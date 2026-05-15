import Link from "next/link";
import { notFound } from "next/navigation";

import { getDictionary, hasLocale } from "../../../../dictionaries";

import { SupplierActions } from "@/components/admin/supplier-actions";
import {
  SupplierStatusBadge,
  SyncStatusBadge,
} from "@/components/admin/state-badge";
import { ApiError, getSupplier } from "@/lib/api";
import { formatDateTime, formatDurationMs } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function SupplierDetailPage({
  params,
}: {
  params: Promise<{ lang: string; id: string }>;
}) {
  const { lang, id } = await params;
  if (!hasLocale(lang)) notFound();
  const dict = await getDictionary(lang);

  let data;
  try {
    data = await getSupplier(id);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  }

  const { supplier, sync_logs } = data;

  return (
    <div>
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs text-fg-secondary mb-1">
            <Link
              href={`/${lang}/admin/suppliers`}
              className="hover:underline"
            >
              {dict.admin.suppliers.back}
            </Link>
          </p>
          <h1 className="text-2xl font-semibold flex items-center gap-3">
            <span className="font-mono text-fg-secondary text-base">
              {supplier.code}
            </span>
            <span>{supplier.display_name}</span>
            <SupplierStatusBadge
              state={supplier.status}
              label={dict.admin.suppliers.statuses[supplier.status]}
            />
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/${lang}/admin/suppliers/${id}/edit`}
            className="rounded border border-border bg-surface px-3 py-1.5 text-sm hover:border-border-strong"
          >
            {dict.admin.suppliers.detail.edit}
          </Link>
          <Link
            href={`/${lang}/admin/supplier-plans?supplier_id=${id}`}
            className="rounded border border-border bg-surface px-3 py-1.5 text-sm hover:border-border-strong"
          >
            {dict.admin.suppliers.detail.view_plans}
          </Link>
        </div>
      </header>

      <SupplierActions lang={lang} dict={dict} supplier={supplier} />

      <section className="mt-6">
        <h2 className="text-sm font-semibold text-fg-secondary mb-2">
          {dict.admin.suppliers.detail.summary}
        </h2>
        <dl className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-3 rounded border border-border bg-surface px-4 py-3 text-sm">
          <DefRow
            term={dict.admin.suppliers.columns.integration_type}
            desc={
              dict.admin.suppliers.integration_types[supplier.integration_type]
            }
          />
          <DefRow
            term={dict.admin.suppliers.columns.default_currency}
            desc={<span className="font-mono">{supplier.default_currency}</span>}
          />
          <DefRow
            term={dict.admin.suppliers.form.credentials_ref}
            desc={
              <span className="font-mono text-xs">
                {supplier.credentials_ref ?? "—"}
              </span>
            }
          />
          <DefRow
            term={dict.admin.suppliers.columns.updated_at}
            desc={formatDateTime(supplier.updated_at)}
          />
        </dl>
        {Object.keys(supplier.contact ?? {}).length > 0 ? (
          <details className="mt-3 rounded border border-border bg-surface px-4 py-3 text-sm">
            <summary className="cursor-pointer text-fg-secondary">
              {dict.admin.suppliers.form.contact_json}
            </summary>
            <pre className="mt-2 max-h-64 overflow-auto rounded bg-bg p-3 text-xs font-mono">
              {JSON.stringify(supplier.contact, null, 2)}
            </pre>
          </details>
        ) : null}
      </section>

      <section className="mt-8">
        <h2 className="text-sm font-semibold text-fg-secondary mb-2">
          {dict.admin.suppliers.detail.sync_log}
        </h2>
        <div className="overflow-x-auto rounded border border-border bg-surface">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-fg-secondary border-b border-border">
              <tr>
                <Th>{dict.admin.suppliers.sync_log_columns.started_at}</Th>
                <Th>{dict.admin.suppliers.sync_log_columns.trigger}</Th>
                <Th>{dict.admin.suppliers.sync_log_columns.triggered_by}</Th>
                <Th>{dict.admin.suppliers.sync_log_columns.status}</Th>
                <Th>{dict.admin.suppliers.sync_log_columns.plan_count}</Th>
                <Th>{dict.admin.suppliers.sync_log_columns.duration}</Th>
                <Th>{dict.admin.suppliers.sync_log_columns.error}</Th>
              </tr>
            </thead>
            <tbody>
              {sync_logs.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-8 text-center text-fg-secondary"
                  >
                    {dict.admin.suppliers.detail.sync_log_empty}
                  </td>
                </tr>
              ) : null}
              {sync_logs.map((log) => {
                const summary = log.summary as { durationMs?: number };
                return (
                  <tr
                    key={log.id}
                    className="border-b border-border last:border-0 hover:bg-surface-muted"
                  >
                    <Td className="text-xs">{formatDateTime(log.started_at)}</Td>
                    <Td className="text-xs">
                      {dict.admin.suppliers.sync_triggers[log.trigger]}
                    </Td>
                    <Td className="text-xs">{log.triggered_by ?? "—"}</Td>
                    <Td>
                      <SyncStatusBadge
                        state={log.status}
                        label={dict.admin.suppliers.sync_statuses[log.status]}
                      />
                    </Td>
                    <Td className="text-xs">{log.plan_count ?? "—"}</Td>
                    <Td className="text-xs">
                      {formatDurationMs(summary?.durationMs ?? null)}
                    </Td>
                    <Td className="text-xs text-danger">
                      {log.error_message ?? ""}
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-3 py-2 font-medium">{children}</th>;
}

function Td({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <td className={`px-3 py-2 ${className ?? ""}`}>{children}</td>;
}

function DefRow({ term, desc }: { term: string; desc: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-fg-secondary">{term}</dt>
      <dd>{desc}</dd>
    </div>
  );
}
