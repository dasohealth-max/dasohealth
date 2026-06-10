import { config } from 'dotenv';
config({ path: '.env.local' });

import { PrismaClient } from '../lib/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
  ssl: { rejectUnauthorized: false },
});
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const prisma = new PrismaClient({ adapter } as any);

const D = '[DEMO]'; // tag stored in notes/description fields

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function pick<T>(arr: readonly T[], i: number): T { return arr[i % arr.length]; }
function addDays(d: Date, n: number): Date { const r = new Date(d); r.setDate(r.getDate() + n); return r; }
function ago(days: number): Date { return addDays(new Date(), -days); }

// ---------------------------------------------------------------------------
// Reference data
// ---------------------------------------------------------------------------
const MALE_NAMES = [
  'Abdi Mohamed','Hassan Ali','Mohamed Ahmed','Omar Ibrahim','Yusuf Hassan',
  'Abdullahi Said','Mukhtar Osman','Dalmar Jama','Bashir Farah','Idris Warsame',
  'Salad Nur','Ahmed Duale','Ismail Shire','Zakariye Muse','Guled Salah',
  'Deeq Ahmed','Faarax Ibrahim','Saciid Abubakar','Cabdi Xasan','Maxamed Cumar',
  'Xuseen Farah','Nuur Cali','Khadar Mohamed','Liibaan Hassan','Mahad Osman',
  'Sharif Ibrahim','Tahlil Warsame','Aden Farah','Barre Hassan','Cawil Ibrahim',
  'Dayib Jama','Egal Muse','Faisal Salad','Gaas Warsame','Hiil Ahmed',
  'Jawaab Hassan','Kaahin Farah','Laascaanood Ali','Nimco Ibrahim','Ogle Jama',
];
const FEMALE_NAMES = [
  'Faadumo Ali','Hodan Mohamed','Sagal Hassan','Nasteho Ahmed','Maryan Osman',
  'Ikran Jama','Fartun Said','Halimo Nur','Caasha Warsame','Anab Hassan',
  'Amina Mohamed','Ifrah Omar','Lul Ahmed','Ruqiyo Ibrahim','Khadra Salad',
  'Safia Osman','Deeqa Maxamed','Nimo Bashir','Asad Ibrahim','Bile Farah',
  'Caado Cali','Daaliya Hassan','Ebyan Farah','Filsan Abdi','Garaad Jama',
  'Hibo Warsame','Istar Mohamed','Jawahir Shire','Kiin Muse','Layla Salah',
  'Mursal Ahmed','Nuurto Ibrahim','Qamar Ali','Roda Farah','Timiro Abdi',
  'Ubah Mohamed','Waris Omar','Xaawo Jama','Yurub Hassan','Zuhur Farah',
];
const OCCUPATIONS = [
  'Farmer','Teacher','Trader','Housewife','Fisherman','Herder',
  'Civil Servant','Carpenter','Tailor','Driver','Nurse','Business Owner',
];
const OFFICERS = [
  'Dr. Amina Hassan','Dr. Yusuf Mohamed','Dr. Faadumo Nur','Dr. Ahmed Ibrahim','Dr. Hodan Salah',
];
const SURGEONS = [
  'Dr. Mohamed Hassan','Dr. Abdi Nur','Dr. Faadumo Warsame','Dr. Omar Jama',
];

// Prisma-side enum names (before @map)
const VA_POOR  = ['V6_36','V6_60','LT6_60','CF','HM'] as const;
const VA_GOOD  = ['V6_6','V6_9','V6_12','V6_18'] as const;
const VA_MID   = ['V6_18','V6_24','V6_36'] as const;

