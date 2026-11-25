import { isDemoMoney } from "@/lib/invoices/demo-order";
import { dispatchNotification } from "./dispatcher";
import { createNotificationProvider, type NotificationProviderEnv } from "./providers";
import { hasRecipient, normalizeRecipient } from "./recipients";
import { currencySuffix, formatNoticeAmount } from "./templates";
import type {
  NotificationChannel,
  NotificationEventType,
  NotificationProvider,
  NotificationStore,
  NotifyResult,
  PurchaseNotice,
  RedemptionNotice,
  TemplateVariables,
  VoucherNotice,
} from "./types";

export type NotificationDeps = {
  store: NotificationStore;
  channels: NotificationChannel[];
  providers?: Partial<Record<NotificationChannel, NotificationProvider>>;
  env?: NotificationProviderEnv;
  loadPurchase?: (orderId: string) => Promise<PurchaseNotice | null>;
  loadVoucher?: (voucherId: string) => Promise<VoucherNotice | null>;
  loadRedemption?: (redemptionId: string) => Promise<RedemptionNotice | null>;
};

function providerFor(channel: NotificationChannel, deps: NotificationDeps) {
  return deps.providers?.[channel] ?? createNotificationProvider(channel, deps.env);
}

function skipped(reason: NotifyResult["reason"]): NotifyResult {
  return { skipped: true, reason, messages: [] };
}

async function deliver(
  deps: NotificationDeps,
  input: {
    eventType: NotificationEventType;
    entityId: string;
    relatedOrderId: string | null;
    variables: TemplateVariables;
    targets: Array<{ channel: NotificationChannel; recipient: string }>;
  },
): Promise<NotifyResult> {
  if (deps.channels.length === 0) {
    return skipped("channels_not_configured");
  }

  const targets = input.targets.filter((target) => deps.channels.includes(target.channel));
  const deliverable = targets.filter((target) => hasRecipient(target.channel, target.recipient));
  if (deliverable.length === 0) {
    return skipped("missing_recipient");
  }

  const messages = [];
  for (const target of deliverable) {
    const recipient = normalizeRecipient(target.channel, target.recipient);
    const result = await dispatchNotification(
      {
        eventType: input.eventType,
        entityId: input.entityId,
        channel: target.channel,
        recipient,
        relatedOrderId: input.relatedOrderId,
        variables: input.variables,
      },
      { store: deps.store, provider: providerFor(target.channel, deps) },
    );
    messages.push(result);
  }

  return { skipped: false, reason: null, messages };
}

function paymentNote(notice: PurchaseNotice) {
  return isDemoMoney(notice) ? "תשלום הדגמה. לא בוצע חיוב אמיתי." : "";
}

function purchaseVariables(notice: PurchaseNotice): TemplateVariables {
  return {
    guestName: notice.guestName,
    hostName: notice.hostName,
    eventTitle: notice.eventTitle,
    orderId: notice.orderId,
    amount: formatNoticeAmount(notice.contributionAmount),
    chargedAmount: formatNoticeAmount(notice.chargedAmount),
    currencySuffix: currencySuffix(notice.currency),
    paymentNote: paymentNote(notice),
    voucherCode: "",
    giftTitle: "",
    storeName: "",
  };
}

export async function sendPurchaseNotice(
  notice: PurchaseNotice,
  eventType: "purchase_confirmed" | "refund",
  deps: NotificationDeps,
) {
  if (!notice.wantsConfirmation) {
    return skipped("wants_confirmation");
  }
  return deliver(deps, {
    eventType,
    entityId: notice.orderId,
    relatedOrderId: notice.orderId,
    variables: purchaseVariables(notice),
    targets: deps.channels.map((channel) => ({
      channel,
      recipient: channel === "email" ? notice.guestEmail : notice.guestPhone,
    })),
  });
}

export async function sendContributionNotice(
  notice: PurchaseNotice,
  recipient: string,
  deps: NotificationDeps,
) {
  return deliver(deps, {
    eventType: "contribution_updated",
    entityId: notice.orderId,
    relatedOrderId: notice.orderId,
    variables: purchaseVariables(notice),
    targets: deps.channels.map((channel) => ({ channel, recipient })),
  });
}

export async function sendVoucherIssuedNotice(
  notice: VoucherNotice,
  recipient: string,
  deps: NotificationDeps,
) {
  return deliver(deps, {
    eventType: "voucher_issued",
    entityId: notice.voucherId,
    relatedOrderId: notice.relatedOrderId,
    variables: {
      guestName: "",
      hostName: "",
      eventTitle: notice.eventTitle,
      orderId: notice.relatedOrderId ?? "",
      amount: formatNoticeAmount(notice.amount),
      chargedAmount: formatNoticeAmount(notice.amount),
      currencySuffix: currencySuffix(notice.currency),
      paymentNote: "",
      voucherCode: notice.code,
      giftTitle: notice.giftTitle,
      storeName: notice.storeName,
    },
    targets: deps.channels.map((channel) => ({ channel, recipient })),
  });
}

export async function sendVoucherRedeemedNotice(
  notice: RedemptionNotice,
  recipient: string,
  deps: NotificationDeps,
) {
  return deliver(deps, {
    eventType: "voucher_redeemed",
    entityId: notice.redemptionId,
    relatedOrderId: notice.relatedOrderId,
    variables: {
      guestName: "",
      hostName: "",
      eventTitle: notice.eventTitle,
      orderId: notice.relatedOrderId ?? "",
      amount: formatNoticeAmount(notice.amount),
      chargedAmount: formatNoticeAmount(notice.amount),
      currencySuffix: currencySuffix(notice.currency),
      paymentNote: "",
      voucherCode: notice.code,
      giftTitle: "",
      storeName: notice.storeName,
    },
    targets: deps.channels.map((channel) => ({ channel, recipient })),
  });
}
