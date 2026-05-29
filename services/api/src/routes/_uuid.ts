/**
 * Defensive 404 for `/:id` route handlers that go straight into a
 * postgres uuid query.
 *
 * Without this, hitting `/admin/vendors/new` or any other non-uuid
 * value blows up the postgres connection with
 *   `invalid input syntax for type uuid: "new"`
 * because the WHERE clause tries `id = $1::uuid`. We'd rather emit a
 * clean 404 — both safer (avoid surfacing postgres error pages to the
 * client) and friendlier to stale bookmarks like the old
 * /admin/vendors/new route that now falls into /vendors/[id].
 */

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(s: string | null | undefined): s is string {
  return typeof s === "string" && UUID_RE.test(s);
}
