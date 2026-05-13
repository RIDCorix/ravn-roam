const steps = [
  {
    n: "01",
    title: "Pick your destination",
    body: "Choose a country, region, or our Global plan. Plans start from 1 GB and scale up to unlimited.",
  },
  {
    n: "02",
    title: "Install in 60 seconds",
    body: "Scan a QR code or tap install in the Roam app. Your eSIM stays alongside your existing line.",
  },
  {
    n: "03",
    title: "Land and connect",
    body: "Data activates the moment you arrive. Top up, switch destinations, or pause from the app.",
  },
];

export function HowItWorks() {
  return (
    <section
      id="how-it-works"
      className="border-b border-border bg-surface-muted"
    >
      <div className="mx-auto w-full max-w-6xl px-6 py-24 md:py-32">
        <SectionHeader
          eyebrow="How it works"
          title="From booking to boarding in three taps."
          description="No SIM trays, no roaming surprises. Roam lives in your phone alongside your existing line."
        />
        <ol className="mt-14 grid gap-6 md:grid-cols-3">
          {steps.map((s) => (
            <li
              key={s.n}
              className="group relative flex flex-col rounded-2xl border border-border bg-surface p-7 transition-colors hover:border-border-strong"
            >
              <span className="font-mono text-xs tracking-widest text-subtle">
                {s.n}
              </span>
              <h3 className="mt-6 text-xl font-semibold tracking-tight">
                {s.title}
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-muted">{s.body}</p>
              <div className="mt-8 h-px w-full bg-border" />
              <span className="mt-4 inline-flex items-center gap-1 text-xs font-medium text-brand">
                Step {s.n}
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  <path d="M5 12h14M13 5l7 7-7 7" />
                </svg>
              </span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

export function SectionHeader({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description?: string;
}) {
  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <span className="text-xs font-medium uppercase tracking-widest text-brand">
        {eyebrow}
      </span>
      <h2 className="text-balance text-3xl font-semibold tracking-tight md:text-5xl">
        {title}
      </h2>
      {description ? (
        <p className="text-pretty text-base leading-relaxed text-muted md:text-lg">
          {description}
        </p>
      ) : null}
    </div>
  );
}
