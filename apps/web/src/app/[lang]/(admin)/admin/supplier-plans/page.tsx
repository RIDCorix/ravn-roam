import Link from "next/link";
import { notFound } from "next/navigation";

import type { SupplierPlan } from "@roam/catalog";

import { getDictionary, hasLocale } from "../../../dictionaries";

import { ApiError, listSupplierPlans } from "@/lib/api";
import { formatData, formatDateTime, formatValidity } from "@/lib/format";

export const dynamic = "force-dynamic";

// Regulation doc §7 step 2a: admin scans available supplier plans, picks one,
// and follows the "Use as primary →" link to /products/new?from_plan=<id> for
// step 2b (auto-prefill from the chosen plan).
export default async function SupplierPlansPage({
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
    country: pickString(sp.country)?.toUpperCase(),
    q: pickString(sp.q),
    available_only: pickString(sp.available_only) !== "false",
  };

  let plans: SupplierPlan[] = [];
  let apiError: string | null = null;
  try {
    plans = await listSupplierPlans(filters);
  } catch (err) {
    apiError =
      err instanceof ApiError
        ? `${err.status}: ${err.body.slice(0, 200)}`
        : (err as Error).message;
  }

  return (
    <div>
      <header className="mb-6">
        <h1 className="text-2xl font-semibold">{dict.admin.supplier_plans.title}</h1>
      </header>

      <form
        method="GET"
        className="flex flex-wrap items-end gap-3 mb-4 rounded border border-border bg-surface px-4 py-3"
      >
        <div>
          <label className="block text-xs text-fg-secondary mb-1">
            {dict.admin.supplier_plans.filters.country}
          </label>
          <input
            name="country"
            type="text"
            maxLength={2}
            defaultValue={filters.country ?? ""}
            className="rounded border border-border bg-bg px-2 py-1 text-sm w-24 uppercase"
          />
        </div>
        <div className="flex-1 min-w-[200px]">
          <label className="block text-xs text-fg-secondary mb-1">
            {dict.admin.common.search}
          </label>
          <input
            name="q"
            type="search"
            defaultValue={filters.q ?? ""}
            placeholder={dict.admin.supplier_plans.filters.search_placeholder}
            className="w-full rounded border border-border bg-bg px-2 py-1 text-sm"
          />
        </div>
        <div className="flex items-center gap-2">
          <input
            id="available_only"
            name="available_only"
            type="checkbox"
            defaultChecked={filters.available_only}
            value="true"
          />
          <label htmlFor="available_only" className="text-xs text-fg-secondary">
            {dict.admin.supplier_plans.filters.available_only}
          </label>
        </div>
        <button
          type="submit"
          className="rounded border border-border bg-bg px-3 py-1.5 text-sm hover:border-border-strong"
        >
          {dict.admin.common.filter}
        </button>
      </form>

      {apiError ? (
        <div className="rounded border border-red-300 bg-red-50 text-danger text-sm px-4 py-3 mb-4">
          API unreachable: {apiError}
        </div>
      ) : null}

      <div className="overflow-x-auto rounded border border-border bg-surface">
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-fg-secondary border-b border-border">
            <tr>
              <Th>{dict.admin.supplier_plans.columns.name}</Th>
              <Th>{dict.admin.supplier_plans.columns.external_id}</Th>
              <Th>{dict.admin.supplier_plans.columns.destinations}</Th>
              <Th>{dict.admin.supplier_plans.columns.data}</Th>
              <Th>{dict.admin.supplier_plans.columns.validity}</Th>
              <Th>{dict.admin.supplier_plans.columns.activation_policy}</Th>
              <Th>{dict.admin.supplier_plans.columns.delivery_model}</Th>
              <Th>{dict.admin.supplier_plans.columns.cost}</Th>
              <Th>{dict.admin.supplier_plans.columns.available}</Th>
              <Th aria-label="Action" />
            </tr>
          </thead>
          <tbody>
            {plans.length === 0 ? (
              <tr>
                <td
                  colSpan={10}
                  className="px-4 py-8 text-center text-fg-secondary"
                >
                  {dict.admin.common.no_results}
                </td>
              </tr>
            ) : null}
            {plans.map((plan) => (
              <tr
                key={plan.id}
                className="border-b border-border last:border-0 hover:bg-surface-muted"
              >
                <Td>{plan.name}</Td>
                <Td className="font-mono text-xs text-fg-secondary">
                  {plan.external_id}
                </Td>
                <Td className="text-xs">{plan.destinations.join(", ")}</Td>
                <Td>{formatData(plan.data_amount_mb)}</Td>
                <Td>{formatValidity(plan.validity_days)}</Td>
                <Td className="text-xs">{plan.activation_policy}</Td>
                <Td className="text-xs">{plan.delivery_model}</Td>
                <Td className="font-mono text-xs">
                  {plan.cost_amount} {plan.cost_currency}
                </Td>
                <Td>
                  {plan.available
                    ? dict.admin.common.yes
                    : dict.admin.common.no}
                </Td>
                <Td>
                  <Link
                    href={`/${lang}/admin/products/new?from_plan=${plan.id}`}
                    className="text-xs text-fg hover:underline whitespace-nowrap"
                  >
                    {dict.admin.supplier_plans.row_action_create_product}
                  </Link>
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-xs text-fg-secondary">
        {dict.admin.supplier_plans.columns.supplier}:{" "}
        <span className="font-mono">supplier_id</span>{" "}
        {dict.admin.common.filter}{" "}
        <span className="font-mono">
          (last sync: {plans[0] ? formatDateTime(plans[0].last_synced_at) : "—"})
        </span>
      </p>
    </div>
  );
}

function Th({
  children,
  ...rest
}: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th className="px-3 py-2 font-medium" {...rest}>
      {children}
    </th>
  );
}

function Td({
  children,
  className,
}: {
  children?: React.ReactNode;
  className?: string;
}) {
  return <td className={`px-3 py-2 ${className ?? ""}`}>{children}</td>;
}

function pickString(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}
