"use client";

import { useLayoutEffect, type ReactNode } from "react";
import { setActiveUploadGrant } from "@/lib/images/active-upload-grant";

export default function UploadGrantProvider({
  token,
  children,
}: {
  token: string;
  children: ReactNode;
}) {
  useLayoutEffect(() => {
    setActiveUploadGrant(token);
    return () => {
      setActiveUploadGrant("");
    };
  }, [token]);

  return children;
}
