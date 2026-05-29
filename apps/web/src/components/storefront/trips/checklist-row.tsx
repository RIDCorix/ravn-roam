"use client";

// Single checklist line. esim items with shortcut: "shop" render a Link
// to the shop with country/days/gb pre-filled. Each row also has:
//   * a clickable check-circle that toggles done via PATCH
//   * an assignee chip showing the responsible companion

import Link from "next/link";
import Image from "next/image";
import { useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  CheckCircle2,
  ChevronDown,
  Circle,
  File,
  Flame,
  Home as HomeIcon,
  Image as ImageIcon,
  Loader2,
  Package,
  Pencil,
  Plane,
  Receipt,
  Save,
  Signal,
  Upload,
  UserPlus,
  X,
  type LucideIcon,
} from "lucide-react";

import { Avatar } from "@/components/storefront/trips/companions-section";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { ChecklistItem } from "@/lib/mock/consumer";
import { buildChecklistEsimShopHref } from "@/lib/shop-link";
import { refreshTrip } from "@/lib/trip-cache";
import type { ApiCompanion } from "@/lib/trips-api";
import { cn } from "@/lib/utils";

const KIND_ICONS: Record<ChecklistItem["kind"], LucideIcon> = {
  esim: Signal,
  money: Flame,
  flight: Plane,
  stay: HomeIcon,
  ticket: Receipt,
  visa: File,
  doc: File,
  gear: Package,
  transit: ArrowRight,
  insurance: CheckCircle2,
};

