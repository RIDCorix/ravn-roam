import { notFound } from "next/navigation";

import {
  TasksPageClient,
  type TaskTripSummary,
} from "@/components/storefront/tasks/tasks-page-client";
import { listChecklists, listTrips, TripApiError } from "@/lib/trips-api";

import { getDictionary, hasLocale } from "../../dictionaries";

export const dynamic = "force-dynamic";

export default async function TasksPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const dict = await getDictionary(lang);
  const { tasks, tripsById } = await loadTasks();
  const t = dict.storefront.tasks;

  return (
    <TasksPageClient
      lang={lang}
      labels={{
        title: dict.storefront.nav.tasks,
        subtitle: t.subtitle,
        open: t.open,
        done: t.done,
        all: t.all,
        search_placeholder: t.search_placeholder,
        empty_title: t.empty_title,
        empty_body: t.empty_body,
        no_results: t.no_results,
        due: t.due,
        no_due: t.no_due,
        suggested: t.suggested,
        open_trip: t.open_trip,
        shop_cta: t.shop_cta,
        esim_order_pending: t.esim_order_pending,
        esim_order_ready: t.esim_order_ready,
        esim_order_shared: t.esim_order_shared,
      }}
      tasks={tasks.map((task) => ({
        ...task,
        trip: tripsById.get(task.trip_id) ?? null,
      }))}
    />
  );
}

async function loadTasks() {
  try {
    const [trips, tasks] = await Promise.all([
      listTrips(),
      listChecklists({ includeDone: true }),
    ]);
    const tripsById = new Map<string, TaskTripSummary>(
      trips.map((trip) => [
        trip.id,
        {
          id: trip.id,
          title: trip.title,
          start_date: trip.start_date,
          end_date: trip.end_date,
          status: trip.status,
        },
      ]),
    );
    return { tasks, tripsById };
  } catch (err) {
    if (err instanceof TripApiError && err.status === 401) {
      return { tasks: [], tripsById: new Map<string, TaskTripSummary>() };
    }
    throw err;
  }
}
