import Link from "next/link";
import { notFound } from "next/navigation";

import type { Supplier, SupplierStatus } from "@roam/catalog";

import { getDictionary, hasLocale } from "../../../dictionaries";

import { SupplierStatusBadge } from "@/components/admin/state-badge";
import { ApiError, listSuppliers } from "@/lib/api";
import { formatDateTime } from "@/lib/format";

export const dynamic = "force-dynamic";

const STATUSES: SupplierStatus[] = ["active", "paused", "terminated"];

export default async function SuppliersPage({
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
    status: pickStatus(pickString(sp.status)),
    q: pickString(sp.q),
  };

  let suppliers: Supplier[] = [];
  let apiError: string | null = null;
  try {
    suppliers = await listSuppliers(filters);
  } catch (err) {
    apiError =
      err instanceof ApiError
        ? `${err.status}: ${err.body.slice(0, 200)}`
        : (err as Error).message;
  }

  return (
    <div>
      <header className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">{dict.admin.suppliers.title}</h1>
        <Link
          href={`/${lang}/admin/suppliers/new`}
          className="rounded bg-fg text-bg px-3 py-1.5 text-sm hover:opacity-90"
        >
          {dict.admin.suppliers.create}
        </Link>
      </header>

      <form
        method="GET"
        className="flex flex-wrap items-end gap-3 mb-4 rounded border border-border bg-surface px-4 py-3"
      >
        <div>
          <label className="block text-xs text-fg-secondary mb-1">
            {dict.admin.suppliers.filters.status}
          </label>
          <select
            name="status"
            defaultValue={filters.status ?? ""}
            className="rounded border border-border bg-bg px-2 py-1 text-sm"
          >
            <option value="">{dict.admin.common.all}</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {dict.admin.suppliers.statuses[s]}
              </option>
            ))}
          </select>
        </div>
        <div className="flex-1 min-w-[200px]">
          <label className="block text-xs text-fg-secondary mb-1">
            {dict.admin.common.search}
          </label>
          <input
            name="q"
            type="search"
            defaultValue={filters.q ?? ""}
            placeholder={dict.admin.suppliers.filters.search_placeholder}
            className="w-full rounded border border-border bg-bg px-2 py-1 text-sm"
          />
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
              <Th>{dict.admin.suppliers.columns.code}</Th>
              <Th>{dict.admin.suppliers.columns.display_name}</Th>
              <Th>{dict.admin.suppliers.columns.status}</Th>
              <Th>{dict.admin.suppliers.columns.integration_type}</Th>
              <Th>{dict.admin.suppliers.columns.default_currency}</Th>
              <Th>{dict.admin.suppliers.columns.updated_at}</Th>
            </tr>
          </thead>
          <tbody>
            {suppliers.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-8 text-center text-fg-secondary"
                >
                  {dict.admin.common.no_results}
                </td>
              </tr>
            ) : null}
            {suppliers.map((supplier) => (
              <tr
                key={supplier.id}
                data-testid="supplier-row"
                className="border-b border-border last:border-0 hover:bg-surface-muted"
              >
                <Td>
                  <Link
                    href={`/${lang}/admin/suppliers/${supplier.id}`}
                    className="font-mono text-xs text-fg hover:underline"
                  >
                    {supplier.code}
                  </Link>
                </Td>
                <Td>{supplier.display_name}</Td>
                <Td>
                  <SupplierStatusBadge
                    state={supplier.status}
                    label={dict.admin.suppliers.statuses[supplier.status]}
                  />
                </Td>
                <Td className="text-xs">
                  {dict.admin.suppliers.integration_types[supplier.integration_type]}
                </Td>
                <Td className="font-mono text-xs">{supplier.default_currency}</Td>
                <Td className="text-xs text-fg-secondary">
                  {formatDateTime(supplier.updated_at)}
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-3 py-2 font-medium">{children}</th>;
}

function Td({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <td className={`px-3 py-2 ${className ?? ""}`}>{children}</td>;
}

function pickString(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

function pickStatus(value: string | undefined): SupplierStatus | undefined {
  if (value === "active" || value === "paused" || value === "terminated") {
    return value;
  }
  return undefined;
}
