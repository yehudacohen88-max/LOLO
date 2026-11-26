import {
  previewAllowsDatabaseUrl,
  type PreviewDatabaseEnv,
} from "@/lib/supabase/preview-guard";

/** Bound for one dependency. The route also sets maxDuration above this. */
export const HEALTH_TIMEOUT_MS = 3000;

export type DatabaseAccess = "ready" | "not_configured" | "disconnected";

export type HealthComponentState =
  | "ok"
  | "not_configured"
  | "disconnected"
  | "timeout"
  | "error";

export type HealthReport = {
  status: "ok" | "unavailable";
  components: {
    app: { status: "ok" };
    database: {
      status: HealthComponentState;
      latencyMs?: number;
    };
  };
};

export type HealthEnv = PreviewDatabaseEnv & {
  supabaseUrl?: string;
  serviceRoleKey?: string;
};

export class HealthTimeoutError extends Error {
  constructor() {
    super("health check timed out");
    this.name = "HealthTimeoutError";
  }
}

function configured(value: string | undefined) {
  return Boolean(value?.trim());
}

/**
 * Decide whether a database probe is allowed.
 * Preview with no credentials is `not_configured`.
 * Preview that still points at a refused database is `disconnected`.
 * Neither case opens a socket.
 */
export function databaseAccess(env: HealthEnv): DatabaseAccess {
  const hasCredentials =
    configured(env.supabaseUrl) && configured(env.serviceRoleKey);
  if ((env.vercelEnv ?? "") !== "preview") {
    return hasCredentials ? "ready" : "not_configured";
  }
  if (!hasCredentials) {
    return "not_configured";
  }
  const allowed = previewAllowsDatabaseUrl(env.supabaseUrl ?? "", {
    vercelEnv: "preview",
    allowPreviewDbUrl: env.allowPreviewDbUrl,
  });
  return allowed ? "ready" : "disconnected";
}

export function withTimeout<T>(
  work: (signal: AbortSignal) => Promise<T>,
  ms: number,
): Promise<T> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new HealthTimeoutError());
    }, ms);
  });

  const attempt = Promise.resolve()
    .then(() => work(controller.signal))
    .then(
      (value) => value,
      (error: unknown) => {
        if (controller.signal.aborted) {
          throw new HealthTimeoutError();
        }
        throw error;
      },
    );

  // Promise.race leaves the loser pending. Swallow that later rejection.
  void attempt.then(
    () => undefined,
    () => undefined,
  );
  void timeout.then(
    () => undefined,
    () => undefined,
  );

  return Promise.race([attempt, timeout]).finally(() => {
    clearTimeout(timer);
  });
}

function report(
  database: HealthComponentState,
  latencyMs?: number,
): HealthReport {
  return {
    status: database === "ok" ? "ok" : "unavailable",
    components: {
      app: { status: "ok" },
      database:
        latencyMs === undefined ? { status: database } : { status: database, latencyMs },
    },
  };
}

export async function runHealthCheck(input: {
  access: DatabaseAccess;
  probe?: (signal: AbortSignal) => Promise<void>;
  timeoutMs?: number;
}): Promise<HealthReport> {
  if (input.access !== "ready") {
    return report(input.access);
  }
  if (!input.probe) {
    return report("error", 0);
  }

  const started = Date.now();
  try {
    await withTimeout(input.probe, input.timeoutMs ?? HEALTH_TIMEOUT_MS);
    return report("ok", Math.max(0, Date.now() - started));
  } catch (error) {
    const latencyMs = Math.max(0, Date.now() - started);
    if (error instanceof HealthTimeoutError) {
      return report("timeout", latencyMs);
    }
    return report("error", latencyMs);
  }
}

export function healthHttpStatus(result: HealthReport): 200 | 503 {
  return result.status === "ok" ? 200 : 503;
}
