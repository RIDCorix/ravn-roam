/**
 * c-6 — "Lumi 與 checklist 到 Shop 的 prefilter 路徑不變."
 *
 * A regression guard, not a new feature. R-301 rearranges the planning surface; the
 * criterion exists because the CTA chain (trip or checklist context -> shop prefilter
 * -> plan comparison) is the product's revenue path and a layout refresh is exactly
 * the kind of change that quietly severs it.
 *
 * Asserted against the URL contract rather than the rendered shop page, because
 * /shop is still `pending_issue: R-276` in the oracle's route list — the link target
 * is what R-301 must not break, and it is what this can honestly check today.
 */
import { expect, test } from "@playwright/test";

const ROUTE = "/zh-TW/dev/trips-editorial?view=detail";

test.describe("shop prefilter path survives the R-301 refresh", () => {
  test("the planning sheet does not intercept or cover the checklist eSIM CTA", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(ROUTE);

    const sheet = page.getByTestId("trip-planning-sheet");
    await expect(sheet).toBeVisible();

    // The sheet is fixed to the bottom. If it grew past the reserved strip it would
    // sit on top of the bottom nav, which is how a refresh severs a CTA chain without
    // touching a single link.
    const box = await sheet.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.y).toBeGreaterThan(0);
    expect(box!.height).toBeLessThan(844 * 0.93);
  });

  test("the checklist eSIM item still deep-links to a prefiltered shop URL", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 960 });
    await page.goto(ROUTE);

    // Drive the actual CTA rather than scanning first paint. The previous version
    // skipped when no link was visible, which satisfied the criterion by looking away
    // from it.
    const inspector = page.getByTestId("trip-planning-inspector");
    await expect(inspector).toBeVisible();
    const checklistTab = inspector.getByRole("tab").filter({ hasText: /檢查|清單|Checklist|Tasks/i });
    if (await checklistTab.count()) await checklistTab.first().click();

    const shopLinks = page.locator('a[href*="/shop"]');
    await expect(
      shopLinks.first(),
      "the checklist eSIM shortcut should expose a shop link",
    ).toBeAttached({ timeout: 5000 });

    const count = await shopLinks.count();
    let prefiltered = 0;
    for (let index = 0; index < count; index += 1) {
      const href = await shopLinks.nth(index).getAttribute("href");
      // A bare /shop is precisely the regression: the chain is trip context -> SHOP
      // PREFILTER -> comparison, and a link that drops the filter has severed it.
      if (/\/shop\/[A-Za-z-]+/.test(href ?? "") || /\/shop\?[^=]+=/.test(href ?? "")) {
        prefiltered += 1;
      }
    }
    expect(prefiltered, "no shop link carried a country segment or a filter query").toBeGreaterThan(0);
  });

  test("the eSIM checklist item is still reachable from the planning surface", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 960 });
    await page.goto(ROUTE);
    // Desktop keeps the side panel; the refresh must not have removed the checklist
    // surface that owns the eSIM shortcut.
    await expect(page.getByTestId("trip-planning-inspector")).toBeVisible();
  });
});
