const FORBIDDEN_PARTS = [
  "password",
  "passwd",
  "secret",
  "token",
  "cookie",
  "session",
  "authorization",
  "apikey",
  "credential",
  "privatekey",
  "servicerole",
  "accesscode",
  "redemptioncode",
  "hostcode",
  "codehash",
  "invitetoken",
  "anonkey",
  "bearer",
];

const FORBIDDEN_EXACT = new Set(["code", "otp", "pin", "hash", "pwd"]);

const REDACTED = "[redacted]";
const MAX_DEPTH = 4;
const MAX_KEYS = 40;
const MAX_ARRAY = 20;
const MAX_STRING = 200;
const MAX_JSON = 4000;

const JWT = /^eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;

export function isForbiddenAuditKey(key: string) {
  const normalized = key.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (FORBIDDEN_EXACT.has(normalized)) {
    return true;
  }
  return FORBIDDEN_PARTS.some((part) => normalized.includes(part));
}

function secretEnvValues() {
  const values: string[] = [];
  for (const [name, value] of Object.entries(process.env)) {
    if (!value || value.length < 8) {
      continue;
    }
    if (/(SECRET|PASSWORD|TOKEN|SERVICE_ROLE|ANON_KEY|API_KEY)/i.test(name)) {
      values.push(value);
    }
  }
  return values;
}

export function redactAuditString(value: string, secrets = secretEnvValues()) {
  const compact = value.trim();
  if (
    compact.toLowerCase().includes("fafvveudrlovaozazkny") ||
    /pbkdf2\$/i.test(compact) ||
    JWT.test(compact) ||
    /^bearer\s+\S+/i.test(compact) ||
    secrets.some((secret) => secret === compact || value.includes(secret))
  ) {
    return REDACTED;
  }
  if (value.length > MAX_STRING) {
    return `${value.slice(0, MAX_STRING)}…`;
  }
  return value;
}

function scrub(value: unknown, depth: number, secrets: string[]): unknown {
  if (value === null) {
    return null;
  }
  if (typeof value === "string") {
    return redactAuditString(value, secrets);
  }
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (depth >= MAX_DEPTH) {
    return null;
  }
  if (Array.isArray(value)) {
    return value.slice(0, MAX_ARRAY).map((item) => scrub(item, depth + 1, secrets));
  }
  if (typeof value === "object") {
    const output: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value).slice(0, MAX_KEYS)) {
      if (isForbiddenAuditKey(key)) {
        continue;
      }
      output[key] = scrub(item, depth + 1, secrets);
    }
    return output;
  }
  return null;
}

export function redactAuditMetadata(input: unknown) {
  const secrets = secretEnvValues();
  const scrubbed = scrub(input, 0, secrets);
  if (!scrubbed || typeof scrubbed !== "object" || Array.isArray(scrubbed)) {
    return {};
  }
  const metadata = scrubbed as Record<string, unknown>;
  if (JSON.stringify(metadata).length > MAX_JSON) {
    return { truncated: true };
  }
  return metadata;
}
