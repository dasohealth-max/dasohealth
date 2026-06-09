-- =============================================================================
-- EyeCare Pro — Development / Demo Seed Data
-- Mirrors INITIAL_STATE in lib/store.ts.
--
-- ID mapping (deterministic UUIDs):
--   users      u1-u5  → 00000000-0000-0000-0001-00000000000n
--   campaigns  c1-c3  → 00000000-0000-0000-0002-00000000000n
--   locations  l1-l4  → 00000000-0000-0000-0003-00000000000n
--   patients   p1-p5  → 00000000-0000-0000-0004-00000000000n
--   screenings s1-s5  → 00000000-0000-0000-0005-00000000000n
--   surgeries  sg1-3  → 00000000-0000-0000-0006-00000000000n
--   referrals  r1-r5  → 00000000-0000-0000-0007-00000000000n
--   follow_ups f1-f4  → 00000000-0000-0000-0008-00000000000n
--   inventory  i1-i5  → 00000000-0000-0000-0009-00000000000n
--   outreach   o1-o3  → 00000000-0000-0000-000a-00000000000n
--   transport  t1-t2  → 00000000-0000-0000-000b-00000000000n
--
-- Relative dates (D(n) in store.ts) are expressed as CURRENT_DATE arithmetic
-- so the seed remains valid whenever it is applied.
--
-- WARNING: passwords are stored in plain text for dev only.
--          Hash them (bcrypt/argon2) before any production use.
-- =============================================================================

BEGIN;

-- =============================================================================
-- USERS
-- =============================================================================
INSERT INTO users (id, name, email, password, role, initials, color, active) VALUES
  ('00000000-0000-0000-0001-000000000001', 'Dr. Ahmed Hassan',  'admin@eyecare.org',    'admin123',  'Super Administrator', 'AH', '#0d9488', true),
  ('00000000-0000-0000-0001-000000000002', 'Dr. Sara Mohamed',  'dr.sara@eyecare.org',  'doctor123', 'Ophthalmologist',     'SM', '#6366f1', true),
  ('00000000-0000-0000-0001-000000000003', 'Ali Osman',         'pm@eyecare.org',        'pm123',     'Project Manager',     'AO', '#f59e0b', true),
  ('00000000-0000-0000-0001-000000000004', 'Jane Smith',        'donor@eyecare.org',     'donor123',  'Donor User',          'JS', '#ec4899', true),
  ('00000000-0000-0000-0001-000000000005', 'Fatima Abdi',       'nurse@eyecare.org',     'nurse123',  'Screening Officer',   'FA', '#8b5cf6', true)
ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- CAMPAIGNS
-- =============================================================================
INSERT INTO campaigns (id, name, type, status, start_date, end_date, budget, donors, target_screenings, target_surgeries, target_follow_ups, description) VALUES
  ('00000000-0000-0000-0002-000000000001',
   'Rural Cataract Outreach 2025', 'Cataract', 'Active',
   '2025-01-01', '2025-12-31', 150000, 'WHO, Lions Club',
   2000, 800, 700, 'Mass cataract campaign in rural districts.'),

  ('00000000-0000-0000-0002-000000000002',
   'School Vision 2025', 'School Eye Health', 'Active',
   '2025-03-01', '2025-11-30', 60000, 'USAID',
   5000, 50, 200, 'School-based eye health programme.'),

  ('00000000-0000-0000-0002-000000000003',
   'Diabetic Eye Q4', 'Diabetic Retinopathy', 'Planned',
   '2025-10-01', '2025-12-31', 45000, 'Private',
   800, 40, 150, 'DR screening for diabetic patients.')
ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- LOCATIONS
-- =============================================================================
INSERT INTO locations (id, name, code, facility_type, district, region, country, lat, lng, phone) VALUES
  ('00000000-0000-0000-0003-000000000001',
   'Mogadishu Central Eye Clinic', 'MOG-01', 'Hospital',
   'Banadir', 'Banadir', 'Somalia', 2.0469, 45.3182, '+252 61 234 5678'),

  ('00000000-0000-0000-0003-000000000002',
   'Hargeisa Regional Hospital', 'HRG-01', 'Hospital',
   'Hargeisa', 'Woqooyi Galbeed', 'Somalia', 9.5600, 44.0650, '+252 63 111 2222'),

  ('00000000-0000-0000-0003-000000000003',
   'Kismayo Mobile Unit', 'KIS-01', 'Mobile Unit',
   'Kismayo', 'Jubaland', 'Somalia', -0.3582, 42.5454, NULL),

  ('00000000-0000-0000-0003-000000000004',
   'Bosaso Clinic', 'BOS-01', 'Clinic',
   'Bosaso', 'Puntland', 'Somalia', 11.2841, 49.1816, '+252 90 333 4444')
ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- CAMPAIGN_LOCATIONS  (junction)
-- =============================================================================
INSERT INTO campaign_locations (campaign_id, location_id) VALUES
  -- c1 → l1, l2
  ('00000000-0000-0000-0002-000000000001', '00000000-0000-0000-0003-000000000001'),
  ('00000000-0000-0000-0002-000000000001', '00000000-0000-0000-0003-000000000002'),
  -- c2 → l3
  ('00000000-0000-0000-0002-000000000002', '00000000-0000-0000-0003-000000000003'),
  -- c3 → l2
  ('00000000-0000-0000-0002-000000000003', '00000000-0000-0000-0003-000000000002')
