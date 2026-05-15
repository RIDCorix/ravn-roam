"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { toggleSupplierPlanAction } from "@/lib/actions";

import type { AdminDict } from "./dict";

export function SupplierPlanToggle({
  lang,
  dict,
  planId,
  adminEnabled,
}: {
  lang: string;
  dict: AdminDict;
  planId: string;
  adminEnabled: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onClick() {
    setError(null);
    startTransition(async () => {
      const res = await toggleSupplierPlanAction(lang, planId, {
        admin_enabled: !adminEnabled,
      });
      if (res.ok) {
        router.refresh();
      } else {
        setError(res.error ?? dict.admin.common.errors.generic);
      }
    });
  }

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={onClick}
        disabled={isPending}
        data-testid="supplier-plan-toggle"
        className="rounded bg-fg text-bg px-3 py-1.5 text-sm hover:opacity-90 disabled:opacity-60"
      >
        {adminEnabled
          ? dict.admin.supplier_plans.detail.toggle_disable
          : dict.admin.supplier_plans.detail.toggle_enable}
      </button>
      {error ? <span className="text-xs text-danger">{error}</span> : null}
    </div>
  );
}
