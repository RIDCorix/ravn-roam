"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import {
  type ProductWithMappings,
  type SupplierPlanActivationPolicy,
  isFieldLocked,
  isPricingLocked,
} from "@roam/catalog";

import type { AdminDict } from "./dict";
import {
  createProductAction,
  updateProductAction,
  type ActionResult,
} from "@/lib/actions";

const CATEGORIES = ["single_country", "regional", "global", "addon_topup"] as const;
const ACTIVATION_POLICIES = ["on_install", "on_first_use", "fixed_date"] as const;

export interface ProductFormProps {
  lang: string;
  dict: AdminDict;
  mode: "create" | "edit";
  initial?: ProductWithMappings;
  // For "create from plan" shortcut: prefilled defaults sourced from the
  // selected supplier_plan, so the admin starts already inside the
  // substitution-rules cage.
  prefill?: {
    marketing_destinations: string[];
    data_amount_mb: number;
    validity_days: number;
    activation_policy_display: SupplierPlanActivationPolicy;
    primary_plan_id: string;
    cost_snapshot?: {
      plan_id: string;
      cost: number;
      currency: string;
      fx_rate: number;
      snapshot_at: string;
    };
  };
}

interface FormState {
  slug: string;
  category: (typeof CATEGORIES)[number];
  display_name_en: string;
  display_name_zh_TW: string;
  description_en: string;
  description_zh_TW: string;
  marketing_destinations: string;
  data_amount_mb: string;
  validity_days: string;
  activation_policy_display: SupplierPlanActivationPolicy;
  sales_window_start: string;
  sales_window_end: string;
  sales_region_allow: string;
  sales_region_deny: string;
  purchase_cap_per_user: string;
  purchase_cap_total: string;
  tags: string;
  currency: string;
  markup_mode: "fixed_amount" | "percentage" | "target_margin" | "manual";
  markup_value: string;
  manual_retail: string;
  msrp: string;
  fx_policy: "snapshot_at_publish" | "daily_refresh" | "manual";
}

function initialState(props: ProductFormProps): FormState {
  const i = props.initial;
  return {
    slug: i?.slug ?? "",
    category: (i?.category ?? "single_country") as FormState["category"],
    display_name_en: i?.display_name_i18n?.en ?? "",
    display_name_zh_TW: i?.display_name_i18n?.["zh-TW"] ?? "",
    description_en: i?.description_i18n?.en ?? "",
    description_zh_TW: i?.description_i18n?.["zh-TW"] ?? "",
    marketing_destinations: (
      i?.marketing_destinations ?? props.prefill?.marketing_destinations ?? []
    ).join(", "),
    data_amount_mb: String(
      i?.data_amount_mb ?? props.prefill?.data_amount_mb ?? 0,
    ),
    validity_days: String(
      i?.validity_days ?? props.prefill?.validity_days ?? 7,
    ),
    activation_policy_display:
      i?.activation_policy_display ??
      props.prefill?.activation_policy_display ??
      "on_first_use",
    sales_window_start: i?.sales_window_start?.slice(0, 16) ?? "",
    sales_window_end: i?.sales_window_end?.slice(0, 16) ?? "",
    sales_region_allow: (i?.sales_region_allow ?? []).join(", "),
    sales_region_deny: (i?.sales_region_deny ?? []).join(", "),
    purchase_cap_per_user:
      i?.purchase_cap_per_user != null ? String(i.purchase_cap_per_user) : "",
    purchase_cap_total:
      i?.purchase_cap_total != null ? String(i.purchase_cap_total) : "",
    tags: (i?.tags ?? []).join(", "),
    currency: i?.pricing?.currency ?? "TWD",
    markup_mode: (i?.pricing?.markup_mode ??
      "percentage") as FormState["markup_mode"],
    markup_value:
      i?.pricing?.markup_value != null ? String(i.pricing.markup_value) : "30",
    manual_retail:
      i?.pricing?.markup_mode === "manual" && i?.pricing?.retail
        ? String(i.pricing.retail)
        : "",
    msrp: i?.pricing?.msrp != null ? String(i.pricing.msrp) : "",
    fx_policy:
      (i?.pricing?.fx_policy as FormState["fx_policy"]) ??
      "snapshot_at_publish",
  };
}

