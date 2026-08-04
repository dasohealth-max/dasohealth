-- Enforce the workflow invariants already required by the application.
-- PostgreSQL will stop this migration with a unique-violation error if legacy
-- duplicates exist. Audit and resolve those records before retrying; this
-- migration deliberately never deletes or merges clinical evidence.

CREATE UNIQUE INDEX IF NOT EXISTS screenings_patient_id_key
  ON screenings (patient_id);

CREATE UNIQUE INDEX IF NOT EXISTS surgeries_patient_active_key
  ON surgeries (patient_id)
  WHERE status <> 'Cancelled'::surgery_status
    AND archived_at IS NULL;
