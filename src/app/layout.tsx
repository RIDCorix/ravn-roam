import type { Metadata } from "next";
import { Inter, Geist_Mono } from "next/font/google";

import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Roam — Quiet connectivity, anywhere you land.",
  description:
    "One eSIM, 200+ destinations. Pay-as-you-go data with no roaming fees.",
  metadataBase: new URL("https://roam.example"),
  icons: {
    icon: "/favicon.svg",
  },
  openGraph: {
    title: "Roam — Quiet connectivity, anywhere you land.",
    description:
      "One eSIM, 200+ destinations. Pay-as-you-go data with no roaming fees.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
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
