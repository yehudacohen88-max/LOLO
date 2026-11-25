import "server-only";
import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin/session";
import { getSupabaseServiceClient } from "@/lib/supabase/server";
import type { Db } from "@/lib/desk/db";
import { DESK_FORBIDDEN, DeskError } from "@/lib/desk/messages";
import {
  isServiceUnavailable,
  SERVICE_UNAVAILABLE_MESSAGE,
} from "@/lib/security/required-secret";

export function deskDb(db?: Db): Db {
  return db ?? (getSupabaseServiceClient() as unknown as Db);
}

export async function requireAdmin() {
  return getAdminSession();
}

export function forbidden() {
  return NextResponse.json({ error: DESK_FORBIDDEN }, { status: 401 });
}

export function deskError(error: unknown, fallback: string) {
  if (error instanceof DeskError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  if (isServiceUnavailable(error)) {
    return NextResponse.json({ error: SERVICE_UNAVAILABLE_MESSAGE }, { status: 503 });
  }
  if (error instanceof Error && /[\u0590-\u05FF]/.test(error.message)) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  console.error("[LOLO] desk", {
    message: error instanceof Error ? error.message : "unknown",
  });
  return NextResponse.json({ error: fallback }, { status: 400 });
}

export function csvResponse(filename: string, body: string) {
  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
