import { config } from 'dotenv';
import { readFileSync } from 'fs';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../lib/generated/prisma/client';
import { createClient } from '@supabase/supabase-js';

config({ path: '.env.local' });

const DEMO = 'DEMO_REGIONAL_WORKFLOW_V1';
const DEMO_PASSWORD = 'Demo123!';

const REGIONAL_CAMPAIGN_AREAS = [
  { region: 'Banadir / Mogadishu', defaultDistrict: 'Mogadishu', defaultSurgeryTarget: 800 },
  { region: 'Koofur Galbeed Somalia', defaultDistrict: 'Baydhabo', defaultSurgeryTarget: 400 },
  { region: 'Hiiraan State', defaultDistrict: 'Beledweyne', defaultSurgeryTarget: 400 },
  { region: 'Hirshabelle State', defaultDistrict: 'Jowhar', defaultSurgeryTarget: 400 },
  { region: 'Jubaland', defaultDistrict: 'Kismaayo', defaultSurgeryTarget: 400 },
  { region: 'Galmudug', defaultDistrict: 'Dhuusamareeb', defaultSurgeryTarget: 400 },
  { region: 'Puntland', defaultDistrict: 'Puntland / selected city', defaultSurgeryTarget: 400 },
  { region: 'Khatumo State', defaultDistrict: 'Laascanood', defaultSurgeryTarget: 400 },
  { region: 'Somaliland', defaultDistrict: 'Boorama', defaultSurgeryTarget: 400 },
] as const;

const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: process.env.DATABASE_URL!,
    ssl: { rejectUnauthorized: false },
  }),
});

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

function dateOffset(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date;
}

function isoDate(days: number) {
  return dateOffset(days).toISOString().split('T')[0];
}

function patientCode(index: number) {
  return `DEMO-${String(index).padStart(4, '0')}`;
}

async function clearDemo() {
  const patients = await prisma.patient.findMany({
    where: { patientCode: { startsWith: 'DEMO-' } },
    select: { id: true },
  });
  const patientIds = patients.map((patient) => patient.id);
  const campaigns = await prisma.campaign.findMany({
    where: { description: { contains: DEMO } },
    select: { id: true },
  });
  const campaignIds = campaigns.map((campaign) => campaign.id);

  await prisma.auditLog.deleteMany({ where: { details: { contains: DEMO } } });
  await prisma.followUp.deleteMany({ where: { OR: [{ patientId: { in: patientIds } }, { campaignId: { in: campaignIds } }] } });
  await prisma.surgery.deleteMany({ where: { OR: [{ patientId: { in: patientIds } }, { campaignId: { in: campaignIds } }] } });
  await prisma.screening.deleteMany({ where: { OR: [{ patientId: { in: patientIds } }, { campaignId: { in: campaignIds } }] } });
  await prisma.patient.deleteMany({ where: { id: { in: patientIds } } });
  await prisma.campaign.deleteMany({ where: { id: { in: campaignIds } } });

  const { data } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
  const demoUsers = data?.users.filter((user) =>
    user.email?.endsWith('@demo.eyecare.local') ||
    user.user_metadata?.demoMarker === DEMO
  ) ?? [];

  for (const user of demoUsers) {
    await supabaseAdmin.auth.admin.deleteUser(user.id);
  }
}

async function ensureSchema() {
  const sql = readFileSync('prisma/migrations/20260613120000_focus_regional_campaign_workflow/migration.sql', 'utf8');
  const statements = sql.split(';').map((statement) => statement.trim()).filter(Boolean);
  for (const statement of statements) {
    await prisma.$executeRawUnsafe(statement);
  }
}

