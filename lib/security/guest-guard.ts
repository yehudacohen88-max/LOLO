import "server-only";
import { NextResponse } from "next/server";
import { clientIpFromVercelHeaders } from "@/lib/security/client-ip";
import {
  GUEST_EVENT_MISS,
  GUEST_ORDER_MISS,
  type LimitDecision,
} from "@/lib/security/guest-rate-decision";
import { guestLimitResponse } from "@/lib/security/guest-http";
import {
  beginGuestRead,
  noteGuestMiss,
  takeOrderRead,
  takeOrderWrite,
  takePaymentIp,
  takePaymentSlug,
  takeQuote,
} from "@/lib/security/guest-limit";
import { consumeGuestSharedLimit } from "@/lib/security/guest-shared-limit";

function headerStore(request: Request) {
  return {
    get(name: string) {
      return request.headers.get(name);
    },
  };
}

export function guestClientIp(request: Request) {
  return clientIpFromVercelHeaders(headerStore(request));
}

async function enforce(local: LimitDecision, shared: Promise<LimitDecision>) {
  const blocked = guestLimitResponse(local);
  if (blocked) {
    return blocked;
  }
  return guestLimitResponse(await shared);
}

export function guardGuestRead(request: Request) {
  const ip = guestClientIp(request);
  return enforce(
    beginGuestRead(ip),
    consumeGuestSharedLimit({ request, ip, scope: "read" }),
  );
}

export function guardOrderRead(request: Request) {
  const ip = guestClientIp(request);
  return enforce(
    takeOrderRead(ip),
    consumeGuestSharedLimit({ request, ip, scope: "read" }),
  );
}

export function guardOrderWriteLocal(request: Request, slug: string) {
  return guestLimitResponse(takeOrderWrite(guestClientIp(request), slug));
}

export function guardQuoteLocal(request: Request, slug: string) {
  return guestLimitResponse(takeQuote(guestClientIp(request), slug));
}

export function guardPaymentIp(request: Request) {
  return guestLimitResponse(takePaymentIp(guestClientIp(request)));
}

export async function guardSharedWrite(request: Request, eventId: string) {
  return guestLimitResponse(
    await consumeGuestSharedLimit({
      request,
      ip: guestClientIp(request),
      scope: "write",
      eventId,
    }),
  );
}

export function guardPaymentSlug(request: Request, slug: string, eventId: string) {
  const ip = guestClientIp(request);
  return enforce(
    takePaymentSlug(slug),
    consumeGuestSharedLimit({ request, ip, scope: "write", eventId }),
  );
}

export function rememberGuestMiss(request: Request) {
  noteGuestMiss(guestClientIp(request));
}

export function guestEventMissResponse() {
  return NextResponse.json(GUEST_EVENT_MISS, { status: 404 });
}

export function guestOrderMissResponse() {
  return NextResponse.json(GUEST_ORDER_MISS, { status: 404 });
}
