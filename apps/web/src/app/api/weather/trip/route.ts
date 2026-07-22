type WeatherPointInput = {
  date: string;
  location: string;
  lat: number;
  lng: number;
};

type DailyWeather = {
  date: string;
  location: string;
  lat: number;
  lng: number;
  source: "forecast" | "historical_average";
  reliability: "high" | "medium" | "low";
  temperature_max_c: number | null;
  temperature_min_c: number | null;
  precipitation_mm: number | null;
  precipitation_probability_pct: number | null;
  weather_code: number | null;
  sample_years: number;
};

type OpenMeteoDaily = {
  time?: string[];
  weather_code?: Array<number | null>;
  temperature_2m_max?: Array<number | null>;
  temperature_2m_min?: Array<number | null>;
  precipitation_sum?: Array<number | null>;
  precipitation_probability_max?: Array<number | null>;
};

type OpenMeteoResponse = {
  daily?: OpenMeteoDaily;
};

export const dynamic = "force-dynamic";

const FORECAST_DAYS = 16;
const HISTORY_YEARS = 10;
const MAX_POINTS = 6;

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    points?: unknown;
  } | null;
  const points = Array.isArray(body?.points)
    ? body.points.map(parseWeatherPoint).filter((point): point is WeatherPointInput => !!point)
    : [];

  if (points.length === 0) {
    return Response.json({
      generated_at: new Date().toISOString(),
      sources: weatherSources(),
      items: [],
    });
  }

  const limitedPoints = uniqueWeatherPoints(points).slice(0, MAX_POINTS);
  const items = await Promise.all(
    limitedPoints.map((point) => weatherForPoint(point)),
  );

  return Response.json({
    generated_at: new Date().toISOString(),
    sources: weatherSources(),
    items,
  });
}

function parseWeatherPoint(value: unknown): WeatherPointInput | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const date = typeof record.date === "string" ? record.date : "";
  const location = typeof record.location === "string" ? record.location : "";
  const lat = Number(record.lat);
  const lng = Number(record.lng);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  if (!location.trim() || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { date, location: location.trim(), lat, lng };
}

