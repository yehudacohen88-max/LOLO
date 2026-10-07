import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin/session";
import { isUuid } from "@/lib/vouchers/input";
import { jsonFromError } from "@/lib/vouchers/http";
import {
  getStoreAccessStatus,
  rotateStoreAccessCode,
} from "@/lib/vouchers/repository";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ storeId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "אין הרשאה." }, { status: 401 });
  }
  const { storeId } = await context.params;
  if (!isUuid(storeId)) {
    return NextResponse.json({ error: "בית העסק לא נמצא." }, { status: 404 });
  }

  try {
    return NextResponse.json(await getStoreAccessStatus(storeId));
  } catch (error) {
    return jsonFromError(error, "טעינת קוד הכניסה נכשלה.");
  }
}

export async function POST(_request: Request, context: RouteContext) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "אין הרשאה." }, { status: 401 });
  }
  const { storeId } = await context.params;
  if (!isUuid(storeId)) {
    return NextResponse.json({ error: "בית העסק לא נמצא." }, { status: 404 });
  }

  try {
    const code = await rotateStoreAccessCode(storeId);
    return NextResponse.json({ code });
  } catch (error) {
    return jsonFromError(error, "יצירת קוד הכניסה נכשלה.");
  }
}
