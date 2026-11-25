import "server-only";
import { orderMoneyFromRow } from "@/lib/payments/fee";
import { getSupabaseServiceClient } from "@/lib/supabase/server";
import { parseNotificationChannels } from "./providers";
import {
  rethrowIfNotificationSchema,
  unavailableError,
} from "./schema-error";
import type {
  IdempotencyKey,
  NewQueuedMessage,
  NotificationChannel,
  NotificationEventType,
  NotificationMessage,
  NotificationStatus,
  NotificationStore,
  PurchaseNotice,
  RedemptionNotice,
  TemplateCopy,
  VoucherNotice,
} from "./types";
import { NOTIFICATION_CHANNELS, NOTIFICATION_EVENT_TYPES, NOTIFICATION_STATUSES } from "./types";

type MessageRow = {
  id: string;
  template_id: string;
  locale: string;
  event_type: string;
  entity_id: string;
  recipient: string;
  channel: string;
  status: string;
  provider: string;
  provider_message_id: string | null;
  provider_response: string | null;
  error: string | null;
  subject: string | null;
  body: string;
  related_order_id: string | null;
  simulated: boolean;
  created_at: string;
  updated_at: string;
};

function isEventType(value: string): value is NotificationEventType {
  return (NOTIFICATION_EVENT_TYPES as readonly string[]).includes(value);
}

function isChannel(value: string): value is NotificationChannel {
  return (NOTIFICATION_CHANNELS as readonly string[]).includes(value);
}

function isStatus(value: string): value is NotificationStatus {
  return (NOTIFICATION_STATUSES as readonly string[]).includes(value);
}

