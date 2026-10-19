import type { ReactNode } from "react";
import FlagshipFrame from "@/app/design/flagship-frame";

export default function BetaLayout({ children }: { children: ReactNode }) {
  return <FlagshipFrame>{children}</FlagshipFrame>;
}
