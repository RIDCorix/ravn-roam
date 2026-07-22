"use client";

// Lumi journey studio V3 — frontend prototype, built from scratch.
// Five acts on one studio desk:
//   1 時間與主要城市 → 2 路線與天數 → 3 亮點挑選 → 4 細排日程 → 5 草稿完成
// Everything here is mock data and local state; no backend calls.

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import {
  AnimatePresence,
  motion,
  useReducedMotion,
} from "framer-motion";
import {
  ArrowLeft,
  ArrowLeftRight,
  ArrowRight,
  CalendarDays,
  Check,
  Clock3,
  Landmark,
  MapPin,
  Minus,
  Plane,
  Plus,
  RefreshCw,
  ShoppingBag,
  Sparkles,
  Star,
  Utensils,
} from "lucide-react";

const EASE = [0.32, 0.72, 0, 1] as const;

// ── Mock data ───────────────────────────────────────────────────────────

type CityId =
  | "milan"
  | "paris"
  | "barcelona"
  | "london"
  | "amsterdam"
  | "prague";

interface City {
  id: CityId;
  name: string;
  country: string;
  tagline: string;
  image: string;
}

const CITIES: City[] = [
  { id: "milan", name: "米蘭", country: "義大利", tagline: "設計與時尚的腹地", image: "/illustrations/cities/milan.jpg" },
  { id: "paris", name: "巴黎", country: "法國", tagline: "美術館與街角咖啡", image: "/illustrations/cities/paris.jpg" },
  { id: "barcelona", name: "巴塞隆納", country: "西班牙", tagline: "高第的海濱幻想", image: "/illustrations/cities/barcelona.jpg" },
  { id: "london", name: "倫敦", country: "英國", tagline: "博物館與市集日常", image: "/illustrations/cities/london.jpg" },
  { id: "amsterdam", name: "阿姆斯特丹", country: "荷蘭", tagline: "運河邊的慢生活", image: "/illustrations/cities/amsterdam.jpg" },
  { id: "prague", name: "布拉格", country: "捷克", tagline: "石板路上的舊時光", image: "/illustrations/cities/prague.jpg" },
];

const CITY_BY_ID = new Map(CITIES.map((city) => [city.id, city]));

type AttractionKind = "sight" | "meal" | "shop";

interface Attraction {
  id: string;
  city: CityId;
  name: string;
  kind: AttractionKind;
  rating: number;
  reviews: string;
  duration: string;
  blurb: string;
  pos: string; // object-position crop variant over the city photo
}

const ATTRACTIONS: Attraction[] = [
  { id: "milan-duomo", city: "milan", name: "米蘭大教堂", kind: "sight", rating: 4.8, reviews: "9.8 萬", duration: "2 小時", blurb: "登上屋頂平台，從尖塔之間看整座城市。", pos: "50% 20%" },
  { id: "milan-galleria", city: "milan", name: "艾曼紐二世迴廊", kind: "shop", rating: 4.7, reviews: "6.1 萬", duration: "1 小時", blurb: "玻璃拱頂下的百年精品街廊。", pos: "30% 60%" },
  { id: "milan-cenacolo", city: "milan", name: "最後的晚餐", kind: "sight", rating: 4.6, reviews: "1.2 萬", duration: "45 分鐘", blurb: "達文西真跡，需要提前預約場次。", pos: "70% 40%" },
  { id: "milan-navigli", city: "milan", name: "Navigli 運河晚餐", kind: "meal", rating: 4.5, reviews: "2.4 萬", duration: "2 小時", blurb: "傍晚沿著運河挑一間餐酒館。", pos: "50% 80%" },
  { id: "milan-corso", city: "milan", name: "10 Corso Como", kind: "shop", rating: 4.4, reviews: "8 千", duration: "1.5 小時", blurb: "概念選物店的始祖，中庭咖啡也值得。", pos: "20% 30%" },
  { id: "paris-louvre", city: "paris", name: "羅浮宮", kind: "sight", rating: 4.7, reviews: "27 萬", duration: "3 小時", blurb: "先挑三件想看的作品，再開始迷路。", pos: "50% 30%" },
  { id: "paris-orsay", city: "paris", name: "奧塞美術館", kind: "sight", rating: 4.8, reviews: "8.9 萬", duration: "2.5 小時", blurb: "印象派的家，車站改建的光線很美。", pos: "60% 50%" },
  { id: "paris-marais", city: "paris", name: "Le Marais 選物", kind: "shop", rating: 4.6, reviews: "3.2 萬", duration: "2 小時", blurb: "Merci 起步，巷子裡的設計與古著。", pos: "30% 70%" },
  { id: "paris-septime", city: "paris", name: "Septime", kind: "meal", rating: 4.6, reviews: "5 千", duration: "2 小時", blurb: "新派法菜代表，記得提早一個月訂位。", pos: "80% 60%" },
  { id: "paris-seine", city: "paris", name: "塞納河遊船", kind: "sight", rating: 4.5, reviews: "11 萬", duration: "1 小時", blurb: "黃昏出發，橋下看巴黎亮燈。", pos: "40% 85%" },
  { id: "barcelona-sagrada", city: "barcelona", name: "聖家堂", kind: "sight", rating: 4.8, reviews: "21 萬", duration: "2 小時", blurb: "先買塔樓票，內部光影是另一個世界。", pos: "50% 15%" },
  { id: "barcelona-batllo", city: "barcelona", name: "巴特婁之家", kind: "sight", rating: 4.7, reviews: "9.4 萬", duration: "1.5 小時", blurb: "高第的海洋幻想，晚場有燈光導覽。", pos: "35% 45%" },
  { id: "barcelona-boqueria", city: "barcelona", name: "波蓋利亞市場", kind: "meal", rating: 4.5, reviews: "15 萬", duration: "1.5 小時", blurb: "午餐就在市場吧台解決，現切火腿配 Cava。", pos: "65% 70%" },
  { id: "barcelona-gothic", city: "barcelona", name: "哥德區老城", kind: "sight", rating: 4.6, reviews: "7.7 萬", duration: "2 小時", blurb: "巷弄與中庭，迷路是這裡的玩法。", pos: "20% 55%" },
  { id: "london-bm", city: "london", name: "大英博物館", kind: "sight", rating: 4.8, reviews: "18 萬", duration: "3 小時", blurb: "免費入場，先去看羅塞塔石碑。", pos: "50% 25%" },
  { id: "london-tate", city: "london", name: "泰特現代美術館", kind: "sight", rating: 4.6, reviews: "9.1 萬", duration: "2 小時", blurb: "渦輪大廳的尺度，頂樓看泰晤士河。", pos: "60% 60%" },
  { id: "london-borough", city: "london", name: "Borough Market", kind: "meal", rating: 4.6, reviews: "12 萬", duration: "1.5 小時", blurb: "倫敦最老食材市集，邊走邊吃。", pos: "30% 75%" },
  { id: "london-liberty", city: "london", name: "Liberty 百貨", kind: "shop", rating: 4.5, reviews: "2.8 萬", duration: "1.5 小時", blurb: "都鐸式木造樓裡的印花與選物。", pos: "75% 40%" },
  { id: "amsterdam-rijks", city: "amsterdam", name: "國家博物館", kind: "sight", rating: 4.7, reviews: "8.4 萬", duration: "2.5 小時", blurb: "夜巡在這裡，建築本身也是展品。", pos: "50% 30%" },
  { id: "amsterdam-vangogh", city: "amsterdam", name: "梵谷博物館", kind: "sight", rating: 4.6, reviews: "6.6 萬", duration: "2 小時", blurb: "按年代走完梵谷的一生，記得預約。", pos: "65% 55%" },
  { id: "amsterdam-jordaan", city: "amsterdam", name: "約丹區運河", kind: "sight", rating: 4.7, reviews: "3.9 萬", duration: "2 小時", blurb: "運河環帶最上鏡的一段，咖啡館密度極高。", pos: "25% 65%" },
  { id: "amsterdam-foodhallen", city: "amsterdam", name: "Foodhallen", kind: "meal", rating: 4.4, reviews: "4.7 萬", duration: "1.5 小時", blurb: "室內美食大廳，下雨天的最佳答案。", pos: "80% 70%" },
  { id: "prague-charles", city: "prague", name: "查理大橋", kind: "sight", rating: 4.8, reviews: "14 萬", duration: "1 小時", blurb: "清晨人最少，三十座聖像陪你過河。", pos: "50% 35%" },
  { id: "prague-castle", city: "prague", name: "布拉格城堡", kind: "sight", rating: 4.7, reviews: "11 萬", duration: "3 小時", blurb: "從聖維特大教堂一路逛到黃金巷。", pos: "40% 20%" },
  { id: "prague-astro", city: "prague", name: "老城廣場天文鐘", kind: "sight", rating: 4.5, reviews: "9.8 萬", duration: "30 分鐘", blurb: "整點報時很短，但廣場值得久留。", pos: "60% 65%" },
  { id: "prague-louvre-cafe", city: "prague", name: "Café Louvre", kind: "meal", rating: 4.4, reviews: "1.6 萬", duration: "1.5 小時", blurb: "卡夫卡常坐的百年咖啡館，蛋糕別跳過。", pos: "75% 80%" },
];

