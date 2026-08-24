export interface ShopRegionLabels {
  no_plans: string;
  no_coverage_title: string;
  no_coverage_body: string;
  plans_load_error_body: string;
  browse_destinations: string;
  plans_load_error: string;
  try_again: string;
  loading_plans: string;
  sign_in_to_continue: string;
  sign_in_to_buy: string;
  sign_in_body: string;
  trip_length: string;
  options: string;
  day_unit: string;
  day_aria: string;
  all: string;
  plans_for_days: string;
  no_plan_duration: string;
  tier_titanium: string;
  tier_high_speed: string;
  unlimited: string;
  per_day: string;
  throttled: string;
  coverage_full_title: string;
  coverage_partial_title: string;
  readiness_title: string;
  readiness_phone: string;
  readiness_install: string;
  readiness_roaming: string;
  readiness_support: string;
  buyer_note_title: string;
  buyer_note_data_only: string;
  buyer_note_activation: string;
  buyer_note_coverage: string;
  buy: string;
  checkout_title: string;
  checkout_body: string;
  checkout_email: string;
  checkout_email_placeholder: string;
  checkout_name: string;
  checkout_name_placeholder: string;
  checkout_quantity: string;
  checkout_total: string;
  checkout_submit: string;
  checkout_submitting: string;
  checkout_success: string;
  checkout_pending: string;
  checkout_fulfilled: string;
  checkout_error: string;
  checkout_refresh: string;
  checkout_refreshing: string;
  checkout_where_to_find: string;
  checkout_select_trip: string;
  checkout_trip_placeholder: string;
  checkout_share_to_companions: string;
  checkout_sharing: string;
  checkout_shared: string;
  order_number: string;
}

export interface CheckoutProfile {
  email: string;
  name: string;
}

export interface CheckoutTripContext {
  tripId: string;
  checklistItemId?: string;
}

export interface CheckoutTripOption {
  id: string;
  title: string;
}
