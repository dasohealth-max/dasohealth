-- =============================================================================
-- EyeCare Pro - Row Level Security Policies
--
-- RLS model:
--   - Browser clients use the public anon key and may authenticate as a user.
--   - Authenticated browser access may read only rows allowed by the user's
--     Supabase JWT app metadata.
--   - Browser/anon/authenticated clients are not allowed to write clinical data.
--   - Server Actions, route handlers, Prisma, and Supabase service-role flows
--     remain the write path. The Supabase service-role bypasses RLS by design.
--
-- Required JWT app_metadata maintained by the app:
--   - role: one of "Super Administrator", "Project Manager", "Data Clerk",
--     "Screening Officer"
--   - assignedRegion: regional scope for non-super-admin users
--
-- Apply this file in the Supabase SQL editor or through a migration after
-- validating against a staging project.
-- =============================================================================

-- =============================================================================
-- Helpers
-- =============================================================================

CREATE OR REPLACE FUNCTION public.current_app_role()
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    auth.jwt() -> 'app_metadata' ->> 'role',
    auth.jwt() -> 'user_metadata' ->> 'role',
    ''
  );
$$;

CREATE OR REPLACE FUNCTION public.current_assigned_region()
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    auth.jwt() -> 'app_metadata' ->> 'assignedRegion',
    auth.jwt() -> 'user_metadata' ->> 'assignedRegion',
    ''
  );
$$;

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT public.current_app_role() = 'Super Administrator';
$$;

CREATE OR REPLACE FUNCTION public.can_read_region(row_region text)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT public.is_super_admin()
    OR (
      public.current_app_role() IN ('Project Manager', 'Data Clerk', 'Screening Officer')
      AND public.current_assigned_region() <> ''
      AND row_region = public.current_assigned_region()
    );
$$;

CREATE OR REPLACE FUNCTION public.deny_browser_write()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT false;
$$;

-- =============================================================================
-- Enable RLS on current application tables
-- =============================================================================

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_regions ENABLE ROW LEVEL SECURITY;
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE screenings ENABLE ROW LEVEL SECURITY;
ALTER TABLE surgeries ENABLE ROW LEVEL SECURITY;
ALTER TABLE follow_ups ENABLE ROW LEVEL SECURITY;
ALTER TABLE follow_up_medications ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- Drop previous broad policies
-- =============================================================================

DROP POLICY IF EXISTS "users_select" ON users;
DROP POLICY IF EXISTS "users_insert" ON users;
DROP POLICY IF EXISTS "users_update" ON users;
DROP POLICY IF EXISTS "users_delete" ON users;

DROP POLICY IF EXISTS "campaigns_select" ON campaigns;
DROP POLICY IF EXISTS "campaigns_insert" ON campaigns;
DROP POLICY IF EXISTS "campaigns_update" ON campaigns;
DROP POLICY IF EXISTS "campaigns_delete" ON campaigns;

DROP POLICY IF EXISTS "campaign_regions_select" ON campaign_regions;
DROP POLICY IF EXISTS "campaign_regions_insert" ON campaign_regions;
DROP POLICY IF EXISTS "campaign_regions_update" ON campaign_regions;
DROP POLICY IF EXISTS "campaign_regions_delete" ON campaign_regions;

DROP POLICY IF EXISTS "patients_select" ON patients;
DROP POLICY IF EXISTS "patients_insert" ON patients;
DROP POLICY IF EXISTS "patients_update" ON patients;
DROP POLICY IF EXISTS "patients_delete" ON patients;

DROP POLICY IF EXISTS "screenings_select" ON screenings;
DROP POLICY IF EXISTS "screenings_insert" ON screenings;
DROP POLICY IF EXISTS "screenings_update" ON screenings;
DROP POLICY IF EXISTS "screenings_delete" ON screenings;

