import { NextResponse } from "next/server";
import {
  GUEST_LIMIT_MESSAGE,
  type LimitDecision,
} from "@/lib/security/guest-limit";

export function guestLimitResponse(decision: LimitDecision) {
  if (decision.ok) {
    return null;
  }
  return NextResponse.json(
    { error: GUEST_LIMIT_MESSAGE },
    {
      status: 429,
      headers: { "Retry-After": String(decision.retryAfterSeconds) },
    },
  );
}

export async function readLimitedJson(request: Request, maxBytes: number) {
  const declared = request.headers.get("content-length");
  if (declared) {
    const length = Number(declared);
    if (!Number.isFinite(length) || length < 0 || length > maxBytes) {
      return { ok: false as const, status: 413 as const, error: "הבקשה גדולה מדי." };
    }
  }

  let text = "";
  try {
    text = await request.text();
  } catch {
    return { ok: false as const, status: 400 as const, error: "הבקשה אינה תקינה." };
  }
  if (text.length > maxBytes) {
    return { ok: false as const, status: 413 as const, error: "הבקשה גדולה מדי." };
  }

  try {
    return {
      ok: true as const,
      value: (text ? JSON.parse(text) : {}) as unknown,
    };
  } catch {
    return { ok: false as const, status: 400 as const, error: "הבקשה אינה תקינה." };
  }
}
