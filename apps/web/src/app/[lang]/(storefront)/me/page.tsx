import { notFound } from "next/navigation";

import { LanguageSwitcher } from "@/components/storefront/me/language-switcher";

import { getDictionary, hasLocale, LOCALES } from "../../dictionaries";

export default async function MePage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const dict = await getDictionary(lang);
  const t = dict.storefront.me;
  const langOptions = LOCALES.map((code) => ({
    value: code,
    label: t.language.options[code],
  }));

  return (
    <main className="mx-auto flex max-w-md flex-col gap-5 px-5 py-6">
      <h1 className="text-[20px] font-semibold tracking-[-0.01em]">
        {t.title}
      </h1>

      <section className="flex flex-col gap-3">
        <h2 className="px-1 text-[12px] font-semibold uppercase tracking-[0.04em] text-fg-secondary">
          {t.settings_section}
        </h2>
        <LanguageSwitcher
          current={lang}
          options={langOptions}
          label={t.language.label}
          hint={t.language.hint}
        />
      </section>
    </main>
  );
}
