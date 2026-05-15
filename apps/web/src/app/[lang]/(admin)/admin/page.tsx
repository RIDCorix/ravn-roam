import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";

import { getDictionary, hasLocale } from "../../dictionaries";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ApiError,
  getDashboardAggregates,
  listVendors,
  type DashboardAggregates,
  type Vendor,
} from "@/lib/api";
import { formatDateTime } from "@/lib/format";

export const dynamic = "force-dynamic";

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

export default async function AdminPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const dict = await getDictionary(lang);

  let agg: DashboardAggregates | null = null;
  let vendors: Vendor[] = [];
  let apiError: string | null = null;
  try {
    [agg, vendors] = await Promise.all([
      getDashboardAggregates(),
      listVendors(),
    ]);
  } catch (err) {
    apiError =
      err instanceof ApiError
        ? `${err.status}: ${err.body.slice(0, 200)}`
        : (err as Error).message;
  }

  const vendorById = new Map(vendors.map((v) => [v.id, v]));
  const currency = agg?.recent_orders[0]?.currency ?? "TWD";
  const totals = agg?.totals;
  const empty = totals && totals.orders === 0;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="t-h3">{dict.admin.dashboard.title}</h1>
        <p className="t-body-sm text-fg-secondary mt-1">
          {dict.admin.dashboard.subtitle}
        </p>
      </header>

      {apiError ? (
        <div className="rounded-md border border-error/30 bg-error-soft text-error text-sm px-4 py-3">
          API unreachable: {apiError}
        </div>
      ) : null}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPI
          label={dict.admin.dashboard.kpi.revenue}
          value={
            totals ? formatMoney(totals.revenue, currency) : "—"
          }
        />
        <KPI
          label={dict.admin.dashboard.kpi.cost}
          value={
            totals ? formatMoney(totals.cost, currency) : "—"
          }
          subtle
        />
        <KPI
          label={dict.admin.dashboard.kpi.margin}
          value={
            totals ? `${(totals.margin * 100).toFixed(1)}%` : "—"
          }
          accent={totals?.margin}
        />
        <KPI
          label={dict.admin.dashboard.kpi.orders}
          value={totals ? String(totals.orders) : "—"}
        />
      </div>

      {empty ? (
        <Card>
          <CardContent className="py-12 text-center">
            <h2 className="t-h5">{dict.admin.dashboard.empty.no_data}</h2>
            <p className="t-body-sm text-fg-secondary mt-2 max-w-md mx-auto">
              {dict.admin.dashboard.empty.no_data_hint}
            </p>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="t-h5">
              {dict.admin.dashboard.sections.top_vendors}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!agg || agg.top_vendors.length === 0 ? (
              <p className="text-sm text-fg-muted py-4">—</p>
            ) : (
              <ul className="space-y-2">
                {agg.top_vendors.map((v) => {
                  const max = agg!.top_vendors[0]!.revenue || 1;
                  const pct = v.revenue / max;
                  return (
                    <li key={v.vendor_id}>
                      <div className="flex items-center justify-between gap-3 text-sm">
                        <Link
                          href={`/${lang}/admin/vendors/${v.vendor_id}`}
                          className="truncate hover:text-accent flex-1"
                        >
                          {v.vendor_name}
                        </Link>
                        <span className="t-mono tabular-nums whitespace-nowrap">
                          {formatMoney(v.revenue, currency)}
                        </span>
                      </div>
                      <div className="mt-1 h-1.5 rounded-full bg-surface-sunken overflow-hidden">
                        <div
                          className="h-full bg-accent"
                          style={{ width: `${pct * 100}%` }}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="t-h5">
              {dict.admin.dashboard.sections.supplier_cost}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!agg || agg.supplier_cost_share.length === 0 ? (
              <p className="text-sm text-fg-muted py-4">—</p>
            ) : (
              <ul className="space-y-2">
                {agg.supplier_cost_share.map((s) => {
                  const max = agg!.supplier_cost_share[0]!.cost || 1;
                  const pct = s.cost / max;
                  return (
                    <li key={s.supplier_id}>
                      <div className="flex items-center justify-between gap-3 text-sm">
                        <Link
                          href={`/${lang}/admin/suppliers/${s.supplier_id}`}
                          className="truncate hover:text-accent flex-1"
                        >
                          {s.supplier_name}
                        </Link>
                        <span className="t-mono tabular-nums text-fg-secondary whitespace-nowrap">
                          {formatMoney(s.cost, currency)}
                        </span>
                      </div>
                      <div className="mt-1 h-1.5 rounded-full bg-surface-sunken overflow-hidden">
                        <div
                          className="h-full bg-fg/30"
                          style={{ width: `${pct * 100}%` }}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="t-h5">
            {dict.admin.dashboard.sections.recent_orders}
          </CardTitle>
          <Button asChild variant="ghost" size="sm" className="h-7 text-xs">
            <Link href={`/${lang}/admin/orders`}>
              {dict.admin.orders.title}
              <ArrowRight className="ml-1 h-3 w-3" />
            </Link>
          </Button>
        </CardHeader>
        <CardContent className="px-0">
          {!agg || agg.recent_orders.length === 0 ? (
            <p className="text-sm text-fg-muted py-4 px-6">—</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs text-fg-secondary border-b border-divider">
                  <tr>
                    <Th>{dict.admin.orders.columns.order_number}</Th>
                    <Th>{dict.admin.orders.columns.vendor}</Th>
                    <Th>{dict.admin.orders.columns.status}</Th>
                    <Th className="text-right">
                      {dict.admin.orders.columns.total}
                    </Th>
                    <Th>{dict.admin.orders.columns.created_at}</Th>
                  </tr>
                </thead>
                <tbody>
                  {agg.recent_orders.map((o) => {
                    const vendor = vendorById.get(o.vendor_id);
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
                          <span className="text-xs">
                            {dict.admin.orders.statuses[o.status]}
                          </span>
                        </Td>
                        <Td className="text-right t-mono tabular-nums">
                          {formatMoney(o.total_amount, o.currency)}
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
          )}
        </CardContent>
      </Card>
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
      className={`px-4 py-2 font-medium whitespace-nowrap ${className}`}
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
  return (
    <td className={`px-4 py-2 whitespace-nowrap ${className}`}>{children}</td>
  );
}

function KPI({
  label,
  value,
  subtle,
  accent,
}: {
  label: string;
  value: string;
  subtle?: boolean;
  accent?: number;
}) {
  return (
    <Card>
      <CardContent className="py-5">
        <p className="t-eyebrow text-fg-muted whitespace-nowrap">{label}</p>
        <p
          className={`mt-2 text-3xl font-semibold tracking-tight tabular-nums whitespace-nowrap ${
            subtle ? "text-fg-secondary" : ""
          } ${
            accent != null && accent >= 0.2
              ? "text-success"
              : accent != null && accent < 0
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
