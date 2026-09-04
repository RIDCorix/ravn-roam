import { expect, test, type CDPSession, type Page } from "@playwright/test";

/**
 * R-301 c-7 — the sheet gesture, driven by real touch input.
 *
 * Two UAT rounds returned this ticket with the same three items open, both
 * times because the only evidence anyone could produce was a desktop *mouse*
 * drag. A mouse drag cannot stand in for these: it never produces a `touch`
 * pointer type, it is not subject to `touch-action`, and Chromium never
 * weighs scrolling the page against handing the events to the grabber. The
 * gesture's touch path — the path a phone actually takes — had no coverage
 * at all.
 *
 * This file drives it with genuine `Input.dispatchTouchEvent` sequences over
 * CDP, in the `mobile-touch` project (390x844, `hasTouch`, `isMobile`,
 * DPR 3), and asserts the numbers from the UAT sheet:
 *
 *   c-7a  the press must not move the sheet more than 4px, and the sheet
 *         must track the finger to within +-6px for the whole drag.
 *   c-7b  a grab must take over an in-flight animation without a seam, and
 *         each reversal must show in the next painted frame.
 *   c-7c  slow/fast x up/down: the release must hand off to a continuous
 *         settle with no teleport, land on a real detent chosen by the
 *         release velocity, and never cross the bottom navigation.
 *
 * Two deliberate choices about how, because they are what makes the evidence
 * worth anything:
 *
 * 1. Anything that could race the browser is measured *in the page*, from
 *    the pointerdown listener itself, rather than round-tripping over CDP
 *    and hoping nothing moved in between. A CDP round trip costs tens of
 *    milliseconds here; the properties under test are single-frame ones.
 *
 * 2. Headless Chromium serves requestAnimationFrame at ~12-20fps on this
 *    machine — measured, and `--disable-frame-rate-limit`, `--disable-gpu-
 *    vsync` and swiftshader all make it worse, not better. Headed Chromium
 *    on a real display serves a clean 16.7ms. So no assertion here is
 *    allowed to assume a frame rate. The settle is checked two ways that do
 *    not: against the CSS transition it hands off to, and per interval
 *    against what that transition's easing can cover in the time that
 *    interval actually took. Each run annotates the cadence it saw, so a
 *    60fps run is legible as one without being required.
 *
 * For a run on a real display at 60fps:
 *   pnpm --filter @roam/web e2e:touch:60fps
 *
 * What is still not covered is a physical handset. This closes the
 * input-class gap (mouse -> touch) and the sampling gap (bounding boxes ->
 * frames), not the hardware gap: digitiser noise, iOS Safari's own gesture
 * arbitration and thermal throttling are not reproduced. See
 * docs/specs/R-301-trip-planning/DELIVERY.md.
 */

const PLANNER_PATH = (lang: string) => `/${lang}/dev/trip-planner`;

const DETENT_FRACTION = { map: 0.24, plan: 0.62, full: 0.94 } as const;
type Detent = keyof typeof DETENT_FRACTION;

interface Frame {
  t: number;
  height: number;
  bottom: number;
  navTop: number;
  running: number;
}

interface Press {
  /** Sheet height read inside the pointerdown listener, before the handler. */
  before: number;
  /** Sheet height on the first frame after the press. */
  after: number;
  /** Animations running at the moment of the press. */
  runningBefore: number;
  pointerType: string;
  t: number;
}

interface Probe {
  frames: Frame[];
  presses: Press[];
  marks: Record<string, number>;
  recording: boolean;
}

declare global {
  interface Window {
    __r301: Probe;
  }
}

// ── page instrumentation ───────────────────────────────────────────────

/**
 * Installs the in-page probe. The pointerdown listener is the important
 * part: it sits on the handle itself, so it runs before React's delegated
 * handler at the root and sees the sheet exactly as the finger found it.
 * That is the only way to measure a press jump without racing it.
 */
