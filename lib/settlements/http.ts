import "server-only";
import { NextResponse } from "next/server";
import {
  SettlementActionError,
  SettlementSchemaMissingError,
} from "@/lib/settlements/messages";
import {
  isServiceUnavailable,
  SERVICE_UNAVAILABLE_MESSAGE,
} from "@/lib/security/required-secret";

export function jsonFromSettlementError(error: unknown, fallback: string) {
  if (error instanceof SettlementSchemaMissingError) {
    return NextResponse.json({ error: error.message }, { status: 503 });
  }
  if (error instanceof SettlementActionError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  if (isServiceUnavailable(error)) {
    return NextResponse.json({ error: SERVICE_UNAVAILABLE_MESSAGE }, { status: 503 });
  }
  if (error instanceof Error && /[\u0590-\u05FF]/.test(error.message)) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  console.error("[LOLO] settlement route", {
    message: error instanceof Error ? error.message : "unknown",
  });
  return NextResponse.json({ error: fallback }, { status: 400 });
}
