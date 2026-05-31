"use client";

// Vendor create/edit form. Submits via the server-action helpers in
// `lib/api.ts`. Two notable simplifications vs. the early draft:
//   - tier is NOT exposed — it's auto-derived (Roam-owned vendors are
//     tier1, vendors created BY another vendor are tier2). Form forces
//     tier1 on create; edit preserves whatever the row has.
//   - grade is no longer collected; the column stays in the DB for
//     legacy rows but ops decided it wasn't useful.

import * as React from "react";
import { useRouter } from "next/navigation";

import {
  createVendor,
  patchVendor,
  type Vendor,
} from "@/lib/api";

import type { AdminDict } from "@/components/admin/dict";

import type { Product } from "@roam/catalog";

import { Button } from "@/components/ui/button";
import { CommissionProductPicker } from "@/components/admin/commission-product-picker";
import { CommissionSlider } from "@/components/admin/commission-slider";
import { FormSelect } from "@/components/admin/form-select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

interface VendorFormProps {
  lang: string;
  dict: AdminDict["admin"];
  mode: "create" | "edit";
  vendor?: Vendor;
  // Optional hook for the dialog wrapper to close itself + refresh the
  // parent list on success. If absent (page-level use), we router.push
  // to the detail page like the old flow.
  onSuccess?: (id: string) => void;
}

export function VendorForm({
  lang,
  dict,
  mode,
  vendor,
  onSuccess,
}: VendorFormProps) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [commission, setCommission] = React.useState<number>(
    vendor?.commission_rate ?? 0,
  );
  const [previewProduct, setPreviewProduct] = React.useState<Product | null>(
    null,
  );

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPending(true);

    const form = new FormData(e.currentTarget);
    const code = String(form.get("code") ?? "").trim();
    const displayName = String(form.get("display_name") ?? "").trim();
    const status = String(form.get("status") ?? "active") as Vendor["status"];
    const contactEmailRaw = String(form.get("contact_email") ?? "").trim();
    const contactEmail = contactEmailRaw || null;
    const notesRaw = String(form.get("notes") ?? "").trim();
    const notes = notesRaw || null;
    // tier auto-derivation: a vendor created in the platform admin is
    // tier1; tier2 is reserved for "vendor of vendor" (created from
    // inside a tier1's own dashboard, not implemented yet).
    const tier: Vendor["tier"] = vendor?.tier ?? "tier1";

    try {
      if (mode === "create") {
        const created = await createVendor({
          code,
          display_name: displayName,
          tier,
          status,
          grade: null,
          contact_email: contactEmail,
          commission_rate: commission,
          notes,
        });
        if (onSuccess) {
          onSuccess(created.id);
        } else {
          router.push(`/${lang}/admin/vendors/${created.id}`);
          router.refresh();
        }
      } else if (vendor) {
        await patchVendor(vendor.id, {
          display_name: displayName,
          tier,
          status,
          grade: null,
          contact_email: contactEmail,
          commission_rate: commission,
          notes,
        });
        if (onSuccess) {
          onSuccess(vendor.id);
        } else {
          router.push(`/${lang}/admin/vendors/${vendor.id}`);
          router.refresh();
        }
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
        <div className="rounded-md border border-destructive/30 bg-destructive/10 text-destructive text-sm px-3 py-2">
          {error}
        </div>
      ) : null}

      <Field label={dict.vendors.form.code} hint={dict.vendors.form.code_hint}>
        <Input
          name="code"
          required
          defaultValue={v?.code ?? ""}
          disabled={mode === "edit"}
          className="font-mono"
        />
      </Field>

      <Field label={dict.vendors.form.display_name}>
        <Input
          name="display_name"
          required
          defaultValue={v?.display_name ?? ""}
        />
      </Field>

      <Field label={dict.vendors.form.status}>
        <FormSelect
          name="status"
          defaultValue={v?.status ?? "active"}
          options={[
            { label: dict.vendors.statuses.active, value: "active" },
            { label: dict.vendors.statuses.paused, value: "paused" },
            { label: dict.vendors.statuses.terminated, value: "terminated" },
          ]}
        />
      </Field>

      <Field
        label={dict.vendors.form.commission_rate}
        hint={dict.vendors.form.commission_rate_hint}
        labelRight={
          <CommissionProductPicker
            selected={previewProduct}
            onSelect={setPreviewProduct}
            defaultSlug="JP-T50-7D"
          />
        }
      >
        <CommissionSlider
          name="commission_rate"
          value={commission}
          onChange={setCommission}
          disabled={pending}
          previewProduct={previewProduct}
        />
      </Field>

      <Field label={dict.vendors.form.contact_email}>
        <Input
          type="email"
          name="contact_email"
          defaultValue={v?.contact_email ?? ""}
        />
      </Field>

      <Field label={dict.vendors.form.notes}>
        <Textarea
          name="notes"
          rows={4}
          defaultValue={v?.notes ?? ""}
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
  labelRight,
  children,
}: {
  label: string;
  hint?: string;
  labelRight?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1">
      <div className="flex items-center gap-2">
        <span className="block flex-1 text-xs text-muted-foreground">
          {label}
        </span>
        {labelRight}
      </div>
      {children}
      {hint ? (
        <span className="block text-xs text-muted-foreground">{hint}</span>
      ) : null}
    </label>
  );
}
