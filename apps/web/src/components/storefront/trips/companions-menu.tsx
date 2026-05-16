"use client";

// Trip-companions popover, triggered by a user icon in the trip-detail
// header. Replaces the old `CompanionsSection` strip — same backing API
// (PATCH/POST/DELETE /api/trips/:id/companions/:cid) but folded into a
// click-to-open menu instead of a permanent row.

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Copy, Plus, Trash2, UserPlus, Users } from "lucide-react";

import type { ApiCompanion } from "@/lib/trips-api";
import { cn } from "@/lib/utils";

import { Avatar } from "./companions-section";

export interface CompanionsMenuLabels {
  manage_title: string;
  manage_aria: string;
  add: string;
  rename_placeholder: string;
  copy_invite: string;
  copied: string;
  link_only: string;
  joined: string;
  delete: string;
  pick_friend: string;
  pick_friend_soon: string;
}

export function CompanionsMenu({
  tripId,
  companions,
  labels,
}: {
  tripId: string;
  companions: ApiCompanion[];
  labels: CompanionsMenuLabels;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  /* Close on click-outside / Escape. Both listeners go away as soon as the
     panel closes so we're not chewing through events all the time. */
  useEffect(() => {
    if (!open) return;
    const onMouse = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onMouse);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onMouse);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

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
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={labels.manage_aria}
        aria-expanded={open}
        className={cn(
          "relative inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] text-fg transition-colors",
          open ? "bg-[rgba(0,0,0,0.06)]" : "hover:bg-[rgba(0,0,0,0.04)]",
        )}
      >
        <Users className="h-4 w-4" />
        {companions.length > 0 && (
          <span
            className="absolute -bottom-0.5 -right-0.5 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[9px] font-bold text-white"
            style={{
              background: "var(--accent)",
              fontFamily: "var(--font-mono)",
            }}
          >
            {companions.length}
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label={labels.manage_title}
          className="absolute right-0 top-full z-30 mt-2 w-[320px] origin-top-right overflow-hidden rounded-2xl border border-divider bg-white shadow-xl"
        >
          <div className="flex items-center justify-between border-b border-divider px-4 py-3">
            <span className="text-[13px] font-semibold tracking-[-0.01em] text-fg">
              {labels.manage_title}
            </span>
            <span
              className="text-[11px] text-fg-muted"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              {companions.length}
            </span>
          </div>

          <div className="max-h-[60vh] overflow-y-auto py-1">
            {companions.map((c) => (
              <CompanionRow
                key={c.id}
                companion={c}
                onRename={(name) => rename(c.id, name)}
                onDelete={() => remove(c.id)}
                busy={busy}
                labels={labels}
              />
            ))}
          </div>

          <div className="border-t border-divider p-1.5">
            <button
              type="button"
              onClick={() => void addNew()}
              disabled={busy}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-[13px] text-fg transition-colors hover:bg-[rgba(0,0,0,0.04)] disabled:opacity-60"
            >
              <Plus className="h-4 w-4 text-accent" />
              <span className="font-medium">{labels.add}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function CompanionRow({
  companion,
  onRename,
  onDelete,
  busy,
  labels,
}: {
  companion: ApiCompanion;
  onRename: (name: string) => void | Promise<void>;
  onDelete: () => void | Promise<void>;
  busy: boolean;
  labels: CompanionsMenuLabels;
}) {
  const [draft, setDraft] = useState(companion.display_name);
  const [copied, setCopied] = useState(false);
  const [pickToast, setPickToast] = useState(false);
  const claimed = !!companion.user_id;

  /* Drift the local draft if the server overwrote display_name (e.g. the
     companion was renamed in another tab). Cheap effect, idempotent. */
  useEffect(() => {
    setDraft(companion.display_name);
  }, [companion.display_name]);

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
      // Older browsers: silently no-op. The invite URL is still visible
      // on the card via the input's value if we ever surface it.
    }
  }

  function pickFriend() {
    /* Friends system isn't built yet. Show a brief inline toast so the
       affordance is discoverable without a real action behind it. */
    setPickToast(true);
    window.setTimeout(() => setPickToast(false), 1500);
  }

  function commitName() {
    const next = draft.trim();
    if (!next || next === companion.display_name) {
      setDraft(companion.display_name);
      return;
    }
    void onRename(next);
  }

  return (
    <div className="group flex items-center gap-3 px-3 py-2 transition-colors hover:bg-[rgba(0,0,0,0.02)]">
      <Avatar color={companion.color} name={companion.display_name} size={28} />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commitName}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              (e.target as HTMLInputElement).blur();
            } else if (e.key === "Escape") {
              e.preventDefault();
              setDraft(companion.display_name);
              (e.target as HTMLInputElement).blur();
            }
          }}
          placeholder={labels.rename_placeholder}
          className="w-full bg-transparent text-[13px] font-semibold tracking-[-0.01em] text-fg outline-none focus:bg-[rgba(0,0,0,0.04)] focus:rounded focus:px-1 focus:-mx-1"
        />
        <span
          className={cn(
            "truncate text-[10.5px]",
            claimed ? "text-accent" : "text-fg-muted",
          )}
        >
          {pickToast
            ? labels.pick_friend_soon
            : copied
              ? labels.copied
              : claimed
                ? labels.joined
                : labels.link_only}
        </span>
      </div>
      <div className="flex shrink-0 items-center gap-0.5">
        <button
          type="button"
          onClick={pickFriend}
          aria-label={labels.pick_friend}
          title={labels.pick_friend}
          className="inline-flex h-7 w-7 items-center justify-center rounded-md text-fg-muted transition-colors hover:bg-[rgba(0,0,0,0.05)] hover:text-fg"
        >
          <UserPlus className="h-3.5 w-3.5" />
        </button>
        {inviteUrl && (
          <button
            type="button"
            onClick={() => void copyInvite()}
            aria-label={labels.copy_invite}
            title={copied ? labels.copied : labels.copy_invite}
            className={cn(
              "inline-flex h-7 w-7 items-center justify-center rounded-md transition-colors",
              copied
                ? "text-accent"
                : "text-fg-muted hover:bg-[rgba(0,0,0,0.05)] hover:text-fg",
            )}
          >
            <Copy className="h-3.5 w-3.5" />
          </button>
        )}
        <button
          type="button"
          onClick={() => void onDelete()}
          disabled={busy}
          aria-label={labels.delete}
          title={labels.delete}
          className="inline-flex h-7 w-7 items-center justify-center rounded-md text-fg-muted transition-colors hover:bg-[rgba(0,0,0,0.05)] hover:text-[#b91c1c]"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
