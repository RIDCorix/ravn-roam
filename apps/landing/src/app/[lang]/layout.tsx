import type { Metadata } from "next";
import { Inter, Geist_Mono } from "next/font/google";
import { notFound } from "next/navigation";

import "../globals.css";
import { MotionProvider } from "@/components/motion-provider";
import {
  buildMetadata,
  organizationJsonLd,
  websiteJsonLd,
} from "@/lib/seo";
import { getDictionary, hasLocale } from "./dictionaries";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  if (!hasLocale(lang)) return {};
  const dict = await getDictionary(lang);
  return {
    ...buildMetadata({
      title: dict.meta.title,
      description: dict.meta.description,
      locale: lang,
      path: "",
      isRoot: true,
    }),
    icons: { icon: "/favicon.svg" },
  };
}

export async function generateStaticParams() {
  return [{ lang: "en" }, { lang: "zh-TW" }];
}

export default async function RootLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();

  /* Precise BCP 47 — Traditional Chinese as used in Taiwan. */
  const htmlLang = lang === "zh-TW" ? "zh-Hant-TW" : lang;

  return (
    <html
      lang={htmlLang}
      className={`${inter.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <script
          type="application/ld+json"
          /* JSON-LD must be raw JSON in a single script tag; React would
             escape children, so we use dangerouslySetInnerHTML. The payload
             is generated from constants and dict, no user input. */
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(organizationJsonLd()),
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(websiteJsonLd(lang)),
          }}
        />
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: "0 0 auto 0",
            height: 1100,
            pointerEvents: "none",
            zIndex: 0,
            background:
              "radial-gradient(50% 60% at 50% 0%, rgba(15, 184, 180, 0.08), transparent 70%), radial-gradient(40% 40% at 90% 10%, rgba(91, 124, 250, 0.05), transparent 70%)",
          }}
        />
        <MotionProvider>
          <div style={{ position: "relative", zIndex: 1 }}>{children}</div>
        </MotionProvider>
      </body>
    </html>
  );
}
