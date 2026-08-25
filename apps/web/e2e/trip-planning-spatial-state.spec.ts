/**
 * c-2 — "切日期、開 full view、返回後維持 day／item／sheet height."
 *
 * The criterion is one assertion about three facts, and restoring two of them is
 * still the bug: coming back to the right day with the sheet collapsed loses the
 * traveler's place exactly as completely as coming back to the wrong day.
 */
import { expect, test } from "@playwright/test";

const MOBILE = { width: 390, height: 844 };
const ROUTE = "/zh-TW/dev/trips-editorial?view=detail";

test.describe("trip planning spatial state", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(MOBILE);
    await page.goto(ROUTE);
  });

  test("D-1: opens at the mid detent, itinerary first", async ({ page }) => {
    const sheet = page.getByTestId("trip-planning-sheet");
    await expect(sheet).toBeVisible();
    await expect(sheet).toHaveAttribute("data-detent", "mid");
    // "首屏看見 2-3 個 stop" — the mid detent has to actually show them, which is the
    // half of D-1 a detent attribute alone would not prove.
    const items = page.getByTestId("trip-planning-compact-item");
    expect(await items.count()).toBeGreaterThanOrEqual(2);
    await expect(items.first()).toBeInViewport();
  });

  test("c-1: the sheet never intersects the bottom nav, at any detent", async ({ page }) => {
    // Measured against the real nav box, not against a fraction of the viewport. The
    // first version of this asserted `height < 0.93 * viewport`, which passed while the
    // sheet sat directly on top of the nav — capping the height reserves space at the
    // TOP, and the nav is at the bottom.
    const nav = page.getByTestId("storefront-bottom-nav");
    const sheet = page.getByTestId("trip-planning-sheet");
    const handle = page.getByTestId("trip-planning-sheet-handle");

    const navBox = await nav.boundingBox();
    expect(navBox, "the storefront bottom nav should be present on mobile").not.toBeNull();

    for (const detent of ["mid", "full", "low"] as const) {
      // Drive to each detent through the keyboard so the assertion covers all three.
      await handle.focus();
      const current = await sheet.getAttribute("data-detent");
      const order = ["low", "mid", "full"];
      const delta = order.indexOf(detent) - order.indexOf(current!);
      for (let step = 0; step < Math.abs(delta); step += 1) {
        await page.keyboard.press(delta > 0 ? "ArrowUp" : "ArrowDown");
      }
      await expect(sheet).toHaveAttribute("data-detent", detent);

      const sheetBox = await sheet.boundingBox();
      expect(sheetBox).not.toBeNull();
      const sheetBottom = sheetBox!.y + sheetBox!.height;
      expect(
        sheetBottom,
        `at detent "${detent}" the sheet bottom (${sheetBottom}) must sit above the nav top (${navBox!.y})`,
      ).toBeLessThanOrEqual(navBox!.y + 1);
    }
  });

  test("keeps day, item and sheet height across a full-view round trip", async ({ page }) => {
    const sheet = page.getByTestId("trip-planning-sheet");

    // 1. change the day
    const chips = page.getByTestId("trip-planning-day-chip");
    await chips.nth(1).click();
    const dayId = await sheet.getAttribute("data-day");
    expect(dayId).toBeTruthy();

    // 2. change the sheet height away from the default, so the restore is provable.
    //    Landing back on "mid" would pass whether state was restored or reset.
    await page.getByTestId("trip-planning-sheet-handle").focus();
    await page.keyboard.press("ArrowUp");
    await expect(sheet).toHaveAttribute("data-detent", "full");

    // 3. open a full view
    const item = page.getByTestId("trip-planning-compact-item").first();
    const itemId = await item.getAttribute("data-item-id");
    await item.getByTestId("trip-planning-more").click();
    await expect(page.getByTestId("trip-planning-full-view")).toBeVisible();

    // 4. return
    await page.getByTestId("trip-planning-full-view-back").click();
    await expect(page.getByTestId("trip-planning-full-view")).toHaveCount(0);

    await expect(sheet).toHaveAttribute("data-day", dayId!);
    await expect(sheet).toHaveAttribute("data-item", itemId!);
    await expect(sheet).toHaveAttribute("data-detent", "full");
  });

  test("D-2: the compact row is universal and keeps ticket & booking visible", async ({ page }) => {
    const rows = page.getByTestId("trip-planning-compact-item");
    const count = await rows.count();
    expect(count).toBeGreaterThan(0);
    for (let index = 0; index < count; index += 1) {
      // Visible on the outer layer, not behind More — the spec is explicit.
      await expect(rows.nth(index).getByTestId("trip-planning-ticket-status")).toBeVisible();
      await expect(rows.nth(index).getByTestId("trip-planning-more")).toBeVisible();
    }
  });

  test("D-2: the full view expands by item type", async ({ page }) => {
    await page.getByTestId("trip-planning-compact-item").first()
      .getByTestId("trip-planning-more").click();
    const full = page.getByTestId("trip-planning-full-view");
    await expect(full).toBeVisible();
    const type = await full.getAttribute("data-item-type");
    expect(["place", "transit", "flight", "stay"]).toContain(type);
    // A full view that rendered no more than the compact sheet would defeat the point
    // of having two layers at all.
    expect(await page.getByTestId("trip-planning-full-field").count()).toBeGreaterThan(3);
  });
});
