import { and, desc, eq } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";

import { getDb } from "../db/client.js";
import schema from "../db/schema/index.js";
import { getUser, requireAuth } from "./_auth.js";

export const collectionRouter = new Hono();

collectionRouter.use("*", requireAuth);

const placeInput = z.object({
  place_key: z.string().min(1).max(160).optional(),
  name: z.string().min(1).max(180),
  name_i18n: z.record(z.string()).default({}),
  country: z.string().min(1).max(120),
  country_code: z.string().max(8).nullish(),
  city: z.string().max(120).nullish(),
  continent: z.string().min(1).max(40),
  kind: z.string().min(1).max(40).default("city"),
  status: z.enum(["visited", "wishlist"]).default("visited"),
  visited_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullish(),
  cover_image: z.string().max(600).nullish(),
  lat: z.number().nullish(),
  lng: z.number().nullish(),
  favorite: z.boolean().default(false),
  source_trip_id: z.string().uuid().nullish(),
  notes: z.string().max(2000).default(""),
});

const placePatch = placeInput.partial().extend({
  favorite: z.boolean().optional(),
  status: z.enum(["visited", "wishlist"]).optional(),
});

const photoInput = z.object({
  photo_key: z.string().min(1).max(160).optional(),
  place_id: z.string().uuid().nullish(),
  trip_id: z.string().uuid().nullish(),
  image_url: z.string().min(1).max(1200),
  caption: z.string().max(1000).default(""),
  taken_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullish(),
});

type ProfileRow = typeof schema.travelerProfile.$inferSelect;
type PlaceRow = typeof schema.travelerPlace.$inferSelect;
type PhotoRow = typeof schema.travelerPhoto.$inferSelect;
type AchievementRow = typeof schema.travelerAchievement.$inferSelect;

const CONTINENT_TARGETS: Record<string, number> = {
  Asia: 50,
  Europe: 50,
  "North America": 50,
  "South America": 50,
  Africa: 50,
  Oceania: 10,
};

function slug(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 140);
}

function xpForPlace(input: z.infer<typeof placeInput>): number {
  if (input.status === "wishlist") return 0;
  if (input.kind === "country") return 120;
  if (input.kind === "city") return 60;
  if (input.kind === "natural" || input.kind === "culture" || input.kind === "historic") return 35;
  return 25;
}

function levelFromXp(xpTotal: number) {
  const level = Math.max(1, Math.floor(xpTotal / 1000) + 1);
  return {
    level,
    xpIntoLevel: xpTotal % 1000,
    xpToNext: 1000,
  };
}

function rowToProfile(row: ProfileRow) {
  return {
    level: row.level,
    xp_total: row.xpTotal,
    xp_into_level: row.xpIntoLevel,
    xp_to_next: row.xpToNext,
    visited_country_count: row.visitedCountryCount,
    visited_city_count: row.visitedCityCount,
    visited_place_count: row.visitedPlaceCount,
    photo_count: row.photoCount,
    achievement_count: row.achievementCount,
  };
}

function rowToPlace(row: PlaceRow, photoCount = 0) {
  return {
    id: row.id,
    place_key: row.placeKey,
    name: row.name,
    name_i18n: row.nameI18n,
    country: row.country,
    country_code: row.countryCode,
    city: row.city,
    continent: row.continent,
    kind: row.kind,
    status: row.status,
    visited_at: row.visitedAt,
    cover_image: row.coverImage,
    lat: row.lat,
    lng: row.lng,
    favorite: row.favorite,
    source_trip_id: row.sourceTripId,
    notes: row.notes,
    xp_awarded: row.xpAwarded,
    photo_count: photoCount,
  };
}

function rowToPhoto(row: PhotoRow) {
  return {
    id: row.id,
    photo_key: row.photoKey,
    place_id: row.placeId,
    trip_id: row.tripId,
    image_url: row.imageUrl,
    caption: row.caption,
    taken_at: row.takenAt,
    xp_awarded: row.xpAwarded,
  };
}

function rowToAchievement(row: AchievementRow) {
  return {
    id: row.id,
    achievement_key: row.achievementKey,
    type: row.type,
    title: row.title,
    description: row.description,
    badge_image: row.badgeImage,
    unlocked_at: row.unlockedAt,
    xp_awarded: row.xpAwarded,
  };
}

