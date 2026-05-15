import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Package, PackageSearch, Plus } from "lucide-react";

import { type Product, pickI18n } from "@roam/catalog";

import { getDictionary, hasLocale } from "../../dictionaries";

import {
  OperationalStateBadge,
  PublicationStateBadge,
} from "@/components/admin/state-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ApiError, listProducts } from "@/lib/api";
import { formatDateTime, formatMoney } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function AdminPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const dict = await getDictionary(lang);

  let products: Product[] = [];
  let apiError: string | null = null;
  try {
    products = await listProducts({});
  } catch (err) {
    apiError =
      err instanceof ApiError
        ? `${err.status}: ${err.body.slice(0, 200)}`
        : (err as Error).message;
  }

  const counts = {
    draft: products.filter((p) => p.publication_state === "draft").length,
    in_review: products.filter((p) => p.publication_state === "in_review").length,
    published: products.filter((p) => p.publication_state === "published").length,
    archived: products.filter((p) => p.publication_state === "archived").length,
  };

  const recent = products.slice(0, 6);

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">
          {dict.admin.heading}
        </h1>
        <p className="mt-1 text-sm text-fg-secondary">{dict.admin.tagline}</p>
      </header>

      {apiError ? (
        <div className="rounded-md border border-error/30 bg-error-soft text-error text-sm px-4 py-3">
          API unreachable: {apiError}
        </div>
      ) : null}

      {/* Quick actions ------------------------------------------------- */}
      <section>
        <h2 className="text-xs font-medium uppercase tracking-wider text-fg-muted mb-3">
          Quick actions
        </h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <ActionCard
            href={`/${lang}/admin/products/new`}
            icon={<Plus className="h-4 w-4" />}
            title={dict.admin.products.create}
            subtitle="Build a product from scratch."
          />
          <ActionCard
            href={`/${lang}/admin/supplier-plans`}
            icon={<PackageSearch className="h-4 w-4" />}
            title={dict.admin.products.create_from_plan}
            subtitle="Browse supplier plans, prefill from one."
          />
          <ActionCard
            href={`/${lang}/admin/products`}
            icon={<Package className="h-4 w-4" />}
            title={dict.admin.products.title}
            subtitle="All products + filters."
          />
        </div>
      </section>

      {/* Publication state overview ------------------------------------ */}
      <section>
        <h2 className="text-xs font-medium uppercase tracking-wider text-fg-muted mb-3">
          {dict.admin.products.filters.publication_state}
        </h2>
        <div className="grid gap-3 sm:grid-cols-4">
          {(["draft", "in_review", "published", "archived"] as const).map(
            (state) => (
              <Card key={state} className="border-border">
                <CardHeader className="pb-2">
                  <CardDescription className="text-xs">
                    {dict.admin.products.states[state]}
                  </CardDescription>
                  <CardTitle className="text-3xl font-semibold tabular-nums">
                    {counts[state]}
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <Button
                    asChild
                    variant="ghost"
                    size="sm"
                    className="h-7 px-0 text-xs text-fg-secondary hover:text-accent"
                  >
                    <Link href={`/${lang}/admin/products?state=${state}`}>
                      View →
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            ),
          )}
        </div>
      </section>

      <Separator />

      {/* Recent products ---------------------------------------------- */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-medium uppercase tracking-wider text-fg-muted">
            Recent products
          </h2>
          <Button asChild variant="ghost" size="sm" className="h-7 text-xs">
            <Link href={`/${lang}/admin/products`}>
              See all <ArrowRight className="ml-1 h-3 w-3" />
            </Link>
          </Button>
        </div>
        {recent.length === 0 ? (
          <p className="text-sm text-fg-secondary">
            {apiError
              ? "—"
              : "No products yet. Create one or import from a supplier plan."}
          </p>
        ) : (
          <div className="grid gap-2">
            {recent.map((product) => (
              <Link
                key={product.id}
                href={`/${lang}/admin/products/${product.id}/edit`}
                className="group flex items-center gap-3 rounded-md border border-border bg-surface px-4 py-3 hover:border-border-strong transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium truncate">
                      {pickI18n(product.display_name_i18n, lang) || product.slug}
                    </span>
                    <PublicationStateBadge
                      state={product.publication_state}
                      label={
                        dict.admin.products.states[product.publication_state]
                      }
                    />
                    {product.operational_state !== "ok" ? (
                      <OperationalStateBadge
                        state={product.operational_state}
                        label={
                          dict.admin.products.operational_states[
                            product.operational_state
                          ]
                        }
                      />
                    ) : null}
                  </div>
                  <div className="mt-0.5 flex items-center gap-3 text-xs text-fg-secondary">
                    <span className="font-mono">{product.slug}</span>
                    <span>·</span>
                    <span>
                      {dict.admin.products.categories[product.category]}
                    </span>
                    {product.marketing_destinations.length > 0 ? (
                      <>
                        <span>·</span>
                        <Badge variant="secondary" className="text-[10px]">
                          {product.marketing_destinations
                            .slice(0, 3)
                            .join(", ")}
                          {product.marketing_destinations.length > 3
                            ? ` +${product.marketing_destinations.length - 3}`
                            : ""}
                        </Badge>
                      </>
                    ) : null}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  {product.pricing?.retail ? (
                    <div className="text-sm font-medium tabular-nums">
                      {formatMoney(
                        product.pricing.retail,
                        product.pricing.currency,
                      )}
                    </div>
                  ) : null}
                  <div className="text-[11px] text-fg-muted">
                    {formatDateTime(product.updated_at)}
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-fg-muted group-hover:text-accent shrink-0" />
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function ActionCard({
  href,
  icon,
  title,
  subtitle,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
}) {
  return (
    <Link
      href={href}
      className="group rounded-md border border-border bg-surface px-4 py-4 hover:border-accent hover:shadow-[var(--shadow-sm)] transition-all"
    >
      <div className="flex items-center gap-2 text-fg">
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-accent-soft text-accent">
          {icon}
        </span>
        <span className="font-medium">{title}</span>
      </div>
      <p className="mt-2 text-xs text-fg-secondary">{subtitle}</p>
    </Link>
  );
}
