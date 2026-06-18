# Production Environment Variables

Use this reference for Vercel and Supabase environments. The same variables are required for staging and production, but values must be different for each environment.

Never commit real values. Store secrets only in Vercel environment variables, Supabase, CI secret stores, or a password manager.

## Required Variables

| Variable | Required | Scope | Example value | Notes |
| --- | --- | --- | --- | --- |
| `DATABASE_URL` | Yes | Server only | `postgresql://postgres.project-ref:REPLACE_WITH_PASSWORD@aws-0-region.pooler.supabase.com:6543/postgres?pgbouncer=true` | Prisma runtime database URL. Use the Supabase pooler URL for app traffic. Contains the database password. |
| `DIRECT_URL` | Yes | Server/CI only | `postgresql://postgres.project-ref:REPLACE_WITH_PASSWORD@aws-0-region.pooler.supabase.com:5432/postgres` | Prisma migration URL used by `prisma.config.ts`. Contains the database password. |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Browser and server | `https://your-project-ref.supabase.co` | Public Supabase project URL. Safe to expose, but must match the target environment. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Browser and server | `your-supabase-anon-key` | Public anon key. Safety depends on correct RLS policies. Rotate if unexpectedly exposed. |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Server only | `your-supabase-service-role-key` | Highly privileged key that bypasses RLS. Never expose to client code, logs, screenshots, or browser tools. |
| `CRON_SECRET` | Yes | Server only | `long-random-generated-secret` | Shared secret for `/api/cron/followups-overdue`. Use at least 32 random bytes encoded as a string. |

## Optional Variables

| Variable | Scope | Recommended value | Notes |
| --- | --- | --- | --- |
| `DATABASE_SSL_REJECT_UNAUTHORIZED` | Server only | unset or `false` unless certificate validation is configured | The Prisma adapter sets SSL mode for Supabase. Set `true` only when the environment has the correct CA trust chain. |
| `E2E_SUPER_EMAIL` | CI only | staging test email | Optional Playwright Super Administrator account. |
| `E2E_PM_EMAIL` | CI only | staging test email | Optional Playwright Project Manager account. |
| `E2E_CLERK_EMAIL` | CI only | staging test email | Optional Playwright Data Clerk account. |
| `E2E_SCREENER_EMAIL` | CI only | staging test email | Optional Playwright Screening Officer account. |
| `E2E_PASSWORD` | CI only | staging test password | Keep out of commits and rotate if shared. |

## Vercel Configuration

Set required variables in Vercel:

1. Open the Vercel project.
2. Go to Settings, then Environment Variables.
3. Add each required variable for the target environment.
4. Use staging Supabase values for Preview/Staging.
5. Use production Supabase values only for Production.
6. Redeploy after changing any variable.

Do not paste `.env.local` into Vercel as a file. Add variables individually so they can be rotated and audited.

## Supabase URL Selection

Use the Supabase pooler URL for `DATABASE_URL` because application traffic can open multiple connections:

```text
postgresql://postgres.project-ref:PASSWORD@aws-0-region.pooler.supabase.com:6543/postgres?pgbouncer=true
```

Use the direct or migration-compatible URL for `DIRECT_URL`:

```text
postgresql://postgres.project-ref:PASSWORD@aws-0-region.pooler.supabase.com:5432/postgres
```

`prisma.config.ts` appends `sslmode=require` to `DIRECT_URL` for Prisma migration commands.

## Secret Rotation Rules

Rotate secrets immediately if they appear in:

- Git commits
- Pull requests
- Issue trackers
- Screenshots
- Shared terminal output
- Client-side JavaScript bundles
- Browser devtools
- Logs or analytics tools

For Supabase exposure, rotate at minimum:

- database password
- anon key when required by the Supabase dashboard flow
- service-role key
- any Vercel variables containing the old values

Redeploy after rotation.

## Deployment Validation

Before promoting a deployment, confirm:

- `npm run lint` passes.
- `npm run test` passes.
- `npm run build` passes.
- `npx prisma migrate deploy` has run against the target Supabase database.
- `supabase/rls.sql` has been applied.
- `supabase/rls_verification.sql` passes.
- `/api/cron/followups-overdue` returns `401` without a secret.
- `/api/cron/followups-overdue` returns `ok: true` with `Authorization: Bearer <CRON_SECRET>`.
- A protected route redirects unauthenticated users to `/login`.
- A logged-in regional user can complete their expected clinical workflow.
