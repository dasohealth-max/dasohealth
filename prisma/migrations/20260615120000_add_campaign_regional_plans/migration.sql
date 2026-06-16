ALTER TYPE campaign_type ADD VALUE IF NOT EXISTS 'Cataract Surgery Outreach';
ALTER TYPE campaign_type ADD VALUE IF NOT EXISTS 'Eye Vision Outreach';
ALTER TYPE campaign_type ADD VALUE IF NOT EXISTS 'General Eye Screening';
ALTER TYPE campaign_type ADD VALUE IF NOT EXISTS 'Mixed Outreach';

DO $$
BEGIN
  CREATE TYPE regional_plan_status AS ENUM ('On Track', 'Behind', 'Completed', 'Suspended');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE campaigns
  ADD COLUMN IF NOT EXISTS notes TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE TABLE IF NOT EXISTS campaign_regions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  region TEXT NOT NULL,
  operation_district TEXT NOT NULL,
  regional_manager_id TEXT NOT NULL DEFAULT '',
  regional_manager_name TEXT NOT NULL DEFAULT '',
  target_patients INTEGER NOT NULL DEFAULT 0,
  target_screenings INTEGER NOT NULL DEFAULT 0,
  target_surgeries INTEGER NOT NULL DEFAULT 0,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status regional_plan_status NOT NULL DEFAULT 'On Track',
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT campaign_regions_campaign_id_region_key UNIQUE (campaign_id, region)
);

CREATE INDEX IF NOT EXISTS idx_campaign_regions_campaign_id ON campaign_regions(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_regions_region ON campaign_regions(region);
CREATE INDEX IF NOT EXISTS idx_campaign_regions_status ON campaign_regions(status);

ALTER TABLE patients ADD COLUMN IF NOT EXISTS campaign_region_id UUID;
ALTER TABLE screenings ADD COLUMN IF NOT EXISTS campaign_region_id UUID;
ALTER TABLE surgeries ADD COLUMN IF NOT EXISTS campaign_region_id UUID;
ALTER TABLE follow_ups ADD COLUMN IF NOT EXISTS campaign_region_id UUID;

DO $$
BEGIN
  ALTER TABLE patients ADD CONSTRAINT patients_campaign_region_id_fkey
    FOREIGN KEY (campaign_region_id) REFERENCES campaign_regions(id);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE screenings ADD CONSTRAINT screenings_campaign_region_id_fkey
    FOREIGN KEY (campaign_region_id) REFERENCES campaign_regions(id);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE surgeries ADD CONSTRAINT surgeries_campaign_region_id_fkey
    FOREIGN KEY (campaign_region_id) REFERENCES campaign_regions(id);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE follow_ups ADD CONSTRAINT follow_ups_campaign_region_id_fkey
    FOREIGN KEY (campaign_region_id) REFERENCES campaign_regions(id);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_patients_campaign_region_id ON patients(campaign_region_id);
CREATE INDEX IF NOT EXISTS idx_screenings_campaign_region_id ON screenings(campaign_region_id);
CREATE INDEX IF NOT EXISTS idx_surgeries_campaign_region_id ON surgeries(campaign_region_id);
CREATE INDEX IF NOT EXISTS idx_follow_ups_campaign_region_id ON follow_ups(campaign_region_id);
