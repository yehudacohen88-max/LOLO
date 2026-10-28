# Guest final UX

One visual language for the live guest flow. Business rules, payments, the beta gate, and the host UI are unchanged.

## Audit

The five screens already shared `flagship.module.css`, but the result still read as a decorated preview:

- Gift selection stacked a wide cover, a gold-ring venue sheet, a gift scene, a second gift card, and a long beta paragraph. Empty events used a giant letter and a repeated gift-box drawing as if they were the product.
- Greeting and details were office forms. The greeting title did not say what to do, the textarea was 240px, and the demo sentence was repeated from the event page.
- Payment put a large reveal above the summary, then the exact demo sentence, then the longer beta paragraph, then a disabled-looking confirm button while the quote loaded.
- Thank-you repeated the gift scene, the demo banner, the beta paragraph, and a technical reference in the main column.
- Desktop layouts capped columns and left empty cream. Mobile type and cards were inconsistent from screen to screen.
- Shared cause: one CSS module with gold rings, gradients, and per-screen scene rules, plus copy that was not the same voice.

Direction kept: Heebo, deep green `#172F2B`, cream `#F7F4EF`, coral only on progress and a small festive mark, white cards, 20px radii, one soft shadow. Gold frames and background gradients are removed. The old blue/red MVP is not restored.

## Design system

`app/e/[slug]/guest-system.module.css` is composed only by the guest `.root`. Host screens do not import it.

| Token | Value | Use |
| --- | --- | --- |
| `--gx-ink` | `#172F2B` | Text and primary buttons |
| `--gx-muted` | `#3E524C` | Secondary text |
| `--gx-cream` | `#F7F4EF` | Page background |
| `--gx-coral` | `#E07A6A` | Progress and a small accent |
| `--gx-line` | `rgba(23, 47, 43, 0.12)` | Card edge |
| `--gx-radius` | `20px` | Cards |
| `--gx-shadow` | soft, low | Cards only |
| `--gx-max` | `1080px` | Desktop content |
| `--gx-form` | `640px` | Form column |

Type is Heebo at 400, 500, and 700. Headings stay on the existing `.flowTitle` scale. Amount chips and the primary button stay at least 44px, the primary button 64px. Errors are green and bold beside the field. `prefers-reduced-motion` turns animation off.

## Screens

1. Gift. Real cover when the host uploaded one. An empty cover is a short mark, not a hero letter. Amounts, progress, and the join button stay. The short demo line remains once. The long beta paragraph is not repeated here.
2. Greeting. Title «מוסיפים ברכה אישית». Suggestions still fill the textarea and stay editable. The field is shorter. «בלי ברכה» continues without text. A missing gift still cannot continue.
3. Details. Title «למי נגיד תודה?». Name, phone, and email stay required. The confirmation checkbox exists and starts unchecked until a draft was saved. Errors use `aria-invalid` and `aria-describedby`. Phone is `type="tel"`.
4. Payment. Title «כמעט סיימנו». The exact sentence «תשלום הדגמה בלבד — לא מתבצע חיוב אמיתי» is the disclosure. Quote, start, and confirm are unchanged.
5. Thank-you. Title «איזה כיף, השתתפת במתנה!». Status still comes from the server, including «שולם בהדגמה». WhatsApp is the main share. The payment reference sits under «פרטי הדגמה».

The step row is «מתנה ← ברכה ← פרטים ← תשלום». Completed steps are links back to saved drafts. Thank-you is the success state.

## Confirmation checkbox

The control is «אני רוצה לקבל אישור על המתנה». It is optional. It is not a terms consent. On main, a new guest starts with it checked: `emptyDetails.wantReceipt` is `true`, and a saved draft treats a missing value as checked (`wantReceipt !== false`). Submit stores it as `wantsConfirmation` on the pending order. This pass keeps that default. An earlier draft of this branch had turned it off for unsaved guests; that would have changed what a guest stores if they never touch the box, so it was put back.

## Second pass

Corner ribbons no longer sit on the event photo or the gift image. A missing photo is a cream tile with a small gift icon. Payment and thank-you show «תשלום הדגמה בלבד — לא מתבצע חיוב אמיתי» once; the long beta paragraph is a short line inside «עוד על ההדגמה». Thank-you is a centered card, about 560px wide inside a 960px column. The gift page at desktop is a header plus a gift column and a sticky summary. The venue card sits under the cover, and the cover uses `object-position: center top` unless the host set a focal point.

## Fourth pass

The guest shell and the page behind it are cream for the full viewport. The step row sits above the heading in the main column, with a coral dot on the current step, a check on completed steps, and muted future steps. The desktop cover is centered (`50% 50%`) and capped at 300px. Thank-you shows one amount and one disclosure. Payment lists each gift once, then the fee line and the total. The side card on greeting and details puts the title and «נאספו … מתוך …» under the image.

## Tests

- `npx tsc --noEmit`: passed
- `npx eslint` on the touched guest files: passed
- `npx next build`: passed
- Final `npx playwright test e2e`: 56 passed, 0 failed

One run in this pass was 54 passed / 2 failed. The demo thank-you keeps «כבר 18 חברים הצטרפו» inside «פרטי הדגמה», so the test opens that disclosure before asserting it.

## Third pass

The cover default is `50% 35%` unless the host set a focal point. On desktop the hero is capped at 360px and the venue card sits beside the title. A gift with no photo is at most 160px on the main card and an 88px square on extra cards. The duplicate progress line under the join button is gone. Payment and thank-you use a light notice. Thank-you is one 560px column, and its screenshot is the paid demo state.

Guest screens no longer paint gradient blobs behind the product photo. The create-event empty cover still uses its own ribbon background, because that screen is not the guest flow.

## Tests

- `npx tsc --noEmit`: passed
- `npx eslint` on the touched guest files: passed
- `npx next build`: passed
- Final `npx playwright test e2e`: 56 passed, 0 failed

One run in this pass was 55 passed / 1 failed. The thank-you screenshot assertion used `getByText("350")`, which matched three amount lines. It now uses the first match. The paid status was already on screen.
