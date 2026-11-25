# Disconnect Vercel Preview from Production Supabase

This document is the runbook for a later approved settings change. Merging this branch does not change Vercel environment variables, does not deploy itself, and does not apply SQL.

The runtime guard in `lib/supabase/server.ts` refuses to create the service-role client when `VERCEL_ENV=preview`, unless `LOLO_ALLOW_PREVIEW_DB_URL` exactly matches `NEXT_PUBLIC_SUPABASE_URL` and that URL is not the Production project `fafvveudrlovaozazkny`. Write routes return HTTP 503 with:

`סביבת Preview מנותקת ממסד הנתונים של Production ואינה זמינה לכתיבה.`

On Production (`VERCEL_ENV=production`) the guard is a no-op.

## Vercel change (Preview target only)

Do this only after explicit approval. Do not delete the variables. They are shared with Production.

1. Open [Environment Variables for project `lolo`](https://vercel.com/yehudacohen88-4015s-projects/lolo/settings/environment-variables).
2. Confirm names and targets only. Do not paste values into chat or into this file.
3. For each of these names, edit the existing record and uncheck **Preview**, leaving **Production** checked:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
4. If a name already has two records (one Production, one Preview), delete only the Preview record. Leave the Production record untouched.
5. Do not change Development, Production values, or any other variable.
6. Do not add `LOLO_ALLOW_PREVIEW_DB_URL` until a separate non-Production database exists.
7. Redeploy **Preview** deployments only, so already-built Previews drop the old values. Do not redeploy Production.

## Rollback

1. Edit the same three variables and check **Preview** again, without replacing the Production value.
2. Redeploy Preview deployments only.
3. If a variable was deleted by mistake, stop. Restore it from the Supabase dashboard for project `fafvveudrlovaozazkny` onto the Production target only, then ask for a new review before adding Preview again.

## Post-checks (read-only against Production)

- The three names still list the Production target and no longer list Preview.
- `https://lolo-sooty.vercel.app` still loads. Do not submit forms. Row counts should be unchanged.
- A Preview URL shows the disconnected or "service unavailable" Hebrew message on data and write routes. Submitting a form there must not change Production counts.

## What Preview shows afterwards

Until a separate database is allow-listed, Preview has no database. Pages and write APIs that need Supabase show the disconnected message (after this code is on that deployment) or the generic "השירות אינו זמין כרגע" message (if only the env vars were removed). Local development is unchanged.
