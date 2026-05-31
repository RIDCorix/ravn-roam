import { describe, expect, test } from "vitest";

import {
  buildPlanningContract,
  normalizeTripDraftCalendar,
  tripDraftFromLooseDays,
} from "./openai.js";

describe("tripDraftFromLooseDays", () => {
  test("turns non-editor days into a visible trip draft", () => {
    const draft = tripDraftFromLooseDays([
      {
        day_date: "2026-09-25",
        city: "台北",
        note: "出發日",
        stops: [
          {
            name: "台北 → 米蘭",
            kind: "transit",
            arrival_time: "23:45",
            duration_min: 850,
            note: "",
            attachments: [],
          },
        ],
      },
      {
        day_date: "2026-09-26",
        city: "米蘭",
        note: "抵達米蘭",
        stops: [],
      },
    ]);

    expect(draft).toMatchObject({
      title: "台北 + 米蘭",
      start_date: "2026-09-25",
      end_date: "2026-09-26",
      cover: "台北",
    });
    expect(draft.days).toHaveLength(2);
    expect(draft.checklist?.map((item) => item.kind)).toEqual([
      "flight",
      "esim",
      "doc",
    ]);
  });
});

describe("normalizeTripDraftCalendar", () => {
  test("preserves draft date range and fills missing calendar days", () => {
    const draft = normalizeTripDraftCalendar({
      title: "台北到米蘭",
      start_date: "2026-09-25",
      end_date: "2026-10-11",
      cover: "台北",
      days: [
        {
          day_date: "2026-09-25",
          city: "Milan",
          note: "抵達日",
          stops: [],
        },
      ],
    });

    expect(draft.start_date).toBe("2026-09-25");
    expect(draft.end_date).toBe("2026-10-11");
    expect(draft.days).toHaveLength(17);
    expect(draft.days[0]?.day_date).toBe("2026-09-25");
    expect(draft.days[16]?.day_date).toBe("2026-10-11");
    expect(draft.days[16]?.city).toBe("Milan");
  });
});

describe("buildPlanningContract", () => {
  test("forces whole-trip editor prompts to emit every current trip date", () => {
    const contract = buildPlanningContract({
      prompt: "幫我簡單規劃每一天 2~3 個行程加上一個餐廳",
      editableTrip: {
        title: "台北到米蘭",
        start_date: "2026-09-25",
        end_date: "2026-09-27",
        days: [
          { day_date: "2026-09-25", city: "米蘭", note: "", stops: [] },
          { day_date: "2026-09-26", city: "米蘭", note: "", stops: [] },
          { day_date: "2026-09-27", city: "米蘭", note: "", stops: [] },
        ],
        cities: [],
        companions: [],
      },
    });

    expect(contract).toContain("day patches");
    expect(contract).toContain("2026-09-25, 2026-09-26, 2026-09-27");
    expect(contract).toContain("Do not ask which day");
    expect(contract).toContain("Do not answer with summary only");
    expect(contract).toContain("only say you planned/updated EVERY day");
    expect(contract).toContain("REAL restaurant name");
  });

  test("does not add a planning contract for non-planning chat", () => {
    const contract = buildPlanningContract({
      prompt: "這趟需要買多少流量？",
      editableTrip: {
        title: "台北到米蘭",
        start_date: "2026-09-25",
        end_date: "2026-09-27",
        days: [
          { day_date: "2026-09-25", city: "米蘭", note: "", stops: [] },
        ],
        cities: [],
        companions: [],
      },
    });

    expect(contract).toBeNull();
  });
});