async function ensureProfile(userId: string): Promise<ProfileRow> {
  const db = getDb();
  const [existing] = await db
    .select()
    .from(schema.travelerProfile)
    .where(eq(schema.travelerProfile.userId, userId))
    .limit(1);
  if (existing) return existing;
  const [created] = await db
    .insert(schema.travelerProfile)
    .values({ userId })
    .returning();
  return created!;
}

async function recalculateProfile(userId: string): Promise<ProfileRow> {
  const db = getDb();
  const [places, photos, achievements] = await Promise.all([
    db
      .select()
      .from(schema.travelerPlace)
      .where(eq(schema.travelerPlace.userId, userId)),
    db
      .select()
      .from(schema.travelerPhoto)
      .where(eq(schema.travelerPhoto.userId, userId)),
    db
      .select()
      .from(schema.travelerAchievement)
      .where(eq(schema.travelerAchievement.userId, userId)),
  ]);
  const visited = places.filter((place) => place.status === "visited");
  const xpTotal =
    places.reduce((sum, row) => sum + row.xpAwarded, 0) +
    photos.reduce((sum, row) => sum + row.xpAwarded, 0) +
    achievements.reduce((sum, row) => sum + row.xpAwarded, 0);
  const level = levelFromXp(xpTotal);

  const [profile] = await db
    .insert(schema.travelerProfile)
    .values({
      userId,
      ...level,
      xpTotal,
      visitedCountryCount: new Set(visited.map((row) => row.country)).size,
      visitedCityCount: new Set(visited.map((row) => row.city ?? row.name)).size,
      visitedPlaceCount: visited.length,
      photoCount: photos.length,
      achievementCount: achievements.length,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: schema.travelerProfile.userId,
      set: {
        ...level,
        xpTotal,
        visitedCountryCount: new Set(visited.map((row) => row.country)).size,
        visitedCityCount: new Set(visited.map((row) => row.city ?? row.name)).size,
        visitedPlaceCount: visited.length,
        photoCount: photos.length,
        achievementCount: achievements.length,
        updatedAt: new Date(),
      },
    })
    .returning();
  return profile!;
}

async function buildDashboard(userId: string) {
  const db = getDb();
  let profile = await ensureProfile(userId);
  const [places, photos, achievements] = await Promise.all([
    db
      .select()
      .from(schema.travelerPlace)
      .where(eq(schema.travelerPlace.userId, userId))
      .orderBy(desc(schema.travelerPlace.visitedAt)),
    db
      .select()
      .from(schema.travelerPhoto)
      .where(eq(schema.travelerPhoto.userId, userId))
      .orderBy(desc(schema.travelerPhoto.takenAt)),
    db
      .select()
      .from(schema.travelerAchievement)
      .where(eq(schema.travelerAchievement.userId, userId))
      .orderBy(desc(schema.travelerAchievement.unlockedAt)),
  ]);
  profile = await recalculateProfile(userId);

  const photoCounts = new Map<string, number>();
  for (const photo of photos) {
    if (!photo.placeId) continue;
    photoCounts.set(photo.placeId, (photoCounts.get(photo.placeId) ?? 0) + 1);
  }

  const visited = places.filter((place) => place.status === "visited");
  const continentStats = Object.entries(CONTINENT_TARGETS).map(([continent, target]) => {
    const count = new Set(
      visited
        .filter((place) => place.continent === continent)
        .map((place) => place.country),
    ).size;
    return {
      continent,
      count,
      target,
      percent: Math.round((count / target) * 100),
    };
  });

  return {
    profile: rowToProfile(profile),
    stats: {
      visited_countries: profile.visitedCountryCount,
      visited_cities: profile.visitedCityCount,
      visited_places: profile.visitedPlaceCount,
      photos: profile.photoCount,
      achievements: profile.achievementCount,
      world_progress_percent: Math.round((profile.visitedCountryCount / 195) * 100),
    },
    places: places.map((place) => rowToPlace(place, photoCounts.get(place.id) ?? 0)),
    visited_places: visited.map((place) => rowToPlace(place, photoCounts.get(place.id) ?? 0)),
    wishlist: places
      .filter((place) => place.status === "wishlist")
      .map((place) => rowToPlace(place, photoCounts.get(place.id) ?? 0)),
    photos: photos.map(rowToPhoto),
    achievements: achievements.map(rowToAchievement),
    continent_progress: continentStats,
    recent_footprints: visited.slice(0, 5).map((place) => rowToPlace(place, photoCounts.get(place.id) ?? 0)),
  };
}

collectionRouter.get("/", async (c) => {
  const user = getUser(c);
  const payload = await buildDashboard(user.id);
  return c.json(payload);
});

