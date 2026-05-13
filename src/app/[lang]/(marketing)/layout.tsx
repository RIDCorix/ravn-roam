import { notFound } from "next/navigation";

import { Footer } from "@/components/footer";
import { RoamNav } from "@/components/nav";
import { getDictionary, hasLocale } from "../dictionaries";

export default async function MarketingLayout({
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
    <>
      <RoamNav dict={dict} currentLocale={lang} />
      <main>{children}</main>
      <Footer dict={dict.footer} currentLocale={lang} />
    </>
  );
}
