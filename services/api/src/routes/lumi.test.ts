import { beforeEach, describe, expect, test, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import { Hono } from "hono";

const getDbMock = vi.hoisted(() => vi.fn());

vi.mock("../db/client.js", () => ({ getDb: getDbMock }));
vi.mock("./_auth.js", () => ({
  getUser: () => ({ id: USER_ID, email: null }),
  requireAuth: async (_c: unknown, next: () => Promise<void>) => next(),
}));

import { executeAttachmentCommand } from "../lumi/execution/attachments.js";
import type { ExecutedLumiCommand } from "../lumi/execution/itinerary.js";
import schema from "../db/schema/index.js";

import {
  pageContextSchema,
  successfulItineraryProjections,
  stopsForLumiWrite,
  lumiRouter,
} from "./lumi.js";

const TRIP_ID = "11111111-1111-4111-8111-111111111111";
const USER_ID = "traveler-1";
const FIRST_STOP_ID = "22222222-2222-4222-8222-222222222222";
const SECOND_STOP_ID = "33333333-3333-4333-8333-333333333333";
const STALE_STOP_ID = "44444444-4444-4444-8444-444444444444";

type AttachmentFixture = {
  id: string;
  name: string;
  dayDate: string;
  attachments: unknown[];
  dayId: string;
  tripId: string;
  userId: string;
};

const dialect = new PgDialect();

describe("POST /chat/stream mutation preflight", () => {
  test("returns HTTP 403 JSON before opening SSE for an unowned trip", async () => {
    getDbMock.mockReturnValue({
      select: () => ({
        from: () => ({
          where: () => ({ limit: async () => [] }),
        }),
      }),
    });
    const app = new Hono().route("/lumi", lumiRouter);
    const response = await app.request("/lumi/chat/stream", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        prompt: "Edit this trip",
        requested_skill: "edit-trip",
        current_trip_id: TRIP_ID,
      }),
    });
    expect(response.status).toBe(403);
    expect(response.headers.get("content-type")).toContain("application/json");
    await expect(response.json()).resolves.toEqual({ error: "current_trip_forbidden" });
  });
});

function renderedPredicate(predicate: unknown) {
  return dialect.sqlToQuery(predicate as Parameters<PgDialect["sqlToQuery"]>[0]);
}

function attachmentDb(stops: AttachmentFixture[]) {
  const updates: Array<{ id: string; attachments: unknown[] }> = [];
  const matchingStops = (
    predicate: unknown,
    joinedTables: unknown[],
  ): AttachmentFixture[] => {
    const query = renderedPredicate(predicate);
    const hasExactStop = query.sql.includes('"trip_day_stop"."id" =');
    const hasTripScope = query.sql.includes('"trip"."id" =');
    const hasOwnerScope = query.sql.includes('"trip"."user_id" =');
    const hasOwnedJoins =
      joinedTables.includes(schema.tripDay) && joinedTables.includes(schema.trip);
    if (!hasExactStop || !hasTripScope || !hasOwnerScope || !hasOwnedJoins) {
      return [];
    }
    return stops.filter(
      (stop) =>
        query.params.includes(stop.id) &&
        query.params.includes(stop.tripId) &&
        query.params.includes(stop.userId),
    );
  };
  const tx = {
    update: vi.fn((table: unknown) => ({
      set: vi.fn((values: { attachments?: unknown[] }) => {
        return {
          where: vi.fn((predicate: unknown) => {
            if (table === schema.tripDayStop && values.attachments) {
              const query = renderedPredicate(predicate);
              if (!query.sql.includes('"trip_day_stop"."id" =')) {
                throw new Error("broad_stop_update");
              }
              const target = stops.find((stop) => query.params.includes(stop.id));
              if (target) {
                updates.push({ id: target.id, attachments: values.attachments });
              }
            }
            return Promise.resolve();
          }),
        };
      }),
    })),
  };
  const db = {
    select: vi.fn(() => ({
      from: vi.fn(() => {
        const joinedTables: unknown[] = [];
        const builder = {
          innerJoin: vi.fn((table: unknown) => {
            joinedTables.push(table);
            return builder;
          }),
          where: vi.fn((predicate: unknown) => ({
            limit: vi.fn(async () => matchingStops(predicate, joinedTables)),
          })),
        };
        return builder;
      }),
    })),
    transaction: vi.fn(async (callback: (transaction: typeof tx) => unknown) =>
      callback(tx),
    ),
  };
  return { db, updates };
}

