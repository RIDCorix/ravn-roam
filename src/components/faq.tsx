import { SectionHeader } from "./how-it-works";

const faqs = [
  {
    q: "Will Roam work on my phone?",
    a: "Roam works on any eSIM-capable device released in the last five years — iPhone XR and newer, Pixel 3 and newer, Samsung Galaxy S20 and newer, plus most current Android flagships. We’ll confirm compatibility before checkout.",
  },
  {
    q: "Do I lose my phone number when I use Roam?",
    a: "No. Roam runs as a second line on your device. Your existing number stays active for calls, iMessage, WhatsApp, and 2FA texts. You decide which line handles data.",
  },
  {
    q: "How is Roam different from a local SIM?",
    a: "You don’t need to find a store, swap trays, or risk losing your home SIM. Install Roam at home, land in another country, and data switches on automatically.",
  },
  {
    q: "Can I top up if I run out of data?",
    a: "Yes. Open the Roam app, pick more data for the same destination, and it adds instantly without changing your eSIM profile.",
  },
  {
    q: "What if I have no signal?",
    a: "Roam connects to multiple partner networks in every region and switches automatically when signal drops. If we can’t deliver service, we refund unused data.",
  },
];

export function FAQ() {
  return (
    <section id="faq" className="border-b border-border">
      <div className="mx-auto grid w-full max-w-6xl gap-12 px-6 py-24 md:grid-cols-[1fr_1.4fr] md:py-32">
        <SectionHeader
          eyebrow="FAQ"
          title="Questions, answered."
          description="Still wondering? Chat with us — average response under two minutes."
        />
        <div className="divide-y divide-border rounded-2xl border border-border bg-surface">
          {faqs.map((f, i) => (
            <details
              key={f.q}
              className="group px-6 py-5 [&_summary::-webkit-details-marker]:hidden"
              open={i === 0}
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-6 text-base font-medium">
                {f.q}
                <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border text-muted transition-colors group-open:rotate-45 group-open:border-foreground group-open:text-foreground">
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden
                  >
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                </span>
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-muted">{f.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
