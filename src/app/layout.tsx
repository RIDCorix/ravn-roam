import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Roam — eSIM for travellers who keep moving",
  description:
    "Roam is a global eSIM that activates in 60 seconds. Stay connected across 190+ destinations with transparent, pay-as-you-roam data.",
  metadataBase: new URL("https://roam.example"),
  icons: {
    icon: "/favicon.svg",
  },
  openGraph: {
    title: "Roam — eSIM for travellers who keep moving",
    description:
      "Global eSIM data in 60 seconds. 190+ destinations. No SIM swaps, no roaming surprises.",
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
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-background text-foreground flex flex-col">
        {children}
      </body>
    </html>
  );
}
