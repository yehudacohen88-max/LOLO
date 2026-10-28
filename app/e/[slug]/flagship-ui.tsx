"use client";

/* Host-uploaded image URLs are arbitrary, so next/image remote patterns cannot cover them. */
/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import LoloMark from "@/app/design/lolo-mark";
import { formatGiftAmount } from "@/lib/guest-draft";
import styles from "./flagship.module.css";

function useSvgId(prefix: string) {
  return `${prefix}${useId().replace(/:/g, "")}`;
}

export function EventMark() {
  return (
    <span className={styles.eventMark} aria-hidden="true">
      <SatinBow className={styles.eventMarkBow} mark />
    </span>
  );
}

export function Wordmark() {
  return (
    <Link href="/" className={styles.wordmark}>
      <LoloMark />
    </Link>
  );
}

export function GiftFallback({ compact = false }: { compact?: boolean }) {
  return (
    <div
      className={`${styles.giftFallback} ${compact ? styles.giftFallbackCompact : ""}`}
      data-gift-fallback=""
      aria-hidden="true"
    >
      <GiftIcon />
    </div>
  );
}

export function EmptyCover({
  monogram,
  compact = false,
}: {
  monogram: string;
  compact?: boolean;
}) {
  return (
    <div
      className={`${styles.portrait} ${styles.portraitEmpty} ${compact ? styles.portraitCompact : ""}`}
    >
      <div className={styles.fallback} aria-hidden="true">
        <span className={styles.fallbackRibbon} />
        <SatinBow className={styles.fallbackBow} mark />
        <span className={styles.monogram} data-empty-letter="">
          {monogram}
        </span>
      </div>
      {compact ? null : <CornerRibbon still />}
    </div>
  );
}

export function GiftIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
      <rect
        x="3"
        y="10"
        width="18"
        height="10"
        rx="2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path d="M3 14.5h18M12 10v10" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M12 10c-1.8-3.6-6.2-3.8-6.2-1.2C5.8 10.2 8.6 10 12 10z" fill="currentColor" />
      <path d="M12 10c1.8-3.6 6.2-3.8 6.2-1.2C18.2 10.2 15.4 10 12 10z" fill="currentColor" />
    </svg>
  );
}

export function LockIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" aria-hidden="true">
      <rect
        x="4.5"
        y="11"
        width="15"
        height="10"
        rx="2.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="M8 11V7.5a4 4 0 0 1 8 0V11"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function SatinBow({ className, mark = false }: { className?: string; mark?: boolean }) {
  const band = useSvgId("band");
  const tail = useSvgId("tail");
  return (
    <svg
      className={className}
      viewBox="0 0 120 150"
      aria-hidden="true"
      {...(mark ? { "data-empty-bow": "" } : {})}
    >
      <defs>
        <linearGradient id={band} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FF907C" />
          <stop offset="0.5" stopColor="#F2553F" />
          <stop offset="1" stopColor="#C9361F" />
        </linearGradient>
        <linearGradient id={tail} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#C9361F" />
          <stop offset="0.4" stopColor="#F7644D" />
          <stop offset="0.6" stopColor="#FF8C77" />
          <stop offset="1" stopColor="#D63E2A" />
        </linearGradient>
      </defs>
      <path d="M56 46 C46 70 30 96 34 142 L43 132 L50 145 C47 104 59 76 63 50 Z" fill={`url(#${tail})`} />
      <path d="M64 46 C75 72 93 98 88 144 L80 134 L71 145 C76 104 66 77 57 50 Z" fill={`url(#${tail})`} />
      <path d="M60 44 C40 10 6 8 8 30 C10 50 40 52 60 44Z" fill={`url(#${band})`} />
      <path d="M60 44 C80 10 114 8 112 30 C110 50 80 52 60 44Z" fill={`url(#${band})`} />
      <path d="M58 44 C44 22 22 20 20 31 C24 40 42 44 58 44Z" fill="#B42E1A" opacity=".32" />
      <path d="M62 44 C76 22 98 20 100 31 C96 40 78 44 62 44Z" fill="#B42E1A" opacity=".32" />
      <path d="M15 24 C23 14 40 16 50 30" stroke="#fff" strokeOpacity=".5" strokeWidth="2.4" fill="none" strokeLinecap="round" />
      <path d="M105 24 C97 14 80 16 70 30" stroke="#fff" strokeOpacity=".3" strokeWidth="2.4" fill="none" strokeLinecap="round" />
      <rect x="51" y="35" width="18" height="19" rx="6" fill="#E3462F" />
      <rect x="54" y="37" width="8" height="4" rx="2" fill="#fff" opacity=".4" />
    </svg>
  );
}

