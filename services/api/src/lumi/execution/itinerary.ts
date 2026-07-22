import { and, asc, eq, inArray, ne, notInArray } from "drizzle-orm";

import { getDb } from "../../db/client.js";
import schema from "../../db/schema/index.js";
import { normalizeTripStopAnchorMode } from "../../db/schema/trip.js";
import { geocodeCities } from "../../geocode/nominatim.js";
import { resolveGooglePlace } from "../../geocode/google-places.js";
import { scheduleTripPlaceSuggestionRefresh } from "../../trips/place-suggestions.js";
import type { LumiCommand } from "../contracts/commands.js";

export type ExecutedLumiCommand =
  | { type: LumiCommand["type"]; status: "success"; target_id: string; request_target_id?: string; attempt_id?: string }
  | {
      type: LumiCommand["type"];
      status: "error";
      target_id: string;
      request_target_id?: string;
      attempt_id?: string;
      code: "invalid_reference" | "conflict" | "execution_failed";
    };

type ItineraryCommand = Extract<
  LumiCommand,
  { type: "update_trip_day" | "create_trip_day" }
>;

type ExecutionContext = { userId: string; tripId: string };

type DayValue = ItineraryCommand["day"];
type StopValue = DayValue["stops"][number];

export function itineraryDayValues(day: DayValue) {
  return {
    dayDate: day.day_date,
    city: day.city,
    cities: day.cities.length > 0 ? day.cities : [day.city],
    segments: day.segments,
    note: day.note,
  };
}

async function resolveStopsForWrite(day: DayValue, stops: StopValue[]): Promise<StopValue[]> {
  const cityName = day.city || day.cities[0] || "";
  const [city] = cityName
    ? await geocodeCities([cityName], { fetchMisses: true }).catch(() => [])
    : [];
  return Promise.all(stops.map(async (stop) => {
    if (normalizeTripStopAnchorMode(stop.anchor_mode) !== "exact_place") return stop;
    const query = (stop.place_name ?? stop.name).trim();
    if (!query) return stop;
    const place = await resolveGooglePlace(query, {
      city: cityName || null,
      expectedCountry: stop.country_code ?? city?.country_code ?? null,
      center: city ? { lat: city.lat, lng: city.lng } : null,
      maxDistanceMeters: 75_000,
    }).catch(() => null);
    return place ? {
      ...stop,
      place_name: place.name,
      place_id: place.place_id,
      place_address: place.formatted_address,
      country_code: stop.country_code ?? place.country_code,
      lat: place.lat,
      lng: place.lng,
    } : stop;
  }));
}

export async function prepareStopRows(
  dayId: string,
  day: DayValue,
  resolver: (day: DayValue, stops: StopValue[]) => Promise<StopValue[]> = resolveStopsForWrite,
) {
  const stops = await resolver(day, day.stops);
  return stops.map((stop, sortOrder) => ({
    id: stop.stop_id,
    dayId,
    sortOrder,
    name: stop.name,
    anchorMode: normalizeTripStopAnchorMode(stop.anchor_mode),
    placeName: stop.place_name ?? null,
    placeId: stop.place_id ?? null,
    placeAddress: stop.place_address ?? null,
    areaName: stop.area_name ?? null,
    searchQuery: stop.search_query ?? null,
    countryCode: stop.country_code ?? null,
    placeTypes: stop.place_types ?? [],
    suggestionCount: stop.suggestion_count ?? 5,
    placeSuggestions: [],
    suggestionsStatus:
      normalizeTripStopAnchorMode(stop.anchor_mode) === "regional"
        ? "idle"
        : "resolved",
    kind: stop.kind ?? "other",
    arrivalTime: stop.arrival_time ?? null,
    durationMin: stop.duration_min ?? null,
    note: stop.note ?? "",
    attachments: stop.attachments ?? [],
    lat: stop.lat ?? null,
    lng: stop.lng ?? null,
  }));
}

export function retainedStopIdsAreCurrent(requestedIds: readonly string[], rows: readonly { id: string }[]): boolean {
  return rows.length === new Set(requestedIds).size && rows.every((row) => requestedIds.includes(row.id));
}