export function ProductForm(props: ProductFormProps) {
  const { dict, lang, mode, initial, prefill } = props;
  const [form, setForm] = useState<FormState>(initialState(props));
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const publicationState = initial?.publication_state ?? "draft";
  const productLocked = (field: Parameters<typeof isFieldLocked>[1]) =>
    mode === "edit" && isFieldLocked(publicationState, field);
  const pricingLocked = mode === "edit" && isPricingLocked(publicationState);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function computeRetail(): number {
    const cost =
      initial?.pricing?.cost_snapshot ?? prefill?.cost_snapshot ?? null;
    if (!cost) return 0;
    const value = Number(form.markup_value || 0);
    const costInRetail = cost.cost * cost.fx_rate;
    switch (form.markup_mode) {
      case "fixed_amount":
        return round2(costInRetail + value);
      case "percentage":
        return round2(costInRetail * (1 + value / 100));
      case "target_margin": {
        const denom = 1 - value / 100;
        if (denom <= 0) return 0;
        return round2(costInRetail / denom);
      }
      case "manual":
        return round2(Number(form.manual_retail || 0));
    }
  }

  function buildPayload() {
    const display_name_i18n: Record<string, string> = {};
    if (form.display_name_en) display_name_i18n.en = form.display_name_en;
    if (form.display_name_zh_TW)
      display_name_i18n["zh-TW"] = form.display_name_zh_TW;
    const description_i18n: Record<string, string> = {};
    if (form.description_en) description_i18n.en = form.description_en;
    if (form.description_zh_TW)
      description_i18n["zh-TW"] = form.description_zh_TW;

    const costSnapshot =
      initial?.pricing?.cost_snapshot ?? prefill?.cost_snapshot;
    const retail = computeRetail();

    return {
      slug: form.slug,
      category: form.category,
      display_name_i18n,
      description_i18n,
      marketing_destinations: splitCSV(form.marketing_destinations),
      data_amount_mb: Number(form.data_amount_mb),
      validity_days: Number(form.validity_days),
      activation_policy_display: form.activation_policy_display,
      sales_window_start: form.sales_window_start
        ? new Date(form.sales_window_start).toISOString()
        : null,
      sales_window_end: form.sales_window_end
        ? new Date(form.sales_window_end).toISOString()
        : null,
      sales_region_allow: splitCSV(form.sales_region_allow),
      sales_region_deny: splitCSV(form.sales_region_deny),
      purchase_cap_per_user: form.purchase_cap_per_user
        ? Number(form.purchase_cap_per_user)
        : null,
      purchase_cap_total: form.purchase_cap_total
        ? Number(form.purchase_cap_total)
        : null,
      pricing: {
        currency: form.currency,
        retail,
        msrp: form.msrp ? Number(form.msrp) : undefined,
        markup_mode: form.markup_mode,
        markup_value: Number(form.markup_value || 0),
        cost_snapshot: costSnapshot,
        fx_policy: form.fx_policy,
      },
      media: initial?.media ?? {},
      tags: splitCSV(form.tags),
    };
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const payload = buildPayload();
    startTransition(async () => {
      let result: ActionResult & { id?: string };
      if (mode === "create") {
        result = await createProductAction(lang, payload);
      } else {
        result = await updateProductAction(lang, initial!.id, payload);
      }
      if (!result.ok) {
        setError(result.error ?? "unknown_error");
        return;
      }
      router.refresh();
    });
  }

  const computedRetail = computeRetail();
  const costSnapshot =
    initial?.pricing?.cost_snapshot ?? prefill?.cost_snapshot;
  const costInRetailCurrency = costSnapshot
    ? costSnapshot.cost * costSnapshot.fx_rate
    : 0;
  const margin =
    computedRetail > 0
      ? ((computedRetail - costInRetailCurrency) / computedRetail) * 100
      : null;

  return (
    <form onSubmit={onSubmit} className="space-y-8">
      <Section title={mode === "create" ? dict.admin.products.create : dict.admin.products.title}>
        <Grid>
          <Field
            label={dict.admin.products.form.slug}
            hint={dict.admin.products.form.slug_hint}
            locked={productLocked("slug")}
          >
            <input
              type="text"
              value={form.slug}
              onChange={(e) => update("slug", e.target.value)}
              disabled={productLocked("slug")}
              className={inputClass(productLocked("slug"))}
              required
            />
          </Field>

          <Field
            label={dict.admin.products.form.category}
            locked={productLocked("category")}
          >
            <select
              value={form.category}
              onChange={(e) =>
                update("category", e.target.value as FormState["category"])
              }
              disabled={productLocked("category")}
              className={inputClass(productLocked("category"))}
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {dict.admin.products.categories[c]}
                </option>
              ))}
            </select>
          </Field>
        </Grid>

        <Grid>
          <Field
            label={`${dict.admin.products.form.display_name} (en)`}
          >
            <input
              type="text"
              value={form.display_name_en}
              onChange={(e) => update("display_name_en", e.target.value)}
              className={inputClass(false)}
            />
          </Field>
          <Field
            label={`${dict.admin.products.form.display_name} (zh-TW)`}
          >
            <input
              type="text"
              value={form.display_name_zh_TW}
              onChange={(e) => update("display_name_zh_TW", e.target.value)}
              className={inputClass(false)}
            />
          </Field>
        </Grid>

        <Grid>
          <Field label={`${dict.admin.products.form.description} (en)`}>
            <textarea
              rows={3}
              value={form.description_en}
              onChange={(e) => update("description_en", e.target.value)}
              className={inputClass(false)}
            />
          </Field>
          <Field label={`${dict.admin.products.form.description} (zh-TW)`}>
            <textarea
              rows={3}
              value={form.description_zh_TW}
              onChange={(e) => update("description_zh_TW", e.target.value)}
              className={inputClass(false)}
            />
          </Field>
        </Grid>

        <Field
          label={dict.admin.products.form.marketing_destinations}
          hint={dict.admin.products.form.marketing_destinations_hint}
          locked={productLocked("marketing_destinations")}
        >
          <input
            type="text"
            value={form.marketing_destinations}
            onChange={(e) =>
              update("marketing_destinations", e.target.value)
            }
            disabled={productLocked("marketing_destinations")}
            className={inputClass(productLocked("marketing_destinations"))}
            placeholder="JP, KR, TW"
          />
        </Field>

        <Grid cols={3}>
          <Field
            label={dict.admin.products.form.data_amount_mb}
            hint={dict.admin.products.form.data_amount_mb_hint}
            locked={productLocked("data_amount_mb")}
          >
            <input
              type="number"
              value={form.data_amount_mb}
              onChange={(e) => update("data_amount_mb", e.target.value)}
              disabled={productLocked("data_amount_mb")}
              className={inputClass(productLocked("data_amount_mb"))}
            />
          </Field>
          <Field
            label={dict.admin.products.form.validity_days}
            locked={productLocked("validity_days")}
          >
            <input
              type="number"
              min="1"
              value={form.validity_days}
              onChange={(e) => update("validity_days", e.target.value)}
              disabled={productLocked("validity_days")}
              className={inputClass(productLocked("validity_days"))}
            />
          </Field>
          <Field
            label={dict.admin.products.form.activation_policy_display}
            locked={productLocked("activation_policy_display")}
          >
            <select
              value={form.activation_policy_display}
              onChange={(e) =>
                update(
                  "activation_policy_display",
                  e.target.value as SupplierPlanActivationPolicy,
                )
              }
              disabled={productLocked("activation_policy_display")}
              className={inputClass(productLocked("activation_policy_display"))}
            >
              {ACTIVATION_POLICIES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </Field>
        </Grid>

        <Grid>
          <Field
            label={dict.admin.products.form.sales_window_start}
          >
            <input
              type="datetime-local"
              value={form.sales_window_start}
              onChange={(e) => update("sales_window_start", e.target.value)}
              className={inputClass(false)}
            />
          </Field>
          <Field label={dict.admin.products.form.sales_window_end}>
            <input
              type="datetime-local"
              value={form.sales_window_end}
              onChange={(e) => update("sales_window_end", e.target.value)}
              className={inputClass(false)}
            />
          </Field>
        </Grid>

        <Grid>
          <Field label={dict.admin.products.form.sales_region_allow}>
            <input
              type="text"
              value={form.sales_region_allow}
              onChange={(e) => update("sales_region_allow", e.target.value)}
              className={inputClass(false)}
              placeholder="TW, JP"
            />
          </Field>
          <Field label={dict.admin.products.form.sales_region_deny}>
            <input
              type="text"
              value={form.sales_region_deny}
              onChange={(e) => update("sales_region_deny", e.target.value)}
              className={inputClass(false)}
              placeholder="CN"
            />
          </Field>
        </Grid>

        <Grid>
          <Field label={dict.admin.products.form.purchase_cap_per_user}>
            <input
              type="number"
              min="1"
              value={form.purchase_cap_per_user}
              onChange={(e) =>
                update("purchase_cap_per_user", e.target.value)
              }
              className={inputClass(false)}
            />
          </Field>
          <Field label={dict.admin.products.form.purchase_cap_total}>
            <input
              type="number"
              min="1"
              value={form.purchase_cap_total}
              onChange={(e) => update("purchase_cap_total", e.target.value)}
              className={inputClass(false)}
            />
          </Field>
        </Grid>

        <Field label={dict.admin.products.form.tags}>
          <input
            type="text"
            value={form.tags}
            onChange={(e) => update("tags", e.target.value)}
            className={inputClass(false)}
            placeholder="travel, asia"
          />
        </Field>
      </Section>

      <Section title={dict.admin.products.pricing.title}>
        {pricingLocked ? (
          <div className="text-xs text-fg-secondary mb-3">
            {dict.admin.common.locked_published}
          </div>
        ) : null}

        <div className="mb-4 rounded border border-border bg-surface-muted px-4 py-3 text-xs">
          <div className="font-medium mb-1">
            {dict.admin.products.pricing.cost_snapshot}
          </div>
          {costSnapshot ? (
            <div className="font-mono">
              {costSnapshot.cost} {costSnapshot.currency} × FX{" "}
              {costSnapshot.fx_rate} = {round2(costInRetailCurrency)}{" "}
              {form.currency} (plan {costSnapshot.plan_id.slice(0, 8)}…)
            </div>
          ) : (
            <div className="text-fg-secondary">
              {dict.admin.products.pricing.cost_snapshot_empty}
            </div>
          )}
        </div>

        <Grid cols={3}>
          <Field label={dict.admin.products.pricing.currency} locked={pricingLocked}>
            <input
              type="text"
              maxLength={3}
              value={form.currency}
              onChange={(e) =>
                update("currency", e.target.value.toUpperCase())
              }
              disabled={pricingLocked}
              className={inputClass(pricingLocked)}
            />
          </Field>
          <Field label={dict.admin.products.pricing.markup_mode} locked={pricingLocked}>
            <select
              value={form.markup_mode}
              onChange={(e) =>
                update("markup_mode", e.target.value as FormState["markup_mode"])
              }
              disabled={pricingLocked}
              className={inputClass(pricingLocked)}
            >
              {(
                ["fixed_amount", "percentage", "target_margin", "manual"] as const
              ).map((m) => (
                <option key={m} value={m}>
                  {dict.admin.products.pricing.modes[m]}
                </option>
              ))}
            </select>
          </Field>
          <Field label={dict.admin.products.pricing.fx_policy} locked={pricingLocked}>
            <select
              value={form.fx_policy}
              onChange={(e) =>
                update("fx_policy", e.target.value as FormState["fx_policy"])
              }
              disabled={pricingLocked}
              className={inputClass(pricingLocked)}
            >
              {(
                ["snapshot_at_publish", "daily_refresh", "manual"] as const
              ).map((p) => (
                <option key={p} value={p}>
                  {dict.admin.products.pricing.fx_policies[p]}
                </option>
              ))}
            </select>
          </Field>
        </Grid>

        <Grid cols={3}>
          {form.markup_mode !== "manual" ? (
            <Field
              label={dict.admin.products.pricing.markup_value}
              locked={pricingLocked}
            >
              <input
                type="number"
                step="0.01"
                value={form.markup_value}
                onChange={(e) => update("markup_value", e.target.value)}
                disabled={pricingLocked}
                className={inputClass(pricingLocked)}
              />
            </Field>
          ) : (
            <Field
              label={dict.admin.products.pricing.retail}
              locked={pricingLocked}
            >
              <input
                type="number"
                step="0.01"
                value={form.manual_retail}
                onChange={(e) => update("manual_retail", e.target.value)}
                disabled={pricingLocked}
                className={inputClass(pricingLocked)}
              />
            </Field>
          )}
          <Field label={dict.admin.products.pricing.msrp} locked={pricingLocked}>
            <input
              type="number"
              step="0.01"
              value={form.msrp}
              onChange={(e) => update("msrp", e.target.value)}
              disabled={pricingLocked}
              className={inputClass(pricingLocked)}
            />
          </Field>
          <Field label={dict.admin.products.pricing.computed_retail}>
            <div className="rounded border border-border bg-surface-muted px-3 py-2 text-sm font-mono">
              {round2(computedRetail)} {form.currency}
              {margin != null ? (
                <span className="ml-3 text-xs text-fg-secondary">
                  {dict.admin.products.pricing.computed_margin}:{" "}
                  {margin.toFixed(1)}%
                </span>
              ) : null}
            </div>
          </Field>
        </Grid>
      </Section>

      {error ? (
        <div className="rounded border border-red-300 bg-red-50 text-danger text-sm px-4 py-3">
          {error}
        </div>
      ) : null}

      <div className="flex justify-end gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded bg-fg text-bg px-4 py-2 text-sm hover:opacity-90 disabled:opacity-50"
        >
          {pending ? dict.admin.common.loading : dict.admin.common.save}
        </button>
      </div>
    </form>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded border border-border bg-surface px-5 py-4">
      <h2 className="text-base font-semibold mb-4">{title}</h2>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

function Grid({
  children,
  cols = 2,
}: {
  children: React.ReactNode;
  cols?: 2 | 3;
}) {
  const grid = cols === 3 ? "md:grid-cols-3" : "md:grid-cols-2";
  return <div className={`grid grid-cols-1 ${grid} gap-4`}>{children}</div>;
}

function Field({
  label,
  hint,
  locked,
  children,
}: {
  label: string;
  hint?: string;
  locked?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-fg-secondary mb-1">
        {label}
        {locked ? <span className="ml-1 text-warning">🔒</span> : null}
      </span>
      {children}
      {hint ? (
        <span className="block text-[11px] text-fg-secondary mt-1">{hint}</span>
      ) : null}
    </label>
  );
}

function inputClass(disabled: boolean): string {
  return `block w-full rounded border border-border bg-bg px-2 py-1.5 text-sm ${
    disabled ? "opacity-60 cursor-not-allowed" : ""
  }`;
}

function splitCSV(value: string): string[] {
  return value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
