-- Rename the legacy Hiiraan State label to the current Hiiran Region label.
-- This is a data-only migration. It updates region text values without deleting rows.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "campaign_regions" old_region
    JOIN "campaign_regions" new_region
      ON new_region."campaign_id" = old_region."campaign_id"
     AND new_region."type" = old_region."type"
     AND new_region."region" = 'Hiiran Region'
    WHERE old_region."region" = 'Hiiraan State'
  ) THEN
    RAISE EXCEPTION 'Cannot rename Hiiraan State to Hiiran Region because duplicate campaign region rows already exist for the same campaign and type.';
  END IF;
END $$;

UPDATE "users"
SET "assigned_region" = 'Hiiran Region'
WHERE "assigned_region" = 'Hiiraan State';

UPDATE "campaigns"
SET "region" = 'Hiiran Region'
WHERE "region" = 'Hiiraan State';

UPDATE "campaign_regions"
SET "region" = 'Hiiran Region'
WHERE "region" = 'Hiiraan State';

UPDATE "patients"
SET "region" = 'Hiiran Region'
WHERE "region" = 'Hiiraan State';

UPDATE "screenings"
SET "region" = 'Hiiran Region'
WHERE "region" = 'Hiiraan State';

UPDATE "surgeries"
SET "region" = 'Hiiran Region'
WHERE "region" = 'Hiiraan State';

UPDATE "follow_ups"
SET "region" = 'Hiiran Region'
WHERE "region" = 'Hiiraan State';

UPDATE "audit_logs"
SET "region" = 'Hiiran Region'
WHERE "region" = 'Hiiraan State';
