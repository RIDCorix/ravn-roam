"use client";

// Vendor create/edit form. Submits via the server-action helpers in
// `lib/actions.ts` so the page can stay a Server Component. POSTs to
// /admin/vendors (create) or PATCHes /admin/vendors/:id (edit).

import * as React from "react";
import { useRouter } from "next/navigation";

import {
  createVendor,
  patchVendor,
  type Vendor,
} from "@/lib/api";

import type { AdminDict } from "@/components/admin/dict";

import { Button } from "@/components/ui/button";

interface VendorFormProps {
  lang: string;
  dict: AdminDict["admin"];
  mode: "create" | "edit";
  vendor?: Vendor;
}

export function VendorForm({ lang, dict, mode, vendor }: VendorFormProps) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPending(true);

    const form = new FormData(e.currentTarget);
    const code = String(form.get("code") ?? "").trim();
    const displayName = String(form.get("display_name") ?? "").trim();
    const tier = String(form.get("tier") ?? "tier1") as Vendor["tier"];
    const status = String(form.get("status") ?? "active") as Vendor["status"];
    const gradeRaw = String(form.get("grade") ?? "");
    const grade = (gradeRaw || null) as Vendor["grade"];
    const contactEmailRaw = String(form.get("contact_email") ?? "").trim();
    const contactEmail = contactEmailRaw || null;
    const commissionRaw = String(form.get("commission_rate") ?? "").trim();
    const commissionRate = commissionRaw === "" ? null : Number(commissionRaw);
    const notesRaw = String(form.get("notes") ?? "").trim();
    const notes = notesRaw || null;

    try {
      if (mode === "create") {
        const created = await createVendor({
          code,
          display_name: displayName,
          tier,
          status,
          grade,
          contact_email: contactEmail,
          commission_rate: commissionRate,
          notes,
        });
        router.push(`/${lang}/admin/vendors/${created.id}`);
        router.refresh();
      } else if (vendor) {
        await patchVendor(vendor.id, {
          display_name: displayName,
          tier,
          status,
          grade,
          contact_email: contactEmail,
          commission_rate: commissionRate,
          notes,
        });
        router.push(`/${lang}/admin/vendors/${vendor.id}`);
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setPending(false);
    }
  }

  const v = vendor;

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {error ? (
        <div className="rounded-md border border-error/30 bg-error-soft text-error text-sm px-3 py-2">
          {error}
        </div>
      ) : null}

      <Field label={dict.vendors.form.code} hint={dict.vendors.form.code_hint}>
        <input
          name="code"
          required
          defaultValue={v?.code ?? ""}
          disabled={mode === "edit"}
          className="w-full rounded-md border border-divider bg-surface px-3 py-1.5 text-sm t-mono disabled:bg-surface-sunken disabled:text-fg-muted"
        />
      </Field>

      <Field label={dict.vendors.form.display_name}>
        <input
          name="display_name"
          required
          defaultValue={v?.display_name ?? ""}
          className="w-full rounded-md border border-divider bg-surface px-3 py-1.5 text-sm"
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label={dict.vendors.form.tier}>
          <select
            name="tier"
            defaultValue={v?.tier ?? "tier1"}
            className="w-full rounded-md border border-divider bg-surface px-3 py-1.5 text-sm"
          >
            <option value="platform">{dict.vendors.tiers.platform}</option>
            <option value="tier1">{dict.vendors.tiers.tier1}</option>
            <option value="tier2">{dict.vendors.tiers.tier2}</option>
          </select>
        </Field>
        <Field label={dict.vendors.form.status}>
          <select
            name="status"
            defaultValue={v?.status ?? "active"}
            className="w-full rounded-md border border-divider bg-surface px-3 py-1.5 text-sm"
          >
            <option value="active">{dict.vendors.statuses.active}</option>
            <option value="paused">{dict.vendors.statuses.paused}</option>
            <option value="terminated">
              {dict.vendors.statuses.terminated}
            </option>
          </select>
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label={dict.vendors.form.grade}>
          <select
            name="grade"
            defaultValue={v?.grade ?? ""}
            className="w-full rounded-md border border-divider bg-surface px-3 py-1.5 text-sm"
          >
            <option value="">—</option>
            <option value="A">{dict.vendors.grades.A}</option>
            <option value="B">{dict.vendors.grades.B}</option>
            <option value="C">{dict.vendors.grades.C}</option>
          </select>
        </Field>
        <Field
          label={dict.vendors.form.commission_rate}
          hint={dict.vendors.form.commission_rate_hint}
        >
          <input
            type="number"
            name="commission_rate"
            min={0}
            max={1}
            step={0.0001}
            defaultValue={v?.commission_rate ?? ""}
            className="w-full rounded-md border border-divider bg-surface px-3 py-1.5 text-sm t-mono"
          />
        </Field>
      </div>

      <Field label={dict.vendors.form.contact_email}>
        <input
          type="email"
          name="contact_email"
          defaultValue={v?.contact_email ?? ""}
          className="w-full rounded-md border border-divider bg-surface px-3 py-1.5 text-sm"
        />
      </Field>

      <Field label={dict.vendors.form.notes}>
        <textarea
          name="notes"
          rows={4}
          defaultValue={v?.notes ?? ""}
          className="w-full rounded-md border border-divider bg-surface px-3 py-1.5 text-sm"
        />
      </Field>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="submit" disabled={pending}>
          {pending ? dict.common.loading : dict.common.save}
        </Button>
      </div>
    </form>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1">
      <span className="block text-xs text-fg-secondary">{label}</span>
      {children}
      {hint ? <span className="block text-xs text-fg-muted">{hint}</span> : null}
    </label>
  );
}
