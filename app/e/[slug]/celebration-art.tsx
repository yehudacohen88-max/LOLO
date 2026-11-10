import type { CSSProperties } from "react";
import type {
  ArtKind,
  CelebrationLook,
  GiftMotif,
  OccasionMotif,
} from "./celebration-look";

const INK = "#172F2B";
const CORAL = "#FF6B57";
const YELLOW = "#FFB84D";
const PINK = "#F8AFC3";
const CREAM = "#FFF3E4";

type Bit = {
  x: string;
  y: string;
  color: string;
  size: number;
  rotate: number;
  delay: string;
  shape: "dot" | "ribbon";
};

const BITS: Bit[] = [
  { x: "7%", y: "14%", color: CORAL, size: 10, rotate: 18, delay: "0s", shape: "dot" },
  { x: "18%", y: "72%", color: YELLOW, size: 8, rotate: -12, delay: "0.4s", shape: "ribbon" },
  { x: "78%", y: "10%", color: PINK, size: 12, rotate: 24, delay: "0.2s", shape: "dot" },
  { x: "88%", y: "64%", color: YELLOW, size: 9, rotate: 8, delay: "0.8s", shape: "ribbon" },
  { x: "46%", y: "8%", color: CORAL, size: 7, rotate: -20, delay: "0.15s", shape: "dot" },
  { x: "62%", y: "78%", color: PINK, size: 8, rotate: 16, delay: "0.55s", shape: "ribbon" },
  { x: "30%", y: "18%", color: YELLOW, size: 6, rotate: 0, delay: "0.3s", shape: "dot" },
  { x: "92%", y: "34%", color: CORAL, size: 6, rotate: 28, delay: "0.9s", shape: "dot" },
  { x: "12%", y: "46%", color: PINK, size: 7, rotate: -8, delay: "0.1s", shape: "ribbon" },
  { x: "70%", y: "42%", color: YELLOW, size: 5, rotate: 12, delay: "0.7s", shape: "dot" },
];

function Motif({ kind }: { kind: ArtKind }) {
  return (
    <svg viewBox="0 0 240 168" data-cele="art" aria-hidden="true">
      <ellipse cx="120" cy="148" rx="74" ry="8" fill={INK} opacity="0.1" />
      {kind === "birthday" ? <Birthday /> : null}
      {kind === "wedding" ? <Wedding /> : null}
      {kind === "henna" ? <Henna /> : null}
      {kind === "mitzvah" ? <Mitzvah /> : null}
      {kind === "brit" ? <Brit /> : null}
      {kind === "halake" ? <Halake /> : null}
      {kind === "party" ? <Party /> : null}
      {kind === "coffee" ? <Coffee /> : null}
      {kind === "travel" ? <Travel /> : null}
      {kind === "cake" ? <Cake /> : null}
      {kind === "flowers" ? <Flowers /> : null}
      {kind === "book" ? <Book /> : null}
      {kind === "gift" ? <GiftBox /> : null}
      {kind === "balloons" ? <Balloons /> : null}
    </svg>
  );
}

function Birthday() {
  return (
    <>
      <Balloons small />
      <Cake />
    </>
  );
}

function Cake() {
  return (
    <>
      <rect x="62" y="96" width="116" height="40" rx="12" fill={CORAL} />
      <rect x="74" y="74" width="92" height="32" rx="12" fill={PINK} />
      <rect x="86" y="56" width="68" height="26" rx="10" fill={CREAM} />
      <path
        d="M86 68c8 8 8 8 14 0s8 8 14 0 8 8 14 0 8 8 14 0 8 8 12 0"
        fill="none"
        stroke={YELLOW}
        strokeWidth="4"
        strokeLinecap="round"
      />
      <rect x="104" y="38" width="5" height="20" rx="2" fill={INK} />
      <rect x="118" y="32" width="5" height="26" rx="2" fill={INK} />
      <rect x="132" y="38" width="5" height="20" rx="2" fill={INK} />
      <circle cx="106.5" cy="36" r="3.2" fill={YELLOW} />
      <circle cx="120.5" cy="29" r="3.6" fill={CORAL} />
      <circle cx="134.5" cy="36" r="3.2" fill={YELLOW} />
    </>
  );
}

function Wedding() {
  return (
    <>
      <circle cx="96" cy="84" r="36" fill="none" stroke={CORAL} strokeWidth="11" />
      <circle cx="148" cy="84" r="36" fill="none" stroke={YELLOW} strokeWidth="11" />
      <circle cx="122" cy="84" r="7" fill={PINK} />
    </>
  );
}

