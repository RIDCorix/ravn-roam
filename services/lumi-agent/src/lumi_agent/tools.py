from __future__ import annotations

import re
from datetime import date, timedelta

from .schemas import (
    ChecklistItem,
    EditableTrip,
    EsimSuggestion,
    LumiDay,
    LumiStop,
    PageContext,
    StopAttachment,
    TravelFacts,
    TripDraft,
)


READ_TOOLS = {"get_page_context", "list_trips", "get_trip_detail"}
TRIP_PROPOSAL_TOOLS = {"extract_travel_facts", "propose_trip", "create_trip"}
TRIP_EDITOR_TOOLS = {
    "get_trip_detail",
    "update_itinerary",
    "update_day",
    "add_stop_attachments",
}
CHECKLIST_TOOLS = {"list_checklist", "upsert_checklist_item", "complete_checklist_item"}
COMPANION_TOOLS = {"list_companions", "upsert_companion", "remove_companion"}
ESIM_TOOLS = {"search_esim_plans", "suggest_esim_plans"}
DANGEROUS_TOOLS = {"delete_trip"}

MONTHS = {
    "一月": 1,
    "二月": 2,
    "三月": 3,
    "四月": 4,
    "五月": 5,
    "六月": 6,
    "七月": 7,
    "八月": 8,
    "九月": 9,
    "十月": 10,
    "十一月": 11,
    "十二月": 12,
}


def select_allowed_tools(page: PageContext) -> set[str]:
    if page.surface == "trip.detail" and page.trip_id:
        return READ_TOOLS | TRIP_EDITOR_TOOLS | CHECKLIST_TOOLS | COMPANION_TOOLS | ESIM_TOOLS
    return READ_TOOLS | TRIP_PROPOSAL_TOOLS | ESIM_TOOLS


def extract_travel_facts(text: str) -> TravelFacts:
    routes = re.findall(r"([A-Za-z\u4e00-\u9fff]+)\s+到\s+([A-Za-z\u4e00-\u9fff]+)", text)
    if not routes:
        raise ValueError("No route found in travel text")

    origin, destination = routes[0]
    return_origin, return_destination = routes[-1]
    if return_destination == origin:
        destination = return_origin

    dates = re.findall(r"(\d{1,2})\s*(一月|二月|三月|四月|五月|六月|七月|八月|九月|十月|十一月|十二月)\s*(\d{4})", text)
    if len(dates) < 2:
        raise ValueError("Need outbound and return dates")

    outbound_date = _format_chinese_date(*dates[0])
    return_date = _format_chinese_date(*dates[-1])
    times = re.findall(r"(?:去程|到達):\s*(\d{2}:\d{2})", text)
    start = _parse_iso_date(outbound_date)
    end = _parse_iso_date(return_date)
    trip_days = (end - start).days + 1

    return TravelFacts(
        origin_city=origin,
        destination_city=destination,
        outbound_depart_date=outbound_date,
        outbound_depart_time=times[0] if len(times) > 0 else None,
        outbound_arrive_date=_add_days(outbound_date, 1) if "+1 日" in text else None,
        outbound_arrive_time=times[1] if len(times) > 1 else None,
        return_depart_date=return_date,
        return_depart_time=times[2] if len(times) > 2 else None,
        return_arrive_date=_add_days(return_date, 1) if len(times) > 3 else None,
        return_arrive_time=times[3] if len(times) > 3 else None,
        trip_start_date=outbound_date,
        trip_end_date=return_date,
        trip_days=trip_days,
    )


