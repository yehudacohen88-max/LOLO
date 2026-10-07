import "server-only";
import { NextResponse } from "next/server";
import {
  isServiceUnavailable,
  SERVICE_UNAVAILABLE_MESSAGE,
} from "@/lib/security/required-secret";
import {
  VoucherActionError,
  VoucherSchemaMissingError,
} from "@/lib/vouchers/messages";

export function jsonFromError(error: unknown, fallback: string) {
  if (error instanceof VoucherSchemaMissingError) {
    return NextResponse.json({ error: error.message }, { status: 503 });
  }
  if (error instanceof VoucherActionError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  if (isServiceUnavailable(error)) {
    return NextResponse.json({ error: SERVICE_UNAVAILABLE_MESSAGE }, { status: 503 });
  }
  if (error instanceof Error && /[\u0590-\u05FF]/.test(error.message)) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  console.error("[LOLO] voucher route", {
    message: error instanceof Error ? error.message : "unknown",
  });
  return NextResponse.json({ error: fallback }, { status: 400 });
}
