import Link from "next/link";
import { notFound } from "next/navigation";

import { getDictionary, hasLocale } from "../../../dictionaries";

import {
  ApiError,
  listOrders,
  listVendors,
  type Order,
  type Vendor,
} from "@/lib/api";
import { formatDateTime } from "@/lib/format";

import {
  Card,
  CardContent,
} from "@/components/ui/card";

export const dynamic = "force-dynamic";

function pickString(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0];
  return v;
}

function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${Math.round(amount)} ${currency}`;
  }
}

function marginPct(o: Order): number {
  if (o.total_amount === 0) return 0;
  return (o.total_amount - o.cost_amount) / o.total_amount;
}

export default async function OrdersPage({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const dict = await getDictionary(lang);
  const sp = await searchParams;

  const filters = {
    q: pickString(sp.q),
    status: pickString(sp.status) as Order["status"] | undefined,
    vendor_id: pickString(sp.vendor_id),
  };

  let orders: Order[] = [];
  let vendors: Vendor[] = [];
  let apiError: string | null = null;
  try {
    [orders, vendors] = await Promise.all([
      listOrders(filters),
      listVendors(),
    ]);
  } catch (err) {
    apiError =
      err instanceof ApiError
        ? `${err.status}: ${err.body.slice(0, 200)}`
        : (err as Error).message;
  }

  const vendorById = new Map(vendors.map((v) => [v.id, v]));

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const monthStart = new Date(todayStart);
  monthStart.setDate(1);
  const todayRev = orders
    .filter(
      (o) =>
        new Date(o.created_at) >= todayStart && o.status !== "cancelled",
    )
    .reduce((s, o) => s + o.total_amount, 0);
  const monthRev = orders
    .filter(
      (o) =>
        new Date(o.created_at) >= monthStart && o.status !== "cancelled",
    )
    .reduce((s, o) => s + o.total_amount, 0);
  const pendingCount = orders.filter((o) => o.status === "pending").length;
  const refundedCount = orders.filter((o) => o.status === "refunded").length;
  const currency = orders[0]?.currency ?? "TWD";

  return (
    <div className="space-y-6">
      <header>
        <h1 className="t-h3">{dict.admin.orders.title}</h1>
        <p className="t-body-sm text-fg-secondary mt-1">
          {dict.admin.orders.subtitle}
        </p>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MiniStat
          label={dict.admin.orders.summary.today_revenue}
          value={formatMoney(todayRev, currency)}
        />
        <MiniStat
          label={dict.admin.orders.summary.month_revenue}
          value={formatMoney(monthRev, currency)}
        />
        <MiniStat
          label={dict.admin.orders.summary.pending}
          value={String(pendingCount)}
          color="warning"
        />
        <MiniStat
          label={dict.admin.orders.summary.refunded}
          value={String(refundedCount)}
          color="error"
        />
      </div>

      <form
        method="GET"
        className="flex flex-wrap items-end gap-3 rounded-2xl border border-divider bg-surface px-4 py-3"
      >
        <div className="flex-1 min-w-[220px]">
          <label className="block text-xs text-fg-secondary mb-1">
            {dict.admin.common.search}
          </label>
          <input
            name="q"
            type="search"
            defaultValue={filters.q ?? ""}
            placeholder={dict.admin.orders.filters.search_placeholder}
            className="w-full rounded-md border border-divider bg-bg px-3 py-1.5 text-sm focus:border-accent focus:outline-none focus:ring-2 focus:ring-[var(--accent-ring)]"
          />
        </div>
        <div>
          <label className="block text-xs text-fg-secondary mb-1">
            {dict.admin.orders.filters.status}
          </label>
          <select
            name="status"
            defaultValue={filters.status ?? ""}
            className="rounded-md border border-divider bg-bg px-2 py-1.5 text-sm"
          >
            <option value="">{dict.admin.common.all}</option>
            <option value="pending">{dict.admin.orders.statuses.pending}</option>
            <option value="paid">{dict.admin.orders.statuses.paid}</option>
            <option value="fulfilled">
              {dict.admin.orders.statuses.fulfilled}
            </option>
            <option value="cancelled">
              {dict.admin.orders.statuses.cancelled}
            </option>
            <option value="refunded">
              {dict.admin.orders.statuses.refunded}
            </option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-fg-secondary mb-1">
            {dict.admin.orders.filters.vendor}
          </label>
          <select
            name="vendor_id"
            defaultValue={filters.vendor_id ?? ""}
            className="rounded-md border border-divider bg-bg px-2 py-1.5 text-sm"
          >
            <option value="">{dict.admin.common.all}</option>
            {vendors.map((v) => (
              <option key={v.id} value={v.id}>
                {v.display_name}
              </option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          className="rounded-md border border-divider bg-surface px-3 py-1.5 text-sm hover:bg-surface-sunken"
        >
          {dict.admin.common.filter}
        </button>
      </form>

      {apiError ? (
        <div className="rounded-md border border-error/30 bg-error-soft text-error text-sm px-4 py-3">
          API unreachable: {apiError}
        </div>
      ) : null}

      {orders.length === 0 && !apiError ? (
        <Card>
          <CardContent className="py-12 text-center text-fg-secondary">
            {dict.admin.orders.no_orders}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="px-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs text-fg-secondary border-b border-divider">
                  <tr>
                    <Th>{dict.admin.orders.columns.order_number}</Th>
                    <Th>{dict.admin.orders.columns.vendor}</Th>
                    <Th>{dict.admin.orders.columns.customer}</Th>
                    <Th>{dict.admin.orders.columns.status}</Th>
                    <Th className="text-right">
                      {dict.admin.orders.columns.total}
                    </Th>
                    <Th className="text-right">
                      {dict.admin.orders.columns.cost}
                    </Th>
                    <Th className="text-right">
                      {dict.admin.orders.columns.margin}
                    </Th>
                    <Th>{dict.admin.orders.columns.created_at}</Th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((o) => {
                    const vendor = vendorById.get(o.vendor_id);
                    const margin = marginPct(o);
                    return (
                      <tr
                        key={o.id}
                        className="border-b border-divider last:border-b-0 hover:bg-surface-sunken transition-colors"
                      >
                        <Td>
                          <Link
                            href={`/${lang}/admin/orders/${o.id}`}
                            className="t-mono text-xs hover:text-accent"
                          >
                            {o.order_number}
                          </Link>
                        </Td>
                        <Td>
                          {vendor ? (
                            <Link
                              href={`/${lang}/admin/vendors/${vendor.id}`}
                              className="hover:text-accent"
                            >
                              {vendor.display_name}
                            </Link>
                          ) : (
                            <span className="text-fg-muted">—</span>
                          )}
                        </Td>
                        <Td>
                          <span className="text-fg-secondary">
                            {o.customer_email}
                          </span>
                        </Td>
                        <Td>
                          <OrderStatusBadge
                            status={o.status}
                            label={dict.admin.orders.statuses[o.status]}
                          />
                        </Td>
                        <Td className="text-right t-mono tabular-nums">
                          {formatMoney(o.total_amount, o.currency)}
                        </Td>
                        <Td className="text-right t-mono tabular-nums text-fg-secondary">
                          {formatMoney(o.cost_amount, o.currency)}
                        </Td>
                        <Td className="text-right t-mono tabular-nums">
                          <span
                            className={
                              margin >= 0.2
                                ? "text-success"
                                : margin >= 0
                                ? "text-fg"
                                : "text-error"
                            }
                          >
                            {(margin * 100).toFixed(1)}%
                          </span>
                        </Td>
                        <Td>
                          <span className="t-mono text-xs text-fg-secondary">
                            {formatDateTime(o.created_at)}
                          </span>
                        </Td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Th({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <th
      className={`px-4 py-3 font-medium whitespace-nowrap ${className}`}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <td className={`px-4 py-3 whitespace-nowrap ${className}`}>{children}</td>;
}

function MiniStat({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color?: "warning" | "error";
}) {
  return (
    <Card>
      <CardContent className="py-4">
        <p className="t-eyebrow text-fg-muted whitespace-nowrap">{label}</p>
        <p
          className={`mt-1 text-2xl font-semibold tracking-tight tabular-nums whitespace-nowrap ${
            color === "warning"
              ? "text-warning"
              : color === "error"
              ? "text-error"
              : ""
          }`}
        >
          {value}
        </p>
      </CardContent>
    </Card>
  );
}

const STATUS_STYLES: Record<Order["status"], string> = {
  pending: "bg-warning-soft text-warning",
  paid: "bg-info-soft text-info",
  fulfilled: "bg-success-soft text-success",
  cancelled: "bg-surface-sunken text-fg-muted",
  refunded: "bg-error-soft text-error",
};

function OrderStatusBadge({
  status,
  label,
}: {
  status: Order["status"];
  label: string;
}) {
  return (
    <span
      className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[status]}`}
    >
      {label}
    </span>
  );
}
