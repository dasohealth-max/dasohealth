ALTER TABLE "campaign_regions"
ADD COLUMN "doctor_name" TEXT NOT NULL DEFAULT '',
ADD COLUMN "doctor_name_key" TEXT;

CREATE UNIQUE INDEX "campaign_regions_doctor_name_key_key"
ON "campaign_regions"("doctor_name_key");
