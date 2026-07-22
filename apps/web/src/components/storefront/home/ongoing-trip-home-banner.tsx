"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Camera, Clock3, MapPin } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import type { Trip } from "@/lib/trip-types";
import { formatTemplate } from "@/lib/text-template";

type TripsPayload = { trips: Trip[] };

export type OngoingTripHomeBannerLabels = {
  eyebrow: string;
  title: string;
  body: string;
  date_range: string;
  open: string;
  tasks_left: string;
};

export function OngoingTripHomeBanner({
  lang,
  labels,
}: {
  lang: string;
  labels: OngoingTripHomeBannerLabels;
}) {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let canceled = false;
    void fetch("/api/storefront/trips", {
      credentials: "same-origin",
      cache: "no-store",
      headers: { accept: "application/json" },
    })
      .then(async (response) => {
        if (!response.ok) return { trips: [] } satisfies TripsPayload;
        return (await response.json()) as TripsPayload;
      })
      .then((payload) => {
        if (canceled) return;
        setTrips(payload.trips ?? []);
        setLoaded(true);
      })
      .catch(() => {
        if (canceled) return;
        setTrips([]);
        setLoaded(true);
      });
    return () => {
      canceled = true;
    };
  }, []);

  const activeTrip = useMemo(() => findActiveTrip(trips), [trips]);
  if (!loaded || !activeTrip) return null;

  const tasksLeft = activeTrip.checklist.filter((item) => !item.done).length;
  const destination =
    activeTrip.days.map((day) => day.city).find(Boolean) ??
    activeTrip.title;
  const imageSrc = imageForTrip(activeTrip, destination);

  return (
    <Link
      href={`/${lang}/trips/${activeTrip.id}?live=1`}
      className="group mt-5 block max-w-[560px] rounded-[22px] border border-white/24 bg-white/16 p-3 text-white shadow-[0_24px_70px_-38px_rgba(0,0,0,0.78)] backdrop-blur-xl transition hover:-translate-y-0.5 hover:bg-white/20 sm:mt-6 sm:p-3.5"
    >
      <div className="flex gap-3">
        <div className="relative h-[104px] w-[104px] shrink-0 overflow-hidden rounded-[18px] bg-white/20 sm:h-[118px] sm:w-[132px]">
          <Image
            src={imageSrc}
            alt=""
            fill
            sizes="132px"
            className="object-cover transition duration-300 group-hover:scale-[1.04]"
          />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0)_35%,rgba(0,0,0,0.28)_100%)]" />
          <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-black/44 px-2 py-1 text-[10.5px] font-semibold text-white backdrop-blur">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" />
            {labels.eyebrow}
          </span>
        </div>
        <div className="min-w-0 flex-1 py-0.5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/72">
            {formatTemplate(labels.date_range, {
              start: shortDate(activeTrip.start),
              end: shortDate(activeTrip.end),
            })}
          </p>
          <h2 className="mt-1 line-clamp-2 text-[20px] font-semibold leading-tight tracking-[-0.02em] sm:text-[24px]">
            {formatTemplate(labels.title, { title: activeTrip.title })}
          </h2>
          <p className="mt-1.5 line-clamp-2 text-[12.5px] leading-5 text-white/76 sm:text-[13px]">
            {labels.body}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] font-semibold text-white/86">
            <span className="inline-flex items-center gap-1 rounded-full bg-white/14 px-2 py-1">
              <MapPin className="h-3 w-3" />
              {destination}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-white/14 px-2 py-1">
              <Clock3 className="h-3 w-3" />
              {formatTemplate(labels.tasks_left, { count: String(tasksLeft) })}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-white/14 px-2 py-1">
              <Camera className="h-3 w-3" />
              {labels.open}
            </span>
          </div>
        </div>
        <span className="mt-1 grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white text-fg shadow-sm transition group-hover:translate-x-0.5">
          <ArrowRight className="h-4 w-4" />
        </span>
      </div>
    </Link>
  );
}

function findActiveTrip(trips: Trip[]): Trip | null {
  const today = todayIso();
  return (
    trips.find((trip) => trip.status === "active") ??
    trips.find((trip) => trip.start <= today && today <= trip.end) ??
    null
  );
}

function todayIso(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function shortDate(date: string): string {
  const parts = date.split("-");
  return parts.length === 3 ? `${Number(parts[1])}/${Number(parts[2])}` : date;
}

function imageForTrip(trip: Trip, destination: string): string {
  const target = `${trip.title} ${destination}`;
  if (/milan|milano|米蘭/i.test(target)) return "/illustrations/cities/rome.jpg";
  if (/taipei|台北|taiwan|台灣/i.test(target)) return "/illustrations/cities/taipei.jpg";
  if (/kyoto|japan|京都|日本/i.test(target)) return "/illustrations/cities/kyoto.jpg";
  if (/paris|巴黎|france|法國/i.test(target)) return "/illustrations/cities/paris.jpg";
  if (/new york|紐約/i.test(target)) return "/illustrations/cities/new-york.jpg";
  if (/singapore|新加坡/i.test(target)) return "/illustrations/cities/singapore.jpg";
  return "/illustrations/home-journey-hero.png";
}
