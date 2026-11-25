export const NOTIFICATION_CHANNELS = ["email", "sms", "whatsapp"] as const;
export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number];

export const NOTIFICATION_EVENT_TYPES = [
  "purchase_confirmed",
  "contribution_updated",
  "voucher_issued",
  "voucher_redeemed",
  "refund",
] as const;
export type NotificationEventType = (typeof NOTIFICATION_EVENT_TYPES)[number];

export const NOTIFICATION_STATUSES = ["queued", "sent_simulated", "failed"] as const;
export type NotificationStatus = (typeof NOTIFICATION_STATUSES)[number];

export const NOTIFICATION_LOCALE = "he" as const;

export type TemplateVariables = Record<string, string>;

export type TemplateCopy = {
  id: string;
  subject: string;
  body: string;
};

export type OutboundNotification = {
  channel: NotificationChannel;
  to: string;
  subject: string;
  body: string;
  templateId: string;
  eventType: NotificationEventType;
  entityId: string;
};

export type ProviderSendResult = {
  providerMessageId: string;
};

/**
 * Channel-agnostic sender. A live adapter must set isSimulated to false.
 * This package only constructs simulated adapters. A real name fails closed
 * before send() can open a socket.
 */
export interface NotificationProvider {
  readonly name: string;
  readonly channel: NotificationChannel;
  readonly isSimulated: boolean;
  send(message: OutboundNotification): Promise<ProviderSendResult>;
}

export type NotificationMessage = {
  id: string;
  templateId: string;
  locale: typeof NOTIFICATION_LOCALE;
  eventType: NotificationEventType;
  entityId: string;
  recipient: string;
  channel: NotificationChannel;
  status: NotificationStatus;
  provider: string;
  providerMessageId: string | null;
  providerResponse: string | null;
  error: string | null;
  subject: string;
  body: string;
  relatedOrderId: string | null;
  simulated: boolean;
  createdAt: string;
  updatedAt: string;
};

export type IdempotencyKey = {
  eventType: NotificationEventType;
  entityId: string;
  recipient: string;
  channel: NotificationChannel;
};

export type NewQueuedMessage = {
  templateId: string;
  eventType: NotificationEventType;
  entityId: string;
  recipient: string;
  channel: NotificationChannel;
  provider: string;
  subject: string;
  body: string;
  relatedOrderId: string | null;
  simulated: boolean;
};

export interface NotificationStore {
  findByKey(key: IdempotencyKey): Promise<NotificationMessage | null>;
  getTemplate(
    eventType: NotificationEventType,
    channel: NotificationChannel,
  ): Promise<TemplateCopy | null>;
  insertQueued(
    message: NewQueuedMessage,
  ): Promise<{ inserted: NotificationMessage } | { conflict: true }>;
  markSent(
    id: string,
    providerMessageId: string,
    providerResponse: string,
  ): Promise<NotificationMessage>;
  markFailed(id: string, error: string): Promise<NotificationMessage>;
  list(query: {
    limit: number;
    orderId?: string;
    status?: NotificationStatus;
  }): Promise<NotificationMessage[]>;
}

export type PurchaseNotice = {
  orderId: string;
  wantsConfirmation: boolean;
  guestName: string;
  guestEmail: string;
  guestPhone: string;
  hostName: string;
  eventTitle: string;
  contributionAmount: number;
  chargedAmount: number;
  currency: string | null;
  paymentProvider: string | null;
  paymentReference: string | null;
  paymentStatus: string;
};

export type VoucherNotice = {
  voucherId: string;
  code: string;
  amount: number;
  eventTitle: string;
  giftTitle: string;
  storeName: string;
  relatedOrderId: string | null;
  currency: string | null;
};

export type RedemptionNotice = {
  redemptionId: string;
  voucherId: string;
  code: string;
  amount: number;
  eventTitle: string;
  storeName: string;
  relatedOrderId: string | null;
  currency: string | null;
};

export type NotifySkipReason =
  | "wants_confirmation"
  | "missing_recipient"
  | "channels_not_configured";

export type NotifyDelivery = {
  message: NotificationMessage;
  idempotent: boolean;
};

export type NotifyResult = {
  skipped: boolean;
  reason: NotifySkipReason | null;
  messages: NotifyDelivery[];
};
