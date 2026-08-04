-- Preserve clinical and accountability records. Application actions mark
-- records void/archive/inactive; they do not erase evidence.

ALTER TABLE screenings
  ADD COLUMN IF NOT EXISTS voided_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS voided_by_id TEXT,
  ADD COLUMN IF NOT EXISTS voided_by_name TEXT,
  ADD COLUMN IF NOT EXISTS voided_reason TEXT;

ALTER TABLE follow_ups
  ADD COLUMN IF NOT EXISTS voided_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS voided_by_id TEXT,
  ADD COLUMN IF NOT EXISTS voided_by_name TEXT,
  ADD COLUMN IF NOT EXISTS voided_reason TEXT;

ALTER TABLE follow_up_medications
  ADD COLUMN IF NOT EXISTS entered_in_error_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS entered_in_error_by_id TEXT,
  ADD COLUMN IF NOT EXISTS entered_in_error_by_name TEXT,
  ADD COLUMN IF NOT EXISTS entered_in_error_reason TEXT;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS deactivated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deactivated_by_id TEXT,
  ADD COLUMN IF NOT EXISTS deactivated_by_name TEXT,
  ADD COLUMN IF NOT EXISTS deactivation_reason TEXT;

ALTER TABLE change_requests
  ADD COLUMN IF NOT EXISTS requester_viewed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_screenings_voided_at ON screenings (voided_at);
CREATE INDEX IF NOT EXISTS idx_follow_ups_voided_at ON follow_ups (voided_at);
CREATE INDEX IF NOT EXISTS idx_follow_up_medications_entered_in_error_at
  ON follow_up_medications (entered_in_error_at);
CREATE INDEX IF NOT EXISTS idx_users_active ON users (active);
CREATE INDEX IF NOT EXISTS idx_change_requests_requester_unread
  ON change_requests (requested_by_id, requester_viewed_at);

CREATE OR REPLACE FUNCTION prevent_protected_record_hard_delete()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION '% records cannot be permanently deleted; use the audited lifecycle action', TG_TABLE_NAME;
END;
$$;

DROP TRIGGER IF EXISTS screenings_prevent_hard_delete ON screenings;
CREATE TRIGGER screenings_prevent_hard_delete
  BEFORE DELETE ON screenings FOR EACH ROW
  EXECUTE FUNCTION prevent_protected_record_hard_delete();

DROP TRIGGER IF EXISTS surgeries_prevent_hard_delete ON surgeries;
CREATE TRIGGER surgeries_prevent_hard_delete
  BEFORE DELETE ON surgeries FOR EACH ROW
  EXECUTE FUNCTION prevent_protected_record_hard_delete();

DROP TRIGGER IF EXISTS follow_ups_prevent_hard_delete ON follow_ups;
CREATE TRIGGER follow_ups_prevent_hard_delete
  BEFORE DELETE ON follow_ups FOR EACH ROW
  EXECUTE FUNCTION prevent_protected_record_hard_delete();

DROP TRIGGER IF EXISTS follow_up_medications_prevent_hard_delete ON follow_up_medications;
CREATE TRIGGER follow_up_medications_prevent_hard_delete
  BEFORE DELETE ON follow_up_medications FOR EACH ROW
  EXECUTE FUNCTION prevent_protected_record_hard_delete();

DROP TRIGGER IF EXISTS users_prevent_hard_delete ON users;
CREATE TRIGGER users_prevent_hard_delete
  BEFORE DELETE ON users FOR EACH ROW
  EXECUTE FUNCTION prevent_protected_record_hard_delete();
