import "server-only";
import { randomBytes } from "node:crypto";
import { normalizeEventSlug, slugifyTitle } from "./slug";

/** 32 chars, so a byte modulo the alphabet has no bias. Omits 0/o/1/l. */
export const SLUG_SUFFIX_ALPHABET = "abcdefghijkmnopqrstuvwxyz23456789";
export const SLUG_SUFFIX_LENGTH = 10;

export function randomSuffix() {
  const bytes = randomBytes(SLUG_SUFFIX_LENGTH);
  let suffix = "";
  for (let index = 0; index < SLUG_SUFFIX_LENGTH; index += 1) {
    suffix += SLUG_SUFFIX_ALPHABET[bytes[index]! % SLUG_SUFFIX_ALPHABET.length];
  }
  return suffix;
}

export function createUniqueSlug(title: string, existing: string[]) {
  const taken = new Set(existing.map(normalizeEventSlug));
  let slug = `${slugifyTitle(title)}-${randomSuffix()}`;

  while (taken.has(slug)) {
    slug = `${slugifyTitle(title)}-${randomSuffix()}`;
  }

  return slug;
}
