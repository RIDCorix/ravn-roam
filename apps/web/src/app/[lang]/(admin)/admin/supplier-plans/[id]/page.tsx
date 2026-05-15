import Link from "next/link";
import { notFound } from "next/navigation";

import { getDictionary, hasLocale } from "../../../../dictionaries";

import { SupplierPlanToggle } from "@/components/admin/supplier-plan-toggle";
import { ApiError, getSupplier, getSupplierPlan } from "@/lib/api";
import {
  formatData,
  formatDateTime,
  formatValidity,
} from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function SupplierPlanDetailPage({
  params,
}: {
  params: Promise<{ lang: string; id: string }>;
}) {
  const { lang, id } = await params;
  if (!hasLocale(lang)) notFound();
  const dict = await getDictionary(lang);

  let plan;
  try {
    plan = await getSupplierPlan(id);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  }

  // The supplier lookup is best-effort. Treat any failure as "no supplier"
  // so the page still renders the plan even if the supplier endpoint is
  // unreachable.
  let supplierLabel: { id: string; name: string } | null = null;
  try {
    const { supplier } = await getSupplier(plan.supplier_id);
    supplierLabel = { id: supplier.id, name: supplier.display_name };
  } catch {
    /* swallow */
  }

  return (
    <div>
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs text-fg-secondary mb-1">
            <Link
              href={`/${lang}/admin/supplier-plans`}
              className="hover:underline"
            >
              {dict.admin.supplier_plans.title}
            </Link>
          </p>
          <h1 className="text-2xl font-semibold flex items-center gap-3">
            <span>{plan.name}</span>
            <span
              className={`inline-block rounded border px-2 py-0.5 text-xs font-medium ${
                plan.admin_enabled
                  ? "bg-green-50 text-success border-green-300"
                  : "bg-red-50 text-danger border-red-300"
              }`}
            >
              {plan.admin_enabled
                ? dict.admin.common.yes
                : dict.admin.common.no}
            </span>
          </h1>
          <p className="text-xs text-fg-secondary mt-1">
            {dict.admin.supplier_plans.detail.intro}
          </p>
        </div>
        <SupplierPlanToggle
          lang={lang}
          dict={dict}
          planId={plan.id}
          adminEnabled={plan.admin_enabled}
        />
      </header>

      <section>
        <h2 className="text-sm font-semibold text-fg-secondary mb-2">
          {dict.admin.supplier_plans.detail.section_summary}
        </h2>
        <dl className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-3 rounded border border-border bg-surface px-4 py-3 text-sm">
          <DefRow
            term={dict.admin.supplier_plans.detail.field_supplier}
            desc={
              supplierLabel ? (
                <Link
                  href={`/${lang}/admin/suppliers/${supplierLabel.id}`}
                  className="hover:underline"
                >
                  {supplierLabel.name}
                </Link>
              ) : (
                <span className="font-mono text-xs">{plan.supplier_id}</span>
              )
            }
          />
          <DefRow
            term={dict.admin.supplier_plans.detail.field_external_id}
            desc={<span className="font-mono text-xs">{plan.external_id}</span>}
          />
          <DefRow
            term={dict.admin.supplier_plans.detail.field_destinations}
            desc={plan.destinations.join(", ") || "—"}
          />
          <DefRow
            term={dict.admin.supplier_plans.detail.field_data}
            desc={formatData(plan.data_amount_mb)}
          />
          <DefRow
            term={dict.admin.supplier_plans.detail.field_validity}
            desc={formatValidity(plan.validity_days)}
          />
          <DefRow
            term={dict.admin.supplier_plans.detail.field_activation_policy}
            desc={
              dict.admin.supplier_plans.activation_policies[
                plan.activation_policy
              ] ?? plan.activation_policy
            }
          />
          <DefRow
            term={dict.admin.supplier_plans.detail.field_delivery_model}
            desc={
              dict.admin.supplier_plans.delivery_models[plan.delivery_model] ??
              plan.delivery_model
            }
          />
          <DefRow
            term={dict.admin.supplier_plans.detail.field_cost}
            desc={
              <span className="font-mono">
                {plan.cost_amount} {plan.cost_currency}
              </span>
            }
          />
          <DefRow
            term={dict.admin.supplier_plans.detail.field_available}
            desc={plan.available ? dict.admin.common.yes : dict.admin.common.no}
          />
          <DefRow
            term={dict.admin.supplier_plans.detail.field_inventory_hint}
            desc={plan.inventory_hint ?? "—"}
          />
          <DefRow
            term={dict.admin.supplier_plans.detail.field_last_synced_at}
            desc={formatDateTime(plan.last_synced_at)}
          />
          <DefRow
            term={dict.admin.supplier_plans.detail.field_created_at}
            desc={formatDateTime(plan.created_at)}
          />
          <DefRow
            term={dict.admin.supplier_plans.detail.field_updated_at}
            desc={formatDateTime(plan.updated_at)}
          />
        </dl>
        <p className="mt-2 text-xs text-fg-secondary">
          {dict.admin.supplier_plans.detail.locked_notice}
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-sm font-semibold text-fg-secondary mb-2">
          {dict.admin.supplier_plans.detail.section_payload}
        </h2>
        <pre
          data-testid="supplier-plan-raw-payload"
          className="max-h-[480px] overflow-auto rounded border border-border bg-surface p-4 text-xs font-mono"
        >
          {JSON.stringify(plan.raw_payload, null, 2)}
        </pre>
      </section>
    </div>
  );
}

function DefRow({ term, desc }: { term: string; desc: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-fg-secondary">{term}</dt>
      <dd>{desc}</dd>
    </div>
  );
}
