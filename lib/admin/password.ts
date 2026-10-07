import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";

export function adminPasswordMatches(input: string) {
  const expected = process.env.LOLO_ADMIN_PASSWORD?.trim() ?? "";
  if (!expected || !input || input.length > 200) {
    return false;
  }

  const given = createHash("sha256").update(input).digest();
  const good = createHash("sha256").update(expected).digest();
  return timingSafeEqual(given, good);
}
