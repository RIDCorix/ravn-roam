import Link from "next/link";
import { notFound } from "next/navigation";

import type { Supplier, SupplierPlan } from "@roam/catalog";

import { getDictionary, hasLocale } from "../../../dictionaries";

import {
  ApiError,
  listSupplierPlans,
  listSuppliers,
} from "@/lib/api";
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
    supplier_id: pickString(sp.supplier_id),
    available_only: pickString(sp.available_only) !== "false",
    admin_enabled: pickAdminEnabled(pickString(sp.admin_enabled)),
    min_data_mb: pickInt(pickString(sp.min_data_mb)),
    min_validity_days: pickInt(pickString(sp.min_validity_days)),
    max_validity_days: pickInt(pickString(sp.max_validity_days)),
  };

  let plans: SupplierPlan[] = [];
  let suppliers: Supplier[] = [];
  let apiError: string | null = null;
  try {
    [plans, suppliers] = await Promise.all([
      listSupplierPlans(filters),
      listSuppliers(),
    ]);
  } catch (err) {
    apiError =
      err instanceof ApiError
        ? `${err.status}: ${err.body.slice(0, 200)}`
        : (err as Error).message;
  }

  const supplierById = new Map(suppliers.map((s) => [s.id, s]));

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
            {dict.admin.supplier_plans.filters.supplier}
          </label>
          <select
            name="supplier_id"
            defaultValue={filters.supplier_id ?? ""}
            className="rounded border border-border bg-bg px-2 py-1 text-sm"
          >
            <option value="">{dict.admin.common.all}</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.display_name}
              </option>
            ))}
          </select>
        </div>
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
        <div>
          <label className="block text-xs text-fg-secondary mb-1">
            {dict.admin.supplier_plans.filters.min_data_mb}
          </label>
          <input
            name="min_data_mb"
            type="number"
            min="0"
            defaultValue={filters.min_data_mb ?? ""}
            className="rounded border border-border bg-bg px-2 py-1 text-sm w-28"
          />
        </div>
        <div>
          <label className="block text-xs text-fg-secondary mb-1">
            {dict.admin.supplier_plans.filters.min_validity_days}
          </label>
          <input
            name="min_validity_days"
            type="number"
            min="0"
            defaultValue={filters.min_validity_days ?? ""}
            className="rounded border border-border bg-bg px-2 py-1 text-sm w-24"
          />
        </div>
        <div>
          <label className="block text-xs text-fg-secondary mb-1">
            {dict.admin.supplier_plans.filters.max_validity_days}
          </label>
          <input
            name="max_validity_days"
            type="number"
            min="0"
            defaultValue={filters.max_validity_days ?? ""}
            className="rounded border border-border bg-bg px-2 py-1 text-sm w-24"
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
        <div>
          <label className="block text-xs text-fg-secondary mb-1">
            {dict.admin.supplier_plans.filters.admin_enabled}
          </label>
          <select
            name="admin_enabled"
            defaultValue={filters.admin_enabled ?? ""}
            className="rounded border border-border bg-bg px-2 py-1 text-sm"
          >
            <option value="">{dict.admin.common.all}</option>
            <option value="true">{dict.admin.common.yes}</option>
            <option value="false">{dict.admin.common.no}</option>
          </select>
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
              <Th>{dict.admin.supplier_plans.columns.supplier}</Th>
              <Th>{dict.admin.supplier_plans.columns.name}</Th>
              <Th>{dict.admin.supplier_plans.columns.external_id}</Th>
              <Th>{dict.admin.supplier_plans.columns.destinations}</Th>
              <Th>{dict.admin.supplier_plans.columns.data}</Th>
              <Th>{dict.admin.supplier_plans.columns.validity}</Th>
              <Th>{dict.admin.supplier_plans.columns.cost}</Th>
              <Th>{dict.admin.supplier_plans.columns.available}</Th>
              <Th>{dict.admin.supplier_plans.columns.admin_enabled}</Th>
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
            {plans.map((plan) => {
              const supplier = supplierById.get(plan.supplier_id);
              return (
                <tr
                  key={plan.id}
                  className="border-b border-border last:border-0 hover:bg-surface-muted"
                >
                  <Td className="text-xs">
                    {supplier ? (
                      <Link
                        href={`/${lang}/admin/suppliers/${supplier.id}`}
                        className="hover:underline"
                      >
                        {supplier.display_name}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </Td>
                  <Td>
                    <Link
                      href={`/${lang}/admin/supplier-plans/${plan.id}`}
                      className="hover:underline"
                    >
                      {plan.name}
                    </Link>
                  </Td>
                  <Td className="font-mono text-xs text-fg-secondary">
                    {plan.external_id}
                  </Td>
                  <Td className="text-xs">{plan.destinations.join(", ")}</Td>
                  <Td>{formatData(plan.data_amount_mb)}</Td>
                  <Td>{formatValidity(plan.validity_days)}</Td>
                  <Td className="font-mono text-xs">
                    {plan.cost_amount} {plan.cost_currency}
                  </Td>
                  <Td>
                    {plan.available
                      ? dict.admin.common.yes
                      : dict.admin.common.no}
                  </Td>
                  <Td>
                    {plan.admin_enabled
                      ? dict.admin.common.yes
                      : dict.admin.common.no}
                  </Td>
                  <Td className="text-xs whitespace-nowrap">
                    <Link
                      href={`/${lang}/admin/supplier-plans/${plan.id}`}
                      className="hover:underline mr-3"
                    >
                      {dict.admin.supplier_plans.row_action_detail}
                    </Link>
                    <Link
                      href={`/${lang}/admin/products/new?from_plan=${plan.id}`}
                      className="hover:underline whitespace-nowrap"
                    >
                      {dict.admin.supplier_plans.row_action_create_product}
                    </Link>
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-xs text-fg-secondary">
        {dict.admin.supplier_plans.columns.supplier} (last sync):{" "}
        <span className="font-mono">
          {plans[0] ? formatDateTime(plans[0].last_synced_at) : "—"}
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

function pickInt(value: string | undefined): number | undefined {
  if (value == null || value === "") return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

function pickAdminEnabled(
  value: string | undefined,
): "true" | "false" | undefined {
  if (value === "true" || value === "false") return value;
  return undefined;
}
