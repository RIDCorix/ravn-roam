/**
 * Acceptance test for ROA-60:
 *   - supplier CRUD via the admin UI
 *   - manual sync trigger from the supplier detail page
 *
 * The spec creates a unique supplier per run (timestamp-keyed code) so
 * repeated runs against the same DB don't collide on the unique-code
 * constraint. Cleanup is deferred; for now the test data lives next to
 * fastmove.
 */

import { expect, test } from "@playwright/test";

const LANG = process.env.E2E_LANG ?? "en";

function uniqueCode(): string {
  return `e2e-${Date.now().toString(36)}`;
}

test.describe("supplier admin", () => {
  test("create, edit, pause, and trigger a manual sync", async ({ page }) => {
    const code = uniqueCode();
    const displayName = `E2E supplier ${code}`;

    // ── CREATE ────────────────────────────────────────────────────────
    await page.goto(`/${LANG}/admin/suppliers/new`);
    await page.fill('input[name="code"]', code);
    await page.fill('input[name="display_name"]', displayName);
    await page.fill('input[name="default_currency"]', "TWD");
    await page.click('button[type="submit"]');

    // Lands on the detail page; URL contains a UUID we don't predict.
    await expect(page).toHaveURL(/\/admin\/suppliers\/[0-9a-f-]{36}/);
    await expect(page.getByText(displayName)).toBeVisible();

    // ── EDIT ──────────────────────────────────────────────────────────
    const url = page.url();
    await page.goto(`${url}/edit`);
    await page.fill('input[name="display_name"]', `${displayName} (edited)`);
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL(url);
    await expect(page.getByText(`${displayName} (edited)`)).toBeVisible();

    // ── PAUSE ─────────────────────────────────────────────────────────
    await page.getByTestId("pause-supplier-button").click();
    // Status badge re-renders after the server action; just confirm the
    // button label flips to the resume verb.
    await expect(page.getByTestId("pause-supplier-button")).not.toContainText(
      "Pause",
    );

    // ── MANUAL SYNC ───────────────────────────────────────────────────
    // Resume first so the manual sync is allowed to run.
    await page.getByTestId("pause-supplier-button").click();
    await expect(page.getByTestId("manual-sync-button")).toBeEnabled();
    await page.getByTestId("manual-sync-button").click();
    // The action returns either a success message or a clear error — both
    // count as "the button is wired up". A fastmove-coded supplier with a
    // configured adapter would return ok; an e2e-coded one will surface
    // "no adapter registered" which still proves the round-trip works.
    await expect(
      page.getByTestId("action-message").or(page.getByTestId("action-error")),
    ).toBeVisible();
  });
});
