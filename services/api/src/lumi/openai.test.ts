import { readFile } from "node:fs/promises";

import ts from "typescript";
import { afterEach, describe, expect, test, vi } from "vitest";

import { env } from "../env.js";
import { serializeLumiContext } from "./context.js";
import {
  buildPlanningContract,
  buildLumiToolDefinitions,
  normalizeLumiDayCities,
  normalizeTripDraftCalendar,
  runLumiTurn,
  selectSkillIdsForTurn,
  stripUnverifiedStopPlaceIds,
  tripDraftFromLooseDays,
} from "./openai.js";
import { buildModePrompt } from "./prompts.js";

const TEST_TRIP_ID = "00000000-0000-4000-8000-000000000001";

function providerImportBoundaryViolations(source: string): string[] {
  const sourceFile = ts.createSourceFile(
    "provider.ts",
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const violations: string[] = [];

  sourceFile.forEachChild((node) => {
    if (
      !ts.isImportDeclaration(node) ||
      !ts.isStringLiteral(node.moduleSpecifier)
    ) {
      return;
    }

    const moduleName = node.moduleSpecifier.text;
    if (/^(?:\.\.\/)+(?:lumi\/)?openai(?:\.js)?$/i.test(moduleName)) {
      violations.push(`compatibility-entry: ${moduleName}`);
    } else if (/(?:^|\/)env(?:\.js)?$/i.test(moduleName)) {
      violations.push(`environment: ${moduleName}`);
    } else if (
      /(?:^|\/)(?:db|database|persistence|repositories?|storage)(?:\/|$)|drizzle|postgres|supabase/i.test(
        moduleName,
      )
    ) {
      violations.push(`persistence: ${moduleName}`);
    } else if (moduleName.startsWith("../") || moduleName.startsWith("@roam/")) {
      violations.push(`domain: ${moduleName}`);
    }
  });

  return violations;
}

function editableDay(day_date: string, city: string) {
  return {
    day_id: `00000000-0000-4000-8000-${day_date.replaceAll("-", "").padEnd(12, "0")}`,
    day_date,
    city,
    cities: [city],
    note: "",
    stops: [],
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("Lumi module boundaries", () => {
  test("builds mode guidance from structured mode input", () => {
    expect(buildModePrompt({ mode: null })).toContain("read-only");
    expect(buildModePrompt({ mode: "edit-trip" })).toContain("exact IDs");
  });

  test("serializes stable editable snapshot IDs without authorization input", () => {
    const snapshot = {
      trip_id: TEST_TRIP_ID,
      title: "Milan design trip",
      start_date: "2026-09-27",
      end_date: "2026-09-27",
      days: [
        {
          ...editableDay("2026-09-27", "Milan"),
          stops: [
            {
              stop_id: "00000000-0000-4000-8000-000000000003",
              name: "Pinacoteca di Brera",
              place_name: "Pinacoteca di Brera",
            },
          ],
        },
      ],
      cities: [],
      companions: [],
    };

    const context = serializeLumiContext(snapshot);

    expect(context).toContain(snapshot.days[0]!.day_id);
    expect(context).toContain(snapshot.days[0]!.stops[0]!.stop_id);
  });

  test("detects complete forbidden provider import declarations", () => {
    const source = `
      import {
        env,
      } from "../../env.js";
      import type {
        Database,
      } from "../../db/index.js";
      import {
        validateLumiCommand,
      } from "../validation/commands.js";
      import {
        runLumiTurn,
      } from "../openai.js";
    `;

    expect(providerImportBoundaryViolations(source)).toEqual([
      "environment: ../../env.js",
      "persistence: ../../db/index.js",
      "domain: ../validation/commands.js",
      "compatibility-entry: ../openai.js",
    ]);
  });

  test("keeps provider transport inside its import boundary", async () => {
    const source = await readFile(
      new URL("./provider/openai.ts", import.meta.url),
      "utf8",
    );

    expect(providerImportBoundaryViolations(source)).toEqual([]);
  });
});

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
  test("never fabricates missing draft days", () => {
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
    expect(draft.days).toHaveLength(1);
    expect(draft.days[0]?.day_date).toBe("2026-09-25");
  });
});

describe("normalizeLumiDayCities", () => {
  test("keeps airport transfer anchors out of overview city paths", () => {
    expect(
      normalizeLumiDayCities({
        city: "台北",
        cities: ["台北", "桃園機場", "米蘭"],
      }),
    ).toEqual(["台北", "米蘭"]);
  });
});

describe("runLumiTurn trip drafts", () => {
  test("returns a typed create-flight command for an editable trip", async () => {
    env.OPENAI_API_KEY = "test-key";
    env.OPENAI_MODEL = "gpt-test";

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                tool_calls: [
                  {
                    id: "call_set_flights",
                    type: "function",
                    function: {
                      name: "create_flight_leg",
                      arguments: JSON.stringify({
                        trip_id: TEST_TRIP_ID,
                        leg: {
                          departure_date: "2026-09-27",
                          departure_time: "11:20",
                          flight_number: "BR 88",
                          terminal: null,
                          gate: "A12",
                        },
                      }),
                    },
                  },
                ],
              },
            },
          ],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    ).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                tool_calls: [
                  {
                    id: "call_flights",
                    type: "function",
                    function: {
                      name: "lumi_response",
                      arguments: JSON.stringify({
                        summary: "已更新航班資訊。",
                        days: null,
                        companions: null,
                        flight_details: null,
                        trip_draft: null,
                        esim_suggestion: null,
                      }),
                    },
                  },
                ],
              },
            },
          ],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );

    const result = await runLumiTurn({
      prompt: "去程 BR 88，2026-09-27 11:20，Gate A12",
      requestedSkill: "edit-trip",
      editableTrip: {
        trip_id: TEST_TRIP_ID,
        title: "歐洲旅行",
        start_date: "2026-09-27",
        end_date: "2026-10-04",
        days: [],
        cities: [],
        companions: [],
      },
    });

    expect(result.commands?.[0]).toMatchObject({
      type: "create_flight_leg",
      trip_id: TEST_TRIP_ID,
      leg: { flight_number: "BR 88", gate: "A12" },
    });
  });

  test("collects repeated explicit flight commands in one turn", async () => {
    env.OPENAI_API_KEY = "test-key";
    env.OPENAI_MODEL = "gpt-test";

    const flightToolCall = (id: string) =>
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                tool_calls: [
                  {
                    id,
                    type: "function",
                    function: {
                      name: "create_flight_leg",
                      arguments: JSON.stringify({
                        trip_id: TEST_TRIP_ID,
                        leg: {
                          departure_date: "2026-09-27",
                          departure_time: null,
                          flight_number: "BR 88",
                          terminal: null,
                          gate: null,
                        },
                      }),
                    },
                  },
                ],
              },
            },
          ],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );

    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(flightToolCall("call_set_flights_1"))
      .mockResolvedValueOnce(flightToolCall("call_set_flights_2"))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  tool_calls: [
                    {
                      id: "call_final",
                      type: "function",
                      function: {
                        name: "lumi_response",
                        arguments: JSON.stringify({
                          summary: "已更新航班資訊。",
                          days: null,
                          companions: null,
                          flight_details: null,
                          trip_draft: null,
                          esim_suggestion: null,
                        }),
                      },
                    },
                  ],
                },
              },
            ],
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
      );

    const result = await runLumiTurn({
      prompt: "去程 BR 88，2026-09-27",
      requestedSkill: "edit-trip",
      editableTrip: {
        trip_id: TEST_TRIP_ID,
        title: "歐洲旅行",
        start_date: "2026-09-27",
        end_date: "2026-10-04",
        days: [],
        cities: [],
        companions: [],
      },
    });

    expect(result.commands?.filter((command) => command.type === "create_flight_leg")).toHaveLength(2);
  });

  test("attaches staged flight details to a new trip draft", async () => {
    env.OPENAI_API_KEY = "test-key";
    env.OPENAI_MODEL = "gpt-test";

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                tool_calls: [
                  {
                    id: "call_set_flights",
                    type: "function",
                    function: {
                      name: "set_flight_details",
                      arguments: JSON.stringify({
                        flight_details: [
                          {
                            leg_key: "outbound",
                            departure_date: "2026-09-27",
                            departure_time: "11:20",
                            flight_number: "BR 88",
                            terminal: "Terminal 1",
                            gate: null,
                          },
                        ],
                      }),
                    },
                  },
                ],
              },
            },
          ],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    ).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                tool_calls: [
                  {
                    id: "call_draft",
                    type: "function",
                    function: {
                      name: "lumi_response",
                      arguments: JSON.stringify({
                        summary: "已建立行程草稿。",
                        days: null,
                        companions: null,
                        flight_details: null,
                        trip_draft: {
                          title: "東京旅行",
                          start_date: "2026-09-27",
                          end_date: "2026-09-27",
                          cover: "東京",
                          days: [
                            {
                              day_date: "2026-09-27",
                              city: "東京",
                              cities: ["東京"],
                              segments: [],
                              note: "抵達東京。",
                              stops: [],
                            },
                          ],
                          flight_details: null,
                          checklist: [],
                        },
                        esim_suggestion: null,
                      }),
                    },
                  },
                ],
              },
            },
          ],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );

    const result = await runLumiTurn({
      prompt: "用 BR 88 9/27 11:20 到東京建立行程",
      requestedSkill: "create-trip",
    });

    expect(result.trip_draft?.flight_details).toEqual([
      {
        leg_key: "outbound",
        departure_date: "2026-09-27",
        departure_time: "11:20",
        flight_number: "BR 88",
        terminal: "TERMINAL 1",
        gate: undefined,
      },
    ]);
  });

  test("does not move gate values into terminal in a typed flight command", async () => {
    env.OPENAI_API_KEY = "test-key";
    env.OPENAI_MODEL = "gpt-test";

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                tool_calls: [
                  {
                    id: "call_set_flights",
                    type: "function",
                    function: {
                      name: "create_flight_leg",
                      arguments: JSON.stringify({
                        trip_id: TEST_TRIP_ID,
                        leg: {
                          departure_date: null,
                          departure_time: null,
                          flight_number: "BR 95",
                          terminal: null,
                          gate: "T1",
                        },
                      }),
                    },
                  },
                ],
              },
            },
          ],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    ).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                tool_calls: [
                  {
                    id: "call_final",
                    type: "function",
                    function: {
                      name: "lumi_response",
                      arguments: JSON.stringify({
                        summary: "已更新航班資訊。",
                        days: null,
                        companions: null,
                        flight_details: null,
                        trip_draft: null,
                        esim_suggestion: null,
                      }),
                    },
                  },
                ],
              },
            },
          ],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );

    const result = await runLumiTurn({
      prompt: "去程 BR 95，第一航廈",
      requestedSkill: "edit-trip",
      editableTrip: {
        trip_id: TEST_TRIP_ID,
        title: "歐洲旅行",
        start_date: "2026-09-27",
        end_date: "2026-10-04",
        days: [],
        cities: [],
        companions: [],
      },
    });

    expect(result.commands?.[0]).toMatchObject({
      type: "create_flight_leg",
      leg: { flight_number: "BR 95", terminal: null, gate: "T1" },
    });
  });

  test("accepts draft days whose city is still unknown", async () => {
    env.OPENAI_API_KEY = "test-key";
    env.OPENAI_MODEL = "gpt-test";

    const invalidResponse = () =>
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                tool_calls: [
                  {
                    id: "call_draft",
                    type: "function",
                    function: {
                      name: "lumi_response",
                      arguments: JSON.stringify({
                        summary: "先建立探索中的行程草稿。",
                        days: null,
                        companions: null,
                        esim_suggestion: null,
                        trip_draft: {
                          title: "探索中的行程",
                          start_date: "2026-09-25",
                          end_date: "2026-09-25",
                          cover: null,
                          days: [
                            {
                              day_date: "2026-09-25",
                              city: "",
                              note: "先保留日期，目的地稍後再決定。",
                              stops: [],
                            },
                          ],
                          checklist: [],
                        },
                      }),
                    },
                  },
                ],
              },
            },
          ],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    const fetchMock = vi.spyOn(globalThis, "fetch");
    for (let i = 0; i < 6; i++) {
      fetchMock.mockResolvedValueOnce(invalidResponse());
    }

    const result = await runLumiTurn({
      prompt: "先建立一個 9/25 出發但還沒決定去哪的行程",
      requestedSkill: "create-trip",
    });

    expect(result.trip_draft?.days[0]?.city).toBe("");
  });

  test("guides Lumi to emit regional stops through the tool contract", async () => {
    env.OPENAI_API_KEY = "test-key";
    env.OPENAI_MODEL = "gpt-test";

    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                tool_calls: [
                  {
                    id: "call_draft",
                    type: "function",
                    function: {
                      name: "lumi_response",
                      arguments: JSON.stringify({
                        summary: "已建立米蘭設計散步行程。",
                        days: null,
                        companions: null,
                        esim_suggestion: null,
                        trip_draft: {
                          title: "米蘭設計散步",
                          start_date: "2026-09-27",
                          end_date: "2026-09-27",
                          cover: "米蘭",
                          days: [
                            {
                              day_date: "2026-09-27",
                              city: "米蘭",
                              note: "Brera 與 Navigli",
                              stops: [
                                {
                                  name: "Brera 區散步",
                                  anchor_mode: "exact_place",
                                  place_name: "Pinacoteca di Brera",
                                  place_id: null,
                                  place_address: null,
                                  area_name: null,
                                  search_query: null,
                                  country_code: "IT",
                                  place_types: [],
                                  suggestion_count: null,
                                  kind: "sight",
                                  arrival_time: "10:30",
                                  duration_min: 90,
                                  note: "以 Brera 區內的美術館作為散步起點。",
                                  attachments: [],
                                },
                                {
                                  name: "晚餐 Navigli 運河區",
                                  anchor_mode: "regional",
                                  place_name: null,
                                  place_id: null,
                                  place_address: null,
                                  area_name: "Navigli",
                                  search_query: "restaurant dinner",
                                  country_code: "IT",
                                  place_types: ["restaurant"],
                                  suggestion_count: 5,
                                  kind: "meal",
                                  arrival_time: "19:30",
                                  duration_min: 90,
                                  note: "以 Navigli 區內的餐廳作為晚餐定位點。",
                                  attachments: [],
                                },
                                {
                                  name: "設計選物店巡禮",
                                  anchor_mode: "regional",
                                  place_name: null,
                                  place_id: null,
                                  place_address: null,
                                  area_name: null,
                                  search_query: "design store concept shop",
                                  country_code: "IT",
                                  place_types: ["store"],
                                  suggestion_count: 5,
                                  kind: "shop",
                                  arrival_time: "14:30",
                                  duration_min: 120,
                                  note: "挑幾間米蘭設計選物店。",
                                  attachments: [],
                                },
                                {
                                  name: "家具品牌展示空間",
                                  anchor_mode: "regional",
                                  place_name: null,
                                  place_id: null,
                                  place_address: null,
                                  area_name: null,
                                  search_query: "furniture showroom home goods store",
                                  country_code: "IT",
                                  place_types: ["furniture_store", "home_goods_store", "store"],
                                  suggestion_count: 5,
                                  kind: "shop",
                                  arrival_time: "16:30",
                                  duration_min: 90,
                                  note: "看看米蘭家具品牌。",
                                  attachments: [],
                                },
                                {
                                  name: "藝廊散步",
                                  anchor_mode: "regional",
                                  place_name: null,
                                  place_id: null,
                                  place_address: null,
                                  area_name: null,
                                  search_query: "art gallery",
                                  country_code: "IT",
                                  place_types: ["art_gallery"],
                                  suggestion_count: 5,
                                  kind: "sight",
                                  arrival_time: "18:00",
                                  duration_min: 60,
                                  note: "保留幾個藝廊選項。",
                                  attachments: [],
                                },
                              ],
                            },
                          ],
                          checklist: [],
                        },
                      }),
                    },
                  },
                ],
              },
            },
          ],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );

    const result = await runLumiTurn({
      prompt: "幫我建立 9/27 米蘭：Brera 區散步，晚餐 Navigli 運河區",
      requestedSkill: "create-trip",
    });

    const stops = result.trip_draft?.days[0]?.stops ?? [];
    expect(stops[0]).toMatchObject({
      name: "Brera 區散步",
      place_name: "Pinacoteca di Brera",
    });
    expect(stops[1]).toMatchObject({
      name: "晚餐 Navigli 運河區",
      anchor_mode: "regional",
      place_name: null,
      area_name: "Navigli",
      search_query: "restaurant dinner",
      place_types: ["restaurant"],
    });
    expect(stops[2]).toMatchObject({
      name: "設計選物店巡禮",
      anchor_mode: "regional",
      kind: "shop",
      place_name: null,
      area_name: null,
      search_query: "design store concept shop",
      place_types: ["store"],
    });
    expect(stops[3]).toMatchObject({
      name: "家具品牌展示空間",
      anchor_mode: "regional",
      kind: "shop",
      place_name: null,
      area_name: null,
      search_query: "furniture showroom home goods store",
      place_types: ["furniture_store", "home_goods_store", "store"],
    });
    expect(stops[4]).toMatchObject({
      name: "藝廊散步",
      anchor_mode: "regional",
      kind: "sight",
      place_name: null,
      area_name: null,
      search_query: "art gallery",
      place_types: ["art_gallery"],
    });

    const request = JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string) as {
      messages: Array<{ role: string; content: string }>;
      tools: unknown[];
    };
    expect(request.messages[0]?.content).toContain(
      "anchor_mode:\"regional\"",
    );
    expect(request.messages[0]?.content).toContain(
      "Never invent other anchor_mode values",
    );
    expect(request.messages[0]?.content).toContain(
      "kind:\"transit\"",
    );
    expect(request.messages[0]?.content).toContain(
      "Do not invent a single representative place for area/category browsing",
    );
    const toolSchema = JSON.stringify(request.tools);
    expect(toolSchema).toContain("anchor_mode");
    expect(toolSchema).toContain("area_name");
    expect(toolSchema).toContain("search_query");
    expect(toolSchema).toContain("Must be null for regional area/category discovery stops");
    expect(toolSchema).toContain("Do not use exact_place with generic category names");
    expect(toolSchema).toContain("Never use transit");
    expect(toolSchema).toContain("including transit anchors such as airports and stations");
    expect(toolSchema).toContain("Recommended for regional discovery when clear");
  });

  test("accepts regional stops with search_query even when place_types is empty", async () => {
    env.OPENAI_API_KEY = "test-key";
    env.OPENAI_MODEL = "gpt-test";

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                tool_calls: [
                  {
                    id: "call_draft",
                    type: "function",
                    function: {
                      name: "lumi_response",
                      arguments: JSON.stringify({
                        summary: "已建立區域探索行程。",
                        days: null,
                        companions: null,
                        esim_suggestion: null,
                        trip_draft: {
                          title: "巴黎街區探索",
                          start_date: "2026-09-28",
                          end_date: "2026-09-28",
                          cover: null,
                          days: [
                            {
                              day_date: "2026-09-28",
                              city: "巴黎",
                              note: "街區探索",
                              stops: [
                                {
                                  name: "巴黎街區散步",
                                  anchor_mode: "regional",
                                  place_name: null,
                                  place_id: null,
                                  place_address: null,
                                  area_name: "Le Marais",
                                  search_query: "neighborhood walk design shops cafes",
                                  country_code: "FR",
                                  place_types: [],
                                  suggestion_count: 5,
                                  kind: "placeholder",
                                  arrival_time: "14:00",
                                  duration_min: 120,
                                  note: "保留街區探索選項。",
                                  attachments: [],
                                },
                              ],
                            },
                          ],
                          checklist: [],
                        },
                      }),
                    },
                  },
                ],
              },
            },
          ],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );

    const result = await runLumiTurn({
      prompt: "幫我建立 9/28 巴黎 Le Marais 街區散步",
      requestedSkill: "create-trip",
    });

    const stop = result.trip_draft?.days[0]?.stops?.[0];
    expect(stop).toMatchObject({
      anchor_mode: "regional",
      place_name: null,
      search_query: "neighborhood walk design shops cafes",
      place_types: [],
    });
  });

  test("accepts non-mappable checklist-like exact stops without place_name", async () => {
    env.OPENAI_API_KEY = "test-key";
    env.OPENAI_MODEL = "gpt-test";

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                tool_calls: [
                  {
                    id: "call_draft",
                    type: "function",
                    function: {
                      name: "lumi_response",
                      arguments: JSON.stringify({
                        summary: "已建立返程前整理日。",
                        days: null,
                        companions: null,
                        esim_suggestion: null,
                        trip_draft: {
                          title: "米蘭返程",
                          start_date: "2026-10-10",
                          end_date: "2026-10-10",
                          cover: null,
                          days: [
                            {
                              day_date: "2026-10-10",
                              city: "米蘭",
                              note: "返程前整理",
                              stops: [
                                {
                                  name: "整理行李",
                                  anchor_mode: "exact_place",
                                  place_name: null,
                                  place_id: null,
                                  place_address: null,
                                  area_name: null,
                                  search_query: null,
                                  country_code: "IT",
                                  place_types: [],
                                  suggestion_count: null,
                                  kind: "placeholder",
                                  arrival_time: "20:00",
                                  duration_min: 60,
                                  note: "整理返程物品。",
                                  attachments: [],
                                },
                              ],
                            },
                          ],
                          checklist: [],
                        },
                      }),
                    },
                  },
                ],
              },
            },
          ],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );

    const result = await runLumiTurn({
      prompt: "10/10 米蘭：最後購物，整理行李",
      requestedSkill: "create-trip",
    });

    expect(result.trip_draft?.days[0]?.stops?.[0]).toMatchObject({
      name: "整理行李",
      place_name: null,
    });
  });

  test("rejects concrete exact stops without a place_name", async () => {
    env.OPENAI_API_KEY = "test-key";
    env.OPENAI_MODEL = "gpt-test";

    const invalidResponse = () =>
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                tool_calls: [
                  {
                    id: "call_draft",
                    type: "function",
                    function: {
                      name: "lumi_response",
                      arguments: JSON.stringify({
                        summary: "已建立倫敦行程。",
                        days: null,
                        companions: null,
                        esim_suggestion: null,
                        trip_draft: {
                          title: "倫敦行程",
                          start_date: "2026-10-04",
                          end_date: "2026-10-04",
                          cover: null,
                          days: [
                            {
                              day_date: "2026-10-04",
                              city: "倫敦",
                              note: "經典倫敦",
                              stops: [
                                {
                                  name: "British Museum",
                                  anchor_mode: "exact_place",
                                  place_name: null,
                                  place_id: null,
                                  place_address: null,
                                  area_name: null,
                                  search_query: null,
                                  country_code: "GB",
                                  place_types: [],
                                  suggestion_count: null,
                                  kind: "sight",
                                  arrival_time: "10:00",
                                  duration_min: 120,
                                  note: "博物館參觀。",
                                  attachments: [],
                                },
                              ],
                            },
                          ],
                          checklist: [],
                        },
                      }),
                    },
                  },
                ],
              },
            },
          ],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    const fetchMock = vi.spyOn(globalThis, "fetch");
    for (let i = 0; i < 6; i++) {
      fetchMock.mockResolvedValueOnce(invalidResponse());
    }

    await expect(
      runLumiTurn({
        prompt: "10/4 British Museum",
        requestedSkill: "create-trip",
      }),
    ).rejects.toThrow("exact_place stop must provide place_name");
  });

  test("does not rewrite exact stops with free-text category heuristics", async () => {
    env.OPENAI_API_KEY = "test-key";
    env.OPENAI_MODEL = "gpt-test";

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                tool_calls: [
                  {
                    id: "call_draft",
                    type: "function",
                    function: {
                      name: "lumi_response",
                      arguments: JSON.stringify({
                        summary: "已建立測試行程。",
                        days: null,
                        companions: null,
                        esim_suggestion: null,
                        trip_draft: {
                          title: "測試行程",
                          start_date: "2026-09-27",
                          end_date: "2026-09-27",
                          cover: "米蘭",
                          days: [
                            {
                              day_date: "2026-09-27",
                              city: "米蘭",
                              cities: ["米蘭"],
                              segments: [
                                {
                                  city: "米蘭",
                                  start_part: "full_day",
                                  end_part: "full_day",
                                  note: "",
                                },
                              ],
                              note: "測試",
                              stops: [
                                {
                                  name: "設計選物店巡禮",
                                  anchor_mode: "exact_place",
                                  place_name: "Design Shops",
                                  place_id: null,
                                  place_address: null,
                                  area_name: null,
                                  search_query: null,
                                  country_code: "IT",
                                  place_types: [],
                                  suggestion_count: null,
                                  kind: "shop",
                                  arrival_time: null,
                                  duration_min: null,
                                  note: "",
                                  attachments: [],
                                },
                              ],
                            },
                          ],
                          checklist: [],
                        },
                      }),
                    },
                  },
                ],
              },
            },
          ],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );

    const result = await runLumiTurn({
      prompt: "建立測試行程",
      requestedSkill: "create-trip",
    });

    expect(result.trip_draft?.days[0]?.stops?.[0]).toMatchObject({
      name: "設計選物店巡禮",
      anchor_mode: "exact_place",
      place_name: "Design Shops",
    });
  });

  test("does not accept a sparse structured draft by fabricating blank days", async () => {
    env.OPENAI_API_KEY = "test-key";
    env.OPENAI_MODEL = "gpt-test";

    const fetchMock = vi.spyOn(globalThis, "fetch");
    fetchMock
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  tool_calls: [
                    {
                      id: "call_draft_1",
                      type: "function",
                      function: {
                        name: "lumi_response",
                        arguments: JSON.stringify({
                          summary: "已為您規劃好 17 天的歐洲行程。",
                          days: null,
                          companions: null,
                          esim_suggestion: null,
                          trip_draft: {
                            title: "歐洲 17 天行程",
                            start_date: "2026-09-25",
                            end_date: "2026-10-11",
                            cover: "歐洲",
                            days: [
                              {
                                day_date: "2026-09-25",
                                city: "米蘭",
                                note: "抵達日",
                                cities: ["米蘭"],
                                segments: [
                                  {
                                    city: "米蘭",
                                    start_part: "full_day",
                                    end_part: "full_day",
                                    note: "",
                                  },
                                ],
                                stops: [
                                  {
                                    name: "米蘭住宿",
                                    place_name: "Milano Centrale Railway Station",
                                    place_id: null,
                                    place_address: null,
                                    kind: "stay",
                                    arrival_time: null,
                                    duration_min: null,
                                    note: "",
                                    attachments: [],
                                  },
                                ],
                              },
                              {
                                day_date: "2026-09-27",
                                city: "",
                                cities: [],
                                segments: [],
                                note: "",
                                stops: [],
                              },
                            ],
                            checklist: [],
                          },
                        }),
                      },
                    },
                  ],
                },
              },
            ],
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  tool_calls: [
                    {
                      id: "call_draft_2",
                      type: "function",
                      function: {
                        name: "lumi_response",
                        arguments: JSON.stringify({
                          summary: "已補齊每個日期的行程。",
                          days: null,
                          companions: null,
                          esim_suggestion: null,
                          trip_draft: {
                            title: "歐洲 17 天行程",
                            start_date: "2026-09-25",
                            end_date: "2026-10-11",
                            cover: "歐洲",
                            days: [
                              {
                                day_date: "2026-09-27",
                                city: "米蘭",
                                note: "米蘭設計",
                                cities: ["米蘭"],
                                segments: [
                                  {
                                    city: "米蘭",
                                    start_part: "full_day",
                                    end_part: "full_day",
                                    note: "",
                                  },
                                ],
                                stops: [
                                  {
                                    name: "Milan Brera 區散步",
                                    place_name: "Pinacoteca di Brera",
                                    place_id: null,
                                    place_address: null,
                                    kind: "sight",
                                    arrival_time: null,
                                    duration_min: null,
                                    note: "",
                                    attachments: [],
                                  },
                                  {
                                    name: "10 Corso Como",
                                    place_name: "10 Corso Como",
                                    place_id: null,
                                    place_address: null,
                                    kind: "shop",
                                    arrival_time: null,
                                    duration_min: null,
                                    note: "",
                                    attachments: [],
                                  },
                                  {
                                    name: "晚餐 Navigli",
                                    place_name: "El Brellin",
                                    place_id: null,
                                    place_address: null,
                                    kind: "meal",
                                    arrival_time: null,
                                    duration_min: null,
                                    note: "",
                                    attachments: [],
                                  },
                                ],
                              },
                              {
                                day_date: "2026-10-04",
                                city: "倫敦",
                                note: "經典倫敦",
                                cities: ["倫敦"],
                                segments: [
                                  {
                                    city: "倫敦",
                                    start_part: "full_day",
                                    end_part: "full_day",
                                    note: "",
                                  },
                                ],
                                stops: [
                                  {
                                    name: "London British Museum",
                                    place_name: "British Museum",
                                    place_id: null,
                                    place_address: null,
                                    kind: "sight",
                                    arrival_time: null,
                                    duration_min: null,
                                    note: "",
                                    attachments: [],
                                  },
                                  {
                                    name: "Soho 書店巡禮",
                                    place_name: "Foyles",
                                    place_id: null,
                                    place_address: null,
                                    kind: "shop",
                                    arrival_time: null,
                                    duration_min: null,
                                    note: "",
                                    attachments: [],
                                  },
                                ],
                              },
                              {
                                day_date: "2026-10-09",
                                city: "倫敦",
                                note: "品牌觀察",
                                cities: ["倫敦"],
                                segments: [
                                  {
                                    city: "倫敦",
                                    start_part: "full_day",
                                    end_part: "full_day",
                                    note: "",
                                  },
                                ],
                                stops: [
                                  {
                                    name: "品牌與空間觀察日",
                                    place_name: "Design Museum",
                                    place_id: null,
                                    place_address: null,
                                    kind: "sight",
                                    arrival_time: null,
                                    duration_min: null,
                                    note: "",
                                    attachments: [],
                                  },
                                  {
                                    name: "Notting Hill",
                                    place_name: "Portobello Road Market",
                                    place_id: null,
                                    place_address: null,
                                    kind: "sight",
                                    arrival_time: null,
                                    duration_min: null,
                                    note: "",
                                    attachments: [],
                                  },
                                  {
                                    name: "Portobello Road Market",
                                    place_name: "Portobello Road Market",
                                    place_id: null,
                                    place_address: null,
                                    kind: "shop",
                                    arrival_time: null,
                                    duration_min: null,
                                    note: "",
                                    attachments: [],
                                  },
                                  {
                                    name: "Chelsea 區選物店與花藝店巡禮",
                                    place_name: "The Conran Shop Chelsea",
                                    place_id: null,
                                    place_address: null,
                                    kind: "shop",
                                    arrival_time: null,
                                    duration_min: null,
                                    note: "",
                                    attachments: [],
                                  },
                                ],
                              },
                              {
                                day_date: "2026-10-10",
                                city: "米蘭",
                                note: "飛往米蘭",
                                cities: ["倫敦", "米蘭"],
                                segments: [
                                  {
                                    city: "倫敦",
                                    start_part: "morning",
                                    end_part: "morning",
                                    note: "",
                                  },
                                  {
                                    city: "米蘭",
                                    start_part: "afternoon",
                                    end_part: "afternoon",
                                    note: "",
                                  },
                                ],
                                stops: [
                                  {
                                    name: "London → Milan",
                                    place_name: "Heathrow Airport",
                                    place_id: null,
                                    place_address: null,
                                    kind: "transit",
                                    arrival_time: null,
                                    duration_min: null,
                                    note: "",
                                    attachments: [],
                                  },
                                ],
                              },
                            ],
                            checklist: [],
                          },
                        }),
                      },
                    },
                  ],
                },
              },
            ],
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
      );

    fetchMock.mockRejectedValue(new Error("provider_called_again_for_incomplete_coverage"));

    await expect(runLumiTurn({
      prompt:
        "請依照我的行程筆記建立行程：9/27（Day 3）Milan Brera 區散步 • 10 Corso Como • 晚餐 Navigli —— 10/4（Day 10）London British Museum • Soho 書店巡禮 —— 10/9（Day 15）品牌與空間觀察日 • Notting Hill • Portobello Road Market • Chelsea 區選物店與花藝店巡禮 —— 🇮🇹 Milan｜1晚 10/10（Day 16）London → Milan",
      requestedSkill: "create-trip",
    })).rejects.toThrow("provider_called_again_for_incomplete_coverage");
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  test("forces draft-day staging after an incomplete final draft", async () => {
    env.OPENAI_API_KEY = "test-key";
    env.OPENAI_MODEL = "gpt-test";

    const day = (date: string, city: string, note: string) => ({
      day_date: date,
      city,
      cities: [city],
      segments: [
        {
          city,
          start_part: "full_day",
          end_part: "full_day",
          note: "",
        },
      ],
      note,
      stops: [],
    });

    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  tool_calls: [
                    {
                      id: "call_incomplete",
                      type: "function",
                      function: {
                        name: "lumi_response",
                        arguments: JSON.stringify({
                          summary: "已建立行程草稿。",
                          days: null,
                          companions: null,
                          flight_details: null,
                          esim_suggestion: null,
                          trip_draft: {
                            title: "歐洲行程",
                            start_date: "2026-09-25",
                            end_date: "2026-09-26",
                            cover: "歐洲",
                            days: [
                              day("2026-09-25", "台北", "出發"),
                              {
                                day_date: "2026-09-26",
                                city: "",
                                cities: [],
                                segments: [],
                                note: "",
                                stops: [],
                              },
                            ],
                            flight_details: null,
                            checklist: [],
                          },
                        }),
                      },
                    },
                  ],
                },
              },
            ],
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  tool_calls: [
                    {
                      id: "call_stage_days",
                      type: "function",
                      function: {
                        name: "stage_trip_draft_days",
                        arguments: JSON.stringify({
                          days: [
                            day("2026-09-25", "台北", "出發"),
                            day("2026-09-26", "米蘭", "抵達"),
                          ],
                        }),
                      },
                    },
                  ],
                },
              },
            ],
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  tool_calls: [
                    {
                      id: "call_final",
                      type: "function",
                      function: {
                        name: "lumi_response",
                        arguments: JSON.stringify({
                          summary: "已補齊每個日期的行程。",
                          days: null,
                          companions: null,
                          flight_details: null,
                          trip_draft: null,
                          esim_suggestion: null,
                        }),
                      },
                    },
                  ],
                },
              },
            ],
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
      );

    const result = await runLumiTurn({
      prompt:
        "請建立行程：9/25 台北 → 米蘭，9/26 抵達米蘭 Duomo 散步",
      requestedSkill: "create-trip",
    });

    expect(fetchMock).toHaveBeenCalledTimes(3);
    const secondRequest = JSON.parse(
      fetchMock.mock.calls[1]?.[1]?.body as string,
    ) as { tool_choice?: { function?: { name?: string } } };
    expect(secondRequest.tool_choice?.function?.name).toBe(
      "stage_trip_draft_days",
    );
    expect(result.trip_draft?.days.map((draftDay) => draftDay.day_date)).toEqual([
      "2026-09-25",
      "2026-09-26",
    ]);
  });

  test("does not recover missing draft days or notes from the raw prompt", async () => {
    env.OPENAI_API_KEY = "test-key";
    env.OPENAI_MODEL = "gpt-test";

    const day = (date: string, city: string, note: string) => ({
      day_date: date,
      city,
      cities: city ? [city] : [],
      segments: [],
      note,
      stops: [],
    });

    const responseFor = (toolName: "lumi_response" | "stage_trip_draft_days") =>
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                tool_calls: [
                  {
                    id: `call_${toolName}`,
                    type: "function",
                    function: {
                      name: toolName,
                      arguments: JSON.stringify(
                        toolName === "stage_trip_draft_days"
                          ? { days: [day("2026-09-27", "", "")] }
                          : {
                              summary: "已建立行程草稿。",
                              days: null,
                              companions: null,
                              flight_details: null,
                              trip_draft: null,
                              esim_suggestion: null,
                            },
                      ),
                    },
                  },
                ],
              },
            },
          ],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );

    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(
      async (_url, init) => {
        const request = JSON.parse(init?.body as string) as {
          tool_choice?: { function?: { name?: string } };
        };
        return responseFor(
          request.tool_choice?.function?.name === "stage_trip_draft_days"
            ? "stage_trip_draft_days"
            : "lumi_response",
        );
      },
    );

    await expect(
      runLumiTurn({
        prompt:
          "請依照我的行程筆記建立行程：9/27（Day 1）抵達米蘭 —— 9/28（Day 2）London British Museum —— 9/29（Day 3）品牌與空間觀察日",
        requestedSkill: "create-trip",
      }),
    ).rejects.toThrow("incomplete_structured_draft");
    expect(fetchMock).toHaveBeenCalledTimes(6);
    const finalRequest = JSON.parse(
      fetchMock.mock.calls.at(-1)?.[1]?.body as string,
    ) as { tool_choice?: { function?: { name?: string } } };
    expect(finalRequest.tool_choice?.function?.name).toBe("lumi_response");
    const retryRequests = fetchMock.mock.calls.slice(1).map((call) =>
      JSON.parse(call[1]?.body as string) as {
        messages?: Array<{ content?: string }>;
      },
    );
    expect(
      retryRequests.every((request) =>
        request.messages?.some((message) =>
          message.content?.includes("incomplete_structured_draft"),
        ),
      ),
    ).toBe(true);
  });

  test("rejects plain-text create-trip exhaustion as incomplete structured draft", async () => {
    env.OPENAI_API_KEY = "test-key";
    env.OPENAI_MODEL = "gpt-test";

    const toolResponse = (
      toolName: "lumi_response" | "stage_trip_draft_days",
    ) =>
      new Response(
        JSON.stringify({
          choices: [{
            message: {
              tool_calls: [{
                id: `call_${toolName}`,
                type: "function",
                function: {
                  name: toolName,
                  arguments: JSON.stringify(
                    toolName === "stage_trip_draft_days"
                      ? {
                          days: [{
                            day_date: "2026-09-27",
                            city: "",
                            cities: [],
                            segments: [],
                            note: "",
                            stops: [],
                          }],
                        }
                      : {
                          summary: "I still need trip details.",
                          days: null,
                          companions: null,
                          flight_details: null,
                          trip_draft: null,
                          esim_suggestion: null,
                        },
                  ),
                },
              }],
            },
          }],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );

    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(
      async (_url, init) => {
        const request = JSON.parse(init?.body as string) as {
          tool_choice?: { function?: { name?: string } };
        };
        const forcedTool = request.tool_choice?.function?.name;
        if (forcedTool === "stage_trip_draft_days") {
          return toolResponse("stage_trip_draft_days");
        }
        if (forcedTool === "lumi_response") {
          return toolResponse("lumi_response");
        }
        return new Response(
          JSON.stringify({
            choices: [{ message: { content: "I still need trip details." } }],
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      },
    );

    await expect(
      runLumiTurn({
        prompt: "Create a trip for 9/27.",
        requestedSkill: "create-trip",
      }),
    ).rejects.toThrow("incomplete_structured_draft");
    expect(fetchMock).toHaveBeenCalledTimes(6);
    const finalRequest = JSON.parse(
      fetchMock.mock.calls.at(-1)?.[1]?.body as string,
    ) as { tool_choice?: { function?: { name?: string } } };
    expect(finalRequest.tool_choice?.function?.name).toBe("lumi_response");
  });

  test("rejects invalid staged draft anchors before storing them", async () => {
    env.OPENAI_API_KEY = "test-key";
    env.OPENAI_MODEL = "gpt-test";

    const invalidDay = {
      day_date: "2026-10-01",
      city: "巴黎",
      cities: ["巴黎"],
      segments: [
        {
          city: "巴黎",
          start_part: "full_day",
          end_part: "full_day",
          note: "",
        },
      ],
      note: "藝術書店",
      stops: [
        {
          name: "藝術書店",
          anchor_mode: "exact_place",
          place_name: null,
          place_id: null,
          place_address: null,
          area_name: null,
          search_query: null,
          country_code: "FR",
          place_types: [],
          suggestion_count: null,
          kind: "shop",
          arrival_time: null,
          duration_min: null,
          note: "",
          attachments: [],
        },
      ],
    };
    const validDay = {
      ...invalidDay,
      stops: [
        {
          ...invalidDay.stops[0]!,
          anchor_mode: "regional",
          place_name: null,
          area_name: "Paris",
          search_query: "art bookshop Paris",
          place_types: ["book_store", "store"],
        },
      ],
    };

    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  tool_calls: [
                    {
                      id: "call_invalid_stage",
                      type: "function",
                      function: {
                        name: "stage_trip_draft_days",
                        arguments: JSON.stringify({ days: [invalidDay] }),
                      },
                    },
                  ],
                },
              },
            ],
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  tool_calls: [
                    {
                      id: "call_valid_stage",
                      type: "function",
                      function: {
                        name: "stage_trip_draft_days",
                        arguments: JSON.stringify({ days: [validDay] }),
                      },
                    },
                  ],
                },
              },
            ],
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  tool_calls: [
                    {
                      id: "call_final",
                      type: "function",
                      function: {
                        name: "lumi_response",
                        arguments: JSON.stringify({
                          summary: "已建立巴黎行程。",
                          days: null,
                          companions: null,
                          flight_details: null,
                          trip_draft: null,
                          esim_suggestion: null,
                        }),
                      },
                    },
                  ],
                },
              },
            ],
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
      );

    const result = await runLumiTurn({
      prompt: "10/1 巴黎藝術書店",
      requestedSkill: "create-trip",
    });

    const firstToolResult = JSON.parse(
      (
        JSON.parse(fetchMock.mock.calls[1]?.[1]?.body as string) as {
          messages: Array<{ role: string; content?: string }>;
        }
      ).messages.find((message) => message.role === "tool")?.content ?? "{}",
    ) as { ok?: boolean; error?: string };
    expect(firstToolResult).toMatchObject({
      ok: false,
      error: "invalid_stop_anchors",
    });
    expect(result.trip_draft?.days[0]?.stops?.[0]).toMatchObject({
      anchor_mode: "regional",
      search_query: "art bookshop Paris",
    });
  });

  test("retries an empty structured day before accepting flight-day city segments", async () => {
    env.OPENAI_API_KEY = "test-key";
    env.OPENAI_MODEL = "gpt-test";

    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  tool_calls: [
                    {
                      id: "call_draft_1",
                      type: "function",
                      function: {
                        name: "lumi_response",
                        arguments: JSON.stringify({
                          summary: "已建立歐洲行程。",
                          days: null,
                          companions: null,
                          esim_suggestion: null,
                          trip_draft: {
                            title: "歐洲 17 天行程",
                            start_date: "2026-09-26",
                            end_date: "2026-09-28",
                            cover: "歐洲",
                            days: [
                              {
                                day_date: "2026-09-27",
                                city: "巴黎",
                                note: "巴黎 · 設計選物店巡禮",
                                cities: ["巴黎"],
                                segments: [
                                  {
                                    city: "巴黎",
                                    start_part: "full_day",
                                    end_part: "full_day",
                                    note: "",
                                  },
                                ],
                                stops: [
                                  {
                                    name: "設計選物店巡禮",
                                    place_name: "Merci",
                                    place_id: null,
                                    place_address: null,
                                    kind: "shop",
                                    arrival_time: null,
                                    duration_min: null,
                                    note: "",
                                    attachments: [],
                                  },
                                  {
                                    name: "家具品牌展示空間",
                                    place_name: "Ligne Roset",
                                    place_id: null,
                                    place_address: null,
                                    kind: "shop",
                                    arrival_time: null,
                                    duration_min: null,
                                    note: "",
                                    attachments: [],
                                  },
                                ],
                              },
                              {
                                day_date: "2026-09-28",
                                city: "",
                                cities: [],
                                segments: [],
                                note: "",
                                stops: [],
                              },
                            ],
                            checklist: [],
                          },
                        }),
                      },
                    },
                  ],
                },
              },
            ],
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  tool_calls: [
                    {
                      id: "call_draft_2",
                      type: "function",
                      function: {
                        name: "lumi_response",
                        arguments: JSON.stringify({
                          summary: "已建立完整歐洲行程。",
                          days: null,
                          companions: null,
                          esim_suggestion: null,
                          trip_draft: {
                            title: "歐洲 17 天行程",
                            start_date: "2026-09-26",
                            end_date: "2026-09-28",
                            cover: "歐洲",
                            days: [
                              {
                                day_date: "2026-09-26",
                                city: "米蘭",
                                note: "米蘭經典",
                                cities: ["米蘭"],
                                segments: [
                                  {
                                    city: "米蘭",
                                    start_part: "full_day",
                                    end_part: "full_day",
                                    note: "",
                                  },
                                ],
                                stops: [
                                  {
                                    name: "Duomo di Milano",
                                    place_name: "Duomo di Milano",
                                    place_id: null,
                                    place_address: null,
                                    kind: "sight",
                                    arrival_time: null,
                                    duration_min: null,
                                    note: "",
                                    attachments: [],
                                  },
                                  {
                                    name: "Galleria Vittorio Emanuele II",
                                    place_name: "Galleria Vittorio Emanuele II",
                                    place_id: null,
                                    place_address: null,
                                    kind: "sight",
                                    arrival_time: null,
                                    duration_min: null,
                                    note: "",
                                    attachments: [],
                                  },
                                ],
                              },
                              {
                                day_date: "2026-09-27",
                                city: "米蘭",
                                note: "米蘭設計",
                                cities: ["米蘭", "巴黎"],
                                segments: [
                                  {
                                    city: "米蘭",
                                    start_part: "morning",
                                    end_part: "morning",
                                    note: "",
                                  },
                                  {
                                    city: "巴黎",
                                    start_part: "evening",
                                    end_part: "evening",
                                    note: "",
                                  },
                                ],
                                stops: [
                                  {
                                    name: "設計選物店巡禮",
                                    place_name: "10 Corso Como",
                                    place_id: null,
                                    place_address: null,
                                    kind: "shop",
                                    arrival_time: null,
                                    duration_min: null,
                                    note: "",
                                    attachments: [],
                                  },
                                  {
                                    name: "家具品牌展示空間",
                                    place_name: "Cassina Milano Durini",
                                    place_id: null,
                                    place_address: null,
                                    kind: "shop",
                                    arrival_time: null,
                                    duration_min: null,
                                    note: "",
                                    attachments: [],
                                  },
                                  {
                                    name: "藝廊散步",
                                    place_name: "Fondazione Prada",
                                    place_id: null,
                                    place_address: null,
                                    kind: "sight",
                                    arrival_time: null,
                                    duration_min: null,
                                    note: "",
                                    attachments: [],
                                  },
                                  {
                                    name: "晚上飛巴黎",
                                    place_name: "Milan Malpensa Airport",
                                    place_id: null,
                                    place_address: null,
                                    kind: "transit",
                                    arrival_time: null,
                                    duration_min: 120,
                                    note: "",
                                    attachments: [],
                                  },
                                ],
                              },
                              {
                                day_date: "2026-09-28",
                                city: "巴黎",
                                note: "Le Marais",
                                cities: ["巴黎"],
                                segments: [
                                  {
                                    city: "巴黎",
                                    start_part: "full_day",
                                    end_part: "full_day",
                                    note: "",
                                  },
                                ],
                                stops: [
                                  {
                                    name: "Le Marais",
                                    place_name: "Place des Vosges",
                                    place_id: null,
                                    place_address: null,
                                    kind: "sight",
                                    arrival_time: null,
                                    duration_min: null,
                                    note: "",
                                    attachments: [],
                                  },
                                  {
                                    name: "Merci",
                                    place_name: "Merci",
                                    place_id: null,
                                    place_address: null,
                                    kind: "shop",
                                    arrival_time: null,
                                    duration_min: null,
                                    note: "",
                                    attachments: [],
                                  },
                                ],
                              },
                            ],
                            checklist: [],
                          },
                        }),
                      },
                    },
                  ],
                },
              },
            ],
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
      );

    const result = await runLumiTurn({
      prompt:
        "🇮🇹 Milan｜2晚\n\n9/26（Day 1）\n • Duomo di Milano\n • Galleria Vittorio Emanuele II\n\n9/27（Day 2）\n • 設計選物店巡禮\n • 家具品牌展示空間\n • 藝廊散步\n • 晚上飛巴黎\n\n🇫🇷 Paris｜4晚\n\n9/28（Day 3）\n • Le Marais\n • Merci",
      requestedSkill: "create-trip",
    });

    const day = result.trip_draft?.days.find(
      (candidate) => candidate.day_date === "2026-09-27",
    );
    expect(day?.city).toBe("米蘭");
    expect((day as { cities?: string[] } | undefined)?.cities).toEqual([
      "米蘭",
      "巴黎",
    ]);
    expect(day?.note).toBe("米蘭設計");
    expect(day?.stops?.map((stop) => stop.name)).toEqual([
      "設計選物店巡禮",
      "家具品牌展示空間",
      "藝廊散步",
      "晚上飛巴黎",
    ]);
    expect(day?.stops?.map((stop) => stop.place_name)).toEqual([
      "10 Corso Como",
      "Cassina Milano Durini",
      "Fondazione Prada",
      "Milan Malpensa Airport",
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  test("prompts Lumi to emit structured flight routes with city segments", async () => {
    env.OPENAI_API_KEY = "test-key";
    env.OPENAI_MODEL = "gpt-test";

    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                tool_calls: [
                  {
                    id: "call_draft",
                    type: "function",
                    function: {
                      name: "lumi_response",
                      arguments: JSON.stringify({
                        summary: "已建立歐洲行程。",
                        days: null,
                        companions: null,
                        esim_suggestion: null,
                        trip_draft: {
                          title: "歐洲行程",
                          start_date: "2026-09-25",
                          end_date: "2026-09-25",
                          cover: "米蘭",
                          days: [
                            {
                              day_date: "2026-09-25",
                              city: "台北",
                              cities: ["台北", "米蘭"],
                              segments: [
                                {
                                  city: "台北",
                                  start_part: "morning",
                                  end_part: "morning",
                                  note: "從住家出發",
                                },
                                {
                                  city: "米蘭",
                                  start_part: "evening",
                                  end_part: "evening",
                                  note: "抵達米蘭",
                                },
                              ],
                              note: "台北出發前往米蘭",
                              stops: [
                                {
                                  name: "前往桃園機場",
                                  anchor_mode: "exact_place",
                                  place_name:
                                    "Taiwan Taoyuan International Airport",
                                  kind: "transit",
                                  arrival_time: "20:00",
                                  duration_min: 120,
                                  note: "預留報到、托運、安檢與登機時間。",
                                },
                                {
                                  name: "抵達米蘭機場",
                                  anchor_mode: "exact_place",
                                  place_name: "Milan Malpensa Airport",
                                  kind: "transit",
                                  arrival_time: null,
                                  duration_min: 45,
                                  note: "下機與領取行李緩衝。",
                                },
                              ],
                            },
                          ],
                          checklist: [],
                        },
                      }),
                    },
                  },
                ],
              },
            },
          ],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );

    await runLumiTurn({
      prompt: "9/25\n • 台北 → 米蘭（夜宿機上）",
      requestedSkill: "create-trip",
    });

    const request = JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string) as {
      messages: Array<{ role: string; content: string }>;
    };
    const systemPrompt = request.messages[0]?.content ?? "";
    expect(systemPrompt).toContain("Taiwan Taoyuan International Airport");
    expect(systemPrompt).toContain("day.segments");
    expect(systemPrompt).toContain("Airports are never day.city");
    expect(systemPrompt).toContain("must only appear in stops");
    expect(systemPrompt).toContain("city:\"台北\"");
    expect(systemPrompt).toContain("cities:[\"台北\",\"米蘭\"]");
    expect(systemPrompt).toContain("Never encode a flight only in day.note");
    expect(systemPrompt).toContain("Route lines are not activity labels");
    expect(systemPrompt).toContain("both non-airport cities in day.cities and day.segments");
    expect(systemPrompt).toContain("Never encode a flight only in day.note");
    expect(systemPrompt).toContain("Keep day.note extremely short");
    expect(systemPrompt).toContain("Write it as a label, not a sentence");
    expect(systemPrompt).toContain("Put details in stops[].note or segment.note instead");
  });

});

