// Small date helpers used by trip seeding/rendering. Centralized so the
// few places that compute relative ISO dates don't each invent their own
// off-by-one TZ trap.

export function isoDate(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function addDays(iso: string, n: number): string {
  const [y, m, d] = iso.split("-").map((s) => Number.parseInt(s, 10));
  const date = new Date(Date.UTC(y!, m! - 1, d!));
  date.setUTCDate(date.getUTCDate() + n);
  return isoDate(date);
}
