import { DEMO_IMAGE_CREDIT, DEMO_SAMPLE_BADGE } from "@/lib/events/demo";

/**
 * Static example for /design-preview/guest only.
 * Gift, title, host, message, amounts, and progress match the bundled demo event.
 * Date, time, and venue are filled in here because the live demo event leaves them blank,
 * and the preview needs those blocks visible. They are not a live event.
 */
export const guestPremiumSample = {
  badge: DEMO_SAMPLE_BADGE,
  credit: DEMO_IMAGE_CREDIT,
  eventType: "יום הולדת",
  dateLabel: "יום שישי, 6 בנובמבר",
  timeLabel: "19:00",
  title: "חוגגים 40 לדנה — מתנה מכל החברים",
  hostName: "נועה",
  message: "השנה החלטנו להפתיע את דנה במשהו שהיא באמת חולמת עליו.",
  venueName: "הבית של נועה",
  address: "דיזנגוף 100, תל אביב",
  coverSrc: "/demo/celebrant.jpg",
  coverAlt: "תמונה לדוגמה לאירוע יום הולדת",
  giftName: "מכונת אספרסו פרימיום",
  giftDescription: "מכונה לבית, מתנה מכל החברים.",
  giftImage: "/demo/espresso.png",
  giftImageAlt: "תמונה לדוגמה של מכונת אספרסו",
  targetAmount: 4800,
  raisedAmount: 3600,
  contributorCount: 18,
  percentOfTarget: 75,
  remainingAmount: 1200,
  amounts: [200, 350, 500] as const,
  defaultAmount: 350,
  guestName: "יעל כהן",
  greeting: "אוהבים ושמחים לחגוג איתך.",
  feeAmount: 0,
  prompts: [
    "מזל טוב! שיהיה יום מלא שמחה.",
    "אוהבים ושמחים לחגוג איתך.",
    "מאחלים שנה של רגעים יפים.",
  ],
} as const;

export const guestPreviewPaths = {
  event: "/design-preview/guest",
  greeting: "/design-preview/guest/greeting",
  payment: "/design-preview/guest/payment",
  thanks: "/design-preview/guest/thank-you",
  missing: "/design-preview/guest/not-found",
} as const;
