-- Drop de-scoped tables (CASCADE removes dependent FK constraints automatically)
DROP TABLE IF EXISTS "transport_jobs"       CASCADE;
DROP TABLE IF EXISTS "outreach_activities"  CASCADE;
DROP TABLE IF EXISTS "inventory_items"      CASCADE;
DROP TABLE IF EXISTS "referrals"            CASCADE;
DROP TABLE IF EXISTS "campaign_locations"   CASCADE;
DROP TABLE IF EXISTS "locations"            CASCADE;

-- Drop dead columns from patients
ALTER TABLE "patients"
  DROP COLUMN IF EXISTS "location_id",
  DROP COLUMN IF EXISTS "lat",
  DROP COLUMN IF EXISTS "lng";

-- Drop dead column from screenings
ALTER TABLE "screenings"
  DROP COLUMN IF EXISTS "location_id";

-- Drop dead columns from surgeries
ALTER TABLE "surgeries"
  DROP COLUMN IF EXISTS "location_id",
  DROP COLUMN IF EXISTS "surgeon_id";

-- Drop dead column from follow_ups
ALTER TABLE "follow_ups"
  DROP COLUMN IF EXISTS "sms_reminder_sent";
