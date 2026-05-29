# Lumi Agent

FastAPI backend for Lumi's MCP-style agent runtime.

## Run

```bash
uv run uvicorn --app-dir src lumi_agent.main:app --host 0.0.0.0 --port 4010
```

## Test

```bash
uv run pytest
```

## Endpoints

- `GET /health`
- `POST /v1/tools` returns page-gated tools for the current surface.
- `POST /v1/respond` returns the agent result, proposal, patch, or confirmation request.