const KIND_META: Record<AttractionKind, { label: string; Icon: typeof Landmark }> = {
  sight: { label: "景點", Icon: Landmark },
  meal: { label: "美食", Icon: Utensils },
  shop: { label: "購物", Icon: ShoppingBag },
};

const DEPARTURES = [
  { date: "2026-09-25", label: "9/25（五）" },
  { date: "2026-10-02", label: "10/2（五）" },
  { date: "2026-10-16", label: "10/16（五）" },
];

const STEPS = [
  { id: 0, title: "時間與城市", blurb: "出發日、天數、想去哪" },
  { id: 1, title: "路線與天數", blurb: "哪幾天在哪裡、哪天移動" },
  { id: 2, title: "挑亮點", blurb: "每個城市想看什麼" },
  { id: 3, title: "細排日程", blurb: "Lumi 排出每一天" },
  { id: 4, title: "草稿完成", blurb: "確認後建立行程" },
];

const NARRATION = [
  "先把出發日和想去的城市定下來，其他交給我。",
  "調整順序和晚數，我會即時算出哪天在哪裡、哪天在路上。",
  "挑你有感覺的就好，沒挑到的我也會留空間給你探索。",
  "我把你挑的亮點排進每一天了。不順眼就讓我換一種排法。",
  "草稿完成。建立行程之後，隨時可以再找我調整。",
];

// ── Trip math ───────────────────────────────────────────────────────────

interface Stop {
  city: CityId;
  nights: number;
}

interface DayCell {
  index: number;
  date: string;
  city: CityId;
  isMove: boolean;
}

