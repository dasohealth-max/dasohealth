/**
 * READ-ONLY duplicate audit script.
 * Run:  npx tsx scripts/audit-duplicates.ts
 *
 * Reports:
 *  1. Patients with more than one screening record
 *  2. Patients with more than one surgery record
 *  3. Potential cross-campaign patient duplicates (same normalised name + phone)
 *  4. Sanity check: row counts vs unique-patient counts per region/campaign
 *
 * Nothing is written. Outputs plain text + CSV files to stdout / disk.
 */

import { config } from 'dotenv';

config({ path: '.env.local', quiet: true });
config({ path: '.env', quiet: true });

import { PrismaClient } from '../lib/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { createWriteStream } from 'fs';
import { join } from 'path';

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
  ssl: { rejectUnauthorized: false },
  max: 2,
});
const prisma = new PrismaClient({ adapter } as never);

function normName(name: string) {
  return name.toLowerCase().trim().replace(/\s+/g, ' ');
}
function normPhone(phone: string) {
  return phone.replace(/[^\d]/g, '');
}

function hr(label: string) {
  console.log('\n' + '═'.repeat(70));
  console.log(`  ${label}`);
  console.log('═'.repeat(70));
}

function info(msg: string) { console.log('  ' + msg); }

async function main() {
  console.log('\n🔍  Eye Care System — Duplicate Audit  (read-only)\n');
  console.log('  Connected to:', process.env.DATABASE_URL?.split('@')[1] ?? 'unknown');

  // ── 1. Duplicate screenings ───────────────────────────────────────────────
  hr('1. Patients with multiple screening records');

  const dupScreenings = await prisma.screening.groupBy({
    by: ['patientId'],
    _count: { _all: true },
    having: { patientId: { _count: { gt: 1 } } },
  });

  info(`Patients with >1 screening: ${dupScreenings.length}`);

  const dupScreeningRows: string[] = ['patientCode,patientName,region,screeningCount,screeningIds,screenedAts,screeners'];

  for (const row of dupScreenings) {
    const screenings = await prisma.screening.findMany({
      where: { patientId: row.patientId },
      include: { patient: { select: { patientCode: true, fullName: true, region: true } } },
      orderBy: { screenedAt: 'asc' },
    });
    const patient = screenings[0]?.patient;
    const ids = screenings.map((s) => s.id).join('|');
    const dates = screenings.map((s) => s.screenedAt.toISOString().split('T')[0]).join('|');
    const screeners = screenings.map((s) => s.screenedByName || s.screenedBy).join('|');
    console.log(`    ├─ ${patient?.patientCode ?? '?'} | ${patient?.fullName ?? '?'} | ${patient?.region ?? '?'} | ${row._count._all} screenings`);
    for (const s of screenings) {
      console.log(`    │   ├─ [${s.id.slice(0, 8)}] ${s.screenedAt.toISOString().split('T')[0]} by ${s.screenedByName || s.screenedBy} → ${s.recommendation}`);
    }
    dupScreeningRows.push(`"${patient?.patientCode}","${patient?.fullName}","${patient?.region}",${row._count._all},"${ids}","${dates}","${screeners}"`);
  }

  // ── 2. Duplicate surgeries ────────────────────────────────────────────────
  hr('2. Patients with multiple surgery records');

  const dupSurgeries = await prisma.surgery.groupBy({
    by: ['patientId'],
    _count: { _all: true },
    having: { patientId: { _count: { gt: 1 } } },
  });

  info(`Patients with >1 surgery: ${dupSurgeries.length}`);

  const dupSurgeryRows: string[] = ['patientCode,patientName,region,surgeryCount,surgeryIds,statuses,scheduledAts,surgeons'];

  for (const row of dupSurgeries) {
    const surgeries = await prisma.surgery.findMany({
      where: { patientId: row.patientId },
      include: { patient: { select: { patientCode: true, fullName: true, region: true } } },
      orderBy: { scheduledAt: 'asc' },
    });
    const patient = surgeries[0]?.patient;
    const ids = surgeries.map((s) => s.id).join('|');
    const statuses = surgeries.map((s) => s.status).join('|');
    const dates = surgeries.map((s) => s.scheduledAt.toISOString().split('T')[0]).join('|');
    const surgeons = surgeries.map((s) => s.surgeonName || '').join('|');
    const followUpCount = await prisma.followUp.count({ where: { patientId: row.patientId } });
    console.log(`    ├─ ${patient?.patientCode ?? '?'} | ${patient?.fullName ?? '?'} | ${patient?.region ?? '?'} | ${row._count._all} surgeries | ${followUpCount} follow-ups`);
    for (const s of surgeries) {
      const fuCount = await prisma.followUp.count({ where: { surgeryId: s.id } });
      console.log(`    │   ├─ [${s.id.slice(0, 8)}] ${s.status} ${s.scheduledAt.toISOString().split('T')[0]} | surgeon: ${s.surgeonName || '–'} | FUs: ${fuCount} | from screening: ${s.createdFromScreeningId?.slice(0, 8) ?? 'manual'}`);
    }
    dupSurgeryRows.push(`"${patient?.patientCode}","${patient?.fullName}","${patient?.region}",${row._count._all},"${ids}","${statuses}","${dates}","${surgeons}"`);
  }

  // ── 3. Cross-campaign duplicates (same name+phone in different campaigns) ─
  hr('3. Potential cross-campaign patient duplicates (same name + phone)');

  const allPatients = await prisma.patient.findMany({
    select: { id: true, patientCode: true, fullName: true, phone: true, campaignId: true, region: true, screeningStatus: true },
    orderBy: { createdAt: 'asc' },
  });

  const namePhoneMap = new Map<string, typeof allPatients>();
  for (const p of allPatients) {
    const key = `${normName(p.fullName)}__${normPhone(p.phone)}`;
    const bucket = namePhoneMap.get(key) ?? [];
    bucket.push(p);
    namePhoneMap.set(key, bucket);
  }

  const crossDups = [...namePhoneMap.values()].filter((bucket) => {
    const campaigns = new Set(bucket.map((p) => p.campaignId));
    return campaigns.size > 1;
  });

  info(`Patient name+phone combinations appearing in multiple campaigns: ${crossDups.length}`);

  const crossDupRows: string[] = ['name,phone,count,patientCodes,regions,campaignIds,screeningStatuses'];

  for (const bucket of crossDups) {
    const first = bucket[0];
    console.log(`    ├─ "${first.fullName}" | ${first.phone} | ${bucket.length} records`);
    for (const p of bucket) {
      console.log(`    │   ├─ ${p.patientCode} | ${p.region} | campaign: ${p.campaignId?.slice(0, 8) ?? 'none'} | ${p.screeningStatus}`);
    }
    const codes = bucket.map((p) => p.patientCode).join('|');
    const regions = bucket.map((p) => p.region).join('|');
    const campaigns = bucket.map((p) => p.campaignId ?? '').join('|');
    const statuses = bucket.map((p) => p.screeningStatus).join('|');
    crossDupRows.push(`"${first.fullName}","${first.phone}",${bucket.length},"${codes}","${regions}","${campaigns}","${statuses}"`);
  }

  // ── 4. Sanity check: row counts vs unique patient counts ──────────────────
  hr('4. Row counts vs unique-patient counts (inflation check)');

  const campaigns = await prisma.campaign.findMany({
    select: { id: true, name: true, region: true, targetSurgeries: true },
    orderBy: { createdAt: 'desc' },
  });

  console.log(`\n  ${'Campaign'.padEnd(40)} ${'Region'.padEnd(28)} ${'Pts'.padStart(5)} ${'ScreenRows'.padStart(11)} ${'UniqueScreened'.padStart(15)} ${'SurgRows'.padStart(9)} ${'UniqueSurg'.padStart(11)}`);
  console.log('  ' + '─'.repeat(130));

  let totalInflatedScreenings = 0;
  let totalInflatedSurgeries = 0;

  const sanityRows: string[] = ['campaign,region,patients,screeningRows,uniqueScreenedPatients,screeningInflation,surgeryRows,uniqueSurgeryPatients,surgeryInflation'];

  for (const c of campaigns) {
    const [patients, screeningGroups, surgeryGroups] = await Promise.all([
      prisma.patient.count({ where: { campaignId: c.id } }),
      prisma.screening.groupBy({ by: ['patientId'], where: { campaignId: c.id } }),
      prisma.surgery.groupBy({ by: ['patientId'], where: { campaignId: c.id } }),
    ]);
    const screeningRows = await prisma.screening.count({ where: { campaignId: c.id } });
    const surgeryRows = await prisma.surgery.count({ where: { campaignId: c.id } });
    const uniqueScreened = screeningGroups.length;
    const uniqueSurg = surgeryGroups.length;
    const sInflation = screeningRows - uniqueScreened;
    const surgInflation = surgeryRows - uniqueSurg;
    totalInflatedScreenings += sInflation;
    totalInflatedSurgeries += surgInflation;

    const flag = sInflation > 0 || surgInflation > 0 ? ' ⚠️' : '';
    console.log(`  ${c.name.slice(0, 38).padEnd(40)} ${c.region.slice(0, 26).padEnd(28)} ${String(patients).padStart(5)} ${String(screeningRows).padStart(11)} ${String(uniqueScreened).padStart(15)} ${String(surgeryRows).padStart(9)} ${String(uniqueSurg).padStart(11)}${flag}`);
    sanityRows.push(`"${c.name}","${c.region}",${patients},${screeningRows},${uniqueScreened},${sInflation},${surgeryRows},${uniqueSurg},${surgInflation}`);
  }

  console.log(`\n  Total extra screening rows (inflation): ${totalInflatedScreenings}`);
  console.log(`  Total extra surgery rows (inflation):   ${totalInflatedSurgeries}`);

  // ── Write CSVs ────────────────────────────────────────────────────────────
  hr('Writing CSV report files');

  const outDir = join(process.cwd(), 'scripts');

  const writeCSV = (filename: string, rows: string[]) => {
    const path = join(outDir, filename);
    const ws = createWriteStream(path);
    for (const row of rows) ws.write(row + '\n');
    ws.end();
    info(`Wrote ${filename}  (${rows.length - 1} rows)`);
  };

  writeCSV('audit-dup-screenings.csv', dupScreeningRows);
  writeCSV('audit-dup-surgeries.csv', dupSurgeryRows);
  writeCSV('audit-dup-cross-campaign.csv', crossDupRows);
  writeCSV('audit-sanity-counts.csv', sanityRows);

  hr('SUMMARY');
  info(`Patients with duplicate screenings:          ${dupScreenings.length}`);
  info(`Patients with duplicate surgeries:           ${dupSurgeries.length}`);
  info(`Cross-campaign duplicate name+phone pairs:  ${crossDups.length}`);
  info(`Total excess screening rows (inflation):     ${totalInflatedScreenings}`);
  info(`Total excess surgery rows (inflation):       ${totalInflatedSurgeries}`);
  info('');
  info('Review the CSV files in scripts/ then run merge-duplicates.ts if needed.');

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
