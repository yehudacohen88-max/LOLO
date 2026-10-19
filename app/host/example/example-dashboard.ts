import type { HostDashboardData } from "@/lib/host/dashboard";
import type { VoucherTerms } from "@/lib/vouchers/terms";

const EXAMPLE_EVENT_ID = "00000000-0000-4000-8000-0000000000e1";

const terms: VoucherTerms = {
  validityDays: 365,
  allowPartialRedemption: false,
  allowCustomerTopup: false,
  redemptionMethod: "הצגת השובר בחנות",
  validityIsDefault: true,
  partialIsDefault: true,
  topupIsDefault: true,
  methodIsDefault: true,
};

/** Static example for screenshots and UI checks. It is not a real event. */
export function exampleDashboardData(): HostDashboardData {
  return {
    eventId: EXAMPLE_EVENT_ID,
    title: "יום ההולדת של יובל",
    eventType: "יום הולדת",
    eventDate: "2026-11-12",
    hostName: "נועה",
    slug: "event-example",
    guestPath: "/e/event-example",
    paidAmount: 1800,
    pendingAmount: 350,
    paidOrderCount: 4,
    pendingOrderCount: 1,
    vouchersReady: true,
    invitedGuests: [
      {
        id: "00000000-0000-4000-8000-0000000000a1",
        eventId: EXAMPLE_EVENT_ID,
        name: "דנה כהן",
        phone: "0501234567",
        createdAt: "2026-10-01T10:00:00.000Z",
        invitePath: "/i/example-dana",
      },
    ],
    // Only a hidden test store, so the closed-beta status replaces the voucher picker.
    voucherStores: [
      {
        id: "store-test",
        name: "חנות אופניים - בדיקה",
        logoUrl: null,
        terms,
      },
    ],
    gifts: [
      {
        id: "gift-example",
        title: "מכונת אספרסו",
        description: "מתנה לדוגמה בלבד.",
        icon: "🎁",
        imageUrl: "",
        storeId: null,
        storeName: "",
        targetAmount: 4800,
        paidAmount: 1800,
        pendingAmount: 350,
        contributorCount: 4,
        percentOfTarget: 38,
        voucheredAmount: 0,
        availableAmount: 1800,
        vouchers: [],
      },
    ],
    orders: [
      {
        id: "order-example",
        guestName: "יוסי לוי",
        guestPhone: "0521112233",
        guestEmail: "",
        greetingText: "יום הולדת שמח!",
        createdAt: "2026-10-02T15:30:00.000Z",
        totalAmount: 500,
        paymentStatus: "paid",
      },
    ],
  };
}

export const EXAMPLE_DASHBOARD_NOTE = "נתוני דוגמה — לא אירוע אמיתי";
