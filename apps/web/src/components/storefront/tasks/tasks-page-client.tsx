"use client";

import { motion } from "framer-motion";
import { useMemo, useState, useTransition } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  CheckCircle2,
  Circle,
  File,
  Flame,
  Home as HomeIcon,
  ListChecks,
  Loader2,
  Package,
  Plane,
  Receipt,
  Search,
  Signal,
  type LucideIcon,
} from "lucide-react";

import { MotionButton, MotionLink, appSpring, fadeUp } from "@/components/storefront/motion";
import { buildChecklistEsimShopHref } from "@/lib/shop-link";
import type { ApiChecklistItem } from "@/lib/trips-api";
import { cn } from "@/lib/utils";

type TaskFilter = "open" | "done" | "all";

export interface TaskTripSummary {
  id: string;
  title: string;
  start_date: string;
  end_date: string;
  status: string;
}

export interface TaskPageLabels {
  title: string;
  subtitle: string;
  open: string;
  done: string;
  all: string;
  search_placeholder: string;
  empty_title: string;
  empty_body: string;
  no_results: string;
  due: string;
  no_due: string;
  suggested: string;
  open_trip: string;
  shop_cta: string;
  esim_order_pending: string;
  esim_order_ready: string;
  esim_order_shared: string;
}

interface TaskWithTrip extends ApiChecklistItem {
  trip: TaskTripSummary | null;
}

const KIND_ICONS: Record<string, LucideIcon> = {
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

export function TasksPageClient({
  lang,
  tasks,
  labels,
}: {
  lang: string;
  tasks: TaskWithTrip[];
  labels: TaskPageLabels;
}) {
  const [filter, setFilter] = useState<TaskFilter>("open");
  const [query, setQuery] = useState("");
  const [optimisticDone, setOptimisticDone] = useState<Record<string, boolean>>({});

  const withState = useMemo(
    () =>
      tasks.map((task) => ({
        ...task,
        done: optimisticDone[task.id] ?? task.done,
      })),
    [optimisticDone, tasks],
  );
  const openCount = withState.filter((task) => !task.done).length;
  const doneCount = withState.filter((task) => task.done).length;
  const normalizedQuery = query.trim().toLowerCase();

  const visible = withState.filter((task) => {
    if (filter === "open" && task.done) return false;
    if (filter === "done" && !task.done) return false;
    if (!normalizedQuery) return true;
    const haystack = `${task.text} ${task.trip?.title ?? ""}`.toLowerCase();
    return haystack.includes(normalizedQuery);
  });

  const grouped = groupTasks(visible);
  const totalLabel = labels.subtitle
    .replace("{open}", String(openCount))
    .replace("{done}", String(doneCount))
    .replace("{all}", String(withState.length));

  return (
    <main className="min-h-full px-5 pb-8 pt-4 md:px-0 md:pt-0">
      <header className="flex flex-col gap-4">
        <div>
          <h1 className="text-[28px] font-semibold tracking-[-0.02em] text-fg">
            {labels.title}
          </h1>
          <p className="mt-1 text-[13px] text-fg-secondary">{totalLabel}</p>
        </div>

        <div className="flex flex-col gap-3">
          <label
            className="flex min-w-0 items-center gap-3 rounded-full bg-surface px-4 py-4 text-fg-secondary transition-colors focus-within:bg-surface"
            style={{ boxShadow: "var(--shadow-card)" }}
          >
            <Search
              className="h-[20px] w-[20px] shrink-0 text-accent"
              strokeWidth={2.25}
            />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={labels.search_placeholder}
              className="min-w-0 flex-1 border-none bg-transparent text-[16px] font-medium text-fg outline-none placeholder:text-fg-muted [&::-webkit-search-cancel-button]:appearance-none [&::-webkit-search-decoration]:appearance-none"
            />
          </label>

          <div className="grid h-11 grid-cols-3 rounded-[14px] bg-surface-sunken p-1 sm:w-[300px]">
            <FilterButton
              active={filter === "open"}
              label={`${labels.open} ${openCount}`}
              onClick={() => setFilter("open")}
            />
            <FilterButton
              active={filter === "done"}
              label={`${labels.done} ${doneCount}`}
              onClick={() => setFilter("done")}
            />
            <FilterButton
              active={filter === "all"}
              label={`${labels.all} ${withState.length}`}
              onClick={() => setFilter("all")}
            />
          </div>
        </div>
      </header>

      {tasks.length === 0 ? (
        <EmptyState title={labels.empty_title} body={labels.empty_body} />
      ) : grouped.length === 0 ? (
        <EmptyState title={labels.no_results} body={labels.empty_body} />
      ) : (
        <div className="mt-5 flex flex-col gap-4">
          {grouped.map((group) => (
            <motion.section
              key={group.key}
              layout
              {...fadeUp}
              className="flex flex-col gap-2.5"
            >
              <div className="flex items-center justify-between px-0.5">
                <div className="min-w-0">
                  <h2 className="truncate text-[13px] font-semibold tracking-[-0.01em] text-fg">
                    {group.title}
                  </h2>
                  {group.meta ? (
                    <p className="mt-0.5 text-[11px] text-fg-muted">{group.meta}</p>
                  ) : null}
                </div>
                <span
                  className="text-[11px] text-fg-muted"
                  style={{ fontFamily: "var(--font-mono)" }}
                >
                  {group.items.length}
                </span>
              </div>
              <div
                className="overflow-hidden rounded-2xl bg-surface"
                style={{ boxShadow: "var(--shadow-card)" }}
              >
                {group.items.map((task) => (
                  <motion.div key={task.id} layout transition={appSpring}>
                    <TaskRow
                      lang={lang}
                      task={task}
                      labels={labels}
                      onDoneChange={(done) =>
                        setOptimisticDone((prev) => ({ ...prev, [task.id]: done }))
                      }
                    />
                  </motion.div>
                ))}
              </div>
            </motion.section>
          ))}
        </div>
      )}
    </main>
  );
}

function FilterButton({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <MotionButton
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-[9px] px-2 text-[12px] font-semibold transition-colors",
        active
          ? "bg-surface text-fg shadow-[var(--shadow-xs)]"
          : "text-fg-secondary hover:text-fg",
      )}
    >
      {label}
    </MotionButton>
  );
}

