import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import {
  caughtErrorBody,
  isServiceUnavailable,
  resetMissingEnvWarnings,
  serviceUnavailableMessage,
} from "../lib/security/required-secret";
import {
  PREVIEW_DISCONNECTED_MESSAGE,
  PRODUCTION_PROJECT_REF,
  assertPreviewDatabaseAllowed,
  normalizeSupabaseUrl,
  previewAllowsDatabaseUrl,
  supabaseUrlLooksLikeProduction,
} from "../lib/supabase/preview-guard";
import { getSupabaseServiceClient } from "../lib/supabase/server";

const PRODUCTION_URL = `https://${PRODUCTION_PROJECT_REF}.supabase.co`;
const STAGING_URL = "https://lolo-preview-example.supabase.co";
const SERVICE_KEY = "test-service-role-key";

const keys = [
  "VERCEL_ENV",
  "LOLO_ALLOW_PREVIEW_DB_URL",
  "NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
] as const;

const original: Record<string, string | undefined> = {};
for (const key of keys) {
  original[key] = process.env[key];
}

function setEnv(values: Partial<Record<(typeof keys)[number], string | undefined>>) {
  for (const key of keys) {
    const value = key in values ? values[key] : original[key];
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}

afterEach(() => {
  setEnv({});
  resetMissingEnvWarnings();
});

describe("preview database guard", () => {
  it("normalizes trailing slashes and /rest/v1", () => {
    assert.equal(
      normalizeSupabaseUrl(` ${STAGING_URL}/rest/v1/ `),
      STAGING_URL,
    );
  });

  it("recognizes the Production project ref in a URL", () => {
    assert.equal(supabaseUrlLooksLikeProduction(PRODUCTION_URL + "/"), true);
    assert.equal(supabaseUrlLooksLikeProduction(STAGING_URL), false);
  });

  it("does not block local or Production Vercel environments", () => {
    setEnv({ VERCEL_ENV: undefined, LOLO_ALLOW_PREVIEW_DB_URL: undefined });
    assert.equal(previewAllowsDatabaseUrl(PRODUCTION_URL), true);

    setEnv({ VERCEL_ENV: "production" });
    assert.equal(previewAllowsDatabaseUrl(PRODUCTION_URL), true);
  });

  it("refuses Preview when no allow-list is set", () => {
    setEnv({ VERCEL_ENV: "preview", LOLO_ALLOW_PREVIEW_DB_URL: undefined });
    assert.equal(previewAllowsDatabaseUrl(PRODUCTION_URL), false);
    assert.equal(previewAllowsDatabaseUrl(STAGING_URL), false);
    assert.throws(() => assertPreviewDatabaseAllowed(STAGING_URL), {
      name: "PreviewDisconnectedError",
      message: PREVIEW_DISCONNECTED_MESSAGE,
    });
  });

  it("refuses Preview even if the Production URL is allow-listed", () => {
    setEnv({
      VERCEL_ENV: "preview",
      LOLO_ALLOW_PREVIEW_DB_URL: PRODUCTION_URL,
    });
    assert.equal(previewAllowsDatabaseUrl(PRODUCTION_URL), false);
    assert.throws(() => assertPreviewDatabaseAllowed(PRODUCTION_URL + "/rest/v1"), {
      name: "PreviewDisconnectedError",
      message: PREVIEW_DISCONNECTED_MESSAGE,
    });
  });

  it("allows Preview only when the URL matches a non-Production allow-list", () => {
    setEnv({
      VERCEL_ENV: "preview",
      LOLO_ALLOW_PREVIEW_DB_URL: STAGING_URL + "/",
    });
    assert.equal(previewAllowsDatabaseUrl(STAGING_URL + "/rest/v1"), true);
    assert.equal(previewAllowsDatabaseUrl("https://other-project.supabase.co"), false);
    assert.doesNotThrow(() => assertPreviewDatabaseAllowed(STAGING_URL));
  });

  it("surfaces the Preview message on write-route helpers", () => {
    setEnv({ VERCEL_ENV: "preview" });
    try {
      assertPreviewDatabaseAllowed(PRODUCTION_URL);
      assert.fail("expected Preview to be refused");
    } catch (error) {
      assert.equal(isServiceUnavailable(error), true);
      assert.equal(serviceUnavailableMessage(error), PREVIEW_DISCONNECTED_MESSAGE);
      assert.deepEqual(caughtErrorBody(error, "שמירת האירוע נכשלה."), {
        error: PREVIEW_DISCONNECTED_MESSAGE,
        status: 503,
      });
    }
  });

  it("uses the Preview message when Preview has no database env vars", () => {
    setEnv({
      VERCEL_ENV: "preview",
      NEXT_PUBLIC_SUPABASE_URL: undefined,
      SUPABASE_SERVICE_ROLE_KEY: undefined,
      LOLO_ALLOW_PREVIEW_DB_URL: undefined,
    });
    assert.throws(() => getSupabaseServiceClient(), {
      name: "PreviewDisconnectedError",
      message: PREVIEW_DISCONNECTED_MESSAGE,
    });
  });

  it("refuses to construct the service-role client on Preview against Production", () => {
    setEnv({
      VERCEL_ENV: "preview",
      NEXT_PUBLIC_SUPABASE_URL: PRODUCTION_URL,
      SUPABASE_SERVICE_ROLE_KEY: SERVICE_KEY,
      LOLO_ALLOW_PREVIEW_DB_URL: undefined,
    });
    assert.throws(() => getSupabaseServiceClient(), {
      name: "PreviewDisconnectedError",
      message: PREVIEW_DISCONNECTED_MESSAGE,
    });
  });

  it("creates the service-role client on Preview only for an allow-listed non-Production URL", () => {
    setEnv({
      VERCEL_ENV: "preview",
      NEXT_PUBLIC_SUPABASE_URL: STAGING_URL,
      SUPABASE_SERVICE_ROLE_KEY: SERVICE_KEY,
      LOLO_ALLOW_PREVIEW_DB_URL: STAGING_URL,
    });
    const client = getSupabaseServiceClient();
    assert.equal(typeof client.from, "function");
  });

  it("still creates the service-role client in Production", () => {
    setEnv({
      VERCEL_ENV: "production",
      NEXT_PUBLIC_SUPABASE_URL: PRODUCTION_URL,
      SUPABASE_SERVICE_ROLE_KEY: SERVICE_KEY,
      LOLO_ALLOW_PREVIEW_DB_URL: undefined,
    });
    const client = getSupabaseServiceClient();
    assert.equal(typeof client.from, "function");
  });
});
