import { notFound } from "next/navigation";

import type { SupplierPlan } from "@roam/catalog";

import { getDictionary, hasLocale } from "../../../dictionaries";

import { SupplierPlansTable } from "@/components/admin/supplier-plans-table";
import { ApiError, listSupplierPlans } from "@/lib/api";

export const dynamic = "force-dynamic";

// Regulation doc §7 step 2a: admin scans available supplier plans, picks one,
// and follows the "Use as primary →" action to /products/new?from_plan=<id>.
export default async function SupplierPlansPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const dict = await getDictionary(lang);

  let plans: SupplierPlan[] = [];
  let apiError: string | null = null;
  try {
    plans = await listSupplierPlans({ available_only: true });
  } catch (err) {
    apiError =
      err instanceof ApiError
        ? `${err.status}: ${err.body.slice(0, 200)}`
        : (err as Error).message;
  }

  return (
    <div className="space-y-5">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            {dict.admin.supplier_plans.title}
          </h1>
          <p className="text-xs text-fg-secondary mt-0.5">
            {plans.length} plans
          </p>
        </div>
      </header>

      {apiError ? (
        <div className="rounded-md border border-error/30 bg-error-soft text-error text-sm px-4 py-3">
          API unreachable: {apiError}
        </div>
      ) : null}

      <SupplierPlansTable lang={lang} dict={dict} plans={plans} />
    </div>
  );
}
