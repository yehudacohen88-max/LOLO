const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeHostEmail(value: string) {
  const email = value.trim().toLowerCase();
  if (!email || email.length > 200 || !EMAIL.test(email)) {
    return "";
  }
  return email;
}

export function maskEmail(email: string) {
  const normalized = normalizeHostEmail(email);
  const at = normalized.indexOf("@");
  if (at <= 0) {
    return "";
  }
  return `${normalized.slice(0, 1)}***@${normalized.slice(at + 1)}`;
}

export type HostEventSummary = {
  id: string;
  title: string;
  date: string;
  slug: string;
};

export function toHostEventSummary(row: {
  id: string;
  title: string;
  event_date: string;
  slug: string;
}) {
  return {
    id: row.id,
    title: row.title,
    date: row.event_date,
    slug: row.slug,
  };
}
