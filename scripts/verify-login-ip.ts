import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { clientIpFromHeaders } from "../lib/beta/gate";
import {
  LOGIN_POLICIES,
  clientIpFromRequest,
  loginAttemptAllowed,
  recordLoginFailure,
  resetLoginLimits,
} from "../lib/security/login-limit";

function request(headers: Record<string, string>) {
  return new Request("http://local.test/api/host/login", { headers });
}

describe("login client IP", () => {
  beforeEach(() => {
    resetLoginLimits();
  });

  it("uses x-vercel-forwarded-for, then x-real-ip, and ignores x-forwarded-for", () => {
    assert.equal(
      clientIpFromRequest(
        request({
          "x-forwarded-for": "1.2.3.4, 203.0.113.10",
          "x-real-ip": "203.0.113.50",
        }),
      ),
      "203.0.113.50",
    );
    assert.equal(
      clientIpFromRequest(
        request({
          "x-forwarded-for": "1.2.3.4",
          "x-vercel-forwarded-for": "198.51.100.8, 10.0.0.1",
          "x-real-ip": "203.0.113.50",
        }),
      ),
      "198.51.100.8",
    );
    assert.equal(clientIpFromRequest(request({ "x-forwarded-for": "1.2.3.4" })), "unknown");
    assert.equal(
      clientIpFromHeaders({
        get(name: string) {
          return name === "x-forwarded-for" ? "9.9.9.9" : null;
        },
      }),
      "unknown",
    );
    assert.equal(
      clientIpFromHeaders({
        get(name: string) {
          if (name === "x-real-ip") return "203.0.113.77";
          if (name === "x-forwarded-for") return "1.1.1.1";
          return null;
        },
      }),
      "203.0.113.77",
    );
  });

  it("does not let a spoofed x-forwarded-for reset host, store, or admin login counters", () => {
    const now = 1_700_000_000_000;
    const real = "203.0.113.10";
    const seen = () =>
      clientIpFromRequest(
        request({
          "x-real-ip": real,
          "x-forwarded-for": `198.51.100.${Math.floor(Math.random() * 200)}`,
        }),
      );

    for (let index = 0; index < LOGIN_POLICIES.host.perIp; index += 1) {
      const ip = seen();
      assert.equal(ip, real);
      recordLoginFailure("host", ip, now);
    }
    assert.equal(loginAttemptAllowed("host", seen(), now), false);
    assert.equal(loginAttemptAllowed("host", "198.51.100.20", now), true);

    for (let index = 0; index < LOGIN_POLICIES.store.perIp; index += 1) {
      recordLoginFailure(
        "store",
        clientIpFromRequest(
          request({
            "x-vercel-forwarded-for": "192.0.2.40",
            "x-forwarded-for": `10.0.0.${index}`,
          }),
        ),
        now,
      );
    }
    assert.equal(
      loginAttemptAllowed(
        "store",
        clientIpFromRequest(
          request({
            "x-vercel-forwarded-for": "192.0.2.40",
            "x-forwarded-for": "1.1.1.1",
          }),
        ),
        now,
      ),
      false,
    );

    for (let index = 0; index < LOGIN_POLICIES.admin.perIp; index += 1) {
      recordLoginFailure(
        "admin",
        clientIpFromRequest(request({ "x-forwarded-for": `8.8.8.${index}` })),
        now,
      );
    }
    assert.equal(
      loginAttemptAllowed("admin", clientIpFromRequest(request({ "x-forwarded-for": "9.9.9.9" })), now),
      false,
    );
  });
});
