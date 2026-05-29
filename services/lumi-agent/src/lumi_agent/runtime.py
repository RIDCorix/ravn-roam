from __future__ import annotations

import re

from .schemas import (
    AgentRequest,
    AgentResult,
    CompanionOperation,
    ConfirmationRequest,
    LumiDay,
    LumiStop,
    ToolCallRecord,
    TripDraft,
)
from .tools import add_booking_todos, extract_travel_facts, propose_trip, select_allowed_tools, suggest_esim


ESIM_RE = re.compile(r"eSIM|sim\s*卡|網卡|上網卡|流量|多少\s*G", re.I)
BOOKING_TODO_RE = re.compile(r"訂票|門票|餐廳|訂位|todo|待辦", re.I)
DELETE_RE = re.compile(r"刪除|delete", re.I)
COMPANION_ADD_RE = re.compile(r"新增旅伴\s*(?P<name>[\w\u4e00-\u9fff]+)")
DAY_REF_RE = re.compile(r"(?:Day|D|第)\s*(?P<day>\d+)\s*(?:天)?", re.I)


def run_turn(request: AgentRequest) -> AgentResult:
    allowed = select_allowed_tools(request.page)

    if ESIM_RE.search(request.prompt):
        suggestion = suggest_esim(request.prompt)
        return AgentResult(
            summary="我幫你抓一個適合這趟旅程的 eSIM 方案。",
            esim_suggestion=suggestion,
            tool_calls=[
                ToolCallRecord(
                    name="suggest_esim_plans",
                    arguments={"prompt": request.prompt},
                    result=suggestion.model_dump(),
                )
            ],
        )

    if DELETE_RE.search(request.prompt) and request.page.trip_id:
        return AgentResult(
            summary="刪除行程需要再次確認。",
            needs_confirmation=ConfirmationRequest(
                action="delete_trip",
                trip_id=request.page.trip_id,
                message="確認後才會刪除這趟行程。",
            ),
        )

    companion_match = COMPANION_ADD_RE.search(request.prompt)
    if companion_match and "upsert_companion" in allowed:
        op = CompanionOperation(display_name=companion_match.group("name"))
        return AgentResult(
            summary=f"我準備新增旅伴 {op.display_name}。",
            companion_operations=[op],
            tool_calls=[ToolCallRecord(name="upsert_companion", arguments=op.model_dump())],
        )

    if request.editable_trip and BOOKING_TODO_RE.search(request.prompt):
        patch = add_booking_todos(request.editable_trip)
        return AgentResult(
            summary="我幫你把需要訂票與訂位的待辦補上了。",
            itinerary_patch=patch,
            tool_calls=[
                ToolCallRecord(
                    name="add_stop_attachments",
                    arguments={"trip_id": request.editable_trip.id},
                    result=patch.model_dump(),
                )
            ],
        )

    if request.editable_trip and _wants_day_update(request.prompt):
        patch = _build_day_patch(request)
        return AgentResult(
            summary="我先幫你把指定日期的安排整理成更新草稿。",
            itinerary_patch=patch,
            tool_calls=[
                ToolCallRecord(
                    name="update_day",
                    arguments={"trip_id": request.editable_trip.id, "day_date": patch.days[0].day_date},
                    result=patch.model_dump(),
                )
            ],
        )

    if "extract_travel_facts" in allowed and _looks_like_travel_source(request.prompt):
        facts = extract_travel_facts(request.prompt)
        draft = propose_trip(facts)
        return AgentResult(
            summary=f"我已經為你整理出 {facts.trip_days} 天的 {facts.destination_city} 旅程草稿。",
            trip_draft=draft,
            tool_calls=[
                ToolCallRecord(
                    name="extract_travel_facts",
                    arguments={"text": request.prompt},
                    result=facts.model_dump(),
                ),
                ToolCallRecord(
                    name="propose_trip",
                    arguments={"facts": facts.model_dump()},
                    result=draft.model_dump(),
                ),
            ],
        )

    return AgentResult(summary="我可以幫你建立旅程、調整行程、整理待辦或推薦 eSIM。")


def _looks_like_travel_source(prompt: str) -> bool:
    return bool(re.search(r"航班|票號|去程|到達|到\s+[A-Za-z\u4e00-\u9fff]+", prompt))


def _wants_day_update(prompt: str) -> bool:
    return bool(DAY_REF_RE.search(prompt) and re.search(r"安排|去|排", prompt))


def _build_day_patch(request: AgentRequest):
    assert request.editable_trip is not None
    match = DAY_REF_RE.search(request.prompt)
    day_index = int(match.group("day")) - 1 if match else 0
    day = request.editable_trip.days[day_index]
    place_match = re.search(r"去(?P<place>[\w\u4e00-\u9fff]+)", request.prompt)
    place = place_match.group("place") if place_match else "待安排地點"
    patched_day = LumiDay(
        day_date=day.day_date,
        city=day.city,
        note=place,
        stops=[LumiStop(name=place, kind="sight", arrival_time="14:00", duration_min=120)],
    )
    return TripDraft(
        title=request.editable_trip.title,
        start_date=request.editable_trip.start_date,
        end_date=request.editable_trip.end_date,
        days=[patched_day],
    )
