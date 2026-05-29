import { notFound } from "next/navigation";
import { Toaster } from "sonner";

import { getDictionary, hasLocale, LOCALES } from "../../dictionaries";

import { AdminBreadcrumbs } from "@/components/admin/admin-breadcrumbs";
import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { LocaleSwitcher } from "@/components/admin/locale-switcher";
import { TweaksPanel } from "@/components/admin/tweaks-panel";
import { Separator } from "@/components/ui/separator";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";

// buff-flavored admin shell. The `.admin-scope` class on the outer
// wrapper switches the entire shadcn token palette (primary, card,
// sidebar, etc.) to buff's deep-forest + cream system — see
// globals.css. Storefront tokens are untouched.
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
      <div className="admin-scope min-h-screen bg-background text-foreground">
        <SidebarProvider>
          <AdminSidebar
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
          <SidebarInset>
            <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-3 border-b border-border bg-background/85 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/70">
              <SidebarTrigger className="-ml-1" />
              <Separator orientation="vertical" className="h-5" />
              <AdminBreadcrumbs />
              <div className="ml-auto flex items-center gap-2">
                <LocaleSwitcher
                  currentLang={lang}
                  locales={LOCALES as readonly string[]}
                />
              </div>
            </header>
            <main className="flex-1 px-6 py-6">{children}</main>
          </SidebarInset>
        </SidebarProvider>
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
