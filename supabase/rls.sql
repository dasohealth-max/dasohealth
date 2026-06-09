-- =============================================================================
-- EyeCare Pro — Row Level Security Policies
--
-- Philosophy (Phase 1 — app-layer RBAC):
--   • RLS acts as a security boundary: unauthenticated callers get nothing.
--   • Fine-grained role checks (who can edit what) live in the Next.js app
--     (lib/permissions.ts), not in PostgreSQL — this keeps SQL simple and
--     keeps business logic in one place while the schema matures.
--   • The server-side Supabase client (createServerClient) uses the
--     service-role key which bypasses RLS. Only use it in Server Actions /
--     Route Handlers where the app layer already enforces permissions.
--
-- To tighten in Phase 2, replace `USING (true)` with expressions like:
--   USING (auth.uid() = created_by)   -- owner-only rows
--   USING (auth.jwt() ->> 'role' = 'Super Administrator')   -- role check
-- =============================================================================

-- =============================================================================
-- Helper: list all tables so we don't miss one
-- =============================================================================
-- Tables covered:
--   users, campaigns, locations, campaign_locations,
--   patients, screenings, referrals, surgeries,
--   follow_ups, inventory_items, outreach_activities,
--   transport_jobs, audit_logs

-- =============================================================================
-- ENABLE RLS ON ALL TABLES
-- =============================================================================

ALTER TABLE users                ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaigns            ENABLE ROW LEVEL SECURITY;
ALTER TABLE locations            ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_locations   ENABLE ROW LEVEL SECURITY;
ALTER TABLE patients             ENABLE ROW LEVEL SECURITY;
ALTER TABLE screenings           ENABLE ROW LEVEL SECURITY;
ALTER TABLE referrals            ENABLE ROW LEVEL SECURITY;
ALTER TABLE surgeries            ENABLE ROW LEVEL SECURITY;
ALTER TABLE follow_ups           ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_items      ENABLE ROW LEVEL SECURITY;
ALTER TABLE outreach_activities  ENABLE ROW LEVEL SECURITY;
ALTER TABLE transport_jobs       ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs           ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- MACRO: for each table we create four policies (SELECT / INSERT / UPDATE / DELETE)
-- Authenticated = any logged-in Supabase Auth user.
-- Anon callers (unauthenticated) are blocked by the absence of anon policies.
-- =============================================================================

-- ─── users ───────────────────────────────────────────────────────────────────

CREATE POLICY "users_select"  ON users FOR SELECT TO authenticated USING (true);
CREATE POLICY "users_insert"  ON users FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "users_update"  ON users FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "users_delete"  ON users FOR DELETE TO authenticated USING (true);

-- ─── campaigns ───────────────────────────────────────────────────────────────

CREATE POLICY "campaigns_select"  ON campaigns FOR SELECT TO authenticated USING (true);
CREATE POLICY "campaigns_insert"  ON campaigns FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "campaigns_update"  ON campaigns FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "campaigns_delete"  ON campaigns FOR DELETE TO authenticated USING (true);

-- ─── locations ───────────────────────────────────────────────────────────────

CREATE POLICY "locations_select"  ON locations FOR SELECT TO authenticated USING (true);
CREATE POLICY "locations_insert"  ON locations FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "locations_update"  ON locations FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "locations_delete"  ON locations FOR DELETE TO authenticated USING (true);

-- ─── campaign_locations ───────────────────────────────────────────────────────

CREATE POLICY "campaign_locations_select"  ON campaign_locations FOR SELECT TO authenticated USING (true);
CREATE POLICY "campaign_locations_insert"  ON campaign_locations FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "campaign_locations_update"  ON campaign_locations FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "campaign_locations_delete"  ON campaign_locations FOR DELETE TO authenticated USING (true);

-- ─── patients ─────────────────────────────────────────────────────────────────
-- NOTE: Donor Users should not see PII (name / phone). This is currently
-- enforced in the app via maskPatient() in lib/permissions.ts.
-- In Phase 2, add a column-level mask or a separate view for donor access.

CREATE POLICY "patients_select"  ON patients FOR SELECT TO authenticated USING (true);
CREATE POLICY "patients_insert"  ON patients FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "patients_update"  ON patients FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "patients_delete"  ON patients FOR DELETE TO authenticated USING (true);

-- ─── screenings ───────────────────────────────────────────────────────────────

CREATE POLICY "screenings_select"  ON screenings FOR SELECT TO authenticated USING (true);
CREATE POLICY "screenings_insert"  ON screenings FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "screenings_update"  ON screenings FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "screenings_delete"  ON screenings FOR DELETE TO authenticated USING (true);

-- ─── referrals ────────────────────────────────────────────────────────────────

CREATE POLICY "referrals_select"  ON referrals FOR SELECT TO authenticated USING (true);
CREATE POLICY "referrals_insert"  ON referrals FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "referrals_update"  ON referrals FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "referrals_delete"  ON referrals FOR DELETE TO authenticated USING (true);

-- ─── surgeries ────────────────────────────────────────────────────────────────

CREATE POLICY "surgeries_select"  ON surgeries FOR SELECT TO authenticated USING (true);
CREATE POLICY "surgeries_insert"  ON surgeries FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "surgeries_update"  ON surgeries FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "surgeries_delete"  ON surgeries FOR DELETE TO authenticated USING (true);

-- ─── follow_ups ───────────────────────────────────────────────────────────────

CREATE POLICY "follow_ups_select"  ON follow_ups FOR SELECT TO authenticated USING (true);
CREATE POLICY "follow_ups_insert"  ON follow_ups FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "follow_ups_update"  ON follow_ups FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "follow_ups_delete"  ON follow_ups FOR DELETE TO authenticated USING (true);

-- ─── inventory_items ──────────────────────────────────────────────────────────

CREATE POLICY "inventory_items_select"  ON inventory_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "inventory_items_insert"  ON inventory_items FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "inventory_items_update"  ON inventory_items FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "inventory_items_delete"  ON inventory_items FOR DELETE TO authenticated USING (true);

-- ─── outreach_activities ──────────────────────────────────────────────────────

CREATE POLICY "outreach_activities_select"  ON outreach_activities FOR SELECT TO authenticated USING (true);
CREATE POLICY "outreach_activities_insert"  ON outreach_activities FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "outreach_activities_update"  ON outreach_activities FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "outreach_activities_delete"  ON outreach_activities FOR DELETE TO authenticated USING (true);

-- ─── transport_jobs ───────────────────────────────────────────────────────────

CREATE POLICY "transport_jobs_select"  ON transport_jobs FOR SELECT TO authenticated USING (true);
CREATE POLICY "transport_jobs_insert"  ON transport_jobs FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "transport_jobs_update"  ON transport_jobs FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "transport_jobs_delete"  ON transport_jobs FOR DELETE TO authenticated USING (true);

-- ─── audit_logs ───────────────────────────────────────────────────────────────
-- Audit logs are append-only in production: UPDATE and DELETE are intentionally
-- left open here to match the task spec, but consider removing them in production
-- to make the audit trail tamper-resistant.

CREATE POLICY "audit_logs_select"  ON audit_logs FOR SELECT TO authenticated USING (true);
CREATE POLICY "audit_logs_insert"  ON audit_logs FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "audit_logs_update"  ON audit_logs FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "audit_logs_delete"  ON audit_logs FOR DELETE TO authenticated USING (true);
