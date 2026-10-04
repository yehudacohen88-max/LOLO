"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  formatPrice,
  loadSelectedGiftChoices,
  loadSelectedGifts,
  saveSelectedGiftIds,
  saveSelectedGiftStore,
  type Gift,
} from "@/lib/gifts";
import { useIsClient } from "@/lib/use-is-client";

type ActiveStoreOption = {
  id: string;
  name: string;
};

export default function OrganizeGifts() {
  const router = useRouter();
  const isClient = useIsClient();
  const [selectedGifts, setSelectedGifts] = useState<Gift[]>([]);
  const [storeIds, setStoreIds] = useState<Record<string, string | null>>({});
  const [stores, setStores] = useState<ActiveStoreOption[]>([]);
  const [storesReady, setStoresReady] = useState(false);
  const [storesNote, setStoresNote] = useState("");
  const [ready, setReady] = useState(false);

  if (isClient && !ready) {
    const choices = loadSelectedGiftChoices();
    setSelectedGifts(loadSelectedGifts());
    setStoreIds(
      Object.fromEntries(choices.map((choice) => [choice.giftId, choice.storeId])),
    );
    setReady(true);
  }

  useEffect(() => {
    if (!ready) {
      return;
    }

    let cancelled = false;

    void (async () => {
      try {
        const response = await fetch("/api/stores");
        const payload = (await response.json()) as {
          stores?: ActiveStoreOption[];
        };
        if (cancelled) {
          return;
        }
        const nextStores = Array.isArray(payload.stores)
          ? payload.stores.filter(
              (store) =>
                Boolean(store) &&
                typeof store.id === "string" &&
                typeof store.name === "string" &&
                store.name.trim().length > 0,
            )
          : [];
        setStores(nextStores);
        setStoresReady(true);
        if (!response.ok) {
          setStoresNote("לא ניתן לטעון את רשימת החנויות. אפשר להמשיך בלי חנות.");
          return;
        }
        if (nextStores.length === 0) {
          setStoresNote("אין כרגע חנויות פעילות. אפשר להמשיך בלי חנות.");
        }
      } catch {
        if (!cancelled) {
          setStores([]);
          setStoresReady(true);
          setStoresNote("לא ניתן לטעון את רשימת החנויות. אפשר להמשיך בלי חנות.");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [ready]);

  function moveGift(index: number, direction: -1 | 1) {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= selectedGifts.length) {
      return;
    }

    const next = [...selectedGifts];
    const [gift] = next.splice(index, 1);
    next.splice(nextIndex, 0, gift);
    setSelectedGifts(next);
    saveSelectedGiftIds(next.map((item) => item.id));
  }

  function continueToDetails() {
    saveSelectedGiftIds(selectedGifts.map((gift) => gift.id));
    router.push("/create-event/details");
  }

  if (!ready) {
    return null;
  }

  if (selectedGifts.length === 0) {
    return (
      <div className="mt-10 rounded-3xl border border-border bg-white p-6 text-center">
        <p className="text-base text-muted">עדיין לא נבחרו מתנות.</p>
        <Link
          href="/create-event/gifts/catalog"
          className="mt-5 inline-flex h-12 w-full items-center justify-center rounded-full bg-brand px-6 text-base font-semibold text-white transition-colors hover:bg-brand-hover"
        >
          חזרה לקטלוג
        </Link>
      </div>
    );
  }

  return (
    <>
      {storesNote ? (
        <p className="mt-8 text-center text-sm text-muted">{storesNote}</p>
      ) : null}
      <ol className={`${storesNote ? "mt-4" : "mt-10"} flex flex-col gap-3`}>
        {selectedGifts.map((gift, index) => {
          const selectedStoreId = storeIds[gift.id] ?? "";
          const storeMissing =
            storesReady &&
            Boolean(selectedStoreId) &&
            !stores.some((store) => store.id === selectedStoreId);

          return (
          <li
            key={gift.id}
            className="flex items-start gap-3 rounded-3xl border border-border bg-white p-4"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-soft text-sm font-bold text-brand">
              {index + 1}
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-bold text-foreground">{gift.name}</p>
              <p className="mt-1 text-sm text-brand">{formatPrice(gift.price)}</p>
              <label className="mt-3 flex flex-col gap-1">
                <span className="text-xs font-semibold text-muted">חנות</span>
                <select
                  value={selectedStoreId}
                  onChange={(event) => {
                    const storeId = event.target.value || null;
                    setStoreIds((current) => ({ ...current, [gift.id]: storeId }));
                    saveSelectedGiftStore(gift.id, storeId);
                  }}
                  className="h-11 rounded-2xl border border-border bg-white px-3 text-sm text-foreground outline-none focus:border-brand"
                >
                  <option value="">בלי חנות</option>
                  {stores.map((store) => (
                    <option key={store.id} value={store.id}>
                      {store.name}
                    </option>
                  ))}
                </select>
              </label>
              {storeMissing ? (
                <p className="mt-1 text-xs text-brand">החנות שנבחרה אינה פעילה.</p>
              ) : null}
            </div>
            <div className="flex shrink-0 flex-col gap-2">
              <button
                type="button"
                onClick={() => moveGift(index, -1)}
                disabled={index === 0}
                className="rounded-full border border-border px-3 py-1 text-xs font-semibold text-foreground disabled:opacity-30"
              >
                למעלה
              </button>
              <button
                type="button"
                onClick={() => moveGift(index, 1)}
                disabled={index === selectedGifts.length - 1}
                className="rounded-full border border-border px-3 py-1 text-xs font-semibold text-foreground disabled:opacity-30"
              >
                למטה
              </button>
            </div>
          </li>
          );
        })}
      </ol>

      <button
        type="button"
        onClick={continueToDetails}
        className="mt-8 inline-flex h-12 w-full items-center justify-center rounded-full bg-brand px-6 text-base font-semibold text-white transition-colors hover:bg-brand-hover"
      >
        ממשיכים
      </button>
    </>
  );
}
