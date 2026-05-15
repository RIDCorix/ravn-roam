import Link from "next/link";
import { notFound } from "next/navigation";

import { getDictionary, hasLocale } from "../../../dictionaries";

import { ApiError, listVendors, type Vendor } from "@/lib/api";
import { formatDateTime } from "@/lib/format";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

function pickString(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0];
  return v;
}

export default async function VendorsPage({
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
    status: pickString(sp.status) as Vendor["status"] | undefined,
    tier: pickString(sp.tier) as Vendor["tier"] | undefined,
  };

  let vendors: Vendor[] = [];
  let apiError: string | null = null;
  try {
    vendors = await listVendors(filters);
  } catch (err) {
    apiError =
      err instanceof ApiError
        ? `${err.status}: ${err.body.slice(0, 200)}`
        : (err as Error).message;
  }

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="t-h3">{dict.admin.vendors.title}</h1>
          <p className="t-body-sm text-fg-secondary mt-1">
            {dict.admin.vendors.subtitle}
          </p>
        </div>
        <Button asChild>
          <Link href={`/${lang}/admin/vendors/new`}>
            {dict.admin.vendors.create}
          </Link>
        </Button>
      </header>

      <form
        method="GET"
        className="flex flex-wrap items-end gap-3 rounded-2xl border border-divider bg-surface px-4 py-3"
      >
        <div className="flex-1 min-w-[200px]">
          <label className="block text-xs text-fg-secondary mb-1">
            {dict.admin.common.search}
          </label>
          <input
            name="q"
            type="search"
            defaultValue={filters.q ?? ""}
            placeholder={dict.admin.vendors.filters.search_placeholder}
            className="w-full rounded-md border border-divider bg-bg px-3 py-1.5 text-sm focus:border-accent focus:outline-none focus:ring-2 focus:ring-[var(--accent-ring)]"
          />
        </div>
        <div>
          <label className="block text-xs text-fg-secondary mb-1">
            {dict.admin.vendors.filters.tier}
          </label>
          <select
            name="tier"
            defaultValue={filters.tier ?? ""}
            className="rounded-md border border-divider bg-bg px-2 py-1.5 text-sm"
          >
            <option value="">{dict.admin.common.all}</option>
            <option value="platform">{dict.admin.vendors.tiers.platform}</option>
            <option value="tier1">{dict.admin.vendors.tiers.tier1}</option>
            <option value="tier2">{dict.admin.vendors.tiers.tier2}</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-fg-secondary mb-1">
            {dict.admin.vendors.filters.status}
          </label>
          <select
            name="status"
            defaultValue={filters.status ?? ""}
            className="rounded-md border border-divider bg-bg px-2 py-1.5 text-sm"
          >
            <option value="">{dict.admin.common.all}</option>
            <option value="active">{dict.admin.vendors.statuses.active}</option>
            <option value="paused">{dict.admin.vendors.statuses.paused}</option>
            <option value="terminated">
              {dict.admin.vendors.statuses.terminated}
            </option>
          </select>
        </div>
        <Button type="submit" variant="secondary" size="sm">
          {dict.admin.common.filter}
        </Button>
      </form>

      {apiError ? (
        <div className="rounded-md border border-error/30 bg-error-soft text-error text-sm px-4 py-3">
          API unreachable: {apiError}
        </div>
      ) : null}

      {vendors.length === 0 && !apiError ? (
        <Card>
          <CardContent className="py-12 text-center text-fg-secondary">
            {dict.admin.vendors.no_vendors}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="t-h5">
              {vendors.length} {dict.admin.vendors.title}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs text-fg-secondary border-b border-divider">
                  <tr>
                    <Th>{dict.admin.vendors.columns.code}</Th>
                    <Th>{dict.admin.vendors.columns.name}</Th>
                    <Th>{dict.admin.vendors.columns.tier}</Th>
                    <Th>{dict.admin.vendors.columns.grade}</Th>
                    <Th>{dict.admin.vendors.columns.commission}</Th>
                    <Th>{dict.admin.vendors.columns.status}</Th>
                    <Th>{dict.admin.vendors.columns.contact}</Th>
                    <Th>{dict.admin.vendors.columns.updated_at}</Th>
                  </tr>
                </thead>
                <tbody>
                  {vendors.map((v) => (
                    <tr
                      key={v.id}
                      className="border-b border-divider last:border-b-0 hover:bg-surface-sunken transition-colors"
                    >
                      <Td>
                        <span className="t-mono text-xs">{v.code}</span>
                      </Td>
                      <Td>
                        <Link
                          href={`/${lang}/admin/vendors/${v.id}`}
                          className="font-medium hover:text-accent"
                        >
                          {v.display_name}
                        </Link>
                      </Td>
                      <Td>
                        <Badge variant="outline" className="text-xs">
                          {dict.admin.vendors.tiers[v.tier]}
                        </Badge>
                      </Td>
                      <Td>
                        {v.grade ? (
                          <Badge variant="secondary" className="text-xs">
                            {dict.admin.vendors.grades[v.grade]}
                          </Badge>
                        ) : (
                          <span className="text-fg-muted">—</span>
                        )}
                      </Td>
                      <Td>
                        {v.commission_rate == null ? (
                          <span className="text-fg-muted">—</span>
                        ) : (
                          <span className="t-mono text-xs tabular-nums">
                            {(v.commission_rate * 100).toFixed(2)}%
                          </span>
                        )}
                      </Td>
                      <Td>
                        <VendorStatusBadge
                          status={v.status}
                          label={dict.admin.vendors.statuses[v.status]}
                        />
                      </Td>
                      <Td>
                        {v.contact_email ? (
                          <a
                            href={`mailto:${v.contact_email}`}
                            className="text-fg-secondary hover:text-accent"
                          >
                            {v.contact_email}
                          </a>
                        ) : (
                          <span className="text-fg-muted">—</span>
                        )}
                      </Td>
                      <Td>
                        <span className="t-mono text-xs text-fg-secondary">
                          {formatDateTime(v.updated_at)}
                        </span>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-4 py-3 font-medium whitespace-nowrap">{children}</th>
  );
}

function Td({ children }: { children: React.ReactNode }) {
  return <td className="px-4 py-3 whitespace-nowrap">{children}</td>;
}

const STATUS_STYLES: Record<Vendor["status"], string> = {
  active: "bg-success-soft text-success",
  paused: "bg-warning-soft text-warning",
  terminated: "bg-error-soft text-error",
};

function VendorStatusBadge({
  status,
  label,
}: {
  status: Vendor["status"];
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
