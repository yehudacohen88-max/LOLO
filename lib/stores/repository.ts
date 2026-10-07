import "server-only";
import { getSupabaseServiceClient } from "@/lib/supabase/server";
import type { Store } from "./types";

type StoreRow = {
  id: string;
  name: string;
  slug: string;
  active: boolean;
  created_at: string;
  updated_at: string;
};

function toActiveStore(row: StoreRow): Store | null {
  if (row.active !== true) {
    return null;
  }

  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    active: true,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listActiveStores(): Promise<Store[]> {
  const supabase = getSupabaseServiceClient();
  const { data, error } = await supabase
    .from("stores")
    .select("id, name, slug, active, created_at, updated_at")
    .eq("active", true)
    .order("name", { ascending: true });

  if (error) {
    console.error("[LOLO] listActiveStores error", {
      message: error.message,
      code: error.code,
    });
    throw new Error("טעינת החנויות נכשלה.");
  }

  return (data ?? [])
    .map((row) => toActiveStore(row as StoreRow))
    .filter((store): store is Store => store !== null);
}
