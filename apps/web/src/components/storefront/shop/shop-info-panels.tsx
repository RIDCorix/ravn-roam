import {
  AlertTriangle,
  CheckCircle2,
  Headphones,
  Smartphone,
  Wifi,
  type LucideIcon,
} from "lucide-react";

import type { ShopRegionLabels } from "./shop-region-types";

export function ReadinessPanel({ labels }: { labels: ShopRegionLabels }) {
  const items: Array<{ icon: LucideIcon; text: string }> = [
    { icon: Smartphone, text: labels.readiness_phone },
    { icon: CheckCircle2, text: labels.readiness_install },
    { icon: Wifi, text: labels.readiness_roaming },
    { icon: Headphones, text: labels.readiness_support },
  ];

  return (
    <section
      className="rounded-2xl bg-surface p-4"
      style={{ boxShadow: "var(--shadow-card)" }}
    >
      <div className="mb-3 flex items-center gap-2">
        <span className="grid h-8 w-8 place-items-center rounded-xl bg-accent-softer text-accent">
          <CheckCircle2 className="h-4 w-4" strokeWidth={2.3} />
        </span>
        <h2 className="text-[14px] font-semibold tracking-[-0.01em] text-fg">
          {labels.readiness_title}
        </h2>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {items.map(({ icon: Icon, text }) => (
          <div
            key={text}
            className="flex min-h-[58px] items-start gap-2 rounded-xl bg-surface-sunken px-3 py-2.5"
          >
            <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" />
            <span className="text-[11.5px] font-medium leading-snug text-fg-secondary">
              {text}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

export function BuyerNotes({ labels }: { labels: ShopRegionLabels }) {
  const items = [
    labels.buyer_note_data_only,
    labels.buyer_note_activation,
    labels.buyer_note_coverage,
  ];

  return (
    <section className="rounded-2xl border border-amber-500/25 bg-amber-500/10 p-4">
      <div className="mb-2 flex items-center gap-2 text-amber-800">
        <AlertTriangle className="h-4 w-4 shrink-0" />
        <h2 className="text-[13px] font-semibold tracking-[-0.01em]">
          {labels.buyer_note_title}
        </h2>
      </div>
      <ul className="space-y-1.5">
        {items.map((item) => (
          <li
            key={item}
            className="flex gap-2 text-[12px] leading-relaxed text-fg-secondary"
          >
            <span className="mt-[0.55em] h-1 w-1 shrink-0 rounded-full bg-amber-700" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
