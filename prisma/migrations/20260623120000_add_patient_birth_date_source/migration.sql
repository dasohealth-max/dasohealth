CREATE TYPE "birth_date_source" AS ENUM ('Exact', 'AgeEstimate');

ALTER TABLE "patients"
  ADD COLUMN "birth_date_source" "birth_date_source" NOT NULL DEFAULT 'Exact',
  ADD COLUMN "age_years_at_registration" SMALLINT;

ALTER TABLE "patients"
  ADD CONSTRAINT "patients_age_years_at_registration_check"
  CHECK (
    "age_years_at_registration" IS NULL
    OR ("age_years_at_registration" >= 0 AND "age_years_at_registration" <= 120)
  );

ALTER TABLE "patients"
  ADD CONSTRAINT "patients_birth_date_source_age_check"
  CHECK (
    ("birth_date_source" = 'Exact' AND "age_years_at_registration" IS NULL)
    OR ("birth_date_source" = 'AgeEstimate' AND "age_years_at_registration" IS NOT NULL)
  );
