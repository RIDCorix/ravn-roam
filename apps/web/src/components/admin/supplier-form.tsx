"use client";

import { useTransition, useState } from "react";
import { useRouter } from "next/navigation";

import {
  supplierCreateSchema,
  supplierUpdateSchema,
  type Supplier,
  type SupplierIntegrationType,
  type SupplierStatus,
} from "@roam/catalog";

import {
  createSupplierAction,
  updateSupplierAction,
} from "@/lib/actions";

import type { AdminDict } from "./dict";

const STATUSES: SupplierStatus[] = ["active", "paused", "terminated"];
const INTEGRATIONS: SupplierIntegrationType[] = ["api", "manual_csv"];

interface SupplierFormProps {
  lang: string;
  dict: AdminDict;
  mode: "create" | "edit";
  initial?: Supplier;
}

export function SupplierForm({ lang, dict, mode, initial }: SupplierFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const [code, setCode] = useState(initial?.code ?? "");
  const [displayName, setDisplayName] = useState(initial?.display_name ?? "");
  const [status, setStatus] = useState<SupplierStatus>(
    initial?.status ?? "active",
  );
  const [integrationType, setIntegrationType] =
    useState<SupplierIntegrationType>(initial?.integration_type ?? "api");
  const [defaultCurrency, setDefaultCurrency] = useState(
    initial?.default_currency ?? "TWD",
  );
  const [credentialsRef, setCredentialsRef] = useState(
    initial?.credentials_ref ?? "",
  );
  const [contactText, setContactText] = useState(
    JSON.stringify(initial?.contact ?? {}, null, 2),
  );

  function clearFieldError(field: string) {
    if (fieldErrors[field]) {
      const next = { ...fieldErrors };
      delete next[field];
      setFieldErrors(next);
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setFieldErrors({});

    let contact: Record<string, unknown>;
    try {
      const parsed = contactText.trim() === "" ? {} : JSON.parse(contactText);
      if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
        throw new Error("not an object");
      }
      contact = parsed as Record<string, unknown>;
    } catch {
      setFieldErrors({ contact: dict.admin.suppliers.errors.contact_json_invalid });
      return;
    }

    if (mode === "create") {
      const result = supplierCreateSchema.safeParse({
        code,
        display_name: displayName,
        status,
        integration_type: integrationType,
        default_currency: defaultCurrency.toUpperCase(),
        contact,
        credentials_ref: credentialsRef.trim() === "" ? null : credentialsRef,
      });
      if (!result.success) {
        applyFlatten(result.error.flatten().fieldErrors);
        return;
      }
      startTransition(async () => {
        const res = await createSupplierAction(lang, result.data);
        if (!res.ok) handleApiError(res);
      });
    } else {
      const result = supplierUpdateSchema.safeParse({
        display_name: displayName,
        status,
        integration_type: integrationType,
        default_currency: defaultCurrency.toUpperCase(),
        contact,
        credentials_ref: credentialsRef.trim() === "" ? null : credentialsRef,
      });
      if (!result.success) {
        applyFlatten(result.error.flatten().fieldErrors);
        return;
      }
      startTransition(async () => {
        const res = await updateSupplierAction(lang, initial!.id, result.data);
        if (!res.ok) {
          handleApiError(res);
        } else {
          router.push(`/${lang}/admin/suppliers/${initial!.id}`);
          router.refresh();
        }
      });
    }
  }

  function applyFlatten(fieldErr: Record<string, string[] | undefined>) {
    const next: Record<string, string> = {};
    for (const [k, v] of Object.entries(fieldErr)) {
      if (v && v.length > 0) next[k] = v[0]!;
    }
    setFieldErrors(next);
  }

  function handleApiError(res: {
    error?: string;
    status?: number;
    details?: unknown;
  }) {
    if (res.status === 409 && res.error?.includes("code_conflict")) {
      setFieldErrors({ code: dict.admin.suppliers.errors.code_conflict });
      return;
    }
    if (
      res.status === 409 &&
      res.error?.includes("supplier_terminated")
    ) {
      setError(dict.admin.suppliers.errors.supplier_terminated);
      return;
    }
    setError(res.error ?? dict.admin.common.errors.generic);
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5 max-w-xl">
      {error ? (
        <div className="rounded border border-red-300 bg-red-50 text-danger text-sm px-4 py-3">
          {error}
        </div>
      ) : null}

      <Field
        label={dict.admin.suppliers.form.code}
        hint={dict.admin.suppliers.form.code_hint}
        error={fieldErrors.code}
      >
        <input
          name="code"
          type="text"
          required
          disabled={mode === "edit"}
          value={code}
          onChange={(e) => {
            setCode(e.target.value);
            clearFieldError("code");
          }}
          className="w-full rounded border border-border bg-bg px-2 py-1 text-sm font-mono disabled:opacity-60"
        />
      </Field>

      <Field
        label={dict.admin.suppliers.form.display_name}
        error={fieldErrors.display_name}
      >
        <input
          name="display_name"
          type="text"
          required
          value={displayName}
          onChange={(e) => {
            setDisplayName(e.target.value);
            clearFieldError("display_name");
          }}
          className="w-full rounded border border-border bg-bg px-2 py-1 text-sm"
        />
      </Field>

      <Field label={dict.admin.suppliers.form.status}>
        <select
          name="status"
          value={status}
          onChange={(e) => setStatus(e.target.value as SupplierStatus)}
          className="rounded border border-border bg-bg px-2 py-1 text-sm"
        >
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {dict.admin.suppliers.statuses[s]}
            </option>
          ))}
        </select>
      </Field>

      <Field label={dict.admin.suppliers.form.integration_type}>
        <select
          name="integration_type"
          value={integrationType}
          onChange={(e) =>
            setIntegrationType(e.target.value as SupplierIntegrationType)
          }
          className="rounded border border-border bg-bg px-2 py-1 text-sm"
        >
          {INTEGRATIONS.map((i) => (
            <option key={i} value={i}>
              {dict.admin.suppliers.integration_types[i]}
            </option>
          ))}
        </select>
      </Field>

      <Field
        label={dict.admin.suppliers.form.default_currency}
        error={fieldErrors.default_currency}
      >
        <input
          name="default_currency"
          type="text"
          maxLength={3}
          required
          value={defaultCurrency}
          onChange={(e) => {
            setDefaultCurrency(e.target.value.toUpperCase());
            clearFieldError("default_currency");
          }}
          className="w-24 rounded border border-border bg-bg px-2 py-1 text-sm font-mono uppercase"
        />
      </Field>

      <Field
        label={dict.admin.suppliers.form.credentials_ref}
        hint={dict.admin.suppliers.form.credentials_ref_hint}
        error={fieldErrors.credentials_ref}
      >
        <input
          name="credentials_ref"
          type="text"
          value={credentialsRef}
          onChange={(e) => {
            setCredentialsRef(e.target.value);
            clearFieldError("credentials_ref");
          }}
          placeholder="vault://roam/fastmove"
          className="w-full rounded border border-border bg-bg px-2 py-1 text-sm font-mono"
        />
      </Field>

      <Field
        label={dict.admin.suppliers.form.contact_json}
        hint={dict.admin.suppliers.form.contact_json_hint}
        error={fieldErrors.contact}
      >
        <textarea
          name="contact"
          rows={5}
          value={contactText}
          onChange={(e) => {
            setContactText(e.target.value);
            clearFieldError("contact");
          }}
          className="w-full rounded border border-border bg-bg px-2 py-1 text-xs font-mono"
        />
      </Field>

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={isPending}
          className="rounded bg-fg text-bg px-4 py-1.5 text-sm hover:opacity-90 disabled:opacity-60"
        >
          {dict.admin.common.save}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="rounded border border-border bg-surface px-4 py-1.5 text-sm hover:border-border-strong"
        >
          {dict.admin.common.cancel}
        </button>
      </div>
    </form>
  );
}

function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1">
      <span className="block text-xs font-medium text-fg">{label}</span>
      {children}
      {hint ? <span className="block text-xs text-fg-secondary">{hint}</span> : null}
      {error ? (
        <span className="block text-xs text-danger" data-testid="field-error">
          {error}
        </span>
      ) : null}
    </label>
  );
}
