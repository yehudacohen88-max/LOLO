import { NextResponse } from "next/server";
import type { Db } from "@/lib/desk/db";
import { deskDb, deskError } from "@/lib/desk/http";
import { readStoreSelfProfile, parseStoreSelfPatch, updateStoreSelfProfile } from "@/lib/desk/store-profile";
import { DESK_FORBIDDEN } from "@/lib/desk/messages";
import { getStoreSession } from "@/lib/store/session";

export const dynamic = "force-dynamic";

async function requireStore() {
  return getStoreSession();
}

export async function handleStoreBusinessGet() {
  const session = await requireStore();
  if (!session) {
    return NextResponse.json({ error: DESK_FORBIDDEN }, { status: 401 });
  }
  try {
    const profile = await readStoreSelfProfile(session.storeId);
    if (!profile) {
      return NextResponse.json({ error: "בית העסק לא נמצא." }, { status: 404 });
    }
    return NextResponse.json({ profile });
  } catch (error) {
    return deskError(error, "טעינת הפרטים נכשלה.");
  }
}

export async function handleStoreBusinessPatch(request: Request, db?: Db) {
  const session = await requireStore();
  if (!session) {
    return NextResponse.json({ error: DESK_FORBIDDEN }, { status: 401 });
  }
  try {
    const patch = parseStoreSelfPatch(await request.json());
    await updateStoreSelfProfile(session.storeId, patch, deskDb(db));
    return NextResponse.json({ ok: true });
  } catch (error) {
    return deskError(error, "עדכון הפרטים נכשל.");
  }
}

export function GET() {
  return handleStoreBusinessGet();
}

export function PATCH(request: Request) {
  return handleStoreBusinessPatch(request);
}