function Henna() {
  const petals = Array.from({ length: 8 }, (_, index) => {
    const angle = (index * Math.PI) / 4;
    const cx = 120 + Math.cos(angle) * 40;
    const cy = 82 + Math.sin(angle) * 40;
    return (
      <ellipse
        key={index}
        cx={cx}
        cy={cy}
        rx="14"
        ry="24"
        fill={index % 2 === 0 ? CORAL : PINK}
        transform={`rotate(${index * 45} ${cx} ${cy})`}
      />
    );
  });
  return (
    <>
      <circle cx="120" cy="82" r="58" fill="none" stroke={YELLOW} strokeWidth="3" />
      {petals}
      <circle cx="120" cy="82" r="16" fill={YELLOW} />
      <circle cx="120" cy="82" r="7" fill={INK} />
    </>
  );
}

function Mitzvah() {
  return (
    <>
      <polygon
        points="120,28 136,68 178,68 144,94 158,136 120,110 82,136 96,94 62,68 104,68"
        fill={YELLOW}
      />
      <polygon
        points="120,48 130,74 156,74 135,90 144,116 120,100 96,116 105,90 84,74 110,74"
        fill={CREAM}
      />
      <path d="M34 130c22-36 34-22 20 10" fill={INK} />
      <path d="M28 124c24-6 30 12 8 16" fill={PINK} />
      <path d="M206 130c-22-36-34-22-20 10" fill={INK} />
      <circle cx="120" cy="88" r="6" fill={CORAL} />
    </>
  );
}

function Brit() {
  return (
    <>
      <path
        d="M58 118c18-62 106-62 124 0"
        fill="none"
        stroke={PINK}
        strokeWidth="16"
        strokeLinecap="round"
      />
      <path
        d="M78 112c12-36 72-36 84 0"
        fill={CREAM}
        stroke={INK}
        strokeWidth="3"
      />
      <circle cx="120" cy="46" r="10" fill={YELLOW} />
      <path d="M120 28l2.2 6.2h6.4l-5.2 3.8 2 6.2-5.4-3.8-5.4 3.8 2-6.2-5.2-3.8h6.4z" fill={CORAL} />
    </>
  );
}

function Halake() {
  return (
    <>
      <path
        d="M58 46c22 8 18 28 34 24"
        fill="none"
        stroke={CORAL}
        strokeWidth="8"
        strokeLinecap="round"
      />
      <path
        d="M78 36c16 14 8 32 26 28"
        fill="none"
        stroke={PINK}
        strokeWidth="8"
        strokeLinecap="round"
      />
      <path
        d="M96 28c14 16 6 34 24 26"
        fill="none"
        stroke={YELLOW}
        strokeWidth="8"
        strokeLinecap="round"
      />
      <rect x="118" y="78" width="70" height="10" rx="4" fill={INK} />
      <rect x="128" y="88" width="50" height="36" rx="8" fill={CREAM} stroke={INK} strokeWidth="3" />
      <path d="M176 70c8 8 8 20 0 28" fill="none" stroke={YELLOW} strokeWidth="4" strokeLinecap="round" />
      <circle cx="176" cy="66" r="6" fill={YELLOW} />
    </>
  );
}

function Party() {
  return (
    <>
      <Balloons />
      <g transform="translate(18 36) scale(0.72)">
        <GiftBox />
      </g>
    </>
  );
}

function Balloons({ small = false }: { small?: boolean }) {
  const shift = small ? "translate(150 8) scale(0.55)" : "";
  return (
    <g transform={shift}>
      <ellipse cx="78" cy="62" rx="22" ry="28" fill={CORAL} />
      <ellipse cx="120" cy="50" rx="24" ry="30" fill={YELLOW} />
      <ellipse cx="162" cy="64" rx="22" ry="28" fill={PINK} />
      <path d="M78 90c4 16 2 24 8 36" fill="none" stroke={INK} strokeWidth="2" />
      <path d="M120 80c2 18-2 28 0 46" fill="none" stroke={INK} strokeWidth="2" />
      <path d="M162 92c-4 14 0 24-6 34" fill="none" stroke={INK} strokeWidth="2" />
    </g>
  );
}

