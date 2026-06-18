import { config } from 'dotenv';

config({ path: '.env.local', quiet: true });
config({ path: '.env', quiet: true });

const DEMO_EMAIL_DOMAIN = '@demo.eyecare.local';
const TODAY = new Date('2026-06-17T09:00:00.000Z');

function uuid(seed: number) {
  return `00000000-0000-4000-8000-${seed.toString(16).padStart(12, '0')}`;
}

function dateOnly(year: number, month: number, day: number) {
  return new Date(Date.UTC(year, month - 1, day));
}

function dateTime(year: number, month: number, day: number, hour = 8, minute = 0) {
  return new Date(Date.UTC(year, month - 1, day, hour, minute));
}

function addDays(base: Date, days: number) {
  const next = new Date(base);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function initials(name: string) {
  return name.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase();
}

const demoUsers = [
  { id: uuid(1), name: 'Demo Super Admin', email: `superadmin${DEMO_EMAIL_DOMAIN}`, role: 'SuperAdministrator', assignedRegion: null, color: '#0f766e' },
  { id: uuid(2), name: 'Ayaan Warsame', email: `pm.galmudug${DEMO_EMAIL_DOMAIN}`, role: 'ProjectManager', assignedRegion: 'Galmudug', color: '#2563eb' },
  { id: uuid(3), name: 'Fahad Mire', email: `pm.puntland${DEMO_EMAIL_DOMAIN}`, role: 'ProjectManager', assignedRegion: 'Puntland', color: '#7c3aed' },
  { id: uuid(4), name: 'Nasra Ali', email: `pm.banadir${DEMO_EMAIL_DOMAIN}`, role: 'ProjectManager', assignedRegion: 'Banadir / Mogadishu', color: '#dc2626' },
  { id: uuid(5), name: 'Hodan Jama', email: `pm.jubaland${DEMO_EMAIL_DOMAIN}`, role: 'ProjectManager', assignedRegion: 'Jubaland', color: '#16a34a' },
  { id: uuid(6), name: 'Leila Yusuf', email: `clerk.galmudug${DEMO_EMAIL_DOMAIN}`, role: 'DataClerk', assignedRegion: 'Galmudug', color: '#0891b2' },
  { id: uuid(7), name: 'Said Roble', email: `clerk.puntland${DEMO_EMAIL_DOMAIN}`, role: 'DataClerk', assignedRegion: 'Puntland', color: '#9333ea' },
  { id: uuid(8), name: 'Muna Hassan', email: `clerk.banadir${DEMO_EMAIL_DOMAIN}`, role: 'DataClerk', assignedRegion: 'Banadir / Mogadishu', color: '#ea580c' },
  { id: uuid(9), name: 'Abdi Osman', email: `clerk.jubaland${DEMO_EMAIL_DOMAIN}`, role: 'DataClerk', assignedRegion: 'Jubaland', color: '#15803d' },
  { id: uuid(10), name: 'Omar Farah', email: `screener.galmudug${DEMO_EMAIL_DOMAIN}`, role: 'ScreeningOfficer', assignedRegion: 'Galmudug', color: '#0d9488' },
  { id: uuid(11), name: 'Maryan Nur', email: `screener.puntland${DEMO_EMAIL_DOMAIN}`, role: 'ScreeningOfficer', assignedRegion: 'Puntland', color: '#6d28d9' },
  { id: uuid(12), name: 'Khadar Ali', email: `screener.banadir${DEMO_EMAIL_DOMAIN}`, role: 'ScreeningOfficer', assignedRegion: 'Banadir / Mogadishu', color: '#b91c1c' },
  { id: uuid(13), name: 'Ifrah Ahmed', email: `screener.jubaland${DEMO_EMAIL_DOMAIN}`, role: 'ScreeningOfficer', assignedRegion: 'Jubaland', color: '#047857' },
] as const;

const campaigns = [
  {
    id: uuid(100),
    name: 'Somalia Cataract Outreach - June 2026',
    type: 'CataractSurgeryOutreach',
    status: 'Active',
    startDate: dateOnly(2026, 6, 1),
    endDate: dateOnly(2026, 8, 31),
    description: 'Demo cataract campaign with sub-region assignment, surgical workflow, and follow-up outcomes.',
    notes: 'Seeded demo campaign. Parent campaign intentionally has no manager or region assignment.',
    regions: [
      { id: uuid(101), region: 'Galmudug', district: 'Dhuusamareeb', managerId: uuid(2), managerName: 'Ayaan Warsame', clerkId: uuid(6), clerkName: 'Leila Yusuf', screenerId: uuid(10), screenerName: 'Omar Farah' },
      { id: uuid(102), region: 'Puntland', district: 'Garoowe', managerId: uuid(3), managerName: 'Fahad Mire', clerkId: uuid(7), clerkName: 'Said Roble', screenerId: uuid(11), screenerName: 'Maryan Nur' },
    ],
  },
  {
    id: uuid(200),
    name: 'Urban Eye Vision Outreach - June 2026',
    type: 'EyeVisionOutreach',
    status: 'Active',
    startDate: dateOnly(2026, 6, 10),
    endDate: dateOnly(2026, 9, 15),
    description: 'Demo vision outreach campaign showing no-surgery releases, referrals, surgeries, and review follow-ups.',
    notes: 'Seeded demo campaign. Parent campaign intentionally has no manager or region assignment.',
    regions: [
      { id: uuid(201), region: 'Banadir / Mogadishu', district: 'Mogadishu', managerId: uuid(4), managerName: 'Nasra Ali', clerkId: uuid(8), clerkName: 'Muna Hassan', screenerId: uuid(12), screenerName: 'Khadar Ali' },
      { id: uuid(202), region: 'Jubaland', district: 'Kismaayo', managerId: uuid(5), managerName: 'Hodan Jama', clerkId: uuid(9), clerkName: 'Abdi Osman', screenerId: uuid(13), screenerName: 'Ifrah Ahmed' },
    ],
  },
] as const;

const firstNames = [
  'Amina', 'Hassan', 'Maryan', 'Abdi', 'Fadumo', 'Yusuf', 'Sahra', 'Omar', 'Hodan', 'Ahmed',
  'Ifrah', 'Mohamed', 'Nasra', 'Ali', 'Leyla', 'Said', 'Nimco', 'Farah', 'Khadra', 'Jama',
  'Zahra', 'Ismail', 'Halima', 'Abshir', 'Muna', 'Warsame', 'Samira', 'Bashir', 'Ruqiya', 'Nuur',
];
const lastNames = ['Hersi', 'Nur', 'Osman', 'Ali', 'Mire', 'Jama', 'Roble', 'Farah', 'Hassan', 'Warsame'];
const referralSources = ['Campaign walk-in', 'Community health worker', 'Self-referral', 'Doctor referral', 'NGO partner', 'Radio / TV campaign'];
const occupations = ['Market vendor', 'Teacher', 'Farmer', 'Driver', 'Homemaker', 'Student', 'Retired', 'Fisher'];
const education = ['None', 'Primary', 'Secondary', 'College'];

async function main() {
  if (!process.argv.includes('--confirm')) {
    throw new Error('Refusing to reset demo data without --confirm.');
  }

  const { prisma } = await import('../lib/prisma');

  console.log('Cleaning existing operational demo data...');
  await prisma.followUpMedication.deleteMany({});
  await prisma.followUp.deleteMany({});
  await prisma.surgery.deleteMany({});
  await prisma.screening.deleteMany({});
  await prisma.patient.deleteMany({});
  await prisma.campaignRegion.deleteMany({});
  await prisma.campaign.deleteMany({});
  await prisma.auditLog.deleteMany({});
  await prisma.user.deleteMany({ where: { email: { endsWith: DEMO_EMAIL_DOMAIN } } });

  console.log('Creating scoped demo users...');
  for (const user of demoUsers) {
    await prisma.user.create({
      data: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        assignedRegion: user.assignedRegion,
        initials: initials(user.name),
        color: user.color,
        active: true,
        createdAt: dateTime(2026, 6, 1, 7),
      },
    });
  }

  let patientSeq = 1;
  let screeningSeq = 1;
  let surgerySeq = 1;
  let followUpSeq = 1;
  let medicationSeq = 1;
  let auditSeq = 1;

  for (const campaign of campaigns) {
    await prisma.campaign.create({
      data: {
        id: campaign.id,
        name: campaign.name,
        type: campaign.type,
        status: campaign.status,
        region: '',
        operationDistrict: '',
        projectManagerId: '',
        projectManagerName: '',
        startDate: campaign.startDate,
        endDate: campaign.endDate,
        targetScreenings: 56,
        targetSurgeries: 44,
        targetFollowUps: 72,
        description: campaign.description,
        notes: campaign.notes,
      },
    });

    await prisma.auditLog.create({
      data: {
        id: uuid(8000 + auditSeq++),
        actor: 'Demo Super Admin (Super Administrator)',
        actorId: uuid(1),
        actorName: 'Demo Super Admin',
        actorRole: 'Super Administrator',
        action: 'create',
        entity: 'Campaign',
        entityId: campaign.id,
        campaignId: campaign.id,
        details: `Seeded ${campaign.name}`,
      },
    });

    for (const plan of campaign.regions) {
      await prisma.campaignRegion.create({
        data: {
          id: plan.id,
          campaignId: campaign.id,
          type: campaign.type,
          region: plan.region,
          operationDistrict: plan.district,
          regionalManagerId: plan.managerId,
          regionalManagerName: plan.managerName,
          targetPatients: 32,
          targetScreenings: 28,
          targetSurgeries: 22,
          startDate: campaign.startDate,
          endDate: campaign.endDate,
          status: 'OnTrack',
          notes: `Demo sub-region assigned to ${plan.managerName}.`,
        },
      });

      for (let index = 1; index <= 32; index++) {
        const patientNumber = patientSeq++;
        const firstName = firstNames[(patientNumber - 1) % firstNames.length];
        const lastName = lastNames[(patientNumber + index) % lastNames.length];
        const patientId = uuid(10000 + patientNumber);
        const screeningId = uuid(20000 + screeningSeq++);
        const registeredAt = dateTime(2026, 6, 1 + (index % 12), 8 + (index % 5), 15);
        const screenedAt = addDays(registeredAt, index % 3);
        const awaitingScreening = index <= 4;
        const referredForSurgery = !awaitingScreening && index > 10;
        const recommendation = referredForSurgery
          ? 'ReferForSurgery'
          : index % 4 === 0
            ? 'Positive'
            : 'Discharge';

        await prisma.patient.create({
          data: {
            id: patientId,
            patientCode: `EC-DEMO-${String(patientNumber).padStart(4, '0')}`,
            fullName: `${firstName} ${lastName}`,
            dateOfBirth: dateOnly(1945 + (patientNumber % 45), 1 + (patientNumber % 12), 1 + (patientNumber % 24)),
            sex: patientNumber % 2 === 0 ? 'Male' : 'Female',
            phone: `+25261${String(4000000 + patientNumber).padStart(7, '0')}`,
            district: plan.district,
            region: plan.region,
            operationDistrict: plan.district,
            occupation: occupations[patientNumber % occupations.length],
            education: education[patientNumber % education.length],
            disabilityStatus: patientNumber % 9 === 0 ? 'Visual' : 'None',
            insuranceStatus: patientNumber % 6 === 0 ? 'Community cover' : 'None',
            emergencyContact: `${lastName} Family`,
            emergencyPhone: `+25261${String(5000000 + patientNumber).padStart(7, '0')}`,
            consentGiven: true,
            consentDate: dateOnly(2026, 6, 1 + (index % 12)),
            campaignId: campaign.id,
            campaignRegionId: plan.id,
            referralSource: referralSources[index % referralSources.length],
            notes: index % 10 === 0 ? 'Needs transport support for appointments.' : '',
            registeredById: plan.clerkId,
            registeredByName: plan.clerkName,
            screeningStatus: awaitingScreening ? 'Awaiting Screening' : 'Screened',
            createdAt: registeredAt,
          },
        });

        if (awaitingScreening) continue;

        await prisma.screening.create({
          data: {
            id: screeningId,
            patientId,
            patientName: `${firstName} ${lastName}`,
            campaignId: campaign.id,
            campaignRegionId: plan.id,
            region: plan.region,
            operationDistrict: plan.district,
            screenedBy: plan.screenerName,
            screenedById: plan.screenerId,
            screenedByName: plan.screenerName,
            screenedAt,
            vaRightUnaided: index % 5 === 0 ? 'LT6_60' : index % 3 === 0 ? 'V6_60' : 'V6_36',
            vaLeftUnaided: index % 4 === 0 ? 'V6_60' : index % 3 === 0 ? 'V6_36' : 'V6_24',
            vaRightCorrected: index % 2 === 0 ? 'V6_24' : null,
            vaLeftCorrected: index % 2 === 1 ? 'V6_24' : null,
            iopRight: 12 + (index % 10),
            iopLeft: 13 + (index % 9),
            cataractSuspected: referredForSurgery,
            glaucomaSuspected: index % 13 === 0,
            diabeticRetinopathy: index % 17 === 0,
            otherFindings: recommendation === 'Positive' ? 'Refractive error suspected.' : '',
            medicalHistory: index % 7 === 0 ? 'Diabetes reported by patient.' : 'No major history reported.',
            currentMedications: index % 7 === 0 ? 'Metformin' : '',
            recommendation,
            notes: referredForSurgery ? 'Referred to surgical desk for cataract workup.' : 'No surgery pathway for this visit.',
          },
        });

        if (!referredForSurgery) continue;

        const surgeryLocalIndex = index - 10;
        const surgeryId = uuid(30000 + surgerySeq++);
        const status = surgeryLocalIndex <= 10
          ? 'Scheduled'
          : surgeryLocalIndex <= 19
            ? 'Completed'
            : surgeryLocalIndex <= 21
              ? 'Postponed'
              : 'Cancelled';
        const scheduledAt = addDays(screenedAt, 2 + surgeryLocalIndex);
        const completed = status === 'Completed';
        const performedAt = completed ? addDays(scheduledAt, 0) : null;

        await prisma.surgery.create({
          data: {
            id: surgeryId,
            patientId,
            patientName: `${firstName} ${lastName}`,
            campaignId: campaign.id,
            campaignRegionId: plan.id,
            region: plan.region,
            operationDistrict: plan.district,
            createdFromScreeningId: screeningId,
            surgeonName: status === 'Cancelled' ? null : surgeryLocalIndex % 2 === 0 ? 'Dr. Samatar' : 'Dr. Ilhan',
            eye: surgeryLocalIndex % 3 === 0 ? 'Both' : surgeryLocalIndex % 2 === 0 ? 'Left' : 'Right',
            lensType: surgeryLocalIndex % 2 === 0 ? 'FoldableAcrylic' : 'PMMA',
            scheduledAt,
            performedAt,
            status,
            preOpVa: surgeryLocalIndex % 2 === 0 ? '6/60' : '<6/60',
            postOpVa: completed ? (surgeryLocalIndex % 3 === 0 ? '6/18' : '6/24') : null,
            complications: completed && surgeryLocalIndex % 7 === 0 ? 'Mild corneal edema' : '',
            intraopNotes: completed ? 'Procedure completed under local anesthesia.' : '',
            completedById: completed ? plan.screenerId : '',
            completedByName: completed ? plan.screenerName : '',
            createdAt: addDays(screenedAt, 1),
          },
        });

        if (!completed) continue;

        const followUpPatterns = [
          { milestone: 'Day1', status: 'Completed', dueOffset: 1, completedOffset: 1, review: false },
          { milestone: 'Week1', status: surgeryLocalIndex % 3 === 0 ? 'Overdue' : surgeryLocalIndex % 3 === 1 ? 'Due' : 'Completed', dueOffset: 7, completedOffset: 8, review: surgeryLocalIndex % 3 === 0 },
          { milestone: 'Month1', status: surgeryLocalIndex % 4 === 0 ? 'Pending' : 'Completed', dueOffset: 30, completedOffset: 31, review: surgeryLocalIndex % 5 === 0 },
          { milestone: 'Month3', status: 'Pending', dueOffset: 90, completedOffset: 91, review: false },
        ] as const;

        for (const pattern of followUpPatterns) {
          const followUpId = uuid(40000 + followUpSeq++);
          const isCompleted = pattern.status === 'Completed';
          const needsDoctorReview = pattern.review;
          const reviewCompleted = needsDoctorReview && surgeryLocalIndex % 2 === 0;
          await prisma.followUp.create({
            data: {
              id: followUpId,
              patientId,
              patientName: `${firstName} ${lastName}`,
              surgeryId,
              campaignId: campaign.id,
              campaignRegionId: plan.id,
              region: plan.region,
              milestone: pattern.milestone,
              dueDate: addDays(performedAt ?? TODAY, pattern.dueOffset),
              completedAt: isCompleted ? addDays(performedAt ?? TODAY, pattern.completedOffset) : null,
              status: pattern.status,
              vaRightPost: isCompleted ? '6/24' : null,
              vaLeftPost: isCompleted ? '6/18' : null,
              complications: needsDoctorReview ? 'Blurred vision reported during follow-up.' : '',
              notes: isCompleted ? 'Follow-up completed during outreach clinic.' : 'Follow-up pending patient attendance.',
              needsDoctorReview,
              doctorReviewStatus: needsDoctorReview ? (reviewCompleted ? 'Completed' : 'Pending') : 'NotNeeded',
              doctorReviewedAt: reviewCompleted ? addDays(performedAt ?? TODAY, pattern.completedOffset + 1) : null,
              doctorName: reviewCompleted ? 'Dr. Salma Aden' : '',
              doctorDiagnosis: reviewCompleted ? 'Expected post-operative inflammation.' : '',
              doctorTreatmentPlan: reviewCompleted ? 'Continue drops and review at next milestone.' : '',
              doctorNotes: reviewCompleted ? 'No urgent intervention required.' : '',
              nextAppointmentDate: pattern.milestone === 'Month1' ? addDays(TODAY, 45) : null,
              completedById: isCompleted ? plan.screenerId : '',
              completedByName: isCompleted ? plan.screenerName : '',
              createdAt: addDays(performedAt ?? TODAY, 0),
            },
          });

          if (needsDoctorReview || isCompleted) {
            await prisma.followUpMedication.create({
              data: {
                id: uuid(50000 + medicationSeq++),
                followUpId,
                drugName: needsDoctorReview ? 'Prednisolone acetate' : 'Chloramphenicol',
                dosage: needsDoctorReview ? '1%' : '0.5%',
                frequency: needsDoctorReview ? 'QID' : 'TID',
                duration: needsDoctorReview ? '2 weeks' : '1 week',
                instructions: needsDoctorReview ? 'Taper as directed by doctor.' : 'Apply after hand washing.',
                status: pattern.status === 'Completed' ? 'Completed' : 'Prescribed',
                notes: needsDoctorReview ? 'Linked to doctor review pathway.' : 'Routine post-operative medication.',
              },
            });
          }
        }
      }

      await prisma.auditLog.create({
        data: {
          id: uuid(8000 + auditSeq++),
          actor: `${plan.managerName} (Project Manager)`,
          actorId: plan.managerId,
          actorName: plan.managerName,
          actorRole: 'Project Manager',
          action: 'seed',
          entity: 'CampaignRegion',
          entityId: plan.id,
          region: plan.region,
          campaignId: campaign.id,
          details: `Seeded 30 screened patients for ${plan.region}.`,
        },
      });
    }
  }

  const [
    campaignCount,
    regionCount,
    patientCount,
    screeningCount,
    surgeryCounts,
    followUpCounts,
    medicationCount,
  ] = await Promise.all([
    prisma.campaign.count(),
    prisma.campaignRegion.count(),
    prisma.patient.count(),
    prisma.screening.count(),
    prisma.surgery.groupBy({ by: ['status'], _count: { _all: true }, orderBy: { status: 'asc' } }),
    prisma.followUp.groupBy({ by: ['status', 'doctorReviewStatus'], _count: { _all: true } }),
    prisma.followUpMedication.count(),
  ]);
  const subRegionSummaries = await prisma.campaignRegion.findMany({
    select: {
      region: true,
      operationDistrict: true,
      regionalManagerName: true,
      campaign: { select: { name: true } },
      _count: { select: { patients: true, screenings: true, surgeries: true, followUps: true } },
    },
    orderBy: [{ campaignId: 'asc' }, { region: 'asc' }],
  });

  console.log('Demo seed complete.');
  console.log(JSON.stringify({
    campaigns: campaignCount,
    subRegionCount: regionCount,
    patients: patientCount,
    screenings: screeningCount,
    surgeries: surgeryCounts,
    followUps: followUpCounts,
    medications: medicationCount,
    subRegionDetails: subRegionSummaries.map((item) => ({
      campaign: item.campaign.name,
      region: item.region,
      district: item.operationDistrict,
      manager: item.regionalManagerName,
      patients: item._count.patients,
      screenings: item._count.screenings,
      surgeries: item._count.surgeries,
      followUps: item._count.followUps,
    })),
  }, null, 2));

  await prisma.$disconnect();
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
