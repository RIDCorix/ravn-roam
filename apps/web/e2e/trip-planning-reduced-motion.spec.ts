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

  test("reduced motion renders an actual cross-fade, not an inert sheet", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.setViewportSize(MOBILE);
    await page.goto(ROUTE);

    const body = page.getByTestId("trip-planning-sheet-body");
    // The substitute treatment has to BE something. Asserting data-motion alone let a
    // version through that set `transition-none` and animated nothing at all.
    await expect(body).toHaveClass(/roam-sheet-crossfade/);
    const animation = await body.evaluate((node) => getComputedStyle(node).animationName);
    expect(animation).toBe("roam-sheet-crossfade");

    // ...and the height must NOT animate, which is the displacement being removed.
    const sheet = page.getByTestId("trip-planning-sheet");
    const heightTransition = await sheet.evaluate((node) => {
      const style = getComputedStyle(node);
      return `${style.transitionProperty}:${style.transitionDuration}`;
    });
    expect(heightTransition).toMatch(/0s/);
  });

  test("higher contrast strengthens the sheet edge", async ({ page }) => {
    await page.setViewportSize(MOBILE);
    await page.emulateMedia({ contrast: "more" });
    await page.goto(ROUTE);
    const width = await page.getByTestId("trip-planning-sheet")
      .evaluate((node) => getComputedStyle(node).borderTopWidth);
    // 2px under prefers-contrast: more, against the 1px default.
    expect(parseFloat(width)).toBeGreaterThan(1);
  });

  test("a reduced-transparency treatment exists in the stylesheet", async ({ page }) => {
    await page.setViewportSize(MOBILE);
    await page.goto(ROUTE);
    // Playwright's emulateMedia covers reducedMotion, colorScheme, forcedColors and
    // contrast — it has NO prefers-reduced-transparency override, so this cannot be
    // driven the way the other two are. Asserting the rule is present in the shipped
    // CSS is the strongest honest check available; the rendered behaviour under that
    // preference stays part of c-7's human pass.
    const hasRule = await page.evaluate(() =>
      [...document.styleSheets].some((sheet) => {
        try {
          return [...sheet.cssRules].some((rule) =>
            rule.cssText.includes("prefers-reduced-transparency"),
          );
        } catch {
          return false; // cross-origin sheet
        }
      }),
    );
    expect(hasRule, "no prefers-reduced-transparency rule reached the page").toBe(true);
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
