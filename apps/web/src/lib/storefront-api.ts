// Client-callable shape of the /storefront/products response.

export interface ShopProduct {
  id: string;
  slug: string;
  display_name_i18n: Record<string, string>;
  marketing_destinations: string[];
  data_amount_mb: number;
  validity_days: number;
  pricing: {
    retail: number | string;
    currency: string;
    cost_snapshot?: {
      cost?: number | string;
      amount?: number | string;
    };
  };
  tags: string[];
}

export interface ShopProductListResponse {
  products: ShopProduct[];
}

export interface StorefrontCheckoutResponse {
  order: {
    id: string;
    order_number: string;
    status: "pending" | "paid" | "fulfilled" | "cancelled" | "refunded";
    customer_email: string;
    total_amount: number;
    currency: string;
    created_at: string;
    paid_at: string | null;
    fulfilled_at: string | null;
    metadata: Record<string, unknown>;
  };
  item: {
    id: string;
    status: "pending_fulfilment" | "fulfilled" | "failed" | "refunded";
    qty: number;
    unit_price: number;
    currency: string;
    fulfilled_at: string | null;
  };
  upstream: unknown;
}
