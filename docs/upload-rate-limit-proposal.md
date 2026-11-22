# Upload rate limits — what is active, and what needs approval

No new environment variable is required. `IMAGE_UPLOAD_SECRET` is only the HMAC key for create-event grants. This document does not provision a firewall rule, a database, or a secret.

## Active now (no approval)

On each server instance, for 10 minutes:

- 24 uploads per trusted IP (`x-vercel-forwarded-for`, then `x-real-ip`; otherwise the shared bucket `unknown`)
- 24 uploads per principal (host session, beta session, or one grant id)
- 180 uploads for that instance
- 300 create-event grants minted per trusted IP

A new grant does not raise the upload cap. The IP counter is checked even when a grant is present. The grant id is an additional cap, not a replacement. Each grant is signed for the trusted IP that rendered the create-event page and is rejected from any other IP. Grants last 30 minutes.

Login, beta login, store lookup, and store redeem use the same IP helper. A spoofed first `X-Forwarded-For` hop does not reset those counters.

These counters are not shared across instances. A new instance starts at zero.

## Shared store — implemented, inactive until Yehuda publishes a rule

`lib/security/upload-shared-limit.ts` calls `@vercel/firewall` `checkRateLimit` only when `VERCEL=1` (set by Vercel, not a secret we add).

- Rule id: `lolo-image-upload`
- Key passed by the app: the trusted IP only (not the grant id)
- Suggested firewall limit: 24 requests per 10 minutes per key
- If the rule is missing (`not-found`), the call times out, or it throws, the decision is **open**. The in-memory limiter still applies. Event creation is not blocked because the store is down or unpublished.
- If the rule returns `rateLimited: true`, the upload is 429 even when this instance has not reached its memory cap.

**This rule is not published.** Until it is, the shared check does nothing and the in-memory caps above are the only active limit.

To turn it on, in the Vercel Firewall for the lolo project create a rate-limit rule whose `@vercel/firewall` id is exactly `lolo-image-upload`, keyed by the rate-limit key the app sends (the trusted client IP), at 24 / 10 minutes. No new env var. No SQL.

## Supabase counter — NOT APPLIED, not wired

A table was considered and is not used. The app does not query it. Do not run the statement below until you explicitly want a database counter instead of the firewall rule. Running it is a schema change on whatever database you point at, including production.

```sql
-- NOT APPLIED. The application does not read or write this table.
-- create table if not exists public.upload_rate_buckets (
--   bucket_key text primary key,
--   count integer not null,
--   reset_at timestamptz not null
-- );
```

No migration file was added under `supabase/`, so it cannot be picked up by the manual SQL list in the README.
