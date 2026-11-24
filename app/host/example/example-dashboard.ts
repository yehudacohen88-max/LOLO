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

function svgDataUrl(width: number, height: number, label: string) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="#21443d"/><rect x="8" y="8" width="${Math.max(1, width - 16)}" height="${Math.max(1, height - 16)}" fill="#ffb84d"/><text x="50%" y="50%" fill="#172f2b" font-size="28" text-anchor="middle" dominant-baseline="middle">${label}</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

const portrait = svgDataUrl(480, 860, "portrait");
const square = svgDataUrl(480, 480, "square");
const wide = svgDataUrl(1400, 280, "wide");
const tiny = svgDataUrl(48, 36, "tiny");

export type ExampleView = "sample" | "empty" | "zero" | "nogoal" | "many" | "ratios";

/** Static example for screenshots and UI checks. It is not a real event. */
export function exampleDashboardData(view: ExampleView = "sample"): HostDashboardData {
  const empty = view === "empty";
  const data: HostDashboardData = {
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
        termsMessage: null,
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

  if (view === "zero") {
    data.title = "אירוע בלי הזמנות";
    data.orders = [];
    data.paidAmount = 0;
    data.pendingAmount = 0;
    data.paidOrderCount = 0;
    data.pendingOrderCount = 0;
    data.gifts = data.gifts.map((gift) => ({
      ...gift,
      paidAmount: 0,
      pendingAmount: 0,
      contributorCount: 0,
      percentOfTarget: gift.targetAmount ? 0 : null,
      voucheredAmount: 0,
      availableAmount: 0,
      vouchers: [],
    }));
  }

  if (view === "nogoal") {
    data.title = "אירוע בלי יעדי מתנות";
    data.gifts = data.gifts.map((gift) => ({
      ...gift,
      targetAmount: null,
      percentOfTarget: null,
    }));
  }

  if (view === "many") {
    data.title = "אירוע עם הרבה השתתפויות";
    data.orders = Array.from({ length: 64 }, (_, index) => ({
      id: `order-many-${index + 1}`,
      guestName:
        index % 5 === 0
          ? `משתתףעםשםארוךמאודבלירווחיםמספר${index + 1}שממלאאתהשורה`
          : `משתתפת מספר ${index + 1} כהן-לוי-אברהם`,
      guestPhone: index % 2 === 0 ? `052${String(1000000 + index)}` : "",
      guestEmail: index % 3 === 0 ? `guest${index + 1}@example.com` : "",
      greetingText: index % 4 === 0 ? "ברכה ארוכה לאירוע, עם מילים רבות שממשיכות על כמה שורות כדי לבדוק את הכרטיס." : "",
      createdAt: "2026-10-06T12:00:00.000Z",
      totalAmount: 100 + index,
      paymentStatus: index % 7 === 0 ? "pending" : "paid",
    }));
    data.paidOrderCount = data.orders.filter((order) => order.paymentStatus === "paid").length;
    data.pendingOrderCount = data.orders.length - data.paidOrderCount;
    data.paidAmount = data.orders
      .filter((order) => order.paymentStatus === "paid")
      .reduce((sum, order) => sum + order.totalAmount, 0);
    data.pendingAmount = data.orders
      .filter((order) => order.paymentStatus === "pending")
      .reduce((sum, order) => sum + order.totalAmount, 0);
  }

  if (view === "ratios") {
    data.title = "תמונות ביחסים שונים";
    data.coverImage = portrait;
    data.gifts = [
      { ...data.gifts[0], id: "gift-square", title: "מתנה מרובעת", imageUrl: square, targetAmount: 1000, percentOfTarget: 20, paidAmount: 200 },
      { ...data.gifts[0], id: "gift-wide", title: "מתנה רחבה", imageUrl: wide, targetAmount: null, percentOfTarget: null, paidAmount: 0, vouchers: [] },
      { ...data.gifts[1], id: "gift-tiny", title: "מתנה קטנה", imageUrl: tiny, targetAmount: 400, percentOfTarget: 50, paidAmount: 200 },
    ];
  }

  return data;
}

export const EXAMPLE_DASHBOARD_NOTE = "נתוני דוגמה — לא אירוע אמיתי";