describe("buildPlanningContract", () => {
  test("adds an editor action-selection contract for current-trip chat", () => {
    const contract = buildPlanningContract({
      prompt: "幫我簡單規劃每一天 2~3 個行程加上一個餐廳",
      requestedSkill: "plan-trip",
      editableTrip: {
        trip_id: TEST_TRIP_ID,
        title: "台北到米蘭",
        start_date: "2026-09-25",
        end_date: "2026-09-27",
        days: [
          editableDay("2026-09-25", "米蘭"),
          editableDay("2026-09-26", "米蘭"),
          editableDay("2026-09-27", "米蘭"),
        ],
        cities: [],
        companions: [],
      },
    });

    expect(contract).toContain("Decide the action from the object");
    expect(contract).toContain("call update_trip_day");
    expect(contract).toContain("call create_trip_day");
    expect(contract).toContain("All itinerary edits must be staged through update_trip_day");
    expect(contract).toContain("call set_flight_details");
    expect(contract).toContain("2026-09-25, 2026-09-26, 2026-09-27");
    expect(contract).toContain("Do not ask which trip or which day");
    expect(contract).toContain("Do not emit trip_draft");
    expect(contract).toContain("Only claim you updated the whole trip");
  });

  test("keeps default current-trip chat out of the mutation contract", () => {
    const contract = buildPlanningContract({
      prompt: "幫我簡單規劃每一天 2~3 個行程加上一個餐廳",
      editableTrip: {
        trip_id: TEST_TRIP_ID,
        title: "台北到米蘭",
        start_date: "2026-09-25",
        end_date: "2026-09-27",
        days: [
          editableDay("2026-09-25", "米蘭"),
        ],
        cities: [],
        companions: [],
      },
    });

    expect(contract).toBeNull();
  });
});