export function CornerRibbon({
  still = false,
  small = false,
  untie = false,
  center = false,
}: {
  still?: boolean;
  small?: boolean;
  untie?: boolean;
  center?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const band = useSvgId("wrap");
  useEffect(() => {
    if (still) {
      return;
    }
    const node = ref.current;
    if (!node || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }
    node.style.willChange = "clip-path, transform";
    const timer = window.setTimeout(() => {
      node.style.willChange = "auto";
    }, 800);
    return () => window.clearTimeout(timer);
  }, [still]);

  return (
    <div
      ref={ref}
      className={`${styles.ribbon} ${small ? styles.ribbonSm : ""} ${still ? styles.ribbonStill : ""} ${untie || center ? styles.ribbonUntie : ""}`}
      aria-hidden="true"
    >
      <svg className={`${styles.ribbonBand} ${untie ? styles.untieBand : ""}`} viewBox="0 0 120 120">
        <defs>
          <linearGradient id={band} x1="0" y1="1" x2="1" y2="0">
            <stop offset="0" stopColor="#C9361F" />
            <stop offset="0.35" stopColor="#F2553F" />
            <stop offset="0.62" stopColor="#FF8C77" />
            <stop offset="1" stopColor="#D63E2A" />
          </linearGradient>
        </defs>
        <path d="M0 74 L74 0 H120 L0 120 Z" fill={`url(#${band})`} />
        <path d="M0 74 L74 0" stroke="#fff" strokeOpacity="0.4" strokeWidth="1.5" />
      </svg>
      <SatinBow className={`${styles.ribbonBow} ${untie ? styles.untieBow : ""}`} />
    </div>
  );
}

export function Portrait({
  src,
  alt,
  hostName,
  nameOnChip = true,
  objectPosition = "center 28%",
}: {
  src: string;
  alt: string;
  monogram: string;
  hostName: string;
  nameOnChip?: boolean;
  objectPosition?: string;
}) {
  const [broken, setBroken] = useState(false);
  const showPhoto = Boolean(src) && !broken;

  return (
    <div className={`${styles.portrait} ${showPhoto ? "" : styles.portraitEmpty}`}>
      {showPhoto ? (
        <img
          src={src}
          alt={alt}
          className={styles.photo}
          data-portrait=""
          width={800}
          height={1000}
          style={{ objectPosition }}
          fetchPriority="high"
          decoding="async"
          onError={() => setBroken(true)}
        />
      ) : (
        <GiftFallback />
      )}
      {hostName && nameOnChip ? (
        <p className={styles.host}>
          <span>{`הזמנה מאת ${hostName}`}</span>
        </p>
      ) : null}
    </div>
  );
}

export function GiftScene({
  src,
  alt,
  primary = false,
}: {
  src: string;
  alt: string;
  primary?: boolean;
  untie?: boolean;
}) {
  const [broken, setBroken] = useState(false);
  const showPhoto = Boolean(src) && !broken;

  return (
    <div
      className={`${styles.scene} ${showPhoto ? "" : styles.sceneEmpty}`}
      data-gift-scene={primary ? "" : undefined}
    >
      <div className={styles.sceneLight} aria-hidden="true" />
      <div className={styles.sceneEdge} aria-hidden="true" />
      {showPhoto ? (
        <div className={styles.sceneStage}>
          <img
            src={src}
            alt={alt}
            className={styles.sceneImage}
            data-gift-photo=""
            decoding="async"
            onError={() => setBroken(true)}
          />
        </div>
      ) : (
        <GiftFallback />
      )}
    </div>
  );
}

export function WishThumb({ src }: { src: string }) {
  const [broken, setBroken] = useState(false);
  const showPhoto = Boolean(src) && !broken;
  return (
    <span className={styles.wishThumb}>
      {showPhoto ? (
        <img src={src} alt="" decoding="async" onError={() => setBroken(true)} />
      ) : (
        <GiftIcon />
      )}
    </span>
  );
}

function holdAmount(value: number) {
  if (typeof window === "undefined" || value <= 0 || document.hidden) {
    return true;
  }
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function CountAmount({ value }: { value: number }) {
  const hold = holdAmount(value);
  const [shown, setShown] = useState(0);

  useEffect(() => {
    if (hold) {
      return;
    }
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / 900);
      const stepped = Math.round(progress * 12) / 12;
      setShown(document.hidden ? value : value * stepped);
      if (progress < 1 && !document.hidden) {
        frame = requestAnimationFrame(tick);
      }
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [hold, value]);

  return <>{formatGiftAmount(hold ? value : shown)}</>;
}

export function ProgressRibbon({
  percent,
  label,
}: {
  percent: number;
  label: string;
}) {
  const ratio = Math.min(1, Math.max(0, percent / 100));
  return (
    <div
      className={styles.rib}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={Math.max(100, percent)}
      aria-valuenow={percent}
      aria-valuetext={label}
      aria-label="התקדמות המתנה"
      style={{ ["--fs-p" as string]: String(ratio) }}
    >
      <div className={styles.track} />
      <div className={styles.fill} />
      <svg className={styles.goal} viewBox="0 0 40 30" aria-hidden="true">
        <path
          d="M20 15 C13 3 2 3 3 10 C4 17 13 17 20 15Z M20 15 C27 3 38 3 37 10 C36 17 27 17 20 15Z"
          fill="#fff"
          stroke="#E87563"
          strokeWidth="1.5"
        />
        <circle cx="20" cy="15" r="3" fill="#E87563" opacity="0.55" />
      </svg>
    </div>
  );
}

export function GiftReveal({
  label,
  caption,
  image,
  cover,
  funding,
  untie = true,
}: {
  label: string;
  caption?: string;
  image?: string;
  cover?: string;
  funding?: string;
  untie?: boolean;
}) {
  return (
    <div className={styles.revealStage} data-reveal="">
      <GiftScene src={image || ""} alt={label || "המתנה"} untie={untie} />
      <div className={styles.revealMeta}>
        {cover ? (
          <img
            className={styles.revealCover}
            src={cover}
            alt=""
            width={72}
            height={90}
          />
        ) : (
          <GiftFallback compact />
        )}
        <div className={styles.revealCopy}>
          <p className={styles.revealCard} data-reveal-card="">
            {label}
          </p>
          {caption ? <p className={styles.revealCaption}>{caption}</p> : null}
          {funding ? <p className={styles.revealFunding}>{funding}</p> : null}
        </div>
      </div>
    </div>
  );
}

export function Frame({ children }: { children: ReactNode }) {
  return (
    <>
      <header className={styles.header}>
        <Wordmark />
      </header>
      {children}
    </>
  );
}
