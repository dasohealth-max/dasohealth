-- Clinical patient records are archive-only. Surgery queue cancellation is
-- recorded independently so cancelling a placement never archives a patient.

-- Fail before making changes if existing data cannot satisfy the pending
-- request uniqueness rule. Resolve duplicates explicitly rather than silently
-- discarding or approving clinical workflow records during deployment.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM change_requests
    WHERE request_type = 'archive' AND status = 'Pending'
    GROUP BY entity, entity_id
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Duplicate pending archive requests exist; resolve them before applying this migration';
  END IF;
END;
$$;

ALTER TABLE surgeries
  ADD COLUMN IF NOT EXISTS cancellation_reason TEXT,
  ADD COLUMN IF NOT EXISTS cancellation_notes TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancelled_by_id TEXT,
  ADD COLUMN IF NOT EXISTS cancelled_by_name TEXT;

-- Prevent application mistakes and cascading evidence loss. A deliberately
-- separate retention procedure would need to disable this trigger explicitly.
CREATE OR REPLACE FUNCTION prevent_patient_hard_delete()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'Patient records are archive-only and cannot be permanently deleted';
END;
$$;

DROP TRIGGER IF EXISTS patients_prevent_hard_delete ON patients;
CREATE TRIGGER patients_prevent_hard_delete
  BEFORE DELETE ON patients
  FOR EACH ROW
  EXECUTE FUNCTION prevent_patient_hard_delete();

-- Concurrency-safe guard against duplicate pending archive requests.
CREATE UNIQUE INDEX IF NOT EXISTS change_requests_one_pending_archive_per_entity
  ON change_requests (entity, entity_id)
  WHERE request_type = 'archive' AND status = 'Pending';

ALTER TABLE change_requests
  ADD COLUMN IF NOT EXISTS notes TEXT NOT NULL DEFAULT '';

CREATE UNIQUE INDEX IF NOT EXISTS change_requests_one_pending_cancellation_per_surgery
  ON change_requests (entity, entity_id)
  WHERE request_type = 'cancel_surgery' AND status = 'Pending';

-- Keep workflow values explicit; convert the former ambiguous terminal state.
UPDATE change_requests SET status = 'Approved' WHERE status = 'Resolved';

ALTER TABLE change_requests
  DROP CONSTRAINT IF EXISTS change_requests_entity_check,
  DROP CONSTRAINT IF EXISTS change_requests_request_type_check,
  DROP CONSTRAINT IF EXISTS change_requests_status_check;

ALTER TABLE change_requests
  ADD CONSTRAINT change_requests_entity_check
    CHECK (entity IN ('Patient', 'Surgery')),
  ADD CONSTRAINT change_requests_request_type_check
    CHECK (request_type IN ('archive', 'cancel_surgery', 'correct', 'other')),
  ADD CONSTRAINT change_requests_status_check
    CHECK (status IN ('Pending', 'Approved', 'Rejected'));
