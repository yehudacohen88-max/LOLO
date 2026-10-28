# Guest final UX

The live guest flow (`/e/[slug]` through thank-you) uses one warm system: Heebo, deep green, cream, white cards, and coral only for progress and the current step. Order math, demo payment, the beta gate, host screens, admin, and `/i` links are unchanged.

## Audit

The five screens already shared `flagship.module.css`, but they still read as separate drafts:

- Gift selection stacked a wide cover, a venue sheet, a product scene with its own shadow, and a second progress block. An empty photo was a giant letter.
- Greeting and details were long forms. On a phone the event cover, a second thumbnail, and several title lines pushed the first field far down the page.
- Payment put the heading and the summary in different grid rows, so the side card opened a large gap above the summary. On a wide screen the side column also lost its card.
- Thank-you repeated the step row, and the success mark sat on top of the product thumbnail.
- The step row itself was a set of oversized dots, dark checks on dark circles, underlined labels, and arrow characters.

## Design system

`app/e/[slug]/guest-system.module.css` is composed only by the guest shell. Host screens do not import it.

| Token | Value | Use |
| --- | --- | --- |
| `--gx-ink` | `#172F2B` | Text and primary buttons |
| `--gx-muted` | `#3E524C` | Secondary text |
| `--gx-cream` | `#F7F4EF` | Page background, full viewport |
| `--gx-coral` | `#E07A6A` | Progress, current step, success mark |
| `--gx-line` | `rgba(23, 47, 43, 0.12)` | Card edge |
| `--gx-radius` | `20px` | Cards |
| `--gx-shadow` | `0 12px 28px -22px rgba(23, 47, 43, 0.55)` | Cards only |
| `--gx-max` | `1080px` | Desktop content |
| `--gx-form` | `640px` | Form column |

Type is Heebo at 400, 500, and 700. Amount chips and the primary button stay at least 44px; the primary button is 64px tall. Errors are green and bold beside the field. `prefers-reduced-motion` turns animation off.

Shared pieces:

- **Step row.** One horizontal line, RTL, first step on the right. Each step is a 20px circle and a 13–14px label. Completed: dark green circle, white check, label not underlined until hover or focus, and a link back to the saved step. Current: coral circle, white number, bold label, `aria-current="step"`. Future: 1.5px outline, muted number and label. Connectors are 20px lines; under 360px they hide so the row stays on one line. Each item is labeled `שלב X מתוך 4`. Thank-you does not show the row.
- **Continuity.** From 1024px up, greeting and details keep a side card: centered 16:9 cover, gift thumb, event title, and `נאספו … מתוך …`. Below 1024px that card is a single row under the heading: a 56px rounded gift thumb (the event photo when the gift has no image), the title on one line with an ellipsis, and `מכונת אספרסו פרימיום · 350 ₪`.
- **Cards.** White, 20px radius, the shared shadow. A product image sits inside its card. The gift-page summary is plain rows inside the sticky card, with the join button and the demo line under those rows.

## Screens

1. **Gift.** Real cover when the host uploaded one, centered and capped on desktop. An empty cover is a short mark, not a letter. The main gift is one white card: image, name, progress, percent inline after `מתוך`, and the amount picker. Extra gifts stay compact. The sticky summary lists the choice as plain rows. The short demo line remains once.
2. **Greeting.** Title `מוסיפים ברכה אישית`. Suggestions still fill the textarea and stay editable. The field is shorter. `בלי ברכה` continues without text. A missing gift still cannot continue. Desktop side card stays; phones use the compact row.
3. **Details.** Title `למי נגיד תודה?`. Name, phone, and email stay required. The confirmation checkbox starts checked, matching the saved default. Errors use `aria-invalid` and `aria-describedby`. Phone is `type="tel"`. Below 1024px the compact row already shows the gift and amount, so that line is not repeated above the fields. Desktop still shows it.
4. **Payment.** Title `כמעט סיימנו`. The main column is one stack: step row, heading, summary, confirm, and the failure link. The side card is its own column, aligned to the top: 72px thumbnail, gift, event, `מאת {host}`, the greeting, and `נאספו … מתוך …`. The disclosure is exactly `תשלום הדגמה בלבד — לא מתבצע חיוב אמיתי`.
5. **Thank-you.** Title `איזה כיף, השתתפת במתנה!`. A 48px coral check sits above the heading. The 72px thumbnail sits in the card. Status still comes from the server, including `שולם בהדגמה`. WhatsApp is the main share. The payment reference sits under `פרטי הדגמה`.

