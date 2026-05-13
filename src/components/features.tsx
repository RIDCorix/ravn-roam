import { SectionHeader } from "./how-it-works";

type Feature = {
  title: string;
  body: string;
  icon: "bolt" | "shield" | "swap" | "wallet" | "globe" | "support";
};

const features: Feature[] = [
  {
    icon: "bolt",
    title: "60-second activation",
    body: "Install over Wi-Fi before you fly. Data switches on the moment you land — no captive portals, no roaming dance.",
  },
  {
    icon: "globe",
    title: "190+ destinations",
    body: "From Tokyo to Reykjavík. One eSIM moves with you across regional and global plans.",
  },
  {
    icon: "swap",
    title: "Keep your number",
    body: "Roam runs as a second line. Your iMessage, WhatsApp, and 2FA texts stay with your home number.",
  },
  {
    icon: "wallet",
    title: "No bill shock",
    body: "Fixed pricing, no overage surprises, no contracts. Top up only when you need more.",
  },
  {
    icon: "shield",
    title: "Private by design",
    body: "Encrypted SIM profiles, no SMS scraping, and zero tracking pixels in the Roam app.",
  },
  {
    icon: "support",
    title: "Humans, on standby",
    body: "Real travellers in support chat within two minutes — across every timezone.",
  },
];

export function Features() {
  return (
    <section className="border-b border-border">
      <div className="mx-auto w-full max-w-6xl px-6 py-24 md:py-32">
        <SectionHeader
          eyebrow="Why Roam"
          title="Connectivity that respects your trip."
          description="We rebuilt international data from the SIM card up. No roaming agreements, no padded margins, no per-MB billing."
        />
        <div className="mt-14 grid gap-px overflow-hidden rounded-2xl border border-border bg-border md:grid-cols-3">
          {features.map((f) => (
            <article
              key={f.title}
              className="flex h-full flex-col gap-4 bg-surface p-7"
            >
              <FeatureIcon name={f.icon} />
              <h3 className="text-lg font-semibold tracking-tight">{f.title}</h3>
              <p className="text-sm leading-relaxed text-muted">{f.body}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function FeatureIcon({ name }: { name: Feature["icon"] }) {
  const common = {
    width: 22,
    height: 22,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.7,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };
  const wrap = (children: React.ReactNode) => (
    <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-brand/10 text-brand">
      {children}
    </span>
  );
  switch (name) {
    case "bolt":
      return wrap(
        <svg {...common}>
          <path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z" />
        </svg>,
      );
    case "globe":
      return wrap(
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
        </svg>,
      );
    case "swap":
      return wrap(
        <svg {...common}>
          <path d="M3 7h13l-3-3M21 17H8l3 3" />
        </svg>,
      );
    case "wallet":
      return wrap(
        <svg {...common}>
          <path d="M3 7a2 2 0 0 1 2-2h12l4 4v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" />
          <path d="M16 13h3" />
        </svg>,
      );
    case "shield":
      return wrap(
        <svg {...common}>
          <path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6l-8-3Z" />
          <path d="m9 12 2 2 4-4" />
        </svg>,
      );
    case "support":
      return wrap(
        <svg {...common}>
          <path d="M21 11a8 8 0 1 0-15 4l-1 4 4-1a8 8 0 0 0 12-7Z" />
        </svg>,
      );
  }
}
