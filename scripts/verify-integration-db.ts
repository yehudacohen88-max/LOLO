import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { describe, it } from "node:test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { ADMIN_SESSION_COOKIE, createAdminSessionToken, getAdminSession } from "../lib/admin/session";
import { listDeskEvents, listDeskGuests, listDeskOrders } from "../lib/desk/directory";
import type { Db } from "../lib/desk/db";
import { listStoreTransactions } from "../lib/desk/transactions";
import { anonCatalogIsClosed } from "../lib/events/guest-shape";
import { loadGuestEvent } from "../lib/events/load-guest-event";
import { HOST_SESSION_COOKIE, createHostSessionToken } from "../lib/host/session";
import { listEventGuests, requireHostEventSession } from "../lib/host/guest-list";
import { SupabaseDocumentStore } from "../lib/invoices/repository";
import { issueOrderDocument } from "../lib/invoices/service";
import { createDocumentProvider, RefusedDocumentProvider } from "../lib/invoices/providers";
import { TEST_DOCUMENT_WATERMARK } from "../lib/invoices/render";
import type { DocumentOrder } from "../lib/invoices/types";
import { REAL_PROVIDER_ALLOWLIST, setLocalRealProviderAllowlist } from "../lib/payments/allowlist";
import { buildDemoWebhookBody } from "../lib/payments/events";
import { paymentIdempotencyKey } from "../lib/payments/idempotency";
import { PAYMENTS_LIVE_NOT_ENABLED } from "../lib/payments/messages";
import { getPaymentProvider } from "../lib/payments/provider";
import {
  applyDemoWebhook,
  cancelDemoOrder,
  confirmDemoCheckout,
  refundDemoOrder,
  startDemoCheckout,
} from "../lib/payments/service";
import { signWebhookBody } from "../lib/payments/webhook-signature";
import { upsertPendingOrder } from "../lib/orders/repository";
import type { StoredOrder } from "../lib/orders/types";
import { dispatchNotification } from "../lib/notifications/dispatcher";
import {
  createNotificationProvider,
  SimulatedChannelProvider,
} from "../lib/notifications/providers";
import { SupabaseNotificationStore } from "../lib/notifications/repository";
import { PRODUCTION_SUPABASE_REF } from "./local-db-order.mjs";
import { __setTestCookies } from "./next-headers-stub.mjs";
import { createStoreSettlement } from "../lib/settlements/repository";
import { STORE_SESSION_COOKIE, createStoreSessionToken, getStoreSession } from "../lib/store/session";
import { getSupabaseServiceClient } from "../lib/supabase/server";
import type { VoucherTerms } from "../lib/vouchers/terms";
import { VoucherActionError } from "../lib/vouchers/messages";
import { cancelVoucher, issueGiftVoucher, redeemVoucher } from "../lib/vouchers/repository";

const enabled = process.env.LOLO_LOCAL_DB === "1";
const TERMS: VoucherTerms = {
  validityDays: 30,
  allowPartialRedemption: true,
  allowCustomerTopup: false,
  redemptionMethod: "בחנות",
  validityIsDefault: false,
  partialIsDefault: false,
  topupIsDefault: false,
  methodIsDefault: false,
};

const externalHosts: string[] = [];
const originalFetch = globalThis.fetch;

function loopbackHost(url: string) {
  const host = new URL(url).hostname;
  assert.ok(host === "127.0.0.1" || host === "localhost" || host === "::1", host);
  assert.equal(url.toLowerCase().includes(PRODUCTION_SUPABASE_REF), false);
  return url.replace(/\/+$/, "");
}

function service(): SupabaseClient {
  return getSupabaseServiceClient();
}

function tag() {
  return randomUUID().replace(/-/g, "").slice(0, 10);
}

async function must<T>(result: { data: T; error: { message: string } | null }, label: string) {
  if (result.error) {
    throw new Error(`${label}: ${result.error.message}`);
  }
  return result.data;
}

