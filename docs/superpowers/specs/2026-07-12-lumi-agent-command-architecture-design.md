# Lumi Agent Command Architecture

Date: 2026-07-12
Scope: Roam Lumi request authorization, model tools, command validation, and trip mutation execution

## Goal

Refactor Lumi so natural-language interpretation happens only inside the model.
Application code must authorize capabilities from structured request context,
accept typed model commands, validate exact references and domain invariants, and
execute those commands without reparsing the user's prompt or guessing targets
from display text.

## Architectural Invariants

1. Free-form chat is read-only.
2. Mutations require an explicit structured `requested_skill` mode.
3. Raw prompt text is available to the model boundary only. Capability policy,
   validation, domain, and persistence modules must not inspect it.
4. Existing records are referenced by stable IDs. Display names and dates are
   context for the model, not mutation keys for the server.
5. The server may validate, enrich from deterministic services, and execute. It
   must not reconstruct omitted intent or fabricate user-requested content.
6. Invalid commands produce structured validation errors and may receive a
   bounded model retry. Exhausted retries fail explicitly.
7. The final natural-language response may describe only commands that were
   accepted and executed.

## Request Modes And Authorization

The chat request keeps `requested_skill`, but it becomes an authorization
boundary rather than a prompt hint.

| Mode | Read context | Allowed mutations |
| --- | --- | --- |
| absent | Page and trip context | None |
| `inspiration` | Travel context | None |
| `create-trip` | General travel context | Stage and finalize a new trip draft |
| `plan-trip` | Exact current-trip snapshot | Update existing itinerary days and create explicitly requested new days |
| `edit-trip` | Exact current-trip snapshot | `plan-trip` capabilities plus companions, attachments, and flight details |

The API rejects mutation modes that lack their required structured context. For
example, `plan-trip` and `edit-trip` require an owned `current_trip_id`.
Conversely, merely supplying `current_trip_id` does not authorize mutation when
`requested_skill` is absent.

A pure capability-policy function maps the validated request envelope to the
only tool definitions exposed for that turn. It does not receive the prompt.

## Model Boundary

The model receives:

- The user's prompt and bounded conversation history.
- Read-only page context.
- An exact snapshot of authorized entities, including day and stop IDs.
- Only the tool schemas allowed by the capability policy.
- Concise behavioral instructions for the selected mode.

The model owns language interpretation: which entity the user means, which
operation they requested, and what structured content belongs in the command.
The server does not duplicate that interpretation with regexes, keyword lists,
substring checks, or date-section parsers.

## Typed Commands

Existing itinerary mutations use stable references:

- `update_trip_day` requires `day_id` and the replacement day payload.
- Attachment mutations require `stop_id` and the attachment payload.
- Companion updates and deletes require the existing companion ID.
- Flight detail updates use an explicit flight-leg identifier from structured
  trip state when updating an existing leg.

Creation commands use an exact parent reference and structured content:

- `create_trip_day` requires `trip_id`, `day_date`, and the new day payload.
- New stops are nested inside an authorized day command or created beneath an
  exact `day_id`.
- New-trip draft days are staged as structured day objects; no existing IDs are
  expected because the aggregate does not yet exist.

Dates, names, and labels remain useful model-visible context, but the executor
never uses them to locate an existing record.

## Validation Pipeline

Each model tool call passes through four stages:

1. Schema validation: parse the command with Zod and reject unknown or missing
   fields.
2. Authorization validation: verify the request mode permits the command.
3. Reference validation: verify IDs exist, belong to the authenticated user and
   current aggregate, and refer to the expected entity type.
4. Domain validation: enforce itinerary ordering, stop anchor contracts,
   calendar constraints, place-ID provenance, and other typed invariants.

Failures use a structured result such as:

```json
{
  "ok": false,
  "code": "invalid_reference",
  "field": "stop_id",
  "message": "The stop is not part of the authorized trip snapshot."
}
```

The provider loop may return this result to the model for another tool call up
to the configured iteration limit. There is no fallback that parses the raw
prompt or invents a partial command after retries are exhausted.

## Execution And Response Assembly

Validated commands are collected as typed values. Execution is handled by
domain-specific services rather than the HTTP route or provider adapter.

- Itinerary service: day creation and replacement, stop persistence, ordering,
  and deterministic place enrichment.
- Trip-detail service: flight facts and companions.
- Attachment service: exact-stop attachment and checklist linkage.
- Draft service: staged new-trip days and final draft assembly.

The route coordinates authentication, request parsing, snapshot loading,
provider invocation, transactions, persistence of conversation events, and the
HTTP/SSE response. It does not contain entity matching or mutation-specific
business logic.

The response assembler receives executed command results. It prevents Lumi
from claiming an update that was rejected, skipped, or never executed.

## Module Boundaries