function uniqueWeatherPoints(points: WeatherPointInput[]): WeatherPointInput[] {
  const seen = new Set<string>();
  const unique: WeatherPointInput[] = [];
  for (const point of points) {
    const key = `${point.date}:${point.location}:${point.lat.toFixed(3)}:${point.lng.toFixed(3)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(point);
  }
  return unique;
}

async function weatherForPoint(point: WeatherPointInput): Promise<DailyWeather> {
  if (isWithinForecastWindow(point.date)) {
    const forecast = await fetchForecast(point).catch(() => null);
    if (forecast) return forecast;
  }
  return fetchHistoricalAverage(point).catch(() => ({
    date: point.date,
    location: point.location,
    lat: point.lat,
    lng: point.lng,
    source: "historical_average",
    reliability: "low",
    temperature_max_c: null,
    temperature_min_c: null,
    precipitation_mm: null,
    precipitation_probability_pct: null,
    weather_code: null,
    sample_years: 0,
  }));
}

function isWithinForecastWindow(date: string): boolean {
  const today = startOfUtcDay(new Date());
  const target = dateToUtc(date);
  const diffDays = Math.floor((target.getTime() - today.getTime()) / 86_400_000);
  return diffDays >= 0 && diffDays < FORECAST_DAYS;
}

async function fetchForecast(point: WeatherPointInput): Promise<DailyWeather | null> {
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", String(point.lat));
  url.searchParams.set("longitude", String(point.lng));
  url.searchParams.set(
    "daily",
    "weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max",
  );
  url.searchParams.set("timezone", "auto");
  url.searchParams.set("start_date", point.date);
  url.searchParams.set("end_date", point.date);

  const data = await fetchJson<OpenMeteoResponse>(url);
  const daily = data?.daily;
  const index = daily?.time?.indexOf(point.date) ?? -1;
  if (!daily || index < 0) return null;
  const daysAway = Math.floor(
    (dateToUtc(point.date).getTime() - startOfUtcDay(new Date()).getTime()) /
      86_400_000,
  );
  return {
    date: point.date,
    location: point.location,
    lat: point.lat,
    lng: point.lng,
    source: "forecast",
    reliability: daysAway <= 7 ? "high" : "medium",
    temperature_max_c: daily.temperature_2m_max?.[index] ?? null,
    temperature_min_c: daily.temperature_2m_min?.[index] ?? null,
    precipitation_mm: daily.precipitation_sum?.[index] ?? null,
    precipitation_probability_pct:
      daily.precipitation_probability_max?.[index] ?? null,
    weather_code: daily.weather_code?.[index] ?? null,
    sample_years: 0,
  };
}

async function fetchHistoricalAverage(point: WeatherPointInput): Promise<DailyWeather> {
  const target = dateToUtc(point.date);
  const currentYear = new Date().getUTCFullYear();
  const samples: DailyWeather[] = [];

  for (let offset = 1; offset <= HISTORY_YEARS; offset++) {
    const year = currentYear - offset;
    const sampleDate = isoDate(
      new Date(Date.UTC(year, target.getUTCMonth(), target.getUTCDate())),
    );
    const url = new URL("https://archive-api.open-meteo.com/v1/archive");
    url.searchParams.set("latitude", String(point.lat));
    url.searchParams.set("longitude", String(point.lng));
    url.searchParams.set(
      "daily",
      "weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum",
    );
    url.searchParams.set("timezone", "auto");
    url.searchParams.set("start_date", sampleDate);
    url.searchParams.set("end_date", sampleDate);
    url.searchParams.set("models", "era5_seamless");

    const data = await fetchJson<OpenMeteoResponse>(url).catch(() => null);
    const daily = data?.daily;
    if (!daily?.time?.length) continue;
    samples.push({
      date: point.date,
      location: point.location,
      lat: point.lat,
      lng: point.lng,
      source: "historical_average",
      reliability: "medium",
      temperature_max_c: daily.temperature_2m_max?.[0] ?? null,
      temperature_min_c: daily.temperature_2m_min?.[0] ?? null,
      precipitation_mm: daily.precipitation_sum?.[0] ?? null,
      precipitation_probability_pct: null,
      weather_code: daily.weather_code?.[0] ?? null,
      sample_years: 1,
    });
  }

  return {
    date: point.date,
    location: point.location,
    lat: point.lat,
    lng: point.lng,
    source: "historical_average",
    reliability: samples.length >= 7 ? "medium" : "low",
    temperature_max_c: average(samples.map((sample) => sample.temperature_max_c)),
    temperature_min_c: average(samples.map((sample) => sample.temperature_min_c)),
    precipitation_mm: average(samples.map((sample) => sample.precipitation_mm)),
    precipitation_probability_pct: null,
    weather_code: mode(samples.map((sample) => sample.weather_code)),
    sample_years: samples.length,
  };
}

async function fetchJson<T>(url: URL): Promise<T> {
  const response = await fetch(url, {
    cache: "no-store",
    headers: { accept: "application/json" },
  });
  if (!response.ok) {
    throw new Error(`weather request failed: ${response.status}`);
  }
  return (await response.json()) as T;
}

function average(values: Array<number | null>): number | null {
  const clean = values.filter((value): value is number => Number.isFinite(value));
  if (!clean.length) return null;
  return round(clean.reduce((sum, value) => sum + value, 0) / clean.length, 1);
}

function mode(values: Array<number | null>): number | null {
  const counts = new Map<number, number>();
  for (const value of values) {
    if (value == null || !Number.isFinite(value)) continue;
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}

function round(value: number, precision: number): number {
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
}

function dateToUtc(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year ?? 1970, (month ?? 1) - 1, day ?? 1));
}

function startOfUtcDay(value: Date): Date {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}

function isoDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function weatherSources() {
  return {
    forecast: {
      name: "Open-Meteo Forecast API",
      url: "https://open-meteo.com/en/docs",
    },
    historical_average: {
      name: "Open-Meteo Historical Weather API",
      dataset: "ERA5-Seamless reanalysis",
      url: "https://open-meteo.com/en/docs/historical-weather-api",
      sample_years: HISTORY_YEARS,
    },
  };
}
