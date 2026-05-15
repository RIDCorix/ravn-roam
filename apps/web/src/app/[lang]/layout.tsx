import type { Metadata } from "next";
import { Inter } from "next/font/google";
import localFont from "next/font/local";
import { notFound } from "next/navigation";

import "../globals.css";
import { getDictionary, hasLocale } from "./dictionaries";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
});

// Intel One Mono — Roam brand mono, used for code, kbd, table data,
// signal-strength labels, mono numerals on the active eSIM card.
// Variable font; weight range 300–700 in a single .ttf.
const intelMono = localFont({
  src: "../fonts/IntelOneMono-VariableFont_wght.ttf",
  variable: "--font-intel-mono",
  weight: "300 700",
  display: "swap",
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
    title: dict.meta.title,
    description: dict.meta.description,
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

  return (
    <html
      lang={lang}
      className={`${inter.variable} ${intelMono.variable} h-full antialiased`}
    >
      <body className="min-h-full">{children}</body>
    </html>
  );
}