describe("selectSkillIdsForTurn", () => {
  test("honors create-trip skill outside an editable trip", () => {
    expect(
      selectSkillIdsForTurn({
        prompt: "這是我的機票，幫我建立行程",
        requestedSkill: "create-trip",
      }),
    ).toContain("trip-drafter");
  });

  test("create-trip skill selection does not depend on ticket or reservation words", () => {
    const manuscript =
      "這是我的規劃文字稿，幫我建立行程：9/27 米蘭 Brera 區散步、晚餐 Navigli；9/28 Paris Le Marais；9/29 Musée d'Orsay；10/4 London British Museum；機票和餐廳訂位晚點再補。";

    expect(
      selectSkillIdsForTurn({
        prompt: manuscript,
        requestedSkill: "create-trip",
      }),
    ).toEqual(
      expect.arrayContaining([
        "trip-drafter",
        "itinerary-stops",
        "placeholder-planning",
      ]),
    );
    expect(
      selectSkillIdsForTurn({
        prompt: manuscript,
        requestedSkill: "create-trip",
      }),
    ).not.toContain("attachments");
  });

  test("loads flight-route rules from explicit create-trip mode, not text matching", () => {
    expect(
      selectSkillIdsForTurn({
        prompt: "完全沒有航班字眼的旅行需求",
        requestedSkill: "create-trip",
      }),
    ).toContain("flight-route");
  });

  test("does not load current-trip action rules without an explicit mode", () => {
    const manuscript =
      "9/27 (Day 2) Milan Brera 區散步，晚餐 Navigli；9/28 (Day 3) Paris Le Marais；9/29 (Day 4) Musée d'Orsay；10/4 (Day 9) London British Museum；機票和餐廳訂位晚點再補。";
    const ids = selectSkillIdsForTurn({
      prompt: manuscript,
      editableTrip: {
        trip_id: TEST_TRIP_ID,
        title: "Europe design trip",
        start_date: "2026-09-26",
        end_date: "2026-10-11",
        days: [
          editableDay("2026-09-26", "米蘭"),
          editableDay("2026-09-27", "米蘭"),
          editableDay("2026-09-28", "巴黎"),
        ],
        cities: [],
        companions: [],
      },
    });

    expect(ids).toEqual(["system-position"]);
    expect(ids).not.toContain("trip-drafter");
  });

  test("honors edit-trip skill on an editable trip", () => {
    expect(
      selectSkillIdsForTurn({
        prompt: "把第二天排順一點",
        requestedSkill: "edit-trip",
        editableTrip: {
          trip_id: TEST_TRIP_ID,
          title: "台北到米蘭",
          start_date: "2026-09-25",
          end_date: "2026-09-26",
          days: [
            editableDay("2026-09-25", "米蘭"),
          ],
          cities: [],
          companions: [],
        },
      }),
    ).toEqual(expect.arrayContaining(["trip-editor", "itinerary-stops"]));
  });

  test("keeps inspiration skill in answer-only mode", () => {
    expect(
      selectSkillIdsForTurn({
        prompt: "給我一些秋天旅行靈感",
        requestedSkill: "inspiration",
      }),
    ).not.toContain("trip-drafter");
  });

  test("keeps off-trip unspecified edits out of draft mode", () => {
    const ids = selectSkillIdsForTurn({
      prompt: "幫我把 BR95 的機票資訊存到我的米蘭行程",
    });

    expect(ids).toContain("system-position");
    expect(ids).not.toContain("trip-drafter");
  });
});

