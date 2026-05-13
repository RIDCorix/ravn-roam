import { SectionHeader } from "./how-it-works";

type Plan = {
  name: string;
  tagline: string;
  price: string;
  unit: string;
  features: string[];
  featured?: boolean;
  cta: string;
};

const plans: Plan[] = [
  {
    name: "Hop",
    tagline: "Quick trips, single country.",
    price: "$4",
    unit: "from / 1 GB · 7 days",
    features: [
      "1 country plan",
      "1–3 GB packages",
      "7-day validity",
      "Pay-as-you-roam top-ups",
    ],
    cta: "Pick a country",
  },
  {
    name: "Voyage",
    tagline: "Multi-stop trips across a region.",
    price: "$14",
    unit: "from / 5 GB · 15 days",
    features: [
      "Regional plans (EU, APAC, Americas)",
      "5–20 GB packages",
      "15 / 30-day validity",
      "Hotspot tethering",
    ],
    featured: true,
    cta: "Start a Voyage",
  },
  {
    name: "Atlas",
    tagline: "Always-on data, anywhere on Earth.",
    price: "$29",
    unit: "from / 10 GB · 30 days",
    features: [
      "Global 190+ country plan",
      "10 GB – unlimited",
      "Priority support",
      "Carrier-grade SLA",
    ],
    cta: "Go global",
  },
];

export function Pricing() {
  return (
    <section id="pricing" className="border-b border-border">
      <div className="mx-auto w-full max-w-6xl px-6 py-24 md:py-32">
        <SectionHeader
          eyebrow="Pricing"
          title="Three ways to roam. Zero hidden fees."
          description="Buy only the data you need. Cancel or top up from the Roam app any time."
        />
        <div className="mt-14 grid gap-6 md:grid-cols-3">
          {plans.map((p) => (
            <PlanCard key={p.name} plan={p} />
          ))}
        </div>
        <p className="mt-10 text-center text-sm text-subtle">
          All prices in USD. Roam works on any eSIM-capable iPhone, Pixel,
          Samsung Galaxy or compatible iPad.
        </p>
      </div>
    </section>
  );
}

function PlanCard({ plan }: { plan: Plan }) {
  const featured = plan.featured;
  return (
    <article
      className={
        featured
          ? "relative flex flex-col rounded-3xl border border-foreground bg-foreground p-8 text-background shadow-xl shadow-black/10"
          : "relative flex flex-col rounded-3xl border border-border bg-surface p-8"
      }
    >
      {featured ? (
        <span className="absolute -top-3 left-8 inline-flex items-center rounded-full bg-brand px-3 py-1 text-xs font-medium text-accent">
          Most popular
        </span>
      ) : null}
      <header>
        <h3 className="text-xl font-semibold tracking-tight">{plan.name}</h3>
        <p
          className={
            featured ? "mt-1 text-sm text-background/70" : "mt-1 text-sm text-muted"
          }
        >
          {plan.tagline}
        </p>
      </header>
      <div className="mt-8 flex items-baseline gap-2">
        <span className="text-5xl font-semibold tracking-tight">
          {plan.price}
        </span>
        <span
          className={
            featured ? "text-sm text-background/70" : "text-sm text-subtle"
          }
        >
          {plan.unit}
        </span>
      </div>
      <ul className="mt-8 space-y-3 text-sm">
        {plan.features.map((f) => (
          <li key={f} className="flex items-start gap-3">
            <CheckIcon featured={featured} />
            <span className={featured ? "text-background/90" : "text-muted"}>
              {f}
            </span>
          </li>
        ))}
      </ul>
      <a
        href="#"
        className={
          featured
            ? "mt-10 inline-flex h-12 items-center justify-center rounded-full bg-brand px-6 text-sm font-medium text-accent transition-colors hover:bg-accent hover:text-brand"
            : "mt-10 inline-flex h-12 items-center justify-center rounded-full border border-border-strong px-6 text-sm font-medium transition-colors hover:border-foreground"
        }
      >
        {plan.cta}
      </a>
    </article>
  );
}

function CheckIcon({ featured }: { featured?: boolean }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={
        featured ? "mt-0.5 shrink-0 text-brand" : "mt-0.5 shrink-0 text-brand"
      }
      aria-hidden
    >
      <path d="m20 6-11 11-5-5" />
    </svg>
  );
}
