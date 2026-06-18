# Pilot Runbook

This runbook is for a 1-week internal pilot with NGO staff using non-production data.

## Setup

1. Create a dedicated Supabase project for the pilot.
2. Configure environment variables from `.env.example`.
3. Apply database migrations.
4. Apply `supabase/rls.sql`.
5. Run `supabase/rls_verification.sql` in the Supabase SQL editor and confirm all checks pass.
6. Configure Vercel or the hosting provider with:
   - `DATABASE_URL`
   - `DIRECT_URL`
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `CRON_SECRET`
7. Deploy the app.
8. Run demo seed data only against the pilot database:

   ```bash
   npm run seed:demo
   ```

9. Create matching Supabase Auth users for the pilot staff accounts.
10. Set each Auth user's app metadata:

   ```json
   {
     "role": "Project Manager",
     "assignedRegion": "Galmudug"
   }
   ```

Use `assignedRegion: null` or omit it for Super Administrator.

## User Roles

- Super Administrator: creates campaigns, assigns Project Managers, manages users, views all reports.
- Project Manager: manages regional users and views assigned-region operations.
- Data Clerk: registers patients for assigned-region campaigns.
- Screening Officer: records screenings, updates surgeries, and manages follow-ups for assigned region.

## Daily Operating Process

1. Project Manager confirms the active campaign and assigned regional staff.
2. Data Clerk registers patients throughout the day.
3. Screening Officer reviews the waiting queue and records screening outcomes.
4. Surgery team updates surgery completion status with actual performed date.
5. Screening Officer completes due follow-ups and flags doctor review when needed.
6. Pilot lead reviews Reports at the end of the day.
7. Confirm the overdue cron job ran or manually call:

   ```bash
   curl -H "Authorization: Bearer $CRON_SECRET" https://your-domain.example/api/cron/followups-overdue
   ```

## Common Issue Recovery

### User Cannot Sign In

- Confirm the user exists in Supabase Auth.
- Confirm email and password are correct.
- Confirm app metadata includes the expected role and assigned region.
- If metadata changed, ask the user to sign out and sign back in.

### User Sees No Regional Data

- Confirm `app_metadata.assignedRegion` exactly matches the app region name.
- Confirm campaign regional plan exists for that region.
- Confirm RLS verification passed.

### Patient Does Not Appear In Screening Queue

- Confirm the patient was registered with `screeningStatus = Awaiting Screening`.
- Confirm the Data Clerk selected the correct campaign region.
- If a screening was deleted, confirm no other screening remains for that patient.

### Surgery Did Not Create Follow-ups

- Confirm surgery status is `Completed`.
- Confirm `performedAt` is set.
- Confirm no database error occurred for the unique `(surgery_id, milestone)` guard.
- Re-save the completed surgery; the app will fill missing milestones idempotently.

### Follow-ups Are Not Marked Overdue

- Confirm `CRON_SECRET` is configured.
- Call the cron route manually.
- Confirm due dates are before today's date and status is `Pending` or `Due`.

### Reports Export Looks Wrong

- Confirm the user's assigned region.
- Compare report filters with the visible tables.
- Export as Super Administrator and as Project Manager to confirm region scoping.

## Data To Collect During Pilot

- Number of users trained by role.
- Number of patients registered per day.
- Number of screenings completed per day.
- Number of surgery referrals created.
- Number of surgeries completed.
- Number of follow-ups generated and completed.
- Number of overdue follow-ups at end of each day.
- Number of doctor review flags.
- Export files used for reporting.
- Any permission, login, or data visibility issues.
- Staff feedback on confusing labels or workflow steps.

## Escalation Criteria

Pause the pilot and escalate if:

- Users can see another region's clinical data.
- Browser clients can directly write clinical records outside Server Actions.
- Follow-up generation creates duplicates.
- Reports export incorrect patient-region data.
- Staff cannot complete registration, screening, surgery completion, or follow-up workflows.
