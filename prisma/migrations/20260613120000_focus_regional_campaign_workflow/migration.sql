ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "assigned_region" TEXT;

ALTER TABLE "campaigns"
  ADD COLUMN IF NOT EXISTS "region" TEXT NOT NULL DEFAULT 'Banadir / Mogadishu',
  ADD COLUMN IF NOT EXISTS "operation_district" TEXT NOT NULL DEFAULT 'Mogadishu',
  ADD COLUMN IF NOT EXISTS "project_manager_id" TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "project_manager_name" TEXT NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS "idx_campaigns_region" ON "campaigns"("region");
CREATE INDEX IF NOT EXISTS "idx_campaigns_project_manager_id" ON "campaigns"("project_manager_id");

ALTER TABLE "patients"
  ADD COLUMN IF NOT EXISTS "operation_district" TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "registered_by_id" TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "registered_by_name" TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "screening_status" TEXT NOT NULL DEFAULT 'Awaiting Screening';

UPDATE "patients"
SET "operation_district" = COALESCE(NULLIF("operation_district", ''), "district")
WHERE "operation_district" = '';

CREATE INDEX IF NOT EXISTS "idx_patients_region" ON "patients"("region");
CREATE INDEX IF NOT EXISTS "idx_patients_screening_status" ON "patients"("screening_status");

ALTER TABLE "screenings"
  ALTER COLUMN "location_id" DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS "region" TEXT NOT NULL DEFAULT 'Banadir / Mogadishu',
  ADD COLUMN IF NOT EXISTS "operation_district" TEXT NOT NULL DEFAULT 'Mogadishu',
  ADD COLUMN IF NOT EXISTS "screened_by_id" TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "screened_by_name" TEXT NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS "idx_screenings_region" ON "screenings"("region");

ALTER TABLE "surgeries"
  ALTER COLUMN "location_id" DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS "region" TEXT NOT NULL DEFAULT 'Banadir / Mogadishu',
  ADD COLUMN IF NOT EXISTS "operation_district" TEXT NOT NULL DEFAULT 'Mogadishu',
  ADD COLUMN IF NOT EXISTS "created_from_screening_id" UUID,
  ADD COLUMN IF NOT EXISTS "completed_by_id" TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "completed_by_name" TEXT NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS "idx_surgeries_region" ON "surgeries"("region");

ALTER TABLE "follow_ups"
  ADD COLUMN IF NOT EXISTS "region" TEXT NOT NULL DEFAULT 'Banadir / Mogadishu',
  ADD COLUMN IF NOT EXISTS "needs_doctor_review" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "completed_by_id" TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "completed_by_name" TEXT NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS "idx_follow_ups_region" ON "follow_ups"("region");

ALTER TABLE "audit_logs"
  ADD COLUMN IF NOT EXISTS "actor_id" TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "actor_name" TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "actor_role" TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "region" TEXT,
  ADD COLUMN IF NOT EXISTS "campaign_id" UUID,
  ADD COLUMN IF NOT EXISTS "before" JSONB,
  ADD COLUMN IF NOT EXISTS "after" JSONB;

CREATE INDEX IF NOT EXISTS "idx_audit_logs_region" ON "audit_logs"("region");
CREATE INDEX IF NOT EXISTS "idx_audit_logs_campaign_id" ON "audit_logs"("campaign_id");