export async function executeItineraryCommand(
  command: ItineraryCommand,
  context: ExecutionContext,
): Promise<ExecutedLumiCommand> {
  const db = getDb();
  const targetId =
    command.type === "update_trip_day" ? command.day_id : command.trip_id;

  try {
    if (command.type === "update_trip_day") {
      const [ownedDay] = await db
        .select({ id: schema.tripDay.id })
        .from(schema.tripDay)
        .innerJoin(schema.trip, eq(schema.tripDay.tripId, schema.trip.id))
        .where(
          and(
            eq(schema.tripDay.id, command.day_id),
            eq(schema.trip.id, context.tripId),
            eq(schema.trip.userId, context.userId),
          ),
        )
        .limit(1);
      if (!ownedDay) {
        return {
          type: command.type,
          status: "error",
          target_id: targetId,
          code: "invalid_reference",
        };
      }

      await db.transaction(async (tx) => {
        const [lockedTrip] = await tx
          .select({ id: schema.trip.id })
          .from(schema.trip)
          .where(and(eq(schema.trip.id, context.tripId), eq(schema.trip.userId, context.userId)))
          .for("update")
          .limit(1);
        if (!lockedTrip) throw new Error("invalid_reference");
        const [currentDay] = await tx
          .select({ id: schema.tripDay.id })
          .from(schema.tripDay)
          .where(and(eq(schema.tripDay.id, command.day_id), eq(schema.tripDay.tripId, lockedTrip.id)))
          .limit(1);
        if (!currentDay) throw new Error("invalid_reference");
        const [calendarConflict] = await tx
          .select({ id: schema.tripDay.id })
          .from(schema.tripDay)
          .where(and(eq(schema.tripDay.tripId, lockedTrip.id), eq(schema.tripDay.dayDate, command.day.day_date), ne(schema.tripDay.id, currentDay.id)))
          .limit(1);
        if (calendarConflict) throw new Error("conflict");
        const retainedIds = command.day.stops.flatMap((stop) => stop.stop_id ? [stop.stop_id] : []);
        if (retainedIds.length > 0) {
          const retained = await tx
            .select({ id: schema.tripDayStop.id })
            .from(schema.tripDayStop)
            .where(and(eq(schema.tripDayStop.dayId, currentDay.id), inArray(schema.tripDayStop.id, retainedIds)));
          if (!retainedStopIdsAreCurrent(retainedIds, retained)) throw new Error("invalid_reference");
        }
        const updatedDays = await tx
          .update(schema.tripDay)
          .set(itineraryDayValues(command.day))
          .where(and(eq(schema.tripDay.id, currentDay.id), eq(schema.tripDay.tripId, lockedTrip.id)))
          .returning({ id: schema.tripDay.id });
        if (updatedDays.length !== 1) throw new Error("invalid_reference");
        const rows = await prepareStopRows(currentDay.id, command.day);
        await tx.delete(schema.tripDayStop).where(
          retainedIds.length > 0
            ? and(eq(schema.tripDayStop.dayId, currentDay.id), notInArray(schema.tripDayStop.id, retainedIds))
            : eq(schema.tripDayStop.dayId, currentDay.id),
        );
        for (const row of rows.filter((candidate) => candidate.id)) {
          const {
            id,
            placeSuggestions: _placeSuggestions,
            lat,
            lng,
            ...baseValues
          } = row;
          const values = {
            ...baseValues,
            ...(lat != null && lng != null ? { lat, lng } : {}),
          };
          const updatedStops = await tx.update(schema.tripDayStop).set(values).where(
            and(eq(schema.tripDayStop.id, id!), eq(schema.tripDayStop.dayId, currentDay.id)),
          ).returning({ id: schema.tripDayStop.id });
          if (updatedStops.length !== 1) throw new Error("invalid_reference");
        }
        const createdRows = rows.filter((candidate) => !candidate.id).map(({ id: _id, ...row }) => row);
        if (createdRows.length > 0) await tx.insert(schema.tripDayStop).values(createdRows);

        const orderedDays = await tx
          .select({ id: schema.tripDay.id, dayDate: schema.tripDay.dayDate })
          .from(schema.tripDay)
          .where(eq(schema.tripDay.tripId, context.tripId));
        orderedDays.sort((a, b) => a.dayDate.localeCompare(b.dayDate));
        for (const [sortOrder, day] of orderedDays.entries()) {
          await tx
            .update(schema.tripDay)
            .set({ sortOrder })
            .where(eq(schema.tripDay.id, day.id));
        }
        const updatedTrips = await tx
          .update(schema.trip)
          .set({
            startDate: orderedDays[0]?.dayDate ?? command.day.day_date,
            endDate: orderedDays.at(-1)?.dayDate ?? command.day.day_date,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(schema.trip.id, context.tripId),
              eq(schema.trip.userId, context.userId),
            ),
          )
          .returning({ id: schema.trip.id });
        if (updatedTrips.length !== 1) throw new Error("invalid_reference");
      });
      scheduleTripPlaceSuggestionRefresh(context.tripId);
      return { type: command.type, status: "success", target_id: targetId };
    }

    if (command.trip_id !== context.tripId) {
      return {
        type: command.type,
        status: "error",
        target_id: targetId,
        code: "invalid_reference",
      };
    }
    const [ownedTrip] = await db
      .select({ id: schema.trip.id })
      .from(schema.trip)
      .where(
        and(
          eq(schema.trip.id, command.trip_id),
          eq(schema.trip.userId, context.userId),
        ),
      )
      .limit(1);
    if (!ownedTrip) {
      return {
        type: command.type,
        status: "error",
        target_id: targetId,
        code: "invalid_reference",
      };
    }
    const [conflictingDay] = await db
      .select({ id: schema.tripDay.id })
      .from(schema.tripDay)
      .where(
        and(
          eq(schema.tripDay.tripId, ownedTrip.id),
          eq(schema.tripDay.dayDate, command.day.day_date),
        ),
      )
      .limit(1);
    if (conflictingDay) {
      return {
        type: command.type,
        status: "error",
        target_id: targetId,
        code: "conflict",
      };
    }

    await db.transaction(async (tx) => {
      const [lockedTrip] = await tx
        .select({ id: schema.trip.id })
        .from(schema.trip)
        .where(and(eq(schema.trip.id, command.trip_id), eq(schema.trip.userId, context.userId)))
        .for("update")
        .limit(1);
      if (!lockedTrip) throw new Error("invalid_reference");
      const [calendarConflict] = await tx
        .select({ id: schema.tripDay.id })
        .from(schema.tripDay)
        .where(and(eq(schema.tripDay.tripId, lockedTrip.id), eq(schema.tripDay.dayDate, command.day.day_date)))
        .limit(1);
      if (calendarConflict) throw new Error("conflict");
      const existingDays = await tx
        .select({ id: schema.tripDay.id, dayDate: schema.tripDay.dayDate })
        .from(schema.tripDay)
        .where(eq(schema.tripDay.tripId, lockedTrip.id))
        .orderBy(asc(schema.tripDay.dayDate));
      const [created] = await tx
        .insert(schema.tripDay)
        .values({
          tripId: lockedTrip.id,
          sortOrder: existingDays.length,
          ...itineraryDayValues(command.day),
        })
        .returning({ id: schema.tripDay.id });
      if (!created) throw new Error("trip_day_insert_failed");
      const rows = (await prepareStopRows(created.id, command.day)).map(({ id: _id, ...row }) => row);
      if (rows.length > 0) await tx.insert(schema.tripDayStop).values(rows);

      const orderedDays = [...existingDays, { id: created.id, dayDate: command.day.day_date }]
        .sort((a, b) => a.dayDate.localeCompare(b.dayDate));
      for (const [sortOrder, day] of orderedDays.entries()) {
        await tx
          .update(schema.tripDay)
          .set({ sortOrder })
          .where(eq(schema.tripDay.id, day.id));
      }
      const updatedTrips = await tx
        .update(schema.trip)
        .set({
          startDate: orderedDays[0]!.dayDate,
          endDate: orderedDays.at(-1)!.dayDate,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(schema.trip.id, lockedTrip.id),
            eq(schema.trip.userId, context.userId),
          ),
        )
        .returning({ id: schema.trip.id });
      if (updatedTrips.length !== 1) throw new Error("invalid_reference");
    });
    scheduleTripPlaceSuggestionRefresh(context.tripId);
    return { type: command.type, status: "success", target_id: targetId };
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const postgresCode = typeof error === "object" && error !== null && "code" in error ? String((error as { code?: unknown }).code) : "";
    return {
      type: command.type,
      status: "error",
      target_id: targetId,
      code: message === "invalid_reference"
        ? "invalid_reference"
        : message === "conflict" || postgresCode === "23505"
          ? "conflict"
          : "execution_failed",
    };
  }
}