function mapMessage(row: MessageRow): NotificationMessage | null {
  if (!isEventType(row.event_type) || !isChannel(row.channel) || !isStatus(row.status)) {
    return null;
  }
  return {
    id: row.id,
    templateId: row.template_id,
    locale: "he",
    eventType: row.event_type,
    entityId: row.entity_id,
    recipient: row.recipient,
    channel: row.channel,
    status: row.status,
    provider: row.provider,
    providerMessageId: row.provider_message_id,
    providerResponse: row.provider_response,
    error: row.error,
    subject: row.subject ?? "",
    body: row.body,
    relatedOrderId: row.related_order_id,
    simulated: row.simulated === true,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function throwQuery(error: { code?: string; message?: string }, label: string): never {
  rethrowIfNotificationSchema(error);
  console.error(`[LOLO] ${label}`, { code: error.code, message: error.message });
  throw unavailableError();
}

export class SupabaseNotificationStore implements NotificationStore {
  async findByKey(key: IdempotencyKey) {
    const supabase = getSupabaseServiceClient();
    const { data, error } = await supabase
      .from("notification_messages")
      .select("*")
      .eq("event_type", key.eventType)
      .eq("entity_id", key.entityId)
      .eq("recipient", key.recipient)
      .eq("channel", key.channel)
      .maybeSingle();
    if (error) {
      throwQuery(error, "notification lookup failed");
    }
    return data ? mapMessage(data as MessageRow) : null;
  }

  async getTemplate(eventType: NotificationEventType, channel: NotificationChannel) {
    const supabase = getSupabaseServiceClient();
    const { data, error } = await supabase
      .from("notification_templates")
      .select("id, subject, body")
      .eq("event_type", eventType)
      .eq("channel", channel)
      .eq("locale", "he")
      .maybeSingle();
    if (error) {
      throwQuery(error, "notification template lookup failed");
    }
    if (!data) {
      return null;
    }
    const row = data as { id: string; subject: string | null; body: string };
    const copy: TemplateCopy = {
      id: row.id,
      subject: row.subject ?? "",
      body: row.body,
    };
    return copy;
  }

  async insertQueued(message: NewQueuedMessage) {
    const supabase = getSupabaseServiceClient();
    const simulated = message.provider === "simulated" ? true : message.simulated;
    const { data, error } = await supabase
      .from("notification_messages")
      .insert({
        template_id: message.templateId,
        locale: "he",
        event_type: message.eventType,
        entity_id: message.entityId,
        recipient: message.recipient,
        channel: message.channel,
        status: "queued",
        provider: message.provider,
        subject: message.subject,
        body: message.body,
        related_order_id: message.relatedOrderId,
        simulated,
      })
      .select("*")
      .maybeSingle();
    if (error?.code === "23505") {
      return { conflict: true as const };
    }
    if (error) {
      throwQuery(error, "notification insert failed");
    }
    const mapped = data ? mapMessage(data as MessageRow) : null;
    if (!mapped) {
      throw unavailableError();
    }
    return { inserted: mapped };
  }

  async markSent(id: string, providerMessageId: string, providerResponse: string) {
    const supabase = getSupabaseServiceClient();
    const { data, error } = await supabase
      .from("notification_messages")
      .update({
        status: "sent_simulated",
        provider_message_id: providerMessageId,
        provider_response: providerResponse,
        error: null,
        simulated: true,
      })
      .eq("id", id)
      .select("*")
      .maybeSingle();
    if (error) {
      throwQuery(error, "notification update failed");
    }
    const mapped = data ? mapMessage(data as MessageRow) : null;
    if (!mapped) {
      throw unavailableError();
    }
    return mapped;
  }

  async markFailed(id: string, errorText: string) {
    const supabase = getSupabaseServiceClient();
    const { data, error } = await supabase
      .from("notification_messages")
      .update({
        status: "failed",
        error: errorText,
        provider_response: null,
      })
      .eq("id", id)
      .select("*")
      .maybeSingle();
    if (error) {
      throwQuery(error, "notification failure update failed");
    }
    const mapped = data ? mapMessage(data as MessageRow) : null;
    if (!mapped) {
      throw unavailableError();
    }
    return mapped;
  }

  async list(query: { limit: number; orderId?: string; status?: NotificationStatus }) {
    const supabase = getSupabaseServiceClient();
    let request = supabase
      .from("notification_messages")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(query.limit);
    if (query.orderId) {
      request = request.eq("related_order_id", query.orderId);
    }
    if (query.status) {
      request = request.eq("status", query.status);
    }
    const { data, error } = await request;
    if (error) {
      throwQuery(error, "notification list failed");
    }
    return ((data ?? []) as MessageRow[])
      .map(mapMessage)
      .filter((row): row is NotificationMessage => row !== null);
  }
}

export async function loadPlatformNotificationSettings() {
  const supabase = getSupabaseServiceClient();
  const { data, error } = await supabase
    .from("platform_settings")
    .select("notification_channels, document_currency")
    .eq("id", "default")
    .maybeSingle();
  if (error) {
    throwQuery(error, "notification settings read failed");
  }
  const row = (data ?? null) as {
    notification_channels?: unknown;
    document_currency?: string | null;
  } | null;
  const currency = row?.document_currency?.trim().toUpperCase() ?? "";
  return {
    channels: parseNotificationChannels(row?.notification_channels),
    currency: /^[A-Z]{3}$/.test(currency) ? currency : null,
  };
}

type OrderRow = {
  id: string;
  event_id: string;
  guest_name: string;
  guest_email: string;
  guest_phone: string;
  wants_confirmation: boolean;
  total_amount?: number | string | null;
  fee_amount?: number | string | null;
  charged_amount?: number | string | null;
  payment_status: string;
  payment_provider?: string | null;
  payment_reference?: string | null;
};

export async function loadPurchaseNotice(
  orderId: string,
  currency: string | null,
): Promise<PurchaseNotice | null> {
  const supabase = getSupabaseServiceClient();
  const { data, error } = await supabase
    .from("orders")
    .select(
      "id, event_id, guest_name, guest_email, guest_phone, wants_confirmation, total_amount, fee_amount, charged_amount, payment_status, payment_provider, payment_reference",
    )
    .eq("id", orderId)
    .maybeSingle();
  if (error) {
    throwQuery(error, "notification order read failed");
  }
  if (!data) {
    return null;
  }
  const order = data as OrderRow;
  const { data: event, error: eventError } = await supabase
    .from("events")
    .select("title, host_name")
    .eq("id", order.event_id)
    .maybeSingle();
  if (eventError) {
    throwQuery(eventError, "notification event read failed");
  }
  const eventRow = (event ?? null) as { title?: string; host_name?: string } | null;
  const money = orderMoneyFromRow(order);
  return {
    orderId: order.id,
    wantsConfirmation: order.wants_confirmation !== false,
    guestName: order.guest_name ?? "",
    guestEmail: order.guest_email ?? "",
    guestPhone: order.guest_phone ?? "",
    hostName: eventRow?.host_name ?? "",
    eventTitle: eventRow?.title ?? "",
    contributionAmount: money.contributionAmount,
    chargedAmount: money.chargedAmount,
    currency,
    paymentProvider: order.payment_provider ?? null,
    paymentReference: order.payment_reference ?? null,
    paymentStatus: order.payment_status,
  };
}

type VoucherRow = {
  id: string;
  code: string;
  amount: number | string;
  event_title: string | null;
  gift_title: string | null;
  store_name: string | null;
};

export async function loadVoucherNotice(
  voucherId: string,
  currency: string | null,
): Promise<VoucherNotice | null> {
  const supabase = getSupabaseServiceClient();
  const { data, error } = await supabase
    .from("vouchers")
    .select("id, code, amount, event_title, gift_title, store_name")
    .eq("id", voucherId)
    .maybeSingle();
  if (error) {
    throwQuery(error, "notification voucher read failed");
  }
  if (!data) {
    return null;
  }
  const voucher = data as VoucherRow;
  return {
    voucherId: voucher.id,
    code: voucher.code,
    amount: Number(voucher.amount) || 0,
    eventTitle: voucher.event_title ?? "",
    giftTitle: voucher.gift_title ?? "",
    storeName: voucher.store_name ?? "",
    relatedOrderId: null,
    currency,
  };
}

export async function loadRedemptionNotice(
  redemptionId: string,
  currency: string | null,
): Promise<RedemptionNotice | null> {
  const supabase = getSupabaseServiceClient();
  const { data, error } = await supabase
    .from("redemptions")
    .select("id, voucher_id, amount")
    .eq("id", redemptionId)
    .maybeSingle();
  if (error) {
    throwQuery(error, "notification redemption read failed");
  }
  if (!data) {
    return null;
  }
  const redemption = data as { id: string; voucher_id: string; amount: number | string };
  const voucher = await loadVoucherNotice(redemption.voucher_id, currency);
  return {
    redemptionId: redemption.id,
    voucherId: redemption.voucher_id,
    code: voucher?.code ?? "",
    amount: Number(redemption.amount) || 0,
    eventTitle: voucher?.eventTitle ?? "",
    storeName: voucher?.storeName ?? "",
    relatedOrderId: null,
    currency,
  };
}

export async function listNotificationMessages(query: {
  limit: number;
  orderId?: string;
  status?: NotificationStatus;
}) {
  return new SupabaseNotificationStore().list(query);
}
