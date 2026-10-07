import { NextResponse } from "next/server";
import { loadEventFunding } from "@/lib/funding/public-progress";
import { caughtErrorBody } from "@/lib/security/required-secret";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ slug: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { slug } = await context.params;

  try {
    const funding = await loadEventFunding(slug);
    if (!funding) {
      return NextResponse.json({ error: "האירוע לא נמצא." }, { status: 404 });
    }

    return NextResponse.json({
      gifts: funding.gifts.map((gift) => ({
        giftId: gift.giftId,
        raisedAmount: gift.raisedAmount,
        contributorCount: gift.contributorCount,
        percentOfTarget: gift.percentOfTarget,
      })),
    });
  } catch (error) {
    const body = caughtErrorBody(error, "טעינת ההתקדמות נכשלה.", 500);
    return NextResponse.json({ error: body.error }, { status: body.status });
  }
}
