import type { ReactNode } from "react";
import { headers } from "next/headers";
import { connection } from "next/server";
import styles from "@/app/design/bold-create.module.css";
import { createImageUploadGrant } from "@/lib/images/upload-grant";
import { clientIpFromVercelHeaders } from "@/lib/security/client-ip";
import UploadGrantProvider from "./upload-grant-provider";

export default async function CreateEventLayout({ children }: { children: ReactNode }) {
  await connection();
  const headerStore = await headers();
  const uploadGrant = createImageUploadGrant(clientIpFromVercelHeaders(headerStore)) ?? "";
  return (
    <UploadGrantProvider token={uploadGrant}>
      <div className={styles.stage}>{children}</div>
    </UploadGrantProvider>
  );
}
