import { NextResponse } from "next/server";
import { listActiveStores } from "@/lib/stores/repository";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const stores = await listActiveStores();
    return NextResponse.json({
      stores: stores.map((store) => ({
        id: store.id,
        name: store.name,
      })),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "טעינת החנויות נכשלה.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
