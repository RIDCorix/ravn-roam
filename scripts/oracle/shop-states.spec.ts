/**
 * The shop region state matrix — the states R-276 contracts for, driven deterministically.
 *
 * Why this exists as its own spec: the generic route screenshot in visual.spec.ts takes
 * whatever the page happens to render. For /shop/[region] that is whatever the catalog
 * API happened to answer, so a machine with no API recorded THREE committed baselines of
 * the "目前無法載入方案" error and called them the route looking right. A gate whose
 * baseline is an environment failure passes forever while the product is broken.
 *
 * Every state below fulfils /api/storefront/products itself, so nothing here depends on a
 * database, a network, or which machine runs it. Each one asserts the state was actually
 * REACHED before it captures — a screenshot with no semantic assertion in front of it only
 * proves the page painted something.
 *
 * Adding a state: add an entry to STATES. The three contract viewports come from the
 * playwright projects, so one entry is three baselines.
 */
import { test, expect, type Page } from "@playwright/test";

import zhTW from "../../apps/web/src/i18n/dictionaries/zh-TW.json";

const L = zhTW.storefront.shop;
// ?days=7 on purpose: without it the slider snaps to whichever duration the fixture
// happens to make longest, and the baseline would move every time a plan is added.
const REGION = "/zh-TW/shop/japan?days=7";
const PRODUCTS_GLOB = "**/api/storefront/products*";

const plan = (over: Partial<Product> = {}): Product => ({
  id: "p-10gb",
  slug: "jp-10gb-7d",
  display_name_i18n: { "zh-TW": "日本 10GB 7 天", en: "Japan 10GB 7 days" },
  marketing_destinations: ["JP"],
  data_amount_mb: 10 * 1024,
  validity_days: 7,
  pricing: { retail: 690, currency: "TWD" },
  tags: [],
  ...over,
});

type Product = {
  id: string;
  slug: string;
  display_name_i18n: Record<string, string>;
  marketing_destinations: string[];
  data_amount_mb: number;
  validity_days: number;
  pricing: { retail: number; currency: string };
  tags: string[];
};

/** A name and a price no designer typed, to prove the card clamps rather than reflows. */
const OVERFLOWING = plan({
  id: "p-overflow",
  slug: "jp-overflow",
  display_name_i18n: {
    "zh-TW": "日本全區高速吃到飽含北海道沖繩離島與機場接送優惠加值方案（限量）",
    en: "Japan nationwide unlimited high-speed including Hokkaido, Okinawa and the outer islands",
  },
  data_amount_mb: 100 * 1024,
  validity_days: 7,
  pricing: { retail: 128900, currency: "TWD" },
});

type State = {
  name: string;
  /** Installs the products route. Returns nothing; the page is navigated afterwards. */
  fixture: (page: Page) => Promise<void>;
  /** Optional interaction that puts the page INTO the state, run after navigation. */
  act?: (page: Page) => Promise<void>;
  /** Proves the state was reached. Runs before the screenshot, and its failure is the point. */
  reached: (page: Page) => Promise<void>;
};

/**
 * Text that a traveler can actually read.
 *
 * getByText also matches the <title> inside the SVG scene, which is an accessible name
 * and not a visible one — asserting on it passes while the screen shows nothing.
 */
const visible = (page: Page, text: string) =>
  page.getByText(text).filter({ visible: true }).first();

/** A plan card, addressed by the accessible name the card exposes. */
const planRow = (page: Page, name: RegExp) => page.getByRole("button", { name }).first();

const json = (products: Product[]) => ({
  status: 200,
  contentType: "application/json",
  body: JSON.stringify({ products }),
});