async function createEvent(label: string) {
  const db = service();
  const id = randomUUID();
  const slug = `ci-${label}-${tag()}`;
  await must(
    await db.from("events").insert({
      id,
      slug,
      title: `בדיקה ${label}`,
      host_name: "מארח בדיקה",
      event_type: "אחר",
      event_date: "2026-12-01",
      event_time: "18:00",
      venue_name: "אולם",
      address: "תל אביב",
      message: "בדיקה מקומית",
      cover_image: "",
      gift_mode: "catalog",
      money_amounts: [],
      allow_custom_amount: true,
      money_display: "amounts",
    }).select("id").single(),
    "event",
  );
  return { id, slug };
}

async function createStore(name: string) {
  const db = service();
  const id = randomUUID();
  const slug = `ci-store-${tag()}`;
  await must(
    await db.from("stores").insert({
      id,
      name,
      slug,
      active: true,
      commission_percent: 10,
      payment_terms_days: 14,
    }).select("id").single(),
    "store",
  );
  return { id, slug };
}

async function createGift(eventId: string, storeId: string, title: string, target: number) {
  const db = service();
  const id = randomUUID();
  await must(
    await db.from("event_gifts").insert({
      id,
      event_id: eventId,
      title,
      description: "בדיקה",
      target_amount: target,
      icon: "🎁",
      priority: 0,
      active: true,
      source: "custom",
      image_url: "",
      store_id: storeId,
      store_name: "חנות בדיקה",
    }).select("id").single(),
    "gift",
  );
  return id;
}

async function guestOrder(slug: string, giftId: string, amount: number, email: string) {
  return upsertPendingOrder({
    slug,
    guestName: "נועה בדיקה",
    guestPhone: "0501234567",
    guestEmail: email,
    wantsConfirmation: true,
    greetingText: "ברכה לבדיקה",
    items: [{ giftId, amount }],
  });
}

async function insertPaidFixture(input: {
  eventId: string;
  slug: string;
  giftId: string;
  giftName: string;
  amount: number;
  provider: string;
  reference: string;
}) {
  const db = service();
  const id = randomUUID();
  const access = randomUUID();
  await must(
    await db.from("orders").insert({
      id,
      event_id: input.eventId,
      event_slug: input.slug,
      guest_name: "אורח כסף",
      guest_phone: "0501234567",
      guest_email: "money@example.com",
      wants_confirmation: false,
      greeting_text: "",
      total_amount: input.amount,
      fee_amount: 0,
      charged_amount: input.amount,
      payment_status: "paid",
      payment_provider: input.provider,
      payment_reference: input.reference,
      paid_at: new Date().toISOString(),
      access_token: access,
    }).select("id").single(),
    "fixture order",
  );
  await must(
    await db.from("order_items").insert({
      id: randomUUID(),
      order_id: id,
      gift_id: input.giftId,
      gift_name: input.giftName,
      amount: input.amount,
    }).select("id").single(),
    "fixture item",
  );
  return id;
}

function execLocalSql(sql: string) {
  const result = spawnSync(
    "docker",
    [
      "exec",
      "-i",
      "supabase_db_lolo",
      "psql",
      "-U",
      "postgres",
      "-d",
      "postgres",
      "-v",
      "ON_ERROR_STOP=1",
      "-q",
    ],
    { input: sql, encoding: "utf8" },
  );
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || "local sql failed");
  }
}

async function withLocalFixtureMoney<T>(run: () => Promise<T>) {
  setLocalRealProviderAllowlist(["fixture"]);
  execLocalSql(
    "insert into public.payment_provider_allowlist(provider) values ('fixture') on conflict do nothing;",
  );
  try {
    return await run();
  } finally {
    setLocalRealProviderAllowlist(null);
    execLocalSql("delete from public.payment_provider_allowlist where provider = 'fixture';");
  }
}