describe("buildLumiToolDefinitions", () => {
  const editableTripSnapshot = {
    trip_id: TEST_TRIP_ID,
    title: "Europe design trip",
    start_date: "2026-09-25",
    end_date: "2026-10-11",
    days: [editableDay("2026-09-25", "台北")],
    cities: [],
    companions: [],
  };

  test("aligns create-trip flight guidance with advertised tools", async () => {
    env.OPENAI_API_KEY = "test-key";
    env.OPENAI_MODEL = "gpt-test";
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          choices: [{
            message: {
              tool_calls: [{
                id: "call_final",
                type: "function",
                function: {
                  name: "lumi_response",
                  arguments: JSON.stringify({
                    summary: "Tell me the destination and dates.",
                    days: null,
                    companions: null,
                    flight_details: null,
                    trip_draft: {
                      title: "Flight trip",
                      start_date: "2026-09-27",
                      end_date: "2026-09-27",
                      cover: null,
                      days: [{
                        day_date: "2026-09-27",
                        city: "Tokyo",
                        cities: ["Tokyo"],
                        segments: [],
                        note: "Flight day",
                        stops: [],
                      }],
                      flight_details: null,
                      checklist: [],
                    },
                    esim_suggestion: null,
                  }),
                },
              }],
            },
          }],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );

    await runLumiTurn({
      prompt: "Create a trip from my flight ticket.",
      requestedSkill: "create-trip",
    });

    const request = JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string) as {
      messages: Array<{ role: string; content: string }>;
      tools: Array<{ function: { name: string } }>;
    };
    const systemPrompt = request.messages
      .filter((message) => message.role === "system")
      .map((message) => message.content)
      .join("\n");
    expect(request.tools.map((tool) => tool.function.name)).not.toContain(
      "set_flight_details",
    );
    expect(systemPrompt).toContain(
      "put those facts directly in trip_draft.flight_details",
    );
    expect(systemPrompt).not.toContain("call set_flight_details");

    const editFlightTools = buildLumiToolDefinitions({
      prompt: "Save these flight details.",
      requestedSkill: "edit-trip",
      editableTrip: editableTripSnapshot,
    }).map((tool) => tool.function.name);
    expect(editFlightTools).toContain("create_flight_leg");
    expect(editFlightTools).toContain("update_flight_leg");
    expect(editFlightTools).not.toContain("set_flight_details");
  });

  test("unscoped current-trip chat exposes no mutation tools", () => {
    const names = buildLumiToolDefinitions({
      prompt: "change the second day",
      editableTrip: editableTripSnapshot,
    }).map((tool) => tool.function.name);

    expect(names).not.toContain("update_trip_day");
    expect(names).not.toContain("create_trip_day");
    expect(names).not.toContain("upsert_stop_attachment");
  });

  test("current-trip mutation tools require exact persisted IDs", () => {
    const tools = buildLumiToolDefinitions({
      prompt: "update this trip and attach my ticket",
      requestedSkill: "edit-trip",
      editableTrip: editableTripSnapshot,
    });
    const requiredFor = (name: string) => {
      const tool = tools.find((candidate) => candidate.function.name === name);
      expect(tool, `${name} should be advertised`).toBeDefined();
      return (tool!.function.parameters as { required: string[] }).required;
    };

    expect(requiredFor("update_trip_day")).toContain("day_id");
    expect(requiredFor("create_trip_day")).toContain("trip_id");
    expect(requiredFor("upsert_stop_attachment")).toContain("stop_id");
  });

  test("day mutation tools do not accept inline attachment edits", () => {
    const tools = buildLumiToolDefinitions({
      prompt: "update this trip and attach my ticket",
      requestedSkill: "edit-trip",
      editableTrip: editableTripSnapshot,
    });
    const attachmentLimitFor = (name: string) => {
      const tool = tools.find((candidate) => candidate.function.name === name);
      expect(tool, `${name} should be advertised`).toBeDefined();
      const parameters = tool!.function.parameters as {
        properties: {
          day: {
            properties: {
              stops: {
                items: {
                  properties: { attachments: { maxItems?: number } };
                };
              };
            };
          };
        };
      };
      return parameters.properties.day.properties.stops.items.properties
        .attachments.maxItems;
    };

    expect(attachmentLimitFor("update_trip_day")).toBe(0);
    expect(attachmentLimitFor("create_trip_day")).toBe(0);
  });

  test("keeps default current-trip chat tools read-only", () => {
    const tools = buildLumiToolDefinitions({
      prompt: "票號和航班資料貼在這裡",
      editableTrip: {
        trip_id: TEST_TRIP_ID,
        title: "Europe design trip",
        start_date: "2026-09-25",
        end_date: "2026-10-11",
        days: [
          editableDay("2026-09-25", "台北"),
          editableDay("2026-10-11", "米蘭"),
        ],
        cities: [],
        companions: [],
      },
    });
    const names = tools.map((tool) => tool.function.name);

    expect(names).not.toContain("update_trip_day");
    expect(names).not.toContain("create_trip_day");
    expect(names).not.toContain("set_trip_days");
    expect(names).not.toContain("set_flight_details");
  });

  test("exposes all current-trip tools in explicit planning mode too", () => {
    const tools = buildLumiToolDefinitions({
      prompt: "幫我重排",
      requestedSkill: "plan-trip",
      editableTrip: {
        trip_id: TEST_TRIP_ID,
        title: "Europe design trip",
        start_date: "2026-09-25",
        end_date: "2026-10-11",
        days: [editableDay("2026-09-25", "台北")],
        cities: [],
        companions: [],
      },
    });
    const names = tools.map((tool) => tool.function.name);

    expect(names).toContain("update_trip_day");
    expect(names).toContain("create_trip_day");
    expect(names).not.toContain("set_trip_days");
    expect(names).not.toContain("set_flight_details");
  });

  test("exposes flight saving in editable current-trip chat", () => {
    const tools = buildLumiToolDefinitions({
      prompt: "這是航班資料",
      requestedSkill: "edit-trip",
      editableTrip: {
        trip_id: TEST_TRIP_ID,
        title: "Europe design trip",
        start_date: "2026-09-25",
        end_date: "2026-10-11",
        days: [editableDay("2026-09-25", "台北")],
        cities: [],
        companions: [],
      },
    });
    const names = tools.map((tool) => tool.function.name);

    expect(names).toContain("create_flight_leg");
    expect(names).toContain("update_flight_leg");
    expect(names).not.toContain("set_flight_details");
  });
});