ON CONFLICT DO NOTHING;

-- =============================================================================
-- PATIENTS
-- =============================================================================
INSERT INTO patients (
  id, patient_code, full_name, date_of_birth, sex, phone,
  district, region, occupation, education,
  disability_status, insurance_status,
  emergency_contact, emergency_phone,
  consent_given, consent_date,
  campaign_id, location_id, referral_source, notes
) VALUES
  ('00000000-0000-0000-0004-000000000001',
   'EC-2025-0001', 'Hodan Ali Omar', '1958-04-12', 'Female', '+252611234001',
   'Banadir', 'Banadir', 'Farmer', 'Primary',
   'Visual', 'None',
   'Ali Omar', '+252611234002',
   true, '2025-01-15',
   '00000000-0000-0000-0002-000000000001',
   '00000000-0000-0000-0003-000000000001',
   'CHW', ''),

  ('00000000-0000-0000-0004-000000000002',
   'EC-2025-0002', 'Abdi Hassan Warsame', '1945-09-20', 'Male', '+252611234003',
   'Hargeisa', 'Woqooyi Galbeed', 'Retired', 'None',
   'None', 'None',
   'Faadumo Hassan', '+252611234004',
   true, '2025-01-18',
   '00000000-0000-0000-0002-000000000001',
   '00000000-0000-0000-0003-000000000002',
   'Self', 'Bilateral cataracts'),

  ('00000000-0000-0000-0004-000000000003',
   'EC-2025-0003', 'Sahra Mohamud Idle', '1962-12-03', 'Female', '+252611234005',
   'Kismayo', 'Jubaland', 'Housewife', 'Secondary',
   'None', 'Government',
   'Mohamud Idle', '+252611234006',
   true, '2025-02-01',
   '00000000-0000-0000-0002-000000000001',
   '00000000-0000-0000-0003-000000000003',
   'Community Leader', ''),

  ('00000000-0000-0000-0004-000000000004',
   'EC-2025-0004', 'Mahad Yusuf Dirie', '1978-06-15', 'Male', '+252611234007',
   'Bosaso', 'Puntland', 'Teacher', 'University',
   'None', 'Private',
   'Asho Dirie', '+252611234008',
   true, '2025-02-10',
   '00000000-0000-0000-0002-000000000002',
   '00000000-0000-0000-0003-000000000004',
   'School', 'Myopia'),

  ('00000000-0000-0000-0004-000000000005',
   'EC-2025-0005', 'Ladan Ahmed Farah', '1950-03-22', 'Female', '+252611234009',
   'Banadir', 'Banadir', 'Trader', 'None',
   'Visual', 'None',
   'Ahmed Farah', '+252611234010',
   true, '2025-02-20',
   '00000000-0000-0000-0002-000000000001',
   '00000000-0000-0000-0003-000000000001',
   'CHW', '')
ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- SCREENINGS
-- =============================================================================
INSERT INTO screenings (
  id, patient_id, patient_name, campaign_id, location_id,
  screened_by, screened_at,
  va_right_unaided, va_left_unaided,
  iop_right, iop_left,
  cataract_suspected, glaucoma_suspected, diabetic_retinopathy,
  other_findings, medical_history, current_medications,
  recommendation, notes
) VALUES
  ('00000000-0000-0000-0005-000000000001',
   '00000000-0000-0000-0004-000000000001', 'Hodan Ali Omar',
   '00000000-0000-0000-0002-000000000001',
   '00000000-0000-0000-0003-000000000001',
   'Dr. Sara Mohamed', '2025-01-16T09:00:00Z',
   '6/60', '<6/60', 14, 15,
   true, false, false,
   '', 'Hypertension', 'Amlodipine',
   'Refer for Surgery', 'Mature cataract left eye'),

  ('00000000-0000-0000-0005-000000000002',
   '00000000-0000-0000-0004-000000000002', 'Abdi Hassan Warsame',
   '00000000-0000-0000-0002-000000000001',
   '00000000-0000-0000-0003-000000000002',
   'Dr. Sara Mohamed', '2025-01-19T10:30:00Z',
   '6/36', '6/24', 12, 13,
   true, false, false,
   '', 'Diabetes', 'Metformin',
   'Refer for Surgery', 'Bilateral early cataracts'),

  ('00000000-0000-0000-0005-000000000003',
   '00000000-0000-0000-0004-000000000003', 'Sahra Mohamud Idle',
   '00000000-0000-0000-0002-000000000001',
   '00000000-0000-0000-0003-000000000003',
   'Fatima Abdi', '2025-02-02T08:00:00Z',
   '6/9', '6/12', 16, 15,
   false, false, false,
   'Mild pterygium', 'None', 'None',
   'Glasses', ''),

  ('00000000-0000-0000-0005-000000000004',
   '00000000-0000-0000-0004-000000000004', 'Mahad Yusuf Dirie',
   '00000000-0000-0000-0002-000000000002',
   '00000000-0000-0000-0003-000000000004',
   'Fatima Abdi', '2025-02-11T11:00:00Z',
   '6/18', '6/24', 13, 14,
   false, false, false,
   '', 'None', 'None',
   'Glasses', 'Myopia -- needs correction'),

  ('00000000-0000-0000-0005-000000000005',
   '00000000-0000-0000-0004-000000000005', 'Ladan Ahmed Farah',
   '00000000-0000-0000-0002-000000000001',
   '00000000-0000-0000-0003-000000000001',
   'Dr. Sara Mohamed', '2025-02-21T09:30:00Z',
   '<6/60', '<6/60', 22, 21,
   true, true, false,
   'Cup-disc ratio elevated', 'None', 'None',
   'Refer for Surgery', 'Possible glaucoma -- urgent review')
ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- SURGERIES
-- D(3) = CURRENT_DATE + 3 days, D(7) = CURRENT_DATE + 7 days
-- =============================================================================
INSERT INTO surgeries (
  id, patient_id, patient_name, campaign_id, location_id,
  surgeon_id, surgeon_name, eye, lens_type,
  scheduled_at, performed_at, status,
  pre_op_va, post_op_va, complications, intraop_notes
) VALUES
  ('00000000-0000-0000-0006-000000000001',
   '00000000-0000-0000-0004-000000000001', 'Hodan Ali Omar',
   '00000000-0000-0000-0002-000000000001',
   '00000000-0000-0000-0003-000000000001',
   '00000000-0000-0000-0001-000000000002', 'Dr. Sara Mohamed',
   'Left', 'Foldable Acrylic',
   '2025-02-01T08:00:00Z', '2025-02-01T09:30:00Z', 'Completed',
   '<6/60', '6/12', 'None', 'Uncomplicated phaco'),

  ('00000000-0000-0000-0006-000000000002',
   '00000000-0000-0000-0004-000000000002', 'Abdi Hassan Warsame',
   '00000000-0000-0000-0002-000000000001',
   '00000000-0000-0000-0003-000000000002',
   '00000000-0000-0000-0001-000000000002', 'Dr. Sara Mohamed',
   'Right', 'PMMA',
   (CURRENT_DATE + INTERVAL '3 days')::TIMESTAMPTZ, NULL, 'Scheduled',
   '6/36', NULL, '', ''),

  ('00000000-0000-0000-0006-000000000003',
   '00000000-0000-0000-0004-000000000005', 'Ladan Ahmed Farah',
   '00000000-0000-0000-0002-000000000001',
   '00000000-0000-0000-0003-000000000001',
   '00000000-0000-0000-0001-000000000002', 'Dr. Sara Mohamed',
   'Both', 'Foldable Acrylic',
   (CURRENT_DATE + INTERVAL '7 days')::TIMESTAMPTZ, NULL, 'Scheduled',
   '<6/60', NULL, '', '')
ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- REFERRALS
-- D(-1) = CURRENT_DATE - 1 day
-- =============================================================================
INSERT INTO referrals (
  id, patient_name, patient_phone, source, referred_by,
  campaign_id, location_id, status,
  referred_at, contacted_at, screened_at, converted_at, notes
) VALUES
  ('00000000-0000-0000-0007-000000000001',
   'Bile Abdi', '+252611001001', 'CHW', 'Ahmed CHW',
   '00000000-0000-0000-0002-000000000001',
   '00000000-0000-0000-0003-000000000001',
   'Converted', '2025-01-10', '2025-01-15', '2025-01-15', '2025-01-16', ''),

  ('00000000-0000-0000-0007-000000000002',
   'Faadumo Nur', '+252611001002', 'School', 'Teacher Hassan',
   '00000000-0000-0000-0002-000000000002',
   '00000000-0000-0000-0003-000000000003',
   'Screened', '2025-02-05', NULL, '2025-02-12', NULL, ''),

  ('00000000-0000-0000-0007-000000000003',
   'Omar Jama', '+252611001003', 'Self', 'Self',
   '00000000-0000-0000-0002-000000000001',
   '00000000-0000-0000-0003-000000000002',
   'Contacted', '2025-02-18', '2025-02-20', NULL, NULL, 'Appointment set'),

  ('00000000-0000-0000-0007-000000000004',
   'Halimo Duale', '+252611001004', 'CHW', 'Fatima CHW',
   '00000000-0000-0000-0002-000000000001',
   '00000000-0000-0000-0003-000000000001',
   'Pending', CURRENT_DATE - INTERVAL '1 day', NULL, NULL, NULL, ''),

  ('00000000-0000-0000-0007-000000000005',
   'Khadar Sheikh', '+252611001005', 'Facility', 'PHC Banadir',
   '00000000-0000-0000-0002-000000000001',
   '00000000-0000-0000-0003-000000000001',
   'Lost', '2025-01-20', '2025-01-22', NULL, NULL, 'No show x3')
ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- FOLLOW-UPS
-- D(-2) = CURRENT_DATE - 2 days  (f2 is Overdue)
-- D(4)  = CURRENT_DATE + 4 days  (f3 is Pending)
-- D(8)  = CURRENT_DATE + 8 days  (f4 is Pending)
-- =============================================================================
INSERT INTO follow_ups (
  id, patient_id, patient_name, surgery_id, campaign_id,
  milestone, due_date, completed_at, status,
  va_right_post, va_left_post, complications, notes, sms_reminder_sent
) VALUES
  ('00000000-0000-0000-0008-000000000001',
   '00000000-0000-0000-0004-000000000001', 'Hodan Ali Omar',
   '00000000-0000-0000-0006-000000000001',
   '00000000-0000-0000-0002-000000000001',
   'Day 1', '2025-02-02', '2025-02-02T09:00:00Z', 'Completed',
   '6/12', '6/18', 'None', 'Good recovery', true),

  ('00000000-0000-0000-0008-000000000002',
   '00000000-0000-0000-0004-000000000001', 'Hodan Ali Omar',
   '00000000-0000-0000-0006-000000000001',
   '00000000-0000-0000-0002-000000000001',
   'Week 1', CURRENT_DATE - INTERVAL '2 days', NULL, 'Overdue',
   NULL, NULL, '', '', true),

  ('00000000-0000-0000-0008-000000000003',
   '00000000-0000-0000-0004-000000000002', 'Abdi Hassan Warsame',
   '00000000-0000-0000-0006-000000000002',
   '00000000-0000-0000-0002-000000000001',
   'Day 1', CURRENT_DATE + INTERVAL '4 days', NULL, 'Pending',
   NULL, NULL, '', '', false),

  ('00000000-0000-0000-0008-000000000004',
   '00000000-0000-0000-0004-000000000005', 'Ladan Ahmed Farah',
   '00000000-0000-0000-0006-000000000003',
   '00000000-0000-0000-0002-000000000001',
   'Day 1', CURRENT_DATE + INTERVAL '8 days', NULL, 'Pending',
   NULL, NULL, '', '', false)
ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- INVENTORY ITEMS
-- =============================================================================
INSERT INTO inventory_items (
  id, sku, name, category, quantity, reorder_level, unit,
  expiry_date, supplier, location_id, notes
) VALUES
  ('00000000-0000-0000-0009-000000000001',
   'IOL-FOLD-001', 'Foldable Acrylic IOL', 'IOL',
   45, 20, 'pcs', '2026-06-30', 'Alcon',
   '00000000-0000-0000-0003-000000000001', ''),

  ('00000000-0000-0000-0009-000000000002',
   'IOL-PMMA-001', 'PMMA IOL', 'IOL',
   12, 20, 'pcs', '2026-12-31', 'Appasamy',
   '00000000-0000-0000-0003-000000000001', 'LOW STOCK'),

  ('00000000-0000-0000-0009-000000000003',
   'MED-BSS-001', 'BSS (Balanced Salt Solution)', 'Medication',
   80, 30, 'bottles', '2025-08-31', 'Alcon',
   '00000000-0000-0000-0003-000000000001', ''),

  ('00000000-0000-0000-0009-000000000004',
   'EQP-SLIT-001', 'Slit Lamp', 'Equipment',
   2, 1, 'units', NULL, 'Haag-Streit',
   '00000000-0000-0000-0003-000000000002', ''),

  ('00000000-0000-0000-0009-000000000005',
   'CON-GLOV-001', 'Surgical Gloves (box)', 'Consumable',
   8, 10, 'boxes', '2025-07-15', 'Local',
   '00000000-0000-0000-0003-000000000001', '')
ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- OUTREACH ACTIVITIES
-- =============================================================================
INSERT INTO outreach_activities (
  id, type, title, date, location_id, location_name,
  campaign_id, reach, conversions, conducted_by, notes
) VALUES
  ('00000000-0000-0000-000a-000000000001',
   'Community Meeting', 'Blindness Awareness - Banadir', '2025-01-10',
   '00000000-0000-0000-0003-000000000001', 'Mogadishu Central',
   '00000000-0000-0000-0002-000000000001', 350, 28, 'Ali Osman', ''),

  ('00000000-0000-0000-000a-000000000002',
   'Radio Broadcast', 'Eye Health Radio - Hargeisa FM', '2025-01-22',
   '00000000-0000-0000-0003-000000000002', 'Hargeisa Regional',
   '00000000-0000-0000-0002-000000000001', 5000, 65, 'Ali Osman', ''),

  ('00000000-0000-0000-000a-000000000003',
   'School Visit', 'Vision Screening - Primary Schools', '2025-02-14',
   '00000000-0000-0000-0003-000000000003', 'Kismayo Mobile Unit',
   '00000000-0000-0000-0002-000000000002', 420, 38, 'Fatima Abdi', '')
ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- TRANSPORT JOBS
-- D(3) = CURRENT_DATE + 3 days (for t2 scheduled)
-- =============================================================================
INSERT INTO transport_jobs (
  id, patient_id, patient_name, vehicle, driver,
  pickup_location, drop_location,
  scheduled_at, completed_at, cost, status, notes
) VALUES
  ('00000000-0000-0000-000b-000000000001',
   '00000000-0000-0000-0004-000000000001', 'Hodan Ali Omar',
   'Toyota HiAce - SON 001', 'Dahir Warsame',
   'Hodan District', 'Mogadishu Central Eye Clinic',
   '2025-02-01T07:00:00Z', '2025-02-01T08:00:00Z',
   15, 'Completed', ''),

  ('00000000-0000-0000-000b-000000000002',
   '00000000-0000-0000-0004-000000000002', 'Abdi Hassan Warsame',
   'Land Cruiser - SON 002', 'Hassan Bile',
   'Sha''ab District', 'Hargeisa Regional Hospital',
   (CURRENT_DATE + INTERVAL '3 days')::TIMESTAMPTZ + INTERVAL '7 hours',
   NULL, 25, 'Scheduled', '')
ON CONFLICT (id) DO NOTHING;

COMMIT;
