# Simulation settings and deferred commercial decisions

Nothing in this file is set on the hosted project `fafvveudrlovaozazkny`, on Vercel Production, or on Vercel Preview. Preview uses that same project, so these values are for the local Docker database and the pull-request CI job only.

The closed beta gate stays closed. Do not set `BETA_ACCESS_ENABLED=false`.

## A. Needed only to exercise the system in simulation

These values make the local app and the CI job walk the demo paths. They are not commercial terms.

| Name | Where | Suggested local / CI value | What it does |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | process env, not committed | `http://127.0.0.1:54321` from `node scripts/local-db.mjs export-env` | Loopback API only. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | process env, not committed | the local demo anon key printed by `export-env` | Local anon key. It is not the Production key. |
| `SUPABASE_SERVICE_ROLE_KEY` | process env, not committed | the local demo service key printed by `export-env` | Local service role. It is not the Production key. |
| `HOST_SESSION_SECRET` | CI env | `ci-host-session-secret` | Signs host cookies in CI. Not a Production secret. |
| `INVITE_TOKEN_SECRET` | CI env | `ci-invite-token-secret` | Signs invite tokens in CI. |
| `ADMIN_SESSION_SECRET` | CI env | `ci-admin-session-secret` | Signs admin cookies in CI. |
| `STORE_SESSION_SECRET` | CI env | `ci-store-session-secret` | Signs store cookies in CI. |
| `LOLO_ADMIN_PASSWORD` | CI env | `ci-admin-password` | Admin login password inside CI. |
| `BETA_ACCESS_SECRET` | CI env | `ci-beta-access-secret` | Cookie signing material. The gate stays closed because `BETA_ACCESS_ENABLED` is unset. |
| `IMAGE_UPLOAD_SECRET` | CI env | `ci-image-upload-secret` | Upload-grant HMAC in CI. |
| `PAYMENT_PROVIDER` | CI env | `demo` | Demo checkout. Any other name throws `PAYMENTS_LIVE_NOT_ENABLED` and does not call a network. |
| `PAYMENT_WEBHOOK_SECRET` | CI env | `ci-webhook-secret` | HMAC for the simulated webhook. Unset rejects every webhook. This is not a live provider secret. |
| `LOLO_LOCAL_DB` | test process | `1` | Lets the database tests run, and is required before a test may insert `fixture` into the local allow-list. |
| `SETTLEMENTS_ENABLED` | unset, except inside one test | unset | Screens and APIs stay off. The integration test sets `true` only while it calls `create_store_settlement`, then restores the previous value. |
| `LEGAL_DRAFTS_ENABLED` | unset | unset | Draft privacy and terms pages stay hidden. |
| `NOTIFICATION_PROVIDER`, `NOTIFICATION_EMAIL_PROVIDER`, `NOTIFICATION_SMS_PROVIDER`, `NOTIFICATION_WHATSAPP_PROVIDER` | unset | unset | Empty or `simulated` uses the simulated channel. Any other name is refused and the dispatcher does not call `send`. |
| `payment_provider_allowlist` | local table | empty | No provider counts as real money. The integration test inserts `fixture` for the monetary redeem cases and deletes that row before the test ends. |
| `platform_settings.money_rounding` | local row, test only | `half_away_from_zero` during the settlement test, then restored | A null rounding refuses the batch. The test sets it only on the loopback row. |
| `platform_settings.refund_*` | local row, test only | window 14, approver `admin`, partial true, blocks-issued false, then restored | Lets the refund test run. Production columns stay null until a policy is chosen. |
| Document VAT arguments | function arguments in the test, not a settings write | 18 percent, VAT not included, kind `receipt`, currency `ILS` | Passed into `issueOrderDocument` for one simulated document. Not written to `platform_settings`. |

`guest_fee_enabled` is already false in `demo-checkout.sql`, with percent and fixed amount 0. Leave that row as the file created it.

## B. Commercial decisions that can wait

These columns and store fields exist so a later decision can be stored. They ship null, or false for the guest fee switch. Do not fill them in for the pilot, and do not fill them on Production from this branch.

| Decision | Where it will live | Current behavior while unset |
| --- | --- | --- |
| Guest service fee | `platform_settings.guest_fee_enabled`, `guest_fee_percent`, `guest_fee_fixed` | Fee switch is false. Percent and fixed amount are 0. |
| Refund window, who may refund, partial refunds, whether an issued voucher blocks a refund | `refund_window_days`, `refund_approver`, `refund_allow_partial`, `refund_blocks_issued_voucher` | Null. The app does not invent a window. |
| Default store commission | `default_commission_percent`, and `stores.commission_percent` | Null. A settlement batch is refused instead of using 0. |
| Default payment terms | `default_payment_terms_days`, and `stores.payment_terms_days` | Null. The batch is refused. |
| Money rounding | `money_rounding` | Null. The batch is refused unless the value is `half_away_from_zero`. |
| VAT rate, whether prices include VAT, default document kind, document currency | `vat_rate_percent`, `vat_included`, `default_document_kind`, `document_currency` | Null. Issuing a document requires the caller to pass settings, and the provider must be the simulated one. The body is watermarked `מסמך בדיקה – אינו מסמך חשבונאי`. |
| Notification channel list | `notification_channels` | Null. Dispatch still only runs a simulated or refused provider. |
| Voucher validity, partial redemption, customer top-up, redemption method | `voucher_default_*` and the matching columns on `stores` | Null. Issue requires an explicit term snapshot. The file does not default validity to 365. |
| Settlement method | `stores.settlement_method` | Null. Not a payment instruction to a bank. |
| Which live PSP is real money | `payment_provider_allowlist` and `REAL_PROVIDER_ALLOWLIST` | Both empty. `demo` and `none` cannot become real. |

Choosing a commission, a refund policy, a VAT rate, or a voucher validity period is a product decision. The simulation in section A does not make those choices.
