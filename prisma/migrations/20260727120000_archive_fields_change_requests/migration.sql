-- Phase 4: Surgery-level deletion lock + archive fields
-- Phase 5: Change-request workflow
--
-- Archive fields let Super Administrators soft-delete surgery-level records
-- with a mandatory reason instead of hard-deleting them.
-- onDelete Restrict on surgery→patient blocks cascading evidence erasure.
-- ChangeRequest gives Project Managers a formal channel to request corrections.

-- ── Patient archive fields ────────────────────────────────────────────────────
ALTER TABLE patients
  ADD COLUMN IF NOT EXISTS archived_at        TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS archived_by_id     TEXT,
  ADD COLUMN IF NOT EXISTS archived_by_name   TEXT,
  ADD COLUMN IF NOT EXISTS archived_reason    TEXT;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_patients_archived_at
  ON patients (archived_at);

-- ── Surgery archive fields ────────────────────────────────────────────────────
ALTER TABLE surgeries
  ADD COLUMN IF NOT EXISTS archived_at        TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS archived_by_id     TEXT,
  ADD COLUMN IF NOT EXISTS archived_by_name   TEXT,
  ADD COLUMN IF NOT EXISTS archived_reason    TEXT;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_surgeries_archived_at
  ON surgeries (archived_at);

-- ── Change the patient→surgery FK from CASCADE to RESTRICT ───────────────────
-- This prevents anyone from deleting a patient record that has surgery evidence
-- even via direct DB access, bypassing the application layer.
ALTER TABLE surgeries
  DROP CONSTRAINT IF EXISTS surgeries_patient_id_fkey;

ALTER TABLE surgeries
  ADD CONSTRAINT surgeries_patient_id_fkey
    FOREIGN KEY (patient_id)
    REFERENCES patients(id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE;

-- ── Change-request table ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS change_requests (
  id                UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  entity            TEXT        NOT NULL,
  entity_id         TEXT        NOT NULL,
  entity_label      TEXT        NOT NULL DEFAULT '',
  request_type      TEXT        NOT NULL,
  reason            TEXT        NOT NULL,
  requested_by_id   TEXT        NOT NULL DEFAULT '',
  requested_by_name TEXT        NOT NULL DEFAULT '',
  requested_by_role TEXT        NOT NULL DEFAULT '',
  status            TEXT        NOT NULL DEFAULT 'Pending',
  region            TEXT,
  campaign_id       UUID,
  resolved_by_id    TEXT,
  resolved_by_name  TEXT,
  resolution_note   TEXT        NOT NULL DEFAULT '',
  resolved_at       TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_change_requests_entity
  ON change_requests (entity, entity_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_change_requests_status
  ON change_requests (status);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_change_requests_region
  ON change_requests (region);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_change_requests_requested_by_id
  ON change_requests (requested_by_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_change_requests_created_at
  ON change_requests (created_at DESC);
