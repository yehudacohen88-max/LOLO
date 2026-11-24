import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin/session";
import { listDocuments } from "@/lib/invoices/repository";
import { jsonAdminError, isUuid, parseListLimit } from "@/lib/notifications/http";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "אין הרשאה." }, { status: 401 });
  }

  const url = new URL(request.url);
  const orderId = url.searchParams.get("orderId")?.trim() ?? "";
  if (orderId && !isUuid(orderId)) {
    return NextResponse.json({ error: "מזהה הזמנה אינו תקין." }, { status: 400 });
  }

  try {
    const documents = await listDocuments({
      limit: parseListLimit(url.searchParams.get("limit")),
      orderId: orderId || undefined,
    });
    return NextResponse.json({ documents });
  } catch (error) {
    return jsonAdminError(error, "טעינת המסמכים נכשלה.");
  }
}
