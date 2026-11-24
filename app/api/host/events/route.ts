import { NextResponse } from "next/server";
import { listLinkedHostEvents, readIdentitySession } from "@/lib/host/identity-server";
import { caughtErrorBody } from "@/lib/security/required-secret";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await readIdentitySession();
  if (!session) {
    return NextResponse.json({ error: "אין הרשאה." }, { status: 401 });
  }

  try {
    const events = await listLinkedHostEvents(session.identityId);
    return NextResponse.json({ events });
  } catch (error) {
    const body = caughtErrorBody(error, "טעינת האירועים נכשלה.", 500);
    return NextResponse.json({ error: body.error }, { status: body.status });
  }
}