The current `services/api/src/lumi/openai.ts` and
`services/api/src/routes/lumi.ts` are coordination hubs well beyond the
repository's file-size budget. The refactor should introduce focused modules:

```text
services/api/src/lumi/
  contracts/
    request.ts
    commands.ts
    responses.ts
  capabilities.ts
  prompts.ts
  context.ts
  provider/openai.ts
  provider/tool-loop.ts
  validation/commands.ts
  validation/itinerary.ts
  execution/itinerary.ts
  execution/trip-details.ts
  execution/attachments.ts
  execution/drafts.ts
  response-assembly.ts
```

Exact names may follow existing conventions, but dependencies must point
inward: routes and providers depend on contracts and services; domain services
must not depend on provider messages, prompt text, or HTTP types.

## Heuristics To Remove

The first migration removes these current behaviors:

- `extractPromptItineraryDates` and raw-prompt date regexes.
- `extractPromptDatedSections` and prompt slicing.
- `tripDraftPromptCoverageIssue` when its requirements are derived from prompt
  parsing.
- `completeTripDraftPromptDates` and fabricated fallback day content.
- `findMatchingStop` and partial normalized-name matching for attachment
  targets.
- Any capability selection based on prompt keywords or regexes.

Deterministic parsing remains valid at explicit protocol boundaries, such as
validating ISO date fields already emitted in a structured command. Search,
display filtering, URL parsing, and supplier-format parsing are outside this
intent-architecture restriction.

## Migration Sequence

### Phase 1: Lock The Authorization Boundary

- Make `requested_skill` the sole mutation authorization input.
- Expose no mutation tools for unscoped chat, even with `current_trip_id`.
- Reject `plan-trip` or `edit-trip` without an owned current trip.
- Add regression tests before changing behavior.

### Phase 2: Add Stable References

- Include day and stop IDs in the model-visible current-trip snapshot.
- Change existing-day commands to require `day_id`.
- Change attachment commands to require `stop_id`.
- Validate references against the loaded snapshot and authenticated owner.

### Phase 3: Remove Prompt Reparsing And Fallback Fabrication

- Delete prompt date/section extraction and fabricated-day completion.
- Use staged structured draft days as the sole draft completeness source.
- Return structured retry errors for incomplete staged output, then fail
  explicitly if the retry budget is exhausted.

### Phase 4: Extract Services And Provider Modules

- Move schemas and shared types into contract modules.
- Move capability selection into a pure policy module.
- Move OpenAI transport and tool-loop mechanics behind a provider adapter.
- Move persistence operations from the route into execution services.

### Phase 5: Consolidate Journey Planning

- Compare the chat tool loop and staged `journey.ts` pipeline after the command
  boundary is stable.
- Reuse shared contracts, validators, and executors.
- Decide whether to retain two orchestration experiences or converge them;
  this decision is deliberately deferred until both use the same typed core.

## Error Handling

- Invalid request mode/context: HTTP 400 or 403 before invoking the model.
- Invalid model command: structured tool error and bounded retry.
- Stale entity ID: reload-required error; never fall back to name matching.
- Domain conflict: typed conflict result with no partial claim of success.
- External enrichment failure: preserve valid structured content and mark the
  enrichment unresolved when the domain permits it.
- Provider timeout: retain staged structured state and return the existing
  recoverable drafting error flow.

## Testing Strategy

Focused tests should prove the boundary rather than particular prompt wording:

- Capability-policy unit tests cover every mode/context combination.
- Unscoped chat exposes no mutation tools regardless of prompt wording.
- `current_trip_id` alone does not authorize mutations.
- Every existing-entity mutation schema requires the stable ID.
- Unknown, cross-trip, and stale IDs fail without name-based fallback.
- Attachment commands target only the exact `stop_id`.
- Draft completion depends on staged structured days, not dates found in raw
  text.
- Invalid commands can retry within the limit and fail explicitly afterward.
- Executed-command results, not proposed commands, control the final response.
- Existing itinerary, place-anchor, flight-route, and ownership tests remain
  green.

## Acceptance Criteria

- No Lumi server module uses raw prompt regexes, keywords, or substring matching
  to authorize a capability, infer an operation, locate an entity, or fabricate
  command content.
- Free-form chat is read-only.
- Every mutation is authorized by explicit structured mode and exact owned
  context.
- Existing entities are mutated only through stable IDs.
- The provider loop, validators, executors, and route orchestration have clear,
  testable boundaries.
- The prompt-derived draft completion and fuzzy stop matching paths are gone.
- Targeted API tests and type checking pass without credentials.

## Out Of Scope

- Redesigning the Lumi UI.
- Replacing the language model or adding a second intent-classification model.
- Rewriting unrelated search, catalog, supplier, or storefront filtering code.
- Immediately converging the chat and staged journey user experiences before
  the typed command core is shared.
