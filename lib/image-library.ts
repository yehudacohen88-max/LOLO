/** Curated celebration photography. Presentation only. See docs/IMAGE_SOURCES.md. */

export const IMAGE_LICENSE = "Pexels License";
export const IMAGE_LICENSE_URL = "https://www.pexels.com/license/";
export const ILLUSTRATIVE_LABEL = "תמונה להמחשה";

export const LIBRARY_CATEGORIES = [
  "birthday",
  "gifts",
  "coffee",
  "travel",
  "flowers",
  "wedding",
  "anniversary",
  "mitzvah",
  "jewelry",
  "festive",
] as const;

export type LibraryCategory = (typeof LIBRARY_CATEGORIES)[number];
export type LibraryRole = "hero" | "card";

export type LibraryImage = {
  id: string;
  slug: string;
  category: LibraryCategory;
  role: LibraryRole;
  file: string;
  avif: string;
  width: number;
  height: number;
  bytes: number;
  avifBytes: number;
  sourceUrl: string;
  photographer: string;
  license: string;
  licenseUrl: string;
  attributionRequired: boolean;
  altHe: string;
};

export const IMAGE_LIBRARY: readonly LibraryImage[] = [
  {
    id: "candles-swirl-hero",
    slug: "candles-swirl",
    category: "birthday",
    role: "hero",
    file: "/images/library/birthday/candles-swirl-hero.webp",
    avif: "/images/library/birthday/candles-swirl-hero.avif",
    width: 1600,
    height: 1200,
    bytes: 40288,
    avifBytes: 36328,
    sourceUrl: "https://www.pexels.com/photo/12065625/",
    photographer: "Towfiqu barbhuiya",
    license: IMAGE_LICENSE,
    licenseUrl: IMAGE_LICENSE_URL,
    attributionRequired: false,
    altHe: "עוגת יום הולדת עם נרות דולקים על רקע תכלת",
  },
  {
    id: "candles-swirl-card",
    slug: "candles-swirl",
    category: "birthday",
    role: "card",
    file: "/images/library/birthday/candles-swirl-card.webp",
    avif: "/images/library/birthday/candles-swirl-card.avif",
    width: 1100,
    height: 733,
    bytes: 22210,
    avifBytes: 20336,
    sourceUrl: "https://www.pexels.com/photo/12065625/",
    photographer: "Towfiqu barbhuiya",
    license: IMAGE_LICENSE,
    licenseUrl: IMAGE_LICENSE_URL,
    attributionRequired: false,
    altHe: "עוגת יום הולדת עם נרות דולקים על רקע תכלת",
  },
  {
    id: "candles-match-hero",
    slug: "candles-match",
    category: "birthday",
    role: "hero",
    file: "/images/library/birthday/candles-match-hero.webp",
    avif: "/images/library/birthday/candles-match-hero.avif",
    width: 1600,
    height: 1200,
    bytes: 35344,
    avifBytes: 36728,
    sourceUrl: "https://www.pexels.com/photo/7600425/",
    photographer: "Thirdman",
    license: IMAGE_LICENSE,
    licenseUrl: IMAGE_LICENSE_URL,
    attributionRequired: false,
    altHe: "הדלקת נרות על עוגת יום הולדת",
  },
  {
    id: "candles-match-card",
    slug: "candles-match",
    category: "birthday",
    role: "card",
    file: "/images/library/birthday/candles-match-card.webp",
    avif: "/images/library/birthday/candles-match-card.avif",
    width: 1100,
    height: 733,
    bytes: 20846,
    avifBytes: 20315,
    sourceUrl: "https://www.pexels.com/photo/7600425/",
    photographer: "Thirdman",
    license: IMAGE_LICENSE,
    licenseUrl: IMAGE_LICENSE_URL,
    attributionRequired: false,
    altHe: "הדלקת נרות על עוגת יום הולדת",
  },
  {
    id: "balloon-party-hero",
    slug: "balloon-party",
    category: "birthday",
    role: "hero",
    file: "/images/library/birthday/balloon-party-hero.webp",
    avif: "/images/library/birthday/balloon-party-hero.avif",
    width: 1600,
    height: 1200,
    bytes: 222480,
    avifBytes: 171680,
    sourceUrl: "https://www.pexels.com/photo/5610382/",
    photographer: "Jonathan Borba",
    license: IMAGE_LICENSE,
    licenseUrl: IMAGE_LICENSE_URL,
    attributionRequired: false,
    altHe: "שולחן יום הולדת צבעוני עם קשת בלונים",
  },
  {
    id: "balloon-party-card",
    slug: "balloon-party",
    category: "birthday",
    role: "card",
    file: "/images/library/birthday/balloon-party-card.webp",
    avif: "/images/library/birthday/balloon-party-card.avif",
    width: 1100,
    height: 733,
    bytes: 112926,
    avifBytes: 83137,
    sourceUrl: "https://www.pexels.com/photo/5610382/",
    photographer: "Jonathan Borba",
    license: IMAGE_LICENSE,
    licenseUrl: IMAGE_LICENSE_URL,
    attributionRequired: false,
    altHe: "שולחן יום הולדת צבעוני עם קשת בלונים",
  },
  {
    id: "pink-heart-cake-hero",
    slug: "pink-heart-cake",
    category: "birthday",
    role: "hero",
    file: "/images/library/birthday/pink-heart-cake-hero.webp",
    avif: "/images/library/birthday/pink-heart-cake-hero.avif",
    width: 1600,
    height: 1200,
    bytes: 110516,
    avifBytes: 96719,
    sourceUrl: "https://www.pexels.com/photo/29282695/",
    photographer: "Beyza",
    license: IMAGE_LICENSE,
    licenseUrl: IMAGE_LICENSE_URL,
    attributionRequired: false,
    altHe: "עוגה ורודה עם לבבות ונרות ליד חלון",
  },
  {
    id: "pink-heart-cake-card",
    slug: "pink-heart-cake",
    category: "birthday",
    role: "card",
    file: "/images/library/birthday/pink-heart-cake-card.webp",
    avif: "/images/library/birthday/pink-heart-cake-card.avif",
    width: 1100,
    height: 733,
    bytes: 53760,
    avifBytes: 48541,
    sourceUrl: "https://www.pexels.com/photo/29282695/",
    photographer: "Beyza",
    license: IMAGE_LICENSE,
    licenseUrl: IMAGE_LICENSE_URL,
    attributionRequired: false,
    altHe: "עוגה ורודה עם לבבות ונרות ליד חלון",
  },
  {
    id: "fruit-cake-hero",
    slug: "fruit-cake",
    category: "birthday",
    role: "hero",
    file: "/images/library/birthday/fruit-cake-hero.webp",
    avif: "/images/library/birthday/fruit-cake-hero.avif",
    width: 1600,
    height: 1200,
    bytes: 127346,
    avifBytes: 119706,
    sourceUrl: "https://www.pexels.com/photo/1721932/",
    photographer: "Dmitry Zvolskiy",
    license: IMAGE_LICENSE,
    licenseUrl: IMAGE_LICENSE_URL,
    attributionRequired: false,
    altHe: "עוגת שכבות עם פירות על שולחן עץ",
  },
  {
    id: "fruit-cake-card",
    slug: "fruit-cake",
    category: "birthday",
    role: "card",
    file: "/images/library/birthday/fruit-cake-card.webp",
    avif: "/images/library/birthday/fruit-cake-card.avif",
    width: 1100,
    height: 733,
    bytes: 55150,
    avifBytes: 48014,
    sourceUrl: "https://www.pexels.com/photo/1721932/",
    photographer: "Dmitry Zvolskiy",
    license: IMAGE_LICENSE,
    licenseUrl: IMAGE_LICENSE_URL,
    attributionRequired: false,
    altHe: "עוגת שכבות עם פירות על שולחן עץ",
  },
  {
    id: "candle-layer-cake-hero",
    slug: "candle-layer-cake",
    category: "birthday",
    role: "hero",
    file: "/images/library/birthday/candle-layer-cake-hero.webp",
    avif: "/images/library/birthday/candle-layer-cake-hero.avif",
    width: 1600,
    height: 1200,
    bytes: 42260,
    avifBytes: 29652,
    sourceUrl: "https://www.pexels.com/photo/33038506/",
    photographer: "Alexander Mass",
    license: IMAGE_LICENSE,
    licenseUrl: IMAGE_LICENSE_URL,
    attributionRequired: false,
    altHe: "עוגת שכבות עם נרות ופרחים על מעמד זכוכית",
  },
  {
    id: "candle-layer-cake-card",
    slug: "candle-layer-cake",
    category: "birthday",
    role: "card",
    file: "/images/library/birthday/candle-layer-cake-card.webp",
    avif: "/images/library/birthday/candle-layer-cake-card.avif",
    width: 1100,
    height: 733,
    bytes: 24254,
    avifBytes: 17232,
    sourceUrl: "https://www.pexels.com/photo/33038506/",
    photographer: "Alexander Mass",
    license: IMAGE_LICENSE,
    licenseUrl: IMAGE_LICENSE_URL,
    attributionRequired: false,
    altHe: "עוגת שכבות עם נרות ופרחים על מעמד זכוכית",
  },
  {
    id: "ribbon-box-hero",
    slug: "ribbon-box",
    category: "gifts",
    role: "hero",
    file: "/images/library/gifts/ribbon-box-hero.webp",
    avif: "/images/library/gifts/ribbon-box-hero.avif",
    width: 1600,
    height: 1200,
    bytes: 107142,
    avifBytes: 93392,
    sourceUrl: "https://www.pexels.com/photo/6045704/",
    photographer: "Skylar Kang",
    license: IMAGE_LICENSE,
    licenseUrl: IMAGE_LICENSE_URL,
    attributionRequired: false,
    altHe: "קופסת מתנה עם סרט אדום ורוד",
  },
  {
    id: "ribbon-box-card",
    slug: "ribbon-box",
    category: "gifts",
    role: "card",
    file: "/images/library/gifts/ribbon-box-card.webp",
    avif: "/images/library/gifts/ribbon-box-card.avif",
    width: 1100,
    height: 733,
    bytes: 46108,
    avifBytes: 39562,
    sourceUrl: "https://www.pexels.com/photo/6045704/",
    photographer: "Skylar Kang",
    license: IMAGE_LICENSE,
    licenseUrl: IMAGE_LICENSE_URL,
    attributionRequired: false,
    altHe: "קופסת מתנה עם סרט אדום ורוד",
  },
  {
    id: "blue-stack-hero",
    slug: "blue-stack",
    category: "gifts",
    role: "hero",
    file: "/images/library/gifts/blue-stack-hero.webp",
    avif: "/images/library/gifts/blue-stack-hero.avif",
    width: 1600,
    height: 1200,
    bytes: 103578,
    avifBytes: 94966,
    sourceUrl: "https://www.pexels.com/photo/264787/",
    photographer: "Pixabay",
    license: IMAGE_LICENSE,
    licenseUrl: IMAGE_LICENSE_URL,
    attributionRequired: false,
    altHe: "ערימת קופסאות מתנה עם סרטי משי",
  },
  {
    id: "blue-stack-card",
    slug: "blue-stack",
    category: "gifts",
    role: "card",
    file: "/images/library/gifts/blue-stack-card.webp",
    avif: "/images/library/gifts/blue-stack-card.avif",
    width: 1100,
    height: 733,
    bytes: 54412,
    avifBytes: 46072,
    sourceUrl: "https://www.pexels.com/photo/264787/",
    photographer: "Pixabay",
    license: IMAGE_LICENSE,
    licenseUrl: IMAGE_LICENSE_URL,
    attributionRequired: false,
    altHe: "ערימת קופסאות מתנה עם סרטי משי",
  },
  {
    id: "pink-bow-hero",
    slug: "pink-bow",
    category: "gifts",
    role: "hero",
    file: "/images/library/gifts/pink-bow-hero.webp",
    avif: "/images/library/gifts/pink-bow-hero.avif",
    width: 1600,
    height: 1200,
    bytes: 135566,
    avifBytes: 147322,
    sourceUrl: "https://www.pexels.com/photo/4886937/",
    photographer: "Leeloo The First",
    license: IMAGE_LICENSE,
    licenseUrl: IMAGE_LICENSE_URL,
    attributionRequired: false,
    altHe: "קופסת מתנה ורודה עם פפיון",
  },
  {
    id: "pink-bow-card",
    slug: "pink-bow",
    category: "gifts",
    role: "card",
    file: "/images/library/gifts/pink-bow-card.webp",
    avif: "/images/library/gifts/pink-bow-card.avif",
    width: 1100,
    height: 733,
    bytes: 49632,
    avifBytes: 50504,
    sourceUrl: "https://www.pexels.com/photo/4886937/",
    photographer: "Leeloo The First",
    license: IMAGE_LICENSE,
    licenseUrl: IMAGE_LICENSE_URL,
    attributionRequired: false,
    altHe: "קופסת מתנה ורודה עם פפיון",
  },
  {
    id: "kitchen-machine-hero",
    slug: "kitchen-machine",
    category: "coffee",
    role: "hero",
    file: "/images/library/coffee/kitchen-machine-hero.webp",
    avif: "/images/library/coffee/kitchen-machine-hero.avif",
    width: 1600,
    height: 1200,
    bytes: 77888,
    avifBytes: 65833,
    sourceUrl: "https://www.pexels.com/photo/5825347/",
    photographer: "Charlotte May",
    license: IMAGE_LICENSE,
    licenseUrl: IMAGE_LICENSE_URL,
    attributionRequired: false,
    altHe: "מכונת אספרסו על שיש במטבח, להמחשה",
  },
  {
    id: "kitchen-machine-card",
    slug: "kitchen-machine",
    category: "coffee",
    role: "card",
    file: "/images/library/coffee/kitchen-machine-card.webp",
    avif: "/images/library/coffee/kitchen-machine-card.avif",
    width: 1100,
    height: 733,
    bytes: 46052,
    avifBytes: 35587,
    sourceUrl: "https://www.pexels.com/photo/5825347/",
    photographer: "Charlotte May",
    license: IMAGE_LICENSE,
    licenseUrl: IMAGE_LICENSE_URL,
    attributionRequired: false,
    altHe: "מכונת אספרסו על שיש במטבח, להמחשה",
  },
  {
    id: "red-cups-hero",
    slug: "red-cups",
    category: "coffee",
    role: "hero",
    file: "/images/library/coffee/red-cups-hero.webp",
    avif: "/images/library/coffee/red-cups-hero.avif",
    width: 1600,
    height: 1200,
    bytes: 67294,
    avifBytes: 59607,
    sourceUrl: "https://www.pexels.com/photo/8271926/",
    photographer: "Diana Smykova",
    license: IMAGE_LICENSE,
    licenseUrl: IMAGE_LICENSE_URL,
    attributionRequired: false,
    altHe: "מכונת אספרסו מוזגת לספל אדום, להמחשה",
  },
  {
    id: "red-cups-card",
    slug: "red-cups",
    category: "coffee",
    role: "card",
    file: "/images/library/coffee/red-cups-card.webp",
    avif: "/images/library/coffee/red-cups-card.avif",
    width: 1100,
    height: 733,
    bytes: 37594,
    avifBytes: 31490,
    sourceUrl: "https://www.pexels.com/photo/8271926/",
    photographer: "Diana Smykova",
    license: IMAGE_LICENSE,
    licenseUrl: IMAGE_LICENSE_URL,
    attributionRequired: false,
    altHe: "מכונת אספרסו מוזגת לספל אדום, להמחשה",
  },
  {
    id: "white-machine-hero",
    slug: "white-machine",
    category: "coffee",
    role: "hero",
    file: "/images/library/coffee/white-machine-hero.webp",
    avif: "/images/library/coffee/white-machine-hero.avif",
    width: 1600,
    height: 1200,
    bytes: 24056,
    avifBytes: 26971,
    sourceUrl: "https://www.pexels.com/photo/38317223/",
    photographer: "Valentin Ivantsov",
    license: IMAGE_LICENSE,
    licenseUrl: IMAGE_LICENSE_URL,
    attributionRequired: false,
    altHe: "מכונת קפה ביתית לבנה עם ספל, להמחשה",
  },
  {
    id: "white-machine-card",
    slug: "white-machine",
    category: "coffee",
    role: "card",
    file: "/images/library/coffee/white-machine-card.webp",
    avif: "/images/library/coffee/white-machine-card.avif",
    width: 1100,
    height: 733,
    bytes: 9616,
    avifBytes: 10984,
    sourceUrl: "https://www.pexels.com/photo/38317223/",
    photographer: "Valentin Ivantsov",
    license: IMAGE_LICENSE,
    licenseUrl: IMAGE_LICENSE_URL,
    attributionRequired: false,
    altHe: "מכונת קפה ביתית לבנה עם ספל, להמחשה",
  },
  {
    id: "tropical-beach-hero",
    slug: "tropical-beach",
    category: "travel",
    role: "hero",
    file: "/images/library/travel/tropical-beach-hero.webp",
    avif: "/images/library/travel/tropical-beach-hero.avif",
    width: 1593,
    height: 1195,
    bytes: 120124,
    avifBytes: 103365,
    sourceUrl: "https://www.pexels.com/photo/1450353/",
    photographer: "Asad Photo Maldives",
    license: IMAGE_LICENSE,
    licenseUrl: IMAGE_LICENSE_URL,
    attributionRequired: false,
    altHe: "חוף טרופי עם דקלים ומים צלולים",
  },
  {
    id: "tropical-beach-card",
    slug: "tropical-beach",
    category: "travel",
    role: "card",
    file: "/images/library/travel/tropical-beach-card.webp",
    avif: "/images/library/travel/tropical-beach-card.avif",
    width: 1100,
    height: 733,
    bytes: 69906,
    avifBytes: 56395,
    sourceUrl: "https://www.pexels.com/photo/1450353/",
    photographer: "Asad Photo Maldives",
    license: IMAGE_LICENSE,
    licenseUrl: IMAGE_LICENSE_URL,
    attributionRequired: false,
    altHe: "חוף טרופי עם דקלים ומים צלולים",
  },
  {
    id: "sunset-beach-hero",
    slug: "sunset-beach",
    category: "travel",
    role: "hero",
    file: "/images/library/travel/sunset-beach-hero.webp",
    avif: "/images/library/travel/sunset-beach-hero.avif",
    width: 1600,
    height: 1200,
    bytes: 148584,
    avifBytes: 108700,
    sourceUrl: "https://www.pexels.com/photo/1032650/",
    photographer: "Travis Rupert",
    license: IMAGE_LICENSE,
    licenseUrl: IMAGE_LICENSE_URL,
    attributionRequired: false,
    altHe: "שקיעה על חוף ים",
  },
  {
    id: "sunset-beach-card",
    slug: "sunset-beach",
    category: "travel",
    role: "card",
    file: "/images/library/travel/sunset-beach-card.webp",
    avif: "/images/library/travel/sunset-beach-card.avif",
    width: 1100,
    height: 733,
    bytes: 67408,
    avifBytes: 49427,
    sourceUrl: "https://www.pexels.com/photo/1032650/",
    photographer: "Travis Rupert",
    license: IMAGE_LICENSE,
    licenseUrl: IMAGE_LICENSE_URL,
    attributionRequired: false,
    altHe: "שקיעה על חוף ים",
  },
  {
    id: "suitcase-flowers-hero",
    slug: "suitcase-flowers",
    category: "travel",
    role: "hero",
    file: "/images/library/travel/suitcase-flowers-hero.webp",
    avif: "/images/library/travel/suitcase-flowers-hero.avif",
    width: 1600,
    height: 1200,
    bytes: 121556,
    avifBytes: 113524,
    sourceUrl: "https://www.pexels.com/photo/29098321/",
    photographer: "Jonathan Borba",
    license: IMAGE_LICENSE,
    licenseUrl: IMAGE_LICENSE_URL,
    attributionRequired: false,
    altHe: "מזוודות וינטג' עם זר פרחים",
  },
  {
    id: "suitcase-flowers-card",
    slug: "suitcase-flowers",
    category: "travel",
    role: "card",
    file: "/images/library/travel/suitcase-flowers-card.webp",
    avif: "/images/library/travel/suitcase-flowers-card.avif",
    width: 1100,
    height: 733,
    bytes: 65264,
    avifBytes: 53655,
    sourceUrl: "https://www.pexels.com/photo/29098321/",
    photographer: "Jonathan Borba",
    license: IMAGE_LICENSE,
    licenseUrl: IMAGE_LICENSE_URL,
    attributionRequired: false,
    altHe: "מזוודות וינטג' עם זר פרחים",
  },
  {
    id: "peach-box-hero",
    slug: "peach-box",
    category: "flowers",
    role: "hero",
    file: "/images/library/flowers/peach-box-hero.webp",
    avif: "/images/library/flowers/peach-box-hero.avif",
    width: 1600,
    height: 1200,
    bytes: 125416,
    avifBytes: 114330,
    sourceUrl: "https://www.pexels.com/photo/931158/",
    photographer: "Secret Garden",
    license: IMAGE_LICENSE,
    licenseUrl: IMAGE_LICENSE_URL,
    attributionRequired: false,
    altHe: "זר פרחים אפרסקי בקופסה ורודה",
  },
  {
    id: "peach-box-card",
    slug: "peach-box",
    category: "flowers",
    role: "card",
    file: "/images/library/flowers/peach-box-card.webp",
    avif: "/images/library/flowers/peach-box-card.avif",
    width: 1100,
    height: 733,
    bytes: 75634,
    avifBytes: 62171,
    sourceUrl: "https://www.pexels.com/photo/931158/",
    photographer: "Secret Garden",
    license: IMAGE_LICENSE,
    licenseUrl: IMAGE_LICENSE_URL,
    attributionRequired: false,
    altHe: "זר פרחים אפרסקי בקופסה ורודה",
  },
  {
    id: "meadow-bouquet-hero",
    slug: "meadow-bouquet",
    category: "flowers",
    role: "hero",
    file: "/images/library/flowers/meadow-bouquet-hero.webp",
    avif: "/images/library/flowers/meadow-bouquet-hero.avif",
    width: 1600,
    height: 1200,
    bytes: 39694,
    avifBytes: 39229,
    sourceUrl: "https://www.pexels.com/photo/30427070/",
    photographer: "Beyzanur K.",
    license: IMAGE_LICENSE,
    licenseUrl: IMAGE_LICENSE_URL,
    attributionRequired: false,
    altHe: "זר פרחים צבעוני עם אורות חמים",
  },
  {
    id: "meadow-bouquet-card",
    slug: "meadow-bouquet",
    category: "flowers",
    role: "card",
    file: "/images/library/flowers/meadow-bouquet-card.webp",
    avif: "/images/library/flowers/meadow-bouquet-card.avif",
    width: 1100,
    height: 733,
    bytes: 23298,
    avifBytes: 22594,
    sourceUrl: "https://www.pexels.com/photo/30427070/",
    photographer: "Beyzanur K.",
    license: IMAGE_LICENSE,
    licenseUrl: IMAGE_LICENSE_URL,
    attributionRequired: false,
    altHe: "זר פרחים צבעוני עם אורות חמים",
  },
  {
    id: "rings-ribbon-hero",
    slug: "rings-ribbon",
    category: "wedding",
    role: "hero",
    file: "/images/library/wedding/rings-ribbon-hero.webp",
    avif: "/images/library/wedding/rings-ribbon-hero.avif",
    width: 1600,
    height: 1200,
    bytes: 38180,
    avifBytes: 34228,
    sourceUrl: "https://www.pexels.com/photo/32147285/",
    photographer: "Busenur Demirkan",
    license: IMAGE_LICENSE,
    licenseUrl: IMAGE_LICENSE_URL,
    attributionRequired: false,
    altHe: "טבעות נישואין בקופסאות עם סרט אדום ופרחים",
  },
  {
    id: "rings-ribbon-card",
    slug: "rings-ribbon",
    category: "wedding",
    role: "card",
    file: "/images/library/wedding/rings-ribbon-card.webp",
    avif: "/images/library/wedding/rings-ribbon-card.avif",
    width: 1100,
    height: 733,
    bytes: 22650,
    avifBytes: 19561,
    sourceUrl: "https://www.pexels.com/photo/32147285/",
    photographer: "Busenur Demirkan",
    license: IMAGE_LICENSE,
    licenseUrl: IMAGE_LICENSE_URL,
    attributionRequired: false,
    altHe: "טבעות נישואין בקופסאות עם סרט אדום ופרחים",
  },
  {
    id: "bouquet-rings-hero",
    slug: "bouquet-rings",
    category: "wedding",
    role: "hero",
    file: "/images/library/wedding/bouquet-rings-hero.webp",
    avif: "/images/library/wedding/bouquet-rings-hero.avif",
    width: 1600,
    height: 1200,
    bytes: 114470,
    avifBytes: 99705,
    sourceUrl: "https://www.pexels.com/photo/7532774/",
    photographer: "Maria Ovchinnikova",
    license: IMAGE_LICENSE,
    licenseUrl: IMAGE_LICENSE_URL,
    attributionRequired: false,
    altHe: "זר כלה וטבעות על בד בהיר",
  },
  {
    id: "bouquet-rings-card",
    slug: "bouquet-rings",
    category: "wedding",
    role: "card",
    file: "/images/library/wedding/bouquet-rings-card.webp",
    avif: "/images/library/wedding/bouquet-rings-card.avif",
    width: 1100,
    height: 733,
    bytes: 46156,
    avifBytes: 42112,
    sourceUrl: "https://www.pexels.com/photo/7532774/",
    photographer: "Maria Ovchinnikova",
    license: IMAGE_LICENSE,
    licenseUrl: IMAGE_LICENSE_URL,
    attributionRequired: false,
    altHe: "זר כלה וטבעות על בד בהיר",
  },
  {
    id: "beach-table-hero",
    slug: "beach-table",
    category: "anniversary",
    role: "hero",
    file: "/images/library/anniversary/beach-table-hero.webp",
    avif: "/images/library/anniversary/beach-table-hero.avif",
    width: 1600,
    height: 1200,
    bytes: 96974,
    avifBytes: 100574,
    sourceUrl: "https://www.pexels.com/photo/27553418/",
    photographer: "Alina Skazka",
    license: IMAGE_LICENSE,
    licenseUrl: IMAGE_LICENSE_URL,
    attributionRequired: false,
    altHe: "שולחן חגיגי על החוף בשקיעה",
  },
  {
    id: "beach-table-card",
    slug: "beach-table",
    category: "anniversary",
    role: "card",
    file: "/images/library/anniversary/beach-table-card.webp",
    avif: "/images/library/anniversary/beach-table-card.avif",
    width: 1100,
    height: 733,
    bytes: 51558,
    avifBytes: 51848,
    sourceUrl: "https://www.pexels.com/photo/27553418/",
    photographer: "Alina Skazka",
    license: IMAGE_LICENSE,
    licenseUrl: IMAGE_LICENSE_URL,
    attributionRequired: false,
    altHe: "שולחן חגיגי על החוף בשקיעה",
  },
  {
    id: "rings-still-hero",
    slug: "rings-still",
    category: "anniversary",
    role: "hero",
    file: "/images/library/anniversary/rings-still-hero.webp",
    avif: "/images/library/anniversary/rings-still-hero.avif",
    width: 1600,
    height: 1200,
    bytes: 38180,
    avifBytes: 34228,
    sourceUrl: "https://www.pexels.com/photo/32147285/",
    photographer: "Busenur Demirkan",
    license: IMAGE_LICENSE,
    licenseUrl: IMAGE_LICENSE_URL,
    attributionRequired: false,
    altHe: "טבעות וסרט אדום על שולחן חגיגי",
  },
  {
    id: "rings-still-card",
    slug: "rings-still",
    category: "anniversary",
    role: "card",
    file: "/images/library/anniversary/rings-still-card.webp",
    avif: "/images/library/anniversary/rings-still-card.avif",
    width: 1100,
    height: 733,
    bytes: 22650,
    avifBytes: 19561,
    sourceUrl: "https://www.pexels.com/photo/32147285/",
    photographer: "Busenur Demirkan",
    license: IMAGE_LICENSE,
    licenseUrl: IMAGE_LICENSE_URL,
    attributionRequired: false,
    altHe: "טבעות וסרט אדום על שולחן חגיגי",
  },
  {
    id: "kiddush-hero",
    slug: "kiddush",
    category: "mitzvah",
    role: "hero",
    file: "/images/library/mitzvah/kiddush-hero.webp",
    avif: "/images/library/mitzvah/kiddush-hero.avif",
    width: 1600,
    height: 1200,
    bytes: 74904,
    avifBytes: 80854,
    sourceUrl: "https://www.pexels.com/photo/4038239/",
    photographer: "cottonbro studio",
    license: IMAGE_LICENSE,
    licenseUrl: IMAGE_LICENSE_URL,
    attributionRequired: false,
    altHe: "גביע קידוש ורימונים על שולחן חגיגי",
  },
  {
    id: "kiddush-card",
    slug: "kiddush",
    category: "mitzvah",
    role: "card",
    file: "/images/library/mitzvah/kiddush-card.webp",
    avif: "/images/library/mitzvah/kiddush-card.avif",
    width: 1100,
    height: 733,
    bytes: 37766,
    avifBytes: 32950,
    sourceUrl: "https://www.pexels.com/photo/4038239/",
    photographer: "cottonbro studio",
    license: IMAGE_LICENSE,
    licenseUrl: IMAGE_LICENSE_URL,
    attributionRequired: false,
    altHe: "גביע קידוש ורימונים על שולחן חגיגי",
  },
  {
    id: "torah-scroll-hero",
    slug: "torah-scroll",
    category: "mitzvah",
    role: "hero",
    file: "/images/library/mitzvah/torah-scroll-hero.webp",
    avif: "/images/library/mitzvah/torah-scroll-hero.avif",
    width: 1600,
    height: 1200,
    bytes: 181950,
    avifBytes: 156886,
    sourceUrl: "https://www.pexels.com/photo/5986495/",
    photographer: "cottonbro studio",
    license: IMAGE_LICENSE,
    licenseUrl: IMAGE_LICENSE_URL,
    attributionRequired: false,
    altHe: "ספר תורה פתוח עם יד לקריאה",
  },
  {
    id: "torah-scroll-card",
    slug: "torah-scroll",
    category: "mitzvah",
    role: "card",
    file: "/images/library/mitzvah/torah-scroll-card.webp",
    avif: "/images/library/mitzvah/torah-scroll-card.avif",
    width: 1100,
    height: 733,
    bytes: 97960,
    avifBytes: 77643,
    sourceUrl: "https://www.pexels.com/photo/5986495/",
    photographer: "cottonbro studio",
    license: IMAGE_LICENSE,
    licenseUrl: IMAGE_LICENSE_URL,
    attributionRequired: false,
    altHe: "ספר תורה פתוח עם יד לקריאה",
  },
  {
    id: "butterfly-necklace-hero",
    slug: "butterfly-necklace",
    category: "jewelry",
    role: "hero",
    file: "/images/library/jewelry/butterfly-necklace-hero.webp",
    avif: "/images/library/jewelry/butterfly-necklace-hero.avif",
    width: 1600,
    height: 1200,
    bytes: 35990,
    avifBytes: 35337,
    sourceUrl: "https://www.pexels.com/photo/27357168/",
    photographer: "Madalina Enache",
    license: IMAGE_LICENSE,
    licenseUrl: IMAGE_LICENSE_URL,
    attributionRequired: false,
    altHe: "שרשרת זהב עדינה על רקע ורוד, להמחשה",
  },
  {
    id: "butterfly-necklace-card",
    slug: "butterfly-necklace",
    category: "jewelry",
    role: "card",
    file: "/images/library/jewelry/butterfly-necklace-card.webp",
    avif: "/images/library/jewelry/butterfly-necklace-card.avif",
    width: 1100,
    height: 733,
    bytes: 20366,
    avifBytes: 19490,
    sourceUrl: "https://www.pexels.com/photo/27357168/",
    photographer: "Madalina Enache",
    license: IMAGE_LICENSE,
    licenseUrl: IMAGE_LICENSE_URL,
    attributionRequired: false,
    altHe: "שרשרת זהב עדינה על רקע ורוד, להמחשה",
  },
  {
    id: "pendant-lights-hero",
    slug: "pendant-lights",
    category: "festive",
    role: "hero",
    file: "/images/library/festive/pendant-lights-hero.webp",
    avif: "/images/library/festive/pendant-lights-hero.avif",
    width: 1423,
    height: 1067,
    bytes: 63166,
    avifBytes: 55459,
    sourceUrl: "https://www.pexels.com/photo/1123262/",
    photographer: "Valeria Boltneva",
    license: IMAGE_LICENSE,
    licenseUrl: IMAGE_LICENSE_URL,
    attributionRequired: false,
    altHe: "נורות חמות תלויות, רקע חגיגי",
  },
  {
    id: "pendant-lights-card",
    slug: "pendant-lights",
    category: "festive",
    role: "card",
    file: "/images/library/festive/pendant-lights-card.webp",
    avif: "/images/library/festive/pendant-lights-card.avif",
    width: 1100,
    height: 733,
    bytes: 42388,
    avifBytes: 36215,
    sourceUrl: "https://www.pexels.com/photo/1123262/",
    photographer: "Valeria Boltneva",
    license: IMAGE_LICENSE,
    licenseUrl: IMAGE_LICENSE_URL,
    attributionRequired: false,
    altHe: "נורות חמות תלויות, רקע חגיגי",
  },
  {
    id: "candle-glow-hero",
    slug: "candle-glow",
    category: "festive",
    role: "hero",
    file: "/images/library/festive/candle-glow-hero.webp",
    avif: "/images/library/festive/candle-glow-hero.avif",
    width: 1600,
    height: 1200,
    bytes: 34164,
    avifBytes: 30283,
    sourceUrl: "https://www.pexels.com/photo/140122/",
    photographer: "freestocks.org",
    license: IMAGE_LICENSE,
    licenseUrl: IMAGE_LICENSE_URL,
    attributionRequired: false,
    altHe: "נרות דולקים באור חם",
  },
  {
    id: "candle-glow-card",
    slug: "candle-glow",
    category: "festive",
    role: "card",
    file: "/images/library/festive/candle-glow-card.webp",
    avif: "/images/library/festive/candle-glow-card.avif",
    width: 1100,
    height: 733,
    bytes: 20820,
    avifBytes: 18907,
    sourceUrl: "https://www.pexels.com/photo/140122/",
    photographer: "freestocks.org",
    license: IMAGE_LICENSE,
    licenseUrl: IMAGE_LICENSE_URL,
    attributionRequired: false,
    altHe: "נרות דולקים באור חם",
  },
];


