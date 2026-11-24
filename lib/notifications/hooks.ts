import "server-only";
import {
  sendContributionNotice,
  sendPurchaseNotice,
  sendVoucherIssuedNotice,
  sendVoucherRedeemedNotice,
  type NotificationDeps,
} from "./send";
import {
  SupabaseNotificationStore,
  loadPlatformNotificationSettings,
  loadPurchaseNotice,
  loadRedemptionNotice,
  loadVoucherNotice,
} from "./repository";
import type { NotifyResult } from "./types";

export type { NotificationDeps } from "./send";

export class NotificationNotFoundError extends Error {
  constructor() {
    super("הרשומה לא נמצאה.");
    this.name = "NotificationNotFoundError";
  }
}

export type NotifyOptions = {
  recipient?: string;
  deps?: NotificationDeps;
};

let defaultStore: SupabaseNotificationStore | null = null;

function store() {
  defaultStore ??= new SupabaseNotificationStore();
  return defaultStore;
}

export async function defaultNotificationDeps(): Promise<NotificationDeps> {
  const settings = await loadPlatformNotificationSettings();
  return {
    store: store(),
    channels: settings.channels,
    loadPurchase: (orderId) => loadPurchaseNotice(orderId, settings.currency),
    loadVoucher: (voucherId) => loadVoucherNotice(voucherId, settings.currency),
    loadRedemption: (redemptionId) => loadRedemptionNotice(redemptionId, settings.currency),
  };
}

async function resolveDeps(deps?: NotificationDeps) {
  return deps ?? (await defaultNotificationDeps());
}

async function requirePurchase(resolved: NotificationDeps, orderId: string) {
  if (!resolved.loadPurchase) {
    throw new NotificationNotFoundError();
  }
  const notice = await resolved.loadPurchase(orderId);
  if (!notice) {
    throw new NotificationNotFoundError();
  }
  return notice;
}

/**
 * Guest purchase confirmation. Sends only when the order asked for a
 * confirmation. Other packages call this after a paid order. It does not
 * change the order and it does not talk to a live provider.
 */
export async function notifyPurchaseConfirmed(
  orderId: string,
  deps?: NotificationDeps,
): Promise<NotifyResult> {
  const resolved = await resolveDeps(deps);
  const notice = await requirePurchase(resolved, orderId);
  return sendPurchaseNotice(notice, "purchase_confirmed", resolved);
}

export async function notifyRefund(orderId: string, deps?: NotificationDeps): Promise<NotifyResult> {
  const resolved = await resolveDeps(deps);
  const notice = await requirePurchase(resolved, orderId);
  return sendPurchaseNotice(notice, "refund", resolved);
}

/**
 * Host update. The event has no host address yet, so the caller passes one.
 * Without a recipient the call is skipped and nothing is written.
 */
export async function notifyContributionUpdated(
  orderId: string,
  options?: NotifyOptions,
): Promise<NotifyResult> {
  const resolved = await resolveDeps(options?.deps);
  const notice = await requirePurchase(resolved, orderId);
  return sendContributionNotice(notice, options?.recipient ?? "", resolved);
}

export async function notifyVoucherIssued(
  voucherId: string,
  options?: NotifyOptions,
): Promise<NotifyResult> {
  const resolved = await resolveDeps(options?.deps);
  const notice = resolved.loadVoucher ? await resolved.loadVoucher(voucherId) : null;
  if (!notice) {
    throw new NotificationNotFoundError();
  }
  return sendVoucherIssuedNotice(notice, options?.recipient ?? "", resolved);
}

export async function notifyVoucherRedeemed(
  redemptionId: string,
  options?: NotifyOptions,
): Promise<NotifyResult> {
  const resolved = await resolveDeps(options?.deps);
  const notice = resolved.loadRedemption ? await resolved.loadRedemption(redemptionId) : null;
  if (!notice) {
    throw new NotificationNotFoundError();
  }
  return sendVoucherRedeemedNotice(notice, options?.recipient ?? "", resolved);
}