def propose_trip(facts: TravelFacts) -> TripDraft:
    days: list[LumiDay] = []
    for index, day in enumerate(_date_range(facts.trip_start_date, facts.trip_end_date)):
        if index == 0:
            days.append(
                LumiDay(
                    day_date=day,
                    city=facts.origin_city,
                    note="出發前往目的地",
                    stops=[
                        LumiStop(
                            name=f"{facts.origin_city} → {facts.destination_city}",
                            kind="transit",
                            arrival_time=facts.outbound_depart_time,
                            duration_min=830,
                            note="",
                        )
                    ],
                )
            )
            continue

        if day == facts.trip_end_date:
            stops = [
                LumiStop(
                    name=f"{facts.destination_city} → {facts.origin_city}",
                    kind="transit",
                    arrival_time=facts.return_depart_time,
                    duration_min=750,
                    note="",
                )
            ]
            days.append(LumiDay(day_date=day, city=facts.destination_city, note="返程日", stops=stops))
            continue

        if index == 1:
            stops = [
                LumiStop(
                    name="抵達與入住",
                    kind="stay",
                    arrival_time="15:00",
                    duration_min=30,
                    note="安排住宿 check-in",
                )
            ]
            days.append(LumiDay(day_date=day, city=facts.destination_city, note="抵達與入住", stops=stops))
            continue

        days.append(
            LumiDay(
                day_date=day,
                city=facts.destination_city,
                note="自由探索",
                stops=[LumiStop(name=facts.destination_city, kind="other", note="保留給 Lumi 後續細排")],
            )
        )

    return TripDraft(
        title=f"{facts.origin_city} + {facts.destination_city}",
        start_date=facts.trip_start_date,
        end_date=facts.trip_end_date,
        cover=facts.destination_city[:2],
        days=days,
        checklist=[
            ChecklistItem(
                text="確認航班與航廈資訊",
                description="如果航班時間有異動，住宿入住時間和接駁安排也要一起確認。",
                kind="flight",
                start_date=_add_days(facts.trip_start_date, -7),
                phase="week_before",
                group_label="文件與確認",
                subtasks=[
                    {"text": "確認去程與回程航班時間", "done": False},
                    {"text": "把電子機票存到離線檔", "done": False},
                ],
            ),
            ChecklistItem(
                text=f"購買{facts.destination_city} {facts.trip_days} 日 eSIM",
                description="抵達前可以先安裝，但先不要啟用；落地後再切換數據線路。",
                kind="esim",
                start_date=_add_days(facts.trip_start_date, -7),
                phase="week_before",
                group_label="通訊與網路",
                subtasks=[
                    {"text": "依旅程天數選擇方案", "done": False},
                    {"text": "出發前先安裝 eSIM", "done": False},
                ],
                shop_filter={"country": _country_for_city(facts.destination_city), "days": facts.trip_days},
            ),
            ChecklistItem(
                text="整理護照、簽證與保險文件",
                description="重要文件建議同時保存在手機離線檔和雲端，避免網路不穩時打不開。",
                kind="doc",
                start_date=_add_days(facts.trip_start_date, -30),
                phase="early",
                group_label="文件與保險",
                subtasks=[
                    {"text": "確認護照效期", "done": False},
                    {"text": "保存簽證、保險與緊急聯絡資料", "done": False},
                ],
            ),
        ],
    )


def add_booking_todos(trip: EditableTrip) -> TripDraft:
    patched_days: list[LumiDay] = []
    for day in trip.days:
        patched_stops: list[LumiStop] = []
        for stop in day.stops:
            next_stop = stop.model_copy(deep=True)
            if _needs_ticket(stop):
                next_stop.attachments.append(
                    StopAttachment(
                        type="ticket",
                        label="門票",
                        action_label="訂票",
                        checklist_text=f"購買{stop.name}門票",
                        checklist_description="- 確認官方售票頁與可入場時段\n- 將票券 QR code 存到離線檔",
                        checklist_kind="ticket",
                    )
                )
            if _needs_reservation(stop):
                next_stop.attachments.append(
                    StopAttachment(
                        type="reservation",
                        label="訂位",
                        action_label="訂位",
                        checklist_text=f"預訂{stop.name}",
                        checklist_description="- 確認營業時間與訂位人數\n- 將訂位確認信或電話存到 memo",
                        checklist_kind="stay" if stop.kind == "stay" else "ticket",
                    )
                )
            patched_stops.append(next_stop)
        patched_days.append(day.model_copy(update={"stops": patched_stops}))

    return TripDraft(
        title=trip.title,
        start_date=trip.start_date,
        end_date=trip.end_date,
        days=patched_days,
    )


def suggest_esim(prompt: str) -> EsimSuggestion:
    country = "IT" if re.search(r"米蘭|Milan|義大利|意大利", prompt, re.I) else "JP"
    days_match = re.search(r"(\d+)\s*天", prompt)
    days = int(days_match.group(1)) if days_match else None
    gb = days * 1 if days else None
    label_country = "義大利" if country == "IT" else "日本"
    return EsimSuggestion(
        plans=[{"country": country, "days": days, "gb": gb, "label": f"{label_country} {days or ''} 天 eSIM".strip()}],
        rationale="以輕量使用抓 1GB/天，適合地圖、訊息和查資料。",
    )


def _format_chinese_date(day: str, month: str, year: str) -> str:
    return f"{int(year):04d}-{MONTHS[month]:02d}-{int(day):02d}"


def _parse_iso_date(value: str) -> date:
    return date.fromisoformat(value)


def _add_days(value: str, days: int) -> str:
    return (_parse_iso_date(value) + timedelta(days=days)).isoformat()


def _date_range(start: str, end: str) -> list[str]:
    cursor = _parse_iso_date(start)
    stop = _parse_iso_date(end)
    out: list[str] = []
    while cursor <= stop:
        out.append(cursor.isoformat())
        cursor += timedelta(days=1)
    return out


def _country_for_city(city: str) -> str:
    if re.search(r"Milan|米蘭|義大利|意大利", city, re.I):
        return "IT"
    if re.search(r"東京|京都|日本|Tokyo|Japan", city, re.I):
        return "JP"
    return "IT"


def _needs_ticket(stop: LumiStop) -> bool:
    return stop.kind == "sight" or bool(re.search(r"teamlab|museum|美術館|博物館|樂園|塔|展", stop.name, re.I))


def _needs_reservation(stop: LumiStop) -> bool:
    return stop.kind == "meal" or bool(re.search(r"bar|restaurant|餐廳|壽司|晚餐", stop.name, re.I))