export type ResolvedImage = {
  kind: "host" | "library" | "illustration";
  src: string;
  avif: string;
  alt: string;
  /** True only for a library default on a gift, never for a host upload. */
  illustrative: boolean;
  category: LibraryCategory | null;
};

export function libraryBySlug(slug: string, role: LibraryRole) {
  const image = IMAGE_LIBRARY.find((item) => item.slug === slug && item.role === role);
  if (!image) {
    throw new Error(`Missing library image ${slug} ${role}`);
  }
  return image;
}

function hashSeed(seed: string) {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/** The birthday cover default. Other birthday photos stay in the library. */
const BIRTHDAY_COVER_SLUG = "candle-layer-cake";

/**
 * Cover for a blank or unmatched type (including אחר). The festive candle
 * photo reads as a memorial. Birthday, wedding, anniversary, and mitzvah
 * keep their own photos.
 */
const UNSET_COVER_SLUG = "balloon-party";

function pick(category: LibraryCategory, role: LibraryRole, seed: string) {
  if (category === "birthday" && role === "hero") {
    const cover = IMAGE_LIBRARY.find(
      (item) => item.slug === BIRTHDAY_COVER_SLUG && item.role === "hero",
    );
    if (cover) {
      return cover;
    }
  }
  const pool = IMAGE_LIBRARY.filter((item) => item.category === category && item.role === role);
  if (pool.length === 0) {
    return null;
  }
  return pool[hashSeed(`${category}|${role}|${seed}`) % pool.length] ?? null;
}

function hostImage(value: string | null | undefined) {
  return value?.trim() ?? "";
}

/**
 * Gift keywords. Order is significant: specific products win before
 * broad travel words, and the Hebrew plural ending ים is never a key.
 * A game console maps to a wrapped gift, not a suitcase.
 */
export function giftCategory(title: string, description = "") {
  const text = `${title} ${description}`.trim();
  if (/קפה|אספרסו|מקיאטו|קפוצ/.test(text)) {
    return "coffee" as const;
  }
  if (/תכשיט|עגיל|שרשרת|צמיד|טבעת|יהלום/.test(text)) {
    return "jewelry" as const;
  }
  if (/קונסול|משחקים|פלייסטיישן|נינטנדו|אקס[\s-]?בוקס|playstation|xbox/i.test(text)) {
    return "gifts" as const;
  }
  if (/חופשה|טיול|טיסה|מלון|מזווד|נופש|ויזה|סופ["״']ש|סופשבוע|סוף שבוע/.test(text)) {
    return "travel" as const;
  }
  if (/פרח|בוקה|ורד|(?:^|\s|[-־])זר(?:\s|$|[-־])/.test(text)) {
    return "flowers" as const;
  }
  if (/חתונה|כלולות|כלה/.test(text)) {
    return "wedding" as const;
  }
  if (/נישואין/.test(text)) {
    return "anniversary" as const;
  }
  if (/עוגה|נרות|בלונ/.test(text)) {
    return "birthday" as const;
  }
  if (/מצווה|מצוה/.test(text)) {
    return "mitzvah" as const;
  }
  return "gifts" as const;
}

export function coverCategory(eventType: string, title: string) {
  const text = `${eventType} ${title}`;
  if (/הולדת|יומולדת|birthday/i.test(text)) {
    return "birthday" as const;
  }
  if (/חתונה|כלולות|wedding/i.test(text)) {
    return "wedding" as const;
  }
  if (/נישואין|anniversary/i.test(text)) {
    return "anniversary" as const;
  }
  if (/מצווה|מצוה/.test(text)) {
    return "mitzvah" as const;
  }
  return "festive" as const;
}

function fromLibrary(category: LibraryCategory, role: LibraryRole, seed: string, illustrative: boolean): ResolvedImage {
  const image = pick(category, role, seed) ?? (category === "gifts" ? null : pick("gifts", role, seed));
  if (!image) {
    return {
      kind: "illustration",
      src: "",
      avif: "",
      alt: "",
      illustrative: false,
      category,
    };
  }
  return {
    kind: "library",
    src: image.file,
    avif: image.avif,
    alt: image.altHe,
    illustrative,
    category: image.category,
  };
}

export function resolveEventCover(input: {
  hostImageUrl?: string | null;
  eventType?: string;
  title?: string;
  alt?: string;
}): ResolvedImage {
  const host = hostImage(input.hostImageUrl);
  if (host) {
    return {
      kind: "host",
      src: host,
      avif: "",
      alt: input.alt?.trim() || "תמונת האירוע",
      illustrative: false,
      category: null,
    };
  }
  const eventType = input.eventType ?? "";
  const title = input.title ?? "";
  const category = coverCategory(eventType, title);
  if (category === "festive") {
    const image = libraryBySlug(UNSET_COVER_SLUG, "hero");
    return {
      kind: "library",
      src: image.file,
      avif: image.avif,
      alt: image.altHe,
      illustrative: false,
      category: image.category,
    };
  }
  return fromLibrary(category, "hero", `${eventType}|${title}`, false);
}

export function resolveGiftImage(input: {
  hostImageUrl?: string | null;
  title: string;
  description?: string;
  alt?: string;
}): ResolvedImage {
  const host = hostImage(input.hostImageUrl);
  if (host) {
    return {
      kind: "host",
      src: host,
      avif: "",
      alt: input.alt?.trim() || input.title || "המתנה",
      illustrative: false,
      category: null,
    };
  }
  const category = giftCategory(input.title, input.description ?? "");
  return fromLibrary(category, "card", `${input.title}|${input.description ?? ""}`, true);
}

/** Known transparent cutout shipped with the bundled demo event. */
export function giftPhotoFit(src: string) {
  if (src.includes("/demo/espresso.png")) {
    return "contain" as const;
  }
  return "cover" as const;
}
