import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  BETA_ATTEMPT_LIMIT,
  betaAttemptLocked,
  betaCookieOptions,
  betaGateMode,
  betaPasswordMatches,
  createBetaSessionValue,
  nextBetaAttemptValue,
  readBetaAttemptValue,
  readBetaSessionValue,
  safeNextPath,
} from "../lib/beta/gate";

const SECRET = "beta-test-secret";
const PASSWORD = "beta-test-password";

describe("beta access gate", () => {
  it("stays closed when the password is missing and opens only by an explicit setting", () => {
    assert.equal(
      betaGateMode({ enabled: undefined, password: "", secret: SECRET }),
      "misconfigured",
    );
    assert.equal(
      betaGateMode({ enabled: "true", password: PASSWORD, secret: "" }),
      "misconfigured",
    );
    assert.equal(
      betaGateMode({ enabled: "", password: PASSWORD, secret: SECRET }),
      "ready",
    );
    assert.equal(
      betaGateMode({ enabled: "false", password: "", secret: "" }),
      "open",
    );
  });

  it("keeps a WhatsApp event link and rejects an external destination", () => {
    assert.equal(safeNextPath("/e/lolo-demo"), "/e/lolo-demo");
    assert.equal(safeNextPath("/e/lolo-demo?gift=1"), "/e/lolo-demo?gift=1");
    assert.equal(safeNextPath("https://evil.example/e/lolo-demo"), "/");
    assert.equal(safeNextPath("//evil.example"), "/");
    assert.equal(safeNextPath("/\\evil.example"), "/");
  });

  it("accepts the beta password and rejects a wrong one", async () => {
    assert.equal(await betaPasswordMatches(PASSWORD, PASSWORD), true);
    assert.equal(await betaPasswordMatches("wrong-password", PASSWORD), false);
    assert.equal(await betaPasswordMatches("", PASSWORD), false);
  });

  it("rejects a session cookie that was edited or unsigned", async () => {
    const token = await createBetaSessionValue(SECRET, 1_000);
    const session = await readBetaSessionValue(SECRET, token, 1_000);
    assert.equal(session?.typ, "beta");

    assert.equal(await readBetaSessionValue(SECRET, "true", 1_000), null);
    const flipped = `${token.slice(0, -1)}${token.endsWith("a") ? "b" : "a"}`;
    assert.equal(await readBetaSessionValue(SECRET, flipped, 1_000), null);

    const [encoded, signature] = token.split(".");
    const forged = `${encoded}x.${signature}`;
    assert.equal(await readBetaSessionValue(SECRET, forged, 1_000), null);
    assert.equal(await readBetaSessionValue("other-secret", token, 1_000), null);
  });

  it("marks the login cookie httpOnly and lax, and secure only in production", () => {
    const production = betaCookieOptions(60, "production");
    const development = betaCookieOptions(60, "development");
    assert.equal(production.httpOnly, true);
    assert.equal(production.sameSite, "lax");
    assert.equal(production.secure, true);
    assert.equal(development.secure, false);
  });

  it("locks further attempts after repeated failures for the same address", async () => {
    const now = 5_000_000;
    const ip = "203.0.113.8";
    let state = null;
    let token = "";
    for (let attempt = 0; attempt < BETA_ATTEMPT_LIMIT - 1; attempt += 1) {
      const next = await nextBetaAttemptValue(SECRET, state, ip, now);
      state = next.state;
      token = next.token;
      assert.equal(betaAttemptLocked(state, now), false);
    }
    const locked = await nextBetaAttemptValue(SECRET, state, ip, now);
    assert.equal(betaAttemptLocked(locked.state, now), true);
    assert.equal(await readBetaAttemptValue(SECRET, token, "198.51.100.4", now), null);
    assert.equal(await readBetaAttemptValue(SECRET, `${token}x`, ip, now), null);
  });
});
