UPDATE "patients"
SET "sex" = 'Female'
WHERE "sex" = 'Other';

ALTER TYPE "sex" RENAME TO "sex_old";

CREATE TYPE "sex" AS ENUM ('Male', 'Female');

ALTER TABLE "patients"
ALTER COLUMN "sex" TYPE "sex"
USING "sex"::text::"sex";

DROP TYPE "sex_old";
