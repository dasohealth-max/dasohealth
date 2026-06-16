CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
BEGIN
  CREATE TYPE user_role AS ENUM (
    'Super Administrator',
    'Project Manager',
    'Data Clerk',
    'Screening Officer',
    'Campaign Manager',
    'Hospital Coordinator',
    'Ophthalmologist',
    'Surgeon',
    'Follow-Up Officer',
    'Outreach Officer',
    'Logistics Officer',
    'Inventory Officer',
    'MEAL Officer',
    'Finance Officer',
    'Donor User'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE campaign_type AS ENUM (
    'Cataract',
    'School Eye Health',
    'Diabetic Retinopathy',
    'Glaucoma',
    'General',
    'Cataract Surgery Outreach',
    'Eye Vision Outreach',
    'General Eye Screening',
    'Mixed Outreach'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE campaign_status AS ENUM ('Planned', 'Active', 'Completed', 'Suspended');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE sex AS ENUM ('Male', 'Female', 'Other');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE disability_status AS ENUM ('None', 'Visual', 'Hearing', 'Mobility', 'Cognitive', 'Multiple');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE va_grade AS ENUM ('6/6', '6/9', '6/12', '6/18', '6/24', '6/36', '6/60', '<6/60', 'CF', 'HM', 'PL', 'NPL');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE screening_recommendation AS ENUM ('Discharge', 'Refer for Surgery', 'Further Investigation', 'Glasses', 'Follow-up', 'Positive');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE surgery_eye AS ENUM ('Right', 'Left', 'Both');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE lens_type AS ENUM ('PMMA', 'Foldable Acrylic', 'Hydrophilic', 'Hydrophobic');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE surgery_status AS ENUM ('Scheduled', 'In-Theatre', 'Completed', 'Cancelled', 'Postponed');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE follow_up_milestone AS ENUM ('Day 1', 'Week 1', 'Month 1', 'Month 3');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE follow_up_status AS ENUM ('Pending', 'Due', 'Overdue', 'Completed', 'Missed');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE doctor_review_status AS ENUM ('Not Needed', 'Pending', 'Completed');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE medication_status AS ENUM ('Prescribed', 'Taking', 'Completed', 'Stopped');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  role user_role NOT NULL,
  initials TEXT NOT NULL DEFAULT '',
  color TEXT NOT NULL DEFAULT '#0d9488',
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type campaign_type NOT NULL,
  status campaign_status NOT NULL DEFAULT 'Planned',
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  budget DECIMAL(14, 2) NOT NULL DEFAULT 0,
  donors TEXT NOT NULL DEFAULT '',
  target_screenings INTEGER NOT NULL DEFAULT 0,
  target_surgeries INTEGER NOT NULL DEFAULT 0,
  target_follow_ups INTEGER NOT NULL DEFAULT 0,
  description TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS patients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_code TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  date_of_birth DATE NOT NULL,
  sex sex NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  district TEXT NOT NULL,
  region TEXT NOT NULL,
  occupation TEXT,
  education TEXT,
  disability_status disability_status NOT NULL DEFAULT 'None',
  insurance_status TEXT NOT NULL DEFAULT 'None',
  emergency_contact TEXT NOT NULL DEFAULT '',
  emergency_phone TEXT NOT NULL DEFAULT '',
  consent_given BOOLEAN NOT NULL DEFAULT false,
  consent_date DATE,
  campaign_id UUID REFERENCES campaigns(id),
  referral_source TEXT NOT NULL DEFAULT '',
  notes TEXT,
  location_id UUID,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  created_at TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS screenings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  patient_name TEXT NOT NULL,
  campaign_id UUID NOT NULL REFERENCES campaigns(id),
  location_id UUID NOT NULL,
  screened_by TEXT NOT NULL,
  screened_at TIMESTAMPTZ(3) NOT NULL,
  va_right_unaided va_grade NOT NULL,
  va_left_unaided va_grade NOT NULL,
  va_right_corrected va_grade,
  va_left_corrected va_grade,
  iop_right SMALLINT,
  iop_left SMALLINT,
  cataract_suspected BOOLEAN NOT NULL DEFAULT false,
  glaucoma_suspected BOOLEAN NOT NULL DEFAULT false,
  diabetic_retinopathy BOOLEAN NOT NULL DEFAULT false,
  other_findings TEXT NOT NULL DEFAULT '',
  medical_history TEXT NOT NULL DEFAULT '',
  current_medications TEXT NOT NULL DEFAULT '',
  recommendation screening_recommendation NOT NULL,
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS surgeries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  patient_name TEXT NOT NULL,
  campaign_id UUID NOT NULL REFERENCES campaigns(id),
  location_id UUID NOT NULL,
  surgeon_id UUID,
  surgeon_name TEXT,
  eye surgery_eye NOT NULL,
  lens_type lens_type NOT NULL,
  scheduled_at TIMESTAMPTZ(3) NOT NULL,
  performed_at TIMESTAMPTZ(3),
  status surgery_status NOT NULL DEFAULT 'Scheduled',
  pre_op_va TEXT NOT NULL DEFAULT '',
  post_op_va TEXT,
  complications TEXT NOT NULL DEFAULT '',
  intraop_notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS follow_ups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  patient_name TEXT NOT NULL,
  surgery_id UUID NOT NULL REFERENCES surgeries(id) ON DELETE CASCADE,
  campaign_id UUID NOT NULL REFERENCES campaigns(id),
  milestone follow_up_milestone NOT NULL,
  due_date DATE NOT NULL,
  completed_at TIMESTAMPTZ(3),
  status follow_up_status NOT NULL DEFAULT 'Pending',
  va_right_post TEXT,
  va_left_post TEXT,
  complications TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  doctor_review_status doctor_review_status NOT NULL DEFAULT 'Not Needed',
  doctor_reviewed_at TIMESTAMPTZ(3),
  doctor_name TEXT NOT NULL DEFAULT '',
  doctor_diagnosis TEXT NOT NULL DEFAULT '',
  doctor_treatment_plan TEXT NOT NULL DEFAULT '',
  doctor_notes TEXT NOT NULL DEFAULT '',
  next_appointment_date DATE,
  sms_reminder_sent BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS follow_up_medications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  follow_up_id UUID NOT NULL REFERENCES follow_ups(id) ON DELETE CASCADE,
  drug_name TEXT NOT NULL,
  dosage TEXT NOT NULL DEFAULT '',
  frequency TEXT NOT NULL DEFAULT '',
  duration TEXT NOT NULL DEFAULT '',
  instructions TEXT NOT NULL DEFAULT '',
  status medication_status NOT NULL DEFAULT 'Prescribed',
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor TEXT NOT NULL,
  action TEXT NOT NULL,
  entity TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  details TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_patients_campaign_id ON patients(campaign_id);
CREATE INDEX IF NOT EXISTS idx_patients_patient_code ON patients(patient_code);
CREATE INDEX IF NOT EXISTS idx_screenings_patient_id ON screenings(patient_id);
CREATE INDEX IF NOT EXISTS idx_screenings_campaign_id ON screenings(campaign_id);
CREATE INDEX IF NOT EXISTS idx_screenings_screened_at ON screenings(screened_at DESC);
CREATE INDEX IF NOT EXISTS idx_surgeries_patient_id ON surgeries(patient_id);
CREATE INDEX IF NOT EXISTS idx_surgeries_campaign_id ON surgeries(campaign_id);
CREATE INDEX IF NOT EXISTS idx_surgeries_status ON surgeries(status);
CREATE INDEX IF NOT EXISTS idx_surgeries_scheduled_at ON surgeries(scheduled_at DESC);
CREATE INDEX IF NOT EXISTS idx_follow_ups_patient_id ON follow_ups(patient_id);
CREATE INDEX IF NOT EXISTS idx_follow_ups_surgery_id ON follow_ups(surgery_id);
CREATE INDEX IF NOT EXISTS idx_follow_ups_surgery_milestone ON follow_ups(surgery_id, milestone);
CREATE INDEX IF NOT EXISTS idx_follow_ups_campaign_id ON follow_ups(campaign_id);
CREATE INDEX IF NOT EXISTS idx_follow_ups_due_date ON follow_ups(due_date);
CREATE INDEX IF NOT EXISTS idx_follow_ups_status ON follow_ups(status);
CREATE INDEX IF NOT EXISTS idx_follow_ups_status_due_date ON follow_ups(status, due_date);
CREATE INDEX IF NOT EXISTS idx_follow_ups_doctor_review_status ON follow_ups(doctor_review_status);
CREATE INDEX IF NOT EXISTS idx_follow_up_medications_follow_up_id ON follow_up_medications(follow_up_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity, entity_id);