// ---------------------------------------------------------------------------
// CLEAR
// ---------------------------------------------------------------------------
async function clearDemo() {
  console.log('🗑  Removing demo data …');
  await prisma.followUp.deleteMany({ where: { notes: { contains: D } } });
  await prisma.transportJob.deleteMany({ where: { notes: { contains: D } } });
  await prisma.outreachActivity.deleteMany({ where: { notes: { contains: D } } });
  await prisma.inventoryItem.deleteMany({ where: { notes: { contains: D } } });
  await prisma.referral.deleteMany({ where: { notes: { contains: D } } });
  await prisma.surgery.deleteMany({ where: { intraopNotes: { contains: D } } });
  await prisma.screening.deleteMany({ where: { notes: { contains: D } } });
  await prisma.patient.deleteMany({ where: { patientCode: { startsWith: 'DEMO-' } } });
  await prisma.campaign.deleteMany({ where: { description: { contains: D } } });
  await prisma.location.deleteMany({ where: { code: { startsWith: 'DEMO-' } } });
  console.log('✅ Done — all demo data removed.');
}

// ---------------------------------------------------------------------------
// SEED
// ---------------------------------------------------------------------------
async function seedDemo() {
  const existing = await prisma.location.count({ where: { code: { startsWith: 'DEMO-' } } });
  if (existing > 0) {
    console.log('⚠️  Demo data already exists. Run with --clear first.\n   npx tsx prisma/seed-demo.ts --clear');
    return;
  }

  console.log('🌱 Seeding demo data …\n');

  // ── 1. LOCATIONS (10) ──────────────────────────────────────────────────
  const LOC_DEF = [
    { name:'Mogadishu Eye Centre',        code:'DEMO-MOG-01', facilityType:'Hospital',       district:'Hodan',           region:'Banaadir',            lat: 2.0469, lng:45.3182, phone:'+252612000001' },
    { name:'Kismayo General Hospital',    code:'DEMO-KIS-01', facilityType:'Hospital',       district:'Kismayo',         region:'Jubba Hoose',          lat:-0.3582, lng:42.5454, phone:'+252614000002' },
    { name:'Garowe Regional Eye Clinic',  code:'DEMO-GAR-01', facilityType:'Clinic',         district:'Garowe',          region:'Nugaal',               lat: 8.4054, lng:48.4845, phone:'+252615000003' },
    { name:'Bosaso Specialist Hospital',  code:'DEMO-BOS-01', facilityType:'Hospital',       district:'Bosaso',          region:'Bari',                 lat:11.2841, lng:49.1780, phone:'+252618000004' },
    { name:'Baidoa District Hospital',    code:'DEMO-BAI-01', facilityType:'Hospital',       district:'Baidoa',          region:'Bay',                  lat: 3.1188, lng:43.6481, phone:'+252617000005' },
    { name:'Hargeisa Group Hospital',     code:'DEMO-HAR-01', facilityType:'Hospital',       district:'Hargeisa',        region:'Woqooyi Galbeed',      lat: 9.5583, lng:44.0751, phone:'+252634000006' },
    { name:'Beledweyne Community Clinic', code:'DEMO-BEL-01', facilityType:'Clinic',         district:'Beledweyne',      region:'Hiiraan',              lat: 4.7351, lng:45.2039, phone:'+252616000007' },
    { name:'Jowhar Mobile Eye Unit',      code:'DEMO-JOW-01', facilityType:'MobileUnit',     district:'Jowhar',          region:'Shabeellaha Dhexe',    lat: 2.7826, lng:45.5035, phone:'+252619000008' },
    { name:'Afgooye Health Centre',       code:'DEMO-AFG-01', facilityType:'CommunityCentre',district:'Afgooye',         region:'Shabeellaha Hoose',    lat: 2.1408, lng:45.1196, phone:'+252620000009' },
    { name:'Berbera Eye Camp',            code:'DEMO-BER-01', facilityType:'MobileUnit',     district:'Berbera',         region:'Sahil',                lat:10.4395, lng:45.0144, phone:'+252625000010' },
  ];
  const locations = await Promise.all(
    LOC_DEF.map(d => prisma.location.create({ data: { ...d, facilityType: d.facilityType as any } }))
  );
  console.log(`  ✓ ${locations.length} locations`);

  // ── 2. CAMPAIGNS (6) ──────────────────────────────────────────────────
  type CampDef = { name:string; type:string; status:string; start:Date; end:Date; budget:number; donors:string; tS:number; tSurg:number; tF:number; desc:string; locIdxs:number[] };
  const CAMP_DEF: CampDef[] = [
    { name:'Jubba Vision 2026',              type:'Cataract',        status:'Active',    start:ago(120), end:addDays(new Date(),60),  budget:85000,  donors:'CBMO, Seeing is Believing',  tS:500, tSurg:200, tF:800,  desc:`Primary cataract campaign for Lower Jubba region. ${D}`,                               locIdxs:[1] },
    { name:'Mogadishu Sight Restoration',    type:'Cataract',        status:'Active',    start:ago(90),  end:addDays(new Date(),90),  budget:120000, donors:'Fred Hollows Foundation',    tS:800, tSurg:300, tF:1200, desc:`High-volume urban cataract programme for Banaadir region. ${D}`,                       locIdxs:[0] },
    { name:'Puntland Eye Health Drive',      type:'General',         status:'Completed', start:ago(200), end:ago(30),                budget:65000,  donors:'USAID, WHO',                 tS:400, tSurg:150, tF:600,  desc:`Comprehensive eye health campaign covering Nugaal and Bari regions. ${D}`,            locIdxs:[2,3] },
    { name:'Somaliland Cataract Mission Q1', type:'Cataract',        status:'Completed', start:ago(180), end:ago(60),                budget:72000,  donors:'Orbis International',        tS:450, tSurg:180, tF:720,  desc:`Cataract surgical mission for Woqooyi Galbeed and Sahil regions. ${D}`,               locIdxs:[5,9] },
    { name:'Bay Region School Eye Health',   type:'SchoolEyeHealth', status:'Active',    start:ago(45),  end:addDays(new Date(),45), budget:28000,  donors:'UNICEF',                     tS:1200,tSurg:20,  tF:60,   desc:`School-age children eye screening and glasses distribution in Baidoa. ${D}`,           locIdxs:[4] },
    { name:'Central Somalia Vision Care',    type:'General',         status:'Active',    start:ago(30),  end:addDays(new Date(),120),budget:55000,  donors:'Islamic Relief',             tS:600, tSurg:200, tF:800,  desc:`Multi-district campaign covering Hiiraan and Middle Shabelle. ${D}`,                   locIdxs:[6,7,8] },
  ];
  const campaigns = await Promise.all(
    CAMP_DEF.map(async ({ locIdxs, tS, tSurg, tF, start, end, ...d }) => {
      const c = await prisma.campaign.create({ data: {
        name: d.name, type: d.type as any, status: d.status as any,
        startDate: start, endDate: end, budget: d.budget, donors: d.donors,
        targetScreenings: tS, targetSurgeries: tSurg, targetFollowUps: tF, description: d.desc,
      }});
      await Promise.all(locIdxs.map(li =>
        prisma.campaignLocation.create({ data: { campaignId: c.id, locationId: locations[li].id } })
      ));
      return c;
    })
  );
  console.log(`  ✓ ${campaigns.length} campaigns`);

  // campaign index → [campIdx, locIdx] pairs used to assign patients
  const CL: [number,number][] = [
    [0,1],[0,1],[1,0],[1,0],[2,2],[2,3],[3,5],[3,9],[4,4],[5,6],[5,7],[5,8],
  ];

  // ── 3. PATIENTS (84) ──────────────────────────────────────────────────
  const patients = [];
  for (let i = 0; i < 84; i++) {
    const male = i % 2 === 0;
    const name = male ? MALE_NAMES[Math.floor(i/2) % MALE_NAMES.length] : FEMALE_NAMES[Math.floor(i/2) % FEMALE_NAMES.length];
    const [cIdx, lIdx] = CL[i % CL.length];
    const loc = LOC_DEF[lIdx];
    const dob = ago((45 + i % 30) * 365 + i * 13);

    const p = await prisma.patient.create({ data: {
      patientCode:      `DEMO-${String(i+1).padStart(4,'0')}`,
      fullName:         name,
      dateOfBirth:      dob,
      sex:              male ? 'Male' : 'Female',
      phone:            `+25261${String(3000000 + i * 17).padStart(7,'0')}`,
      district:         loc.district,
      region:           loc.region,
      occupation:       pick(OCCUPATIONS, i),
      disabilityStatus: i % 9 === 0 ? 'Visual' : 'None',
      consentGiven:     true,
      consentDate:      ago(115 - i),
      campaignId:       campaigns[cIdx].id,
      locationId:       locations[lIdx].id,
      referralSource:   pick(['CHW','Self','Community Leader','Facility','Volunteer'], i),
      notes:            D,
      lat:              loc.lat + Math.sin(i) * 0.04,
      lng:              loc.lng + Math.cos(i) * 0.04,
    }});
    patients.push({ p, cIdx, lIdx });
  }
  console.log(`  ✓ ${patients.length} patients`);

  // ── 4. SCREENINGS (78) ────────────────────────────────────────────────
  type ScreenRow = { screening: Awaited<ReturnType<typeof prisma.screening.create>>; needsSurgery: boolean };
  const screenings: ScreenRow[] = [];

  for (let i = 0; i < 78; i++) {
    const { p, cIdx, lIdx } = patients[i];
    const hasCataract      = i % 3 === 0;
    const hasGlaucoma      = i % 7 === 0;
    const poorVision       = hasCataract || i % 4 === 0;
    const rec              = hasCataract ? 'ReferForSurgery'
                           : i % 5 === 0 ? 'Glasses'
                           : i % 6 === 0 ? 'FurtherInvestigation'
                           : i % 8 === 0 ? 'FollowUp'
                           : 'Discharge';
    const screenedAt = ago(85 - i % 70);

    const s = await prisma.screening.create({ data: {
      patientId:          p.id,
      patientName:        p.fullName,
      campaignId:         campaigns[cIdx].id,
      locationId:         locations[lIdx].id,
      screenedBy:         pick(OFFICERS, i),
      screenedAt,
      vaRightUnaided:     poorVision ? pick(VA_POOR, i)  : pick(VA_GOOD, i),
      vaLeftUnaided:      poorVision ? pick(VA_MID, i)   : pick(VA_GOOD, i),
      vaRightCorrected:   hasCataract ? null : pick(VA_GOOD, i),
      vaLeftCorrected:    hasCataract ? null : pick(VA_GOOD, i),
      iopRight:           hasGlaucoma ? 22 + (i % 8) : 14 + (i % 5),
      iopLeft:            hasGlaucoma ? 21 + (i % 8) : 13 + (i % 5),
      cataractSuspected:  hasCataract,
      glaucomaSuspected:  hasGlaucoma,
      diabeticRetinopathy:i % 15 === 0,
      medicalHistory:     i % 3 === 0 ? 'Hypertension' : i % 7 === 0 ? 'Diabetes mellitus type 2' : '',
      currentMedications: i % 5 === 0 ? 'Metformin 500mg BD' : '',
      otherFindings:      hasCataract ? 'Mature cataract, absent red reflex' : hasGlaucoma ? 'Increased cup-to-disc ratio 0.7' : '',
      recommendation:     rec as any,
      notes:              D,
    }});
    screenings.push({ screening: s, needsSurgery: hasCataract });
  }
  console.log(`  ✓ ${screenings.length} screenings`);

  // ── 5. SURGERIES (36) ────────────────────────────────────────────────
  const LENS   = ['PMMA','FoldableAcrylic','Hydrophilic','Hydrophobic'] as const;
  const EYES   = ['Right','Left','Both'] as const;
  const SURG_STATUS = ['Completed','Completed','Completed','Completed','Completed','InTheatre','Scheduled'] as const;

  const surgeries: Awaited<ReturnType<typeof prisma.surgery.create>>[] = [];
  let si = 0;
  for (let i = 0; i < screenings.length && si < 36; i++) {
    if (!screenings[i].needsSurgery) continue;
    const { screening: sc } = screenings[i];
    const { p, cIdx, lIdx } = patients[i];
    const status      = pick(SURG_STATUS, si);
    const scheduledAt = addDays(new Date(sc.screenedAt), 14 + (si % 12));
    const done        = status === 'Completed';

    const surg = await prisma.surgery.create({ data: {
      patientId:    p.id,
      patientName:  p.fullName,
      campaignId:   campaigns[cIdx].id,
      locationId:   locations[lIdx].id,
      surgeonName:  pick(SURGEONS, si),
      eye:          pick(EYES, si),
      lensType:     pick(LENS, si),
      scheduledAt,
      performedAt:  done ? scheduledAt : null,
      status:       status as any,
      preOpVa:      'LT6_60',
      postOpVa:     done ? pick(['6/6','6/9','6/12','6/18'], si) : null,
      complications:si % 9 === 0 ? 'Posterior capsule rupture — managed intraoperatively' : '',
      intraopNotes: D,
    }});
    surgeries.push(surg);
    si++;
  }
  console.log(`  ✓ ${surgeries.length} surgeries`);

  // ── 6. FOLLOW-UPS (for completed surgeries) ──────────────────────────
  const MILESTONES = [
    { m:'Day1',   off:1  },
    { m:'Week1',  off:7  },
    { m:'Month1', off:30 },
    { m:'Month3', off:90 },
  ] as const;
  let fuCount = 0;
  for (const surg of surgeries) {
    if (surg.status !== 'Completed') continue;
    const { p, cIdx } = patients.find(x => x.p.id === surg.patientId)!;
    for (const { m, off } of MILESTONES) {
      const dueDate   = addDays(new Date(surg.performedAt!), off);
      const isPast    = dueDate < new Date();
      const completed = isPast && fuCount % 6 !== 0; // ~83% completion
      await prisma.followUp.create({ data: {
        patientId:   p.id,
        patientName: p.fullName,
        surgeryId:   surg.id,
        campaignId:  campaigns[cIdx].id,
        milestone:   m as any,
        dueDate,
        status:      completed ? 'Completed' : isPast ? 'Overdue' : 'Pending',
        completedAt: completed ? addDays(dueDate, fuCount % 2) : null,
        vaRightPost: completed ? pick(['6/6','6/9','6/12','6/18'], fuCount) : null,
        vaLeftPost:  completed ? pick(['6/6','6/9','6/12'], fuCount) : null,
        smsReminderSent: isPast,
        notes: D,
      }});
      fuCount++;
    }
  }
  console.log(`  ✓ ${fuCount} follow-ups`);

  // ── 7. REFERRALS (30) ────────────────────────────────────────────────
  const REF_SOURCES  = ['CHW','Volunteer','School','Facility','Self','CommunityLeader'] as const;
  const REF_STATUSES = ['Pending','Contacted','Screened','Converted','Lost'] as const;
  for (let i = 0; i < 30; i++) {
    const { p, cIdx, lIdx } = patients[i + 12 < patients.length ? i + 12 : i];
    const status    = pick(REF_STATUSES, i);
    const refDate   = ago(55 - i % 45);
    const contacted = ['Contacted','Screened','Converted'].includes(status);
    const screened  = ['Screened','Converted'].includes(status);
    await prisma.referral.create({ data: {
      patientName:  p.fullName,
      patientPhone: p.phone,
      source:       pick(REF_SOURCES, i),
      referredBy:   pick(OFFICERS, i),
      campaignId:   campaigns[cIdx].id,
      locationId:   locations[lIdx].id,
      status:       status as any,
      referredAt:   refDate,
      contactedAt:  contacted ? addDays(refDate, 2 + i % 3)  : null,
      screenedAt:   screened  ? addDays(refDate, 7 + i % 5)  : null,
      convertedAt:  status === 'Converted' ? addDays(refDate, 14 + i % 7) : null,
      notes:        D,
    }});
  }
  console.log('  ✓ 30 referrals');

  // ── 8. OUTREACH (20) ─────────────────────────────────────────────────
  const OUTREACH_TYPES  = ['AwarenessCampaign','CommunityMeeting','RadioBroadcast','SchoolVisit','HealthFair','CHWTraining'] as const;
  const OUTREACH_TITLES = [
    'Cataract Awareness Drive – Hodan District',
    'CHW Training Session – Kismayo',
    'Radio Eye Health Programme – Radio Mogadishu',
    'School Vision Screening – Baidoa Primary School',
    'Eye Health Fair – Garowe Central Market',
    'Community Meeting on Blindness Prevention – Bosaso',
    'School Visit – Sheikh Ahmed Secondary',
    'CHW Refresher Training – Beledweyne',
    'Radio Broadcast – Puntland FM',
    'Eye Health Fair – Hargeisa Stadium Grounds',
    'Awareness Campaign – Afgooye Village',
    'Community Meeting – Jowhar District Hall',
    'School Vision Day – Bosaso Girls School',
    'CHW Training – Berbera Coastal Communities',
    'Radio Programme – HornAfrik Radio',
    'Eye Health Fair – Baidoa Hospital Grounds',
    'Community Screening Session – Hodan',
    'School Visit – Garowe Model Primary School',
    'Awareness March – Kismayo Town Centre',
    'Blindness Prevention Workshop – Hargeisa',
  ];
  for (let i = 0; i < 20; i++) {
    const [cIdx, lIdx] = CL[i % CL.length];
    await prisma.outreachActivity.create({ data: {
      type:         pick(OUTREACH_TYPES, i),
      title:        OUTREACH_TITLES[i],
      date:         ago(95 - i * 4),
      locationId:   locations[lIdx].id,
      locationName: locations[lIdx].name,
      campaignId:   campaigns[cIdx].id,
      reach:        60  + i * 22 + (i % 7) * 12,
      conversions:  6   + i * 3  + (i % 5),
      conductedBy:  pick(OFFICERS, i),
      notes:        D,
    }});
  }
  console.log('  ✓ 20 outreach activities');

  // ── 9. INVENTORY (25) ────────────────────────────────────────────────
  type InvRow = { sku:string; name:string; cat:string; qty:number; reorder:number; unit:string; supplier:string; lIdx:number; expDays:number|null };
  const INV: InvRow[] = [
    { sku:'DEMO-IOL-PMMA-220', name:'PMMA IOL 22.0D',                      cat:'IOL',        qty:120, reorder:30, unit:'units',   supplier:'Aurolab India',   lIdx:0, expDays:365  },
    { sku:'DEMO-IOL-PMMA-215', name:'PMMA IOL 21.5D',                      cat:'IOL',        qty:95,  reorder:30, unit:'units',   supplier:'Aurolab India',   lIdx:1, expDays:365  },
    { sku:'DEMO-IOL-FOLD-220', name:'Foldable Acrylic IOL 22.0D',          cat:'IOL',        qty:60,  reorder:20, unit:'units',   supplier:'Alcon',           lIdx:0, expDays:540  },
    { sku:'DEMO-IOL-FOLD-210', name:'Foldable Acrylic IOL 21.0D',          cat:'IOL',        qty:45,  reorder:20, unit:'units',   supplier:'Alcon',           lIdx:5, expDays:540  },
    { sku:'DEMO-IOL-HYDRO-220',name:'Hydrophobic IOL 22.0D',               cat:'IOL',        qty:30,  reorder:15, unit:'units',   supplier:'Rayner UK',       lIdx:2, expDays:480  },
    { sku:'DEMO-MED-TIMOLOL',  name:'Timolol Eye Drops 0.5%',              cat:'Medication', qty:80,  reorder:20, unit:'bottles', supplier:'IDA Foundation',  lIdx:0, expDays:180  },
    { sku:'DEMO-MED-BETAX',    name:'Betaxolol Eye Drops 0.5%',            cat:'Medication', qty:55,  reorder:15, unit:'bottles', supplier:'IDA Foundation',  lIdx:2, expDays:210  },
    { sku:'DEMO-MED-DEXA',     name:'Dexamethasone Eye Drops 0.1%',        cat:'Medication', qty:200, reorder:50, unit:'bottles', supplier:'IDA Foundation',  lIdx:0, expDays:270  },
    { sku:'DEMO-MED-CIPRO',    name:'Ciprofloxacin Eye Drops 0.3%',        cat:'Medication', qty:150, reorder:40, unit:'bottles', supplier:'MSF Pharmacy',    lIdx:1, expDays:240  },
    { sku:'DEMO-MED-MOXY',     name:'Moxifloxacin Eye Drops 0.5%',        cat:'Medication', qty:12,  reorder:20, unit:'bottles', supplier:'MSF Pharmacy',    lIdx:5, expDays:90   }, // LOW
    { sku:'DEMO-MED-PHENYL',   name:'Phenylephrine 2.5% Eye Drops',        cat:'Medication', qty:45,  reorder:15, unit:'bottles', supplier:'IDA Foundation',  lIdx:3, expDays:160  },
    { sku:'DEMO-EQUIP-SLAMP',  name:'Slit Lamp Haag-Streit BQ 900',        cat:'Equipment',  qty:3,   reorder:1,  unit:'units',   supplier:'Haag-Streit',     lIdx:0, expDays:null },
    { sku:'DEMO-EQUIP-PHACO',  name:'Phacoemulsification Machine (Alcon)', cat:'Equipment',  qty:2,   reorder:1,  unit:'units',   supplier:'Alcon Centurion', lIdx:0, expDays:null },
    { sku:'DEMO-EQUIP-TONO',   name:'Non-Contact Tonometer (Nidek)',       cat:'Equipment',  qty:4,   reorder:1,  unit:'units',   supplier:'Nidek',           lIdx:2, expDays:null },
    { sku:'DEMO-EQUIP-AUTORF', name:'Auto Refractor / Keratometer',        cat:'Equipment',  qty:3,   reorder:1,  unit:'units',   supplier:'Topcon',          lIdx:5, expDays:null },
    { sku:'DEMO-CON-VISCO',    name:'OVD Viscoelastic 1.4% Sodium Hyaluronate', cat:'Consumable', qty:200, reorder:50, unit:'syringes', supplier:'Carl Zeiss', lIdx:0, expDays:300 },
    { sku:'DEMO-CON-SUTURE10', name:'Suture 10-0 Nylon (Ethilon)',         cat:'Consumable', qty:150, reorder:30, unit:'packs',   supplier:'Ethicon',         lIdx:0, expDays:720  },
    { sku:'DEMO-CON-BSS',      name:'Balanced Salt Solution BSS 500ml',    cat:'Consumable', qty:180, reorder:40, unit:'bottles', supplier:'Alcon',           lIdx:0, expDays:400  },
    { sku:'DEMO-CON-DRAPE',    name:'Disposable Surgical Drape (Pack 10)', cat:'Consumable', qty:60,  reorder:20, unit:'packs',   supplier:'Medline',         lIdx:1, expDays:1000 },
    { sku:'DEMO-CON-GLOVES7',  name:'Sterile Surgical Gloves Size 7 ×50', cat:'Consumable', qty:40,  reorder:10, unit:'boxes',   supplier:'Ansell',          lIdx:0, expDays:600  },
    { sku:'DEMO-CON-NEEDLES',  name:'Retrobulbar Needle 23G (Pack 10)',    cat:'Consumable', qty:8,   reorder:20, unit:'packs',   supplier:'BD Medical',      lIdx:0, expDays:400  }, // LOW
    { sku:'DEMO-PPE-MASK',     name:'Surgical Face Masks (Box 50)',        cat:'PPE',        qty:120, reorder:30, unit:'boxes',   supplier:'Local Supplier',  lIdx:0, expDays:500  },
    { sku:'DEMO-PPE-GOWN',     name:'Disposable Surgical Gowns (Pack 10)',cat:'PPE',        qty:80,  reorder:20, unit:'packs',   supplier:'Medline',         lIdx:1, expDays:600  },
    { sku:'DEMO-PPE-GOGGLES',  name:'Protective Eye Goggles',              cat:'PPE',        qty:35,  reorder:10, unit:'units',   supplier:'Local Supplier',  lIdx:5, expDays:null },
    { sku:'DEMO-CON-GAUZE',    name:'Sterile Cotton Gauze Swabs (×100)',   cat:'Consumable', qty:90,  reorder:25, unit:'packs',   supplier:'Local Supplier',  lIdx:2, expDays:800  },
  ];
  for (const it of INV) {
    await prisma.inventoryItem.create({ data: {
      sku:         it.sku,
      name:        it.name,
      category:    it.cat as any,
      quantity:    it.qty,
      reorderLevel:it.reorder,
      unit:        it.unit,
      supplier:    it.supplier,
      locationId:  locations[it.lIdx].id,
      expiryDate:  it.expDays !== null ? addDays(new Date(), it.expDays) : null,
      notes:       D,
    }});
  }
  console.log(`  ✓ ${INV.length} inventory items`);

  // ── 10. TRANSPORT (20) ───────────────────────────────────────────────
  const VEHICLES = ['Toyota HiLux PK-001','Land Cruiser PK-002','Ambulance AMB-003','Minibus MB-004','Land Cruiser PK-005'];
  const DRIVERS  = ['Hassan Abdi','Mohamed Warsame','Omar Nur','Abdullahi Jama','Yusuf Ahmed'];
  const TR_STATUS = ['Completed','Completed','Completed','InTransit','Scheduled'] as const;

  for (let i = 0; i < 20; i++) {
    const { p, lIdx } = patients[(i * 4) % patients.length];
    const scheduledAt = ago(25 - i);
    const status      = pick(TR_STATUS, i);
    const done        = status === 'Completed';
    await prisma.transportJob.create({ data: {
      patientId:      p.id,
      patientName:    p.fullName,
      vehicle:        pick(VEHICLES, i),
      driver:         pick(DRIVERS, i),
      pickupLocation: `${LOC_DEF[lIdx].district} Village, ${LOC_DEF[lIdx].region}`,
      dropLocation:   locations[lIdx].name,
      scheduledAt,
      completedAt:    done ? scheduledAt : null,
      cost:           25 + i * 8,
      status:         status as any,
      notes:          D,
    }});
  }
  console.log('  ✓ 20 transport jobs');

  console.log(`
✅ Demo seeding complete!

   Records created:
   • 10 locations     • 6 campaigns      • 84 patients
   • 78 screenings    • 36 surgeries     • ${fuCount} follow-ups
   • 30 referrals     • 20 outreach      • 25 inventory items
   • 20 transport jobs

   To remove all demo data:
   npx tsx prisma/seed-demo.ts --clear
`);
}

// ---------------------------------------------------------------------------
async function main() {
  if (process.argv.includes('--clear')) {
    await clearDemo();
  } else {
    await seedDemo();
  }
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