DROP POLICY IF EXISTS "surgeries_select" ON surgeries;
DROP POLICY IF EXISTS "surgeries_insert" ON surgeries;
DROP POLICY IF EXISTS "surgeries_update" ON surgeries;
DROP POLICY IF EXISTS "surgeries_delete" ON surgeries;

DROP POLICY IF EXISTS "follow_ups_select" ON follow_ups;
DROP POLICY IF EXISTS "follow_ups_insert" ON follow_ups;
DROP POLICY IF EXISTS "follow_ups_update" ON follow_ups;
DROP POLICY IF EXISTS "follow_ups_delete" ON follow_ups;

DROP POLICY IF EXISTS "follow_up_medications_select" ON follow_up_medications;
DROP POLICY IF EXISTS "follow_up_medications_insert" ON follow_up_medications;
DROP POLICY IF EXISTS "follow_up_medications_update" ON follow_up_medications;
DROP POLICY IF EXISTS "follow_up_medications_delete" ON follow_up_medications;

DROP POLICY IF EXISTS "audit_logs_select" ON audit_logs;
DROP POLICY IF EXISTS "audit_logs_insert" ON audit_logs;
DROP POLICY IF EXISTS "audit_logs_update" ON audit_logs;
DROP POLICY IF EXISTS "audit_logs_delete" ON audit_logs;

-- =============================================================================
-- Users
-- Authenticated users may read themselves. Super admins may read all users.
-- Browser writes are denied; user management must go through server actions.
-- =============================================================================

CREATE POLICY "users_select"
  ON users FOR SELECT TO authenticated
  USING (public.is_super_admin() OR id = auth.uid());

CREATE POLICY "users_insert"
  ON users FOR INSERT TO authenticated
  WITH CHECK (public.deny_browser_write());

CREATE POLICY "users_update"
  ON users FOR UPDATE TO authenticated
  USING (public.deny_browser_write())
  WITH CHECK (public.deny_browser_write());

CREATE POLICY "users_delete"
  ON users FOR DELETE TO authenticated
  USING (public.deny_browser_write());

-- =============================================================================
-- Campaign configuration
-- Region-scoped users may read their assigned region. Super admins read all.
-- Browser writes are denied; campaign changes must go through server actions.
-- =============================================================================

CREATE POLICY "campaigns_select"
  ON campaigns FOR SELECT TO authenticated
  USING (
    public.is_super_admin()
    OR public.can_read_region(region)
    OR EXISTS (
      SELECT 1
      FROM campaign_regions cr
      WHERE cr.campaign_id = campaigns.id
        AND public.can_read_region(cr.region)
    )
  );

CREATE POLICY "campaigns_insert"
  ON campaigns FOR INSERT TO authenticated
  WITH CHECK (public.deny_browser_write());

CREATE POLICY "campaigns_update"
  ON campaigns FOR UPDATE TO authenticated
  USING (public.deny_browser_write())
  WITH CHECK (public.deny_browser_write());

CREATE POLICY "campaigns_delete"
  ON campaigns FOR DELETE TO authenticated
  USING (public.deny_browser_write());

CREATE POLICY "campaign_regions_select"
  ON campaign_regions FOR SELECT TO authenticated
  USING (public.can_read_region(region));

CREATE POLICY "campaign_regions_insert"
  ON campaign_regions FOR INSERT TO authenticated
  WITH CHECK (public.deny_browser_write());

CREATE POLICY "campaign_regions_update"
  ON campaign_regions FOR UPDATE TO authenticated
  USING (public.deny_browser_write())
  WITH CHECK (public.deny_browser_write());

CREATE POLICY "campaign_regions_delete"
  ON campaign_regions FOR DELETE TO authenticated
  USING (public.deny_browser_write());

-- =============================================================================
-- Clinical workflow data
-- Authenticated browser users may read only their allowed region. They cannot
-- insert, update, or delete patient clinical records directly. Server Actions
-- remain responsible for validation, audit logging, and RBAC before writing.
-- =============================================================================

