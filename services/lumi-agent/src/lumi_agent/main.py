from fastapi import FastAPI

from .runtime import run_turn
from .schemas import AgentRequest, AgentResult
from .tools import select_allowed_tools

app = FastAPI(title="Lumi Agent", version="0.1.0")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/v1/respond", response_model=AgentResult)
def respond(request: AgentRequest) -> AgentResult:
    return run_turn(request)


@app.post("/v1/tools")
def tools(request: AgentRequest) -> dict[str, list[str]]:
    return {"tools": sorted(select_allowed_tools(request.page))}