function addDays(iso: string, offset: number): string {
  const date = new Date(`${iso}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}

function shortDate(iso: string): string {
  return `${Number(iso.slice(5, 7))}/${Number(iso.slice(8, 10))}`;
}

/* Keep nights summing exactly to totalDays, every stop at least one day:
   shrink from the back when over budget, grow the last stop when under. */
function balanceStops(stops: Stop[], totalDays: number): Stop[] {
  if (stops.length === 0) return stops;
  const next = stops.map((stop) => ({ ...stop, nights: Math.max(1, stop.nights) }));
  let sum = next.reduce((acc, stop) => acc + stop.nights, 0);
  let guard = 0;
  while (sum > totalDays && guard < 200) {
    for (let i = next.length - 1; i >= 0 && sum > totalDays; i--) {
      if (next[i]!.nights > 1) {
        next[i]!.nights -= 1;
        sum -= 1;
      }
    }
    guard += 1;
  }
  while (sum < totalDays) {
    next[next.length - 1]!.nights += 1;
    sum += 1;
  }
  return next;
}

function dayCells(stops: Stop[], start: string, totalDays: number): DayCell[] {
  const balanced = balanceStops(stops, totalDays);
  const cells: DayCell[] = [];
  let index = 0;
  for (const stop of balanced) {
    for (let i = 0; i < stop.nights && index < totalDays; i++) {
      cells.push({
        index,
        date: addDays(start, index),
        city: stop.city,
        isMove: i === 0,
      });
      index += 1;
    }
  }
  while (index < totalDays) {
    const lastCity = balanced[balanced.length - 1]?.city ?? "milan";
    cells.push({ index, date: addDays(start, index), city: lastCity, isMove: false });
    index += 1;
  }
  return cells;
}

interface ScheduleItem {
  time: string;
  title: string;
  kind: AttractionKind | "transit" | "free";
  sub: string;
}

function buildSchedule(
  cells: DayCell[],
  pickIds: Set<string>,
  seed: number,
): ScheduleItem[][] {
  const byCity = new Map<CityId, Attraction[]>();
  for (const attraction of ATTRACTIONS) {
    if (!pickIds.has(attraction.id)) continue;
    const list = byCity.get(attraction.city) ?? [];
    list.push(attraction);
    byCity.set(attraction.city, list);
  }
  for (const [city, list] of byCity) {
    const rotated = [...list.slice(seed % list.length), ...list.slice(0, seed % list.length)];
    byCity.set(city, rotated);
  }
  const cursors = new Map<CityId, number>();

  return cells.map((cell) => {
    const items: ScheduleItem[] = [];
    if (cell.isMove) {
      items.push({
        time: "09:00",
        title: cell.index === 0 ? `出發前往${CITY_BY_ID.get(cell.city)?.name}` : `移動到${CITY_BY_ID.get(cell.city)?.name}`,
        kind: "transit",
        sub: "含機場與交通時間",
      });
    }
    const list = byCity.get(cell.city) ?? [];
    let cursor = cursors.get(cell.city) ?? 0;
    const slots = cell.isMove ? ["14:30", "17:00"] : ["10:00", "14:30", "17:00"];
    let mealUsed = false;
    for (const time of slots) {
      if (cursor >= list.length) break;
      const attraction = list[cursor]!;
      cursor += 1;
      if (attraction.kind === "meal" && !mealUsed) {
        items.push({ time: "12:30", title: attraction.name, kind: "meal", sub: attraction.blurb });
        mealUsed = true;
        continue;
      }
      items.push({ time, title: attraction.name, kind: attraction.kind, sub: attraction.blurb });
    }
    cursors.set(cell.city, cursor);
    const nonTransit = items.filter((item) => item.kind !== "transit").length;
    if (nonTransit === 0) {
      items.push({
        time: "10:30",
        title: "留白時段",
        kind: "free",
        sub: "Lumi 會在建立行程後推薦在地亮點",
      });
    } else if (nonTransit === 1) {
      items.push({
        time: "15:30",
        title: "留白時段",
        kind: "free",
        sub: "Lumi 會在建立行程後推薦在地亮點",
      });
    }
    return items.sort((a, b) => a.time.localeCompare(b.time));
  });
}

// ── Prototype root ──────────────────────────────────────────────────────

export function JourneyStudioV3Prototype() {
  const reduced = useReducedMotion();
  const [step, setStep] = useState(0);
  const [departure, setDeparture] = useState(0);
  const [totalDays, setTotalDays] = useState(8);
  const [stops, setStops] = useState<Stop[]>([
    { city: "milan", nights: 3 },
    { city: "paris", nights: 3 },
    { city: "barcelona", nights: 2 },
  ]);
  const [activeCityTab, setActiveCityTab] = useState<CityId>("milan");
  const [picks, setPicks] = useState<Set<string>>(
    () => new Set(["milan-duomo", "paris-orsay", "barcelona-sagrada"]),
  );
  const [planning, setPlanning] = useState(false);
  const [seed, setSeed] = useState(0);
  const [activeDay, setActiveDay] = useState(0);
  const [toast, setToast] = useState<string | null>(null);

  const startDate = DEPARTURES[departure]!.date;
  const cells = useMemo(
    () => dayCells(stops, startDate, totalDays),
    [stops, startDate, totalDays],
  );
  const schedule = useMemo(
    () => buildSchedule(cells, picks, seed),
    [cells, picks, seed],
  );
  const pickCount = picks.size;

  useEffect(() => {
    if (!planning) return;
    const timer = setTimeout(() => setPlanning(false), reduced ? 250 : 1700);
    return () => clearTimeout(timer);
  }, [planning, reduced]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(timer);
  }, [toast]);

  const effectiveCityTab = stops.some((stop) => stop.city === activeCityTab)
    ? activeCityTab
    : (stops[0]?.city ?? activeCityTab);

  const toggleCity = (id: CityId) => {
    setStops((current) => {
      const exists = current.some((stop) => stop.city === id);
      if (exists) {
        return current.length > 1
          ? current.filter((stop) => stop.city !== id)
          : current;
      }
      if (current.length >= 4) return current;
      return [...current, { city: id, nights: 2 }];
    });
  };

  const swapStops = (index: number) => {
    setStops((current) => {
      const next = [...current];
      const a = next[index];
      const b = next[index + 1];
      if (!a || !b) return current;
      next[index] = b;
      next[index + 1] = a;
      return next;
    });
  };

  const adjustNights = (index: number, delta: number) => {
    setStops((current) => {
      const next = current.map((stop) => ({ ...stop }));
      const target = next[index];
      const buddy = next[index === next.length - 1 ? index - 1 : next.length - 1];
      if (!target || !buddy || target === buddy) return current;
      if (delta > 0 && buddy.nights <= 1) return current;
      if (delta < 0 && target.nights <= 1) return current;
      target.nights += delta;
      buddy.nights -= delta;
      return next;
    });
  };

  const togglePick = (id: string) => {
    setPicks((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const canNext =
    step === 0 ? stops.length > 0 : step === 3 ? !planning : true;
  const nextLabel =
    step === 2 ? "請 Lumi 排程" : step === 3 ? "完成草稿" : step === 4 ? "建立行程" : "下一步";

  const handleNext = () => {
    if (step === 4) {
      setToast("Prototype：這裡會接上 Lumi 後端建立行程");
      return;
    }
    if (step === 2) setPlanning(true);
    if (step === 3) setActiveDay(0);
    setStep((current) => Math.min(4, current + 1));
  };

  const stageTransition = {
    initial: reduced ? { opacity: 0 } : { opacity: 0, x: 56 },
    animate: reduced ? { opacity: 1 } : { opacity: 1, x: 0 },
    exit: reduced ? { opacity: 0 } : { opacity: 0, x: -56 },
    transition: { duration: reduced ? 0.15 : 0.42, ease: EASE },
  };

  return (
    <div className="relative min-h-screen bg-bg text-fg">
      <div aria-hidden className="pointer-events-none fixed inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle,rgba(17,17,17,0.045)_1px,transparent_1px)] bg-[length:22px_22px]" />
        <div className="absolute inset-x-0 top-0 h-72 bg-[radial-gradient(60%_100%_at_30%_0%,rgba(15,184,180,0.1),transparent_70%)]" />
        <div className="absolute inset-x-0 bottom-0 h-72 bg-[radial-gradient(60%_100%_at_75%_100%,rgba(255,196,120,0.1),transparent_70%)]" />
      </div>

      <div className="relative mx-auto w-full max-w-[1040px] px-4 pb-32 pt-6 sm:px-6">
        <header className="flex items-center justify-between gap-4">
          <div className="inline-flex items-center gap-2 rounded-full border border-divider bg-surface px-3 py-1.5 text-[12px] font-semibold text-accent shadow-sm">
            <Sparkles className="h-3.5 w-3.5" />
            Lumi journey studio
          </div>
          <p className="font-mono text-[12px] text-fg-muted">
            {step + 1} / {STEPS.length}
          </p>
        </header>

        <StepRail step={step} onJump={(target) => target < step && setStep(target)} />

        <div className="relative mt-6 min-h-[520px]">
          <AnimatePresence mode="wait" initial={false}>
            {step === 0 ? (
              <motion.section key="s1" {...stageTransition}>
                <StageTime
                  departure={departure}
                  onDeparture={setDeparture}
                  totalDays={totalDays}
                  onTotalDays={setTotalDays}
                  stops={stops}
                  onToggleCity={toggleCity}
                />
              </motion.section>
            ) : step === 1 ? (
              <motion.section key="s2" {...stageTransition}>
                <StageRoute
                  stops={balanceStops(stops, totalDays)}
                  cells={cells}
                  onSwap={swapStops}
                  onNights={adjustNights}
                />
              </motion.section>
            ) : step === 2 ? (
              <motion.section key="s3" {...stageTransition}>
                <StagePicks
                  stops={stops}
                  activeTab={effectiveCityTab}
                  onTab={setActiveCityTab}
                  picks={picks}
                  onToggle={togglePick}
                />
              </motion.section>
            ) : step === 3 ? (
              <motion.section key="s4" {...stageTransition}>
                <StageSchedule
                  cells={cells}
                  schedule={schedule}
                  planning={planning}
                  activeDay={activeDay}
                  onDay={setActiveDay}
                  onShuffle={() => {
                    setSeed((value) => value + 1);
                    setPlanning(true);
                  }}
                />
              </motion.section>
            ) : (
              <motion.section key="s5" {...stageTransition}>
                <StageDone
                  stops={balanceStops(stops, totalDays)}
                  cells={cells}
                  startDate={startDate}
                  totalDays={totalDays}
                  pickCount={pickCount}
                />
              </motion.section>
            )}
          </AnimatePresence>
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-divider bg-[color-mix(in_srgb,var(--surface)_88%,transparent)] backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-[1040px] items-center gap-3 px-4 py-3 sm:px-6">
          <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full border border-divider bg-white shadow-sm">
            <Image src="/lumi-avatars/classic.png" alt="Lumi" fill sizes="40px" className="object-cover" />
          </div>
          <AnimatePresence mode="wait" initial={false}>
            <motion.p
              key={step}
              className="min-w-0 flex-1 truncate text-[13px] font-medium text-fg-secondary sm:text-[14px]"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.25, ease: EASE }}
            >
              {NARRATION[step]}
            </motion.p>
          </AnimatePresence>
          {step > 0 ? (
            <button
              type="button"
              data-pt="back"
              onClick={() => setStep((current) => Math.max(0, current - 1))}
              className="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-full border border-divider bg-surface px-4 text-[13px] font-semibold text-fg-secondary transition-colors hover:text-fg"
            >
              <ArrowLeft className="h-4 w-4" />
              上一步
            </button>
          ) : null}
          <motion.button
            type="button"
            data-pt="next"
            onClick={handleNext}
            disabled={!canNext}
            whileTap={{ scale: 0.97 }}
            className={`inline-flex h-11 shrink-0 items-center gap-2 rounded-full bg-accent px-5 text-[14px] font-semibold text-white shadow-[0_14px_28px_-14px_rgba(15,184,180,0.8)] transition-opacity ${canNext ? "" : "cursor-not-allowed opacity-50"}`}
          >
            {nextLabel}
            <ArrowRight className="h-4 w-4" />
          </motion.button>
        </div>
      </div>

      <AnimatePresence>
        {toast ? (
          <motion.div
            key="toast"
            className="fixed bottom-24 left-1/2 z-30 -translate-x-1/2 rounded-full bg-fg px-5 py-2.5 text-[13px] font-medium text-white shadow-lg"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            transition={{ duration: 0.3, ease: EASE }}
          >
            {toast}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

// ── Step rail ───────────────────────────────────────────────────────────

function StepRail({ step, onJump }: { step: number; onJump: (target: number) => void }) {
  return (
    <nav className="mt-6">
      <div className="relative">
        <div className="absolute inset-x-[10%] top-[15px] h-[2px] rounded-full bg-[rgba(17,17,17,0.08)]">
          <motion.div
            className="h-full rounded-full bg-accent"
            animate={{ width: `${(step / (STEPS.length - 1)) * 100}%` }}
            transition={{ duration: 0.6, ease: EASE }}
          />
        </div>
        <ol className="relative grid grid-cols-5">
          {STEPS.map((item) => {
            const done = item.id < step;
            const active = item.id === step;
            return (
              <li key={item.id} className="flex min-w-0 flex-col items-center">
                <button
                  type="button"
                  onClick={() => onJump(item.id)}
                  disabled={item.id >= step}
                  className={`grid h-8 w-8 place-items-center rounded-full border text-[12px] font-bold transition-colors duration-300 ${
                    done
                      ? "border-accent bg-accent text-white"
                      : active
                        ? "border-accent bg-surface text-accent shadow-[0_0_0_5px_rgba(15,184,180,0.12)]"
                        : "border-divider bg-surface text-fg-muted"
                  } ${item.id < step ? "cursor-pointer" : "cursor-default"}`}
                >
                  {done ? <Check className="h-3.5 w-3.5" /> : item.id + 1}
                </button>
                <p
                  className={`mt-1.5 w-full truncate px-1 text-center text-[11px] font-semibold sm:text-[12.5px] ${done || active ? "text-fg" : "text-fg-muted"}`}
                >
                  {item.title}
                </p>
                <p className="hidden w-full truncate px-1 text-center text-[11px] text-fg-muted sm:block">
                  {active ? item.blurb : " "}
                </p>
              </li>
            );
          })}
        </ol>
      </div>
    </nav>
  );
}

// ── Stage 1 · time + cities ─────────────────────────────────────────────

const gridStagger = {
  animate: { transition: { staggerChildren: 0.05 } },
};
const popItem = {
  initial: { opacity: 0, y: 14, scale: 0.97 },
  animate: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.4, ease: EASE } },
};

function StageTime({
  departure,
  onDeparture,
  totalDays,
  onTotalDays,
  stops,
  onToggleCity,
}: {
  departure: number;
  onDeparture: (index: number) => void;
  totalDays: number;
  onTotalDays: (days: number) => void;
  stops: Stop[];
  onToggleCity: (id: CityId) => void;
}) {
  const orderOf = new Map(stops.map((stop, index) => [stop.city, index + 1]));
  return (
    <div>
      <h1 className="text-[26px] font-semibold tracking-[-0.02em] sm:text-[32px]">
        什麼時候出發，想去哪幾個城市？
      </h1>
      <div className="mt-5 grid gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
        <div className="space-y-4">
          <div className="rounded-[20px] border border-divider bg-surface p-4 shadow-sm">
            <p className="flex items-center gap-1.5 text-[12px] font-semibold text-fg-muted">
              <CalendarDays className="h-3.5 w-3.5 text-accent" />
              出發日
            </p>
            <div className="mt-2.5 flex flex-wrap gap-2">
              {DEPARTURES.map((option, index) => (
                <button
                  key={option.date}
                  type="button"
                  data-pt={`dep-${index}`}
                  onClick={() => onDeparture(index)}
                  className={`rounded-full px-3.5 py-2 text-[13px] font-semibold transition-colors ${
                    departure === index
                      ? "bg-fg text-white"
                      : "border border-divider bg-surface text-fg-secondary hover:text-fg"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
          <div className="rounded-[20px] border border-divider bg-surface p-4 shadow-sm">
            <p className="flex items-center gap-1.5 text-[12px] font-semibold text-fg-muted">
              <Clock3 className="h-3.5 w-3.5 text-accent" />
              旅程長度
            </p>
            <div className="mt-2.5 flex items-center gap-4">
              <button
                type="button"
                data-pt="days-minus"
                onClick={() => onTotalDays(Math.max(4, totalDays - 1))}
                className="grid h-10 w-10 place-items-center rounded-full border border-divider text-fg-secondary hover:text-fg"
                aria-label="減少一天"
              >
                <Minus className="h-4 w-4" />
              </button>
              <div className="min-w-[88px] text-center">
                <motion.span
                  key={totalDays}
                  className="inline-block text-[40px] font-semibold leading-none tracking-[-0.02em]"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25, ease: EASE }}
                >
                  {totalDays}
                </motion.span>
                <span className="ml-1 text-[15px] font-medium text-fg-muted">天</span>
              </div>
              <button
                type="button"
                data-pt="days-plus"
                onClick={() => onTotalDays(Math.min(14, totalDays + 1))}
                className="grid h-10 w-10 place-items-center rounded-full border border-divider text-fg-secondary hover:text-fg"
                aria-label="增加一天"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
            <p className="mt-2 text-[12px] leading-5 text-fg-muted">
              {DEPARTURES[departure]!.label} 出發 · {shortDate(addDays(DEPARTURES[departure]!.date, totalDays - 1))} 回程
            </p>
          </div>
        </div>

        <motion.div
          className="grid grid-cols-2 gap-3 sm:grid-cols-3"
          variants={gridStagger}
          initial="initial"
          animate="animate"
        >
          {CITIES.map((city) => {
            const order = orderOf.get(city.id);
            return (
              <motion.button
                key={city.id}
                type="button"
                data-pt={`city-${city.id}`}
                variants={popItem}
                onClick={() => onToggleCity(city.id)}
                whileTap={{ scale: 0.97 }}
                className={`group relative overflow-hidden rounded-[20px] border text-left transition-shadow ${
                  order
                    ? "border-accent shadow-[0_18px_36px_-22px_rgba(15,184,180,0.7)]"
                    : "border-divider shadow-sm hover:shadow-md"
                }`}
              >
                <div className="relative h-[120px] sm:h-[136px]">
                  <Image
                    src={city.image}
                    alt={city.name}
                    fill
                    sizes="(max-width: 640px) 50vw, 240px"
                    className="object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                  />
                  <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_30%,rgba(17,17,17,0.55)_100%)]" />
                  <AnimatePresence>
                    {order ? (
                      <motion.span
                        key="badge"
                        className="absolute right-2.5 top-2.5 grid h-7 w-7 place-items-center rounded-full bg-accent text-[12px] font-bold text-white shadow-md"
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0, opacity: 0 }}
                        transition={{ duration: 0.25, ease: EASE }}
                      >
                        {order}
                      </motion.span>
                    ) : null}
                  </AnimatePresence>
                  <div className="absolute inset-x-3 bottom-2.5">
                    <p className="text-[15px] font-semibold text-white">{city.name}</p>
                    <p className="text-[11px] text-white/80">{city.country} · {city.tagline}</p>
                  </div>
                </div>
              </motion.button>
            );
          })}
        </motion.div>
      </div>
    </div>
  );
}

