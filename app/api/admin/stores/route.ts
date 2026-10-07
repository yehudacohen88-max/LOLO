import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin/session";
import { parseAdminStoreInput } from "@/lib/admin/store-input";
import { createAdminStore } from "@/lib/admin/stores";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "אין הרשאה." }, { status: 401 });
  }

  try {
    const store = await createAdminStore(parseAdminStoreInput(await request.json()));
    return NextResponse.json({ id: store.id });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "שמירת בית העסק נכשלה.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
