# Shared upload rate-limit store — proposal only

`POST /api/uploads/images` keeps its in-memory counters in `lib/security/upload-limit.ts`. This change does not add Redis, Vercel KV, or a new firewall rule.

## What is enforced today

On one server instance, for a 10 minute window:

- 24 uploads per platform client IP
- 24 uploads per principal (host session, beta session, or upload grant)
- 180 uploads for the whole instance

The client IP comes from `x-vercel-forwarded-for`, then `x-real-ip` (`clientIpFromVercelHeaders`). A caller-supplied first `X-Forwarded-For` hop is ignored. When neither trusted header is present, every such request shares the bucket `unknown` instead of a spoofed address.

Those counters reset when a new instance starts, and they are not shared across instances. The global cap only limits the instance that received the requests.

## Why a shared store is not in this change

Guest routes already call `@vercel/firewall` with rule ids Yehuda publishes (`lolo-guest-read`, `lolo-guest-write`). A shared upload limit needs the same kind of new infrastructure: a rule published outside this repo, or another counter service. Neither exists for uploads. Adding a client call to an unpublished rule id would not create the shared store.

## Proposed follow-up

1. Publish a Vercel Firewall rate-limit rule, for example `lolo-image-upload`, keyed by platform IP and principal (`host:<eventId>`, `beta:<digest>`, or `grant:<id>`).
2. Call it from the upload route the same way guest writes call `checkRateLimit`: on Vercel, a real `rateLimited` result returns 429; a missing rule, timeout, or other error falls through.
3. Keep the in-memory counters as the local backstop when the shared check is skipped.
4. Do not invent a database table for counters unless the firewall rule cannot express the per-principal key.

Login routes still read the first `X-Forwarded-For` hop via `clientIpFromRequest`. That is separate from uploads and is not changed here.
