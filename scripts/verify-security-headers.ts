import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { PRODUCTION_SUPABASE_REF } from "./local-db-order.mjs";
import {
  localDatabaseUiAllowed,
  PRODUCTION_PROJECT_REF,
  supabaseUrlIsLoopback,
} from "../lib/supabase/loopback-guard";

const root = path.resolve(import.meta.dirname, "..");

describe("response headers", () => {
  const source = fs.readFileSync(path.join(root, "next.config.ts"), "utf8");

  it("sets frame, content-type, referrer, and camera policy on every route", () => {
    assert.match(source, /X-Frame-Options", value: "DENY"/);
    assert.match(source, /X-Content-Type-Options", value: "nosniff"/);
    assert.match(source, /Referrer-Policy", value: "strict-origin-when-cross-origin"/);
    assert.match(source, /camera=\(self\)/);
    assert.match(source, /source: "\/"/);
    assert.match(source, /source: "\/:path\*"/);
    assert.doesNotMatch(source, /Strict-Transport-Security/);
    assert.doesNotMatch(source, /Content-Security-Policy/);
  });
});

describe("local UI guard", () => {
  it("matches the Production project ref used by the database scripts", () => {
    assert.equal(PRODUCTION_PROJECT_REF, PRODUCTION_SUPABASE_REF);
  });

  it("accepts only a loopback Supabase URL when the local flag is on", () => {
    assert.equal(supabaseUrlIsLoopback("http://127.0.0.1:54321"), true);
    assert.equal(supabaseUrlIsLoopback("http://localhost:54321"), true);
    assert.equal(supabaseUrlIsLoopback(`https://${PRODUCTION_PROJECT_REF}.supabase.co`), false);
    assert.equal(supabaseUrlIsLoopback("https://example.supabase.co"), false);
    assert.equal(supabaseUrlIsLoopback(""), false);

    const previous = {
      flag: process.env.LOLO_LOCAL_DB,
      url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    };
    try {
      delete process.env.LOLO_LOCAL_DB;
      process.env.NEXT_PUBLIC_SUPABASE_URL = "http://127.0.0.1:54321";
      assert.equal(localDatabaseUiAllowed(), false);
      process.env.LOLO_LOCAL_DB = "1";
      process.env.NEXT_PUBLIC_SUPABASE_URL = `https://${PRODUCTION_PROJECT_REF}.supabase.co`;
      assert.equal(localDatabaseUiAllowed(), false);
      process.env.NEXT_PUBLIC_SUPABASE_URL = "http://127.0.0.1:54321";
      assert.equal(localDatabaseUiAllowed(), true);
    } finally {
      if (previous.flag === undefined) {
        delete process.env.LOLO_LOCAL_DB;
      } else {
        process.env.LOLO_LOCAL_DB = previous.flag;
      }
      if (previous.url === undefined) {
        delete process.env.NEXT_PUBLIC_SUPABASE_URL;
      } else {
        process.env.NEXT_PUBLIC_SUPABASE_URL = previous.url;
      }
    }
  });
});
