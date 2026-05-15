import Link from "next/link";
import { notFound } from "next/navigation";

import { getDictionary, hasLocale } from "../../../../dictionaries";

import { ApiError, getOrder } from "@/lib/api";
import { formatDateTime } from "@/lib/format";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

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

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ lang: string; id: string }>;
}) {
  const { lang, id } = await params;
  if (!hasLocale(lang)) notFound();
  const dict = await getDictionary(lang);

  try {
    const { order, items } = await getOrder(id);
    const margin =
      order.total_amount === 0
        ? 0
        : (order.total_amount - order.cost_amount) / order.total_amount;

    return (
      <div className="space-y-6">
        <header>
          <Link
            href={`/${lang}/admin/orders`}
            className="t-eyebrow text-fg-muted hover:text-fg"
          >
            ← {dict.admin.orders.title}
          </Link>
          <h1 className="t-h3 mt-2 t-mono">{order.order_number}</h1>
          <p className="t-body-sm text-fg-secondary mt-1">
            {dict.admin.orders.statuses[order.status]} ·{" "}
            {formatDateTime(order.created_at)}
          </p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <Stat
            label={dict.admin.orders.columns.total}
            value={formatMoney(order.total_amount, order.currency)}
          />
          <Stat
            label={dict.admin.orders.columns.cost}
            value={formatMoney(order.cost_amount, order.currency)}
          />
          <Stat
            label={dict.admin.orders.columns.margin}
            value={`${(margin * 100).toFixed(1)}%`}
          />
          <Stat
            label={dict.admin.orders.columns.customer}
            value={order.customer_email}
          />
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="t-h5">
              {dict.admin.orders.detail.items}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs text-fg-secondary border-b border-divider">
                  <tr>
                    <Th>Supplier plan</Th>
                    <Th>Status</Th>
                    <Th className="text-right">Qty</Th>
                    <Th className="text-right">Unit price</Th>
                    <Th className="text-right">Unit cost</Th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((it) => (
                    <tr
                      key={it.id}
                      className="border-b border-divider last:border-b-0"
                    >
                      <Td>
                        <Link
                          href={`/${lang}/admin/supplier-plans/${it.supplier_plan_id}`}
                          className="t-mono text-xs hover:text-accent"
                        >
                          {it.supplier_plan_id.slice(0, 8)}…
                        </Link>
                      </Td>
                      <Td>
                        <span className="text-xs">{it.status}</span>
                      </Td>
                      <Td className="text-right tabular-nums">{it.qty}</Td>
                      <Td className="text-right t-mono tabular-nums">
                        {formatMoney(it.unit_price, it.currency)}
                      </Td>
                      <Td className="text-right t-mono tabular-nums text-fg-secondary">
                        {formatMoney(it.unit_cost, it.currency)}
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {Object.keys(order.metadata ?? {}).length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle className="t-h5">
                {dict.admin.orders.detail.metadata}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="t-mono text-xs overflow-x-auto rounded-lg bg-surface-sunken p-3">
                {JSON.stringify(order.metadata, null, 2)}
              </pre>
            </CardContent>
          </Card>
        ) : null}
      </div>
    );
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return notFound();
    throw err;
  }
}

function Th({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <th className={`px-4 py-2 font-medium whitespace-nowrap ${className}`}>
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

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="py-4">
        <p className="t-eyebrow text-fg-muted whitespace-nowrap">{label}</p>
        <p className="mt-1 text-xl font-semibold tracking-tight tabular-nums whitespace-nowrap">
          {value}
        </p>
      </CardContent>
    </Card>
  );
}
