import { SectionHeader } from "./how-it-works";

const quotes = [
  {
    quote:
      "Activated my Japan plan from the Narita immigration queue. Worked before I cleared customs.",
    name: "Mia A.",
    role: "Designer · Tokyo trip",
  },
  {
    quote:
      "Swapped countries four times in two weeks. Never opened the SIM tray. Never thought about it.",
    name: "Luca R.",
    role: "Eurail · 6 countries",
  },
  {
    quote:
      "Cheaper than the airport SIM I used last year, and I kept my number for 2FA. Will not go back.",
    name: "Priya S.",
    role: "Remote engineer",
  },
];

export function Testimonials() {
  return (
    <section className="border-b border-border bg-surface-muted">
      <div className="mx-auto w-full max-w-6xl px-6 py-24 md:py-32">
        <SectionHeader
          eyebrow="Travellers"
          title="Loved by people who can’t sit still."
        />
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {quotes.map((q) => (
            <figure
              key={q.name}
              className="flex h-full flex-col rounded-2xl border border-border bg-surface p-7"
            >
              <Stars />
              <blockquote className="mt-5 text-base leading-relaxed">
                “{q.quote}”
              </blockquote>
              <figcaption className="mt-6 border-t border-border pt-4 text-sm">
                <span className="font-medium">{q.name}</span>
                <span className="ml-2 text-subtle">{q.role}</span>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}

function Stars() {
  return (
    <div className="flex gap-1 text-brand" aria-label="5 out of 5 stars">
      {Array.from({ length: 5 }).map((_, i) => (
        <svg
          key={i}
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="currentColor"
          aria-hidden
        >
          <path d="m12 2 3.1 6.5 7.1.7-5.3 4.9 1.6 7L12 17.6 5.5 21l1.6-7L1.8 9.2l7.1-.7L12 2Z" />
        </svg>
      ))}
    </div>
  );
}
