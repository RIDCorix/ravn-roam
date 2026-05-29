from fastapi.testclient import TestClient

from lumi_agent.main import app
from lumi_agent.runtime import run_turn
from lumi_agent.schemas import AgentRequest, EditableTrip, LumiDay, LumiStop, PageContext
from lumi_agent.tools import select_allowed_tools


FLIGHT_PROMPT = """票號 695-2463892633: Yiting Liu
票號 695-2463892634: Shangruei Yang
台北 到 Milan
航班 1: 星期五, 25 九月 2026 已確認
去程: 23:45 台北, 台灣 - 台灣桃園國際機場, 航站 2
到達: 07:35 +1 日 Milan, 義大利 - 馬爾彭薩, 航站 1
航空公司 (班號): EVA Air BR 95
飛行時間: 13小時50分
Milan 到 台北
航班 1: 星期日, 11 十月 2026 已確認
去程: 11:15 Milan, 義大利 - 馬爾彭薩, 航站 1
到達: 05:45 +1 日 台北, 台灣 - 台灣桃園國際機場, 航站 2
航空公司 (班號): EVA Air BR 96
飛行時間: 12小時30分
"""


def test_ticket_prompt_generates_reasonable_17_day_milan_trip():
    result = run_turn(
        AgentRequest(
            prompt=FLIGHT_PROMPT,
            page=PageContext(surface="trips.list", locale="zh-TW"),
        )
    )

    assert result.trip_draft is not None
    assert result.trip_draft.start_date == "2026-09-25"
    assert result.trip_draft.end_date == "2026-10-11"
    assert len(result.trip_draft.days) == 17
    assert result.trip_draft.days[0].city == "台北"
    assert result.trip_draft.days[1].city == "Milan"
    assert result.trip_draft.days[-1].city == "Milan"
    assert "Milan" in result.trip_draft.title


def test_ticket_prompt_uses_fact_extraction_then_trip_proposal_tools():
    result = run_turn(
        AgentRequest(
            prompt=FLIGHT_PROMPT,
            page=PageContext(surface="trips.list", locale="zh-TW"),
        )
    )

    assert [call.name for call in result.tool_calls[:2]] == [
        "extract_travel_facts",
        "propose_trip",
    ]
    assert "update_itinerary" not in [call.name for call in result.tool_calls]


def test_trips_list_cannot_expose_itinerary_mutation_tools():
    tools = select_allowed_tools(PageContext(surface="trips.list", locale="zh-TW"))

    assert "propose_trip" in tools
    assert "create_trip" in tools
    assert "update_itinerary" not in tools
    assert "update_day" not in tools


def test_trip_detail_exposes_itinerary_tools_for_current_trip():
    tools = select_allowed_tools(
        PageContext(surface="trip.detail", locale="zh-TW", trip_id="trip-1")
    )

    assert "get_trip_detail" in tools
    assert "update_itinerary" in tools
    assert "update_day" in tools
    assert "create_trip" not in tools


def test_existing_trip_detail_adds_ticket_and_restaurant_todos():
    trip = EditableTrip(
        id="trip-1",
        title="東京 5 日",
        start_date="2026-05-12",
        end_date="2026-05-16",
        days=[
            LumiDay(
                day_date="2026-05-13",
                city="東京",
                note="上野與銀座",
                stops=[
                    LumiStop(name="teamLab Planets", kind="sight", arrival_time="10:00", duration_min=120),
                    LumiStop(name="Bar Benfiddich", kind="meal", arrival_time="19:30", duration_min=120),
                ],
            )
        ],
    )

    result = run_turn(
        AgentRequest(
            prompt="幫我把需要訂票和餐廳訂位的 todo 加到這趟行程",
            page=PageContext(surface="trip.detail", locale="zh-TW", trip_id="trip-1"),
            editable_trip=trip,
        )
    )

    assert result.itinerary_patch is not None
    attachments = result.itinerary_patch.days[0].stops[0].attachments
    meal_attachments = result.itinerary_patch.days[0].stops[1].attachments
    assert attachments[0].type == "ticket"
    assert "teamLab" in attachments[0].checklist_text
    assert meal_attachments[0].type == "reservation"
    assert "Bar Benfiddich" in meal_attachments[0].checklist_text


def test_generated_todos_have_subtasks_and_non_duplicate_guidance():
    result = run_turn(
        AgentRequest(
            prompt=FLIGHT_PROMPT,
            page=PageContext(surface="trips.list", locale="zh-TW"),
        )
    )

    checklist = result.trip_draft.checklist
    assert checklist
    assert all(item.subtasks for item in checklist)
    for item in checklist:
        subtask_texts = {subtask["text"] for subtask in item.subtasks}
        assert item.description is None or item.description not in subtask_texts


def test_day_reference_maps_to_existing_trip_date():
    trip = EditableTrip(
        id="trip-1",
        title="東京 3 日",
        start_date="2026-05-12",
        end_date="2026-05-14",
        days=[
            LumiDay(day_date="2026-05-12", city="東京", note="", stops=[]),
            LumiDay(day_date="2026-05-13", city="東京", note="", stops=[]),
            LumiDay(day_date="2026-05-14", city="東京", note="", stops=[]),
        ],
    )

    result = run_turn(
        AgentRequest(
            prompt="幫我安排 Day 2 下午去晴空塔",
            page=PageContext(surface="trip.detail", locale="zh-TW", trip_id="trip-1"),
            editable_trip=trip,
        )
    )

    assert result.itinerary_patch is not None
    assert result.itinerary_patch.days[0].day_date == "2026-05-13"
    assert result.itinerary_patch.days[0].stops[0].name == "晴空塔"


def test_esim_intent_suggests_plans_without_trip_mutation():
    result = run_turn(
        AgentRequest(
            prompt="我這趟米蘭 17 天要買多少 eSIM？",
            page=PageContext(surface="trips.list", locale="zh-TW"),
        )
    )

    assert result.esim_suggestion is not None
    assert result.trip_draft is None
    assert result.itinerary_patch is None
    assert result.esim_suggestion.plans[0].country == "IT"


def test_companion_management_uses_companion_tool_only_on_trip_detail():
    result = run_turn(
        AgentRequest(
            prompt="新增旅伴小明",
            page=PageContext(surface="trip.detail", locale="zh-TW", trip_id="trip-1"),
            editable_trip=EditableTrip(
                id="trip-1",
                title="東京",
                start_date="2026-05-12",
                end_date="2026-05-13",
                days=[],
            ),
        )
    )

    assert result.companion_operations is not None
    assert result.companion_operations[0].display_name == "小明"
    assert [call.name for call in result.tool_calls] == ["upsert_companion"]


def test_delete_trip_requires_confirmation_token():
    result = run_turn(
        AgentRequest(
            prompt="刪除這趟行程",
            page=PageContext(surface="trip.detail", locale="zh-TW", trip_id="trip-1"),
            editable_trip=EditableTrip(
                id="trip-1",
                title="東京",
                start_date="2026-05-12",
                end_date="2026-05-13",
                days=[],
            ),
        )
    )

    assert result.needs_confirmation is not None
    assert result.needs_confirmation.action == "delete_trip"
    assert "delete_trip" not in [call.name for call in result.tool_calls]


def test_fastapi_respond_endpoint_returns_agent_result():
    client = TestClient(app)

    response = client.post(
        "/v1/respond",
        json={
            "prompt": "我這趟米蘭 17 天要買多少 eSIM？",
            "page": {"surface": "trips.list", "locale": "zh-TW"},
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["esim_suggestion"]["plans"][0]["country"] == "IT"
