# Staging Deployment Checklist

Use this checklist for a Vercel + Supabase staging deployment before an internal pilot or production release. Do not deploy staging with production patient data.

## Readiness Review

- [ ] Use a dedicated staging Supabase project, not the production project.
- [ ] Confirm the Vercel staging project points to this repository and branch.
- [ ] Confirm `.env.local` and other real secret files are not committed.
- [ ] Confirm all required Vercel environment variables are configured from `docs/PRODUCTION_ENV_VARS.md`.
- [ ] Confirm exposed Supabase credentials from earlier local cleanup have been rotated before staging is shared.
- [ ] Confirm Supabase Auth users have `app_metadata.role`.
- [ ] Confirm regional users have `app_metadata.assignedRegion`.
- [ ] Confirm `vercel.json` includes the daily `/api/cron/followups-overdue` schedule.

## Supabase Setup

1. Create or select the staging Supabase project.
2. Set the database password and save it only in a password manager or deployment secret store.
3. Copy the project URL, anon key, and service-role key from the Supabase dashboard.
4. Create staging Auth users for each pilot role:
   - Super Administrator
   - Project Manager
   - Data Clerk
   - Screening Officer
   - Surgeon
   - Follow-up Coordinator
5. Set Auth user metadata:
   - `app_metadata.role`
   - `app_metadata.assignedRegion` for region-scoped users
6. Keep the service-role key server-only. Never paste it into browser code, client-side tools, screenshots, or shared logs.

## Prisma Migration Deploy

Run migrations against staging before deploying traffic to the app.

1. Set local or CI `DIRECT_URL` to the Supabase direct database connection for staging.
2. Set local or CI `DATABASE_URL` to the staging Supabase pooler connection string.
3. Run:

   ```bash
   npx prisma migrate deploy
   ```

4. Confirm the migration history includes all repository migrations.
5. Confirm the follow-up uniqueness migration has been applied:

   ```text
   20260618120000_add_follow_up_milestone_unique
   ```

If migration deploy fails because duplicate follow-ups already exist for the same `(surgeryId, milestone)`, stop and clean the duplicate staging rows before retrying.

## RLS SQL Apply

1. Open the staging Supabase dashboard.
2. Go to SQL Editor.
3. Paste the full contents of `supabase/rls.sql`.
4. Run the SQL.
5. Confirm the script completes without errors.
6. Do not weaken policies to make app flows work. Fix missing claims, server-side writes, or incorrect environment variables instead.

## RLS Verification

1. Open `docs/RLS_VERIFICATION.md`.
2. Follow the SQL Editor steps exactly.
3. Paste and run `supabase/rls_verification.sql`.
4. Confirm all rows in the final `rls_results` output have `passed = true`.
5. Confirm direct browser/anon writes to clinical tables fail.
6. Confirm trusted server-side app writes still work through the application.

## Vercel Environment Variables

Configure these in Vercel for the staging environment:

- `DATABASE_URL`
- `DIRECT_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `CRON_SECRET`

Optional:

- `DATABASE_SSL_REJECT_UNAUTHORIZED`
- E2E account variables listed in `.env.example`

After updating variables, trigger a fresh Vercel deployment. Do not upload `.env.local`.

## Build Verification

Run locally before deployment:

```bash
npm run lint
npm run test
npm run build
```

Confirm the Vercel deployment build also succeeds. If the build fails, do not promote the deployment.

## Cron Verification

Vercel Cron is configured in `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/cron/followups-overdue",
      "schedule": "0 0 * * *"
    }
  ]
}
```

After deployment:

1. Confirm `CRON_SECRET` is configured in Vercel.
2. Manually call the route:

   ```bash
   curl -H "Authorization: Bearer $CRON_SECRET" https://staging.example.org/api/cron/followups-overdue
   ```

3. Expected result:

   ```json
   { "ok": true, "updated": 0 }
   ```

The `updated` value may be greater than `0` if overdue follow-ups exist.

## Smoke Test Checklist

- [ ] Unauthenticated users visiting `/dashboard` redirect to `/login` before protected HTML is served.
- [ ] Logged-in users visiting `/login` redirect to their role default page.
- [ ] Super Administrator can create a campaign and assign a Project Manager.
- [ ] Project Manager can create regional users.
- [ ] Data Clerk can register a patient in their assigned region.
- [ ] Screening Officer can create a screening.
- [ ] A `Discharge` screening result saves without validation errors.
- [ ] A surgery can be completed for a referred patient.
- [ ] Completed surgery creates exactly Day 1 and Week 1 follow-ups.
- [ ] Re-running completion or follow-up generation does not create duplicate milestones.
- [ ] Follow-up Coordinator can complete a follow-up.
- [ ] Reports page loads and exports expected report files.
- [ ] Region-scoped users cannot read another region's clinical data.
- [ ] Browser/anon Supabase client cannot directly insert, update, or delete clinical records.
- [ ] Cron route returns `401` without a valid secret.
- [ ] Cron route returns `ok: true` with a valid secret.

## Rollback Steps

If deployment fails before traffic is served:

1. Keep the failed Vercel deployment unpromoted.
2. Fix the failing environment variable, build, migration, or RLS issue.
3. Redeploy from the same commit or a fix commit.

If deployment fails after traffic is served:

1. In Vercel, promote the last known good deployment.
2. Disable or rotate any incorrect environment variable that caused the issue.
3. If the issue is RLS-related, reapply the last known good SQL policy script in Supabase.
4. If the issue is migration-related, do not manually edit production-like schemas without a reviewed rollback plan. Restore from the latest staging backup when appropriate.
5. Re-run the smoke test checklist after rollback.

If service-role credentials were exposed during the failed deployment, rotate the service-role key before redeploying.

## Deployment Blockers

Block staging promotion if any of these are true:

- Required environment variables are missing.
- Prisma migrations fail.
- RLS verification fails.
- Direct browser writes to clinical records are allowed.
- Server-side patient registration fails.
- Protected routes serve page HTML to unauthenticated users.
- Build, lint, or tests fail.
- The cron route is reachable without `CRON_SECRET`.
