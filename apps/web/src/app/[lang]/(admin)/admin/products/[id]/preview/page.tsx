import Link from "next/link";
import { notFound } from "next/navigation";

import { pickI18n } from "@roam/catalog";

import { getDictionary, hasLocale } from "../../../../../dictionaries";

import {
  OperationalStateBadge,
  PublicationStateBadge,
} from "@/components/admin/state-badge";
import { ApiError, getProduct } from "@/lib/api";
import { formatData, formatMoney, formatValidity } from "@/lib/format";

export const dynamic = "force-dynamic";

// Approximation of the eventual storefront card. Lives in the admin section
// so admins can preview a draft / in-review product without flipping it to
// published. When the real storefront product page lands (Phase 2.5), this
// will dogfood the same component instead.
export default async function PreviewProductPage({
  params,
}: {
  params: Promise<{ lang: string; id: string }>;
}) {
  const { lang, id } = await params;
  if (!hasLocale(lang)) notFound();
  const dict = await getDictionary(lang);

  let product;
  try {
    product = await getProduct(id);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  }

  const name = pickI18n(product.display_name_i18n, lang) || product.slug;
  const description = pickI18n(product.description_i18n, lang);

  return (
    <div className="max-w-3xl space-y-4">
      <header>
        <Link
          href={`/${lang}/admin/products/${product.id}/edit`}
          className="text-xs text-fg-secondary hover:underline"
        >
          ← {dict.admin.preview.back_to_edit}
        </Link>
        <h1 className="mt-1 text-2xl font-semibold">{dict.admin.preview.title}</h1>
        <p className="text-sm text-fg-secondary">{dict.admin.preview.intro}</p>
      </header>

      <article className="rounded border border-border bg-surface overflow-hidden">
        {product.media?.hero ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={product.media.hero}
            alt={name}
            className="w-full aspect-[2/1] object-cover bg-surface-muted"
          />
        ) : (
          <div className="w-full aspect-[2/1] bg-surface-muted flex items-center justify-center text-fg-secondary text-xs">
            (no hero image)
          </div>
        )}
        <div className="px-5 py-4 space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h2 className="text-xl font-semibold truncate">{name}</h2>
              <div className="mt-1 text-xs text-fg-secondary font-mono">
                {product.slug}
              </div>
            </div>
            <div className="flex flex-col items-end gap-1 shrink-0">
              <PublicationStateBadge
                state={product.publication_state}
                label={dict.admin.products.states[product.publication_state]}
              />
              <OperationalStateBadge
                state={product.operational_state}
                label={
                  dict.admin.products.operational_states[
                    product.operational_state
                  ]
                }
              />
            </div>
          </div>

          {description ? (
            <p className="text-sm whitespace-pre-line">{description}</p>
          ) : null}

          <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
            <Stat label={dict.admin.preview.destinations}>
              {product.marketing_destinations.join(" · ") || "—"}
            </Stat>
            <Stat label={dict.admin.preview.data}>
              {formatData(product.data_amount_mb)}
            </Stat>
            <Stat label={dict.admin.preview.validity}>
              {formatValidity(product.validity_days)}
            </Stat>
            <Stat label={dict.admin.preview.activation_policy}>
              {product.activation_policy_display}
            </Stat>
          </dl>

          <div className="flex items-end justify-between gap-3 pt-3 border-t border-border">
            <div>
              <div className="text-xs text-fg-secondary">
                {dict.admin.preview.retail}
              </div>
              <div className="text-2xl font-semibold">
                {product.pricing?.retail
                  ? formatMoney(
                      product.pricing.retail,
                      product.pricing.currency,
                    )
                  : "—"}
              </div>
              {product.pricing?.msrp && product.pricing.msrp > product.pricing.retail ? (
                <div className="text-xs text-fg-secondary line-through">
                  {formatMoney(product.pricing.msrp, product.pricing.currency)}
                </div>
              ) : null}
            </div>
            <button
              type="button"
              disabled
              className="rounded bg-fg text-bg px-4 py-2 text-sm opacity-60 cursor-not-allowed"
              aria-label="Storefront CTA (preview only)"
            >
              {/* Preview-only — buyer flow lives in (storefront), wired in Phase 2.5 */}
              Buy
            </button>
          </div>

          {product.tags.length > 0 ? (
            <div className="flex flex-wrap gap-1 pt-2">
              {product.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded bg-surface-muted text-fg-secondary text-xs px-2 py-0.5"
                >
                  {tag}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      </article>
    </div>
  );
}

function Stat({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <dt className="text-xs text-fg-secondary">{label}</dt>
      <dd className="text-sm font-medium">{children}</dd>
    </div>
  );
}
