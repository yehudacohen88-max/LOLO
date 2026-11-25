# Pre-merge integration report

Draft only. Do not merge this branch into `main`.

- Integration branch: `cursor/integration-premerge`
- Base: `main` at `bf8527ac810e3e9a4908bff54a36f5f20cc623d0` (merge of #27). Fetched again before this report; `main` had not moved.
- Draft PR: https://github.com/yehudacohen88-max/LOLO/pull/41 titled `DO NOT MERGE: pre-merge integration`.
- Hosted Supabase project `fafvveudrlovaozazkny` was not queried and was not written. No `.env` file was committed. The beta gate was not opened. No PR was merged.

## Pull requests against current main

Each branch was 0 behind `main` and merged cleanly into `main` by itself (`git merge-tree`). Conflicts appeared only when the independent branches were merged together. Stack parents were exact ancestors of the child tips.

| PR | Branch | Ahead / behind `main` | Stack | Alone vs `main` |
| --- | --- | --- | --- | --- |
| #29 | `cursor/pilot-demo-voucher-guard-2d6a` | 1 / 0 | base `main` | clean |
| #36 | `cursor/p1-payments-core` | 2 / 0 | on #29 | clean |
| #38 | `cursor/p2-voucher-terms` | 3 / 0 | on #36 | clean |
| #40 | `cursor/p5-host-guest` | 4 / 0 | on #38 | clean |
| #28 | `cursor/pilot-readiness-b92f` | 1 / 0 | base `main` | clean |
| #34 | `cursor/p3-settlement` | 2 / 0 | on #28 | clean |
| #39 | `cursor/p6-store-admin` | 3 / 0 | on #34 | clean |
| #30 | `cursor/legal-privacy-drafts-7410` | 1 / 0 | base `main` | clean |
| #33 | `cursor/p4-notifications-invoices` | 1 / 0 | base `main` | clean |
| #32 | `cursor/p7-ci-testdb-audit` | 2 / 0 | base `main` | clean |
| #31 | `cursor/system-gap-map-1b7e` | 1 / 0 | base `main`, docs only | clean |

Overlapping paths that are sequential history inside a stack, not cross-branch conflicts: `package.json` on almost every branch; `proxy.ts` on #28, #30, and #39; `next.config.ts` only on #30; host and guest pages on #29, #30, and #40; admin nav on #28, #33, and #39. No dependency version conflict. `package.json` conflicts were script names only.

## Merge order and conflict resolutions

Real `git merge --no-ff` of each branch tip, in this order: #29, #28, #30, #36, #38, #40, #34, #39, #33, #32, #31.

| Merge | Conflict | Resolution |
| --- | --- | --- |
| #30 | `proxy.ts` | Keep both gates. Legal-draft 404 first, then the settlements rewrite to `/settlements-unavailable` when `SETTLEMENTS_ENABLED` is off. Beta gate unchanged. |
| #30 | `README.md` | List `SETTLEMENTS_ENABLED`, `LEGAL_DRAFTS_ENABLED`, `verify:pilot`, and `verify:legal`. |
| #30 | `app/e/[slug]/details/guest-details-form.tsx` | Keep the legal collection notice. Do not restore the receipt checkbox. #29 removed it and saves `wantReceipt: false`. |
| #36 | `.env.example`, `README.md` | Keep the legal-draft comment and the `PAYMENT_WEBHOOK_SECRET` comment. No secret value. |
| #38 | none | |
| #40 | `package.json` | Keep `verify:legal`, `verify:host-guest`, and the voucher scripts. |
| #34 | none | README auto-merged. |
| #39 | none | README, `package.json`, and `proxy.ts` auto-merged. Admin nav keeps events, orders, guests, payments, refunds, reports, audit, settlements (filtered by `showSettlements`), settings, and notifications. |
| #33 | `package.json` | Keep `verify:permissions`, `verify:pilot`, and `verify:notifications`. |
| #32 | `package.json` | Keep `verify:legal`, `verify:host-guest`, `test:e2e`, and the local-db scripts `db:local`, `db:reset`, `db:seed`, `verify:audit`, `verify:ci`, `verify:local-db`. |
| #31 | none | `docs/system/gap-map.md` only. |

## Feature fixes on this branch

These are separate commits on the integration branch. They are not on the feature PR branches yet. Copy them back before relying on a merge of that PR alone.

| Fix | Why | Put it back on |
| --- | --- | --- |
| `supabase/demo-seed.sql` redeems the bike voucher only when `voucher_demo_guard_version()` is absent. `docs/DEMO.md` says the same. | After the guard, `redeem_voucher` raises `voucher_demo_blocked` and the seed's `DO` block would abort. The seed stays last so issued demo vouchers are `demo_only`. | #29, together with `main`'s `demo-seed.sql`. |
| Empty `payment_provider_allowlist` and `payment_provider_is_real`. Unknown provider names are simulated in SQL, matching the empty TypeScript allow-list. | The old SQL treated every name other than `demo` as real money, so a direct `issue_gift_voucher` call could fund a spendable voucher. | #29. |
| `issueGiftVoucher` returns the existing row when the same idempotency key is sent again, before the funding plan rejects a second issue. | A retry after a successful issue saw an empty balance and threw `voucher_none_available` instead of returning the first voucher. | #29. |
| `setLocalRealProviderAllowlist` works only when `LOLO_LOCAL_DB=1`. | The monetary redeem test inserts `fixture` on the loopback allow-list and deletes it afterwards. The committed allow-list stays empty. | #29, with the test that uses it. |

CI-only change, not a product fix: `.github/workflows/ci.yml` sets `PAYMENT_WEBHOOK_SECRET` to `ci-webhook-secret` so the integration test can check HMAC. That value is not a live provider secret. It belongs with #32 if the integration test moves there. `scripts/local-db-order.mjs` now applies every SQL file except the two skipped files. That order belongs with #32.

## Tests run locally

Loopback Supabase only. `npx next typegen` succeeded. `npx tsc --noEmit` succeeded. `npx eslint . --max-warnings 0` succeeded.

`node scripts/run-verify.mjs` with `LOLO_LOCAL_DB=1` and `LOLO_LOCAL_PROFILE=full` against the loopback database:

| Script | Pass | Fail |
| --- | ---: | ---: |
| verify:audit | 7 | 0 |
| verify:beta | 6 | 0 |
| verify:checkout | 21 | 0 |
| verify:ci | 5 | 0 |
| verify:events | 5 | 0 |
| verify:guest-access | 74 | 0 |
| verify:guest-progress | 10 | 0 |
| verify:host-guest | 10 | 0 |
| verify:host-images | 29 | 0 |
| verify:images | 8 | 0 |
| verify:integration | 5 | 0 |
| verify:legal | 10 | 0 |
| verify:local-db | 2 | 0 |
| verify:notifications | 16 | 0 |
| verify:permissions | 11 | 0 |
| verify:pilot | 14 | 0 |
| verify:sessions | 17 | 0 |
| verify:settlements | 17 | 0 |
| verify:vouchers | 28 | 0 |
| **Total** | **295** | **0** |

`verify:integration` is the local end-to-end file `scripts/verify-integration-db.ts`. Its five tests cover:

1. Payments: a non-demo provider throws `PAYMENTS_LIVE_NOT_ENABLED`. Demo start and confirm are idempotent. Webhook HMAC rejects a bad signature and accepts `sha256=`. A second event does not change the charged amount. A `cardcom` attempt with `simulated = false` is rejected by the table check. A demo refund replays. Cancelling a paid order is refused. Cancelling a pending order is idempotent.
2. Vouchers: with the allow-list empty, a `fixture` payment issues `demo_only` and redeem is refused. With a loopback-only `fixture` row, issue is idempotent, full redeem, second redeem, other-store redeem, partial redeem, a further partial that would overspend, expiry, and cancel are checked. The `fixture` row is deleted. A demo checkout voucher is `demo_only` and redeem is refused.
3. Permissions: anonymous REST on events, gifts, orders, vouchers, guests, and audit is closed. A host cookie reads only that event's guests. A store cookie is not an admin cookie. Desk lists stay on the requested event.
4. Settlement: a monetary redemption leaves `UNSETTLED`. A redemption planted on a `demo_only` voucher stays `UNSETTLED` and is not in the batch.
5. Notifications and documents: simulated email records `sent_simulated` and `simulated; no network`. A `twilio` SMS provider is refused and does not send. The document is simulated, watermarked `מסמך בדיקה – אינו מסמך חשבונאי`. A `hashavshevet` provider throws before insert. The test's fetch spy saw no host outside the loopback.

The `full` SQL profile applied with zero errors before these tests. `verify:local-db` saw settlements and the demo event because the profile was `full`.

## Safety audit

| Claim | Evidence |
| --- | --- |
| No real charge | `REAL_PROVIDER_ALLOWLIST` is `[]`. `payment_provider_allowlist` is created empty and the integration test leaves it empty. `createLiveProviderStub` throws `PAYMENTS_LIVE_NOT_ENABLED` and has no `fetch`. `payment_attempts` checks `provider = 'demo'` and `simulated`. The integration test sets `PAYMENT_PROVIDER=cardcom` and asserts the start call throws. |
| No real message send | `lib/notifications` has no `fetch` and no URL. Only `""` and `"simulated"` construct `SimulatedChannelProvider`. Any other name is `RefusedChannelProvider`; the dispatcher records `failed` and does not call `send`. The integration test covers `twilio`. |
| No real accounting document | `lib/invoices` has no `fetch`. `issueOrderDocument` throws unless the provider is named `simulated`. The stored watermark is `מסמך בדיקה – אינו מסמך חשבונאי`. The integration test covers a refused `hashavshevet` provider. |
| Demo vouchers are not redeemable for money | `redeem_voucher` raises `voucher_demo_blocked` when `demo_only` is true. The integration test issues a demo checkout voucher and a voucher funded by an unknown provider, and both redeems throw the Hebrew demo error. |

Finding, not a server send: `lib/invite/whatsapp.ts` and the host copy-link build `https://api.whatsapp.com/send?...` for the host's browser. The server does not call that URL. No Twilio, Resend, Stripe, or Cardcom host appears in application code.

Finding, not a charge: `isDemoMoney` and `orderDemoFlag` still describe an unknown provider name as "not demo" for a label and for whether the simulated payment note is included. The document path still forces `simulated` and the watermark. The desk label for that case is `אינו מסומן כהדגמה`. It does not create a payment.

## CI

GitHub Actions run https://github.com/yehudacohen88-max/LOLO/actions/runs/45377050810 on code commit `24de65c`. Both jobs passed:

| Job | Result | Time |
| --- | --- | --- |
| local database without settlements | pass | 3m3s |
| local database with settlements and demo seed | pass | 2m34s |

The workflow is pull_request only, reads no GitHub secrets, and does not set a hosted Supabase URL. The Vercel preview deployment for that commit completed. No write test was run against the preview, because Preview uses the hosted project.

This report commit does not change runtime behavior. It records that result.

## Recommended merge order into main

Use merge commits, in the same order as this branch: #29, #28, #30, #36, #38, #40, #34, #39, #33, #32, #31. Do not squash. A squash of a parent leaves the child's original commits in place and the next merge no longer matches this history.

After each parent merges, retarget the next child onto `main` without rebasing:

- After #29 merges, set #36's base to `main`, then merge #36.
- After #36, set #38's base to `main`, then merge #38.
- After #38, set #40's base to `main`, then merge #40.
- After #28, set #34's base to `main`, then merge #34.
- After #34, set #39's base to `main`, then merge #39.
- #30, #33, #32, and #31 are already based on `main`.

Copy the #29 fixes listed above onto `cursor/pilot-demo-voucher-guard-2d6a` before merging #29, or the merged guard will still treat an unknown provider as real money and `demo-seed.sql` will fail once the guard is applied. Copy the SQL order and the CI webhook env onto #32 before merging #32, or CI will not apply the new files.

Do not merge this integration branch. It exists so the combined tree and CI can be reviewed.

## SQL order and settings

The ordered list, risk, and rollback for every file are in `docs/system/sql-apply-order.md`. Twenty-seven files are applied. `supabase/fix-public-read.sql` and `supabase/demo-cleanup.sql` stay skipped.

Simulation values versus deferred commercial decisions are in `docs/system/simulation-settings.md`. Commission, refund policy, VAT, voucher validity, and the real-provider allow-list stay unset.
