// Display helpers shared across admin pages.

export function formatData(mb: number): string {
  if (mb === -1) return "∞";
  if (mb % 1024 === 0) return `${mb / 1024} GB`;
  return `${mb} MB`;
}

export function formatValidity(days: number): string {
  return `${days}d`;
}

export function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${amount} ${currency}`;
  }
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toISOString().replace("T", " ").slice(0, 16);
}
