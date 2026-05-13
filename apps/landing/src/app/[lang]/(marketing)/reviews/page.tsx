import { notFound } from "next/navigation";

import { PageHeader } from "@/components/page-header";
import { ReviewsCarousel } from "@/components/reviews-carousel";
import { getDictionary, hasLocale } from "../../dictionaries";

export default async function ReviewsPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const dict = await getDictionary(lang);
  const r = dict.reviews;

  return (
    <article>
      <PageHeader
        eyebrow={r.eyebrow}
        title={r.title}
        subtitle={r.subtitle}
        backLabel={dict.page.back}
        currentLocale={lang}
      />
      <section style={{ padding: "0 0 96px" }}>
        <div
          style={{
            maxWidth: 1200,
            margin: "0 auto",
            padding: "0 24px",
          }}
        >
          <ReviewsCarousel items={r.items} controls={r.controls} />
        </div>
      </section>
    </article>
  );
}
