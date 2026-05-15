import Link from "next/link";
import { notFound } from "next/navigation";

import { getDictionary, hasLocale, LOCALES } from "../../dictionaries";

import { LocaleSwitcher } from "@/components/admin/locale-switcher";

export default async function AdminLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const dict = await getDictionary(lang);

  return (
    <div className="min-h-screen flex bg-bg text-fg">
      <aside className="w-56 shrink-0 border-r border-border bg-surface-muted">
        <div className="px-5 py-5 border-b border-border">
          <Link href={`/${lang}/admin`} className="font-semibold text-fg">
            Roam · {dict.admin.heading}
          </Link>
        </div>
        <nav className="px-2 py-3 space-y-1">
          <NavItem
            href={`/${lang}/admin/products`}
            label={dict.admin.nav.products}
          />
          <NavItem
            href={`/${lang}/admin/supplier-plans`}
            label={dict.admin.nav.supplier_plans}
          />
        </nav>
      </aside>
      <main className="flex-1 min-w-0">
        <header className="flex items-center justify-end gap-3 px-6 py-3 border-b border-border bg-surface">
          <LocaleSwitcher currentLang={lang} locales={LOCALES as readonly string[]} />
        </header>
        <div className="px-6 py-6">{children}</div>
      </main>
    </div>
  );
}

function NavItem({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="block rounded-md px-3 py-2 text-sm text-fg hover:bg-surface"
    >
      {label}
    </Link>
  );
}