const STATES: State[] = [
  {
    name: "comparison",
    fixture: (page) =>
      page.route(PRODUCTS_GLOB, (route) =>
        route.fulfill(
          json([
            plan(),
            plan({ id: "p-3gb", slug: "jp-3gb-7d", display_name_i18n: { "zh-TW": "日本 3GB 7 天", en: "Japan 3GB 7 days" }, data_amount_mb: 3 * 1024, pricing: { retail: 320, currency: "TWD" } }),
            plan({ id: "p-30gb", slug: "jp-30gb-7d", display_name_i18n: { "zh-TW": "日本 30GB 7 天", en: "Japan 30GB 7 days" }, data_amount_mb: 30 * 1024, pricing: { retail: 1180, currency: "TWD" }, tags: ["featured"] }),
            plan({ id: "p-10gb-14d", slug: "jp-10gb-14d", display_name_i18n: { "zh-TW": "日本 10GB 14 天", en: "Japan 10GB 14 days" }, validity_days: 14, pricing: { retail: 980, currency: "TWD" } }),
          ]),
        ),
      ),
    reached: async (page) => {
      // The card shows allowance, coverage and price — not the catalog display name —
      // so assert the accessible name a traveler actually compares. Three plans, three
      // different prices: this is the state where comparison is possible at all.
      await expect(planRow(page, /3 GB.+NT\$ 320/)).toBeVisible();
      await expect(planRow(page, /10 GB.+NT\$ 690/)).toBeVisible();
      await expect(planRow(page, /30 GB.+NT\$ 1,180/)).toBeVisible();
      // Three of the four fixture plans are 7-day, and ?days=7 selects them.
      await expect(visible(page, "7 天方案 (3)")).toBeVisible();
      await expect(visible(page, L.plans_load_error)).toHaveCount(0);
      await expect(visible(page, L.no_coverage_title)).toHaveCount(0);
    },
  },
  {
    name: "no-coverage",
    fixture: (page) => page.route(PRODUCTS_GLOB, (route) => route.fulfill(json([]))),
    reached: async (page) => {
      await expect(visible(page, L.no_coverage_title)).toBeVisible();
      await expect(visible(page, L.browse_destinations)).toBeVisible();
      // No coverage is a truthful answer, not a shop: nothing purchasable may remain.
      await expect(page.getByRole("button", { name: new RegExp(L.buy) })).toHaveCount(0);
    },
  },
  {
    name: "load-error",
    fixture: (page) =>
      page.route(PRODUCTS_GLOB, (route) =>
        route.fulfill({ status: 503, contentType: "application/json", body: "{}" }),
      ),
    reached: async (page) => {
      await expect(visible(page, L.plans_load_error)).toBeVisible();
      // The body must describe the failure it actually had, and the one recovery offered.
      await expect(visible(page, L.plans_load_error_body)).toBeVisible();
      await expect(visible(page, L.try_again)).toBeVisible();
      // F9's regression: the no-coverage body told the traveler to browse elsewhere
      // while the only control was Try again.
      await expect(visible(page, L.no_coverage_body)).toHaveCount(0);
    },
  },
  {
    // Selection + permission-denied in one state, because that is how an anonymous
    // traveler meets it: choosing a plan is allowed, and the account requirement
    // appears only at the point it applies — with the chosen plan still on screen.
    name: "selected-sign-in-required",
    fixture: (page) => page.route(PRODUCTS_GLOB, (route) => route.fulfill(json([plan()]))),
    act: async (page) => {
      await planRow(page, /10 GB.+NT\$ 690/).click();
    },
    reached: async (page) => {
      await expect(visible(page, L.sign_in_to_buy)).toBeVisible();
      // The selected plan is still named on screen: the shopper's context survives
      // the sign-in requirement rather than being discarded by it.
      await expect(visible(page, L.checkout_title)).toBeVisible();
    },
  },
  {
    name: "loading",
    fixture: (page) =>
      // Held open, never answered: the loading state is a state, not a transient.
      page.route(PRODUCTS_GLOB, () => {}),
    reached: async (page) => {
      await expect(visible(page, L.loading_plans)).toBeVisible();
    },
  },
  {
    name: "overflow",
    fixture: (page) =>
      page.route(PRODUCTS_GLOB, (route) => route.fulfill(json([OVERFLOWING, plan()]))),
    reached: async (page) => {
      await expect(planRow(page, /100 GB.+NT\$ 128,900/)).toBeVisible();
      // The contract's actual promise: an unusually long name or price never pushes a
      // CTA off-screen. A page wider than its own viewport is how that failure looks.
      const spill = await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      );
      expect(spill, "the page scrolls horizontally — content is not clamped").toBeLessThanOrEqual(1);
      await expect(planRow(page, /100 GB/)).toBeVisible();
    },
  },
];

const BASE = process.env.WEB_URL;

test.describe("shop region states", () => {
  for (const state of STATES) {
    test(`${REGION} ${state.name}`, async ({ page }) => {
      expect(BASE, "web was not booted — no base URL").toBeTruthy();
      await state.fixture(page);
      await page.goto(`${BASE}${REGION}`, { waitUntil: "load" });
      if (state.act) await state.act(page);
      await state.reached(page);

      await page.addStyleTag({
        content: `*, *::before, *::after {
          animation-duration: 0s !important; animation-delay: 0s !important;
          transition-duration: 0s !important; transition-delay: 0s !important;
          caret-color: transparent !important;
        }`,
      });
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(400);
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.waitForTimeout(400);

      await expect(page).toHaveScreenshot(`shop-region-${state.name}.png`, {
        fullPage: true,
        maxDiffPixelRatio: 0.01,
        animations: "disabled",
      });
    });
  }
});