async function installProbe(page: Page) {
  await page.evaluate(() => {
    const sheet = document.querySelector(
      '[data-testid="planner-sheet"]',
    ) as HTMLElement;
    const nav = document.querySelector(
      'nav[aria-label="Primary"]',
    ) as HTMLElement;
    const handle = document.querySelector(
      '[data-testid="planner-sheet-handle"]',
    ) as HTMLElement;

    const probe: Probe = {
      frames: [],
      presses: [],
      marks: {},
      recording: false,
    };
    window.__r301 = probe;

    const running = () =>
      sheet.getAnimations().filter((a) => a.playState === "running").length;

    handle.addEventListener("pointerdown", (event) => {
      const press: Press = {
        before: sheet.getBoundingClientRect().height,
        after: Number.NaN,
        runningBefore: running(),
        pointerType: (event as PointerEvent).pointerType,
        t: performance.now(),
      };
      probe.presses.push(press);
      requestAnimationFrame(() => {
        press.after = sheet.getBoundingClientRect().height;
      });
    });

    // Timestamp with the frame time rAF is given, not performance.now(), and
    // drop repeats. Two callbacks can run inside one frame — the test's own
    // `sheetOnNextFrame` schedules one — and timestamping them by wall clock
    // produced pairs 7ms apart that looked like a frame interval and were
    // not. Anything that divides by dt reads that as the sheet moving a
    // frame's worth of pixels in half a frame.
    let lastFrame = -1;
    const tick = (frameTime: number) => {
      if (probe.recording && frameTime !== lastFrame) {
        lastFrame = frameTime;
        const s = sheet.getBoundingClientRect();
        probe.frames.push({
          t: frameTime,
          height: s.height,
          bottom: s.bottom,
          navTop: nav.getBoundingClientRect().top,
          running: running(),
        });
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}

async function record(page: Page, on: boolean) {
  await page.evaluate((value) => {
    window.__r301.recording = value;
    if (value) window.__r301.frames = [];
  }, on);
}

async function readProbe(page: Page): Promise<Probe> {
  return page.evaluate(
    () => JSON.parse(JSON.stringify(window.__r301)) as Probe,
  );
}

async function mark(page: Page, name: string): Promise<number> {
  return page.evaluate((key) => {
    const now = performance.now();
    window.__r301.marks[key] = now;
    return now;
  }, name);
}

/** Median frame gap this display is actually serving, right now. */
async function frameCadence(page: Page): Promise<number> {
  return page.evaluate(async () => {
    const stamps: number[] = [];
    await new Promise<void>((resolve) => {
      const tick = (t: number) => {
        stamps.push(t);
        if (stamps.length < 40) requestAnimationFrame(tick);
        else resolve();
      };
      requestAnimationFrame(tick);
    });
    const gaps = stamps
      .slice(1)
      .map((t, i) => t - stamps[i]!)
      .sort((a, b) => a - b);
    return gaps[Math.floor(gaps.length / 2)]!;
  });
}

/** Sheet geometry, read on the next painted frame. */
async function sheetOnNextFrame(page: Page) {
  return page.evaluate(async () => {
    await new Promise((resolve) => requestAnimationFrame(resolve));
    const el = document.querySelector(
      '[data-testid="planner-sheet"]',
    ) as HTMLElement;
    const s = el.getBoundingClientRect();
    return {
      height: s.height,
      bottom: s.bottom,
      navTop: document
        .querySelector('nav[aria-label="Primary"]')!
        .getBoundingClientRect().top,
      dragging: el.classList.contains("is-dragging"),
      running: el.getAnimations().filter((a) => a.playState === "running")
        .length,
    };
  });
}

/**
 * The settle, described rather than sampled.
 *
 * A CSS transition is a contract the compositor honours whatever the frame
 * rate is: given a from-value, a to-value, a duration and an easing, there
 * is no frame on which the height can be anywhere else. So "did it teleport"
 * is answerable without watching frames at all — a teleport is the absence
 * of this record.
 */
async function settleContract(page: Page) {
  return page.evaluate(() => {
    const el = document.querySelector(
      '[data-testid="planner-sheet"]',
    ) as HTMLElement;
    const animation = el
      .getAnimations()
      .find((a) => (a as CSSTransition).transitionProperty === "height") as
      | CSSTransition
      | undefined;
    if (!animation) return null;
    const timing = animation.effect!.getComputedTiming();
    const frames = (animation.effect as KeyframeEffect).getKeyframes();
    return {
      property: animation.transitionProperty,
      duration: Number(timing.duration),
      elapsed: Number(animation.currentTime ?? 0),
      from: parseFloat(String(frames[0]?.height ?? "")),
      to: parseFloat(String(frames.at(-1)?.height ?? "")),
    };
  });
}

/**
 * The most the settle may move in one interval of `dt` milliseconds.
 *
 * This deliberately does not assume a frame rate. An earlier version gated
 * the whole check on a measured median frame gap, which is not a promise
 * about any individual gap: it passed a 126px step that was several dropped
 * frames' worth of ordinary motion, and failed a legitimate one.
 *
 * cubic-bezier(0.32, 0.72, 0, 1) has a peak slope of y1/x1 = 2.25, so over
 * `dt` of a 320ms transition the height can cover at most
 * `2.25 * distance * dt / 320`. Two allowances on top: the transition does
 * not start on a frame boundary, so the first recorded interval can carry up
 * to a frame of animation time it was not sampled across, and a small
 * constant for sub-pixel rounding.
 *
 * A teleport still fails comfortably — it covers the entire distance inside
 * one interval, against a budget of roughly a third of it.
 */
function frameBudget(distance: number, dt: number): number {
  const PEAK_SLOPE = 2.25;
  const UNSAMPLED_FRAME_MS = 17;
  return (PEAK_SLOPE * distance * (dt + UNSAMPLED_FRAME_MS) * 1.2) / 320 + 4;
}

async function detents(page: Page) {
  const space = Number(
    await page.getByTestId("planner").getAttribute("data-planning-space"),
  );
  return {
    space,
    map: Math.round(space * DETENT_FRACTION.map),
    plan: Math.round(space * DETENT_FRACTION.plan),
    full: Math.round(space * DETENT_FRACTION.full),
  };
}

async function animationsIdle(page: Page) {
  await page.waitForFunction(() =>
    (document.querySelector('[data-testid="planner-sheet"]') as HTMLElement)
      .getAnimations()
      .every((a) => a.playState !== "running"),
  );
}

// ── real touch input ───────────────────────────────────────────────────

function touchDriver(cdp: CDPSession) {
  const send = (
    type: "touchStart" | "touchMove" | "touchEnd",
    x: number,
    y: number,
  ) =>
    cdp.send("Input.dispatchTouchEvent", {
      type,
      touchPoints: type === "touchEnd" ? [] : [{ x, y, id: 1 }],
    });
  return {
    down: (x: number, y: number) => send("touchStart", x, y),
    move: (x: number, y: number) => send("touchMove", x, y),
    up: (x: number, y: number) => send("touchEnd", x, y),
  };
}

async function grabPoint(page: Page) {
  const box = (await page.getByTestId("planner-sheet-handle").boundingBox())!;
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

async function settleTo(page: Page, detent: Detent) {
  await page.getByTestId(`planner-detent-${detent}`).click();
  await expect(page.getByTestId("planner")).toHaveAttribute(
    "data-detent",
    detent,
  );
  await animationsIdle(page);
}

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
  await page.addStyleTag({ content: "nextjs-portal{display:none!important}" });
  // Third-party tiles have nothing to do with the gesture and only add jank.
  await page.addStyleTag({
    content: ".leaflet-tile-pane{visibility:hidden!important}",
  });
  await installProbe(page);
}

// ───────────────────────────────────────────────────────────────────────

test.describe("c-7 sheet gesture under real touch input", () => {
  test.beforeEach(async ({ page }) => {
    await gotoPlanner(page);
  });

  // ── c-7a · the grab does not jump, and the sheet tracks the finger ───

  test("c-7a grabs without a jump and tracks the finger within 6px", async ({
    page,
  }) => {
    const touch = touchDriver(await page.context().newCDPSession(page));
    const heights = await detents(page);

    await settleTo(page, "plan");
    const grab = await grabPoint(page);

    // The grabber has to opt out of browser scrolling explicitly. It happens
    // not to be load-bearing in today's layout — the planner owns the
    // viewport and has no scrollable ancestor to steal the gesture — which
    // is exactly why it is worth pinning: the day the sheet lives inside
    // something scrollable, losing this silently hands every drag to the
    // scroller, and no mouse test would notice.
    await expect(page.getByTestId("planner-sheet-handle")).toHaveCSS(
      "touch-action",
      "none",
    );

    const before = await sheetOnNextFrame(page);
    await touch.down(grab.x, grab.y);
    const pressed = await sheetOnNextFrame(page);
    expect(pressed.dragging).toBe(true);

    // Up 160px, then back down past the start. Sampled every 8px of finger
    // travel, finer than a thumb moves between frames.
    const path: number[] = [];
    for (let dy = -8; dy >= -160; dy -= 8) path.push(dy);
    for (let dy = -152; dy <= 40; dy += 8) path.push(dy);

    let worst = 0;
    for (const dy of path) {
      await touch.move(grab.x, grab.y + dy);
      const live = await sheetOnNextFrame(page);
      const expected = Math.min(
        heights.full,
        Math.max(heights.map, pressed.height - dy),
      );
      worst = Math.max(worst, Math.abs(live.height - expected));
      // Mid-gesture is when a sheet is most likely to reach under the
      // navigation, so check every sample rather than only the end state.
      expect(live.bottom).toBeLessThanOrEqual(live.navTop + 1);
    }
    await touch.up(grab.x, grab.y + 40);

    const presses = (await readProbe(page)).presses;
    expect(presses, "the touch must land on the grabber").toHaveLength(1);
    const press = presses[0]!;

    // Measured inside the pointerdown listener: the sheet the finger landed
    // on versus the sheet one frame later, with no CDP round trip in
    // between for a jump to hide in.
    expect(press.pointerType, "the gesture must run the touch path").toBe(
      "touch",
    );
    expect(
      Math.abs(press.after - press.before),
      "press must not move the sheet",
    ).toBeLessThanOrEqual(4);
    expect(Math.abs(press.before - before.height)).toBeLessThanOrEqual(1);
    expect(worst, "sheet must track the finger within 6px").toBeLessThanOrEqual(
      6,
    );
  });

  // ── c-7b · takeover and reversal ─────────────────────────────────────

  test("c-7b takes over a running animation and reverses on the next frame", async ({
    page,
  }) => {
    const cdp = await page.context().newCDPSession(page);
    const touch = touchDriver(cdp);
    const heights = await detents(page);

    // Grab a real height transition while it is still running.
    //
    // Aiming at the handle is the awkward part, and it is a harness problem
    // rather than a product one. The handle rides the top of the sheet,
    // which climbs 211px on the way to `full` at up to 1.6px/ms, so a grab
    // point read over CDP is stale before the touch that uses it is
    // dispatched — the first version of this test passed on macOS and missed
    // the 28px grabber on every attempt on the CI runner.
    //
    // So stop the animation clock instead of racing it. The transition is
    // left mid-flight at a real intermediate height, still unfinished and
    // still reported as running; it simply holds still long enough to be
    // aimed at. Nothing about how the handler reads the sheet changes, which
    // is the thing under test, and freezing removes the race rather than
    // papering over it with retries.
    await cdp.send("Animation.enable");
    await settleTo(page, "plan");
    await record(page, true);

    await page.getByTestId("planner-detent-full").click();
    await page.waitForTimeout(40);
    await cdp.send("Animation.setPlaybackRate", { playbackRate: 0 });

    const grab = await grabPoint(page);
    await touch.down(grab.x, grab.y);
    // One frame has to pass before the probe can report where the sheet
    // ended up, since that is read from a requestAnimationFrame callback.
    await sheetOnNextFrame(page);

    const presses = (await readProbe(page)).presses;
    expect(presses, "the touch must land on the grabber").toHaveLength(1);
    const press = presses[0]!;

    await cdp.send("Animation.setPlaybackRate", { playbackRate: 1 });
    const pressed = await sheetOnNextFrame(page);

    expect(press.pointerType).toBe("touch");
    expect(
      press.runningBefore,
      "the press must land while the sheet is still animating",
    ).toBeGreaterThan(0);
    // Continuity across the takeover: the sheet the finger grabbed is the
    // sheet it holds a frame later — no snap to either end of the animation
    // it interrupted. Both readings are taken in-page, one frame apart.
    expect(
      Math.abs(press.after - press.before),
      "takeover must not seam",
    ).toBeLessThanOrEqual(4);
    expect(press.before).toBeGreaterThan(heights.plan - 4);
    expect(press.before).toBeLessThan(heights.full + 4);
    expect(pressed.dragging).toBe(true);
    expect(pressed.running, "the old animation must be dropped").toBe(0);

    // Legs sized from the headroom the grab actually left, not fixed: the
    // takeover lands wherever the transition had got to, and a leg that runs
    // into the `full` clamp stops the sheet dead — which reads as "did not
    // reverse" when the sheet is simply pinned at the top.
    const grow = Math.min(80, heights.full - pressed.height - 16);
    const shrink = Math.min(140, pressed.height + grow - heights.map - 16);
    const regrow = Math.min(100, heights.full - (pressed.height + grow - shrink) - 16);
    expect(Math.min(grow, shrink, regrow)).toBeGreaterThan(30);

    const legs = [-grow, shrink, -regrow]; // up, reverse down, reverse up
    let y = grab.y;
    let previous = pressed.height;
    let reversals = 0;

    for (const [index, leg] of legs.entries()) {
      const step = leg > 0 ? 10 : -10;
      for (
        let travelled = 0;
        Math.abs(travelled) < Math.abs(leg);
        travelled += step
      ) {
        y += step;
        await touch.move(grab.x, y);
        const live = await sheetOnNextFrame(page);

        if (travelled === 0 && index > 0) {
          reversals += 1;
          // The next painted frame after the reversal already shows the
          // sheet going the other way; it does not play out the old
          // direction first.
          if (step > 0) expect(live.height).toBeLessThan(previous);
          else expect(live.height).toBeGreaterThan(previous);
        }
        // A running animation here would mean something other than the
        // finger is deciding where the sheet is.
        expect(live.running).toBe(0);
        expect(live.dragging).toBe(true);
        expect(live.bottom).toBeLessThanOrEqual(live.navTop + 1);
        previous = live.height;
      }
    }
    expect(reversals).toBe(2);
    // The drag is what this check records, so stop before the settle.
    await record(page, false);
    const probe = await readProbe(page);
    await touch.up(grab.x, y);
    // Once the finger is down, no frame of the drag is animation-driven.
    const animated = probe.frames.filter(
      (frame) => frame.running > 0 && frame.t > press.t,
    );
    expect(animated).toEqual([]);
  });

  // ── c-7c · the four release cases ────────────────────────────────────

  const RELEASES = [
    {
      name: "slow upward",
      direction: -1 as const,
      lead: 60,
      flickPx: 12,
      flickPause: 90,
      fast: false,
    },
    {
      name: "fast upward",
      direction: -1 as const,
      lead: 40,
      flickPx: 44,
      flickPause: 0,
      fast: true,
      expected: "full" as Detent,
    },
    {
      name: "slow downward",
      direction: 1 as const,
      lead: 60,
      flickPx: 12,
      flickPause: 90,
      fast: false,
    },
    {
      name: "fast downward",
      direction: 1 as const,
      lead: 40,
      flickPx: 44,
      flickPause: 0,
      fast: true,
      expected: "map" as Detent,
    },
  ];

  for (const release of RELEASES) {
    test(`c-7c releases ${release.name} onto a detent without a jump`, async ({
      page,
    }, testInfo) => {
      const touch = touchDriver(await page.context().newCDPSession(page));
      const heights = await detents(page);

      await settleTo(page, "plan");
      const grab = await grabPoint(page);
      const cadence = await frameCadence(page);
      await record(page, true);

      let y = grab.y;
      await touch.down(grab.x, y);

      // Lead-in: move the sheet off its detent at a speed the release does
      // not inherit, so the projection has something to say.
      for (let travelled = 0; travelled < release.lead; travelled += 10) {
        y += 10 * release.direction;
        await touch.move(grab.x, y);
        await page.waitForTimeout(24);
      }

      // The release. `flickPause` is the whole difference between the two
      // speeds: the same displacement over 90ms is a slide, over one frame
      // it is a flick.
      for (let step = 0; step < 3; step += 1) {
        y += release.flickPx * release.direction;
        await touch.move(grab.x, y);
        if (release.flickPause) await page.waitForTimeout(release.flickPause);
      }

      const atRelease = await sheetOnNextFrame(page);
      const releasedAt = await mark(page, "release");
      await touch.up(grab.x, y);

      // The settle contract, read while it is still running. This is what
      // rules out a teleport: a transition from the release height to the
      // detent height over 320ms cannot put the sheet anywhere else on any
      // frame, however few frames the display serves.
      const contract = await settleContract(page);
      expect(
        contract,
        "the release must hand off to a height transition",
      ).toBeTruthy();
      expect(contract!.duration).toBe(320);
      expect(
        Math.abs(contract!.from - atRelease.height),
        "the settle must start from where the finger let go",
      ).toBeLessThanOrEqual(6);

      const settled = (await page
        .getByTestId("planner")
        .getAttribute("data-detent")) as Detent;
      expect(["map", "plan", "full"]).toContain(settled);
      if (release.expected) expect(settled).toBe(release.expected);

      const target = heights[settled];
      const towards = Math.sign(target - atRelease.height);
      expect(
        Math.abs(contract!.to - target),
        "the settle must end on the detent",
      ).toBeLessThanOrEqual(2);
      if (release.fast) {
        // A flick has to be honoured rather than overridden by proximity:
        // upward grows the sheet, downward shrinks it.
        expect(towards).toBe(-release.direction);
      }

      await animationsIdle(page);
      const probe = await readProbe(page);
      await record(page, false);

      // Never under the navigation — drag, release or settle.
      const overlaps = probe.frames.filter(
        (frame) => frame.bottom > frame.navTop + 1,
      );
      expect(overlaps, "sheet must never intersect the navigation").toEqual([]);
      const last = probe.frames.at(-1)!;
      expect(Math.abs(last.height - target)).toBeLessThanOrEqual(2);

      // No frame may jump the settle. See `frameBudget`.
      const after = probe.frames.filter((frame) => frame.t > releasedAt);
      // Measure the budget against the travel the transition itself declared
      // rather than only the gap between the release sample and the detent.
      // The two normally agree to within a pixel; where they do not, the
      // transition is the authority on how far the sheet is going, and using
      // the smaller of the two would invent a jump out of ordinary motion.
      const distance = Math.max(
        Math.abs(contract!.to - contract!.from),
        Math.abs(target - atRelease.height),
      );
      const steps = after.slice(1).map((frame, index) => ({
        dy: frame.height - after[index]!.height,
        dt: Math.max(1, frame.t - after[index]!.t),
      }));
      const jumps = steps.filter(
        (step) => Math.abs(step.dy) > frameBudget(distance, step.dt),
      );
      expect(jumps, "no frame may jump the settle").toEqual([]);

      if (distance > 8) {
        const firstMove = steps.findIndex((step) => Math.abs(step.dy) > 0.5);
        expect(
          firstMove,
          "the settle must start on the release, not after a stall",
        ).toBeGreaterThanOrEqual(0);
        expect(Math.sign(steps[firstMove]!.dy)).toBe(towards);
        const wrongWay = steps
          .slice(firstMove)
          .filter(
            (step) => Math.sign(step.dy) === -towards && Math.abs(step.dy) > 1,
          );
        expect(wrongWay, "the settle must not reverse").toEqual([]);
      }

      testInfo.annotations.push({
        type: "settle",
        description: `${after.length} frames, median gap ${cadence.toFixed(1)}ms, ${distance.toFixed(0)}px to ${settled}`,
      });
    });
  }
});
