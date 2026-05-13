import { Icon, RoamLogo } from "./icons";
import { Button } from "./button";
import { NavLink } from "./nav-link";
import { LanguageSwitcher } from "./language-switcher";
import type { Dictionary, Locale } from "@/app/[lang]/dictionaries";

export function RoamNav({
  dict,
  currentLocale,
}: {
  dict: Dictionary;
  currentLocale: Locale;
}) {
  const links: Array<{ key: keyof Dictionary["nav"]; label: string }> = [
    { key: "coverage", label: dict.nav.coverage },
    { key: "plans", label: dict.nav.plans },
    { key: "howItWorks", label: dict.nav.howItWorks },
    { key: "help", label: dict.nav.help },
  ];

  return (
    <div
      style={{
        position: "sticky",
        top: 0,
        zIndex: 50,
        display: "flex",
        justifyContent: "center",
        padding: "14px 24px 0",
        background:
          "linear-gradient(180deg, rgba(247,247,245,0.85) 0%, rgba(247,247,245,0.65) 70%, rgba(247,247,245,0) 100%)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
      }}
    >
      <nav
        className="r-nav"
        style={{
          width: "100%",
          maxWidth: 1200,
          display: "flex",
          alignItems: "center",
          gap: 24,
          padding: "10px 4px",
        }}
      >
        <a href={`/${currentLocale}`} style={{ textDecoration: "none" }}>
          <RoamLogo />
        </a>

        <div
          className="r-nav-links"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 24,
            marginLeft: 16,
          }}
        >
          {links.map((l) => (
            <NavLink key={l.key} href="#">
              {l.label}
            </NavLink>
          ))}
        </div>

        <div style={{ flex: 1 }} />

        <LanguageSwitcher current={currentLocale} dict={dict.language} />

        <a
          href="#"
          className="r-nav-signin"
          style={{
            fontSize: 13.5,
            color: "var(--fg-secondary)",
            textDecoration: "none",
          }}
        >
          {dict.nav.signIn}
        </a>
        <Button size="sm" style={{ padding: "8px 14px", fontSize: 13.5 }}>
          {dict.nav.cta}
          <Icon name="arrowRight" size={13} />
        </Button>
      </nav>
    </div>
  );
}