describe("capability enforcement", () => {
  const editableTrip = {
    trip_id: TEST_TRIP_ID,
    title: "Europe design trip",
    start_date: "2026-09-25",
    end_date: "2026-09-25",
    days: [editableDay("2026-09-25", "米蘭")],
    cities: [],
    companions: [],
  };

  test("sanitizes unscoped companion mutations from the final response", async () => {
    env.OPENAI_API_KEY = "test-key";
    env.OPENAI_MODEL = "gpt-test";
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          choices: [{
            message: {
              tool_calls: [{
                id: "call_final",
                type: "function",
                function: {
                  name: "lumi_response",
                  arguments: JSON.stringify({
                    summary: "Added a companion.",
                    days: null,
                    companions: [{
                      id: null,
                      display_name: "Mallory",
                      color: "#ffffff",
                      delete: null,
                    }],
                    flight_details: null,
                    trip_draft: null,
                    esim_suggestion: null,
                  }),
                },
              }],
            },
          }],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );

    const result = await runLumiTurn({
      prompt: "Tell me about this trip",
      editableTrip,
    });

    expect(result.companions).toBeUndefined();
  });

  test("sanitizes unscoped flight mutations from the final response", async () => {
    env.OPENAI_API_KEY = "test-key";
    env.OPENAI_MODEL = "gpt-test";
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          choices: [{
            message: {
              tool_calls: [{
                id: "call_final",
                type: "function",
                function: {
                  name: "lumi_response",
                  arguments: JSON.stringify({
                    summary: "Saved a flight.",
                    days: null,
                    companions: null,
                    flight_details: [{
                      leg_key: "outbound",
                      departure_date: "2026-09-25",
                      departure_time: "10:00",
                      flight_number: "BR88",
                      terminal: null,
                      gate: null,
                    }],
                    trip_draft: null,
                    esim_suggestion: null,
                  }),
                },
              }],
            },
          }],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );

    const result = await runLumiTurn({
      prompt: "Tell me about this trip",
      editableTrip,
    });

    expect(result.flight_details).toBeUndefined();
  });

  test("rejects an unadvertised action tool call before staging", async () => {
    env.OPENAI_API_KEY = "test-key";
    env.OPENAI_MODEL = "gpt-test";
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            choices: [{
              message: {
                tool_calls: [{
                  id: "call_flight",
                  type: "function",
                  function: {
                    name: "set_flight_details",
                    arguments: JSON.stringify({
                      flight_details: [{
                        leg_key: "outbound",
                        departure_date: "2026-09-25",
                        departure_time: null,
                        flight_number: "BR88",
                        terminal: null,
                        gate: null,
                      }],
                    }),
                  },
                }],
              },
            }],
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            choices: [{
              message: {
                tool_calls: [{
                  id: "call_final",
                  type: "function",
                  function: {
                    name: "lumi_response",
                    arguments: JSON.stringify({
                      summary: "No changes made.",
                      days: null,
                      companions: null,
                      flight_details: null,
                      trip_draft: null,
                      esim_suggestion: null,
                    }),
                  },
                }],
              },
            }],
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
      );

    const result = await runLumiTurn({
      prompt: "Tell me about this trip",
      editableTrip,
    });
    const secondRequest = JSON.parse(
      fetchMock.mock.calls[1]?.[1]?.body as string,
    ) as { messages: Array<{ role: string; content?: string }> };
    const toolMessage = secondRequest.messages.find(
      (message) => message.role === "tool",
    );

    expect(toolMessage?.content).toContain('"error":"unauthorized_tool"');
    expect(result.flight_details).toBeUndefined();
  });

  test("rejects plan-trip day attachments before staging", async () => {
    env.OPENAI_API_KEY = "test-key";
    env.OPENAI_MODEL = "gpt-test";
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            choices: [{
              message: {
                tool_calls: [{
                  id: "call_day",
                  type: "function",
                  function: {
                    name: "update_trip_day",
                    arguments: JSON.stringify({
                      day_id: editableDay("2026-09-25", "米蘭").day_id,
                      day: {
                        day_date: "2026-09-25",
                        city: "米蘭",
                        cities: ["米蘭"],
                        segments: [],
                        note: "Keep the day",
                        stops: [{
                          name: "Duomo",
                          place_name: "Duomo di Milano",
                          kind: "sight",
                          note: "Visit",
                          attachments: [{
                            type: "ticket",
                            label: "Injected ticket",
                            status: "required",
                          }],
                        }],
                      },
                    }),
                  },
                }],
              },
            }],
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            choices: [{
              message: {
                tool_calls: [{
                  id: "call_final",
                  type: "function",
                  function: {
                    name: "lumi_response",
                    arguments: JSON.stringify({
                      summary: "Attachment not saved.",
                      days: null,
                      companions: null,
                      flight_details: null,
                      trip_draft: null,
                      esim_suggestion: null,
                    }),
                  },
                }],
              },
            }],
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
      );

    const result = await runLumiTurn({
      prompt: "Plan this day",
      requestedSkill: "plan-trip",
      editableTrip,
    });
    const secondRequest = JSON.parse(
      fetchMock.mock.calls[1]?.[1]?.body as string,
    ) as { messages: Array<{ role: string; content?: string }> };
    const toolMessage = secondRequest.messages.find(
      (message) => message.role === "tool",
    );

    expect(JSON.parse(toolMessage?.content ?? "{}")).toMatchObject({
      ok: false,
      code: "unauthorized_command",
      field: "day.stops",
      message: expect.any(String),
    });
    expect(result.days).toBeUndefined();
  });

  test("preserves existing attachments by exact place identity in plan mode", async () => {
    env.OPENAI_API_KEY = "test-key";
    env.OPENAI_MODEL = "gpt-test";
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            choices: [{
              message: {
                tool_calls: [{
                  id: "call_day",
                  type: "function",
                  function: {
                    name: "update_trip_day",
                    arguments: JSON.stringify({
                      day_id: editableDay("2026-09-25", "米蘭").day_id,
                      day: {
                        day_date: "2026-09-25",
                        city: "米蘭",
                        cities: ["米蘭"],
                        segments: [],
                        note: "Updated plan",
                        stops: [{
                          stop_id: "00000000-0000-4000-8000-000000000101",
                          name: "Duomo",
                          place_name: "Duomo di Milano",
                          place_id: "places/duomo",
                          kind: "sight",
                          note: "Visit in the morning",
                          attachments: [],
                        }],
                      },
                    }),
                  },
                }],
              },
            }],
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            choices: [{
              message: {
                tool_calls: [{
                  id: "call_final",
                  type: "function",
                  function: {
                    name: "lumi_response",
                    arguments: JSON.stringify({
                      summary: "Updated without changing the ticket.",
                      days: null,
                      companions: null,
                      flight_details: null,
                      trip_draft: null,
                      esim_suggestion: null,
                    }),
                  },
                }],
              },
            }],
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
      );

    const result = await runLumiTurn({
      prompt: "Reorder this day",
      requestedSkill: "plan-trip",
      editableTrip: {
        ...editableTrip,
        days: [{
          day_id: editableDay("2026-09-25", "米蘭").day_id,
          day_date: "2026-09-25",
          city: "米蘭",
          cities: ["米蘭"],
          note: "",
          stops: [{
            stop_id: "00000000-0000-4000-8000-000000000101",
            name: "Duomo",
            place_name: "Duomo di Milano",
            place_id: "places/duomo",
            kind: "sight",
            attachments: [{
              id: "attachment-1",
              type: "ticket",
              label: "Duomo ticket",
              status: "uploaded",
            }],
          }],
        }],
      },
    });

    expect(result.days?.[0]?.stops?.[0]?.attachments).toEqual([
      expect.objectContaining({
        id: "attachment-1",
        label: "Duomo ticket",
        status: "uploaded",
      }),
    ]);
  });

  test("rejects destructive plan updates without stable stop identity", async () => {
    env.OPENAI_API_KEY = "test-key";
    env.OPENAI_MODEL = "gpt-test";
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            choices: [{
              message: {
                tool_calls: [{
                  id: "call_day",
                  type: "function",
                  function: {
                    name: "update_trip_day",
                    arguments: JSON.stringify({
                      day_id: editableDay("2026-09-25", "米蘭").day_id,
                      day: {
                        day_date: "2026-09-25",
                        city: "米蘭",
                        cities: ["米蘭"],
                        segments: [],
                        note: "Updated plan",
                        stops: [{
                          name: "Duomo",
                          place_name: "Duomo di Milano",
                          place_id: null,
                          kind: "sight",
                          note: "Visit in the morning",
                          attachments: [],
                        }],
                      },
                    }),
                  },
                }],
              },
            }],
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            choices: [{
              message: {
                tool_calls: [{
                  id: "call_final",
                  type: "function",
                  function: {
                    name: "lumi_response",
                    arguments: JSON.stringify({
                      summary: "No changes made.",
                      days: null,
                      companions: null,
                      flight_details: null,
                      trip_draft: null,
                      esim_suggestion: null,
                    }),
                  },
                }],
              },
            }],
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
      );

    const result = await runLumiTurn({
      prompt: "Reorder this day",
      requestedSkill: "plan-trip",
      editableTrip: {
        ...editableTrip,
        days: [{
          day_id: editableDay("2026-09-25", "米蘭").day_id,
          day_date: "2026-09-25",
          city: "米蘭",
          cities: ["米蘭"],
          note: "",
          stops: [{
            stop_id: "00000000-0000-4000-8000-000000000101",
            name: "Duomo",
            place_name: "Duomo di Milano",
            place_id: null,
            kind: "sight",
            attachments: [{
              id: "attachment-1",
              type: "ticket",
              label: "Duomo ticket",
              status: "uploaded",
            }],
          }],
        }],
      },
    });
    const secondRequest = JSON.parse(
      fetchMock.mock.calls[1]?.[1]?.body as string,
    ) as { messages: Array<{ role: string; content?: string }> };
    const toolMessage = secondRequest.messages.find(
      (message) => message.role === "tool",
    );

    expect(JSON.parse(toolMessage?.content ?? "{}")).toMatchObject({
      ok: false,
      code: "invalid_command",
      field: "day.stops",
      message: expect.any(String),
      details: "attachment_preservation_requires_stable_stop_identity",
    });
    expect(result.days).toBeUndefined();
  });
});