describe("executeAttachmentCommand", () => {
  beforeEach(() => getDbMock.mockReset());

  test("updates only the owned stop selected by its exact ID", async () => {
    const louvreMuseum: AttachmentFixture = {
      id: FIRST_STOP_ID,
      name: "Louvre Museum",
      dayDate: "2026-09-10",
      attachments: [],
      dayId: "55555555-5555-4555-8555-555555555555",
      tripId: TRIP_ID,
      userId: USER_ID,
    };
    const eveningTour: AttachmentFixture = {
      id: SECOND_STOP_ID,
      name: "Louvre Museum evening tour",
      dayDate: "2026-09-10",
      attachments: [],
      dayId: louvreMuseum.dayId,
      tripId: TRIP_ID,
      userId: USER_ID,
    };
    const harness = attachmentDb([louvreMuseum, eveningTour]);
    getDbMock.mockReturnValue(harness.db);

    const result = await executeAttachmentCommand(
      {
        type: "upsert_stop_attachment",
        stop_id: SECOND_STOP_ID,
        attachment: { type: "ticket", label: "Evening admission", status: "required" },
      },
      { userId: USER_ID, tripId: TRIP_ID },
    );

    expect(result).toEqual({
      type: "upsert_stop_attachment",
      status: "success",
      target_id: SECOND_STOP_ID,
    });
    expect(harness.updates).toHaveLength(1);
    expect(harness.updates[0]?.id).toBe(eveningTour.id);
    expect(harness.updates[0]?.id).not.toBe(louvreMuseum.id);
  });

  test("returns invalid_reference for a stale stop ID without updating a stop", async () => {
    const harness = attachmentDb([
      {
        id: FIRST_STOP_ID,
        name: "Louvre Museum",
        dayDate: "2026-09-10",
        attachments: [],
        dayId: "55555555-5555-4555-8555-555555555555",
        tripId: TRIP_ID,
        userId: USER_ID,
      },
      {
        id: SECOND_STOP_ID,
        name: "Louvre Museum evening tour",
        dayDate: "2026-09-10",
        attachments: [],
        dayId: "55555555-5555-4555-8555-555555555555",
        tripId: TRIP_ID,
        userId: USER_ID,
      },
    ]);
    getDbMock.mockReturnValue(harness.db);

    const result = await executeAttachmentCommand(
      {
        type: "upsert_stop_attachment",
        stop_id: STALE_STOP_ID,
        attachment: { type: "ticket", label: "Admission", status: "required" },
      },
      { userId: USER_ID, tripId: TRIP_ID },
    );

    expect(result).toEqual({
      type: "upsert_stop_attachment",
      status: "error",
      target_id: STALE_STOP_ID,
      code: "invalid_reference",
    });
    expect(harness.updates).toEqual([]);
  });

  test("rejects a matching stop ID outside the authorized owner context", async () => {
    const harness = attachmentDb([
      {
        id: SECOND_STOP_ID,
        name: "Louvre Museum evening tour",
        dayDate: "2026-09-10",
        attachments: [],
        dayId: "55555555-5555-4555-8555-555555555555",
        tripId: TRIP_ID,
        userId: "another-traveler",
      },
    ]);
    getDbMock.mockReturnValue(harness.db);

    const result = await executeAttachmentCommand(
      {
        type: "upsert_stop_attachment",
        stop_id: SECOND_STOP_ID,
        attachment: { type: "ticket", label: "Admission", status: "required" },
      },
      { userId: USER_ID, tripId: TRIP_ID },
    );

    expect(result.status).toBe("error");
    expect(harness.updates).toEqual([]);
  });
});

