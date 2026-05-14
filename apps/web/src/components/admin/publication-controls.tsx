"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import {
  type ProductPublicationState,
  allowedTransitions,
  type PublicationTransition,
} from "@roam/catalog";

import type { AdminDict } from "./dict";
import { publicationActionRunner } from "@/lib/actions";

export function PublicationControls({
  lang,
  dict,
  productId,
  state,
}: {
  lang: string;
  dict: AdminDict;
  productId: string;
  state: ProductPublicationState;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const transitions = allowedTransitions(state);

  function run(action: PublicationTransition) {
    setError(null);
    startTransition(async () => {
      const result = await publicationActionRunner(lang, productId, { action });
      if (!result.ok) {
        setError(result.error ?? "unknown_error");
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="rounded border border-border bg-surface px-5 py-4">
      <h2 className="text-base font-semibold mb-3">
        {dict.admin.products.publication.title}
      </h2>
      <div className="text-xs text-fg-secondary mb-3">
        {dict.admin.products.publication.current_state}:{" "}
        <span className="font-medium text-fg">
          {dict.admin.products.states[state]}
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        {transitions.map((action) => (
          <button
            key={action}
            type="button"
            onClick={() => run(action)}
            disabled={pending}
            className="rounded border border-border bg-bg px-3 py-1.5 text-sm hover:border-border-strong disabled:opacity-50"
          >
            {dict.admin.products.publication.actions[action]}
          </button>
        ))}
      </div>
      {error ? (
        <div className="mt-3 rounded border border-red-300 bg-red-50 text-danger text-xs px-3 py-2">
          {error}
        </div>
      ) : null}
    </div>
  );
}
