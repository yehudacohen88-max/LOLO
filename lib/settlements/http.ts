import "server-only";
import { NextResponse } from "next/server";
import {
  SETTLEMENTS_PILOT_MESSAGE,
  SettlementPilotDisabledError,
  settlementsEnabled,
} from "@/lib/settlements/availability";
import {
  SettlementActionError,
  SettlementSchemaMissingError,
} from "@/lib/settlements/messages";
import {
  isServiceUnavailable,
  SERVICE_UNAVAILABLE_MESSAGE,
} from "@/lib/security/required-secret";

export function settlementPilotUnavailable() {
  if (settlementsEnabled()) {
    return null;
  }
  return NextResponse.json({ error: SETTLEMENTS_PILOT_MESSAGE }, { status: 501 });
}

export function jsonFromSettlementError(error: unknown, fallback: string) {
  if (error instanceof SettlementPilotDisabledError) {
    return NextResponse.json({ error: error.message }, { status: 501 });
  }
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

export function settlementCsvResponse(filename: string, body: string) {
  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
