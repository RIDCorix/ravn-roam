import type { Metadata } from "next";
import { Inter, Geist_Mono } from "next/font/google";
import { notFound } from "next/navigation";

import "../globals.css";
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
    title: dict.meta.title,
    description: dict.meta.description,
    metadataBase: new URL("https://roam.example"),
    icons: { icon: "/favicon.svg" },
    openGraph: {
      title: dict.meta.title,
      description: dict.meta.description,
      type: "website",
    },
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
      className={`${inter.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full">
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
        <div style={{ position: "relative", zIndex: 1 }}>{children}</div>
      </body>
    </html>
  );
}
