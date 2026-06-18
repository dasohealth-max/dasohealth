# Pilot QA Checklist

Use this checklist before and during the 1-week internal pilot. Run it in a staging or pilot environment with non-production data.

## Environment

- `.env.local` or hosted environment variables are configured from `.env.example`.
- `CRON_SECRET` is set in the hosting environment.
- Supabase credentials used in pilot have been rotated after any local exposure.
- `supabase/rls.sql` has been applied in the pilot Supabase project.
- `supabase/rls_verification.sql` passes in the Supabase SQL editor.
- `npm run seed:demo` has been run only against the pilot/demo database, not production.
- Supabase Auth users exist for each pilot role and their `app_metadata.role` and `app_metadata.assignedRegion` match the seeded app users.

## Super Administrator Flow

- Sign in as Super Administrator.
- Confirm redirect lands on `/dashboard`.
- Open Campaigns.
- Create a campaign with at least one regional plan.
- Assign a Project Manager to the regional plan.
- Confirm the campaign appears in Campaigns and Reports.
- Open Settings.
- Create or update a Project Manager user.
- Confirm audit logs record user and campaign changes.

## Project Manager Flow

- Sign in as Project Manager.
- Confirm Reports are locked to the assigned region.
- Confirm other-region patient/campaign data is not visible.
- Open Settings.
- Create one Data Clerk and one Screening Officer for the assigned region.
- Confirm those users cannot be assigned to another region by the Project Manager.

## Data Clerk Flow

- Sign in as Data Clerk.
- Open Patients.
- Register a new patient into the assigned campaign region.
- Confirm generated patient code is unique.
- Confirm region and operation district are derived from the campaign region.
- Open Screening.
- Confirm the newly registered patient appears in the waiting queue.

## Screening Officer Flow

- Sign in as Screening Officer.
- Open Screening.
- Screen a waiting patient with `Discharge`.
- Confirm no surgery is created.
- Screen another waiting patient with `Refer for Surgery`.
- Confirm a scheduled surgery is created.
- Delete a test screening only if needed and confirm the patient returns to `Awaiting Screening` when no screenings remain.

## Surgery And Follow-up Flow

- Open Surgeries.
- Mark a scheduled surgery as `Completed` with a performed date.
- Open Follow-ups.
- Confirm exactly three milestones exist for that surgery:
  - Day 1
  - Week 1
  - Month 1
- Complete a Day 1 follow-up.
- Mark a follow-up as needing doctor review.
- Complete a doctor review.
- Run the cron endpoint manually and confirm past-due pending follow-ups become `Overdue`.

## Reports And Export Flow

- Open Reports as Super Administrator.
- Export reports for all regions.
- Filter to one region and export again.
- Sign in as Project Manager and confirm exports only include the assigned region.
- Confirm exported files do not contain unrelated-region patient rows.

## Pilot Exit Criteria

- All checklist items above pass.
- No unhandled errors are observed in browser console or server logs.
- Staff can complete the workflow without developer assistance.
- Daily follow-up overdue cron has run successfully at least once.
- Pilot lead confirms data exports match expected weekly reporting needs.

## Known Non-blockers For This Pilot

- Offline mode is not included.
- Authentication users still need to be prepared in Supabase Auth before training.
- RLS relies on correct Supabase Auth JWT metadata.