describe("runLumiTurn", () => {
  test("offers no mutation tools outside explicit draft or edit context", async () => {
    env.OPENAI_API_KEY = "test-key";
    env.OPENAI_MODEL = "gpt-test";

    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                tool_calls: [
                  {
                    id: "call_final",
                    type: "function",
                    function: {
                      name: "lumi_response",
                      arguments: JSON.stringify({
                        summary: "你可能是指米蘭行程嗎？請先確認。",
                        days: null,
                        companions: null,
                        flight_details: null,
                        trip_draft: null,
                        esim_suggestion: null,
                      }),
                    },
                  },
                ],
              },
            },
          ],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );

    await runLumiTurn({
      prompt: "幫我把 BR95 的機票資訊存到我的米蘭行程",
      context: {
        current_date: "2026-06-15",
        user_name: null,
        known_trips: [
          {
            id: "trip-1",
            title: "米蘭行程",
            start_date: "2026-09-25",
            end_date: "2026-10-11",
            status: "upcoming",
            days_count: 17,
            cities: ["米蘭"],
            updated_at: "2026-06-14T05:00:00.000Z",
          },
        ],
        active_trip: null,
        active_esim: null,
        today_tasks: null,
      },
    });

    const body = JSON.parse(
      String((fetchMock.mock.calls[0]?.[1] as RequestInit | undefined)?.body),
    ) as { tools: Array<{ function?: { name?: string } }> };
    expect(body.tools.map((tool) => tool.function?.name)).not.toContain(
      "set_flight_details",
    );
    expect(body.tools.map((tool) => tool.function?.name)).not.toContain(
      "stage_trip_draft_days",
    );
  });

  test("allows explicit planning mode to patch a targeted stop day", async () => {
    env.OPENAI_API_KEY = "test-key";
    env.OPENAI_MODEL = "gpt-test";

    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  tool_calls: [
                    {
                      id: "call_day_3",
                      type: "function",
                      function: {
                        name: "update_trip_day",
                        arguments: JSON.stringify({
                          day_id: editableDay("2026-09-28", "巴黎").day_id,
                          day: {
                            day_date: "2026-09-28",
                            city: "巴黎",
                            note: "家具展示空間",
                            stops: [
                              {
                                name: "家具品牌展示空間",
                                anchor_mode: "regional",
                                place_name: null,
                                place_id: null,
                                place_address: null,
                                area_name: null,
                                search_query: "furniture showroom home goods store",
                                country_code: "FR",
                                place_types: [
                                  "furniture_store",
                                  "home_goods_store",
                                  "store",
                                ],
                                suggestion_count: 5,
                                kind: "shop",
                                arrival_time: null,
                                duration_min: 90,
                                note: "挑幾間家具品牌展示空間。",
                                attachments: [],
                              },
                            ],
                          },
                        }),
                      },
                    },
                  ],
                },
              },
            ],
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  tool_calls: [
                    {
                      id: "call_final",
                      type: "function",
                      function: {
                        name: "lumi_response",
                        arguments: JSON.stringify({
                          summary: "已幫你把 Day 3 的家具展示空間補進行程。",
                          days: null,
                          companions: null,
                          flight_details: null,
                          trip_draft: null,
                          esim_suggestion: null,
                        }),
                      },
                    },
                  ],
                },
              },
            ],
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
      );

    const result = await runLumiTurn({
      prompt: "幫我挑選 day3 的家具品牌展示空間有哪些地方適合去",
      requestedSkill: "plan-trip",
      editableTrip: {
        trip_id: TEST_TRIP_ID,
        title: "Europe design trip",
        start_date: "2026-09-26",
        end_date: "2026-09-28",
        days: [
          editableDay("2026-09-26", "米蘭"),
          editableDay("2026-09-27", "米蘭"),
          editableDay("2026-09-28", "巴黎"),
        ],
        cities: [],
        companions: [],
      },
    });

    const firstRequest = JSON.parse(
      fetchMock.mock.calls[0]?.[1]?.body as string,
    ) as { tools: Array<{ function?: { name?: string } }> };
    const toolNames = firstRequest.tools.map((tool) => tool.function?.name);
    expect(toolNames).toContain("update_trip_day");
    expect(toolNames).toContain("create_trip_day");
    expect(toolNames).not.toContain("set_flight_details");
    expect(toolNames).not.toContain("set_trip_days");
    expect(result.days?.[0]?.day_date).toBe("2026-09-28");
    expect(result.days?.[0]?.stops?.[0]).toMatchObject({
      name: "家具品牌展示空間",
      kind: "shop",
      anchor_mode: "regional",
      search_query: "furniture showroom home goods store",
    });
    expect(result.flight_details).toBeUndefined();
  });

  test("executes multiple itinerary day tool calls before the final response", async () => {
    env.OPENAI_API_KEY = "test-key";
    env.OPENAI_MODEL = "gpt-test";

    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  tool_calls: [
                    {
                      id: "call_day_1",
                      type: "function",
                      function: {
                        name: "update_trip_day",
                        arguments: JSON.stringify({
                          day_id: editableDay("2026-09-26", "米蘭").day_id,
                          day: {
                            day_date: "2026-09-26",
                            city: "米蘭",
                            note: "Brera 與 Navigli",
                            stops: [
                              {
                                name: "Brera",
                                place_name: "Pinacoteca di Brera",
                                place_id: null,
                                place_address: null,
                                kind: "sight",
                                arrival_time: null,
                                duration_min: null,
                                note: "設計店與藝廊散步",
                                attachments: [],
                              },
                            ],
                          },
                        }),
                      },
                    },
                    {
                      id: "call_day_2",
                      type: "function",
                      function: {
                        name: "update_trip_day",
                        arguments: JSON.stringify({
                          day_id: editableDay("2026-09-27", "巴黎").day_id,
                          day: {
                            day_date: "2026-09-27",
                            city: "巴黎",
                            note: "Le Marais",
                            stops: [
                              {
                                name: "Le Marais",
                                place_name: "Place des Vosges",
                                place_id: null,
                                place_address: null,
                                kind: "sight",
                                arrival_time: null,
                                duration_min: null,
                                note: "街區散步",
                                attachments: [],
                              },
                            ],
                          },
                        }),
                      },
                    },
                  ],
                },
              },
            ],
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  tool_calls: [
                    {
                      id: "call_final",
                      type: "function",
                      function: {
                        name: "lumi_response",
                        arguments: JSON.stringify({
                          summary: "已把米蘭和巴黎兩天更新到行程裡。",
                          days: null,
                          companions: null,
                          esim_suggestion: null,
                          trip_draft: null,
                        }),
                      },
                    },
                  ],
                },
              },
            ],
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
      );

    const result = await runLumiTurn({
      prompt: "把 Day 1 排米蘭，Day 2 排巴黎",
      requestedSkill: "plan-trip",
      editableTrip: {
        trip_id: TEST_TRIP_ID,
        title: "Europe design trip",
        start_date: "2026-09-26",
        end_date: "2026-09-27",
        days: [
          editableDay("2026-09-26", "米蘭"),
          editableDay("2026-09-27", "巴黎"),
        ],
        cities: [],
        companions: [],
      },
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.summary).toBe("已把米蘭和巴黎兩天更新到行程裡。");
    expect(result.days?.map((day) => day.day_date)).toEqual([
      "2026-09-26",
      "2026-09-27",
    ]);
    expect(result.days?.map((day) => day.note)).toEqual([
      "Brera 與 Navigli",
      "Le Marais",
    ]);
    expect(result.tool_events).toEqual([
      expect.objectContaining({
        event: "tool_result",
        tool_name: "update_trip_day",
        status: "success",
        day_date: "2026-09-26",
        day_index: 1,
      }),
      expect.objectContaining({
        event: "tool_result",
        tool_name: "update_trip_day",
        status: "success",
        day_date: "2026-09-27",
        day_index: 2,
      }),
    ]);

    const secondRequest = JSON.parse(
      fetchMock.mock.calls[1]?.[1]?.body as string,
    ) as { messages: Array<{ role: string; tool_call_id?: string }> };
    expect(secondRequest.messages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          role: "tool",
          tool_call_id: "call_day_1",
        }),
        expect.objectContaining({
          role: "tool",
          tool_call_id: "call_day_2",
        }),
      ]),
    );
  });

  test("uses staged itinerary tools over a smaller final days payload", async () => {
    env.OPENAI_API_KEY = "test-key";
    env.OPENAI_MODEL = "gpt-test";

    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  tool_calls: [
                    {
                      id: "call_day_1",
                      type: "function",
                      function: {
                        name: "update_trip_day",
                        arguments: JSON.stringify({
                          day_id: editableDay("2026-09-26", "米蘭").day_id,
                          day: {
                            day_date: "2026-09-26",
                            city: "米蘭",
                            note: "米蘭設計散步",
                            stops: [],
                          },
                        }),
                      },
                    },
                    {
                      id: "call_day_2",
                      type: "function",
                      function: {
                        name: "update_trip_day",
                        arguments: JSON.stringify({
                          day_id: editableDay("2026-09-27", "巴黎").day_id,
                          day: {
                            day_date: "2026-09-27",
                            city: "巴黎",
                            note: "巴黎美術館日",
                            stops: [],
                          },
                        }),
                      },
                    },
                  ],
                },
              },
            ],
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  tool_calls: [
                    {
                      id: "call_final",
                      type: "function",
                      function: {
                        name: "lumi_response",
                        arguments: JSON.stringify({
                          summary: "已更新兩天。",
                          days: [
                            {
                              day_date: "2026-09-26",
                              city: "米蘭",
                              note: "只有最後回覆的一天",
                              stops: [],
                            },
                          ],
                          companions: null,
                          esim_suggestion: null,
                          trip_draft: null,
                        }),
                      },
                    },
                  ],
                },
              },
            ],
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
      );

    const result = await runLumiTurn({
      prompt: "把 Day 1 和 Day 2 都更新",
      requestedSkill: "plan-trip",
      editableTrip: {
        trip_id: TEST_TRIP_ID,
        title: "Europe design trip",
        start_date: "2026-09-26",
        end_date: "2026-09-27",
        days: [
          editableDay("2026-09-26", "米蘭"),
          editableDay("2026-09-27", "巴黎"),
        ],
        cities: [],
        companions: [],
      },
    });

    expect(result.days?.map((day) => day.day_date)).toEqual([
      "2026-09-26",
      "2026-09-27",
    ]);
    expect(result.days?.map((day) => day.note)).toEqual([
      "米蘭設計散步",
      "巴黎美術館日",
    ]);
  });
});

