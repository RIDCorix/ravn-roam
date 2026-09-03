import { expect, test, type Page } from "@playwright/test";

// R-301 acceptance run. Every check here drives the fixture at
// `/[lang]/dev/trip-planner`, which composes the real storefront bottom
// navigation with the planner — a planner on a bare page can only prove it
// does not overlap a navigation that was never on screen.

const PLANNER_PATH = (lang: string) => `/${lang}/dev/trip-planner`;

/** Small catalog so the shop lands on a real plan list without the API. */
const SHOP_PRODUCTS = {
  products: [4, 6, 8, 10, 15].map((days) => ({
    id: `plan-${days}`,
    slug: `japan-${days}d`,
    display_name_i18n: { en: `Japan ${days} days`, "zh-TW": `日本 ${days} 天` },
    marketing_destinations: ["JP"],
    data_amount_mb: 1024 * days,
    validity_days: days,
    pricing: { retail: 4.2 * days, currency: "TWD" },
    tags: [],
  })),
};

async function gotoPlanner(page: Page, lang = "en") {
  await page.goto(PLANNER_PATH(lang));
  await page.waitForFunction(
    () =>
      Number(
        document
          .querySelector('[data-testid="planner"]')
          ?.getAttribute("data-planning-space") ?? 0,
      ) > 0,
  );
  // The dev overlay is not part of the product surface.
  await page.addStyleTag({ content: "nextjs-portal{display:none!important}" });
}

async function geometry(page: Page) {
  const chrome = (await page.getByTestId("planner-top-chrome").boundingBox())!;
  const nav = (await page.locator('nav[aria-label="Primary"]').boundingBox())!;
  const map = (await page.getByTestId("planner-map").boundingBox())!;
  const sheet = (await page.getByTestId("planner-sheet").boundingBox())!;
  const planningSpace = nav.y - (chrome.y + chrome.height);
  return {
    chrome,
    nav,
    map,
    sheet,
    planningSpace,
    mapShare: map.height / planningSpace,
  };
}

function intersects(
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number },
): boolean {
  return (
    a.x < b.x + b.width &&
    b.x < a.x + a.width &&
    a.y < b.y + b.height &&
    b.y < a.y + a.height
  );
}

// ── c-1 · visual baselines on a fixture with the real navigation ────────

const VIEWPORTS = [
  { width: 390, height: 844 },
  { width: 1280, height: 900 },
  { width: 1440, height: 900 },
  { width: 1720, height: 1000 },
];

for (const viewport of VIEWPORTS) {
  test(`c-1 planner baseline at ${viewport.width}px`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });

    await page.setViewportSize(viewport);
    await gotoPlanner(page);

    // No overflow.
    await expect
      .poll(() =>
        page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      )
      .toBe(true);

    // Exactly one navigation is on screen: the bottom bar on the phone, the
    // rail on the desktop. Never both, never a second copy.
    const visibleNavs = await page.locator("nav:visible").count();
    expect(visibleNavs).toBe(1);
    const bottomNav = page.locator('nav[aria-label="Primary"]');
    if (viewport.width < 768) {
      await expect(bottomNav).toBeVisible();
      const { nav, sheet } = await geometry(page);
      // The sheet stops above the navigation instead of sliding under it.
      expect(sheet.y + sheet.height).toBeLessThanOrEqual(nav.y);
    } else {
      await expect(bottomNav).toBeHidden();
    }

    // No clipped controls.
    const controls = [
      "planner-more",
      "planner-lumi-cta",
      "planner-checklist-esim-cta",
    ];
    for (const testId of controls) {
      const control = page.getByTestId(testId);
      const box = (await control.boundingBox())!;
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + 1);
      const clipped = await control.evaluate(
        (element) => element.scrollWidth > element.clientWidth + 1,
      );
      expect(clipped).toBe(false);
    }

    // Tiles come from a third-party server and are not a stable baseline;
    // the pins, the route and the chrome around them are ours.
    await page.addStyleTag({
      content: ".leaflet-tile-pane{visibility:hidden}",
    });
    await expect(page).toHaveScreenshot(`planner-${viewport.width}.png`, {
      animations: "disabled",
    });

    expect(errors).toEqual([]);
  });
}

// ── c-2 · the phone's spatial contract, and state that survives ─────────

