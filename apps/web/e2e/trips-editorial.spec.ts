import { expect, test } from "@playwright/test";

test.describe("Trips editorial fixture", () => {
  test("renders the list information architecture", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 960 });
    await page.goto("/en/dev/trips-editorial?view=list");

    await expect(page.getByRole("heading", { name: "My trips" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "All trips" })).toBeVisible();
    await expect(page.getByRole("button", { name: "New trip" })).toBeVisible();
    await expect(page.getByTestId("trip-editorial-card")).toHaveCount(2);
    await expect(page.getByTestId("trip-editorial-masthead")).toBeVisible();
    await expect(page.getByTestId("trip-editorial-cover")).toHaveCount(2);
    await expect(
      page.getByText("Routes worth remembering, details ready when you need them."),
    ).toBeVisible();
    await expect(page.getByTestId("trip-editorial-progress")).toHaveCount(2);
    await page.getByRole("tab", { name: "Drafting" }).click();
    await expect(page.getByTestId("trip-editorial-card")).toHaveCount(1);
    await page.getByRole("button", { name: "New trip" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Create trip" })).toBeVisible();
  });

  test("turns the empty list into a useful first-trip composition", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 960 });
    await page.goto("/en/dev/trips-editorial?view=list&state=empty");

    await expect(
      page.getByRole("heading", { name: "Start your first trip" }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Create trip" })).toBeVisible();
    await expect(page.getByTestId("trip-empty-editorial")).toBeVisible();
  });

  test("renders the detail workspace without dropping planning modes", async ({
    page,
  }) => {
    const browserErrors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") browserErrors.push(message.text());
    });
    page.on("pageerror", (error) => browserErrors.push(error.message));
    await page.setViewportSize({ width: 1600, height: 1000 });
    await page.goto("/en/dev/trips-editorial?view=detail");

    await expect(
      page.getByRole("heading", { name: "Barcelona to London" }),
    ).toBeVisible();
    await expect(page.getByText("Daily itinerary", { exact: true })).toBeVisible();
    await expect(page.getByTestId("trip-route-map")).toBeVisible();
    await expect(
      page.getByRole("tab", { name: "Planning progress" }),
    ).toBeVisible();
    await expect(page.getByRole("tab", { name: "To-dos" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Trip notes" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Budget" })).toBeVisible();
    await expect(page.getByTestId("trip-editorial-masthead")).toBeVisible();
    await expect(page.getByTestId("trip-editorial-stamp")).toBeVisible();
    await expect(page.getByTestId("trip-editorial-cover")).toBeVisible();
    await expect(page.getByTestId("trip-editorial-cover")).toHaveAttribute(
      "src",
      /barcelona/,
    );
    await expect(page.getByTestId("trip-detail-workspace")).toBeVisible();
    await expect(page.getByTestId("trip-map-itinerary-grid")).toBeVisible();
    await expect(page.getByTestId("trip-planning-inspector")).toBeVisible();
    await expect(page.getByRole("button", { name: "Share" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Export trip" })).toBeVisible();
    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Export trip" }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe("Barcelona-to-London.ics");
    expect(browserErrors).toEqual([]);
  });

  test("keeps the detail workspace usable on mobile", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/en/dev/trips-editorial?view=detail");

    await expect(
      page.getByRole("heading", { name: "Barcelona to London" }),
    ).toBeVisible();
    await expect(page.getByTestId("trip-day-rail")).toBeVisible();
    await expect(page.getByTestId("trip-route-map")).toBeVisible();
    await expect(page.getByTestId("trip-mobile-context")).toBeVisible();
    await page.getByTestId("trip-mobile-inspector-toggle").click();
    await expect(page.getByTestId("trip-mobile-inspector-toggle")).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    const inspectorBox = await page
      .getByTestId("trip-planning-inspector")
      .boundingBox();
    expect(inspectorBox?.height).toBeGreaterThanOrEqual(500);
    expect(inspectorBox?.height).toBeLessThanOrEqual(650);
    await expect
      .poll(() =>
        page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      )
      .toBe(true);
  });

  test("keeps the localized list calm and contained on mobile", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/zh-TW/dev/trips-editorial?view=list");

    await expect(page.getByRole("heading", { name: "我的行程" })).toBeVisible();
    await expect(page.getByRole("button", { name: "新增行程" })).toBeVisible();
    await expect(page.getByTestId("trip-editorial-card")).toHaveCount(2);
    await expect(page.getByText("京都文化", { exact: true })).toBeVisible();
    await expect
      .poll(() =>
        page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      )
      .toBe(true);
  });
});