describe("model-visible editable snapshot", () => {
  test("includes stable trip, day, and stop IDs in structured context", async () => {
    env.OPENAI_API_KEY = "test-key";
    env.OPENAI_MODEL = "gpt-test";
    const dayId = "00000000-0000-4000-8000-000000000002";
    const stopId = "00000000-0000-4000-8000-000000000003";
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          choices: [{
            message: {
              tool_calls: [{
                id: "call_final",
                type: "function",
                function: {
                  name: "lumi_response",
                  arguments: JSON.stringify({
                    summary: "Trip context loaded.",
                    days: null,
                    companions: null,
                    flight_details: null,
                    trip_draft: null,
                    esim_suggestion: null,
                  }),
                },
              }],
            },
          }],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );

    await runLumiTurn({
      prompt: "What is on this trip?",
      editableTrip: {
        trip_id: TEST_TRIP_ID,
        title: "Milan design trip",
        start_date: "2026-09-27",
        end_date: "2026-09-27",
        days: [{
          day_id: dayId,
          day_date: "2026-09-27",
          city: "Milan",
          cities: ["Milan"],
          note: "Design day",
          stops: [{
            stop_id: stopId,
            name: "Pinacoteca di Brera",
            place_name: "Pinacoteca di Brera",
          }],
        }],
        cities: [],
        companions: [],
      },
    });

    const request = JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string) as {
      messages: Array<{ role: string; content: string }>;
    };
    const context = request.messages[1]?.content ?? "";
    expect(context).toContain(`trip_id: ${TEST_TRIP_ID}`);
    expect(context).toContain(`"day_id": "${dayId}"`);
    expect(context).toContain(`"stop_id": "${stopId}"`);
  });
});