collectionRouter.post("/places", async (c) => {
  const user = getUser(c);
  const parsed = placeInput.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return c.json({ error: "invalid_body", issues: parsed.error.issues }, 400);
  const input = parsed.data;
  const placeKey =
    input.place_key ?? slug(`${input.country}-${input.city ?? ""}-${input.name}`);
  const xpAwarded = xpForPlace(input);
  const db = getDb();
  const [place] = await db
    .insert(schema.travelerPlace)
    .values({
      userId: user.id,
      placeKey,
      name: input.name,
      nameI18n: input.name_i18n,
      country: input.country,
      countryCode: input.country_code ?? null,
      city: input.city ?? null,
      continent: input.continent,
      kind: input.kind,
      status: input.status,
      visitedAt: input.visited_at ?? null,
      coverImage: input.cover_image ?? null,
      lat: input.lat ?? null,
      lng: input.lng ?? null,
      favorite: input.favorite,
      sourceTripId: input.source_trip_id ?? null,
      notes: input.notes,
      xpAwarded,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [schema.travelerPlace.userId, schema.travelerPlace.placeKey],
      set: {
        name: input.name,
        nameI18n: input.name_i18n,
        country: input.country,
        countryCode: input.country_code ?? null,
        city: input.city ?? null,
        continent: input.continent,
        kind: input.kind,
        status: input.status,
        visitedAt: input.visited_at ?? null,
        coverImage: input.cover_image ?? null,
        lat: input.lat ?? null,
        lng: input.lng ?? null,
        favorite: input.favorite,
        sourceTripId: input.source_trip_id ?? null,
        notes: input.notes,
        xpAwarded,
        updatedAt: new Date(),
      },
    })
    .returning();
  await recalculateProfile(user.id);
  return c.json({ place: rowToPlace(place!) }, 201);
});

collectionRouter.patch("/places/:id", async (c) => {
  const user = getUser(c);
  const id = c.req.param("id");
  const parsed = placePatch.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return c.json({ error: "invalid_body", issues: parsed.error.issues }, 400);
  const patch = parsed.data;
  const set: Partial<typeof schema.travelerPlace.$inferInsert> = { updatedAt: new Date() };
  if (patch.name != null) set.name = patch.name;
  if (patch.name_i18n != null) set.nameI18n = patch.name_i18n;
  if (patch.country != null) set.country = patch.country;
  if (patch.country_code !== undefined) set.countryCode = patch.country_code ?? null;
  if (patch.city !== undefined) set.city = patch.city ?? null;
  if (patch.continent != null) set.continent = patch.continent;
  if (patch.kind != null) set.kind = patch.kind;
  if (patch.status != null) set.status = patch.status;
  if (patch.visited_at !== undefined) set.visitedAt = patch.visited_at ?? null;
  if (patch.cover_image !== undefined) set.coverImage = patch.cover_image ?? null;
  if (patch.lat !== undefined) set.lat = patch.lat ?? null;
  if (patch.lng !== undefined) set.lng = patch.lng ?? null;
  if (patch.favorite !== undefined) set.favorite = patch.favorite;
  if (patch.source_trip_id !== undefined) set.sourceTripId = patch.source_trip_id ?? null;
  if (patch.notes != null) set.notes = patch.notes;

  const [place] = await getDb()
    .update(schema.travelerPlace)
    .set(set)
    .where(and(eq(schema.travelerPlace.id, id), eq(schema.travelerPlace.userId, user.id)))
    .returning();
  if (!place) return c.json({ error: "not_found" }, 404);
  await recalculateProfile(user.id);
  return c.json({ place: rowToPlace(place) });
});

collectionRouter.post("/photos", async (c) => {
  const user = getUser(c);
  const parsed = photoInput.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return c.json({ error: "invalid_body", issues: parsed.error.issues }, 400);
  const input = parsed.data;
  const photoKey = input.photo_key ?? slug(`${input.image_url}-${input.caption}`);
  const [photo] = await getDb()
    .insert(schema.travelerPhoto)
    .values({
      userId: user.id,
      photoKey,
      placeId: input.place_id ?? null,
      tripId: input.trip_id ?? null,
      imageUrl: input.image_url,
      caption: input.caption,
      takenAt: input.taken_at ?? null,
      xpAwarded: 10,
    })
    .onConflictDoUpdate({
      target: [schema.travelerPhoto.userId, schema.travelerPhoto.photoKey],
      set: {
        placeId: input.place_id ?? null,
        tripId: input.trip_id ?? null,
        imageUrl: input.image_url,
        caption: input.caption,
        takenAt: input.taken_at ?? null,
      },
    })
    .returning();
  await recalculateProfile(user.id);
  return c.json({ photo: rowToPhoto(photo!) }, 201);
});

