export function Hero() {
  return (
    <section className="relative overflow-hidden border-b border-border">
      <BackgroundGlow />
      <div className="relative mx-auto grid w-full max-w-6xl gap-12 px-6 pb-24 pt-16 md:grid-cols-[1.05fr_0.95fr] md:gap-16 md:pb-32 md:pt-24">
        <div className="flex flex-col justify-center">
          <span className="inline-flex w-fit items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-xs font-medium tracking-wide text-muted">
            <span className="relative flex h-2 w-2">
              <span className="roam-pulse absolute inline-flex h-full w-full rounded-full bg-brand" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-brand" />
            </span>
            Now live in 190+ destinations
          </span>
          <h1 className="mt-6 text-balance text-5xl font-semibold leading-[1.04] tracking-tight md:text-7xl">
            Roam the world,
            <br />
            <span className="text-brand">stay connected.</span>
          </h1>
          <p className="mt-6 max-w-xl text-pretty text-lg leading-relaxed text-muted md:text-xl">
            One eSIM. Every destination. Activate in 60 seconds and switch local
            data on the moment you land — without swapping a single SIM.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <a
              href="#pricing"
              className="inline-flex h-12 items-center justify-center rounded-full bg-foreground px-6 text-sm font-medium text-background transition-colors hover:bg-brand"
            >
              Get my eSIM
            </a>
            <a
              href="#how-it-works"
              className="inline-flex h-12 items-center justify-center rounded-full border border-border-strong px-6 text-sm font-medium text-foreground transition-colors hover:border-foreground"
            >
              See how it works
            </a>
          </div>
          <dl className="mt-10 grid max-w-md grid-cols-3 gap-6 border-t border-border pt-8">
            <Stat value="60s" label="Average activation" />
            <Stat value="190+" label="Countries covered" />
            <Stat value="4.9★" label="Traveller rating" />
          </dl>
        </div>
        <HeroVisual />
      </div>
    </section>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <dt className="text-2xl font-semibold tracking-tight">{value}</dt>
      <dd className="mt-1 text-xs uppercase tracking-wider text-subtle">
        {label}
      </dd>
    </div>
  );
}

function BackgroundGlow() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
    >
      <div className="absolute -top-32 left-1/2 h-[28rem] w-[28rem] -translate-x-1/2 rounded-full bg-brand/15 blur-3xl" />
      <div className="absolute right-[-10%] top-1/3 h-72 w-72 rounded-full bg-accent/40 blur-3xl" />
    </div>
  );
}

function HeroVisual() {
  return (
    <div className="relative mx-auto flex w-full max-w-md items-center justify-center md:max-w-none">
      <div className="relative aspect-square w-full max-w-md">
        <div className="absolute inset-0 rounded-[2rem] border border-border bg-surface shadow-[0_20px_60px_-25px_rgba(11,61,46,0.35)]" />

        <div className="absolute inset-6 grid place-items-center">
          <div className="relative h-full w-full">
            <Globe />
            <div className="roam-orbit absolute inset-0">
              <PinDot className="absolute left-1/2 top-2 -translate-x-1/2" />
              <PinDot className="absolute right-2 top-1/2 -translate-y-1/2" />
              <PinDot className="absolute bottom-2 left-1/2 -translate-x-1/2" />
              <PinDot className="absolute left-2 top-1/2 -translate-y-1/2" />
            </div>
          </div>
        </div>

        <div className="absolute -bottom-6 left-6 right-6 flex items-center justify-between rounded-2xl border border-border bg-surface px-4 py-3 shadow-lg shadow-black/5">
          <div>
            <p className="text-xs text-subtle">Active plan</p>
            <p className="text-sm font-medium">Japan · 5 GB · 7 days</p>
          </div>
          <span className="inline-flex items-center gap-2 rounded-full bg-brand/10 px-3 py-1 text-xs font-medium text-brand">
            <span className="h-1.5 w-1.5 rounded-full bg-brand" />
            Connected
          </span>
        </div>
      </div>
    </div>
  );
}

function Globe() {
  return (
    <svg
      viewBox="0 0 200 200"
      className="h-full w-full text-brand"
      aria-hidden
    >
      <defs>
        <radialGradient id="g1" cx="35%" cy="35%" r="65%">
          <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.7" />
          <stop offset="100%" stopColor="var(--brand)" stopOpacity="1" />
        </radialGradient>
      </defs>
      <circle cx="100" cy="100" r="78" fill="url(#g1)" />
      <g stroke="var(--accent)" strokeOpacity="0.45" fill="none">
        <ellipse cx="100" cy="100" rx="78" ry="30" />
        <ellipse cx="100" cy="100" rx="78" ry="55" />
        <line x1="22" y1="100" x2="178" y2="100" />
        <line x1="100" y1="22" x2="100" y2="178" />
        <ellipse cx="100" cy="100" rx="30" ry="78" />
        <ellipse cx="100" cy="100" rx="55" ry="78" />
      </g>
    </svg>
  );
}

function PinDot({ className }: { className?: string }) {
  return (
    <span className={className}>
      <span className="relative flex h-3 w-3">
        <span className="roam-pulse absolute inline-flex h-full w-full rounded-full bg-accent" />
        <span className="relative inline-flex h-3 w-3 rounded-full border border-brand bg-accent" />
      </span>
    </span>
  );
}
