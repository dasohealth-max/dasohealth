-- =============================================================================
-- EyeCare Pro RLS verification checks
--
-- Run in the Supabase SQL editor after applying supabase/rls.sql.
-- The script uses fixed rollback-only test data and ends with ROLLBACK.
-- =============================================================================

BEGIN;

-- Privileged setup data. This runs as the SQL editor owner before role switching.
INSERT INTO campaigns (
  id, name, type, status, region, operation_district,
  project_manager_id, project_manager_name, start_date, end_date
) VALUES
  ('11111111-1111-1111-1111-111111111111', 'RLS Galmudug', 'Cataract', 'Active', 'Galmudug', 'Dhuusamareeb', '', '', CURRENT_DATE, CURRENT_DATE + 30),
  ('22222222-2222-2222-2222-222222222222', 'RLS Banadir', 'Cataract', 'Active', 'Banadir / Mogadishu', 'Mogadishu', '', '', CURRENT_DATE, CURRENT_DATE + 30);

INSERT INTO campaign_regions (
  id, campaign_id, type, region, operation_district,
  start_date, end_date
) VALUES
  ('33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', 'Cataract Surgery Outreach', 'Galmudug', 'Dhuusamareeb', CURRENT_DATE, CURRENT_DATE + 30),
  ('44444444-4444-4444-4444-444444444444', '22222222-2222-2222-2222-222222222222', 'Cataract Surgery Outreach', 'Banadir / Mogadishu', 'Mogadishu', CURRENT_DATE, CURRENT_DATE + 30);

INSERT INTO patients (
  id, patient_code, full_name, date_of_birth, sex, phone,
  district, region, operation_district, disability_status,
  consent_given, consent_date, campaign_id, campaign_region_id,
  referral_source, registered_by_id, registered_by_name
) VALUES
  ('55555555-5555-5555-5555-555555555555', 'RLSG1', 'RLS Galmudug Patient', DATE '1970-01-01', 'Female', '+252610000001',
   'Dhuusamareeb', 'Galmudug', 'Dhuusamareeb', 'None',
   true, CURRENT_DATE, '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333333',
   'RLS test', '00000000-0000-0000-0000-000000000001', 'RLS Test'),
  ('66666666-6666-6666-6666-666666666666', 'RLSB1', 'RLS Banadir Patient', DATE '1970-01-01', 'Female', '+252610000002',
   'Mogadishu', 'Banadir / Mogadishu', 'Mogadishu', 'None',
   true, CURRENT_DATE, '22222222-2222-2222-2222-222222222222', '44444444-4444-4444-4444-444444444444',
   'RLS test', '00000000-0000-0000-0000-000000000001', 'RLS Test');

CREATE TEMP TABLE rls_results (
  check_name text PRIMARY KEY,
  passed boolean NOT NULL,
  details text NOT NULL DEFAULT ''
) ON COMMIT DROP;

CREATE OR REPLACE FUNCTION pg_temp.set_claims(role_name text, assigned_region text)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object(
      'sub', '99999999-9999-9999-9999-999999999999',
      'role', 'authenticated',
      'app_metadata', json_build_object(
        'role', role_name,
        'assignedRegion', assigned_region
      )
    )::text,
    true
  );
END;
$$;

CREATE OR REPLACE FUNCTION pg_temp.record_check(name text, condition boolean, details text DEFAULT '')
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO rls_results(check_name, passed, details)
  VALUES (name, condition, COALESCE(details, ''));
END;
$$;

-- Super Admin can read all region-scoped clinical rows.
SET LOCAL ROLE authenticated;
SELECT pg_temp.set_claims('Super Administrator', '');
SELECT pg_temp.record_check(
  'super_admin_reads_all_patients',
  (SELECT count(*) FROM patients WHERE patient_code IN ('RLSG1', 'RLSB1')) = 2
);
RESET ROLE;

-- Project Manager can read only assigned region.
SET LOCAL ROLE authenticated;
SELECT pg_temp.set_claims('Project Manager', 'Galmudug');
SELECT pg_temp.record_check(
  'project_manager_reads_only_assigned_region',
  (SELECT count(*) FROM patients WHERE patient_code IN ('RLSG1', 'RLSB1')) = 1
  AND EXISTS (SELECT 1 FROM patients WHERE patient_code = 'RLSG1')
  AND NOT EXISTS (SELECT 1 FROM patients WHERE patient_code = 'RLSB1')
);
RESET ROLE;

