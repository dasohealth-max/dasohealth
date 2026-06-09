-- =============================================================================
-- EyeCare Pro — Database Schema
-- Generated from TypeScript types in types/index.ts
-- Run this against a fresh Supabase project (SQL Editor or CLI).
-- =============================================================================

-- Enable UUID generation (available by default in Supabase; included for safety)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================================================
-- ENUMS
-- =============================================================================

CREATE TYPE user_role AS ENUM (
  'Super Administrator',
  'Project Manager',
  'Campaign Manager',
  'Hospital Coordinator',
  'Data Clerk',
  'Screening Officer',
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

CREATE TYPE campaign_type AS ENUM (
  'Cataract',
  'School Eye Health',
  'Diabetic Retinopathy',
  'Glaucoma',
  'General'
);

CREATE TYPE campaign_status AS ENUM (
  'Planned',
  'Active',
  'Completed',
  'Suspended'
);

CREATE TYPE facility_type AS ENUM (
  'Hospital',
  'Clinic',
  'Mobile Unit',
  'School',
  'Community Centre'
);

CREATE TYPE sex AS ENUM ('Male', 'Female', 'Other');

CREATE TYPE disability_status AS ENUM (
  'None',
  'Visual',
  'Hearing',
  'Mobility',
  'Cognitive',
  'Multiple'
);

CREATE TYPE va_grade AS ENUM (
  '6/6', '6/9', '6/12', '6/18', '6/24', '6/36', '6/60', '<6/60',
  'CF', 'HM', 'PL', 'NPL'
);

CREATE TYPE screening_recommendation AS ENUM (
  'Discharge',
  'Refer for Surgery',
  'Further Investigation',
  'Glasses',
  'Follow-up'
);

CREATE TYPE surgery_eye AS ENUM ('Right', 'Left', 'Both');

CREATE TYPE lens_type AS ENUM (
  'PMMA',
  'Foldable Acrylic',
  'Hydrophilic',
  'Hydrophobic'
);

CREATE TYPE surgery_status AS ENUM (
  'Scheduled',
  'In-Theatre',
  'Completed',
  'Cancelled',
  'Postponed'
);

CREATE TYPE referral_source AS ENUM (
  'CHW',
  'Volunteer',
  'School',
  'Facility',
  'Self',
  'Community Leader'
);

CREATE TYPE referral_status AS ENUM (
  'Pending',
  'Contacted',
  'Screened',
  'Converted',
  'Lost'
);

CREATE TYPE follow_up_milestone AS ENUM (
  'Day 1',
  'Week 1',
  'Month 1',
  'Month 3'
);

CREATE TYPE follow_up_status AS ENUM (
  'Pending',
  'Due',
  'Overdue',
  'Completed',
  'Missed'
);

CREATE TYPE inventory_category AS ENUM (
  'IOL',
  'Medication',
  'Equipment',
  'Consumable',
  'PPE'
);

CREATE TYPE outreach_type AS ENUM (
  'Awareness Campaign',
  'Community Meeting',
  'Radio Broadcast',
  'School Visit',
  'Health Fair',
  'CHW Training'
);

CREATE TYPE transport_status AS ENUM (
  'Scheduled',
  'In-Transit',
  'Completed',
  'Cancelled'
);

-- =============================================================================
-- TABLES
-- =============================================================================

-- -----------------------------------------------------------------------------
-- users
-- Stores application users. Passwords are hashed in production.
-- In this app, role-based access control lives in the app layer (lib/permissions.ts).
-- -----------------------------------------------------------------------------
CREATE TABLE users (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT        NOT NULL,
  email       TEXT        NOT NULL UNIQUE,
  password    TEXT        NOT NULL,
  role        user_role   NOT NULL,
  initials    TEXT        NOT NULL,
  color       TEXT        NOT NULL DEFAULT '#0d9488',
  active      BOOLEAN     NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- campaigns
-- A time-boxed programme (e.g. Cataract Outreach 2025).
-- -----------------------------------------------------------------------------
CREATE TABLE campaigns (
  id                 UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
  name               TEXT            NOT NULL,
  type               campaign_type   NOT NULL,
  status             campaign_status NOT NULL DEFAULT 'Planned',
  start_date         DATE            NOT NULL,
  end_date           DATE            NOT NULL,
  budget             NUMERIC(14, 2)  NOT NULL DEFAULT 0,
  donors             TEXT            NOT NULL DEFAULT '',
  target_screenings  INT             NOT NULL DEFAULT 0,
  target_surgeries   INT             NOT NULL DEFAULT 0,
  target_follow_ups  INT             NOT NULL DEFAULT 0,
  description        TEXT            NOT NULL DEFAULT '',
  created_at         TIMESTAMPTZ     NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- locations
-- Physical facilities where services are delivered.
-- -----------------------------------------------------------------------------
CREATE TABLE locations (
  id             UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  name           TEXT          NOT NULL,
  code           TEXT          NOT NULL UNIQUE,
  facility_type  facility_type NOT NULL,
  district       TEXT          NOT NULL,
  region         TEXT          NOT NULL,
  country        TEXT          NOT NULL DEFAULT 'Somalia',
  lat            DOUBLE PRECISION NOT NULL,
  lng            DOUBLE PRECISION NOT NULL,
  phone          TEXT,
  created_at     TIMESTAMPTZ   NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- campaign_locations  (junction: campaigns <-> locations, many-to-many)
-- Replaces the locationIds string[] on Campaign.
-- -----------------------------------------------------------------------------
CREATE TABLE campaign_locations (
  campaign_id  UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  location_id  UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  PRIMARY KEY (campaign_id, location_id)
);

-- -----------------------------------------------------------------------------
-- patients
-- Beneficiary registered in the system.
-- -----------------------------------------------------------------------------
CREATE TABLE patients (
  id                 UUID              PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_code       TEXT              NOT NULL UNIQUE,
  full_name          TEXT              NOT NULL,
  date_of_birth      DATE              NOT NULL,
  sex                sex               NOT NULL,
  phone              TEXT              NOT NULL,
  email              TEXT,
  district           TEXT              NOT NULL,
  region             TEXT              NOT NULL,
  occupation         TEXT,
  education          TEXT,
  disability_status  disability_status NOT NULL DEFAULT 'None',
  insurance_status   TEXT              NOT NULL DEFAULT 'None',
  emergency_contact  TEXT              NOT NULL DEFAULT '',
  emergency_phone    TEXT              NOT NULL DEFAULT '',
  consent_given      BOOLEAN           NOT NULL DEFAULT false,
  consent_date       DATE,
  campaign_id        UUID              REFERENCES campaigns(id),
  location_id        UUID              REFERENCES locations(id),
  referral_source    TEXT              NOT NULL DEFAULT '',
  notes              TEXT,
  lat                DOUBLE PRECISION,
  lng                DOUBLE PRECISION,
  created_at         TIMESTAMPTZ       NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- screenings
-- Eye health assessment performed during a campaign visit.
-- -----------------------------------------------------------------------------
CREATE TABLE screenings (
  id                    UUID                     PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id            UUID                     NOT NULL REFERENCES patients(id)  ON DELETE CASCADE,
  patient_name          TEXT                     NOT NULL,
  campaign_id           UUID                     NOT NULL REFERENCES campaigns(id),
  location_id           UUID                     NOT NULL REFERENCES locations(id),
  screened_by           TEXT                     NOT NULL,
  screened_at           TIMESTAMPTZ              NOT NULL,
  va_right_unaided      va_grade                 NOT NULL,
  va_left_unaided       va_grade                 NOT NULL,
  va_right_corrected    va_grade,
  va_left_corrected     va_grade,
  iop_right             SMALLINT,
  iop_left              SMALLINT,
  cataract_suspected    BOOLEAN                  NOT NULL DEFAULT false,
  glaucoma_suspected    BOOLEAN                  NOT NULL DEFAULT false,
  diabetic_retinopathy  BOOLEAN                  NOT NULL DEFAULT false,
  other_findings        TEXT                     NOT NULL DEFAULT '',
  medical_history       TEXT                     NOT NULL DEFAULT '',
  current_medications   TEXT                     NOT NULL DEFAULT '',
  recommendation        screening_recommendation NOT NULL,
  notes                 TEXT                     NOT NULL DEFAULT '',
  created_at            TIMESTAMPTZ              NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- referrals
-- A lead / referred person who has not yet become a registered patient.
-- -----------------------------------------------------------------------------
CREATE TABLE referrals (
  id              UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
  screening_id    UUID            REFERENCES screenings(id),
  patient_name    TEXT            NOT NULL,
  patient_phone   TEXT            NOT NULL,
  source          referral_source NOT NULL,
  referred_by     TEXT            NOT NULL,
  campaign_id     UUID            NOT NULL REFERENCES campaigns(id),
  location_id     UUID            NOT NULL REFERENCES locations(id),
  status          referral_status NOT NULL DEFAULT 'Pending',
  referred_at     DATE            NOT NULL,
  contacted_at    DATE,
  screened_at     DATE,
  converted_at    DATE,
  notes           TEXT            NOT NULL DEFAULT '',
  created_at      TIMESTAMPTZ     NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- surgeries
-- A surgical procedure (typically cataract extraction / IOL implant).
-- surgeon_id is nullable to support the "unassigned surgeon" workflow.
-- -----------------------------------------------------------------------------
CREATE TABLE surgeries (
  id              UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id      UUID           NOT NULL REFERENCES patients(id)  ON DELETE CASCADE,
  patient_name    TEXT           NOT NULL,
  campaign_id     UUID           NOT NULL REFERENCES campaigns(id),
  location_id     UUID           NOT NULL REFERENCES locations(id),
  surgeon_id      UUID           REFERENCES users(id),
  surgeon_name    TEXT,
  eye             surgery_eye    NOT NULL,
  lens_type       lens_type      NOT NULL,
  scheduled_at    TIMESTAMPTZ    NOT NULL,
  performed_at    TIMESTAMPTZ,
  status          surgery_status NOT NULL DEFAULT 'Scheduled',
  pre_op_va       TEXT           NOT NULL DEFAULT '',
  post_op_va      TEXT,
  complications   TEXT           NOT NULL DEFAULT '',
  intraop_notes   TEXT           NOT NULL DEFAULT '',
  created_at      TIMESTAMPTZ    NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- follow_ups
-- Post-operative check-in at standardised milestones.
-- -----------------------------------------------------------------------------
CREATE TABLE follow_ups (
  id                  UUID                PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id          UUID                NOT NULL REFERENCES patients(id)  ON DELETE CASCADE,
  patient_name        TEXT                NOT NULL,
  surgery_id          UUID                NOT NULL REFERENCES surgeries(id) ON DELETE CASCADE,
  campaign_id         UUID                NOT NULL REFERENCES campaigns(id),
  milestone           follow_up_milestone NOT NULL,
  due_date            DATE                NOT NULL,
  completed_at        TIMESTAMPTZ,
  status              follow_up_status    NOT NULL DEFAULT 'Pending',
  va_right_post       TEXT,
  va_left_post        TEXT,
  complications       TEXT                NOT NULL DEFAULT '',
  notes               TEXT                NOT NULL DEFAULT '',
  sms_reminder_sent   BOOLEAN             NOT NULL DEFAULT false,
  created_at          TIMESTAMPTZ         NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- inventory_items
-- Medical supplies, equipment, and consumables.
-- -----------------------------------------------------------------------------
CREATE TABLE inventory_items (
  id             UUID               PRIMARY KEY DEFAULT gen_random_uuid(),
  sku            TEXT               NOT NULL UNIQUE,
  name           TEXT               NOT NULL,
  category       inventory_category NOT NULL,
  quantity       INT                NOT NULL DEFAULT 0,
  reorder_level  INT                NOT NULL DEFAULT 0,
  unit           TEXT               NOT NULL,
  expiry_date    DATE,
  supplier       TEXT               NOT NULL DEFAULT '',
  location_id    UUID               NOT NULL REFERENCES locations(id),
  notes          TEXT               NOT NULL DEFAULT '',
  created_at     TIMESTAMPTZ        NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- outreach_activities
-- Community / school / radio outreach events.
-- location_name is denormalised for display convenience.
-- -----------------------------------------------------------------------------
CREATE TABLE outreach_activities (
  id             UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  type           outreach_type NOT NULL,
  title          TEXT          NOT NULL,
  date           DATE          NOT NULL,
  location_id    UUID          NOT NULL REFERENCES locations(id),
  location_name  TEXT          NOT NULL,
  campaign_id    UUID          NOT NULL REFERENCES campaigns(id),
  reach          INT           NOT NULL DEFAULT 0,
  conversions    INT           NOT NULL DEFAULT 0,
  conducted_by   TEXT          NOT NULL,
  notes          TEXT          NOT NULL DEFAULT '',
  created_at     TIMESTAMPTZ   NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- transport_jobs
-- Patient transport bookings.
-- -----------------------------------------------------------------------------
CREATE TABLE transport_jobs (
  id               UUID             PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id       UUID             NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  patient_name     TEXT             NOT NULL,
  vehicle          TEXT             NOT NULL,
  driver           TEXT             NOT NULL,
  pickup_location  TEXT             NOT NULL,
  drop_location    TEXT             NOT NULL,
  scheduled_at     TIMESTAMPTZ      NOT NULL,
  completed_at     TIMESTAMPTZ,
  cost             NUMERIC(10, 2)   NOT NULL DEFAULT 0,
  status           transport_status NOT NULL DEFAULT 'Scheduled',
  notes            TEXT             NOT NULL DEFAULT '',
  created_at       TIMESTAMPTZ      NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- audit_logs
-- Immutable event log. Rows should never be updated or deleted in production.
-- entity_id is TEXT (not UUID FK) to support cross-entity references generically.
-- -----------------------------------------------------------------------------
CREATE TABLE audit_logs (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  actor       TEXT        NOT NULL,
  action      TEXT        NOT NULL,
  entity      TEXT        NOT NULL,
  entity_id   TEXT        NOT NULL,
  details     TEXT        NOT NULL DEFAULT '',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================================================
-- INDEXES
-- Covers all foreign keys and the columns most likely to appear in WHERE / ORDER.
-- =============================================================================

-- patients
CREATE INDEX idx_patients_campaign_id   ON patients(campaign_id);
CREATE INDEX idx_patients_location_id   ON patients(location_id);
CREATE INDEX idx_patients_patient_code  ON patients(patient_code);

-- screenings
CREATE INDEX idx_screenings_patient_id   ON screenings(patient_id);
CREATE INDEX idx_screenings_campaign_id  ON screenings(campaign_id);
CREATE INDEX idx_screenings_location_id  ON screenings(location_id);
CREATE INDEX idx_screenings_screened_at  ON screenings(screened_at DESC);

-- referrals
CREATE INDEX idx_referrals_campaign_id  ON referrals(campaign_id);
CREATE INDEX idx_referrals_location_id  ON referrals(location_id);
CREATE INDEX idx_referrals_status       ON referrals(status);

-- surgeries
CREATE INDEX idx_surgeries_patient_id   ON surgeries(patient_id);
CREATE INDEX idx_surgeries_campaign_id  ON surgeries(campaign_id);
CREATE INDEX idx_surgeries_surgeon_id   ON surgeries(surgeon_id);
CREATE INDEX idx_surgeries_status       ON surgeries(status);
CREATE INDEX idx_surgeries_scheduled_at ON surgeries(scheduled_at DESC);

-- follow_ups
CREATE INDEX idx_follow_ups_patient_id  ON follow_ups(patient_id);
CREATE INDEX idx_follow_ups_surgery_id  ON follow_ups(surgery_id);
CREATE INDEX idx_follow_ups_campaign_id ON follow_ups(campaign_id);
CREATE INDEX idx_follow_ups_due_date    ON follow_ups(due_date);
CREATE INDEX idx_follow_ups_status      ON follow_ups(status);

-- inventory_items
CREATE INDEX idx_inventory_location_id  ON inventory_items(location_id);
CREATE INDEX idx_inventory_category     ON inventory_items(category);

-- outreach_activities
CREATE INDEX idx_outreach_campaign_id  ON outreach_activities(campaign_id);
CREATE INDEX idx_outreach_location_id  ON outreach_activities(location_id);

-- transport_jobs
CREATE INDEX idx_transport_patient_id  ON transport_jobs(patient_id);
CREATE INDEX idx_transport_status      ON transport_jobs(status);

-- audit_logs
CREATE INDEX idx_audit_logs_entity      ON audit_logs(entity, entity_id);
CREATE INDEX idx_audit_logs_created_at  ON audit_logs(created_at DESC);
