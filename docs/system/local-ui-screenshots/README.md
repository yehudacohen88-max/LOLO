# Local UI screenshots

Captured by `e2e/local/ui-smoke.spec.ts` against `npm run dev:local` (loopback Supabase only).

Each screen is saved twice: `*-desktop.png` at 1280×900 and `*-mobile.png` at 390×844. The suite writes the files. It does not compare pixels, so a CI run can regenerate them without failing on a diff.

The pages use the demo seed. Visible Hebrew copy includes `נתונים לדוגמה` where the seed or the local label file set it. No production data is in these images.

| File prefix | Screen |
| --- | --- |
| `home` | Marketing home, with the security headers checked on `/` |
| `host-create`, `host-create-success` | Host wizard and the one-time management code |
| `guest-event`, `guest-greeting`, `guest-details`, `guest-payment`, `guest-thank-you` | Guest path through demo checkout; thank-you shows the server status |
| `host-dashboard`, `host-my-events`, `host-recovery`, `host-recovery-code` | Host edit, identity list, simulated recovery |
| `admin-home`, `admin-stores`, `admin-events`, `admin-orders`, `admin-guests`, `admin-audit`, `admin-settlements`, `admin-notifications` | Admin lists, settlement, audit, notification log, simulated documents |
| `store-redeem`, `store-demo-refused`, `store-history` | Store desk; demo voucher has no redeem button |
