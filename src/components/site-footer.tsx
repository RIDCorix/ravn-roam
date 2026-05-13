const groups = [
  {
    title: "Product",
    links: [
      { label: "Plans", href: "#pricing" },
      { label: "Coverage", href: "#coverage" },
      { label: "How it works", href: "#how-it-works" },
      { label: "Roam app", href: "#" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About", href: "#" },
      { label: "Careers", href: "#" },
      { label: "Press", href: "#" },
      { label: "Brand", href: "#" },
    ],
  },
  {
    title: "Support",
    links: [
      { label: "Help center", href: "#" },
      { label: "Device compatibility", href: "#" },
      { label: "Contact", href: "#" },
      { label: "Status", href: "#" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="bg-background">
      <div className="mx-auto w-full max-w-6xl px-6 py-16">
        <div className="grid gap-12 md:grid-cols-[1.4fr_repeat(3,1fr)]">
          <div>
            <div className="flex items-center gap-2 font-semibold tracking-tight">
              <svg
                viewBox="0 0 32 32"
                width={28}
                height={28}
                aria-hidden
              >
                <rect width="32" height="32" rx="10" fill="var(--brand)" />
                <path
                  d="M9 22V10h7.5a4 4 0 0 1 1.4 7.74L21 22h-3.5l-2.7-4.4H12V22H9Zm3-7h4.2a1.7 1.7 0 0 0 0-3.4H12V15Z"
                  fill="var(--accent)"
                />
              </svg>
              Roam
            </div>
            <p className="mt-4 max-w-xs text-sm text-muted">
              Global eSIM data for travellers who keep moving. Built in
              Singapore, available worldwide.
            </p>
          </div>
          {groups.map((g) => (
            <div key={g.title}>
              <h4 className="text-xs font-semibold uppercase tracking-widest text-subtle">
                {g.title}
              </h4>
              <ul className="mt-4 space-y-3 text-sm">
                {g.links.map((l) => (
                  <li key={l.label}>
                    <a
                      href={l.href}
                      className="text-muted transition-colors hover:text-foreground"
                    >
                      {l.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-14 flex flex-col items-start justify-between gap-3 border-t border-border pt-8 text-xs text-subtle md:flex-row md:items-center">
          <p>© {new Date().getFullYear()} Roam Networks Pte Ltd.</p>
          <ul className="flex gap-5">
            <li>
              <a href="#" className="transition-colors hover:text-foreground">
                Privacy
              </a>
            </li>
            <li>
              <a href="#" className="transition-colors hover:text-foreground">
                Terms
              </a>
            </li>
            <li>
              <a href="#" className="transition-colors hover:text-foreground">
                Cookies
              </a>
            </li>
          </ul>
        </div>
      </div>
    </footer>
  );
}