function GiftBox() {
  return (
    <>
      <rect x="68" y="72" width="104" height="64" rx="10" fill={CORAL} />
      <rect x="112" y="72" width="16" height="64" fill={YELLOW} />
      <rect x="68" y="96" width="104" height="16" fill={YELLOW} />
      <path d="M120 72c-16-28-46-22-36-4 8 8 24 8 36 4z" fill={PINK} />
      <path d="M120 72c16-28 46-22 36-4-8 8-24 8-36 4z" fill={PINK} />
      <circle cx="120" cy="74" r="7" fill={YELLOW} />
    </>
  );
}

function Coffee() {
  return (
    <>
      <path
        d="M86 30c8 12-8 14 0 24M108 22c10 14-10 16 0 28"
        fill="none"
        stroke={PINK}
        strokeWidth="4"
        strokeLinecap="round"
      />
      <rect x="62" y="64" width="92" height="78" rx="16" fill={INK} />
      <rect x="74" y="50" width="68" height="24" rx="10" fill={CREAM} />
      <circle cx="124" cy="62" r="5" fill={CORAL} />
      <rect x="154" y="86" width="34" height="12" rx="6" fill={INK} />
      <path d="M84 112h48v20a16 16 0 0 1-16 16h-16a16 16 0 0 1-16-16z" fill={CORAL} />
      <ellipse cx="108" cy="112" rx="24" ry="7" fill={YELLOW} />
      <circle cx="186" cy="124" r="14" fill={YELLOW} />
    </>
  );
}

function Travel() {
  return (
    <>
      <circle cx="178" cy="42" r="18" fill={YELLOW} />
      <rect x="48" y="70" width="132" height="74" rx="16" fill={CREAM} stroke={INK} strokeWidth="4" />
      <path d="M96 70v-16a18 18 0 0 1 36 0V70" fill="none" stroke={INK} strokeWidth="4" />
      <rect x="48" y="100" width="132" height="16" fill={CORAL} />
      <circle cx="148" cy="124" r="8" fill={YELLOW} stroke={INK} strokeWidth="3" />
    </>
  );
}

function Flowers() {
  return (
    <>
      <path d="M78 140V86M120 140V70M162 140V90" stroke={INK} strokeWidth="3" />
      <circle cx="78" cy="74" r="16" fill={PINK} />
      <circle cx="78" cy="74" r="6" fill={YELLOW} />
      <circle cx="120" cy="56" r="18" fill={CORAL} />
      <circle cx="120" cy="56" r="7" fill={CREAM} />
      <circle cx="162" cy="76" r="16" fill={YELLOW} />
      <circle cx="162" cy="76" r="6" fill={CORAL} />
      <path d="M64 112c-16 4-18 18-4 18M176 116c16 2 18 16 2 16" fill={INK} />
    </>
  );
}

function Book() {
  return (
    <>
      <path d="M48 46h72c8 10 8 70 0 82H48z" fill={CORAL} />
      <path d="M192 46H120c-8 10-8 70 0 82h72z" fill={PINK} />
      <path d="M120 46v82" stroke={INK} strokeWidth="4" />
      <rect x="62" y="64" width="40" height="6" rx="3" fill={YELLOW} />
      <rect x="62" y="78" width="46" height="4" rx="2" fill={CREAM} />
      <rect x="138" y="64" width="40" height="6" rx="3" fill={YELLOW} />
      <rect x="132" y="78" width="46" height="4" rx="2" fill={CREAM} />
    </>
  );
}

export function CelebrationConfetti({ look }: { look: CelebrationLook }) {
  const bits = look === "bold" ? BITS : BITS.filter((_, index) => index % 2 === 0);
  return (
    <div data-cele="confetti" aria-hidden="true">
      {bits.map((bit, index) => (
        <span
          key={`${bit.x}-${index}`}
          data-cele="bit"
          data-shape={bit.shape}
          style={
            {
              insetInlineStart: bit.x,
              top: bit.y,
              background: bit.color,
              width: bit.size,
              height: bit.shape === "ribbon" ? Math.max(4, bit.size * 0.42) : bit.size,
              animationDelay: bit.delay,
              ["--cele-spin" as string]: `${bit.rotate}deg`,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}

export function FestiveStage({
  occasion,
  look,
}: {
  occasion: OccasionMotif;
  look: CelebrationLook;
}) {
  return (
    <div data-cele="festive" data-occasion={occasion} data-tone={look} aria-hidden="true">
      <Motif kind={occasion} />
    </div>
  );
}

export function GiftMedallion({
  motif,
  look,
}: {
  motif: GiftMotif;
  look: CelebrationLook;
}) {
  return (
    <div data-cele="medallion" data-motif={motif} data-tone={look} aria-hidden="true">
      <Motif kind={motif} />
    </div>
  );
}
