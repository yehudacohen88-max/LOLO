import type { ReactNode } from "react";
import styles from "./bold-host.module.css";

export default function BoldHostFrame({ children }: { children: ReactNode }) {
  return (
    <div className={styles.stage} data-bold-host="">
      {children}
    </div>
  );
}
