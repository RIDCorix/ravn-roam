import Link from "next/link";
import { notFound } from "next/navigation";
import { Toaster } from "sonner";

import { getDictionary, hasLocale, LOCALES } from "../../dictionaries";

import { AdminBreadcrumbs } from "@/components/admin/admin-breadcrumbs";
import { AdminNav } from "@/components/admin/admin-nav";
import { LocaleSwitcher } from "@/components/admin/locale-switcher";
import { TweaksPanel } from "@/components/admin/tweaks-panel";
import { TooltipProvider } from "@/components/ui/tooltip";

// ROA-100 Lume redesign: the admin lives inside a floating app-canvas on a
// warm-white body with an ambient teal/indigo bloom behind it. The shell
// classes (.app-shell / .app-canvas / .app-main / .bg-ambient) live in
// apps/web/src/app/globals.css so any future Lume surface can opt in
// without re-declaring the radii / shadow values.
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
    <TooltipProvider delayDuration={200}>
      <div className="bg-ambient h-screen w-screen overflow-hidden">
        <div className="app-shell">
          <aside className="w-60 shrink-0 flex flex-col pr-3">
            <div className="px-3 h-14 flex items-center">
              <Link
                href={`/${lang}/admin`}
                className="font-semibold tracking-tight text-fg flex items-center gap-2"
              >
                <span className="inline-block h-6 w-6 rounded-md bg-accent" />
                Roam
              </Link>
            </div>
            <AdminNav
              lang={lang}
              labels={{
                dashboard: dict.admin.heading,
                orders: dict.admin.nav.orders,
                products: dict.admin.nav.products,
                suppliers: dict.admin.nav.suppliers,
                supplier_plans: dict.admin.nav.supplier_plans,
                vendors: dict.admin.nav.vendors,
              }}
            />
          </aside>
          <div className="app-canvas">
            <header className="h-14 flex items-center gap-3 px-6 border-b border-divider bg-surface/80 backdrop-blur">
              <AdminBreadcrumbs />
              <div className="ml-auto flex items-center gap-3">
                <LocaleSwitcher
                  currentLang={lang}
                  locales={LOCALES as readonly string[]}
                />
              </div>
            </header>
            <div className="app-main">
              <div className="lume-screen px-6 py-6">{children}</div>
            </div>
          </div>
        </div>
        <TweaksPanel
          dict={{
            title: dict.admin.tweaks.title,
            appearance: dict.admin.tweaks.appearance,
            accent: dict.admin.tweaks.accent,
            ambient: dict.admin.tweaks.ambient,
            density: dict.admin.tweaks.density,
            density_options: dict.admin.tweaks.density_options,
            display: dict.admin.tweaks.display,
            currency: dict.admin.tweaks.currency,
          }}
        />
        <Toaster richColors position="bottom-right" />
      </div>
    </TooltipProvider>
  );
}
