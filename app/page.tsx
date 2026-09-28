import HomeCreateActions from "./home-create-actions";

const steps = [
  { number: "1", title: "יוצרים אירוע" },
  { number: "2", title: "בוחרים מתנות" },
  { number: "3", title: "משתפים את האורחים" },
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
            יוצרים אירוע, בוחרים מתנות ומאפשרים לאורחים להשתתף בדרך פשוטה
            ונעימה.
          </p>

          <HomeCreateActions />
        </section>

        <section className="mt-14 sm:mt-20" aria-label="איך זה עובד">
          <ol className="grid gap-3 sm:grid-cols-3 sm:gap-4">
            {steps.map((step) => (
              <li
                key={step.number}
                className="flex items-center gap-4 rounded-2xl border border-border bg-white px-4 py-4 sm:flex-col sm:items-center sm:px-5 sm:py-6 sm:text-center"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-soft text-sm font-bold text-brand">
                  {step.number}
                </span>
                <span className="text-sm font-semibold text-foreground sm:text-base">
                  {step.title}
                </span>
              </li>
            ))}
          </ol>
        </section>
      </main>
    </div>
  );
}
