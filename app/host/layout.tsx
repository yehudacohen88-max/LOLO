import type { ReactNode } from "react";
import BoldHostFrame from "@/app/design/bold-host-frame";

export default function HostLayout({ children }: { children: ReactNode }) {
  return <BoldHostFrame>{children}</BoldHostFrame>;
}
