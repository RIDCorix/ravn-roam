"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import type { Supplier } from "@roam/catalog";

import {
  pauseSupplierAction,
  triggerSupplierSyncAction,
} from "@/lib/actions";

import type { AdminDict } from "./dict";

export function SupplierActions({
  lang,
  dict,
  supplier,
}: {
  lang: string;
  dict: AdminDict;
  supplier: Supplier;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function onSync() {
    setMessage(null);
    setError(null);
    startTransition(async () => {
      const res = await triggerSupplierSyncAction(lang, supplier.id, supplier.code);
      if (res.ok) {
        setMessage(`Sync triggered (logId: ${res.logId ?? "—"})`);
        router.refresh();
      } else {
        setError(res.error ?? dict.admin.common.errors.generic);
      }
    });
  }

  function onTogglePause() {
    setMessage(null);
    setError(null);
    const nextStatus = supplier.status === "paused" ? "active" : "paused";
    startTransition(async () => {
      const res = await pauseSupplierAction(lang, supplier.id, {
        status: nextStatus,
      });
      if (res.ok) {
        router.refresh();
      } else {
        setError(res.error ?? dict.admin.common.errors.generic);
      }
    });
  }

  const isTerminated = supplier.status === "terminated";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={onSync}
        disabled={isPending || isTerminated}
        data-testid="manual-sync-button"
        className="rounded bg-fg text-bg px-3 py-1.5 text-sm hover:opacity-90 disabled:opacity-60"
      >
        {isPending
          ? dict.admin.suppliers.detail.manual_sync_in_progress
          : dict.admin.suppliers.detail.manual_sync}
      </button>

      <button
        type="button"
        onClick={onTogglePause}
        disabled={isPending || isTerminated}
        data-testid="pause-supplier-button"
        className="rounded border border-border bg-surface px-3 py-1.5 text-sm hover:border-border-strong disabled:opacity-60"
      >
        {supplier.status === "paused"
          ? dict.admin.suppliers.detail.resume
          : dict.admin.suppliers.detail.pause}
      </button>

      {isTerminated ? (
        <span className="text-xs text-fg-secondary">
          {dict.admin.suppliers.detail.terminated_notice}
        </span>
      ) : null}

      {message ? (
        <span
          data-testid="action-message"
          className="text-xs text-success"
        >
          {message}
        </span>
      ) : null}
      {error ? (
        <span data-testid="action-error" className="text-xs text-danger">
          {error}
        </span>
      ) : null}
    </div>
  );
}