collectionRouter.post("/seed", async (c) => {
  const user = getUser(c);
  await seedCollection(user.id);
  const payload = await buildDashboard(user.id);
  return c.json({ seeded: true, ...payload });
});

async function seedCollection(userId: string) {
  const db = getDb();
  const places = SAMPLE_PLACES.map((place) => ({
    userId,
    placeKey: place.place_key,
    name: place.name,
    nameI18n: place.name_i18n,
    country: place.country,
    countryCode: place.country_code,
    city: place.city,
    continent: place.continent,
    kind: place.kind,
    status: place.status,
    visitedAt: place.visited_at,
    coverImage: place.cover_image,
    lat: place.lat,
    lng: place.lng,
    favorite: place.favorite,
    notes: place.notes,
    xpAwarded: xpForPlace(place),
    metadata: { seeded: true },
    updatedAt: new Date(),
  }));
  await db
    .insert(schema.travelerPlace)
    .values(places)
    .onConflictDoUpdate({
      target: [schema.travelerPlace.userId, schema.travelerPlace.placeKey],
      set: {
        status: "visited",
        favorite: true,
        metadata: { seeded: true },
        updatedAt: new Date(),
      },
    });

  const seededPlaces = await db
    .select()
    .from(schema.travelerPlace)
    .where(eq(schema.travelerPlace.userId, userId));
  const placeByKey = new Map(seededPlaces.map((place) => [place.placeKey, place]));
  await db
    .insert(schema.travelerPhoto)
    .values(
      SAMPLE_PHOTOS.flatMap((photo) => {
        const place = placeByKey.get(photo.place_key);
        if (!place) return [];
        return [{
          userId,
          photoKey: photo.photo_key,
          placeId: place.id,
          imageUrl: photo.image_url,
          caption: photo.caption,
          takenAt: photo.taken_at,
          xpAwarded: 10,
          metadata: { seeded: true },
        }];
      }),
    )
    .onConflictDoNothing({
      target: [schema.travelerPhoto.userId, schema.travelerPhoto.photoKey],
    });

  await db
    .insert(schema.travelerAchievement)
    .values(
      SAMPLE_ACHIEVEMENTS.map((achievement) => ({
        userId,
        achievementKey: achievement.achievement_key,
        type: achievement.type,
        title: achievement.title,
        description: achievement.description,
        badgeImage: achievement.badge_image,
        unlockedAt: achievement.unlocked_at,
        xpAwarded: achievement.xp_awarded,
        metadata: { seeded: true },
      })),
    )
    .onConflictDoNothing({
      target: [
        schema.travelerAchievement.userId,
        schema.travelerAchievement.achievementKey,
      ],
    });
  await recalculateProfile(userId);
}

