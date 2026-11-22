import type { ReactNode } from "react";
import { connection } from "next/server";
import styles from "@/app/design/bold-create.module.css";
import { createImageUploadGrant } from "@/lib/images/upload-grant";
import UploadGrantProvider from "./upload-grant-provider";

export default async function CreateEventLayout({ children }: { children: ReactNode }) {
  await connection();
  const uploadGrant = createImageUploadGrant() ?? "";
  return (
    <UploadGrantProvider token={uploadGrant}>
      <div className={styles.stage}>{children}</div>
    </UploadGrantProvider>
  );
}
