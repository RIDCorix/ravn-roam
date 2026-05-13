import Link from "next/link";

const links = [
  { href: "#how-it-works", label: "How it works" },
  { href: "#coverage", label: "Coverage" },
  { href: "#pricing", label: "Pricing" },
  { href: "#faq", label: "FAQ" },
];

export function SiteNav() {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <RoamMark className="h-7 w-7" />
          <span className="text-base">Roam</span>
        </Link>
        <nav className="hidden md:block">
          <ul className="flex items-center gap-8 text-sm text-muted">
            {links.map((l) => (
              <li key={l.href}>
                <a
                  href={l.href}
                  className="transition-colors hover:text-foreground"
                >
                  {l.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <div className="flex items-center gap-2">
          <a
            href="#pricing"
            className="hidden text-sm text-muted transition-colors hover:text-foreground sm:inline"
          >
            Sign in
          </a>
          <a
            href="#pricing"
            className="inline-flex h-9 items-center rounded-full bg-foreground px-4 text-sm font-medium text-background transition-colors hover:bg-brand"
          >
            Get an eSIM
          </a>
        </div>
      </div>
    </header>
  );
}

function RoamMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden
    >
      <rect width="32" height="32" rx="10" fill="var(--brand)" />
      <path
        d="M9 22V10h7.5a4 4 0 0 1 1.4 7.74L21 22h-3.5l-2.7-4.4H12V22H9Zm3-7h4.2a1.7 1.7 0 0 0 0-3.4H12V15Z"
        fill="var(--accent)"
      />
    </svg>
  );
}