const SAMPLE_PLACES = [
  {
    place_key: "fr-paris",
    name: "Paris",
    name_i18n: { "zh-TW": "巴黎", en: "Paris" },
    country: "France",
    country_code: "FR",
    city: "Paris",
    continent: "Europe",
    kind: "city",
    status: "visited" as const,
    visited_at: "2024-12-20",
    cover_image: "/illustrations/cities/paris.jpg",
    lat: 48.8566,
    lng: 2.3522,
    favorite: true,
    notes: "Winter lights and museum walks.",
  },
  {
    place_key: "jp-fuji",
    name: "Mount Fuji",
    name_i18n: { "zh-TW": "富士山", en: "Mount Fuji" },
    country: "Japan",
    country_code: "JP",
    city: "Yamanashi",
    continent: "Asia",
    kind: "natural",
    status: "visited" as const,
    visited_at: "2024-11-18",
    cover_image: "/illustrations/cities/hokkaido.jpg",
    lat: 35.3606,
    lng: 138.7274,
    favorite: true,
    notes: "Clear morning view from the lake.",
  },
  {
    place_key: "gr-santorini",
    name: "Santorini",
    name_i18n: { "zh-TW": "聖托里尼", en: "Santorini" },
    country: "Greece",
    country_code: "GR",
    city: "Santorini",
    continent: "Europe",
    kind: "city",
    status: "visited" as const,
    visited_at: "2024-10-02",
    cover_image: "/illustrations/events/japan-gion-matsuri-2026.png",
    lat: 36.3932,
    lng: 25.4615,
    favorite: true,
    notes: "Blue domes, sea wind, and a slow sunset.",
  },
  {
    place_key: "us-new-york",
    name: "New York",
    name_i18n: { "zh-TW": "紐約", en: "New York" },
    country: "United States",
    country_code: "US",
    city: "New York",
    continent: "North America",
    kind: "city",
    status: "visited" as const,
    visited_at: "2024-09-05",
    cover_image: "/illustrations/cities/new-york.jpg",
    lat: 40.7128,
    lng: -74.006,
    favorite: true,
    notes: "A skyline that makes jet lag feel useful.",
  },
  {
    place_key: "id-bali",
    name: "Bali",
    name_i18n: { "zh-TW": "峇里島", en: "Bali" },
    country: "Indonesia",
    country_code: "ID",
    city: "Bali",
    continent: "Asia",
    kind: "culture",
    status: "visited" as const,
    visited_at: "2024-08-18",
    cover_image: "/illustrations/cities/bangkok.jpg",
    lat: -8.3405,
    lng: 115.092,
    favorite: true,
    notes: "Temples, beaches, and soft evenings.",
  },
  {
    place_key: "it-rome-colosseum",
    name: "Colosseum",
    name_i18n: { "zh-TW": "羅馬競技場", en: "Colosseum" },
    country: "Italy",
    country_code: "IT",
    city: "Rome",
    continent: "Europe",
    kind: "historic",
    status: "visited" as const,
    visited_at: "2024-07-22",
    cover_image: "/illustrations/cities/rome.jpg",
    lat: 41.8902,
    lng: 12.4922,
    favorite: true,
    notes: "Ancient stone and late-afternoon light.",
  },
  {
    place_key: "au-great-barrier-reef",
    name: "Great Barrier Reef",
    name_i18n: { "zh-TW": "大堡礁", en: "Great Barrier Reef" },
    country: "Australia",
    country_code: "AU",
    city: "Queensland",
    continent: "Oceania",
    kind: "natural",
    status: "visited" as const,
    visited_at: "2024-06-15",
    cover_image: "/illustrations/cities/sydney.jpg",
    lat: -18.2871,
    lng: 147.6992,
    favorite: false,
    notes: "A blue world below the boat.",
  },
  {
    place_key: "jp-kyoto",
    name: "Kyoto",
    name_i18n: { "zh-TW": "京都", en: "Kyoto" },
    country: "Japan",
    country_code: "JP",
    city: "Kyoto",
    continent: "Asia",
    kind: "city",
    status: "visited" as const,
    visited_at: "2024-05-10",
    cover_image: "/illustrations/cities/kyoto.jpg",
    lat: 35.0116,
    lng: 135.7681,
    favorite: true,
    notes: "Shrines, coffee, and quiet alleys.",
  },
];

const SAMPLE_PHOTOS = SAMPLE_PLACES.flatMap((place, index) => [
  {
    photo_key: `${place.place_key}-cover`,
    place_key: place.place_key,
    image_url: place.cover_image,
    caption: `${place.name} memory`,
    taken_at: place.visited_at,
  },
  ...(index < 3
    ? [{
        photo_key: `${place.place_key}-detail`,
        place_key: place.place_key,
        image_url: place.cover_image,
        caption: `${place.name} detail`,
        taken_at: place.visited_at,
      }]
    : []),
]);

const SAMPLE_ACHIEVEMENTS = [
  {
    achievement_key: "first-footprint",
    type: "milestone",
    title: "First footprint",
    description: "Logged the first visited place.",
    badge_image: "/illustrations/event-icons/icon-14.png",
    unlocked_at: "2024-05-10",
    xp_awarded: 250,
  },
  {
    achievement_key: "asia-explorer",
    type: "continent",
    title: "Asia explorer",
    description: "Visited three places across Asia.",
    badge_image: "/illustrations/event-icons/icon-28.png",
    unlocked_at: "2024-11-18",
    xp_awarded: 180,
  },
  {
    achievement_key: "europe-loop",
    type: "continent",
    title: "Europe loop",
    description: "Collected multiple European memories.",
    badge_image: "/illustrations/event-icons/icon-29.png",
    unlocked_at: "2024-12-20",
    xp_awarded: 220,
  },
  {
    achievement_key: "photo-journal",
    type: "photo",
    title: "Photo journal",
    description: "Added ten travel photos.",
    badge_image: "/illustrations/event-icons/icon-01.png",
    unlocked_at: "2024-12-20",
    xp_awarded: 120,
  },
];
