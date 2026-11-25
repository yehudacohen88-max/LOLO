# LOLO system gap map

Analysis only. No application code, no SQL execution, no Production writes. `DECISIONS.md` is not in `origin/main` (`bf8527a`) or on PR branches #28–#30, so the configurable-decision list below is taken from code and docs.

**Baseline:** `main` at `bf8527a` (merge of #27). Open PRs are treated as built and awaiting merge. All three branch from that same commit.

| PR | Branch | What it adds |
| --- | --- | --- |
| [#28](https://github.com/yehudacohen88-max/LOLO/pull/28) | `cursor/pilot-readiness-b92f` | `SETTLEMENTS_ENABLED` gate, `/feedback`, test-data inventory, `npm run verify:pilot` |
| [#29](https://github.com/yehudacohen88-max/LOLO/pull/29) | `cursor/pilot-demo-voucher-guard-2d6a` | Demo-funded voucher issue/redeem block, demo labels, 0 NIS checkout block |
| [#30](https://github.com/yehudacohen88-max/LOLO/pull/30) | `cursor/legal-privacy-drafts-7410` | Hebrew legal drafts behind `LEGAL_DRAFTS_ENABLED` |

**Status values**

| Status | Meaning |
| --- | --- |
| Done | On `main` and works with the schema the code already expects |
| Partial | A slice is on `main`; the rest of the requirement is absent |
| Missing | No route, table, or provider path |
| Built-in-open-PR | The behavior lives on #28, #29, or #30 and is not on `main` |

## Schema the code assumes

SQL files are applied by hand in the Supabase SQL editor. Deploy does not run them (`README.md`). This pass did not query Production.

| File | Objects the code uses | Live? |
| --- | --- | --- |
| `supabase/schema.sql` | `events`, `event_gifts` | Yes. First install only. Re-running it after `events-anon-read.sql` reopens anonymous reads. |
| `supabase/events-server-write.sql` | Revokes anon write (and select) on events and gifts | Assumed. Server writes go through the service role (`lib/events/publish-server.ts`). |
| `supabase/events-anon-read.sql` | Drops public SELECT policies and revokes anon select | The 24 Nov 2026 read already has no policies on events and event gifts, which is this file's end state. It is not a pending Production migration. Local and CI still apply it after schema.sql, because schema.sql opens the read policies. |
| `supabase/orders.sql` | `orders`, `order_items`, `set_updated_at`, `order_item_matches_event` | Yes. Checkout and the host dashboard select these tables. |
| `supabase/host-access-code.sql` | `event_host_access` | Yes. `POST /api/host/login` reads it. |
| `supabase/event-guests.sql` | `event_guests` | Yes. `lib/host/guest-list.ts`. |
| `supabase/invite-tokens.sql` | `event_guests.invite_token_hash`, `invite_token_enc` | Yes. `GET /i/[token]`. |
| `supabase/stores.sql` | `stores` | Yes. |
| `supabase/stores-admin-fields.sql` | Contact, commission, terms, voucher settings | Yes. Admin store select lists every column (`lib/admin/stores.ts`). |
| `supabase/event-gifts-store.sql` | `event_gifts.store_id`, `store_name` | Yes, with narrower fallback selects in `lib/host/dashboard.ts`. |
| `supabase/custom-gifts.sql` | `image_url`, `source` | Yes, with a fallback when those columns are missing (`lib/events/publish-server.ts`). |
| `supabase/demo-checkout.sql` | `orders.fee_amount`, `charged_amount`, `payment_provider`, `payment_reference`, `paid_at`; `platform_settings` | Yes. Missing schema fails checkout closed (`lib/payments/schema-error.ts`). |
| `supabase/vouchers.sql` | `vouchers`, `redemptions`, `store_redemption_access`; RPCs `issue_gift_voucher`, `redeem_voucher`, `cancel_voucher` | Yes. Missing schema returns "הנפקת השוברים עדיין לא הופעלה." (`lib/vouchers/messages.ts`). |
| `supabase/settlements.sql` | `settlements`, `settlement_lines`; RPCs `create_store_settlement`, `mark_settlement_paid`, `cancel_settlement` | **Not applied in Production.** Code on `main` calls it and shows "ההתחשבנות עדיין לא הופעלה." (`lib/settlements/repository.ts`). #28 keeps the screens off until `SETTLEMENTS_ENABLED`. |
| `supabase/fix-public-read.sql` | Reopens anonymous read and insert | Do not run. |
| `supabase/demo-seed.sql`, `supabase/demo-cleanup.sql` | Demo rows. Cleanup also touches settlement tables | Optional. Cleanup is unsafe while `settlements` is absent (#28 inventory note). |
| `supabase/pilot-feedback.sql` (#28) | `pilot_feedback` | Not applied. `/feedback` stays 503 until the table exists. |
| `supabase/pilot-isolate-test-data.sql` (#28) | Proposed `pilot_isolated` flags. Writes are commented and end in `ROLLBACK` | Not applied. The file as committed only runs `SELECT`. |
| `supabase/pilot-demo-voucher-guard.sql` (#29) | `vouchers.demo_only`; replaces paid-amount and redeem functions | Not applied. Until it is, the app refuses to issue or redeem demo-funded vouchers. |
| `docs/upload-rate-limit-proposal.md` | Commented `upload_rate_buckets` | Explicitly not applied and not queried. |

`supabase/readonly/test-data-inventory.sql` (#28) is `SELECT` only and was not run on Production in that PR.

## Roll-up

| Domain | Done | Partial | Missing | Built-in-open-PR |
| --- | --- | --- | --- | --- |
| 1 Host | Create event | Edit, gifts, invitees, participation, greetings, invitations, voucher balances | My events, access recovery | — |
| 2 Guest | Gift choice, partial contribution | Details and greeting text, demo payment, on-screen confirmation | Sent confirmation, cancel, refund | 0 NIS block (#29) |
| 3 Store | Login, verify, redeem | Business details, one shared code, settlement screens | Self-serve onboarding, staff roles, redemption history | Settlement gate (#28); demo redeem block (#29) |
| 4 Admin | Stores, vouchers, redemptions, guest-fee setting | Orders as totals only, voucher cancel, commission math | Hosts, events, guests, refunds, audit log | Feedback (#28); settlement gate (#28) |
| 5 Payments | Demo provider, simulated failure, one-order double-pay guard | Provider interface, demo vs real labeling | Webhook, cancel, refund, attempt ledger | 0 NIS guard on start/confirm (#29) |
| 6 Vouchers | Issue, verify, redeem, partial redeem, row lock, per-store terms | Top-up flag with no charge path; 365-day code default | — | Demo monetary block (#29) |
| 7 Settlement | — | Full ledger design on `main`; no Production tables; mark-paid is a status, not a payout | Bank reconciliation, payout provider | UI/API gate (#28) |
| 8 Notifications | — | Click-to-chat WhatsApp links; `wants_confirmation` stored | Email, SMS, templates, send log, simulated providers | — |
| 9 Invoices | — | "Invoice" as a settlement-method label; receipt checkbox stored on the order | Document adapter, test watermark, document history | — |
| 10 Security | Separate host, store, admin, and invite cookies; in-memory limits; beta gate | Firewall rate limits coded and unpublished; advisor items not triaged here | Security headers, CI, audit log, backups/monitoring in repo, isolated test DB | Legal drafts (#30) |

## 1. Host

| Requirement | Status | Evidence | Missing | DB schema | Depends on |
| --- | --- | --- | --- | --- | --- |
| Create event | Done | Wizard `app/create-event/**`. `POST /api/events` → `publishEventOnServer` (`lib/events/publish-server.ts`). Access code hashed into `event_host_access`. Shown once (`app/create-event/success/`). | — | Uses existing `events`, `event_gifts`, `event_guests`, `event_host_access` | — |
| Edit event | Partial | `updateEvent` in `lib/events/repository.ts` calls `createEvent` and inserts a new row. After publish, only photos change: `PATCH /api/host/events/[eventId]/images`, `app/host/events/[eventId]/host-photo-editor.tsx`. Plan: `docs/host-phase-2-plan.md`. | Title, date, venue, message, gift text, gift order. No `PATCH` for the event row. Slug must stay stable. | No new table for text edits. A `session_version` column is only needed once recovery can invalidate cookies. | Host session already required |
| My events | Missing | Login is one slug plus one code (`app/host/page.tsx`, `POST /api/host/login`). Cookie `lolo_host_session` is `typ: "host"` for one `eventId`, 12 hours (`lib/host/session.ts`). Last slug is `localStorage` only. | Identity, list API, and a cookie that is not a single-event session. | New `host_identities`, `host_identity_events` (see phase-2 plan). RLS closed to anon, service role only. | Recovery channel before the list is safe |
| Access recovery | Missing | Code is PBKDF2 in `event_host_access.code_hash` (`lib/host/access-code.ts`). No phone or email on `events`. | OTP, new code, session revocation. | `host_recovery_challenges` (OTP hash, expiry, attempts). Optional recovery columns, not a second copy of the management code. | Notification provider (package P4) for the OTP |
| Manage gifts | Partial | Gifts are chosen before publish (`app/create-event/gifts/**`). Dashboard shows progress and can replace a photo. | Add, remove, reorder, or retarget a gift after publish. Funded gifts must not be deleted quietly. | No new table. Rules belong in the update API, not a new column, except a lock when `order_items` or `vouchers` exist. | Voucher issue rules so an edit cannot orphan a voucher |
| Manage invitees | Partial | Excel import `lib/guests/excel.ts` (`xlsx`). Host add/remove `app/api/host/events/[eventId]/guests`. Table `event_guests` (name, phone). | Email on the invitee row. No RSVP. Removing a guest does not revoke a cookie already issued. | Optional `email` on `event_guests`. Invite hash columns already exist. | — |
| Track participation | Partial | `getHostDashboardData` (`lib/host/dashboard.ts`) loads paid and pending totals per gift via `lib/funding/calculate.ts`. Orders list name, phone, email, greeting, status. | No export. Media greetings are not on the order. | No | — |
| Greetings | Partial | `orders.greeting_text` (max 500, `lib/orders/guest-input.ts`). Host dashboard prints that text. | Image, audio, and video stay in browser `localStorage` (`lib/guest-draft.ts`, `app/e/[slug]/greeting/greeting-form.tsx`). | New `order_greetings` or storage objects if media must survive the browser. | Upload security already used for event images |
| Invitations | Partial | Personal link `GET /i/[token]` sets `lolo_invite_session`. WhatsApp is a `wa.me` URL (`lib/invite/whatsapp.ts`), also on the success page. | No send, no delivered/opened status. | Optional `invite_sent_at` only after a real sender exists. | P4 |
| Vouchers and balances | Partial | Host issues with `POST /api/host/events/[eventId]/vouchers` → `issue_gift_voucher`. Card at `/host/events/[eventId]/vouchers/[voucherId]` and public `/v/[token]`. Remaining amount is on the voucher. On `main`, `voucher_paid_amount` sums every paid order, including `payment_provider = demo`. | Demo-funded vouchers can still be issued as spendable until #29 is merged and its SQL is applied. | #29 adds `vouchers.demo_only`. Do not add a second balance table. | #29; payments classification (P1) |

## 2. Guest

| Requirement | Status | Evidence | Missing | DB schema | Depends on |
| --- | --- | --- | --- | --- | --- |
| Choose gifts | Done | `/e/[slug]` `app/e/[slug]/guest-event-view.tsx`. Up to 8 gifts (`GUEST_MONEY_LIMITS`). Public payload is filtered (`lib/events/public-guest.ts`). | — | No | — |
| Full or partial contribution | Done | Suggested amounts and a custom amount. Target is not a cap (`README.md`, `lib/funding/calculate.ts`). Server rejects `amount <= 0` in `lib/orders/repository.ts`. Cap 100,000 is a code constant. | The cap and the currency are not settings. | No | Configurable limits (decisions section) |
| Greetings and personal details | Partial | `/e/[slug]/greeting`, `/e/[slug]/details`. Name, phone, email required. `wantsConfirmation` stored as `orders.wants_confirmation`. | Rich media not stored. The checkbox does not send anything. | Same media table as host greetings, if product wants it. | P4 for the confirmation the checkbox implies |
| Payment flow | Partial | `/e/[slug]/payment` → `POST /api/payments/start` and `POST /api/payments/confirm`. Demo buttons only (`app/e/[slug]/payment/payment-summary.tsx`). Quote: `POST /api/checkout/quote`. Fee from `platform_settings` (`lib/payments/fee.ts`). | No live PSP, no card form, no redirect URL (the demo provider returns no `checkoutUrl`). | No for the demo path. A live attempt table is P1. | P1 |
| 0 NIS checkout | Built-in-open-PR | On `main`, `guestItemsProblem` allows a total of 0; the repository then rejects it. #29 adds `guestCheckoutAllowed` and blocks start, confirm, and order write with "עדיין לא נבחרה מתנה." | Merge #29. | No | #29 |
| Purchase confirmation | Partial | `/e/[slug]/thank-you` reads the order from the server (`thank-you-view.tsx`). Status text includes demo paid and failed. | No email, SMS, or receipt. `wants_confirmation` is only a column. | `notification_messages` when P4 lands. | P4, P1 paid event |
| Error handling | Done | Demo outcome `failure` calls `markOrderFailed`. A paid order is not overwritten (`lib/payments/state.ts`). Thank-you links back to payment. | — | No | — |
| Cancel | Missing | `payment_status` may be `cancelled` (`supabase/orders.sql`) and the UI has a label, but no route sets that status. | Guest and admin cancel of a pending order. | No column. A transition in the existing check constraint is enough. | Refund policy decision before cancelling a paid order |
| Refund | Missing | No refund column, route, or provider method. | Full and partial refund, and what that does to issued vouchers. | `payment_refunds` (amount, provider, idempotency key, status). | P1; voucher release rules (P2) |

## 3. Store

| Requirement | Status | Evidence | Missing | DB schema | Depends on |
| --- | --- | --- | --- | --- | --- |
| Onboarding and business details | Partial | Admin creates the store: `/admin/stores/new`, `POST /api/admin/stores`. Fields in `lib/admin/store-fields.ts` (name, slug, logo, site, contact, commission, terms, settlement method, voucher terms, notes). | No store self-signup. The store never edits its own details. | Columns already exist from `stores-admin-fields.sql`. | — |
| Permissions and access | Partial | `/store` login with slug plus redemption code. Hash in `store_redemption_access`. Cookie `lolo_store_session` (`lib/store/session.ts`). Admin rotates the code (`app/admin/stores/redemption-code-panel.tsx`). Inactive stores cannot sign in. | One shared code per store. No staff users, no roles. | Optional `store_staff` if more than one code is required. | — |
| Verify and redeem | Done | `POST /api/store/lookup`, `POST /api/store/redeem`, QR scan on `app/store/redeem/redeem-form.tsx`. RPC `redeem_voucher` locks the row (`for update`). | — | Uses `vouchers.sql`. | #29 for demo vouchers |
| Demo voucher redeem block | Built-in-open-PR | #29 `lib/vouchers/demo-funding.ts` and `supabase/pilot-demo-voucher-guard.sql`. Demo vouchers are labeled "שובר הדגמה – ללא ערך כספי" and redeem raises a closed/demo error. Until the SQL is applied, issue and redeem of that money fail closed in the app. | Merge #29, then apply that SQL only after approval. | `vouchers.demo_only` plus replaced functions. File already in the PR. Do not apply from this docs change. | #29 |
| Transaction history | Missing | The store UI has login, redeem, and settlements. Redemption rows are listed for admin (`/admin/redemptions`), not for the store. | A store-scoped list of its own redemptions. | No new table. Query `redemptions` by `store_id`. | — |
| Balances | Partial | `listStoreBalances` (`lib/settlements/repository.ts`) sums unsettled, pending, and paid payable amounts. The store page only lists settlement batches (`app/store/settlements/page.tsx`). | Running balance is hidden while the settlement schema is absent, and #28 hides the page unless the flag is on. | Requires `settlements.sql`, which is not in Production. | #28, P3 |
| Settlement | Partial | See domain 7. Store page is read-only. | Payout execution. | `settlements.sql` (not applied). | #28 |
| Reports | Partial | Settlement list with gross, commission, payable, due date, status. | No date filter, no export, no per-voucher report for the store. | No | P3 |

## 4. Admin

| Requirement | Status | Evidence | Missing | DB schema | Depends on |
| --- | --- | --- | --- | --- | --- |
| Manage stores | Done | `/admin/stores`, create, edit, activate. Single password `LOLO_ADMIN_PASSWORD` (`lib/admin/password.ts`), cookie `lolo_admin_session`. | More than one admin. | No | — |
| Manage hosts | Missing | No host list or disable. Counts of events only (`countEvents` in `lib/admin/stores.ts`). | Search, lock, rotate a host code. | No, until host identities exist. | P5 |
| Manage events | Missing | Dashboard shows an event count (`app/admin/page.tsx`). | List, open, unpublish, edit. | No | P5 edit API |
| Manage guests | Missing | Guest rows are host-only. | Admin view with the same redaction as public guest payloads. | No | — |
| Orders and payments | Partial | Overview totals: paid contribution, guest fees, order count (`getAdminFinanceOverview`). | No order browser, no status change, no refund. | `payment_refunds` with P1. | P1 |
| Vouchers and redemptions | Done | `/admin/vouchers`, `/admin/vouchers/[voucherId]`, `/admin/redemptions`. Admin redeem `POST /api/admin/vouchers/[voucherId]/redeem`. | — | `vouchers.sql` | #29 so admin redeem cannot cash a demo voucher |
| Cancellations | Partial | `POST /api/admin/vouchers/[voucherId]/cancel` → `cancel_voucher` (blocked after a redemption). Settlement cancel exists in code and is gated by #28. | Order cancel and payment refund. | No for voucher cancel. | P1 for payment cancel |
| Refunds | Missing | Same gap as the guest refund row. | Admin refund with a reason. | `payment_refunds`. | P1, P2 |
| Commissions | Partial | Per-store `commission_percent`, snapshotted on `redemptions.commission_percent_snapshot`. Split in `lib/settlements/money.ts` and `settlement_split`. Null snapshot is treated as 0%. | The 0% default for "unset" is a business rule baked into SQL. Settlement screens do not run in Production. | No new column. Read the snapshot; do not hard-code a rate. | Decision: what null commission means |
| Settlement | Partial | `/admin/settlements`, create, mark paid, cancel. Idempotency key on the batch. | Production tables. Real payout. | `settlements.sql` not applied. | #28 gate |
| Reports | Partial | Home stat cards only. | Export, date range, per-store and per-event statements. | A view can wait. Aggregates can read existing tables. | P3 |
| Support | Built-in-open-PR | #28 `app/feedback`, `POST /api/feedback`, `lib/pilot/feedback.ts`. Closed until `pilot_feedback` exists. | A support queue, assignment, and reply. The PR is a pilot form, not a desk. | `pilot_feedback` (file in #28, not applied). | #28 |
| Audit log | Missing | No `audit_log` table. Login, code rotation, voucher cancel, and mark-paid are not recorded. | Append-only log of who did what. | `audit_events` (actor, action, subject, at, metadata). Service role insert only. No update or delete. | P7 |

## 5. Payments

| Requirement | Status | Evidence | Missing | DB schema | Depends on |
| --- | --- | --- | --- | --- | --- |
| Provider abstraction | Partial | `PaymentProvider` in `lib/payments/provider.ts`: `startPayment`, optional `confirmDemoPayment`. `getPaymentProvider` selects `demo`, `none`, or throws on any other `PAYMENT_PROVIDER` (`lib/payments/selection.ts`). | Registering a live provider, a webhook entry, and a refund method on the interface. | No | — |
| Demo provider | Done | `lib/payments/demo-provider.ts`. Reference `demo-` plus 16 hex chars (`lib/payments/reference.ts`). UI copy says no card and no real charge. | — | `demo-checkout.sql` | — |
| Webhook simulation | Missing | The comment in `provider.ts` describes a future signed webhook that calls `markOrderPaid`. There is no `/api/payments/webhook` route. Demo confirm is a browser `POST` allowed only when the provider kind is `demo`. | A simulated webhook that posts a signed body and is rejected when the signature or the idempotency key is wrong. | `payment_attempts` so the webhook and the browser cannot both capture. | P1 |
| Failure handling | Done | Outcome `failure` → `markOrderFailed`. Paid stays paid. Failed can later become paid. Cancelled is rejected (`lib/payments/state.ts`). | — | No | — |
| Double-charge prevention | Partial | `markOrderPaid` updates only `pending` or `failed`, then re-reads if the row was already paid (`lib/orders/repository.ts`). A second success keeps the first reference. | No client idempotency key. A guest can open a second order for the same gift. No unique provider-payment id. | `payment_attempts (order_id, idempotency_key)` unique, plus a unique provider reference per live provider. | P1 |
| Cancellations and refunds | Missing | Status `cancelled` is accepted by the state machine and never written. No refund method on `PaymentProvider`. | Pending cancel. Refund of a demo payment must stay inside the demo ledger. Refund of a live payment must call the PSP. | `payment_refunds`. | Policy decision; P2 if a voucher was already issued |
| Demo vs real separation | Partial | `orders.payment_provider` and `payment_reference` are stored. Demo references start with `demo-`. On `main`, voucher issue ignores that distinction (`voucher_paid_amount` in `supabase/vouchers.sql`). | Absolute block is #29, not `main`. | #29 `demo_only` and `voucher_simulated_amount`. | #29 |

## 6. Vouchers

| Requirement | Status | Evidence | Missing | DB schema | Depends on |
| --- | --- | --- | --- | --- | --- |
| Issue | Done | `issue_gift_voucher`. Idempotency unique on `(gift_id, idempotency_key)`. Cannot issue more than paid minus committed. Cancelled vouchers release the amount (`lib/vouchers/ledger.ts`). | — | `vouchers.sql` | — |
| Verify | Done | Store lookup by code or QR secret. Wrong store returns not found (`redeem_voucher`). Public card uses `view_token` (`/v/[token]`). | — | No | — |
| Redeem | Done | Store channel and admin channel. Amount, reference, commission snapshot, terms snapshot. | — | No | — |
| Balances and partial redemption | Done | `remaining_amount`. Partial allowed only when `allow_partial_redemption` is true; otherwise `voucher_partial_disabled`. Default when the store value is null is false (`lib/vouchers/terms.ts`). | — | Columns exist. | — |
| Double-redeem prevention | Done | `select … for update` in `redeem_voucher`. Status must be `ISSUED` or `PARTIALLY_REDEEMED`. | — | No | — |
| Validity and terms | Partial | Per store: `voucher_validity_days` (1–3650), partial flag, top-up flag, redemption method. Snapshotted onto the voucher at issue. Null uses `VOUCHER_TERM_DEFAULTS` (365 days, partial off, top-up off, method "הצגת השובר בחנות"). | The fallback lives in TypeScript, not in `platform_settings`. Top-up is displayed and stored; nothing charges a top-up. | Optional `platform_settings` columns for the fallback. No new voucher table. | Decision: default validity |
| Block monetary redeem of demo-funded vouchers | Built-in-open-PR | #29. Real money is a paid order whose provider is a non-empty name other than `demo` and whose reference does not start with `demo-`. Anything else is simulated. Demo issue is refused until `pilot-demo-voucher-guard.sql` is applied, so the old redeem function cannot cash it. | Merge and, after approval, apply that one SQL file. | File is in #29. | #29 |

## 7. Settlement

| Requirement | Status | Evidence | Missing | DB schema | Depends on |
| --- | --- | --- | --- | --- | --- |
| Compute transactions, commissions, balances | Partial | Design in `supabase/settlements.sql` and `lib/settlements/money.ts`. One batch per store takes every `UNSETTLED` redemption. Commission is `round(gross * percent / 100, 2)`. Payable is gross minus commission. Guest fees stay on the order, not on the batch. Due date is redemption time plus snapshotted days. | Tables are not in Production, so the compute never runs there. Demo redemptions are not excluded on `main` (there is no `demo_only` yet). | Apply `settlements.sql` only after an explicit approval. A later file should exclude `demo_only` vouchers. Do not edit `settlements.sql` in place once it has been applied anywhere. | #28 gate, #29 `demo_only`, P2 |
| Reports for stores and admin | Partial | Admin list and detail, store list. Overview cards include LOLO revenue as guest fees plus commission. | No CSV, no period close, no statement PDF. | No | P3, and the SQL applied |
| Reconciliation | Partial | `settlement_lines` reference one redemption. A partial unique index keeps a redemption on one open line. Cancel of `PENDING` releases the line. `PAID` cannot be cancelled. | No bank statement import and no mismatch queue. | Optional `reconciliation_items` later. Not required to ship the ledger. | P3 |
| Payout infrastructure with no real money movement | Partial | `mark_settlement_paid` stores `paid_at`, `payment_reference`, and `payment_method` (`bank_transfer`, `invoice`, `manual`, `other`). It does not call a bank. | A payout adapter interface that stays on a manual/simulated provider. The word "paid" today means an operator typed a reference. | No new table if the existing columns remain the record. | Decision: who may mark paid |
| Pilot gate | Built-in-open-PR | #28 `lib/settlements/availability.ts`. Unset `SETTLEMENTS_ENABLED` returns 501 and hides nav, pages, and write routes. The flag must stay off until `settlements.sql` is applied. | Keep the flag off in Production. | No | #28 |

## 8. Notifications

| Requirement | Status | Evidence | Missing | DB schema | Depends on |
| --- | --- | --- | --- | --- | --- |
| Modular email / SMS / WhatsApp | Missing | WhatsApp is a hand-built URL (`lib/invite/whatsapp.ts`, thank-you share, create-event success). No provider interface, no sender process. | `NotificationProvider` with `send`, a `name`, and `isSimulated`. | No | — |
| Templates | Missing | Invite text is a function body in `whatsappInviteMessage`. | Template ids and locales stored as data, Hebrew first. | `notification_templates` | — |
| Purchase confirmations and updates | Missing | `orders.wants_confirmation` defaults true. Nothing reads it to send. | Paid, failed, voucher issued, refund. | No extra column on `orders`. | P1 paid/failed events |
| Send log and failures | Missing | — | Append-only log with provider response and error. | `notification_messages` (template, to, status, provider, error, related order id). | — |
| Simulated providers until real ones are connected | Missing | — | A log-only provider used when no vendor env is set, same pattern as `PAYMENT_PROVIDER`. | The log table above. | — |

## 9. Invoices and receipts

| Requirement | Status | Evidence | Missing | DB schema | Depends on |
| --- | --- | --- | --- | --- | --- |
| External-provider adapter | Missing | `settlement_method = invoice` is a label (`lib/admin/store-fields.ts`), not a document. | `DocumentProvider.issue(order | settlement)` returning a provider id. | No | — |
| Simulated documents marked as test | Missing | — | Watermark and a `simulated` flag that cannot be cleared by the client. | `documents.simulated boolean not null` | — |
| History linked to transactions | Missing | The guest checkbox is stored as `wants_confirmation` and is documented as a confirmation request, not a tax invoice (`docs/guest-final-ux.md`). | List of documents per order and per settlement. | `documents (order_id, settlement_id, kind, provider, external_id, simulated)`. | P1, P3 |

## 10. Security and infrastructure

| Requirement | Status | Evidence | Missing | DB schema | Depends on |
| --- | --- | --- | --- | --- | --- |
| Security headers | Missing | `next.config.ts` on `main` has an empty config. `proxy.ts` sets `X-Robots-Tag` on guest and invite paths only. #30 adds the same tag for `/legal` and does not add CSP, HSTS, `X-Frame-Options`, `Referrer-Policy`, or `Permissions-Policy`. | A headers map on every route. | No | Rebase onto #30 before editing `next.config.ts` |
| CI | Missing | No `.github/workflows`. `npm run lint`, `tsc --noEmit`, `verify:*`, and `npm run test:e2e` are local scripts (`package.json`). E2E builds the app and does not need a database. | A workflow that runs those commands. | No | — |
| Rate limits | Partial | In-memory: admin/host/store login (`lib/security/login-limit.ts`), guest reads and payments (`lib/security/guest-limit.ts`), uploads (`docs/upload-rate-limit-proposal.md`). Shared checks call `@vercel/firewall` and **open** when the rule is missing (`lib/security/guest-rate-decision.ts`). Rule ids `lolo-guest-read`, `lolo-guest-write`, `lolo-image-upload` are not created by this repo. Counters reset per instance. | Publish the firewall rules, or a shared counter, before a second instance is the only defense. | The commented `upload_rate_buckets` table is not wired. Prefer the firewall rules already coded. | Someone with Vercel Firewall access |
| `xlsx` 0.18.5 | Partial | Direct dependency `xlsx` `^0.18.5` (`package.json`, `package-lock.json`). Used to parse host guest spreadsheets (`lib/guests/excel.ts`). | The community line stops at 0.18.5, which is the version named in the published prototype-pollution and ReDoS advisories. Replace the parser. Do not point the app at an unpublished npm version. | No | P7, and avoid `package.json` conflicts with #28–#30 |
| Supabase advisor warnings | Partial | This pass did not call the advisor API and did not run SQL. Static review: `set_updated_at`, `stores_set_updated_at`, and `order_item_matches_event` do not pin `search_path`. Voucher and settlement RPCs are `security definer` with `search_path = public` and are revoked from anon. `stores` allows anon SELECT of active rows on purpose. Gift images are publicly readable (`supabase/custom-gifts.sql`). | Triage a real advisor export in a later change. Fix function search paths in a new SQL file. | New SQL file only, not applied here. | Read-only advisor export before editing |
| Permissions and user separation | Partial | Four cookies: host, admin, store, invite, plus the beta cookie. `scripts/verify-session-separation.ts`. Admin is one shared password. Store is one shared code. Host is one code per event. No Supabase Auth users. | Per-person admin and store staff. Server-side session revocation (`session_version`). | `audit_events` does not by itself create users. Staff tables are a product decision. | P5 host identity, P6 store staff |
| Backups and monitoring | Missing | No backup job, no Sentry, no OpenTelemetry, no health route beyond the app itself. | Document who owns Supabase backups (dashboard, not this repo) and add an error sink. | No | — |
| Audit log of sensitive actions | Missing | See admin audit row. | Login success and failure, code rotation, voucher cancel, settlement mark-paid, fee changes, refunds. | `audit_events`. | P7 |
| Legal drafts | Built-in-open-PR | #30. Pages under `app/legal`, copy in `docs/legal/*` and `lib/legal/documents.ts`. Hidden unless `LEGAL_DRAFTS_ENABLED` is `1`, `true`, `yes`, or `on`. Drafts still contain `[להשלמה]` placeholders. | Do not turn the flag on until the placeholders are filled. Not a substitute for an audit log. | No | #30 |
| Isolated test database | Missing | No `supabase/config.toml`, no Docker Compose, no CI service. `.env.example` is one Supabase project. Preview deployments that copy Production env vars share the Production database. | A local database for tests. | Apply the existing SQL files to local Docker only. Never from CI to Production. | P7 proposal below |

### Isolated test database (no purchase)

Previews must not use the Production service role. Automated tests should not use it either.

1. Add the Supabase CLI and a `supabase/config.toml` that starts Postgres in Docker (`supabase start`). That is local only. It does not create a paid project.
2. In GitHub Actions, start that database and apply the SQL files in the README order, skipping `fix-public-read.sql`. Skip `settlements.sql` in the default job until a second job opts in, so CI matches Production. Apply `pilot-demo-voucher-guard.sql` only in the job that tests #29.
3. Point `NEXT_PUBLIC_SUPABASE_URL` and the service role at `127.0.0.1` for that job. Run `verify:*` there. Keep `npm run test:e2e` on the current no-database smoke path.
4. Vercel Preview: remove the Production service role from the Preview environment. Until a second database exists, Preview should fail closed (missing keys show the existing Hebrew setup errors) rather than write to Production. A free second Supabase project is optional and is still a separate database; it is not required for CI. Do not buy a Render or Supabase add-on for this.
5. `demo-seed.sql` may run against the local database. It must not be part of the Production deploy.

## Decisions that must stay configurable

Do not hard-code these. Where a value already exists, keep it in data. Where it does not, add it to `platform_settings` (one row, `id = default`) or to the store row, and snapshot it onto the order, voucher, or redemption at the moment of the action.

| Decision | Where it sits today | How to keep it configurable |
| --- | --- | --- |
| Guest service fee on/off, percent, fixed amount | `platform_settings`, edited at `/admin/settings` | Keep. Snapshot `fee_amount` on the order (already done). |
| Store commission percent | `stores.commission_percent`, copied onto the redemption | Keep the snapshot. Do not treat null as 0% inside a function without an explicit setting. Put the default in `platform_settings`. |
| Settlement payment terms (days) | `stores.payment_terms_days`. Presets `0, 30, 45, 60` are a UI list in `lib/admin/store-fields.ts` | Store the number. Presets can stay a UI hint. Null must not silently mean "due now" unless the setting says so. |
| Settlement method | `stores.settlement_method` enum `bank_transfer`, `invoice`, `manual`, `other` | Extending the enum is a migration, not a code constant scattered in pages. |
| Voucher validity, partial redeem, top-up, redemption method | Store columns, fallback `VOUCHER_TERM_DEFAULTS` in `lib/vouchers/terms.ts` (365 days, partial off, top-up off) | Move the fallback into `platform_settings`. Keep the snapshot columns on `vouchers`. |
| What counts as demo vs real money | #29 `isSimulatedPayment`: empty provider, `demo`, or reference prefix `demo-` | One function, shared by payments, vouchers, and settlement. A new PSP name must be allow-listed, not inferred. |
| `PAYMENT_PROVIDER`, `SETTLEMENTS_ENABLED`, `LEGAL_DRAFTS_ENABLED` | Env flags, default off or demo | Keep the closed default. Do not bake `true` into the client bundle (#30 already reads the legal flag through a computed key). |
| Minimum and maximum contribution | Max 100,000 in `lib/orders/guest-input.ts`. Zero blocked in #29. | Platform setting, snapshotted on the quote. |
| Currency and rounding | Shekel display via `he-IL`; `roundMoney` is half-up to 2 decimals; SQL settlement split is half away from zero | One rounding rule, named in settings, used by both TypeScript and SQL. |
| Refund policy | Absent | Window, full vs partial, who approves, and whether an issued voucher blocks the refund. Store the policy row. Refuse to code a number of days in a route. |
| Guest fee vs store commission vs VAT | Fee is on the guest, commission is on the store, VAT is not modeled | A tax-document adapter must read a rate from settings. Do not invent 17% in the invoice simulator. |
| Who may mark a settlement paid | Any admin who knows `LOLO_ADMIN_PASSWORD` | Keep as an operator action until a payout provider exists. Record it in `audit_events`. |
| Rate limits and session length | `LOGIN_POLICIES`, `GUEST_LIMITS`, host session 12 hours, beta 30 days | Acceptable as code until abuse appears. Document changes in the gap follow-up, do not copy the numbers into SQL. |
| Legal retention, terms, and the pilot "demo only" promise | #30 drafts with `[להשלמה]` markers | Those drafts are not policy. Do not enable `LEGAL_DRAFTS_ENABLED` to make them look final. |
| Host recovery channel (email vs SMS vs WhatsApp) | Written up in `docs/host-phase-2-plan.md`, not built | Choose a provider before building OTP. Do not send the management code itself. |
| Test-store detection | #28 name/slug/notes heuristics in `docs/pilot/test-data-inventory.md` | A real `pilot_isolated` flag, default false, after approval. Do not keep matching on the word "בדיקה" as the long-term rule. |

## Build plan

Seven packages. Each one adds SQL files under `supabase/` and does not run them. Production stays on the current schema until a person applies a file in the SQL editor.

Parallel waves that avoid the same files:

| Wave | Packages | Why they can move together |
| --- | --- | --- |
| A | P4, P7 | New directories. P7 stays out of `proxy.ts`, `next.config.ts`, and `package.json` until the open PRs merge. |
| B | P1 then P2 | Both stack on #29. P2 starts after P1's attempt table and demo classifier exist. |
| C | P3 | Stack on #28. Starts once P2's `demo_only` contract is stable. Does not edit P1 payment routes. |
| D | P5, P6 | After #28–#30 merge, or stacked on the PR they touch. They do not edit `lib/payments` or `lib/notifications`. |

### P1 — Payments core

Demo provider, idempotency, simulated webhook, refund records. No live PSP.

| | |
| --- | --- |
| Files | `lib/payments/**`, `app/api/payments/**`, `lib/orders/repository.ts`, `lib/payments/state.ts`, `scripts/verify-demo-checkout.ts`. New `app/api/payments/webhook/route.ts`. |
| SQL file (not applied) | `supabase/payments-attempts.sql`: `payment_attempts` and `payment_refunds`. Unique `(order_id, idempotency_key)` and unique `(provider, provider_reference)` where the reference is not null. |
| Tests | Extend `scripts/verify-demo-checkout.ts`: replayed confirm, webhook with a bad signature, demo refund that never calls a live URL, two concurrent marks leaving one `paid_at`. |
| Depends on | #29 (0 NIS guards and the demo classifier). Stack this package on #29. |
| Conflicts | #29 already edits `app/api/payments/start/route.ts`, `confirm/route.ts`, and `lib/orders/repository.ts`. Branching P1 from `main` will conflict on those three files. #28 and #30 do not touch them. |

### P2 — Voucher ledger and terms

Partial redemption already exists. This package moves defaults into settings and keeps demo money unspendable.

| | |
| --- | --- |
| Files | `lib/vouchers/**`, `app/api/host/events/[eventId]/vouchers/route.ts`, `app/api/store/redeem/route.ts`, `app/api/admin/vouchers/**`, `scripts/verify-vouchers.ts`. |
| SQL file (not applied) | `supabase/voucher-term-defaults.sql`: fallback columns on `platform_settings` only. Do not replace `issue_gift_voucher` again. `demo_only` stays owned by `supabase/pilot-demo-voucher-guard.sql`. |
| Tests | `scripts/verify-vouchers.ts` plus the #29 script `scripts/verify-pilot-demo.ts`: demo pool cannot redeem; partial redeem still respects the store flag; a changed default does not rewrite an issued voucher. |
| Depends on | P1 classifier and #29. Stack on #29 (or on P1 if P1 is already stacked there). |
| Conflicts | #29 owns `lib/vouchers/repository.ts`, `lib/vouchers/types.ts`, `components/voucher-card.tsx`, and the host issue panel. Do not reimplement `pilot-demo-voucher-guard.sql`. |

### P3 — Settlement, commissions, reports

Reuse `supabase/settlements.sql`. Keep it gated.

| | |
| --- | --- |
| Files | `lib/settlements/**`, `app/admin/settlements/**`, `app/store/settlements/**`, `app/admin/page.tsx`, `scripts/verify-settlements.ts`. |
| SQL file (not applied) | `supabase/settlement-exclude-demo.sql`: `create or replace` of `create_store_settlement` so a `demo_only` redemption cannot enter a batch. Run only after both `settlements.sql` and `pilot-demo-voucher-guard.sql`. No new balance table. |
| Tests | Existing settlement ledger tests, plus a case that a demo redemption stays `UNSETTLED` and out of the batch. No Production connection. |
| Depends on | P2 `demo_only`. #28 gate. Stack on #28, then rebase onto P2's SQL contract (the column name, not the branch, if the branches diverge). |
| Conflicts | #28 edits settlement pages, admin nav, `lib/settlements/repository.ts`, store settlements, and `app/store/redeem/page.tsx`. Branching from `main` conflicts on all of those. #29 does not edit settlement files. |

### P4 — Notifications and invoices

Simulated providers and logs only.

| | |
| --- | --- |
| Files | New `lib/notifications/**`, `lib/invoices/**`, `app/api/notifications/**`. Read `orders.wants_confirmation`. Do not edit guest or host forms. |
| SQL file (not applied) | `supabase/notifications-and-documents.sql`: `notification_templates`, `notification_messages`, `documents`. |
| Tests | New `scripts/verify-notifications.ts`: simulated send writes a row, a thrown provider records `failed`, a document for a demo order is stored with `simulated = true`. |
| Depends on | P1 order status values. Can stub those statuses and land in wave A. |
| Conflicts | Stay out of `app/e/[slug]/details/guest-details-form.tsx` and `app/host/events/[eventId]/host-dashboard.tsx` (both #29 and #30) and out of `components/legal/**` (#30). Branch from `main`. |

### P5 — Host and guest UI completion

Edit event, invitee improvements, greeting persistence, confirmation state on screen. Recovery and "my events" wait on the identity tables and on P4.

| | |
| --- | --- |
| Files | `app/host/**`, `app/create-event/**`, `app/e/**`, `lib/host/**`, `lib/events/repository.ts`, `app/api/host/**`, `app/api/events/**`. |
| SQL file (not applied) | `supabase/host-identity.sql`: `host_identities`, `host_identity_events`, `host_recovery_challenges`, as sketched in `docs/host-phase-2-plan.md`. No backfill. |
| Tests | Existing host e2e (`e2e/host-experience.spec.ts`, `e2e/bold-host-dashboard.spec.ts`) plus a unit test that edit does not mint a new slug and does not delete gifts that have orders. |
| Depends on | P1 for cancel/refund labels. P4 before OTP recovery. #29 and #30 merged, because they edit the host dashboard and the guest details form. |
| Conflicts | Highest overlap with #29 and #30. Do not start this package on those files while those PRs are open. Stack on the later of #29 and #30, or branch from `main` after both merge. |

### P6 — Store and admin UI completion

Store redemption history, admin order list, reports on top of P3. No new payment math.

| | |
| --- | --- |
| Files | `app/store/**`, `app/admin/**` except settlement math already in P3, `app/api/admin/**`, `app/api/store/**`. |
| SQL file (not applied) | None if reports are queries. Optional `supabase/store-staff.sql` only if the product asks for more than one store code. |
| Tests | Extend `scripts/verify-vouchers.ts` for a store-scoped history filter. Admin pages: one Playwright test that an order list renders from a fixture. |
| Depends on | P2 redeem rules, P3 report numbers, #28 for nav that includes settlements. |
| Conflicts | Stack on #28. #28 changes `app/admin/admin-nav.tsx`, `app/admin/page.tsx`, settlement pages, and `app/store/redeem/page.tsx`. #29 changes voucher cards the admin voucher page may import; rebase onto #29 after it merges. |

### P7 — Security, CI, headers, test database

| | |
| --- | --- |
| Files | New `.github/workflows/ci.yml`, new `supabase/config.toml`, `lib/guests/excel.ts` (parser swap), `scripts/` as needed. Headers in `next.config.ts` only after #30 merges. Audit writes from admin and store routes in a second commit so P6 can move first. |
| SQL file (not applied) | `supabase/audit-events.sql`: `audit_events` with RLS on and no anon policies. A separate `supabase/function-search-path.sql` only after an advisor export lists the functions to pin. CI applies files to Docker, not to Production. |
| Tests | Workflow runs `lint`, `tsc --noEmit`, and `verify:*` against local Supabase. Assert the workflow env does not contain the Production host. Header test: response includes the new headers on `/`. |
| Depends on | None for CI and the parser. Headers depend on #30. Audit calls depend on P6 routes existing, so the insert helper can land first and the call sites later. |
| Conflicts | `package.json` / `package-lock.json` are touched by all three open PRs. Land the `xlsx` removal in a rebase after they merge. `proxy.ts` is #28 and #30. `next.config.ts` is #30. `.env.example` and `README.md` are #28 and #30. The new workflow and `supabase/config.toml` conflict with nobody. |

## Conflict notes for this document

This file is the only change. It does not touch #28, #29, or #30. Branch it from `main`. Do not stack it.

When two later packages both need a merged PR, stack the child in GitHub with `base` set to the parent branch so the diff stays small. Merging the parent first, then retargeting the child to `main`, is the alternative. Do not merge any of this work by pushing to `main`; Production auto-deploys from `main`.
