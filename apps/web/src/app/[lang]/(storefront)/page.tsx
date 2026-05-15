import { notFound } from "next/navigation";
import { Bell } from "lucide-react";

import {
  ActiveESIMCard,
  ActiveTripStrip,
  LumiNudge,
  PageHeader,
  QuickActions,
  UpcomingTripCard,
} from "@/components/storefront/home-sections";
import {
  ACTIVE_ESIM,
  USER,
  daysUntil,
  getActiveTrip,
  getNextUpcomingTrip,
  uniqueCities,
} from "@/lib/mock/consumer";

import { getDictionary, hasLocale } from "../dictionaries";

// Consumer screens are per-user (auth, active eSIM, trips). Opt out of SSG
// — Phase D will swap mock data for `createSupabaseServerClient` queries.
export const dynamic = "force-dynamic";

export default async function StorefrontHomePage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const dict = await getDictionary(lang);
  const t = dict.storefront.home;

  const activeTrip = getActiveTrip();
  const upcoming = getNextUpcomingTrip();

  const todayCity = activeTrip?.days.find((d) => d.d === "2025-09-19")?.city;
  const subtitle = activeTrip
    ? format(t.subtitle_active, {
        city: todayCity ?? activeTrip.days[0]?.city ?? "",
        days: String(daysUntil(activeTrip.end)),
      })
    : t.subtitle_no_trip;

  return (
    <div>
      <PageHeader
        title={format(t.greeting, { name: USER.name })}
        subtitle={subtitle}
        right={
          <button
            type="button"
            aria-label="通知"
            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-fg-secondary transition-colors hover:bg-[rgba(0,0,0,0.04)]"
          >
            <Bell className="h-[18px] w-[18px]" />
          </button>
        }
      />

      <div className="flex flex-col gap-4 px-5 pt-1 pb-6">
        <ActiveESIMCard
          sim={ACTIVE_ESIM}
          lang={lang}
          labels={{
            activeLabel: format(t.esim_active_label, { network: ACTIVE_ESIM.network }),
            countryPlan: format(t.esim_country_plan, {
              country: ACTIVE_ESIM.countryName,
              plan: ACTIVE_ESIM.plan,
            }),
            remainingUnit: t.esim_remaining_unit,
            daysLeft: t.esim_days_left,
            used: format(t.esim_used, { gb: ACTIVE_ESIM.used.toFixed(2) }),
            remaining: format(t.esim_remaining, {
              gb: (ACTIVE_ESIM.total - ACTIVE_ESIM.used).toFixed(2),
            }),
            topup: t.actions.topup,
            switchHotspot: t.actions.switch_hotspot,
            troubleshoot: t.actions.troubleshoot,
          }}
        />

        <QuickActions
          lang={lang}
          labels={{
            shop: t.quick_actions.shop,
            newTrip: t.quick_actions.new_trip,
            askLumi: t.quick_actions.ask_lumi,
            myTasks: t.quick_actions.my_tasks,
          }}
        />

        <LumiNudge
          name={t.lumi_nudge.name}
          timeLabel={t.lumi_nudge.time_just_now}
          body={t.lumi_nudge.body}
          href={`/${lang}/trips`}
        />

        {upcoming && (
          <UpcomingTripCard
            trip={upcoming}
            cities={uniqueCities(upcoming)}
            countdownLabel={format(t.next_trip.label_with_countdown, {
              days: String(daysUntil(upcoming.start)),
            })}
            durationLabel={format(t.next_trip.duration_days, {
              days: String(upcoming.days.length),
            })}
            href={`/${lang}/trips`}
          />
        )}

        {activeTrip && (
          <ActiveTripStrip
            trip={activeTrip}
            sectionTitle={t.active_trip.section_title}
            summary={format(t.active_trip.summary, {
              title: activeTrip.title,
              n: String(activeTrip.checklist.filter((c) => !c.done).length),
            })}
            viewAllLabel={t.active_trip.view_all}
            href={`/${lang}/trips`}
          />
        )}
      </div>
    </div>
  );
}

// Tiny i18n templating: replace {key} tokens. Keeps Phase B free of a
// runtime dep; revisit when we need plurals / ICU.
function format(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => vars[key] ?? `{${key}}`);
}
