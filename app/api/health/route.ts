import { NextResponse } from "next/server";
import { probeSupabaseRest } from "@/lib/health/database-probe";
import {
  databaseAccess,
  healthHttpStatus,
  runHealthCheck,
  type HealthEnv,
} from "@/lib/health/check";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 5;

function healthEnv(): HealthEnv {
  return {
    vercelEnv: process.env.VERCEL_ENV,
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    allowPreviewDbUrl: process.env.LOLO_ALLOW_PREVIEW_DB_URL,
  };
}

export async function GET() {
  const env = healthEnv();
  const access = databaseAccess(env);
  const report = await runHealthCheck({
    access,
    probe:
      access === "ready"
        ? (signal) =>
            probeSupabaseRest({
              supabaseUrl: env.supabaseUrl ?? "",
              serviceRoleKey: env.serviceRoleKey ?? "",
              signal,
            })
        : undefined,
  });

  return NextResponse.json(report, {
    status: healthHttpStatus(report),
    headers: { "Cache-Control": "no-store" },
  });
}