// ── Stage 2 · route + nights ────────────────────────────────────────────

function StageRoute({
  stops,
  cells,
  onSwap,
  onNights,
}: {
  stops: Stop[];
  cells: DayCell[];
  onSwap: (index: number) => void;
  onNights: (index: number, delta: number) => void;
}) {
  return (
    <div>
      <h1 className="text-[26px] font-semibold tracking-[-0.02em] sm:text-[32px]">
        哪幾天在哪裡？
      </h1>
      <div className="mt-5 overflow-x-auto pb-2">
        <div className="flex min-w-max items-stretch gap-0">
          {stops.map((stop, index) => {
            const city = CITY_BY_ID.get(stop.city)!;
            return (
              <div key={stop.city} className="flex items-center">
                <motion.div
                  layout
                  transition={{ duration: 0.4, ease: EASE }}
                  className="w-[180px] rounded-[20px] border border-divider bg-surface p-3.5 shadow-sm"
                >
                  <div className="relative h-[72px] overflow-hidden rounded-[14px]">
                    <Image src={city.image} alt={city.name} fill sizes="180px" className="object-cover" />
                    <span className="absolute left-2 top-2 grid h-6 w-6 place-items-center rounded-full bg-white/95 text-[11px] font-bold text-accent shadow-sm">
                      {index + 1}
                    </span>
                  </div>
                  <p className="mt-2.5 text-[15px] font-semibold">{city.name}</p>
                  <div className="mt-2 flex items-center justify-between">
                    <button
                      type="button"
                      data-pt={`nights-minus-${index}`}
                      onClick={() => onNights(index, -1)}
                      className="grid h-8 w-8 place-items-center rounded-full border border-divider text-fg-secondary hover:text-fg"
                      aria-label={`${city.name}減少一晚`}
                    >
                      <Minus className="h-3.5 w-3.5" />
                    </button>
                    <motion.p
                      key={stop.nights}
                      className="text-[14px] font-semibold"
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.2, ease: EASE }}
                    >
                      {stop.nights} <span className="text-[12px] font-medium text-fg-muted">晚</span>
                    </motion.p>
                    <button
                      type="button"
                      data-pt={`nights-plus-${index}`}
                      onClick={() => onNights(index, 1)}
                      className="grid h-8 w-8 place-items-center rounded-full border border-divider text-fg-secondary hover:text-fg"
                      aria-label={`${city.name}增加一晚`}
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </motion.div>
                {index < stops.length - 1 ? (
                  <div className="flex w-[64px] flex-col items-center gap-1.5">
                    <div className="roam-v3-dash h-[2px] w-full" />
                    <button
                      type="button"
                      data-pt={`swap-${index}`}
                      onClick={() => onSwap(index)}
                      className="grid h-8 w-8 place-items-center rounded-full border border-divider bg-surface text-fg-secondary shadow-sm transition-colors hover:text-accent"
                      aria-label="交換順序"
                    >
                      <ArrowLeftRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-6 rounded-[20px] border border-divider bg-surface p-4 shadow-sm">
        <p className="text-[12px] font-semibold text-fg-muted">
          日曆 · <Plane className="-mt-0.5 inline h-3.5 w-3.5 text-accent" /> 是移動日
        </p>
        <motion.div
          className="mt-3 grid grid-cols-4 gap-1.5 sm:grid-cols-7"
          variants={gridStagger}
          initial="initial"
          animate="animate"
          key={cells.map((cell) => `${cell.city}-${cell.isMove}`).join("|")}
        >
          {cells.map((cell) => {
            const city = CITY_BY_ID.get(cell.city)!;
            return (
              <motion.div
                key={cell.index}
                variants={popItem}
                className={`rounded-[14px] border px-2 py-2 text-center ${
                  cell.isMove
                    ? "border-accent/40 bg-accent-softer"
                    : "border-divider bg-bg"
                }`}
              >
                <p className="font-mono text-[11px] text-fg-muted">{shortDate(cell.date)}</p>
                <p className="mt-0.5 flex items-center justify-center gap-1 text-[12.5px] font-semibold">
                  {cell.isMove ? <Plane className="h-3 w-3 text-accent" /> : null}
                  <span className="truncate">{city.name}</span>
                </p>
              </motion.div>
            );
          })}
        </motion.div>
      </div>
      <style>{`
        .roam-v3-dash {
          background-image: linear-gradient(90deg, var(--accent) 40%, transparent 0);
          background-size: 10px 2px;
          animation: roam-v3-dash-flow 1.2s linear infinite;
          opacity: 0.7;
        }
        @keyframes roam-v3-dash-flow {
          to { background-position: 10px 0; }
        }
        @media (prefers-reduced-motion: reduce) {
          .roam-v3-dash { animation: none; }
        }
      `}</style>
    </div>
  );
}

// ── Stage 3 · attraction picks ──────────────────────────────────────────

function StagePicks({
  stops,
  activeTab,
  onTab,
  picks,
  onToggle,
}: {
  stops: Stop[];
  activeTab: CityId;
  onTab: (id: CityId) => void;
  picks: Set<string>;
  onToggle: (id: string) => void;
}) {
  const attractions = ATTRACTIONS.filter((item) => item.city === activeTab);
  const picked = ATTRACTIONS.filter((item) => picks.has(item.id));
  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-[26px] font-semibold tracking-[-0.02em] sm:text-[32px]">
          每個城市，想看什麼？
        </h1>
        <p className="text-[13px] font-medium text-fg-muted">
          已挑 <span className="font-semibold text-accent">{picks.size}</span> 個亮點
        </p>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {stops.map((stop) => {
          const city = CITY_BY_ID.get(stop.city)!;
          const count = ATTRACTIONS.filter(
            (item) => item.city === stop.city && picks.has(item.id),
          ).length;
          const active = activeTab === stop.city;
          return (
            <button
              key={stop.city}
              type="button"
              data-pt={`tab-${stop.city}`}
              onClick={() => onTab(stop.city)}
              className={`relative flex items-center gap-2 rounded-full border py-1.5 pl-1.5 pr-3.5 transition-colors ${
                active ? "border-fg bg-fg text-white" : "border-divider bg-surface text-fg-secondary hover:text-fg"
              }`}
            >
              <span className="relative h-7 w-7 overflow-hidden rounded-full">
                <Image src={city.image} alt="" fill sizes="28px" className="object-cover" />
              </span>
              <span className="text-[13px] font-semibold">{city.name}</span>
              {count > 0 ? (
                <span className={`grid h-5 min-w-5 place-items-center rounded-full px-1 text-[11px] font-bold ${active ? "bg-accent text-white" : "bg-accent-soft text-accent"}`}>
                  {count}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      <motion.div
        key={activeTab}
        className="mt-4 grid gap-3 sm:grid-cols-2"
        variants={gridStagger}
        initial="initial"
        animate="animate"
      >
        {attractions.map((item) => {
          const selected = picks.has(item.id);
          const meta = KIND_META[item.kind];
          return (
            <motion.button
              key={item.id}
              type="button"
              data-pt={`pick-${item.id}`}
              variants={popItem}
              onClick={() => onToggle(item.id)}
              whileTap={{ scale: 0.98 }}
              className={`flex gap-3 rounded-[20px] border p-3 text-left transition-shadow ${
                selected
                  ? "border-accent bg-accent-softer/60 shadow-[0_18px_36px_-24px_rgba(15,184,180,0.7)]"
                  : "border-divider bg-surface shadow-sm hover:shadow-md"
              }`}
            >
              <div className="relative h-[96px] w-[96px] shrink-0 overflow-hidden rounded-[14px]">
                <Image
                  src={CITY_BY_ID.get(item.city)!.image}
                  alt={item.name}
                  fill
                  sizes="96px"
                  className="object-cover"
                  style={{ objectPosition: item.pos }}
                />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <p className="truncate text-[15px] font-semibold">{item.name}</p>
                  <span
                    className={`grid h-7 w-7 shrink-0 place-items-center rounded-full border transition-colors ${
                      selected
                        ? "border-accent bg-accent text-white"
                        : "border-divider bg-surface text-fg-muted"
                    }`}
                  >
                    {selected ? <Check className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                  </span>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[12px] text-fg-muted">
                  <span className="inline-flex items-center gap-1 font-medium text-fg-secondary">
                    <Star className="h-3 w-3 fill-[#f5a623] text-[#f5a623]" />
                    {item.rating}
                  </span>
                  <span>（{item.reviews}）</span>
                  <span className="inline-flex items-center gap-0.5">
                    <meta.Icon className="h-3 w-3" />
                    {meta.label}
                  </span>
                  <span className="inline-flex items-center gap-0.5">
                    <Clock3 className="h-3 w-3" />
                    {item.duration}
                  </span>
                </div>
                <p className="mt-1.5 line-clamp-2 text-[12.5px] leading-5 text-fg-secondary">
                  {item.blurb}
                </p>
              </div>
            </motion.button>
          );
        })}
      </motion.div>

      <div className="mt-5 min-h-[56px] rounded-[20px] border border-dashed border-divider-strong bg-surface/70 px-4 py-3">
        {picked.length ? (
          <div className="flex flex-wrap items-center gap-2">
            <MapPin className="h-4 w-4 text-accent" />
            <AnimatePresence>
              {picked.map((item) => (
                <motion.span
                  key={item.id}
                  layout
                  initial={{ opacity: 0, scale: 0.7 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.7 }}
                  transition={{ duration: 0.25, ease: EASE }}
                  className="inline-flex items-center gap-1.5 rounded-full border border-divider bg-surface py-1 pl-1 pr-2.5 text-[12px] font-medium shadow-sm"
                >
                  <span className="relative h-5 w-5 overflow-hidden rounded-full">
                    <Image
                      src={CITY_BY_ID.get(item.city)!.image}
                      alt=""
                      fill
                      sizes="20px"
                      className="object-cover"
                      style={{ objectPosition: item.pos }}
                    />
                  </span>
                  {item.name}
                </motion.span>
              ))}
            </AnimatePresence>
          </div>
        ) : (
          <p className="text-[13px] leading-7 text-fg-muted">
            還沒挑亮點。也可以直接下一步，讓 Lumi 全權安排。
          </p>
        )}
      </div>
    </div>
  );
}

// ── Stage 4 · schedule ──────────────────────────────────────────────────

function StageSchedule({
  cells,
  schedule,
  planning,
  activeDay,
  onDay,
  onShuffle,
}: {
  cells: DayCell[];
  schedule: ScheduleItem[][];
  planning: boolean;
  activeDay: number;
  onDay: (index: number) => void;
  onShuffle: () => void;
}) {
  const day = cells[activeDay];
  const items = schedule[activeDay] ?? [];
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-[26px] font-semibold tracking-[-0.02em] sm:text-[32px]">
          每一天，這樣走
        </h1>
        <button
          type="button"
          data-pt="shuffle"
          onClick={onShuffle}
          disabled={planning}
          className="inline-flex h-10 items-center gap-1.5 rounded-full border border-divider bg-surface px-4 text-[13px] font-semibold text-fg-secondary transition-colors hover:text-fg disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${planning ? "animate-spin" : ""}`} />
          換一種排法
        </button>
      </div>

      {planning ? (
        <div className="mt-6 rounded-[20px] border border-divider bg-surface p-6 shadow-sm">
          <p className="flex items-center gap-2 text-[14px] font-semibold text-fg">
            <Sparkles className="h-4 w-4 text-accent" />
            Lumi 正在把你挑的亮點排進每一天…
          </p>
          <div className="mt-5 space-y-3">
            {[0, 1, 2].map((row) => (
              <div key={row} className="roam-v3-shimmer h-12 rounded-[14px]" style={{ animationDelay: `${row * 160}ms` }} />
            ))}
          </div>
          <style>{`
            .roam-v3-shimmer {
              background: linear-gradient(90deg, rgba(17,17,17,0.05), rgba(15,184,180,0.12), rgba(17,17,17,0.05));
              background-size: 220% 100%;
              animation: roam-v3-shimmer 1.6s ease-in-out infinite;
            }
            @keyframes roam-v3-shimmer {
              0% { background-position: 120% 0; }
              100% { background-position: -120% 0; }
            }
            @media (prefers-reduced-motion: reduce) {
              .roam-v3-shimmer { animation: none; }
            }
          `}</style>
        </div>
      ) : (
        <>
          <div className="mt-4 flex gap-1.5 overflow-x-auto pb-1">
            {cells.map((cell, index) => {
              const active = index === activeDay;
              return (
                <button
                  key={cell.index}
                  type="button"
                  data-pt={`day-${index}`}
                  onClick={() => onDay(index)}
                  className={`shrink-0 rounded-full px-3.5 py-2 text-[12.5px] font-semibold transition-colors ${
                    active ? "bg-fg text-white" : "border border-divider bg-surface text-fg-secondary hover:text-fg"
                  }`}
                >
                  Day {index + 1} · {CITY_BY_ID.get(cell.city)!.name}
                </button>
              );
            })}
          </div>

          <motion.div
            key={`${activeDay}-${items.map((item) => item.title).join("|")}`}
            className="mt-4 rounded-[20px] border border-divider bg-surface p-5 shadow-sm"
            variants={gridStagger}
            initial="initial"
            animate="animate"
          >
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-[15px] font-semibold">
                Day {activeDay + 1} · {day ? CITY_BY_ID.get(day.city)!.name : ""}
              </p>
              <p className="font-mono text-[12px] text-fg-muted">{day?.date}</p>
            </div>
            <div className="relative mt-4">
              <span aria-hidden className="absolute bottom-3 left-[52px] top-3 w-[2px] rounded-full bg-accent/20" />
              <ul className="space-y-3">
                {items.map((item) => {
                  const Icon =
                    item.kind === "transit"
                      ? Plane
                      : item.kind === "free"
                        ? Sparkles
                        : KIND_META[item.kind].Icon;
                  return (
                    <motion.li key={`${item.time}-${item.title}`} variants={popItem} className="flex items-start gap-3">
                      <p className="w-[40px] pt-1.5 text-right font-mono text-[12px] text-fg-muted">
                        {item.time}
                      </p>
                      <span className="relative z-10 mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-full border border-accent/30 bg-white text-accent shadow-sm">
                        <Icon className="h-3.5 w-3.5" />
                      </span>
                      <div className="min-w-0 flex-1 rounded-[14px] border border-divider bg-bg px-3.5 py-2.5">
                        <p className="text-[14px] font-semibold">{item.title}</p>
                        <p className="mt-0.5 line-clamp-1 text-[12.5px] text-fg-muted">{item.sub}</p>
                      </div>
                    </motion.li>
                  );
                })}
              </ul>
            </div>
          </motion.div>
        </>
      )}
    </div>
  );
}

// ── Stage 5 · done ──────────────────────────────────────────────────────

function StageDone({
  stops,
  cells,
  startDate,
  totalDays,
  pickCount,
}: {
  stops: Stop[];
  cells: DayCell[];
  startDate: string;
  totalDays: number;
  pickCount: number;
}) {
  const firstCity = CITY_BY_ID.get(stops[0]?.city ?? "milan")!;
  const moveDays = cells.filter((cell) => cell.isMove).length;
  const stats = [
    { label: "天數", value: `${totalDays}` },
    { label: "城市", value: `${stops.length}` },
    { label: "亮點", value: `${pickCount}` },
    { label: "移動日", value: `${moveDays}` },
  ];
  return (
    <div>
      <motion.div
        className="relative overflow-hidden rounded-[28px] border border-divider shadow-[0_32px_72px_-44px_rgba(17,17,32,0.5)]"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: EASE }}
      >
        <div className="relative h-[240px] sm:h-[280px]">
          <Image src={firstCity.image} alt="" fill sizes="1040px" className="object-cover" priority />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(17,17,17,0.1)_0%,rgba(17,17,17,0.65)_100%)]" />
          <div className="absolute inset-x-6 bottom-5 sm:inset-x-8">
            <p className="text-[12px] font-semibold uppercase tracking-[0.1em] text-white/75">
              {startDate} - {addDays(startDate, totalDays - 1)}
            </p>
            <h1 className="mt-1.5 text-[30px] font-semibold leading-[1.05] tracking-[-0.02em] text-white [text-wrap:balance] sm:text-[40px]">
              {stops.map((stop) => CITY_BY_ID.get(stop.city)!.name).join("・")} {totalDays} 天
            </h1>
            <div className="mt-3 flex flex-wrap items-center gap-1.5 text-[13px] font-medium text-white/90">
              {stops.map((stop, index) => (
                <span key={stop.city} className="inline-flex items-center gap-1.5">
                  {index > 0 ? <Plane className="h-3.5 w-3.5 text-white/70" /> : null}
                  {CITY_BY_ID.get(stop.city)!.name}
                  <span className="text-white/60">{stop.nights} 晚</span>
                </span>
              ))}
            </div>
          </div>
        </div>
      </motion.div>

      <motion.div
        className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4"
        variants={gridStagger}
        initial="initial"
        animate="animate"
      >
        {stats.map((stat) => (
          <motion.div
            key={stat.label}
            variants={popItem}
            className="rounded-[20px] border border-divider bg-surface px-4 py-3.5 text-center shadow-sm"
          >
            <p className="text-[26px] font-semibold leading-none tracking-[-0.02em]">{stat.value}</p>
            <p className="mt-1.5 text-[12px] font-medium text-fg-muted">{stat.label}</p>
          </motion.div>
        ))}
      </motion.div>

      <motion.div
        className="mt-4 flex flex-wrap gap-1.5"
        variants={gridStagger}
        initial="initial"
        animate="animate"
      >
        {cells.map((cell, index) => (
          <motion.span
            key={cell.index}
            variants={popItem}
            className={`rounded-full border px-3 py-1.5 text-[12px] font-medium ${
              cell.isMove
                ? "border-accent/40 bg-accent-softer text-fg"
                : "border-divider bg-surface text-fg-secondary"
            }`}
          >
            Day {index + 1} {CITY_BY_ID.get(cell.city)!.name}
            {cell.isMove ? <Plane className="-mt-0.5 ml-1 inline h-3 w-3 text-accent" /> : null}
          </motion.span>
        ))}
      </motion.div>
    </div>
  );
}