function TaskRow({
  lang,
  task,
  labels,
  onDoneChange,
}: {
  lang: string;
  task: TaskWithTrip;
  labels: TaskPageLabels;
  onDoneChange: (done: boolean) => void;
}) {
  const [busy, startTransition] = useTransition();
  const Icon = KIND_ICONS[task.kind] ?? ListChecks;
  const shopHref = !task.done && !task.esim_order
    ? buildChecklistEsimShopHref(lang, {
        kind: task.kind,
        text: task.text,
        shopFilter: task.shop_filter as
          | { country?: string; days?: number; gb?: number }
          | null,
      })
    : null;
  const esimOrder = task.esim_order;
  const esimOrderLabel = esimOrder
    ? {
        pending: labels.esim_order_pending,
        ready: labels.esim_order_ready,
        shared: labels.esim_order_shared,
      }[esimOrder.status]
    : null;

  function toggleDone() {
    const next = !task.done;
    onDoneChange(next);
    startTransition(async () => {
      const res = await fetch(`/api/trips/${task.trip_id}/checklist/${task.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ done: next }),
      });
      if (!res.ok) onDoneChange(task.done);
    });
  }

  return (
    <motion.div
      whileHover={{ backgroundColor: "rgba(0,0,0,0.018)" }}
      transition={{ duration: 0.16 }}
      className="flex items-center gap-3 border-b border-divider px-3.5 py-3 last:border-b-0"
    >
      <MotionButton
        type="button"
        onClick={toggleDone}
        disabled={busy}
        aria-label={task.done ? labels.done : labels.open}
        className="inline-flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-[7px] text-white transition-colors disabled:opacity-60"
        style={{
          background: task.done ? "var(--accent)" : "transparent",
          boxShadow: task.done ? "none" : "inset 0 0 0 1.5px var(--divider-strong)",
        }}
      >
        {task.done && <Check className="h-3 w-3" strokeWidth={3} />}
      </MotionButton>

      <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-accent-softer text-accent">
        <Icon className="h-[16px] w-[16px]" strokeWidth={1.8} />
      </span>

      <div className="min-w-0 flex-1">
        <div
          className={cn(
            "truncate text-[13.5px] font-medium text-fg",
            task.done && "text-fg-muted line-through decoration-[var(--fg-muted)]",
          )}
        >
          {task.text}
        </div>
        <div className="mt-1 flex min-w-0 items-center gap-2 text-[11px] text-fg-muted">
          {task.due_date ? (
            <span className="shrink-0 text-warning">
              {labels.due} {task.due_date.slice(5)}
            </span>
          ) : (
            <span className="shrink-0">{labels.no_due}</span>
          )}
          {task.suggested ? <span className="shrink-0">{labels.suggested}</span> : null}
        </div>
      </div>

      {esimOrderLabel ? (
        <span
          className={cn(
            "inline-flex shrink-0 items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-semibold",
            esimOrder?.status === "pending" &&
              "bg-amber-500/12 text-amber-700",
            esimOrder?.status === "ready" &&
              "bg-accent-softer text-accent",
            esimOrder?.status === "shared" && "bg-fg text-white",
          )}
        >
          {esimOrder?.status === "pending" ? (
            <Loader2 className="h-2.5 w-2.5 animate-spin" />
          ) : (
            <Receipt className="h-2.5 w-2.5" />
          )}
          {esimOrderLabel}
        </span>
      ) : shopHref ? (
        <MotionLink
          href={shopHref}
          className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-fg px-2.5 py-1 text-[11px] font-semibold text-white"
        >
          <ArrowUpRight className="h-2.5 w-2.5" />
          {labels.shop_cta}
        </MotionLink>
      ) : task.trip ? (
        <MotionLink
          href={`/${lang}/trips/${task.trip.id}`}
          aria-label={labels.open_trip}
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-fg-secondary transition-colors hover:bg-surface-hover hover:text-fg"
        >
          <ArrowRight className="h-4 w-4" />
        </MotionLink>
      ) : (
        <Circle className="h-4 w-4 shrink-0 text-fg-muted" />
      )}
    </motion.div>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div
      className="mt-6 flex min-h-[280px] flex-col items-center justify-center rounded-2xl bg-surface px-6 text-center"
      style={{ boxShadow: "var(--shadow-card)" }}
    >
      <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-accent-soft text-accent">
        <ListChecks className="h-5 w-5" />
      </div>
      <h2 className="mt-4 text-[16px] font-semibold text-fg">{title}</h2>
      <p className="mt-1 max-w-[280px] text-[13px] leading-6 text-fg-secondary">
        {body}
      </p>
    </div>
  );
}

function groupTasks(tasks: TaskWithTrip[]) {
  const byTrip = new Map<
    string,
    {
      key: string;
      title: string;
      meta: string | null;
      items: TaskWithTrip[];
    }
  >();
  for (const task of tasks) {
    const key = task.trip?.id ?? "unknown";
    const existing = byTrip.get(key);
    const group =
      existing ??
      {
        key,
        title: task.trip?.title ?? "Trip",
        meta: task.trip
          ? `${task.trip.start_date.slice(5)} - ${task.trip.end_date.slice(5)}`
          : null,
        items: [],
      };
    group.items.push(task);
    byTrip.set(key, group);
  }
  return [...byTrip.values()].map((group) => ({
    ...group,
    items: group.items.sort(compareTasks),
  }));
}

function compareTasks(a: TaskWithTrip, b: TaskWithTrip): number {
  if (a.done !== b.done) return a.done ? 1 : -1;
  if (a.due_date && b.due_date && a.due_date !== b.due_date) {
    return a.due_date.localeCompare(b.due_date);
  }
  if (a.due_date && !b.due_date) return -1;
  if (!a.due_date && b.due_date) return 1;
  return a.text.localeCompare(b.text);
}
