/**
 * Duplicate cleanup script (Phase 3).
 * Run AFTER reviewing audit-duplicates.ts output.
 *
 * Usage:
 *   npx tsx scripts/merge-duplicates.ts --dry-run     ← preview only
 *   npx tsx scripts/merge-duplicates.ts --confirm     ← actually write
 *
 * Strategy:
 *  Screenings:  per patient keep the EARLIEST screening.
 *               If any later screening has a linked surgery (createdFromScreeningId),
 *               re-point that surgery to the earliest screening, then delete the duplicate.
 *               If the earlier screening has recommendation != 'Refer for Surgery' but the
 *               later one does, promote the later one to primary first.
 *
 *  Surgeries:   per patient keep the MOST COMPLETE (Completed > Scheduled > Postponed > Cancelled).
 *               Re-point all follow-ups from dropped surgeries to the kept surgery.
 *               Delete the duplicates.
 */

import { config } from 'dotenv';

config({ path: '.env.local', quiet: true });
config({ path: '.env', quiet: true });

import { PrismaClient } from '../lib/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const dryRun = !process.argv.includes('--confirm');

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
  ssl: { rejectUnauthorized: false },
  max: 2,
});
const prisma = new PrismaClient({ adapter } as never);

const STATUS_RANK: Record<string, number> = {
  Completed: 4,
  Scheduled: 3,
  Postponed: 2,
  Cancelled: 1,
};

function log(msg: string) { console.log('  ' + msg); }
function warn(msg: string) { console.warn('  ⚠️  ' + msg); }
function act(msg: string) { console.log((dryRun ? '  [DRY] ' : '  ✔ ') + msg); }

async function mergeScreenings() {
  console.log('\n── Screening duplicates ──────────────────────────────────────────────');

  const groups = await prisma.screening.groupBy({
    by: ['patientId'],
    _count: { _all: true },
    having: { patientId: { _count: { gt: 1 } } },
  });

  log(`Patients with multiple screenings: ${groups.length}`);

  for (const g of groups) {
    const screenings = await prisma.screening.findMany({
      where: { patientId: g.patientId },
      orderBy: { screenedAt: 'asc' },
    });

    // Pick primary: prefer "Refer for Surgery" recommendation; among those, earliest.
    const referral = screenings.filter((s) => s.recommendation === 'ReferForSurgery');
    const primary = referral[0] ?? screenings[0];
    const duplicates = screenings.filter((s) => s.id !== primary.id);

    log(`Patient ${g.patientId.slice(0, 8)}: keeping screening ${primary.id.slice(0, 8)} (${primary.screenedAt.toISOString().split('T')[0]}, ${primary.recommendation})`);

    for (const dup of duplicates) {
      // Re-point any surgery that was created from this duplicate screening.
      const linkedSurgery = await prisma.surgery.findFirst({
        where: { createdFromScreeningId: dup.id },
        select: { id: true },
      });
      if (linkedSurgery) {
        warn(`Surgery ${linkedSurgery.id.slice(0, 8)} was linked to dup screening ${dup.id.slice(0, 8)} — re-pointing to primary`);
        if (!dryRun) {
          await prisma.surgery.update({
            where: { id: linkedSurgery.id },
            data: { createdFromScreeningId: primary.id },
          });
        }
      }
      act(`Delete duplicate screening ${dup.id.slice(0, 8)} (${dup.screenedAt.toISOString().split('T')[0]})`);
      if (!dryRun) {
        await prisma.screening.delete({ where: { id: dup.id } });
      }
    }
  }
}

async function mergeSurgeries() {
  console.log('\n── Surgery duplicates ────────────────────────────────────────────────');

  const groups = await prisma.surgery.groupBy({
    by: ['patientId'],
    _count: { _all: true },
    having: { patientId: { _count: { gt: 1 } } },
  });

  log(`Patients with multiple surgeries: ${groups.length}`);

  for (const g of groups) {
    const surgeries = await prisma.surgery.findMany({
      where: { patientId: g.patientId },
      orderBy: { scheduledAt: 'asc' },
    });

    // Pick the most complete surgery.
    const primary = surgeries.slice().sort((a, b) => {
      const rankDiff = (STATUS_RANK[String(b.status)] ?? 0) - (STATUS_RANK[String(a.status)] ?? 0);
      if (rankDiff !== 0) return rankDiff;
      return a.scheduledAt.getTime() - b.scheduledAt.getTime();
    })[0];

    const duplicates = surgeries.filter((s) => s.id !== primary.id);
    log(`Patient ${g.patientId.slice(0, 8)}: keeping surgery ${primary.id.slice(0, 8)} (${String(primary.status)}, ${primary.scheduledAt.toISOString().split('T')[0]})`);

    for (const dup of duplicates) {
      const followUps = await prisma.followUp.findMany({
        where: { surgeryId: dup.id },
        select: { id: true, milestone: true },
      });

      for (const fu of followUps) {
        // Re-point follow-up to primary surgery if primary doesn't already have that milestone.
        const milestoneExists = await prisma.followUp.findFirst({
          where: { surgeryId: primary.id, milestone: fu.milestone },
          select: { id: true },
        });
        if (milestoneExists) {
          act(`Delete orphaned follow-up ${fu.id.slice(0, 8)} (milestone ${fu.milestone} already exists on primary)`);
          if (!dryRun) {
            await prisma.followUp.delete({ where: { id: fu.id } });
          }
        } else {
          act(`Re-point follow-up ${fu.id.slice(0, 8)} from dup surgery to primary surgery`);
          if (!dryRun) {
            await prisma.followUp.update({
              where: { id: fu.id },
              data: { surgeryId: primary.id },
            });
          }
        }
      }

      act(`Delete duplicate surgery ${dup.id.slice(0, 8)} (${String(dup.status)}, ${dup.scheduledAt.toISOString().split('T')[0]})`);
      if (!dryRun) {
        await prisma.surgery.delete({ where: { id: dup.id } });
      }
    }
  }
}

async function main() {
  console.log('\n🔧  Eye Care System — Duplicate Cleanup');
  console.log(dryRun ? '    MODE: DRY RUN (add --confirm to apply)\n' : '    MODE: LIVE WRITE\n');

  await mergeScreenings();
  await mergeSurgeries();

  console.log('\n── Done ──────────────────────────────────────────────────────────────');
  if (dryRun) {
    console.log('  Re-run with --confirm to apply these changes.');
  } else {
    console.log('  Cleanup complete. Run audit-duplicates.ts again to verify.');
  }

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
