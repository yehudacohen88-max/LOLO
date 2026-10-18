type CreatedAccess = {
  slug: string;
  accessCode: string;
};

let memory: CreatedAccess | null = null;

/** In-memory only. Survives client navigation, not reload, storage, or the URL. */
export function holdCreatedAccess(slug: string, accessCode: string) {
  if (!slug || !accessCode) {
    memory = null;
    return;
  }
  memory = { slug, accessCode };
}

export function peekCreatedAccess(slug: string) {
  if (!memory || memory.slug !== slug) {
    return "";
  }
  return memory.accessCode;
}
