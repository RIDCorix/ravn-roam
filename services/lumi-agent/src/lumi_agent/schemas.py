from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


class StopAttachment(BaseModel):
    type: str = "ticket"
    label: str
    url: str | None = None
    amount: str | None = None
    action_label: str | None = None
    checklist_text: str | None = None
    checklist_description: str | None = None
    checklist_kind: str | None = None
    checklist_item_id: str | None = None
    status: Literal["required", "completed", "uploaded"] = "required"


class LumiStop(BaseModel):
    name: str
    kind: str = "other"
    arrival_time: str | None = None
    duration_min: int | None = None
    note: str = ""
    attachments: list[StopAttachment] = Field(default_factory=list)


class LumiDay(BaseModel):
    day_date: str
    city: str
    note: str = ""
    stops: list[LumiStop] = Field(default_factory=list)


class ChecklistItem(BaseModel):
    text: str
    description: str | None = None
    kind: str
    start_date: str | None = None
    phase: str | None = None
    group_label: str | None = None
    subtasks: list[dict] = Field(default_factory=list)
    suggested: bool | None = True
    shop_filter: dict | None = None


class TripDraft(BaseModel):
    title: str
    start_date: str
    end_date: str
    cover: str | None = None
    days: list[LumiDay]
    checklist: list[ChecklistItem] = Field(default_factory=list)


class EditableTrip(BaseModel):
    id: str
    title: str
    start_date: str
    end_date: str
    days: list[LumiDay]


class PageContext(BaseModel):
    surface: str
    locale: str = "zh-TW"
    trip_id: str | None = None


class AgentRequest(BaseModel):
    prompt: str
    page: PageContext
    editable_trip: EditableTrip | None = None


class TravelFacts(BaseModel):
    origin_city: str
    destination_city: str
    outbound_depart_date: str
    outbound_depart_time: str | None = None
    outbound_arrive_date: str | None = None
    outbound_arrive_time: str | None = None
    return_depart_date: str
    return_depart_time: str | None = None
    return_arrive_date: str | None = None
    return_arrive_time: str | None = None
    trip_start_date: str
    trip_end_date: str
    trip_days: int


class EsimPlan(BaseModel):
    country: str
    days: int | None = None
    gb: float | None = None
    label: str | None = None


class EsimSuggestion(BaseModel):
    plans: list[EsimPlan]
    rationale: str | None = None


class CompanionOperation(BaseModel):
    display_name: str
    color: str | None = None
    id: str | None = None
    delete: bool | None = None


class ConfirmationRequest(BaseModel):
    action: str
    trip_id: str | None = None
    message: str


class ToolCallRecord(BaseModel):
    name: str
    arguments: dict = Field(default_factory=dict)
    result: dict | None = None


class AgentResult(BaseModel):
    summary: str
    tool_calls: list[ToolCallRecord] = Field(default_factory=list)
    trip_draft: TripDraft | None = None
    itinerary_patch: TripDraft | None = None
    esim_suggestion: EsimSuggestion | None = None
    companion_operations: list[CompanionOperation] | None = None
    needs_confirmation: ConfirmationRequest | None = None
