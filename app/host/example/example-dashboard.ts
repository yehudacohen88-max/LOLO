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

const sampleGuests = [
  {
    id: "00000000-0000-4000-8000-0000000000a1",
    eventId: EXAMPLE_EVENT_ID,
    name: "דנה כהן",
    phone: "0501234567",
    createdAt: "2026-10-01T10:00:00.000Z",
    invitePath: "/i/example-dana",
  },
];

/** Static example for screenshots and UI checks. It is not a real event. */
export function exampleDashboardData(view: "sample" | "empty" = "sample"): HostDashboardData {
  const empty = view === "empty";
  return {
    eventId: EXAMPLE_EVENT_ID,
    title: empty ? "אירוע בלי מתנות עדיין" : "יום ההולדת של יובל",
    eventType: "יום הולדת",
    eventDate: empty ? "" : "2026-11-12",
    hostName: "נועה",
    slug: "event-example",
    coverImage: "",
    guestPath: "/e/event-example",
    paidAmount: empty ? 0 : 1800,
    pendingAmount: empty ? 0 : 350,
    paidOrderCount: empty ? 0 : 3,
    pendingOrderCount: empty ? 0 : 1,
    vouchersReady: true,
    invitedGuests: empty ? [] : sampleGuests,
    // Only a hidden test store, so the closed-beta status replaces the voucher picker.
    voucherStores: [
      {
        id: "store-test",
        name: "חנות אופניים - בדיקה",
        logoUrl: null,
        terms,
      },
    ],
    gifts: empty
      ? []
      : [
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
            voucheredAmount: 500,
            availableAmount: 1300,
            vouchers: [
              {
                id: "00000000-0000-4000-8000-0000000000b1",
                amount: 500,
                remainingAmount: 500,
                status: "ISSUED",
                expiresAt: "2027-11-12T00:00:00.000Z",
                storeName: "בית הקפה",
              },
            ],
          },
          {
            id: "gift-open",
            title: "השתתפות פתוחה",
            description: "בלי יעד, כדי שהסכום לא יוצג לאורחים כמטרה.",
            icon: "🎁",
            imageUrl: "",
            storeId: null,
            storeName: "",
            targetAmount: null,
            paidAmount: 0,
            pendingAmount: 0,
            contributorCount: 0,
            percentOfTarget: null,
            voucheredAmount: 0,
            availableAmount: 0,
            vouchers: [],
          },
        ],
    orders: empty
      ? []
      : [
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
          {
            id: "order-michal",
            guestName: "מיכל אברהם",
            guestPhone: "",
            guestEmail: "",
            greetingText: "",
            createdAt: "2026-10-03T11:00:00.000Z",
            totalAmount: 700,
            paymentStatus: "paid",
          },
          {
            id: "order-roni",
            guestName: "רוני חדד",
            guestPhone: "0543332211",
            guestEmail: "roni@example.com",
            greetingText: "מאחלים המון",
            createdAt: "2026-10-04T18:15:00.000Z",
            totalAmount: 600,
            paymentStatus: "paid",
          },
          {
            id: "order-pending",
            guestName: "נועם לוי",
            guestPhone: "",
            guestEmail: "",
            greetingText: "",
            createdAt: "2026-10-05T09:40:00.000Z",
            totalAmount: 350,
            paymentStatus: "pending",
          },
        ],
  };
}

export const EXAMPLE_DASHBOARD_NOTE = "נתוני דוגמה — לא אירוע אמיתי";