describe("successfulItineraryProjections", () => {
  const updateCommand = {
    type: "update_trip_day" as const,
    day_id: "66666666-6666-4666-8666-666666666666",
    day: {
      day_date: "2026-09-10",
      city: "Paris",
      cities: ["Paris"],
      segments: [],
      note: "Museum day",
      stops: [],
    },
  };
  const createCommand = {
    type: "create_trip_day" as const,
    trip_id: TRIP_ID,
    day: {
      day_date: "2026-09-11",
      city: "Paris",
      cities: ["Paris"],
      segments: [],
      note: "New day",
      stops: [],
    },
  };
  const attachmentCommand = {
    type: "upsert_stop_attachment" as const,
    stop_id: SECOND_STOP_ID,
    attachment: { type: "ticket", label: "Admission", status: "required" as const },
  };

  test("does not report proposed itinerary days after only an attachment succeeds", () => {
    const outcomes: ExecutedLumiCommand[] = [
      {
        type: "update_trip_day",
        status: "error",
        target_id: updateCommand.day_id,
        code: "invalid_reference",
      },
      {
        type: "upsert_stop_attachment",
        status: "success",
        target_id: attachmentCommand.stop_id,
      },
    ];

    expect(
      successfulItineraryProjections(
        [updateCommand, attachmentCommand],
        outcomes,
      ),
    ).toEqual([]);
  });

  test("returns only itinerary days whose corresponding executions succeeded", () => {
    const outcomes: ExecutedLumiCommand[] = [
      {
        type: "update_trip_day",
        status: "success",
        target_id: updateCommand.day_id,
      },
      {
        type: "create_trip_day",
        status: "error",
        target_id: createCommand.trip_id,
        code: "conflict",
      },
    ];

    expect(
      successfulItineraryProjections([updateCommand, createCommand], outcomes),
    ).toEqual([
      {
        day_date: "2026-09-10",
        city: "Paris",
        cities: ["巴黎"],
        note: "Museum day",
      },
    ]);
  });
});

describe("pageContextSchema", () => {
  test("accepts known trips from the web Lumi context", () => {
    const parsed = pageContextSchema.safeParse({
      current_date: "2026-07-08",
      user_name: null,
      known_trips: [
        {
          id: "f9d0d7af-08f8-49e1-8659-297beb0ffa97",
          title: "Tokyo draft",
          start_date: "2026-09-01",
          end_date: "2026-09-05",
          status: "draft",
          days_count: 5,
          cities: ["Tokyo"],
          updated_at: "2026-07-08T09:00:00.000Z",
        },
      ],
      active_trip: null,
      active_esim: null,
      today_tasks: null,
    });

    expect(parsed.success).toBe(true);
  });
});

describe("stopsForLumiWrite", () => {
  test("does not synthesize city-name stops for Lumi days without stops", () => {
    expect(
      stopsForLumiWrite({
        day_date: "2026-09-27",
        city: "Milan",
        cities: ["Milan"],
        note: "Design day",
        stops: [],
      }),
    ).toEqual([]);
  });

  test("preserves stops Lumi explicitly planned", () => {
    expect(
      stopsForLumiWrite({
        day_date: "2026-09-27",
        city: "Milan",
        note: "Design day",
        stops: [
          {
            name: "Brera",
            place_name: "Pinacoteca di Brera",
            kind: "sight",
            attachments: [],
          },
        ],
      }),
    ).toEqual([
      {
        name: "Brera",
        place_name: "Pinacoteca di Brera",
        kind: "sight",
        attachments: [],
      },
    ]);
  });
});
