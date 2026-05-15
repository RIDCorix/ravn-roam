import Link from "next/link";
import { notFound } from "next/navigation";

import { isProductEditable, pickI18n } from "@roam/catalog";

import { getDictionary, hasLocale } from "../../../../../dictionaries";

import { MappingEditor } from "@/components/admin/mapping-editor";
import { ProductForm } from "@/components/admin/product-form";
import { PublicationControls } from "@/components/admin/publication-controls";
import {
  OperationalStateBadge,
  PublicationStateBadge,
} from "@/components/admin/state-badge";
import { ApiError, getProduct } from "@/lib/api";

export const dynamic = "force-dynamic";

export default async function EditProductPage({
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

  const archived = !isProductEditable(product.publication_state);
  const displayName =
    pickI18n(product.display_name_i18n, lang) || product.slug;

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <Link
            href={`/${lang}/admin/products`}
            className="text-xs text-fg-secondary hover:underline"
          >
            ← {dict.admin.common.back}
          </Link>
          <h1 className="mt-1 text-2xl font-semibold truncate">{displayName}</h1>
          <div className="mt-2 flex items-center gap-2 text-xs text-fg-secondary">
            <span className="font-mono">{product.slug}</span>
            <PublicationStateBadge
              state={product.publication_state}
              label={dict.admin.products.states[product.publication_state]}
            />
            <OperationalStateBadge
              state={product.operational_state}
              label={
                dict.admin.products.operational_states[product.operational_state]
              }
            />
          </div>
        </div>
        <div className="shrink-0 flex gap-2">
          <Link
            href={`/${lang}/admin/products/${product.id}/preview`}
            className="rounded border border-border bg-surface px-3 py-1.5 text-sm hover:border-border-strong"
          >
            {dict.admin.products.publication.preview}
          </Link>
        </div>
      </header>

      {archived ? (
        <div className="rounded border border-border bg-surface-muted text-fg-secondary text-sm px-4 py-3">
          {dict.admin.common.locked_archived}
        </div>
      ) : null}

      <PublicationControls
        lang={lang}
        dict={dict}
        productId={product.id}
        state={product.publication_state}
      />

      <MappingEditor lang={lang} dict={dict} product={product} />

      <ProductForm lang={lang} dict={dict} mode="edit" initial={product} />
    </div>
  );
}
