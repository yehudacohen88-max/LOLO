export type StoredSessionVersion = number | "legacy" | "missing";

export function hostSessionVersionMatches(
  session: { sv?: number },
  stored: StoredSessionVersion,
) {
  if (stored === "legacy") {
    return session.sv == null;
  }
  if (stored === "missing") {
    return false;
  }
  return session.sv === stored;
}
