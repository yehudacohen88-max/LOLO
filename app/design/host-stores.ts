/**
 * Hides test stores from the regular host gift and voucher pickers.
 *
 * No database or API change. `/api/stores` currently returns only `id` and
 * `name` (see app/api/stores/route.ts). The store record has no test flag.
 *
 * A store is hidden when either:
 * 1. The payload already carries a truthy test flag (`test`, `isTest`, or
 *    `is_test`). Extra fields are kept if a response includes them; this
 *    client does not add them.
 * 2. Otherwise the name matches a test label: it contains "בדיקה" or "טסט",
 *    or the Latin word "test" (so "חנות אופניים - בדיקה" is hidden and
 *    "testing" is not).
 *
 * A store that was already chosen and is hidden by this rule is cleared in
 * the picker so a new save does not keep pointing at it. Stores missing from
 * the payload entirely are left to the existing "inactive store" message.
 */

type StoreLike = {
  name?: string | null;
  test?: unknown;
  isTest?: unknown;
  is_test?: unknown;
};

function hasTestFlag(store: StoreLike) {
  return store.test === true || store.isTest === true || store.is_test === true;
}

export function isHiddenTestStore(store: StoreLike) {
  if (hasTestFlag(store)) {
    return true;
  }

  const name = (store.name ?? "").trim();
  if (!name) {
    return false;
  }

  return /בדיקה|טסט/i.test(name) || /\btest\b/i.test(name);
}

export function visibleHostStores<T extends StoreLike>(stores: T[]) {
  return stores.filter((store) => !isHiddenTestStore(store));
}
