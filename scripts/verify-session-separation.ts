import assert from "node:assert/strict";
import {
  createCipheriv,
  createHash,
  createHmac,
  randomBytes,
} from "node:crypto";
import { beforeEach, describe, it } from "node:test";
import { createAdminSessionToken, readAdminSessionToken } from "../lib/admin/session";
import { createHostSessionToken, readHostSessionToken } from "../lib/host/session";
import { createInviteSessionToken, readInviteSessionToken } from "../lib/invite/session";
import {
  decryptInviteToken,
  encryptInviteToken,
  hashInviteToken,
} from "../lib/invite/token";
import {
  clearLoginFailures,
  LOGIN_POLICIES,
  loginAttemptAllowed,
  recordLoginFailure,
  resetLoginLimits,
} from "../lib/security/login-limit";
import { signScopedPayload } from "../lib/security/hmac";
import {
  resetMissingEnvWarnings,
  SERVICE_UNAVAILABLE_MESSAGE,
} from "../lib/security/required-secret";

const HOST_SECRET = "host-session-secret-for-tests";
const INVITE_SECRET = "invite-token-secret-for-tests";
const ADMIN_SECRET = "admin-session-secret-for-tests";
const SERVICE_ROLE = "service-role-must-not-sign-or-encrypt";

function useSecrets(values: {
  host?: string;
  invite?: string;
  admin?: string;
  serviceRole?: string;
}) {
  process.env.HOST_SESSION_SECRET = values.host ?? HOST_SECRET;
  process.env.INVITE_TOKEN_SECRET = values.invite ?? INVITE_SECRET;
  process.env.ADMIN_SESSION_SECRET = values.admin ?? ADMIN_SECRET;
  process.env.SUPABASE_SERVICE_ROLE_KEY = values.serviceRole ?? SERVICE_ROLE;
}

function dropSecret(name: "HOST_SESSION_SECRET" | "INVITE_TOKEN_SECRET" | "ADMIN_SESSION_SECRET") {
  delete process.env[name];
}

function legacyToken(payload: object, secret: string, prefix = "") {
  const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const signature = createHmac("sha256", secret)
    .update(`${prefix}${encoded}`)
    .digest("base64url");
  return `${encoded}.${signature}`;
}

function seal(secret: string, token: string) {
  const key = createHash("sha256").update(secret, "utf8").digest();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64url")}.${tag.toString("base64url")}.${encrypted.toString("base64url")}`;
}

describe("session token separation", () => {
  beforeEach(() => {
    useSecrets({});
    resetMissingEnvWarnings();
  });

  it("rejects a guest invite cookie used as a host or admin session", () => {
    const invite = createInviteSessionToken({
      eventId: "event-1",
      guestId: "guest-1",
      name: "נועה",
      phone: "0500000000",
    });

    assert.equal(readHostSessionToken(invite), null);
    assert.equal(readAdminSessionToken(invite), null);
    assert.equal(readInviteSessionToken(invite)?.guestId, "guest-1");
    assert.equal(readInviteSessionToken(invite)?.eventId, "event-1");
  });

  it("rejects host and admin cookies used as each other or as an invite", () => {
    const host = createHostSessionToken("event-1");
    const admin = createAdminSessionToken();

    assert.equal(readHostSessionToken(host)?.eventId, "event-1");
    assert.equal(readInviteSessionToken(host), null);
    assert.equal(readAdminSessionToken(host), null);
    assert.ok(readAdminSessionToken(admin));
    assert.equal(readHostSessionToken(admin), null);
    assert.equal(readInviteSessionToken(admin), null);
  });

  it("keeps types separated even when every secret is the same string", () => {
    const shared = "same-secret-for-every-role";
    useSecrets({ host: shared, invite: shared, admin: shared });

    const invite = createInviteSessionToken({
      eventId: "event-1",
      guestId: "guest-1",
      name: "נועה",
      phone: "0500000000",
    });
    const host = createHostSessionToken("event-1");
    const admin = createAdminSessionToken();

    assert.equal(readHostSessionToken(invite), null);
    assert.equal(readAdminSessionToken(invite), null);
    assert.equal(readInviteSessionToken(host), null);
    assert.equal(readAdminSessionToken(host), null);
    assert.equal(readHostSessionToken(admin), null);
    assert.equal(readInviteSessionToken(admin), null);
  });

  it("rejects legacy untyped cookies, including ones signed with the service role", () => {
    const future = Date.now() + 60_000;
    const hostLegacy = legacyToken(
      { eventId: "event-1", exp: future },
      HOST_SECRET,
    );
    const inviteLegacy = legacyToken(
      {
        eventId: "event-1",
        guestId: "guest-1",
        name: "נועה",
        phone: "0500000000",
        exp: future,
      },
      SERVICE_ROLE,
    );
    const adminLegacy = legacyToken(
      { role: "admin", exp: future },
      SERVICE_ROLE,
      "admin:",
    );

    assert.equal(readHostSessionToken(hostLegacy), null);
    assert.equal(readHostSessionToken(inviteLegacy), null);
    assert.equal(readInviteSessionToken(inviteLegacy), null);
    assert.equal(readAdminSessionToken(adminLegacy), null);
    assert.equal(readHostSessionToken(adminLegacy), null);
  });

  it("rejects a host-prefixed token whose payload type is not host", () => {
    const encoded = Buffer.from(
      JSON.stringify({
        typ: "invite",
        eventId: "event-1",
        guestId: "guest-1",
        name: "נועה",
        phone: "0500000000",
        exp: Date.now() + 60_000,
      }),
      "utf8",
    ).toString("base64url");
    const forged = `${encoded}.${signScopedPayload("HOST_SESSION_SECRET", "host", encoded)}`;
    assert.equal(readHostSessionToken(forged), null);
  });

  it("does not fall back to the service role key when a session secret is missing", () => {
    useSecrets({});
    dropSecret("HOST_SESSION_SECRET");
    const logs: string[] = [];
    const original = console.error;
    console.error = (...args: unknown[]) => {
      logs.push(args.map((part) => String(part)).join(" "));
    };

    try {
      assert.throws(
        () => createHostSessionToken("event-1"),
        (error: unknown) => {
          assert.ok(error instanceof Error);
          assert.equal(error.message, SERVICE_UNAVAILABLE_MESSAGE);
          assert.equal(error.message.includes(SERVICE_ROLE), false);
          assert.equal(error.message.includes("HOST_SESSION_SECRET"), false);
          assert.equal(error.message.includes("Supabase"), false);
          return true;
        },
      );
    } finally {
      console.error = original;
    }

    assert.match(logs.join("\n"), /HOST_SESSION_SECRET/);
    assert.equal(logs.join("\n").includes(SERVICE_ROLE), false);
    assert.equal(readHostSessionToken("not-a-token"), null);
  });
});

