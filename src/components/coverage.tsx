import { SectionHeader } from "./how-it-works";

const destinations = [
  { name: "Japan", from: "$4", flag: "🇯🇵" },
  { name: "United States", from: "$6", flag: "🇺🇸" },
  { name: "Thailand", from: "$3", flag: "🇹🇭" },
  { name: "United Kingdom", from: "$5", flag: "🇬🇧" },
  { name: "South Korea", from: "$4", flag: "🇰🇷" },
  { name: "Italy", from: "$4", flag: "🇮🇹" },
  { name: "Vietnam", from: "$3", flag: "🇻🇳" },
  { name: "Australia", from: "$7", flag: "🇦🇺" },
];

export function Coverage() {
  return (
    <section id="coverage" className="border-b border-border bg-surface-muted">
      <div className="mx-auto w-full max-w-6xl px-6 py-24 md:py-32">
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <SectionHeader
            eyebrow="Coverage"
            title="Network-grade data in 190+ destinations."
            description="Tier-1 carriers in every region, multiple fallback networks, automatic switching when signal drops."
          />
          <a
            href="#pricing"
            className="inline-flex h-11 items-center justify-center rounded-full border border-border-strong px-5 text-sm font-medium transition-colors hover:border-foreground"
          >
            See all destinations →
          </a>
        </div>
        <ul className="mt-12 grid grid-cols-2 gap-3 md:grid-cols-4">
          {destinations.map((d) => (
            <li key={d.name}>
              <a
                href="#pricing"
                className="group flex items-center justify-between rounded-2xl border border-border bg-surface p-4 transition-colors hover:border-foreground"
              >
                <span className="flex items-center gap-3">
                  <span className="text-2xl" aria-hidden>
                    {d.flag}
                  </span>
                  <span className="text-sm font-medium">{d.name}</span>
                </span>
                <span className="text-xs text-subtle group-hover:text-foreground">
                  from {d.from}
                </span>
              </a>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
