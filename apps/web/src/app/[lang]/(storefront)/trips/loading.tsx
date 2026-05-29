import { PageHeader } from "@/components/storefront/home-sections";

export default function TripsLoading() {
  return (
    <div>
      <PageHeader title="Trips" subtitle=" " />
      <div className="flex flex-col gap-6 px-5 pt-1 pb-6" aria-hidden>
        {Array.from({ length: 2 }).map((_, group) => (
          <section key={group} className="flex flex-col gap-2.5">
            <div className="h-4 w-24 rounded-full bg-[rgba(0,0,0,0.08)]" />
            <div className="flex flex-col gap-2">
              {Array.from({ length: group === 0 ? 2 : 3 }).map((__, row) => (
                <div
                  key={row}
                  className="flex items-center gap-3.5 rounded-2xl bg-surface px-4 py-3.5"
                  style={{ boxShadow: "var(--shadow-xs)" }}
                >
                  <div className="h-11 w-11 shrink-0 rounded-[12px] bg-[rgba(0,0,0,0.06)]" />
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="h-4 w-[54%] rounded-full bg-[rgba(0,0,0,0.08)]" />
                    <div className="h-3 w-[78%] rounded-full bg-[rgba(0,0,0,0.06)]" />
                  </div>
                  <div className="h-8 w-10 rounded-[10px] bg-[rgba(0,0,0,0.05)]" />
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