describe("typed command collection", () => {
  const dayId = "00000000-0000-4000-8000-000000000002";

  function commandTrip() {
    return {
      trip_id: TEST_TRIP_ID,
      title: "Milan design trip",
      start_date: "2026-09-25",
      end_date: "2026-09-25",
      days: [{
        ...editableDay("2026-09-25", "Milan"),
        day_id: dayId,
      }],
      cities: [],
      companions: [],
    };
  }

  function finalResponse(summary: string) {
    return new Response(JSON.stringify({
      choices: [{
        message: {
          tool_calls: [{
            id: "call_final",
            type: "function",
            function: {
              name: "lumi_response",
              arguments: JSON.stringify({
                summary,
                days: null,
                companions: null,
                flight_details: null,
                trip_draft: null,
                esim_suggestion: null,
              }),
            },
          }],
        },
      }],
    }), { status: 200, headers: { "content-type": "application/json" } });
  }

  test("collects only a validated exact-ID command", async () => {
    env.OPENAI_API_KEY = "test-key";
    env.OPENAI_MODEL = "gpt-test";
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({
        choices: [{
          message: {
            tool_calls: [{
              id: "call_day",
              type: "function",
              function: {
                name: "update_trip_day",
                arguments: JSON.stringify({
                  day_id: dayId,
                  day: {
                    day_date: "2026-09-25",
                    city: "Milan",
                    cities: ["Milan"],
                    segments: [],
                    note: "Brera day",
                    stops: [],
                  },
                }),
              },
            }],
          },
        }],
      }), { status: 200, headers: { "content-type": "application/json" } }))
      .mockResolvedValueOnce(finalResponse("Updated the day."));

    const result = await runLumiTurn({
      prompt: "Update this day",
      requestedSkill: "plan-trip",
      editableTrip: commandTrip(),
    });

    expect(result.commands).toEqual([
      expect.objectContaining({
        type: "update_trip_day",
        day_id: dayId,
        day: expect.objectContaining({ day_date: "2026-09-25" }),
      }),
    ]);
  });

  test("returns a structured reference error and does not collect a stale-ID command", async () => {
    env.OPENAI_API_KEY = "test-key";
    env.OPENAI_MODEL = "gpt-test";
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({
        choices: [{
          message: {
            tool_calls: [{
              id: "call_day",
              type: "function",
              function: {
                name: "update_trip_day",
                arguments: JSON.stringify({
                  day_id: "00000000-0000-4000-8000-000000000099",
                  day: {
                    day_date: "2026-09-25",
                    city: "Milan",
                    cities: ["Milan"],
                    segments: [],
                    note: "Brera day",
                    stops: [],
                  },
                }),
              },
            }],
          },
        }],
      }), { status: 200, headers: { "content-type": "application/json" } }))
      .mockResolvedValueOnce(finalResponse("No changes made."));

    const result = await runLumiTurn({
      prompt: "Update Brera day",
      requestedSkill: "plan-trip",
      editableTrip: commandTrip(),
    });
    const retryRequest = JSON.parse(
      fetchMock.mock.calls[1]?.[1]?.body as string,
    ) as { messages: Array<{ role: string; content?: string }> };
    const toolMessage = retryRequest.messages.find(
      (message) => message.role === "tool",
    );

    expect(toolMessage?.content).toContain('"code":"invalid_reference"');
    expect(toolMessage?.content).toContain('"field":"day_id"');
    expect(result.commands).toBeUndefined();
  });

  test("returns accurate structured errors for schema and domain rejections", async () => {
    env.OPENAI_API_KEY = "test-key";
    env.OPENAI_MODEL = "gpt-test";
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({
        choices: [{
          message: {
            tool_calls: [
              {
                id: "duplicate_provider_id",
                type: "function",
                function: {
                  name: "update_trip_day",
                  arguments: JSON.stringify({
                    day: {
                      day_date: "not-a-date",
                      city: "Milan",
                      cities: ["Milan"],
                      segments: [],
                      note: "Invalid date",
                      stops: [],
                    },
                  }),
                },
              },
              {
                id: "duplicate_provider_id",
                type: "function",
                function: {
                  name: "update_trip_day",
                  arguments: JSON.stringify({
                    day_id: dayId,
                    day: {
                      day_date: "2026-09-25",
                      city: "Milan",
                      cities: ["Milan"],
                      segments: [],
                      note: "Inline attachment",
                      stops: [{
                        name: "Pinacoteca di Brera",
                        place_name: "Pinacoteca di Brera",
                        kind: "sight",
                        note: "",
                        attachments: [{
                          type: "ticket",
                          label: "Brera ticket",
                          status: "required",
                        }],
                      }],
                    },
                  }),
                },
              },
            ],
          },
        }],
      }), { status: 200, headers: { "content-type": "application/json" } }))
      .mockResolvedValueOnce(finalResponse("No changes made."));

    const result = await runLumiTurn({
      prompt: "Update this day",
      requestedSkill: "edit-trip",
      editableTrip: commandTrip(),
    });
    const retryRequest = JSON.parse(
      fetchMock.mock.calls[1]?.[1]?.body as string,
    ) as { messages: Array<{ role: string; content?: string }> };
    const toolResults = retryRequest.messages
      .filter((message) => message.role === "tool")
      .map((message) => JSON.parse(message.content ?? "{}"));

    expect(toolResults).toEqual([
      expect.objectContaining({
        ok: false,
        code: "invalid_command",
        field: "day_id",
        message: expect.any(String),
      }),
      expect.objectContaining({
        ok: false,
        code: "unauthorized_command",
        field: "day.stops",
        message: expect.any(String),
      }),
    ]);
    expect(toolResults.every((failure) => !("error" in failure))).toBe(true);
    expect(result.commands).toBeUndefined();
    expect(result.rejected_commands).toEqual([
      expect.objectContaining({
        type: "update_trip_day",
        target_id: null,
        attempt_id: expect.stringMatching(/^lumi-attempt-[0-9a-f-]{36}$/),
        provider_tool_call_id: "duplicate_provider_id",
        status: "rejected",
        code: "invalid_command",
      }),
      expect.objectContaining({
        type: "update_trip_day",
        target_id: dayId,
        attempt_id: expect.stringMatching(/^lumi-attempt-[0-9a-f-]{36}$/),
        provider_tool_call_id: "duplicate_provider_id",
        status: "rejected",
        code: "unauthorized_command",
      }),
    ]);
    expect(result.rejected_commands![0]!.attempt_id).not.toBe(result.rejected_commands![1]!.attempt_id);
  });

  test("keeps repeated updates but rejects a colliding duplicate create", async () => {
    env.OPENAI_API_KEY = "test-key";
    env.OPENAI_MODEL = "gpt-test";
    const replacement = (note: string) => ({
      day_date: "2026-09-25",
      city: "Milan",
      cities: ["Milan"],
      segments: [],
      note,
      stops: [],
    });
    const creation = (note: string) => ({
      day_date: "2026-09-26",
      city: "Milan",
      cities: ["Milan"],
      segments: [],
      note,
      stops: [],
    });
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({
        choices: [{
          message: {
            tool_calls: [
              {
                id: "call_update_1",
                type: "function",
                function: {
                  name: "update_trip_day",
                  arguments: JSON.stringify({ day_id: dayId, day: replacement("first update") }),
                },
              },
              {
                id: "call_update_2",
                type: "function",
                function: {
                  name: "update_trip_day",
                  arguments: JSON.stringify({ day_id: dayId, day: replacement("last update") }),
                },
              },
              {
                id: "call_create_1",
                type: "function",
                function: {
                  name: "create_trip_day",
                  arguments: JSON.stringify({ trip_id: TEST_TRIP_ID, day: creation("first create") }),
                },
              },
              {
                id: "call_create_2",
                type: "function",
                function: {
                  name: "create_trip_day",
                  arguments: JSON.stringify({ trip_id: TEST_TRIP_ID, day: creation("last create") }),
                },
              },
            ],
          },
        }],
      }), { status: 200, headers: { "content-type": "application/json" } }))
      .mockResolvedValueOnce(finalResponse("Updated the trip."));

    const result = await runLumiTurn({
      prompt: "Update and create days",
      requestedSkill: "edit-trip",
      editableTrip: commandTrip(),
    });

    expect(result.commands?.map((command) => command.type)).toEqual([
      "update_trip_day",
      "update_trip_day",
      "create_trip_day",
    ]);
    expect(result.days).toHaveLength(1);
    expect(result.days?.[0]?.note).toBe("last update");
    expect(result.day_creates).toHaveLength(1);
    expect(result.day_creates?.[0]?.note).toBe("first create");
    expect(result.rejected_commands).toContainEqual(expect.objectContaining({ type: "create_trip_day" }));
  });
});

describe("search_places grounding", () => {
  test("stripUnverifiedStopPlaceIds drops invented ids and keeps verified ones", () => {
    const result = {
      days: [
        {
          day_date: "2026-09-25",
          city: "巴黎",
          note: "",
          stops: [
            { name: "Septime", place_id: "verified-id", note: "" },
            { name: "Fake Bistro", place_id: "invented-id", note: "" },
            { name: "Le Marais 散步", place_id: null, note: "" },
          ],
        },
      ],
      trip_draft: null,
    };
    stripUnverifiedStopPlaceIds(result, new Set(["verified-id"]));
    expect(result.days[0]!.stops!.map((stop) => stop.place_id)).toEqual([
      "verified-id",
      null,
      null,
    ]);
  });

  test("runLumiTurn executes search_places and keeps only searched place_ids", async () => {
    env.OPENAI_API_KEY = "test-key";
    env.OPENAI_MODEL = "gpt-test";
    const previousMapsKey = env.GOOGLE_MAPS_API_KEY;
    env.GOOGLE_MAPS_API_KEY = "maps-test-key";

    const openAiSearchCall = new Response(
      JSON.stringify({
        choices: [
          {
            message: {
              tool_calls: [
                {
                  id: "call_search",
                  type: "function",
                  function: {
                    name: "search_places",
                    arguments: JSON.stringify({
                      query: "Septime",
                      city: "巴黎",
                      country_code: "FR",
                      max_results: 3,
                    }),
                  },
                },
              ],
            },
          },
        ],
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
    const placesResponse = new Response(
      JSON.stringify({
        places: [
          {
            id: "ChIJseptime",
            displayName: { text: "Septime" },
            formattedAddress: "80 Rue de Charonne, 75011 Paris",
            location: { latitude: 48.8531, longitude: 2.3811 },
            addressComponents: [{ shortText: "FR", types: ["country"] }],
            primaryType: "restaurant",
            types: ["restaurant"],
            rating: 4.6,
            userRatingCount: 5000,
          },
        ],
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
    const openAiFinalCall = new Response(
      JSON.stringify({
        choices: [
          {
            message: {
              tool_calls: [
                {
                  id: "call_final",
                  type: "function",
                  function: {
                    name: "lumi_response",
                    arguments: JSON.stringify({
                      summary: "排好了。",
                      days: null,
                      companions: null,
                      esim_suggestion: null,
                      trip_draft: {
                        title: "巴黎一日",
                        start_date: "2026-09-25",
                        end_date: "2026-09-25",
                        cover: null,
                        days: [
                          {
                            day_date: "2026-09-25",
                            city: "巴黎",
                            cities: ["巴黎"],
                            segments: [],
                            note: "美食日",
                            stops: [
                              {
                                name: "Septime",
                                anchor_mode: "exact_place",
                                place_name: "Septime",
                                place_id: "ChIJseptime",
                                kind: "meal",
                                note: "新派法菜",
                              },
                              {
                                name: "羅浮宮",
                                anchor_mode: "exact_place",
                                place_name: "Louvre Museum",
                                place_id: "invented-by-model",
                                kind: "sight",
                                note: "先挑三件想看的",
                              },
                            ],
                          },
                        ],
                        checklist: [],
                      },
                    }),
                  },
                },
              ],
            },
          },
        ],
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    );

    const fetchMock = vi.spyOn(globalThis, "fetch");
    fetchMock
      .mockResolvedValueOnce(openAiSearchCall)
      .mockResolvedValueOnce(placesResponse)
      .mockResolvedValueOnce(openAiFinalCall);

    try {
      const result = await runLumiTurn({
        prompt: "幫我排 9/25 巴黎一天，晚餐想吃 Septime",
        requestedSkill: "create-trip",
      });

      const placesCall = fetchMock.mock.calls[1]!;
      expect(String(placesCall[0])).toContain(
        "places.googleapis.com/v1/places:searchText",
      );

      const stops = result.trip_draft?.days[0]?.stops ?? [];
      expect(stops.map((stop) => stop.place_id)).toEqual(["ChIJseptime", null]);
      expect(stops.map((stop) => stop.place_name)).toEqual([
        "Septime",
        "Louvre Museum",
      ]);
    } finally {
      env.GOOGLE_MAPS_API_KEY = previousMapsKey;
    }
  });
});
