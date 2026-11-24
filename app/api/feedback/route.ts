import { NextResponse } from "next/server";
import {
  PILOT_FEEDBACK_CLOSED,
  PILOT_FEEDBACK_INVALID,
  parsePilotFeedback,
} from "@/lib/pilot/feedback";
import { insertPilotFeedback, pilotFeedbackTableReady } from "@/lib/pilot/feedback-store";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!(await pilotFeedbackTableReady())) {
    return NextResponse.json({ error: PILOT_FEEDBACK_CLOSED }, { status: 503 });
  }

  try {
    const input = parsePilotFeedback(await request.json());
    await insertPilotFeedback(input);
  } catch (error) {
    const message =
      error instanceof Error && /[\u0590-\u05FF]/.test(error.message)
        ? error.message
        : PILOT_FEEDBACK_INVALID;
    return NextResponse.json({ error: message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
