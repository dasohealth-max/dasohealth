# Security Setup

This project uses Supabase, Prisma, and Next.js environment variables. Keep all real credentials in local or deployment-specific secret stores only. Do not commit `.env`, `.env.local`, production `.env.*` files, database URLs, Supabase keys, screenshots of secrets, or logs containing secrets.

## Immediate Rotation Warning

Live-looking database and Supabase credentials were found in the local untracked `.env.local` during cleanup. Treat those values as exposed if this workspace, terminal output, screenshots, backups, or any previous commits were shared.

Rotate the exposed credentials in Supabase immediately:

1. Rotate the database password from the Supabase project database settings.
2. Rotate the Supabase JWT secret or API keys as required by the Supabase dashboard flow.
3. Replace `NEXT_PUBLIC_SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` everywhere they are configured.
4. Update local `.env.local`, deployment environment variables, and CI secrets with the new values.
5. Redeploy the app after updating hosted secrets.

## Required Variables

Create `.env.local` from `.env.example` for local development and fill in real values locally only.

| Variable | Required | Used by | Notes |
| --- | --- | --- | --- |
| `DATABASE_URL` | Yes | Prisma runtime | Use the Supabase pooler URL for application traffic. Contains the database password and must stay secret. |
| `DIRECT_URL` | Yes for migrations | Prisma CLI | Used by `prisma.config.ts` for migrations. Contains the database password and must stay secret. |
| `DATABASE_SSL_REJECT_UNAUTHORIZED` | Optional | Prisma runtime | Set to `true` only when certificate validation is configured correctly. |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Browser and server auth | Public project URL. It is not a password, but keep environment setup consistent. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Browser and server auth | Public anon key. It must rely on Supabase RLS and policies for safety. Rotate if exposed unexpectedly. |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes for admin server actions | Server actions only | Highly privileged key that bypasses RLS. Never expose it to client code or logs. |
| `CRON_SECRET` | Yes in deployed environments | Cron route authentication | Long random shared secret used to protect `/api/cron/followups-overdue`. |
| `E2E_SUPER_EMAIL` | Optional | Playwright tests | Local or CI test account email. |
| `E2E_PM_EMAIL` | Optional | Playwright tests | Local or CI test account email. |
| `E2E_CLERK_EMAIL` | Optional | Playwright tests | Local or CI test account email. |
| `E2E_SCREENER_EMAIL` | Optional | Playwright tests | Local or CI test account email. |
| `E2E_PASSWORD` | Optional | Playwright tests | Test account password. Keep out of commits. |

## Safe Local Setup

1. Copy `.env.example` to `.env.local`.
2. Fill in real values from Supabase and your local test account setup.
3. Confirm `.env.local` is ignored by Git:

   ```bash
   git check-ignore -v .env.local
   ```

4. Never paste secret values into issue trackers, pull requests, chat, screenshots, or terminal logs.
5. If a secret is accidentally exposed, rotate it instead of only deleting it from files.

## Deployment Setup

Configure production and preview secrets in the hosting provider's environment variable UI or secret manager. Do not upload `.env.local`.

Set at minimum:

- `DATABASE_URL`
- `DIRECT_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `CRON_SECRET`

Use separate Supabase projects or separately scoped credentials for development, staging, and production when possible.

## Follow-up Overdue Cron

The app includes an authenticated route handler at:

```text
/api/cron/followups-overdue
```

It marks pending or due follow-ups as `Overdue` when their due date is before the current day. The route requires `CRON_SECRET`; requests without the secret return `401`.

For Vercel, `vercel.json` schedules the route daily at `00:00` UTC:

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

Configure `CRON_SECRET` in Vercel project environment variables for Production and Preview as needed. Vercel Cron can call the route using the `Authorization: Bearer <CRON_SECRET>` header. For manual verification, call:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" https://your-domain.example/api/cron/followups-overdue
```

The route also accepts `x-cron-secret: <CRON_SECRET>` for external schedulers that cannot set bearer tokens.

## Supabase RLS

Apply `supabase/rls.sql` in Supabase after testing it in staging. The current RLS model allows authenticated browser clients to read region-scoped rows but denies browser writes to patient, screening, surgery, follow-up, medication, user, campaign, and audit tables. Writes must go through Server Actions or trusted service-role/server database flows.

The policies depend on Supabase Auth JWT metadata:

- `app_metadata.role`
- `app_metadata.assignedRegion`

Keep those values synchronized when users are created or updated.

## Logging Rules

Do not log full environment variables, connection strings, JWTs, API keys, passwords, cookies, authorization headers, refresh tokens, or password reset tokens. If troubleshooting requires confirmation, log only the variable name and whether it is present.

Acceptable:

```ts
console.info('DATABASE_URL configured:', Boolean(process.env.DATABASE_URL));
```

Not acceptable:

```ts
console.info(process.env.DATABASE_URL);
```

## Service Role Safety

`SUPABASE_SERVICE_ROLE_KEY` must remain server-only. Only use it in server actions, route handlers, scripts, or other code that cannot be bundled for the browser. Client components must use `NEXT_PUBLIC_SUPABASE_ANON_KEY` and rely on Supabase Row Level Security.
