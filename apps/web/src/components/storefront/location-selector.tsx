"use client";

import { ChevronLeft, ChevronRight, Globe2, MapPin, Search, X } from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export type LocationKind = "world" | "region" | "country" | "city";

export type LocationSelection = {
  id: string;
  label: string;
  kind: LocationKind;
  path: string[];
};

export type LocationSelectorLabels = {
  placeholder: string;
  search_placeholder: string;
  popular: string;
  no_results: string;
  back: string;
  clear: string;
  select: string;
};

type LocationNode = {
  id: string;
  kind: LocationKind;
  labels: Record<string, string>;
  aliases: string[];
  children?: LocationNode[];
};

const LOCATION_TREE: LocationNode[] = [
  {
    id: "europe",
    kind: "region",
    labels: { en: "Europe", "zh-TW": "歐洲" },
    aliases: ["歐洲", "europe", "eu", "歐盟", "西歐", "東歐"],
    children: [
      city("france", "country", "France", "法國", ["paris", "巴黎"], [
        city("paris", "city", "Paris", "巴黎", ["法國巴黎", "パリ", "파리"]),
        city("nice", "city", "Nice", "尼斯", ["cote d azur", "蔚藍海岸"]),
      ]),
      city("italy", "country", "Italy", "義大利", ["rome", "venice", "義大利"], [
        city("rome", "city", "Rome", "羅馬", ["roma", "ローマ", "로마"]),
        city("venice", "city", "Venice", "威尼斯", ["venezia", "ヴェネツィア", "베네치아"]),
        city("milan", "city", "Milan", "米蘭", ["milano", "ミラノ", "밀라노"]),
      ]),
      city("switzerland", "country", "Switzerland", "瑞士", ["swiss", "jungfrau", "少女峰"], [
        city("zurich", "city", "Zurich", "蘇黎世", ["zuerich", "zürich", "チューリッヒ", "취리히"]),
        city("interlaken", "city", "Interlaken", "因特拉肯", ["少女峰", "jungfrau"]),
      ]),
      city("uk", "country", "United Kingdom", "英國", ["britain", "london", "uk"], [
        city("london", "city", "London", "倫敦", ["英國倫敦", "ロンドン", "런던"]),
        city("edinburgh", "city", "Edinburgh", "愛丁堡", ["蘇格蘭"]),
      ]),
      city("spain", "country", "Spain", "西班牙", ["barcelona", "madrid"], [
        city("barcelona", "city", "Barcelona", "巴塞隆納", ["巴薩", "バルセロナ", "바르셀로나"]),
        city("madrid", "city", "Madrid", "馬德里", []),
      ]),
    ],
  },
  {
    id: "asia",
    kind: "region",
    labels: { en: "Asia", "zh-TW": "亞洲" },
    aliases: ["asia", "亞洲", "東亞", "southeast asia", "東南亞"],
    children: [
      city("taiwan", "country", "Taiwan", "台灣", ["臺灣", "tw", "taipei", "台北"], [
        city("taipei", "city", "Taipei", "台北", ["台北市", "臺北", "臺北市", "タイペイ", "타이베이"]),
        city("taichung", "city", "Taichung", "台中", ["臺中", "台中市"]),
        city("tainan", "city", "Tainan", "台南", ["臺南", "台南市"]),
        city("kaohsiung", "city", "Kaohsiung", "高雄", ["高雄市"]),
      ]),
      city("japan", "country", "Japan", "日本", ["tokyo", "kyoto", "osaka", "日本"], [
        city("tokyo", "city", "Tokyo", "東京", ["東京市", "とうきょう", "도쿄"]),
        city("kyoto", "city", "Kyoto", "京都", ["祇園", "きょうと", "교토"]),
        city("osaka", "city", "Osaka", "大阪", ["おおさか", "오사카"]),
        city("hokkaido", "city", "Hokkaido", "北海道", ["札幌", "sapporo"]),
      ]),
      city("korea", "country", "South Korea", "韓國", ["korea", "seoul", "busan", "南韓"], [
        city("seoul", "city", "Seoul", "首爾", ["漢城", "서울", "ソウル"]),
        city("busan", "city", "Busan", "釜山", ["부산", "プサン"]),
      ]),
      city("hong-kong", "country", "Hong Kong", "香港", ["hk"], [
        city("hong-kong-city", "city", "Hong Kong", "香港", ["中環", "九龍"]),
      ]),
      city("singapore", "country", "Singapore", "新加坡", ["sg"], [
        city("singapore-city", "city", "Singapore", "新加坡", ["星加坡"]),
      ]),
      city("thailand", "country", "Thailand", "泰國", ["bangkok"], [
        city("bangkok", "city", "Bangkok", "曼谷", []),
      ]),
    ],
  },
  {
    id: "americas",
    kind: "region",
    labels: { en: "Americas", "zh-TW": "美洲" },
    aliases: ["america", "americas", "north america", "south america", "美洲"],
    children: [
      city("usa", "country", "United States", "美國", ["usa", "america", "new york"], [
        city("new-york", "city", "New York", "紐約", ["nyc"]),
        city("los-angeles", "city", "Los Angeles", "洛杉磯", ["la"]),
      ]),
      city("canada", "country", "Canada", "加拿大", ["toronto", "vancouver"], [
        city("toronto", "city", "Toronto", "多倫多", []),
        city("vancouver", "city", "Vancouver", "溫哥華", []),
      ]),
      city("brazil", "country", "Brazil", "巴西", ["rio"], [
        city("rio", "city", "Rio de Janeiro", "里約熱內盧", ["里約"]),
      ]),
    ],
  },
  {
    id: "oceania",
    kind: "region",
    labels: { en: "Oceania", "zh-TW": "大洋洲" },
    aliases: ["oceania", "australia", "大洋洲", "澳洲"],
    children: [
      city("australia", "country", "Australia", "澳洲", ["australia", "雪梨"], [
        city("sydney", "city", "Sydney", "雪梨", ["悉尼"]),
        city("melbourne", "city", "Melbourne", "墨爾本", []),
      ]),
      city("new-zealand", "country", "New Zealand", "紐西蘭", ["nz"], [
        city("auckland", "city", "Auckland", "奧克蘭", []),
      ]),
    ],
  },
  {
    id: "africa",
    kind: "region",
    labels: { en: "Africa", "zh-TW": "非洲" },
    aliases: ["africa", "非洲"],
    children: [
      city("morocco", "country", "Morocco", "摩洛哥", ["marrakesh"], [
        city("marrakesh", "city", "Marrakesh", "馬拉喀什", []),
      ]),
      city("south-africa", "country", "South Africa", "南非", ["cape town"], [
        city("cape-town", "city", "Cape Town", "開普敦", []),
      ]),
    ],
  },
];

