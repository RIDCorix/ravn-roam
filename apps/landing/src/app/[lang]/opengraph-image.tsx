import { ImageResponse } from "next/og";

import { LOCALES, getDictionary, hasLocale } from "./dictionaries";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Roam — Travel eSIM";

export function generateStaticParams() {
  return LOCALES.map((lang) => ({ lang }));
}

export default async function OgImage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!hasLocale(lang)) return new Response("Not found", { status: 404 });
  const dict = await getDictionary(lang);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background:
            "linear-gradient(135deg, #f7f7f5 0%, #ebfaf9 60%, #dcf4f3 100%)",
          padding: "72px 88px",
          fontFamily: "Inter, sans-serif",
        }}
      >
        {/* logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <svg width="44" height="44" viewBox="0 0 28 28" fill="none">
            <circle cx="14" cy="14" r="13" stroke="#111" strokeWidth="1.6" />
            <circle cx="14" cy="14" r="2.4" fill="#111" />
            <path
              d="M5.2 14a8.8 8.8 0 0 1 17.6 0"
              stroke="#111"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
            <path
              d="M8.8 14a5.2 5.2 0 0 1 10.4 0"
              stroke="#0FB8B4"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
          </svg>
          <div style={{ fontSize: 30, fontWeight: 700, color: "#111" }}>
            Roam
          </div>
        </div>

        {/* headline */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            marginTop: "auto",
            gap: 24,
          }}
        >
          <div
            style={{
              fontSize: 96,
              fontWeight: 700,
              color: "#111",
              letterSpacing: "-0.04em",
              lineHeight: 1.0,
              display: "flex",
              flexWrap: "wrap",
              gap: "0 20px",
            }}
          >
            <span>{dict.hero.headlineLead}</span>
            <span
              style={{
                fontStyle: "italic",
                fontWeight: 500,
                color: "#0FB8B4",
              }}
            >
              {dict.hero.headlineAccent}
            </span>
          </div>
          <div
            style={{
              fontSize: 28,
              color: "#666",
              maxWidth: 920,
              lineHeight: 1.4,
            }}
          >
            {dict.meta.description}
          </div>
        </div>
      </div>
    ),
    size,
  );
}
