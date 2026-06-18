# RLS Verification

Use this plan after applying `supabase/rls.sql` in a staging Supabase project.

## Prerequisites

- Apply `supabase/rls.sql`.
- Confirm Supabase Auth users have `app_metadata.role`.
- Confirm region-scoped users also have `app_metadata.assignedRegion`.
- Run this first in staging, not production.

## Executable SQL Check

1. Open Supabase Dashboard.
2. Go to SQL Editor.
3. Paste the contents of `supabase/rls_verification.sql`.
4. Run the script.
5. Confirm the final `rls_results` table shows all checks with `passed = true`.

The script runs inside a transaction and ends with `ROLLBACK`, so test rows are not persisted.

## Covered Checks

- Super Administrator can read all seeded test clinical rows.
- Project Manager can read only their assigned region.
- Data Clerk can read only their assigned region.
- Screening Officer can read only their assigned region.
- Anonymous browser access cannot read patient clinical rows.
- Authenticated browser access cannot directly insert patient clinical rows.
- Service role can still insert patient clinical rows for trusted server-side flows.

## Manual API Smoke Checks

With the public anon key, direct browser writes should fail:

```bash
curl "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/patients" \
  -H "apikey: $NEXT_PUBLIC_SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer $USER_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"patient_code":"DENIED","full_name":"Denied","date_of_birth":"1970-01-01","sex":"Female","phone":"+252610000000","district":"Dhuusamareeb","region":"Galmudug","operation_district":"Dhuusamareeb","disability_status":"None","consent_given":true,"consent_date":"2026-06-18","referral_source":"test","registered_by_id":"test","registered_by_name":"test"}'
```

Expected result: HTTP 401/403 or an RLS policy violation.

Trusted server writes should still be tested through the app by registering a patient from the UI or via the existing Server Action flow.

## Policy Ambiguities

- Region access depends on `app_metadata.assignedRegion`; missing or stale claims will block legitimate regional reads.
- `Data Clerk` and `Screening Officer` currently have the same RLS read scope as `Project Manager`; finer action permissions remain in app-layer RBAC.
- RLS blocks direct browser writes broadly. Any future client-side Supabase writes must be routed through Server Actions or explicit new policies.