test.describe("c-2 spatial skeleton and state", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("opens itinerary-first with the map on 35-41% of the planning space", async ({
    page,
  }) => {
    await gotoPlanner(page);
    await expect(page.getByTestId("planner")).toHaveAttribute(
      "data-detent",
      "plan",
    );
    const { mapShare, sheet, nav, chrome, map } = await geometry(page);
    expect(mapShare).toBeGreaterThanOrEqual(0.35);
    expect(mapShare).toBeLessThanOrEqual(0.41);
    // The sheet and the navigation do not intersect.
    expect(intersects(sheet, nav)).toBe(false);
    // The map owns the space between the top chrome and the sheet.
    expect(Math.round(map.y)).toBe(Math.round(chrome.y + chrome.height));
    expect(Math.round(map.y + map.height)).toBe(Math.round(sheet.y));
  });

  test("keeps day, item and detent across the full edit page", async ({
    page,
  }) => {
    await gotoPlanner(page);

    await page.getByTestId("planner-detent-full").click();
    await page.locator('[data-testid="planner-day-chip"][data-day="3"]').click();
    await page
      .locator('[data-testid="planner-item-row"][data-item-type="transport"]')
      .click();

    const selectedTitle = await page
      .getByTestId("planner-compact-title")
      .textContent();
    await expect(page.getByTestId("planner")).toHaveAttribute(
      "data-detent",
      "full",
    );

    await page.getByTestId("planner-more").click();
    await expect(page.getByTestId("planner-full-view")).toBeVisible();
    await page.getByTestId("planner-full-view-back").click();
    await expect(page.getByTestId("planner-full-view")).toHaveCount(0);

    await expect(
      page.locator('[data-testid="planner-day-chip"][data-day="3"]'),
    ).toHaveAttribute("data-active", "true");
    await expect(page.getByTestId("planner-compact-title")).toHaveText(
      selectedTitle!,
    );
    await expect(page.getByTestId("planner")).toHaveAttribute(
      "data-detent",
      "full",
    );
  });

  test("lands on a detent when the grabber is dragged", async ({ page }) => {
    await gotoPlanner(page);
    const handle = page.getByTestId("planner-sheet-handle");
    const start = (await handle.boundingBox())!;
    const before = (await page.getByTestId("planner-sheet").boundingBox())!;

    await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2);
    await page.mouse.down();
    // Pull the sheet down in steps so the move handler sees a real gesture.
    for (let offset = 20; offset <= 200; offset += 20) {
      await page.mouse.move(
        start.x + start.width / 2,
        start.y + start.height / 2 + offset,
      );
    }
    await page.mouse.up();

    await expect(page.getByTestId("planner")).toHaveAttribute(
      "data-detent",
      "map",
    );
    const after = (await page.getByTestId("planner-sheet").boundingBox())!;
    expect(after.height).toBeLessThan(before.height);
    const { nav, sheet } = await geometry(page);
    expect(intersects(sheet, nav)).toBe(false);
  });
});

// ── c-3 · stay segments, travel days, and the compact/full split ────────

test.describe("c-3 information architecture", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("shows stay segments, and a relocation only as a travel day", async ({
    page,
  }) => {
    await gotoPlanner(page);
    const rows = page.getByTestId("planner-overview-row");
    await expect(rows).toHaveCount(5);
    const kinds = await rows.evaluateAll((nodes) =>
      nodes.map((node) => node.getAttribute("data-row-kind")),
    );
    expect(kinds).toEqual(["stay", "travel", "stay", "travel", "stay"]);

    const places = await rows.evaluateAll((nodes) =>
      nodes.map((node) => node.getAttribute("data-place")),
    );
    expect(places).toEqual(["tokyo", null, "kyoto", null, "osaka"]);

    const travelDays = await page
      .locator('[data-row-kind="travel"]')
      .evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-day")));
    expect(travelDays).toEqual(["4", "7"]);

    await expect(
      page.locator('[data-row-kind="travel"]').first(),
    ).toContainText("Tokyo → Kyoto");
    await expect(page.getByTestId("planner-legend")).toBeVisible();
  });

  test("keeps the compact sheet universal and the full view type-specific", async ({
    page,
  }) => {
    await gotoPlanner(page);

    const compactFields = await page
      .locator('[data-testid="planner-compact-card"] [data-field]')
      .evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-field")));
    expect(compactFields).toEqual(["date", "startTime", "durationMin", "ticket"]);
    await expect(page.getByTestId("planner-ticket-row")).toBeVisible();

    const expected: Record<string, string[]> = {
      flight: [
        "airline",
        "flightNumber",
        "origin",
        "destination",
        "ticketReference",
      ],
      stay: ["property", "checkIn", "checkOut", "bookingReference"],
      place: ["placeName", "admission", "bookingReference"],
      transport: ["mode", "origin", "destination", "ticketReference"],
    };

    for (const [type, fields] of Object.entries(expected)) {
      const day = type === "transport" ? "3" : "1";
      await page
        .locator(`[data-testid="planner-day-chip"][data-day="${day}"]`)
        .click();
      await page
        .locator(`[data-testid="planner-item-row"][data-item-type="${type}"]`)
        .click();
      await page.getByTestId("planner-more").click();
      await expect(page.getByTestId("planner-full-view")).toHaveAttribute(
        "data-item-type",
        type,
      );

      const rendered = await page
        .locator('[data-testid="planner-full-view"] [data-field]')
        .evaluateAll((nodes) =>
          nodes.map((node) => node.getAttribute("data-field")),
        );
      expect(rendered).toEqual([
        "date",
        "startTime",
        "durationMin",
        "ticket",
        ...fields,
      ]);

      // The full view is a page, not a translucent layer: nothing from the
      // planner underneath may be hit-testable through it.
      const coveredBy = await page
        .getByTestId("planner-field-date")
        .evaluate((element) => {
          const box = element.getBoundingClientRect();
          const hit = document.elementFromPoint(
            box.x + box.width / 2,
            box.y + box.height / 2,
          );
          return hit?.closest('[data-testid="planner-full-view"]') ? "full" : "other";
        });
      expect(coveredBy).toBe("full");

      await page.getByTestId("planner-full-view-back").click();
      await expect(page.getByTestId("planner-full-view")).toHaveCount(0);
    }
  });
});

