// Server-side proxy: PlanPicker (client component, embedded inside the admin
// edit page's MappingEditor) fetches this from the browser to populate the
// supplier-plan dropdown. Going through the proxy keeps ROAM_API_URL on the
// server and lets us layer auth later without changing the client code.

import { ApiError, listSupplierPlans } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const country = url.searchParams.get("country");
  const q = url.searchParams.get("q");
  const supplierId = url.searchParams.get("supplier_id");
  const availableOnly = url.searchParams.get("available_only");
  const minData = url.searchParams.get("min_data_mb");
  const maxValidity = url.searchParams.get("max_validity_days");

  try {
    const plans = await listSupplierPlans({
      country: country ?? undefined,
      q: q ?? undefined,
      supplier_id: supplierId ?? undefined,
      available_only: availableOnly === null ? undefined : availableOnly !== "false",
      min_data_mb: minData != null ? Number(minData) : undefined,
      max_validity_days: maxValidity != null ? Number(maxValidity) : undefined,
    });
    return Response.json({ plans });
  } catch (err) {
    if (err instanceof ApiError) {
      return Response.json(
        { error: err.message, body: err.body },
        { status: err.status },
      );
    }
    return Response.json(
      { error: (err as Error).message ?? "unknown_error" },
      { status: 500 },
    );
  }
}
