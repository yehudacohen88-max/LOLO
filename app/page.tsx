import HomeCreateActions from "./home-create-actions";

const steps = [
  {
    number: "1",
    title: "יוצרים אירוע",
    body: "בוחרים מתנות, יעד וחנות.",
  },
  {
    number: "2",
    title: "האורחים משתתפים",
    body: "כל אורח נכנס מקישור אישי, בוחר סכום ומשאיר ברכה.",
  },
  {
    number: "3",
    title: "מממשים בחנות",
    body: "המארח מציג שובר, והחנות מממשת אותו.",
  },
];

export default function Home() {
  return (
    <div className="flex flex-1 flex-col">
      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col px-5 py-10 sm:max-w-2xl sm:px-8 sm:py-16 lg:max-w-3xl">
        <section className="flex flex-col items-center text-center">
          <p className="text-4xl font-extrabold tracking-[0.28em] text-brand sm:text-5xl">
            LOLO
          </p>

          <h1 className="mt-8 text-3xl font-bold leading-tight tracking-tight text-foreground sm:text-5xl">
            המתנה שבאמת רצית
          </h1>

          <p className="mt-4 max-w-md text-base leading-relaxed text-muted sm:mt-5 sm:text-lg">
            LOLO היא הדרך לתת מתנה אמיתית לאירוע. המארח בוחר מתנות מחנויות
            שותפות, האורחים משתתפים בסכום שמתאים להם, והכסף הופך לשובר למימוש
            בחנות.
          </p>
          <p className="mt-3 max-w-md text-sm leading-relaxed text-muted">
            היעד של המתנה הוא יעד, לא תקרה. אפשר לעבור את 100%, והמארח מנפיק
            שובר על מה ששולם.
          </p>

          <HomeCreateActions />
        </section>

        <section className="mt-14 sm:mt-20" aria-label="איך זה עובד">
          <h2 className="text-center text-lg font-bold text-foreground">איך זה עובד</h2>
          <ol className="mt-4 grid gap-3 sm:grid-cols-3 sm:gap-4">
            {steps.map((step) => (
              <li
                key={step.number}
                className="flex items-start gap-4 rounded-2xl border border-border bg-white px-4 py-4 sm:flex-col sm:items-center sm:px-5 sm:py-6 sm:text-center"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-soft text-sm font-bold text-brand">
                  {step.number}
                </span>
                <span>
                  <span className="block text-sm font-semibold text-foreground sm:text-base">
                    {step.title}
                  </span>
                  <span className="mt-1 block text-sm leading-relaxed text-muted">
                    {step.body}
                  </span>
                </span>
              </li>
            ))}
          </ol>
        </section>
      </main>
    </div>
  );
}
