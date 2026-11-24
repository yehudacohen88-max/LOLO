import "server-only";
import { getSupabaseServiceClient } from "@/lib/supabase/server";
import type { PilotFeedbackInput } from "@/lib/pilot/feedback";

export async function pilotFeedbackTableReady() {
  try {
    const supabase = getSupabaseServiceClient();
    const { error } = await supabase.from("pilot_feedback").select("id").limit(1);
    if (error) {
      console.error("[LOLO] pilot feedback unavailable", { code: error.code ?? "" });
      return false;
    }
    return true;
  } catch (error) {
    console.error("[LOLO] pilot feedback unavailable", {
      name: error instanceof Error ? error.name : "Error",
    });
    return false;
  }
}

export async function insertPilotFeedback(input: PilotFeedbackInput) {
  const supabase = getSupabaseServiceClient();
  const { error } = await supabase.from("pilot_feedback").insert({
    role: input.role,
    device: input.device,
    completed: input.completed,
    clarity: input.clarity,
    demo_payment_clear: input.demoPaymentClear,
    would_use: input.wouldUse,
    notes: input.notes,
  });
  if (error) {
    console.error("[LOLO] pilot feedback insert", { code: error.code ?? "" });
    throw new Error("לא הצלחנו לשמור את המשוב.");
  }
}