describe("invite token encryption", () => {
  beforeEach(() => {
    useSecrets({});
    resetMissingEnvWarnings();
  });

  it("keeps invite link hashes unkeyed sha256", () => {
    const token = "already-sent-invite-token";
    assert.equal(
      hashInviteToken(token),
      createHash("sha256").update(token, "utf8").digest("base64url"),
    );
  });

  it("decrypts current and host-secret legacy ciphertext, and not the service role", () => {
    const fresh = encryptInviteToken("fresh-token");
    assert.equal(decryptInviteToken(fresh), "fresh-token");
    assert.equal(decryptInviteToken(seal(HOST_SECRET, "legacy-token")), "legacy-token");
    assert.equal(decryptInviteToken(seal(SERVICE_ROLE, "service-role-token")), null);
  });

  it("fails closed instead of decrypting with the service role key", () => {
    dropSecret("INVITE_TOKEN_SECRET");
    dropSecret("HOST_SESSION_SECRET");
    const original = console.error;
    console.error = () => {};
    try {
      assert.throws(
        () => decryptInviteToken(seal(SERVICE_ROLE, "service-role-token")),
        (error: unknown) => {
          assert.ok(error instanceof Error);
          assert.equal(error.message, SERVICE_UNAVAILABLE_MESSAGE);
          assert.equal(error.message.includes(SERVICE_ROLE), false);
          return true;
        },
      );
    } finally {
      console.error = original;
    }
  });
});

describe("login rate limit", () => {
  beforeEach(() => {
    resetLoginLimits();
  });

  it("locks an admin IP after the configured failures and then releases it", () => {
    const start = 1_700_000_000_000;
    const { perIp, lockMs } = LOGIN_POLICIES.admin;
    for (let attempt = 0; attempt < perIp; attempt += 1) {
      assert.equal(loginAttemptAllowed("admin", "203.0.113.4", start), true);
      recordLoginFailure("admin", "203.0.113.4", start);
    }
    assert.equal(loginAttemptAllowed("admin", "203.0.113.4", start + 1), false);
    assert.equal(loginAttemptAllowed("admin", "203.0.113.9", start + 1), true);
    assert.equal(
      loginAttemptAllowed("admin", "203.0.113.4", start + lockMs + 1),
      true,
    );
  });

  it("locks admin login globally without locking a host IP", () => {
    const start = 1_700_000_000_000;
    const globalLimit = LOGIN_POLICIES.admin.global ?? 0;
    for (let index = 0; index < globalLimit; index += 1) {
      recordLoginFailure("admin", `198.51.100.${index}`, start);
    }
    assert.equal(loginAttemptAllowed("admin", "203.0.113.50", start + 1), false);
    assert.equal(loginAttemptAllowed("host", "203.0.113.50", start + 1), true);
  });

  it("locks only the host IP that failed, and a success clear reopens it", () => {
    const { perIp } = LOGIN_POLICIES.host;
    for (let attempt = 0; attempt < perIp; attempt += 1) {
      recordLoginFailure("host", "192.0.2.10");
    }
    assert.equal(loginAttemptAllowed("host", "192.0.2.10"), false);
    assert.equal(loginAttemptAllowed("host", "192.0.2.11"), true);
    clearLoginFailures("host", "192.0.2.10");
    assert.equal(loginAttemptAllowed("host", "192.0.2.10"), true);
  });
});
