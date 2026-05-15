import { notFound } from "next/navigation";

import { LumiLauncher } from "@/components/storefront/lumi/lumi-launcher";
import { StorefrontShell } from "@/components/storefront/shell";

import { getDictionary, hasLocale } from "../dictionaries";

export default async function StorefrontLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const dict = await getDictionary(lang);
  const lumi = dict.storefront.lumi;

  return (
    <StorefrontShell lang={lang} labels={dict.storefront.nav}>
      {children}
      <LumiLauncher
        lang={lang}
        copy={{
          launcherLabel: lumi.launcher_label,
          sheetTitle: lumi.sheet_title,
          sheetSubtitle: lumi.sheet_subtitle,
          close: lumi.close,
          introDefault: lumi.intro_default,
          introTripTemplate: lumi.intro_trip,
          greetingDefault: lumi.greeting_default,
          greetingTripTemplate: lumi.greeting_trip,
          composerPlaceholder: lumi.composer_placeholder,
          suggestionsDefault: lumi.suggestions_default,
          suggestionsTrip: lumi.suggestions_trip,
          errorPrefix: lumi.error_prefix,
          itineraryTitle: lumi.itinerary_title,
          esimCtaFallback: lumi.esim_cta_fallback,
        }}
      />
    </StorefrontShell>
  );
}