CREATE POLICY "patients_select"
  ON patients FOR SELECT TO authenticated
  USING (public.can_read_region(region));

CREATE POLICY "patients_insert"
  ON patients FOR INSERT TO authenticated
  WITH CHECK (public.deny_browser_write());

CREATE POLICY "patients_update"
  ON patients FOR UPDATE TO authenticated
  USING (public.deny_browser_write())
  WITH CHECK (public.deny_browser_write());

CREATE POLICY "patients_delete"
  ON patients FOR DELETE TO authenticated
  USING (public.deny_browser_write());

CREATE POLICY "screenings_select"
  ON screenings FOR SELECT TO authenticated
  USING (public.can_read_region(region));

CREATE POLICY "screenings_insert"
  ON screenings FOR INSERT TO authenticated
  WITH CHECK (public.deny_browser_write());

CREATE POLICY "screenings_update"
  ON screenings FOR UPDATE TO authenticated
  USING (public.deny_browser_write())
  WITH CHECK (public.deny_browser_write());

CREATE POLICY "screenings_delete"
  ON screenings FOR DELETE TO authenticated
  USING (public.deny_browser_write());

CREATE POLICY "surgeries_select"
  ON surgeries FOR SELECT TO authenticated
  USING (public.can_read_region(region));

CREATE POLICY "surgeries_insert"
  ON surgeries FOR INSERT TO authenticated
  WITH CHECK (public.deny_browser_write());

CREATE POLICY "surgeries_update"
  ON surgeries FOR UPDATE TO authenticated
  USING (public.deny_browser_write())
  WITH CHECK (public.deny_browser_write());

CREATE POLICY "surgeries_delete"
  ON surgeries FOR DELETE TO authenticated
  USING (public.deny_browser_write());

CREATE POLICY "follow_ups_select"
  ON follow_ups FOR SELECT TO authenticated
  USING (public.can_read_region(region));

CREATE POLICY "follow_ups_insert"
  ON follow_ups FOR INSERT TO authenticated
  WITH CHECK (public.deny_browser_write());

CREATE POLICY "follow_ups_update"
  ON follow_ups FOR UPDATE TO authenticated
  USING (public.deny_browser_write())
  WITH CHECK (public.deny_browser_write());

CREATE POLICY "follow_ups_delete"
  ON follow_ups FOR DELETE TO authenticated
  USING (public.deny_browser_write());

CREATE POLICY "follow_up_medications_select"
  ON follow_up_medications FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM follow_ups fu
      WHERE fu.id = follow_up_medications.follow_up_id
        AND public.can_read_region(fu.region)
    )
  );

CREATE POLICY "follow_up_medications_insert"
  ON follow_up_medications FOR INSERT TO authenticated
  WITH CHECK (public.deny_browser_write());

CREATE POLICY "follow_up_medications_update"
  ON follow_up_medications FOR UPDATE TO authenticated
  USING (public.deny_browser_write())
  WITH CHECK (public.deny_browser_write());

CREATE POLICY "follow_up_medications_delete"
  ON follow_up_medications FOR DELETE TO authenticated
  USING (public.deny_browser_write());

-- =============================================================================
-- Audit logs
-- Browser users do not write audit logs. Super admins may read the audit trail.
-- Server Actions write audit logs through the trusted server/database path.
-- =============================================================================

CREATE POLICY "audit_logs_select"
  ON audit_logs FOR SELECT TO authenticated
  USING (public.is_super_admin());

CREATE POLICY "audit_logs_insert"
  ON audit_logs FOR INSERT TO authenticated
  WITH CHECK (public.deny_browser_write());

CREATE POLICY "audit_logs_update"
  ON audit_logs FOR UPDATE TO authenticated
  USING (public.deny_browser_write())
  WITH CHECK (public.deny_browser_write());

CREATE POLICY "audit_logs_delete"
  ON audit_logs FOR DELETE TO authenticated
  USING (public.deny_browser_write());