export function ChecklistRow({
  item,
  tripId,
  companions,
  assigneeLabels,
  lang,
  tint,
  shopCtaLabel,
  esimOrderLabels,
  esimShareLabels,
}: {
  item: ChecklistItem;
  tripId: string;
  companions: ApiCompanion[];
  assigneeLabels: {
    assign: string;
    assigned_to: string;
    unassigned: string;
  };
  lang: string;
  tint?: boolean;
  shopCtaLabel: string;
  esimOrderLabels?: {
    pending: string;
    ready: string;
    shared: string;
  };
  esimShareLabels?: {
    title: string;
    description: string;
    cta: string;
    sharing: string;
    shared: string;
    empty: string;
    error: string;
  };
}) {
  const KindIcon = KIND_ICONS[item.kind] ?? Circle;
  const shopHref = !item.done && !item.esimOrder
    ? buildChecklistEsimShopHref(lang, item, {
        tripId,
        checklistItemId: item.id,
        quantity: Math.max(1, companions.length),
      })
    : null;
  const showShopCta = Boolean(shopHref);
  const esimOrder = item.esimOrder;
  const esimOrderLabel = esimOrder
    ? (esimOrderLabels?.[esimOrder.status] ?? esimOrder.status)
    : null;

  const [busy, startTransition] = useTransition();
  const [optimistic, setOptimistic] = useState<{
    done?: boolean;
    assignedCompanionId?: string | null;
    description?: string | null;
    subtasks?: ChecklistSubtask[];
  }>({});
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const pendingUploadIndexRef = useRef<number | null>(null);
  const [previewSubtask, setPreviewSubtask] = useState<ChecklistSubtask | null>(null);
  const [imageUploadError, setImageUploadError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(Boolean(item.description));
  const [editingMemo, setEditingMemo] = useState(false);
  const [memoDraft, setMemoDraft] = useState(item.description ?? "");
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [sharingEsim, setSharingEsim] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);
  const done = optimistic.done ?? item.done;
  const description =
    "description" in optimistic
      ? optimistic.description
      : (item.description ?? null);
  const subtasks =
    ("subtasks" in optimistic ? optimistic.subtasks : item.subtasks) ?? [];
  const assignedId =
    "assignedCompanionId" in optimistic
      ? optimistic.assignedCompanionId
      : (item.assignedCompanionId ?? null);
  const assignee = companions.find((c) => c.id === assignedId);

  useEffect(() => {
    setMemoDraft(item.description ?? "");
  }, [item.description]);

  function patch(body: Record<string, unknown>) {
    startTransition(async () => {
      await fetch(`/api/trips/${tripId}/checklist/${item.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      await refreshTrip(tripId);
    });
  }

  async function shareEsimOrder() {
    if (!esimOrder || esimOrder.status !== "ready") return;
    setSharingEsim(true);
    setShareError(null);
    try {
      const res = await fetch(
        `/api/storefront/orders/${esimOrder.orderId}/share-esims`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ trip_id: tripId }),
        },
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(
          typeof data?.error === "string"
            ? data.error
            : (esimShareLabels?.error ?? "Share failed"),
        );
      }
      setShareDialogOpen(false);
      await refreshTrip(tripId);
    } catch (err) {
      setShareError(
        err instanceof Error
          ? err.message
          : (esimShareLabels?.error ?? "Share failed"),
      );
    } finally {
      setSharingEsim(false);
    }
  }

  function toggleDone() {
    const next = !done;
    setOptimistic((p) => ({ ...p, done: next }));
    patch({ done: next });
  }

  function reassign(id: string | null) {
    setOptimistic((p) => ({ ...p, assignedCompanionId: id }));
    patch({ assigned_companion_id: id });
  }

  function saveMemo() {
    const next = memoDraft.trim();
    setOptimistic((p) => ({ ...p, description: next || null }));
    setEditingMemo(false);
    setExpanded(Boolean(next));
    patch({ description: next || null });
  }

  function toggleSubtask(index: number) {
    const next = subtasks.map((subtask, i) =>
      i === index ? { ...subtask, done: !subtask.done } : subtask,
    );
    setOptimistic((p) => ({ ...p, subtasks: next }));
    patch({ subtasks: serializeSubtasks(next) });
  }

  function pickSubtaskImage(index: number) {
    setImageUploadError(null);
    pendingUploadIndexRef.current = index;
    fileInputRef.current?.click();
  }

  function uploadSubtaskImage(file: File | null) {
    const index = pendingUploadIndexRef.current;
    pendingUploadIndexRef.current = null;
    if (!file || index == null || busy) return;
    startTransition(async () => {
      let imageDataUrl: string;
      try {
        imageDataUrl = await compressImageToDataUrl(file);
      } catch {
        setImageUploadError("圖片處理失敗，請換一張較小的截圖。");
        return;
      }
      const next = subtasks.map((subtask, i) =>
        i === index
          ? {
              ...subtask,
              imageName: file.name,
              imageDataUrl,
              done: true,
            }
          : subtask,
      );
      setImageUploadError(null);
      setOptimistic((p) => ({ ...p, subtasks: next }));
      patch({ subtasks: serializeSubtasks(next) });
    });
  }

  return (
    <div
      className={cn(
        "rounded-2xl px-3.5 py-2.5",
        done && "opacity-60",
      )}
      style={{
        background: tint ? "rgba(15,184,180,0.06)" : "var(--surface)",
        boxShadow: tint
          ? "inset 0 0 0 1px rgba(15,184,180,0.22)"
          : "var(--shadow-xs)",
      }}
    >
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={toggleDone}
          disabled={busy}
          aria-label={done ? "uncheck" : "check"}
          className="inline-flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-[7px] text-white transition-colors"
          style={{
            background: done ? "var(--accent)" : "transparent",
            boxShadow: done
              ? "none"
              : "inset 0 0 0 1.5px var(--divider-strong)",
          }}
        >
          {done && <Check className="h-3 w-3" strokeWidth={3} />}
        </button>

        <KindIcon
          className={cn(
            "h-3.5 w-3.5 shrink-0",
            tint ? "text-accent" : "text-fg-muted",
          )}
        />

        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className={cn(
            "min-w-0 flex-1 truncate text-left text-[13px] text-fg",
            done && "line-through decoration-[var(--fg-muted)]",
          )}
        >
          {item.text}
        </button>

        <button
          type="button"
          onClick={() => {
            setExpanded(true);
            setEditingMemo((v) => !v);
          }}
          className={cn(
            "inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full transition-colors",
            description
              ? "bg-accent-softer text-accent"
              : "text-fg-muted hover:bg-surface-hover",
          )}
          aria-label="編輯 memo"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              disabled={busy}
              className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 disabled:opacity-60"
              title={
                assignee
                  ? `${assigneeLabels.assigned_to}: ${assignee.display_name}`
                  : assigneeLabels.assign
              }
              aria-label={assigneeLabels.assign}
            >
              {assignee ? (
                <Avatar
                  color={assignee.color}
                  name={assignee.display_name}
                  size={22}
                />
              ) : (
                <span className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-dashed border-divider-strong text-fg-muted">
                  <UserPlus className="h-3 w-3" />
                </span>
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuLabel className="text-[12px]">
              {assigneeLabels.assign}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuRadioGroup
              value={assignedId ?? "__unassigned__"}
              onValueChange={(value) =>
                reassign(value === "__unassigned__" ? null : value)
              }
            >
              <DropdownMenuRadioItem
                value="__unassigned__"
                className="text-[12.5px]"
              >
                {assigneeLabels.unassigned}
              </DropdownMenuRadioItem>
              {companions.map((c) => (
                <DropdownMenuRadioItem
                  key={c.id}
                  value={c.id}
                  className="text-[12.5px]"
                >
                  <span className="mr-1 inline-flex">
                    <Avatar color={c.color} name={c.display_name} size={16} />
                  </span>
                  <span className="truncate">{c.display_name}</span>
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
            {companions.length === 0 && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem disabled className="text-[12.5px]">
                  {assigneeLabels.unassigned}
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        {(item.start || item.due) && !done && (
          <div className="flex shrink-0 flex-col items-end leading-none">
            {item.start && (
              <span
                className="whitespace-nowrap text-[10px] text-fg-muted"
                style={{ fontFamily: "var(--font-mono)" }}
              >
                {item.start.slice(5)}
              </span>
            )}
            {item.due && (
              <span
                className="mt-1 whitespace-nowrap text-[11px] text-warning"
                style={{ fontFamily: "var(--font-mono)" }}
              >
                {item.due.slice(5)}
              </span>
            )}
          </div>
        )}

        {esimOrderLabel ? (
          esimOrder?.status === "ready" ? (
            <button
              type="button"
              onClick={() => setShareDialogOpen(true)}
              className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-lg bg-accent-softer px-2.5 py-1 text-[11px] font-semibold text-accent transition-transform hover:scale-[1.02]"
            >
              <Receipt className="h-2.5 w-2.5" />
              {esimOrderLabel}
            </button>
          ) : (
            <span
              className={cn(
                "inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-lg px-2.5 py-1 text-[11px] font-semibold",
                esimOrder?.status === "pending" &&
                  "bg-amber-500/12 text-amber-700",
                esimOrder?.status === "shared" &&
                  "bg-fg text-white",
              )}
            >
              {esimOrder?.status === "pending" ? (
                <Loader2 className="h-2.5 w-2.5 animate-spin" />
              ) : (
                <Receipt className="h-2.5 w-2.5" />
              )}
              {esimOrderLabel}
            </span>
          )
        ) : showShopCta ? (
          <Link
            href={shopHref!}
            className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-lg px-2.5 py-1 text-[11px] font-semibold text-white"
            style={{ background: "#111" }}
          >
            <ArrowUpRight className="h-2.5 w-2.5" />
            {shopCtaLabel}
          </Link>
        ) : null}

        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-fg-muted transition-colors hover:bg-surface-hover"
          aria-label={expanded ? "收合 memo" : "展開 memo"}
        >
          <ChevronDown
            className={cn(
              "h-3.5 w-3.5 transition-transform",
              expanded && "rotate-180",
        )}
          />
        </button>
      </div>

      {expanded && (
        <div className="mt-2 border-t border-divider pt-2">
          {subtasks.length > 0 && (
            <div className="mb-2 space-y-1.5">
              {subtasks.map((subtask, index) => (
                <div
                  key={`${subtask.text}-${index}`}
                  className="flex items-start gap-2 rounded-lg px-1 py-0.5 text-[12.5px] leading-relaxed text-fg-secondary"
                >
                  <button
                    type="button"
                    onClick={() => toggleSubtask(index)}
                    disabled={busy}
                    className={cn(
                      "mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-[5px] transition-colors",
                      subtask.done
                        ? "bg-accent text-white"
                        : "bg-white text-transparent shadow-[inset_0_0_0_1px_var(--divider-strong)]",
                    )}
                    aria-label={subtask.done ? "取消子項目" : "完成子項目"}
                  >
                    <Check className="h-2.5 w-2.5" strokeWidth={3} />
                  </button>
                  <span
                    className={cn(
                      "min-w-0 flex-1",
                      subtask.done && "text-fg-muted line-through",
                    )}
                  >
                    {subtask.text}
                  </span>
                  {subtask.imageDataUrl ? (
                    <button
                      type="button"
                      onClick={() => setPreviewSubtask(subtask)}
                      className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent-softer text-accent"
                      aria-label="查看截圖"
                    >
                      <ImageIcon className="h-3.5 w-3.5" />
                    </button>
                  ) : item.kind === "esim" && shopHref ? (
                    <Link
                      href={shopHref}
                      className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent-softer text-accent transition-transform hover:scale-105"
                      aria-label="前往購買 eSIM"
                    >
                      <ArrowUpRight className="h-3.5 w-3.5" />
                    </Link>
                  ) : (
                    <button
                      type="button"
                      onClick={() => pickSubtaskImage(index)}
                      disabled={busy}
                      className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-fg-muted transition-colors hover:bg-surface-hover hover:text-accent disabled:opacity-60"
                      aria-label="上傳截圖"
                    >
                      {busy ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Upload className="h-3.5 w-3.5" />
                      )}
                    </button>
                  )}
                </div>
              ))}
              <Input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={(e) => {
                  uploadSubtaskImage(e.target.files?.[0] ?? null);
                  e.currentTarget.value = "";
                }}
              />
              {imageUploadError && (
                <div className="px-1 text-[11px] leading-snug text-[#b91c1c]">
                  {imageUploadError}
                </div>
              )}
            </div>
          )}
          {editingMemo ? (
            <div className="space-y-2">
              <Textarea
                value={memoDraft}
                onChange={(e) => setMemoDraft(e.target.value)}
                placeholder="- 可以記準備方式、連結、注意事項"
                rows={4}
                className="min-h-[96px] resize-none rounded-xl border-divider bg-white text-[12.5px] leading-relaxed text-fg placeholder:text-fg-muted focus-visible:ring-2 focus-visible:ring-accent/25 focus-visible:ring-offset-0"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setMemoDraft(description ?? "");
                    setEditingMemo(false);
                  }}
                  className="rounded-full px-3 py-1.5 text-[12px] font-medium text-fg-muted hover:bg-surface-hover"
                >
                  取消
                </button>
                <button
                  type="button"
                  onClick={saveMemo}
                  disabled={busy}
                  className="inline-flex items-center gap-1.5 rounded-full bg-accent px-3 py-1.5 text-[12px] font-semibold text-white disabled:opacity-60"
                >
                  <Save className="h-3 w-3" />
                  儲存
                </button>
              </div>
            </div>
          ) : description ? (
            <MarkdownMemo value={description} />
          ) : (
            <button
              type="button"
              onClick={() => setEditingMemo(true)}
              className="w-full rounded-xl border border-dashed border-divider-strong px-3 py-3 text-left text-[12.5px] text-fg-muted hover:bg-surface-hover"
            >
              新增 memo
            </button>
          )}
        </div>
      )}

      {esimOrder?.status === "ready" ? (
        <Dialog open={shareDialogOpen} onOpenChange={setShareDialogOpen}>
          <DialogContent className="max-w-[360px] rounded-[28px] border-0 bg-surface p-0 shadow-xl">
            <DialogHeader className="border-b border-divider px-5 pb-4 pt-5 text-left">
              <DialogTitle className="text-[18px] tracking-[-0.02em] text-fg">
                {esimShareLabels?.title ?? "分享 eSIM"}
              </DialogTitle>
              <DialogDescription className="text-[12.5px] leading-relaxed text-fg-muted">
                {esimShareLabels?.description ?? ""}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2 px-5 py-4">
              {companions.length > 0 ? (
                companions.map((companion, index) => (
                  <div
                    key={companion.id}
                    className="flex items-center justify-between rounded-2xl bg-surface-sunken px-3 py-2.5"
                  >
                    <div className="flex min-w-0 items-center gap-2.5">
                      <Avatar
                        color={companion.color}
                        name={companion.display_name}
                        size={28}
                      />
                      <div className="min-w-0">
                        <div className="truncate text-[13px] font-semibold text-fg">
                          {companion.display_name}
                        </div>
                        <div className="text-[11px] text-fg-muted">
                          {index + 1} / {Math.max(companions.length, esimOrder.profileCount)}
                        </div>
                      </div>
                    </div>
                    <CheckCircle2 className="h-4 w-4 text-accent" />
                  </div>
                ))
              ) : (
                <div className="rounded-2xl bg-surface-sunken px-3 py-4 text-center text-[12px] text-fg-muted">
                  {esimShareLabels?.empty ?? ""}
                </div>
              )}
              {shareError ? (
                <div className="rounded-2xl bg-red-500/10 px-3 py-2 text-[12px] leading-relaxed text-red-700">
                  {shareError}
                </div>
              ) : null}
            </div>
            <DialogFooter className="border-t border-divider px-5 py-4">
              <Button
                type="button"
                onClick={shareEsimOrder}
                disabled={sharingEsim || companions.length === 0}
                className="h-11 w-full rounded-full bg-accent text-[14px] font-semibold text-white hover:bg-accent/90"
              >
                {sharingEsim ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {esimShareLabels?.sharing ?? "Sharing"}
                  </>
                ) : (
                  esimShareLabels?.cta ?? "Share"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}
      {previewSubtask?.imageDataUrl && (
        <SubtaskImageModal
          subtask={previewSubtask}
          onClose={() => setPreviewSubtask(null)}
        />
      )}
    </div>
  );
}

type ChecklistSubtask = NonNullable<ChecklistItem["subtasks"]>[number];

function serializeSubtasks(subtasks: ChecklistSubtask[]) {
  return subtasks.map((subtask) => ({
    text: subtask.text,
    done: subtask.done,
    image_name: subtask.imageName ?? null,
    image_data_url: subtask.imageDataUrl ?? null,
  }));
}

function SubtaskImageModal({
  subtask,
  onClose,
}: {
  subtask: ChecklistSubtask;
  onClose: () => void;
}) {
  if (!subtask.imageDataUrl) return null;
  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/35 px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-10 md:items-center md:pb-10">
      <div className="w-full max-w-[430px] overflow-hidden rounded-2xl border border-divider bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-divider px-4 py-3">
          <div className="min-w-0">
            <div className="truncate text-[15px] font-semibold text-fg">
              {subtask.text}
            </div>
            {subtask.imageName && (
              <div className="mt-0.5 truncate text-[11px] text-fg-muted">
                {subtask.imageName}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="關閉"
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-fg-muted hover:bg-surface-hover"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-4">
          <Image
            src={subtask.imageDataUrl}
            alt={subtask.imageName ?? subtask.text}
            width={800}
            height={520}
            unoptimized
            className="max-h-[62vh] w-full rounded-xl bg-surface-sunken object-contain"
          />
        </div>
      </div>
    </div>
  );
}

function MarkdownMemo({ value }: { value: string }) {
  const lines = value.split(/\r?\n/);
  const nodes: ReactNode[] = [];
  let bullets: string[] = [];

  function flushBullets() {
    if (bullets.length === 0) return;
    nodes.push(
      <ul key={`ul-${nodes.length}`} className="list-disc space-y-1 pl-4">
        {bullets.map((line, i) => (
          <li key={`${line}-${i}`}>{renderInlineMarkdown(line)}</li>
        ))}
      </ul>,
    );
    bullets = [];
  }

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) {
      flushBullets();
      continue;
    }
    if (line.startsWith("- ") || line.startsWith("* ")) {
      bullets.push(line.slice(2).trim());
      continue;
    }
    flushBullets();
    nodes.push(
      <p key={`p-${nodes.length}`}>{renderInlineMarkdown(line)}</p>,
    );
  }
  flushBullets();

  return (
    <div className="space-y-1.5 text-[12.5px] leading-relaxed text-fg-secondary">
      {nodes}
    </div>
  );
}

function renderInlineMarkdown(value: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\))/g;
  let last = 0;
  for (const match of value.matchAll(re)) {
    if (match.index == null) continue;
    if (match.index > last) out.push(value.slice(last, match.index));
    const token = match[0];
    if (token.startsWith("**")) {
      out.push(
        <strong key={`${token}-${match.index}`} className="font-semibold text-fg">
          {token.slice(2, -2)}
        </strong>,
      );
    } else {
      const link = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      if (link) {
        out.push(
          <a
            key={`${token}-${match.index}`}
            href={link[2]}
            target="_blank"
            rel="noreferrer"
            className="font-medium text-accent underline-offset-2 hover:underline"
          >
            {link[1]}
          </a>,
        );
      }
    }
    last = match.index + token.length;
  }
  if (last < value.length) out.push(value.slice(last));
  return out;
}

async function compressImageToDataUrl(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new Error("not_image");
  }
  const bitmap = await createImageBitmap(file);
  const maxSide = 1600;
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas_unavailable");
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  for (const quality of [0.82, 0.72, 0.62, 0.52]) {
    const dataUrl = canvas.toDataURL("image/jpeg", quality);
    if (dataUrl.length <= 7_500_000) return dataUrl;
  }
  throw new Error("image_too_large");
}
