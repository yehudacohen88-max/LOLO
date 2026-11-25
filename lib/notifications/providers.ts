import { randomUUID } from "node:crypto";
import {
  NOTIFICATION_CHANNELS,
  type NotificationChannel,
  type NotificationProvider,
  type OutboundNotification,
  type ProviderSendResult,
} from "./types";

const SIMULATED = "simulated";

/**
 * Empty and "simulated" are the only accepted names.
 * Any other name is a live provider that is not connected. It must not
 * fall through to the simulated adapter, and it must not open a network call.
 */
export function resolveNotificationProviderName(raw: string | undefined) {
  const name = (raw ?? "").trim().toLowerCase();
  if (name === "" || name === SIMULATED) {
    return SIMULATED;
  }
  return name;
}

export type NotificationProviderEnv = Record<string, string | undefined>;

export function providerEnvForChannel(
  channel: NotificationChannel,
  env: NotificationProviderEnv = process.env,
) {
  if (channel === "email") {
    return env.NOTIFICATION_EMAIL_PROVIDER ?? env.NOTIFICATION_PROVIDER;
  }
  if (channel === "sms") {
    return env.NOTIFICATION_SMS_PROVIDER ?? env.NOTIFICATION_PROVIDER;
  }
  return env.NOTIFICATION_WHATSAPP_PROVIDER ?? env.NOTIFICATION_PROVIDER;
}

export class SimulatedChannelProvider implements NotificationProvider {
  readonly name = SIMULATED;
  readonly isSimulated = true;
  readonly recorded: OutboundNotification[] = [];
  sendCalls = 0;
  failure: Error | null = null;
  readonly channel: NotificationChannel;

  constructor(channel: NotificationChannel) {
    this.channel = channel;
  }

  async send(message: OutboundNotification): Promise<ProviderSendResult> {
    this.sendCalls += 1;
    this.recorded.push({ ...message });
    if (message.channel !== this.channel) {
      throw new Error("ערוץ ההודעה אינו תואם לספק.");
    }
    if (this.failure) {
      throw this.failure;
    }
    return { providerMessageId: `sim-${this.channel}-${randomUUID()}` };
  }
}

export class RefusedChannelProvider implements NotificationProvider {
  readonly isSimulated = false;
  readonly recorded: OutboundNotification[] = [];
  sendCalls = 0;
  readonly channel: NotificationChannel;
  readonly name: string;

  constructor(channel: NotificationChannel, name: string) {
    this.channel = channel;
    this.name = name;
  }

  async send(message: OutboundNotification): Promise<ProviderSendResult> {
    this.sendCalls += 1;
    this.recorded.push({ ...message });
    throw new Error(`ספק ההודעות ${this.name} אינו מחובר.`);
  }
}

export function createNotificationProvider(
  channel: NotificationChannel,
  env: NotificationProviderEnv = process.env,
): NotificationProvider {
  const name = resolveNotificationProviderName(providerEnvForChannel(channel, env));
  if (name === SIMULATED) {
    return new SimulatedChannelProvider(channel);
  }
  return new RefusedChannelProvider(channel, name);
}

export function createSimulatedProviders() {
  return {
    email: new SimulatedChannelProvider("email"),
    sms: new SimulatedChannelProvider("sms"),
    whatsapp: new SimulatedChannelProvider("whatsapp"),
  } satisfies Record<NotificationChannel, SimulatedChannelProvider>;
}

export function isNotificationChannel(value: string): value is NotificationChannel {
  return (NOTIFICATION_CHANNELS as readonly string[]).includes(value);
}

export function parseNotificationChannels(value: unknown): NotificationChannel[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const seen = new Set<NotificationChannel>();
  for (const item of value) {
    if (typeof item === "string" && isNotificationChannel(item)) {
      seen.add(item);
    }
  }
  return [...seen];
}