// ── c-4 · reduced motion, reduced transparency, higher contrast ─────────

test.describe("c-4 accessibility modes", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  async function sampleDetentChange(page: Page) {
    return page.evaluate(async () => {
      const sheet = document.querySelector('[data-testid="planner-sheet"]')!;
      const heights: number[] = [];
      const target = document.querySelector(
        '[data-testid="planner-detent-full"]',
      ) as HTMLButtonElement;
      target.click();
      const stopAt = performance.now() + 400;
      while (performance.now() < stopAt) {
        heights.push(Math.round(sheet.getBoundingClientRect().height));
        await new Promise((resolve) => requestAnimationFrame(resolve));
      }
      return [...new Set(heights)];
    });
  }

  test("slides the sheet height when motion is allowed", async ({ page }) => {
    await gotoPlanner(page);
    await expect(page.getByTestId("planner")).toHaveAttribute(
      "data-motion",
      "full",
    );
    const heights = await sampleDetentChange(page);
    // A real transition passes through intermediate heights.
    expect(heights.length).toBeGreaterThan(3);
    const animation = await page
      .getByTestId("planner-sheet-content")
      .evaluate((element) => getComputedStyle(element).animationName);
    expect(animation).toBe("none");
  });

  test("cross-fades instead of sliding the height under reduced motion", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await gotoPlanner(page);
    await expect(page.getByTestId("planner")).toHaveAttribute(
      "data-motion",
      "reduced",
    );

    const transition = await page
      .getByTestId("planner-sheet")
      .evaluate((element) => getComputedStyle(element).transitionProperty);
    expect(transition).not.toContain("height");

    const heights = await sampleDetentChange(page);
    // Only the height it left and the height it landed on.
    expect(heights.length).toBeLessThanOrEqual(2);

    const animation = await page
      .getByTestId("planner-sheet-content")
      .evaluate((element) => getComputedStyle(element).animationName);
    expect(animation).toBe("planner-cross-fade");
  });

  test("drops the chrome material when transparency is reduced", async ({
    page,
  }) => {
    await gotoPlanner(page);
    const read = () =>
      page.getByTestId("planner-top-chrome").evaluate((element) => {
        const style = getComputedStyle(element);
        return {
          backdrop: style.backdropFilter,
          background: style.backgroundColor,
          matches: window.matchMedia("(prefers-reduced-transparency: reduce)")
            .matches,
        };
      });

    const normal = await read();
    expect(normal.matches).toBe(false);
    expect(normal.backdrop).toContain("blur");
    expect(normal.background).toContain("0.82");

    const client = await page.context().newCDPSession(page);
    await client.send("Emulation.setEmulatedMedia", {
      features: [{ name: "prefers-reduced-transparency", value: "reduce" }],
    });

    const reduced = await read();
    expect(reduced.matches).toBe(true);
    expect(reduced.backdrop).toBe("none");
    expect(reduced.background).toBe("rgb(255, 255, 255)");
  });

  test("strengthens the borders when higher contrast is asked for", async ({
    page,
  }) => {
    await gotoPlanner(page);
    const borderOf = (testId: string) =>
      page
        .getByTestId(testId)
        .evaluate((element) => getComputedStyle(element).borderTopColor);

    const before = await borderOf("planner-sheet");
    await page.emulateMedia({ contrast: "more" });
    const after = await borderOf("planner-sheet");
    expect(after).not.toBe(before);
    expect(after).toBe("rgb(17, 17, 17)");

    const meta = await page
      .getByTestId("planner-trip-meta")
      .evaluate((element) => getComputedStyle(element).color);
    expect(meta).toBe("rgb(17, 17, 17)");
  });
});

// ── c-5 · long titles and dates in a real render, in both locales ───────

