ALTER TABLE campaign_regions
  ADD COLUMN IF NOT EXISTS type campaign_type NOT NULL DEFAULT 'Mixed Outreach';

UPDATE campaign_regions cr
SET type = c.type
FROM campaigns c
WHERE cr.campaign_id = c.id
  AND cr.type = 'Mixed Outreach';

ALTER TABLE campaign_regions DROP CONSTRAINT IF EXISTS campaign_regions_campaign_id_region_key;
DROP INDEX IF EXISTS campaign_regions_campaign_id_region_key;

DO $$
BEGIN
  ALTER TABLE campaign_regions
    ADD CONSTRAINT campaign_regions_campaign_id_region_type_key UNIQUE (campaign_id, region, type);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_campaign_regions_type ON campaign_regions(type);
