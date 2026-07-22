export interface TravelerProfile {
  level: number;
  xp_total: number;
  xp_into_level: number;
  xp_to_next: number;
  visited_country_count: number;
  visited_city_count: number;
  visited_place_count: number;
  photo_count: number;
  achievement_count: number;
}

export interface TravelerPlace {
  id: string;
  place_key: string;
  name: string;
  name_i18n: Record<string, string>;
  country: string;
  country_code: string | null;
  city: string | null;
  continent: string;
  kind: string;
  status: "visited" | "wishlist";
  visited_at: string | null;
  cover_image: string | null;
  lat: number | null;
  lng: number | null;
  favorite: boolean;
  source_trip_id: string | null;
  notes: string;
  xp_awarded: number;
  photo_count: number;
}

export interface TravelerPhoto {
  id: string;
  photo_key: string;
  place_id: string | null;
  trip_id: string | null;
  image_url: string;
  caption: string;
  taken_at: string | null;
  xp_awarded: number;
}

export interface TravelerAchievement {
  id: string;
  achievement_key: string;
  type: string;
  title: string;
  description: string;
  badge_image: string | null;
  unlocked_at: string;
  xp_awarded: number;
}

export interface ContinentProgress {
  continent: string;
  count: number;
  target: number;
  percent: number;
}

export interface CollectionDashboard {
  profile: TravelerProfile;
  stats: {
    visited_countries: number;
    visited_cities: number;
    visited_places: number;
    photos: number;
    achievements: number;
    world_progress_percent: number;
  };
  places: TravelerPlace[];
  visited_places: TravelerPlace[];
  wishlist: TravelerPlace[];
  photos: TravelerPhoto[];
  achievements: TravelerAchievement[];
  continent_progress: ContinentProgress[];
  recent_footprints: TravelerPlace[];
}

export async function fetchCollectionDashboard(): Promise<CollectionDashboard> {
  const response = await fetch("/api/me/collection", {
    credentials: "same-origin",
    headers: { accept: "application/json" },
  });
  if (!response.ok) {
    const error = new Error(`collection_fetch_failed:${response.status}`);
    (error as Error & { status?: number }).status = response.status;
    throw error;
  }
  return (await response.json()) as CollectionDashboard;
}

export async function seedCollectionDashboard(): Promise<CollectionDashboard> {
  const response = await fetch("/api/me/collection/seed", {
    method: "POST",
    credentials: "same-origin",
    headers: { accept: "application/json" },
  });
  if (!response.ok) {
    const error = new Error(`collection_seed_failed:${response.status}`);
    (error as Error & { status?: number }).status = response.status;
    throw error;
  }
  return (await response.json()) as CollectionDashboard;
}

export function sampleCollectionDashboard(): CollectionDashboard {
  const places: TravelerPlace[] = [
    samplePlace("p-paris", "Paris", "巴黎", "France", "Europe", "city", "2024-12-20", "/illustrations/cities/paris.jpg", true),
    samplePlace("p-fuji", "Mount Fuji", "富士山", "Japan", "Asia", "natural", "2024-11-18", "/illustrations/cities/tokyo.jpg", true),
    samplePlace("p-santorini", "Santorini", "聖托里尼", "Greece", "Europe", "city", "2024-10-02", "/illustrations/cities/europe.jpg", true),
    samplePlace("p-new-york", "New York", "紐約", "United States", "North America", "city", "2024-09-05", "/illustrations/cities/new-york.jpg", true),
    samplePlace("p-bali", "Bali", "峇里島", "Indonesia", "Asia", "culture", "2024-08-18", "/illustrations/cities/jakarta.jpg", false),
    samplePlace("p-rome", "Colosseum", "羅馬競技場", "Italy", "Europe", "historic", "2024-07-22", "/illustrations/cities/rome.jpg", false),
    samplePlace("p-reef", "Great Barrier Reef", "大堡礁", "Australia", "Oceania", "natural", "2024-06-15", "/illustrations/cities/sydney.jpg", false),
    samplePlace("p-kyoto", "Kyoto", "京都", "Japan", "Asia", "city", "2024-05-10", "/illustrations/cities/kyoto.jpg", true),
  ];
  const achievements: TravelerAchievement[] = [
    sampleAchievement("a-paris", "Paris first steps", "巴黎初體驗", "2024-12-20"),
    sampleAchievement("a-fuji", "Fuji sunrise", "富士山晨光", "2024-11-18"),
    sampleAchievement("a-island", "Island collector", "海島愛好者", "2024-10-02"),
    sampleAchievement("a-history", "History seeker", "古城探索家", "2024-09-15"),
    sampleAchievement("a-food", "Local table", "美食體驗家", "2024-08-30"),
  ];

  return {
    profile: {
      level: 12,
      xp_total: 11750,
      xp_into_level: 750,
      xp_to_next: 1000,
      visited_country_count: 23,
      visited_city_count: 68,
      visited_place_count: 135,
      photo_count: 135,
      achievement_count: 12,
    },
    stats: {
      visited_countries: 23,
      visited_cities: 68,
      visited_places: 135,
      photos: 135,
      achievements: 12,
      world_progress_percent: 11,
    },
    places,
    visited_places: places,
    wishlist: [],
    photos: places.map((place, index) => ({
      id: `photo-${place.id}`,
      photo_key: `sample-${place.place_key}`,
      place_id: place.id,
      trip_id: null,
      image_url: place.cover_image ?? "",
      caption: place.name,
      taken_at: place.visited_at,
      xp_awarded: 10 + index,
    })),
    achievements,
    continent_progress: [
      { continent: "Asia", count: 18, target: 50, percent: 36 },
      { continent: "Europe", count: 11, target: 50, percent: 22 },
      { continent: "North America", count: 7, target: 50, percent: 15 },
      { continent: "South America", count: 4, target: 50, percent: 8 },
      { continent: "Africa", count: 2, target: 50, percent: 5 },
      { continent: "Oceania", count: 3, target: 10, percent: 30 },
    ],
    recent_footprints: places.slice(0, 5),
  };
}

function samplePlace(
  id: string,
  name: string,
  zhName: string,
  country: string,
  continent: string,
  kind: string,
  visitedAt: string,
  coverImage: string,
  favorite: boolean,
): TravelerPlace {
  return {
    id,
    place_key: id,
    name,
    name_i18n: { en: name, "zh-TW": zhName },
    country,
    country_code: null,
    city: name,
    continent,
    kind,
    status: "visited",
    visited_at: visitedAt,
    cover_image: coverImage,
    lat: null,
    lng: null,
    favorite,
    source_trip_id: null,
    notes: "",
    xp_awarded: 60,
    photo_count: 6,
  };
}

function sampleAchievement(
  id: string,
  title: string,
  zhTitle: string,
  unlockedAt: string,
): TravelerAchievement {
  return {
    id,
    achievement_key: id,
    type: "travel",
    title,
    description: zhTitle,
    badge_image: null,
    unlocked_at: unlockedAt,
    xp_awarded: 120,
  };
}