test.describe("c-5 localized typography", () => {
  for (const width of [390, 1280]) {
    test(`no overlap, truncation or locale shift at ${width}px`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
      const chromeHeights: number[] = [];

      for (const lang of ["en", "zh-TW"]) {
        await gotoPlanner(page, lang);

        const title = page.getByTestId("planner-trip-title");
        const meta = page.getByTestId("planner-trip-meta");
        expect(intersects((await title.boundingBox())!, (await meta.boundingBox())!)).toBe(
          false,
        );
        // The reserved two lines hold the longest title we ship.
        expect(
          await title.evaluate(
            (element) => element.scrollHeight <= element.clientHeight + 1,
          ),
        ).toBe(true);
        chromeHeights.push(
          (await page.getByTestId("planner-top-chrome").boundingBox())!.height,
        );

        const rows = page.getByTestId("planner-item-row");
        const count = await rows.count();
        expect(count).toBeGreaterThan(0);
        for (let index = 0; index < count; index += 1) {
          const row = rows.nth(index);
          const time = (await row
            .getByTestId("planner-item-time")
            .boundingBox())!;
          const rowTitle = (await row
            .getByTestId("planner-item-title")
            .boundingBox())!;
          expect(intersects(time, rowTitle)).toBe(false);
          expect(
            await row
              .getByTestId("planner-item-title")
              .evaluate(
                (element) => element.scrollHeight <= element.clientHeight + 1,
              ),
          ).toBe(true);
        }

        const compactTitle = page.getByTestId("planner-compact-title");
        expect(
          await compactTitle.evaluate(
            (element) => element.scrollHeight <= element.clientHeight + 1,
          ),
        ).toBe(true);
      }

      // Switching locale must not move the chrome.
      expect(chromeHeights[0]).toBe(chromeHeights[1]);
    });
  }
});

// ── c-6 · both CTAs reach the shop with the country and day prefilter ───

test.describe("c-6 purchase handoff", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test.beforeEach(async ({ page }) => {
    await page.route("**/api/storefront/products*", (route) =>
      route.fulfill({ json: SHOP_PRODUCTS }),
    );
  });

  for (const cta of ["planner-lumi-cta", "planner-checklist-esim-cta"]) {
    test(`${cta} lands on the Japan plan list prefiltered to 8 days`, async ({
      page,
    }) => {
      await gotoPlanner(page);
      await page.getByTestId(cta).click();

      await expect(page).toHaveURL(/\/en\/shop\/japan\/plans\?/);
      const url = new URL(page.url());
      expect(url.pathname).toBe("/en/shop/japan/plans");
      expect(url.searchParams.get("days")).toBe("8");

      await expect(page.getByRole("heading", { name: "Japan" })).toBeVisible();
      await expect(page.getByRole("slider", { name: "Trip length" })).toHaveValue(
        "8",
      );
    });
  }
});

// ── c-8 · the four item types are editable, and the edit survives ───────

test.describe("c-8 type-specific editing", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  const CASES = [
    {
      type: "flight",
      day: "1",
      edits: { airline: "All Nippon Airways", flightNumber: "NH 852" },
    },
    {
      type: "stay",
      day: "1",
      edits: { property: "Hotel Kanade annex", bookingReference: "HK-9001" },
    },
    {
      type: "place",
      day: "1",
      edits: { placeName: "Sensoji main hall", admission: "Free, donation box" },
    },
    {
      type: "transport",
      day: "3",
      edits: { mode: "Airport bus", ticketReference: "BUS-4410" },
    },
  ];

  for (const testCase of CASES) {
    test(`edits and keeps ${testCase.type} details`, async ({ page }) => {
      await gotoPlanner(page);
      await page
        .locator(`[data-testid="planner-day-chip"][data-day="${testCase.day}"]`)
        .click();
      await page
        .locator(
          `[data-testid="planner-item-row"][data-item-type="${testCase.type}"]`,
        )
        .click();
      await page.getByTestId("planner-more").click();

      for (const [field, value] of Object.entries(testCase.edits)) {
        await page.getByTestId(`planner-field-${field}`).fill(value);
      }
      await page.getByTestId("planner-field-ticketLabel").fill("receipt.pdf");
      await page.getByTestId("planner-save").click();
      await expect(page.getByTestId("planner-saved")).toHaveText("Saved.");

      await page.getByTestId("planner-full-view-back").click();
      await expect(page.getByTestId("planner-full-view")).toHaveCount(0);

      // Reopen: the values are still there.
      await page.getByTestId("planner-more").click();
      for (const [field, value] of Object.entries(testCase.edits)) {
        await expect(page.getByTestId(`planner-field-${field}`)).toHaveValue(
          value,
        );
      }
      await expect(
        page.getByTestId("planner-field-ticketLabel"),
      ).toHaveValue("receipt.pdf");
    });
  }
});
