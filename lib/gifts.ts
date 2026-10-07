export const giftCategories = [
  "הכל",
  "חוויות ונופש",
  "לבית",
  "טכנולוגיה",
  "ילדים",
  "אופנה וטיפוח",
  "ספורט ופנאי",
  "אחר",
] as const;

export type GiftCategory = (typeof giftCategories)[number];

export type Gift = {
  id: string;
  name: string;
  description: string;
  price: number;
  category: Exclude<GiftCategory, "הכל">;
  emoji: string;
};

export const gifts: Gift[] = [
  {
    id: "weekend-hotel",
    name: "סופ״ש זוגי במלון",
    description: "לילה או שניים במלון בוטיק, בלי לדאוג לכלום.",
    price: 1500,
    category: "חוויות ונופש",
    emoji: "🏨",
  },
  {
    id: "family-vacation",
    name: "חופשה משפחתית",
    description: "יציאה משפחתית שכולם זוכרים, לא עוד מתנה למגירה.",
    price: 4000,
    category: "חוויות ונופש",
    emoji: "✈️",
  },
  {
    id: "chef-dinner",
    name: "ארוחה במסעדת שף",
    description: "ערב אחד של אוכל מעולה, בלי לבשל ובלי לשטוף.",
    price: 600,
    category: "חוויות ונופש",
    emoji: "🍽️",
  },
  {
    id: "couple-spa",
    name: "יום ספא זוגי",
    description: "עיסוי, שקט וזמן איכות בלי הטלפון באמצע.",
    price: 800,
    category: "חוויות ונופש",
    emoji: "🧖",
  },
  {
    id: "coffee-machine",
    name: "מכונת קפה",
    description: "קפה טוב בבית, כל בוקר מחדש.",
    price: 1500,
    category: "לבית",
    emoji: "☕",
  },
  {
    id: "robot-vacuum",
    name: "שואב אבק רובוטי",
    description: "הרצפה נשארת נקייה בלי לרדוף אחריה.",
    price: 2000,
    category: "לבית",
    emoji: "🤖",
  },
  {
    id: "gas-grill",
    name: "גריל גז",
    description: "שישי בחוץ, בלי עשן של פחמים ובלי לחץ.",
    price: 2500,
    category: "לבית",
    emoji: "🔥",
  },
  {
    id: "kitchen-set",
    name: "סט כלי מטבח",
    description: "כלים יפים ואיכותיים שממש משתמשים בהם.",
    price: 800,
    category: "לבית",
    emoji: "🍳",
  },
  {
    id: "new-phone",
    name: "טלפון חדש",
    description: "שדרוג אמיתי שמחליף את הישן שעובד על נס.",
    price: 3500,
    category: "טכנולוגיה",
    emoji: "📱",
  },
  {
    id: "tablet",
    name: "טאבלט",
    description: "לסרטים, לקריאה ולעבודה מהספה.",
    price: 2000,
    category: "טכנולוגיה",
    emoji: "💻",
  },
  {
    id: "wireless-headphones",
    name: "אוזניות אלחוטיות",
    description: "סאונד טוב בלי כבלים ובלי לחפש אותן במגירה.",
    price: 800,
    category: "טכנולוגיה",
    emoji: "🎧",
  },
  {
    id: "smartwatch",
    name: "שעון חכם",
    description: "ספורט, התראות ושעון אחד במקום שלושה.",
    price: 1500,
    category: "טכנולוגיה",
    emoji: "⌚",
  },
  {
    id: "bicycle",
    name: "אופניים",
    description: "חופש, אוויר וקצת כיף בלי מסך.",
    price: 1200,
    category: "ילדים",
    emoji: "🚲",
  },
  {
    id: "game-console",
    name: "קונסולת משחקים",
    description: "המתנה שגורמת לכל ילד לחייך מיד.",
    price: 2000,
    category: "ילדים",
    emoji: "🎮",
  },
  {
    id: "lego-set",
    name: "ערכת LEGO גדולה",
    description: "בנייה, דמיון ושעות של ריכוז שקט.",
    price: 700,
    category: "ילדים",
    emoji: "🧱",
  },
  {
    id: "kids-choice",
    name: "מתנה לבחירה",
    description: "סכום גמיש לצעצוע או חוויה שהם באמת רוצים.",
    price: 500,
    category: "ילדים",
    emoji: "🎁",
  },
  {
    id: "skincare-set",
    name: "ערכת טיפוח",
    description: "מוצרים איכותיים שמרגישים כמו פינוק אמיתי.",
    price: 450,
    category: "אופנה וטיפוח",
    emoji: "✨",
  },
  {
    id: "fashion-voucher",
    name: "שובר אופנה",
    description: "לקנות בדיוק את מה שמתאים, בלי לנחש מידה.",
    price: 700,
    category: "אופנה וטיפוח",
    emoji: "👗",
  },
  {
    id: "perfume",
    name: "בושם אהוב",
    description: "ניחוח שנשאר, לא עוד פריט שנשכח בארון.",
    price: 550,
    category: "אופנה וטיפוח",
    emoji: "🌸",
  },
  {
    id: "gym-membership",
    name: "מנוי לחדר כושר",
    description: "כמה חודשים של אנרגיה ושגרה בריאה.",
    price: 900,
    category: "ספורט ופנאי",
    emoji: "🏋️",
  },
  {
    id: "camping-kit",
    name: "ערכת קמפינג",
    description: "לילה בחוץ בלי לאלתר ציוד ברגע האחרון.",
    price: 1100,
    category: "ספורט ופנאי",
    emoji: "⛺",
  },
  {
    id: "yoga-set",
    name: "ערכת יוגה",
    description: "מזרן ואביזרים שעושים את האימון בבית נעים יותר.",
    price: 350,
    category: "ספורט ופנאי",
    emoji: "🧘",
  },
  {
    id: "open-voucher",
    name: "שובר מתנה חופשי",
    description: "גמישות מלאה לבחור משהו שלא מופיע ברשימה.",
    price: 400,
    category: "אחר",
    emoji: "🎀",
  },
  {
    id: "charity",
    name: "תרומה לצדקה",
    description: "מתנה עם משמעות, במקום עוד חפץ בבית.",
    price: 300,
    category: "אחר",
    emoji: "💛",
  },
];

export function formatPrice(price: number) {
  return `${price.toLocaleString("he-IL")} ₪`;
}

export function getGiftById(id: string) {
  return gifts.find((gift) => gift.id === id);
}
