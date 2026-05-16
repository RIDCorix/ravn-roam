"use client";

// Trip companions strip. Lives above the tab bar on the trip detail
// page. Shows one card per companion; tap to rename / copy invite /
// delete. New companions can be added with the trailing "+" tile.

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Copy, Plus, Trash2 } from "lucide-react";

import type { ApiCompanion } from "@/lib/trips-api";
import { cn } from "@/lib/utils";

export interface CompanionsLabels {
  section_title: string;
  add: string;
  rename_placeholder: string;
  save: string;
  cancel: string;
  copy_invite: string;
  copied: string;
  link_only: string;
  joined: string;
  delete: string;
}

export function CompanionsSection({
  tripId,
  companions,
  labels,
}: {
  tripId: string;
  companions: ApiCompanion[];
  labels: CompanionsLabels;
}) {
  const router = useRouter();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function api(input: RequestInfo, init?: RequestInit) {
    setBusy(true);
    try {
      const res = await fetch(input, init);
      router.refresh();
      return res;
    } finally {
      setBusy(false);
    }
  }

  async function rename(id: string, displayName: string) {
    await api(`/api/trips/${tripId}/companions/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ display_name: displayName }),
    });
    setEditingId(null);
  }

  async function remove(id: string) {
    await api(`/api/trips/${tripId}/companions/${id}`, { method: "DELETE" });
  }

  async function addNew() {
    const nextNum = companions.length + 1;
    await api(`/api/trips/${tripId}/companions`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ display_name: `旅伴 ${nextNum}` }),
    });
  }

  return (
    <section className="border-b border-divider px-5 py-4">
      <div className="mb-2 flex items-baseline justify-between">
        <span className="text-[12px] font-semibold uppercase tracking-[0.04em] text-fg-secondary">
          {labels.section_title}
        </span>
        <span
          className="text-[11px] text-fg-muted"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          {companions.length}
        </span>
      </div>
      <div className="flex gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {companions.map((c) => (
          <CompanionCard
            key={c.id}
            tripId={tripId}
            companion={c}
            editing={editingId === c.id}
            onEdit={() => setEditingId(c.id)}
            onCancel={() => setEditingId(null)}
            onRename={(name) => rename(c.id, name)}
            onDelete={() => remove(c.id)}
            busy={busy}
            labels={labels}
          />
        ))}
        <button
          type="button"
          onClick={() => void addNew()}
          disabled={busy}
          className="flex h-[88px] w-[80px] shrink-0 flex-col items-center justify-center gap-1.5 rounded-2xl border border-dashed border-divider-strong text-fg-muted transition-colors hover:border-accent hover:text-accent disabled:opacity-60"
        >
          <Plus className="h-4 w-4" />
          <span className="text-[11px] font-medium">{labels.add}</span>
        </button>
      </div>
    </section>
  );
}

function CompanionCard({
  tripId,
  companion,
  editing,
  onEdit,
  onCancel,
  onRename,
  onDelete,
  busy,
  labels,
}: {
  tripId: string;
  companion: ApiCompanion;
  editing: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onRename: (name: string) => void | Promise<void>;
  onDelete: () => void | Promise<void>;
  busy: boolean;
  labels: CompanionsLabels;
}) {
  const [draft, setDraft] = useState(companion.display_name);
  const [copied, setCopied] = useState(false);
  const claimed = !!companion.user_id;

  const inviteUrl =
    typeof window !== "undefined" && companion.invite_token
      ? `${window.location.origin}/invite/${companion.invite_token}`
      : null;

  async function copyInvite() {
    if (!inviteUrl) return;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // Older browsers — fall back to manual selection
    }
  }

  return (
    <div
      className={cn(
        "group relative flex h-[88px] w-[160px] shrink-0 flex-col gap-1.5 rounded-2xl border border-divider bg-white px-3 py-2.5 transition-shadow",
        editing && "border-accent",
      )}
      style={{
        boxShadow: editing ? "0 0 0 1px var(--accent) inset" : "var(--shadow-xs)",
      }}
    >
      <div className="flex items-center gap-2">
        <Avatar color={companion.color} name={companion.display_name} />
        {editing ? (
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={() => {
              if (draft.trim() && draft.trim() !== companion.display_name) {
                void onRename(draft.trim());
              } else {
                onCancel();
              }
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                (e.target as HTMLInputElement).blur();
              }
              if (e.key === "Escape") {
                e.preventDefault();
                setDraft(companion.display_name);
                onCancel();
              }
            }}
            className="min-w-0 flex-1 truncate bg-transparent text-[13px] font-semibold tracking-[-0.01em] outline-none"
            placeholder={labels.rename_placeholder}
          />
        ) : (
          <button
            type="button"
            onClick={onEdit}
            className="min-w-0 flex-1 truncate text-left text-[13px] font-semibold tracking-[-0.01em] text-fg"
            title={companion.display_name}
          >
            {companion.display_name}
          </button>
        )}
      </div>
      <div className="flex items-center justify-between gap-1">
        <span
          className={cn(
            "truncate text-[10.5px]",
            claimed ? "text-accent" : "text-fg-muted",
          )}
        >
          {claimed ? labels.joined : labels.link_only}
        </span>
        <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          {inviteUrl && (
            <button
              type="button"
              onClick={() => void copyInvite()}
              aria-label={labels.copy_invite}
              title={copied ? labels.copied : labels.copy_invite}
              className="inline-flex h-6 w-6 items-center justify-center rounded-md text-fg-muted hover:bg-[rgba(0,0,0,0.04)] hover:text-fg"
            >
              <Copy className="h-3 w-3" />
            </button>
          )}
          <button
            type="button"
            onClick={() => void onDelete()}
            disabled={busy}
            aria-label={labels.delete}
            title={labels.delete}
            className="inline-flex h-6 w-6 items-center justify-center rounded-md text-fg-muted hover:bg-[rgba(0,0,0,0.04)] hover:text-[#b91c1c]"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      </div>
    </div>
  );
}

export function Avatar({
  color,
  name,
  size = 22,
}: {
  color: string;
  name: string;
  size?: number;
}) {
  // Take the first non-space character — Chinese single char or Latin
  // initial — and put it on a colored chip.
  const ch = name.trim().charAt(0) || "?";
  const fontSize = Math.round(size * 0.5);
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full text-white"
      style={{
        width: size,
        height: size,
        background: color,
        fontSize,
        fontWeight: 600,
        lineHeight: 1,
      }}
    >
      {ch}
    </span>
  );
}
