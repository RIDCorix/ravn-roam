"use client";

import * as React from "react";
import { Loader2, RefreshCw, Send, TicketCheck, WalletCards } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface WalletOrder {
  id: string;
  order_number: string;
  status: string;
  item_status: string;
  wallet_status: "pending" | "ready" | "shared";
  product_name: string;
  quantity: number;
  total_amount: number;
  currency: string;
  created_at: string;
  trip_id: string | null;
  trip_title: string | null;
  assigned_count: number;
  profile_count: number;
}

interface WalletTrip {
  id: string;
  title: string;
}

interface WalletPayload {
  orders: WalletOrder[];
  trips: WalletTrip[];
}

export function EsimWallet({
  labels,
}: {
  labels: {
    title: string;
    summary: string;
    empty: string;
    pending: string;
    ready: string;
    shared: string;
    sync: string;
    syncing: string;
    share: string;
    sharing: string;
    select_trip: string;
    profiles: string;
  };
}) {
  const [payload, setPayload] = React.useState<WalletPayload>({
    orders: [],
    trips: [],
  });
  const [loading, setLoading] = React.useState(true);
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [selectedTrips, setSelectedTrips] = React.useState<Record<string, string>>(
    {},
  );

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/storefront/orders", { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as WalletPayload;
      setPayload(data);
      setSelectedTrips((current) => {
        const next = { ...current };
        for (const order of data.orders) {
          if (!next[order.id]) next[order.id] = order.trip_id ?? data.trips[0]?.id ?? "";
        }
        return next;
      });
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    void load();
  }, []);

  async function refresh(orderId: string) {
    setBusyId(orderId);
    try {
      await fetch(`/api/storefront/orders/${orderId}/refresh`, { method: "POST" });
      await load();
    } finally {
      setBusyId(null);
    }
  }

  async function share(orderId: string) {
    const tripId = selectedTrips[orderId];
    if (!tripId) return;
    setBusyId(orderId);
    try {
      await fetch(`/api/storefront/orders/${orderId}/share-esims`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ trip_id: tripId }),
      });
      await load();
    } finally {
      setBusyId(null);
    }
  }

  const counts = payload.orders.reduce(
    (acc, order) => {
      acc[order.wallet_status] += 1;
      return acc;
    },
    { pending: 0, ready: 0, shared: 0 },
  );

  return (
    <section className="space-y-3">
      <div className="flex items-baseline justify-between px-1">
        <h2 className="text-[18px] font-semibold tracking-[-0.015em] text-fg">
          {labels.title}
        </h2>
        <span className="text-[12px] text-fg-muted tabular-nums">
          {format(labels.summary, {
            pending: String(counts.pending),
            ready: String(counts.ready),
            shared: String(counts.shared),
          })}
        </span>
      </div>

      {loading ? (
        <div className="flex h-32 items-center justify-center rounded-2xl bg-surface text-fg-muted shadow-xs">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : payload.orders.length === 0 ? (
        <div className="flex h-32 flex-col items-center justify-center rounded-2xl bg-surface px-5 text-center shadow-xs">
          <WalletCards className="h-5 w-5 text-fg-muted" />
          <div className="mt-2 text-[13px] text-fg-muted">{labels.empty}</div>
        </div>
      ) : (
        <div className="space-y-2">
          {payload.orders.map((order) => {
            const isBusy = busyId === order.id;
            const canShare =
              order.wallet_status === "ready" && payload.trips.length > 0;
            return (
              <article
                key={order.id}
                className="rounded-2xl bg-surface p-4 shadow-xs"
              >
                <div className="flex items-start gap-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-accent-softer text-accent">
                    <TicketCheck className="h-5 w-5" strokeWidth={2} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="truncate text-[15px] font-semibold tracking-[-0.01em] text-fg">
                          {order.product_name}
                        </div>
                        <div className="mt-0.5 text-[12px] text-fg-muted">
                          {order.order_number}
                        </div>
                      </div>
                      <StatusPill status={order.wallet_status} labels={labels} />
                    </div>
                    <div className="mt-3 grid grid-cols-3 gap-2 text-[12px] text-fg-muted">
                      <span>{order.quantity} 張</span>
                      <span>
                        {order.currency} {Math.round(order.total_amount)}
                      </span>
                      <span>
                        {format(labels.profiles, {
                          count: String(order.profile_count),
                        })}
                      </span>
                    </div>
                    {order.trip_title ? (
                      <div className="mt-2 text-[12px] text-fg-secondary">
                        {order.trip_title} · {order.assigned_count} / {order.quantity}
                      </div>
                    ) : null}

                    {canShare ? (
                      <div className="mt-3 grid grid-cols-[1fr_auto] gap-2">
                        <Select
                          value={selectedTrips[order.id] ?? ""}
                          onValueChange={(value) =>
                            setSelectedTrips((current) => ({
                              ...current,
                              [order.id]: value,
                            }))
                          }
                        >
                          <SelectTrigger className="h-10 w-full rounded-xl bg-surface-sunken">
                            <SelectValue placeholder={labels.select_trip} />
                          </SelectTrigger>
                          <SelectContent>
                            {payload.trips.map((trip) => (
                              <SelectItem key={trip.id} value={trip.id}>
                                {trip.title}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button
                          type="button"
                          onClick={() => share(order.id)}
                          disabled={isBusy || !selectedTrips[order.id]}
                          className="h-10 rounded-xl bg-accent px-3 text-white hover:bg-accent/90"
                        >
                          {isBusy ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Send className="h-4 w-4" />
                          )}
                          <span className="sr-only">{labels.share}</span>
                        </Button>
                      </div>
                    ) : null}

                    {order.wallet_status === "pending" ? (
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => refresh(order.id)}
                        disabled={isBusy}
                        className="mt-3 h-9 rounded-full bg-surface-sunken px-3 text-accent hover:bg-accent-softer"
                      >
                        {isBusy ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <RefreshCw className="mr-2 h-4 w-4" />
                        )}
                        {isBusy ? labels.syncing : labels.sync}
                      </Button>
                    ) : null}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

function StatusPill({
  status,
  labels,
}: {
  status: WalletOrder["wallet_status"];
  labels: { pending: string; ready: string; shared: string };
}) {
  return (
    <span
      className={cn(
        "shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold",
        status === "pending" && "bg-amber-500/12 text-amber-700",
        status === "ready" && "bg-accent-softer text-accent",
        status === "shared" && "bg-fg text-white",
      )}
    >
      {labels[status]}
    </span>
  );
}

function format(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => values[key] ?? "");
}
