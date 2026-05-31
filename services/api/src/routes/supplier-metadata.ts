export type SupplierOrderMode = "redemption" | "standard";

export function readSupplierItems(
  metadata: unknown,
): Array<Record<string, unknown>> {
  if (!metadata || typeof metadata !== "object") return [];
  const record = metadata as Record<string, unknown>;
  const recovery = record.supplier_recovery_response;
  if (!recovery || typeof recovery !== "object") return [];
  const items =
    (recovery as { itemList?: unknown; results?: unknown }).itemList ??
    (recovery as { results?: unknown }).results;
  return Array.isArray(items)
    ? items.filter((item): item is Record<string, unknown> =>
        Boolean(item && typeof item === "object"),
      )
    : [];
}

export function readSupplierOrderId(metadata: Record<string, unknown>): string {
  const response = metadata.supplier_order_response;
  if (!response || typeof response !== "object") return "";
  return String((response as { orderId?: unknown }).orderId ?? "");
}

export function readSupplierOrderMode(
  metadata: Record<string, unknown>,
): SupplierOrderMode {
  if (metadata.supplier_order_mode === "redemption") return "redemption";
  if (metadata.supplier_order_mode === "standard") return "standard";
  const request = metadata.supplier_order_request;
  return request && typeof request === "object" && "qrcodeType" in request
    ? "redemption"
    : "standard";
}
