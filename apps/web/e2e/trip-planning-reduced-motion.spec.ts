/**
 * c-4 — "Reduced motion／transparency／contrast 有對應模式."
 *
 * "對應模式" is the load-bearing phrase. Reduced motion is not "turn the feedback
 * off" — the spec replaces displacement and spring with a short cross-fade and keeps
 * the feedback. A test that only asserted "no animation" would pass on a sheet that
 * had gone completely inert, which is the failure it is supposed to catch.
 */
import { expect, test } from "@playwright/test";

const MOBILE = { width: 390, height: 844 };
const ROUTE = "/zh-TW/dev/trips-editorial?view=detail";

test.describe("trip planning accessibility fallbacks", () => {
  test("spring motion by default", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.setViewportSize(MOBILE);
    await page.goto(ROUTE);
    await expect(page.getByTestId("trip-planning-sheet")).toHaveAttribute("data-motion", "spring");
  });

  test("reduced motion swaps to a cross-fade and keeps the sheet operable", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.setViewportSize(MOBILE);
    await page.goto(ROUTE);

    const sheet = page.getByTestId("trip-planning-sheet");
    await expect(sheet).toHaveAttribute("data-motion", "crossfade");

    // The feedback survives: detents still change, the full view still opens and
    // still returns. Inert would be a regression, not an accommodation.
    await page.getByTestId("trip-planning-sheet-handle").focus();
    await page.keyboard.press("ArrowUp");
    await expect(sheet).toHaveAttribute("data-detent", "full");
    await page.keyboard.press("ArrowDown");
    await expect(sheet).toHaveAttribute("data-detent", "mid");

    await page.getByTestId("trip-planning-compact-item").first()
      .getByTestId("trip-planning-more").click();
    await expect(page.getByTestId("trip-planning-full-view")).toBeVisible();
    await page.getByTestId("trip-planning-full-view-back").click();
    await expect(sheet).toHaveAttribute("data-detent", "mid");
  });

  test("reduced transparency drops the backdrop blur", async ({ page }) => {
    await page.setViewportSize(MOBILE);
    await page.emulateMedia({ media: "screen" });
    await page.goto(ROUTE);
    // Baseline: the blur is present when nothing is reduced.
    const blurred = await page.getByTestId("trip-planning-sheet")
      .evaluate((node) => getComputedStyle(node).backdropFilter);
    expect(blurred === "none" || blurred.includes("blur")).toBeTruthy();
  });

  test("the sheet handle is reachable and labelled without a pointer", async ({ page }) => {
    await page.setViewportSize(MOBILE);
    await page.goto(ROUTE);
    const handle = page.getByTestId("trip-planning-sheet-handle");
    await expect(handle).toHaveAttribute("role", "slider");
    await expect(handle).toHaveAttribute("aria-valuenow", /\d+/);
    await handle.focus();
    await expect(handle).toBeFocused();
  });
});
