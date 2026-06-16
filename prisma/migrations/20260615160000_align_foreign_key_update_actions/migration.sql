ALTER TABLE patients DROP CONSTRAINT IF EXISTS patients_campaign_id_fkey;
ALTER TABLE patients
  ADD CONSTRAINT patients_campaign_id_fkey
  FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON UPDATE CASCADE ON DELETE SET NULL;

ALTER TABLE screenings DROP CONSTRAINT IF EXISTS screenings_campaign_id_fkey;
ALTER TABLE screenings
  ADD CONSTRAINT screenings_campaign_id_fkey
  FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE screenings DROP CONSTRAINT IF EXISTS screenings_patient_id_fkey;
ALTER TABLE screenings
  ADD CONSTRAINT screenings_patient_id_fkey
  FOREIGN KEY (patient_id) REFERENCES patients(id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE surgeries DROP CONSTRAINT IF EXISTS surgeries_campaign_id_fkey;
ALTER TABLE surgeries
  ADD CONSTRAINT surgeries_campaign_id_fkey
  FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE surgeries DROP CONSTRAINT IF EXISTS surgeries_patient_id_fkey;
ALTER TABLE surgeries
  ADD CONSTRAINT surgeries_patient_id_fkey
  FOREIGN KEY (patient_id) REFERENCES patients(id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE follow_ups DROP CONSTRAINT IF EXISTS follow_ups_campaign_id_fkey;
ALTER TABLE follow_ups
  ADD CONSTRAINT follow_ups_campaign_id_fkey
  FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE follow_ups DROP CONSTRAINT IF EXISTS follow_ups_patient_id_fkey;
ALTER TABLE follow_ups
  ADD CONSTRAINT follow_ups_patient_id_fkey
  FOREIGN KEY (patient_id) REFERENCES patients(id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE follow_ups DROP CONSTRAINT IF EXISTS follow_ups_surgery_id_fkey;
ALTER TABLE follow_ups
  ADD CONSTRAINT follow_ups_surgery_id_fkey
  FOREIGN KEY (surgery_id) REFERENCES surgeries(id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE follow_up_medications DROP CONSTRAINT IF EXISTS follow_up_medications_follow_up_id_fkey;
ALTER TABLE follow_up_medications
  ADD CONSTRAINT follow_up_medications_follow_up_id_fkey
  FOREIGN KEY (follow_up_id) REFERENCES follow_ups(id) ON UPDATE CASCADE ON DELETE CASCADE;
