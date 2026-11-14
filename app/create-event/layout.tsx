import type { ReactNode } from "react";
import styles from "@/app/design/bold-create.module.css";

export default function CreateEventLayout({ children }: { children: ReactNode }) {
  return <div className={styles.stage}>{children}</div>;
}
