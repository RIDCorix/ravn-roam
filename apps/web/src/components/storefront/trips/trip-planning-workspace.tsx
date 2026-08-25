"use client";

import Image from "next/image";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  closestCenter,
  DndContext,
  pointerWithin,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Handle,
  MarkerType,
  Position,
  ReactFlow,
  type Edge,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import {
  ArrowDownUp,
  BedDouble,
  BookMarked,
  CalendarDays,
  CarFront,
  Camera,
  CalendarCheck,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  ExternalLink,
  GripVertical,
  Globe,
  Heart,
  HeartOff,
  House,
  MapPin,
  Menu,
  MoreHorizontal,
  CircleAlert,
  Pause,
  PencilLine,
  Plane,
  Play,
  Plus,
  Loader2,
  MessageSquareText,
  Phone,
  ReceiptText,
  Save,
  Search,
  Share2,
  Star,
  Ticket,
  TrainFront,
  Trash2,
  Upload,
  Utensils,
  WalletCards,
  X,
  type LucideIcon,
} from "lucide-react";
import {
  type CSSProperties,
  type ChangeEvent,
  type FormEvent,
  Fragment,
  type MouseEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { DateRange as DayPickerDateRange } from "react-day-picker";

import {
  CompanionsMenu,
  type CompanionsMenuLabels,
} from "@/components/storefront/trips/companions-menu";
import { SPOTLIGHT_EVENTS } from "@/components/storefront/explore/explore-spotlight";
import {
  StorefrontTabs,
  StorefrontTabsList,
  StorefrontTabsTrigger,
} from "@/components/storefront/storefront-tabs";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { TabsContent } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { loadGoogleMaps, loadGooglePlaces } from "@/lib/google-maps";
import { compressImageToDataUrl } from "@/lib/image-compression";
import { refreshTrip } from "@/lib/trip-cache";
import {
  isRegionalTripStop,
  normalizeTripStopAnchorMode,
  type ChecklistItem,
  type Trip,
  type TripDaySegment,
  type TripPlaceSuggestion,
  type TripStop,
  type TripStopAttachment,
} from "@/lib/trip-types";
import type { ApiCity, ApiCompanion } from "@/lib/trips-api";
import {
  buildExploreFlights,
  ExploreFlightsBoard,
  ExploreFlightsPanel,
  ExploreStageMap,
  LumiTakeoverOverlay,
  TripDateRangePicker,
  playPinDropSound,
  readExplorationCities,
  type ExploreCity,
  type ExploreFlightDetails,
  type ExploreSearchResult,
  type TakeoverFlightDetails,
} from "@/components/storefront/trips/trip-explore-stage";
import { cn } from "@/lib/utils";
import {
  TripPlanningSheet,
  type PlanningDepthLabels,
  type PlanningSheetDay,
} from "./trip-planning-sheet";
import { useDebouncedVersionedSave } from "@/lib/use-debounced-versioned-save";

import {
  LocationSelector,
  type LocationSelection,
  type LocationSelectorLabels,
} from "@/components/storefront/location-selector";
import {
  createFallbackTravelSegments,
  resolveTravelSegments,
  type TripMapActiveTravelSegment,
  type TravelModeKind,
  type TravelSegment,
  type TripMapCity,
  type TripMapPoiHighlight,
  type TripMapPoiClick,
  type TripMapTravelStop,
  type TripMapViewport,
} from "./trip-map";
import {
  EditorialCover,
  EditorialMasthead,
  EditorialRouteStamp,
} from "./trip-editorial-ui";
import { TripTitleEditor } from "./trip-title-editor";

export type TripPlanningLabels = {
  planning_depth: PlanningDepthLabels;
  back_to_trips: string;
  explore_stage: {
    title: string;
    subtitle: string;
    search_placeholder: string;
    searching: string;
    no_results: string;
    selected_label: string;
    empty_hint: string;
    remove: string;
    add: string;
    map_hint: string;
    cancel: string;
    next_flights: string;
  };
  explore_flights: {
    title: string;
    count: string;
    back: string;
    outbound: string;
    return_flight: string;
    leg: string;
    from_home: string;
    to_home: string;
    from_departure: string;
    to_departure: string;
    pending: string;
    search_flights: string;
    map_hint: string;
    departure_label: string;
    departure_pin: string;
    departure_missing_title: string;
    departure_missing_body: string;
    departure_set_cta: string;
    departure_change_cta: string;
    departure_search_placeholder: string;
    departure_no_results: string;
    departure_date_label: string;
    departure_time_label: string;
    flight_number_label: string;
    flight_number_placeholder: string;
    terminal_label: string;
    terminal_placeholder: string;
    gate_label: string;
    gate_placeholder: string;
    flight_details_empty: string;
  };
  date_range: {
    aria_label: string;
    locked_hint: string;
    apply: string;
    nights_suffix: string;
  };
  lumi_takeover: {
    intro: string;
    dates: string;
    places: string;
    done: string;
    asking: string;
    failed: string;
    answer_placeholder: string;
    send: string;
    dismiss: string;
  };
  share: string;
  export_trip: string;
  collaborative: string;
  route_preview: string;
  route_budget: string;
  daily_itinerary: string;
  map_autoplay: {
    play: string;
    pause: string;
  };
  map_travel: {
    walk: string;
    drive: string;
    transit: string;
    flight: string;
    min: string;
    hour: string;
    hour_min: string;
  };
  location_selector: LocationSelectorLabels;
  overview_label: string;
  overview_editor: {
    add_city: string;
    add_city_title: string;
    city_name_label: string;
    city_name_placeholder: string;
    add: string;
    cancel: string;
    delete_city: string;
    delete_city_title: string;
    delete_city_body: string;
    cannot_delete_last_city: string;
    review_title: string;
    route_changed: string;
    conflict_overlap: string;
    affected_days: string;
    affected_stops: string;
    transfer_delta: string;
    move_stops: string;
    keep_stops: string;
    review_days: string;
    add_stay: string;
    flight_details_title: string;
    flight_details_body: string;
    departure_time_label: string;
    departure_time_placeholder: string;
    duration_minutes_label: string;
    save_flight: string;
    overnight_transfer: string;
    edit_note_title: string;
    edit_note_body: string;
    note_label: string;
    note_placeholder: string;
    save_note: string;
    delete_day: string;
    delete_block: string;
    delete_day_body: string;
    delete_block_body: string;
    delete_segment_fill: string;
    delete_segment_gap: string;
    gap_warning: string;
    conflict_warning: string;
    overlap_warning: string;
    segment_mismatch_warning: string;
    warning_details: string;
    warning_date_range: string;
    warning_summary_overlap: string;
    warning_summary_mismatch: string;
    return_home: string;
    apply_change: string;
    resize_start: string;
    resize_end: string;
    drag_block: string;
    drag_day: string;
  };
  fly_to: string;
  stay_in: string;
  day_label: string;
  day_unit: string;
  no_stops: string;
  stop_actions: {
    delete: string;
    edit_time: string;
    auto_arrange?: string;
    auto_arranging?: string;
    auto_arranged?: string;
    auto_arrange_no_change?: string;
    auto_arrange_hours_blocked?: string;
    auto_arrange_failed?: string;
  };
  place_suggestions?: {
    title: string;
    searching: string;
    empty: string;
    add: string;
    adding: string;
    added: string;
    remove?: string;
    add_selected: string;
    selected_count: string;
    rating: string;
  };
  ticket_actions: {
    open: string;
    upload: string;
    uploading: string;
    uploaded: string;
    upload_error: string;
    screenshots: string;
    ticket_label: string;
    reservation_label: string;
    transfer_label: string;
    purchase_query: string;
  };
  lodging_stops: {
    start_label: string;
    end_label: string;
    stay_badge: string;
    placeholder_badge: string;
    placeholder_title: string;
    placeholder_subtitle: string;
    choose: string;
    home_label: string;
    home_title: string;
    home_subtitle: string;
    home_badge: string;
    set_home: string;
    add_other: string;
    assign_people: string;
    assignment_title: string;
    assignment_hint: string;
    assignment_everyone: string;
    home_dialog_title: string;
    home_dialog_description: string;
    home_search_placeholder: string;
    home_search: string;
    home_current: string;
    home_no_results: string;
    home_select: string;
    home_cancel: string;
    home_save: string;
    home_saving: string;
    home_saved: string;
    home_error: string;
    range_title: string;
    range_hint: string;
    settings_title: string;
    settings_description: string;
    check_in: string;
    check_out: string;
    choose_after_dates: string;
    save_dates: string;
    saving_dates: string;
    settings_error: string;
    add: string;
    adding: string;
    booking_button: string;
    booking_note: string;
    booking_no_price: string;
    overnight_badge: string;
    overnight_title: string;
    overnight_subtitle: string;
  };
  edit_title: string;
  title_save_error: string;
  more: string;
  tabs: {
    todos: string;
    notes: string;
    budget: string;
    lumi: string;
    open_inspector: string;
    close_inspector: string;
  };
  add_item: string;
  todo_count: string;
  planning_progress: {
    title: string;
    subtitle: string;
    done_label: string;
    current_label: string;
    upcoming_label: string;
    progress_label: string;
    activity_prompt: string;
    activity_chips: string[];
    inspiration_label: string;
    inspiration_placeholder: string;
    destinations_label: string;
    destinations_placeholder: string;
    add_destination: string;
    remove_destination: string;
    destinations_empty: string;
    destination_lookup_error: string;
    destination_days_label: string;
    destination_days_placeholder: string;
    date_range_label: string;
    duration_label: string;
    return_to_explore: string;
    returning_to_explore: string;
    flight_proof_title: string;
    flight_proof_body: string;
    save: string;
    saved: string;
    save_error: string;
    steps: Record<
      | "dreaming"
      | "timing"
      | "commit"
      | "macro"
      | "anchors"
      | "poi"
      | "routing"
      | "logistics"
      | "pretrip",
      {
        phase: string;
        title: string;
        body: string;
        done: string;
        next: string;
        cta: string;
      }
    >;
  };
  inspiration_explore: {
    title: string;
    subtitle: string;
    radar_title: string;
    radar_subtitle: string;
    hero_title: string;
    search_placeholder: string;
    reset_filters: string;
    category_rail_title: string;
    category_count: string;
    filter_all: string;
    notebook: string;
    notebook_title: string;
    notebook_empty: string;
    notebook_map_tab: string;
    want_to_go: string;
    saved_to_notebook: string;
    remove_saved: string;
    confirm_create: string;
    confirming_create: string;
    confirm_empty: string;
    confirm_error: string;
    details_title: string;
    select_country: string;
    selected_country: string;
    events: Array<{
      id: string;
      title: string;
      category: string;
      location: string;
      description: string;
      story_headline: string;
      story_timing_label: string;
      story_timing_value: string;
    }>;
  };
  todo_edit: string;
  todo_delete: string;
  todo_save: string;
  todo_cancel: string;
  todo_edit_placeholder: string;
  todo_save_error: string;
  todo_delete_error: string;
  sections: {
    preparation: string;
    transport: string;
    stay: string;
    sights: string;
  };
  fallback_items: {
    passport: string;
    esim: string;
    stay: string;
    places: string;
  };
  kind: Record<string, string>;
  notes_empty: string;
  note_editor: {
    title: string;
    subtitle: string;
    placeholder: string;
    empty: string;
  };
  budget_empty: string;
  budget_analysis: {
    title: string;
    total: string;
    confirmed: string;
    estimated: string;
    missing: string;
    per_day: string;
    categories: {
      flight: string;
      stay: string;
      food: string;
      transport: string;
      activities: string;
      other: string;
    };
    sources: {
      recorded: string;
      estimated: string;
    };
    sections: {
      breakdown: string;
      category_chart: string;
      daily_spend: string;
      details: string;
      gaps: string;
    };
    empty: string;
    estimate_note: string;
    missing_hint: string;
    day_label: string;
  };
  weather: {
    title: string;
    subtitle: string;
    loading: string;
    unavailable: string;
    forecast_source: string;
    history_source: string;
    reliability_label: string;
    reliability_high: string;
    reliability_medium: string;
    reliability_low: string;
    forecast_note: string;
    history_note: string;
    temperature: string;
    precipitation: string;
    precipitation_probability: string;
    sample_years: string;
  };
  journey_live: {
    eyebrow: string;
    title: string;
    body: string;
    current_stop: string;
    next_stop: string;
    today_progress: string;
    checked_in_label: string;
    checked_in: string;
    tickets_label: string;
    tickets_ready: string;
    calm_note: string;
    check_in: string;
    check_in_done: string;
    check_in_uploading: string;
    check_in_error: string;
  };
  lumi_prompt: string;
  map_search: {
    placeholder: string;
    nearby: {
      coffee: string;
      food: string;
      sights: string;
      stay?: string;
    };
    add: string;
    replace?: string;
    adding: string;
    no_results: string;
    error: string;
    drag_hint: string;
    clear: string;
    placeholder_context?: {
      heading: string;
      labels: Record<PlaceholderKind, string>;
      subtitles: Record<PlaceholderKind, string>;
    };
  };
  place_details: {
    title: string;
    loading: string;
    no_details: string;
    reviews: string;
    contact: string;
    hours: string;
    website: string;
    directions: string;
    menu: string;
    budget_label: string;
    budget_add: string;
    budget_placeholder: string;
    budget_save: string;
    budget_saving: string;
    budget_saved: string;
    budget_error: string;
    photo_previous: string;
    photo_next: string;
    review_search_placeholder: string;
    review_all: string;
    review_no_matches: string;
    review_stars: string;
    review_topics: Record<ReviewTopic, string>;
    food_traits: Record<PlaceFoodTrait, string>;
    close: string;
  };
  movement_details: {
    title: string;
    route: string;
    estimate: string;
    distance: string;
    duration: string;
    cost_range: string;
    booking_required: string;
    booking_body: string;
    upload: string;
    uploading: string;
    uploaded: string;
    upload_error: string;
    screenshot: string;
    estimated_by_google: string;
    close: string;
  };
  settings: {
    title: string;
    aria: string;
    trip_section: string;
    delete_trip: string;
    delete_confirm: string;
    delete_cancel: string;
    deleting: string;
    delete_error: string;
  };
  companions: CompanionsMenuLabels;
};

type ActiveItineraryView = "overview" | number;

type MapFocus =
  | { mode: "route"; index: number; source?: "manual" | "auto" | "added" }
  | { mode: "stop"; index: number; source?: "manual" | "auto" | "added" }
  | { mode: "movement"; fromIndex: number; toIndex: number; source?: "manual" | "auto" | "added" }
  | null;

type LodgingSearchRequest = {
  version: number;
  dayIndex: number;
  nightIndex: number;
  range?: LodgingDateRange;
};

type LodgingPlanContext = {
  defaultStartIndex: number;
  defaultEndIndex: number;
};

type LodgingDateRange = {
  startIndex: number;
  endIndex: number;
};

type LodgingSettingsTarget = {
  dayIndex: number;
  stopIndex: number;
  stop: TripDayModel["stops"][number];
};

type LodgingSettingsState = {
  dayIndex: number;
  position: DayLodgingAnchor["position"];
  target: LodgingSettingsTarget | null;
  range: LodgingDateRange;
};

type TripModel = {
  id: string;
  title: string;
  cover: string | null;
  destination: string;
  startDate: string;
  endDate: string;
  metadata: Record<string, unknown>;
  days: TripDayModel[];
  checklist: ChecklistGroup[];
  notes: string[];
};

type TripDayModel = {
  date: string;
  city: string;
  cities: string[];
  segments: TripDaySegment[];
  lat: number | null;
  lng: number | null;
  note: string;
  stops: Array<
    Required<Pick<TripStop, "name">> &
      Pick<
        TripStop,
        | "kind"
        | "arrival_time"
        | "duration_min"
        | "note"
        | "placeName"
        | "placeId"
        | "placeAddress"
        | "anchorMode"
        | "areaName"
        | "searchQuery"
        | "countryCode"
        | "placeTypes"
        | "suggestionCount"
        | "placeSuggestions"
        | "suggestionsStatus"
      > & {
        id?: string;
        attachments?: TripStopAttachment[];
        lat: number | null;
        lng: number | null;
      }
  >;
};

type JourneyLiveState = {
  dayIndex: number;
  stopIndex: number;
  visibleIndex: number;
  totalStops: number;
  day: TripDayModel;
  stop: TripDayModel["stops"][number];
  nextStop: TripDayModel["stops"][number] | null;
  checkedInCount: number;
  ticketDoneCount: number;
  ticketTotalCount: number;
};

type DayLodgingAnchor = {
  state: "home" | "stay" | "placeholder" | "overnight";
  label: string;
  title: string;
  subtitle: string;
  badge: string;
  position: "start" | "end";
  stop?: TripDayModel["stops"][number] | null;
};

type UserHomePlace = {
  name: string;
  address: string;
  lat: number;
  lng: number;
  placeId?: string | null;
};

type UserDeparturePlace = UserHomePlace & {
  id: string;
};

type RoutePoint = {
  city: string;
  lat: number | null;
  lng: number | null;
  dateLabel: string;
  days: number[];
};

type RouteDiagramNode = {
  city: string;
  dayIndexes: number[];
  routeIndex: number | null;
};

type RouteDiagramTransfer = {
  dayIndex: number;
  date: string;
  fromNodeIndex: number;
  toNodeIndex: number;
  extendedTransfer: boolean;
};

type RouteDiagramPlan = {
  nodes: RouteDiagramNode[];
  transfers: RouteDiagramTransfer[];
};

type RouteFlowCityNodeData = {
  city: string;
  dayLabels: { label: string; date: string }[];
  colorClassName: string;
  textClassName: string;
  borderClassName: string;
  ringClassName: string;
  active: boolean;
  routeIndex: number | null;
  emptyLabel: string;
};

type RouteFlowLaneNodeData = {
  city: string;
  colorClassName: string;
  textClassName: string;
  borderClassName: string;
};

type RouteFlowCityNode = Node<RouteFlowCityNodeData, "routeCity">;
type RouteFlowLaneNode = Node<RouteFlowLaneNodeData, "routeLane">;
type RouteFlowNode = RouteFlowCityNode | RouteFlowLaneNode;
type RouteFlowEdge = Edge<{ extendedTransfer: boolean }, "smoothstep">;

type ChecklistGroup = {
  key: string;
  title: string;
  done: number;
  items: ChecklistItem[];
  tint: string;
  Icon: LucideIcon;
};

type PlanningProgressStepKey =
  | "dreaming"
  | "timing"
  | "commit"
  | "macro"
  | "anchors"
  | "poi"
  | "routing"
  | "logistics"
  | "pretrip";

type PlanningProgressStep = {
  key: PlanningProgressStepKey;
  Icon: LucideIcon;
  done: boolean;
  signal: "empty" | "partial" | "ready";
};
type ExplorationStep = "places" | "flights";

const OPEN_LUMI_ASSISTANT_EVENT = "roam:open-lumi-assistant";

const COUNTRY_NAME_ZH: Record<string, string> = {
  AT: "奧地利",
  AU: "澳洲",
  BE: "比利時",
  BR: "巴西",
  CA: "加拿大",
  CH: "瑞士",
  CZ: "捷克",
  DE: "德國",
  DK: "丹麥",
  ES: "西班牙",
  FI: "芬蘭",
  FR: "法國",
  GB: "英國",
  GR: "希臘",
  HK: "香港",
  ID: "印尼",
  IS: "冰島",
  IT: "義大利",
  JP: "日本",
  KR: "韓國",
  MY: "馬來西亞",
  NL: "荷蘭",
  NO: "挪威",
  PT: "葡萄牙",
  SE: "瑞典",
  SG: "新加坡",
  TH: "泰國",
  TR: "土耳其",
  TW: "台灣",
  US: "美國",
};

const COUNTRY_INPUT_ALIASES: Record<string, string> = {
  australia: "AU",
  austria: "AT",
  belgium: "BE",
  brazil: "BR",
  canada: "CA",
  czechia: "CZ",
  "czech republic": "CZ",
  denmark: "DK",
  finland: "FI",
  france: "FR",
  germany: "DE",
  greece: "GR",
  "hong kong": "HK",
  iceland: "IS",
  indonesia: "ID",
  italy: "IT",
  japan: "JP",
  korea: "KR",
  malaysia: "MY",
  netherlands: "NL",
  norway: "NO",
  portugal: "PT",
  singapore: "SG",
  spain: "ES",
  sweden: "SE",
  switzerland: "CH",
  taiwan: "TW",
  thailand: "TH",
  turkey: "TR",
  "united kingdom": "GB",
  uk: "GB",
  "united states": "US",
  usa: "US",
  us: "US",
  澳洲: "AU",
  奧地利: "AT",
  比利時: "BE",
  巴西: "BR",
  加拿大: "CA",
  捷克: "CZ",
  丹麥: "DK",
  芬蘭: "FI",
  法國: "FR",
  德國: "DE",
  希臘: "GR",
  冰島: "IS",
  印尼: "ID",
  義大利: "IT",
  意大利: "IT",
  日本: "JP",
  韓國: "KR",
  南韓: "KR",
  荷蘭: "NL",
  挪威: "NO",
  葡萄牙: "PT",
  新加坡: "SG",
  西班牙: "ES",
  瑞典: "SE",
  瑞士: "CH",
  台灣: "TW",
  臺灣: "TW",
  泰國: "TH",
  土耳其: "TR",
  英國: "GB",
  美國: "US",
};

type TripPlanningMetadata = {
  inspiration: string;
  mainDestinations: string[];
  destinationDays: Array<{ countryCode: string; days: number }>;
  inspirationWishlist: InspirationWishlistItem[];
};

type InspirationWishlistItem = {
  id: string;
  title: string;
  category: string;
  location: string;
  description: string;
  countryCode: string;
  image: string;
  lat: number;
  lng: number;
  tone: "coral" | "gold" | "green" | "cyan" | "violet" | "rose";
};

type BudgetCategory =
  | "flight"
  | "stay"
  | "food"
  | "transport"
  | "activities"
  | "other";

type BudgetSource = "recorded" | "estimated";

type BudgetLine = {
  id: string;
  category: BudgetCategory;
  source: BudgetSource;
  label: string;
  detail: string;
  dayIndex: number;
  dayLabel: string;
  amount: number;
  rawAmount?: string;
};

type BudgetCategorySummary = {
  category: BudgetCategory;
  label: string;
  amount: number;
  recordedAmount: number;
  estimatedAmount: number;
  lines: BudgetLine[];
  Icon: LucideIcon;
  tint: string;
  color: string;
};

type BudgetDailySummary = {
  dayLabel: string;
  amount: number;
  recordedAmount: number;
  estimatedAmount: number;
};

type BudgetAnalysis = {
  total: number;
  recordedTotal: number;
  estimatedTotal: number;
  perDay: number;
  missingCount: number;
  categories: BudgetCategorySummary[];
  days: BudgetDailySummary[];
  lines: BudgetLine[];
};

type BudgetAnalysisLabels = TripPlanningLabels["budget_analysis"];

type LandmarkSearchResult = {
  id: string;
  placeId?: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  iconMaskUri?: string | null;
  iconBackgroundColor?: string | null;
  primaryType?: string | null;
  types?: string[];
  selected?: boolean;
};

const EMPTY_LANDMARK_SEARCH_RESULTS: LandmarkSearchResult[] = [];
const AIRPORT_TRANSFER_TRAVEL_MODE: TravelModeKind = "drive";
const USE_CORRIDOR_TABLE_OVERVIEW = true;

type NearbySearchKind = "coffee" | "food" | "sights" | "stay";
type PlaceholderKind = "stay" | "meal" | "coffee" | "activity" | "other";
type ActivePlaceholderSearch = {
  dayIndex: number;
  stopIndex: number;
  stopName: string;
  kind: PlaceholderKind;
  query: string;
} | null;

type PlaceFoodTrait =
  | "breakfast"
  | "brunch"
  | "lunch"
  | "dinner"
  | "coffee"
  | "vegetarian"
  | "delivery"
  | "dine_in"
  | "reservable";

type ReviewTopic = "environment" | "food" | "service" | "price";

type GoogleStopDetails = {
  id: string;
  name: string;
  address: string | null;
  rating: number | null;
  userRatingCount: number | null;
  phone: string | null;
  website: string | null;
  mapsUrl: string | null;
  location: google.maps.LatLngLiteral | null;
  isRestaurant: boolean;
  priceLabel: string | null;
  foodTraitKeys: PlaceFoodTrait[];
  photos: string[];
  hours: string[];
  openingHours: google.maps.places.OpeningHours | null;
  reviews: Array<{
    author: string;
    rating: number | null;
    text: string;
    relativeTime: string | null;
  }>;
};

type CandidateStopDetailsContext = {
  landmark: LandmarkSearchResult;
  details: GoogleStopDetails | null;
  loading: boolean;
  error: boolean;
  adding: boolean;
  lodgingPlan: LodgingPlanContext | null;
  suggestedPlacement: SuggestedPlacePlacement | null;
  selectedSuggestion: boolean;
};

type ActiveStopDetailsContext = {
  stop: TripDayModel["stops"][number];
  day: TripDayModel;
  dayIndex: number;
  stopIndex: number;
  details: GoogleStopDetails | null;
  loading: boolean;
  error: boolean;
};

type ActiveStopLandmarkLabel = {
  dayIndex: number;
  stopIndex: number;
  label: string;
} | null;

type SuggestedPlacePlacement = {
  dayIndex: number;
  stopIndex: number;
};

type ActiveMovementDetailsContext = {
  day: TripDayModel;
  dayIndex: number;
  fromStop: TripDayModel["stops"][number];
  toStop: TripDayModel["stops"][number];
  fromIndex: number;
  toIndex: number;
  segment: TravelSegment | null;
  loading: boolean;
  attachment: TripStopAttachment | null;
};

const STOP_IMAGES = [
  "/illustrations/cities/paris.jpg",
  "/illustrations/cities/taipei.jpg",
  "/illustrations/cities/kyoto.jpg",
  "/illustrations/cities/singapore.jpg",
  "/illustrations/cities/new-york.jpg",
  "/illustrations/cities/rome.jpg",
];

const PLACE_COORDINATES: Record<string, { lat: number; lng: number }> = {
  amsterdam: { lat: 52.3676, lng: 4.9041 },
  bangkok: { lat: 13.7563, lng: 100.5018 },
  barcelona: { lat: 41.3874, lng: 2.1686 },
  berlin: { lat: 52.52, lng: 13.405 },
  boston: { lat: 42.3601, lng: -71.0589 },
  brussels: { lat: 50.8503, lng: 4.3517 },
  budapest: { lat: 47.4979, lng: 19.0402 },
  copenhagen: { lat: 55.6761, lng: 12.5683 },
  edinburgh: { lat: 55.9533, lng: -3.1883 },
  europe: { lat: 48.8566, lng: 10.4515 },
  interlaken: { lat: 46.6863, lng: 7.8632 },
  kyoto: { lat: 35.0116, lng: 135.7681 },
  london: { lat: 51.5072, lng: -0.1276 },
  milan: { lat: 45.4642, lng: 9.19 },
  newyork: { lat: 40.7128, lng: -74.006 },
  osaka: { lat: 34.6937, lng: 135.5023 },
  paris: { lat: 48.8566, lng: 2.3522 },
  pisa: { lat: 43.7228, lng: 10.4017 },
  prague: { lat: 50.0755, lng: 14.4378 },
  rome: { lat: 41.9028, lng: 12.4964 },
  singapore: { lat: 1.3521, lng: 103.8198 },
  sydney: { lat: -33.8688, lng: 151.2093 },
  taipei: { lat: 25.033, lng: 121.5654 },
  taiwan: { lat: 23.6978, lng: 120.9605 },
  tokyo: { lat: 35.6764, lng: 139.65 },
  venice: { lat: 45.4408, lng: 12.3155 },
  vienna: { lat: 48.2082, lng: 16.3738 },
  zurich: { lat: 47.3769, lng: 8.5417 },
  京都: { lat: 35.0116, lng: 135.7681 },
  台北: { lat: 25.033, lng: 121.5654 },
  台灣: { lat: 23.6978, lng: 120.9605 },
  台灣桃園國際機場: { lat: 25.0797, lng: 121.2342 },
  桃園國際機場: { lat: 25.0797, lng: 121.2342 },
  桃園機場: { lat: 25.0797, lng: 121.2342 },
  麗寶北歐莊園芬蘭極光: { lat: 25.0328964, lng: 121.464764 },
  北歐莊園芬蘭極光: { lat: 25.0328964, lng: 121.464764 },
  北歐莊園芬蘭極光社區: { lat: 25.0328964, lng: 121.464764 },
  巴黎: { lat: 48.8566, lng: 2.3522 },
  巴黎戴高樂機場: { lat: 49.0097, lng: 2.5479 },
  布拉格: { lat: 50.0755, lng: 14.4378 },
  布達佩斯: { lat: 47.4979, lng: 19.0402 },
  新加坡: { lat: 1.3521, lng: 103.8198 },
  東京: { lat: 35.6764, lng: 139.65 },
  比薩: { lat: 43.7228, lng: 10.4017 },
  義大利: { lat: 41.9028, lng: 12.4964 },
  米蘭: { lat: 45.4642, lng: 9.19 },
  米蘭馬爾彭薩機場: { lat: 45.63, lng: 8.7231 },
  維也納: { lat: 48.2082, lng: 16.3738 },
  羅馬: { lat: 41.9028, lng: 12.4964 },
  蘇黎世: { lat: 47.3769, lng: 8.5417 },
  威尼斯: { lat: 45.4408, lng: 12.3155 },
  歐洲: { lat: 48.8566, lng: 10.4515 },
};

const STOP_BUDGET_ATTACHMENT_ID = "roam-stop-budget";
const STOP_TICKET_ATTACHMENT_ID = "roam-stop-ticket";
const STOP_RESERVATION_ATTACHMENT_ID = "roam-stop-reservation";
const LODGING_ASSIGNMENT_ATTACHMENT_ID = "roam-lodging-assignment";
const BOOKING_DEFAULT_ROOMS = 1;
const BOOKING_AFFILIATE_ID =
  process.env.NEXT_PUBLIC_BOOKING_AFFILIATE_ID?.trim() ?? "";
const TICKET_ATTACHMENT_TYPES = new Set([
  "ticket",
  "reservation",
  "booking",
  "voucher",
]);

const LeafletTripMap = dynamic(
  () => import("./trip-map").then((mod) => mod.TripMap),
  {
    ssr: false,
    loading: () => (
      <div className="h-full w-full bg-[linear-gradient(135deg,#dff4f2,#efe7d9)]" />
    ),
  },
);

const SpotlightFlagMap = dynamic(
  () =>
    import("@/components/storefront/explore/spotlight-flag-map").then(
      (mod) => mod.SpotlightFlagMap,
    ),
  {
    ssr: false,
    loading: () => (
      <div className="h-full w-full rounded-[24px] bg-white/20" />
    ),
  },
);

export function TripPlanningWorkspace({
  trip,
  cities,
  companions,
  lang,
  labels,
  preview = false,
}: {
  trip: Trip;
  cities: ApiCity[];
  companions: ApiCompanion[];
  lang: string;
  labels: TripPlanningLabels;
  preview?: boolean;
}) {
  const serverModel = useMemo(
    () => buildTripModel(trip, cities, labels),
    [cities, labels, trip],
  );
  const serverModelSignature = useMemo(
    () => JSON.stringify({ trip, cities }),
    [cities, trip],
  );
  const [model, setModel] = useState<TripModel>(serverModel);
  const modelRef = useRef(model);
  const serverModelSignatureRef = useRef(serverModelSignature);
  const committedTitleRef = useRef(serverModel.title);
  const daysUndoStackRef = useRef<TripDayModel[][]>([]);
  const [titleSaveError, setTitleSaveError] = useState(false);
  const daysSave = useDebouncedVersionedSave<TripDayModel[]>({
    save: (days) => replaceTripDays({ tripId: trip.id, days }),
    onSuccess: () => {
      void refreshTrip(trip.id);
    },
  });
  const titleSave = useDebouncedVersionedSave<string>({
    save: async (title) => {
      const response = await fetch(`/api/trips/${trip.id}`, {
        method: "PATCH",
        credentials: "same-origin",
        cache: "no-store",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title }),
      });
      if (!response.ok) throw new Error(`title update failed: ${response.status}`);
    },
    onSuccess: (title) => {
      committedTitleRef.current = title;
      void refreshTrip(trip.id);
    },
    onError: () => {
      const revertedModel = {
        ...modelRef.current,
        title: committedTitleRef.current,
      };
      modelRef.current = revertedModel;
      setModel(revertedModel);
      setTitleSaveError(true);
    },
  });
  async function handleUpdateTripMetadata(nextMetadata: Record<string, unknown>) {
    const response = await fetch(`/api/trips/${trip.id}`, {
      method: "PATCH",
      credentials: "same-origin",
      cache: "no-store",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ metadata: nextMetadata }),
    });
    if (!response.ok) {
      throw new Error(`metadata update failed: ${response.status}`);
    }
    modelRef.current = { ...modelRef.current, metadata: nextMetadata };
    setModel((current) => ({ ...current, metadata: nextMetadata }));
    await refreshTrip(trip.id);
  }
  const [activeView, setActiveView] = useState<ActiveItineraryView>("overview");
  const [mapFocus, setMapFocus] = useState<MapFocus>(null);
  const [mapAutoplayEnabled, setMapAutoplayEnabled] = useState(true);
  const [manualMapFocusVersion, setManualMapFocusVersion] = useState(0);
  const [homePlace, setHomePlace] = useState<UserHomePlace | null>(null);
  const [departurePlaces, setDeparturePlaces] = useState<UserDeparturePlace[]>([]);
  const [selectedDeparturePlaceId, setSelectedDeparturePlaceId] =
    useState<string | null>(null);
  const [homeDialogOpen, setHomeDialogOpen] = useState(false);
  const [stopDetailsState, setStopDetailsState] = useState<{
    key: string | null;
    details: GoogleStopDetails | null;
    loading: boolean;
    error: boolean;
  }>({ key: null, details: null, loading: false, error: false });
  const [candidateDetailsState, setCandidateDetailsState] = useState<{
    landmark: LandmarkSearchResult | null;
    key: string | null;
    details: GoogleStopDetails | null;
    loading: boolean;
    error: boolean;
    adding: boolean;
    lodgingPlan: LodgingPlanContext | null;
    suggestedPlacement: SuggestedPlacePlacement | null;
    selectedSuggestion: boolean;
  }>({
    landmark: null,
    key: null,
    details: null,
    loading: false,
    error: false,
    adding: false,
    lodgingPlan: null,
    suggestedPlacement: null,
    selectedSuggestion: false,
  });
  const [candidateClearVersion, setCandidateClearVersion] = useState(0);
  const [lodgingSearchRequest, setLodgingSearchRequest] =
    useState<LodgingSearchRequest | null>(null);
  const [lodgingSettings, setLodgingSettings] =
    useState<LodgingSettingsState | null>(null);
  const [movementSegmentState, setMovementSegmentState] = useState<{
    key: string | null;
    segment: TravelSegment | null;
    loading: boolean;
  }>({ key: null, segment: null, loading: false });
  const activeDayIndex = typeof activeView === "number"
    ? Math.min(activeView, model.days.length - 1)
    : null;
  const selectedDay = activeDayIndex == null ? null : model.days[activeDayIndex];
  const bookingAdults = Math.max(1, companions.length || 1);
  const planningMetadata = useMemo(
    () => readTripPlanningMetadata(model.metadata),
    [model.metadata],
  );
  const inspirationExploreActive =
    planningMetadata.mainDestinations.length === 0 &&
    model.metadata.source === "explore";
  /* First planning step on the regular page: a trip with no days yet keeps
     the normal layout, hides the itinerary, and limits the map to
     searching/selecting countries and cities. */
  const baseExploringStage =
    !inspirationExploreActive &&
    planningMetadata.mainDestinations.length === 0 &&
    model.days.length === 0;
  const explorationCities = useMemo(
    () => readExplorationCities(model.metadata),
    [model.metadata],
  );
  const explorationFlightDetails = useMemo(
    () => readExplorationFlightDetails(model.metadata),
    [model.metadata],
  );
  const [dateGlow, setDateGlow] = useState(false);
  const [exploreStep, setExploreStep] = useState<"places" | "flights">("places");
  const [explorationViewOverride, setExplorationViewOverride] = useState(false);
  const [selectedFlightIndex, setSelectedFlightIndex] = useState(0);
  const exploreFlights = useMemo(
    () => buildExploreFlights(explorationCities),
    [explorationCities],
  );
  const [lumiTakeover, setLumiTakeover] = useState<{ prompt: string } | null>(
    null,
  );
  const exploringStage = baseExploringStage || explorationViewOverride;

  function handleExplorationStepChange(step: ExplorationStep) {
    setExploreStep(step);
    if (step === "flights") {
      setSelectedFlightIndex(0);
    }
    setExplorationViewOverride(true);
  }

  useEffect(() => {
    let promptText = consumeLumiTakeoverPrompt(trip.id);
    if (!promptText) {
      /* Fallback: a Lumi-created trip carries its prompt in metadata, so
         the takeover survives session-storage loss and full reloads while
         the trip is still untouched. */
      const metadata = modelRef.current.metadata;
      const untouched =
        modelRef.current.days.length === 0 &&
        readExplorationCities(metadata).length === 0 &&
        metadata.lumi_takeover_done !== true;
      if (
        untouched &&
        metadata.source === "lumi" &&
        typeof metadata.lumi_prompt === "string" &&
        metadata.lumi_prompt.trim()
      ) {
        promptText = metadata.lumi_prompt.trim();
      }
    }
    if (!promptText) return;
    const timer = setTimeout(() => setLumiTakeover({ prompt: promptText }), 700);
    return () => clearTimeout(timer);
  }, [trip.id]);
  const journeyLiveState = useMemo(
    () => currentJourneyLiveState(model),
    [model],
  );
  const journeyStarted = journeyLiveState != null;
  const liveFocusAppliedRef = useRef(false);

  useEffect(() => {
    if (!journeyLiveState || liveFocusAppliedRef.current) return;
    liveFocusAppliedRef.current = true;
    setActiveView(journeyLiveState.dayIndex);
    setMapFocus({
      mode: "stop",
      index: journeyLiveState.stopIndex,
      source: "manual",
    });
    setMapAutoplayEnabled(false);
  }, [journeyLiveState]);

  async function handleSelectInspirationCountry(countryCode: string) {
    const planning =
      modelRef.current.metadata.planning &&
      typeof modelRef.current.metadata.planning === "object"
        ? (modelRef.current.metadata.planning as Record<string, unknown>)
        : {};
    const currentDestinations = readTripPlanningMetadata(
      modelRef.current.metadata,
    ).mainDestinations;
    await handleUpdateTripMetadata({
      ...modelRef.current.metadata,
      planning: {
        ...planning,
        main_destinations: Array.from(
          new Set([...currentDestinations, countryCode.toUpperCase()]),
        ),
      },
    });
  }

  async function persistExplorationCities(next: ExploreCity[]) {
    const planning =
      modelRef.current.metadata.planning &&
      typeof modelRef.current.metadata.planning === "object"
        ? (modelRef.current.metadata.planning as Record<string, unknown>)
        : {};
    await handleUpdateTripMetadata({
      ...modelRef.current.metadata,
      planning: { ...planning, exploration_cities: next },
    });
  }

  async function handleUpdateExplorationFlightDetails(
    legKey: string,
    details: ExploreFlightDetails,
  ) {
    const planning =
      modelRef.current.metadata.planning &&
      typeof modelRef.current.metadata.planning === "object"
        ? (modelRef.current.metadata.planning as Record<string, unknown>)
        : {};
    const current = readExplorationFlightDetails(modelRef.current.metadata);
    const cleanDetails = normalizeExploreFlightDetails(details);
    const nextFlightDetails = {
      ...current,
      [legKey]: cleanDetails,
    };
    if (
      !cleanDetails.departureDate &&
      !cleanDetails.departureTime &&
      !cleanDetails.flightNumber &&
      !cleanDetails.terminal &&
      !cleanDetails.gate
    ) {
      delete nextFlightDetails[legKey];
    }
    await handleUpdateTripMetadata({
      ...modelRef.current.metadata,
      planning: {
        ...planning,
        exploration_flight_details: nextFlightDetails,
      },
    });
  }

  async function handleApplyTakeoverFlightDetails(
    details: TakeoverFlightDetails[],
  ) {
    if (details.length === 0) return;
    const planning =
      modelRef.current.metadata.planning &&
      typeof modelRef.current.metadata.planning === "object"
        ? (modelRef.current.metadata.planning as Record<string, unknown>)
        : {};
    const current = readExplorationFlightDetails(modelRef.current.metadata);
    const nextFlightDetails = { ...current };
    for (const item of details) {
      const legKey = item.leg_key.trim();
      if (!legKey) continue;
      const existing = normalizeExploreFlightDetails(nextFlightDetails[legKey]);
      const gateValue = item.gate?.trim();
      const terminalFromGate =
        gateValue && isTerminalFieldValue(gateValue) ? gateValue : null;
      nextFlightDetails[legKey] = {
        ...existing,
        ...(item.departure_date != null
          ? { departureDate: item.departure_date }
          : {}),
        ...(item.departure_time != null
          ? { departureTime: item.departure_time }
          : {}),
        ...(item.flight_number != null
          ? { flightNumber: item.flight_number.trim().toUpperCase() }
          : {}),
        ...(terminalFromGate != null
          ? { terminal: terminalFromGate.trim().toUpperCase() }
          : item.terminal != null
          ? { terminal: item.terminal.trim().toUpperCase() }
          : {}),
        ...(item.gate != null && terminalFromGate == null
          ? { gate: item.gate.trim().toUpperCase() }
          : {}),
      };
    }
    await handleUpdateTripMetadata({
      ...modelRef.current.metadata,
      planning: {
        ...planning,
        exploration_flight_details: nextFlightDetails,
      },
    });
  }

  async function handleAddExplorationCity(city: ExploreCity) {
    const current = readExplorationCities(modelRef.current.metadata);
    if (
      current.some(
        (existing) =>
          existing.name.toLowerCase() === city.name.toLowerCase() ||
          (
            existing.country_code != null &&
            city.country_code != null &&
            existing.country_code.toUpperCase() === city.country_code.toUpperCase()
          ),
      )
    ) {
      return;
    }
    playPinDropSound();
    await persistExplorationCities([...current, city]);
  }

  async function handleRemoveExplorationCity(index: number) {
    const current = readExplorationCities(modelRef.current.metadata);
    await persistExplorationCities(
      current.filter((_, currentIndex) => currentIndex !== index),
    );
  }

  async function handleExploreSearch(
    query: string,
  ): Promise<ExploreSearchResult[]> {
    const GEO_TYPES = new Set([
      "locality",
      "sublocality",
      "postal_town",
      "country",
      "administrative_area_level_1",
      "administrative_area_level_2",
      "continent",
      "archipelago",
    ]);
    const results = await geocodeLandmark(query);
    return results
      .filter((result) => (result.types ?? []).some((type) => GEO_TYPES.has(type)))
      .map((result) => ({
        id: result.id,
        name: result.name,
        address: result.address,
        lat: result.lat,
        lng: result.lng,
        countryCode: null,
      }));
  }

  async function handleResolveExplorePoint(
    lat: number,
    lng: number,
  ): Promise<ExploreSearchResult | null> {
    await loadGoogleMaps();
    const geocoder = new google.maps.Geocoder();
    const { results } = await geocoder.geocode({ location: { lat, lng } });
    const pick =
      results.find((result) => result.types.includes("locality")) ??
      results.find((result) =>
        result.types.includes("administrative_area_level_1"),
      ) ??
      results.find((result) => result.types.includes("country"));
    if (!pick) return null;
    const component = (type: string) =>
      pick.address_components.find((entry) => entry.types.includes(type));
    const name =
      component("locality")?.long_name ??
      component("administrative_area_level_1")?.long_name ??
      component("country")?.long_name ??
      pick.formatted_address;
    const location = pick.geometry.location;
    return {
      id: pick.place_id,
      name,
      address: pick.formatted_address,
      lat: location.lat(),
      lng: location.lng(),
      countryCode: component("country")?.short_name ?? null,
    };
  }

  async function handleUpdateTripDates(startDate: string, endDate: string) {
    const response = await fetch(`/api/trips/${trip.id}`, {
      method: "PATCH",
      credentials: "same-origin",
      cache: "no-store",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ start_date: startDate, end_date: endDate }),
    });
    if (!response.ok) {
      throw new Error(`date update failed: ${response.status}`);
    }
    modelRef.current = { ...modelRef.current, startDate, endDate };
    setModel((current) => ({ ...current, startDate, endDate }));
    await refreshTrip(trip.id);
  }

  async function handleConfirmInspirationDraft(items: InspirationWishlistItem[]) {
    if (items.length === 0) return;
    const planning =
      modelRef.current.metadata.planning &&
      typeof modelRef.current.metadata.planning === "object"
        ? (modelRef.current.metadata.planning as Record<string, unknown>)
        : {};
    const currentDestinations = readTripPlanningMetadata(
      modelRef.current.metadata,
    ).mainDestinations;
    const nextDestinations = Array.from(
      new Set([
        ...currentDestinations,
        ...items.map((item) => item.countryCode.toUpperCase()),
      ]),
    );
    const nextDays = blankDaysForDateRange(
      modelRef.current.startDate,
      modelRef.current.endDate,
      items,
      lang,
    );
    const nextMetadata = {
      ...modelRef.current.metadata,
      source: "explore_confirmed",
      planning: {
        ...planning,
        main_destinations: nextDestinations,
        inspiration_wishlist: items.map((item) => ({
          id: item.id,
          title: item.title,
          category: item.category,
          location: item.location,
          description: item.description,
          country_code: item.countryCode,
          image: item.image,
          lat: item.lat,
          lng: item.lng,
          tone: item.tone,
        })),
      },
    };
    await handleUpdateTripMetadata(nextMetadata);
    await replaceTripDays({ tripId: trip.id, days: nextDays });
    const nextModel = {
      ...modelRef.current,
      metadata: nextMetadata,
      days: nextDays,
      notes: nextDays.map((day) => day.note).filter(Boolean),
    };
    modelRef.current = nextModel;
    setModel(nextModel);
    setActiveView("overview");
    await refreshTrip(trip.id);
  }

  useEffect(() => {
    if (preview) return;
    let canceled = false;
    void fetchUserPreferences()
      .then((preferences) => {
        if (!canceled) {
          setHomePlace(preferences.home_place);
          setDeparturePlaces(preferences.departure_places);
          setSelectedDeparturePlaceId(preferences.selected_departure_place_id);
        }
      })
      .catch(() => {
        if (!canceled) {
          setHomePlace(null);
          setDeparturePlaces([]);
          setSelectedDeparturePlaceId(null);
        }
      });
    return () => {
      canceled = true;
    };
  }, [preview]);

  useEffect(() => {
    if (serverModelSignatureRef.current === serverModelSignature) return;
    serverModelSignatureRef.current = serverModelSignature;
    committedTitleRef.current = serverModel.title;
    modelRef.current = serverModel;
    daysUndoStackRef.current = [];
    setModel(serverModel);
    setTitleSaveError(false);
    setMovementSegmentState({ key: null, segment: null, loading: false });
    setStopDetailsState({
      key: null,
      details: null,
      loading: false,
      error: false,
    });
    setCandidateDetailsState({
      landmark: null,
      key: null,
      details: null,
      loading: false,
      error: false,
      adding: false,
      lodgingPlan: null,
      suggestedPlacement: null,
      selectedSuggestion: false,
    });
    const nextActiveView =
      activeView === "overview" || serverModel.days.length === 0
        ? "overview"
        : Math.min(activeView, serverModel.days.length - 1);
    setActiveView(nextActiveView);
    setMapFocus((current) => clampMapFocus(current, serverModel, nextActiveView));
  }, [activeView, serverModel, serverModelSignature]);
  const activeStopIndex =
    activeView !== "overview" && mapFocus?.mode === "stop"
      ? Math.max(0, Math.min((selectedDay?.stops.length ?? 1) - 1, mapFocus.index))
      : null;
  const activeStopForDetails =
    activeView !== "overview" &&
    mapFocus?.mode === "stop" &&
    (mapFocus.source === "manual" || mapFocus.source === "added") &&
    activeStopIndex != null
      ? selectedDay?.stops[activeStopIndex] ?? null
      : null;
  const selectedDeparturePlace =
    departurePlaces.find((place) => place.id === selectedDeparturePlaceId) ??
    departurePlaces[0] ??
    null;
  const activeMovementIndexes =
    activeView !== "overview" &&
    mapFocus?.mode === "movement" &&
    (mapFocus.source === "manual" || mapFocus.source === "added")
      ? {
          fromIndex: Math.max(
            0,
            Math.min((selectedDay?.stops.length ?? 2) - 2, mapFocus.fromIndex),
          ),
          toIndex: Math.max(
            1,
            Math.min((selectedDay?.stops.length ?? 1) - 1, mapFocus.toIndex),
          ),
        }
      : null;
  const activeMovementForDetails =
    activeMovementIndexes && selectedDay
      ? {
          fromStop: selectedDay.stops[activeMovementIndexes.fromIndex] ?? null,
          toStop: selectedDay.stops[activeMovementIndexes.toIndex] ?? null,
          fromIndex: activeMovementIndexes.fromIndex,
          toIndex: activeMovementIndexes.toIndex,
        }
      : null;
  const activeMovementAttachment =
    activeMovementForDetails?.fromStop && activeMovementForDetails.toStop
      ? airportTransferAttachmentForMovement(
          activeMovementForDetails.fromStop,
          activeMovementForDetails.toStop,
        )
      : null;
  const activeMovementDetailsKey =
    activeMovementForDetails?.fromStop && activeMovementForDetails.toStop
      ? `${activeMovementForDetails.fromIndex}:${activeMovementForDetails.toIndex}:${activeMovementForDetails.fromStop.name}:${activeMovementForDetails.toStop.name}`
      : null;
  const activeMovementFromStop = activeMovementForDetails?.fromStop ?? null;
  const activeMovementToStop = activeMovementForDetails?.toStop ?? null;
  const activeMovementFromIndex = activeMovementForDetails?.fromIndex ?? null;
  const activeMovementToIndex = activeMovementForDetails?.toIndex ?? null;
  const activeStopDetailsKey = activeStopForDetails
    ? stopDetailsLookupKey(activeStopForDetails)
    : null;
  const currentStopDetails =
    stopDetailsState.key === activeStopDetailsKey ? stopDetailsState.details : null;
  const activeStopCanFetchDetails =
    activeStopForDetails != null &&
    Boolean(
      activeStopForDetails.placeId ||
        activeStopForDetails.placeName?.trim() ||
        (activeStopForDetails.lat != null && activeStopForDetails.lng != null),
    ) &&
    !isAreaWalkStop(activeStopForDetails);
  const activeStopDetailsLabel =
    activeStopForDetails
      ? landmarkLabelForStop(activeStopForDetails.placeName, activeStopForDetails)
      : null;
  const activeStopLandmarkLabel: ActiveStopLandmarkLabel =
    activeStopDetailsLabel && activeDayIndex != null && activeStopIndex != null
      ? {
          dayIndex: activeDayIndex,
          stopIndex: activeStopIndex,
          label: activeStopDetailsLabel,
        }
      : null;
  const currentStopDetailsLoading =
    activeStopCanFetchDetails &&
    (stopDetailsState.key !== activeStopDetailsKey || stopDetailsState.loading);
  const currentStopDetailsError =
    stopDetailsState.key === activeStopDetailsKey && stopDetailsState.error;

  function handleActiveViewChange(view: ActiveItineraryView) {
    setActiveView(view);
    setMapFocus(null);
    setCandidateDetailsState((current) => ({
      ...current,
      landmark: null,
      lodgingPlan: null,
      suggestedPlacement: null,
      selectedSuggestion: false,
    }));
    setCandidateClearVersion((version) => version + 1);
  }

  function handleMapFocusChange(focus: MapFocus) {
    const userFocus = focus?.source === "manual" || focus?.source === "added";
    if (userFocus) {
      setCandidateDetailsState((current) => ({
        ...current,
        landmark: null,
        lodgingPlan: null,
        suggestedPlacement: null,
        selectedSuggestion: false,
      }));
      setCandidateClearVersion((version) => version + 1);
    }
    if (userFocus) {
      setMapAutoplayEnabled(false);
    }
    if (
      (focus?.mode === "stop" || focus?.mode === "movement") &&
      userFocus
    ) {
      setManualMapFocusVersion((version) => version + 1);
    }
    setMapFocus(focus);
  }

  async function handleSaveHomePlace(nextHomePlace: UserHomePlace) {
    const nextDeparturePlace = homePlaceToDeparturePlace(nextHomePlace);
    const nextDeparturePlaces = upsertDeparturePlace(
      departurePlaces,
      nextDeparturePlace,
    );
    const preferences = await updateUserTravelPreferences({
      home_place: nextHomePlace,
      departure_places: nextDeparturePlaces,
      selected_departure_place_id: nextDeparturePlace.id,
    });
    setHomePlace(preferences.home_place);
    setDeparturePlaces(preferences.departure_places);
    setSelectedDeparturePlaceId(preferences.selected_departure_place_id);
  }

  async function handleSelectDeparturePlace(placeId: string) {
    const previousSelectedDeparturePlaceId = selectedDeparturePlaceId;
    setSelectedDeparturePlaceId(placeId);
    try {
      const preferences = await updateUserTravelPreferences({
        selected_departure_place_id: placeId,
      });
      setDeparturePlaces(preferences.departure_places);
      setSelectedDeparturePlaceId(preferences.selected_departure_place_id);
    } catch {
      setSelectedDeparturePlaceId(previousSelectedDeparturePlaceId);
    }
  }

  const handleCandidateSelect = useCallback((
    landmark: LandmarkSearchResult | null,
    lodgingPlan: LodgingPlanContext | null = null,
    suggestedPlacement: SuggestedPlacePlacement | null = null,
  ) => {
    setCandidateDetailsState({
      landmark,
      key: landmark ? landmarkKey(landmark) : null,
      details: null,
      loading: Boolean(landmark),
      error: false,
      adding: false,
      lodgingPlan: landmark ? lodgingPlan : null,
      suggestedPlacement: landmark ? suggestedPlacement : null,
      selectedSuggestion:
        landmark && suggestedPlacement
          ? landmark.selected === true ||
            selectedSuggestionForPlacement(
              modelRef.current.days,
              suggestedPlacement,
              landmark,
            )
          : false,
    });
    if (landmark) {
      setMapAutoplayEnabled(false);
      if (!suggestedPlacement) setMapFocus(null);
    }
  }, []);

  const handleRequestMapAutoplayPause = useCallback(() => {
    setMapAutoplayEnabled(false);
  }, []);

  const handleRequestLodgingSearch = useCallback(
    (
      dayIndex: number,
      position: DayLodgingAnchor["position"],
      range?: LodgingDateRange,
    ) => {
      const nextDayIndex = Math.max(
        0,
        Math.min(modelRef.current.days.length - 1, dayIndex),
      );
      const nightIndex = Math.max(
        0,
        Math.min(
          modelRef.current.days.length - 1,
          position === "start" ? nextDayIndex - 1 : nextDayIndex,
        ),
      );
      setActiveView(nextDayIndex);
      setMapFocus(null);
      setMapAutoplayEnabled(false);
      setLodgingSettings(null);
      setCandidateDetailsState((current) => ({
        ...current,
        landmark: null,
        adding: false,
        lodgingPlan: null,
        suggestedPlacement: null,
        selectedSuggestion: false,
      }));
      setCandidateClearVersion((version) => version + 1);
      setLodgingSearchRequest((current) => ({
        version: (current?.version ?? 0) + 1,
        dayIndex: nextDayIndex,
        nightIndex,
        range: range
          ? normalizeLodgingDateRange(range, modelRef.current.days.length)
          : undefined,
      }));
    },
    [],
  );

  const handleOpenLodgingSettings = useCallback(
    (dayIndex: number, position: DayLodgingAnchor["position"]) => {
      const currentDays = modelRef.current.days;
      if (currentDays.length === 0) return;
      const nextDayIndex = Math.max(0, Math.min(currentDays.length - 1, dayIndex));
      const target = lodgingTargetForAnchor(currentDays, nextDayIndex, position);
      const requestedNightIndex = Math.max(
        0,
        Math.min(
          currentDays.length - 1,
          position === "start" ? nextDayIndex - 1 : nextDayIndex,
        ),
      );
      const defaultPlan = defaultLodgingPlanForDays(currentDays, requestedNightIndex);
      const range = target
        ? lodgingDateRangeForTarget(currentDays, target)
        : {
            startIndex: defaultPlan.defaultStartIndex,
            endIndex: defaultPlan.defaultEndIndex,
          };
      setLodgingSettings({
        dayIndex: nextDayIndex,
        position,
        target,
        range: normalizeLodgingDateRange(range, currentDays.length),
      });
    },
    [],
  );

  const handleResumeMapAutoplay = useCallback(() => {
    const currentDays = modelRef.current.days;
    const firstDayWithStops = currentDays.findIndex((day) => day.stops.length > 0);
    const activeDayWithStops =
      typeof activeView === "number" && currentDays[activeView]?.stops.length
        ? activeView
        : null;
    const nextDayIndex =
      activeDayWithStops ?? (firstDayWithStops >= 0 ? firstDayWithStops : null);

    setCandidateDetailsState({
      landmark: null,
      key: null,
      details: null,
      loading: false,
      error: false,
      adding: false,
      lodgingPlan: null,
      suggestedPlacement: null,
      selectedSuggestion: false,
    });
    setCandidateClearVersion((version) => version + 1);

    if (nextDayIndex == null) {
      setActiveView("overview");
      setMapFocus(null);
    } else {
      setActiveView(nextDayIndex);
      setMapFocus({ mode: "stop", index: 0, source: "auto" });
    }

    setMapAutoplayEnabled(true);
  }, [activeView]);

  useEffect(() => {
    if (!mapAutoplayEnabled) return;
    if (activeDayIndex == null || !selectedDay || selectedDay.stops.length === 0) {
      return;
    }
    if (
      (mapFocus?.mode === "stop" || mapFocus?.mode === "movement") &&
      (mapFocus.source === "manual" || mapFocus.source === "added")
    ) {
      return;
    }

    const startTimer = window.setTimeout(() => {
      setMapFocus((current) => {
        if (
          (current?.mode === "stop" || current?.mode === "movement") &&
          (current.source === "manual" || current.source === "added")
        ) return current;
        if (current?.mode === "stop" && current.index < selectedDay.stops.length) {
          return current;
        }
        return { mode: "stop", index: 0, source: "auto" };
      });
    }, 0);

    if (selectedDay.stops.length <= 1) {
      return () => window.clearTimeout(startTimer);
    }

    const timer = window.setInterval(() => {
      setMapFocus((current) => {
        if (
          (current?.mode === "stop" || current?.mode === "movement") &&
          (current.source === "manual" || current.source === "added")
        ) return current;
        const currentIndex = current?.mode === "stop" ? current.index : -1;
        return {
          mode: "stop",
          index: (currentIndex + 1) % selectedDay.stops.length,
          source: "auto",
        };
      });
    }, 3200);

    return () => {
      window.clearTimeout(startTimer);
      window.clearInterval(timer);
    };
  }, [activeDayIndex, mapAutoplayEnabled, mapFocus?.mode, mapFocus?.source, selectedDay]);

  useEffect(() => {
    let canceled = false;
    if (
      !activeStopForDetails ||
      !activeStopCanFetchDetails
    ) {
      return () => {
        canceled = true;
      };
    }

    const requestKey = stopDetailsLookupKey(activeStopForDetails);
    window.setTimeout(() => {
      if (!canceled) {
        setStopDetailsState({
          key: requestKey,
          details: null,
          loading: true,
          error: false,
        });
      }
    }, 0);
    void fetchStopGoogleDetails({
      stop: activeStopForDetails,
      city: selectedDay?.city ?? null,
    })
      .then((details) => {
        if (canceled) return;
        setStopDetailsState({
          key: requestKey,
          details,
          loading: false,
          error: details == null,
        });
      })
      .catch(() => {
        if (!canceled) {
          setStopDetailsState({
            key: requestKey,
            details: null,
            loading: false,
            error: true,
          });
        }
      });

    return () => {
      canceled = true;
    };
  }, [
    activeStopForDetails,
    activeStopForDetails?.lat,
    activeStopForDetails?.lng,
    activeStopForDetails?.name,
    activeStopForDetails?.placeId,
    activeStopForDetails?.placeName,
    activeStopCanFetchDetails,
    selectedDay?.city,
  ]);

  useEffect(() => {
    let canceled = false;
    const landmark = candidateDetailsState.landmark;
    if (!landmark) return () => {
      canceled = true;
    };

    const requestKey = landmarkKey(landmark);
    window.setTimeout(() => {
      if (!canceled) {
        setCandidateDetailsState((current) =>
          current.landmark && landmarkKey(current.landmark) === requestKey
            ? { ...current, key: requestKey, details: null, loading: true, error: false }
            : current,
        );
      }
    }, 0);
    void fetchStopGoogleDetails({
      stop: landmarkToStop(landmark),
      city: selectedDay?.city ?? null,
    })
      .then((details) => {
        if (canceled) return;
        setCandidateDetailsState((current) =>
          current.landmark && landmarkKey(current.landmark) === requestKey
            ? {
                ...current,
                key: requestKey,
                details,
                loading: false,
                error: details == null,
              }
            : current,
        );
      })
      .catch(() => {
        if (canceled) return;
        setCandidateDetailsState((current) =>
          current.landmark && landmarkKey(current.landmark) === requestKey
            ? { ...current, key: requestKey, details: null, loading: false, error: true }
            : current,
        );
      });

    return () => {
      canceled = true;
    };
  }, [candidateDetailsState.landmark, selectedDay?.city]);

  useEffect(() => {
    let canceled = false;
    const fromStop = activeMovementFromStop;
    const toStop = activeMovementToStop;
    if (
      !activeMovementDetailsKey ||
      !fromStop ||
      !toStop ||
      activeMovementFromIndex == null ||
      activeMovementToIndex == null ||
      fromStop.lat == null ||
      fromStop.lng == null ||
      toStop.lat == null ||
      toStop.lng == null
    ) {
      const timer = window.setTimeout(() => {
        if (!canceled) {
          setMovementSegmentState({ key: null, segment: null, loading: false });
        }
      }, 0);
      return () => {
        canceled = true;
        window.clearTimeout(timer);
      };
    }

    const loadingTimer = window.setTimeout(() => {
      if (!canceled) {
        setMovementSegmentState({
          key: activeMovementDetailsKey,
          segment: null,
          loading: true,
        });
      }
    }, 0);

    const stops: TripMapTravelStop[] = [
      {
        name: fromStop.name,
        lat: fromStop.lat,
        lng: fromStop.lng,
        kind: "airport_transfer",
        sourceIndex: activeMovementFromIndex,
      },
      {
        name: toStop.name,
        lat: toStop.lat,
        lng: toStop.lng,
        kind: "airport_transfer",
        sourceIndex: activeMovementToIndex,
      },
    ];

    void resolveTravelSegments(stops, labels.map_travel)
      .then((segments) => {
        if (canceled) return;
        setMovementSegmentState({
          key: activeMovementDetailsKey,
          segment: segments[0] ?? null,
          loading: false,
        });
      })
      .catch(() => {
        if (canceled) return;
        setMovementSegmentState({
          key: activeMovementDetailsKey,
          segment: createFallbackTravelSegments(stops, labels.map_travel)[0] ?? null,
          loading: false,
        });
      });

    return () => {
      canceled = true;
      window.clearTimeout(loadingTimer);
    };
  }, [
    activeMovementDetailsKey,
    activeMovementFromIndex,
    activeMovementFromStop,
    activeMovementFromStop?.name,
    activeMovementFromStop?.lat,
    activeMovementFromStop?.lng,
    activeMovementToIndex,
    activeMovementToStop,
    activeMovementToStop?.name,
    activeMovementToStop?.lat,
    activeMovementToStop?.lng,
    labels.map_travel,
  ]);

  function updateDaysDraft(
    updater: (days: TripDayModel[]) => TripDayModel[],
    debounceMs = 450,
  ) {
    const previousDays = modelRef.current.days;
    const nextDays = updater(previousDays);
    if (tripDaysEqual(previousDays, nextDays)) return;
    daysUndoStackRef.current = [
      ...daysUndoStackRef.current.slice(-49),
      cloneTripDays(previousDays),
    ];
    const nextModel = {
      ...modelRef.current,
      days: nextDays,
      notes: nextDays.map((day) => day.note).filter(Boolean),
    };
    modelRef.current = nextModel;
    setModel(nextModel);
    daysSave.schedule(nextDays, debounceMs);
  }

  const undoLastDaysChange = useCallback(() => {
    const previousDays = daysUndoStackRef.current.at(-1);
    if (!previousDays) return false;
    daysUndoStackRef.current = daysUndoStackRef.current.slice(0, -1);
    const restoredDays = cloneTripDays(previousDays);
    const nextActiveView =
      activeView === "overview" || restoredDays.length === 0
        ? "overview"
        : Math.min(activeView, restoredDays.length - 1);
    const nextModel = {
      ...modelRef.current,
      days: restoredDays,
      notes: restoredDays.map((day) => day.note).filter(Boolean),
    };
    modelRef.current = nextModel;
    setModel(nextModel);
    setActiveView(nextActiveView);
    setMapFocus((current) => clampMapFocus(current, nextModel, nextActiveView));
    daysSave.schedule(restoredDays, 150);
    return true;
  }, [activeView, daysSave]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.shiftKey || event.altKey) return;
      if (event.key.toLowerCase() !== "z") return;
      if (isEditableKeyboardTarget(event.target)) return;
      if (!undoLastDaysChange()) return;
      event.preventDefault();
      event.stopPropagation();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [undoLastDaysChange]);

  function handleRenameTrip(nextTitle: string) {
    const cleanTitle = nextTitle.trim();
    if (!cleanTitle || cleanTitle === modelRef.current.title) return;
    const nextModel = { ...modelRef.current, title: cleanTitle };
    modelRef.current = nextModel;
    setModel(nextModel);
    setTitleSaveError(false);
    titleSave.schedule(cleanTitle, 300);
  }

  function handleReorderDayStops(dayIndex: number, stops: TripDayModel["stops"]) {
    updateDaysDraft(
      (days) =>
        days.map((day, index) =>
          index === dayIndex ? { ...day, stops } : day,
        ),
      300,
    );
    return Promise.resolve();
  }

  function handleUpdateStopBudget(
    dayIndex: number,
    stopIndex: number,
    amount: string,
  ) {
    updateDaysDraft((days) =>
      days.map((day, index) =>
        index === dayIndex
          ? {
              ...day,
              stops: day.stops.map((stop, currentStopIndex) =>
                currentStopIndex === stopIndex
                  ? withStopBudget(stop, amount, labels.place_details.budget_label)
                  : stop,
              ),
            }
          : day,
      ),
    );
    return Promise.resolve();
  }

  function handleUpdateStopTime(
    dayIndex: number,
    stopIndex: number,
    arrivalTime: string | null,
  ) {
    updateDaysDraft(
      (days) =>
        days.map((day, index) =>
          index === dayIndex
            ? {
                ...day,
                stops: day.stops.map((stop, currentStopIndex) =>
                  currentStopIndex === stopIndex
                    ? { ...stop, arrival_time: arrivalTime }
                    : stop,
                ),
              }
            : day,
        ),
      220,
    );
    return Promise.resolve();
  }

  function handleUpdateTripNotes(note: string) {
    updateDaysDraft((days) =>
      days.map((day, index) => ({ ...day, note: index === 0 ? note : "" })),
    );
  }

  function handleUpdateStopAttachments(
    dayIndex: number,
    stopIndex: number,
    attachments: TripStopAttachment[],
  ) {
    updateDaysDraft(
      (days) =>
        days.map((day, index) =>
          index === dayIndex
            ? {
                ...day,
                stops: day.stops.map((stop, currentStopIndex) =>
                  currentStopIndex === stopIndex ? { ...stop, attachments } : stop,
                ),
              }
            : day,
        ),
      80,
    );
    return Promise.resolve();
  }

  function handleUpdateLodgingAssignment(
    dayIndex: number,
    position: DayLodgingAnchor["position"],
    companionIds: string[],
  ) {
    updateDaysDraft(
      (days) => {
        const target = lodgingTargetForAnchor(days, dayIndex, position);
        if (!target) return days;
        return days.map((day, index) => {
          if (index !== target.dayIndex) return day;
          return {
            ...day,
            stops: day.stops.map((stop) =>
              stop === target.stop
                ? withLodgingAssignment(
                    stop,
                    companionIds,
                    labels.lodging_stops.assign_people,
                  )
                : stop,
            ),
          };
        });
      },
      180,
    );
  }

  async function handleAddCandidateToTrip(
    landmark: LandmarkSearchResult,
  ): Promise<{ dayIndex: number; stopIndex: number }> {
    if (candidateDetailsState.adding) {
      throw new Error("candidate add already in progress");
    }
    setCandidateDetailsState((current) => ({ ...current, adding: true }));
    try {
      if (candidateDetailsState.suggestedPlacement) {
        const placement = candidateDetailsState.suggestedPlacement;
        const nextSelected = !candidateDetailsState.selectedSuggestion;
        const nextDays = setSuggestedPlaceSelected(
          modelRef.current.days,
          placement,
          landmark,
          nextSelected,
        );
        const nextModel = {
          ...modelRef.current,
          days: nextDays,
          notes: nextDays.map((day) => day.note).filter(Boolean),
        };
        modelRef.current = nextModel;
        setModel(nextModel);
        setActiveView(placement.dayIndex);
        await replaceTripDays({ tripId: trip.id, days: nextDays });
        setCandidateDetailsState((current) => ({
          ...current,
          adding: false,
          selectedSuggestion: nextSelected,
          landmark: current.landmark
            ? { ...current.landmark, selected: nextSelected }
            : current.landmark,
        }));
        return { dayIndex: placement.dayIndex, stopIndex: placement.stopIndex };
      }
      const placement = planLandmarkInsertion(modelRef.current.days, landmark);
      const nextModel = {
        ...modelRef.current,
        days: placement.days,
        notes: placement.days.map((day) => day.note).filter(Boolean),
      };
      setActiveView(placement.dayIndex);
      setMapFocus({
        mode: "stop",
        index: placement.stopIndex,
        source: "added",
      });
      setManualMapFocusVersion((version) => version + 1);
      modelRef.current = nextModel;
      setModel(nextModel);
      await replaceTripDays({ tripId: trip.id, days: placement.days });
      await refreshTrip(trip.id);
      setCandidateDetailsState({
        landmark: null,
        key: null,
        details: null,
        loading: false,
        error: false,
        adding: false,
        lodgingPlan: null,
        suggestedPlacement: null,
        selectedSuggestion: false,
      });
      setCandidateClearVersion((version) => version + 1);
      return { dayIndex: placement.dayIndex, stopIndex: placement.stopIndex };
    } catch (error) {
      setCandidateDetailsState((current) => ({ ...current, adding: false }));
      throw error;
    }
  }

  async function handleAddLodgingToTrip(
    landmark: LandmarkSearchResult,
    range: LodgingDateRange,
  ): Promise<void> {
    if (candidateDetailsState.adding) {
      throw new Error("lodging add already in progress");
    }
    const startIndex = Math.max(
      0,
      Math.min(modelRef.current.days.length - 1, range.startIndex),
    );
    const endIndex = Math.max(
      startIndex,
      Math.min(modelRef.current.days.length - 1, range.endIndex),
    );
    setCandidateDetailsState((current) => ({ ...current, adding: true }));
    try {
      const lodgingStop = landmarkToLodgingStop(landmark);
      const targetIndexes = modelRef.current.days
        .map((_, dayIndex) => dayIndex)
        .filter(
          (dayIndex) =>
            dayIndex >= startIndex &&
            dayIndex <= endIndex &&
            !overnightFlightStopForDay(modelRef.current.days[dayIndex]),
        );
      if (targetIndexes.length === 0) {
        targetIndexes.push(startIndex);
      }
      const targetIndexSet = new Set(targetIndexes);
      const nextDays = modelRef.current.days.map((day, dayIndex) => {
        if (!targetIndexSet.has(dayIndex)) return day;
        return {
          ...day,
          stops: [
            ...day.stops.filter((stop) => !isLodgingStop(stop)),
            lodgingStop,
          ],
        };
      });
      const nextModel = {
        ...modelRef.current,
        days: nextDays,
        notes: nextDays.map((day) => day.note).filter(Boolean),
      };
      modelRef.current = nextModel;
      setModel(nextModel);
      setActiveView(startIndex);
      setMapFocus(null);
      await replaceTripDays({ tripId: trip.id, days: nextDays });
      await refreshTrip(trip.id);
      setCandidateDetailsState({
        landmark: null,
        key: null,
        details: null,
        loading: false,
        error: false,
        adding: false,
        lodgingPlan: null,
        suggestedPlacement: null,
        selectedSuggestion: false,
      });
      setCandidateClearVersion((version) => version + 1);
    } catch (error) {
      setCandidateDetailsState((current) => ({ ...current, adding: false }));
      throw error;
    }
  }

  async function handleSaveLodgingDates(
    target: LodgingSettingsTarget,
    range: LodgingDateRange,
  ): Promise<void> {
    const nextDays = applyLodgingDateRange(
      modelRef.current.days,
      target,
      range,
    );
    const nextModel = {
      ...modelRef.current,
      days: nextDays,
      notes: nextDays.map((day) => day.note).filter(Boolean),
    };
    modelRef.current = nextModel;
    setModel(nextModel);
    setActiveView(normalizeLodgingDateRange(range, nextDays.length).startIndex);
    setMapFocus(null);
    setLodgingSettings(null);
    await replaceTripDays({ tripId: trip.id, days: nextDays });
    await refreshTrip(trip.id);
  }

  async function handleUploadMovementBooking({
    dayIndex,
    fromIndex,
    attachment,
    imageName,
    imageDataUrl,
  }: {
    dayIndex: number;
    fromIndex: number;
    attachment: TripStopAttachment;
    imageName: string;
    imageDataUrl: string;
  }) {
    const stop = modelRef.current.days[dayIndex]?.stops[fromIndex];
    if (!stop) throw new Error("movement stop not found");
    const nextAttachment: TripStopAttachment = {
      ...attachment,
      imageName,
      imageDataUrl,
      status: "uploaded",
      done: true,
    };

    if (stop.id) {
      const response = await fetch(
        `/api/trips/${trip.id}/stops/${stop.id}/attachments/${encodeURIComponent(attachment.id)}`,
        {
          method: "PATCH",
          credentials: "same-origin",
          cache: "no-store",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            status: "uploaded",
            image_name: imageName,
            image_data_url: imageDataUrl,
          }),
        },
      );
      if (!response.ok) throw new Error(`attachment update failed: ${response.status}`);
    }

    updateDaysDraft(
      (days) =>
        days.map((day, index) =>
          index === dayIndex
            ? {
                ...day,
                stops: day.stops.map((currentStop, currentStopIndex) =>
                  currentStopIndex === fromIndex
                    ? {
                        ...currentStop,
                        attachments: (currentStop.attachments ?? []).map((current) =>
                          current.id === attachment.id ? nextAttachment : current,
                        ),
                      }
                    : currentStop,
                ),
              }
            : day,
        ),
      0,
    );
    await refreshTrip(trip.id);
  }

  if (inspirationExploreActive) {
    return (
      <InspirationExploreImmersive
        lang={lang}
        model={model}
        labels={labels}
        planningMetadata={planningMetadata}
        onUpdateMetadata={handleUpdateTripMetadata}
        onConfirmDraft={handleConfirmInspirationDraft}
      />
    );
  }

  // R-301 D-1/D-2. Mapped here rather than inside the sheet so the sheet stays a pure
  // renderer of the depth contract and the workspace keeps owning the trip model.
  const planningSheetDays: PlanningSheetDay[] = model.days.map((day, dayIndex) => ({
    id: day.date || `day-${dayIndex}`,
    date: day.date,
    city: day.city,
    items: day.stops.map((stop, stopIndex) => ({
      id: stop.id ?? `${day.date}-${stopIndex}`,
      name: stop.name,
      kind: stop.kind ?? "sight",
      arrivalTime: stop.arrival_time ?? null,
      durationMin: stop.duration_min ?? null,
      note: stop.note ?? null,
      placeName: stop.placeName ?? null,
      attachmentCount: stop.attachments?.length ?? 0,
      ticketRequired: (stop.attachments ?? []).some(
        (attachment) => attachment.status === "required",
      ),
    })),
  }));

  return (
    <div
      data-testid="trip-detail-workspace"
      className="min-h-dvh overflow-x-hidden bg-paper px-3 pb-8 pt-20 text-fg sm:px-5 sm:pt-24 lg:px-7"
    >
      <div className="mx-auto grid min-h-0 w-full max-w-[1760px] gap-5 2xl:grid-cols-[minmax(0,1fr)_400px]">
        <main className="min-w-0">
          <TripHeader
            lang={lang}
            model={model}
            companions={companions}
            labels={labels}
            saveError={titleSaveError}
            onRenameTrip={handleRenameTrip}
            exploringStage={exploringStage}
            dateGlow={dateGlow}
            onUpdateDates={handleUpdateTripDates}
          />
          <JourneyLivePanel
            state={journeyLiveState}
            labels={labels.journey_live}
          />
          {exploringStage ? (
            exploreStep === "flights" ? (
              <ExploreFlightsBoard
                cities={explorationCities}
                flights={exploreFlights}
                departure={selectedDeparturePlace}
                selectedIndex={selectedFlightIndex}
                onSelect={setSelectedFlightIndex}
                onBack={() => setExploreStep("places")}
                onRequestDeparture={() => setHomeDialogOpen(true)}
                labels={labels.explore_flights}
              />
            ) : (
              <ExploreStageMap
                lang={lang}
                cities={explorationCities}
                labels={labels.explore_stage}
                onSearch={handleExploreSearch}
                onAddCity={handleAddExplorationCity}
                onRemoveCity={handleRemoveExplorationCity}
                onResolvePoint={handleResolveExplorePoint}
                nextEnabled={explorationCities.length > 0}
                onNext={() => {
                  handleExplorationStepChange("flights");
                }}
              />
            )
          ) : (
            <div
              data-testid="trip-map-itinerary-grid"
              className="mt-4 grid min-w-0 gap-4 2xl:grid-cols-[minmax(340px,0.42fr)_minmax(520px,0.58fr)] 2xl:items-stretch"
            >
              <div className="min-w-0 2xl:min-h-[650px]">
                <RouteMap
                  tripId={trip.id}
                  lang={lang}
                  days={model.days}
                  activeView={activeView}
                  mapFocus={mapFocus}
                  autoplayEnabled={mapAutoplayEnabled}
                  inspirationExploreActive={inspirationExploreActive}
                  onActiveViewChange={handleActiveViewChange}
                  onMapFocusChange={handleMapFocusChange}
                  onAutoplayChange={setMapAutoplayEnabled}
                  onAutoplayResume={handleResumeMapAutoplay}
                  onRequestAutoplayPause={handleRequestMapAutoplayPause}
                  onSelectInspirationCountry={handleSelectInspirationCountry}
                  onCandidateSelect={handleCandidateSelect}
                  onAddCandidateToTrip={handleAddCandidateToTrip}
                  candidateClearVersion={candidateClearVersion}
                  lodgingSearchRequest={lodgingSearchRequest}
                  activeStopFocusKey={
                    mapFocus?.mode === "stop"
                      ? `${mapFocus.index}:${mapFocus.source ?? "auto"}:${manualMapFocusVersion}`
                      : mapFocus?.mode === "movement"
                        ? `${mapFocus.fromIndex}:${mapFocus.toIndex}:${mapFocus.source ?? "auto"}:${manualMapFocusVersion}`
                        : null
                  }
                  focusActiveStopOnly={
                    (mapFocus?.mode === "stop" && mapFocus.source === "added") ||
                    isRegionalTripStop(activeStopForDetails)
                  }
                  labels={labels}
                />
              </div>

              <section className="min-h-0 min-w-0 rounded-[22px] border border-divider bg-paper-raised p-3 shadow-[var(--shadow-sm)] sm:p-4">
                <h2 className="px-1 pb-1 pt-0.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-fg-muted">
                  {labels.daily_itinerary}
                </h2>
                <DailyItinerary
                  days={model.days}
                  lang={lang}
                  companions={companions}
                  bookingAdults={bookingAdults}
                  homePlace={homePlace}
                  activeView={activeView}
                  mapFocus={mapFocus}
                  activeStopLandmarkLabel={activeStopLandmarkLabel}
                  onActiveViewChange={handleActiveViewChange}
                  onMapFocusChange={handleMapFocusChange}
                  onReorderDayStops={handleReorderDayStops}
                  onUpdateDays={(updater, debounceMs) =>
                    updateDaysDraft(updater, debounceMs)
                  }
                  onUpdateStopTime={handleUpdateStopTime}
                  onUpdateStopAttachments={handleUpdateStopAttachments}
                  onAutoArrangeDayStops={handleReorderDayStops}
                  onOpenLodgingSettings={handleOpenLodgingSettings}
                  onRequestHomeSettings={() => setHomeDialogOpen(true)}
                  onUpdateLodgingAssignment={handleUpdateLodgingAssignment}
                  journeyStarted={journeyStarted}
                  selectedDay={selectedDay}
                  labels={labels}
                />
              </section>
            </div>
          )}
        </main>

        {homeDialogOpen ? (
          <HomePlaceDialog
            open={homeDialogOpen}
            homePlace={homePlace}
            labels={labels.lodging_stops}
            onOpenChange={setHomeDialogOpen}
            onSave={handleSaveHomePlace}
          />
        ) : null}

        {lodgingSettings ? (
          <LodgingSettingsDialog
            key={`${lodgingSettings.dayIndex}:${lodgingSettings.position}:${lodgingSettings.target?.stop.name ?? "new"}:${lodgingSettings.range.startIndex}:${lodgingSettings.range.endIndex}`}
            open={Boolean(lodgingSettings)}
            days={model.days}
            settings={lodgingSettings}
            labels={labels.lodging_stops}
            dayLabel={labels.day_label}
            bookingAdults={bookingAdults}
            onOpenChange={(open) => {
              if (!open) setLodgingSettings(null);
            }}
            onSave={handleSaveLodgingDates}
            onChooseStay={(range) =>
              handleRequestLodgingSearch(
                lodgingSettings.dayIndex,
                lodgingSettings.position,
                range,
              )
            }
          />
        ) : null}

        {exploringStage && exploreStep === "flights" ? (
          <ExploreFlightsPanel
            flights={exploreFlights}
            departure={selectedDeparturePlace}
            departurePlaces={departurePlaces}
            selectedIndex={selectedFlightIndex}
            onSelect={setSelectedFlightIndex}
            onBack={() => setExploreStep("places")}
            onDepartureSelect={(placeId) =>
              void handleSelectDeparturePlace(placeId)
            }
            onRequestDeparture={() => setHomeDialogOpen(true)}
            flightDetails={explorationFlightDetails}
            onFlightDetailsChange={(legKey, details) =>
              void handleUpdateExplorationFlightDetails(legKey, details)
            }
            labels={labels.explore_flights}
          />
        ) : (
        <TripSidePanel
          key={
            activeMovementDetailsKey ??
            activeStopDetailsKey ??
            candidateDetailsState.key ??
            "trip-side-panel"
          }
          tripId={trip.id}
          lang={lang}
          days={model.days}
          checklist={model.checklist}
          metadata={model.metadata}
          explorationStep={exploringStage ? exploreStep : null}
          onExplorationStepChange={handleExplorationStepChange}
          activeStop={
            activeStopForDetails &&
            selectedDay &&
            activeDayIndex != null &&
            activeStopIndex != null
              ? {
                  stop: activeStopForDetails,
                  day: selectedDay,
                  dayIndex: activeDayIndex,
                  stopIndex: activeStopIndex,
                  details: currentStopDetails,
                  loading: currentStopDetailsLoading,
                  error: currentStopDetailsError,
                }
              : null
          }
          activeMovement={
            activeMovementForDetails?.fromStop &&
            activeMovementForDetails.toStop &&
            selectedDay &&
            activeDayIndex != null &&
            activeMovementDetailsKey
              ? {
                  day: selectedDay,
                  dayIndex: activeDayIndex,
                  fromStop: activeMovementForDetails.fromStop,
                  toStop: activeMovementForDetails.toStop,
                  fromIndex: activeMovementForDetails.fromIndex,
                  toIndex: activeMovementForDetails.toIndex,
                  segment:
                    movementSegmentState.key === activeMovementDetailsKey
                      ? movementSegmentState.segment
                      : null,
                  loading:
                    movementSegmentState.key !== activeMovementDetailsKey ||
                    movementSegmentState.loading,
                  attachment: activeMovementAttachment,
                }
              : null
          }
          activeCandidate={
            candidateDetailsState.landmark
              ? {
                  landmark: candidateDetailsState.landmark,
                  details:
                    candidateDetailsState.key ===
                    landmarkKey(candidateDetailsState.landmark)
                      ? candidateDetailsState.details
                      : null,
                  loading:
                    candidateDetailsState.key !==
                      landmarkKey(candidateDetailsState.landmark) ||
                    candidateDetailsState.loading,
                  error:
                    candidateDetailsState.key ===
                      landmarkKey(candidateDetailsState.landmark) &&
                    candidateDetailsState.error,
                  adding: candidateDetailsState.adding,
                  lodgingPlan: candidateDetailsState.lodgingPlan,
                  suggestedPlacement: candidateDetailsState.suggestedPlacement,
                  selectedSuggestion: candidateDetailsState.selectedSuggestion,
                }
              : null
          }
          onAddCandidateToTrip={handleAddCandidateToTrip}
          onAddLodgingToTrip={handleAddLodgingToTrip}
          bookingAdults={bookingAdults}
          onUpdateStopBudget={handleUpdateStopBudget}
          onUploadMovementBooking={handleUploadMovementBooking}
          onUpdateTripNotes={handleUpdateTripNotes}
          onUpdateTripMetadata={handleUpdateTripMetadata}
          onCloseStopDetails={() => {
            setMapFocus(null);
            setCandidateDetailsState((current) => ({
              ...current,
              landmark: null,
              adding: false,
              lodgingPlan: null,
              suggestedPlacement: null,
              selectedSuggestion: false,
            }));
            setCandidateClearVersion((version) => version + 1);
          }}
          labels={labels}
        />
        )}

        {lumiTakeover ? (
          <LumiTakeoverOverlay
            prompt={lumiTakeover.prompt}
            labels={labels.lumi_takeover}
            avatarSrc="/lumi-avatars/classic.png"
            dateTargetId="roam-trip-daterange"
            onApplyDates={async (startDate, endDate) => {
              setDateGlow(true);
              try {
                await handleUpdateTripDates(startDate, endDate);
              } finally {
                window.setTimeout(() => setDateGlow(false), 2400);
              }
            }}
            onAddCity={handleAddExplorationCity}
            onApplyFlightDetails={handleApplyTakeoverFlightDetails}
            onDismiss={() => {
              setLumiTakeover(null);
              if (modelRef.current.metadata.lumi_takeover_done !== true) {
                void handleUpdateTripMetadata({
                  ...modelRef.current.metadata,
                  lumi_takeover_done: true,
                }).catch(() => undefined);
              }
            }}
          />
        ) : null}
      </div>

      {/* R-301: the planning sheet owns the mobile surface. Rendered as a sibling of
          the grid rather than inside it so its fixed positioning is measured against
          the viewport, and hidden at xl where the side panel already is the layer. */}
      {!exploringStage ? (
        <TripPlanningSheet
          days={planningSheetDays}
          labels={labels.planning_depth}
        />
      ) : null}
    </div>
  );
}

const consumedLumiTakeoverPrompts = new Map<string, string | null>();

function consumeLumiTakeoverPrompt(tripId: string): string | null {
  if (consumedLumiTakeoverPrompts.has(tripId)) {
    return consumedLumiTakeoverPrompts.get(tripId) ?? null;
  }
  let promptText: string | null = null;
  try {
    const key = `roam:lumi-takeover:${tripId}`;
    const raw = sessionStorage.getItem(key);
    if (raw) {
      sessionStorage.removeItem(key);
      const parsed = JSON.parse(raw) as { prompt?: string };
      promptText = parsed.prompt?.trim() || null;
    }
  } catch {
    promptText = null;
  }
  consumedLumiTakeoverPrompts.set(tripId, promptText);
  return promptText;
}

function TripHeader({
  lang,
  model,
  companions,
  labels,
  saveError,
  onRenameTrip,
  exploringStage,
  dateGlow,
  onUpdateDates,
}: {
  lang: string;
  model: TripModel;
  companions: ApiCompanion[];
  labels: TripPlanningLabels;
  saveError: boolean;
  onRenameTrip: (title: string) => void;
  exploringStage: boolean;
  dateGlow: boolean;
  onUpdateDates: (startDate: string, endDate: string) => Promise<void>;
}) {
  const rangeDayCount = (() => {
    const start = new Date(`${model.startDate}T00:00:00`);
    const end = new Date(`${model.endDate}T00:00:00`);
    const diff = Math.round((end.getTime() - start.getTime()) / 86400000) + 1;
    return Number.isFinite(diff) && diff > 0 ? diff : model.days.length;
  })();
  const router = useRouter();
  const routeCities = Array.from(
    new Set(
      model.days.flatMap((day) =>
        day.cities.length > 0 ? day.cities : [day.city],
      ),
    ),
  ).filter(Boolean);
  const routeLabel =
    routeCities.length > 1
      ? `${routeCities[0]} → ${routeCities.at(-1)}`
      : routeCities[0] || model.destination || "";
  const stampDate = `${shortDate(model.startDate)} — ${shortDate(model.endDate)}`;

  async function handleShareTrip() {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title: model.title, url });
      } catch {
        // Closing the native share sheet is not an application error.
      }
      return;
    }
    await navigator.clipboard.writeText(url);
  }

  return (
    <>
    <EditorialMasthead className="min-h-[214px] bg-paper-raised">
      <div className="absolute inset-y-0 right-0 hidden w-[52%] md:block">
        <EditorialCover
          src={model.cover}
          seed={model.id}
          alt=""
          sizes="(min-width: 1280px) 720px, 50vw"
          className="object-cover saturate-[0.82]"
          priority
        />
      </div>
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,var(--paper-raised)_0%,var(--paper-raised)_52%,transparent_100%)]" />
      <div className="relative z-10 flex min-h-[214px] flex-col justify-between gap-5 p-4 sm:p-5 lg:p-6">
        <div className="flex min-w-0 items-start justify-between gap-4">
          <div className="min-w-0">
            <Link
              href={`/${lang}/trips`}
              className="inline-flex h-9 items-center gap-1 text-[12px] font-semibold text-fg-muted transition-colors hover:text-fg"
            >
              <ChevronLeft className="h-4 w-4" />
              {labels.back_to_trips}
            </Link>
            <div className="mt-1 max-w-[720px] [&_h1]:font-editorial [&_h1]:text-[34px] [&_h1]:font-normal [&_h1]:leading-[0.98] [&_h1]:tracking-[-0.035em] sm:[&_h1]:text-[46px] lg:[&_h1]:text-[54px]">
              <TripTitleEditor
                key={`${model.id}:${model.title}`}
                title={model.title}
                editLabel={labels.edit_title}
                saveErrorLabel={labels.title_save_error}
                saveError={saveError}
                onRename={onRenameTrip}
              />
            </div>
            {routeLabel ? (
              <p className="mt-3 text-[13px] font-medium text-fg-secondary">
                {routeLabel}
              </p>
            ) : null}
          </div>
          {routeCities.length > 0 ? (
            <EditorialRouteStamp
              route={routeCities.map((city) => city.slice(0, 4)).join(" · ")}
              date={stampDate}
              className="hidden shrink-0 sm:grid md:mr-[44%]"
            />
          ) : null}
        </div>

        <div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <TripDateRangePicker
            id="roam-trip-daterange"
            startDate={model.startDate}
            endDate={model.endDate}
            dayCount={model.days.length > 0 ? model.days.length : rangeDayCount}
            editable={exploringStage}
            glow={dateGlow}
            labels={labels.date_range}
            dayUnit={labels.day_unit}
            onChange={onUpdateDates}
          />
          <div className="flex max-w-full gap-2 overflow-x-auto pb-1 lg:justify-end">
            <Button
              type="button"
              variant="outline"
              className="h-10 shrink-0 rounded-xl bg-white/92"
              onClick={() => void handleShareTrip()}
            >
              <Share2 className="h-4 w-4" />
              {labels.share}
            </Button>
            <Button
              type="button"
              className="h-10 shrink-0 rounded-xl bg-fg px-4 text-white hover:bg-fg-secondary"
              onClick={() => exportTripCalendar(model)}
            >
              <Plane className="h-4 w-4" />
              {labels.export_trip}
            </Button>
            <CompanionsMenu
              tripId={model.id}
              companions={companions}
              labels={labels.companions}
              trigger={
                <span className="inline-flex h-10 items-center rounded-full border border-divider bg-white/92 px-2.5 shadow-sm">
                  <AvatarStack companions={companions} interactive />
                </span>
              }
            />
            <TripMoreMenu
              tripId={model.id}
              title={model.title}
              labels={labels.settings}
              onDeleted={() => {
                router.push(`/${lang}/trips`);
                router.refresh();
              }}
            />
          </div>
        </div>
      </div>
    </EditorialMasthead>
      <div
        data-testid="trip-mobile-context"
        className="sticky top-[72px] z-30 mt-2 flex min-w-0 items-center justify-between gap-3 rounded-2xl border border-divider bg-paper-raised/94 px-3 py-2.5 shadow-[var(--shadow-md)] backdrop-blur-xl md:hidden"
      >
        <div className="min-w-0">
          <p className="truncate font-editorial text-[18px] leading-tight text-fg">
            {model.title}
          </p>
          <p className="mt-0.5 truncate font-mono text-[10px] text-fg-muted">
            {shortDate(model.startDate)} — {shortDate(model.endDate)}
          </p>
        </div>
        {routeLabel ? (
          <span className="max-w-[42%] truncate text-[11px] font-semibold text-accent">
            {routeLabel}
          </span>
        ) : null}
      </div>
    </>
  );
}

function InspirationExploreImmersive({
  lang,
  model,
  labels,
  planningMetadata,
  onUpdateMetadata,
  onConfirmDraft,
}: {
  lang: string;
  model: TripModel;
  labels: TripPlanningLabels;
  planningMetadata: TripPlanningMetadata;
  onUpdateMetadata: (metadata: Record<string, unknown>) => Promise<void>;
  onConfirmDraft: (items: InspirationWishlistItem[]) => Promise<void>;
}) {
  const exploreLabels = labels.inspiration_explore;
  const copyById = useMemo(
    () => new Map(exploreLabels.events.map((event) => [event.id, event])),
    [exploreLabels.events],
  );
  const events = useMemo(
    () =>
      SPOTLIGHT_EVENTS.map((event) => {
        const copy = copyById.get(event.id);
        return { ...event, ...(copy ?? fallbackInspirationEventCopy(event.id)) };
      }),
    [copyById],
  );
  const categories = useMemo(
    () => Array.from(new Set(events.map((event) => event.category))),
    [events],
  );
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const filteredEvents = events.filter((event) => {
    const matchesCategory = selectedCategory
      ? event.category === selectedCategory
      : true;
    const query = searchQuery.trim().toLowerCase();
    const matchesQuery = query
      ? `${event.title} ${event.location} ${event.category}`.toLowerCase().includes(query)
      : true;
    return matchesCategory && matchesQuery;
  });
  const [activeId, setActiveId] = useState(events[0]?.id ?? "");
  const [notebookOpen, setNotebookOpen] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [flyingId, setFlyingId] = useState<string | null>(null);
  const [confirmingDraft, setConfirmingDraft] = useState(false);
  const [confirmError, setConfirmError] = useState(false);
  const activeEvent =
    filteredEvents.find((event) => event.id === activeId) ??
    filteredEvents[0] ??
    events[0];
  const wishlist = planningMetadata.inspirationWishlist;
  const savedIds = useMemo(
    () => new Set(wishlist.map((item) => item.id)),
    [wishlist],
  );
  const mapEvents = filteredEvents.map((event) => ({
    id: event.id,
    title: event.title,
    lat: event.lat,
    lng: event.lng,
    tone: event.tone,
  }));
  const categorySummaries = useMemo(
    () =>
      categories.map((category) => {
        const categoryEvents = events.filter((event) => event.category === category);
        return {
          category,
          count: categoryEvents.length,
          image: categoryEvents[0]?.image ?? "/illustrations/explore.png",
        };
      }),
    [categories, events],
  );

  if (!activeEvent) {
    return (
      <div className="fixed inset-0 z-[70] bg-surface text-fg">
        <Link
          href={`/${lang}/trips`}
          className="absolute left-4 top-4 inline-flex h-10 items-center gap-1 text-[13px] font-semibold text-fg-muted hover:text-fg"
        >
          <ChevronLeft className="h-4 w-4" />
          {labels.back_to_trips}
        </Link>
      </div>
    );
  }

  function eventToWishlistItem(
    event: typeof activeEvent,
  ): InspirationWishlistItem {
    return {
      id: event.id,
      title: event.title,
      category: event.category,
      location: event.location,
      description: event.description,
      countryCode: event.countryCode,
      image: event.image,
      lat: event.lat,
      lng: event.lng,
      tone: event.tone,
    };
  }

  async function saveWishlist(nextWishlist: InspirationWishlistItem[]) {
    const planning =
      model.metadata.planning && typeof model.metadata.planning === "object"
        ? (model.metadata.planning as Record<string, unknown>)
        : {};
    await onUpdateMetadata({
      ...model.metadata,
      planning: {
        ...planning,
        inspiration_wishlist: nextWishlist.map((item) => ({
          id: item.id,
          title: item.title,
          category: item.category,
          location: item.location,
          description: item.description,
          country_code: item.countryCode,
          image: item.image,
          lat: item.lat,
          lng: item.lng,
          tone: item.tone,
        })),
      },
    });
  }

  async function addActiveEventToWishlist() {
    if (savedIds.has(activeEvent.id) || savingId) return;
    setSavingId(activeEvent.id);
    try {
      await saveWishlist([...wishlist, eventToWishlistItem(activeEvent)]);
      setFlyingId(activeEvent.id);
      window.setTimeout(() => setFlyingId(null), 780);
    } finally {
      setSavingId(null);
    }
  }

  async function removeWishlistItem(id: string) {
    if (savingId) return;
    setSavingId(id);
    try {
      await saveWishlist(wishlist.filter((item) => item.id !== id));
    } finally {
      setSavingId(null);
    }
  }

  function activateEvent(eventId: string) {
    setActiveId(eventId);
  }

  function showRelativeEvent(direction: -1 | 1) {
    if (filteredEvents.length <= 1) return;
    const currentIndex = Math.max(
      0,
      filteredEvents.findIndex((event) => event.id === activeEvent.id),
    );
    const nextIndex =
      (currentIndex + direction + filteredEvents.length) % filteredEvents.length;
    setActiveId(filteredEvents[nextIndex]!.id);
  }

  async function confirmDraft() {
    if (wishlist.length === 0 || confirmingDraft) return;
    setConfirmingDraft(true);
    setConfirmError(false);
    try {
      await onConfirmDraft(wishlist);
    } catch {
      setConfirmError(true);
      setConfirmingDraft(false);
    }
  }

  const activeCountryName = countryNameForCode(activeEvent.countryCode, lang);
  const activeSaved = savedIds.has(activeEvent.id);

  return (
    <div className="fixed inset-0 isolate z-[999] h-svh w-screen overflow-hidden bg-[#f2eadc] text-fg">
      <style>{INSPIRATION_IMMERSIVE_CSS}</style>
      <div className="roam-inspiration-map absolute inset-0 z-0">
        <SpotlightFlagMap
          events={mapEvents}
          activeId={activeEvent.id}
          onActiveChange={activateEvent}
          interactive
          colorful
        />
      </div>
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(248,244,236,0.42)_0%,rgba(248,244,236,0.06)_34%,rgba(248,244,236,0.18)_76%,rgba(248,244,236,0.74)_100%)]" />

      <header className="absolute left-4 top-4 z-40 max-w-[760px] sm:left-8 sm:top-7">
        <Link
          href={`/${lang}/trips`}
          className="inline-flex h-8 items-center gap-1 text-[12px] font-semibold text-fg-muted transition hover:text-fg"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          {labels.back_to_trips}
        </Link>
        <h1 className="mt-1 text-[30px] font-semibold leading-tight tracking-tight text-fg sm:text-[38px]">
          {exploreLabels.hero_title}
        </h1>
        <p className="mt-1 text-[15px] font-semibold text-fg-secondary">
          {exploreLabels.radar_subtitle}
        </p>
        <form
          className="mt-5 flex h-12 w-[min(420px,calc(100vw-2rem))] items-center gap-3 rounded-2xl border border-white/82 bg-white/92 px-4 shadow-[0_18px_56px_-42px_rgba(32,41,46,0.55)] backdrop-blur-xl"
          onSubmit={(event) => event.preventDefault()}
        >
          <Search className="h-5 w-5 shrink-0 text-fg-muted" />
          <Input
            value={searchQuery}
            placeholder={exploreLabels.search_placeholder}
            className="h-10 border-0 bg-transparent px-0 text-[14px] font-semibold shadow-none placeholder:text-fg-subtle focus-visible:ring-0"
            onChange={(event) => setSearchQuery(event.target.value)}
          />
          {searchQuery ? (
            <button
              type="button"
              className="grid h-7 w-7 place-items-center rounded-full text-fg-muted transition hover:bg-muted hover:text-fg"
              onClick={() => setSearchQuery("")}
              aria-label={labels.map_search.clear}
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </form>
      </header>

      <div className="absolute left-4 right-4 top-[156px] z-40 flex gap-2 overflow-x-auto pb-2 sm:left-[520px] sm:right-[420px] sm:top-[106px]">
        <FilterChip
          active={selectedCategory == null}
          label={exploreLabels.filter_all}
          onClick={() => setSelectedCategory(null)}
        />
        {categories.map((category) => (
          <FilterChip
            key={category}
            active={selectedCategory === category}
            label={category}
            onClick={() => setSelectedCategory(category)}
          />
        ))}
        <button
          type="button"
          className="h-11 shrink-0 rounded-2xl border border-white/80 bg-white/84 px-4 text-[13px] font-semibold text-[#b95468] shadow-sm backdrop-blur-xl transition hover:bg-white"
          onClick={() => {
            setSelectedCategory(null);
            setSearchQuery("");
          }}
        >
          {exploreLabels.reset_filters}
        </button>
      </div>

      <Button
        type="button"
        variant="outline"
        className={cn(
          "absolute right-4 top-4 z-50 h-11 rounded-2xl border-white/80 bg-white/90 shadow-sm backdrop-blur-xl sm:top-7",
          notebookOpen ? "sm:right-[392px]" : "sm:right-8",
        )}
      >
        <Share2 className="h-4 w-4" />
        {labels.share}
      </Button>

      <button
        type="button"
        className={cn(
          "absolute right-4 top-[74px] z-50 inline-flex h-14 items-center gap-2 rounded-[24px] border border-white/80 bg-white/92 px-4 text-[14px] font-semibold text-fg-secondary shadow-[0_24px_70px_-42px_rgba(32,41,46,0.7)] backdrop-blur-xl transition hover:-translate-y-0.5 hover:text-accent sm:top-7",
          notebookOpen ? "sm:right-[496px]" : "sm:right-[126px]",
        )}
        onClick={() => setNotebookOpen((open) => !open)}
        aria-pressed={notebookOpen}
      >
        <span className="relative grid h-8 w-8 place-items-center rounded-xl bg-accent-soft text-accent">
          <BookMarked className="h-[18px] w-[18px]" />
          {wishlist.length > 0 ? (
            <span className="absolute -right-2 -top-2 grid h-5 min-w-5 place-items-center rounded-full bg-[#d6526f] px-1 text-[10px] font-semibold text-white shadow-sm">
              {wishlist.length}
            </span>
          ) : null}
        </span>
        {exploreLabels.notebook}
      </button>

      <section className="absolute left-4 top-[218px] z-30 w-[min(420px,calc(100vw-2rem))] sm:left-8 sm:top-[210px]">
        <div className="overflow-hidden rounded-[26px] border border-white/82 bg-white/94 shadow-[0_30px_90px_-48px_rgba(32,41,46,0.78)] backdrop-blur-xl">
          <div className="relative h-[260px]">
            <Image
              src={activeEvent.image}
              alt=""
              fill
              priority
              sizes="420px"
              className="object-cover"
            />
            <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0)_46%,rgba(0,0,0,0.38)_100%)]" />
            <span className="absolute left-4 top-4 rounded-full bg-white/88 px-3 py-1.5 text-[12px] font-semibold text-[#b95468] shadow-sm backdrop-blur">
              {activeEvent.category}
            </span>
            <div className="absolute right-4 top-4 flex flex-col gap-3">
              <button
                type="button"
                className="grid h-12 w-12 place-items-center rounded-full bg-white/90 text-fg-muted shadow-sm backdrop-blur transition hover:text-fg"
                onClick={() => showRelativeEvent(1)}
                aria-label={labels.route_preview}
              >
                <X className="h-5 w-5" />
              </button>
              <button
                type="button"
                className={cn(
                  "grid h-12 w-12 place-items-center rounded-full bg-white/90 shadow-sm backdrop-blur transition",
                  activeSaved ? "text-[#d6526f]" : "text-[#d6526f]/75 hover:text-[#d6526f]",
                )}
                onClick={() => void addActiveEventToWishlist()}
                disabled={activeSaved || savingId === activeEvent.id}
                aria-label={exploreLabels.want_to_go}
              >
                {savingId === activeEvent.id ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Heart className={cn("h-5 w-5", activeSaved && "fill-current")} />
                )}
              </button>
            </div>
          </div>
          <div className="p-5">
            <h2 className="text-[28px] font-semibold leading-tight tracking-tight text-fg">
              {activeEvent.title}
            </h2>
            <p className="mt-2 inline-flex items-center gap-2 text-[13px] font-semibold text-fg-secondary">
              <span>{activeCountryName}</span>
              <span className="h-1 w-1 rounded-full bg-fg-subtle" />
              <span>{activeEvent.location}</span>
            </p>
            <div className="mt-3 flex items-center gap-2 text-[13px] font-semibold text-fg-muted">
              <CalendarDays className="h-4 w-4" />
              <span>{activeEvent.story_timing_value}</span>
              <span className="rounded-full bg-[#fae8ed] px-2.5 py-1 text-[#b95468]">
                {activeEvent.story_timing_label}
              </span>
            </div>
            <p className="mt-4 text-[14px] leading-7 text-fg-secondary">
              {activeEvent.story_headline}
            </p>
            <div className="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-[13px]">
              <span className="font-semibold text-fg-muted">{exploreLabels.details_title}</span>
              <span className="font-semibold text-fg-secondary">
                {activeEvent.description}
              </span>
              <span className="font-semibold text-fg-muted">{activeEvent.story_timing_label}</span>
              <span className="font-semibold text-fg-secondary">
                {activeEvent.story_timing_value}
              </span>
            </div>
            <div className="mt-5 grid grid-cols-[1fr_48px] gap-3">
              <Button
                type="button"
                disabled={activeSaved || savingId === activeEvent.id}
                className="h-[52px] rounded-2xl bg-[#bd3f52] text-[15px] font-semibold text-white hover:bg-[#aa3648] disabled:cursor-default disabled:bg-[#bd3f52]/78"
                onClick={() => void addActiveEventToWishlist()}
              >
                {savingId === activeEvent.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : activeSaved ? (
                  <Check className="h-4 w-4" />
                ) : null}
                {activeSaved ? exploreLabels.saved_to_notebook : exploreLabels.want_to_go}
              </Button>
              <button
                type="button"
                className={cn(
                  "grid h-[52px] place-items-center rounded-2xl border border-divider bg-white text-[#bd3f52] transition hover:bg-[#fae8ed]",
                  activeSaved && "bg-[#fae8ed]",
                )}
                onClick={() => void addActiveEventToWishlist()}
                disabled={activeSaved || savingId === activeEvent.id}
                aria-label={exploreLabels.want_to_go}
              >
                <Heart className={cn("h-5 w-5", activeSaved && "fill-current")} />
              </button>
            </div>
          </div>
        </div>
      </section>

      <section
        className={cn(
          "absolute bottom-5 left-4 z-30 hidden rounded-[26px] border border-white/82 bg-white/90 p-5 shadow-[0_28px_80px_-54px_rgba(32,41,46,0.72)] backdrop-blur-xl sm:block",
          notebookOpen ? "right-[392px]" : "right-8",
        )}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-[16px] font-semibold text-fg">
            {exploreLabels.category_rail_title}
          </h2>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              className="h-9 w-9 rounded-full bg-white"
              onClick={() => showRelativeEvent(-1)}
              aria-label={labels.route_preview}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              className="h-9 w-9 rounded-full bg-white"
              onClick={() => showRelativeEvent(1)}
              aria-label={labels.route_preview}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="grid grid-cols-4 gap-4 lg:grid-cols-5 xl:grid-cols-6">
          {categorySummaries.map((item) => (
            <button
              key={item.category}
              type="button"
              className={cn(
                "group relative h-28 overflow-hidden rounded-2xl text-left shadow-sm transition hover:-translate-y-0.5",
                selectedCategory === item.category && "ring-2 ring-[#bd3f52]/45",
              )}
              onClick={() => setSelectedCategory(item.category)}
            >
              <Image
                src={item.image}
                alt=""
                fill
                sizes="180px"
                className="object-cover transition duration-300 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.02)_0%,rgba(0,0,0,0.62)_100%)]" />
              <div className="absolute inset-x-0 bottom-0 p-3 text-white">
                <p className="text-[14px] font-semibold">{item.category}</p>
                <p className="mt-0.5 text-[11px] font-semibold text-white/75">
                  {formatTemplate(exploreLabels.category_count, {
                    count: String(item.count),
                  })}
                </p>
              </div>
            </button>
          ))}
        </div>
      </section>

      {flyingId ? (
        <div className="roam-wishlist-fly">
          <Heart className="h-4 w-4 fill-current" />
        </div>
      ) : null}

      {notebookOpen ? (
        <aside className="absolute inset-x-3 bottom-3 top-20 z-50 sm:inset-y-4 sm:left-auto sm:right-4 sm:w-[360px]">
          <InspirationNotebookPanel
            labels={exploreLabels}
            lang={lang}
            items={wishlist}
            savingId={savingId}
            confirming={confirmingDraft}
            error={confirmError}
            onClose={() => setNotebookOpen(false)}
            onActivate={activateEvent}
            onRemove={(id) => void removeWishlistItem(id)}
            onConfirm={() => void confirmDraft()}
          />
        </aside>
      ) : null}
    </div>
  );
}

function FilterChip({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={cn(
        "h-11 shrink-0 rounded-2xl border px-4 text-[13px] font-semibold shadow-sm backdrop-blur-xl transition",
        active
          ? "border-accent/35 bg-white text-accent"
          : "border-white/80 bg-white/84 text-fg-secondary hover:text-accent",
      )}
      onClick={onClick}
    >
      {label}
    </button>
  );
}

function InspirationNotebookPanel({
  labels,
  lang,
  items,
  savingId,
  confirming,
  error,
  onClose,
  onActivate,
  onRemove,
  onConfirm,
}: {
  labels: TripPlanningLabels["inspiration_explore"];
  lang: string;
  items: InspirationWishlistItem[];
  savingId: string | null;
  confirming: boolean;
  error: boolean;
  onClose: () => void;
  onActivate: (id: string) => void;
  onRemove: (id: string) => void;
  onConfirm: () => void;
}) {
  return (
    <div className="flex h-full max-h-[calc(100svh-1.5rem)] flex-col rounded-[28px] border border-white/82 bg-white/94 p-4 shadow-[0_28px_90px_-48px_rgba(32,41,46,0.78)] backdrop-blur-xl sm:max-h-none">
      <div className="flex items-center justify-between gap-3 border-b border-divider pb-4">
        <div className="min-w-0">
          <h2 className="text-[22px] font-semibold tracking-tight text-fg">
            {formatTemplate(labels.notebook_title, {
              count: String(items.length),
            })}
          </h2>
          <div className="mt-3 flex gap-4 text-[13px] font-semibold text-fg-muted">
            <span className="border-b-2 border-accent pb-2 text-accent">
              {labels.notebook}
            </span>
            <span className="pb-2">{labels.notebook_map_tab}</span>
          </div>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="h-9 w-9 rounded-full text-fg-muted hover:bg-muted hover:text-fg"
          onClick={onClose}
          aria-label={labels.notebook}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {items.length === 0 ? (
        <div className="grid min-h-[240px] flex-1 place-items-center text-center">
          <div className="max-w-[240px]">
            <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-accent-soft text-accent">
              <BookMarked className="h-6 w-6" />
            </span>
            <p className="mt-3 text-[13px] leading-6 text-fg-muted">
              {labels.notebook_empty}
            </p>
          </div>
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto py-3 pr-1">
          <div className="space-y-3">
            {items.map((item) => (
              <div
                key={item.id}
                className="group flex gap-3 rounded-2xl border border-divider bg-white p-2.5 transition hover:border-accent/28 hover:bg-accent-softer"
              >
                <button
                  type="button"
                  className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-muted"
                  onClick={() => onActivate(item.id)}
                  aria-label={item.title}
                >
                  {item.image ? (
                    <Image
                      src={item.image}
                      alt=""
                      fill
                      sizes="80px"
                      className="object-cover"
                    />
                  ) : null}
                </button>
                <button
                  type="button"
                  className="min-w-0 flex-1 py-1 text-left"
                  onClick={() => onActivate(item.id)}
                >
                  <span className="block truncate text-[15px] font-semibold text-fg">
                    {item.title}
                  </span>
                  <span className="mt-1 block truncate text-[12px] font-semibold text-fg-muted">
                    {item.location || countryNameForCode(item.countryCode, lang)}
                  </span>
                  <span className="mt-2 inline-flex rounded-full bg-accent-soft px-2.5 py-1 text-[11px] font-semibold text-accent">
                    {item.category}
                  </span>
                </button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  disabled={savingId === item.id}
                  className="mt-1 h-8 w-8 shrink-0 rounded-full text-fg-muted opacity-80 transition hover:bg-muted hover:text-destructive group-hover:opacity-100"
                  onClick={() => onRemove(item.id)}
                  aria-label={labels.remove_saved}
                  title={labels.remove_saved}
                >
                  {savingId === item.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="border-t border-divider pt-3">
        {items.length === 0 ? (
          <p className="mb-2 text-[12px] leading-5 text-fg-muted">
            {labels.confirm_empty}
          </p>
        ) : null}
        {error ? (
          <p className="mb-2 text-[12px] font-semibold text-danger">
            {labels.confirm_error}
          </p>
        ) : null}
        <Button
          type="button"
          disabled={items.length === 0 || confirming}
          className="h-11 w-full rounded-2xl bg-fg text-[14px] font-semibold text-white hover:bg-fg/90 disabled:cursor-default disabled:opacity-55"
          onClick={onConfirm}
        >
          {confirming ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Check className="h-4 w-4" />
          )}
          {confirming ? labels.confirming_create : labels.confirm_create}
        </Button>
      </div>
    </div>
  );
}

const INSPIRATION_IMMERSIVE_CSS = `
.roam-inspiration-map {
  pointer-events: auto;
}

.roam-inspiration-map .leaflet-container,
.roam-inspiration-map .leaflet-pane,
.roam-inspiration-map .leaflet-top,
.roam-inspiration-map .leaflet-bottom {
  z-index: 0 !important;
}

.roam-inspiration-map .leaflet-marker-pane {
  z-index: 10 !important;
}

.roam-wishlist-fly {
  position: fixed;
  right: min(420px, 34vw);
  bottom: 210px;
  z-index: 90;
  display: grid;
  width: 42px;
  height: 42px;
  place-items: center;
  border-radius: 999px;
  color: white;
  background: #d6526f;
  box-shadow: 0 18px 42px rgba(32, 41, 46, 0.28);
  animation: roam-wishlist-fly 760ms cubic-bezier(.22,.78,.18,1) both;
  pointer-events: none;
}

@keyframes roam-wishlist-fly {
  0% {
    opacity: 0;
    transform: translate3d(0, 18px, 0) scale(0.75);
  }
  16% {
    opacity: 1;
    transform: translate3d(0, 0, 0) scale(1);
  }
  100% {
    opacity: 0;
    transform: translate3d(280px, -380px, 0) scale(0.24) rotate(18deg);
  }
}

@media (max-width: 640px) {
  .roam-wishlist-fly {
    right: 64px;
    bottom: 230px;
  }

  @keyframes roam-wishlist-fly {
    0% {
      opacity: 0;
      transform: translate3d(0, 18px, 0) scale(0.75);
    }
    16% {
      opacity: 1;
      transform: translate3d(0, 0, 0) scale(1);
    }
    100% {
      opacity: 0;
      transform: translate3d(20px, -520px, 0) scale(0.24) rotate(18deg);
    }
  }
}

@media (prefers-reduced-motion: reduce) {
  .roam-wishlist-fly {
    animation: none;
    opacity: 0;
  }
}
`;

function JourneyLivePanel({
  state,
  labels,
}: {
  state: JourneyLiveState | null;
  labels: TripPlanningLabels["journey_live"];
}) {
  if (!state) return null;

  return (
    <section className="mt-3 rounded-[22px] border border-accent/16 bg-[linear-gradient(135deg,rgba(255,255,255,0.92),rgba(232,250,248,0.78))] p-3 shadow-[0_20px_58px_-42px_rgba(15,184,180,0.55)] backdrop-blur">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-accent text-white shadow-[0_14px_32px_-20px_rgba(15,184,180,0.9)]">
            <MapPin className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-accent">
              {labels.eyebrow}
            </p>
            <h2 className="mt-0.5 truncate text-[18px] font-semibold tracking-tight text-fg">
              {labels.title}: {state.stop.name}
            </h2>
            <p className="mt-1 line-clamp-2 text-[12px] leading-5 text-fg-muted">
              {labels.body}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:min-w-[520px]">
          <JourneyLiveMetric
            icon={Clock}
            label={labels.current_stop}
            value={formatTemplate(labels.today_progress, {
              done: String(state.visibleIndex + 1),
              total: String(state.totalStops),
            })}
          />
          <JourneyLiveMetric
            icon={Camera}
            label={labels.checked_in_label}
            value={formatTemplate(labels.checked_in, {
              count: String(state.checkedInCount),
            })}
          />
          <JourneyLiveMetric
            icon={Ticket}
            label={labels.tickets_label}
            value={formatTemplate(labels.tickets_ready, {
              done: String(state.ticketDoneCount),
              total: String(state.ticketTotalCount),
            })}
          />
          <JourneyLiveMetric
            icon={ChevronRight}
            label={labels.next_stop}
            value={state.nextStop?.name ?? labels.calm_note}
          />
        </div>
      </div>
      <div className="mt-3 rounded-2xl border border-white/70 bg-white/72 px-3 py-2 text-[12px] leading-5 text-fg-muted">
        {labels.calm_note}
      </div>
    </section>
  );
}

function JourneyLiveMetric({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
}) {
  return (
    <div className="min-w-0 rounded-2xl border border-white/72 bg-white/76 px-3 py-2 shadow-sm">
      <p className="flex items-center gap-1.5 text-[10.5px] font-semibold text-fg-muted">
        <Icon className="h-3.5 w-3.5 text-accent" />
        <span className="truncate">{label}</span>
      </p>
      <p className="mt-1 truncate text-[12.5px] font-semibold text-fg">
        {value}
      </p>
    </div>
  );
}

function TripMoreMenu({
  tripId,
  title,
  labels,
  onDeleted,
}: {
  tripId: string;
  title: string;
  labels: TripPlanningLabels["settings"];
  onDeleted: () => void;
}) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  async function deleteTrip() {
    setBusy(true);
    setError(false);
    try {
      const res = await fetch(`/api/trips/${tripId}`, {
        method: "DELETE",
        credentials: "same-origin",
      });
      if (!res.ok) throw new Error(`delete failed: ${res.status}`);
      onDeleted();
    } catch {
      setError(true);
      setBusy(false);
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon-lg"
            className="h-11 w-11 rounded-xl"
            aria-label={labels.aria}
          >
            <MoreHorizontal className="h-5 w-5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="rounded-xl bg-white">
          <DropdownMenuItem
            variant="destructive"
            onSelect={() => setConfirmOpen(true)}
          >
            <Trash2 className="h-4 w-4" />
            {labels.delete_trip}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <Dialog
        open={confirmOpen}
        onOpenChange={(open) => {
          if (!busy) setConfirmOpen(open);
        }}
      >
        <DialogContent className="rounded-[24px] bg-white sm:max-w-[430px]">
          <DialogHeader>
            <DialogTitle>{labels.delete_trip}</DialogTitle>
            <DialogDescription>{title}</DialogDescription>
          </DialogHeader>
          {error ? (
            <div className="rounded-xl bg-destructive/10 px-3 py-2 text-[12px] text-destructive">
              {labels.delete_error}
            </div>
          ) : null}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => setConfirmOpen(false)}
            >
              {labels.delete_cancel}
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={busy}
              onClick={() => void deleteTrip()}
            >
              {busy ? labels.deleting : labels.delete_confirm}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function RouteMap({
  tripId,
  lang,
  days,
  activeView,
  mapFocus,
  autoplayEnabled,
  inspirationExploreActive,
  activeStopFocusKey,
  focusActiveStopOnly,
  onActiveViewChange,
  onMapFocusChange,
  onAutoplayChange,
  onAutoplayResume,
  onRequestAutoplayPause,
  onSelectInspirationCountry,
  onCandidateSelect,
  onAddCandidateToTrip,
  candidateClearVersion,
  lodgingSearchRequest,
  labels,
}: {
  tripId: string;
  lang: string;
  days: TripDayModel[];
  activeView: ActiveItineraryView;
  mapFocus: MapFocus;
  autoplayEnabled: boolean;
  inspirationExploreActive: boolean;
  activeStopFocusKey: string | null;
  focusActiveStopOnly: boolean;
  onActiveViewChange: (view: ActiveItineraryView) => void;
  onMapFocusChange: (focus: MapFocus) => void;
  onAutoplayChange: (enabled: boolean) => void;
  onAutoplayResume: () => void;
  onRequestAutoplayPause: () => void;
  onSelectInspirationCountry: (countryCode: string) => Promise<void>;
  onCandidateSelect: (
    landmark: LandmarkSearchResult | null,
    lodgingPlan?: LodgingPlanContext | null,
    suggestedPlacement?: SuggestedPlacePlacement | null,
  ) => void;
  onAddCandidateToTrip: (
    landmark: LandmarkSearchResult,
  ) => Promise<{ dayIndex: number; stopIndex: number }>;
  candidateClearVersion: number;
  lodgingSearchRequest: LodgingSearchRequest | null;
  labels: TripPlanningLabels;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<LandmarkSearchResult[]>([]);
  const [suggestedPlaceContext, setSuggestedPlaceContext] = useState<{
    dayIndex: number;
    stopIndex: number;
    results: LandmarkSearchResult[];
  } | null>(null);
  const [selectedLandmark, setSelectedLandmark] =
    useState<LandmarkSearchResult | null>(null);
  const [poiHighlight, setPoiHighlight] = useState<TripMapPoiHighlight | null>(null);
  const [activePlaceholder, setActivePlaceholder] =
    useState<ActivePlaceholderSearch>(null);
  const [mapViewport, setMapViewport] = useState<TripMapViewport | null>(null);
  const [showSearchResultMarkers, setShowSearchResultMarkers] = useState(false);
  const [activeLodgingPlan, setActiveLodgingPlan] =
    useState<LodgingPlanContext | null>(null);
  const [searching, setSearching] = useState(false);
  const [adding, setAdding] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const searchActiveRef = useRef(false);
  const lastCandidateClearVersionRef = useRef(candidateClearVersion);
  const lastLodgingSearchVersionRef = useRef(lodgingSearchRequest?.version ?? 0);
  const mapViewportRef = useRef<TripMapViewport | null>(null);
  const searchCenterRef = useRef<google.maps.LatLngLiteral | null>(null);
  const suggestedPlaceContextKeyRef = useRef<string | null>(null);
  const mapAutoplayLabels = mapAutoplayLabelsFor(labels);
  const activeDayIndex = typeof activeView === "number"
    ? Math.min(activeView, days.length - 1)
    : null;
  const selectedDay = activeDayIndex == null ? null : days[activeDayIndex];
  const routePoints = useMemo(
    () =>
      activeView === "overview"
        ? buildRoutePoints(days)
        : selectedDay
          ? [dayToRoutePoint(selectedDay, activeDayIndex ?? 0)]
          : [],
    [activeDayIndex, activeView, days, selectedDay],
  );
  const mapCities = useMemo(
    () =>
      routePoints.map((point, index) => ({
        name: point.city,
        lat: point.lat,
        lng: point.lng,
        label: String(index + 1),
        date: point.dateLabel,
      })) satisfies TripMapCity[],
    [routePoints],
  );
  const activeMapStopIndexes = useMemo(() => {
    if (activeView === "overview" || !selectedDay) return new Set<number>();
    const stopCount = selectedDay.stops.length;
    if (mapFocus?.mode === "stop") {
      return new Set([Math.max(0, Math.min(stopCount - 1, mapFocus.index))]);
    }
    if (mapFocus?.mode === "movement") {
      return new Set([
        Math.max(0, Math.min(stopCount - 1, mapFocus.fromIndex)),
        Math.max(0, Math.min(stopCount - 1, mapFocus.toIndex)),
      ]);
    }
    return new Set<number>();
  }, [activeView, mapFocus, selectedDay]);
  const dayStops = useMemo(
    () =>
      selectedDay
        ? selectedDay.stops.flatMap((stop, index) => {
            const shouldShowStop =
              !isTimelineHiddenStop(stop) || activeMapStopIndexes.has(index);
            if (!shouldShowStop) return [];
            const shouldShowCandidate = (
              candidate: TripDayModel["stops"][number],
              candidateIndex: number,
            ) =>
              !isTimelineHiddenStop(candidate) ||
              activeMapStopIndexes.has(candidateIndex);
            const nextStop = selectedDay.stops
              .slice(index + 1)
              .find((candidate, offset) =>
                shouldShowCandidate(candidate, index + 1 + offset),
              );
            const hasAirportTransferMovement = nextStop
              ? airportTransferAttachmentForMovement(stop, nextStop) != null
              : false;
            const location = representativeStopLocation(stop);
            return [{
              name: mappableStopName(stop),
              lat: location?.lat ?? null,
              lng: location?.lng ?? null,
              label: String(
                selectedDay.stops
                  .slice(0, index + 1)
                  .filter((candidate, candidateIndex) =>
                    shouldShowCandidate(candidate, candidateIndex),
                  ).length,
              ),
              date:
                stop.arrival_time ??
                labels.kind[stop.kind ?? "other"] ??
                labels.kind.other,
              kind: stop.kind,
              sourceIndex: index,
              travelModeToNext: hasAirportTransferMovement
                ? AIRPORT_TRANSFER_TRAVEL_MODE
                : undefined,
              travelLabelToNext: hasAirportTransferMovement
                ? labels.kind.airport_transfer
                : undefined,
            }];
          })
        : undefined,
    [activeMapStopIndexes, labels.kind, selectedDay],
  );
  const hasLocatedCities = mapCities.some((city) => city.lat != null && city.lng != null);
  const activeRouteIndex = activeView === "overview" && mapFocus?.mode === "route"
    ? Math.max(0, Math.min(routePoints.length - 1, mapFocus.index))
    : null;
  const activeStopIndex = activeView !== "overview" && mapFocus?.mode === "stop"
    ? Math.max(0, Math.min((selectedDay?.stops.length ?? 1) - 1, mapFocus.index))
    : null;
  const activeStop =
    activeStopIndex == null ? null : selectedDay?.stops[activeStopIndex] ?? null;
  const suggestedPlaceResults = suggestedPlaceContext?.results ?? EMPTY_LANDMARK_SEARCH_RESULTS;
  const mapSearchResults = useMemo(
    () =>
      showSearchResultMarkers
        ? [...suggestedPlaceResults, ...results]
        : EMPTY_LANDMARK_SEARCH_RESULTS,
    [results, showSearchResultMarkers, suggestedPlaceResults],
  );
  const activeTravelSegment = useMemo<TripMapActiveTravelSegment | null>(() => {
    if (activeView === "overview" || mapFocus?.mode !== "movement") return null;
    return {
      fromIndex: Math.max(0, Math.min((selectedDay?.stops.length ?? 2) - 2, mapFocus.fromIndex)),
      toIndex: Math.max(1, Math.min((selectedDay?.stops.length ?? 1) - 1, mapFocus.toIndex)),
      focusKey: activeStopFocusKey,
    };
  }, [activeStopFocusKey, activeView, mapFocus, selectedDay?.stops.length]);
  const activeRoutePoint = activeRouteIndex == null ? null : routePoints[activeRouteIndex] ?? null;
  const hasSearchActivity = Boolean(
    searching ||
    query.trim() ||
    results.length > 0 ||
    selectedLandmark ||
    searchError,
  );
  const searchCenter = useMemo<google.maps.LatLngLiteral | null>(() => {
    const activeStopLocation = activeStop
      ? representativeStopLocation(activeStop)
      : null;
    if (activeStopLocation) {
      return activeStopLocation;
    }
    if (activePlaceholder && selectedDay) {
      const nearbyStop = nearestLocatedStopForPlaceholder(
        selectedDay,
        activePlaceholder.stopIndex,
      );
      if (nearbyStop?.lat != null && nearbyStop.lng != null) {
        return { lat: nearbyStop.lat, lng: nearbyStop.lng };
      }
    }
    const firstLocatedStop = dayStops?.find(
      (stop) => stop.lat != null && stop.lng != null,
    );
    if (firstLocatedStop?.lat != null && firstLocatedStop.lng != null) {
      return { lat: firstLocatedStop.lat, lng: firstLocatedStop.lng };
    }
    if (selectedDay?.lat != null && selectedDay.lng != null) {
      return { lat: selectedDay.lat, lng: selectedDay.lng };
    }
    return null;
  }, [activePlaceholder, activeStop, dayStops, selectedDay]);
  useEffect(() => {
    mapViewportRef.current = mapViewport;
  }, [mapViewport]);
  useEffect(() => {
    searchCenterRef.current = searchCenter;
  }, [searchCenter]);
  const clearSearchState = useCallback(() => {
    setQuery("");
    setResults([]);
    setSuggestedPlaceContext(null);
    setSelectedLandmark(null);
    setPoiHighlight(null);
    setActiveLodgingPlan(null);
    onCandidateSelect(null, null);
    setShowSearchResultMarkers(false);
    setSearchError(null);
    setActivePlaceholder(null);
  }, [onCandidateSelect]);
  useEffect(() => {
    if (lastCandidateClearVersionRef.current === candidateClearVersion) return;
    lastCandidateClearVersionRef.current = candidateClearVersion;
    setQuery("");
    setResults([]);
    setSuggestedPlaceContext(null);
    setSelectedLandmark(null);
    setPoiHighlight(null);
    setActiveLodgingPlan(null);
    setShowSearchResultMarkers(false);
    setSearchError(null);
    setActivePlaceholder(null);
  }, [candidateClearVersion]);
  const handleMapViewportChange = useCallback((viewport: TripMapViewport) => {
    setMapViewport((current) =>
      current && isSameMapViewport(current, viewport) ? current : viewport,
    );
  }, []);
  const handleCityActivate = useCallback((index: number) => {
    setPoiHighlight(null);
    if (activeView === "overview") {
      onMapFocusChange({ mode: "route", index, source: "manual" });
    }
  }, [activeView, onMapFocusChange]);
  const handleStopActivate = useCallback((index: number) => {
    setPoiHighlight(null);
    if (activeView !== "overview") {
      onMapFocusChange({ mode: "stop", index, source: "manual" });
    }
  }, [activeView, onMapFocusChange]);

  useEffect(() => {
    let canceled = false;
    const queueSuggestedPlaceContextReset = () => {
      suggestedPlaceContextKeyRef.current = null;
      queueMicrotask(() => {
        if (!canceled) setSuggestedPlaceContext(null);
      });
    };

    if (
      activeView === "overview" ||
      activeDayIndex == null ||
      mapFocus?.mode !== "stop" ||
      mapFocus.source !== "manual"
    ) {
      queueSuggestedPlaceContextReset();
      return () => {
        canceled = true;
      };
    }
    const stopIndex = Math.max(
      0,
      Math.min((selectedDay?.stops.length ?? 1) - 1, mapFocus.index),
    );
    const stop = selectedDay?.stops[stopIndex] ?? null;
    const suggestionResults =
      stop && isRegionalTripStop(stop)
        ? (stop.placeSuggestions ?? []).map(placeSuggestionToLandmark)
        : [];
    if (suggestionResults.length === 0) {
      queueSuggestedPlaceContextReset();
      return () => {
        canceled = true;
      };
    }
    const contextKey = `${activeDayIndex}:${stopIndex}`;
    const wasSameContext = suggestedPlaceContextKeyRef.current === contextKey;
    suggestedPlaceContextKeyRef.current = contextKey;
    queueMicrotask(() => {
      if (canceled) return;
      setSuggestedPlaceContext({
        dayIndex: activeDayIndex,
        stopIndex,
        results: suggestionResults,
      });
      if (wasSameContext) {
        setPoiHighlight((current) =>
          current
            ? suggestionResults.find(
                (candidate) => landmarkKey(candidate) === landmarkKey(current),
              ) ?? current
            : current,
        );
        setSelectedLandmark((current) =>
          current
            ? suggestionResults.find(
                (candidate) => landmarkKey(candidate) === landmarkKey(current),
              ) ?? current
            : current,
        );
        setShowSearchResultMarkers(true);
        onRequestAutoplayPause();
        return;
      }
      setQuery("");
      setResults([]);
      setSelectedLandmark(null);
      setPoiHighlight(null);
      setActivePlaceholder(null);
      setActiveLodgingPlan(null);
      setSearchError(null);
      setShowSearchResultMarkers(true);
      onCandidateSelect(null, null);
      onRequestAutoplayPause();
    });
    return () => {
      canceled = true;
    };
  }, [
    activeDayIndex,
    activeView,
    mapFocus,
    onCandidateSelect,
    onRequestAutoplayPause,
    selectedDay,
  ]);
  const handleSearchMarkerDrag = useCallback((position: { lat: number; lng: number }) => {
    setSelectedLandmark((current) =>
      current ? { ...current, ...position } : current,
    );
  }, []);
  const handleSearchResultActivate = useCallback((index: number) => {
    const result = mapSearchResults[index] ?? null;
    if (result) {
      const suggestedPlacement =
        suggestedPlaceContext?.results.some(
          (candidate) => landmarkKey(candidate) === landmarkKey(result),
        )
          ? {
              dayIndex: suggestedPlaceContext.dayIndex,
              stopIndex: suggestedPlaceContext.stopIndex,
            }
          : null;
      const lodgingPlan =
        activeLodgingPlan ??
        (isLodgingLandmark(result)
          ? defaultLodgingPlanForDays(days, activeDayIndex ?? 0)
          : null);
      setPoiHighlight(suggestedPlacement ? result : null);
      setSelectedLandmark(suggestedPlacement ? null : result);
      setActiveLodgingPlan(lodgingPlan);
      onCandidateSelect(result, lodgingPlan, suggestedPlacement);
      setSearchError(null);
    }
  }, [
    activeDayIndex,
    activeLodgingPlan,
    days,
    mapSearchResults,
    onCandidateSelect,
    suggestedPlaceContext,
  ]);
  const handleGooglePoiClick = useCallback(async (poi: TripMapPoiClick) => {
    if (searching) return;
    const pendingLandmark: LandmarkSearchResult = {
      id: poi.placeId,
      placeId: poi.placeId,
      name: "Google Maps",
      address: "",
      lat: poi.lat,
      lng: poi.lng,
      iconMaskUri: "https://maps.gstatic.com/mapfiles/place_api/icons/v2/generic_pinlet.svg",
      iconBackgroundColor: "#7B9EB0",
    };
    setSearching(true);
    setSearchError(null);
    setQuery("");
    setResults([]);
    setSelectedLandmark(null);
    setPoiHighlight(pendingLandmark);
    setActivePlaceholder(null);
    setActiveLodgingPlan(null);
    setShowSearchResultMarkers(false);
    onRequestAutoplayPause();
    try {
      const landmark = await fetchLandmarkByPlaceId(poi.placeId, {
        lat: poi.lat,
        lng: poi.lng,
      });
      if (!landmark) {
        return;
      }
      const lodgingPlan =
        activeLodgingPlan ??
        (isLodgingLandmark(landmark)
          ? defaultLodgingPlanForDays(days, activeDayIndex ?? 0)
          : null);
      setPoiHighlight(landmark);
      setActiveLodgingPlan(lodgingPlan);
      onCandidateSelect(landmark, lodgingPlan);
    } catch {
      setPoiHighlight(null);
      onCandidateSelect(null, null);
    } finally {
      setSearching(false);
    }
  }, [
    activeDayIndex,
    activeLodgingPlan,
    days,
    onCandidateSelect,
    onRequestAutoplayPause,
    searching,
  ]);

  useEffect(() => {
    if (hasSearchActivity && !searchActiveRef.current) {
      onRequestAutoplayPause();
    }
    searchActiveRef.current = hasSearchActivity;
  }, [hasSearchActivity, onRequestAutoplayPause]);

  async function searchPlaceholderOptions(
    kind: PlaceholderKind,
    nextQuery: string,
    centerOverride?: google.maps.LatLngLiteral | null,
  ) {
    if (searching) return;
    const cleanQuery = nextQuery.trim() || placeholderSearchLabel(kind);
    setSearching(true);
    setSearchError(null);
    setPoiHighlight(null);
    setSuggestedPlaceContext(null);
    try {
      const primaryType = placeholderPrimaryType(kind);
      const nextResults = primaryType
        ? await searchNearbyPlacesByPrimaryType(
            primaryType,
            mapViewport,
            centerOverride ?? searchCenter,
            { preferFallbackCenter: true },
          )
        : await geocodeLandmark(
            cleanQuery,
            selectedDay?.city,
            centerOverride ?? searchCenter,
          );
      setResults(nextResults);
      setShowSearchResultMarkers(Boolean(primaryType));
      const first = nextResults[0] ?? null;
      setSelectedLandmark(first);
      onCandidateSelect(first, null);
      if (!first) setSearchError(labels.map_search.no_results);
    } catch {
      setSearchError(labels.map_search.error);
    } finally {
      setSearching(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (
        activeView === "overview" ||
        activeDayIndex == null ||
        mapFocus?.mode !== "stop" ||
        mapFocus.source !== "manual"
      ) {
        return;
      }
      const stopIndex = Math.max(0, Math.min((selectedDay?.stops.length ?? 1) - 1, mapFocus.index));
      const stop = selectedDay?.stops[stopIndex] ?? null;
      if (!stop || !isPlaceholderStop(stop)) {
        setActivePlaceholder(null);
        return;
      }
      const kind = placeholderKindForStop(stop);
      const placeholderQuery = placeholderSearchQuery(stop, selectedDay?.city);
      setActivePlaceholder({
        dayIndex: activeDayIndex,
        stopIndex,
        stopName: stop.name,
        kind,
        query: placeholderQuery,
      });
      setQuery(placeholderQuery);
      setSearchError(null);
      const nearbyStop = selectedDay
        ? nearestLocatedStopForPlaceholder(selectedDay, stopIndex)
        : null;
      void searchPlaceholderOptions(
        kind,
        placeholderQuery,
        nearbyStop?.lat != null && nearbyStop.lng != null
          ? { lat: nearbyStop.lat, lng: nearbyStop.lng }
          : null,
      );
    }, 0);
    return () => window.clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeDayIndex, activeView, mapFocus, selectedDay]);

  useEffect(() => {
    if (!lodgingSearchRequest) return;
    if (lastLodgingSearchVersionRef.current === lodgingSearchRequest.version) return;
    lastLodgingSearchVersionRef.current = lodgingSearchRequest.version;

    const requestedRange = lodgingSearchRequest.range
      ? normalizeLodgingDateRange(lodgingSearchRequest.range, days.length)
      : null;
    const plan = requestedRange
      ? {
          defaultStartIndex: requestedRange.startIndex,
          defaultEndIndex: requestedRange.endIndex,
        }
      : defaultLodgingPlanForDays(days, lodgingSearchRequest.nightIndex);
    const label =
      labels.map_search.nearby?.stay ?? labels.lodging_stops.choose;
    const centerOverride =
      centerForLodgingSearch(days[lodgingSearchRequest.dayIndex]) ??
      centerForLodgingSearch(days[plan.defaultStartIndex]) ??
      searchCenterRef.current;

    setActiveLodgingPlan(plan);
    setQuery(label);
    setSearching(true);
    setSearchError(null);
    setPoiHighlight(null);
    setResults([]);
    setSuggestedPlaceContext(null);
    setSelectedLandmark(null);
    setShowSearchResultMarkers(true);
    setActivePlaceholder(null);
    onCandidateSelect(null, null);

    let canceled = false;
    void searchNearbyPlacesByPrimaryType(
      "lodging",
      mapViewportRef.current,
      centerOverride,
      { preferFallbackCenter: true },
    )
      .then((nextResults) => {
        if (canceled) return;
        setResults(nextResults);
        const first = nextResults[0] ?? null;
        setSelectedLandmark(first);
        onCandidateSelect(first, plan);
        if (!first) setSearchError(labels.map_search.no_results);
      })
      .catch(() => {
        if (!canceled) setSearchError(labels.map_search.error);
      })
      .finally(() => {
        if (!canceled) setSearching(false);
      });

    return () => {
      canceled = true;
    };
  }, [
    days,
    labels.lodging_stops.choose,
    labels.map_search.error,
    labels.map_search.nearby,
    labels.map_search.no_results,
    lodgingSearchRequest,
    onCandidateSelect,
  ]);

  async function searchLandmarksFor(nextQuery: string) {
    const cleanQuery = nextQuery.trim();
    if (!cleanQuery || searching) return;
    setQuery(cleanQuery);
    setSearching(true);
    setSearchError(null);
    setPoiHighlight(null);
    setActiveLodgingPlan(null);
    setSuggestedPlaceContext(null);
    try {
      const nextResults = await geocodeLandmark(
        cleanQuery,
        selectedDay?.city,
        searchCenter,
      );
      setResults(nextResults);
      setShowSearchResultMarkers(false);
      const first = nextResults[0] ?? null;
      setSelectedLandmark(first);
      onCandidateSelect(first, null);
      if (!first) setSearchError(labels.map_search.no_results);
    } catch {
      setSearchError(labels.map_search.error);
    } finally {
      setSearching(false);
    }
  }

  async function searchLandmarks(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await searchLandmarksFor(query);
  }

  async function searchNearbyLandmarks(kind: NearbySearchKind) {
    if (searching) return;
    const label = labels.map_search.nearby?.[kind] ?? kind;
    setQuery(label);
    setSearching(true);
    setSearchError(null);
    setPoiHighlight(null);
    setActiveLodgingPlan(kind === "stay" ? activeLodgingPlan : null);
    setSuggestedPlaceContext(null);
    try {
      const nextResults = await searchNearbyPlaces(kind, mapViewport, searchCenter, {
        preferFallbackCenter: true,
      });
      setResults(nextResults);
      setShowSearchResultMarkers(true);
      const first = nextResults[0] ?? null;
      setSelectedLandmark(first);
      onCandidateSelect(first, kind === "stay" ? activeLodgingPlan : null);
      if (!first) setSearchError(labels.map_search.no_results);
    } catch {
      setSearchError(labels.map_search.error);
    } finally {
      setSearching(false);
    }
  }

  async function addSelectedLandmark() {
    if (!selectedLandmark || adding || days.length === 0) return;
    setAdding(true);
    setSearchError(null);
    try {
      if (activePlaceholder) {
        await replacePlaceholderWithLandmark({
          tripId,
          days,
          placeholder: activePlaceholder,
          landmark: selectedLandmark,
        });
        onActiveViewChange(activePlaceholder.dayIndex);
        onMapFocusChange({
          mode: "stop",
          index: activePlaceholder.stopIndex,
          source: "added",
        });
      } else {
        await onAddCandidateToTrip(selectedLandmark);
      }
      setQuery("");
      setResults([]);
      setSuggestedPlaceContext(null);
      setSelectedLandmark(null);
      setPoiHighlight(null);
      setActiveLodgingPlan(null);
      onCandidateSelect(null, null);
      setShowSearchResultMarkers(false);
      setActivePlaceholder(null);
      await refreshTrip(tripId);
    } catch {
      setSearchError(labels.map_search.error);
    } finally {
      setAdding(false);
    }
  }

  if (inspirationExploreActive) {
    return (
      <InspirationExploreRouteMap
        lang={lang}
        labels={labels}
        onSelectCountry={onSelectInspirationCountry}
      />
    );
  }

  return (
    <>
      <section
        data-testid="trip-route-map"
        className="relative h-[44svh] min-h-[330px] overflow-hidden rounded-[22px] border border-divider bg-surface-sunken shadow-[var(--shadow-sm)] sm:rounded-[24px] 2xl:h-full 2xl:min-h-[650px]"
      >
        {hasLocatedCities ? (
          <div className="roam-detail-route-map absolute inset-0">
            <LeafletTripMap
              cities={mapCities}
              activeCity={activeRoutePoint?.city ?? selectedDay?.city ?? null}
              activeCityIndex={activeRouteIndex}
              activeLegFrom={
                activeRouteIndex != null && activeRouteIndex > 0
                  ? routePoints[activeRouteIndex - 1]?.city ?? null
                  : activeDayIndex != null && activeDayIndex > 0
                  ? days[activeDayIndex - 1]?.city ?? null
                  : null
              }
              activeLegFromIndex={
                activeRouteIndex != null && activeRouteIndex > 0
                  ? activeRouteIndex - 1
                  : null
              }
              dayStops={dayStops}
              travelLabels={labels.map_travel}
              activeStopIndex={activeStopIndex}
              activeStopFocusKey={activeStopFocusKey}
              focusActiveStopOnly={focusActiveStopOnly}
              activeTravelSegment={activeTravelSegment}
              panToActiveStop={mapFocus?.mode === "stop"}
              searchMarker={selectedLandmark}
              searchResults={mapSearchResults}
              poiHighlight={poiHighlight}
              poiFilterActive={showSearchResultMarkers}
              onCityActivate={handleCityActivate}
              onStopActivate={handleStopActivate}
              onSearchMarkerDrag={handleSearchMarkerDrag}
              onSearchResultActivate={handleSearchResultActivate}
              onViewportChange={handleMapViewportChange}
              onPoiClick={(poi) => void handleGooglePoiClick(poi)}
            />
          </div>
        ) : (
          <>
            <div className="absolute inset-0 opacity-75 [background-image:radial-gradient(circle_at_20%_30%,rgba(15,184,180,0.12),transparent_22%),radial-gradient(circle_at_82%_42%,rgba(224,122,63,0.12),transparent_22%),linear-gradient(120deg,rgba(255,255,255,0.82),rgba(255,255,255,0.48))]" />
            <div className="absolute inset-0 opacity-35 [background-image:linear-gradient(rgba(39,58,63,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(39,58,63,0.08)_1px,transparent_1px)] [background-size:80px_80px]" />
            <svg
              aria-hidden
              className="absolute inset-0 h-full w-full"
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
            >
              <path
                d="M 18 50 C 28 20, 38 20, 43 24 S 56 53, 62 45 S 68 63, 76 62 S 58 77, 50 68 S 33 62, 30 35"
                fill="none"
                stroke="rgba(39,58,63,0.45)"
                strokeDasharray="1.7 1.3"
                strokeWidth="0.55"
              />
            </svg>
          </>
        )}
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(255,255,255,0.62),transparent_24%,transparent_76%,rgba(255,255,255,0.38)),linear-gradient(180deg,rgba(255,255,255,0.2),transparent_24%,rgba(255,255,255,0.16))]" />
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          aria-pressed={autoplayEnabled}
          aria-label={
            autoplayEnabled
              ? mapAutoplayLabels.pause
              : mapAutoplayLabels.play
          }
          title={
            autoplayEnabled
              ? mapAutoplayLabels.pause
              : mapAutoplayLabels.play
          }
          onClick={() => {
            if (autoplayEnabled) {
              onAutoplayChange(false);
              return;
            }
            onAutoplayResume();
          }}
          className={cn(
            "absolute left-5 top-5 z-30 h-10 w-10 rounded-2xl border-white/80 bg-white/92 text-fg-secondary shadow-sm backdrop-blur transition hover:border-accent/40 hover:bg-white hover:text-accent",
            autoplayEnabled &&
              "border-accent/35 bg-accent text-white hover:bg-white hover:text-accent",
          )}
        >
          {autoplayEnabled ? (
            <Pause className="h-4 w-4" />
          ) : (
            <Play className="h-4 w-4 fill-current" />
          )}
        </Button>
        <LandmarkSearchControl
          labels={labels}
          query={query}
          results={results}
          selectedLandmark={selectedLandmark}
          activePlaceholder={activePlaceholder}
          searching={searching}
          adding={adding}
          error={searchError}
          onQueryChange={(value) => {
            setQuery(value);
            setPoiHighlight(null);
            setSuggestedPlaceContext(null);
            setShowSearchResultMarkers(false);
            if (!value.trim()) {
              setResults([]);
              setSelectedLandmark(null);
              setActiveLodgingPlan(null);
              onCandidateSelect(null, null);
              setSearchError(null);
            }
          }}
          onSubmit={searchLandmarks}
          onNearbySearch={(kind) => void searchNearbyLandmarks(kind)}
          onSelect={(result) => {
            const lodgingPlan =
              activeLodgingPlan ??
              (isLodgingLandmark(result)
                ? defaultLodgingPlanForDays(days, activeDayIndex ?? 0)
                : null);
            setPoiHighlight(null);
            setSuggestedPlaceContext(null);
            setSelectedLandmark(result);
            setActiveLodgingPlan(lodgingPlan);
            onCandidateSelect(result, lodgingPlan);
            setSearchError(null);
          }}
          onAdd={() => void addSelectedLandmark()}
          onClear={clearSearchState}
        />
        <style jsx global>{`
          .roam-detail-route-map .roam-trip-map {
            height: 44svh;
            min-height: 330px;
            border-radius: 22px;
          }
          @media (min-width: 1280px) {
            .roam-detail-route-map .roam-trip-map {
              height: 40dvh;
              min-height: 0;
              border-radius: 24px;
            }
          }
        `}</style>
      </section>
    </>
  );
}

function LandmarkSearchControl({
  labels,
  query,
  results,
  selectedLandmark,
  activePlaceholder,
  searching,
  adding,
  error,
  onQueryChange,
  onSubmit,
  onNearbySearch,
  onSelect,
  onAdd,
  onClear,
}: {
  labels: TripPlanningLabels;
  query: string;
  results: LandmarkSearchResult[];
  selectedLandmark: LandmarkSearchResult | null;
  activePlaceholder: ActivePlaceholderSearch;
  searching: boolean;
  adding: boolean;
  error: string | null;
  onQueryChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onNearbySearch: (kind: NearbySearchKind) => void;
  onSelect: (result: LandmarkSearchResult) => void;
  onAdd: () => void;
  onClear: () => void;
}) {
  const hasSearchState = Boolean(
    query.trim() || results.length > 0 || selectedLandmark || error,
  );
  const nearbyOptions: Array<{ kind: NearbySearchKind; label: string }> = [
    {
      kind: "coffee",
      label: labels.map_search.nearby?.coffee ?? "附近咖啡廳",
    },
    {
      kind: "food",
      label: labels.map_search.nearby?.food ?? "附近餐廳",
    },
    {
      kind: "sights",
      label: labels.map_search.nearby?.sights ?? "附近景點",
    },
  ];
  useEffect(() => {
    if (!hasSearchState) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClear();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [hasSearchState, onClear]);

  return (
    <div className="absolute inset-x-3 top-3 z-20 sm:inset-x-auto sm:right-5 sm:top-5 sm:w-[min(430px,calc(100%-2.5rem))]">
      {activePlaceholder ? (
        <div className="mb-2 rounded-2xl border border-accent/25 bg-white/94 px-3 py-2 text-[12px] font-semibold text-accent shadow-sm backdrop-blur">
          {placeholderSearchHeading(activePlaceholder, labels)}
        </div>
      ) : null}
      <form
        onSubmit={onSubmit}
        className="flex h-12 items-center gap-2 rounded-2xl border border-white/80 bg-white/92 pl-3 pr-2 shadow-sm backdrop-blur"
      >
        <Search className="h-5 w-5 shrink-0 text-fg-muted" />
        <Input
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder={labels.map_search.placeholder}
          className="h-10 border-0 bg-transparent px-0 text-[14px] shadow-none focus-visible:ring-0"
        />
        {hasSearchState ? (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={onClear}
            aria-label={labels.map_search.clear}
            className="rounded-xl text-fg-muted hover:text-fg"
          >
            <X className="h-4 w-4" />
          </Button>
        ) : null}
        <Button
          type="submit"
          size="icon-sm"
          disabled={searching || !query.trim()}
          className="rounded-xl bg-fg text-white"
        >
          {searching ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Search className="h-4 w-4" />
          )}
        </Button>
      </form>
      <div className="mt-2 flex gap-2 overflow-x-auto pb-1 sm:flex-wrap sm:overflow-visible sm:pb-0">
        {nearbyOptions.map((option) => (
          <button
            key={option.kind}
            type="button"
            disabled={searching}
            onClick={() => onNearbySearch(option.kind)}
            className="shrink-0 rounded-full border border-white/80 bg-white/88 px-3 py-1.5 text-[12px] font-semibold text-fg-secondary shadow-sm backdrop-blur transition hover:border-accent/40 hover:text-accent disabled:opacity-60"
          >
            {option.label}
          </button>
        ))}
      </div>

      {(results.length > 0 || selectedLandmark || error) && (
        <div className="mt-2 overflow-hidden rounded-2xl border border-white/80 bg-white/94 shadow-[0_18px_52px_-36px_rgba(32,41,46,0.55)] backdrop-blur">
          {results.length > 0 && (
            <div className="max-h-32 overflow-y-auto p-1.5 sm:max-h-40">
              {results.map((result) => (
                <button
                  key={result.id}
                  type="button"
                  onClick={() => onSelect(result)}
                  className={cn(
                    "block w-full rounded-xl px-3 py-2 text-left transition-colors hover:bg-surface",
                    selectedLandmark?.id === result.id && "bg-accent-soft",
                  )}
                >
                  <span className="block truncate text-[13px] font-semibold text-fg">
                    {result.name}
                  </span>
                  <span className="mt-0.5 block truncate text-[12px] text-fg-muted">
                    {result.address}
                  </span>
                </button>
              ))}
            </div>
          )}
          {selectedLandmark && (
            <div className="border-t border-divider px-3 py-3">
              <p className="text-[12px] leading-5 text-fg-muted">
                {labels.map_search.drag_hint}
              </p>
              <Button
                type="button"
                onClick={onAdd}
                disabled={adding}
                className="mt-2 h-10 w-full rounded-xl bg-accent text-white hover:bg-accent/90"
              >
                {adding ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
                {adding
                  ? labels.map_search.adding
                  : activePlaceholder
                    ? labels.map_search.replace ?? labels.map_search.add
                    : labels.map_search.add}
              </Button>
            </div>
          )}
          {error && (
            <div className="border-t border-divider px-3 py-2 text-[12px] text-destructive">
              {error}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function InspirationExploreRouteMap({
  lang,
  labels,
  onSelectCountry,
}: {
  lang: string;
  labels: TripPlanningLabels;
  onSelectCountry: (countryCode: string) => Promise<void>;
}) {
  const exploreLabels = labels.inspiration_explore;
  const copyById = useMemo(
    () => new Map(exploreLabels.events.map((event) => [event.id, event])),
    [exploreLabels.events],
  );
  const events = useMemo(
    () =>
      SPOTLIGHT_EVENTS.flatMap((event) => {
        const copy = copyById.get(event.id);
        return copy ? [{ ...event, ...copy }] : [];
      }),
    [copyById],
  );
  const categories = useMemo(
    () => Array.from(new Set(events.map((event) => event.category))),
    [events],
  );
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const filteredEvents = selectedCategory
    ? events.filter((event) => event.category === selectedCategory)
    : events;
  const [activeId, setActiveId] = useState(events[0]?.id ?? "");
  const [savingCountry, setSavingCountry] = useState(false);
  const [selectedCountryName, setSelectedCountryName] = useState<string | null>(null);
  const activeEvent =
    filteredEvents.find((event) => event.id === activeId) ??
    filteredEvents[0] ??
    events[0];

  if (!activeEvent) {
    return (
      <section
        data-testid="trip-route-map"
        className="relative h-[44svh] min-h-[330px] overflow-hidden rounded-[22px] border border-divider bg-surface-sunken shadow-[var(--shadow-sm)] sm:rounded-[24px] 2xl:h-full 2xl:min-h-[650px]"
      />
    );
  }

  const mapEvents = filteredEvents.map((event) => ({
    id: event.id,
    title: event.title,
    lat: event.lat,
    lng: event.lng,
    tone: event.tone,
  }));
  const activeCountryName = countryNameForCode(activeEvent.countryCode, lang);

  async function selectCountry() {
    if (savingCountry) return;
    setSavingCountry(true);
    setSelectedCountryName(null);
    try {
      await onSelectCountry(activeEvent.countryCode);
      setSelectedCountryName(activeCountryName);
    } finally {
      setSavingCountry(false);
    }
  }

  return (
    <section
      data-testid="trip-route-map"
      className="relative h-auto min-h-[640px] overflow-hidden rounded-[22px] border border-divider bg-surface-sunken shadow-[var(--shadow-sm)] sm:rounded-[24px] md:min-h-[440px] 2xl:h-full 2xl:min-h-[650px]"
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_24%,rgba(15,184,180,0.18),transparent_24%),radial-gradient(circle_at_76%_56%,rgba(224,122,63,0.16),transparent_26%),linear-gradient(120deg,rgba(255,255,255,0.72),rgba(255,255,255,0.36))]" />
      <div className="relative z-10 grid min-h-[640px] gap-4 p-3 sm:p-4 md:min-h-[440px] md:grid-cols-[minmax(280px,0.48fr)_minmax(0,1fr)] md:p-5 xl:h-full xl:min-h-0">
        <div className="flex min-h-0 flex-col rounded-[22px] border border-white/70 bg-white/82 p-4 shadow-[0_18px_56px_-40px_rgba(32,41,46,0.58)] backdrop-blur">
          <div className="min-w-0">
            <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-accent">
              {exploreLabels.title}
            </p>
            <h2 className="mt-1 text-[22px] font-semibold tracking-tight text-fg">
              {activeEvent.title}
            </h2>
            <p className="mt-2 line-clamp-2 text-[12px] leading-5 text-fg-muted">
              {exploreLabels.subtitle}
            </p>
          </div>

          <div className="mt-3 flex flex-wrap gap-1.5">
            <button
              type="button"
              className={cn(
                "rounded-full border px-2.5 py-1 text-[11.5px] font-semibold transition",
                selectedCategory == null
                  ? "border-accent bg-accent text-white"
                  : "border-divider bg-white text-fg-secondary hover:border-accent/35 hover:text-accent",
              )}
              onClick={() => setSelectedCategory(null)}
            >
              {exploreLabels.filter_all}
            </button>
            {categories.map((category) => (
              <button
                key={category}
                type="button"
                className={cn(
                  "rounded-full border px-2.5 py-1 text-[11.5px] font-semibold transition",
                  selectedCategory === category
                    ? "border-accent bg-accent text-white"
                    : "border-divider bg-white text-fg-secondary hover:border-accent/35 hover:text-accent",
                )}
                onClick={() => setSelectedCategory(category)}
              >
                {category}
              </button>
            ))}
          </div>

          <div className="mt-4 min-h-0 flex-1 overflow-y-auto pr-1">
            <div className="space-y-2">
              {filteredEvents.map((event) => (
                <button
                  key={event.id}
                  type="button"
                  className={cn(
                    "w-full rounded-2xl border px-3 py-2.5 text-left transition",
                    event.id === activeEvent.id
                      ? "border-accent/45 bg-accent-soft shadow-sm"
                      : "border-divider bg-white hover:border-accent/30 hover:bg-accent-softer",
                  )}
                  onClick={() => setActiveId(event.id)}
                >
                  <span className="flex items-center justify-between gap-3">
                    <span className="min-w-0">
                      <span className="block truncate text-[13px] font-semibold text-fg">
                        {event.title}
                      </span>
                      <span className="mt-0.5 block truncate text-[11.5px] font-semibold text-fg-muted">
                        {event.location}
                      </span>
                    </span>
                    <span className="shrink-0 rounded-full bg-white px-2 py-1 text-[10.5px] font-semibold text-accent">
                      {countryNameForCode(event.countryCode, lang)}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="mt-3 border-t border-divider pt-3">
            <p className="line-clamp-2 text-[12px] leading-5 text-fg-muted">
              {activeEvent.description}
            </p>
            <Button
              type="button"
              disabled={savingCountry}
              className="mt-3 h-10 w-full rounded-xl bg-accent text-white hover:bg-accent/90 disabled:cursor-wait disabled:opacity-65"
              onClick={() => void selectCountry()}
            >
              {savingCountry ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Check className="h-4 w-4" />
              )}
              {formatTemplate(exploreLabels.select_country, {
                country: activeCountryName,
              })}
            </Button>
            {selectedCountryName ? (
              <p className="mt-2 text-center text-[11px] font-semibold text-accent">
                {formatTemplate(exploreLabels.selected_country, {
                  country: selectedCountryName,
                })}
              </p>
            ) : null}
          </div>
        </div>

        <div className="relative min-h-0 overflow-hidden rounded-[22px] border border-white/60 bg-white/30 shadow-inner">
          <div className="absolute inset-0 opacity-80">
            <SpotlightFlagMap
              events={mapEvents}
              activeId={activeEvent.id}
              onActiveChange={setActiveId}
            />
          </div>
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_52%,rgba(248,244,236,0)_0%,rgba(248,244,236,0.1)_54%,rgba(248,244,236,0.42)_100%)]" />
        </div>
      </div>
    </section>
  );
}

function GooglePlacePhotoStrip({
  photos,
  title,
  closeLabel,
  previousLabel,
  nextLabel,
}: {
  photos: string[];
  title: string;
  closeLabel: string;
  previousLabel: string;
  nextLabel: string;
}) {
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  if (!photos.length) return null;

  return (
    <>
      <div className="flex gap-2 overflow-x-auto px-4 pb-3">
        {photos.slice(0, 4).map((photo, index) => (
          <button
            key={`${photo}-${index}`}
            type="button"
            className="group h-20 w-28 shrink-0 overflow-hidden rounded-2xl bg-muted ring-offset-2 transition hover:ring-2 hover:ring-accent/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            aria-label={`${title} ${index + 1}`}
            onClick={() => setPreviewIndex(index)}
          >
            <Image
              src={photo}
              alt=""
              width={112}
              height={80}
              unoptimized
              className="h-full w-full object-cover transition duration-200 group-hover:scale-[1.03]"
              loading="lazy"
            />
          </button>
        ))}
      </div>

      <GooglePlacePhotoCarouselDialog
        photos={photos}
        title={title}
        openIndex={previewIndex}
        closeLabel={closeLabel}
        previousLabel={previousLabel}
        nextLabel={nextLabel}
        onOpenIndexChange={setPreviewIndex}
      />
    </>
  );
}

function GooglePlacePhotoCarouselDialog({
  photos,
  title,
  openIndex,
  closeLabel,
  previousLabel,
  nextLabel,
  onOpenIndexChange,
}: {
  photos: string[];
  title: string;
  openIndex: number | null;
  closeLabel: string;
  previousLabel: string;
  nextLabel: string;
  onOpenIndexChange: (index: number | null) => void;
}) {
  if (!photos.length) return null;

  const currentIndex = openIndex == null
    ? 0
    : Math.max(0, Math.min(photos.length - 1, openIndex));
  const currentPhoto = photos[currentIndex];
  const canNavigate = photos.length > 1;
  const previousIndex = (currentIndex - 1 + photos.length) % photos.length;
  const nextIndex = (currentIndex + 1) % photos.length;

  return (
    <Dialog
      open={openIndex != null}
      onOpenChange={(open) => {
        if (!open) onOpenIndexChange(null);
      }}
    >
      <DialogContent
        showCloseButton={false}
        className="w-auto max-w-[calc(100vw-2rem)] border-0 bg-transparent p-0 shadow-none sm:max-w-[1080px]"
      >
        <DialogTitle className="sr-only">
          {`${title} ${currentIndex + 1}`}
        </DialogTitle>
        <div className="relative overflow-hidden rounded-[22px] bg-black shadow-[0_28px_90px_-28px_rgba(0,0,0,0.72)]">
          {currentPhoto ? (
            <Image
              src={currentPhoto}
              alt=""
              width={1280}
              height={900}
              unoptimized
              className="max-h-[82vh] w-auto max-w-[calc(100vw-2rem)] object-contain sm:max-w-[1080px]"
              priority
            />
          ) : null}
          {canNavigate ? (
            <>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute left-3 top-1/2 h-10 w-10 -translate-y-1/2 rounded-full bg-black/55 text-white shadow-lg backdrop-blur transition hover:bg-black/75 hover:text-white"
                aria-label={previousLabel}
                onClick={() => onOpenIndexChange(previousIndex)}
              >
                <ChevronLeft className="h-5 w-5" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-3 top-1/2 h-10 w-10 -translate-y-1/2 rounded-full bg-black/55 text-white shadow-lg backdrop-blur transition hover:bg-black/75 hover:text-white"
                aria-label={nextLabel}
                onClick={() => onOpenIndexChange(nextIndex)}
              >
                <ChevronRight className="h-5 w-5" />
              </Button>
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-black/55 px-3 py-1 text-[12px] font-semibold text-white backdrop-blur">
                {currentIndex + 1} / {photos.length}
              </div>
            </>
          ) : null}
          <DialogClose asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute right-3 top-3 h-9 w-9 rounded-full bg-black/55 text-white shadow-lg backdrop-blur transition hover:bg-black/75 hover:text-white"
              aria-label={closeLabel}
            >
              <X className="h-4 w-4" />
            </Button>
          </DialogClose>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function GooglePlaceReviewSection({
  reviews,
  labels,
}: {
  reviews: GoogleStopDetails["reviews"];
  labels: TripPlanningLabels["place_details"];
}) {
  const [starFilter, setStarFilter] = useState<number | null>(null);
  const [topicFilter, setTopicFilter] = useState<ReviewTopic | null>(null);
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLowerCase();
  const topicKeys: ReviewTopic[] = ["environment", "food", "service", "price"];
  const visibleReviews = reviews.filter((review) => {
    if (starFilter != null && Math.round(review.rating ?? 0) !== starFilter) {
      return false;
    }
    if (topicFilter && !reviewMatchesTopic(review, topicFilter)) {
      return false;
    }
    if (normalizedQuery) {
      const searchable = `${review.author} ${review.text}`.toLowerCase();
      if (!searchable.includes(normalizedQuery)) return false;
    }
    return true;
  });

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-[12px] font-semibold text-fg">
        <MessageSquareText className="h-4 w-4 text-accent" />
        {labels.reviews}
      </div>
      <Input
        value={query}
        placeholder={labels.review_search_placeholder}
        onChange={(event) => setQuery(event.target.value)}
        className="h-9 rounded-full border-divider bg-white px-3 text-[12px] shadow-none"
      />
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        <ReviewFilterChip
          active={starFilter == null}
          label={labels.review_all}
          onClick={() => setStarFilter(null)}
        />
        {[5, 4, 3, 2, 1].map((rating) => (
          <ReviewFilterChip
            key={rating}
            active={starFilter === rating}
            label={formatTemplate(labels.review_stars, { n: String(rating) })}
            onClick={() => setStarFilter(rating)}
          />
        ))}
      </div>
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        <ReviewFilterChip
          active={topicFilter == null}
          label={labels.review_all}
          onClick={() => setTopicFilter(null)}
        />
        {topicKeys.map((topic) => (
          <ReviewFilterChip
            key={topic}
            active={topicFilter === topic}
            label={labels.review_topics[topic]}
            onClick={() => setTopicFilter(topic)}
          />
        ))}
      </div>
      <div className="space-y-2">
        {visibleReviews.length ? (
          visibleReviews.slice(0, 5).map((review, index) => (
            <blockquote
              key={`${review.author}-${index}`}
              className="rounded-2xl bg-muted px-3 py-2 text-[12px] leading-5 text-fg-secondary"
            >
              <div className="mb-1 flex items-center justify-between gap-2 font-semibold text-fg">
                <span className="truncate">{review.author}</span>
                {review.rating ? (
                  <span className="inline-flex items-center gap-1 text-[#9b6a00]">
                    <Star className="h-3 w-3 fill-current" />
                    {review.rating.toFixed(1)}
                  </span>
                ) : null}
              </div>
              <p className="line-clamp-3">{review.text}</p>
              {review.relativeTime ? (
                <p className="mt-1 text-[11px] text-fg-muted">
                  {review.relativeTime}
                </p>
              ) : null}
            </blockquote>
          ))
        ) : (
          <div className="rounded-2xl bg-muted px-3 py-2 text-[12px] text-fg-muted">
            {labels.review_no_matches}
          </div>
        )}
      </div>
    </div>
  );
}

function ReviewFilterChip({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={[
        "shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition",
        active
          ? "border-accent bg-accent text-white"
          : "border-divider bg-white text-fg-secondary hover:border-accent/40 hover:text-accent",
      ].join(" ")}
      onClick={onClick}
    >
      {label}
    </button>
  );
}

function StopGoogleDetailsCard({
  labels,
  details,
  loading,
  error,
  ticketLabels,
  ticketAttachments,
  budgetAmount,
  isMealStop,
  fallbackName,
  cityHint,
  fallbackPlaceId,
  allowFallbackMapsLink,
  fallbackAddress,
  onSaveBudget,
  onClose,
}: {
  labels: TripPlanningLabels["place_details"];
  details: GoogleStopDetails | null;
  loading: boolean;
  error: boolean;
  ticketLabels: TripPlanningLabels["ticket_actions"];
  ticketAttachments: TripStopAttachment[];
  budgetAmount: string;
  isMealStop: boolean;
  fallbackName: string;
  cityHint: string | null;
  fallbackPlaceId: string | null;
  allowFallbackMapsLink: boolean;
  fallbackAddress: string;
  onSaveBudget: (amount: string) => Promise<void>;
  onClose: () => void;
}) {
  const [budgetValue, setBudgetValue] = useState(budgetAmount);
  const [budgetEditing, setBudgetEditing] = useState(false);
  const [budgetStatus, setBudgetStatus] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");
  const [menuPreviewIndex, setMenuPreviewIndex] = useState<number | null>(null);
  const name = details?.name || fallbackName;
  const address = details?.address || fallbackAddress;
  const websiteUrl = normalizeExternalUrl(details?.website);
  const mapsUrl =
    normalizeExternalUrl(details?.mapsUrl) ??
    (allowFallbackMapsLink
      ? googleMapsSearchUrl(name, address, details?.id ?? fallbackPlaceId, cityHint)
      : null);
  const hasContact = Boolean(details?.phone || websiteUrl || mapsUrl);
  const menuUrl = websiteUrl ?? mapsUrl;
  const showRestaurantTools = isMealStop || Boolean(details?.isRestaurant);
  const ticketScreenshots = ticketAttachments.filter(
    (attachment) => attachment.imageDataUrl,
  );
  const ticketLinks = ticketAttachments.filter((attachment) => attachment.url);
  const hasRichContent = Boolean(
    details?.photos.length ||
      details?.rating ||
      details?.reviews.length ||
      details?.hours.length ||
      details?.priceLabel ||
      ticketScreenshots.length ||
      ticketLinks.length ||
      hasContact,
  );
  const budgetDisplayValue = budgetValue.trim();

  async function saveBudget(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (budgetStatus === "saving") return;
    setBudgetStatus("saving");
    try {
      await onSaveBudget(budgetDisplayValue);
      setBudgetStatus("saved");
      setBudgetEditing(false);
    } catch {
      setBudgetStatus("error");
    }
  }

  return (
    <aside className="overflow-hidden rounded-[22px] border border-white/80 bg-white/92 shadow-[0_26px_70px_-42px_rgba(32,41,46,0.58)] backdrop-blur-xl">
      <div className="flex items-start justify-between gap-3 px-4 pb-3 pt-4">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-accent">
            {labels.title}
          </p>
          <h3 className="mt-1 truncate text-[18px] font-semibold text-fg">
            {name}
          </h3>
          {address ? (
            <p className="mt-1 line-clamp-1 text-[12px] text-fg-muted">
              {address}
            </p>
          ) : null}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0 rounded-full"
          aria-label={labels.close}
          onClick={onClose}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <GooglePlacePhotoStrip
        photos={details?.photos ?? []}
        title={name}
        closeLabel={labels.close}
        previousLabel={labels.photo_previous}
        nextLabel={labels.photo_next}
      />

      <div className="space-y-3 px-4 pb-4">
        {loading ? (
          <div className="flex items-center gap-2 rounded-2xl bg-accent-soft px-3 py-2 text-[13px] font-medium text-accent">
            <Loader2 className="h-4 w-4 animate-spin" />
            {labels.loading}
          </div>
        ) : error || !hasRichContent ? (
          <div className="rounded-2xl bg-muted px-3 py-2 text-[13px] text-fg-muted">
            {labels.no_details}
          </div>
        ) : null}

        {details?.rating ? (
          <div className="flex flex-wrap items-center gap-2 text-[13px] text-fg">
            <span className="inline-flex items-center gap-1 rounded-full bg-[#fff7dc] px-2.5 py-1 font-semibold text-[#9b6a00]">
              <Star className="h-3.5 w-3.5 fill-current" />
              {details.rating.toFixed(1)}
            </span>
            {details.userRatingCount ? (
              <span className="text-fg-muted">
                {details.userRatingCount.toLocaleString()} {labels.reviews}
              </span>
            ) : null}
          </div>
        ) : null}

        {showRestaurantTools ? (
          <div className="rounded-2xl border border-divider bg-white p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2 text-[12px] font-semibold text-fg">
                <Menu className="h-4 w-4 text-accent" />
                <span className="truncate">{labels.menu}</span>
              </div>
              {details?.priceLabel ? (
                <span className="rounded-full bg-muted px-2.5 py-1 text-[11px] font-semibold text-fg-secondary">
                  {details.priceLabel}
                </span>
              ) : null}
            </div>
            {details?.foodTraitKeys.length ? (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {details.foodTraitKeys.slice(0, 4).map((trait) => (
                  <span
                    key={trait}
                    className="rounded-full bg-accent-soft px-2 py-1 text-[10px] font-semibold text-accent"
                  >
                    {labels.food_traits[trait]}
                  </span>
                ))}
              </div>
            ) : null}
            {details?.photos.length ? (
              <Button
                type="button"
                size="sm"
                onClick={() => setMenuPreviewIndex(0)}
                className="mt-3 inline-flex items-center gap-2 rounded-full bg-fg px-3 py-2 text-[12px] font-semibold text-white transition hover:bg-fg-secondary"
              >
                {labels.menu}
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            ) : menuUrl ? (
              <a
                href={menuUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-3 inline-flex items-center gap-2 rounded-full bg-fg px-3 py-2 text-[12px] font-semibold text-white transition hover:bg-fg-secondary"
              >
                {labels.menu}
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            ) : null}
          </div>
        ) : null}

        <GooglePlacePhotoCarouselDialog
          photos={details?.photos ?? []}
          title={name}
          openIndex={menuPreviewIndex}
          closeLabel={labels.close}
          previousLabel={labels.photo_previous}
          nextLabel={labels.photo_next}
          onOpenIndexChange={setMenuPreviewIndex}
        />

        {ticketScreenshots.length || ticketLinks.length ? (
          <div className="rounded-2xl border border-divider bg-white p-3">
            <div className="mb-2 flex items-center gap-2 text-[12px] font-semibold text-fg">
              <Ticket className="h-4 w-4 text-accent" />
              {ticketLabels.screenshots}
            </div>
            {ticketScreenshots.length ? (
              <div className="grid grid-cols-2 gap-2">
                {ticketScreenshots.slice(0, 4).map((attachment) => (
                  <a
                    key={attachment.id}
                    href={attachment.imageDataUrl ?? undefined}
                    target="_blank"
                    rel="noreferrer"
                    className="group relative overflow-hidden rounded-2xl border border-divider bg-muted transition hover:border-accent/40"
                  >
                    <Image
                      src={attachment.imageDataUrl ?? ""}
                      alt={attachment.imageName ?? attachment.label}
                      width={180}
                      height={120}
                      unoptimized
                      className="h-24 w-full object-cover transition group-hover:scale-[1.03]"
                    />
                    <span className="absolute inset-x-2 bottom-2 truncate rounded-full bg-white/90 px-2 py-1 text-[10px] font-semibold text-fg shadow-sm backdrop-blur">
                      {attachment.imageName ?? attachment.label}
                    </span>
                  </a>
                ))}
              </div>
            ) : null}
            {ticketLinks.length ? (
              <div className="mt-2 flex flex-wrap gap-2">
                {ticketLinks.slice(0, 3).map((attachment) => (
                  <a
                    key={attachment.id}
                    href={attachment.url ?? undefined}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex min-w-0 items-center gap-1.5 rounded-full bg-accent-soft px-3 py-1.5 text-[11px] font-semibold text-accent transition hover:bg-accent hover:text-white"
                  >
                    <span className="truncate">{attachment.label}</span>
                    <ExternalLink className="h-3 w-3 shrink-0" />
                  </a>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-2">
          {budgetDisplayValue && !budgetEditing ? (
            <button
              type="button"
              className="inline-flex min-w-0 items-center gap-2 rounded-full border border-accent/20 bg-accent-soft px-3 py-1.5 text-[12px] font-semibold text-accent transition hover:border-accent/40 hover:bg-accent/10"
              onClick={() => {
                setBudgetEditing(true);
                setBudgetStatus("idle");
              }}
            >
              <ReceiptText className="h-3.5 w-3.5 shrink-0" />
              <span className="text-fg-secondary">{labels.budget_label}</span>
              <span className="max-w-36 truncate">{budgetDisplayValue}</span>
            </button>
          ) : null}
          {!budgetDisplayValue && !budgetEditing ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 rounded-full border-accent/30 bg-white px-3 text-[12px] font-semibold text-accent hover:border-accent/50 hover:bg-accent-soft"
              onClick={() => {
                setBudgetEditing(true);
                setBudgetStatus("idle");
              }}
            >
              <Plus className="h-3.5 w-3.5" />
              {labels.budget_add}
            </Button>
          ) : null}
          {budgetStatus === "saved" && !budgetEditing ? (
            <span className="text-[11px] font-semibold text-accent">
              {labels.budget_saved}
            </span>
          ) : null}
        </div>

        {budgetEditing ? (
          <form
            className="rounded-2xl border border-accent/15 bg-accent-soft/60 p-2.5"
            onSubmit={(event) => void saveBudget(event)}
          >
            <label className="sr-only">{labels.budget_label}</label>
            <div className="flex gap-2">
              <Input
                value={budgetValue}
                placeholder={labels.budget_placeholder}
                inputMode="decimal"
                autoFocus
                onChange={(event) => {
                  setBudgetValue(event.target.value);
                  setBudgetStatus("idle");
                }}
                className="h-9 rounded-full border-white/70 bg-white text-[13px] shadow-none"
              />
              <Button
                type="submit"
                size="sm"
                disabled={budgetStatus === "saving"}
                className="h-9 shrink-0 rounded-full px-3"
              >
                {budgetStatus === "saving" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                <span className="hidden sm:inline">
                  {budgetStatus === "saving"
                    ? labels.budget_saving
                    : labels.budget_save}
                </span>
              </Button>
            </div>
            {budgetStatus === "error" ? (
              <p className="mt-2 text-[11px] font-semibold text-destructive">
                {labels.budget_error}
              </p>
            ) : null}
          </form>
        ) : null}

        {hasContact ? (
          <div className="grid gap-2 text-[13px] text-fg-secondary sm:grid-cols-2">
            {details?.phone ? (
              <a
                href={`tel:${details.phone.replace(/\s+/g, "")}`}
                className="inline-flex min-w-0 items-center gap-2 rounded-2xl border border-divider bg-white px-3 py-2 transition hover:border-accent/35 hover:text-accent"
              >
                <Phone className="h-4 w-4 shrink-0" />
                <span className="truncate">{details.phone}</span>
              </a>
            ) : null}
            {websiteUrl ? (
              <a
                href={websiteUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-w-0 items-center gap-2 rounded-2xl border border-divider bg-white px-3 py-2 transition hover:border-accent/35 hover:text-accent"
              >
                <Globe className="h-4 w-4 shrink-0" />
                <span className="truncate">{labels.website}</span>
              </a>
            ) : null}
            {mapsUrl ? (
              <a
                href={mapsUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-w-0 items-center gap-2 rounded-2xl border border-divider bg-white px-3 py-2 transition hover:border-accent/35 hover:text-accent"
              >
                <MapPin className="h-4 w-4 shrink-0" />
                <span className="truncate">{labels.directions}</span>
              </a>
            ) : null}
          </div>
        ) : null}

        {details?.hours.length ? (
          <div className="rounded-2xl border border-divider bg-white px-3 py-2">
            <div className="mb-1 flex items-center gap-2 text-[12px] font-semibold text-fg">
              <Clock className="h-4 w-4 text-accent" />
              {labels.hours}
            </div>
            <p className="line-clamp-2 text-[12px] leading-5 text-fg-muted">
              {details.hours.slice(0, 2).join(" · ")}
            </p>
          </div>
        ) : null}

        {details?.reviews.length ? (
          <GooglePlaceReviewSection reviews={details.reviews} labels={labels} />
        ) : null}
      </div>

      {mapsUrl ? (
        <div className="border-t border-divider px-4 py-2 text-[10px] text-fg-muted">
          <a
            href={mapsUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 transition hover:text-accent"
          >
            Google Maps
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      ) : null}
    </aside>
  );
}

function CandidateStopDetailsCard({
  candidate,
  days,
  bookingAdults,
  labels,
  onAdd,
  onClose,
}: {
  candidate: CandidateStopDetailsContext;
  days: TripDayModel[];
  bookingAdults: number;
  labels: TripPlanningLabels;
  onAdd: (range?: LodgingDateRange) => Promise<unknown>;
  onClose: () => void;
}) {
  const [status, setStatus] = useState<"idle" | "adding" | "error">("idle");
  const [lodgingRange, setLodgingRange] = useState<LodgingDateRange>(() => ({
    startIndex: candidate.lodgingPlan?.defaultStartIndex ?? 0,
    endIndex: candidate.lodgingPlan?.defaultEndIndex ?? 0,
  }));
  const details = candidate.details;
  const name = details?.name || candidate.landmark.name;
  const address = details?.address || candidate.landmark.address;
  const mapsUrl =
    normalizeExternalUrl(details?.mapsUrl) ??
    googleMapsSearchUrl(name, address, candidate.landmark.placeId);
  const websiteUrl = normalizeExternalUrl(details?.website);
  const loading = candidate.loading;
  const lodgingPlan = candidate.lodgingPlan;
  const isSuggestedCandidate = candidate.suggestedPlacement != null;
  const suggestionLabels = {
    add: labels.place_suggestions?.add ?? "Want to go",
    adding: labels.place_suggestions?.adding ?? "Saving…",
    added: labels.place_suggestions?.added ?? "Selected",
    remove: labels.place_suggestions?.remove ?? "Remove from stop",
  };
  const normalizedLodgingRange = normalizeLodgingDateRange(
    lodgingRange,
    days.length,
  );
  const bookingUrl = lodgingPlan
    ? bookingSearchUrl({
        destination: [name, address].filter(Boolean).join(", "),
        checkIn: days[normalizedLodgingRange.startIndex]?.date ?? "",
        checkOut: checkoutDateForLodgingRange(days, normalizedLodgingRange),
        adults: bookingAdults,
        rooms: BOOKING_DEFAULT_ROOMS,
      })
    : null;

  async function addToTrip() {
    if (status === "adding" || candidate.adding) return;
    setStatus("adding");
    try {
      await onAdd(lodgingPlan ? lodgingRange : undefined);
      if (isSuggestedCandidate) setStatus("idle");
    } catch {
      setStatus("error");
    }
  }

  return (
    <aside className="overflow-hidden rounded-[22px] border border-white/80 bg-white/92 shadow-[0_26px_70px_-42px_rgba(32,41,46,0.58)] backdrop-blur-xl">
      <div className="flex items-start justify-between gap-3 px-4 pb-3 pt-4">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-accent">
            {labels.place_details.title}
          </p>
          <h3 className="mt-1 truncate text-[18px] font-semibold text-fg">
            {name}
          </h3>
          {address ? (
            <p className="mt-1 line-clamp-1 text-[12px] text-fg-muted">
              {address}
            </p>
          ) : null}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0 rounded-full"
          aria-label={labels.place_details.close}
          onClick={onClose}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <GooglePlacePhotoStrip
        photos={details?.photos ?? []}
        title={name}
        closeLabel={labels.place_details.close}
        previousLabel={labels.place_details.photo_previous}
        nextLabel={labels.place_details.photo_next}
      />

      <div className="space-y-3 px-4 pb-4">
        {loading ? (
          <div className="flex items-center gap-2 rounded-2xl bg-accent-soft px-3 py-2 text-[13px] font-medium text-accent">
            <Loader2 className="h-4 w-4 animate-spin" />
            {labels.place_details.loading}
          </div>
        ) : candidate.error ? (
          <div className="rounded-2xl bg-muted px-3 py-2 text-[13px] text-fg-muted">
            {labels.place_details.no_details}
          </div>
        ) : null}

        {details?.rating ? (
          <div className="flex flex-wrap items-center gap-2 text-[13px] text-fg">
            <span className="inline-flex items-center gap-1 rounded-full bg-[#fff7dc] px-2.5 py-1 font-semibold text-[#9b6a00]">
              <Star className="h-3.5 w-3.5 fill-current" />
              {details.rating.toFixed(1)}
            </span>
            {details.userRatingCount ? (
              <span className="text-fg-muted">
                {details.userRatingCount.toLocaleString()} {labels.place_details.reviews}
              </span>
            ) : null}
          </div>
        ) : null}

        {details?.hours.length ? (
          <div className="rounded-2xl border border-divider bg-white px-3 py-2">
            <div className="mb-1 flex items-center gap-2 text-[12px] font-semibold text-fg">
              <Clock className="h-4 w-4 text-accent" />
              {labels.place_details.hours}
            </div>
            <p className="line-clamp-2 text-[12px] leading-5 text-fg-muted">
              {details.hours.slice(0, 2).join(" · ")}
            </p>
          </div>
        ) : null}

        <div className="grid gap-2 text-[13px] text-fg-secondary sm:grid-cols-2">
          {websiteUrl ? (
            <a
              href={websiteUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-w-0 items-center gap-2 rounded-2xl border border-divider bg-white px-3 py-2 transition hover:border-accent/35 hover:text-accent"
            >
              <Globe className="h-4 w-4 shrink-0" />
              <span className="truncate">{labels.place_details.website}</span>
            </a>
          ) : null}
          {mapsUrl ? (
            <a
              href={mapsUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-w-0 items-center gap-2 rounded-2xl border border-divider bg-white px-3 py-2 transition hover:border-accent/35 hover:text-accent"
            >
              <MapPin className="h-4 w-4 shrink-0" />
              <span className="truncate">{labels.place_details.directions}</span>
            </a>
          ) : null}
        </div>

        {lodgingPlan ? (
          <LodgingDateRangePicker
            days={days}
            range={lodgingRange}
            labels={labels.lodging_stops}
            dayLabel={labels.day_label}
            onChange={setLodgingRange}
          />
        ) : null}

        {lodgingPlan && bookingUrl ? (
          <div className="rounded-2xl border border-[#d7dce7] bg-white p-3">
            <a
              href={bookingUrl}
              target="_blank"
              rel="noreferrer sponsored"
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-fg px-3 text-[13px] font-semibold text-white transition hover:bg-fg/90"
            >
              <ExternalLink className="h-4 w-4" />
              {labels.lodging_stops.booking_button}
            </a>
            <p className="mt-2 text-[11px] leading-5 text-fg-muted">
              {labels.lodging_stops.booking_note}
            </p>
            <p className="text-[11px] leading-5 text-fg-muted">
              {labels.lodging_stops.booking_no_price}
            </p>
          </div>
        ) : null}

        <Button
          type="button"
          onClick={() => void addToTrip()}
          disabled={
            status === "adding" ||
            candidate.adding
          }
          className={cn(
            "h-11 w-full rounded-xl text-white",
            isSuggestedCandidate && candidate.selectedSuggestion
              ? "bg-fg/80 hover:bg-fg"
              : "bg-accent hover:bg-accent/90",
          )}
        >
          {status === "adding" || candidate.adding ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : isSuggestedCandidate && candidate.selectedSuggestion ? (
            <HeartOff className="h-4 w-4" />
          ) : isSuggestedCandidate ? (
            <Heart className="h-4 w-4" />
          ) : (
            <Plus className="h-4 w-4" />
          )}
          {status === "adding" || candidate.adding
            ? isSuggestedCandidate
              ? suggestionLabels.adding
              : lodgingPlan
              ? labels.lodging_stops.adding
              : labels.map_search.adding
            : isSuggestedCandidate && candidate.selectedSuggestion
              ? suggestionLabels.remove
              : isSuggestedCandidate
                ? suggestionLabels.add
                : lodgingPlan
              ? labels.lodging_stops.add
              : labels.map_search.add}
        </Button>
        {status === "error" ? (
          <p className="text-[12px] font-semibold text-destructive">
            {labels.map_search.error}
          </p>
        ) : null}
      </div>
    </aside>
  );
}

function LodgingDateRangePicker({
  days,
  range,
  labels,
  dayLabel,
  onChange,
}: {
  days: TripDayModel[];
  range: LodgingDateRange;
  labels: TripPlanningLabels["lodging_stops"];
  dayLabel: string;
  onChange: (range: LodgingDateRange) => void;
}) {
  const normalizedRange = normalizeLodgingDateRange(range, days.length);
  const firstDate = tripDateToLocalDate(days[0]?.date);
  const lastDate = tripDateToLocalDate(days.at(-1)?.date);
  const selectedRange: DayPickerDateRange | undefined =
    days[normalizedRange.startIndex] && days[normalizedRange.endIndex]
      ? {
          from: tripDateToLocalDate(days[normalizedRange.startIndex]?.date),
          to: tripDateToLocalDate(days[normalizedRange.endIndex]?.date),
        }
      : undefined;
  const rangeSummary =
    days[normalizedRange.startIndex] && days[normalizedRange.endIndex]
      ? `${formatTemplate(dayLabel, {
          n: String(normalizedRange.startIndex + 1),
        })} ${shortDate(days[normalizedRange.startIndex]?.date ?? "")} - ${formatTemplate(dayLabel, {
          n: String(normalizedRange.endIndex + 1),
        })} ${shortDate(days[normalizedRange.endIndex]?.date ?? "")}`
      : "";

  function handleCalendarSelect(nextRange: DayPickerDateRange | undefined) {
    if (!nextRange?.from) return;
    const startIndex = dayIndexForLocalDate(days, nextRange.from);
    const endIndex = nextRange.to
      ? dayIndexForLocalDate(days, nextRange.to)
      : startIndex;
    if (startIndex == null || endIndex == null) return;
    onChange(
      normalizeLodgingDateRange(
        {
          startIndex: Math.min(startIndex, endIndex),
          endIndex: Math.max(startIndex, endIndex),
        },
        days.length,
      ),
    );
  }

  return (
    <div className="rounded-2xl border border-accent/20 bg-accent-soft/30 p-3">
      <p className="text-[12px] font-semibold text-fg">
        {labels.range_title}
      </p>
      <p className="mt-0.5 text-[11px] leading-5 text-fg-muted">
        {labels.range_hint}
      </p>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            className="mt-3 h-11 w-full justify-start rounded-xl border-accent/25 bg-white px-3 text-left text-[13px] font-semibold text-fg hover:border-accent/45 hover:bg-white hover:text-accent"
          >
            <CalendarDays className="h-4 w-4 text-accent" />
            <span className="min-w-0 flex-1 truncate">
              {rangeSummary || labels.choose}
            </span>
            <ChevronDown className="h-4 w-4 text-fg-muted" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="w-auto rounded-2xl border-white/80 bg-white p-0 shadow-[0_24px_70px_-46px_rgba(32,41,46,0.58)]"
        >
          <Calendar
            mode="range"
            selected={selectedRange}
            defaultMonth={selectedRange?.from ?? firstDate ?? undefined}
            startMonth={firstDate ?? undefined}
            endMonth={lastDate ?? undefined}
            disabled={(date) => dayIndexForLocalDate(days, date) == null}
            numberOfMonths={1}
            onSelect={handleCalendarSelect}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}

function LodgingSettingsDialog({
  open,
  days,
  settings,
  labels,
  dayLabel,
  bookingAdults,
  onOpenChange,
  onSave,
  onChooseStay,
}: {
  open: boolean;
  days: TripDayModel[];
  settings: LodgingSettingsState;
  labels: TripPlanningLabels["lodging_stops"];
  dayLabel: string;
  bookingAdults: number;
  onOpenChange: (open: boolean) => void;
  onSave: (
    target: LodgingSettingsTarget,
    range: LodgingDateRange,
  ) => Promise<void>;
  onChooseStay: (range: LodgingDateRange) => void;
}) {
  const [range, setRange] = useState(settings.range);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);
  const normalizedRange = normalizeLodgingDateRange(range, days.length);
  const checkIn = days[normalizedRange.startIndex]?.date ?? "";
  const checkOut = checkoutDateForLodgingRange(days, normalizedRange);
  const currentStay = settings.target?.stop ?? null;
  const bookingUrl = bookingSearchUrl({
    destination:
      days[normalizedRange.startIndex]?.city ||
      currentStay?.name ||
      labels.placeholder_title,
    checkIn,
    checkOut,
    adults: bookingAdults,
    rooms: BOOKING_DEFAULT_ROOMS,
  });

  async function handleSave() {
    if (!settings.target) return;
    setSaving(true);
    setError(false);
    try {
      await onSave(settings.target, normalizedRange);
    } catch {
      setSaving(false);
      setError(true);
    }
  }

  function handleChooseStay() {
    onChooseStay(normalizedRange);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-[24px] bg-white sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>{labels.settings_title}</DialogTitle>
          <DialogDescription>
            {labels.settings_description}
          </DialogDescription>
        </DialogHeader>

        {currentStay ? (
          <div className="rounded-2xl border border-divider bg-muted/40 p-3">
            <p className="text-[13px] font-semibold text-fg">
              {currentStay.name}
            </p>
            <p className="mt-1 line-clamp-2 text-[12px] leading-5 text-fg-muted">
              {currentStay.placeAddress ||
                currentStay.note ||
                currentStay.placeName ||
                labels.choose}
            </p>
          </div>
        ) : null}

        <div className="grid gap-2 sm:grid-cols-2">
          <div className="rounded-2xl border border-divider bg-white p-3">
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase text-fg-muted">
              <CalendarCheck className="h-3.5 w-3.5 text-accent" />
              {labels.check_in}
            </div>
            <p className="mt-1 text-[14px] font-semibold text-fg">
              {shortDate(checkIn)}
            </p>
          </div>
          <div className="rounded-2xl border border-divider bg-white p-3">
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase text-fg-muted">
              <CalendarDays className="h-3.5 w-3.5 text-accent" />
              {labels.check_out}
            </div>
            <p className="mt-1 text-[14px] font-semibold text-fg">
              {shortDate(checkOut)}
            </p>
          </div>
        </div>

        <LodgingDateRangePicker
          days={days}
          range={normalizedRange}
          labels={labels}
          dayLabel={dayLabel}
          onChange={setRange}
        />

        {error ? (
          <p className="rounded-2xl border border-destructive/20 bg-destructive/5 px-3 py-2 text-[12px] text-destructive">
            {labels.settings_error}
          </p>
        ) : null}

        <DialogFooter className="gap-2 sm:justify-between">
          <DialogClose asChild>
            <Button
              type="button"
              variant="outline"
              className="rounded-xl border-divider bg-white"
              disabled={saving}
            >
              {labels.home_cancel}
            </Button>
          </DialogClose>
          <div className="flex flex-col gap-2 sm:flex-row">
            {bookingUrl ? (
              <a
                href={bookingUrl}
                target="_blank"
                rel="noreferrer sponsored"
                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-divider bg-white px-3 text-[12px] font-semibold text-fg transition hover:border-accent/35 hover:bg-accent-soft hover:text-accent"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                {labels.booking_button}
              </a>
            ) : null}
            <Button
              type="button"
              variant={settings.target ? "outline" : "default"}
              className={cn(
                "rounded-xl",
                !settings.target && "bg-accent text-white hover:bg-accent-strong",
              )}
              disabled={saving}
              onClick={handleChooseStay}
            >
              <Search className="h-4 w-4" />
              {labels.choose_after_dates}
            </Button>
            {settings.target ? (
              <Button
                type="button"
                className="rounded-xl bg-accent text-white hover:bg-accent-strong"
                disabled={saving}
                onClick={() => void handleSave()}
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                {saving ? labels.saving_dates : labels.save_dates}
              </Button>
            ) : null}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MovementDetailsCard({
  movement,
  labels,
  onUpload,
  onClose,
}: {
  movement: ActiveMovementDetailsContext;
  labels: TripPlanningLabels["movement_details"];
  onUpload: (input: {
    dayIndex: number;
    fromIndex: number;
    attachment: TripStopAttachment;
    imageName: string;
    imageDataUrl: string;
  }) => Promise<void>;
  onClose: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploadState, setUploadState] = useState<
    "idle" | "uploading" | "uploaded" | "error"
  >("idle");
  const attachment = movement.attachment;
  const complete = attachment ? isAttachmentComplete(attachment) : false;
  const estimate = movement.segment
    ? estimateAirportTransferCost(movement.segment)
    : null;

  async function uploadBookingCapture(file: File | null) {
    if (!file || !attachment || uploadState === "uploading") return;
    setUploadState("uploading");
    try {
      const imageDataUrl = await compressImageToDataUrl(file, {
        maxDataUrlLength: 1_800_000,
        fallbackQuality: 0.45,
      });
      await onUpload({
        dayIndex: movement.dayIndex,
        fromIndex: movement.fromIndex,
        attachment,
        imageName: file.name,
        imageDataUrl,
      });
      setUploadState("uploaded");
    } catch {
      setUploadState("error");
    } finally {
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <aside className="overflow-hidden rounded-[22px] border border-white/80 bg-white/92 shadow-[0_26px_70px_-42px_rgba(32,41,46,0.58)] backdrop-blur-xl">
      <div className="flex items-start justify-between gap-3 px-4 pb-3 pt-4">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-accent">
            {labels.title}
          </p>
          <h3 className="mt-1 truncate text-[18px] font-semibold text-fg">
            {movement.fromStop.name} → {movement.toStop.name}
          </h3>
          <p className="mt-1 text-[12px] text-fg-muted">{labels.route}</p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0 rounded-full"
          aria-label={labels.close}
          onClick={onClose}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="space-y-3 px-4 pb-4">
        <div className="grid grid-cols-2 gap-2">
          <MovementMetric
            label={labels.duration}
            value={
              movement.loading
                ? "..."
                : movement.segment?.durationText ?? labels.estimated_by_google
            }
          />
          <MovementMetric
            label={labels.distance}
            value={
              movement.segment
                ? `${movement.segment.distanceKm.toFixed(1)} km`
                : movement.loading
                  ? "..."
                  : labels.estimated_by_google
            }
          />
        </div>

        <div className="rounded-2xl border border-divider bg-white p-3">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[12px] font-semibold text-fg">
                {labels.estimate}
              </div>
              <div className="mt-1 text-[11px] text-fg-muted">
                {labels.estimated_by_google}
              </div>
            </div>
            <div className="shrink-0 text-right text-[15px] font-semibold text-fg">
              {estimate ? formatTemplate(labels.cost_range, estimate) : "..."}
            </div>
          </div>
        </div>

        <div
          className={cn(
            "rounded-2xl border p-3",
            complete
              ? "border-accent/25 bg-accent-soft"
              : "border-[#f2b84b]/45 bg-[#fff8e7]",
          )}
        >
          <div className="flex items-start gap-2">
            {complete ? (
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
            ) : (
              <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-[#9b6a00]" />
            )}
            <div className="min-w-0">
              <div className="text-[13px] font-semibold text-fg">
                {complete ? labels.uploaded : labels.booking_required}
              </div>
              <p className="mt-1 text-[12px] leading-5 text-fg-muted">
                {labels.booking_body}
              </p>
            </div>
          </div>
          {attachment?.imageDataUrl ? (
            <a
              href={attachment.imageDataUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-3 block overflow-hidden rounded-2xl border border-white bg-white"
            >
              <Image
                src={attachment.imageDataUrl}
                alt={attachment.imageName ?? labels.screenshot}
                width={320}
                height={180}
                unoptimized
                className="h-36 w-full object-cover"
              />
            </a>
          ) : null}
          <Button
            type="button"
            variant={complete ? "outline" : "default"}
            className={cn(
              "mt-3 h-10 w-full rounded-xl",
              !complete && "bg-fg text-white hover:bg-fg-secondary",
            )}
            disabled={!attachment || uploadState === "uploading"}
            onClick={() => inputRef.current?.click()}
          >
            {uploadState === "uploading" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : complete || uploadState === "uploaded" ? (
              <Check className="h-4 w-4" />
            ) : (
              <Upload className="h-4 w-4" />
            )}
            {uploadState === "uploading"
              ? labels.uploading
              : uploadState === "error"
                ? labels.upload_error
                : complete || uploadState === "uploaded"
                  ? labels.uploaded
                  : labels.upload}
          </Button>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(event) =>
              void uploadBookingCapture(event.target.files?.[0] ?? null)
            }
          />
        </div>
      </div>
    </aside>
  );
}

function MovementMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-divider bg-white p-3">
      <div className="text-[11px] font-semibold text-fg-muted">{label}</div>
      <div className="mt-1 text-[15px] font-semibold text-fg">{value}</div>
    </div>
  );
}

function DailyItinerary({
  days,
  lang,
  companions,
  bookingAdults,
  homePlace,
  activeView,
  mapFocus,
  activeStopLandmarkLabel,
  onActiveViewChange,
  onMapFocusChange,
  onReorderDayStops,
  onUpdateDays,
  onUpdateStopTime,
  onUpdateStopAttachments,
  onAutoArrangeDayStops,
  onOpenLodgingSettings,
  onRequestHomeSettings,
  onUpdateLodgingAssignment,
  journeyStarted,
  selectedDay,
  labels,
}: {
  days: TripDayModel[];
  lang: string;
  companions: ApiCompanion[];
  bookingAdults: number;
  homePlace: UserHomePlace | null;
  activeView: ActiveItineraryView;
  mapFocus: MapFocus;
  activeStopLandmarkLabel: ActiveStopLandmarkLabel;
  onActiveViewChange: (view: ActiveItineraryView) => void;
  onMapFocusChange: (focus: MapFocus) => void;
  onReorderDayStops: (dayIndex: number, stops: TripDayModel["stops"]) => Promise<void>;
  onUpdateDays: (
    updater: (days: TripDayModel[]) => TripDayModel[],
    debounceMs?: number,
  ) => void;
  onUpdateStopTime: (
    dayIndex: number,
    stopIndex: number,
    arrivalTime: string | null,
  ) => Promise<void>;
  onUpdateStopAttachments: (
    dayIndex: number,
    stopIndex: number,
    attachments: TripStopAttachment[],
  ) => Promise<void>;
  onAutoArrangeDayStops: (
    dayIndex: number,
    stops: TripDayModel["stops"],
  ) => Promise<void>;
  onOpenLodgingSettings: (
    dayIndex: number,
    position: DayLodgingAnchor["position"],
  ) => void;
  onRequestHomeSettings: () => void;
  onUpdateLodgingAssignment: (
    dayIndex: number,
    position: DayLodgingAnchor["position"],
    companionIds: string[],
  ) => void;
  journeyStarted: boolean;
  selectedDay: TripDayModel | null;
  labels: TripPlanningLabels;
}) {
  const activeDay = typeof activeView === "number" ? activeView : 0;
  return (
    <section className="mt-3 flex min-h-[540px] flex-col 2xl:h-[606px] 2xl:min-h-0">
      <div data-testid="trip-day-rail" className="shrink-0 overflow-x-auto pb-1.5">
        <div className="flex min-w-max items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="icon-lg"
          aria-label={formatTemplate(labels.day_label, {
            n: String(Math.max(1, activeDay)),
          })}
          className="h-[50px] w-11 shrink-0 rounded-xl bg-white sm:h-[52px]"
          onClick={() => {
            if (activeView === "overview") return;
            onActiveViewChange(activeDay === 0 ? "overview" : Math.max(0, activeDay - 1));
          }}
        >
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <button
          type="button"
          onClick={() => onActiveViewChange("overview")}
          className={cn(
            "h-[50px] min-w-[108px] rounded-xl border bg-white px-3 text-center transition-colors sm:h-[52px] sm:min-w-[118px] sm:px-4",
            activeView === "overview"
              ? "border-accent text-accent shadow-sm"
              : "border-divider text-fg-secondary hover:border-accent/40",
          )}
        >
          <span className="block text-[12px] font-bold uppercase">
            {labels.overview_label}
          </span>
          <span className="mt-0.5 block text-[12px] font-semibold">
            {shortDate(days[0]?.date ?? "")} - {shortDate(days.at(-1)?.date ?? "")}
          </span>
        </button>
        {days.map((day, index) => (
          <button
            key={`${day.date}-${index}`}
            type="button"
            onClick={() => onActiveViewChange(index)}
            className={cn(
              "h-[50px] min-w-[108px] rounded-xl border bg-white px-3 text-center transition-colors sm:h-[52px] sm:min-w-[118px] sm:px-4",
              activeView === index
                ? "border-accent text-accent shadow-sm"
                : "border-divider text-fg-secondary hover:border-accent/40",
            )}
          >
            <span className="block text-[12px] font-bold uppercase">
              {formatTemplate(labels.day_label, { n: String(index + 1) })}
            </span>
            <span className="mt-0.5 block text-[12px] font-semibold">
              {shortDate(day.date)}
            </span>
          </button>
        ))}
        <Button
          type="button"
          variant="outline"
          size="icon-lg"
          aria-label={formatTemplate(labels.day_label, {
            n: String(Math.min(days.length, activeDay + 2)),
          })}
          className="h-[50px] w-11 shrink-0 rounded-xl bg-white sm:h-[52px]"
          onClick={() =>
            onActiveViewChange(
              activeView === "overview" ? 0 : Math.min(days.length - 1, activeDay + 1),
            )
          }
        >
          <ChevronRight className="h-5 w-5" />
        </Button>
        </div>
      </div>
      <div className="min-h-0 flex-1">
        {activeView === "overview" ? (
          <OverviewTimeline
            days={days}
            lang={lang}
            mapFocus={mapFocus}
            onMapFocusChange={onMapFocusChange}
            onUpdateDays={onUpdateDays}
            labels={labels}
          />
        ) : selectedDay ? (
          <Timeline
            days={days}
            companions={companions}
            bookingAdults={bookingAdults}
            homePlace={homePlace}
            day={selectedDay}
            dayIndex={activeDay}
            mapFocus={mapFocus}
            activeStopLandmarkLabel={activeStopLandmarkLabel}
            onMapFocusChange={onMapFocusChange}
            onReorderDayStops={onReorderDayStops}
            onUpdateStopTime={onUpdateStopTime}
            onUpdateStopAttachments={onUpdateStopAttachments}
            onAutoArrangeDayStops={onAutoArrangeDayStops}
            onOpenLodgingSettings={onOpenLodgingSettings}
            onRequestHomeSettings={onRequestHomeSettings}
            onUpdateLodgingAssignment={onUpdateLodgingAssignment}
            journeyStarted={journeyStarted}
            labels={labels}
          />
        ) : null}
      </div>
    </section>
  );
}

function OverviewTimeline({
  days,
  lang,
  mapFocus,
  onMapFocusChange,
  onUpdateDays,
  labels,
}: {
  days: TripDayModel[];
  lang: string;
  mapFocus: MapFocus;
  onMapFocusChange: (focus: MapFocus) => void;
  onUpdateDays: (
    updater: (days: TripDayModel[]) => TripDayModel[],
    debounceMs?: number,
  ) => void;
  labels: TripPlanningLabels;
}) {
  const segments = useMemo(() => buildRoutePoints(days), [days]);
  const diagram = useMemo(() => buildRouteDiagramPlan(days), [days]);
  const initialIds = segments.map((segment, index) => routeSegmentId(segment, index));

  if (segments.length === 0) {
    return (
      <div className="mt-2 h-full rounded-2xl border border-dashed border-divider-strong bg-white/70 p-5 text-center text-[13px] text-fg-muted">
        {labels.no_stops}
      </div>
    );
  }

  if (diagram.nodes.length > 1) {
    return USE_CORRIDOR_TABLE_OVERVIEW ? (
      <CorridorTableOverview
        days={days}
        lang={lang}
        mapFocus={mapFocus}
        onUpdateDays={onUpdateDays}
        labels={labels}
      />
    ) : (
      <RouteDiagramOverview
        diagram={diagram}
        days={days}
        mapFocus={mapFocus}
        onMapFocusChange={onMapFocusChange}
        labels={labels}
      />
    );
  }

  return (
    <OverviewSortableTimeline
      key={initialIds.join("|")}
      segments={segments}
      initialIds={initialIds}
      mapFocus={mapFocus}
      onMapFocusChange={onMapFocusChange}
      labels={labels}
    />
  );
}

type CorridorOverviewLane = {
  key: string;
  city: string;
  laneIndex: number;
};

type CorridorSegmentEntry = {
  city: string;
  note: string;
  segmentIndex: number | null;
};

type CorridorOverviewCell = {
  key: string;
  dayIndex: number;
  segmentIndex: number | null;
  city: string;
  cityKey: string;
  summary: string[];
  routeIndex: number | null;
};

type CorridorOverviewRun = {
  key: string;
  cityKey: string;
  laneIndex: number;
  startDayIndex: number;
  endDayIndex: number;
  cells: CorridorOverviewCell[];
};

type CorridorOverviewNote = {
  key: string;
  dayIndex: number;
  text: string;
};

type CorridorOverviewTransfer = {
  key: string;
  dayIndex: number;
  arrivalDayIndex: number;
  fromCity: string;
  fromKey: string;
  toCity: string;
  toKey: string;
  label: string;
  durationLabel: string | null;
  mode: TravelModeKind;
  fromLaneIndex: number;
  toLaneIndex: number;
  targetLaneIndex: number;
  extended: boolean;
  overnight: boolean;
};

type CorridorOverviewWarning = {
  key: string;
  kind: "overlap";
  startDayIndex: number;
  endDayIndex: number;
  fromLaneIndex: number;
  toLaneIndex: number;
  conflictDays: number;
} | {
  key: string;
  kind: "mismatch";
  dayIndex: number;
  laneIndex: number;
  expectedCity: string;
  actualCity: string;
};

type CorridorOverviewDay = {
  dayIndex: number;
  date: string;
  cells: CorridorOverviewCell[];
  transfers: CorridorOverviewTransfer[];
};

type CorridorOverviewPlan = {
  lanes: CorridorOverviewLane[];
  days: CorridorOverviewDay[];
  notes: CorridorOverviewNote[];
  warnings: CorridorOverviewWarning[];
};

type CorridorDragState = {
  runKey: string;
  city: string;
  cityKey: string;
  laneIndex: number;
  startDayIndex: number;
  endDayIndex: number;
  length: number;
} | null;

type CorridorDayDragState = {
  cellKey: string;
  city: string;
  cityKey: string;
  laneIndex: number;
  dayIndex: number;
} | null;

type CorridorHoverState = {
  laneIndex: number;
  dayIndex: number;
  conflictDays: number;
  mode: "add" | "move" | "resize" | "day";
} | null;

type CorridorResizeState = {
  runKey: string;
  city: string;
  cityKey: string;
  laneIndex: number;
  startDayIndex: number;
  endDayIndex: number;
  side: "start" | "end";
} | null;

type CorridorPendingAction = {
  kind: "add" | "move" | "delete" | "delete-day" | "delete-block" | "resize";
  city: string;
  nextDays: TripDayModel[];
  nextDaysWithStops: TripDayModel[] | null;
  secondaryActionLabel?: string;
  primaryActionLabel?: string;
  warning?: string | null;
  affectedDays: number;
  affectedStops: number;
  transferBefore: number;
  transferAfter: number;
  conflictDays: number;
};

type CorridorFlightSettings = {
  transfer: CorridorOverviewTransfer;
  departureTime: string;
  durationMinutes: string;
} | null;

type CorridorNoteEditor = {
  dayIndex: number;
  segmentIndex: number | null;
  city: string;
  value: string;
} | null;

type CorridorDropTarget = {
  laneIndex: number;
  dayIndex: number;
  laneKey: string;
};

type CorridorDndData =
  | { type: "run"; run: NonNullable<CorridorDragState> }
  | { type: "day"; day: NonNullable<CorridorDayDragState> }
  | { type: "resize"; resize: NonNullable<CorridorResizeState> }
  | { type: "cell"; target: CorridorDropTarget };

function CorridorTableOverview({
  days,
  lang,
  mapFocus,
  onUpdateDays,
  labels,
}: {
  days: TripDayModel[];
  lang: string;
  mapFocus: MapFocus;
  onUpdateDays: (
    updater: (days: TripDayModel[]) => TripDayModel[],
    debounceMs?: number,
  ) => void;
  labels: TripPlanningLabels;
}) {
  const [extraCities, setExtraCities] = useState<string[]>([]);
  const [addCityOpen, setAddCityOpen] = useState(false);
  const [selectedCityLocation, setSelectedCityLocation] = useState<LocationSelection | null>(null);
  const [deleteLane, setDeleteLane] = useState<CorridorOverviewLane | null>(null);
  const [dragState, setDragState] = useState<CorridorDragState>(null);
  const [dayDragState, setDayDragState] = useState<CorridorDayDragState>(null);
  const [resizeState, setResizeState] = useState<CorridorResizeState>(null);
  const [hoverState, setHoverState] = useState<CorridorHoverState>(null);
  const [pendingAction, setPendingAction] = useState<CorridorPendingAction | null>(null);
  const [flightSettings, setFlightSettings] = useState<CorridorFlightSettings>(null);
  const [noteEditor, setNoteEditor] = useState<CorridorNoteEditor>(null);
  const bodyUserSelectBeforeDragRef = useRef<string | null>(null);
  const dndSensors = useTimelineDndSensors();
  const plan = useMemo(
    () => withExtraCorridorLanes(buildCorridorOverviewPlan(days, labels), extraCities),
    [days, extraCities, labels],
  );
  const runs = useMemo(() => buildCorridorOverviewRuns(plan), [plan]);
  const dayColumnWidth = 118;
  const labelColumnWidth = 154;
  const headerHeight = 58;
  const laneHeight = 48;
  const transferGapRowHeight = 40;
  const addCityRowHeight = 52;
  const bodyRowCount = Math.max(0, plan.lanes.length * 2 - 1);
  const addCityGridRow = bodyRowCount + 2;
  const bodyRowSizes = plan.lanes.flatMap((_, index) =>
    index < plan.lanes.length - 1
      ? [`${laneHeight}px`, `${transferGapRowHeight}px`]
      : [`${laneHeight}px`],
  );
  const cityGridRow = (laneIndex: number) => laneIndex * 2 + 2;
  const transferGridRow = (transfer: CorridorOverviewTransfer) => {
    const fromRow = cityGridRow(transfer.fromLaneIndex);
    const toRow = cityGridRow(transfer.targetLaneIndex);
    if (Math.abs(transfer.targetLaneIndex - transfer.fromLaneIndex) === 1) {
      return Math.min(fromRow, toRow) + 1;
    }
    return `${Math.min(fromRow, toRow) + 1} / ${Math.max(fromRow, toRow)}`;
  };
  const warningGridRow = (warning: CorridorOverviewWarning) => {
    if (warning.kind === "mismatch") {
      return cityGridRow(warning.laneIndex);
    }
    const fromRow = cityGridRow(warning.fromLaneIndex);
    const toRow = cityGridRow(warning.toLaneIndex);
    if (Math.abs(warning.toLaneIndex - warning.fromLaneIndex) === 1) {
      return Math.min(fromRow, toRow) + 1;
    }
    return `${Math.min(fromRow, toRow) + 1} / ${Math.max(fromRow, toRow)}`;
  };
  const editorLabels = labels.overview_editor;

  function applyPendingAction(moveStops: boolean) {
    if (!pendingAction) return;
    onUpdateDays(
      () =>
        pendingAction.nextDaysWithStops && moveStops
          ? pendingAction.nextDaysWithStops
          : pendingAction.nextDays,
      250,
    );
    setPendingAction(null);
    setHoverState(null);
  }

  function requestEditCellNote(cell: CorridorOverviewCell) {
    const day = days[cell.dayIndex];
    if (!day) return;
    const segment = cell.segmentIndex == null ? null : day.segments[cell.segmentIndex];
    setNoteEditor({
      dayIndex: cell.dayIndex,
      segmentIndex: cell.segmentIndex,
      city: cell.city,
      value: segment?.note ?? day.note,
    });
  }

  function saveCellNote() {
    if (!noteEditor) return;
    onUpdateDays(
      (currentDays) =>
        currentDays.map((day, dayIndex) =>
          dayIndex === noteEditor.dayIndex
            ? noteEditor.segmentIndex == null
              ? { ...day, note: noteEditor.value }
              : {
                  ...day,
                  segments: day.segments.map((segment, segmentIndex) =>
                    segmentIndex === noteEditor.segmentIndex
                      ? { ...segment, note: noteEditor.value }
                      : segment,
                  ),
                }
            : day,
        ),
      250,
    );
    setNoteEditor(null);
  }

  function requestFlightSettings(transfer: CorridorOverviewTransfer) {
    const day = days[transfer.dayIndex];
    const existing = day?.stops.find((stop) => stop.id === corridorFlightStopId(day, transfer)) ?? null;
    const estimatedMinutes = estimateTransferMinutes(
      transfer.fromCity,
      transfer.toCity,
      transfer.mode,
    );
    setFlightSettings({
      transfer,
      departureTime: normalizeEditableTime(existing?.arrival_time) || "",
      durationMinutes: String(existing?.duration_min ?? estimatedMinutes ?? 120),
    });
  }

  function saveFlightSettings() {
    if (!flightSettings) return;
    const duration = Math.max(1, Math.round(Number(flightSettings.durationMinutes) || 0));
    const departureTime = normalizeEditableTime(flightSettings.departureTime) || null;
    const transfer = flightSettings.transfer;
    onUpdateDays(
      (currentDays) =>
        currentDays.map((day, dayIndex) => {
          if (dayIndex !== transfer.dayIndex) return day;
          const stop = corridorFlightStop(day, transfer, departureTime, duration);
          const stopIdValue = corridorFlightStopId(day, transfer);
          const nextStops = day.stops.some((item) => item.id === stopIdValue)
            ? day.stops.map((item) => (item.id === stopIdValue ? stop : item))
            : [...day.stops, stop];
          return { ...day, stops: nextStops };
        }),
      250,
    );
    setFlightSettings(null);
  }

  function requestDeleteDay(cell: CorridorOverviewCell) {
    const day = days[cell.dayIndex];
    if (!day) return;
    const nextDays = deleteCorridorDaySegment(days, cell, false);
    const nextDaysWithStops = deleteCorridorDaySegment(days, cell, true);
    setPendingAction({
      kind: "delete-day",
      city: cell.city,
      nextDays,
      nextDaysWithStops,
      secondaryActionLabel: editorLabels.delete_segment_fill,
      primaryActionLabel: editorLabels.delete_segment_gap,
      warning: editorLabels.gap_warning,
      affectedDays: 1,
      affectedStops: day.stops.length,
      transferBefore: countCorridorTransfers(days),
      transferAfter: countCorridorTransfers(nextDaysWithStops),
      conflictDays: 0,
    });
  }

  function requestDeleteBlock(run: CorridorOverviewRun) {
    if (plan.lanes.length <= 1) return;
    const nextDays = deleteCorridorRun(days, run);
    const affectedDays = run.endDayIndex - run.startDayIndex + 1;
    const affectedStops = days
      .slice(run.startDayIndex, run.endDayIndex + 1)
      .reduce((total, day) => total + day.stops.length, 0);
    setPendingAction({
      kind: "delete-block",
      city: plan.lanes[run.laneIndex]?.city ?? run.cells[0]?.city ?? "",
      nextDays,
      nextDaysWithStops: null,
      affectedDays,
      affectedStops,
      transferBefore: countCorridorTransfers(days),
      transferAfter: countCorridorTransfers(nextDays),
      conflictDays: 0,
    });
  }

  function requestResizeRun(resize: NonNullable<CorridorResizeState>, targetDayIndex: number) {
    const nextRange = corridorResizeRange(resize, targetDayIndex, days.length);
    if (
      nextRange.startDayIndex === resize.startDayIndex &&
      nextRange.endDayIndex === resize.endDayIndex
    ) {
      setResizeState(null);
      setHoverState(null);
      return;
    }
    const nextDays = resizeCorridorRun(days, resize, nextRange.startDayIndex, nextRange.endDayIndex);
    if (tripDaysEqual(days, nextDays)) {
      setResizeState(null);
      setHoverState(null);
      return;
    }
    const affectedDays = countResizeAffectedDays(resize, nextRange.startDayIndex, nextRange.endDayIndex);
    const conflictDays = countResizeConflictDays(days, resize, nextRange.startDayIndex, nextRange.endDayIndex);
    setPendingAction({
      kind: "resize",
      city: resize.city,
      nextDays,
      nextDaysWithStops: null,
      warning: conflictDays > 2 ? editorLabels.conflict_warning : null,
      affectedDays,
      affectedStops: countStopsForDayRange(days, nextRange.startDayIndex, nextRange.endDayIndex),
      transferBefore: countCorridorTransfers(days),
      transferAfter: countCorridorTransfers(nextDays),
      conflictDays,
    });
    setResizeState(null);
    setHoverState(null);
  }

  function requestAddCity() {
    const city = selectedCityLocation?.label.trim();
    if (!city) return;
    setExtraCities((current) =>
      current.some((item) => normalizePlaceToken(item) === normalizePlaceToken(city))
        ? current
        : [...current, city],
    );
    setSelectedCityLocation(null);
    setAddCityOpen(false);
  }

  function requestAddStay(lane: CorridorOverviewLane, dayIndex: number) {
    const currentDay = days[dayIndex];
    if (!currentDay) return;
    const nextDays = days.map((day, index) =>
      index === dayIndex ? addCorridorSegmentToDay(day, lane.city) : day,
    );
    const conflictDays = dayHasCorridorCity(currentDay, lane.key) ? 0 : 1;
    setPendingAction({
      kind: "add",
      city: lane.city,
      nextDays,
      nextDaysWithStops: null,
      affectedDays: 1,
      affectedStops: currentDay.stops.length,
      transferBefore: countCorridorTransfers(days),
      transferAfter: countCorridorTransfers(nextDays),
      conflictDays,
    });
  }

  function requestMoveRun(
    run: NonNullable<CorridorDragState>,
    targetLane: CorridorOverviewLane,
    targetDayIndex: number,
  ) {
    const targetStart = Math.max(
      0,
      Math.min(targetDayIndex, Math.max(0, days.length - run.length)),
    );
    const targetEnd = targetStart + run.length - 1;
    if (targetStart === run.startDayIndex && targetEnd === run.endDayIndex) {
      setDragState(null);
      setHoverState(null);
      return;
    }
    const { nextDays, nextDaysWithStops, affectedDays, affectedStops, conflictDays } =
      moveCorridorRun(days, run, targetLane.city, targetStart, targetEnd);
    if (tripDaysEqual(days, nextDays)) {
      setDragState(null);
      setHoverState(null);
      return;
    }
    setPendingAction({
      kind: "move",
      city: targetLane.city,
      nextDays,
      nextDaysWithStops,
      warning: conflictDays > 2 ? editorLabels.conflict_warning : null,
      affectedDays,
      affectedStops,
      transferBefore: countCorridorTransfers(days),
      transferAfter: countCorridorTransfers(nextDays),
      conflictDays,
    });
  }

  function requestMoveDay(
    dayDrag: NonNullable<CorridorDayDragState>,
    targetLane: CorridorOverviewLane,
    targetDayIndex: number,
  ) {
    if (
      dayDrag.dayIndex === targetDayIndex &&
      dayDrag.cityKey === targetLane.key
    ) {
      setDayDragState(null);
      setHoverState(null);
      return;
    }
    const { nextDays, nextDaysWithStops, affectedDays, affectedStops, conflictDays } =
      moveCorridorDay(days, dayDrag, targetLane.city, targetLane.key, targetDayIndex);
    if (tripDaysEqual(days, nextDays)) {
      setDayDragState(null);
      setHoverState(null);
      return;
    }
    setPendingAction({
      kind: "move",
      city: targetLane.city,
      nextDays,
      nextDaysWithStops,
      warning: conflictDays > 2 ? editorLabels.conflict_warning : null,
      affectedDays,
      affectedStops,
      transferBefore: countCorridorTransfers(days),
      transferAfter: countCorridorTransfers(nextDays),
      conflictDays,
    });
  }

  function requestDeleteCity(lane: CorridorOverviewLane) {
    if (plan.lanes.length <= 1) {
      setPendingAction({
        kind: "delete",
        city: lane.city,
        nextDays: days,
        nextDaysWithStops: null,
        affectedDays: 0,
        affectedStops: 0,
        transferBefore: countCorridorTransfers(days),
        transferAfter: countCorridorTransfers(days),
        conflictDays: 0,
      });
      return;
    }
    setDeleteLane(lane);
  }

  function confirmDeleteCity() {
    if (!deleteLane) return;
    if (countDaysForCity(days, deleteLane.city) === 0) {
      const deleteKey = deleteLane.key;
      setExtraCities((current) =>
        current.filter((city) => normalizePlaceToken(city) !== deleteKey),
      );
      setDeleteLane(null);
      return;
    }
    const nextDays = deleteCorridorCity(days, deleteLane.city);
    setPendingAction({
      kind: "delete",
      city: deleteLane.city,
      nextDays,
      nextDaysWithStops: null,
      affectedDays: countDaysForCity(days, deleteLane.city),
      affectedStops: countStopsForCityDays(days, deleteLane.city),
      transferBefore: countCorridorTransfers(days),
      transferAfter: countCorridorTransfers(nextDays),
      conflictDays: 0,
    });
    setDeleteLane(null);
  }

  function pendingActionDescription() {
    if (pendingAction && plan.lanes.length <= 1 && pendingAction.affectedDays === 0) {
      return editorLabels.cannot_delete_last_city;
    }
    if (pendingAction?.kind === "delete-day") {
      return editorLabels.delete_day_body;
    }
    if (pendingAction?.kind === "delete-block") {
      return editorLabels.delete_block_body;
    }
    return editorLabels.route_changed;
  }

  function lockDragTextSelection() {
    if (bodyUserSelectBeforeDragRef.current != null) return;
    bodyUserSelectBeforeDragRef.current = document.body.style.userSelect;
    document.body.style.userSelect = "none";
  }

  function unlockDragTextSelection() {
    if (bodyUserSelectBeforeDragRef.current == null) return;
    document.body.style.userSelect = bodyUserSelectBeforeDragRef.current;
    bodyUserSelectBeforeDragRef.current = null;
  }

  function previewDropTarget(
    target: CorridorDropTarget,
    activeDragState = dragState,
    activeResizeState = resizeState,
    activeDayDragState = dayDragState,
  ) {
    const lane = plan.lanes[target.laneIndex];
    if (!lane || lane.key !== target.laneKey) return;
    if (activeResizeState) {
      if (lane.key !== activeResizeState.cityKey) return;
      const nextRange = corridorResizeRange(activeResizeState, target.dayIndex, days.length);
      setHoverState({
        laneIndex: target.laneIndex,
        dayIndex: target.dayIndex,
        conflictDays: countResizeConflictDays(
          days,
          activeResizeState,
          nextRange.startDayIndex,
          nextRange.endDayIndex,
        ),
        mode: "resize",
      });
      return;
    }
    if (activeDayDragState) {
      setHoverState({
        laneIndex: target.laneIndex,
        dayIndex: target.dayIndex,
        conflictDays:
          target.dayIndex === activeDayDragState.dayIndex ||
          lane.key === activeDayDragState.cityKey
            ? 0
            : 1,
        mode: "day",
      });
      return;
    }
    if (activeDragState) {
      if (lane.key !== activeDragState.cityKey) return;
      setHoverState({
        laneIndex: target.laneIndex,
        dayIndex: target.dayIndex,
        conflictDays: countMoveConflictDays(days, activeDragState, target.dayIndex),
        mode: "move",
      });
      return;
    }
    const day = plan.days[target.dayIndex];
    const hasCell = Boolean(day?.cells.some((cell) => cell.cityKey === lane.key));
    if (hasCell) return;
    setHoverState({
      laneIndex: target.laneIndex,
      dayIndex: target.dayIndex,
      conflictDays: 0,
      mode: "add",
    });
  }

  function handleCorridorDragStart(event: DragStartEvent) {
    const data = event.active.data.current as CorridorDndData | undefined;
    if (!data) return;
    lockDragTextSelection();
    if (data.type === "run") {
      setDragState(data.run);
      setDayDragState(null);
      setResizeState(null);
      setHoverState(null);
      return;
    }
    if (data.type === "day") {
      setDayDragState(data.day);
      setDragState(null);
      setResizeState(null);
      setHoverState(null);
      return;
    }
    if (data.type === "resize") {
      setResizeState(data.resize);
      setDragState(null);
      setDayDragState(null);
      setHoverState(null);
    }
  }

  function handleCorridorDragOver(event: DragOverEvent) {
    const data = event.over?.data.current as CorridorDndData | undefined;
    if (data?.type !== "cell") return;
    previewDropTarget(data.target);
  }

  function handleCorridorDragEnd(event: DragEndEvent) {
    const activeData = event.active.data.current as CorridorDndData | undefined;
    const overData = event.over?.data.current as CorridorDndData | undefined;
    if (overData?.type === "cell") {
      if (activeData?.type === "resize" && overData.target.laneKey === activeData.resize.cityKey) {
        requestResizeRun(activeData.resize, overData.target.dayIndex);
      } else if (activeData?.type === "day") {
        requestMoveDay(activeData.day, plan.lanes[overData.target.laneIndex]!, overData.target.dayIndex);
      } else if (activeData?.type === "run" && overData.target.laneKey === activeData.run.cityKey) {
        requestMoveRun(activeData.run, plan.lanes[overData.target.laneIndex]!, overData.target.dayIndex);
      }
    }
    setDragState(null);
    setDayDragState(null);
    setResizeState(null);
    setHoverState(null);
    unlockDragTextSelection();
  }

  function handleCorridorDragCancel() {
    setDragState(null);
    setDayDragState(null);
    setResizeState(null);
    setHoverState(null);
    unlockDragTextSelection();
  }

  useEffect(() => () => unlockDragTextSelection(), []);

  if (plan.lanes.length === 0) {
    return (
      <div className="mt-2 h-full rounded-2xl border border-dashed border-divider-strong bg-white/70 p-5 text-center text-[13px] text-fg-muted">
        {labels.no_stops}
      </div>
    );
  }

  return (
    <>
    <div className="mt-2 h-[calc(100%-0.5rem)] overflow-hidden rounded-[18px] border border-divider bg-white shadow-[0_18px_50px_-42px_rgba(32,41,46,0.48)]">
      <div className="h-full overflow-auto">
        <DndContext
          id="trip-corridor-overview"
          sensors={dndSensors}
          collisionDetection={pointerWithin}
          onDragStart={handleCorridorDragStart}
          onDragOver={handleCorridorDragOver}
          onDragEnd={handleCorridorDragEnd}
          onDragCancel={handleCorridorDragCancel}
        >
        <div
          className="relative grid min-w-max select-none bg-white text-fg"
          style={{
            gridTemplateColumns: `${labelColumnWidth}px repeat(${plan.days.length}, ${dayColumnWidth}px)`,
            gridTemplateRows: `${headerHeight}px ${bodyRowSizes.join(" ")} ${addCityRowHeight}px`,
          }}
        >
          <div className="sticky left-0 top-0 z-40 flex items-center bg-white px-5 backdrop-blur">
            <p className="text-[13px] font-bold text-fg">
              {labels.overview_label}
            </p>
          </div>

          {plan.days.map((day) => (
            <div
              key={`header:${day.dayIndex}`}
              className="sticky top-0 z-30 flex flex-col items-center justify-center bg-white/94 px-2 text-center backdrop-blur"
              style={{ gridColumn: day.dayIndex + 2, gridRow: 1 }}
            >
              <span className="text-[11px] font-bold leading-4 text-fg-muted">
                {shortDate(day.date)}
              </span>
              <span className="text-[10px] font-black uppercase leading-3 text-fg">
                {formatTemplate(labels.day_label, { n: String(day.dayIndex + 1) })}
              </span>
            </div>
          ))}

          {plan.lanes.map((lane) => {
            const tone = routeTone(lane.laneIndex);
            return (
              <div
                key={`lane-label:${lane.key}`}
                className={cn(
                  "group sticky left-0 z-30 flex items-center bg-white/94 px-5 backdrop-blur",
                )}
                style={{ gridColumn: 1, gridRow: cityGridRow(lane.laneIndex) }}
              >
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  <span className={cn("h-2.5 w-2.5 shrink-0 rounded-full", tone.bg)} />
                  <span className="min-w-0 flex-1 truncate text-[13px] font-bold text-fg">
                    {lane.city}
                  </span>
                  <button
                    type="button"
                    className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-fg-muted opacity-0 transition hover:bg-fg/6 hover:text-fg group-hover:opacity-100"
                    aria-label={formatTemplate(editorLabels.delete_city_title, { city: lane.city })}
                    title={formatTemplate(editorLabels.delete_city_title, { city: lane.city })}
                    onClick={() => requestDeleteCity(lane)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            );
          })}

          {plan.lanes.slice(0, -1).map((lane) => (
            <div
              key={`transfer-label:${lane.key}`}
              className="sticky left-0 z-30 bg-white/94 backdrop-blur"
              style={{ gridColumn: 1, gridRow: cityGridRow(lane.laneIndex) + 1 }}
            />
          ))}

          <div
            className="sticky left-0 z-30 flex items-center bg-white/94 px-4 backdrop-blur"
            style={{ gridColumn: 1, gridRow: addCityGridRow }}
          >
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9 w-full justify-start rounded-xl bg-white"
              onClick={() => setAddCityOpen(true)}
            >
              <Plus className="mr-2 h-4 w-4" />
              {editorLabels.add_city}
            </Button>
          </div>

          {Array.from({ length: bodyRowCount }, (_, rowOffset) =>
            plan.days.map((day) => {
              const isCityRow = rowOffset % 2 === 0;
              const laneIndex = Math.floor(rowOffset / 2);
              const lane = plan.lanes[laneIndex] ?? null;
              const hasCell = Boolean(
                lane && day.cells.some((cell) => cell.cityKey === lane.key),
              );
              return (
                <CorridorDroppableCell
                  key={`grid:${rowOffset}:${day.dayIndex}`}
                  id={`corridor-cell:${rowOffset}:${day.dayIndex}`}
                  disabled={!isCityRow || !lane}
                  target={lane ? { laneIndex, dayIndex: day.dayIndex, laneKey: lane.key } : null}
                  className={cn(
                    "relative select-none bg-white text-left outline-none transition",
                    rowOffset % 2 === 1 && rowOffset < bodyRowCount - 1 && "bg-accent-soft/16",
                    isCityRow && lane && !hasCell && "hover:bg-accent-soft/26",
                  )}
                  style={{
                    gridColumn: day.dayIndex + 2,
                    gridRow: rowOffset + 2,
                  }}
                  onMouseEnter={() => {
                    if (!isCityRow || !lane || hasCell) return;
                    previewDropTarget({ laneIndex, dayIndex: day.dayIndex, laneKey: lane.key });
                  }}
                  onMouseLeave={() => {
                    if (!dragState && !dayDragState && !resizeState) setHoverState(null);
                  }}
                  onClick={() => {
                    if (!isCityRow || !lane || hasCell || dragState || dayDragState || resizeState) return;
                    requestAddStay(lane, day.dayIndex);
                  }}
                />
              );
            }),
          )}

          {Array.from({ length: plan.days.length }, (_, dayIndex) => (
            <div
              key={`add-city-row:${dayIndex}`}
              className="bg-white"
              style={{ gridColumn: dayIndex + 2, gridRow: addCityGridRow }}
            />
          ))}

          {runs.map((run) => {
            const runDragState: NonNullable<CorridorDragState> = {
              runKey: run.key,
              city: run.cells[0]?.city ?? plan.lanes[run.laneIndex]?.city ?? "",
              cityKey: run.cityKey,
              laneIndex: run.laneIndex,
              startDayIndex: run.startDayIndex,
              endDayIndex: run.endDayIndex,
              length: run.endDayIndex - run.startDayIndex + 1,
            };
            return (
              <CorridorDraggableRun
                key={run.key}
                id={`corridor-run:${run.key}`}
                dragState={runDragState}
                gripLabel={editorLabels.drag_block}
                className={cn(
                  "group/run relative z-10 m-1 grid cursor-default select-none overflow-hidden rounded-xl border border-white/72 shadow-[0_12px_28px_-24px_rgba(32,41,46,0.65)]",
                  routePastelSurface(run.laneIndex),
                )}
                style={{
                  gridColumn: `${run.startDayIndex + 2} / ${run.endDayIndex + 3}`,
                  gridRow: cityGridRow(run.laneIndex),
                  gridTemplateColumns: `repeat(${run.cells.length}, minmax(0, 1fr))`,
                }}
              >
                {run.cells.map((cell, index) => {
                  const active =
                    cell.routeIndex != null &&
                    mapFocus?.mode === "route" &&
                    mapFocus.index === cell.routeIndex;
                  const dayDrag: NonNullable<CorridorDayDragState> = {
                    cellKey: cell.key,
                    city: cell.city,
                    cityKey: cell.cityKey,
                    laneIndex: run.laneIndex,
                    dayIndex: cell.dayIndex,
                  };
                  return (
                    <ContextMenu key={cell.key}>
                      <ContextMenuTrigger asChild>
                        <div
                          role="button"
                          tabIndex={0}
                          onClick={() => requestEditCellNote(cell)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              requestEditCellNote(cell);
                            }
                          }}
                          className={cn(
                            "group/cell relative flex min-w-0 select-none flex-col items-center justify-center px-2 py-1.5 text-center transition",
                            index > 0 && "border-l border-white/64",
                            active
                              ? "bg-white/72 shadow-[inset_0_0_0_2px_rgba(15,184,180,0.2)]"
                              : "hover:bg-white/48",
                          )}
                        >
                          <p className="line-clamp-2 select-none text-[12px] font-black leading-4 text-fg">
                            {cell.summary[0] ?? formatTemplate(labels.stay_in, { city: cell.city })}
                          </p>
                          <CorridorDayDragHandle
                            id={`corridor-day:${cell.key}`}
                            dayDragState={dayDrag}
                            ariaLabel={editorLabels.drag_day}
                            className="absolute right-1 top-1 z-20 grid h-5 w-5 cursor-grab select-none place-items-center rounded-full bg-white/88 text-fg-muted opacity-0 shadow-sm transition hover:text-fg active:cursor-grabbing group-hover/cell:opacity-100"
                          />
                        </div>
                      </ContextMenuTrigger>
                      <ContextMenuContent className="w-44 rounded-xl bg-white">
                        <ContextMenuItem onSelect={() => requestEditCellNote(cell)}>
                          <PencilLine className="mr-2 h-3.5 w-3.5" />
                          {editorLabels.edit_note_title}
                        </ContextMenuItem>
                        <ContextMenuSeparator />
                        <ContextMenuItem
                          className="text-[#b93f59] focus:text-[#b93f59]"
                          onSelect={() => requestDeleteDay(cell)}
                        >
                          <Trash2 className="mr-2 h-3.5 w-3.5" />
                          {editorLabels.delete_day}
                        </ContextMenuItem>
                        <ContextMenuItem
                          className="text-[#b93f59] focus:text-[#b93f59]"
                          disabled={plan.lanes.length <= 1}
                          onSelect={() => requestDeleteBlock(run)}
                        >
                          <Trash2 className="mr-2 h-3.5 w-3.5" />
                          {editorLabels.delete_block}
                        </ContextMenuItem>
                      </ContextMenuContent>
                    </ContextMenu>
                  );
                })}
                <CorridorResizeHandle
                  id={`corridor-resize-start:${run.key}`}
                  resizeState={{
                    runKey: run.key,
                    city: runDragState.city,
                    cityKey: run.cityKey,
                    laneIndex: run.laneIndex,
                    startDayIndex: run.startDayIndex,
                    endDayIndex: run.endDayIndex,
                    side: "start",
                  }}
                  ariaLabel={editorLabels.resize_start}
                  className="absolute bottom-0 left-0 top-0 z-20 w-4 cursor-ew-resize select-none rounded-l-xl bg-transparent transition hover:bg-white/45"
                />
                <CorridorResizeHandle
                  id={`corridor-resize-end:${run.key}`}
                  resizeState={{
                    runKey: run.key,
                    city: runDragState.city,
                    cityKey: run.cityKey,
                    laneIndex: run.laneIndex,
                    startDayIndex: run.startDayIndex,
                    endDayIndex: run.endDayIndex,
                    side: "end",
                  }}
                  ariaLabel={editorLabels.resize_end}
                  className="absolute bottom-0 right-0 top-0 z-20 w-4 cursor-ew-resize select-none rounded-r-xl bg-transparent transition hover:bg-white/45"
                />
              </CorridorDraggableRun>
            );
          })}

          {hoverState ? (() => {
            const lane = plan.lanes[hoverState.laneIndex];
            if (!lane) return null;
            const resizeRange = resizeState && hoverState.mode === "resize"
              ? corridorResizeRange(resizeState, hoverState.dayIndex, days.length)
              : null;
            const startDayIndex = resizeRange?.startDayIndex ?? hoverState.dayIndex;
            const span = resizeRange
              ? resizeRange.endDayIndex - resizeRange.startDayIndex + 1
              : dragState
                ? Math.min(dragState.length, plan.days.length - hoverState.dayIndex)
                : 1;
            const conflict = hoverState.conflictDays > 2;
            return (
              <div
                className={cn(
                  "pointer-events-none z-30 m-1 flex items-center justify-center rounded-xl border border-dashed px-2 text-center text-[10px] font-black shadow-sm",
                  conflict
                    ? "border-[#d6526f]/55 bg-[#d6526f]/10 text-[#b93f59]"
                    : "border-accent/55 bg-accent-soft/50 text-accent",
                )}
                style={{
                  gridColumn: `${startDayIndex + 2} / span ${span}`,
                  gridRow: cityGridRow(hoverState.laneIndex),
                }}
              >
                {conflict
                  ? formatTemplate(editorLabels.conflict_overlap, {
                      days: String(hoverState.conflictDays),
                    })
                  : formatTemplate(editorLabels.add_stay, { city: lane.city })}
              </div>
            );
          })() : null}

          {plan.warnings.map((warning) => {
            const text = warning.kind === "overlap"
              ? formatTemplate(editorLabels.overlap_warning, {
                  days: String(warning.conflictDays),
                })
              : formatTemplate(editorLabels.segment_mismatch_warning, {
                  expected: warning.expectedCity,
                  actual: warning.actualCity,
                });
            const summary = warning.kind === "overlap"
              ? formatTemplate(editorLabels.warning_summary_overlap, {
                  days: String(warning.conflictDays),
                })
              : formatTemplate(editorLabels.warning_summary_mismatch, {
                  expected: warning.expectedCity,
                  actual: warning.actualCity,
                });
            const dateRange = warning.kind === "overlap"
              ? formatDateRange(
                  days[warning.startDayIndex]?.date ?? "",
                  days[warning.endDayIndex]?.date ?? "",
                )
              : `${formatTemplate(labels.day_label, {
                  n: String(warning.dayIndex + 1),
                })} · ${shortDate(days[warning.dayIndex]?.date ?? "")}`;
            return (
              <TooltipProvider key={warning.key} delayDuration={120}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      aria-label={`${editorLabels.warning_details}: ${text}`}
                      className="z-20 m-1 flex min-w-0 cursor-help items-center justify-center gap-1.5 rounded-xl border border-warning/35 bg-warning-soft px-2.5 text-center text-[11px] font-black leading-4 text-warning shadow-[0_12px_28px_-26px_rgba(155,93,0,0.65)] outline-none transition hover:border-warning/55 hover:bg-[rgba(217,153,78,0.18)] focus-visible:ring-2 focus-visible:ring-warning/35"
                      style={{
                        gridColumn: warning.kind === "overlap"
                          ? `${warning.startDayIndex + 2} / ${warning.endDayIndex + 3}`
                          : warning.dayIndex + 2,
                        gridRow: warningGridRow(warning),
                      }}
                    >
                      <CircleAlert className="h-3.5 w-3.5 shrink-0" />
                      <span className="min-w-0 truncate">
                        {summary}
                      </span>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent
                    side="top"
                    sideOffset={8}
                    className="max-w-[280px] rounded-xl bg-fg px-3.5 py-3 text-left text-[12px] leading-5 text-white shadow-[0_18px_48px_-24px_rgba(17,24,28,0.48)]"
                  >
                    <p className="font-black">
                      {editorLabels.warning_details}
                    </p>
                    <p className="mt-1 font-semibold text-white/92">
                      {text}
                    </p>
                    <p className="mt-2 text-[11px] font-semibold text-white/72">
                      {formatTemplate(editorLabels.warning_date_range, {
                        range: dateRange,
                      })}
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            );
          })}

          {plan.days.map((day) => (
            <Fragment key={`day-transfers:${day.dayIndex}`}>
              {day.transfers.map((transfer) => {
                const tone = routeTone(transfer.fromLaneIndex);
                const TransferIcon =
                  transfer.mode === "flight"
                    ? Plane
                    : transfer.mode === "drive"
                      ? CarFront
                      : TrainFront;
                const arrowUp = transfer.targetLaneIndex < transfer.fromLaneIndex;
                const isOvernight = transfer.overnight;
                const durationText = [
                  isOvernight ? editorLabels.overnight_transfer : null,
                  transfer.durationLabel,
                ].filter(Boolean).join(" · ");
                return (
                  <Fragment key={transfer.key}>
                    <div
                      className={cn(
                        "pointer-events-none relative z-20 mx-1 text-center",
                        isOvernight
                          ? "text-warning"
                          : transfer.extended
                            ? "text-[#8a5a15]"
                            : tone.text,
                      )}
                      style={{
                        gridColumn: isOvernight
                          ? `${transfer.dayIndex + 2} / ${Math.min(
                              plan.days.length + 2,
                              transfer.arrivalDayIndex + 3,
                            )}`
                          : `${transfer.dayIndex + 2} / span ${
                              transfer.extended
                                ? Math.min(2, plan.days.length - transfer.dayIndex)
                                : 1
                            }`,
                        gridRow: transferGridRow(transfer),
                      }}
                    >
                      <span
                        className={cn(
                          "absolute bottom-2 top-2 left-1/2 -translate-x-1/2 border-l border-dashed",
                          isOvernight
                            ? "border-warning/55"
                            : transfer.extended
                              ? "border-[#c97718]/45"
                              : "border-current/45",
                        )}
                      />
                      <ChevronRight
                        className={cn(
                          "absolute left-1/2 h-4 w-4 -translate-x-1/2",
                          arrowUp ? "top-0 -rotate-90" : "bottom-0 rotate-90",
                          isOvernight
                            ? "text-warning"
                            : transfer.extended
                              ? "text-[#c97718]"
                              : tone.text,
                        )}
                      />
                      <button
                        type="button"
                        className={cn(
                          "pointer-events-auto absolute left-1/2 top-1/2 flex h-6 -translate-x-1/2 -translate-y-1/2 items-center gap-1 rounded-full border border-current/20 bg-white shadow-sm transition hover:scale-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/35",
                          durationText ? "w-auto px-2" : "w-6 justify-center",
                          isOvernight
                            ? "hover:bg-warning-soft focus-visible:ring-warning/35"
                            : "hover:bg-accent-soft",
                        )}
                        aria-label={editorLabels.flight_details_title}
                        title={editorLabels.flight_details_title}
                        onClick={() => requestFlightSettings(transfer)}
                      >
                        <TransferIcon className="h-3 w-3 shrink-0" />
                        {durationText ? (
                          <span className="whitespace-nowrap text-[10px] font-black leading-3">
                            {durationText}
                          </span>
                        ) : null}
                      </button>
                    </div>
                  </Fragment>
                );
              })}
            </Fragment>
          ))}

        </div>
        </DndContext>
      </div>
    </div>
    <Dialog
      open={addCityOpen}
      onOpenChange={(open) => {
        setAddCityOpen(open);
        if (!open) {
          setSelectedCityLocation(null);
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editorLabels.add_city_title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-2 text-[13px] font-semibold text-fg">
          <span>{editorLabels.city_name_label}</span>
          <LocationSelector
            lang={lang}
            value={selectedCityLocation}
            labels={labels.location_selector}
            allowedKinds={["city"]}
            onChange={setSelectedCityLocation}
          />
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">
              {editorLabels.cancel}
            </Button>
          </DialogClose>
          <Button type="button" onClick={requestAddCity} disabled={!selectedCityLocation}>
            {editorLabels.add}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <Dialog open={Boolean(deleteLane)} onOpenChange={(open) => !open && setDeleteLane(null)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {deleteLane
              ? formatTemplate(editorLabels.delete_city_title, { city: deleteLane.city })
              : editorLabels.delete_city}
          </DialogTitle>
          <DialogDescription>
            {deleteLane
              ? formatTemplate(editorLabels.delete_city_body, {
                  days: String(countDaysForCity(days, deleteLane.city)),
                  stops: String(countStopsForCityDays(days, deleteLane.city)),
                })
              : ""}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">
              {editorLabels.cancel}
            </Button>
          </DialogClose>
          <Button type="button" variant="destructive" onClick={confirmDeleteCity}>
            {editorLabels.delete_city}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <Dialog open={Boolean(pendingAction)} onOpenChange={(open) => !open && setPendingAction(null)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editorLabels.review_title}</DialogTitle>
          <DialogDescription>
            {pendingActionDescription()}
          </DialogDescription>
        </DialogHeader>
        {pendingAction ? (
          <div className="space-y-2 text-[13px] text-fg-secondary">
            {pendingAction.conflictDays > 2 ? (
              <p className="rounded-xl bg-[#d6526f]/10 px-3 py-2 font-semibold text-[#b93f59]">
                {formatTemplate(editorLabels.conflict_overlap, {
                  days: String(pendingAction.conflictDays),
                })}
              </p>
            ) : null}
            {pendingAction.warning ? (
              <p className="rounded-xl bg-[#d6526f]/10 px-3 py-2 font-semibold text-[#b93f59]">
                {pendingAction.warning}
              </p>
            ) : null}
            <p>{formatTemplate(editorLabels.affected_days, { days: String(pendingAction.affectedDays) })}</p>
            <p>{formatTemplate(editorLabels.affected_stops, { stops: String(pendingAction.affectedStops) })}</p>
            <p>
              {formatTemplate(editorLabels.transfer_delta, {
                before: String(pendingAction.transferBefore),
                after: String(pendingAction.transferAfter),
              })}
            </p>
          </div>
        ) : null}
        <DialogFooter className="gap-2 sm:justify-between">
          <DialogClose asChild>
            <Button type="button" variant="outline">
              {editorLabels.cancel}
            </Button>
          </DialogClose>
          {pendingAction?.nextDaysWithStops ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => applyPendingAction(true)}
            >
              {pendingAction.secondaryActionLabel ?? editorLabels.move_stops}
            </Button>
          ) : null}
          <Button
            type="button"
            onClick={() => applyPendingAction(false)}
            disabled={!pendingAction || (plan.lanes.length <= 1 && pendingAction.affectedDays === 0)}
          >
            {pendingAction?.primaryActionLabel ??
              (pendingAction?.nextDaysWithStops
                ? editorLabels.keep_stops
                : editorLabels.apply_change)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <Dialog open={Boolean(noteEditor)} onOpenChange={(open) => !open && setNoteEditor(null)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editorLabels.edit_note_title}</DialogTitle>
          <DialogDescription>
            {noteEditor
              ? formatTemplate(editorLabels.edit_note_body, {
                  city: noteEditor.city,
                  day: formatTemplate(labels.day_label, {
                    n: String(noteEditor.dayIndex + 1),
                  }),
                })
              : ""}
          </DialogDescription>
        </DialogHeader>
        <label className="space-y-2 text-[13px] font-semibold text-fg">
          <span>{editorLabels.note_label}</span>
          <Textarea
            value={noteEditor?.value ?? ""}
            onChange={(event) =>
              setNoteEditor((current) =>
                current ? { ...current, value: event.target.value } : current,
              )
            }
            placeholder={editorLabels.note_placeholder}
            className="min-h-28 resize-none rounded-xl bg-white"
          />
        </label>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">
              {editorLabels.cancel}
            </Button>
          </DialogClose>
          <Button type="button" onClick={saveCellNote} disabled={!noteEditor}>
            {editorLabels.save_note}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <Dialog open={Boolean(flightSettings)} onOpenChange={(open) => !open && setFlightSettings(null)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editorLabels.flight_details_title}</DialogTitle>
          <DialogDescription>
            {flightSettings
              ? formatTemplate(editorLabels.flight_details_body, {
                  from: flightSettings.transfer.fromCity,
                  to: flightSettings.transfer.toCity,
                })
              : ""}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-2 text-[13px] font-semibold text-fg">
            <span>{editorLabels.departure_time_label}</span>
            <Input
              value={flightSettings?.departureTime ?? ""}
              onChange={(event) =>
                setFlightSettings((current) =>
                  current ? { ...current, departureTime: event.target.value } : current,
                )
              }
              placeholder={editorLabels.departure_time_placeholder}
              inputMode="numeric"
            />
          </label>
          <label className="space-y-2 text-[13px] font-semibold text-fg">
            <span>{editorLabels.duration_minutes_label}</span>
            <Input
              value={flightSettings?.durationMinutes ?? ""}
              onChange={(event) =>
                setFlightSettings((current) =>
                  current ? { ...current, durationMinutes: event.target.value } : current,
                )
              }
              inputMode="numeric"
            />
          </label>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">
              {editorLabels.cancel}
            </Button>
          </DialogClose>
          <Button type="button" onClick={saveFlightSettings} disabled={!flightSettings}>
            {editorLabels.save_flight}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}

/* eslint-disable react-hooks/refs --
 * dnd-kit exposes node refs, listener maps, and drag state through hooks.
 * These values are meant to be applied during render, matching the sortable
 * timeline pattern elsewhere in this file. */
function CorridorDroppableCell({
  id,
  target,
  disabled,
  className,
  style,
  onMouseEnter,
  onMouseLeave,
  onClick,
}: {
  id: string;
  target: CorridorDropTarget | null;
  disabled: boolean;
  className: string;
  style: CSSProperties;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onClick: () => void;
}) {
  const droppable = useDroppable({
    id,
    disabled: disabled || !target,
    data: target ? ({ type: "cell", target } satisfies CorridorDndData) : undefined,
  });

  return (
    <button
      ref={droppable.setNodeRef}
      type="button"
      disabled={disabled}
      className={cn(className, droppable.isOver && "bg-accent-soft/36")}
      style={style}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onClick={onClick}
    />
  );
}

function CorridorDraggableRun({
  id,
  dragState,
  gripLabel,
  className,
  style,
  children,
}: {
  id: string;
  dragState: NonNullable<CorridorDragState>;
  gripLabel: string;
  className: string;
  style: CSSProperties;
  children: ReactNode;
}) {
  const draggable = useDraggable({
    id,
    data: { type: "run", run: dragState } satisfies CorridorDndData,
  });
  const transform = draggable.transform
    ? `translate3d(${Math.round(draggable.transform.x)}px, ${Math.round(draggable.transform.y)}px, 0)`
    : undefined;

  return (
    <div
      ref={draggable.setNodeRef}
      className={cn(className, draggable.isDragging && "opacity-75 shadow-xl")}
      style={{
        ...style,
        transform,
        zIndex: draggable.isDragging ? 120 : style.zIndex,
      }}
    >
      <button
        ref={draggable.setActivatorNodeRef}
        type="button"
        aria-label={gripLabel}
        className="absolute left-4 top-1/2 z-30 grid h-7 w-7 -translate-y-1/2 cursor-grab select-none place-items-center rounded-full bg-white/90 text-fg-muted opacity-0 shadow-sm transition hover:text-fg active:cursor-grabbing group-hover/run:opacity-100"
        onClick={(event) => event.stopPropagation()}
        onPointerDownCapture={(event) => event.stopPropagation()}
        {...draggable.attributes}
        {...draggable.listeners}
      >
        <GripVertical className="h-4 w-4" />
      </button>
      {children}
    </div>
  );
}

function CorridorDayDragHandle({
  id,
  dayDragState,
  ariaLabel,
  className,
}: {
  id: string;
  dayDragState: NonNullable<CorridorDayDragState>;
  ariaLabel: string;
  className: string;
}) {
  const draggable = useDraggable({
    id,
    data: { type: "day", day: dayDragState } satisfies CorridorDndData,
  });

  return (
    <div
      ref={draggable.setNodeRef}
      aria-label={ariaLabel}
      className={cn("select-none", className, draggable.isDragging && "opacity-100 shadow-md")}
      onClick={(event) => event.stopPropagation()}
      onPointerDownCapture={(event) => event.stopPropagation()}
      {...draggable.attributes}
      {...draggable.listeners}
    >
      <GripVertical className="h-3.5 w-3.5" />
    </div>
  );
}

function CorridorResizeHandle({
  id,
  resizeState,
  ariaLabel,
  className,
}: {
  id: string;
  resizeState: NonNullable<CorridorResizeState>;
  ariaLabel: string;
  className: string;
}) {
  const draggable = useDraggable({
    id,
    data: { type: "resize", resize: resizeState } satisfies CorridorDndData,
  });

  return (
    <button
      ref={draggable.setNodeRef}
      type="button"
      aria-label={ariaLabel}
      className={cn("select-none", className, draggable.isDragging && "bg-white/65")}
      style={{ cursor: "ew-resize" }}
      onClick={(event) => event.stopPropagation()}
      onPointerDownCapture={(event) => event.stopPropagation()}
      {...draggable.attributes}
      {...draggable.listeners}
    />
  );
}
/* eslint-enable react-hooks/refs */

function RouteDiagramOverview({
  diagram,
  days,
  mapFocus,
  onMapFocusChange,
  labels,
}: {
  diagram: RouteDiagramPlan;
  days: TripDayModel[];
  mapFocus: MapFocus;
  onMapFocusChange: (focus: MapFocus) => void;
  labels: TripPlanningLabels;
}) {
  const { nodes, edges } = useMemo(
    () => routeDiagramToFlow(diagram, days, labels, mapFocus),
    [days, diagram, labels, mapFocus],
  );

  return (
    <div className="mt-2 h-[calc(100%-0.5rem)] overflow-hidden rounded-[20px] border border-white/70 bg-[radial-gradient(circle_at_20%_15%,rgba(15,184,180,0.12),transparent_24%),linear-gradient(180deg,rgba(255,255,255,0.86),rgba(255,255,255,0.66))] p-2 shadow-[0_18px_50px_-40px_rgba(32,41,46,0.45)]">
      <ReactFlow<RouteFlowNode, RouteFlowEdge>
        nodes={nodes}
        edges={edges}
        nodeTypes={ROUTE_FLOW_NODE_TYPES}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        defaultViewport={{ x: 78, y: 52, zoom: 0.72 }}
        minZoom={0.45}
        maxZoom={1.35}
        panOnDrag
        panOnScroll
        zoomOnScroll
        zoomOnPinch
        preventScrolling={false}
        proOptions={{ hideAttribution: true }}
        onNodeClick={(_, node) => {
          if (node.type !== "routeCity" || node.data.routeIndex == null) return;
          onMapFocusChange({
            mode: "route",
            index: node.data.routeIndex,
            source: "manual",
          });
        }}
        className="rounded-[18px]"
      />
    </div>
  );
}

const ROUTE_FLOW_NODE_TYPES = {
  routeLane: RouteFlowLaneNode,
  routeCity: RouteFlowCityNode,
};

function RouteFlowLaneNode({ data }: NodeProps<RouteFlowLaneNode>) {
  return (
    <div
      className={cn(
        "pointer-events-none h-full w-full rounded-[30px] border bg-white/45 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)]",
        data.borderClassName,
      )}
    >
      <div
        className={cn(
          "absolute left-4 top-3 inline-flex items-center gap-2 rounded-full bg-white/85 px-3 py-1 text-[11px] font-semibold shadow-sm",
          data.textClassName,
        )}
      >
        <span className={cn("h-2 w-2 rounded-full", data.colorClassName)} />
        {data.city}
      </div>
    </div>
  );
}

function RouteFlowCityNode({ data }: NodeProps<RouteFlowCityNode>) {
  const visibleDayLabels = data.dayLabels.slice(0, 4);
  const hiddenDayCount = data.dayLabels.length - visibleDayLabels.length;

  return (
    <div
      className={cn(
        "relative w-[184px] rounded-[22px] border border-white bg-white/95 p-3 text-center shadow-[0_22px_54px_-34px_rgba(32,41,46,0.55)]",
        data.active && `${data.borderClassName} ${data.ringClassName}`,
      )}
    >
      <Handle
        type="target"
        position={Position.Left}
        isConnectable={false}
        className="!h-2 !w-2 !border-0 !bg-transparent"
      />
      <Handle
        type="source"
        position={Position.Right}
        isConnectable={false}
        className="!h-2 !w-2 !border-0 !bg-transparent"
      />
      <div className="flex flex-col items-center">
        <span
          className={cn(
            "grid h-14 w-14 place-items-center rounded-full border-4 border-white text-white shadow-[0_18px_40px_-26px_rgba(32,41,46,0.85)]",
            data.colorClassName,
          )}
        >
          <MapPin className="h-6 w-6" />
        </span>
        <p className="mt-2 max-w-full truncate text-[15px] font-semibold text-fg">
          {data.city}
        </p>
        <div className="mt-3 flex max-w-full flex-wrap justify-center gap-1.5">
          {visibleDayLabels.map((day) => (
            <span
              key={`${day.label}:${day.date}`}
              className={cn(
                "inline-flex items-center gap-1 rounded-full border bg-white px-2 py-1 text-[11px] font-semibold shadow-sm",
                data.borderClassName,
                data.textClassName,
              )}
            >
              {day.label}
              <span className="text-fg-muted">{day.date}</span>
            </span>
          ))}
          {hiddenDayCount > 0 ? (
            <span
              className={cn(
                "rounded-full border bg-white px-2 py-1 text-[11px] font-semibold shadow-sm",
                data.borderClassName,
                data.textClassName,
              )}
            >
              +{hiddenDayCount}
            </span>
          ) : null}
          {data.dayLabels.length === 0 ? (
            <span className="rounded-full border border-divider bg-white px-2 py-1 text-[11px] font-semibold text-fg-muted shadow-sm">
              {data.emptyLabel}
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function routeDiagramToFlow(
  diagram: RouteDiagramPlan,
  days: TripDayModel[],
  labels: TripPlanningLabels,
  mapFocus: MapFocus,
): { nodes: RouteFlowNode[]; edges: RouteFlowEdge[] } {
  const laneIndexesByCity = new Map<string, number>();
  const laneCities: string[] = [];
  diagram.nodes.forEach((node) => {
    const cityKey = normalizePlaceToken(node.city);
    if (laneIndexesByCity.has(cityKey)) return;
    laneIndexesByCity.set(cityKey, laneIndexesByCity.size);
    laneCities.push(node.city);
  });

  const diagramWidth =
    Math.max(1, diagram.nodes.length - 1) * ROUTE_FLOW_X_GAP + 430;

  const laneNodes: RouteFlowLaneNode[] = laneCities.map((city, laneIndex) => {
    const tone = routeTone(laneIndex);
    return {
      id: routeDiagramLaneId(laneIndex),
      type: "routeLane",
      position: {
        x: -108,
        y: routeDiagramLaneY(laneIndex) - 18,
      },
      draggable: false,
      selectable: false,
      focusable: false,
      zIndex: -2,
      style: {
        width: diagramWidth,
        height: 116,
      },
      data: {
        city,
        colorClassName: tone.bg,
        textClassName: tone.text,
        borderClassName: tone.borderMuted,
      },
    };
  });

  const cityNodes: RouteFlowCityNode[] = diagram.nodes.map((node, index) => {
    const laneIndex =
      laneIndexesByCity.get(normalizePlaceToken(node.city)) ?? index;
    const tone = routeTone(laneIndex);
    return {
      id: routeDiagramNodeId(index),
      type: "routeCity",
      position: {
        x: index * ROUTE_FLOW_X_GAP,
        y: routeDiagramLaneY(laneIndex),
      },
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
      draggable: false,
      selectable: false,
      style: { width: 184 },
      data: {
        city: node.city,
        dayLabels: node.dayIndexes.map((dayIndex) => ({
          label: formatTemplate(labels.day_label, { n: String(dayIndex + 1) }),
          date: shortDate(days[dayIndex]?.date ?? ""),
        })),
        colorClassName: tone.bg,
        textClassName: tone.text,
        borderClassName: tone.borderMuted,
        ringClassName: tone.ring,
        active:
          node.routeIndex != null &&
          mapFocus?.mode === "route" &&
          mapFocus.index === node.routeIndex,
        routeIndex: node.routeIndex,
        emptyLabel: labels.map_travel.flight,
      },
    };
  });

  const edges: RouteFlowEdge[] = diagram.transfers.map((transfer) => {
    const sourceNode = diagram.nodes[transfer.fromNodeIndex];
    const sourceLaneIndex = sourceNode
      ? laneIndexesByCity.get(normalizePlaceToken(sourceNode.city))
      : null;
    const stroke = transfer.extendedTransfer
      ? "#c97718"
      : routeStrokeColor(sourceLaneIndex ?? transfer.fromNodeIndex);
    return {
      id: `route-transfer:${transfer.fromNodeIndex}:${transfer.toNodeIndex}:${transfer.dayIndex}`,
      source: routeDiagramNodeId(transfer.fromNodeIndex),
      target: routeDiagramNodeId(transfer.toNodeIndex),
      type: "smoothstep",
      animated: transfer.extendedTransfer,
      selectable: false,
      data: { extendedTransfer: transfer.extendedTransfer },
      label: (
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-full border bg-white px-2.5 py-1 text-[11px] font-semibold shadow-sm",
            transfer.extendedTransfer
              ? "border-[#f39b2f]/45 text-[#8a5a15]"
              : "border-accent/25 text-accent",
          )}
        >
          <Plane className="h-3.5 w-3.5" />
          {transfer.extendedTransfer
            ? labels.lodging_stops.overnight_badge
            : labels.map_travel.flight}
          <span className="text-fg-muted">
            {formatTemplate(labels.day_label, { n: String(transfer.dayIndex + 1) })}
          </span>
        </span>
      ),
      labelShowBg: false,
      style: {
        stroke,
        strokeWidth: transfer.extendedTransfer ? 3 : 2.5,
        strokeDasharray: transfer.extendedTransfer ? "7 6" : undefined,
      },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: stroke,
        width: 18,
        height: 18,
      },
    };
  });

  return { nodes: [...laneNodes, ...cityNodes], edges };
}

const ROUTE_FLOW_X_GAP = 292;
const ROUTE_FLOW_LANE_GAP = 120;
const ROUTE_FLOW_Y_OFFSET = 44;

function routeDiagramNodeId(index: number): string {
  return `route-city:${index}`;
}

function routeDiagramLaneId(index: number): string {
  return `route-lane:${index}`;
}

function routeDiagramLaneY(index: number): number {
  return ROUTE_FLOW_Y_OFFSET + index * ROUTE_FLOW_LANE_GAP;
}

function OverviewSortableTimeline({
  segments,
  initialIds,
  mapFocus,
  onMapFocusChange,
  labels,
}: {
  segments: RoutePoint[];
  initialIds: string[];
  mapFocus: MapFocus;
  onMapFocusChange: (focus: MapFocus) => void;
  labels: TripPlanningLabels;
}) {
  const [orderedIds, setOrderedIds] = useState(initialIds);
  const sensors = useTimelineDndSensors();
  const segmentById = useMemo(
    () =>
      new Map(
        segments.map((segment, index) => [
          routeSegmentId(segment, index),
          { segment, routeIndex: index },
        ]),
      ),
    [segments],
  );
  const orderedSegments = orderedIds
    .map((id) => ({ id, ...segmentById.get(id) }))
    .filter(
      (item): item is { id: string; segment: RoutePoint; routeIndex: number } =>
        item.segment != null && item.routeIndex != null,
    );

  return (
    <div className="mt-2 h-[calc(100%-0.5rem)] overflow-y-auto rounded-[20px] border border-white/70 bg-white/70 p-2.5 shadow-[0_18px_50px_-40px_rgba(32,41,46,0.45)] sm:p-3">
      <DndContext
        id="trip-route-overview"
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={(event) => {
          const { active, over } = event;
          if (!over || active.id === over.id) return;
          setOrderedIds((current) => {
            const oldIndex = current.indexOf(String(active.id));
            const newIndex = current.indexOf(String(over.id));
            if (oldIndex < 0 || newIndex < 0) return current;
            return arrayMove(current, oldIndex, newIndex);
          });
        }}
      >
        <SortableContext
          items={orderedIds}
          strategy={verticalListSortingStrategy}
        >
          {orderedSegments.map(({ id, segment, routeIndex }, visualIndex) => {
        const previous = segments[routeIndex - 1];
        const isTransfer = previous && previous.city !== segment.city;
        return (
          <SortableTimelineRow
            key={id}
            id={id}
            active={mapFocus?.mode === "route" && mapFocus.index === routeIndex}
            gridClassName="grid-cols-[64px_34px_minmax(0,1fr)] gap-2 sm:grid-cols-[74px_38px_minmax(0,1fr)] sm:gap-3"
            onActivate={() =>
              onMapFocusChange({ mode: "route", index: routeIndex, source: "manual" })
            }
          >
            <div className="pt-3 text-[13px] font-semibold text-fg-secondary transition-colors group-data-[active=true]:text-fg">
              {segment.dateLabel}
            </div>
            <div className="relative flex justify-center">
              <div className="absolute bottom-0 top-0 w-px bg-divider" />
              <span className={cn(
                "relative mt-3 grid h-7 w-7 place-items-center rounded-full text-white transition-shadow group-data-[active=true]:shadow-[0_0_0_5px_rgba(15,184,180,0.16),0_8px_18px_rgba(15,184,180,0.22)]",
                routeColor(visualIndex),
              )}>
                {isTransfer ? <Plane className="h-4 w-4" /> : routeIndex + 1}
              </span>
            </div>
            <article className="mb-2 rounded-2xl border border-divider bg-white p-3 shadow-sm transition group-hover:border-accent/35 group-hover:shadow-md group-data-[active=true]:border-accent/45 group-data-[active=true]:bg-[linear-gradient(135deg,rgba(255,255,255,0.98),rgba(236,252,251,0.72))] group-data-[active=true]:shadow-[0_18px_42px_-32px_rgba(15,184,180,0.7)]">
              <p className="text-[15px] font-semibold text-fg">
                {formatTemplate(isTransfer ? labels.fly_to : labels.stay_in, {
                  city: segment.city,
                })}
              </p>
              <p className="mt-0.5 text-[12px] leading-5 text-fg-muted">
                {segment.days
                  .map((dayIndex) =>
                    formatTemplate(labels.day_label, { n: String(dayIndex + 1) }),
                  )
                  .join(" · ")}
              </p>
            </article>
          </SortableTimelineRow>
        );
      })}
        </SortableContext>
      </DndContext>
    </div>
  );
}

function Timeline({
  days,
  companions,
  bookingAdults,
  homePlace,
  day,
  dayIndex,
  mapFocus,
  activeStopLandmarkLabel,
  onMapFocusChange,
  onReorderDayStops,
  onUpdateStopTime,
  onUpdateStopAttachments,
  onAutoArrangeDayStops,
  onOpenLodgingSettings,
  onRequestHomeSettings,
  onUpdateLodgingAssignment,
  journeyStarted,
  labels,
}: {
  days: TripDayModel[];
  companions: ApiCompanion[];
  bookingAdults: number;
  homePlace: UserHomePlace | null;
  day: TripDayModel;
  dayIndex: number;
  mapFocus: MapFocus;
  activeStopLandmarkLabel: ActiveStopLandmarkLabel;
  onMapFocusChange: (focus: MapFocus) => void;
  onReorderDayStops: (dayIndex: number, stops: TripDayModel["stops"]) => Promise<void>;
  onUpdateStopTime: (
    dayIndex: number,
    stopIndex: number,
    arrivalTime: string | null,
  ) => Promise<void>;
  onUpdateStopAttachments: (
    dayIndex: number,
    stopIndex: number,
    attachments: TripStopAttachment[],
  ) => Promise<void>;
  onAutoArrangeDayStops: (
    dayIndex: number,
    stops: TripDayModel["stops"],
  ) => Promise<void>;
  onOpenLodgingSettings: (
    dayIndex: number,
    position: DayLodgingAnchor["position"],
  ) => void;
  onRequestHomeSettings: () => void;
  onUpdateLodgingAssignment: (
    dayIndex: number,
    position: DayLodgingAnchor["position"],
    companionIds: string[],
  ) => void;
  journeyStarted: boolean;
  labels: TripPlanningLabels;
}) {
  const initialIds = useMemo(
    () =>
      day.stops.flatMap((stop, index) =>
        isTimelineHiddenStop(stop) ? [] : [stopId(stop, index)],
      ),
    [day.stops],
  );

  return (
    <SortableStopTimeline
      key={`${day.date}:${initialIds.join("|")}`}
      days={days}
      companions={companions}
      bookingAdults={bookingAdults}
      homePlace={homePlace}
      day={day}
      dayIndex={dayIndex}
      initialIds={initialIds}
      mapFocus={mapFocus}
      activeStopLandmarkLabel={activeStopLandmarkLabel}
      onMapFocusChange={onMapFocusChange}
      onReorderDayStops={onReorderDayStops}
      onUpdateStopTime={onUpdateStopTime}
      onUpdateStopAttachments={onUpdateStopAttachments}
      onAutoArrangeDayStops={onAutoArrangeDayStops}
      onOpenLodgingSettings={onOpenLodgingSettings}
      onRequestHomeSettings={onRequestHomeSettings}
      onUpdateLodgingAssignment={onUpdateLodgingAssignment}
      journeyStarted={journeyStarted}
      labels={labels}
    />
  );
}

function SortableStopTimeline({
  days,
  companions,
  bookingAdults,
  homePlace,
  day,
  dayIndex,
  initialIds,
  mapFocus,
  activeStopLandmarkLabel,
  onMapFocusChange,
  onReorderDayStops,
  onUpdateStopTime,
  onUpdateStopAttachments,
  onAutoArrangeDayStops,
  onOpenLodgingSettings,
  onRequestHomeSettings,
  onUpdateLodgingAssignment,
  journeyStarted,
  labels,
}: {
  days: TripDayModel[];
  companions: ApiCompanion[];
  bookingAdults: number;
  homePlace: UserHomePlace | null;
  day: TripDayModel;
  dayIndex: number;
  initialIds: string[];
  mapFocus: MapFocus;
  activeStopLandmarkLabel: ActiveStopLandmarkLabel;
  onMapFocusChange: (focus: MapFocus) => void;
  onReorderDayStops: (dayIndex: number, stops: TripDayModel["stops"]) => Promise<void>;
  onUpdateStopTime: (
    dayIndex: number,
    stopIndex: number,
    arrivalTime: string | null,
  ) => Promise<void>;
  onUpdateStopAttachments: (
    dayIndex: number,
    stopIndex: number,
    attachments: TripStopAttachment[],
  ) => Promise<void>;
  onAutoArrangeDayStops: (
    dayIndex: number,
    stops: TripDayModel["stops"],
  ) => Promise<void>;
  onOpenLodgingSettings: (
    dayIndex: number,
    position: DayLodgingAnchor["position"],
  ) => void;
  onRequestHomeSettings: () => void;
  onUpdateLodgingAssignment: (
    dayIndex: number,
    position: DayLodgingAnchor["position"],
    companionIds: string[],
  ) => void;
  journeyStarted: boolean;
  labels: TripPlanningLabels;
}) {
  const [orderedIds, setOrderedIds] = useState(initialIds);
  const [busy, setBusy] = useState(false);
  const [autoArrangeStatus, setAutoArrangeStatus] = useState<
    "idle" | "saved" | "no_change" | "hours_blocked" | "error"
  >("idle");
  const [travelSegments, setTravelSegments] = useState<TravelSegment[]>([]);
  const sensors = useTimelineDndSensors();
  const stopById = useMemo(
    () =>
      new Map(
        day.stops.map((stop, index) => [
          stopId(stop, index),
          { stop, originalIndex: index },
        ]),
      ),
    [day.stops],
  );
  const travelStops = useMemo<TripMapTravelStop[]>(
    () =>
      orderedIds.flatMap((id) => {
        const entry = stopById.get(id);
        if (!entry) return [];
        const location = representativeStopLocation(entry.stop);
        if (!location) return [];
        const nextStop = orderedIds
          .slice(orderedIds.indexOf(id) + 1)
          .map((nextId) => stopById.get(nextId)?.stop)
          .find((stop): stop is TripDayModel["stops"][number] => stop != null);
        const hasAirportTransferMovement = nextStop
          ? airportTransferAttachmentForMovement(entry.stop, nextStop) != null
          : false;
        return [{
          name: mappableStopName(entry.stop),
          lat: location.lat,
          lng: location.lng,
          kind: entry.stop.kind,
          sourceIndex: entry.originalIndex,
          travelModeToNext: hasAirportTransferMovement
            ? AIRPORT_TRANSFER_TRAVEL_MODE
            : undefined,
          travelLabelToNext: hasAirportTransferMovement
            ? labels.kind.airport_transfer
            : undefined,
        }];
      }),
    [labels.kind.airport_transfer, orderedIds, stopById],
  );
  const orderedStops = useMemo(
    () =>
      orderedIds
        .map((id) => ({ id, ...stopById.get(id) }))
        .filter(
          (item): item is {
            id: string;
            stop: TripDayModel["stops"][number];
            originalIndex: number;
          } => item.stop != null && item.originalIndex != null,
        ),
    [orderedIds, stopById],
  );
  const landmarkLookupEntries = useMemo(
    () =>
      orderedStops.flatMap(({ stop, originalIndex }) =>
        stop.lat == null ||
        stop.lng == null ||
        !stop.placeName?.trim() ||
        placeholderInfoForStop(stop)
          ? []
          : [{
              originalIndex,
              stop,
              key: stopDetailsLookupKey(stop),
            }],
      ),
    [orderedStops],
  );
  const landmarkLookupSignature = useMemo(
    () =>
      landmarkLookupEntries
        .map(({ originalIndex, key }) => `${originalIndex}:${key}`)
        .join("|"),
    [landmarkLookupEntries],
  );
  const [landmarkLabelsState, setLandmarkLabelsState] = useState<{
    signature: string;
    labels: Record<number, string>;
  }>({ signature: "", labels: {} });
  const landmarkLabelsByStop =
    landmarkLabelsState.signature === landmarkLookupSignature
      ? landmarkLabelsState.labels
      : {};
  const lodgingAnchors = useMemo(
    () => buildDayLodgingAnchors(days, dayIndex, labels, homePlace),
    [dayIndex, days, homePlace, labels],
  );
  const deleteStopLabel = labels.stop_actions?.delete ?? "Delete stop";
  const autoArrangeLabels = autoArrangeLabelsFor(labels);

  useEffect(() => {
    let canceled = false;
    if (travelStops.length < 2) {
      const timer = window.setTimeout(() => {
        if (!canceled) setTravelSegments([]);
      }, 0);
      return () => {
        canceled = true;
        window.clearTimeout(timer);
      };
    }

    void resolveTravelSegments(travelStops, labels.map_travel)
      .then((segments) => {
        if (!canceled) setTravelSegments(segments);
      })
      .catch(() => {
      if (!canceled) {
        setTravelSegments(createFallbackTravelSegments(travelStops, labels.map_travel));
      }
    });

    return () => {
      canceled = true;
    };
  }, [labels.map_travel, travelStops]);

  useEffect(() => {
    let canceled = false;
    if (landmarkLookupEntries.length === 0) {
      return () => {
        canceled = true;
      };
    }

    void Promise.all(
      landmarkLookupEntries.map(async ({ originalIndex, stop }) => {
        const details = await fetchStopGoogleDetails({ stop, city: day.city }).catch(
          () => null,
        );
        const label = landmarkLabelForStop(details?.name, stop);
        return label ? { originalIndex, label } : null;
      }),
    ).then((entries) => {
      if (canceled) return;
      const nextLabels = Object.fromEntries(
        entries.flatMap((entry) =>
          entry ? [[entry.originalIndex, entry.label] as const] : [],
        ),
      );
      setLandmarkLabelsState({
        signature: landmarkLookupSignature,
        labels: nextLabels,
      });
    });

    return () => {
      canceled = true;
    };
  }, [day.city, landmarkLookupEntries, landmarkLookupSignature]);

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id || busy) return;
    const oldIndex = orderedIds.indexOf(String(active.id));
    const newIndex = orderedIds.indexOf(String(over.id));
    if (oldIndex < 0 || newIndex < 0) return;
    const previousIds = orderedIds;
    const nextIds = arrayMove(orderedIds, oldIndex, newIndex);
    setOrderedIds(nextIds);
    setBusy(true);
    try {
      const nextVisibleStops = nextIds
        .map((id) => stopById.get(id)?.stop)
        .filter((stop): stop is TripDayModel["stops"][number] => stop != null);
      await onReorderDayStops(
        dayIndex,
        mergeTimelineVisibleStops(day.stops, nextVisibleStops),
      );
    } catch {
      setOrderedIds(previousIds);
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteStop(stopIdToDelete: string, originalIndex: number) {
    if (busy) return;
    const previousIds = orderedIds;
    const nextIds = orderedIds.filter((id) => id !== stopIdToDelete);
    setOrderedIds(nextIds);
    setBusy(true);
    try {
      const nextVisibleStops = nextIds
        .map((id) => stopById.get(id)?.stop)
        .filter((stop): stop is TripDayModel["stops"][number] => stop != null);
      await onReorderDayStops(
        dayIndex,
        mergeTimelineVisibleStops(day.stops, nextVisibleStops),
      );
      if (mapFocus?.mode === "stop") {
        if (mapFocus.index === originalIndex) {
          onMapFocusChange(
            nextVisibleStops.length > 0
              ? { mode: "stop", index: Math.min(originalIndex, nextVisibleStops.length - 1), source: "manual" }
              : null,
          );
        } else if (mapFocus.index > originalIndex) {
          onMapFocusChange({
            mode: "stop",
            index: mapFocus.index - 1,
            source: mapFocus.source,
          });
        }
      }
    } catch {
      setOrderedIds(previousIds);
    } finally {
      setBusy(false);
    }
  }

  async function handleAutoArrangeStops() {
    if (busy) return;
    setBusy(true);
    setAutoArrangeStatus("idle");
    try {
      const currentStops = orderedStops.map((item) => item.stop);
      const nextStops = await arrangeDayStopsByRouteAndHours(day, currentStops);
      if (!nextStops) {
        setAutoArrangeStatus("hours_blocked");
        return;
      }
      const idByStop = new Map(
        orderedStops.map((item) => [item.stop, item.id] as const),
      );
      const nextIds = nextStops.map((stop, index) => idByStop.get(stop) ?? stopId(stop, index));
      const sameOrder = nextStops.every((stop, index) => {
        const currentStop = currentStops[index];
        return (
          currentStop != null &&
          stopScheduleKey(stop) === stopScheduleKey(currentStop) &&
          (stop.arrival_time ?? null) === (currentStop.arrival_time ?? null)
        );
      });
      if (sameOrder) {
        setAutoArrangeStatus("no_change");
        return;
      }
      setOrderedIds(nextIds);
      await onAutoArrangeDayStops(
        dayIndex,
        mergeTimelineVisibleStops(day.stops, nextStops),
      );
      setAutoArrangeStatus("saved");
      onMapFocusChange({ mode: "stop", index: 0, source: "manual" });
    } catch {
      setAutoArrangeStatus("error");
    } finally {
      setBusy(false);
    }
  }

  function handleLodgingAnchorActivate(anchor: DayLodgingAnchor) {
    if (anchor.state === "placeholder") {
      onOpenLodgingSettings(dayIndex, anchor.position);
      return;
    }
    if (anchor.state !== "stay") return;
    onOpenLodgingSettings(dayIndex, anchor.position);
  }

  return (
    <div className="mt-2 h-[calc(100%-0.5rem)] overflow-y-auto rounded-[20px] border border-white/70 bg-white/70 p-2.5 shadow-[0_18px_50px_-40px_rgba(32,41,46,0.45)] sm:p-3">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="min-h-5 text-[12px] font-semibold text-fg-muted">
          {autoArrangeStatus === "saved"
            ? autoArrangeLabels.saved
            : autoArrangeStatus === "no_change"
              ? autoArrangeLabels.noChange
              : autoArrangeStatus === "hours_blocked"
                ? autoArrangeLabels.hoursBlocked
                : autoArrangeStatus === "error"
                  ? autoArrangeLabels.failed
                  : null}
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={busy || orderedStops.length < 2}
          onClick={() => void handleAutoArrangeStops()}
          className="h-9 rounded-full border-accent/30 bg-white px-3 text-[12px] font-semibold text-accent hover:border-accent/50 hover:bg-accent-soft"
        >
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <ArrowDownUp className="h-4 w-4" />
          )}
          {busy
            ? autoArrangeLabels.arranging
            : autoArrangeLabels.arrange}
        </Button>
      </div>
      <LodgingAnchorRow
        anchor={lodgingAnchors.start}
        days={days}
        dayIndex={dayIndex}
        companions={companions}
        bookingAdults={bookingAdults}
        labels={labels.lodging_stops}
        onActivate={() => handleLodgingAnchorActivate(lodgingAnchors.start)}
        onChoose={() => onOpenLodgingSettings(dayIndex, lodgingAnchors.start.position)}
        onSetHome={onRequestHomeSettings}
        onUpdateAssignment={(companionIds) =>
          onUpdateLodgingAssignment(dayIndex, lodgingAnchors.start.position, companionIds)
        }
      />
      {orderedStops.length === 0 ? (
        <div className="my-3 rounded-2xl border border-dashed border-divider-strong bg-white/70 p-5 text-center text-[13px] text-fg-muted">
          {labels.no_stops}
        </div>
      ) : null}
      <DndContext
        id={`trip-day-${dayIndex}-stops`}
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={(event) => void handleDragEnd(event)}
      >
        <SortableContext items={orderedIds} strategy={verticalListSortingStrategy}>
          {orderedStops.map(({ id, stop, originalIndex }, index) => {
            const placeholder = placeholderInfoForStop(stop);
            const landmarkLabel =
              landmarkLabelsByStop[originalIndex] ??
              (activeStopLandmarkLabel?.dayIndex === dayIndex &&
              activeStopLandmarkLabel.stopIndex === originalIndex
                ? activeStopLandmarkLabel.label
                : null);
            const secondaryText = stopTimelineSecondaryText({
              stop,
              placeholder,
              landmarkLabel,
              labels,
            });
            const Icon = placeholder
              ? iconForPlaceholderKind(placeholder.kind)
              : iconForKind(stop.kind);
            const budgetAmount = stopBudgetAmount(stop);
            const nextStop = orderedStops[index + 1];
            const segment = nextStop
              ? travelSegments.find(
                  (item) =>
                    item.fromIndex === originalIndex &&
                    item.toIndex === nextStop.originalIndex,
                )
              : null;
            const movementAttachment =
              nextStop
                ? airportTransferAttachmentForMovement(stop, nextStop.stop)
                : null;
            const hasAirportTransferMovement = movementAttachment != null;
            const movementNeedsAction =
              hasAirportTransferMovement && !isAttachmentComplete(movementAttachment);
            const segmentActive =
	              nextStop != null &&
	              ((mapFocus?.mode === "stop" &&
	                mapFocus.index === nextStop.originalIndex) ||
	                (mapFocus?.mode === "movement" &&
	                  mapFocus.fromIndex === originalIndex &&
	                  mapFocus.toIndex === nextStop.originalIndex));
            return (
              <SortableTimelineRow
                key={id}
                id={id}
                active={mapFocus?.mode === "stop" && mapFocus.index === originalIndex}
                disabled={busy}
                stackOrder={orderedStops.length - index}
                gridClassName="grid-cols-[96px_34px_minmax(0,1fr)] gap-2 sm:grid-cols-[118px_38px_minmax(0,1fr)] sm:gap-3"
                onActivate={() =>
                  onMapFocusChange({ mode: "stop", index: originalIndex, source: "manual" })
                }
              >
                <StopTimeInput
                  value={stop.arrival_time ?? timeForStop(index)}
                  disabled={busy}
                  ariaLabel={labels.stop_actions.edit_time}
                  onChange={(arrivalTime) =>
                    onUpdateStopTime(dayIndex, originalIndex, arrivalTime)
                  }
                />
                <div className="relative flex justify-center">
                  <div className="absolute bottom-0 top-0 w-px bg-divider" />
                  <span className={cn(
                    "relative mt-3 grid h-7 w-7 place-items-center rounded-full text-white transition-shadow group-data-[active=true]:shadow-[0_0_0_5px_rgba(15,184,180,0.16),0_8px_18px_rgba(15,184,180,0.22)]",
                    placeholder
                      ? "border border-dashed border-accent/45 bg-white text-accent"
                      : routeColor(index),
                  )}>
                    <Icon className="h-4 w-4" />
                  </span>
                  {segment ? (
                    <button
                      type="button"
                      className={cn(
                        "absolute left-1/2 top-[48px] z-30 inline-flex w-max max-w-[112px] -translate-x-1/2 items-center gap-1 rounded-full border bg-white/95 px-2 py-0.5 text-[10px] font-semibold leading-none text-fg-muted shadow-sm backdrop-blur transition hover:border-accent/35 hover:text-accent sm:top-[50px] sm:max-w-none",
                        segmentActive
                          ? "border-accent/30 text-accent shadow-[0_12px_26px_-20px_rgba(15,184,180,0.85)]"
                          : "border-divider",
                        movementNeedsAction && "border-[#f2b84b]/55 text-[#9b6a00]",
                      )}
                      onClick={(event) => {
                        event.stopPropagation();
                        if (hasAirportTransferMovement && nextStop) {
                          onMapFocusChange({
                            mode: "movement",
                            fromIndex: originalIndex,
                            toIndex: nextStop.originalIndex,
                            source: "manual",
                          });
                        } else {
                          onMapFocusChange({
                            mode: "stop",
                            index: nextStop.originalIndex,
                            source: "manual",
                          });
                        }
                      }}
                    >
                      {movementNeedsAction ? <CircleAlert className="h-3 w-3" /> : null}
                      <span className="truncate">
                        {hasAirportTransferMovement
                          ? labels.kind.airport_transfer
                          : labels.map_travel[segment.mode]} · {segment.durationText}
                      </span>
                    </button>
	                  ) : null}
	                </div>
                <article className={cn(
                  "mb-2 flex min-w-0 items-center gap-2 rounded-2xl border bg-white p-2 pr-1.5 shadow-sm transition group-hover:border-accent/35 group-hover:shadow-md group-data-[active=true]:border-accent/45 group-data-[active=true]:bg-[linear-gradient(135deg,rgba(255,255,255,0.98),rgba(236,252,251,0.72))] group-data-[active=true]:shadow-[0_18px_42px_-32px_rgba(15,184,180,0.7)] sm:gap-3 sm:p-2.5 sm:pr-2",
                  placeholder
                    ? "border-dashed border-accent/35 bg-accent-soft/30"
                    : "border-divider",
                )}>
                  <div className={cn(
                    "relative hidden h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-xl min-[430px]:grid",
                    placeholder ? "bg-white text-accent" : "bg-accent-softer",
                  )}>
                    {placeholder ? (
                      <Icon className="h-5 w-5" />
                    ) : (
                      <Image
                        src={STOP_IMAGES[index % STOP_IMAGES.length]}
                        alt=""
                        fill
                        sizes="48px"
                        className="object-cover"
                      />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="flex min-w-0 items-center gap-1.5 text-[14px] font-semibold text-fg sm:gap-2 sm:text-[15px]">
                      <span
                        className="grid h-5 min-w-5 shrink-0 place-items-center rounded-full bg-accent-soft px-1.5 text-[11px] font-bold text-accent"
                        style={{ fontFamily: "var(--font-mono)" }}
                      >
                        {originalIndex + 1}
                      </span>
                      <span className="truncate">{stop.name}</span>
                    </h3>
                    <p className="mt-0.5 line-clamp-1 text-[12px] text-fg-muted">
                      {secondaryText}
                    </p>
                  </div>
                  <div className="hidden text-right sm:block">
                    <span className={cn(
                      "rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
                      placeholder
                        ? "border border-accent/25 bg-white text-accent"
                        : "bg-accent-soft text-accent",
                    )}>
                      {placeholder
                        ? placeholderLabel(placeholder.kind, labels)
                        : labels.kind[stop.kind ?? "other"] ?? labels.kind.other}
                    </span>
                    {stop.duration_min ? (
                      <p className="mt-1 text-[11px] text-fg-muted">
                        {Math.max(1, Math.round(stop.duration_min / 60))}h
                      </p>
                    ) : null}
	                    {budgetAmount ? (
	                      <p className="mt-0.5 text-[11px] font-semibold text-fg-secondary">
	                        {budgetAmount}
	                      </p>
	                    ) : null}
	                  </div>
	                  <TicketAttachmentActions
	                    stop={stop}
	                    disabled={busy}
	                    labels={labels.ticket_actions}
	                    onUpdateAttachments={(attachments) =>
	                      onUpdateStopAttachments(dayIndex, originalIndex, attachments)
	                    }
	                  />
                    {journeyStarted && !placeholder ? (
                      <StopCheckInAction
                        stop={stop}
                        disabled={busy}
                        labels={labels.journey_live}
                        onUpdateAttachments={(attachments) =>
                          onUpdateStopAttachments(dayIndex, originalIndex, attachments)
                        }
                      />
                    ) : null}
	                  <Button
	                    type="button"
	                    variant="ghost"
                    size="icon-sm"
                    disabled={busy}
                    aria-label={deleteStopLabel}
                    title={deleteStopLabel}
                    onClick={(event) => {
                      event.stopPropagation();
                      void handleDeleteStop(id, originalIndex);
                    }}
                    className="shrink-0 rounded-xl text-fg-muted opacity-0 transition hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100 group-data-[active=true]:opacity-100"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </article>
              </SortableTimelineRow>
	        );
	      })}
        </SortableContext>
      </DndContext>
      <LodgingAnchorRow
        anchor={lodgingAnchors.end}
        days={days}
        dayIndex={dayIndex}
        companions={companions}
        bookingAdults={bookingAdults}
        labels={labels.lodging_stops}
        onActivate={() => handleLodgingAnchorActivate(lodgingAnchors.end)}
        onChoose={() => onOpenLodgingSettings(dayIndex, lodgingAnchors.end.position)}
        onSetHome={onRequestHomeSettings}
        onUpdateAssignment={(companionIds) =>
          onUpdateLodgingAssignment(dayIndex, lodgingAnchors.end.position, companionIds)
        }
      />
    </div>
  );
}

function LodgingAnchorRow({
  anchor,
  days,
  dayIndex,
  companions,
  bookingAdults,
  labels,
  onActivate,
  onChoose,
  onSetHome,
  onUpdateAssignment,
}: {
  anchor: DayLodgingAnchor;
  days: TripDayModel[];
  dayIndex: number;
  companions: ApiCompanion[];
  bookingAdults: number;
  labels: TripPlanningLabels["lodging_stops"];
  onActivate: () => void;
  onChoose: () => void;
  onSetHome: () => void;
  onUpdateAssignment: (companionIds: string[]) => void;
}) {
  const isHome = anchor.state === "home";
  const isPlaceholder = anchor.state === "placeholder";
  const isOvernight = anchor.state === "overnight";
  const isStay = anchor.state === "stay";
  const Icon = isHome ? House : isOvernight ? Plane : BedDouble;
  const assignedCompanionIds = companionIdsForLodgingStop(anchor.stop, companions);
  const bookingUrl = isOvernight || isHome
    ? null
    : bookingSearchUrl({
        destination: days[dayIndex]?.city || anchor.title,
        checkIn: checkInDateForLodgingAnchor(days, dayIndex, anchor.position),
        checkOut: checkOutDateForLodgingAnchor(days, dayIndex, anchor.position),
        adults: bookingAdults,
        rooms: BOOKING_DEFAULT_ROOMS,
      });

  return (
    <div className="grid grid-cols-[96px_34px_minmax(0,1fr)] gap-2 sm:grid-cols-[118px_38px_minmax(0,1fr)] sm:gap-3">
      <div className="py-2 text-[12px] font-semibold text-fg-muted">
        {anchor.label}
      </div>
      <div className="relative flex justify-center">
        <div className="absolute bottom-0 top-0 w-px bg-divider/80" />
        <span
          className={cn(
            "relative mt-2 grid h-7 w-7 place-items-center rounded-full border bg-white shadow-sm",
            isHome
              ? "border-[#d6cec2] text-fg-secondary"
              : isOvernight
              ? "border-[#87a8d8] text-[#4f76ac]"
              : isPlaceholder
                ? "border-dashed border-accent/45 text-accent"
                : "border-[#9ed8c4] text-[#34866b]",
          )}
        >
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <div className="mb-2 mt-1 flex min-w-0 flex-wrap items-center gap-2">
        <div
          className={cn(
            "inline-flex min-w-0 max-w-full flex-1 items-center gap-2 rounded-2xl border px-3 py-2 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md sm:max-w-[420px] sm:gap-3 sm:flex-none",
            isHome
              ? "border-[#ded8cf] bg-white text-fg"
              : isOvernight
              ? "border-[#bfd4f2] bg-[#f2f7ff] text-[#254a7b]"
              : isPlaceholder
                ? "border-dashed border-accent/35 bg-accent-soft/40 text-accent"
                : "border-[#c6eadc] bg-[#f2fbf7] text-[#245f4e]",
          )}
        >
          <button
            type="button"
            onClick={isOvernight || isHome ? undefined : onActivate}
            className="flex min-w-0 flex-1 items-center gap-2 text-left sm:gap-3"
          >
            <span
              className={cn(
                "grid h-9 w-9 shrink-0 place-items-center rounded-xl",
                isHome
                  ? "bg-muted text-fg-secondary"
                  : isOvernight
                  ? "bg-white text-[#4f76ac]"
                  : isPlaceholder
                    ? "bg-white text-accent"
                    : "bg-white text-[#34866b]",
              )}
            >
              <Icon className="h-4.5 w-4.5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-center gap-2">
                <span className="truncate text-[14px] font-semibold">
                  {anchor.title}
                </span>
                <span className="rounded-full bg-white/75 px-2 py-0.5 text-[10px] font-semibold">
                  {anchor.badge}
                </span>
              </span>
              <span className="mt-0.5 block line-clamp-2 text-[12px] leading-5 text-fg-muted">
                {anchor.subtitle}
              </span>
            </span>
          </button>
          {isStay && companions.length > 0 ? (
            <LodgingCompanionAssignmentPopover
              companions={companions}
              selectedIds={assignedCompanionIds}
              labels={labels}
              onChange={onUpdateAssignment}
            />
          ) : null}
        </div>
        {isHome ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onSetHome}
            className="h-10 rounded-xl border-divider bg-white px-3 text-[12px] font-semibold text-fg-muted hover:border-accent/35 hover:bg-accent-soft hover:text-accent"
          >
            <House className="h-3.5 w-3.5" />
            {labels.set_home}
          </Button>
        ) : null}
        {isStay ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onChoose}
            className="h-10 rounded-xl border-divider bg-white px-3 text-[12px] font-semibold text-fg-muted hover:border-accent/35 hover:bg-accent-soft hover:text-accent"
          >
            <Plus className="h-3.5 w-3.5" />
            {labels.add_other}
          </Button>
        ) : null}
        {bookingUrl ? (
          <div className="flex min-w-0 flex-1 flex-col gap-1 sm:min-w-[220px] sm:flex-none">
            <a
              href={bookingUrl}
              target="_blank"
              rel="noreferrer sponsored"
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-divider bg-white px-3 text-[12px] font-semibold text-fg transition hover:border-accent/35 hover:bg-accent-soft hover:text-accent"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              {labels.booking_button}
            </a>
            <span className="px-1 text-[10px] leading-4 text-fg-muted">
              {labels.booking_note}
            </span>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function LodgingCompanionAssignmentPopover({
  companions,
  selectedIds,
  labels,
  onChange,
}: {
  companions: ApiCompanion[];
  selectedIds: string[];
  labels: TripPlanningLabels["lodging_stops"];
  onChange: (companionIds: string[]) => void;
}) {
  const allIds = companions.map((companion) => companion.id);
  const selectedSet = new Set(selectedIds.length > 0 ? selectedIds : allIds);
  const selectedCompanions = companions.filter((companion) =>
    selectedSet.has(companion.id),
  );
  const isEveryoneSelected = selectedSet.size >= companions.length;

  function updateCompanion(companionId: string, checked: boolean) {
    const next = new Set(selectedSet);
    if (checked) {
      next.add(companionId);
    } else {
      next.delete(companionId);
    }
    onChange(next.size > 0 ? Array.from(next) : allIds);
  }

  function selectEveryone() {
    onChange(allIds);
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          aria-label={labels.assign_people}
          title={labels.assign_people}
          className="h-9 rounded-full border-white/80 bg-white/70 px-1.5 shadow-sm hover:border-accent/30 hover:bg-white"
        >
          <AvatarStack
            companions={selectedCompanions.length > 0 ? selectedCompanions : companions}
          />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 rounded-2xl p-3">
        <div className="space-y-3">
          <div>
            <p className="text-[13px] font-semibold text-fg">
              {labels.assignment_title}
            </p>
            <p className="mt-0.5 text-[11px] leading-5 text-fg-muted">
              {labels.assignment_hint}
            </p>
          </div>
          <button
            type="button"
            onClick={selectEveryone}
            className={cn(
              "flex w-full items-center justify-between rounded-xl border px-3 py-2 text-left text-[12px] font-semibold transition",
              isEveryoneSelected
                ? "border-accent/35 bg-accent-soft text-accent"
                : "border-divider bg-white text-fg-muted hover:border-accent/35 hover:text-accent",
            )}
          >
            <span>{labels.assignment_everyone}</span>
            {isEveryoneSelected ? <Check className="h-4 w-4" /> : null}
          </button>
          <div className="space-y-1">
            {companions.map((companion, index) => (
              <label
                key={companion.id}
                className="flex cursor-pointer items-center gap-3 rounded-xl px-2 py-2 transition hover:bg-muted/60"
              >
                <Checkbox
                  checked={selectedSet.has(companion.id)}
                  onCheckedChange={(checked) =>
                    updateCompanion(companion.id, checked === true)
                  }
                />
                <span
                  className="grid h-7 w-7 place-items-center rounded-full text-[11px] font-semibold text-white"
                  style={{ background: companion.color || avatarColor(index) }}
                >
                  {companion.display_name.slice(0, 1)}
                </span>
                <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-fg">
                  {companion.display_name}
                </span>
              </label>
            ))}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function HomePlaceDialog({
  open,
  homePlace,
  labels,
  onOpenChange,
  onSave,
}: {
  open: boolean;
  homePlace: UserHomePlace | null;
  labels: TripPlanningLabels["lodging_stops"];
  onOpenChange: (open: boolean) => void;
  onSave: (homePlace: UserHomePlace) => Promise<void>;
}) {
  const [query, setQuery] = useState(homePlace?.name ?? "");
  const [results, setResults] = useState<LandmarkSearchResult[]>([]);
  const [selected, setSelected] = useState<LandmarkSearchResult | null>(
    homePlace ? homePlaceToLandmark(homePlace) : null,
  );
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<"idle" | "saved" | "error">("idle");

  async function searchHomePlace(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleanQuery = query.trim();
    if (!cleanQuery || searching) return;
    setSearching(true);
    setStatus("idle");
    try {
      const nextResults = await geocodeLandmark(cleanQuery);
      setResults(nextResults);
      setSelected(nextResults[0] ?? null);
      if (nextResults.length === 0) setStatus("error");
    } catch {
      setStatus("error");
    } finally {
      setSearching(false);
    }
  }

  async function saveHomePlace() {
    if (!selected || saving) return;
    setSaving(true);
    setStatus("idle");
    try {
      await onSave(landmarkToHomePlace(selected));
      setStatus("saved");
      onOpenChange(false);
    } catch {
      setStatus("error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-[24px] bg-white sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>{labels.home_dialog_title}</DialogTitle>
          <DialogDescription>
            {labels.home_dialog_description}
          </DialogDescription>
        </DialogHeader>
        <form className="flex gap-2" onSubmit={(event) => void searchHomePlace(event)}>
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={labels.home_search_placeholder}
            className="h-11 rounded-xl"
          />
          <Button
            type="submit"
            disabled={searching || !query.trim()}
            className="h-11 rounded-xl"
          >
            {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            {labels.home_search}
          </Button>
        </form>
        <div className="space-y-2">
          {homePlace ? (
            <div className="rounded-2xl border border-divider bg-muted/40 p-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-fg-muted">
                {labels.home_current}
              </p>
              <p className="mt-1 text-[14px] font-semibold text-fg">
                {homePlace.name}
              </p>
              <p className="mt-0.5 text-[12px] leading-5 text-fg-muted">
                {homePlace.address}
              </p>
            </div>
          ) : null}
          {results.length > 0 ? (
            <div className="max-h-64 space-y-1 overflow-y-auto rounded-2xl border border-divider p-1">
              {results.map((result) => {
                const active = selected ? landmarkKey(selected) === landmarkKey(result) : false;
                return (
                  <button
                    key={landmarkKey(result)}
                    type="button"
                    onClick={() => setSelected(result)}
                    className={cn(
                      "flex w-full items-start gap-3 rounded-xl px-3 py-2 text-left transition",
                      active
                        ? "bg-accent-soft text-accent"
                        : "text-fg hover:bg-muted/60",
                    )}
                  >
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-semibold">
                        {result.name}
                      </span>
                      <span className="mt-0.5 block line-clamp-2 text-[11px] leading-4 text-fg-muted">
                        {result.address}
                      </span>
                    </span>
                    {active ? <Check className="mt-0.5 h-4 w-4 shrink-0" /> : null}
                  </button>
                );
              })}
            </div>
          ) : null}
          {status === "error" ? (
            <p className="text-[12px] text-destructive">
              {results.length === 0 ? labels.home_no_results : labels.home_error}
            </p>
          ) : status === "saved" ? (
            <p className="text-[12px] text-accent">{labels.home_saved}</p>
          ) : null}
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline" disabled={saving}>
              {labels.home_cancel}
            </Button>
          </DialogClose>
          <Button
            type="button"
            disabled={!selected || saving}
            onClick={() => void saveHomePlace()}
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <House className="h-4 w-4" />}
            {saving ? labels.home_saving : labels.home_save}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function StopTimeInput({
  value,
  disabled,
  ariaLabel,
  onChange,
}: {
  value: string;
  disabled: boolean;
  ariaLabel: string;
  onChange: (arrivalTime: string | null) => Promise<void>;
}) {
  const editableValue = normalizeEditableTime(value);
  const [open, setOpen] = useState(false);
  const [draftValue, setDraftValue] = useState(editableValue);
  const hour = editableValue ? editableValue.slice(0, 2) : "09";
  const minute = editableValue ? editableValue.slice(3, 5) : "00";

  function commitTime(nextHour: string, nextMinute: string) {
    setDraftValue(`${nextHour}:${nextMinute}`);
    void onChange(`${nextHour}:${nextMinute}`);
  }

  function commitDraft(nextValue: string) {
    const normalized = normalizeEditableTime(nextValue);
    if (normalized) {
      setDraftValue(normalized);
      void onChange(normalized);
    }
  }

  return (
    <div className="pt-2">
      <Popover
        open={open}
        onOpenChange={(nextOpen) => {
          setOpen(nextOpen);
          if (nextOpen) setDraftValue(editableValue);
        }}
      >
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            disabled={disabled}
            aria-label={ariaLabel}
            title={ariaLabel}
            className="h-8 w-[92px] min-w-[92px] rounded-xl border-divider bg-white/88 px-2 text-[13px] font-semibold tabular-nums text-fg-secondary shadow-none transition hover:border-accent/35 hover:bg-white hover:text-accent focus-visible:border-accent/45 focus-visible:ring-2 focus-visible:ring-accent/20 group-data-[active=true]:text-fg sm:w-[112px] sm:min-w-[112px]"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => event.stopPropagation()}
          >
            <Clock className="h-3.5 w-3.5 text-fg-muted" />
            <span>{editableValue || `${hour}:${minute}`}</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          side="bottom"
          sideOffset={8}
          className="z-[700] w-[208px] rounded-2xl border-white/80 bg-white/96 p-2 shadow-[0_22px_60px_-36px_rgba(32,41,46,0.65)] backdrop-blur sm:data-[side=right]:animate-in"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => event.stopPropagation()}
        >
          <Input
            value={draftValue}
            inputMode="numeric"
            placeholder="HH:mm"
            aria-label={ariaLabel}
            className="mb-2 h-9 rounded-xl border-divider bg-white px-3 text-center text-[14px] font-semibold tabular-nums text-fg shadow-none focus-visible:border-accent/45 focus-visible:ring-2 focus-visible:ring-accent/20"
            onChange={(event) => {
              const nextValue = event.target.value
                .replace(/[^\d:]/g, "")
                .slice(0, 5);
              setDraftValue(nextValue);
              const normalized = normalizeEditableTime(nextValue);
              if (normalized) {
                void onChange(normalized);
              }
            }}
            onBlur={() => commitDraft(draftValue)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                commitDraft(draftValue);
              }
            }}
          />
          <div className="grid grid-cols-2 gap-2">
            <TimePickerColumn
              ariaLabel={`${ariaLabel} hour`}
              values={TIME_PICKER_HOURS}
              selected={hour}
              onSelect={(nextHour) => commitTime(nextHour, minute)}
            />
            <TimePickerColumn
              ariaLabel={`${ariaLabel} minute`}
              values={TIME_PICKER_MINUTES}
              selected={minute}
              onSelect={(nextMinute) => commitTime(hour, nextMinute)}
            />
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

const TIME_PICKER_HOURS = Array.from({ length: 24 }, (_, index) =>
  String(index).padStart(2, "0"),
);
const TIME_PICKER_MINUTES = Array.from({ length: 60 }, (_, index) =>
  String(index).padStart(2, "0"),
);

function TimePickerColumn({
  values,
  selected,
  ariaLabel,
  onSelect,
}: {
  values: string[];
  selected: string;
  ariaLabel: string;
  onSelect: (value: string) => void;
}) {
  return (
    <ScrollArea className="h-44 rounded-xl bg-surface/80 p-1" aria-label={ariaLabel}>
      <div className="space-y-1">
        {values.map((item) => (
          <button
            key={item}
            type="button"
            aria-pressed={item === selected}
            className={cn(
              "flex h-8 w-full items-center justify-center rounded-lg text-[13px] font-semibold tabular-nums text-fg-secondary transition hover:bg-white hover:text-accent",
              item === selected && "bg-accent text-white shadow-sm hover:bg-accent hover:text-white",
            )}
            onClick={() => onSelect(item)}
          >
            {item}
          </button>
        ))}
      </div>
    </ScrollArea>
  );
}

function TicketAttachmentActions({
  stop,
  disabled,
  labels,
  onUpdateAttachments,
}: {
  stop: TripDayModel["stops"][number];
  disabled: boolean;
  labels: TripPlanningLabels["ticket_actions"];
  onUpdateAttachments: (attachments: TripStopAttachment[]) => Promise<void>;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploadState, setUploadState] = useState<"idle" | "uploading" | "uploaded" | "error">(
    "idle",
  );
  const attachments = ticketAttachmentsForStop(stop);
  const primaryAttachment =
    primaryTicketAttachment(stop) ?? defaultTicketAttachmentForStop(stop, labels);
  const needsTicket = stopNeedsTicketAction(stop);
  const hasUpload = attachments.some((attachment) => attachment.imageDataUrl);

  if (!needsTicket) return null;

  function openPurchasePage(event: MouseEvent<HTMLButtonElement>) {
    event.stopPropagation();
    window.open(ticketPurchaseUrl(stop, primaryAttachment, labels), "_blank", "noopener,noreferrer");
  }

  async function uploadTicketCapture(file: File | null) {
    if (!file || disabled) return;
    setUploadState("uploading");
    try {
      const imageDataUrl = await compressImageToDataUrl(file, {
        maxDataUrlLength: 1_800_000,
        fallbackQuality: 0.45,
      });
      await onUpdateAttachments(
        withTicketAttachment(stop, labels, {
          imageName: file.name,
          imageDataUrl,
        }),
      );
      setUploadState("uploaded");
    } catch {
      setUploadState("error");
    } finally {
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div
      className="flex shrink-0 items-center gap-1"
      onClick={(event) => event.stopPropagation()}
    >
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        disabled={disabled}
        aria-label={labels.open}
        title={labels.open}
        onClick={openPurchasePage}
        className={cn(
          "relative rounded-xl text-fg-muted transition hover:bg-accent-soft hover:text-accent",
          hasUpload && "bg-accent-soft text-accent",
        )}
      >
        {primaryAttachment.type === "reservation" ||
        primaryAttachment.type === "booking" ? (
          <CalendarCheck className="h-4 w-4" />
        ) : (
          <Ticket className="h-4 w-4" />
        )}
        {hasUpload ? (
          <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border border-white bg-accent" />
        ) : null}
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        disabled={disabled || uploadState === "uploading"}
        aria-label={labels.upload}
        title={
          uploadState === "uploading"
            ? labels.uploading
            : uploadState === "uploaded"
              ? labels.uploaded
              : uploadState === "error"
                ? labels.upload_error
                : labels.upload
        }
        onClick={(event) => {
          event.stopPropagation();
          inputRef.current?.click();
        }}
        className={cn(
          "rounded-xl text-fg-muted opacity-0 transition hover:bg-muted hover:text-fg group-hover:opacity-100 group-data-[active=true]:opacity-100",
          (hasUpload || uploadState !== "idle") && "opacity-100",
          uploadState === "uploaded" && "text-accent",
          uploadState === "error" && "text-destructive",
        )}
      >
        {uploadState === "uploading" ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : uploadState === "uploaded" || hasUpload ? (
          <Check className="h-4 w-4" />
        ) : (
          <Upload className="h-4 w-4" />
        )}
      </Button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => void uploadTicketCapture(event.target.files?.[0] ?? null)}
      />
    </div>
  );
}

function StopCheckInAction({
  stop,
  disabled,
  labels,
  onUpdateAttachments,
}: {
  stop: TripDayModel["stops"][number];
  disabled: boolean;
  labels: TripPlanningLabels["journey_live"];
  onUpdateAttachments: (attachments: TripStopAttachment[]) => Promise<void>;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<"idle" | "uploading" | "done" | "error">(
    checkInAttachmentForStop(stop) ? "done" : "idle",
  );
  const checkedIn = state === "done" || checkInAttachmentForStop(stop) != null;

  async function uploadCheckIn(file: File | null) {
    if (!file || disabled) return;
    setState("uploading");
    try {
      const imageDataUrl = await compressImageToDataUrl(file, {
        maxDataUrlLength: 1_600_000,
        fallbackQuality: 0.5,
      });
      await onUpdateAttachments(
        withCheckInAttachment(stop.attachments, labels, {
          imageName: file.name,
          imageDataUrl,
        }),
      );
      setState("done");
    } catch {
      setState("error");
    } finally {
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  const title =
    state === "uploading"
      ? labels.check_in_uploading
      : checkedIn
        ? labels.check_in_done
        : state === "error"
          ? labels.check_in_error
          : labels.check_in;

  return (
    <div
      className="flex shrink-0 items-center"
      onClick={(event) => event.stopPropagation()}
    >
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        disabled={disabled || state === "uploading"}
        aria-label={title}
        title={title}
        onClick={(event) => {
          event.stopPropagation();
          inputRef.current?.click();
        }}
        className={cn(
          "rounded-xl text-fg-muted transition hover:bg-accent-soft hover:text-accent",
          checkedIn && "bg-accent-soft text-accent",
          state === "error" && "text-destructive hover:bg-destructive/10 hover:text-destructive",
        )}
      >
        {state === "uploading" ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : checkedIn ? (
          <Check className="h-4 w-4" />
        ) : (
          <Camera className="h-4 w-4" />
        )}
      </Button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(event: ChangeEvent<HTMLInputElement>) =>
          void uploadCheckIn(event.target.files?.[0] ?? null)
        }
      />
    </div>
  );
}

/* eslint-disable react-hooks/refs --
 * dnd-kit exposes drag listeners, attributes, and setNodeRef through
 * useSortable. They are intentionally applied during render and do not read
 * user-managed React refs. */
function SortableTimelineRow({
  id,
  active,
  disabled,
  stackOrder,
  gridClassName,
  onActivate,
  children,
}: {
  id: string;
  active: boolean;
  disabled?: boolean;
  stackOrder?: number;
  gridClassName: string;
  onActivate: () => void;
  children: ReactNode;
}) {
  const sortable = useSortable({ id, disabled });
  const style: CSSProperties = {
    transform: CSS.Transform.toString(sortable.transform),
    transition: sortable.transition,
    opacity: sortable.isDragging ? 0.72 : undefined,
    zIndex: sortable.isDragging ? 100 : stackOrder,
  };

  return (
    <div
      ref={sortable.setNodeRef}
      style={style}
      data-active={active ? "true" : undefined}
      onClick={onActivate}
      className={cn(
        "group relative grid cursor-pointer gap-3 rounded-2xl transition",
        gridClassName,
        sortable.isDragging && "shadow-xl",
      )}
    >
      <button
        type="button"
        className="absolute -left-2 top-1/2 z-10 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full bg-white/92 text-fg-muted opacity-0 shadow-sm transition hover:text-fg group-hover:opacity-100"
        aria-label="Drag row"
        onClick={(event) => event.stopPropagation()}
        {...sortable.attributes}
        {...sortable.listeners}
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <button
        type="button"
        aria-label="Focus map marker"
        className="absolute inset-0 z-[1] rounded-2xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/35"
        onClick={(event) => {
          event.stopPropagation();
          onActivate();
        }}
      />
      <div className="contents [&>*]:relative [&>*]:z-[2]">
        {children}
      </div>
    </div>
  );
}
/* eslint-enable react-hooks/refs */

function useTimelineDndSensors() {
  return useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 180, tolerance: 6 },
    }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
}

function TripSidePanel({
  tripId,
  lang,
  days,
  checklist,
  metadata,
  explorationStep,
  onExplorationStepChange,
  activeStop,
  activeMovement,
  activeCandidate,
  onAddCandidateToTrip,
  onAddLodgingToTrip,
  bookingAdults,
  onUpdateStopBudget,
  onUploadMovementBooking,
  onUpdateTripNotes,
  onUpdateTripMetadata,
  onCloseStopDetails,
  labels,
}: {
  tripId: string;
  lang: string;
  days: TripDayModel[];
  checklist: ChecklistGroup[];
  metadata: Record<string, unknown>;
  explorationStep?: ExplorationStep | null;
  onExplorationStepChange?: (step: ExplorationStep) => void;
  activeStop: ActiveStopDetailsContext | null;
  activeMovement: ActiveMovementDetailsContext | null;
  activeCandidate: CandidateStopDetailsContext | null;
  onAddCandidateToTrip: (
    landmark: LandmarkSearchResult,
  ) => Promise<{ dayIndex: number; stopIndex: number }>;
  onAddLodgingToTrip: (
    landmark: LandmarkSearchResult,
    range: LodgingDateRange,
  ) => Promise<void>;
  bookingAdults: number;
  onUpdateStopBudget: (
    dayIndex: number,
    stopIndex: number,
    amount: string,
  ) => Promise<void>;
  onUploadMovementBooking: (input: {
    dayIndex: number;
    fromIndex: number;
    attachment: TripStopAttachment;
    imageName: string;
    imageDataUrl: string;
  }) => Promise<void>;
  onUpdateTripNotes: (note: string) => void;
  onUpdateTripMetadata: (metadata: Record<string, unknown>) => Promise<void>;
  onCloseStopDetails: () => void;
  labels: TripPlanningLabels;
}) {
  const [tab, setTab] = useState(
    activeMovement
      ? "movement"
      : activeCandidate
          ? "candidate"
          : activeStop
            ? "stop"
            : "planning",
  );
  const [mobileInspectorOpen, setMobileInspectorOpen] = useState(false);
  const activeStopTabKey = activeStop
    ? `${activeStop.dayIndex}:${activeStop.stopIndex}:${activeStop.stop.name}`
    : null;
  const activeMovementTabKey = activeMovement
    ? `${activeMovement.dayIndex}:${activeMovement.fromIndex}:${activeMovement.toIndex}`
    : null;
  const activeCandidateTabKey = activeCandidate
    ? `${landmarkKey(activeCandidate.landmark)}:${
        activeCandidate.lodgingPlan
          ? `${activeCandidate.lodgingPlan.defaultStartIndex}-${activeCandidate.lodgingPlan.defaultEndIndex}`
          : "regular"
      }`
    : null;
  const budget = useMemo(
    () => buildBudgetAnalysis(days, labels),
    [days, labels],
  );
  const hasActiveDetails = Boolean(activeMovement || activeStop || activeCandidate);

  useEffect(() => {
    let canceled = false;
    const nextTab = activeCandidateTabKey
      ? "candidate"
      : activeMovementTabKey
        ? "movement"
        : activeStopTabKey
          ? "stop"
          : null;
    if (!nextTab) return;
    queueMicrotask(() => {
      if (!canceled) setTab(nextTab);
    });
    return () => {
      canceled = true;
    };
  }, [activeCandidateTabKey, activeMovementTabKey, activeStopTabKey]);

  return (
    <aside
      data-testid="trip-planning-inspector"
      className={cn(
        "relative flex min-h-0 min-w-0 flex-col overflow-hidden rounded-[22px] border border-divider bg-paper-raised p-4 shadow-[var(--shadow-sm)] transition-[height,box-shadow] duration-200 motion-reduce:transition-none sm:p-5 2xl:sticky 2xl:top-24 2xl:h-[calc(100dvh-7rem)]",
        hasActiveDetails
          ? "max-xl:fixed max-xl:inset-x-3 max-xl:bottom-3 max-xl:z-50 max-xl:max-h-[74svh] max-xl:bg-paper-raised max-xl:shadow-[var(--shadow-xl)]"
          : "max-xl:fixed max-xl:inset-x-3 max-xl:bottom-3 max-xl:z-40 max-xl:h-[60px] max-xl:p-3 max-xl:shadow-[var(--shadow-xl)]",
        !hasActiveDetails && mobileInspectorOpen &&
          "max-xl:h-[72svh] max-xl:max-h-[640px] max-xl:min-h-[520px] max-xl:p-4",
      )}
    >
      {!hasActiveDetails ? (
        <button
          type="button"
          data-testid="trip-mobile-inspector-toggle"
          aria-expanded={mobileInspectorOpen}
          aria-label={
            mobileInspectorOpen
              ? labels.tabs.close_inspector
              : labels.tabs.open_inspector
          }
          className="absolute right-3 top-3 z-20 grid h-9 w-9 place-items-center rounded-full border border-divider bg-paper-raised text-fg-muted xl:hidden"
          onClick={() => setMobileInspectorOpen((open) => !open)}
        >
          <ChevronDown
            className={cn(
              "h-4 w-4 transition-transform duration-200 motion-reduce:transition-none",
              !mobileInspectorOpen && "rotate-180",
            )}
          />
        </button>
      ) : null}
      <StorefrontTabs
        value={tab}
        onValueChange={(value) => {
          setTab(value);
          setMobileInspectorOpen(true);
        }}
        className={cn(
          "flex min-h-0 flex-1 flex-col",
          !hasActiveDetails &&
            !mobileInspectorOpen &&
            "max-xl:[&_[data-slot=tabs-content]]:hidden",
        )}
      >
        <StorefrontTabsList className="h-12 w-full shrink-0 justify-start gap-4 overflow-x-auto max-xl:pr-11 sm:gap-5">
          {activeMovement ? (
            <StorefrontTabsTrigger value="movement">
              <CarFront className="h-4 w-4" />
              {labels.movement_details.title}
            </StorefrontTabsTrigger>
          ) : null}
          {activeStop ? (
            <StorefrontTabsTrigger value="stop">
              <MapPin className="h-4 w-4" />
              {labels.place_details.title}
            </StorefrontTabsTrigger>
          ) : null}
          {activeCandidate ? (
            <StorefrontTabsTrigger value="candidate">
              <Plus className="h-4 w-4" />
              {activeCandidate.suggestedPlacement
                ? labels.place_suggestions?.add ?? "Want to go"
                : activeCandidate.lodgingPlan
                ? labels.lodging_stops.add
                : labels.map_search.add}
            </StorefrontTabsTrigger>
          ) : null}
          <StorefrontTabsTrigger value="planning">
            {labels.planning_progress.title}
          </StorefrontTabsTrigger>
          <StorefrontTabsTrigger value="todos">
            {labels.tabs.todos}
          </StorefrontTabsTrigger>
          <StorefrontTabsTrigger value="notes">
            {labels.tabs.notes}
          </StorefrontTabsTrigger>
          <StorefrontTabsTrigger value="budget">
            {labels.tabs.budget}
          </StorefrontTabsTrigger>
        </StorefrontTabsList>

        {activeMovement ? (
          <TabsContent value="movement" className="mt-5 min-h-0 flex-1 overflow-y-auto pr-1">
            <MovementDetailsCard
              key={activeMovementTabKey}
              movement={activeMovement}
              labels={labels.movement_details}
              onUpload={onUploadMovementBooking}
              onClose={onCloseStopDetails}
            />
          </TabsContent>
        ) : null}

        {activeStop ? (
          <TabsContent value="stop" className="mt-5 min-h-0 flex-1 overflow-y-auto pr-1">
            <StopGoogleDetailsCard
              key={activeStopTabKey}
              labels={labels.place_details}
              details={activeStop.details}
              loading={activeStop.loading}
              error={activeStop.error}
              ticketLabels={labels.ticket_actions}
              ticketAttachments={ticketAttachmentsForStop(activeStop.stop)}
              budgetAmount={stopBudgetAmount(activeStop.stop)}
              isMealStop={activeStop.stop.kind === "meal"}
              fallbackName={mappableStopName(activeStop.stop)}
              cityHint={days[activeStop.dayIndex]?.city ?? null}
              fallbackPlaceId={activeStop.stop.placeId ?? null}
              allowFallbackMapsLink={!isAreaWalkStop(activeStop.stop)}
              fallbackAddress={
                activeStop.stop.placeAddress ??
                activeStop.stop.note ??
                ""
              }
              onSaveBudget={(amount) =>
                onUpdateStopBudget(activeStop.dayIndex, activeStop.stopIndex, amount)
              }
              onClose={onCloseStopDetails}
            />
          </TabsContent>
        ) : null}

        {activeCandidate ? (
          <TabsContent value="candidate" className="mt-5 min-h-0 flex-1 overflow-y-auto pr-1">
            <CandidateStopDetailsCard
              key={activeCandidateTabKey}
              candidate={activeCandidate}
              days={days}
              bookingAdults={bookingAdults}
              labels={labels}
              onAdd={(range) =>
                activeCandidate.lodgingPlan
                  ? onAddLodgingToTrip(
                      activeCandidate.landmark,
                      range ?? {
                        startIndex: activeCandidate.lodgingPlan.defaultStartIndex,
                        endIndex: activeCandidate.lodgingPlan.defaultEndIndex,
                      },
                    )
                  : onAddCandidateToTrip(activeCandidate.landmark)
              }
              onClose={onCloseStopDetails}
            />
          </TabsContent>
        ) : null}

        <TabsContent value="planning" className="mt-5 min-h-0 flex-1 overflow-y-auto pr-1">
          <PlanningProgressSection
            days={days}
            checklist={checklist}
            metadata={metadata}
            explorationStep={explorationStep}
            onExplorationStepChange={onExplorationStepChange}
            onUpdateMetadata={onUpdateTripMetadata}
            lang={lang}
            labels={labels}
          />
        </TabsContent>

        <TabsContent value="todos" className="mt-5 min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
          <div className="flex justify-end">
            <Button
              type="button"
              variant="outline"
              className="h-10 rounded-xl border-accent/40 bg-white text-accent"
            >
              <Plus className="h-4 w-4" />
              {labels.add_item}
            </Button>
          </div>
          {checklist.map((group) => (
            <ChecklistSection
              key={group.key}
              group={group}
              tripId={tripId}
              labels={labels}
            />
          ))}
        </TabsContent>

        <TabsContent value="notes" className="mt-5 min-h-0 flex-1 overflow-y-auto pr-1">
          <TripNotesPanel
            days={days}
            labels={labels}
            onUpdateTripNotes={onUpdateTripNotes}
          />
        </TabsContent>

        <TabsContent value="budget" className="mt-5 min-h-0 flex-1 overflow-y-auto pr-1">
          <BudgetAnalysisPanel budget={budget} labels={labels} />
        </TabsContent>
      </StorefrontTabs>
    </aside>
  );
}

function PlanningProgressSection({
  days,
  checklist,
  metadata,
  explorationStep,
  onExplorationStepChange,
  onUpdateMetadata,
  lang,
  labels,
}: {
  days: TripDayModel[];
  checklist: ChecklistGroup[];
  metadata: Record<string, unknown>;
  explorationStep?: ExplorationStep | null;
  onExplorationStepChange?: (step: ExplorationStep) => void;
  onUpdateMetadata: (metadata: Record<string, unknown>) => Promise<void>;
  lang: string;
  labels: TripPlanningLabels;
}) {
  const progressLabels = labels.planning_progress;
  const planningMetadata = useMemo(
    () => readTripPlanningMetadata(metadata),
    [metadata],
  );
  const steps = buildPlanningProgressSteps(
    days,
    checklist,
    planningMetadata,
    explorationStep ?? null,
  );
  const completed = steps.filter((step) => step.done).length;
  const activeIndex = Math.max(0, steps.findIndex((step) => !step.done));
  const allDone = completed === steps.length;
  const progressPercent = steps.length
    ? Math.round((completed / steps.length) * 100)
    : 0;
  const defaultStepKey = steps[allDone ? steps.length - 1 : activeIndex]!.key;
  const preferredStepKey =
    explorationStep === "flights"
      ? "commit"
      : explorationStep === "places"
        ? "dreaming"
        : defaultStepKey;
  const [selectedStepKey, setSelectedStepKey] =
    useState<PlanningProgressStepKey>(preferredStepKey);
  const selectedStepKeyForRender =
    explorationStep != null
      ? preferredStepKey
      : steps.some((step) => step.key === selectedStepKey)
        ? selectedStepKey
        : preferredStepKey;
  const selectedStep =
    steps.find((step) => step.key === selectedStepKeyForRender) ??
    steps[allDone ? steps.length - 1 : activeIndex]!;
  const selectedStepLabels = progressLabels.steps[selectedStep.key];
  const selectedStepIndex = steps.findIndex((step) => step.key === selectedStep.key);
  const selectedStatusLabel = selectedStep.done
    ? progressLabels.done_label
    : selectedStepIndex === activeIndex
      ? progressLabels.current_label
      : progressLabels.upcoming_label;
  const [selectedDestinationCodes, setSelectedDestinationCodes] = useState(
    () => planningMetadata.mainDestinations,
  );
  const [destinationNameDraft, setDestinationNameDraft] = useState("");
  const [destinationLookupError, setDestinationLookupError] = useState(false);
  const [savingMetadata, setSavingMetadata] = useState(false);
  const [returningToExplore, setReturningToExplore] = useState(false);
  const [metadataStatus, setMetadataStatus] =
    useState<"idle" | "saved" | "error">("idle");
  const canReturnToExplore =
    selectedStep.key === "dreaming" && metadata.source === "explore_confirmed";

  function addDestinationFromDraft() {
    const nextCodes = countryCodesFromInput(destinationNameDraft);
    if (nextCodes.length === 0) {
      setDestinationLookupError(destinationNameDraft.trim().length > 0);
      return;
    }

    setSelectedDestinationCodes((current) =>
      Array.from(new Set([...current, ...nextCodes])),
    );
    setDestinationNameDraft("");
    setDestinationLookupError(false);
    setMetadataStatus("idle");
  }

  function removeDestination(code: string) {
    setSelectedDestinationCodes((current) =>
      current.filter((item) => item !== code),
    );
    setMetadataStatus("idle");
  }

  async function savePlanningMetadata() {
    if (savingMetadata) return;
    setSavingMetadata(true);
    setMetadataStatus("idle");
    const nextPlanning = {
      inspiration: planningMetadata.inspiration,
      main_destinations: selectedDestinationCodes,
      destination_days: planningMetadata.destinationDays.map((item) => ({
        country_code: item.countryCode,
        days: item.days,
      })),
    };
    try {
      await onUpdateMetadata({
        ...metadata,
        planning: nextPlanning,
      });
      setMetadataStatus("saved");
    } catch {
      setMetadataStatus("error");
    } finally {
      setSavingMetadata(false);
    }
  }

  async function returnToExplore() {
    if (returningToExplore) return;
    setReturningToExplore(true);
    setMetadataStatus("idle");
    const planning =
      metadata.planning && typeof metadata.planning === "object"
        ? (metadata.planning as Record<string, unknown>)
        : {};
    try {
      await onUpdateMetadata({
        ...metadata,
        source: "explore",
        planning: {
          ...planning,
          main_destinations: [],
          destination_days: [],
        },
      });
      setSelectedDestinationCodes([]);
    } catch {
      setMetadataStatus("error");
      setReturningToExplore(false);
    }
  }

  return (
    <section className="space-y-4">
      <div className="rounded-[24px] border border-divider bg-white p-4 shadow-sm">
        <div className="flex items-end justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-[18px] font-semibold tracking-tight text-fg">
              {progressLabels.title}
            </h2>
            <p className="mt-1 text-[12px] leading-5 text-fg-muted">
              {formatTemplate(progressLabels.progress_label, {
                done: String(completed),
                total: String(steps.length),
              })}
            </p>
          </div>
          <div className="shrink-0 text-right">
            <span className="text-[30px] font-semibold leading-none tracking-tight text-accent">
              {progressPercent}%
            </span>
          </div>
        </div>

        <div className="mt-4 h-2 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-accent transition-[width] duration-500 ease-out"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        <div className="mt-5 overflow-hidden rounded-[22px] border border-divider bg-white">
          {steps.map((step, index) => {
            const stepLabels = progressLabels.steps[step.key];
            const current = !allDone && index === activeIndex;
            const selected = step.key === selectedStep.key;
            const tone = routeTone(index);
            const statusLabel = step.done
              ? progressLabels.done_label
                : current
                  ? progressLabels.current_label
                  : progressLabels.upcoming_label;

            return (
              <button
                key={step.key}
                type="button"
                className={cn(
                  "group relative flex min-h-[74px] w-full items-center gap-3 border-b border-divider px-3 py-3 text-left transition last:border-b-0",
                  selected
                    ? cn(tone.soft, tone.text, "shadow-[inset_3px_0_0_currentColor]")
                    : "bg-white hover:bg-surface/70",
                )}
                title={`${stepLabels.phase} · ${stepLabels.title} · ${statusLabel}`}
                aria-label={`${stepLabels.phase} ${stepLabels.title} ${statusLabel}`}
                aria-pressed={selected}
                onClick={() => {
                  setSelectedStepKey(step.key);
                  if (step.key === "commit") {
                    onExplorationStepChange?.("flights");
                  } else if (step.key === "dreaming") {
                    onExplorationStepChange?.("places");
                  }
                }}
              >
                <span
                  className={cn(
                    "relative grid h-10 w-10 shrink-0 place-items-center rounded-full border transition",
                    step.done
                      ? "border-[#9bd8b8]/65 bg-[#eaf7f1] text-[#34866b]"
                      : current
                        ? cn(tone.border, tone.soft, tone.text)
                        : "border-divider bg-muted text-fg-muted",
                  )}
                >
                  <step.Icon className="h-[18px] w-[18px]" />
                  {step.done ? (
                    <span
                      className="absolute -bottom-0.5 -right-0.5 grid h-4 w-4 place-items-center rounded-full border border-white bg-[#3da56d] text-white shadow-[0_2px_8px_rgba(32,41,46,0.18)]"
                      aria-hidden
                    >
                      <Check className="h-2.5 w-2.5 stroke-[3]" />
                    </span>
                  ) : null}
                </span>
                <span className="min-w-0 flex-1">
                  <span
                    className={cn(
                      "block truncate text-[14px] font-semibold",
                      selected ? tone.text : "text-fg",
                    )}
                  >
                    {stepLabels.phase} · {stepLabels.title}
                  </span>
                  <span className="mt-0.5 block truncate text-[12px] font-medium text-fg-muted">
                    {step.done ? stepLabels.done : stepLabels.next}
                  </span>
                </span>
                <span
                  className={cn(
                    "shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold",
                    step.done
                      ? "bg-[#eaf7f1] text-[#34866b]"
                      : current
                        ? cn(tone.soft, tone.text)
                        : "bg-muted text-fg-muted",
                  )}
                >
                  {statusLabel}
                </span>
                <ChevronRight
                  className={cn(
                    "h-4 w-4 shrink-0 transition group-hover:translate-x-0.5",
                    selected ? tone.text : "text-fg-subtle",
                  )}
                />
              </button>
            );
          })}
        </div>
      </div>

      <div className="rounded-[22px] border border-accent/25 bg-accent-softer p-3">
        <div className="flex min-w-0 items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-accent">
              {selectedStepLabels.phase}
            </p>
            <h3 className="truncate text-[15px] font-semibold text-fg">
              {selectedStepLabels.title}
            </h3>
          </div>
          <span className="shrink-0 rounded-full bg-white px-2 py-1 text-[10.5px] font-semibold text-accent">
            {selectedStatusLabel}
          </span>
        </div>
        <p className="mt-2 text-[12px] leading-5 text-fg-muted">
          {selectedStep.done ? selectedStepLabels.done : selectedStepLabels.next}
        </p>
        <div className="mt-3 space-y-3 rounded-2xl border border-white/70 bg-white/78 p-3">
          <p className="text-[12px] leading-5 text-fg-secondary">
            {selectedStepLabels.body}
          </p>
          {selectedStep.key === "dreaming" ? (
            <div className="space-y-2">
              <div>
                <label className="block text-[11px] font-semibold text-fg-muted">
                  {progressLabels.destinations_label}
                </label>
                {selectedDestinationCodes.length > 0 ? (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {selectedDestinationCodes.map((code) => {
                      const countryName = countryNameForCode(code, lang);
                      return (
                        <span
                          key={code}
                          className="inline-flex items-center gap-1.5 rounded-full bg-accent-soft px-2.5 py-1 text-[11.5px] font-semibold text-accent"
                        >
                          {countryName}
                          <button
                            type="button"
                            className="grid h-4 w-4 place-items-center rounded-full text-accent/75 transition hover:bg-white hover:text-accent"
                            aria-label={formatTemplate(
                              progressLabels.remove_destination,
                              { country: countryName },
                            )}
                            onClick={() => removeDestination(code)}
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      );
                    })}
                  </div>
                ) : (
                  <p className="mt-2 rounded-2xl border border-dashed border-divider bg-white px-3 py-2 text-[12px] text-fg-muted">
                    {progressLabels.destinations_empty}
                  </p>
                )}
              </div>
              <div className="flex gap-2">
                <Input
                  value={destinationNameDraft}
                  placeholder={progressLabels.destinations_placeholder}
                  className="h-10 min-w-0 rounded-2xl border-divider bg-white text-[13px] shadow-none focus-visible:ring-accent/25"
                  onChange={(event) => {
                    setDestinationNameDraft(event.target.value);
                    setDestinationLookupError(false);
                  }}
                  onKeyDown={(event) => {
                    if (event.key !== "Enter") return;
                    event.preventDefault();
                    addDestinationFromDraft();
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  className="h-10 shrink-0 rounded-xl border-accent/35 bg-white px-3 text-[12px] font-semibold text-accent hover:bg-accent-soft"
                  onClick={addDestinationFromDraft}
                >
                  <Plus className="h-3.5 w-3.5" />
                  {progressLabels.add_destination}
                </Button>
              </div>
              {destinationLookupError ? (
                <p className="text-[11px] font-semibold text-danger">
                  {progressLabels.destination_lookup_error}
                </p>
              ) : null}
              <div className="flex items-center gap-2">
                {canReturnToExplore ? (
                  <Button
                    type="button"
                    variant="outline"
                    disabled={returningToExplore}
                    className="h-9 rounded-xl border-divider bg-white px-3 text-[12px] font-semibold text-fg-secondary hover:border-accent/35 hover:bg-accent-soft hover:text-accent disabled:cursor-wait disabled:opacity-60"
                    onClick={() => void returnToExplore()}
                  >
                    {returningToExplore ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <ChevronLeft className="h-3.5 w-3.5" />
                    )}
                    {returningToExplore
                      ? progressLabels.returning_to_explore
                      : progressLabels.return_to_explore}
                  </Button>
                ) : null}
                <Button
                  type="button"
                  variant="outline"
                  disabled={savingMetadata}
                  className="h-9 rounded-xl border-accent/35 bg-white px-3 text-[12px] font-semibold text-accent hover:bg-accent-soft disabled:cursor-wait disabled:opacity-60"
                  onClick={() => void savePlanningMetadata()}
                >
                  {savingMetadata ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Save className="h-3.5 w-3.5" />
                  )}
                  {progressLabels.save}
                </Button>
                {metadataStatus === "saved" ? (
                  <span className="text-[11px] font-semibold text-accent">
                    {progressLabels.saved}
                  </span>
                ) : metadataStatus === "error" ? (
                  <span className="text-[11px] font-semibold text-danger">
                    {progressLabels.save_error}
                  </span>
                ) : null}
              </div>
            </div>
          ) : null}
          {selectedStep.key === "timing" ? (
            <div className="grid grid-cols-2 gap-2">
              <PlanningMetric
                label={progressLabels.date_range_label}
                value={`${formatDateShort(days[0]?.date)} - ${formatDateShort(
                  days.at(-1)?.date,
                )}`}
              />
              <PlanningMetric
                label={progressLabels.duration_label}
                value={`${days.length} ${labels.day_unit}`}
              />
              {planningMetadata.destinationDays.length > 0 ? (
                <div className="col-span-2 rounded-2xl border border-divider bg-white px-3 py-2">
                  <p className="text-[11px] font-semibold text-fg-muted">
                    {progressLabels.destination_days_label}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {planningMetadata.destinationDays.map((item) => (
                      <span
                        key={item.countryCode}
                        className="rounded-full bg-accent-soft px-2.5 py-1 text-[11.5px] font-semibold text-accent"
                      >
                        {countryNameForCode(item.countryCode, lang)} ·{" "}
                        {item.days} {labels.day_unit}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
          {selectedStep.key === "commit" ? (
            <div className="rounded-2xl border border-divider bg-white px-3 py-3">
              <p className="text-[12px] font-semibold text-fg">
                {progressLabels.flight_proof_title}
              </p>
              <p className="mt-1 text-[12px] leading-5 text-fg-muted">
                {progressLabels.flight_proof_body}
              </p>
            </div>
          ) : null}
          <Button
            type="button"
            variant="outline"
            className="h-9 rounded-xl border-accent/35 bg-white px-3 text-[12px] font-semibold text-accent hover:bg-accent-soft"
            onClick={() => {
              window.dispatchEvent(
                new CustomEvent(OPEN_LUMI_ASSISTANT_EVENT, {
                  detail: {
                    prompt: `${selectedStepLabels.title}：${selectedStepLabels.next}`,
                    autoSend: false,
                    newConversation: false,
                  },
                }),
              );
            }}
          >
            {selectedStepLabels.cta}
          </Button>
        </div>
      </div>
    </section>
  );
}

function PlanningMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-divider bg-white px-3 py-2">
      <p className="text-[11px] font-semibold text-fg-muted">{label}</p>
      <p className="mt-1 text-[13px] font-semibold text-fg">{value}</p>
    </div>
  );
}

function TripNotesPanel({
  days,
  labels,
  onUpdateTripNotes,
}: {
  days: TripDayModel[];
  labels: TripPlanningLabels;
  onUpdateTripNotes: (note: string) => void;
}) {
  const noteLabels = noteEditorLabelsFor(labels);
  const documentValue = tripNotesDocument(days);
  const [blocks, setBlocks] = useState(() => noteBlocksFromDocument(documentValue));
  const textAreaRefs = useRef<Array<HTMLTextAreaElement | null>>([]);

  function commitBlocks(nextBlocks: string[]) {
    const safeBlocks = nextBlocks.length > 0 ? nextBlocks : [""];
    setBlocks(safeBlocks);
    onUpdateTripNotes(noteDocumentFromBlocks(safeBlocks));
  }

  function updateBlock(index: number, value: string) {
    commitBlocks(blocks.map((block, blockIndex) => (blockIndex === index ? value : block)));
  }

  function insertBlock(index: number, value = "") {
    const nextBlocks = [
      ...blocks.slice(0, index + 1),
      value,
      ...blocks.slice(index + 1),
    ];
    commitBlocks(nextBlocks);
    window.setTimeout(() => textAreaRefs.current[index + 1]?.focus(), 0);
  }

  function removeBlock(index: number) {
    if (blocks.length <= 1) return;
    const nextBlocks = blocks.filter((_, blockIndex) => blockIndex !== index);
    commitBlocks(nextBlocks);
    window.setTimeout(() => textAreaRefs.current[Math.max(0, index - 1)]?.focus(), 0);
  }

  if (days.length === 0) {
    return (
      <InfoCard
        icon={CalendarDays}
        title={labels.tabs.notes}
        body={labels.notes_empty}
      />
    );
  }

  return (
    <section className="rounded-[24px] border border-divider bg-white p-4 shadow-sm">
      <div className="flex items-start gap-3 border-b border-divider pb-4">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-accent-soft text-accent">
          <MessageSquareText className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <h2 className="text-[18px] font-semibold tracking-tight text-fg">
            {noteLabels.title}
          </h2>
          <p className="mt-1 text-[12px] leading-5 text-fg-muted">
            {noteLabels.subtitle}
          </p>
        </div>
      </div>

      <div className="mt-4 space-y-3">
        {blocks.map((block, index) => (
          <div
            key={index}
            className="group flex items-start gap-2 rounded-2xl border border-transparent bg-surface/70 px-2 py-2 transition hover:border-divider hover:bg-white"
          >
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="mt-1 h-7 w-7 shrink-0 rounded-lg text-fg-muted opacity-0 transition group-hover:opacity-100 focus-visible:opacity-100"
              onClick={() => insertBlock(index)}
              aria-label={noteLabels.empty}
              title={noteLabels.empty}
            >
              <Plus className="h-4 w-4" />
            </Button>
            <Textarea
              ref={(node) => {
                textAreaRefs.current[index] = node;
              }}
              value={block}
              placeholder={index === 0 ? noteLabels.placeholder : ""}
              aria-label={`${noteLabels.title} ${index + 1}`}
              className="min-h-[42px] resize-none rounded-xl border-transparent bg-transparent px-0 py-2 text-[14px] leading-6 text-fg shadow-none ring-offset-0 placeholder:text-fg-subtle focus-visible:border-transparent focus-visible:ring-0 focus-visible:ring-offset-0"
              onChange={(event) => updateBlock(index, event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  insertBlock(index);
                  return;
                }
                if (event.key === "Backspace" && block.length === 0) {
                  event.preventDefault();
                  removeBlock(index);
                }
              }}
            />
          </div>
        ))}
      </div>

      {documentValue.trim().length === 0 ? (
        <p className="mt-4 rounded-2xl bg-muted px-3 py-2 text-[12px] leading-5 text-fg-muted">
          {noteLabels.empty}
        </p>
      ) : null}
    </section>
  );
}

function ChecklistSection({
  group,
  tripId,
  labels,
}: {
  group: ChecklistGroup;
  tripId: string;
  labels: TripPlanningLabels;
}) {
  return (
    <section className="rounded-2xl border border-divider bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className={cn("grid h-10 w-10 place-items-center rounded-full", group.tint)}>
            <group.Icon className="h-5 w-5" />
          </span>
          <h2 className="text-[16px] font-semibold text-fg">
            {group.title}
          </h2>
          <span className="text-[13px] font-semibold text-fg-muted">
            {formatTemplate(labels.todo_count, {
              done: String(group.done),
              total: String(group.items.length),
            })}
          </span>
        </div>
        <ChevronDown className="h-4 w-4 text-fg-muted" />
      </div>
      <div className="mt-3 space-y-3">
        {group.items.map((item) => (
          <TodoRow
            key={item.id}
            item={item}
            tripId={tripId}
            labels={labels}
          />
        ))}
      </div>
    </section>
  );
}

const BUDGET_CHART_CSS = `
.roam-budget-pie {
  animation: roam-budget-pie-in 560ms cubic-bezier(.2,.8,.2,1) both;
}

.roam-budget-bar {
  animation: roam-budget-bar-in 620ms cubic-bezier(.2,.8,.2,1) both;
  animation-delay: var(--bar-delay, 0ms);
  transform-origin: center bottom;
}

@keyframes roam-budget-pie-in {
  from {
    opacity: 0;
    transform: scale(0.86) rotate(-8deg);
  }
  to {
    opacity: 1;
    transform: scale(1) rotate(0deg);
  }
}

@keyframes roam-budget-bar-in {
  from {
    opacity: 0.35;
    height: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    height: var(--bar-height);
    transform: translateY(0);
  }
}

@media (prefers-reduced-motion: reduce) {
  .roam-budget-pie,
  .roam-budget-bar {
    animation: none;
  }
}
`;

function BudgetAnalysisPanel({
  budget,
  labels,
}: {
  budget: BudgetAnalysis;
  labels: TripPlanningLabels;
}) {
  const budgetLabels = budgetLabelsFor(labels);
  const maxCategoryAmount = Math.max(
    1,
    ...budget.categories.map((category) => category.amount),
  );
  const chartCategories = budget.categories.filter((category) => category.amount > 0);
  const pieGradient = budgetPieGradient(chartCategories, budget.total);
  const maxDailyAmount = Math.max(1, ...budget.days.map((day) => day.amount));
  const [expandedBudgetCategory, setExpandedBudgetCategory] =
    useState<BudgetCategory | null>(null);

  if (budget.lines.length === 0) {
    return (
      <InfoCard
        icon={WalletCards}
        title={labels.tabs.budget}
        body={budgetLabels.empty}
      />
    );
  }

  return (
    <section className="space-y-4">
      <style dangerouslySetInnerHTML={{ __html: BUDGET_CHART_CSS }} />
      <div className="rounded-[24px] border border-divider bg-white p-4 shadow-sm">
        <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-accent">
          {budgetLabels.title}
        </p>
        <div className="mt-3 flex items-end justify-between gap-3">
          <div>
            <p className="text-[12px] font-semibold text-fg-muted">
              {budgetLabels.total}
            </p>
            <p className="mt-1 text-[30px] font-semibold tracking-tight text-fg">
              {formatCurrencyTwd(budget.total)}
            </p>
          </div>
          <div className="rounded-2xl bg-accent-soft px-3 py-2 text-right">
            <p className="text-[11px] font-semibold text-accent">
              {budgetLabels.per_day}
            </p>
            <p className="mt-0.5 text-[15px] font-semibold text-fg">
              {formatCurrencyTwd(budget.perDay)}
            </p>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <BudgetMetric
            label={budgetLabels.confirmed}
            value={formatCurrencyTwd(budget.recordedTotal)}
          />
          <BudgetMetric
            label={budgetLabels.estimated}
            value={formatCurrencyTwd(budget.estimatedTotal)}
          />
        </div>
        {budget.missingCount > 0 ? (
          <p className="mt-3 rounded-2xl bg-muted px-3 py-2 text-[12px] leading-5 text-fg-muted">
            {formatTemplate(budgetLabels.missing_hint, {
              count: String(budget.missingCount),
            })}
          </p>
        ) : null}
      </div>

      <div className="space-y-4">
        <div className="rounded-[24px] border border-divider bg-white p-4 shadow-sm">
          <h3 className="text-[15px] font-semibold text-fg">
            {budgetLabels.sections.category_chart}
          </h3>
          <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center">
            <div
              className="roam-budget-pie relative mx-auto grid h-36 w-36 shrink-0 place-items-center rounded-full shadow-[inset_0_0_0_1px_rgba(255,255,255,0.9),0_18px_42px_-30px_rgba(32,41,46,0.55)] sm:mx-0"
              style={{ background: pieGradient }}
              aria-hidden
            >
              <div className="grid h-20 w-20 place-items-center rounded-full bg-white text-center shadow-[0_10px_30px_-24px_rgba(32,41,46,0.75)]">
                <span className="text-[12px] font-semibold text-fg-muted">
                  {budgetLabels.total}
                </span>
                <span className="mt-0.5 text-[13px] font-semibold text-fg">
                  {formatCurrencyTwd(budget.total)}
                </span>
              </div>
            </div>
            <div className="min-w-0 flex-1 space-y-2">
              {chartCategories.map((category) => (
                <div key={category.category} className="flex items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ background: category.color }}
                    aria-hidden
                  />
                  <span className="min-w-0 flex-1 truncate text-[12px] font-semibold text-fg">
                    {category.label}
                  </span>
                  <span className="shrink-0 text-[12px] font-semibold text-fg-secondary">
                    {formatBudgetShare(category.amount, budget.total)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="rounded-[24px] border border-divider bg-white p-4 shadow-sm">
          <h3 className="text-[15px] font-semibold text-fg">
            {budgetLabels.sections.daily_spend}
          </h3>
          <div className="mt-4 flex h-44 items-end gap-2 overflow-x-auto pb-1">
            {budget.days.map((day, index) => {
              const height = day.amount > 0
                ? Math.max(10, (day.amount / maxDailyAmount) * 100)
                : 2;
              const color = BUDGET_CHART_COLORS[index % BUDGET_CHART_COLORS.length]!;
              return (
                <div
                  key={day.dayLabel}
                  className="flex h-full min-w-12 flex-1 flex-col justify-end gap-2"
                >
                  <div className="flex min-h-0 flex-1 items-end rounded-full bg-muted/70 px-1">
                    <div
                      className="roam-budget-bar w-full rounded-full shadow-[0_12px_26px_-20px_rgba(32,41,46,0.65)]"
                      style={{
                        "--bar-height": `${height}%`,
                        "--bar-delay": `${index * 42}ms`,
                        height: `${height}%`,
                        background: color,
                      } as CSSProperties}
                      title={formatCurrencyTwd(day.amount)}
                    />
                  </div>
                  <div className="text-center">
                    <p className="truncate text-[11px] font-semibold text-fg-muted">
                      {day.dayLabel}
                    </p>
                    <p className="truncate text-[11px] font-semibold text-fg-secondary">
                      {formatCompactCurrencyTwd(day.amount)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="rounded-[24px] border border-divider bg-white p-4 shadow-sm">
        <h3 className="text-[15px] font-semibold text-fg">
          {budgetLabels.sections.breakdown}
        </h3>
        <div className="mt-4 space-y-3">
          {budget.categories.map((category) => {
            const expanded = expandedBudgetCategory === category.category;
            const hasLines = category.lines.length > 0;
            return (
              <div key={category.category} className="space-y-2">
                <button
                  type="button"
                  className={cn(
                    "flex w-full items-center justify-between gap-3 rounded-2xl border px-2 py-2 text-left transition",
                    hasLines ? "cursor-pointer" : "cursor-default",
                    expanded
                      ? "border-accent/35 bg-accent-softer"
                      : "border-transparent hover:border-divider hover:bg-surface/70",
                  )}
                  aria-expanded={hasLines ? expanded : undefined}
                  aria-disabled={!hasLines}
                  onClick={() => {
                    if (hasLines) {
                      setExpandedBudgetCategory((current) =>
                        current === category.category ? null : category.category,
                      );
                    }
                  }}
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <span
                      className={cn(
                        "grid h-8 w-8 place-items-center rounded-full",
                        category.tint,
                      )}
                    >
                      <category.Icon className="h-4 w-4" />
                    </span>
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ background: category.color }}
                      aria-hidden
                    />
                    <span className="truncate text-[13px] font-semibold text-fg">
                      {category.label}
                    </span>
                  </div>
                  <span className="flex shrink-0 items-center gap-2 text-[13px] font-semibold text-fg-secondary">
                    {formatCurrencyTwd(category.amount)}
                    <ChevronDown
                      className={cn(
                        "h-4 w-4 text-fg-muted transition-transform",
                        expanded && "rotate-180 text-accent",
                        !hasLines && "opacity-30",
                      )}
                    />
                  </span>
                </button>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-accent"
                    style={{
                      width:
                        category.amount > 0
                          ? `${Math.max(
                              7,
                              (category.amount / maxCategoryAmount) * 100,
                            )}%`
                          : "0%",
                    }}
                  />
                </div>
                <p className="text-[11px] text-fg-muted">
                  {budgetLabels.confirmed}:{" "}
                  {formatCurrencyTwd(category.recordedAmount)}
                  {" · "}
                  {budgetLabels.estimated}:{" "}
                  {formatCurrencyTwd(category.estimatedAmount)}
                </p>
                {expanded && hasLines ? (
                  <div className="space-y-2 rounded-2xl border border-divider bg-white p-2">
                    {category.lines.map((line) => (
                      <BudgetLineItem
                        key={line.id}
                        line={line}
                        labels={budgetLabels}
                      />
                    ))}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
        <p className="mt-3 text-[11px] leading-5 text-fg-muted">
          {budgetLabels.estimate_note}
        </p>
      </div>
    </section>
  );
}

function BudgetMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-divider bg-surface/70 px-3 py-2">
      <p className="text-[11px] font-semibold text-fg-muted">{label}</p>
      <p className="mt-1 text-[15px] font-semibold text-fg">{value}</p>
    </div>
  );
}

function BudgetLineItem({
  line,
  labels,
}: {
  line: BudgetLine;
  labels: BudgetAnalysisLabels;
}) {
  return (
    <div className="rounded-2xl border border-divider bg-surface/70 px-3 py-2">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[13px] font-semibold text-fg">
            {line.label}
          </p>
          <p className="mt-0.5 truncate text-[11px] text-fg-muted">
            {line.dayLabel} · {line.detail}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-[13px] font-semibold text-fg-secondary">
            {line.rawAmount ?? formatCurrencyTwd(line.amount)}
          </p>
          <p
            className={cn(
              "mt-0.5 text-[10px] font-semibold",
              line.source === "recorded" ? "text-accent" : "text-fg-muted",
            )}
          >
            {labels.sources[line.source]}
          </p>
        </div>
      </div>
    </div>
  );
}

function TodoRow({
  item,
  tripId,
  labels,
}: {
  item: ChecklistItem;
  tripId: string;
  labels: TripPlanningLabels;
}) {
  const [done, setDone] = useState(item.done);
  const [text, setText] = useState(item.text);
  const [draftText, setDraftText] = useState(item.text);
  const [editing, setEditing] = useState(false);
  const [savingText, setSavingText] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleted, setDeleted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const latestRequestRef = useRef(0);
  const saveTimerRef = useRef<number | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(
    () => () => {
      if (saveTimerRef.current != null) {
        window.clearTimeout(saveTimerRef.current);
      }
    },
    [],
  );

  useEffect(() => {
    if (editing) {
      window.setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 0);
    }
  }, [editing]);

  function toggle() {
    if (editing || savingText || deleting) return;
    const next = !done;
    const requestId = latestRequestRef.current + 1;
    latestRequestRef.current = requestId;
    setDone(next);

    if (saveTimerRef.current != null) {
      window.clearTimeout(saveTimerRef.current);
    }
    saveTimerRef.current = window.setTimeout(() => {
      saveTimerRef.current = null;
      void (async () => {
        try {
          const res = await fetch(`/api/trips/${tripId}/checklist/${item.id}`, {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ done: next }),
          });
          if (!res.ok) {
            throw new Error(`checklist update failed: ${res.status}`);
          }
          if (latestRequestRef.current === requestId) {
            void refreshTrip(tripId);
          }
        } catch {
          if (latestRequestRef.current === requestId) {
            setDone(!next);
          }
        }
      })();
    }, 260);
  }

  function startEdit() {
    if (deleting) return;
    setError(null);
    setDraftText(text);
    setEditing(true);
  }

  function cancelEdit() {
    setError(null);
    setDraftText(text);
    setEditing(false);
  }

  async function saveEdit(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    const nextText = draftText.trim();
    if (nextText.length === 0 || savingText) return;
    if (nextText === text) {
      setEditing(false);
      setError(null);
      return;
    }

    setSavingText(true);
    setError(null);
    try {
      const res = await fetch(`/api/trips/${tripId}/checklist/${item.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text: nextText }),
      });
      if (!res.ok) throw new Error(`checklist text update failed: ${res.status}`);
      setText(nextText);
      setDraftText(nextText);
      setEditing(false);
      void refreshTrip(tripId);
    } catch {
      setError(labels.todo_save_error);
    } finally {
      setSavingText(false);
    }
  }

  async function deleteItem() {
    if (deleting) return;
    setDeleting(true);
    setDeleted(true);
    setError(null);
    try {
      const res = await fetch(`/api/trips/${tripId}/checklist/${item.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error(`checklist delete failed: ${res.status}`);
      void refreshTrip(tripId);
    } catch {
      setDeleted(false);
      setError(labels.todo_delete_error);
      setDeleting(false);
    }
  }

  if (deleted) return null;

  return (
    <div className="group flex w-full items-start gap-3 rounded-2xl px-1.5 py-1 text-left text-[14px] leading-6 text-fg-secondary transition hover:bg-surface/70">
      <button
        type="button"
        onClick={toggle}
        disabled={editing || savingText || deleting}
        aria-pressed={done}
        className={cn(
          "mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md border transition",
          done
            ? "border-accent bg-accent text-white"
            : "border-divider-strong bg-white text-transparent",
          (editing || savingText || deleting) && "cursor-default opacity-60",
        )}
      >
        {done ? <Check className="h-3.5 w-3.5" /> : null}
      </button>

      <div className="min-w-0 flex-1">
        {editing ? (
          <form className="flex min-w-0 items-center gap-1.5" onSubmit={saveEdit}>
            <Input
              ref={inputRef}
              value={draftText}
              placeholder={labels.todo_edit_placeholder}
              disabled={savingText}
              className="h-8 min-w-0 flex-1 rounded-xl border-divider bg-white px-2.5 text-[13px] font-medium text-fg shadow-none focus-visible:ring-accent/25"
              onChange={(event) => setDraftText(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  event.preventDefault();
                  cancelEdit();
                }
              }}
            />
            <Button
              type="submit"
              variant="ghost"
              size="icon-sm"
              disabled={savingText || draftText.trim().length === 0}
              className="h-8 w-8 shrink-0 rounded-xl text-accent hover:bg-accent-soft hover:text-accent"
              aria-label={labels.todo_save}
              title={labels.todo_save}
            >
              {savingText ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Check className="h-4 w-4" />
              )}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              disabled={savingText}
              className="h-8 w-8 shrink-0 rounded-xl text-fg-muted hover:bg-muted hover:text-fg"
              onClick={cancelEdit}
              aria-label={labels.todo_cancel}
              title={labels.todo_cancel}
            >
              <X className="h-4 w-4" />
            </Button>
          </form>
        ) : (
          <p
            className={cn(
              "min-w-0 break-words pr-1",
              done && "text-fg-muted line-through decoration-divider-strong",
            )}
          >
            {text}
          </p>
        )}
        {error ? (
          <p className="mt-1 text-[11px] font-medium text-danger">{error}</p>
        ) : null}
      </div>

      {!editing ? (
        <div className="flex shrink-0 items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            disabled={deleting}
            className="h-7 w-7 rounded-lg text-fg-muted hover:bg-accent-soft hover:text-accent"
            onClick={startEdit}
            aria-label={labels.todo_edit}
            title={labels.todo_edit}
          >
            <PencilLine className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            disabled={deleting}
            className="h-7 w-7 rounded-lg text-fg-muted hover:bg-danger/10 hover:text-danger"
            onClick={deleteItem}
            aria-label={labels.todo_delete}
            title={labels.todo_delete}
          >
            {deleting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Trash2 className="h-3.5 w-3.5" />
            )}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function InfoCard({
  icon: Icon,
  title,
  body,
}: {
  icon: LucideIcon;
  title: string;
  body: string;
}) {
  return (
    <section className="rounded-2xl border border-divider bg-white p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-accent-soft text-accent">
          <Icon className="h-5 w-5" />
        </span>
        <div>
          <h2 className="text-[16px] font-semibold text-fg">{title}</h2>
          <p className="mt-1 text-[13px] leading-6 text-fg-muted">{body}</p>
        </div>
      </div>
    </section>
  );
}

function buildBudgetAnalysis(
  days: TripDayModel[],
  labels: TripPlanningLabels,
): BudgetAnalysis {
  const lines: BudgetLine[] = [];
  let missingCount = 0;
  const budgetLabels = budgetLabelsFor(labels);

  days.forEach((day, dayIndex) => {
    const dayLabel = formatTemplate(budgetLabels.day_label, {
      n: String(dayIndex + 1),
    });

    day.stops.forEach((stop, stopIndex) => {
      const category = budgetCategoryForStop(stop);
      const rawAmount = stopBudgetAmount(stop);
      const parsedAmount = parseBudgetAmount(rawAmount);
      if (parsedAmount != null && parsedAmount > 0) {
        lines.push({
          id: `stop:${day.date}:${stopIndex}:recorded`,
          category,
          source: "recorded",
          label: stop.name,
          detail: budgetLabels.categories[category],
          dayIndex,
          dayLabel,
          amount: parsedAmount,
          rawAmount,
        });
        return;
      }

      const estimate = estimateStopBudget(stop);
      if (estimate > 0) {
        missingCount += 1;
        lines.push({
          id: `stop:${day.date}:${stopIndex}:estimated`,
          category,
          source: "estimated",
          label: stop.name,
          detail: budgetLabels.categories[category],
          dayIndex,
          dayLabel,
          amount: estimate,
        });
      }
    });

    const localLegs = Math.max(0, day.stops.length - 1);
    if (localLegs > 0) {
      lines.push({
        id: `local-transport:${day.date}`,
        category: "transport",
        source: "estimated",
        label: `${day.city} ${budgetLabels.categories.transport}`,
        detail: `${localLegs} legs`,
        dayIndex,
        dayLabel,
        amount: localLegs * 250,
      });
    }

    const previousDay = days[dayIndex - 1];
    if (
      previousDay &&
      previousDay.city !== day.city &&
      shouldEstimateIntercityTransport(previousDay, day)
    ) {
      lines.push({
        id: `intercity-transport:${previousDay.city}:${day.city}:${day.date}`,
        category: "transport",
        source: "estimated",
        label: `${previousDay.city} → ${day.city}`,
        detail: budgetLabels.categories.transport,
        dayIndex,
        dayLabel,
        amount: 1250,
      });
    }
  });

  const categories = budgetCategoryOrder(labels).map((category) => {
    const categoryLines = lines.filter((line) => line.category === category.key);
    return {
      category: category.key,
      label: category.label,
      amount: sumBudget(categoryLines),
      recordedAmount: sumBudget(
        categoryLines.filter((line) => line.source === "recorded"),
      ),
      estimatedAmount: sumBudget(
        categoryLines.filter((line) => line.source === "estimated"),
      ),
      lines: categoryLines,
      Icon: category.Icon,
      tint: category.tint,
      color: category.color,
    } satisfies BudgetCategorySummary;
  });
  const daySummaries = days.map((_, dayIndex) => {
    const dayLabel = formatTemplate(budgetLabels.day_label, {
      n: String(dayIndex + 1),
    });
    const dayLines = lines.filter((line) => line.dayIndex === dayIndex);
    return {
      dayLabel,
      amount: sumBudget(dayLines),
      recordedAmount: sumBudget(dayLines.filter((line) => line.source === "recorded")),
      estimatedAmount: sumBudget(dayLines.filter((line) => line.source === "estimated")),
    } satisfies BudgetDailySummary;
  });
  const total = sumBudget(lines);

  return {
    total,
    recordedTotal: sumBudget(lines.filter((line) => line.source === "recorded")),
    estimatedTotal: sumBudget(lines.filter((line) => line.source === "estimated")),
    perDay: days.length > 0 ? total / days.length : 0,
    missingCount,
    categories,
    days: daySummaries,
    lines: lines.sort((a, b) => b.amount - a.amount),
  };
}

function budgetLabelsFor(labels: TripPlanningLabels): BudgetAnalysisLabels {
  return (
    (labels as Partial<TripPlanningLabels>).budget_analysis ?? {
      title: "預算分析",
      total: "預計總額",
      confirmed: "已填金額",
      estimated: "系統估算",
      missing: "缺少金額",
      per_day: "每日平均",
      categories: {
        flight: "機票",
        stay: "住宿",
        food: "餐廳",
        transport: "交通車費",
        activities: "活動與門票",
        other: "其他",
      },
      sources: {
        recorded: "已填",
        estimated: "估算",
      },
      sections: {
        breakdown: "分類花費",
        category_chart: "分類花費圓餅圖",
        daily_spend: "每日花費",
        details: "花費明細",
        gaps: "預算缺口",
      },
      empty: "從地圖地點資訊卡填入預算後，就能開始分析整趟行程花費。",
      estimate_note:
        "估算項目會依行程類型推算；點擊地圖上的地點後可以改成實際預算。",
      missing_hint:
        "還有 {count} 個行程項目使用估算金額。從地圖地點資訊卡補上預算後，預測會更準。",
      day_label: "Day {n}",
    }
  );
}

function noteEditorLabelsFor(labels: TripPlanningLabels): TripPlanningLabels["note_editor"] {
  return (
    (labels as Partial<TripPlanningLabels>).note_editor ?? {
      title: labels.tabs.notes,
      subtitle: labels.notes_empty,
      placeholder: "記下當天的住宿、靈感、提醒或 Lumi 建議。",
      empty: labels.notes_empty,
    }
  );
}

function mapAutoplayLabelsFor(
  labels: TripPlanningLabels,
): TripPlanningLabels["map_autoplay"] {
  return (
    (labels as Partial<TripPlanningLabels>).map_autoplay ?? {
      play: "Start map autoplay",
      pause: "Pause map autoplay",
    }
  );
}

function autoArrangeLabelsFor(labels: TripPlanningLabels) {
  return {
    arrange: labels.stop_actions.auto_arrange ?? "Auto arrange",
    arranging: labels.stop_actions.auto_arranging ?? "Arranging",
    saved: labels.stop_actions.auto_arranged ?? "Arranged.",
    noChange: labels.stop_actions.auto_arrange_no_change ?? "Order already works.",
    hoursBlocked:
      labels.stop_actions.auto_arrange_hours_blocked ??
      "No route fits all opening hours.",
    failed: labels.stop_actions.auto_arrange_failed ?? "Could not arrange stops.",
  };
}

function tripNotesDocument(days: TripDayModel[]): string {
  return days
    .map((day) => day.note.trim())
    .filter(Boolean)
    .join("\n\n");
}

function noteBlocksFromDocument(documentValue: string): string[] {
  const blocks = documentValue
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);
  return blocks.length > 0 ? blocks : [""];
}

function noteDocumentFromBlocks(blocks: string[]): string {
  return blocks
    .map((block) => block.trim())
    .filter(Boolean)
    .join("\n\n");
}

function budgetCategoryOrder(labels: TripPlanningLabels): Array<{
  key: BudgetCategory;
  label: string;
  Icon: LucideIcon;
  tint: string;
  color: string;
}> {
  const categoryLabels = budgetLabelsFor(labels).categories;
  return [
    { key: "flight", label: categoryLabels.flight, Icon: Plane, tint: "bg-[#e8f5fb] text-[#2e7fa6]", color: "var(--chart-2)" },
    { key: "stay", label: categoryLabels.stay, Icon: BedDouble, tint: "bg-[#eaf7f1] text-[#34866b]", color: "var(--chart-4)" },
    { key: "food", label: categoryLabels.food, Icon: Utensils, tint: "bg-[#fff2dc] text-[#b26a17]", color: "var(--chart-3)" },
    { key: "transport", label: categoryLabels.transport, Icon: TrainFront, tint: "bg-[#eef4ff] text-[#4b75b7]", color: "var(--chart-1)" },
    { key: "activities", label: categoryLabels.activities, Icon: Camera, tint: "bg-[#f1edff] text-[#7357b8]", color: "var(--chart-5)" },
    { key: "other", label: categoryLabels.other, Icon: WalletCards, tint: "bg-muted text-fg-muted", color: "var(--fg-muted)" },
  ];
}

function budgetCategoryForStop(stop: TripDayModel["stops"][number]): BudgetCategory {
  const kind = stop.kind ?? "other";
  if (kind === "flight") return "flight";
  if (kind === "stay") return "stay";
  if (kind === "meal") return "food";
  if (kind === "sight" || kind === "ticket") return "activities";
  if (kind === "transport" || kind === "transit" || kind === "airport_transfer") {
    return "transport";
  }
  return "other";
}

function estimateStopBudget(stop: TripDayModel["stops"][number]): number {
  if (isTransitAnchorStop(stop)) return 0;

  switch (budgetCategoryForStop(stop)) {
    case "flight":
      return 0;
    case "stay":
      return 4200;
    case "food":
      return 1000;
    case "transport":
      return 700;
    case "activities":
      return 650;
    case "other":
      return 0;
  }
}

function shouldEstimateIntercityTransport(
  previousDay: TripDayModel,
  day: TripDayModel,
): boolean {
  return hasSubstantiveBudgetStops(previousDay) && hasSubstantiveBudgetStops(day);
}

function hasSubstantiveBudgetStops(day: TripDayModel): boolean {
  return day.stops.some((stop) => !isTransitAnchorStop(stop));
}

function isTransitAnchorStop(stop: TripDayModel["stops"][number]): boolean {
  const kind = stop.kind ?? "other";
  return ["airport_transfer", "flight"].includes(kind);
}

function parseBudgetAmount(amount: string): number | null {
  const normalized = amount.replace(/,/g, "").match(/\d+(?:\.\d+)?/);
  if (!normalized) return null;
  const value = Number(normalized[0]);
  return Number.isFinite(value) ? value : null;
}

function sumBudget(lines: BudgetLine[]): number {
  return lines.reduce((sum, line) => sum + line.amount, 0);
}

const BUDGET_CHART_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "var(--fg-muted)",
];

function budgetPieGradient(
  categories: BudgetCategorySummary[],
  total: number,
): string {
  if (total <= 0 || categories.length === 0) return "var(--muted)";
  let cursor = 0;
  const segments = categories.map((category) => {
    const start = cursor;
    const end = Math.min(100, cursor + (category.amount / total) * 100);
    cursor = end;
    return `${category.color} ${start}% ${end}%`;
  });
  return `conic-gradient(${segments.join(", ")})`;
}

function formatBudgetShare(amount: number, total: number): string {
  if (total <= 0) return "0%";
  return `${Math.round((amount / total) * 100)}%`;
}

function formatCurrencyTwd(value: number): string {
  return new Intl.NumberFormat("zh-TW", {
    style: "currency",
    currency: "TWD",
    maximumFractionDigits: 0,
  }).format(Math.round(value));
}

function formatCompactCurrencyTwd(value: number): string {
  if (value >= 1000000) return `NT$${Math.round(value / 1000000)}M`;
  if (value >= 10000) return `NT$${Math.round(value / 1000)}k`;
  return `NT$${Math.round(value).toLocaleString("en-US")}`;
}

function AvatarStack({
  companions,
  interactive = false,
}: {
  companions: ApiCompanion[];
  interactive?: boolean;
}) {
  const visible = companions.slice(0, 3);
  const extra = Math.max(0, companions.length - visible.length);
  return (
    <div
      className={cn(
        "flex -space-x-2 rounded-full transition duration-200",
        interactive &&
          "group-hover:-translate-y-0.5 group-hover:drop-shadow-md",
      )}
    >
      {visible.map((companion, index) => (
        <span
          key={companion.id}
          className={cn(
            "grid h-8 w-8 place-items-center rounded-full border-2 border-white text-[11px] font-semibold text-white transition duration-200",
            interactive && "group-hover:ring-2 group-hover:ring-accent/20",
          )}
          style={{ background: companion.color || avatarColor(index) }}
        >
          {companion.display_name.slice(0, 1)}
        </span>
      ))}
      {extra > 0 ? (
        <span
          className={cn(
            "grid h-8 w-8 place-items-center rounded-full border-2 border-white bg-surface text-[12px] font-semibold text-fg-muted transition duration-200",
            interactive && "group-hover:ring-2 group-hover:ring-accent/20",
          )}
        >
          +{extra}
        </span>
      ) : null}
    </div>
  );
}

function defaultDaySegmentForCity(city: string): TripDaySegment {
  return {
    city,
    start_part: "full_day",
    end_part: "full_day",
    note: "",
  };
}

function normalizeDaySegmentsForModel(
  segments: TripDaySegment[] | undefined,
  cities: string[],
): TripDaySegment[] {
  const normalized = (segments ?? [])
    .map((segment) => ({
      city: segment.city.trim(),
      start_part: segment.start_part,
      end_part: segment.end_part,
      note: segment.note ?? "",
    }))
    .filter((segment) => segment.city);
  if (normalized.length > 0) return normalized;
  if (cities.length === 0) return [];
  return cities.map(defaultDaySegmentForCity);
}

function buildTripModel(
  trip: Trip,
  cities: ApiCity[],
  labels: TripPlanningLabels,
): TripModel {
  const cityLookup = new Map(
    cities.map((city) => [normalizePlaceToken(city.name), city]),
  );
  const days = trip.days.map((day) => {
    const cityCoords = coordinatesForPlace(day.city, cityLookup);
    const dayCities = day.cities ?? [day.city].filter(Boolean);
      return {
        date: day.d,
        city: day.city,
        cities: dayCities,
        segments: normalizeDaySegmentsForModel(
          day.segments,
          dayCities,
        ),
        ...cityCoords,
      note: day.note,
      stops: (day.stops ?? []).map((stop) => ({
        id: stop.id,
        name: stop.name,
        anchorMode: stop.anchorMode,
        placeName: stop.placeName,
        placeId: stop.placeId,
        placeAddress: stop.placeAddress,
        areaName: stop.areaName,
        searchQuery: stop.searchQuery,
        countryCode: stop.countryCode,
        placeTypes: stop.placeTypes,
        suggestionCount: stop.suggestionCount,
        placeSuggestions: stop.placeSuggestions,
        suggestionsStatus: stop.suggestionsStatus,
        kind: normalizeKind(stop.kind),
        arrival_time: stop.arrival_time,
        duration_min: stop.duration_min,
        note: stop.note,
        attachments: stop.attachments,
        lat:
          stop.lat ??
          coordinatesForStop(stop, cityLookup).lat,
        lng:
          stop.lng ??
          coordinatesForStop(stop, cityLookup).lng,
      })),
    };
  });

  return {
    id: trip.id,
    title: trip.title,
    cover: trip.cover || null,
    destination: cities.map((city) => city.name).join(" · ") || days[0]?.city || "",
    startDate: trip.start,
    endDate: trip.end,
    metadata: trip.metadata ?? {},
    days,
    checklist: buildChecklistGroups(trip.checklist, labels),
    notes: days.map((day) => day.note).filter(Boolean),
  };
}

function buildPlanningProgressSteps(
  days: TripDayModel[],
  checklist: ChecklistGroup[],
  metadata: TripPlanningMetadata,
  explorationStep: ExplorationStep | null = null,
): PlanningProgressStep[] {
  const allStops = days.flatMap((day) => day.stops);
  const nonEmptyCities = new Set(
    days.map((day) => day.city.trim()).filter(Boolean),
  );
  const cityCoverage = days.length
    ? days.filter((day) => day.city.trim()).length / days.length
    : 0;
  const poiStops = allStops.filter(isPoiPlanningStop);
  const fixedStops = allStops.filter(isFixedAnchorStop);
  const flightStops = allStops.filter(isFlightLikeStop);
  const logisticsStops = allStops.filter(isLogisticsStop);
  const daysWithPoiClusters = days.filter(
    (day) => day.stops.filter(isPoiPlanningStop).length >= 2,
  ).length;
  const checklistItems = checklist.flatMap((group) => group.items);
  const checklistDone = checklistItems.filter((item) => item.done).length;
  const preparationItems = checklist
    .filter((group) => group.key === "preparation" || group.key === "transport")
    .flatMap((group) => group.items);
  const preparationDone = preparationItems.filter((item) => item.done).length;
  const explorationComplete = explorationStep === "flights";
  const dreamingReady =
    days.length > 0 &&
    (metadata.inspiration.length > 0 ||
      metadata.mainDestinations.length > 0 ||
      metadata.inspirationWishlist.length > 0 ||
      nonEmptyCities.size > 0 ||
      poiStops.length > 0);
  const dreamingPartial =
    days.length > 0 ||
    metadata.inspiration.length > 0 ||
    metadata.mainDestinations.length > 0 ||
    metadata.inspirationWishlist.length > 0 ||
    explorationStep === "places";

  return [
    {
      key: "dreaming",
      Icon: Globe,
      done: explorationComplete || dreamingReady,
      signal: explorationComplete || dreamingReady
        ? "ready"
        : dreamingPartial
          ? "partial"
          : "empty",
    },
    {
      key: "commit",
      Icon: Plane,
      done: flightStops.length > 0,
      signal: flightStops.length > 0 ? "ready" : "empty",
    },
    {
      key: "macro",
      Icon: MapPin,
      done: days.length > 0 && cityCoverage >= 0.75,
      signal:
        cityCoverage >= 0.75
          ? "ready"
          : cityCoverage > 0
            ? "partial"
            : "empty",
    },
    {
      key: "anchors",
      Icon: Ticket,
      done: fixedStops.length >= 2,
      signal:
        fixedStops.length >= 2
          ? "ready"
          : fixedStops.length > 0
            ? "partial"
            : "empty",
    },
    {
      key: "poi",
      Icon: Camera,
      done: poiStops.length >= 5,
      signal:
        poiStops.length >= 5
          ? "ready"
          : poiStops.length > 0
            ? "partial"
            : "empty",
    },
    {
      key: "routing",
      Icon: ArrowDownUp,
      done: daysWithPoiClusters >= 2 || poiStops.length >= Math.max(4, days.length),
      signal:
        daysWithPoiClusters >= 2 || poiStops.length >= Math.max(4, days.length)
          ? "ready"
          : poiStops.length > 1
            ? "partial"
            : "empty",
    },
    {
      key: "logistics",
      Icon: TrainFront,
      done: logisticsStops.length >= 2,
      signal:
        logisticsStops.length >= 2
          ? "ready"
          : logisticsStops.length > 0
            ? "partial"
            : "empty",
    },
    {
      key: "pretrip",
      Icon: Check,
      done:
        preparationItems.length > 0 &&
        preparationDone === preparationItems.length &&
        checklistDone > 0,
      signal:
        preparationItems.length > 0 && preparationDone === preparationItems.length
          ? "ready"
          : checklistDone > 0
            ? "partial"
            : "empty",
    },
  ];
}

function readTripPlanningMetadata(metadata: Record<string, unknown>): TripPlanningMetadata {
  const planning =
    metadata.planning && typeof metadata.planning === "object"
      ? (metadata.planning as Record<string, unknown>)
      : {};
  const mainDestinations = Array.isArray(planning.main_destinations)
    ? Array.from(
        new Set(
          planning.main_destinations
            .filter((item): item is string => typeof item === "string")
            .map((item) => countryCodeFromInput(item) ?? item.trim().toUpperCase())
            .filter((item) => /^[A-Z]{2}$/.test(item)),
        ),
      )
    : [];
  const destinationDays = Array.isArray(planning.destination_days)
    ? planning.destination_days
        .map((item) => {
          if (!item || typeof item !== "object") return null;
          const record = item as Record<string, unknown>;
          const countryCode =
            typeof record.country_code === "string"
              ? (countryCodeFromInput(record.country_code) ??
                record.country_code.trim().toUpperCase())
              : "";
          const days = Number(record.days);
          if (
            !/^[A-Z]{2}$/.test(countryCode) ||
            !Number.isFinite(days) ||
            days <= 0
          ) {
            return null;
          }
          return { countryCode, days: Math.floor(days) };
        })
        .filter((item): item is { countryCode: string; days: number } => !!item)
    : [];
  const inspirationWishlist = Array.isArray(planning.inspiration_wishlist)
    ? planning.inspiration_wishlist
        .map((item) =>
          item && typeof item === "object"
            ? inspirationWishlistItemFromMetadata(item as Record<string, unknown>)
            : null,
        )
        .filter((item): item is InspirationWishlistItem => item != null)
    : [];
  const inferredDestinations = Array.from(
    new Set(destinationDays.map((item) => item.countryCode)),
  );
  return {
    inspiration:
      typeof planning.inspiration === "string" ? planning.inspiration : "",
    mainDestinations:
      mainDestinations.length > 0 ? mainDestinations : inferredDestinations,
    destinationDays,
    inspirationWishlist,
  };
}

function inspirationWishlistItemFromMetadata(
  item: Record<string, unknown>,
): InspirationWishlistItem | null {
  const id = typeof item.id === "string" ? item.id : "";
  const title = typeof item.title === "string" ? item.title : "";
  const countryCode =
    typeof item.countryCode === "string"
      ? item.countryCode
      : typeof item.country_code === "string"
        ? item.country_code
        : "";
  const lat = typeof item.lat === "number" ? item.lat : null;
  const lng = typeof item.lng === "number" ? item.lng : null;
  if (!id || !title || !countryCode || lat == null || lng == null) return null;
  return {
    id,
    title,
    category: typeof item.category === "string" ? item.category : "",
    location: typeof item.location === "string" ? item.location : "",
    description: typeof item.description === "string" ? item.description : "",
    countryCode: countryCode.toUpperCase(),
    image: typeof item.image === "string" ? item.image : "",
    lat,
    lng,
    tone: isSpotlightTone(item.tone) ? item.tone : "cyan",
  };
}

function isSpotlightTone(value: unknown): value is InspirationWishlistItem["tone"] {
  return (
    value === "coral" ||
    value === "gold" ||
    value === "green" ||
    value === "cyan" ||
    value === "violet" ||
    value === "rose"
  );
}

function fallbackInspirationEventCopy(id: string) {
  const title = id
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
  return {
    id,
    title,
    category: "活動",
    location: "世界",
    description: "一個值得放進旅行靈感雷達的世界事件。",
    story_headline: "世界正在發生的旅行理由，適合先收藏，再慢慢決定是否出發。",
    story_timing_label: "推薦時間",
    story_timing_value: "規劃中",
  };
}

function countryCodesFromInput(value: string): string[] {
  return Array.from(
    new Set(
      value
        .split(/[,，、\n]+/)
        .map((item) => countryCodeFromInput(item))
        .filter((item): item is string => !!item),
    ),
  );
}

function countryCodeFromInput(value: string): string | null {
  const input = value.trim();
  if (!input) return null;
  const code = input.toUpperCase();
  if (/^[A-Z]{2}$/.test(code)) return code;
  return COUNTRY_INPUT_ALIASES[input.toLowerCase()] ?? COUNTRY_INPUT_ALIASES[input] ?? null;
}

function countryNameForCode(code: string, lang: string): string {
  const normalized = code.trim().toUpperCase();
  if (!normalized) return "-";
  if (lang === "zh-TW" && COUNTRY_NAME_ZH[normalized]) {
    return COUNTRY_NAME_ZH[normalized];
  }

  try {
    const displayNames = new Intl.DisplayNames(
      [lang === "zh-TW" ? "zh-Hant-TW" : lang],
      { type: "region" },
    );
    return displayNames.of(normalized) ?? normalized;
  } catch {
    return COUNTRY_NAME_ZH[normalized] ?? normalized;
  }
}

function formatDateShort(value: string | undefined): string {
  if (!value) return "-";
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return value;
  return `${Number(match[2])}/${Number(match[3])}`;
}

function blankDaysForDateRange(
  startDate: string,
  endDate: string,
  items: InspirationWishlistItem[],
  lang: string,
): TripDayModel[] {
  const dates = datesBetween(startDate, endDate);
  const inspirationNote = inspirationNotebookNote(items, lang);
  return dates.map((date, index) => ({
    date,
    city: "",
    cities: [],
    segments: [],
    lat: null,
    lng: null,
    note: index === 0 ? inspirationNote : "",
    stops: [],
  }));
}

function datesBetween(startDate: string, endDate: string): string[] {
  const start = dateFromIso(startDate);
  const end = dateFromIso(endDate < startDate ? startDate : endDate);
  if (!start || !end) return [new Date().toISOString().slice(0, 10)];
  const dates: string[] = [];
  const cursor = new Date(start);
  while (cursor <= end && dates.length < 120) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates.length > 0 ? dates : [startDate];
}

function dateFromIso(value: string): Date | null {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return Number.isNaN(date.getTime()) ? null : date;
}

function inspirationNotebookNote(
  items: InspirationWishlistItem[],
  lang: string,
): string {
  const title = lang === "zh-TW" ? "待安排活動" : "Saved inspiration";
  return [
    title,
    ...items.map((item) => {
      const country = countryNameForCode(item.countryCode, lang);
      return `- ${item.title} · ${item.location || country}`;
    }),
  ].join("\n");
}

function isFlightLikeStop(stop: TripDayModel["stops"][number]): boolean {
  return stop.kind === "flight";
}

function isLogisticsStop(stop: TripDayModel["stops"][number]): boolean {
  return ["flight", "transit", "transport", "airport_transfer"].includes(
    stop.kind ?? "",
  );
}

function isFixedAnchorStop(stop: TripDayModel["stops"][number]): boolean {
  const hasAttachment = (stop.attachments?.length ?? 0) > 0;
  const hasSpecificTime = /^\d{1,2}:\d{2}$/.test(stop.arrival_time ?? "");
  return (
    hasAttachment ||
    hasSpecificTime ||
    ["flight", "stay", "ticket", "airport_transfer"].includes(stop.kind ?? "")
  );
}

function isPoiPlanningStop(stop: TripDayModel["stops"][number]): boolean {
  const kind = normalizeKind(stop.kind);
  if (
    ["stay", "transport", "flight", "airport_transfer", "placeholder"].includes(
      kind,
    )
  ) {
    return false;
  }
  return !isPlaceholderStop(stop) && !isRegionalTripStop(stop) && Boolean(stop.name.trim());
}

function clampMapFocus(
  focus: MapFocus,
  model: TripModel,
  activeView: ActiveItineraryView,
): MapFocus {
  if (!focus) return null;
  if (activeView === "overview") {
    if (focus.mode !== "route") return null;
    const routePoints = buildRoutePoints(model.days);
    if (routePoints.length === 0) return null;
    return {
      ...focus,
      index: Math.max(0, Math.min(routePoints.length - 1, focus.index)),
    };
  }

  const day = model.days[activeView];
  if (!day || day.stops.length === 0) return null;
  if (focus.mode === "stop") {
    return {
      ...focus,
      index: Math.max(0, Math.min(day.stops.length - 1, focus.index)),
    };
  }
  if (focus.mode === "movement") {
    if (day.stops.length < 2) return null;
    const fromIndex = Math.max(0, Math.min(day.stops.length - 2, focus.fromIndex));
    return {
      ...focus,
      fromIndex,
      toIndex: Math.max(fromIndex + 1, Math.min(day.stops.length - 1, focus.toIndex)),
    };
  }
  return null;
}

function coordinatesForPlace(
  primary: string,
  cityLookup: Map<string, ApiCity>,
  fallback?: string,
): { lat: number | null; lng: number | null } {
  const candidates = [primary, fallback ?? ""]
    .flatMap((value) => [value, ...value.split(/[,\s、，/→>到]+/)])
    .map(normalizePlaceToken)
    .filter(Boolean);
  for (const candidate of candidates) {
    const exact = PLACE_COORDINATES[candidate];
    if (exact) return exact;
    const fromApi = cityLookup.get(candidate);
    if (fromApi?.lat != null && fromApi.lng != null) {
      return { lat: fromApi.lat, lng: fromApi.lng };
    }
    const fuzzyKey = Object.keys(PLACE_COORDINATES).find(
      (key) => candidate.includes(key) || key.includes(candidate),
    );
    if (fuzzyKey) return PLACE_COORDINATES[fuzzyKey]!;
  }
  return { lat: null, lng: null };
}

function coordinatesForStop(
  stop: Pick<TripStop, "name" | "placeName" | "kind" | "anchorMode">,
  cityLookup: Map<string, ApiCity>,
): { lat: number | null; lng: number | null } {
  if (isAreaWalkStop(stop)) {
    return { lat: null, lng: null };
  }
  return exactCoordinatesForPlace(mappableStopName(stop), cityLookup);
}

function exactCoordinatesForPlace(
  place: string,
  cityLookup: Map<string, ApiCity>,
): { lat: number | null; lng: number | null } {
  const candidate = normalizePlaceToken(place);
  if (!candidate) return { lat: null, lng: null };
  const exact = PLACE_COORDINATES[candidate];
  if (exact) return exact;
  const fromApi = cityLookup.get(candidate);
  if (fromApi?.lat != null && fromApi.lng != null) {
    return { lat: fromApi.lat, lng: fromApi.lng };
  }
  return { lat: null, lng: null };
}

function isAreaWalkStop(
  stop: Pick<TripStop, "name" | "placeName" | "kind" | "anchorMode">,
): boolean {
  return isRegionalTripStop(stop);
}

function normalizePlaceToken(value: string): string {
  return value.trim().toLowerCase().replace(/[\s.'-]+/g, "");
}

type CorridorOverlapWarningGroup = {
  startDayIndex: number;
  endDayIndex: number;
  cityKeys: string[];
};

function buildCorridorOverlapWarningGroups(
  days: TripDayModel[],
): CorridorOverlapWarningGroup[] {
  const groups: CorridorOverlapWarningGroup[] = [];
  let active:
    | {
        key: string;
        startDayIndex: number;
        endDayIndex: number;
        cityKeys: string[];
      }
    | null = null;

  for (const [dayIndex, day] of days.entries()) {
    const cityKeys = orderedCorridorCitiesForDay(day)
      .map(normalizePlaceToken)
      .filter(Boolean)
      .sort();
    const key = cityKeys.length > 1 ? cityKeys.join("|") : "";
    if (!key) {
      if (active && active.endDayIndex - active.startDayIndex + 1 > 2) {
        groups.push({
          startDayIndex: active.startDayIndex,
          endDayIndex: active.endDayIndex,
          cityKeys: active.cityKeys,
        });
      }
      active = null;
      continue;
    }
    if (active && active.key === key && active.endDayIndex + 1 === dayIndex) {
      active.endDayIndex = dayIndex;
      continue;
    }
    if (active && active.endDayIndex - active.startDayIndex + 1 > 2) {
      groups.push({
        startDayIndex: active.startDayIndex,
        endDayIndex: active.endDayIndex,
        cityKeys: active.cityKeys,
      });
    }
    active = { key, startDayIndex: dayIndex, endDayIndex: dayIndex, cityKeys };
  }

  if (active && active.endDayIndex - active.startDayIndex + 1 > 2) {
    groups.push({
      startDayIndex: active.startDayIndex,
      endDayIndex: active.endDayIndex,
      cityKeys: active.cityKeys,
    });
  }

  return groups;
}

function buildCorridorOverviewPlan(
  days: TripDayModel[],
  labels: TripPlanningLabels,
): CorridorOverviewPlan {
  const lanesByKey = new Map<string, CorridorOverviewLane>();
  const routeIndexByDayCity = routeIndexByDayCityKey(days);
  const overviewDays: CorridorOverviewDay[] = [];
  const homeCityKey = corridorHomeCityKey(days);
  const overlapWarningGroups = buildCorridorOverlapWarningGroups(days);
  const overlapWarningDayIndexes = new Set(
    overlapWarningGroups.flatMap((group) =>
      Array.from(
        { length: group.endDayIndex - group.startDayIndex + 1 },
        (_, offset) => group.startDayIndex + offset,
      ),
    ),
  );
  let previousEndCity: string | null = null;

  function ensureLane(city: string): CorridorOverviewLane {
    const key = normalizePlaceToken(city);
    const existing = lanesByKey.get(key);
    if (existing) return existing;
    const lane: CorridorOverviewLane = {
      key,
      city,
      laneIndex: lanesByKey.size,
    };
    lanesByKey.set(key, lane);
    return lane;
  }

  for (const [dayIndex, day] of days.entries()) {
    const explicitSegments = orderedCorridorSegmentsForDay(day);
    const carryCity =
      explicitSegments.length === 1 &&
      previousEndCity &&
      normalizePlaceToken(previousEndCity) !== normalizePlaceToken(explicitSegments[0]!.city) &&
      day.cities.some(
        (city) => normalizePlaceToken(city) === normalizePlaceToken(previousEndCity!),
      )
        ? previousEndCity
        : null;
    const segments: CorridorSegmentEntry[] =
      carryCity
        ? [
            {
              city: carryCity,
              note: "",
              segmentIndex: null,
            },
            explicitSegments[0]!,
          ]
        : explicitSegments;
    const cities: string[] = segments.map((segment) => segment.city);

    cities.forEach(ensureLane);
    const cityKeys = cities.map(normalizePlaceToken);
    const summaryByCity = new Map<string, string[]>(
      cityKeys.map((key) => [key, []]),
    );
    const segmentIndexByCity = new Map<string, number | null>();
    for (const segment of segments) {
      const cityKey = normalizePlaceToken(segment.city);
      if (!segmentIndexByCity.has(cityKey)) {
        segmentIndexByCity.set(cityKey, segment.segmentIndex);
      }
      const segmentSummary = segmentSummaryTitle(segment.note);
      if (segmentSummary) {
        summaryByCity.set(cityKey, [segmentSummary]);
      }
    }
    const daySummary = daySummaryTitle(day);
    const dayCityKey = normalizePlaceToken(day.city);
    if (
      daySummary &&
      summaryByCity.has(dayCityKey) &&
      (summaryByCity.get(dayCityKey)?.length ?? 0) === 0
    ) {
      summaryByCity.set(dayCityKey, [daySummary]);
    }

    if (!daySummary) {
      const summaryStops = day.stops.filter(
        (stop) =>
          !isTimelineHiddenStop(stop) &&
          !isLogisticsStop(stop) &&
          normalizeKind(stop.kind) !== "stay",
      );
      for (const stop of summaryStops) {
        const cityKey = corridorCityKeyForStop(stop, cities, day);
        const summaries = summaryByCity.get(cityKey);
        if (!summaries) continue;
        summaries.push(stop.name.trim());
      }
    }

    const cells = cities.flatMap((city) => {
      const cityKey = normalizePlaceToken(city);
      const summary = summaryByCity.get(cityKey) ?? [];
      const isDayCity = normalizePlaceToken(day.city) === cityKey;
      const isReturnHome =
        days.length > 1 &&
        dayIndex === days.length - 1 &&
        homeCityKey != null &&
        cityKey === homeCityKey;
      return [{
        key: `corridor-cell:${dayIndex}:${cityKey}:${segmentIndexByCity.get(cityKey) ?? "carry"}`,
        dayIndex,
        segmentIndex: segmentIndexByCity.get(cityKey) ?? null,
        city,
        cityKey,
        summary:
          summary.length > 0
            ? summary
            : isReturnHome
              ? [labels.overview_editor.return_home]
              : isDayCity
                ? [formatTemplate(labels.stay_in, { city })]
              : [],
        routeIndex: routeIndexByDayCity.get(`${dayIndex}:${cityKey}`) ?? null,
      }];
    });

    const transfers: CorridorOverviewTransfer[] = [];
    if (!overlapWarningDayIndexes.has(dayIndex)) {
      for (let cityIndex = 1; cityIndex < cities.length; cityIndex += 1) {
        const fromCity = cities[cityIndex - 1]!;
        const toCity = cities[cityIndex]!;
        const fromLane = lanesByKey.get(normalizePlaceToken(fromCity));
        const toLane = lanesByKey.get(normalizePlaceToken(toCity));
        if (!fromLane || !toLane) continue;
        const mode: TravelModeKind = "flight";
        const durationLabel = corridorTransferDurationLabel(
          day,
          labels,
          fromCity,
          toCity,
          mode,
        );
        transfers.push({
          key: `corridor-transfer:${dayIndex}:${cityIndex}:${fromLane.key}:${toLane.key}`,
          dayIndex,
          arrivalDayIndex: dayIndex,
          fromCity,
          fromKey: fromLane.key,
          toCity,
          toKey: toLane.key,
          label: corridorTransferLabel(day, toCity, labels, mode),
          durationLabel,
          mode,
          fromLaneIndex: fromLane.laneIndex,
          toLaneIndex: toLane.laneIndex,
          targetLaneIndex: toLane.laneIndex,
          extended: dayHasExtendedFlightTransfer(day),
          overnight: false,
        });
      }

      const overnightTransfer = corridorOvernightTransferCandidate(
        days,
        dayIndex,
        cities,
      );
      if (overnightTransfer) {
        const fromLane = ensureLane(overnightTransfer.fromCity);
        const toLane = ensureLane(overnightTransfer.toCity);
        const mode: TravelModeKind = "flight";
        const durationLabel = corridorTransferDurationLabel(
          day,
          labels,
          overnightTransfer.fromCity,
          overnightTransfer.toCity,
          mode,
        );
        transfers.push({
          key: `corridor-overnight-transfer:${dayIndex}:${overnightTransfer.arrivalDayIndex}:${fromLane.key}:${toLane.key}`,
          dayIndex,
          arrivalDayIndex: overnightTransfer.arrivalDayIndex,
          fromCity: overnightTransfer.fromCity,
          fromKey: fromLane.key,
          toCity: overnightTransfer.toCity,
          toKey: toLane.key,
          label: corridorTransferLabel(day, overnightTransfer.toCity, labels, mode),
          durationLabel,
          mode,
          fromLaneIndex: fromLane.laneIndex,
          toLaneIndex: toLane.laneIndex,
          targetLaneIndex: toLane.laneIndex,
          extended: true,
          overnight: true,
        });
      }
    }

    overviewDays.push({
      dayIndex,
      date: day.date,
      cells,
      transfers,
    });
    previousEndCity = cities.at(-1) ?? previousEndCity;
  }

  return {
    lanes: Array.from(lanesByKey.values()),
    days: withCorridorTransferTargets(overviewDays, Array.from(lanesByKey.values())),
    notes: days.flatMap((day, dayIndex) => {
      const text = daySummaryTitle(day);
      return text ? [{
        key: `corridor-note:${dayIndex}`,
        dayIndex,
        text,
      }] : [];
    }),
    warnings: [
      ...overlapWarningGroups.flatMap((group) => {
        const laneIndexes = group.cityKeys
          .map((cityKey) => lanesByKey.get(cityKey)?.laneIndex)
          .filter((laneIndex): laneIndex is number => laneIndex != null);
        if (laneIndexes.length < 2) return [];
        return [{
          key: `corridor-warning:${group.startDayIndex}:${group.endDayIndex}:${group.cityKeys.join("-")}`,
          kind: "overlap" as const,
          startDayIndex: group.startDayIndex,
          endDayIndex: group.endDayIndex,
          fromLaneIndex: Math.min(...laneIndexes),
          toLaneIndex: Math.max(...laneIndexes),
          conflictDays: group.endDayIndex - group.startDayIndex + 1,
        }];
      }),
      ...buildCorridorMismatchWarnings(
        overviewDays,
        Array.from(lanesByKey.values()),
      ),
    ],
  };
}

function corridorHomeCityKey(days: TripDayModel[]): string | null {
  for (const day of days) {
    const city = orderedCorridorSegmentsForDay(day)[0]?.city ?? "";
    const key = normalizePlaceToken(city);
    if (key) return key;
  }
  return null;
}

function buildCorridorOverviewRuns(
  plan: CorridorOverviewPlan,
): CorridorOverviewRun[] {
  const runs: CorridorOverviewRun[] = [];
  for (const lane of plan.lanes) {
    let current: CorridorOverviewRun | null = null;
    for (const day of plan.days) {
      const cell = day.cells.find((item) => item.cityKey === lane.key);
      if (!cell) {
        if (current) {
          runs.push(current);
          current = null;
        }
        continue;
      }
      if (current && current.endDayIndex + 1 === day.dayIndex) {
        current.endDayIndex = day.dayIndex;
        current.cells.push(cell);
        continue;
      }
      if (current) runs.push(current);
      current = {
        key: `corridor-run:${lane.key}:${day.dayIndex}`,
        cityKey: lane.key,
        laneIndex: lane.laneIndex,
        startDayIndex: day.dayIndex,
        endDayIndex: day.dayIndex,
        cells: [cell],
      };
    }
    if (current) runs.push(current);
  }
  return runs;
}

function withCorridorTransferTargets(
  days: CorridorOverviewDay[],
  lanes: CorridorOverviewLane[],
): CorridorOverviewDay[] {
  const laneIndexByCityKey = new Map(
    lanes.map((lane) => [lane.key, lane.laneIndex]),
  );
  return days.map((day) => ({
    ...day,
    transfers: day.transfers.map((transfer) => {
      const target = findCorridorTransferTarget(days, transfer);
      return {
        ...transfer,
        targetLaneIndex: target
          ? laneIndexByCityKey.get(target.cityKey) ?? transfer.toLaneIndex
          : transfer.toLaneIndex,
      };
    }),
  }));
}

function findCorridorTransferTarget(
  days: CorridorOverviewDay[],
  transfer: CorridorOverviewTransfer,
): CorridorOverviewCell | null {
  for (let dayIndex = transfer.dayIndex; dayIndex < days.length; dayIndex += 1) {
    const day = days[dayIndex];
    const target = day?.cells.find((cell) => cell.cityKey === transfer.toKey);
    if (target) return target;
  }
  return null;
}

function buildCorridorMismatchWarnings(
  days: CorridorOverviewDay[],
  lanes: CorridorOverviewLane[],
): CorridorOverviewWarning[] {
  const laneByKey = new Map(lanes.map((lane) => [lane.key, lane]));
  const warnings: CorridorOverviewWarning[] = [];
  for (const day of days) {
    for (const cell of day.cells) {
      const actualCity = summaryCityPrefix(cell.summary[0] ?? "", lanes);
      if (!actualCity) continue;
      const actualKey = normalizePlaceToken(actualCity);
      if (actualKey === cell.cityKey) continue;
      const lane = laneByKey.get(cell.cityKey);
      if (!lane) continue;
      warnings.push({
        key: `corridor-mismatch:${day.dayIndex}:${cell.cityKey}:${actualKey}`,
        kind: "mismatch",
        dayIndex: day.dayIndex,
        laneIndex: lane.laneIndex,
        expectedCity: cell.city,
        actualCity,
      });
    }
  }
  return warnings;
}

function summaryCityPrefix(
  summary: string,
  lanes: CorridorOverviewLane[],
): string | null {
  const prefix = summary
    .split(/[·•｜|:：\-—–]/)[0]
    ?.trim();
  if (!prefix) return null;
  const prefixKey = normalizePlaceToken(prefix);
  return lanes.find((lane) => lane.key === prefixKey)?.city ?? null;
}

function withExtraCorridorLanes(
  plan: CorridorOverviewPlan,
  extraCities: string[],
): CorridorOverviewPlan {
  const existing = new Set(plan.lanes.map((lane) => lane.key));
  const lanes = [...plan.lanes];
  for (const city of extraCities) {
    const trimmed = city.trim();
    if (!trimmed) continue;
    const key = normalizePlaceToken(trimmed);
    if (existing.has(key)) continue;
    existing.add(key);
    lanes.push({ key, city: trimmed, laneIndex: lanes.length });
  }
  return { ...plan, lanes };
}

function moveCorridorRun(
  days: TripDayModel[],
  run: NonNullable<CorridorDragState>,
  _targetCity: string,
  targetStart: number,
  targetEnd: number,
): {
  nextDays: TripDayModel[];
  nextDaysWithStops: TripDayModel[] | null;
  affectedDays: number;
  affectedStops: number;
  conflictDays: number;
} {
  const nextDays = days.map(cloneTripDay);
  const nextDaysWithStops = days.map((day) => ({
    ...cloneTripDay(day),
    stops: [...day.stops],
  }));
  const affected = new Set<number>();
  const length = Math.min(run.length, targetEnd - targetStart + 1);
  for (let offset = 0; offset < length; offset += 1) {
    const sourceIndex = run.startDayIndex + offset;
    const targetIndex = targetStart + offset;
    const sourceDay = days[sourceIndex];
    const targetDay = days[targetIndex];
    if (!sourceDay || !targetDay) continue;
    affected.add(sourceIndex);
    affected.add(targetIndex);
    const targetCity = targetDay.city;
    nextDays[sourceIndex] = assignCityToSingleDay(sourceDay, targetCity);
    nextDays[targetIndex] = assignCityToSingleDay(targetDay, run.city);
    nextDaysWithStops[sourceIndex] = {
      ...assignCityToSingleDay(sourceDay, targetCity),
      note: targetDay.note,
      stops: [...targetDay.stops],
    };
    nextDaysWithStops[targetIndex] = {
      ...assignCityToSingleDay(targetDay, run.city),
      note: sourceDay.note,
      stops: [...sourceDay.stops],
    };
  }
  return {
    nextDays,
    nextDaysWithStops: rangesOverlap(
      run.startDayIndex,
      run.endDayIndex,
      targetStart,
      targetEnd,
    )
      ? null
      : nextDaysWithStops,
    affectedDays: affected.size,
    affectedStops: Array.from(affected).reduce(
      (total, dayIndex) => total + (days[dayIndex]?.stops.length ?? 0),
      0,
    ),
    conflictDays: countMoveConflictDays(days, run, targetStart),
  };
}

function moveCorridorDay(
  days: TripDayModel[],
  dayDrag: NonNullable<CorridorDayDragState>,
  targetCity: string,
  targetCityKey: string,
  targetDayIndex: number,
): {
  nextDays: TripDayModel[];
  nextDaysWithStops: TripDayModel[] | null;
  affectedDays: number;
  affectedStops: number;
  conflictDays: number;
} {
  const nextDays = days.map(cloneTripDay);
  const nextDaysWithStops = days.map((day) => ({
    ...cloneTripDay(day),
    stops: [...day.stops],
  }));
  const sourceDay = days[dayDrag.dayIndex];
  const targetDay = days[targetDayIndex];
  if (!sourceDay || !targetDay) {
    return {
      nextDays,
      nextDaysWithStops: null,
      affectedDays: 0,
      affectedStops: 0,
      conflictDays: 0,
    };
  }

  if (dayDrag.dayIndex === targetDayIndex) {
    nextDays[targetDayIndex] = assignCityToSingleDay(targetDay, targetCity);
    return {
      nextDays,
      nextDaysWithStops: null,
      affectedDays: 1,
      affectedStops: targetDay.stops.length,
      conflictDays: normalizePlaceToken(targetDay.city) === targetCityKey ? 0 : 1,
    };
  }

  const targetOriginalCity = targetDay.city;
  nextDays[dayDrag.dayIndex] = assignCityToSingleDay(sourceDay, targetOriginalCity);
  nextDays[targetDayIndex] = assignCityToSingleDay(targetDay, dayDrag.city);
  nextDaysWithStops[dayDrag.dayIndex] = {
    ...assignCityToSingleDay(sourceDay, targetOriginalCity),
    note: targetDay.note,
    stops: [...targetDay.stops],
  };
  nextDaysWithStops[targetDayIndex] = {
    ...assignCityToSingleDay(targetDay, dayDrag.city),
    note: sourceDay.note,
    stops: [...sourceDay.stops],
  };
  return {
    nextDays,
    nextDaysWithStops,
    affectedDays: 2,
    affectedStops: sourceDay.stops.length + targetDay.stops.length,
    conflictDays:
      normalizePlaceToken(targetDay.city) === dayDrag.cityKey &&
      normalizePlaceToken(sourceDay.city) === targetCityKey
        ? 0
        : 1,
  };
}

function assignCityToSingleDay(day: TripDayModel, city: string): TripDayModel {
  const coords = coordinatesForKnownPlace(city);
  return withSingleCorridorCity(day, city, coords);
}

function addCorridorSegmentToDay(day: TripDayModel, city: string): TripDayModel {
  const key = normalizePlaceToken(city);
  if (dayHasCorridorCity(day, key)) return day;
  return withCorridorSegments(day, [
    ...segmentsForDayModel(day),
    defaultDaySegmentForCity(city),
  ]);
}

function removeCorridorSegmentFromDay(
  day: TripDayModel,
  cityKey: string,
): TripDayModel {
  return withCorridorSegments(
    day,
    segmentsForDayModel(day).filter(
      (segment) => normalizePlaceToken(segment.city) !== cityKey,
    ),
  );
}

function deleteCorridorDaySegment(
  days: TripDayModel[],
  cell: CorridorOverviewCell,
  fillForward: boolean,
): TripDayModel[] {
  const nextDays = days.map(cloneTripDay);
  if (!fillForward) {
    const day = nextDays[cell.dayIndex];
    if (day) {
      nextDays[cell.dayIndex] = removeCorridorSegmentFromDay(day, cell.cityKey);
    }
    return nextDays;
  }

  let endDayIndex = cell.dayIndex;
  while (
    endDayIndex + 1 < nextDays.length &&
    dayHasCorridorCity(nextDays[endDayIndex + 1]!, cell.cityKey)
  ) {
    endDayIndex += 1;
  }

  for (let index = cell.dayIndex; index < endDayIndex; index += 1) {
    const currentDay = removeCorridorSegmentFromDay(nextDays[index]!, cell.cityKey);
    const nextSegment = segmentsForDayModel(nextDays[index + 1]!).find(
      (segment) => normalizePlaceToken(segment.city) === cell.cityKey,
    );
    nextDays[index] = nextSegment
      ? withCorridorSegments(currentDay, [
          ...segmentsForDayModel(currentDay),
          { ...nextSegment },
        ])
      : currentDay;
  }

  nextDays[endDayIndex] = removeCorridorSegmentFromDay(
    nextDays[endDayIndex]!,
    cell.cityKey,
  );
  return nextDays;
}

function withSingleCorridorCity(
  day: TripDayModel,
  city: string,
  coords: { lat: number; lng: number } | null = coordinatesForKnownPlace(city),
): TripDayModel {
  return withCorridorSegments(day, [defaultDaySegmentForCity(city)], coords);
}

function withCorridorSegments(
  day: TripDayModel,
  segments: TripDaySegment[],
  coords: { lat: number; lng: number } | null = null,
): TripDayModel {
  const normalized = normalizeDaySegmentsForModel(segments, []);
  const primaryCity = normalized[0]?.city ?? day.city;
  const cities = uniqueCorridorCities(normalized.map((segment) => segment.city));
  const primaryCoords = coords ?? coordinatesForKnownPlace(primaryCity);
  return {
    ...day,
    city: primaryCity,
    cities,
    segments: normalized,
    lat: primaryCoords?.lat ?? day.lat,
    lng: primaryCoords?.lng ?? day.lng,
  };
}

function segmentsForDayModel(day: TripDayModel): TripDaySegment[] {
  return normalizeDaySegmentsForModel(
    day.segments,
    day.cities.length ? day.cities : [day.city].filter(Boolean),
  );
}

function uniqueCorridorCities(cities: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const city of cities) {
    const trimmed = city.trim();
    if (!trimmed) continue;
    const key = normalizePlaceToken(trimmed);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(trimmed);
  }
  return out;
}

function rangesOverlap(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart <= bEnd && bStart <= aEnd;
}

function countMoveConflictDays(
  days: TripDayModel[],
  run: NonNullable<CorridorDragState>,
  targetStart: number,
): number {
  let count = 0;
  for (let offset = 0; offset < run.length; offset += 1) {
    const dayIndex = targetStart + offset;
    if (dayIndex < 0 || dayIndex >= days.length) continue;
    if (dayIndex >= run.startDayIndex && dayIndex <= run.endDayIndex) continue;
    const day = days[dayIndex];
    if (day && !dayHasCorridorCity(day, run.cityKey)) count += 1;
  }
  return count;
}

function countDaysForCity(days: TripDayModel[], city: string): number {
  const key = normalizePlaceToken(city);
  return days.filter((day) => dayHasCorridorCity(day, key)).length;
}

function countStopsForCityDays(days: TripDayModel[], city: string): number {
  const key = normalizePlaceToken(city);
  return days
    .filter((day) => dayHasCorridorCity(day, key))
    .reduce((total, day) => total + day.stops.length, 0);
}

function countStopsForDayRange(
  days: TripDayModel[],
  startDayIndex: number,
  endDayIndex: number,
): number {
  return days
    .slice(Math.max(0, startDayIndex), Math.min(days.length, endDayIndex + 1))
    .reduce((total, day) => total + day.stops.length, 0);
}

function dayHasCorridorCity(day: TripDayModel, cityKey: string): boolean {
  return orderedCorridorCitiesForDay(day).some(
    (city) => normalizePlaceToken(city) === cityKey,
  );
}

function deleteCorridorCity(days: TripDayModel[], city: string): TripDayModel[] {
  const deletedKey = normalizePlaceToken(city);
  return days.map((day, index) => {
    if (!dayHasCorridorCity(day, deletedKey)) return day;
    const replacement =
      findNearestRemainingCity(days, index, deletedKey) ?? day.city;
    return assignCityToSingleDay(day, replacement);
  });
}

function deleteCorridorRun(
  days: TripDayModel[],
  run: CorridorOverviewRun,
): TripDayModel[] {
  return days.map((day, index) => {
    if (index < run.startDayIndex || index > run.endDayIndex) return day;
    if (!dayHasCorridorCity(day, run.cityKey)) return day;
    const replacement =
      findNearestCityOutsideRange(days, index, run.cityKey, run.startDayIndex, run.endDayIndex) ??
      day.city;
    return assignCityToSingleDay(day, replacement);
  });
}

function corridorResizeRange(
  resize: NonNullable<CorridorResizeState>,
  targetDayIndex: number,
  dayCount: number,
): { startDayIndex: number; endDayIndex: number } {
  const safeTarget = Math.max(0, Math.min(targetDayIndex, Math.max(0, dayCount - 1)));
  if (resize.side === "start") {
    return {
      startDayIndex: Math.min(safeTarget, resize.endDayIndex),
      endDayIndex: resize.endDayIndex,
    };
  }
  return {
    startDayIndex: resize.startDayIndex,
    endDayIndex: Math.max(safeTarget, resize.startDayIndex),
  };
}

function resizeCorridorRun(
  days: TripDayModel[],
  resize: NonNullable<CorridorResizeState>,
  startDayIndex: number,
  endDayIndex: number,
): TripDayModel[] {
  return days.map((day, index) => {
    const wasInRange = index >= resize.startDayIndex && index <= resize.endDayIndex;
    const isInRange = index >= startDayIndex && index <= endDayIndex;
    if (isInRange) {
      return addCorridorSegmentToDay(day, resize.city);
    }
    if (!wasInRange || !dayHasCorridorCity(day, resize.cityKey)) {
      return day;
    }
    return removeCorridorSegmentFromDay(day, resize.cityKey);
  });
}

function countResizeAffectedDays(
  resize: NonNullable<CorridorResizeState>,
  startDayIndex: number,
  endDayIndex: number,
): number {
  const affected = new Set<number>();
  for (let index = resize.startDayIndex; index <= resize.endDayIndex; index += 1) {
    affected.add(index);
  }
  for (let index = startDayIndex; index <= endDayIndex; index += 1) {
    affected.add(index);
  }
  return affected.size;
}

function countResizeConflictDays(
  days: TripDayModel[],
  resize: NonNullable<CorridorResizeState>,
  startDayIndex: number,
  endDayIndex: number,
): number {
  let count = 0;
  for (let index = startDayIndex; index <= endDayIndex; index += 1) {
    if (index >= resize.startDayIndex && index <= resize.endDayIndex) continue;
    const day = days[index];
    if (day && !dayHasCorridorCity(day, resize.cityKey)) count += 1;
  }
  return count;
}

function findNearestRemainingCity(
  days: TripDayModel[],
  index: number,
  deletedKey: string,
): string | null {
  for (let distance = 1; distance < days.length; distance += 1) {
    const previous = days[index - distance];
    const previousCity = previous
      ? orderedCorridorCitiesForDay(previous).find(
          (city) => normalizePlaceToken(city) !== deletedKey,
        )
      : null;
    if (previousCity) {
      return previousCity;
    }
    const next = days[index + distance];
    const nextCity = next
      ? orderedCorridorCitiesForDay(next).find(
          (city) => normalizePlaceToken(city) !== deletedKey,
        )
      : null;
    if (nextCity) {
      return nextCity;
    }
  }
  return null;
}

function findNearestCityOutsideRange(
  days: TripDayModel[],
  index: number,
  excludedKey: string,
  startDayIndex: number,
  endDayIndex: number,
): string | null {
  for (let distance = 1; distance < days.length; distance += 1) {
    const previousIndex = index - distance;
    const previous = days[previousIndex];
    if (
      (previousIndex < startDayIndex || previousIndex > endDayIndex) &&
      previous
    ) {
      const city = orderedCorridorCitiesForDay(previous).find(
        (candidate) => normalizePlaceToken(candidate) !== excludedKey,
      );
      if (city) return city;
    }
    const nextIndex = index + distance;
    const next = days[nextIndex];
    if (
      (nextIndex < startDayIndex || nextIndex > endDayIndex) &&
      next
    ) {
      const city = orderedCorridorCitiesForDay(next).find(
        (candidate) => normalizePlaceToken(candidate) !== excludedKey,
      );
      if (city) return city;
    }
  }
  return null;
}

function countCorridorTransfers(days: TripDayModel[]): number {
  let previousEndCity: string | null = null;
  let count = 0;
  for (const [dayIndex, day] of days.entries()) {
    const explicitCities = orderedCorridorCitiesForDay(day);
    const cities: string[] =
      explicitCities.length === 1 &&
      previousEndCity &&
      normalizePlaceToken(previousEndCity) !== normalizePlaceToken(explicitCities[0]!)
        ? [previousEndCity, explicitCities[0]!]
        : explicitCities;
    for (let index = 1; index < cities.length; index += 1) {
      if (normalizePlaceToken(cities[index - 1]!) !== normalizePlaceToken(cities[index]!)) {
        count += 1;
      }
    }
    if (corridorOvernightTransferCandidate(days, dayIndex, cities)) {
      count += 1;
    }
    previousEndCity = cities.at(-1) ?? previousEndCity;
  }
  return count;
}

function corridorFlightStopId(
  day: TripDayModel,
  transfer: Pick<CorridorOverviewTransfer, "fromCity" | "toCity">,
): string {
  return corridorFlightStopIdFromParts(day.date, transfer.fromCity, transfer.toCity);
}

function corridorFlightStopIdFromParts(date: string, fromCity: string, toCity: string): string {
  return [
    "corridor-flight",
    date,
    normalizePlaceToken(fromCity),
    normalizePlaceToken(toCity),
  ].join(":");
}

function corridorFlightStop(
  day: TripDayModel,
  transfer: CorridorOverviewTransfer,
  departureTime: string | null,
  durationMinutes: number,
): TripDayModel["stops"][number] {
  const id = corridorFlightStopId(day, transfer);
  return {
    id,
    name: `${transfer.fromCity} → ${transfer.toCity}`,
    placeName: null,
    placeId: null,
    placeAddress: null,
    kind: "flight",
    arrival_time: departureTime,
    duration_min: durationMinutes,
    note: `${transfer.fromCity} → ${transfer.toCity}`,
    attachments: [],
    lat: null,
    lng: null,
  };
}

function routeIndexByDayCityKey(days: TripDayModel[]): Map<string, number> {
  const routePoints = buildRoutePoints(days);
  const routeIndexByKey = new Map<string, number>();
  routePoints.forEach((point, routeIndex) => {
    const cityKey = normalizePlaceToken(point.city);
    point.days.forEach((dayIndex) => {
      routeIndexByKey.set(`${dayIndex}:${cityKey}`, routeIndex);
    });
  });
  return routeIndexByKey;
}

function daySummaryTitle(day: TripDayModel): string | null {
  return segmentSummaryTitle(day.note);
}

function segmentSummaryTitle(note: string): string | null {
  const firstLine = note
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean);
  return firstLine ?? null;
}

function corridorCityKeyForStop(
  stop: TripDayModel["stops"][number],
  cities: string[],
  day: TripDayModel,
): string {
  const dayCityKey = normalizePlaceToken(day.city);
  if (cities.some((city) => normalizePlaceToken(city) === dayCityKey)) {
    return dayCityKey;
  }
  const firstCity = cities[0] ?? day.city;
  if (stop.lat == null || stop.lng == null) return normalizePlaceToken(firstCity);

  let closest = firstCity;
  let closestDistance = Number.POSITIVE_INFINITY;
  for (const city of cities) {
    const coords = coordinatesForKnownPlace(city);
    if (!coords) continue;
    const distance =
      (coords.lat - stop.lat) ** 2 + (coords.lng - stop.lng) ** 2;
    if (distance < closestDistance) {
      closest = city;
      closestDistance = distance;
    }
  }
  return normalizePlaceToken(closest);
}

function coordinatesForKnownPlace(
  place: string,
): { lat: number; lng: number } | null {
  const candidate = normalizePlaceToken(place);
  const exact = PLACE_COORDINATES[candidate];
  if (exact) return exact;
  const fuzzyKey = Object.keys(PLACE_COORDINATES).find(
    (key) => candidate.includes(key) || key.includes(candidate),
  );
  return fuzzyKey ? PLACE_COORDINATES[fuzzyKey]! : null;
}

function corridorCityDistanceKm(fromCity: string, toCity: string): number | null {
  const from = coordinatesForKnownPlace(fromCity);
  const to = coordinatesForKnownPlace(toCity);
  if (!from || !to) return null;
  const toRad = (value: number) => (value * Math.PI) / 180;
  const earthKm = 6371;
  const dLat = toRad(to.lat - from.lat);
  const dLng = toRad(to.lng - from.lng);
  const lat1 = toRad(from.lat);
  const lat2 = toRad(to.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * earthKm * Math.asin(Math.min(1, Math.sqrt(h)));
}

function corridorTransferLabel(
  day: TripDayModel,
  toCity: string,
  labels: TripPlanningLabels,
  mode: TravelModeKind,
): string {
  const duration = corridorTransferDurationLabel(day, labels, "", toCity, mode);
  return [
    labels.map_travel[mode],
    duration,
    formatTemplate(
      mode === "flight" ? labels.fly_to : labels.stay_in,
      { city: toCity },
    ),
  ]
    .filter(Boolean)
    .join(" · ");
}

function corridorTransferDurationLabel(
  day: TripDayModel,
  labels: TripPlanningLabels,
  fromCity: string,
  toCity: string,
  mode: TravelModeKind,
): string | null {
  const routeStopId = corridorFlightStopIdFromParts(day.date, fromCity, toCity);
  const routeStop = day.stops.find((stop) => stop.id === routeStopId);
  const logisticsStop = routeStop ?? day.stops.find((stop) => normalizeKind(stop.kind) === mode);
  const explicit = formatTravelDurationLabel(logisticsStop?.duration_min ?? null, labels);
  if (explicit) return explicit;
  const estimated = estimateTransferMinutes(fromCity, toCity, mode);
  const estimatedLabel = formatTravelDurationLabel(estimated, labels);
  return estimatedLabel ? `~${estimatedLabel}` : null;
}

function formatTravelDurationLabel(
  minutes: number | null | undefined,
  labels: TripPlanningLabels,
): string | null {
  if (!minutes || minutes <= 0) return null;
  const safeMinutes = Math.max(1, Math.round(minutes));
  if (safeMinutes < 60) {
    return formatTemplate(labels.map_travel.min, { n: String(safeMinutes) });
  }
  const hours = Math.floor(safeMinutes / 60);
  const rest = safeMinutes % 60;
  if (rest === 0) {
    return formatTemplate(labels.map_travel.hour, { h: String(hours) });
  }
  return formatTemplate(labels.map_travel.hour_min, {
    h: String(hours),
    m: String(rest),
  });
}

function estimateTransferMinutes(
  fromCity: string,
  toCity: string,
  mode: TravelModeKind,
): number | null {
  if (!fromCity || !toCity) return mode === "flight" ? 120 : null;
  const distanceKm = corridorCityDistanceKm(fromCity, toCity);
  if (distanceKm == null) return mode === "flight" ? 120 : null;
  if (mode === "flight") {
    return Math.max(60, Math.round((distanceKm / 760) * 60 + 45));
  }
  if (mode === "drive") {
    return Math.max(15, Math.round((distanceKm / 70) * 60));
  }
  return Math.max(20, Math.round((distanceKm / 160) * 60));
}

function buildRoutePoints(days: TripDayModel[]): RoutePoint[] {
  const points: RoutePoint[] = [];
  for (const [index, day] of days.entries()) {
    const previous = points.at(-1);
    if (previous && normalizePlaceToken(previous.city) === normalizePlaceToken(day.city)) {
      previous.days.push(index);
      previous.dateLabel = formatDateRange(days[previous.days[0]]!.date, day.date);
      continue;
    }
    points.push({
      city: day.city,
      lat: day.lat,
      lng: day.lng,
      dateLabel: shortDate(day.date),
      days: [index],
    });
  }
  return points;
}

function buildRouteDiagramPlan(days: TripDayModel[]): RouteDiagramPlan {
  const nodes: RouteDiagramNode[] = [];
  const transfers: RouteDiagramTransfer[] = [];
  const routeIndexQueues = routeIndexQueuesByCity(buildRoutePoints(days));
  let previousEndCity: string | null = null;

  for (const [dayIndex, day] of days.entries()) {
    const explicitCities = orderedCorridorCitiesForDay(day);
    if (explicitCities.length === 0) continue;
    const cities: string[] =
      explicitCities.length === 1 &&
      previousEndCity &&
      normalizePlaceToken(previousEndCity) !== normalizePlaceToken(explicitCities[0]!)
        ? [previousEndCity, explicitCities[0]!]
        : explicitCities;
    const startCity = cities[0]!;
    const endCity = cities.at(-1)!;
    const transfer = cities.length > 1 &&
      normalizePlaceToken(startCity) !== normalizePlaceToken(endCity);

    const startNodeIndex = ensureRouteDiagramNode(
      nodes,
      routeIndexQueues,
      startCity,
    );
    nodes[startNodeIndex]?.dayIndexes.push(dayIndex);

    if (transfer) {
      const endNodeIndex = ensureRouteDiagramNode(
        nodes,
        routeIndexQueues,
        endCity,
      );
      transfers.push({
        dayIndex,
        date: day.date,
        fromNodeIndex: startNodeIndex,
        toNodeIndex: endNodeIndex,
        extendedTransfer: dayHasExtendedFlightTransfer(day),
      });
    }

    previousEndCity = endCity;
  }

  return { nodes, transfers };
}

function routeIndexQueuesByCity(routePoints: RoutePoint[]): Map<string, number[]> {
  const queues = new Map<string, number[]>();
  routePoints.forEach((point, index) => {
    const cityKey = normalizePlaceToken(point.city);
    queues.set(cityKey, [...(queues.get(cityKey) ?? []), index]);
  });
  return queues;
}

function ensureRouteDiagramNode(
  nodes: RouteDiagramNode[],
  routeIndexQueues: Map<string, number[]>,
  city: string,
): number {
  const lastNode = nodes.at(-1);
  if (lastNode && normalizePlaceToken(lastNode.city) === normalizePlaceToken(city)) {
    return nodes.length - 1;
  }
  const cityKey = normalizePlaceToken(city);
  const routeIndexQueue = routeIndexQueues.get(cityKey) ?? [];
  const routeIndex = routeIndexQueue.shift() ?? null;
  nodes.push({
    city,
    dayIndexes: [],
    routeIndex,
  });
  return nodes.length - 1;
}

function orderedCorridorCitiesForDay(day: TripDayModel): string[] {
  return orderedCorridorSegmentsForDay(day).map((segment) => segment.city);
}

function orderedCorridorSegmentsForDay(
  day: TripDayModel,
): CorridorSegmentEntry[] {
  const nextSegments: CorridorSegmentEntry[] = [];
  const candidates = (day.segments.length
    ? day.segments.map((segment, segmentIndex) => ({
        city: segment.city,
        note: segment.note,
        segmentIndex,
      }))
    : day.cities.map((city) => ({
        city,
        note: "",
        segmentIndex: null,
      })))
    .map((segment) => ({
      ...segment,
      city: segment.city.trim(),
      note: segment.note ?? "",
    }))
    .filter((segment) => segment.city);
  for (const segment of candidates) {
    if (
      nextSegments.some(
        (existing) =>
          normalizePlaceToken(existing.city) === normalizePlaceToken(segment.city),
      )
    ) {
      continue;
    }
    nextSegments.push(segment);
  }
  return nextSegments;
}

function corridorOvernightTransferCandidate(
  days: TripDayModel[],
  dayIndex: number,
  renderedCities: string[],
): { fromCity: string; toCity: string; arrivalDayIndex: number } | null {
  const day = days[dayIndex];
  const nextDay = days[dayIndex + 1];
  const fromCity = renderedCities.at(-1);
  if (!day || !nextDay || !fromCity) return null;

  const structuredCities = uniqueCorridorCities(day.cities);
  if (structuredCities.length < 2) return null;

  const nextDayFirstCity =
    orderedCorridorSegmentsForDay(nextDay)[0]?.city ??
    uniqueCorridorCities(nextDay.cities)[0] ??
    nextDay.city;
  if (!nextDayFirstCity) return null;

  const nextDayFirstKey = normalizePlaceToken(nextDayFirstCity);
  const fromKey = normalizePlaceToken(fromCity);
  if (!nextDayFirstKey || nextDayFirstKey === fromKey) return null;

  const renderedKeys = new Set(renderedCities.map(normalizePlaceToken));
  if (renderedKeys.has(nextDayFirstKey)) return null;

  const structuredHasDestination = structuredCities.some(
    (city) => normalizePlaceToken(city) === nextDayFirstKey,
  );
  if (!structuredHasDestination) return null;

  return {
    fromCity,
    toCity: nextDayFirstCity,
    arrivalDayIndex: dayIndex + 1,
  };
}

function dayHasExtendedFlightTransfer(day: TripDayModel): boolean {
  return day.stops.some(
    (stop) =>
      isOvernightFlightStop(stop) ||
      (isFlightLikeStop(stop) && (stop.duration_min ?? 0) >= 1440),
  );
}

function dayToRoutePoint(day: TripDayModel, index: number): RoutePoint {
  return {
    city: day.city,
    lat: day.lat,
    lng: day.lng,
    dateLabel: shortDate(day.date),
    days: [index],
  };
}

function routeSegmentId(segment: RoutePoint, index: number): string {
  return `route:${index}:${segment.city}:${segment.dateLabel}:${segment.days.join("-")}`;
}

function stopId(stop: TripDayModel["stops"][number], index: number): string {
  return stop.id ?? `stop:${index}:${stop.name}:${stop.lat ?? ""}:${stop.lng ?? ""}`;
}

function cloneTripDays(days: TripDayModel[]): TripDayModel[] {
  return days.map(cloneTripDay);
}

function cloneTripDay(day: TripDayModel): TripDayModel {
  return {
    ...day,
    cities: [...day.cities],
    segments: day.segments.map((segment) => ({ ...segment })),
    stops: day.stops.map((stop) => ({
      ...stop,
      attachments: stop.attachments?.map((attachment) => ({ ...attachment })),
    })),
  };
}

function tripDaysEqual(a: TripDayModel[], b: TripDayModel[]): boolean {
  if (a === b) return true;
  return JSON.stringify(a) === JSON.stringify(b);
}

function isEditableKeyboardTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tagName = target.tagName.toLowerCase();
  return (
    tagName === "input" ||
    tagName === "textarea" ||
    tagName === "select" ||
    target.isContentEditable
  );
}

function stopBudgetAmount(stop: TripDayModel["stops"][number]): string {
  return (
    stop.attachments?.find(
      (attachment) =>
        attachment.id === STOP_BUDGET_ATTACHMENT_ID ||
        attachment.type === "budget",
    )?.amount ?? ""
  );
}

function withStopBudget(
  stop: TripDayModel["stops"][number],
  amount: string,
  label: string,
): TripDayModel["stops"][number] {
  const cleanAmount = amount.trim();
  const attachments = stop.attachments ?? [];
  const existingIndex = attachments.findIndex(
    (attachment) =>
      attachment.id === STOP_BUDGET_ATTACHMENT_ID ||
      attachment.type === "budget",
  );
  const budgetAttachment: TripStopAttachment = {
    id: STOP_BUDGET_ATTACHMENT_ID,
    type: "budget",
    label,
    url: null,
    amount: cleanAmount || null,
    actionLabel: null,
    checklistItemId: null,
    checklistText: null,
    checklistKind: null,
    imageName: null,
    imageDataUrl: null,
    status: cleanAmount ? "completed" : "required",
    done: Boolean(cleanAmount),
  };
  if (existingIndex >= 0) {
    return {
      ...stop,
      attachments: attachments.map((attachment, index) =>
        index === existingIndex ? { ...attachment, ...budgetAttachment } : attachment,
      ),
    };
  }
  return {
    ...stop,
    attachments: [...attachments, budgetAttachment],
  };
}

function isTicketAttachment(attachment: TripStopAttachment): boolean {
  return TICKET_ATTACHMENT_TYPES.has(attachment.type);
}

const CHECK_IN_ATTACHMENT_TYPE = "checkin";

function isCheckInAttachment(attachment: TripStopAttachment): boolean {
  return attachment.type === CHECK_IN_ATTACHMENT_TYPE;
}

function checkInAttachmentForStop(
  stop: TripDayModel["stops"][number],
): TripStopAttachment | null {
  return (stop.attachments ?? []).find(isCheckInAttachment) ?? null;
}

function ticketAttachmentsForStop(
  stop: TripDayModel["stops"][number],
): TripStopAttachment[] {
  return (stop.attachments ?? []).filter(isTicketAttachment);
}

function primaryTicketAttachment(
  stop: TripDayModel["stops"][number],
): TripStopAttachment | null {
  return ticketAttachmentsForStop(stop)[0] ?? null;
}

function airportTransferAttachmentForMovement(
  fromStop: TripDayModel["stops"][number],
  toStop: TripDayModel["stops"][number],
): TripStopAttachment | null {
  if (
    ![fromStop.kind, toStop.kind].some((kind) =>
      ["flight", "airport_transfer"].includes(kind ?? ""),
    )
  ) return null;
  return (
    (fromStop.attachments ?? []).find((attachment) =>
      isAirportTransferAttachment(attachment),
    ) ?? null
  );
}

function buildDayLodgingAnchors(
  days: TripDayModel[],
  dayIndex: number,
  labels: TripPlanningLabels,
  homePlace: UserHomePlace | null,
): { start: DayLodgingAnchor; end: DayLodgingAnchor } {
  const previousDay = dayIndex > 0 ? days[dayIndex - 1] ?? null : null;
  const currentDay = days[dayIndex] ?? null;
  const previousOvernightFlight = previousDay
    ? overnightFlightStopForDay(previousDay)
    : null;
  const currentOvernightFlight = currentDay
    ? overnightFlightStopForDay(currentDay)
    : null;

  return {
    start: dayIndex === 0
      ? homeLodgingAnchor(labels, homePlace)
      : previousOvernightFlight
      ? overnightLodgingAnchor(previousOvernightFlight, "start", labels)
      : stayLodgingAnchor(
          lodgingForNightAfterDay(days, dayIndex - 1),
          "start",
          labels,
        ),
    end: currentOvernightFlight
      ? overnightLodgingAnchor(currentOvernightFlight, "end", labels)
      : stayLodgingAnchor(
          lodgingForNightAfterDay(days, dayIndex),
          "end",
          labels,
        ),
  };
}

function homeLodgingAnchor(
  labels: TripPlanningLabels,
  homePlace: UserHomePlace | null,
): DayLodgingAnchor {
  const lodgingLabels = labels.lodging_stops;
  return {
    state: "home",
    position: "start",
    label: lodgingLabels.home_label,
    title: homePlace?.name ?? lodgingLabels.home_title,
    subtitle: homePlace?.address ?? lodgingLabels.home_subtitle,
    badge: lodgingLabels.home_badge,
    stop: null,
  };
}

function stayLodgingAnchor(
  stop: TripDayModel["stops"][number] | null,
  position: "start" | "end",
  labels: TripPlanningLabels,
): DayLodgingAnchor {
  const lodgingLabels = labels.lodging_stops;
  if (!stop) {
    return {
      state: "placeholder",
      position,
      label:
        position === "start"
          ? lodgingLabels.start_label
          : lodgingLabels.end_label,
      title: lodgingLabels.placeholder_title,
      subtitle: lodgingLabels.placeholder_subtitle,
      badge: lodgingLabels.placeholder_badge,
      stop: null,
    };
  }
  return {
    state: "stay",
    position,
    label:
      position === "start"
        ? lodgingLabels.start_label
        : lodgingLabels.end_label,
    title: stop.name,
    subtitle: stop.note || stop.arrival_time || lodgingLabels.choose,
    badge: lodgingLabels.stay_badge,
    stop,
  };
}

function overnightLodgingAnchor(
  stop: TripDayModel["stops"][number],
  position: "start" | "end",
  labels: TripPlanningLabels,
): DayLodgingAnchor {
  const lodgingLabels = labels.lodging_stops;
  return {
    state: "overnight",
    position,
    label:
      position === "start"
        ? lodgingLabels.start_label
        : lodgingLabels.end_label,
    title: lodgingLabels.overnight_title,
    subtitle: stop.name || lodgingLabels.overnight_subtitle,
    badge: lodgingLabels.overnight_badge,
    stop,
  };
}

function lodgingForNightAfterDay(
  days: TripDayModel[],
  dayIndex: number,
): TripDayModel["stops"][number] | null {
  if (dayIndex < 0) return null;
  return days[dayIndex]?.stops.find(isLodgingStop) ?? null;
}

function lodgingTargetForAnchor(
  days: TripDayModel[],
  dayIndex: number,
  position: DayLodgingAnchor["position"],
): LodgingSettingsTarget | null {
  const lodgingDayIndex = position === "start" ? dayIndex - 1 : dayIndex;
  if (lodgingDayIndex < 0 || lodgingDayIndex >= days.length) return null;
  const stopIndex =
    days[lodgingDayIndex]?.stops.findIndex(isLodgingStop) ?? -1;
  if (stopIndex < 0) return null;
  const stop = days[lodgingDayIndex]?.stops[stopIndex] ?? null;
  return stop ? { dayIndex: lodgingDayIndex, stopIndex, stop } : null;
}

function lodgingDateRangeForTarget(
  days: TripDayModel[],
  target: LodgingSettingsTarget,
): LodgingDateRange {
  let startIndex = target.dayIndex;
  let endIndex = target.dayIndex;
  while (
    startIndex - 1 >= 0 &&
    isSameLodgingStop(
      lodgingForNightAfterDay(days, startIndex - 1),
      target.stop,
    )
  ) {
    startIndex -= 1;
  }
  while (
    endIndex + 1 < days.length &&
    isSameLodgingStop(lodgingForNightAfterDay(days, endIndex + 1), target.stop)
  ) {
    endIndex += 1;
  }
  return normalizeLodgingDateRange({ startIndex, endIndex }, days.length);
}

function applyLodgingDateRange(
  days: TripDayModel[],
  target: LodgingSettingsTarget,
  range: LodgingDateRange,
): TripDayModel[] {
  const normalizedRange = normalizeLodgingDateRange(range, days.length);
  const targetIndexes = new Set(
    days
      .map((_, dayIndex) => dayIndex)
      .filter(
        (dayIndex) =>
          dayIndex >= normalizedRange.startIndex &&
          dayIndex <= normalizedRange.endIndex &&
          !overnightFlightStopForDay(days[dayIndex]),
      ),
  );

  return days.map((day, dayIndex) => {
    const withoutSameStay = day.stops.filter(
      (stop) => !isSameLodgingStop(stop, target.stop),
    );
    if (!targetIndexes.has(dayIndex)) {
      return withoutSameStay.length === day.stops.length
        ? day
        : { ...day, stops: withoutSameStay };
    }
    return {
      ...day,
      stops: [
        ...withoutSameStay.filter((stop) => !isLodgingStop(stop)),
        target.stop,
      ],
    };
  });
}

function isSameLodgingStop(
  left: TripDayModel["stops"][number] | null | undefined,
  right: TripDayModel["stops"][number] | null | undefined,
): boolean {
  if (!left || !right) return false;
  if (left === right) return true;
  if (left.id && right.id && left.id === right.id) return true;
  if (left.placeId && right.placeId && left.placeId === right.placeId) {
    return true;
  }
  const leftKey = lodgingStopIdentity(left);
  const rightKey = lodgingStopIdentity(right);
  return Boolean(leftKey && rightKey && leftKey === rightKey);
}

function lodgingStopIdentity(stop: TripDayModel["stops"][number]): string {
  return [
    stop.placeId,
    stop.placeName,
    stop.placeAddress,
    stop.name,
  ]
    .filter((value): value is string => Boolean(value?.trim()))
    .join("|")
    .trim()
    .toLowerCase();
}

function isLodgingStop(stop: TripDayModel["stops"][number]): boolean {
  return stop.kind === "stay";
}

function companionIdsForLodgingStop(
  stop: TripDayModel["stops"][number] | null | undefined,
  companions: ApiCompanion[],
): string[] {
  const allIds = companions.map((companion) => companion.id);
  if (!stop) return allIds;
  const attachment = lodgingAssignmentAttachmentForStop(stop);
  if (!attachment?.url) return allIds;
  try {
    const parsed = JSON.parse(attachment.url) as { companionIds?: unknown };
    if (!Array.isArray(parsed.companionIds)) return allIds;
    const knownIds = new Set(allIds);
    const companionIds = parsed.companionIds.filter(
      (value): value is string => typeof value === "string" && knownIds.has(value),
    );
    return companionIds.length > 0 ? companionIds : allIds;
  } catch {
    return allIds;
  }
}

function lodgingAssignmentAttachmentForStop(
  stop: TripDayModel["stops"][number],
): TripStopAttachment | null {
  return (
    (stop.attachments ?? []).find(
      (attachment) =>
        attachment.id === LODGING_ASSIGNMENT_ATTACHMENT_ID ||
        attachment.type === "lodging_assignment",
    ) ?? null
  );
}

function withLodgingAssignment(
  stop: TripDayModel["stops"][number],
  companionIds: string[],
  label: string,
): TripDayModel["stops"][number] {
  const nextAttachment: TripStopAttachment = {
    id: LODGING_ASSIGNMENT_ATTACHMENT_ID,
    type: "lodging_assignment",
    label,
    url: JSON.stringify({ companionIds }),
    status: "completed",
    done: true,
  };
  const attachments = stop.attachments ?? [];
  return {
    ...stop,
    attachments: [
      ...attachments.filter(
        (attachment) =>
          attachment.id !== LODGING_ASSIGNMENT_ATTACHMENT_ID &&
          attachment.type !== "lodging_assignment",
      ),
      nextAttachment,
    ],
  };
}

function isLodgingLandmark(landmark: LandmarkSearchResult): boolean {
  const placeTypes = [landmark.primaryType, ...(landmark.types ?? [])]
    .filter((type): type is string => Boolean(type))
    .map((type) => type.toLowerCase());
  return placeTypes.some((type) =>
    ["bed_and_breakfast", "hotel", "lodging", "motel", "resort_hotel"].includes(
      type,
    ),
  );
}

function isTimelineHiddenStop(stop: TripDayModel["stops"][number]): boolean {
  return isLodgingStop(stop);
}

function mergeTimelineVisibleStops(
  allStops: TripDayModel["stops"],
  visibleStops: TripDayModel["stops"],
): TripDayModel["stops"] {
  return [
    ...visibleStops,
    ...allStops.filter(isTimelineHiddenStop),
  ];
}

function defaultLodgingPlanForDays(
  days: TripDayModel[],
  requestedNightIndex: number,
): LodgingPlanContext {
  if (days.length === 0) return { defaultStartIndex: 0, defaultEndIndex: 0 };
  const requestedIndex = Math.max(0, Math.min(days.length - 1, requestedNightIndex));
  let startIndex = days.findIndex((_, index) => !isLodgingNightPlanned(days, index));
  if (startIndex < 0) {
    startIndex = requestedIndex;
  }
  let endIndex = startIndex;
  while (
    endIndex + 1 < days.length &&
    !isLodgingNightPlanned(days, endIndex + 1)
  ) {
    endIndex += 1;
  }
  return { defaultStartIndex: startIndex, defaultEndIndex: endIndex };
}

function isLodgingNightPlanned(days: TripDayModel[], dayIndex: number): boolean {
  const day = days[dayIndex];
  if (!day) return true;
  return Boolean(day.stops.find(isLodgingStop) || overnightFlightStopForDay(day));
}

function centerForLodgingSearch(
  day: TripDayModel | null | undefined,
): google.maps.LatLngLiteral | null {
  const locatedStop = day?.stops.find(
    (stop) =>
      !isTimelineHiddenStop(stop) &&
      stop.lat != null &&
      stop.lng != null,
  );
  if (locatedStop?.lat != null && locatedStop.lng != null) {
    return { lat: locatedStop.lat, lng: locatedStop.lng };
  }
  if (day?.lat != null && day.lng != null) {
    return { lat: day.lat, lng: day.lng };
  }
  return null;
}

function normalizeLodgingDateRange(
  range: LodgingDateRange,
  dayCount: number,
): LodgingDateRange {
  if (dayCount <= 0) return { startIndex: 0, endIndex: 0 };
  const startIndex = Math.max(0, Math.min(dayCount - 1, range.startIndex));
  const endIndex = Math.max(
    startIndex,
    Math.min(dayCount - 1, range.endIndex),
  );
  return { startIndex, endIndex };
}

function tripDateToLocalDate(date: string | null | undefined): Date | undefined {
  const match = date?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return undefined;
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

function dayIndexForLocalDate(days: TripDayModel[], date: Date): number | null {
  const key = [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
  const index = days.findIndex((day) => day.date === key);
  return index >= 0 ? index : null;
}

function checkoutDateForLodgingRange(
  days: TripDayModel[],
  range: LodgingDateRange,
): string {
  const normalizedRange = normalizeLodgingDateRange(range, days.length);
  const nextTripDay = days[normalizedRange.endIndex + 1]?.date;
  if (nextTripDay) return nextTripDay;
  const endDate = tripDateToLocalDate(days[normalizedRange.endIndex]?.date);
  return endDate ? formatLocalDate(addLocalDays(endDate, 1)) : "";
}

function checkInDateForLodgingAnchor(
  days: TripDayModel[],
  dayIndex: number,
  position: DayLodgingAnchor["position"],
): string {
  const nightIndex = Math.max(
    0,
    Math.min(days.length - 1, position === "start" ? dayIndex - 1 : dayIndex),
  );
  return days[nightIndex]?.date ?? days[dayIndex]?.date ?? "";
}

function checkOutDateForLodgingAnchor(
  days: TripDayModel[],
  dayIndex: number,
  position: DayLodgingAnchor["position"],
): string {
  const checkIn = checkInDateForLodgingAnchor(days, dayIndex, position);
  const checkInIndex = days.findIndex((day) => day.date === checkIn);
  const nextTripDay = days[checkInIndex + 1]?.date;
  if (nextTripDay) return nextTripDay;
  const checkInDate = tripDateToLocalDate(checkIn);
  return checkInDate ? formatLocalDate(addLocalDays(checkInDate, 1)) : "";
}

function bookingSearchUrl({
  destination,
  checkIn,
  checkOut,
  adults,
  rooms,
}: {
  destination: string;
  checkIn: string;
  checkOut: string;
  adults: number;
  rooms: number;
}): string {
  const params = new URLSearchParams({
    ss: destination,
    checkin: checkIn,
    checkout: checkOut,
    group_adults: String(Math.max(1, adults)),
    no_rooms: String(Math.max(1, rooms)),
    group_children: "0",
  });
  if (BOOKING_AFFILIATE_ID) {
    params.set("aid", BOOKING_AFFILIATE_ID);
  }
  return `https://www.booking.com/searchresults.html?${params.toString()}`;
}

function addLocalDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function formatLocalDate(date: Date): string {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function overnightFlightStopForDay(
  day: TripDayModel,
): TripDayModel["stops"][number] | null {
  return day.stops.find(isOvernightFlightStop) ?? null;
}

function isOvernightFlightStop(stop: TripDayModel["stops"][number]): boolean {
  return stop.kind === "flight" && (stop.duration_min ?? 0) >= 360;
}

function isPlaceholderStop(stop: TripDayModel["stops"][number]): boolean {
  return (
    stop.kind === "placeholder" ||
    (stop.note ?? "").trim().toLowerCase().startsWith("placeholder:")
  );
}

function placeholderInfoForStop(
  stop: TripDayModel["stops"][number],
): { kind: PlaceholderKind; query: string } | null {
  if (!isPlaceholderStop(stop)) return null;
  const kind = placeholderKindForStop(stop);
  return {
    kind,
    query: placeholderSearchQuery(stop),
  };
}

function landmarkLabelForStop(
  placeName: string | null | undefined,
  stop: TripDayModel["stops"][number],
): string | null {
  const cleanPlaceName = placeName?.trim();
  if (!cleanPlaceName) return null;
  if (sameDisplayName(cleanPlaceName, stop.name)) return null;
  return cleanPlaceName;
}

function stopDetailsLookupKey(stop: TripDayModel["stops"][number]): string {
  return `${stop.placeId ?? ""}:${mappableStopName(stop)}:${stop.lat ?? ""}:${stop.lng ?? ""}`;
}

function mappableStopName(stop: Pick<TripStop, "name" | "placeName">): string {
  return stop.placeName?.trim() || stop.name;
}

function representativeStopLocation(
  stop: Pick<TripStop, "lat" | "lng" | "placeSuggestions">,
): google.maps.LatLngLiteral | null {
  if (stop.lat != null && stop.lng != null) {
    return { lat: stop.lat, lng: stop.lng };
  }
  const suggestion = stop.placeSuggestions?.find(
    (candidate) => candidate.lat != null && candidate.lng != null,
  );
  return suggestion ? { lat: suggestion.lat, lng: suggestion.lng } : null;
}

function sameDisplayName(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

function stopTimelineSecondaryText({
  stop,
  placeholder,
  landmarkLabel,
  labels,
}: {
  stop: TripDayModel["stops"][number];
  placeholder: { kind: PlaceholderKind; query: string } | null;
  landmarkLabel: string | null;
  labels: TripPlanningLabels;
}): string {
  if (placeholder) return placeholderSubtitle(placeholder.kind, labels);
  return firstPresentText(
    landmarkLabel,
    landmarkLabelForStop(stop.placeName, stop),
    stop.placeAddress,
    stop.note,
  );
}

function firstPresentText(
  ...values: Array<string | null | undefined>
): string {
  return values.map((value) => value?.trim()).find(Boolean) ?? "";
}

function placeholderKindForStop(stop: TripDayModel["stops"][number]): PlaceholderKind {
  const [marker, encodedKind] = (stop.note ?? "").trim().split(":", 3);
  const normalizedKind = encodedKind?.trim().toLowerCase();
  if (
    marker?.trim().toLowerCase() === "placeholder" &&
    ["stay", "coffee", "meal", "activity", "other"].includes(
      normalizedKind ?? "",
    )
  ) {
    return normalizedKind as PlaceholderKind;
  }
  const placeTypes = new Set(stop.placeTypes ?? []);
  if (placeTypes.has("lodging")) return "stay";
  if (placeTypes.has("cafe")) return "coffee";
  if (placeTypes.has("restaurant")) return "meal";
  if (placeTypes.has("tourist_attraction")) return "activity";
  return "other";
}

function placeholderSearchQuery(
  stop: TripDayModel["stops"][number],
  city?: string | null,
): string {
  const parts = (stop.note ?? "").trim().split(":");
  const explicit =
    parts[0]?.trim().toLowerCase() === "placeholder" && parts.length >= 3
      ? parts.slice(2).join(":").split("|", 1)[0]?.trim()
      : "";
  if (explicit) return explicit;
  const base = placeholderSearchLabel(placeholderKindForStop(stop));
  return city ? `${base} ${city}` : base;
}

function placeholderSearchLabel(kind: PlaceholderKind): string {
  if (kind === "stay") return "hotel";
  if (kind === "meal") return "restaurant";
  if (kind === "coffee") return "cafe";
  if (kind === "activity") return "tourist attraction";
  return "place";
}

function placeholderPrimaryType(kind: PlaceholderKind): string | null {
  if (kind === "stay") return "lodging";
  if (kind === "meal") return "restaurant";
  if (kind === "coffee") return "cafe";
  if (kind === "activity") return "tourist_attraction";
  return null;
}

function realKindForPlaceholder(kind: PlaceholderKind): string {
  if (kind === "stay") return "stay";
  if (kind === "meal" || kind === "coffee") return "meal";
  if (kind === "activity") return "sight";
  return "other";
}

function iconForPlaceholderKind(kind: PlaceholderKind): LucideIcon {
  if (kind === "stay") return BedDouble;
  if (kind === "meal" || kind === "coffee") return Utensils;
  if (kind === "activity") return Camera;
  return MapPin;
}

function placeholderLabel(kind: PlaceholderKind, labels?: TripPlanningLabels): string {
  const label = labels?.map_search.placeholder_context?.labels?.[kind];
  if (label) return label;
  if (kind === "stay") return "住宿待選";
  if (kind === "meal") return "餐廳待選";
  if (kind === "coffee") return "咖啡待選";
  if (kind === "activity") return "景點待選";
  return "地點待選";
}

function placeholderSubtitle(kind: PlaceholderKind, labels?: TripPlanningLabels): string {
  const subtitle = labels?.map_search.placeholder_context?.subtitles?.[kind];
  if (subtitle) return subtitle;
  if (kind === "stay") return "選定住宿後，後續每天可從這裡出發。";
  if (kind === "meal") return "點擊後從附近餐廳挑選。";
  if (kind === "coffee") return "點擊後從附近咖啡廳挑選。";
  if (kind === "activity") return "點擊後從附近景點挑選。";
  return "點擊後搜尋並替換成實際地點。";
}

function placeholderSearchHeading(
  placeholder: NonNullable<ActivePlaceholderSearch>,
  labels: TripPlanningLabels,
): string {
  const label = placeholderLabel(placeholder.kind, labels).replace("待選", "");
  const template =
    labels.map_search.placeholder_context?.heading ??
    "正在為「{name}」尋找{kind}";
  return formatTemplate(template, {
    name: placeholder.stopName,
    kind: label,
  });
}

function nearestLocatedStopForPlaceholder(
  day: TripDayModel,
  stopIndex: number,
): TripDayModel["stops"][number] | null {
  for (let offset = 1; offset < day.stops.length; offset += 1) {
    const previous = day.stops[stopIndex - offset];
    if (previous?.lat != null && previous.lng != null) return previous;
    const next = day.stops[stopIndex + offset];
    if (next?.lat != null && next.lng != null) return next;
  }
  return null;
}

function isAirportTransferAttachment(attachment: TripStopAttachment): boolean {
  return (
    attachment.type === "airport_transfer" ||
    attachment.checklistKind === "airport_transfer"
  );
}

function isAttachmentComplete(attachment: TripStopAttachment): boolean {
  return (
    attachment.done ||
    attachment.status === "completed" ||
    attachment.status === "uploaded" ||
    Boolean(attachment.imageDataUrl)
  );
}

function estimateAirportTransferCost(segment: TravelSegment): {
  min: string;
  max: string;
} {
  const base = 650;
  const min = roundCurrency(base + segment.distanceKm * 26 + segment.durationMin * 3.5);
  const max = roundCurrency(min * 1.35 + 180);
  return {
    min: min.toLocaleString(),
    max: max.toLocaleString(),
  };
}

function roundCurrency(value: number): number {
  return Math.max(500, Math.round(value / 50) * 50);
}

function stopNeedsTicketAction(stop: TripDayModel["stops"][number]): boolean {
  if (primaryTicketAttachment(stop)) return true;
  if (
    stop.kind === "ticket" ||
    stop.kind === "sight" ||
    stop.kind === "meal" ||
    stop.kind === "airport_transfer"
  ) {
    return true;
  }
  return false;
}

function defaultTicketAttachmentForStop(
  stop: TripDayModel["stops"][number],
  labels: TripPlanningLabels["ticket_actions"],
): TripStopAttachment {
  const isReservation = stop.kind === "meal";
  const isTransfer = stop.kind === "airport_transfer";
  return {
    id: isTransfer
      ? "roam-stop-airport-transfer"
      : isReservation
      ? STOP_RESERVATION_ATTACHMENT_ID
      : STOP_TICKET_ATTACHMENT_ID,
    type: isTransfer ? "booking" : isReservation ? "reservation" : "ticket",
    label: isTransfer
      ? labels.transfer_label
      : isReservation
        ? labels.reservation_label
        : labels.ticket_label,
    url: null,
    amount: null,
    actionLabel: labels.open,
    checklistItemId: null,
    checklistText: null,
    checklistKind: null,
    imageName: null,
    imageDataUrl: null,
    status: "required",
    done: false,
  };
}

function ticketPurchaseUrl(
  stop: TripDayModel["stops"][number],
  attachment: TripStopAttachment,
  labels: TripPlanningLabels["ticket_actions"],
): string {
  if (attachment.url) return attachment.url;
  return `https://www.google.com/search?q=${encodeURIComponent(
    `${stop.name} ${labels.purchase_query}`,
  )}`;
}

function withTicketAttachment(
  stop: TripDayModel["stops"][number],
  labels: TripPlanningLabels["ticket_actions"],
  image: { imageName: string; imageDataUrl: string },
): TripStopAttachment[] {
  const attachments = stop.attachments ?? [];
  const existingIndex = attachments.findIndex(isTicketAttachment);
  const base =
    existingIndex >= 0
      ? attachments[existingIndex]
      : defaultTicketAttachmentForStop(stop, labels);
  const nextAttachment: TripStopAttachment = {
    ...base,
    url: base.url ?? ticketPurchaseUrl(stop, base, labels),
    imageName: image.imageName,
    imageDataUrl: image.imageDataUrl,
    status: "uploaded",
    done: true,
  };

  if (existingIndex >= 0) {
    return attachments.map((attachment, index) =>
      index === existingIndex ? nextAttachment : attachment,
    );
  }
  return [...attachments, nextAttachment];
}

function withCheckInAttachment(
  attachments: TripStopAttachment[] | undefined,
  labels: TripPlanningLabels["journey_live"],
  image: { imageName: string; imageDataUrl: string },
): TripStopAttachment[] {
  const currentAttachments = attachments ?? [];
  const existingIndex = currentAttachments.findIndex(isCheckInAttachment);
  const previous = existingIndex >= 0 ? currentAttachments[existingIndex] : null;
  const nextAttachment: TripStopAttachment = {
    id: previous?.id ?? `checkin-${Date.now()}`,
    type: CHECK_IN_ATTACHMENT_TYPE,
    label: labels.check_in_done,
    url: null,
    amount: null,
    actionLabel: labels.check_in,
    checklistItemId: null,
    checklistText: null,
    checklistKind: null,
    imageName: image.imageName,
    imageDataUrl: image.imageDataUrl,
    status: "uploaded",
    done: true,
  };

  if (existingIndex >= 0) {
    return currentAttachments.map((attachment, index) =>
      index === existingIndex ? nextAttachment : attachment,
    );
  }
  return [...currentAttachments, nextAttachment];
}

function stopAttachmentsForApi(
  attachments: TripStopAttachment[] | undefined,
): Array<{
  id?: string | null;
  type?: string;
  label: string;
  url?: string | null;
  amount?: string | null;
  action_label?: string | null;
  checklist_item_id?: string | null;
  checklist_text?: string | null;
  checklist_kind?: string | null;
  image_name?: string | null;
  image_data_url?: string | null;
  status?: "required" | "completed" | "uploaded";
}> {
  return (attachments ?? []).map((attachment) => ({
    id: attachment.id,
    type: attachment.type,
    label: attachment.label,
    url: attachment.url ?? null,
    amount: attachment.amount ?? null,
    action_label: attachment.actionLabel ?? null,
    checklist_item_id: attachment.checklistItemId ?? null,
    checklist_text: attachment.checklistText ?? null,
    checklist_kind: attachment.checklistKind ?? null,
    image_name: attachment.imageName ?? null,
    image_data_url: attachment.imageDataUrl ?? null,
    status: attachment.status,
  }));
}

function buildChecklistGroups(
  items: ChecklistItem[],
  labels: TripPlanningLabels,
): ChecklistGroup[] {
  const fallback: ChecklistItem[] = items.length
    ? items
    : [
        fallbackChecklist("fallback-passport", labels.fallback_items.passport, "doc"),
        fallbackChecklist("fallback-esim", labels.fallback_items.esim, "esim"),
        fallbackChecklist("fallback-stay", labels.fallback_items.stay, "stay"),
        fallbackChecklist("fallback-places", labels.fallback_items.places, "ticket"),
      ];
  const groups = [
    {
      key: "preparation",
      title: labels.sections.preparation,
      tint: "bg-[#dff4f2] text-accent",
      Icon: CalendarDays,
    },
    {
      key: "transport",
      title: labels.sections.transport,
      tint: "bg-[#fff1dc] text-[#e67932]",
      Icon: Plane,
    },
    {
      key: "stay",
      title: labels.sections.stay,
      tint: "bg-[#ddf3e9] text-[#3a8f78]",
      Icon: BedDouble,
    },
    {
      key: "sights",
      title: labels.sections.sights,
      tint: "bg-[#eee7ff] text-[#7a5ac7]",
      Icon: Camera,
    },
  ];

  return groups.map((group, groupIndex) => {
    const groupItems = fallback.filter((item) => bucketForKind(item.kind) === group.key);
    const visible = groupItems.length ? groupItems : fallback.slice(groupIndex, groupIndex + 1);
    return {
      key: group.key,
      title: group.title,
      done: visible.filter((item) => item.done).length,
      items: visible,
      tint: group.tint,
      Icon: group.Icon,
    };
  });
}

function fallbackChecklist(
  id: string,
  text: string,
  kind: ChecklistItem["kind"],
): ChecklistItem {
  return {
    id,
    text,
    done: false,
    kind,
  };
}

function bucketForKind(kind: string): string {
  if (kind === "stay") return "stay";
  if (
    kind === "transit" ||
    kind === "transport" ||
    kind === "airport_transfer" ||
    kind === "flight" ||
    kind === "esim"
  ) {
    return "transport";
  }
  if (kind === "ticket" || kind === "sight" || kind === "meal") return "sights";
  return "preparation";
}

function normalizeKind(kind: string | undefined | null): string {
  if (!kind) return "other";
  if (kind === "meal") return "meal";
  if (kind === "stay") return "stay";
  if (kind === "flight") return "flight";
  if (kind === "placeholder") return "placeholder";
  if (kind === "airport_transfer") return "airport_transfer";
  if (kind === "transit" || kind === "transport") return "transport";
  if (kind === "sight" || kind === "ticket") return kind;
  return "other";
}

function iconForKind(kind: string | undefined): LucideIcon {
  if (kind === "placeholder") return MapPin;
  if (kind === "meal") return Utensils;
  if (kind === "stay") return BedDouble;
  if (kind === "flight") return Plane;
  if (kind === "airport_transfer") return CarFront;
  if (kind === "transport" || kind === "transit") return TrainFront;
  if (kind === "sight" || kind === "ticket") return Camera;
  return MapPin;
}

function routeColor(index: number): string {
  return [
    "bg-[#d6526f]",
    "bg-[#f39b2f]",
    "bg-[#54ad8d]",
    "bg-[#4b91c9]",
    "bg-[#7a5ac7]",
    "bg-accent",
  ][index % 6]!;
}

function routeStrokeColor(index: number): string {
  return [
    "#d6526f",
    "#f39b2f",
    "#54ad8d",
    "#4b91c9",
    "#7a5ac7",
    "#0fb8b4",
  ][index % 6]!;
}

function routePastelSurface(index: number): string {
  return [
    "bg-rose-100",
    "bg-amber-100",
    "bg-emerald-100",
    "bg-sky-100",
    "bg-violet-100",
    "bg-teal-50",
  ][index % 6]!;
}

function routeTone(index: number): {
  bg: string;
  soft: string;
  text: string;
  textMuted: string;
  border: string;
  borderMuted: string;
  line: string;
  ring: string;
} {
  return [
    {
      bg: "bg-[#d6526f]",
      soft: "bg-[#d6526f]/10",
      text: "text-[#d6526f]",
      textMuted: "text-[#d6526f]/65",
      border: "border-[#d6526f]/55",
      borderMuted: "border-[#d6526f]/25",
      line: "bg-[#d6526f]/42",
      ring: "shadow-[0_0_0_3px_rgba(214,82,111,0.16)]",
    },
    {
      bg: "bg-[#f39b2f]",
      soft: "bg-[#f39b2f]/12",
      text: "text-[#c97718]",
      textMuted: "text-[#c97718]/65",
      border: "border-[#f39b2f]/60",
      borderMuted: "border-[#f39b2f]/28",
      line: "bg-[#f39b2f]/46",
      ring: "shadow-[0_0_0_3px_rgba(243,155,47,0.18)]",
    },
    {
      bg: "bg-[#54ad8d]",
      soft: "bg-[#54ad8d]/12",
      text: "text-[#3d8d72]",
      textMuted: "text-[#3d8d72]/65",
      border: "border-[#54ad8d]/58",
      borderMuted: "border-[#54ad8d]/28",
      line: "bg-[#54ad8d]/44",
      ring: "shadow-[0_0_0_3px_rgba(84,173,141,0.17)]",
    },
    {
      bg: "bg-[#4b91c9]",
      soft: "bg-[#4b91c9]/12",
      text: "text-[#3d7fb2]",
      textMuted: "text-[#3d7fb2]/65",
      border: "border-[#4b91c9]/58",
      borderMuted: "border-[#4b91c9]/28",
      line: "bg-[#4b91c9]/44",
      ring: "shadow-[0_0_0_3px_rgba(75,145,201,0.17)]",
    },
    {
      bg: "bg-[#7a5ac7]",
      soft: "bg-[#7a5ac7]/12",
      text: "text-[#6d50b8]",
      textMuted: "text-[#6d50b8]/65",
      border: "border-[#7a5ac7]/58",
      borderMuted: "border-[#7a5ac7]/28",
      line: "bg-[#7a5ac7]/44",
      ring: "shadow-[0_0_0_3px_rgba(122,90,199,0.17)]",
    },
    {
      bg: "bg-accent",
      soft: "bg-accent-soft",
      text: "text-accent",
      textMuted: "text-accent/65",
      border: "border-accent/55",
      borderMuted: "border-accent/25",
      line: "bg-accent/42",
      ring: "shadow-[0_0_0_3px_rgba(15,184,180,0.16)]",
    },
  ][index % 6]!;
}

function avatarColor(index: number): string {
  return ["#2c7188", "#c37f61", "#3a8f78"][index % 3]!;
}

function exportTripCalendar(model: TripModel) {
  const start = calendarDate(model.startDate);
  const end = calendarDate(dayAfter(model.endDate));
  const calendar = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Roam//Trip//EN",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${model.id}@roam`,
    `DTSTART;VALUE=DATE:${start}`,
    `DTEND;VALUE=DATE:${end}`,
    `SUMMARY:${escapeCalendarText(model.title)}`,
    `DESCRIPTION:${escapeCalendarText(model.destination)}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
  const blob = new Blob([calendar], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${model.title.trim().replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "trip"}.ics`;
  link.click();
  URL.revokeObjectURL(url);
}

function calendarDate(value: string): string {
  return value.replaceAll("-", "");
}

function dayAfter(value: string): string {
  const date = dateFromIso(value);
  if (!date) return value;
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

function escapeCalendarText(value: string): string {
  return value
    .replaceAll("\\", "\\\\")
    .replaceAll("\n", "\\n")
    .replaceAll(",", "\\,")
    .replaceAll(";", "\\;");
}

function shortDate(date: string): string {
  const parts = date.split("-");
  return parts.length === 3 ? `${Number(parts[1])}/${Number(parts[2])}` : date;
}

function formatDateRange(start: string, end: string): string {
  const startLabel = shortDate(start);
  const endLabel = shortDate(end);
  return startLabel === endLabel ? startLabel : `${startLabel} - ${endLabel}`;
}

function timeForStop(index: number): string {
  return ["09:00", "10:30", "12:00", "14:00", "16:30", "19:00"][index] ?? "20:00";
}

function currentJourneyLiveState(
  model: TripModel,
  now = new Date(),
): JourneyLiveState | null {
  if (!isDateWithinTrip(model, now)) return null;
  const today = localDateKey(now);
  const dayIndex = model.days.findIndex((day) => day.date === today);
  if (dayIndex < 0) return null;
  const day = model.days[dayIndex];
  if (!day) return null;
  const visibleStops = day.stops
    .map((stop, originalIndex) => ({ stop, originalIndex }))
    .filter(({ stop }) => !isTimelineHiddenStop(stop));
  if (visibleStops.length === 0) return null;

  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  let visibleIndex = 0;
  visibleStops.forEach(({ stop }, index) => {
    const time = normalizeEditableTime(stop.arrival_time) || timeForStop(index);
    if (timeToMinutes(time) <= nowMinutes) {
      visibleIndex = index;
    }
  });

  const current = visibleStops[visibleIndex] ?? visibleStops[0];
  if (!current) return null;
  const nextStop = visibleStops[visibleIndex + 1]?.stop ?? null;
  const ticketAttachments = visibleStops.flatMap(({ stop }) =>
    ticketAttachmentsForStop(stop),
  );
  return {
    dayIndex,
    stopIndex: current.originalIndex,
    visibleIndex,
    totalStops: visibleStops.length,
    day,
    stop: current.stop,
    nextStop,
    checkedInCount: visibleStops.filter(({ stop }) => checkInAttachmentForStop(stop)).length,
    ticketDoneCount: ticketAttachments.filter((attachment) => attachment.done).length,
    ticketTotalCount: ticketAttachments.length,
  };
}

function isDateWithinTrip(model: TripModel, date: Date): boolean {
  const today = localDateKey(date);
  return Boolean(model.startDate && model.endDate && model.startDate <= today && today <= model.endDate);
}

function localDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function timeToMinutes(time: string): number {
  const normalized = normalizeEditableTime(time);
  if (!normalized) return 0;
  const [hour = "0", minute = "0"] = normalized.split(":");
  return Number(hour) * 60 + Number(minute);
}

function normalizeEditableTime(value: string | null | undefined): string {
  const match = value?.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return "";
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (
    !Number.isInteger(hour) ||
    !Number.isInteger(minute) ||
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59
  ) {
    return "";
  }
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function formatTemplate(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => values[key] ?? "");
}

function reviewMatchesTopic(
  review: GoogleStopDetails["reviews"][number],
  topic: ReviewTopic,
): boolean {
  const text = `${review.author} ${review.text}`.toLowerCase();
  const keywordMap: Record<ReviewTopic, string[]> = {
    environment: [
      "ambience",
      "ambient",
      "ambiente",
      "atmosphere",
      "環境",
      "氣氛",
      "氛圍",
      "座位",
      "空間",
    ],
    food: [
      "dish",
      "food",
      "menu",
      "sushi",
      "餐",
      "料理",
      "口味",
      "味道",
      "食物",
      "菜單",
    ],
    service: [
      "service",
      "staff",
      "waiter",
      "friendly",
      "servizio",
      "服務",
      "店員",
      "親切",
    ],
    price: [
      "price",
      "value",
      "expensive",
      "cheap",
      "prezzo",
      "價格",
      "價錢",
      "划算",
      "貴",
    ],
  };
  return keywordMap[topic].some((keyword) => text.includes(keyword));
}

function isSameMapViewport(a: TripMapViewport, b: TripMapViewport): boolean {
  const close = (left: number, right: number, epsilon = 0.000001) =>
    Math.abs(left - right) <= epsilon;
  return (
    close(a.center.lat, b.center.lat) &&
    close(a.center.lng, b.center.lng) &&
    close(a.radiusMeters, b.radiusMeters, 0.5) &&
    close(a.bounds.north, b.bounds.north) &&
    close(a.bounds.south, b.bounds.south) &&
    close(a.bounds.east, b.bounds.east) &&
    close(a.bounds.west, b.bounds.west)
  );
}

function normalizeExternalUrl(url: string | null | undefined): string | null {
  const trimmed = url?.trim();
  if (!trimmed) return null;
  if (/^(https?:|tel:|mailto:)/i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

function googleMapsSearchUrl(
  name: string,
  address: string | null | undefined,
  placeId: string | null | undefined,
  cityHint?: string | null,
): string {
  const params = new URLSearchParams({
    api: "1",
    query: [name, address, cityHint].filter(Boolean).join(" "),
  });
  if (placeId) {
    params.set("query_place_id", placeId);
  }
  return `https://www.google.com/maps/search/?${params.toString()}`;
}

const GOOGLE_STOP_DETAIL_FIELDS = [
  "id",
  "displayName",
  "formattedAddress",
  "location",
  "rating",
  "userRatingCount",
  "nationalPhoneNumber",
  "internationalPhoneNumber",
  "websiteURI",
  "googleMapsURI",
  "primaryType",
  "types",
  "priceLevel",
  "servesBreakfast",
  "servesBrunch",
  "servesLunch",
  "servesDinner",
  "servesCoffee",
  "servesVegetarianFood",
  "hasDelivery",
  "hasDineIn",
  "isReservable",
  "photos",
  "reviews",
  "regularOpeningHours",
  "currentOpeningHours",
] as const;

async function fetchStopGoogleDetails({
  stop,
  city,
}: {
  stop: TripDayModel["stops"][number];
  city: string | null;
}): Promise<GoogleStopDetails | null> {
  const center =
    stop.lat != null && stop.lng != null
      ? { lat: stop.lat, lng: stop.lng }
      : null;
  if (!center && !stop.placeId && !mappableStopName(stop).trim()) return null;
  const language = typeof document === "undefined"
    ? undefined
    : document.documentElement.lang || navigator.language || undefined;
  const place = await findStopGooglePlace({
    stop,
    city,
    center,
    language,
  });
  if (!place) return null;

  await place.fetchFields({ fields: [...GOOGLE_STOP_DETAIL_FIELDS] });
  const photos = (place.photos ?? [])
    .slice(0, 10)
    .map((photo) => photo.getURI({ maxWidth: 640, maxHeight: 420 }));
  const reviews = (place.reviews ?? [])
    .map((review) => ({
      author: review.authorAttribution?.displayName ?? "Google Maps",
      rating: review.rating ?? null,
      text: review.text ?? review.originalText ?? "",
      relativeTime: review.relativePublishTimeDescription ?? null,
    }))
    .filter((review) => review.text.trim().length > 0)
    .slice(0, 5);
  const placeTypes = [place.primaryType, ...(place.types ?? [])].filter(
    (type): type is string => Boolean(type),
  );
  const isRestaurant = placeTypes.some(isRestaurantPlaceType);

  return {
    id: place.id,
    name: place.displayName ?? stop.name,
    address: place.formattedAddress ?? stop.note ?? null,
    rating: place.rating ?? null,
    userRatingCount: place.userRatingCount ?? null,
    phone: place.nationalPhoneNumber ?? place.internationalPhoneNumber ?? null,
    website: place.websiteURI ?? null,
    mapsUrl: place.googleMapsURI ?? null,
    location: placeLocationToLiteral(place.location) ?? center,
    isRestaurant,
    priceLabel: priceLevelToLabel(place.priceLevel),
    foodTraitKeys: foodTraitKeysForPlace(place),
    photos,
    hours:
      place.currentOpeningHours?.weekdayDescriptions ??
      place.regularOpeningHours?.weekdayDescriptions ??
      [],
    openingHours: place.currentOpeningHours ?? place.regularOpeningHours ?? null,
    reviews,
  };
}

async function findStopGooglePlace({
  stop,
  city,
  center,
  language,
}: {
  stop: TripDayModel["stops"][number];
  city: string | null;
  center: google.maps.LatLngLiteral | null;
  language: string | undefined;
}): Promise<google.maps.places.Place | null> {
  if (stop.placeId) {
    const placeById = await fetchStopGooglePlaceById(stop.placeId).catch(
      () => null,
    );
    if (placeById) return placeById;
  }

  const textPlace = await searchStopPlaceByText({
    stop,
    city,
    center,
    language,
  });
  if (stop.placeName?.trim()) return textPlace;

  const textPlaceLocation = placeLocationToLiteral(textPlace?.location);
  if (
    textPlace &&
    center &&
    textPlaceLocation &&
    distanceMeters(center, textPlaceLocation) <= 300 &&
    landmarkLabelForStop(textPlace.displayName, stop)
  ) {
    return textPlace;
  }

  if (!center) return textPlace;

  return (
    (await searchNearestStopPlaceByCoordinates({ stop, center, language })) ??
    textPlace
  );
}

async function fetchStopGooglePlaceById(
  placeId: string,
): Promise<google.maps.places.Place | null> {
  const cleanPlaceId = placeId.trim();
  if (!cleanPlaceId) return null;
  const { Place } = await loadGooglePlaces();
  return new Place({ id: cleanPlaceId });
}

async function searchStopPlaceByText({
  stop,
  city,
  center,
  language,
}: {
  stop: TripDayModel["stops"][number];
  city: string | null;
  center: google.maps.LatLngLiteral | null;
  language: string | undefined;
}): Promise<google.maps.places.Place | null> {
  const { Place } = await loadGooglePlaces();
  const hasExplicitPlaceName = Boolean(stop.placeName?.trim());
  const response = await Place.searchByText({
    textQuery: [mappableStopName(stop), city].filter(Boolean).join(" "),
    fields: ["id", "displayName", "formattedAddress", "location"],
    ...(center && !hasExplicitPlaceName
      ? { locationBias: { center, radius: 1800 } }
      : {}),
    maxResultCount: 5,
    language,
  });

  const candidates = response.places
    .map((candidate) => ({
      place: candidate,
      location: placeLocationToLiteral(candidate.location),
    }))
    .filter(
      (
        candidate,
      ): candidate is {
        place: google.maps.places.Place;
        location: google.maps.LatLngLiteral;
      } => candidate.location != null,
    );
  if (hasExplicitPlaceName) {
    const expectedName = stop.placeName?.trim() ?? "";
    return (
      candidates.find((candidate) =>
        googlePlaceTextMatches(candidate.place, expectedName),
      )?.place ??
      candidates[0]?.place ??
      null
    );
  }
  if (!center) return candidates[0]?.place ?? null;
  return candidates.sort(
    (a, b) =>
      distanceMeters(center, a.location) - distanceMeters(center, b.location),
  )[0]?.place ?? null;
}

function googlePlaceTextMatches(
  place: google.maps.places.Place,
  expectedName: string,
): boolean {
  const expected = normalizePlaceToken(expectedName);
  if (!expected) return false;
  return [place.displayName, place.formattedAddress]
    .map((value) => normalizePlaceToken(value ?? ""))
    .some(
      (candidate) =>
        candidate === expected ||
        (expected.length >= 6 && candidate.includes(expected)) ||
        (candidate.length >= 6 && expected.includes(candidate)),
    );
}

async function searchNearestStopPlaceByCoordinates({
  stop,
  center,
  language,
}: {
  stop: TripDayModel["stops"][number];
  center: google.maps.LatLngLiteral;
  language: string | undefined;
}): Promise<google.maps.places.Place | null> {
  const { Place, SearchNearbyRankPreference } = await loadGooglePlaces();
  const candidates: Array<{
    place: google.maps.places.Place;
    distance: number;
  }> = [];
  const seen = new Set<string>();

  for (const primaryType of stopNearbyPrimaryTypes(stop)) {
    try {
      const response = await Place.searchNearby({
        fields: ["id", "displayName", "formattedAddress", "location"],
        includedPrimaryTypes: [primaryType],
        locationRestriction: { center, radius: 220 },
        maxResultCount: 4,
        rankPreference: SearchNearbyRankPreference.DISTANCE,
        language,
      });
      response.places.forEach((place) => {
        const location = placeLocationToLiteral(place.location);
        if (!location) return;
        const distance = distanceMeters(center, location);
        if (distance > 260) return;
        const key = place.id ?? `${place.displayName ?? ""}:${distance.toFixed(1)}`;
        if (seen.has(key)) return;
        seen.add(key);
        candidates.push({ place, distance });
      });
    } catch {
      // Some Google primary types are not available in every Places rollout.
    }
  }

  return candidates.sort((a, b) => a.distance - b.distance)[0]?.place ?? null;
}

function stopNearbyPrimaryTypes(stop: TripDayModel["stops"][number]): string[] {
  const placeTypes = new Set(stop.placeTypes ?? []);
  if (placeTypes.has("furniture_store") || placeTypes.has("home_goods_store")) {
    return ["furniture_store", "home_goods_store", "store"];
  }
  if (
    placeTypes.has("clothing_store") ||
    placeTypes.has("store") ||
    placeTypes.has("shopping_mall")
  ) {
    return ["clothing_store", "store", "shopping_mall"];
  }
  if (placeTypes.has("art_gallery") || placeTypes.has("museum")) {
    return ["art_gallery", "museum", "tourist_attraction"];
  }
  if (stop.kind === "meal") {
    return ["restaurant", "cafe", "bar"];
  }
  return [
    "tourist_attraction",
    "museum",
    "art_gallery",
    "store",
    "shopping_mall",
    "restaurant",
    "cafe",
  ];
}

function isRestaurantPlaceType(type: string): boolean {
  return [
    "restaurant",
    "cafe",
    "bar",
    "bakery",
    "meal_delivery",
    "meal_takeaway",
    "food",
  ].includes(type);
}

function priceLevelToLabel(
  priceLevel: google.maps.places.PriceLevelString | null | undefined,
): string | null {
  if (!priceLevel) return null;
  if (priceLevel.includes("FREE")) return "$0";
  if (priceLevel.includes("INEXPENSIVE")) return "$";
  if (priceLevel.includes("MODERATE")) return "$$";
  if (priceLevel.includes("EXPENSIVE") && !priceLevel.includes("VERY")) return "$$$";
  if (priceLevel.includes("VERY_EXPENSIVE")) return "$$$$";
  return null;
}

function foodTraitKeysForPlace(
  place: google.maps.places.Place,
): PlaceFoodTrait[] {
  return [
    place.servesBreakfast ? "breakfast" : null,
    place.servesBrunch ? "brunch" : null,
    place.servesLunch ? "lunch" : null,
    place.servesDinner ? "dinner" : null,
    place.servesCoffee ? "coffee" : null,
    place.servesVegetarianFood ? "vegetarian" : null,
    place.hasDelivery ? "delivery" : null,
    place.hasDineIn ? "dine_in" : null,
    place.isReservable ? "reservable" : null,
  ].filter((key): key is PlaceFoodTrait => key != null);
}

async function geocodeLandmark(
  query: string,
  contextCity?: string | null,
  locationBias?: google.maps.LatLngLiteral | null,
): Promise<LandmarkSearchResult[]> {
  const cleanQuery = query.trim();
  const q = contextCity ? `${cleanQuery} ${contextCity}` : cleanQuery;
  const language = typeof document === "undefined"
    ? undefined
    : document.documentElement.lang || navigator.language || undefined;
  const { AutocompleteSessionToken, AutocompleteSuggestion } =
    await loadGooglePlaces();
  const sessionToken = new AutocompleteSessionToken();
  const response = await AutocompleteSuggestion.fetchAutocompleteSuggestions({
    input: q,
    language,
    ...(locationBias
      ? { locationBias: { center: locationBias, radius: 3500 } }
      : {}),
    sessionToken,
  });

  const predictions = response.suggestions
    .map((suggestion) => suggestion.placePrediction)
    .filter((prediction): prediction is google.maps.places.PlacePrediction =>
      prediction != null,
    )
    .slice(0, 6);

  const results: Array<LandmarkSearchResult | null> = await Promise.all(
    predictions.map(async (prediction, index) => {
      const place = prediction.toPlace();
      await place.fetchFields({
        fields: [
          "id",
          "displayName",
          "formattedAddress",
          "location",
          "svgIconMaskURI",
          "iconBackgroundColor",
          "primaryType",
          "types",
        ],
      });
      const location = place.location;
      if (!location) return null;
      const name =
        place.displayName ??
        prediction.mainText?.text ??
        prediction.text.text ??
        cleanQuery;
      const address =
        place.formattedAddress ??
        prediction.secondaryText?.text ??
        prediction.text.text ??
        name;
      const placeId = place.id || prediction.placeId || undefined;
      const icon = googlePlaceIconForPlace(place);
      return {
        id: placeId ?? `${name}-${index}`,
        placeId,
        name,
        address,
        lat: location.lat(),
        lng: location.lng(),
        iconMaskUri: icon.iconMaskUri,
        iconBackgroundColor: icon.iconBackgroundColor,
        primaryType: place.primaryType ?? null,
        types: place.types ?? [],
      } satisfies LandmarkSearchResult;
    }),
  );

  return results.filter(
    (result): result is LandmarkSearchResult => result != null,
  );
}

async function fetchLandmarkByPlaceId(
  placeId: string,
  fallbackLocation: google.maps.LatLngLiteral,
): Promise<LandmarkSearchResult | null> {
  const { Place } = await loadGooglePlaces();
  const place = new Place({ id: placeId });
  await place.fetchFields({
    fields: [
      "id",
      "displayName",
      "formattedAddress",
      "location",
      "svgIconMaskURI",
      "iconBackgroundColor",
      "primaryType",
      "types",
    ],
  });
  const icon = googlePlaceIconForPlace(place);
  const location = placeLocationToLiteral(place.location) ?? fallbackLocation;
  const name = place.displayName ?? place.formattedAddress ?? "Google Maps";
  return {
    id: place.id || placeId,
    placeId: place.id || placeId,
    name,
    address: place.formattedAddress ?? name,
    lat: location.lat,
    lng: location.lng,
    iconMaskUri: icon.iconMaskUri,
    iconBackgroundColor: icon.iconBackgroundColor,
    primaryType: place.primaryType ?? null,
    types: place.types ?? [],
  };
}

function googlePlaceIconForPlace(
  place: google.maps.places.Place,
): { iconMaskUri: string | null; iconBackgroundColor: string | null } {
  const placeWithIcon = place as google.maps.places.Place & {
    svgIconMaskURI?: string | null;
    iconBackgroundColor?: string | null;
    primaryType?: string | null;
    types?: string[] | null;
  };
  const fallbackIcon = googlePlaceIconForTypes(
    placeWithIcon.primaryType,
    placeWithIcon.types,
  );
  const baseMapColor = googleBaseMapColorForTypes(
    placeWithIcon.primaryType,
    placeWithIcon.types,
  );
  return {
    iconMaskUri:
      normalizeGooglePlaceIconUri(placeWithIcon.svgIconMaskURI) ??
      fallbackIcon.iconMaskUri,
    iconBackgroundColor:
      baseMapColor ?? placeWithIcon.iconBackgroundColor ?? fallbackIcon.iconBackgroundColor,
  };
}

function normalizeGooglePlaceIconUri(uri: string | null | undefined): string | null {
  if (!uri) return null;
  return uri.endsWith(".svg") ? uri : `${uri}.svg`;
}

function googlePlaceIconForTypes(
  primaryType?: string | null,
  types?: string[] | null,
): { iconMaskUri: string | null; iconBackgroundColor: string | null } {
  const placeTypes = [primaryType, ...(types ?? [])]
    .filter((type): type is string => Boolean(type))
    .map((type) => type.toLowerCase());
  const icon = placeTypes.map(googlePlaceIconForType).find((item) => item != null);
  return icon ?? { iconMaskUri: null, iconBackgroundColor: null };
}

function googleBaseMapColorForTypes(
  primaryType?: string | null,
  types?: string[] | null,
): string | null {
  const placeTypes = [primaryType, ...(types ?? [])]
    .filter((type): type is string => Boolean(type))
    .map((type) => type.toLowerCase());
  if (
    placeTypes.some((type) =>
      ["bed_and_breakfast", "hotel", "lodging", "motel", "resort_hotel"].includes(type),
    )
  ) {
    return "#D56B88";
  }
  return null;
}

function googlePlaceIconForType(
  type: string,
): { iconMaskUri: string; iconBackgroundColor: string } | null {
  const base = "https://maps.gstatic.com/mapfiles/place_api/icons/v2";
  if (["restaurant", "bakery", "meal_delivery", "meal_takeaway", "food"].includes(type)) {
    return { iconMaskUri: `${base}/restaurant_pinlet.svg`, iconBackgroundColor: "#FF9E67" };
  }
  if (["cafe", "coffee_shop"].includes(type)) {
    return { iconMaskUri: `${base}/cafe_pinlet.svg`, iconBackgroundColor: "#FF9E67" };
  }
  if (["bar", "night_club"].includes(type)) {
    return { iconMaskUri: `${base}/bar_pinlet.svg`, iconBackgroundColor: "#FF9E67" };
  }
  if (["church", "place_of_worship"].includes(type)) {
    return { iconMaskUri: `${base}/worship_christian_pinlet.svg`, iconBackgroundColor: "#7B9EB0" };
  }
  if (type === "hindu_temple") {
    return { iconMaskUri: `${base}/worship_hindu_pinlet.svg`, iconBackgroundColor: "#7B9EB0" };
  }
  if (type === "mosque") {
    return { iconMaskUri: `${base}/worship_islam_pinlet.svg`, iconBackgroundColor: "#7B9EB0" };
  }
  if (type === "synagogue") {
    return { iconMaskUri: `${base}/worship_jewish_pinlet.svg`, iconBackgroundColor: "#7B9EB0" };
  }
  if (type === "jain_temple") {
    return { iconMaskUri: `${base}/worship_jain_pinlet.svg`, iconBackgroundColor: "#7B9EB0" };
  }
  if (type === "sikh_temple") {
    return { iconMaskUri: `${base}/worship_sikh_pinlet.svg`, iconBackgroundColor: "#7B9EB0" };
  }
  if (["park", "natural_feature"].includes(type)) {
    return { iconMaskUri: `${base}/tree_pinlet.svg`, iconBackgroundColor: "#4DB546" };
  }
  if (["campground", "rv_park"].includes(type)) {
    return { iconMaskUri: `${base}/camping_pinlet.svg`, iconBackgroundColor: "#4DB546" };
  }
  if (["tourist_attraction", "aquarium", "zoo"].includes(type)) {
    return { iconMaskUri: `${base}/dolphin_pinlet.svg`, iconBackgroundColor: "#13B5C7" };
  }
  if (
    [
      "castle",
      "chateau",
      "cultural_landmark",
      "historical_landmark",
      "historical_place",
      "landmark",
      "palace",
    ].includes(type)
  ) {
    return { iconMaskUri: `${base}/historic_pinlet.svg`, iconBackgroundColor: "#13B5C7" };
  }
  if (["monument", "sculpture", "fountain"].includes(type)) {
    return { iconMaskUri: `${base}/monument_pinlet.svg`, iconBackgroundColor: "#7B9EB0" };
  }
  if (["museum", "art_museum", "history_museum", "art_gallery"].includes(type)) {
    return { iconMaskUri: `${base}/museum_pinlet.svg`, iconBackgroundColor: "#13B5C7" };
  }
  if (["movie_theater", "movie_rental"].includes(type)) {
    return { iconMaskUri: `${base}/movie_pinlet.svg`, iconBackgroundColor: "#13B5C7" };
  }
  if (["performing_arts_theater", "theater", "amphitheatre", "opera_house"].includes(type)) {
    return { iconMaskUri: `${base}/theater_pinlet.svg`, iconBackgroundColor: "#13B5C7" };
  }
  if (["concert_hall", "event_venue", "live_music_venue", "music_venue", "philharmonic_hall"].includes(type)) {
    return { iconMaskUri: `${base}/theater_pinlet.svg`, iconBackgroundColor: "#13B5C7" };
  }
  if (type === "library") {
    return { iconMaskUri: `${base}/library_pinlet.svg`, iconBackgroundColor: "#7B9EB0" };
  }
  if (["bed_and_breakfast", "hotel", "lodging", "motel", "resort_hotel"].includes(type)) {
    return { iconMaskUri: `${base}/hotel_pinlet.svg`, iconBackgroundColor: "#D56B88" };
  }
  if (type === "airport") {
    return { iconMaskUri: `${base}/airport_pinlet.svg`, iconBackgroundColor: "#10BDFF" };
  }
  if (["train_station", "subway_station", "light_rail_station", "transit_station"].includes(type)) {
    return { iconMaskUri: `${base}/train_rail_1_pinlet.svg`, iconBackgroundColor: "#10BDFF" };
  }
  if (["bus_station", "taxi_stand"].includes(type)) {
    return { iconMaskUri: `${base}/bus_share_taxi_pinlet.svg`, iconBackgroundColor: "#10BDFF" };
  }
  if (["establishment", "point_of_interest"].includes(type)) {
    return { iconMaskUri: `${base}/generic_pinlet.svg`, iconBackgroundColor: "#7B9EB0" };
  }
  return null;
}

async function searchNearbyPlaces(
  kind: NearbySearchKind,
  viewport: TripMapViewport | null,
  fallbackCenter: google.maps.LatLngLiteral | null,
  options: { preferFallbackCenter?: boolean } = {},
): Promise<LandmarkSearchResult[]> {
  return searchNearbyPlacesByPrimaryType(
    nearbyPrimaryType(kind),
    viewport,
    fallbackCenter,
    options,
  );
}

async function searchNearbyPlacesByPrimaryType(
  primaryType: string,
  viewport: TripMapViewport | null,
  fallbackCenter: google.maps.LatLngLiteral | null,
  options: { preferFallbackCenter?: boolean } = {},
): Promise<LandmarkSearchResult[]> {
  if (primaryType === "lodging") {
    let lastError: unknown = null;
    for (const lodgingType of ["lodging", "hotel"]) {
      try {
        const results = await searchNearbyPlacesBySinglePrimaryType(
          lodgingType,
          viewport,
          fallbackCenter,
          options,
        );
        if (results.length > 0 || lodgingType === "hotel") return results;
      } catch (error) {
        lastError = error;
      }
    }
    if (lastError) throw lastError;
    return [];
  }
  return searchNearbyPlacesBySinglePrimaryType(
    primaryType,
    viewport,
    fallbackCenter,
    options,
  );
}

async function searchNearbyPlacesBySinglePrimaryType(
  primaryType: string,
  viewport: TripMapViewport | null,
  fallbackCenter: google.maps.LatLngLiteral | null,
  options: { preferFallbackCenter?: boolean } = {},
): Promise<LandmarkSearchResult[]> {
  const center =
    options.preferFallbackCenter && fallbackCenter
      ? fallbackCenter
      : viewport?.center ?? fallbackCenter;
  if (!center) return [];
  const viewportForFilter =
    viewport && isWithinViewport(center, viewport.bounds) ? viewport : null;
  const language = typeof document === "undefined"
    ? undefined
    : document.documentElement.lang || navigator.language || undefined;
  const { Place, SearchNearbyRankPreference } = await loadGooglePlaces();
  const response = await Place.searchNearby({
    fields: [
      "id",
      "displayName",
      "formattedAddress",
      "location",
      "svgIconMaskURI",
      "iconBackgroundColor",
      "primaryType",
      "types",
    ],
    includedPrimaryTypes: [primaryType],
    locationRestriction: {
      center,
      radius: viewportForFilter
        ? Math.min(50000, Math.max(1200, viewportForFilter.radiusMeters))
        : 3500,
    },
    maxResultCount: 12,
    rankPreference: SearchNearbyRankPreference.DISTANCE,
    language,
  });

  const results: LandmarkSearchResult[] = [];
  response.places.forEach((place, index) => {
    const location = placeLocationToLiteral(place.location);
    if (!location) return;
    if (viewportForFilter && !isWithinViewport(location, viewportForFilter.bounds)) return;
    const name = place.displayName ?? place.formattedAddress ?? "Place";
    const icon = googlePlaceIconForPlace(place);
    results.push({
      id: place.id ?? `${name}-${index}`,
      ...(place.id ? { placeId: place.id } : {}),
      name,
      address: place.formattedAddress ?? name,
      lat: location.lat,
      lng: location.lng,
      iconMaskUri: icon.iconMaskUri,
      iconBackgroundColor: icon.iconBackgroundColor,
      primaryType: place.primaryType ?? null,
      types: place.types ?? [],
    });
  });

  return results.slice(0, 8);
}

function nearbyPrimaryType(kind: NearbySearchKind): string {
  if (kind === "stay") return "lodging";
  if (kind === "coffee") return "cafe";
  if (kind === "food") return "restaurant";
  return "tourist_attraction";
}

function placeLocationToLiteral(
  location: google.maps.LatLng | google.maps.LatLngLiteral | null | undefined,
): google.maps.LatLngLiteral | null {
  if (!location) return null;
  if (typeof location.lat === "function" && typeof location.lng === "function") {
    return { lat: location.lat(), lng: location.lng() };
  }
  if (typeof location.lat === "number" && typeof location.lng === "number") {
    return { lat: location.lat, lng: location.lng };
  }
  return null;
}

function distanceMeters(
  a: google.maps.LatLngLiteral,
  b: google.maps.LatLngLiteral,
): number {
  const radius = 6371000;
  const latA = (a.lat * Math.PI) / 180;
  const latB = (b.lat * Math.PI) / 180;
  const deltaLat = ((b.lat - a.lat) * Math.PI) / 180;
  const deltaLng = ((b.lng - a.lng) * Math.PI) / 180;
  const h =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(latA) *
      Math.cos(latB) *
      Math.sin(deltaLng / 2) *
      Math.sin(deltaLng / 2);
  return radius * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function isWithinViewport(
  point: google.maps.LatLngLiteral,
  bounds: TripMapViewport["bounds"],
): boolean {
  const withinLatitude = point.lat >= bounds.south && point.lat <= bounds.north;
  const withinLongitude =
    bounds.west <= bounds.east
      ? point.lng >= bounds.west && point.lng <= bounds.east
      : point.lng >= bounds.west || point.lng <= bounds.east;
  return withinLatitude && withinLongitude;
}

function landmarkKey(landmark: {
  id?: string;
  placeId?: string;
  lat: number;
  lng: number;
}): string {
  return `${landmark.placeId ?? landmark.id}:${landmark.lat}:${landmark.lng}`;
}

function landmarkToStop(landmark: LandmarkSearchResult): TripDayModel["stops"][number] {
  return {
    name: landmark.name,
    placeName: landmark.name,
    placeId: landmark.placeId ?? null,
    placeAddress: landmark.address,
    kind: kindForLandmark(landmark),
    arrival_time: null,
    duration_min: 75,
    note: landmark.address,
    attachments: [],
    lat: landmark.lat,
    lng: landmark.lng,
  };
}

function placeSuggestionToLandmark(
  suggestion: TripPlaceSuggestion,
): LandmarkSearchResult {
  return {
    id: suggestion.id,
    placeId: suggestion.placeId ?? undefined,
    name: suggestion.name,
    address: suggestion.address ?? "",
    lat: suggestion.lat,
    lng: suggestion.lng,
    primaryType: suggestion.primaryType ?? null,
    types: suggestion.types,
    selected: suggestion.selected === true,
  };
}

function kindForLandmark(landmark: LandmarkSearchResult): string {
  const types = new Set([
    landmark.primaryType,
    ...(landmark.types ?? []),
  ].filter((type): type is string => Boolean(type)));
  if (["restaurant", "cafe", "bakery", "bar", "food"].some((type) => types.has(type))) {
    return "meal";
  }
  if (
    ["store", "furniture_store", "home_goods_store", "clothing_store", "book_store"].some(
      (type) => types.has(type),
    )
  ) {
    return "shop";
  }
  if (["lodging", "hotel"].some((type) => types.has(type))) return "stay";
  if (["airport", "train_station", "transit_station"].some((type) => types.has(type))) {
    return "transit";
  }
  if (["museum", "art_gallery", "tourist_attraction", "park"].some((type) => types.has(type))) {
    return "sight";
  }
  return "other";
}

function landmarkToLodgingStop(
  landmark: LandmarkSearchResult,
): TripDayModel["stops"][number] {
  return {
    name: landmark.name,
    placeName: landmark.name,
    placeId: landmark.placeId ?? null,
    placeAddress: landmark.address,
    kind: "stay",
    arrival_time: null,
    duration_min: null,
    note: landmark.address,
    attachments: [],
    lat: landmark.lat,
    lng: landmark.lng,
  };
}

function landmarkToHomePlace(landmark: LandmarkSearchResult): UserHomePlace {
  return {
    name: landmark.name,
    address: landmark.address,
    lat: landmark.lat,
    lng: landmark.lng,
    placeId: landmark.placeId ?? null,
  };
}

function homePlaceToLandmark(homePlace: UserHomePlace): LandmarkSearchResult {
  return {
    id: homePlace.placeId ?? `${homePlace.name}:${homePlace.lat}:${homePlace.lng}`,
    placeId: homePlace.placeId ?? undefined,
    name: homePlace.name,
    address: homePlace.address,
    lat: homePlace.lat,
    lng: homePlace.lng,
    primaryType: "home",
    types: ["home"],
  };
}

function planLandmarkInsertion(
  days: TripDayModel[],
  landmark: LandmarkSearchResult,
): { days: TripDayModel[]; dayIndex: number; stopIndex: number } {
  const candidateStop = landmarkToStop(landmark);
  const placements = days.map((day, dayIndex) => {
    const bestStopIndex = bestInsertionIndex(day.stops, candidateStop);
    const cost = insertionCost(day.stops, candidateStop, bestStopIndex);
    return { dayIndex, stopIndex: bestStopIndex, cost };
  });
  const best = placements.sort((a, b) => a.cost - b.cost)[0] ?? {
    dayIndex: 0,
    stopIndex: 0,
  };
  const nextDays = days.map((day, dayIndex) =>
    dayIndex === best.dayIndex
      ? {
          ...day,
          stops: [
            ...day.stops.slice(0, best.stopIndex),
            candidateStop,
            ...day.stops.slice(best.stopIndex),
          ],
        }
      : day,
  );
  return { days: nextDays, dayIndex: best.dayIndex, stopIndex: best.stopIndex };
}

function selectedSuggestionForPlacement(
  days: TripDayModel[],
  placement: SuggestedPlacePlacement,
  landmark: LandmarkSearchResult,
): boolean {
  const suggestion = days[placement.dayIndex]?.stops[
    placement.stopIndex
  ]?.placeSuggestions?.find((candidate) =>
    sameSuggestionLandmark(candidate, landmark),
  );
  return suggestion?.selected === true;
}

function setSuggestedPlaceSelected(
  days: TripDayModel[],
  placement: SuggestedPlacePlacement,
  landmark: LandmarkSearchResult,
  selected: boolean,
): TripDayModel[] {
  return days.map((day, dayIndex) => {
    if (dayIndex !== placement.dayIndex) return day;
    return {
      ...day,
      stops: day.stops.map((stop, stopIndex) => {
        if (stopIndex !== placement.stopIndex) return stop;
        return {
          ...stop,
          placeSuggestions: (stop.placeSuggestions ?? []).map((suggestion) =>
            sameSuggestionLandmark(suggestion, landmark)
              ? { ...suggestion, selected }
              : suggestion,
          ),
        };
      }),
    };
  });
}

function sameSuggestionLandmark(
  suggestion: TripPlaceSuggestion,
  landmark: LandmarkSearchResult,
): boolean {
  if (suggestion.placeId && landmark.placeId) {
    return suggestion.placeId === landmark.placeId;
  }
  return (
    suggestion.id === landmark.id ||
    (suggestion.name === landmark.name &&
      suggestion.lat === landmark.lat &&
      suggestion.lng === landmark.lng)
  );
}

function bestInsertionIndex(
  stops: TripDayModel["stops"],
  candidate: TripDayModel["stops"][number],
): number {
  let bestIndex = stops.length;
  let bestCost = Number.POSITIVE_INFINITY;
  for (let index = 0; index <= stops.length; index += 1) {
    const cost = insertionCost(stops, candidate, index);
    if (cost < bestCost) {
      bestCost = cost;
      bestIndex = index;
    }
  }
  return bestIndex;
}

function insertionCost(
  stops: TripDayModel["stops"],
  candidate: TripDayModel["stops"][number],
  index: number,
): number {
  if (candidate.lat == null || candidate.lng == null) return Number.POSITIVE_INFINITY;
  const point = { lat: candidate.lat, lng: candidate.lng };
  const previous = previousLocatedStop(stops, index);
  const next = nextLocatedStop(stops, index);
  if (!previous && !next) return 0;
  const previousPoint =
    previous?.lat != null && previous.lng != null
      ? { lat: previous.lat, lng: previous.lng }
      : null;
  const nextPoint =
    next?.lat != null && next.lng != null ? { lat: next.lat, lng: next.lng } : null;
  const direct =
    previousPoint && nextPoint ? distanceMeters(previousPoint, nextPoint) : 0;
  return (
    (previousPoint ? distanceMeters(previousPoint, point) : 0) +
    (nextPoint ? distanceMeters(point, nextPoint) : 0) -
    direct
  );
}

function previousLocatedStop(
  stops: TripDayModel["stops"],
  beforeIndex: number,
): TripDayModel["stops"][number] | null {
  for (let index = beforeIndex - 1; index >= 0; index -= 1) {
    const stop = stops[index];
    if (stop?.lat != null && stop.lng != null) return stop;
  }
  return null;
}

function nextLocatedStop(
  stops: TripDayModel["stops"],
  fromIndex: number,
): TripDayModel["stops"][number] | null {
  for (let index = fromIndex; index < stops.length; index += 1) {
    const stop = stops[index];
    if (stop?.lat != null && stop.lng != null) return stop;
  }
  return null;
}

async function arrangeDayStopsByRouteAndHours(
  day: TripDayModel,
  currentStops: TripDayModel["stops"],
): Promise<TripDayModel["stops"] | null> {
  const movablePositions = currentStops
    .map((stop, index) => ({ stop, index }))
    .filter(({ stop }) => canAutoArrangeStop(stop));
  if (movablePositions.length < 2) return currentStops;

  const detailsByStop = new Map<string, GoogleStopDetails | null>();
  await Promise.all(
    movablePositions.map(async ({ stop }) => {
      try {
        detailsByStop.set(
          stopScheduleKey(stop),
          await fetchStopGoogleDetails({ stop, city: day.city }),
        );
      } catch {
        detailsByStop.set(stopScheduleKey(stop), null);
      }
    }),
  );

  const options =
    movablePositions.length <= 7
      ? permutations(movablePositions)
          .sort((a, b) =>
            routeDistanceForArrangement(day, currentStops, a, detailsByStop) -
            routeDistanceForArrangement(day, currentStops, b, detailsByStop),
          )
      : [greedyArrangement(day, currentStops, movablePositions, detailsByStop)];

  for (const option of options) {
    const nextStops = stopsForArrangement(currentStops, option);
    if (arrangementFitsOpeningHours(day, nextStops, detailsByStop)) {
      return nextStops;
    }
  }

  return null;
}

function canAutoArrangeStop(stop: TripDayModel["stops"][number]): boolean {
  if (isPlaceholderStop(stop)) return false;
  if (stop.lat == null || stop.lng == null) return false;
  return !["transport", "transit", "flight", "airport_transfer"].includes(
    stop.kind ?? "",
  );
}

function routeDistanceForArrangement(
  day: TripDayModel,
  currentStops: TripDayModel["stops"],
  arrangement: Array<{ stop: TripDayModel["stops"][number]; index: number }>,
  detailsByStop: Map<string, GoogleStopDetails | null>,
): number {
  const arrangedStops = stopsForArrangement(currentStops, arrangement);
  return totalRouteDistance(
    arrangedStops,
    detailsByStop,
    autoArrangeStartPoint(day, currentStops, arrangement, detailsByStop),
  );
}

function stopsForArrangement(
  currentStops: TripDayModel["stops"],
  arrangement: Array<{ stop: TripDayModel["stops"][number]; index: number }>,
): TripDayModel["stops"] {
  const nextStops = [...currentStops];
  const slots = currentStops
    .map((stop, index) => ({ stop, index }))
    .filter(({ stop }) => canAutoArrangeStop(stop));
  arrangement.forEach(({ stop }, arrangementIndex) => {
    const target = slots[arrangementIndex];
    if (!target) return;
    const slotStop = currentStops[target.index];
    nextStops[target.index] = {
      ...stop,
      arrival_time: slotStop?.arrival_time ?? timeForStop(target.index),
    };
  });
  return nextStops;
}

function totalRouteDistance(
  stops: TripDayModel["stops"],
  detailsByStop: Map<string, GoogleStopDetails | null> = new Map(),
  startPoint: google.maps.LatLngLiteral | null = null,
): number {
  const points = [
    ...(startPoint ? [startPoint] : []),
    ...stops.flatMap((stop) => {
      const point = pointForAutoArrangeStop(stop, detailsByStop);
      return point ? [point] : [];
    }),
  ];
  return points.reduce((sum, point, index) => {
    const previous = points[index - 1];
    return previous ? sum + distanceMeters(previous, point) : sum;
  }, 0);
}

function greedyArrangement(
  day: TripDayModel,
  currentStops: TripDayModel["stops"],
  movablePositions: Array<{ stop: TripDayModel["stops"][number]; index: number }>,
  detailsByStop: Map<string, GoogleStopDetails | null>,
): Array<{ stop: TripDayModel["stops"][number]; index: number }> {
  const remaining = [...movablePositions];
  const arranged: Array<{ stop: TripDayModel["stops"][number]; index: number }> = [];
  let anchorPoint = autoArrangeStartPoint(day, currentStops, movablePositions, detailsByStop);
  while (remaining.length > 0) {
    const bestIndex = remaining.reduce((best, item, index) => {
      const itemPoint = pointForAutoArrangeStop(item.stop, detailsByStop);
      if (!anchorPoint || !itemPoint) return best;
      const bestStop = remaining[best]?.stop;
      const bestPoint = bestStop
        ? pointForAutoArrangeStop(bestStop, detailsByStop)
        : null;
      const bestDistance = bestPoint
        ? distanceMeters(anchorPoint, bestPoint)
        : Number.POSITIVE_INFINITY;
      const distance = distanceMeters(anchorPoint, itemPoint);
      return distance < bestDistance ? index : best;
    }, 0);
    const [next] = remaining.splice(bestIndex, 1);
    if (next) {
      arranged.push(next);
      anchorPoint = pointForAutoArrangeStop(next.stop, detailsByStop) ?? anchorPoint;
    }
  }
  return arranged.map((item, index) => ({
    ...item,
    index: movablePositions[index]?.index ?? item.index,
  }));
}

function autoArrangeStartPoint(
  day: TripDayModel,
  currentStops: TripDayModel["stops"],
  movablePositions: Array<{ stop: TripDayModel["stops"][number]; index: number }>,
  detailsByStop: Map<string, GoogleStopDetails | null>,
): google.maps.LatLngLiteral | null {
  const firstMovableIndex = movablePositions[0]?.index ?? 0;
  const previous = previousLocatedStop(currentStops, firstMovableIndex);
  if (previous) return pointForAutoArrangeStop(previous, detailsByStop);
  if (day.lat != null && day.lng != null) return { lat: day.lat, lng: day.lng };
  return null;
}

function pointForAutoArrangeStop(
  stop: TripDayModel["stops"][number],
  detailsByStop: Map<string, GoogleStopDetails | null>,
): google.maps.LatLngLiteral | null {
  const detailsLocation = detailsByStop.get(stopScheduleKey(stop))?.location;
  if (detailsLocation) return detailsLocation;
  if (stop.lat == null || stop.lng == null) return null;
  return { lat: stop.lat, lng: stop.lng };
}

function permutations<T>(items: T[]): T[][] {
  if (items.length <= 1) return [items];
  const result: T[][] = [];
  items.forEach((item, index) => {
    const rest = [...items.slice(0, index), ...items.slice(index + 1)];
    permutations(rest).forEach((tail) => result.push([item, ...tail]));
  });
  return result;
}

function arrangementFitsOpeningHours(
  day: TripDayModel,
  arrangedStops: TripDayModel["stops"],
  detailsByStop: Map<string, GoogleStopDetails | null>,
): boolean {
  return arrangedStops.every((stop, index) => {
    if (!canAutoArrangeStop(stop)) return true;
    const details = detailsByStop.get(stopScheduleKey(stop));
    if (!details?.openingHours?.periods.length) return true;
    const arrivalTime = normalizeEditableTime(stop.arrival_time) || timeForStop(index);
    const arrival = dateAtLocalTime(day.date, arrivalTime);
    const durationMin = Math.max(15, stop.duration_min ?? 75);
    const departure = new Date(arrival.getTime() + Math.max(1, durationMin - 1) * 60000);
    return (
      openingHoursContain(details.openingHours, arrival) &&
      openingHoursContain(details.openingHours, departure)
    );
  });
}

function stopScheduleKey(stop: TripDayModel["stops"][number]): string {
  return `${stop.name}:${stop.lat ?? ""}:${stop.lng ?? ""}`;
}

function dateAtLocalTime(date: string, time: string): Date {
  return new Date(`${date}T${time}:00`);
}

function openingHoursContain(
  hours: google.maps.places.OpeningHours,
  date: Date,
): boolean {
  const target = date.getDay() * 1440 + date.getHours() * 60 + date.getMinutes();
  return hours.periods.some((period) => {
    const start = period.open.day * 1440 + period.open.hour * 60 + period.open.minute;
    const close = period.close;
    if (!close) return true;
    let end = close.day * 1440 + close.hour * 60 + close.minute;
    if (end <= start) end += 7 * 1440;
    return (
      (target >= start && target < end) ||
      (target + 7 * 1440 >= start && target + 7 * 1440 < end)
    );
  });
}

async function replacePlaceholderWithLandmark({
  tripId,
  days,
  placeholder,
  landmark,
}: {
  tripId: string;
  days: TripDayModel[];
  placeholder: NonNullable<ActivePlaceholderSearch>;
  landmark: LandmarkSearchResult;
}): Promise<void> {
  const nextDays = days.map((day, dayIndex) => ({
    ...day,
    stops:
      dayIndex === placeholder.dayIndex
        ? day.stops.map((stop, stopIndex) =>
            stopIndex === placeholder.stopIndex
              ? {
                  ...stop,
                  name: landmark.name,
                  placeName: landmark.name,
                  placeId: landmark.placeId ?? null,
                  placeAddress: landmark.address,
                  kind: realKindForPlaceholder(placeholder.kind),
                  note: landmark.address,
                  lat: landmark.lat,
                  lng: landmark.lng,
                }
              : stop,
          )
        : day.stops,
  }));
  await replaceTripDays({ tripId, days: nextDays });
}

async function replaceTripDays({
  tripId,
  days,
}: {
  tripId: string;
  days: TripDayModel[];
}): Promise<void> {
  const body = {
    days: days.map((day) => ({
      day_date: day.date,
      city: day.city,
      cities: day.cities,
      segments: day.segments.map((segment) => ({
        city: segment.city,
        start_part: segment.start_part,
        end_part: segment.end_part,
        note: segment.note,
      })),
      note: day.note,
      stops: day.stops.map((stop) => ({
        name: stop.name,
        anchor_mode: normalizeTripStopAnchorMode(stop.anchorMode),
        place_name: stop.placeName ?? null,
        place_id: stop.placeId ?? null,
        place_address: stop.placeAddress ?? null,
        area_name: stop.areaName ?? null,
        search_query: stop.searchQuery ?? null,
        country_code: stop.countryCode ?? null,
        place_types: stop.placeTypes ?? [],
        suggestion_count: stop.suggestionCount ?? 5,
        place_suggestions: (stop.placeSuggestions ?? []).map((suggestion) => ({
          id: suggestion.id,
          place_id: suggestion.placeId ?? null,
          name: suggestion.name,
          address: suggestion.address ?? null,
          lat: suggestion.lat,
          lng: suggestion.lng,
          primary_type: suggestion.primaryType ?? null,
          types: suggestion.types ?? [],
          rating: suggestion.rating ?? null,
          user_rating_count: suggestion.userRatingCount ?? null,
          maps_url: suggestion.mapsUrl ?? null,
          selected: suggestion.selected === true,
        })),
        suggestions_status: stop.suggestionsStatus ?? "idle",
        kind: stop.kind ?? "other",
        arrival_time: stop.arrival_time ?? null,
        duration_min: stop.duration_min ?? null,
        note: stop.note ?? "",
        attachments: stopAttachmentsForApi(stop.attachments),
        lat: stop.lat ?? null,
        lng: stop.lng ?? null,
      })),
    })),
  };
  const response = await fetch(`/api/trips/${tripId}/days`, {
    method: "PUT",
    credentials: "same-origin",
    cache: "no-store",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`replace days failed: ${response.status}`);
}

type UserTravelPreferences = {
  home_place: UserHomePlace | null;
  departure_places: UserDeparturePlace[];
  selected_departure_place_id: string | null;
};

async function fetchUserPreferences(): Promise<UserTravelPreferences> {
  const response = await fetch("/api/me/preferences", {
    credentials: "same-origin",
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`preferences fetch failed: ${response.status}`);
  const data = (await response.json()) as {
    home_place?: unknown;
    departure_places?: unknown;
    selected_departure_place_id?: unknown;
  };
  const homePlace = normalizeUserHomePlace(data.home_place);
  const departurePlaces = normalizeUserDeparturePlaces(
    data.departure_places,
    homePlace,
  );
  return {
    home_place: homePlace,
    departure_places: departurePlaces,
    selected_departure_place_id:
      normalizeSelectedDeparturePlaceId(
        data.selected_departure_place_id,
        departurePlaces,
      ) ?? departurePlaces[0]?.id ?? null,
  };
}

async function updateUserTravelPreferences(input: {
  home_place?: UserHomePlace | null;
  departure_places?: UserDeparturePlace[];
  selected_departure_place_id?: string | null;
}): Promise<UserTravelPreferences> {
  const response = await fetch("/api/me/preferences", {
    method: "PATCH",
    credentials: "same-origin",
    cache: "no-store",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!response.ok) throw new Error(`preferences update failed: ${response.status}`);
  const data = (await response.json()) as {
    home_place?: unknown;
    departure_places?: unknown;
    selected_departure_place_id?: unknown;
  };
  const homePlace = normalizeUserHomePlace(data.home_place);
  const departurePlaces = normalizeUserDeparturePlaces(
    data.departure_places,
    homePlace,
  );
  return {
    home_place: homePlace,
    departure_places: departurePlaces,
    selected_departure_place_id:
      normalizeSelectedDeparturePlaceId(
        data.selected_departure_place_id,
        departurePlaces,
      ) ?? departurePlaces[0]?.id ?? null,
  };
}

function normalizeUserHomePlace(value: unknown): UserHomePlace | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const name = typeof record.name === "string" ? record.name.trim() : "";
  const address =
    typeof record.address === "string" ? record.address.trim() : "";
  const lat = typeof record.lat === "number" ? record.lat : Number.NaN;
  const lng = typeof record.lng === "number" ? record.lng : Number.NaN;
  const placeId =
    typeof record.placeId === "string" && record.placeId.trim()
      ? record.placeId.trim()
      : null;
  if (!name || !address || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null;
  }
  return { name, address, lat, lng, placeId };
}

function normalizeUserDeparturePlaces(
  value: unknown,
  fallbackHomePlace: UserHomePlace | null,
): UserDeparturePlace[] {
  const places = Array.isArray(value)
    ? value.flatMap((item) => {
        const place = normalizeUserDeparturePlace(item);
        return place ? [place] : [];
      })
    : [];
  return dedupeUserDeparturePlaces(
    places.length === 0 && fallbackHomePlace
      ? [homePlaceToDeparturePlace(fallbackHomePlace)]
      : places,
  );
}

function normalizeUserDeparturePlace(value: unknown): UserDeparturePlace | null {
  if (!value || typeof value !== "object") return null;
  const homePlace = normalizeUserHomePlace(value);
  if (!homePlace) return null;
  const record = value as Record<string, unknown>;
  const id =
    typeof record.id === "string" && record.id.trim()
      ? record.id.trim()
      : departurePlaceId(homePlace);
  return { id, ...homePlace };
}

function homePlaceToDeparturePlace(
  homePlace: UserHomePlace,
): UserDeparturePlace {
  return { id: departurePlaceId(homePlace), ...homePlace };
}

function upsertDeparturePlace(
  places: UserDeparturePlace[],
  place: UserDeparturePlace,
): UserDeparturePlace[] {
  return dedupeUserDeparturePlaces([
    place,
    ...places.filter((current) => current.id !== place.id),
  ]);
}

function dedupeUserDeparturePlaces(
  places: UserDeparturePlace[],
): UserDeparturePlace[] {
  const seen = new Set<string>();
  const result: UserDeparturePlace[] = [];
  for (const place of places) {
    if (seen.has(place.id)) continue;
    seen.add(place.id);
    result.push(place);
  }
  return result.slice(0, 12);
}

function normalizeSelectedDeparturePlaceId(
  value: unknown,
  places: UserDeparturePlace[],
): string | null {
  if (typeof value !== "string") return null;
  const id = value.trim();
  if (!id) return null;
  return places.some((place) => place.id === id) ? id : null;
}

function departurePlaceId(place: UserHomePlace): string {
  const stable =
    place.placeId ?? `${place.name}:${place.address}:${place.lat}:${place.lng}`;
  return `departure:${stable
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")}`;
}

function readExplorationFlightDetails(
  metadata: Record<string, unknown>,
): Record<string, ExploreFlightDetails> {
  const planning =
    metadata.planning && typeof metadata.planning === "object"
      ? (metadata.planning as Record<string, unknown>)
      : null;
  const raw = planning?.exploration_flight_details;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  return Object.fromEntries(
    Object.entries(raw as Record<string, unknown>).flatMap(([key, value]) => {
      if (!key) return [];
      return [[key, normalizeExploreFlightDetails(value)]];
    }),
  );
}

function normalizeExploreFlightDetails(value: unknown): ExploreFlightDetails {
  if (!value || typeof value !== "object") {
    return {
      departureDate: "",
      departureTime: "",
      flightNumber: "",
      terminal: "",
      gate: "",
    };
  }
  const record = value as Record<string, unknown>;
  const rawGate = typeof record.gate === "string" ? record.gate.trim() : "";
  const gateLooksLikeTerminal = rawGate ? isTerminalFieldValue(rawGate) : false;
  return {
    departureDate:
      typeof record.departureDate === "string"
        ? normalizeIsoDateInput(record.departureDate)
        : typeof record.departure_date === "string"
          ? normalizeIsoDateInput(record.departure_date)
          : "",
    departureTime:
      typeof record.departureTime === "string"
        ? normalizeTimeInput(record.departureTime)
        : typeof record.departure_time === "string"
          ? normalizeTimeInput(record.departure_time)
          : "",
    flightNumber:
      typeof record.flightNumber === "string"
        ? record.flightNumber.trim().toUpperCase().slice(0, 16)
        : typeof record.flight_number === "string"
          ? record.flight_number.trim().toUpperCase().slice(0, 16)
          : "",
    terminal:
      typeof record.terminal === "string"
        ? record.terminal.trim().toUpperCase().slice(0, 24)
        : gateLooksLikeTerminal
          ? rawGate.toUpperCase().slice(0, 24)
        : "",
    gate:
      rawGate && !gateLooksLikeTerminal
        ? rawGate.toUpperCase().slice(0, 12)
        : "",
  };
}

function normalizeIsoDateInput(value: string): string {
  const clean = value.trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(clean) ? clean : "";
}

function normalizeTimeInput(value: string): string {
  const clean = value.trim();
  return /^\d{2}:\d{2}$/.test(clean) ? clean : "";
}

function isTerminalFieldValue(value: string): boolean {
  const clean = value.trim().toLowerCase();
  if (!clean) return false;
  if (clean.includes("terminal") || clean.includes("航廈") || clean.includes("航站")) {
    return true;
  }
  if (clean === "1" || clean === "2") return true;
  if (!clean.startsWith("t") || clean.length < 2) return false;
  const code = clean.charCodeAt(1);
  return code >= 48 && code <= 57;
}
