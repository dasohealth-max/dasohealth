CREATE INDEX IF NOT EXISTS "idx_campaigns_region_status"
  ON "campaigns"("region", "status");

CREATE INDEX IF NOT EXISTS "idx_surgeries_region_status"
  ON "surgeries"("region", "status");

CREATE INDEX IF NOT EXISTS "idx_follow_ups_surgery_milestone"
  ON "follow_ups"("surgery_id", "milestone");

CREATE INDEX IF NOT EXISTS "idx_follow_ups_status_due_date"
  ON "follow_ups"("status", "due_date");