describe(
  "local database integration",
  { skip: enabled ? false : "set LOLO_LOCAL_DB=1 to use the Docker database" },
  () => {
    it("pays a demo order once, verifies the webhook, and records a simulated refund", async () => {
      const url = loopbackHost(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "");
      assert.ok(process.env.SUPABASE_SERVICE_ROLE_KEY);
      assert.equal(url.includes(PRODUCTION_SUPABASE_REF), false);
      assert.deepEqual([...REAL_PROVIDER_ALLOWLIST], []);

      const previousProvider = process.env.PAYMENT_PROVIDER;
      process.env.PAYMENT_PROVIDER = "cardcom";
      const live = getPaymentProvider();
      assert.equal(live.isDemo, false);
      await assert.rejects(
        () => live.start({ order: {} as StoredOrder, idempotencyKey: "live-start-refused" }),
        (error: unknown) => error instanceof Error && error.message === PAYMENTS_LIVE_NOT_ENABLED,
      );
      process.env.PAYMENT_PROVIDER = previousProvider ?? "demo";
      assert.equal(getPaymentProvider().isDemo, true);

      const event = await createEvent("pay");
      const store = await createStore("חנות תשלום");
      const giftId = await createGift(event.id, store.id, "מתנת תשלום", 500);
      const loaded = await loadGuestEvent(event.slug);
      assert.equal(loaded?.slug, event.slug);
      assert.equal(loaded?.gifts.some((gift) => gift.id === giftId), true);

      const order = await guestOrder(event.slug, giftId, 100, "guest-pay@example.com");
      const startKey = paymentIdempotencyKey(order.id, "start");
      const firstStart = await startDemoCheckout(order, startKey);
      const secondStart = await startDemoCheckout(order, startKey);
      assert.equal(firstStart.status, "ready");
      assert.equal(firstStart.replayed, false);
      assert.equal(secondStart.replayed, true);

      const confirmKey = paymentIdempotencyKey(order.id, "confirm-success");
      const paid = await confirmDemoCheckout({
        orderId: order.id,
        accessToken: order.accessToken,
        outcome: "success",
        idempotencyKey: confirmKey,
      });
      const paidAgain = await confirmDemoCheckout({
        orderId: order.id,
        accessToken: order.accessToken,
        outcome: "success",
        idempotencyKey: confirmKey,
      });
      assert.equal(paid.paymentStatus, "paid");
      assert.equal(paid.paymentProvider, "demo");
      assert.match(paid.paymentReference ?? "", /^demo-/);
      assert.equal(paidAgain.paymentReference, paid.paymentReference);
      assert.equal(paidAgain.chargedAmount, paid.chargedAmount);

      const secret = process.env.PAYMENT_WEBHOOK_SECRET?.trim() || "ci-webhook-secret";
      const eventId = `webhook-${tag()}`;
      const body = buildDemoWebhookBody({
        eventId,
        type: "payment.succeeded",
        provider: "demo",
        orderId: order.id,
        amount: paid.chargedAmount,
      });
      const provider = getPaymentProvider();
      assert.equal(
        provider.verifyWebhook({ rawBody: body, signature: "sha256=deadbeef", secret }).ok,
        false,
      );
      const signature = `sha256=${signWebhookBody(body, secret)}`;
      assert.equal(provider.verifyWebhook({ rawBody: body, signature, secret }).ok, true);
      const parsed = provider.parseEvent(body);
      const applied = await applyDemoWebhook(parsed);
      const replayed = await applyDemoWebhook(parsed);
      assert.equal(replayed.replayed, true);
      assert.equal(applied.paidAt != null || replayed.paidAt != null, true);

      const otherBody = buildDemoWebhookBody({
        eventId: `webhook-${tag()}`,
        type: "payment.succeeded",
        provider: "demo",
        orderId: order.id,
        amount: paid.chargedAmount,
      });
      await applyDemoWebhook(provider.parseEvent(otherBody));
      const { data: stored } = await service()
        .from("orders")
        .select("payment_status, payment_provider, payment_reference, charged_amount")
        .eq("id", order.id)
        .single();
      assert.equal(stored?.payment_status, "paid");
      assert.equal(stored?.payment_provider, "demo");
      assert.equal(stored?.payment_reference, paid.paymentReference);
      assert.equal(Number(stored?.charged_amount), paid.chargedAmount);

      const refusedAttempt = await service().from("payment_attempts").insert({
        order_id: order.id,
        provider: "cardcom",
        idempotency_key: `live-${tag()}`,
        kind: "confirm",
        status: "succeeded",
        amount: paid.chargedAmount,
        simulated: false,
      });
      assert.ok(refusedAttempt.error, "a non-demo capture must be rejected by the database");

      const db = service();
      const { data: policyBefore } = await db
        .from("platform_settings")
        .select("refund_window_days, refund_approver, refund_allow_partial, refund_blocks_issued_voucher")
        .eq("id", "default")
        .single();
      await must(
        await db.from("platform_settings").update({
          refund_window_days: 14,
          refund_approver: "admin",
          refund_allow_partial: true,
          refund_blocks_issued_voucher: false,
        }).eq("id", "default").select("id").single(),
        "refund policy",
      );
      try {
        const refundKey = paymentIdempotencyKey(order.id, "refund");
        const refund = await refundDemoOrder({
          orderId: order.id,
          accessToken: null,
          actor: "admin",
          amount: paid.chargedAmount,
          idempotencyKey: refundKey,
          reason: "בדיקה מקומית",
        });
        const again = await refundDemoOrder({
          orderId: order.id,
          accessToken: null,
          actor: "admin",
          amount: paid.chargedAmount,
          idempotencyKey: refundKey,
          reason: "בדיקה מקומית",
        });
        assert.equal(refund.simulated, true);
        assert.equal(refund.provider, "demo");
        assert.equal(refund.externalUrl, null);
        assert.equal(again.replayed, true);
        assert.equal(again.providerReference, refund.providerReference);
        await assert.rejects(
          () => cancelDemoOrder(order.id, order.accessToken, paymentIdempotencyKey(order.id, "cancel")),
          (error: unknown) => error instanceof Error && /שולמה|מבוטלת/.test(error.message),
        );
      } finally {
        await db.from("platform_settings").update({
          refund_window_days: policyBefore?.refund_window_days ?? null,
          refund_approver: policyBefore?.refund_approver ?? null,
          refund_allow_partial: policyBefore?.refund_allow_partial ?? null,
          refund_blocks_issued_voucher: policyBefore?.refund_blocks_issued_voucher ?? null,
        }).eq("id", "default");
      }

      const pending = await guestOrder(event.slug, giftId, 40, "guest-cancel@example.com");
      const cancelled = await cancelDemoOrder(
        pending.id,
        pending.accessToken,
        paymentIdempotencyKey(pending.id, "cancel"),
      );
      assert.equal(cancelled.paymentStatus, "cancelled");
      const cancelledAgain = await cancelDemoOrder(
        pending.id,
        pending.accessToken,
        paymentIdempotencyKey(pending.id, "cancel"),
      );
      assert.equal(cancelledAgain.paymentStatus, "cancelled");
    });

    it("issues, redeems, expires, and blocks demo vouchers", async () => {
      const event = await createEvent("voucher");
      const store = await createStore("חנות שובר");
      const other = await createStore("חנות אחרת");
      const moneyGift = await createGift(event.id, store.id, "מתנה כספית", 500);
      const partialGift = await createGift(event.id, store.id, "מתנה חלקית", 500);
      const expireGift = await createGift(event.id, store.id, "מתנה פגה", 500);
      const cancelGift = await createGift(event.id, store.id, "מתנה לביטול", 500);
      const demoGift = await createGift(event.id, store.id, "מתנת הדגמה", 500);
      const closedGift = await createGift(event.id, store.id, "ספק לא מאושר", 500);
      await insertPaidFixture({
        eventId: event.id,
        slug: event.slug,
        giftId: closedGift,
        giftName: "ספק לא מאושר",
        amount: 40,
        provider: "fixture",
        reference: "local-fixture-closed",
      });
      const closed = await issueGiftVoucher({
        eventId: event.id,
        giftId: closedGift,
        storeId: store.id,
        expectedAmount: 40,
        idempotencyKey: randomUUID(),
        terms: TERMS,
      });
      const closedRow = await service().from("vouchers").select("demo_only").eq("id", closed.id).single();
      assert.equal(closedRow.data?.demo_only, true);
      await assert.rejects(
        () => redeemVoucher({
          storeId: store.id,
          channel: "store",
          redeemedBy: "קופה",
          amount: null,
          reference: "closed-money",
          voucherId: closed.id,
        }),
        (error: unknown) => error instanceof VoucherActionError && /הדגמה/.test(error.message),
      );

      await insertPaidFixture({
        eventId: event.id,
        slug: event.slug,
        giftId: moneyGift,
        giftName: "מתנה כספית",
        amount: 120,
        provider: "fixture",
        reference: "local-fixture-full",
      });
      await insertPaidFixture({
        eventId: event.id,
        slug: event.slug,
        giftId: partialGift,
        giftName: "מתנה חלקית",
        amount: 100,
        provider: "fixture",
        reference: "local-fixture-partial",
      });
      await insertPaidFixture({
        eventId: event.id,
        slug: event.slug,
        giftId: expireGift,
        giftName: "מתנה פגה",
        amount: 50,
        provider: "fixture",
        reference: "local-fixture-expire",
      });
      await insertPaidFixture({
        eventId: event.id,
        slug: event.slug,
        giftId: cancelGift,
        giftName: "מתנה לביטול",
        amount: 30,
        provider: "fixture",
        reference: "local-fixture-cancel",
      });

      await withLocalFixtureMoney(async () => {
      const issueKey = randomUUID();
      const issued = await issueGiftVoucher({
        eventId: event.id,
        giftId: moneyGift,
        storeId: store.id,
        expectedAmount: 120,
        idempotencyKey: issueKey,
        terms: TERMS,
      });
      const issuedAgain = await issueGiftVoucher({
        eventId: event.id,
        giftId: moneyGift,
        storeId: store.id,
        expectedAmount: 120,
        idempotencyKey: issueKey,
        terms: TERMS,
      });
      assert.equal(issuedAgain.id, issued.id);
      assert.equal(issuedAgain.idempotent, true);
      const row = await service().from("vouchers").select("demo_only, amount").eq("id", issued.id).single();
      assert.equal(row.data?.demo_only, false);
      const full = await redeemVoucher({
        storeId: store.id,
        channel: "store",
        redeemedBy: "קופה",
        amount: null,
        reference: "full-1",
        voucherId: issued.id,
      });
      assert.equal(full.remainingAmount, 0);
      await assert.rejects(
        () => redeemVoucher({
          storeId: store.id,
          channel: "store",
          redeemedBy: "קופה",
          amount: null,
          reference: "full-2",
          voucherId: issued.id,
        }),
        (error: unknown) => error instanceof VoucherActionError,
      );
      await assert.rejects(
        () => redeemVoucher({
          storeId: other.id,
          channel: "store",
          redeemedBy: "קופה",
          amount: null,
          reference: "other-store",
          voucherId: issued.id,
        }),
        (error: unknown) => error instanceof VoucherActionError,
      );

      const partial = await issueGiftVoucher({
        eventId: event.id,
        giftId: partialGift,
        storeId: store.id,
        expectedAmount: 100,
        idempotencyKey: randomUUID(),
        terms: TERMS,
      });
      const firstPart = await redeemVoucher({
        storeId: store.id,
        channel: "store",
        redeemedBy: "קופה",
        amount: 40,
        reference: "part-1",
        voucherId: partial.id,
      });
      assert.equal(firstPart.remainingAmount, 60);
      assert.equal(firstPart.status, "PARTIALLY_REDEEMED");
      const secondPart = await redeemVoucher({
        storeId: store.id,
        channel: "store",
        redeemedBy: "קופה",
        amount: 60,
        reference: "part-2",
        voucherId: partial.id,
      });
      assert.equal(secondPart.remainingAmount, 0);
      await assert.rejects(
        () => redeemVoucher({
          storeId: store.id,
          channel: "store",
          redeemedBy: "קופה",
          amount: 1,
          reference: "part-3",
          voucherId: partial.id,
        }),
        (error: unknown) => error instanceof VoucherActionError,
      );

      const expiring = await issueGiftVoucher({
        eventId: event.id,
        giftId: expireGift,
        storeId: store.id,
        expectedAmount: 50,
        idempotencyKey: randomUUID(),
        terms: TERMS,
      });
      execLocalSql("alter table public.vouchers disable trigger vouchers_guard_issue;");
      try {
        execLocalSql(
          `update public.vouchers set expires_at = '2000-01-01 00:00:00+00' where id = '${expiring.id}';`,
        );
      } finally {
        execLocalSql("alter table public.vouchers enable trigger vouchers_guard_issue;");
      }
      await assert.rejects(
        () => redeemVoucher({
          storeId: store.id,
          channel: "store",
          redeemedBy: "קופה",
          amount: null,
          reference: "expired",
          voucherId: expiring.id,
        }),
        (error: unknown) => error instanceof VoucherActionError && /פג|תוקף/.test(error.message),
      );

      const toCancel = await issueGiftVoucher({
        eventId: event.id,
        giftId: cancelGift,
        storeId: store.id,
        expectedAmount: 30,
        idempotencyKey: randomUUID(),
        terms: TERMS,
      });
      await cancelVoucher(toCancel.id);
      await assert.rejects(
        () => redeemVoucher({
          storeId: store.id,
          channel: "store",
          redeemedBy: "קופה",
          amount: null,
          reference: "cancelled",
          voucherId: toCancel.id,
        }),
        (error: unknown) => error instanceof VoucherActionError,
      );
      });

      const demoOrder = await guestOrder(event.slug, demoGift, 80, "demo-voucher@example.com");
      await confirmDemoCheckout({
        orderId: demoOrder.id,
        accessToken: demoOrder.accessToken,
        outcome: "success",
        idempotencyKey: paymentIdempotencyKey(demoOrder.id, "confirm-success"),
      });
      const demoVoucher = await issueGiftVoucher({
        eventId: event.id,
        giftId: demoGift,
        storeId: store.id,
        expectedAmount: 80,
        idempotencyKey: randomUUID(),
        terms: TERMS,
      });
      const demoRow = await service().from("vouchers").select("demo_only").eq("id", demoVoucher.id).single();
      assert.equal(demoRow.data?.demo_only, true);
      await assert.rejects(
        () => redeemVoucher({
          storeId: store.id,
          channel: "store",
          redeemedBy: "קופה",
          amount: null,
          reference: "demo-money",
          voucherId: demoVoucher.id,
        }),
        (error: unknown) => error instanceof VoucherActionError && /הדגמה/.test(error.message),
      );

      const page = await listStoreTransactions(store.id, { from: null, to: null, kind: "all" }, service() as unknown as Db);
      assert.equal(page.rows.every((row) => row.storeId === store.id), true);
      assert.equal(page.rows.some((row) => row.demoOnly === true), false);
    });

    it("keeps stores, hosts, and admins on their own rows", async () => {
      const url = loopbackHost(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "");
      const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
      assert.ok(anonKey);
      const anon = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
      for (const table of ["events", "event_gifts", "orders", "vouchers", "event_guests", "audit_events"]) {
        const response = await fetch(`${url}/rest/v1/${table}?select=id&limit=1`, {
          headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` },
        });
        const text = await response.text();
        const body = text ? JSON.parse(text) : [];
        const rowCount = Array.isArray(body) ? body.length : 0;
        assert.equal(anonCatalogIsClosed(response.status, rowCount), true, table);
      }
      const anonEvents = await anon.from("events").select("id").limit(1);
      assert.equal(Array.isArray(anonEvents.data) ? anonEvents.data.length : 0, 0);

      const eventA = await createEvent("hosta");
      const eventB = await createEvent("hostb");
      const store = await createStore("חנות הרשאה");
      await createGift(eventA.id, store.id, "מתנה א", 10);
      await service().from("event_host_access").insert({
        event_id: eventA.id,
        code_hash: "pbkdf2$sha256$1$aa$bb",
        session_version: 0,
      });
      await service().from("event_host_access").insert({
        event_id: eventB.id,
        code_hash: "pbkdf2$sha256$1$cc$dd",
        session_version: 0,
      });
      await service().from("event_guests").insert([
        { id: randomUUID(), event_id: eventA.id, name: "אורח א", phone: "0501111111" },
        { id: randomUUID(), event_id: eventB.id, name: "אורח ב", phone: "0502222222" },
      ]);

      __setTestCookies({
        [HOST_SESSION_COOKIE]: createHostSessionToken(eventA.id, 0),
      });
      assert.ok(await requireHostEventSession(eventA.id));
      assert.equal(await requireHostEventSession(eventB.id), null);
      const guests = await listEventGuests(eventA.id);
      assert.deepEqual(guests.map((guest) => guest.name), ["אורח א"]);

      __setTestCookies({});
      assert.equal(await getAdminSession(), null);
      __setTestCookies({ [ADMIN_SESSION_COOKIE]: createAdminSessionToken() });
      assert.ok(await getAdminSession());
      __setTestCookies({ [STORE_SESSION_COOKIE]: createStoreSessionToken(store.id) });
      const storeSession = await getStoreSession();
      assert.equal(storeSession?.storeId, store.id);
      assert.equal(await getAdminSession(), null);

      const db = service() as unknown as Db;
      const events = await listDeskEvents(db, eventA.slug);
      assert.equal(events.some((row) => row.id === eventA.id), true);
      assert.equal(events.some((row) => row.id === eventB.id), false);
      const deskGuests = await listDeskGuests(db, eventA.id);
      assert.equal(deskGuests.every((guest) => guest.eventId === eventA.id), true);
      const orders = await listDeskOrders(db);
      assert.equal(
        orders.orders.some((order) => order.eventId === eventB.id && order.guestName === "אורח ב"),
        false,
      );
    });

    it("leaves demo redemptions out of a settlement batch when that schema exists", async () => {
      const probe = await service().from("settlements").select("id").limit(1);
      if (probe.error) {
        assert.match(probe.error.message, /settlements|schema cache|does not exist/i);
        return;
      }

      const previous = process.env.SETTLEMENTS_ENABLED;
      const db = service();
      const { data: roundingBefore } = await db
        .from("platform_settings")
        .select("money_rounding")
        .eq("id", "default")
        .single();
      process.env.SETTLEMENTS_ENABLED = "true";
      await db.from("platform_settings").update({
        money_rounding: "half_away_from_zero",
      }).eq("id", "default");
      try {
        const event = await createEvent("settle");
        const store = await createStore("חנות התחשבנות");
        const moneyGift = await createGift(event.id, store.id, "מתנה לסגירה", 400);
        const demoGift = await createGift(event.id, store.id, "הדגמה לסגירה", 400);
        await insertPaidFixture({
          eventId: event.id,
          slug: event.slug,
          giftId: moneyGift,
          giftName: "מתנה לסגירה",
          amount: 90,
          provider: "fixture",
          reference: "local-fixture-settle",
        });
        const moneyVoucher = await withLocalFixtureMoney(async () => {
          const issued = await issueGiftVoucher({
            eventId: event.id,
            giftId: moneyGift,
            storeId: store.id,
            expectedAmount: 90,
            idempotencyKey: randomUUID(),
            terms: TERMS,
          });
          await redeemVoucher({
            storeId: store.id,
            channel: "store",
            redeemedBy: "קופה",
            amount: null,
            reference: "settle-real",
            voucherId: issued.id,
          });
          return issued;
        });

        const demoOrder = await guestOrder(event.slug, demoGift, 70, "settle-demo@example.com");
        await confirmDemoCheckout({
          orderId: demoOrder.id,
          accessToken: demoOrder.accessToken,
          outcome: "success",
          idempotencyKey: paymentIdempotencyKey(demoOrder.id, "confirm-success"),
        });
        const demoVoucher = await issueGiftVoucher({
          eventId: event.id,
          giftId: demoGift,
          storeId: store.id,
          expectedAmount: 70,
          idempotencyKey: randomUUID(),
          terms: TERMS,
        });
        const planted = await db.from("redemptions").insert({
          voucher_id: demoVoucher.id,
          store_id: store.id,
          amount: 70,
          channel: "store",
          redeemed_by: "seed",
          reference: "planted-demo",
          commission_percent_snapshot: 10,
          payment_terms_days_snapshot: 14,
          settlement_status: "UNSETTLED",
        }).select("id").single();
        assert.equal(planted.error, null);

        const created = await createStoreSettlement(store.id, randomUUID());
        assert.ok(created);
        const redemptions = await db
          .from("redemptions")
          .select("voucher_id, settlement_status")
          .eq("store_id", store.id);
        const rows = redemptions.data ?? [];
        const demoLine = rows.find((row) => row.voucher_id === demoVoucher.id);
        const moneyLine = rows.find((row) => row.voucher_id === moneyVoucher.id);
        assert.equal(demoLine?.settlement_status, "UNSETTLED");
        assert.notEqual(moneyLine?.settlement_status, "UNSETTLED");
      } finally {
        process.env.SETTLEMENTS_ENABLED = previous;
        await db.from("platform_settings").update({
          money_rounding: roundingBefore?.money_rounding ?? null,
        }).eq("id", "default");
      }
    });

    it("sends notifications and documents only through the simulated providers", async () => {
      externalHosts.length = 0;
      globalThis.fetch = async (input, init) => {
        const raw = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
        try {
          const host = new URL(raw).hostname;
          if (host !== "127.0.0.1" && host !== "localhost" && host !== "::1") {
            externalHosts.push(host);
          }
        } catch {
          // Relative URLs stay on this process.
        }
        return originalFetch(input, init);
      };
      try {
        const event = await createEvent("notice");
        const store = await createStore("חנות הודעה");
        const giftId = await createGift(event.id, store.id, "מתנת הודעה", 20);
        const order = await guestOrder(event.slug, giftId, 20, "notice@example.com");
        const paid = await confirmDemoCheckout({
          orderId: order.id,
          accessToken: order.accessToken,
          outcome: "success",
          idempotencyKey: paymentIdempotencyKey(order.id, "confirm-success"),
        });

        const simulated = new SimulatedChannelProvider("email");
        const sent = await dispatchNotification(
          {
            eventType: "purchase_confirmed",
            entityId: paid.id,
            channel: "email",
            recipient: "notice@example.com",
            relatedOrderId: paid.id,
            variables: { guestName: "נועה", amount: "20", eventTitle: "בדיקה" },
          },
          { store: new SupabaseNotificationStore(), provider: simulated },
        );
        assert.equal(sent.message.simulated, true);
        assert.equal(sent.message.provider, "simulated");
        assert.equal(sent.message.status, "sent_simulated");
        assert.match(sent.message.providerResponse ?? "", /no network/);
        assert.equal(simulated.sendCalls, 1);

        const refused = createNotificationProvider("sms", { NOTIFICATION_SMS_PROVIDER: "twilio" });
        assert.equal(refused.isSimulated, false);
        const refusedSend = await dispatchNotification(
          {
            eventType: "purchase_confirmed",
            entityId: `${paid.id}-sms`,
            channel: "sms",
            recipient: "0501234567",
            relatedOrderId: paid.id,
            variables: { guestName: "נועה", amount: "20", eventTitle: "בדיקה" },
          },
          { store: new SupabaseNotificationStore(), provider: refused },
        );
        assert.equal(refusedSend.message.status, "failed");
        assert.equal(refusedSend.message.simulated, false);

        const documentOrder: DocumentOrder = {
          id: paid.id,
          eventTitle: "בדיקה",
          guestName: "נועה בדיקה",
          contributionAmount: 20,
          feeAmount: 0,
          chargedAmount: paid.chargedAmount,
          paymentProvider: "demo",
          paymentReference: paid.paymentReference,
          paymentStatus: "paid",
        };
        const document = await issueOrderDocument(
          documentOrder,
          { vatRatePercent: 18, vatIncluded: false, documentKind: "receipt", currency: "ILS" },
          { store: new SupabaseDocumentStore(), provider: createDocumentProvider({}) },
        );
        assert.equal(document.simulated, true);
        assert.equal(document.watermark, TEST_DOCUMENT_WATERMARK);
        assert.match(document.body, /מסמך בדיקה/);
        const stored = await service().from("documents").select("simulated, watermark, provider").eq("id", document.id).single();
        assert.equal(stored.data?.simulated, true);
        assert.equal(stored.data?.provider, "simulated");
        assert.equal(stored.data?.watermark, TEST_DOCUMENT_WATERMARK);

        const liveDocument = new RefusedDocumentProvider("hashavshevet");
        await assert.rejects(
          () => issueOrderDocument(
            { ...documentOrder, id: randomUUID() },
            { vatRatePercent: 18, vatIncluded: false, documentKind: "receipt", currency: "ILS" },
            { store: new SupabaseDocumentStore(), provider: liveDocument },
          ),
          (error: unknown) => error instanceof Error && /אינו מחובר/.test(error.message),
        );
        assert.equal(externalHosts.length, 0, externalHosts.join(","));
      } finally {
        globalThis.fetch = originalFetch;
      }
    });
  },
);
