-- Prevent duplicate scheduled follow-up milestones for the same surgery.
-- If this fails in an existing database, remove duplicate follow_ups rows first.
CREATE UNIQUE INDEX IF NOT EXISTS "follow_ups_surgery_id_milestone_key"
  ON "follow_ups"("surgery_id", "milestone");
