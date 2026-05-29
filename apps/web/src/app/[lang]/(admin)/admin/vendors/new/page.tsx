import { redirect } from "next/navigation";

// The "new vendor" flow moved into a Dialog on the list page. Stale
// bookmarks / external links pointing at /admin/vendors/new should
// quietly redirect to the list (where the Dialog trigger lives) rather
// than fall through to /[id] and crash on `id = "new"`.
export default async function NewVendorRedirect({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  redirect(`/${lang}/admin/vendors`);
}
