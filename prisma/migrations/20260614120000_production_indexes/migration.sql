CREATE INDEX IF NOT EXISTS "idx_campaigns_created_at"
  ON "campaigns"("created_at" DESC);

CREATE INDEX IF NOT EXISTS "idx_patients_region_screening_status"
  ON "patients"("region", "screening_status");

CREATE INDEX IF NOT EXISTS "idx_patients_created_at"
  ON "patients"("created_at" DESC);

CREATE INDEX IF NOT EXISTS "idx_patients_duplicate_guard"
  ON "patients"("full_name", "phone", "campaign_id");

CREATE INDEX IF NOT EXISTS "idx_screenings_region_campaign_id"
  ON "screenings"("region", "campaign_id");

CREATE INDEX IF NOT EXISTS "idx_screenings_created_at"
  ON "screenings"("created_at" DESC);

CREATE INDEX IF NOT EXISTS "idx_surgeries_region_campaign_id"
  ON "surgeries"("region", "campaign_id");

CREATE INDEX IF NOT EXISTS "idx_surgeries_created_at"
  ON "surgeries"("created_at" DESC);

CREATE INDEX IF NOT EXISTS "idx_follow_ups_region_status"
  ON "follow_ups"("region", "status");

CREATE INDEX IF NOT EXISTS "idx_follow_ups_region_due_date"
  ON "follow_ups"("region", "due_date");

CREATE INDEX IF NOT EXISTS "idx_follow_ups_created_at"
  ON "follow_ups"("created_at" DESC);

CREATE INDEX IF NOT EXISTS "idx_audit_logs_actor_id"
  ON "audit_logs"("actor_id");

CREATE INDEX IF NOT EXISTS "idx_audit_logs_action"
  ON "audit_logs"("action");

CREATE INDEX IF NOT EXISTS "idx_audit_logs_region_created_at"
  ON "audit_logs"("region", "created_at" DESC);