async function main() {
  await ensureSchema();

  if (process.argv.includes('--clear')) {
    await clearDemo();
    console.log('Cleared focused workflow demo data.');
    return;
  }

  await clearDemo();

  const managerNames = [
    'Abdullahi Hassan',
    'Hodan Mohamed',
    'Yusuf Ali',
    'Amina Warsame',
    'Sahra Ahmed',
    'Omar Farah',
    'Maryan Osman',
    'Khalid Jama',
    'Ifrah Nur',
  ];

  const superAdmin = await createDemoAuthUser({
    email: 'super.admin@demo.eyecare.local',
    name: 'Demo Super Admin',
    role: 'Super Administrator',
    assignedRegion: undefined,
    color: '#0d9488',
  });

  const projectManagers: { id: string; name: string; region: string }[] = [];
  for (const [index, area] of REGIONAL_CAMPAIGN_AREAS.entries()) {
    const manager = await createDemoAuthUser({
      email: `pm.${slug(area.region)}@demo.eyecare.local`,
      name: managerNames[index],
      role: 'Project Manager',
      assignedRegion: area.region,
      color: '#f59e0b',
    });
    projectManagers.push({
      id: manager.id,
      name: manager.name,
      region: area.region,
    });

    await createDemoAuthUser({
      email: `clerk.${slug(area.region)}@demo.eyecare.local`,
      name: `Demo Clerk ${area.region}`,
      role: 'Data Clerk',
      assignedRegion: area.region,
      color: '#64748b',
    });

    await createDemoAuthUser({
      email: `screener.${slug(area.region)}@demo.eyecare.local`,
      name: `Demo Screener ${area.region}`,
      role: 'Screening Officer',
      assignedRegion: area.region,
      color: '#06b6d4',
    });
  }

  const campaigns = await Promise.all(REGIONAL_CAMPAIGN_AREAS.map((area, index) => {
    const manager = projectManagers[index];
    const isLazyRegion = area.region === 'Khatumo State';
    return prisma.campaign.create({
      data: {
        name: `${area.region} Cataract Surgery Campaign`,
        type: 'Cataract',
        status: isLazyRegion ? 'Planned' : 'Active',
        region: area.region,
        operationDistrict: area.region === 'Galmudug' ? 'Guriceel' : area.defaultDistrict,
        projectManagerId: manager.id,
        projectManagerName: manager.name,
        startDate: new Date(isoDate(-20 - index)),
        endDate: new Date(isoDate(40 + index)),
        budget: area.defaultSurgeryTarget * 35,
        donors: 'Demo donor pool',
        targetScreenings: area.defaultSurgeryTarget * 2,
        targetSurgeries: area.defaultSurgeryTarget,
        targetFollowUps: area.defaultSurgeryTarget * 2,
        description: `${DEMO} seeded campaign for visual testing.`,
      },
    });
  }));

  let patientIndex = 1;
  for (const [regionIndex, campaign] of campaigns.entries()) {
    const manager = projectManagers[regionIndex];
    const volumeByRegion: Record<string, number> = {
      'Banadir / Mogadishu': 18,
      'Koofur Galbeed Somalia': 10,
      'Hiiraan State': 7,
      'Hirshabelle State': 5,
      Jubaland: 9,
      Galmudug: 8,
      Puntland: 4,
      'Khatumo State': 0,
      Somaliland: 2,
    };
    const volume = volumeByRegion[campaign.region] ?? 4;

    for (let i = 0; i < volume; i += 1) {
      const fullName = `${['Ahmed Ali', 'Fatima Hassan', 'Mohamed Osman', 'Asha Yusuf', 'Hassan Warsame', 'Sahra Noor'][i % 6]} ${campaign.region.split(' ')[0]} ${i + 1}`;
      const patient = await prisma.patient.create({
        data: {
          patientCode: patientCode(patientIndex),
          fullName,
          dateOfBirth: new Date(`${1950 + (i % 35)}-02-15`),
          sex: i % 2 === 0 ? 'Male' : 'Female',
          phone: `+25261${String(700000 + patientIndex).padStart(6, '0')}`,
          email: null,
          district: campaign.operationDistrict,
          region: campaign.region,
          operationDistrict: campaign.operationDistrict,
          occupation: ['Farmer', 'Teacher', 'Trader', 'Retired'][i % 4],
          education: ['None', 'Primary', 'Secondary'][i % 3],
          disabilityStatus: i % 7 === 0 ? 'Visual' : 'None',
          insuranceStatus: 'None',
          emergencyContact: 'Family contact',
          emergencyPhone: `+25261${String(800000 + patientIndex).padStart(6, '0')}`,
          consentGiven: true,
          consentDate: dateOffset(-10),
          campaignId: campaign.id,
          referralSource: 'Campaign walk-in',
          notes: `${DEMO} seeded patient`,
          registeredById: `demo-clerk-${regionIndex + 1}`,
          registeredByName: `Demo Data Clerk ${regionIndex + 1}`,
          screeningStatus: i % 5 === 4 ? 'Awaiting Screening' : 'Screened',
        },
      });

      if (i % 5 !== 4) {
        const needsSurgery = i % 3 !== 2;
        const screening = await prisma.screening.create({
          data: {
            patientId: patient.id,
            patientName: patient.fullName,
            campaignId: campaign.id,
            region: campaign.region,
            operationDistrict: campaign.operationDistrict,
            screenedBy: `Demo Screener ${regionIndex + 1}`,
            screenedById: `demo-screener-${regionIndex + 1}`,
            screenedByName: `Demo Screener ${regionIndex + 1}`,
            screenedAt: dateOffset(-8 + i),
            vaRightUnaided: needsSurgery ? 'V6_60' : 'V6_18',
            vaLeftUnaided: needsSurgery ? 'LT6_60' : 'V6_24',
            cataractSuspected: needsSurgery,
            glaucomaSuspected: i % 6 === 0,
            diabeticRetinopathy: i % 8 === 0,
            otherFindings: needsSurgery ? 'Lens opacity visible' : 'Mild refractive error',
            medicalHistory: 'No major history reported',
            currentMedications: '',
            recommendation: needsSurgery ? 'ReferForSurgery' : 'Glasses',
            notes: `${DEMO} seeded screening`,
          },
        });

        if (needsSurgery) {
          const status = i % 4 === 0 ? 'Completed' : i % 7 === 0 ? 'Postponed' : 'Scheduled';
          const performedAt = status === 'Completed' ? dateOffset(-2 - (i % 4)) : null;
          const surgery = await prisma.surgery.create({
            data: {
              patientId: patient.id,
              patientName: patient.fullName,
              campaignId: campaign.id,
              region: campaign.region,
              operationDistrict: campaign.operationDistrict,
              createdFromScreeningId: screening.id,
              surgeonName: `Demo Doctor ${regionIndex + 1}`,
              eye: i % 2 === 0 ? 'Right' : 'Left',
              lensType: 'FoldableAcrylic',
              scheduledAt: dateOffset(i % 4 === 0 ? -3 : 5 + i),
              performedAt,
              status,
              preOpVa: '6/60',
              postOpVa: status === 'Completed' ? '6/18' : null,
              complications: '',
              intraopNotes: `${DEMO} seeded surgery`,
              completedById: status === 'Completed' ? `demo-screener-${regionIndex + 1}` : '',
              completedByName: status === 'Completed' ? `Demo Screener ${regionIndex + 1}` : '',
            },
          });

          if (status === 'Completed' && performedAt) {
            for (const [milestone, days] of [['Day1', 1], ['Week1', 7]] as const) {
              await prisma.followUp.create({
                data: {
                  patientId: patient.id,
                  patientName: patient.fullName,
                  surgeryId: surgery.id,
                  campaignId: campaign.id,
                  region: campaign.region,
                  milestone,
                  dueDate: new Date(performedAt.getTime() + days * 86400_000),
                  completedAt: days === 1 ? dateOffset(-1) : null,
                  status: days === 1 ? 'Completed' : i % 8 === 0 ? 'Overdue' : 'Pending',
                  vaRightPost: days === 1 ? '6/24' : null,
                  vaLeftPost: days === 1 ? '6/24' : null,
                  complications: i % 8 === 0 ? 'Redness and discomfort reported' : '',
                  notes: `${DEMO} seeded follow-up`,
                  needsDoctorReview: i % 8 === 0,
                  completedById: days === 1 ? `demo-screener-${regionIndex + 1}` : '',
                  completedByName: days === 1 ? `Demo Screener ${regionIndex + 1}` : '',
                },
              });
            }
          }
        }
      }

      patientIndex += 1;
    }

    await prisma.auditLog.create({
      data: {
        actor: `${superAdmin.name} (Super Administrator)`,
        actorId: superAdmin.id,
        actorName: superAdmin.name,
        actorRole: 'Super Administrator',
        action: 'demo-seed',
        entity: 'Campaign',
        entityId: campaign.id,
        region: campaign.region,
        campaignId: campaign.id,
        details: `${DEMO} seeded workflow data for ${campaign.region}`,
      },
    });

    await prisma.auditLog.create({
      data: {
        actor: `${manager.name} (Project Manager)`,
        actorId: manager.id,
        actorName: manager.name,
        actorRole: 'Project Manager',
        action: 'demo-seed',
        entity: 'Campaign',
        entityId: campaign.id,
        region: campaign.region,
        campaignId: campaign.id,
        details: `${DEMO} seeded workflow data for ${campaign.region}`,
      },
    });
  }

  console.log(`Seeded focused workflow demo data: ${campaigns.length} campaigns, ${patientIndex - 1} patients.`);
  console.log(`Seeded demo auth users: 1 Super Admin, ${REGIONAL_CAMPAIGN_AREAS.length} Project Managers, ${REGIONAL_CAMPAIGN_AREAS.length} Data Clerks, ${REGIONAL_CAMPAIGN_AREAS.length} Screening Officers.`);
  console.log(`Demo password for all demo users: ${DEMO_PASSWORD}`);
  console.log('Example logins:');
  console.log('  super.admin@demo.eyecare.local');
  console.log('  pm.galmudug@demo.eyecare.local');
  console.log('  clerk.galmudug@demo.eyecare.local');
  console.log('  screener.galmudug@demo.eyecare.local');
  console.log('Run `npm run clear:demo` to delete this demo data.');
}

function slug(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '.')
    .replace(/^\.+|\.+$/g, '');
}

function initials(name: string) {
  return name.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase();
}

async function createDemoAuthUser(input: {
  email: string;
  name: string;
  role: 'Super Administrator' | 'Project Manager' | 'Data Clerk' | 'Screening Officer';
  assignedRegion?: string;
  color: string;
}) {
  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email: input.email,
    password: DEMO_PASSWORD,
    email_confirm: true,
    user_metadata: {
      name: input.name,
      role: input.role,
      assignedRegion: input.assignedRegion,
      initials: initials(input.name),
      color: input.color,
      demoMarker: DEMO,
    },
  });

  if (error) throw error;
  return { id: data.user.id, name: input.name };
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
