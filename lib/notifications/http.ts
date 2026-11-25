import { NextResponse } from "next/server";
import { DocumentConfigError } from "@/lib/invoices/settings";
import {
  isServiceUnavailable,
  SERVICE_UNAVAILABLE_MESSAGE,
} from "@/lib/security/required-secret";
import { NotificationNotFoundError } from "./hooks";
import { NotificationSchemaMissingError } from "./schema-error";

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuid(value: string) {
  return UUID.test(value);
}

export function parseListLimit(raw: string | null) {
  if (!raw) {
    return 50;
  }
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 1) {
    return 50;
  }
  return Math.min(parsed, 100);
}

export function jsonAdminError(error: unknown, fallback: string) {
  if (error instanceof NotificationNotFoundError) {
    return NextResponse.json({ error: error.message }, { status: 404 });
  }
  if (error instanceof NotificationSchemaMissingError || error instanceof DocumentConfigError) {
    return NextResponse.json({ error: error.message }, { status: 503 });
  }
  if (isServiceUnavailable(error)) {
    return NextResponse.json({ error: SERVICE_UNAVAILABLE_MESSAGE }, { status: 503 });
  }
  console.error("[LOLO] admin notification route", {
    message: error instanceof Error ? error.message : "unknown",
  });
  return NextResponse.json({ error: fallback }, { status: 400 });
}
