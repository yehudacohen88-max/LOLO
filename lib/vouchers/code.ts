import "server-only";
import { randomBytes } from "node:crypto";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function randomCodeChars(length: number) {
  const chars: string[] = [];
  const bytes = randomBytes(length);
  for (let index = 0; index < length; index += 1) {
    chars.push(ALPHABET[bytes[index] % ALPHABET.length]);
  }
  return chars.join("");
}

export function generateVoucherCode() {
  const raw = randomCodeChars(16);
  return `${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 12)}-${raw.slice(12)}`;
}

export function generateVoucherSecret() {
  return randomBytes(32).toString("base64url");
}

export function voucherQrPayload(code: string, qrSecret: string) {
  const compact = code.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  return `LOLO1.${compact}.${qrSecret}`;
}

export function parseVoucherLookup(raw: string) {
  const trimmed = raw.trim();
  if (trimmed.startsWith("LOLO1.")) {
    const rest = trimmed.slice("LOLO1.".length);
    const splitAt = rest.indexOf(".");
    if (splitAt > 0) {
      const secret = rest.slice(splitAt + 1).trim();
      return {
        code: rest.slice(0, splitAt),
        qrSecret: secret || null,
      };
    }
  }
  return { code: trimmed, qrSecret: null as string | null };
}
