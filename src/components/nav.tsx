import { Icon, RoamLogo } from "./icons";
import { Button } from "./button";
import { NavLink } from "./nav-link";

const links = ["Coverage", "Plans", "How it works", "Help"];

export function RoamNav() {
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
        style={{
          width: "100%",
          maxWidth: 1200,
          display: "flex",
          alignItems: "center",
          gap: 24,
          padding: "10px 4px",
        }}
      >
        <a href="#" style={{ textDecoration: "none" }}>
          <RoamLogo />
        </a>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 24,
            marginLeft: 16,
          }}
        >
          {links.map((label) => (
            <NavLink key={label} href="#">
              {label}
            </NavLink>
          ))}
        </div>

        <div style={{ flex: 1 }} />

        <a
          href="#"
          style={{
            fontSize: 13.5,
            color: "var(--fg-secondary)",
            textDecoration: "none",
          }}
        >
          Sign in
        </a>
        <Button size="sm" style={{ padding: "8px 14px", fontSize: 13.5 }}>
          Get an eSIM
          <Icon name="arrowRight" size={13} />
        </Button>
      </nav>
    </div>
  );
}
