export type ActiveStoreOption = {
  id: string;
  name: string;
};

export async function fetchActiveStoreOptions(): Promise<ActiveStoreOption[]> {
  const response = await fetch("/api/stores");
  const payload = (await response.json()) as {
    stores?: ActiveStoreOption[];
  };

  if (!response.ok) {
    throw new Error("stores");
  }

  if (!Array.isArray(payload.stores)) {
    return [];
  }

  return payload.stores.filter(
    (store) =>
      Boolean(store) &&
      typeof store.id === "string" &&
      typeof store.name === "string" &&
      store.name.trim().length > 0,
  );
}
