import type { ApiCity, ApiCompanion } from "@/lib/trips-api";
import type { Trip } from "@/lib/trip-types";

import {
  BackendTripsPage,
  type BackendTripsLabels,
} from "@/components/storefront/trips/backend-trips-page";
import {
  TripPlanningWorkspace,
  type TripPlanningLabels,
} from "@/components/storefront/trips/trip-planning-workspace";

const BARCELONA_TO_LONDON: Trip = {
  id: "editorial-barcelona-london",
  title: "Barcelona to London",
  cover: "/illustrations/cities/barcelona.jpg",
  start: "2026-09-26",
  end: "2026-10-11",
  status: "upcoming",
  metadata: {
    source: "manual",
    draft: true,
    planning: {
      main_destinations: ["ES", "FR", "GB"],
      destination_days: [
        { country_code: "ES", days: 4 },
        { country_code: "FR", days: 5 },
        { country_code: "GB", days: 7 },
      ],
    },
  },
  days: [
    {
      d: "2026-09-26",
      city: "Barcelona",
      note: "Arrive and settle into Eixample",
      stops: [
        {
          id: "stop-sagrada",
          name: "Sagrada Família",
          placeName: "Basílica de la Sagrada Família",
          placeId: "editorial-sagrada",
          placeAddress: "Carrer de Mallorca, Barcelona",
          countryCode: "ES",
          kind: "sight",
          arrival_time: "14:00",
          duration_min: 120,
          note: "Tower entry booked",
          lat: 41.4036,
          lng: 2.1744,
          attachments: [],
        },
        {
          id: "stop-batllo",
          name: "Casa Batlló",
          placeName: "Casa Batlló",
          placeId: "editorial-batllo",
          countryCode: "ES",
          kind: "sight",
          arrival_time: "17:30",
          duration_min: 90,
          note: "Blue-hour visit",
          lat: 41.3917,
          lng: 2.1649,
          attachments: [],
        },
      ],
    },
    {
      d: "2026-09-27",
      city: "Barcelona",
      note: "Markets and the Gothic Quarter",
      stops: [
        {
          id: "stop-boqueria",
          name: "La Boqueria",
          placeName: "Mercat de la Boqueria",
          placeId: "editorial-boqueria",
          countryCode: "ES",
          kind: "meal",
          arrival_time: "11:30",
          duration_min: 90,
          note: "Lunch at the market counter",
          lat: 41.3817,
          lng: 2.1716,
          attachments: [],
        },
      ],
    },
    {
      d: "2026-09-29",
      city: "Paris",
      note: "Museums and Saint-Germain",
      stops: [
        {
          id: "stop-orangerie",
          name: "Musée de l'Orangerie",
          placeName: "Musée de l'Orangerie",
          placeId: "editorial-orangerie",
          countryCode: "FR",
          kind: "sight",
          arrival_time: "09:00",
          duration_min: 120,
          note: "Timed entry",
          lat: 48.8638,
          lng: 2.3227,
          attachments: [],
        },
        {
          id: "stop-marais",
          name: "Le Marais walk",
          placeName: "Le Marais",
          placeId: "editorial-marais",
          countryCode: "FR",
          kind: "sight",
          arrival_time: "14:30",
          duration_min: 150,
          note: "Galleries and independent shops",
          lat: 48.859,
          lng: 2.3622,
          attachments: [],
        },
      ],
    },
    {
      d: "2026-10-04",
      city: "London",
      note: "Museums and Covent Garden",
      stops: [
        {
          id: "stop-british-museum",
          name: "British Museum",
          placeName: "The British Museum",
          placeId: "editorial-british-museum",
          countryCode: "GB",
          kind: "sight",
          arrival_time: "10:00",
          duration_min: 180,
          note: "Start with the Great Court",
          lat: 51.5194,
          lng: -0.127,
          attachments: [],
        },
      ],
    },
  ],
  checklist: [
    {
      id: "check-flights",
      text: "Confirm train seats",
      done: true,
      kind: "transit",
      phase: "before_trip",
      groupLabel: "Transport",
    },
    {
      id: "check-esim",
      text: "Choose a Europe eSIM",
      done: false,
      kind: "esim",
      phase: "before_trip",
      groupLabel: "Connectivity",
    },
    {
      id: "check-insurance",
      text: "Save travel insurance",
      done: false,
      kind: "insurance",
      phase: "before_trip",
      groupLabel: "Preparation",
    },
  ],
};

const JAPAN_AUTUMN: Trip = {
  id: "editorial-japan-autumn",
  title: "Japan in autumn",
  cover: "/illustrations/cities/kyoto.jpg",
  start: "2026-11-10",
  end: "2026-11-20",
  status: "active",
  metadata: { source: "manual", draft: false },
  days: [
    { d: "2026-11-10", city: "Tokyo", note: "Arrive in Tokyo", stops: [] },
    { d: "2026-11-14", city: "Kyoto", note: "Temple day", stops: [] },
  ],
  checklist: [
    { id: "check-jr", text: "Book rail seats", done: true, kind: "transit" },
    { id: "check-stay", text: "Confirm Kyoto stay", done: false, kind: "stay" },
  ],
};

const CITIES: ApiCity[] = [
  { name: "Barcelona", lat: 41.3874, lng: 2.1686 },
  { name: "Paris", lat: 48.8566, lng: 2.3522 },
  { name: "London", lat: 51.5072, lng: -0.1276 },
];

const COMPANIONS: ApiCompanion[] = [
  {
    id: "companion-alex",
    trip_id: BARCELONA_TO_LONDON.id,
    display_name: "Alex",
    color: "teal",
    sort_order: 0,
    user_id: "fixture-alex",
    invite_token: null,
    accepted_at: "2026-07-01T08:00:00.000Z",
    role: "owner",
  },
  {
    id: "companion-mia",
    trip_id: BARCELONA_TO_LONDON.id,
    display_name: "Mia",
    color: "sand",
    sort_order: 1,
    user_id: "fixture-mia",
    invite_token: null,
    accepted_at: "2026-07-02T08:00:00.000Z",
    role: "companion",
  },
];

export function TripsEditorialFixture({
  lang,
  view,
  empty,
  listLabels,
  detailLabels,
}: {
  lang: string;
  view: "list" | "detail";
  empty: boolean;
  listLabels: BackendTripsLabels;
  detailLabels: TripPlanningLabels;
}) {
  if (view === "detail") {
    return (
      <TripPlanningWorkspace
        trip={BARCELONA_TO_LONDON}
        cities={CITIES}
        companions={COMPANIONS}
        lang={lang}
        labels={detailLabels}
        preview
      />
    );
  }

  return (
    <BackendTripsPage
      lang={lang}
      labels={listLabels}
      initialTrips={empty ? [] : [BARCELONA_TO_LONDON, JAPAN_AUTUMN]}
      preview
    />
  );
}
