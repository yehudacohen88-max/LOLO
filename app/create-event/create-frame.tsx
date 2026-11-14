import type { ReactNode } from "react";
import Link from "next/link";
import LoloMark from "@/app/design/lolo-mark";
import styles from "@/app/design/bold-create.module.css";
import CreateSummary from "./create-summary";
import { CREATE_STEPS, createStepLabel } from "./steps";

type CreateFrameProps = {
  step?: number;
  title?: string;
  lede?: string;
  children: ReactNode;
};

export default function CreateFrame({ step, title, lede, children }: CreateFrameProps) {
  return (
    <div className={step ? styles.spread : styles.single}>
      <main className={styles.main}>
        <header className={styles.header}>
          <Link href="/" className={styles.wordmark}>
            <LoloMark />
          </Link>
          {step ? <p className={styles.step}>{createStepLabel(step)}</p> : null}
          {step ? (
            <ol className={styles.steps} aria-label="שלבי יצירת האירוע">
              {CREATE_STEPS.map((item) => {
                const state =
                  item.step === step ? styles.stepsOn : item.step < step ? styles.stepsDone : "";
                const mark = (
                  <>
                    <span className={styles.dot}>{item.step < step ? "✓" : item.step}</span>
                    {item.label}
                  </>
                );
                return (
                  <li key={item.step} className={state}>
                    {item.step < step ? (
                      <Link
                        href={item.href}
                        className={styles.stepLink}
                        aria-label={`${createStepLabel(item.step)}: ${item.label}`}
                      >
                        {mark}
                      </Link>
                    ) : (
                      <span
                        className={item.step === step ? styles.stepLink : styles.stepFuture}
                        aria-current={item.step === step ? "step" : undefined}
                      >
                        {mark}
                      </span>
                    )}
                  </li>
                );
              })}
            </ol>
          ) : null}
          {title ? <h1 className={styles.title}>{title}</h1> : null}
          {lede ? <p className={styles.lede}>{lede}</p> : null}
        </header>
        {step ? (
          <div className={styles.mobileCard}>
            <CreateSummary compact />
          </div>
        ) : null}
        <div className={styles.sheet}>{children}</div>
      </main>
      {step ? (
        <aside className={styles.summary} aria-label="סיכום האירוע">
          <CreateSummary />
        </aside>
      ) : null}
    </div>
  );
}
