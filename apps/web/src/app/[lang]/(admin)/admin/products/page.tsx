import Link from "next/link";
import { notFound } from "next/navigation";

import { type Product, pickI18n } from "@roam/catalog";

import { getDictionary, hasLocale } from "../../../dictionaries";

import {
  OperationalStateBadge,
  PublicationStateBadge,
} from "@/components/admin/state-badge";
import { ApiError, listProducts } from "@/lib/api";
import { formatData, formatDateTime, formatMoney, formatValidity } from "@/lib/format";

export const dynamic = "force-dynamic";

const PUBLICATION_STATES = ["draft", "in_review", "published", "archived"] as const;
const CATEGORIES = ["single_country", "regional", "global", "addon_topup"] as const;

export default async function ProductsPage({
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
    publication_state: pickString(sp.state),
    category: pickString(sp.category),
    q: pickString(sp.q),
  };

  let products: Product[] = [];
  let apiError: string | null = null;
  try {
    products = await listProducts(filters);
  } catch (err) {
    apiError =
      err instanceof ApiError
        ? `${err.status}: ${err.body.slice(0, 200)}`
        : (err as Error).message;
  }

  return (
    <div>
      <header className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold">{dict.admin.products.title}</h1>
        </div>
        <div className="flex gap-2">
          <Link
            href={`/${lang}/admin/supplier-plans`}
            className="rounded border border-border bg-surface px-3 py-1.5 text-sm hover:border-border-strong"
          >
            {dict.admin.products.create_from_plan}
          </Link>
          <Link
            href={`/${lang}/admin/products/new`}
            className="rounded bg-fg text-bg px-3 py-1.5 text-sm hover:opacity-90"
          >
            {dict.admin.products.create}
          </Link>
        </div>
      </header>

      <form
        method="GET"
        className="flex flex-wrap items-end gap-3 mb-4 rounded border border-border bg-surface px-4 py-3"
      >
        <div>
          <label className="block text-xs text-fg-secondary mb-1">
            {dict.admin.products.filters.publication_state}
          </label>
          <select
            name="state"
            defaultValue={filters.publication_state ?? ""}
            className="rounded border border-border bg-bg px-2 py-1 text-sm"
          >
            <option value="">{dict.admin.common.all}</option>
            {PUBLICATION_STATES.map((s) => (
              <option key={s} value={s}>
                {dict.admin.products.states[s]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-fg-secondary mb-1">
            {dict.admin.products.filters.category}
          </label>
          <select
            name="category"
            defaultValue={filters.category ?? ""}
            className="rounded border border-border bg-bg px-2 py-1 text-sm"
          >
            <option value="">{dict.admin.common.all}</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {dict.admin.products.categories[c]}
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
            placeholder={dict.admin.products.filters.search_placeholder}
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
              <Th>{dict.admin.products.columns.name}</Th>
              <Th>{dict.admin.products.columns.slug}</Th>
              <Th>{dict.admin.products.columns.category}</Th>
              <Th>{dict.admin.products.columns.state}</Th>
              <Th>{dict.admin.products.columns.operational_state}</Th>
              <Th>{dict.admin.products.columns.destinations}</Th>
              <Th>{dict.admin.products.columns.data}</Th>
              <Th>{dict.admin.products.columns.validity}</Th>
              <Th>{dict.admin.products.columns.retail}</Th>
              <Th>{dict.admin.products.columns.updated_at}</Th>
            </tr>
          </thead>
          <tbody>
            {products.length === 0 ? (
              <tr>
                <td
                  colSpan={10}
                  className="px-4 py-8 text-center text-fg-secondary"
                >
                  {dict.admin.common.no_results}
                </td>
              </tr>
            ) : null}
            {products.map((product) => (
              <tr
                key={product.id}
                className="border-b border-border last:border-0 hover:bg-surface-muted"
              >
                <Td>
                  <Link
                    href={`/${lang}/admin/products/${product.id}/edit`}
                    className="text-fg hover:underline"
                  >
                    {pickI18n(product.display_name_i18n, lang) || product.slug}
                  </Link>
                </Td>
                <Td className="font-mono text-xs text-fg-secondary">
                  {product.slug}
                </Td>
                <Td>{dict.admin.products.categories[product.category]}</Td>
                <Td>
                  <PublicationStateBadge
                    state={product.publication_state}
                    label={
                      dict.admin.products.states[product.publication_state]
                    }
                  />
                </Td>
                <Td>
                  <OperationalStateBadge
                    state={product.operational_state}
                    label={
                      dict.admin.products.operational_states[
                        product.operational_state
                      ]
                    }
                  />
                </Td>
                <Td className="text-xs">
                  {product.marketing_destinations.join(", ") || "—"}
                </Td>
                <Td>{formatData(product.data_amount_mb)}</Td>
                <Td>{formatValidity(product.validity_days)}</Td>
                <Td>
                  {product.pricing?.retail
                    ? formatMoney(
                        product.pricing.retail,
                        product.pricing.currency,
                      )
                    : "—"}
                </Td>
                <Td className="text-xs text-fg-secondary">
                  {formatDateTime(product.updated_at)}
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
