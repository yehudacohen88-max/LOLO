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

## Tests

From `/workspace` after `npm ci`:

- `npx eslint` on the touched guest components: passed (the new CSS module is ignored by the eslint config)
- `npx tsc --noEmit`: passed
- `npx next build`: passed
- `npx playwright test e2e`: 53 passed, then 1 failed (`screenshot 320 without_images`, the shortened empty cover overlapped the bow). After removing that shrink, `npx playwright test e2e/flagship-guest.spec.ts e2e/flagship-flow.spec.ts e2e/guest-premium-layout.spec.ts` passed 26, and a later check of the empty-cover and layout widths passed 11. The host, smoke, beta, create-event, and guest-access specs had already passed in the full run and were not changed again.

Imageless extra gifts no longer show the large parcel drawing (`.extra .scene.sceneEmpty`). The primary empty cover still keeps the letter clear of the small bow, which the regression test requires. After that last CSS change, the empty-cover screenshots and the seven layout widths passed (11 tests). Host, smoke, beta, create-event, and guest-access had passed in the earlier full run and do not use that rule.
