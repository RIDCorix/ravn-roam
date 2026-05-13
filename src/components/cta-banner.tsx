export function CtaBanner() {
  return (
    <section className="border-b border-border">
      <div className="mx-auto w-full max-w-6xl px-6 py-20">
        <div className="relative overflow-hidden rounded-3xl border border-border bg-foreground px-8 py-16 text-background md:px-14 md:py-20">
          <div
            aria-hidden
            className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-brand/40 blur-3xl"
          />
          <div className="relative flex flex-col gap-8 md:flex-row md:items-center md:justify-between">
            <div className="max-w-xl">
              <h2 className="text-balance text-3xl font-semibold tracking-tight md:text-5xl">
                Next trip booked? Get your eSIM in 60 seconds.
              </h2>
              <p className="mt-3 text-base text-background/70 md:text-lg">
                Install today, pay nothing until you activate your destination.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <a
                href="#pricing"
                className="inline-flex h-12 items-center justify-center rounded-full bg-brand px-6 text-sm font-medium text-accent transition-colors hover:bg-accent hover:text-brand"
              >
                Get my eSIM
              </a>
              <a
                href="#how-it-works"
                className="inline-flex h-12 items-center justify-center rounded-full border border-background/30 px-6 text-sm font-medium text-background transition-colors hover:border-background"
              >
                Learn more
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