-- Data Clerk can read only assigned region.
SET LOCAL ROLE authenticated;
SELECT pg_temp.set_claims('Data Clerk', 'Galmudug');
SELECT pg_temp.record_check(
  'data_clerk_reads_only_assigned_region',
  (SELECT count(*) FROM patients WHERE patient_code IN ('RLSG1', 'RLSB1')) = 1
  AND EXISTS (SELECT 1 FROM patients WHERE patient_code = 'RLSG1')
  AND NOT EXISTS (SELECT 1 FROM patients WHERE patient_code = 'RLSB1')
);
RESET ROLE;

-- Screening Officer can read only assigned region.
SET LOCAL ROLE authenticated;
SELECT pg_temp.set_claims('Screening Officer', 'Galmudug');
SELECT pg_temp.record_check(
  'screening_officer_reads_only_assigned_region',
  (SELECT count(*) FROM patients WHERE patient_code IN ('RLSG1', 'RLSB1')) = 1
  AND EXISTS (SELECT 1 FROM patients WHERE patient_code = 'RLSG1')
  AND NOT EXISTS (SELECT 1 FROM patients WHERE patient_code = 'RLSB1')
);
RESET ROLE;

-- Browser/authenticated clients cannot directly write clinical records.
DO $$
DECLARE
  denied boolean := false;
BEGIN
  SET LOCAL ROLE authenticated;
  PERFORM pg_temp.set_claims('Data Clerk', 'Galmudug');

  BEGIN
    INSERT INTO patients (
      patient_code, full_name, date_of_birth, sex, phone,
      district, region, operation_district, disability_status,
      consent_given, consent_date, campaign_id, campaign_region_id,
      referral_source, registered_by_id, registered_by_name
    ) VALUES (
      'RLS-DENIED', 'Denied Patient', DATE '1970-01-01', 'Female', '+252610000003',
      'Dhuusamareeb', 'Galmudug', 'Dhuusamareeb', 'None',
      true, CURRENT_DATE, '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333333',
      'RLS test', '00000000-0000-0000-0000-000000000001', 'RLS Test'
    );
  EXCEPTION WHEN insufficient_privilege OR check_violation THEN
    denied := true;
  END;

  RESET ROLE;
  PERFORM pg_temp.record_check('authenticated_browser_cannot_insert_patient', denied);
END $$;

-- Browser/anon clients cannot read or write clinical records.
SET LOCAL ROLE anon;
SELECT pg_temp.record_check(
  'anon_cannot_read_patients',
  (SELECT count(*) FROM patients WHERE patient_code IN ('RLSG1', 'RLSB1')) = 0
);
RESET ROLE;

-- Service role can still perform server-side writes.
DO $$
DECLARE
  wrote boolean := false;
BEGIN
  SET LOCAL ROLE service_role;
  INSERT INTO patients (
    id, patient_code, full_name, date_of_birth, sex, phone,
    district, region, operation_district, disability_status,
    consent_given, consent_date, campaign_id, campaign_region_id,
    referral_source, registered_by_id, registered_by_name
  ) VALUES (
    '77777777-7777-7777-7777-777777777777', 'RLSSVC1', 'RLS Service Patient', DATE '1970-01-01', 'Female', '+252610000004',
    'Dhuusamareeb', 'Galmudug', 'Dhuusamareeb', 'None',
    true, CURRENT_DATE, '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333333',
    'RLS test', '00000000-0000-0000-0000-000000000001', 'RLS Test'
  );
  wrote := EXISTS (SELECT 1 FROM patients WHERE patient_code = 'RLSSVC1');
  RESET ROLE;
  PERFORM pg_temp.record_check('service_role_can_insert_patient', wrote);
END $$;

TABLE rls_results ORDER BY check_name;

DO $$
DECLARE
  failures text;
BEGIN
  SELECT string_agg(check_name || ': ' || details, E'\n')
  INTO failures
  FROM rls_results
  WHERE NOT passed;

  IF failures IS NOT NULL THEN
    RAISE EXCEPTION 'RLS verification failed:%', E'\n' || failures;
  END IF;
END $$;

ROLLBACK;
