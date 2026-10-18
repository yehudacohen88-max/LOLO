import type { ReactNode } from "react";
import FlagshipFrame from "@/app/design/flagship-frame";

export default function CreateEventLayout({ children }: { children: ReactNode }) {
  return <FlagshipFrame>{children}</FlagshipFrame>;
}
