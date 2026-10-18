import BrandMark from "@/components/brand-mark";
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
      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col px-6 py-8 sm:max-w-3xl sm:px-10 lg:max-w-6xl lg:px-12 lg:py-16 xl:max-w-7xl">
        <section className="lg:grid lg:grid-cols-[minmax(0,1.15fr)_minmax(18rem,0.85fr)] lg:items-center lg:gap-16">
          <div className="flex flex-col items-center text-center lg:items-start lg:text-start">
            <BrandMark />
            <p className="lolo-kicker mt-8">ביחד, אנחנו מגשימים משאלה</p>
            <h1 className="lolo-title mt-3 max-w-xl">המתנה שבאמת רצית</h1>
            <p className="mt-4 max-w-md text-base leading-relaxed text-muted sm:text-lg">
              חברים ומשפחה נפגשים סביב מתנה אחת. כל אחד נותן את החלק שלו, והמשאלה
              מתגשמת.
            </p>
            <div className="lolo-celebration mt-6 lg:hidden" aria-hidden>
              <span className="cele-base" />
              <span className="cele-lid" />
              <span className="cele-bow" />
            </div>
            <HomeCreateActions />
          </div>
          <div className="lolo-celebration-stage mt-0 hidden place-items-center overflow-hidden lg:grid" aria-hidden>
            <div className="lolo-celebration origin-center scale-150">
              <span className="cele-base" />
              <span className="cele-lid" />
              <span className="cele-bow" />
            </div>
          </div>
        </section>

        <section className="mt-14 sm:mt-20" aria-label="איך זה עובד">
          <h2 className="text-center text-2xl font-medium text-foreground">איך זה עובד</h2>
          <p className="mx-auto mt-3 max-w-lg text-center text-sm leading-relaxed text-muted">
            LOLO היא הדרך לתת מתנה אמיתית לאירוע. המארח בוחר מתנות מחנויות
            שותפות, האורחים משתתפים בסכום שמתאים להם, והכסף הופך לשובר למימוש
            בחנות.
          </p>
          <p className="mx-auto mt-2 max-w-lg text-center text-sm leading-relaxed text-muted">
            היעד של המתנה הוא יעד, לא תקרה. אפשר לעבור את 100%, והמארח מנפיק
            שובר על מה ששולם.
          </p>
          <ol className="mt-6 grid gap-3 sm:grid-cols-3 sm:gap-4">
            {steps.map((step) => (
              <li key={step.number} className="lolo-card flex items-start gap-4 px-4 py-4 sm:flex-col sm:items-center sm:px-5 sm:py-6 sm:text-center">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-soft text-sm font-bold text-brand">
                  {step.number}
                </span>
                <span>
                  <span className="block font-sans text-sm font-semibold text-foreground sm:text-base">
                    {step.title}
                  </span>
                  <span className="mt-1 block font-sans text-sm leading-relaxed text-muted">
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