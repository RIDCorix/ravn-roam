import Link from "next/link";
import { notFound } from "next/navigation";

import { getDictionary, hasLocale } from "../../../../dictionaries";

import { ProductForm } from "@/components/admin/product-form";
import { getSupplierPlan } from "@/lib/api";

export const dynamic = "force-dynamic";

// The `from_plan` query param wires the regulation doc §7 step 2b shortcut:
// pre-fill the new product with everything the primary plan dictates, so the
// admin only fills i18n + pricing + sales constraints.
export default async function NewProductPage({
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
  const fromPlan = typeof sp.from_plan === "string" ? sp.from_plan : null;

  let prefill;
  let prefillError: string | null = null;
  if (fromPlan) {
    try {
      const plan = await getSupplierPlan(fromPlan);
      prefill = {
        marketing_destinations: plan.destinations,
        data_amount_mb: plan.data_amount_mb,
        validity_days: plan.validity_days,
        activation_policy_display: plan.activation_policy,
        primary_plan_id: plan.id,
        cost_snapshot: {
          plan_id: plan.id,
          cost: plan.cost_amount,
          currency: plan.cost_currency,
          // Phase 2 = manual FX baseline; admin can edit before publishing.
          fx_rate: 1,
          snapshot_at: new Date().toISOString(),
        },
      };
    } catch (err) {
      prefillError = (err as Error).message;
    }
  }

  return (
    <div>
      <header className="mb-6 flex items-center justify-between">
        <div>
          <Link
            href={`/${lang}/admin/products`}
            className="text-xs text-fg-secondary hover:underline"
          >
            ← {dict.admin.common.back}
          </Link>
          <h1 className="text-2xl font-semibold">
            {dict.admin.products.create}
          </h1>
          {fromPlan ? (
            <p className="text-xs text-fg-secondary mt-1">
              {dict.admin.products.create_from_plan}: <code>{fromPlan}</code>
            </p>
          ) : null}
        </div>
      </header>

      {prefillError ? (
        <div className="rounded border border-red-300 bg-red-50 text-danger text-sm px-4 py-3 mb-4">
          {prefillError}
        </div>
      ) : null}

      <ProductForm
        lang={lang}
        dict={dict}
        mode="create"
        prefill={prefill}
      />
    </div>
  );
}
