import { Reveal } from "./reveal";
import { ReviewsCarousel } from "./reviews-carousel";
import type { Dictionary } from "@/app/[lang]/dictionaries";

/* Home-page testimonial section: heading + continuous marquee. The old
   /reviews standalone route is removed — testimonials live here now. */
export function ReviewsSection({ dict }: { dict: Dictionary["reviews"] }) {
  return (
    <section
      id="reviews"
      className="r-section"
      style={{ padding: "64px 0 96px", scrollMarginTop: 80 }}
    >
      <div
        style={{
          maxWidth: 1200,
          margin: "0 auto",
          padding: "0 24px 32px",
          display: "flex",
          flexDirection: "column",
          gap: 14,
        }}
      >
        <Reveal y={10}>
          <div
            style={{
              fontSize: 12.5,
              color: "var(--fg-muted)",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              fontWeight: 500,
            }}
          >
            {dict.eyebrow}
          </div>
        </Reveal>
        <Reveal delay={0.08}>
          <h2
            style={{
              margin: 0,
              fontSize: "clamp(28px, 4.2vw, 52px)",
              fontWeight: 600,
              letterSpacing: "-0.03em",
              lineHeight: 1.06,
              color: "var(--fg)",
              textWrap: "balance",
              maxWidth: 720,
            }}
          >
            {dict.title}
          </h2>
        </Reveal>
        {dict.subtitle ? (
          <Reveal delay={0.16}>
            <p
              style={{
                margin: 0,
                fontSize: 16,
                lineHeight: 1.55,
                color: "var(--fg-secondary)",
                maxWidth: 560,
                textWrap: "pretty",
              }}
            >
              {dict.subtitle}
            </p>
          </Reveal>
        ) : null}
      </div>
      <ReviewsCarousel items={dict.items} />
    </section>
  );
}