## Confirmation checkbox

The control is `אני רוצה לקבל אישור על המתנה`. It is optional. It is not a terms consent. A new guest starts with it checked: `emptyDetails.wantReceipt` is `true`, and a saved draft treats a missing value as checked. Submit stores it as `wantsConfirmation` on the pending order.

## Files

- `app/e/[slug]/guest-system.module.css` — tokens
- `app/e/[slug]/flagship.module.css` — guest layout
- `app/e/[slug]/flagship-ui.tsx` — cover, gift scene, empty photo
- `app/e/[slug]/flow-page.tsx` — step row, compact row, column split
- `app/e/[slug]/guest-event-view.tsx` — gift card and summary
- `app/e/[slug]/greeting/greeting-form.tsx`, `greeting/page.tsx`
- `app/e/[slug]/details/guest-details-form.tsx`, `details/page.tsx`
- `app/e/[slug]/payment/payment-summary.tsx`, `payment/page.tsx`
- `app/e/[slug]/thank-you/thank-you-view.tsx`, `thank-you/page.tsx`
- `app/e/[slug]/continuity.ts`, `layout.tsx`
- `e2e/guest-premium-layout.spec.ts`, `e2e/flagship-flow.spec.ts`, `e2e/flagship-guest.spec.ts`, `e2e/empty-cover.ts`

## Photo-less events

A missing cover is not a panel. The page starts with a 40px bow, then the date, the title, and the invite line. A missing gift photo is an 80px glyph beside the name (56px under 430px), and the description uses the full card width. Titles use `text-wrap: balance`, and a display formatter keeps the dash on the same line as the word before it. Progress fills from the right at every width. The sticky summary uses `top: 24px` and does not stretch with the gift column.

On main, guest details are written to the browser draft only when the form is submitted. This branch also writes name, phone, email, and the checkbox on each change, using the same `saveGuestDetails` storage, so the stepper can return to what was typed. «בלי ברכה» is shown only while the textarea is empty.

Greeting and details share one side card. The event title is the small line at the top, then each gift with its thumbnail and the amount on the left edge, then «נאספו … מתוך …», then a divider and «סה״כ». On a phone, payment shows only «סיכום התשלום». On a wide screen the payment side card keeps the gift and the collected line, and «סה״כ לחיוב» stays in the summary. The native share button is labeled «שיתוף בדרך אחרת». Each amount stays with its ₪. Future step numbers are 13px in `#5B6B66`. The custom amount row uses one focus ring. A gift title beside a glyph uses the remaining width. Suggestion chips are one full-width column. The «המשאלה» shortcut appears only when there are three or more gifts. A custom amount field opens only for «סכום אחר». The collected figure is labeled «נאספו». On a phone the gift page has a 16px gutter and the summary is a white card; at 768 the column is centered at about 640px.

## Tests

- `npx tsc --noEmit`: passed
- `npx eslint` on the touched guest files: passed
- `npx next build`: passed
- Final `npx playwright test e2e`: 57 passed, 0 failed

## Follow-ups that are not this UI

- Demo checkout still does not charge a card. A live provider is a separate change.
- A host focal point still overrides the centered cover crop. The default stays `50% 50%`.
- Beta access, host and admin screens, personal invite links, and contribution math stay on their own tracks.
- A pass on a physical phone is still worth doing after this preview. The Playwright shots cover 320, 390, 768, and 1440.
