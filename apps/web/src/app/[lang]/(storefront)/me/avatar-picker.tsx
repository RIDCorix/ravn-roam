"use client";

import { useState } from "react";
import { Check } from "lucide-react";

import { createSupabaseBrowserClient } from "@roam/shared";

import {
  DEFAULT_LUMI_AVATAR_ID,
  LUMI_AVATARS,
  LumiAvatarChip,
} from "@/components/storefront/lumi-avatar";

export function LumiAvatarPicker({
  initialId,
  lang,
}: {
  initialId: string | null;
  lang: string;
}) {
  const [selected, setSelected] = useState(initialId ?? DEFAULT_LUMI_AVATAR_ID);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function choose(id: string) {
    if (saving) return;
    setError(null);
    setSaving(id);
    const previous = selected;
    setSelected(id);
    const supabase = createSupabaseBrowserClient();
    const { error: err } = await supabase.auth.updateUser({
      data: { lumi_avatar: id },
    });
    if (err) {
      setSelected(previous);
      setError(err.message);
    }
    setSaving(null);
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3">
        {LUMI_AVATARS.map((avatar) => {
          const active = avatar.id === selected;
          const isSaving = saving === avatar.id;
          return (
            <button
              key={avatar.id}
              type="button"
              onClick={() => void choose(avatar.id)}
              disabled={!!saving}
              className="group relative flex flex-col items-center gap-2 rounded-2xl border border-divider bg-white px-3 py-4 transition-colors hover:border-divider-strong disabled:opacity-60"
              style={{
                borderColor: active ? "var(--accent)" : undefined,
                boxShadow: active ? "0 0 0 1px var(--accent) inset" : undefined,
              }}
            >
              <LumiAvatarChip avatar={avatar} size={72} />
              <span className="text-[12px] font-medium text-fg-secondary">
                {avatar.label}
              </span>
              {active && (
                <span className="absolute right-1.5 top-1.5 inline-flex h-4 w-4 items-center justify-center rounded-full bg-accent text-white">
                  <Check className="h-2.5 w-2.5" strokeWidth={3} />
                </span>
              )}
              {isSaving && (
                <span className="absolute inset-0 flex items-center justify-center rounded-2xl bg-white/60 text-[11px] text-fg-muted">
                  {lang === "zh-TW" ? "儲存中…" : "Saving…"}
                </span>
              )}
            </button>
          );
        })}
      </div>
      {error && (
        <div className="rounded-lg bg-[rgba(220,38,38,0.08)] px-3 py-2 text-[12px] text-[#b91c1c]">
          {error}
        </div>
      )}
    </div>
  );
}
