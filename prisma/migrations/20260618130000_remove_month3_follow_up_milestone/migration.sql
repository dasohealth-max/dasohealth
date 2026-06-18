-- Remove the Month 3 follow-up milestone end to end.
-- Existing Month 3 follow-up rows are deleted before the enum is recreated.
-- Follow-up medications attached to those rows are removed by the existing
-- follow_up_medications.follow_up_id ON DELETE CASCADE constraint.

DELETE FROM "follow_ups"
WHERE "milestone" = 'Month 3';

ALTER TYPE "follow_up_milestone" RENAME TO "follow_up_milestone_old";

CREATE TYPE "follow_up_milestone" AS ENUM ('Day 1', 'Week 1', 'Month 1');

ALTER TABLE "follow_ups"
  ALTER COLUMN "milestone" TYPE "follow_up_milestone"
  USING "milestone"::text::"follow_up_milestone";

DROP TYPE "follow_up_milestone_old";
