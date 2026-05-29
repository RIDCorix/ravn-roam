import { notFound } from "next/navigation";

import { getDictionary, hasLocale } from "../../../dictionaries";

import { ApiError, listVendors, type Vendor } from "@/lib/api";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FormSelect } from "@/components/admin/form-select";
import { VendorCreateDialog } from "@/components/admin/vendor-create-dialog";
import { VendorsTable } from "@/components/admin/vendors-table";

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
        <VendorCreateDialog lang={lang} dict={dict.admin} />
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
          <FormSelect
            name="tier"
            defaultValue={filters.tier ?? ""}
            options={[
              { label: dict.admin.common.all, value: "" },
              { label: dict.admin.vendors.tiers.platform, value: "platform" },
              { label: dict.admin.vendors.tiers.tier1, value: "tier1" },
              { label: dict.admin.vendors.tiers.tier2, value: "tier2" },
            ]}
          />
        </div>
        <div>
          <label className="block text-xs text-fg-secondary mb-1">
            {dict.admin.vendors.filters.status}
          </label>
          <FormSelect
            name="status"
            defaultValue={filters.status ?? ""}
            options={[
              { label: dict.admin.common.all, value: "" },
              { label: dict.admin.vendors.statuses.active, value: "active" },
              { label: dict.admin.vendors.statuses.paused, value: "paused" },
              {
                label: dict.admin.vendors.statuses.terminated,
                value: "terminated",
              },
            ]}
          />
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

      {apiError ? null : (
        <VendorsTable vendors={vendors} lang={lang} dict={dict.admin} />
      )}
    </div>
  );
}

