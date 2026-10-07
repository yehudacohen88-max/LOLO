import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin/session";
import { parseActiveFlag, parseAdminStoreInput } from "@/lib/admin/store-input";
import { setAdminStoreActive, updateAdminStore } from "@/lib/admin/stores";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ storeId: string }>;
};

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

export async function PATCH(request: Request, context: RouteContext) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "אין הרשאה." }, { status: 401 });
  }

  const { storeId } = await context.params;
  if (!isUuid(storeId)) {
    return NextResponse.json({ error: "בית העסק לא נמצא." }, { status: 404 });
  }

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const keys = Object.keys(body);
    if (keys.length === 1 && keys[0] === "active") {
      await setAdminStoreActive(storeId, parseActiveFlag(body));
      return NextResponse.json({ ok: true });
    }

    const store = await updateAdminStore(storeId, parseAdminStoreInput(body));
    return NextResponse.json({ id: store.id });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "עדכון בית העסק נכשל.";
    const status = message === "בית העסק לא נמצא." ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
