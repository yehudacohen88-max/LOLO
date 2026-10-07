"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import GiftMedia from "@/components/gift-media";
import {
  deleteDraftGift,
  loadDraftGifts,
  moveDraftGift,
  setDraftGiftStore,
  type DraftGift,
} from "@/lib/draft-gifts";
import { formatPrice } from "@/lib/gifts";
import {
  fetchActiveStoreOptions,
  type ActiveStoreOption,
} from "@/lib/stores/active-stores-client";
import { useIsClient } from "@/lib/use-is-client";

export default function OrganizeGifts() {
  const router = useRouter();
  const isClient = useIsClient();
  const [gifts, setGifts] = useState<DraftGift[]>([]);
  const [stores, setStores] = useState<ActiveStoreOption[]>([]);
  const [storesReady, setStoresReady] = useState(false);
  const [storesNote, setStoresNote] = useState("");
  const [pendingDeleteId, setPendingDeleteId] = useState("");
  const [ready, setReady] = useState(false);

  if (isClient && !ready) {
    setGifts(loadDraftGifts());
    setReady(true);
  }

  useEffect(() => {
    if (!ready) {
      return;
    }

    let cancelled = false;

    void (async () => {
      try {
        const nextStores = await fetchActiveStoreOptions();
        if (cancelled) {
          return;
        }
        setStores(nextStores);
        setStoresReady(true);
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

  function moveGift(id: string, direction: -1 | 1) {
    setGifts(moveDraftGift(id, direction));
    setPendingDeleteId("");
  }

  function removeGift(id: string) {
    deleteDraftGift(id);
    setGifts(loadDraftGifts());
    setPendingDeleteId("");
  }

  if (!ready) {
    return <p className="mt-10 text-center text-sm text-muted">טוענים את המתנות...</p>;
  }

  return (
    <div className="mt-8 flex flex-col gap-4">
      <Link
        href="/create-event/gifts/custom"
        className="inline-flex h-12 w-full items-center justify-center rounded-full bg-brand px-6 text-base font-semibold text-white transition-colors hover:bg-brand-hover"
      >
        הוספת מתנה משלכם
      </Link>
      <Link
        href="/create-event/gifts/catalog"
        className="inline-flex h-12 w-full items-center justify-center rounded-full border border-border bg-white px-6 text-base font-semibold text-foreground transition-colors hover:bg-brand-soft"
      >
        רעיונות להשראה
      </Link>

      {!storesReady ? (
        <p className="text-center text-sm text-muted">טוענים חנויות...</p>
      ) : null}
      {storesNote ? <p className="text-center text-sm text-muted">{storesNote}</p> : null}

      {gifts.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-border bg-white px-6 py-10 text-center">
          <p className="text-4xl" aria-hidden>
            🎁
          </p>
          <h2 className="mt-4 text-lg font-bold text-foreground">עדיין אין מתנות</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            הוסיפו מתנה שהייתם שמחים לקבל: שם, תמונה ויעד. אפשר גם להתחיל מרעיון
            מוכן ולהתאים אותו.
          </p>
        </div>
      ) : (
        <ol className="flex flex-col gap-3">
          {gifts.map((gift, index) => {
            const selectedStoreId = gift.storeId ?? "";
            const storeMissing =
              storesReady &&
              Boolean(selectedStoreId) &&
              !stores.some((store) => store.id === selectedStoreId);

            return (
              <li
                key={gift.id}
                className="rounded-3xl border border-border bg-white p-4"
              >
                <div className="flex items-start gap-3">
                  <GiftMedia
                    imageUrl={gift.imageUrl}
                    icon={gift.icon}
                    alt=""
                    className="h-16 w-16 text-2xl"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-xs font-semibold text-brand">
                          עדיפות {index + 1}
                        </p>
                        <p className="font-bold text-foreground">{gift.title}</p>
                      </div>
                      <p className="shrink-0 text-sm font-semibold text-brand">
                        {formatPrice(gift.targetAmount)}
                      </p>
                    </div>
                    {gift.description ? (
                      <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-muted">
                        {gift.description}
                      </p>
                    ) : null}
                  </div>
                </div>

                <label className="mt-3 flex flex-col gap-1">
                  <span className="text-xs font-semibold text-muted">חנות</span>
                  <select
                    value={selectedStoreId}
                    onChange={(event) => {
                      const storeId = event.target.value || null;
                      setGifts(setDraftGiftStore(gift.id, storeId));
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

                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => moveGift(gift.id, -1)}
                    disabled={index === 0}
                    className="rounded-full border border-border px-3 py-1 text-xs font-semibold text-foreground disabled:opacity-30"
                  >
                    למעלה
                  </button>
                  <button
                    type="button"
                    onClick={() => moveGift(gift.id, 1)}
                    disabled={index === gifts.length - 1}
                    className="rounded-full border border-border px-3 py-1 text-xs font-semibold text-foreground disabled:opacity-30"
                  >
                    למטה
                  </button>
                  <Link
                    href={`/create-event/gifts/custom?id=${encodeURIComponent(gift.id)}`}
                    className="rounded-full border border-border px-3 py-1 text-xs font-semibold text-foreground hover:bg-brand-soft"
                  >
                    עריכה
                  </Link>
                  {pendingDeleteId === gift.id ? (
                    <button
                      type="button"
                      onClick={() => removeGift(gift.id)}
                      className="rounded-full bg-brand px-3 py-1 text-xs font-semibold text-white"
                    >
                      אישור מחיקה
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setPendingDeleteId(gift.id)}
                      className="rounded-full border border-border px-3 py-1 text-xs font-semibold text-foreground"
                    >
                      מחיקה
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}

      <button
        type="button"
        disabled={gifts.length === 0}
        onClick={() => router.push("/create-event/details")}
        className="inline-flex h-12 w-full items-center justify-center rounded-full bg-brand px-6 text-base font-semibold text-white transition-colors hover:bg-brand-hover disabled:cursor-not-allowed disabled:bg-brand/40 disabled:hover:bg-brand/40"
      >
        ממשיכים
      </button>
      {gifts.length === 0 ? (
        <p className="text-center text-sm text-muted">הוסיפו לפחות מתנה אחת כדי להמשיך.</p>
      ) : null}
    </div>
  );
}
