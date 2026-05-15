import type {
  ProductOperationalState,
  ProductPublicationState,
  SupplierPlanSyncStatus,
  SupplierStatus,
} from "@roam/catalog";

const PUBLICATION_STYLES: Record<ProductPublicationState, string> = {
  draft: "bg-surface-muted text-fg-secondary border-border",
  in_review: "bg-yellow-50 text-warning border-yellow-300",
  published: "bg-green-50 text-success border-green-300",
  archived: "bg-red-50 text-danger border-red-300",
};

const OPERATIONAL_STYLES: Record<ProductOperationalState, string> = {
  ok: "bg-green-50 text-success border-green-300",
  sold_out: "bg-yellow-50 text-warning border-yellow-300",
  suspended: "bg-red-50 text-danger border-red-300",
  out_of_window: "bg-surface-muted text-fg-secondary border-border",
};

export function PublicationStateBadge({
  state,
  label,
}: {
  state: ProductPublicationState;
  label: string;
}) {
  return (
    <span
      className={`inline-block rounded border px-2 py-0.5 text-xs font-medium ${PUBLICATION_STYLES[state]}`}
    >
      {label}
    </span>
  );
}

export function OperationalStateBadge({
  state,
  label,
}: {
  state: ProductOperationalState;
  label: string;
}) {
  return (
    <span
      className={`inline-block rounded border px-2 py-0.5 text-xs font-medium ${OPERATIONAL_STYLES[state]}`}
    >
      {label}
    </span>
  );
}

const SUPPLIER_STYLES: Record<SupplierStatus, string> = {
  active: "bg-green-50 text-success border-green-300",
  paused: "bg-yellow-50 text-warning border-yellow-300",
  terminated: "bg-red-50 text-danger border-red-300",
};

export function SupplierStatusBadge({
  state,
  label,
}: {
  state: SupplierStatus;
  label: string;
}) {
  return (
    <span
      className={`inline-block rounded border px-2 py-0.5 text-xs font-medium ${SUPPLIER_STYLES[state]}`}
    >
      {label}
    </span>
  );
}

const SYNC_STYLES: Record<SupplierPlanSyncStatus, string> = {
  success: "bg-green-50 text-success border-green-300",
  partial: "bg-yellow-50 text-warning border-yellow-300",
  failed: "bg-red-50 text-danger border-red-300",
};

export function SyncStatusBadge({
  state,
  label,
}: {
  state: SupplierPlanSyncStatus;
  label: string;
}) {
  return (
    <span
      className={`inline-block rounded border px-2 py-0.5 text-xs font-medium ${SYNC_STYLES[state]}`}
    >
      {label}
    </span>
  );
}
