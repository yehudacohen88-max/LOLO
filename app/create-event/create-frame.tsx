import type { ReactNode } from "react";
import Link from "next/link";
import LoloMark from "@/app/design/lolo-mark";
import styles from "@/app/design/host-experience.module.css";
import CreateSummary from "./create-summary";
import { createStepLabel } from "./steps";

type CreateFrameProps = {
  step?: number;
  title?: string;
  lede?: string;
  children: ReactNode;
};

export default function CreateFrame({ step, title, lede, children }: CreateFrameProps) {
  return (
    <div className={step ? styles.spread : undefined}>
      <main className={styles.main}>
        <header className={styles.header}>
          <Link href="/" className={styles.wordmark}>
            <LoloMark />
          </Link>
          {step ? <p className={styles.step}>{createStepLabel(step)}</p> : null}
          {title ? <h1 className={styles.title}>{title}</h1> : null}
          {lede ? <p className={styles.lede}>{lede}</p> : null}
        </header>
        {children}
      </main>
      {step ? <CreateSummary step={step} /> : null}
    </div>
  );
}
