import type { ReactNode } from "react";
import Link from "next/link";
import styles from "@/app/design/host-experience.module.css";
import { createStepLabel } from "./steps";

type CreateFrameProps = {
  step?: number;
  title?: string;
  lede?: string;
  children: ReactNode;
};

export default function CreateFrame({ step, title, lede, children }: CreateFrameProps) {
  return (
    <main className={styles.main}>
      <header className={styles.header}>
        <Link href="/" className={styles.wordmark}>
          LOLO
        </Link>
        {step ? <p className={styles.step}>{createStepLabel(step)}</p> : null}
        {title ? <h1 className={styles.title}>{title}</h1> : null}
        {lede ? <p className={styles.lede}>{lede}</p> : null}
      </header>
      {children}
    </main>
  );
}