export function LocationSelector({
  lang,
  value,
  labels,
  allowedKinds,
  onChange,
}: {
  lang: string;
  value: LocationSelection | null;
  labels: LocationSelectorLabels;
  allowedKinds?: LocationKind[];
  onChange: (value: LocationSelection | null) => void;
}) {
  const locale = lang || "en";
  const allowedKindSet = useMemo(
    () => (allowedKinds ? new Set<LocationKind>(allowedKinds) : null),
    [allowedKinds],
  );
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [parentId, setParentId] = useState<string | null>(null);
  const flattened = useMemo(() => flattenLocations(LOCATION_TREE, locale), [locale]);
  const parent = parentId ? flattened.find((item) => item.node.id === parentId) : null;
  const visibleNodes = parent?.node.children ?? LOCATION_TREE;
  const results = query.trim()
    ? flattened.filter((item) => item.search.includes(normalize(query))).slice(0, 10)
    : visibleNodes.map((node) => flattenNode(node, locale));

  function canSelect(item: FlattenedLocation) {
    return !allowedKindSet || allowedKindSet.has(item.node.kind);
  }

  function select(item: FlattenedLocation) {
    if (!canSelect(item)) {
      if (item.node.children?.length) {
        setParentId(item.node.id);
        setQuery("");
      }
      return;
    }
    onChange(toSelection(item));
    setOpen(false);
    setQuery("");
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className={cn(
            "mt-2 h-11 w-full justify-between rounded-xl border-divider-strong bg-white px-3.5 text-left text-[14px] font-medium",
            !value && "text-fg-muted",
          )}
        >
          <span className="flex min-w-0 items-center gap-2">
            <MapPin className="h-4 w-4 shrink-0 text-accent" />
            <span className="truncate">{value?.label ?? labels.placeholder}</span>
          </span>
          <ChevronRight className="h-4 w-4 shrink-0 text-fg-muted" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-[min(420px,calc(100vw-32px))] rounded-2xl border-divider bg-white p-3 shadow-xl"
      >
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-muted" />
          <Input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={labels.search_placeholder}
            className="h-10 rounded-xl pl-9 pr-9"
          />
          {query && (
            <button
              type="button"
              aria-label={labels.clear}
              onClick={() => setQuery("")}
              className="absolute right-2.5 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded-full text-fg-muted hover:bg-surface-hover"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {!query.trim() && (
          <div className="mt-3 flex items-center gap-2 text-[12px] font-semibold text-fg-muted">
            {parent && (
              <button
                type="button"
                onClick={() => setParentId(parent.parent?.id ?? null)}
                className="inline-flex h-7 items-center gap-1 rounded-full bg-surface px-2 text-fg-secondary hover:bg-surface-hover"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                {labels.back}
              </button>
            )}
            <span>{parent ? parent.path.join(" / ") : labels.popular}</span>
          </div>
        )}

        <div className="mt-3 max-h-[320px] space-y-1 overflow-y-auto pr-1">
          {results.length === 0 && (
            <div className="rounded-xl border border-dashed border-divider p-5 text-center text-[13px] text-fg-muted">
              {labels.no_results}
            </div>
          )}
          {results.map((item) => (
            <div
              key={item.node.id}
              className="group flex items-center gap-1 rounded-xl hover:bg-surface-hover"
            >
              <button
                type="button"
                onClick={() => select(item)}
                className="flex min-w-0 flex-1 items-center gap-3 px-3 py-2.5 text-left"
              >
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent">
                  {item.node.kind === "region" ? (
                    <Globe2 className="h-4 w-4" />
                  ) : (
                    <MapPin className="h-4 w-4" />
                  )}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-[14px] font-semibold text-fg">
                    {item.label}
                  </span>
                  <span className="block truncate text-[12px] text-fg-muted">
                    {item.path.join(" / ")}
                  </span>
                </span>
              </button>
              {item.node.children?.length ? (
                <button
                  type="button"
                  onClick={() => {
                    setParentId(item.node.id);
                    setQuery("");
                  }}
                  aria-label={labels.select}
                  className="mr-2 grid h-8 w-8 shrink-0 place-items-center rounded-full text-fg-muted hover:bg-white hover:text-fg"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              ) : null}
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function findLocationByText(
  text: string,
  lang: string,
): LocationSelection | null {
  const locale = lang || "en";
  const normalized = normalize(text);
  if (!normalized) return null;
  const flattened = flattenLocations(LOCATION_TREE, locale);
  const exact =
    flattened.find((item) => item.tokens.some((token) => token === normalized)) ??
    flattened.find((item) => normalized.includes(normalize(item.label)));
  return exact ? toSelection(exact) : null;
}

function city(
  id: string,
  kind: LocationKind,
  en: string,
  zh: string,
  aliases: string[],
  children?: LocationNode[],
): LocationNode {
  return {
    id,
    kind,
    labels: { en, "zh-TW": zh },
    aliases: [en, zh, ...aliases],
    children,
  };
}

type FlattenedLocation = {
  node: LocationNode;
  label: string;
  path: string[];
  search: string;
  tokens: string[];
  parent: LocationNode | null;
};

function flattenLocations(
  nodes: LocationNode[],
  locale: string,
  path: string[] = [],
  parent: LocationNode | null = null,
): FlattenedLocation[] {
  return nodes.flatMap((node) => {
    const current = flattenNode(node, locale, path, parent);
    return [
      current,
      ...flattenLocations(node.children ?? [], locale, current.path, node),
    ];
  });
}

function flattenNode(
  node: LocationNode,
  locale: string,
  path: string[] = [],
  parent: LocationNode | null = null,
): FlattenedLocation {
  const label = labelForLocationNode(node, locale);
  const fullPath = [...path, label];
  const tokens = [
    ...Object.values(node.labels),
    ...node.aliases,
    ...fullPath,
  ].map(normalize);
  return {
    node,
    label,
    path: fullPath,
    tokens,
    parent,
    search: tokens.join(" "),
  };
}

function toSelection(item: FlattenedLocation): LocationSelection {
  return {
    id: item.node.id,
    label: item.label,
    kind: item.node.kind,
    path: item.path,
  };
}

function labelForLocationNode(node: LocationNode, locale: string): string {
  return node.labels[locale] ?? node.labels.en ?? Object.values(node.labels)[0] ?? node.id;
}

function normalize(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .trim()
    .toLowerCase()
    .replace(/[’'`.-]/g, "")
    .replace(/\s+/g, " ");
}
