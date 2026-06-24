-- Targeted production indexes for dashboard/report/list performance.
-- Use CONCURRENTLY so deploy-time index creation does not block writes.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_active_created_at_desc
ON users (active, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_patients_region_created_at_desc
ON patients (region, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_patients_region_screening_status_created_at_desc
ON patients (region, screening_status, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_patients_full_name_trgm
ON patients USING gin (lower(full_name) gin_trgm_ops);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_patients_patient_code_trgm
ON patients USING gin (lower(patient_code) gin_trgm_ops);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_patients_phone_trgm
ON patients USING gin (phone gin_trgm_ops);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_screenings_region_screened_at_desc
ON screenings (region, screened_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_screenings_patient_name_trgm
ON screenings USING gin (lower(patient_name) gin_trgm_ops);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_surgeries_region_status_scheduled_at_desc
ON surgeries (region, status, scheduled_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_surgeries_patient_name_trgm
ON surgeries USING gin (lower(patient_name) gin_trgm_ops);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_surgeries_surgeon_name_trgm
ON surgeries USING gin (lower(surgeon_name) gin_trgm_ops);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_follow_ups_region_status_milestone_due_surgery
ON follow_ups (region, status, milestone, due_date, surgery_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_follow_ups_region_review_milestone_due_surgery
ON follow_ups (region, doctor_review_status, milestone, due_date, surgery_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_follow_ups_region_needs_review_due_surgery
ON follow_ups (region, needs_doctor_review, doctor_review_status, milestone, due_date, surgery_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_follow_ups_patient_name_trgm
ON follow_ups USING gin (lower(patient_name) gin_trgm_ops);
