// Multi-line textarea + send button. Enter sends, Shift+Enter newline.

import { ArrowUp } from "lucide-react";

import { cn } from "@/lib/utils";

export function Composer({
  draft,
  onChange,
  onSubmit,
  placeholder,
  disabled,
}: {
  draft: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  placeholder: string;
  disabled?: boolean;
}) {
  const canSend = !disabled && draft.trim().length > 0;
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (canSend) onSubmit();
      }}
      className="sticky bottom-2 flex items-end gap-1.5 rounded-2xl p-1.5"
      style={{
        background: "var(--surface)",
        boxShadow: "var(--shadow-md), inset 0 0 0 1px var(--divider)",
      }}
    >
      <textarea
        value={draft}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            if (canSend) onSubmit();
          }
        }}
        placeholder={placeholder}
        rows={1}
        className="max-h-[120px] min-w-0 flex-1 resize-none border-0 bg-transparent px-3 py-2.5 text-[14px] text-fg outline-none"
        style={{ fontFamily: "var(--font-sans)" }}
      />
      <button
        type="submit"
        disabled={!canSend}
        className={cn(
          "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] text-white transition-colors",
          canSend ? "bg-accent cursor-pointer" : "cursor-not-allowed",
        )}
        style={{
          background: canSend ? undefined : "rgba(0,0,0,0.06)",
        }}
        aria-label="Send"
      >
        <ArrowUp className="h-4 w-4" />
      </button>
    </form>
  );
}
