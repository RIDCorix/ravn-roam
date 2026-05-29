import Link from "next/link";
import { ChevronLeft } from "lucide-react";

export default function TripDetailLoading() {
  return (
    <div>
      <header
        className="sticky top-0 z-10 flex items-center gap-2.5 px-5 py-3.5 backdrop-blur-xl backdrop-saturate-150"
        style={{ background: "rgba(247,247,245,0.85)" }}
      >
        <Link
          href="../"
          aria-label="Back"
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] text-fg hover:bg-[rgba(0,0,0,0.04)]"
        >
          <ChevronLeft className="h-4 w-4" />
        </Link>
        <div className="min-w-0 flex-1 space-y-2">
          <div className="h-5 w-44 rounded-full bg-[rgba(0,0,0,0.08)]" />
          <div className="h-3 w-32 rounded-full bg-[rgba(0,0,0,0.06)]" />
        </div>
      </header>
      <div className="px-5 pb-8" aria-hidden>
        <div className="mt-5 h-[34vw] min-h-[180px] max-h-[340px] rounded-[24px] bg-[rgba(0,0,0,0.06)]" />
        <div className="mt-8 space-y-3">
          <div className="h-3 w-28 rounded-full bg-[rgba(0,0,0,0.08)]" />
          <div className="h-7 w-64 max-w-full rounded-full bg-[rgba(0,0,0,0.08)]" />
          <div className="h-4 w-24 rounded-full bg-[rgba(0,0,0,0.06)]" />
        </div>
        <div className="mt-8 space-y-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex gap-4">
              <div className="w-16 space-y-2">
                <div className="h-4 w-12 rounded-full bg-[rgba(0,0,0,0.10)]" />
                <div className="h-3 w-9 rounded-full bg-[rgba(0,0,0,0.06)]" />
              </div>
              <div className="h-10 w-10 rounded-full bg-[rgba(15,184,180,0.16)]" />
              <div className="min-w-0 flex-1 space-y-2">
                <div className="h-5 w-[70%] rounded-full bg-[rgba(0,0,0,0.08)]" />
                <div className="h-3 w-[46%] rounded-full bg-[rgba(0,0,0,0.06)]" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
