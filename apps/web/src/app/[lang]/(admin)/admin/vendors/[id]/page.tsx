import Link from "next/link";
import { notFound } from "next/navigation";

import { getDictionary, hasLocale } from "../../../../dictionaries";

import { ApiError, getVendor } from "@/lib/api";
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

export default async function VendorDetailPage({
  params,
}: {
  params: Promise<{ lang: string; id: string }>;
}) {
  const { lang, id } = await params;
  if (!hasLocale(lang)) notFound();
  const dict = await getDictionary(lang);

  try {
    const vendor = await getVendor(id);

    return (
      <div className="space-y-6">
        <header className="flex items-center justify-between">
          <div>
            <Link
              href={`/${lang}/admin/vendors`}
              className="t-eyebrow text-fg-muted hover:text-fg"
            >
              ← {dict.admin.vendors.title}
            </Link>
            <h1 className="t-h3 mt-2">{vendor.display_name}</h1>
            <p className="t-body-sm text-fg-secondary mt-1 t-mono">
              {vendor.code}
            </p>
          </div>
          <div className="flex gap-2">
            <Button asChild variant="secondary">
              <Link href={`/${lang}/admin/vendors/${id}/edit`}>
                {dict.admin.common.edit}
              </Link>
            </Button>
          </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <SummaryCard
            label={dict.admin.vendors.columns.tier}
            value={dict.admin.vendors.tiers[vendor.tier]}
          />
          <SummaryCard
            label={dict.admin.vendors.columns.status}
            value={dict.admin.vendors.statuses[vendor.status]}
          />
          <SummaryCard
            label={dict.admin.vendors.columns.commission}
            value={
              vendor.commission_rate == null
                ? "—"
                : `${(vendor.commission_rate * 100).toFixed(2)}%`
            }
            mono
          />
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="t-h5">Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3 text-sm">
              <DefRow label={dict.admin.vendors.form.code} value={vendor.code} mono />
              <DefRow
                label={dict.admin.vendors.form.display_name}
                value={vendor.display_name}
              />
              <DefRow
                label={dict.admin.vendors.form.tier}
                value={dict.admin.vendors.tiers[vendor.tier]}
              />
              <DefRow
                label={dict.admin.vendors.form.status}
                value={dict.admin.vendors.statuses[vendor.status]}
              />
              <DefRow
                label={dict.admin.vendors.form.grade}
                value={
                  vendor.grade
                    ? dict.admin.vendors.grades[vendor.grade]
                    : "—"
                }
              />
              <DefRow
                label={dict.admin.vendors.form.contact_email}
                value={vendor.contact_email ?? "—"}
              />
              <DefRow
                label={dict.admin.vendors.form.commission_rate}
                value={
                  vendor.commission_rate == null
                    ? "—"
                    : `${(vendor.commission_rate * 100).toFixed(2)}%`
                }
                mono
              />
              <DefRow
                label={dict.admin.vendors.columns.updated_at}
                value={formatDateTime(vendor.updated_at)}
                mono
              />
            </dl>
            {vendor.notes ? (
              <div className="mt-6 rounded-lg bg-surface-sunken p-4">
                <h3 className="t-eyebrow mb-2">
                  {dict.admin.vendors.form.notes}
                </h3>
                <p className="t-body-sm whitespace-pre-wrap">{vendor.notes}</p>
              </div>
            ) : null}
            {vendor.contract_terms &&
            Object.keys(vendor.contract_terms).length > 0 ? (
              <div className="mt-4 rounded-lg bg-surface-sunken p-4">
                <h3 className="t-eyebrow mb-2">Contract terms</h3>
                <pre className="t-mono text-xs overflow-x-auto">
                  {JSON.stringify(vendor.contract_terms, null, 2)}
                </pre>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    );
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return notFound();
    throw err;
  }
}

function SummaryCard({
  label,
  value,
  mono,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <Card>
      <CardContent className="py-5">
        <p className="t-eyebrow text-fg-muted">{label}</p>
        <p
          className={`mt-2 text-2xl font-semibold tracking-tight ${
            mono ? "t-mono" : ""
          }`}
        >
          {value}
        </p>
      </CardContent>
    </Card>
  );
}

function DefRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs text-fg-muted">{label}</dt>
      <dd className={`text-sm ${mono ? "t-mono" : ""}`}>{value}</dd>
    </div>
  );
}

// Suppress unused Badge import (kept for future status badge work).
void Badge;
