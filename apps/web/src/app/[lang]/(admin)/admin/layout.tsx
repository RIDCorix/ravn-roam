import Link from "next/link";
import { notFound } from "next/navigation";
import { LayoutDashboard, Package, PackageSearch } from "lucide-react";

import { getDictionary, hasLocale, LOCALES } from "../../dictionaries";

import { AdminBreadcrumbs } from "@/components/admin/admin-breadcrumbs";
import { AdminNav, type AdminNavGroup } from "@/components/admin/admin-nav";
import { LocaleSwitcher } from "@/components/admin/locale-switcher";
import { Toaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

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

  const groups: AdminNavGroup[] = [
    {
      items: [
        {
          href: `/${lang}/admin`,
          label: dict.admin.heading,
          Icon: LayoutDashboard,
        },
      ],
    },
    {
      label: "Catalog",
      items: [
        {
          href: `/${lang}/admin/products`,
          label: dict.admin.nav.products,
          Icon: Package,
        },
        {
          href: `/${lang}/admin/supplier-plans`,
          label: dict.admin.nav.supplier_plans,
          Icon: PackageSearch,
        },
      ],
    },
  ];

  return (
    <TooltipProvider delayDuration={200}>
      <div className="min-h-screen flex bg-bg text-fg">
        <aside className="w-60 shrink-0 border-r border-divider bg-sidebar flex flex-col">
          <div className="px-5 h-14 flex items-center border-b border-divider">
            <Link
              href={`/${lang}/admin`}
              className="font-semibold tracking-tight text-fg flex items-center gap-2"
            >
              <span className="inline-block h-6 w-6 rounded-md bg-accent" />
              Roam
            </Link>
          </div>
          <AdminNav groups={groups} />
        </aside>
        <main className="flex-1 min-w-0 flex flex-col">
          <header className="h-14 flex items-center gap-3 px-6 border-b border-divider bg-surface">
            <AdminBreadcrumbs />
            <div className="ml-auto flex items-center gap-3">
              <LocaleSwitcher
                currentLang={lang}
                locales={LOCALES as readonly string[]}
              />
            </div>
          </header>
          <div className="flex-1 px-6 py-6">{children}</div>
        </main>
        <Toaster richColors position="bottom-right" />
      </div>
    </TooltipProvider>
  );
}
