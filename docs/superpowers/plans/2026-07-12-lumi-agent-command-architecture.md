# Lumi Agent Command Architecture Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Lumi mutations explicitly authorized, typed, stable-ID based, and free of server-side natural-language intent guessing.

**Architecture:** A pure capability policy maps structured request mode and owned context to model tools. The model interprets the prompt and emits typed commands; validators check authorization, references, and domain rules; execution services apply exact-ID mutations; response assembly reports only executed results. Raw prompt text remains confined to the provider boundary.

**Tech Stack:** Node.js 22, TypeScript 5.7, Hono, Zod 3, Drizzle ORM, Vitest 2, OpenAI Chat Completions tools.

## Global Constraints

- Free-form chat is read-only.
- Mutations require explicit `requested_skill` authorization.
- Existing records are referenced only by stable IDs.
- Server code must not parse prompt text to authorize capabilities, locate entities, or fabricate structured content.
- Preserve `/healthz` without optional credentials and keep tests credential-free.
- Preserve unrelated dirty-worktree changes.
- Do not commit, push, or deploy without explicit user authorization.

## File Map

- Create `services/api/src/lumi/contracts/{request,snapshot,commands}.ts` for provider-independent types and schemas.
- Create `services/api/src/lumi/capabilities.ts` for the pure authorization matrix.
- Create `services/api/src/lumi/validation/commands.ts` for authorization and stable-reference checks.
- Create `services/api/src/lumi/execution/{itinerary,attachments}.ts` for exact-ID persistence.
- Create `services/api/src/lumi/provider/{openai,tool-loop}.ts` for provider transport and bounded iteration.
- Create `services/api/src/lumi/{prompts,context,response-assembly}.ts` for focused orchestration concerns.
- Modify `services/api/src/lumi/openai.ts` into a compatibility entry point.
- Modify `services/api/src/routes/lumi.ts` to validate mode/context, load IDs, and call executors.
- Add focused `*.test.ts` files beside each module and update existing Lumi route/provider tests.
- Modify `docs/ARCHITECTURE.md` with the trust boundary.

---

### Task 1: Explicit Capability Policy

**Files:**
- Create: `services/api/src/lumi/contracts/request.ts`
- Create: `services/api/src/lumi/capabilities.ts`
- Create: `services/api/src/lumi/capabilities.test.ts`
- Modify: `services/api/src/lumi/openai.ts`

**Interfaces:**
- Produces `LumiRequestMode`, `LumiAuthorizationContext`, `LumiCapability`, and `capabilitiesForTurn(context)`.
- Consumes no prompt text and no provider types.

- [ ] **Step 1: Write the failing authorization-matrix tests**

```ts
test("keeps unscoped chat read-only even with a current trip", () => {
  expect(capabilitiesForTurn({ mode: null, tripId: "trip-1" })).toEqual(
    new Set(["read:context", "read:places", "read:esim"]),
  );
});

test("requires an owned trip for mutation modes", () => {
  expect(() =>
    capabilitiesForTurn({ mode: "plan-trip", tripId: null }),
  ).toThrow("plan-trip requires an owned current trip");
});

test("authorizes the explicit edit-trip mutations", () => {
  expect(capabilitiesForTurn({ mode: "edit-trip", tripId: "trip-1" })).toEqual(
    new Set([
      "read:context", "read:places", "trip:update-day", "trip:create-day",
      "trip:update-flight", "trip:edit-companion", "trip:edit-attachment",
    ]),
  );
});
```

- [ ] **Step 2: Run RED**

```bash
pnpm --filter @roam/api test -- src/lumi/capabilities.test.ts
```

Expected: FAIL because `capabilities.ts` does not exist.

- [ ] **Step 3: Implement the policy**

```ts
export type LumiRequestMode =
  | "create-trip" | "plan-trip" | "edit-trip" | "inspiration";

export interface LumiAuthorizationContext {
  mode: LumiRequestMode | null;
  tripId: string | null;
}

export type LumiCapability =
  | "read:context" | "read:places" | "read:esim"
  | "draft:stage-day" | "draft:finalize"
  | "trip:update-day" | "trip:create-day" | "trip:update-flight"
  | "trip:edit-companion" | "trip:edit-attachment";
```

Implement the exhaustive policy and authorization adapter:

```ts
export function authorizationForInput(input: {
  requestedSkill?: LumiRequestMode;
  editableTrip?: { trip_id: string };
}): LumiAuthorizationContext {
  return {
    mode: input.requestedSkill ?? null,
    tripId: input.editableTrip?.trip_id ?? null,
  };
}

export function capabilitiesForTurn(
  context: LumiAuthorizationContext,
): ReadonlySet<LumiCapability> {
  if ((context.mode === "plan-trip" || context.mode === "edit-trip") &&
      !context.tripId) {
    throw new Error(`${context.mode} requires an owned current trip`);
  }
  switch (context.mode) {
    case null:
      return new Set(["read:context", "read:places", "read:esim"]);
    case "inspiration":
      return new Set(["read:context", "read:places"]);
    case "create-trip":
      return new Set([
        "read:context", "read:places", "draft:stage-day", "draft:finalize",
      ]);
    case "plan-trip":
      return new Set([
        "read:context", "read:places", "trip:update-day", "trip:create-day",
      ]);
    case "edit-trip":
      return new Set([
        "read:context", "read:places", "trip:update-day", "trip:create-day",
        "trip:update-flight", "trip:edit-companion", "trip:edit-attachment",
      ]);
  }
}
```

Remove the `editableTrip => mutation skills` fallback from
`selectSkillIdsForTurn` and `buildLumiToolDefinitions`.

- [ ] **Step 4: Run GREEN and check the diff**

```bash
pnpm --filter @roam/api test -- src/lumi/capabilities.test.ts src/lumi/openai.test.ts
git diff --check -- services/api/src/lumi/capabilities.ts services/api/src/lumi/openai.ts
```

Expected: both commands exit 0; unscoped chat exposes no mutation tool.

---

### Task 2: Stable Snapshot And Command Contracts

**Files:**
- Create: `services/api/src/lumi/contracts/snapshot.ts`
- Create: `services/api/src/lumi/contracts/commands.ts`
- Create: `services/api/src/lumi/contracts/commands.test.ts`
- Modify: `services/api/src/routes/lumi.ts`

**Interfaces:**
- Produces `EditableTripSnapshot`, `EditableDaySnapshot`,
  `EditableStopSnapshot`, `lumiCommandSchema`, and `LumiCommand`.

- [ ] **Step 1: Write failing stable-ID tests**

```ts
test("requires day_id for an existing-day replacement", () => {
  expect(lumiCommandSchema.safeParse({
    type: "update_trip_day",
    day: { day_date: "2026-09-27", city: "Milan", note: "", stops: [] },
  }).success).toBe(false);
});

test("requires stop_id for an attachment mutation", () => {
  expect(lumiCommandSchema.safeParse({
    type: "upsert_stop_attachment",
    attachment: { type: "ticket", label: "Museum ticket" },
  }).success).toBe(false);
});
```

- [ ] **Step 2: Run RED**

```bash
pnpm --filter @roam/api test -- src/lumi/contracts/commands.test.ts
```

Expected: FAIL because the contract module does not exist.

- [ ] **Step 3: Add ID-rich snapshot types**

```ts
export interface EditableStopSnapshot extends LumiStop {
  stop_id: string;
}
export interface EditableDaySnapshot {
  day_id: string;
  day_date: string;
  city: string;
  cities: string[];
  note: string;
  stops: EditableStopSnapshot[];
}
export interface EditableTripSnapshot {
  trip_id: string;
  title: string;
  start_date: string;
  end_date: string;
  days: EditableDaySnapshot[];
  cities: LumiCity[];
  companions: LumiCompanion[];
}
```

- [ ] **Step 4: Add discriminated command schemas**

```ts
export const lumiCommandSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("update_trip_day"),
    day_id: z.string().uuid(),
    day: lumiDaySchema,
  }),
  z.object({
    type: z.literal("create_trip_day"),
    trip_id: z.string().uuid(),
    day: lumiDaySchema,
  }),
  z.object({
    type: z.literal("upsert_stop_attachment"),
    stop_id: z.string().uuid(),
    attachment: stopAttachmentSchema,
  }),
]);
export type LumiCommand = z.infer<typeof lumiCommandSchema>;
```

Define the referenced attachment schema in the same module:

```ts
export const stopAttachmentSchema = z.object({
  id: z.string().min(1).max(80).nullish(),
  type: z.string().min(1).max(40).default("ticket"),
  label: z.string().min(1).max(120),
  url: z.string().url().max(1200).nullish(),
  amount: z.string().max(80).nullish(),
  action_label: z.string().max(80).nullish(),
  checklist_text: z.string().max(500).nullish(),
  checklist_description: z.string().max(4000).nullish(),
  checklist_kind: z.string().max(40).nullish(),
  checklist_item_id: z.string().uuid().nullish(),
  status: z.enum(["required", "completed", "uploaded"]).default("required"),
});
```

- [ ] **Step 5: Return IDs from `loadEditableTrip`**

Add `trip_id: trip.tripId`, `day_id: day.id`, and `stop_id: stop.id` to
the loaded snapshot and serialize them into model context.

- [ ] **Step 6: Run GREEN**

```bash
pnpm --filter @roam/api test -- src/lumi/contracts/commands.test.ts src/routes/lumi.test.ts
```

Expected: PASS.

---

### Task 3: Capability-Gated Tool Definitions

**Files:**
- Modify: `services/api/src/lumi/openai.ts`
- Modify: `services/api/src/lumi/openai.test.ts`

**Interfaces:**
- Consumes capabilities and command schemas.
- Produces OpenAI tools requiring exact IDs.

- [ ] **Step 1: Add failing tool tests**

```ts
test("unscoped current-trip chat exposes no mutation tools", () => {
  const names = buildLumiToolDefinitions({
    prompt: "change the second day",
    editableTrip: editableTripSnapshot,
  }).map((tool) => tool.function.name);
  expect(names).not.toContain("update_trip_day");
  expect(names).not.toContain("create_trip_day");
  expect(names).not.toContain("upsert_stop_attachment");
});
```

Also assert `update_trip_day.parameters.required` contains `day_id` and
`upsert_stop_attachment.parameters.required` contains `stop_id`.

- [ ] **Step 2: Run RED**

```bash
pnpm --filter @roam/api test -- src/lumi/openai.test.ts
```

Expected: FAIL under the current editable-trip fallback/name-target design.

- [ ] **Step 3: Gate tools directly**

```ts
if (capabilities.has("trip:update-day")) tools.push(updateTripDayTool);
if (capabilities.has("trip:create-day")) tools.push(createTripDayTool);
if (capabilities.has("trip:edit-attachment")) {
  tools.push(upsertStopAttachmentTool);
}
if (capabilities.has("trip:update-flight")) tools.push(setFlightDetailsTool);
if (capabilities.has("draft:stage-day")) tools.push(stageTripDraftDaysTool);
```

Remove attachment edits from name-based incoming day payloads.

- [ ] **Step 4: Run GREEN**

```bash
pnpm --filter @roam/api test -- src/lumi/openai.test.ts
```

Expected: PASS.

---

### Task 4: Typed Command Validation And Collection

**Files:**
- Create: `services/api/src/lumi/validation/commands.ts`
- Create: `services/api/src/lumi/validation/commands.test.ts`
- Modify: `services/api/src/lumi/openai.ts`

**Interfaces:**
- Produces `validateLumiCommand(command, context)` with typed success/error.
- Consumes capabilities, exact snapshot, and `LumiCommand`.

- [ ] **Step 1: Write failing stale/cross-trip tests**

```ts
expect(validateLumiCommand(staleDayCommand, validationContext)).toEqual({
  ok: false,
  code: "invalid_reference",
  field: "day_id",
  message: "The day is not part of the authorized trip snapshot.",
});
expect(validateLumiCommand(crossTripStopCommand, validationContext).ok).toBe(false);
```

The stale command's date and display name must deliberately match a real day so
the test proves there is no fallback.

- [ ] **Step 2: Run RED**

```bash
pnpm --filter @roam/api test -- src/lumi/validation/commands.test.ts
```

Expected: FAIL because the validator does not exist.

- [ ] **Step 3: Implement validation**

```ts
export type LumiCommandValidation =
  | { ok: true; command: LumiCommand }
  | {
      ok: false;
      code: "unauthorized_command" | "invalid_reference";
      field: "type" | "trip_id" | "day_id" | "stop_id";
      message: string;
    };
```

Map command type to required capability, then test exact `trip_id`,
`day_id`, or `stop_id` membership in the authorized snapshot. Never accept
date or name equality as a substitute.

- [ ] **Step 4: Replace date-keyed mutation collection**

```ts
type LumiToolState = {
  acceptedCommands: LumiCommand[];
  draftDaysByDate: Map<string, LumiDay>;
  verifiedPlaceIds: Set<string>;
};
```

Expose accepted commands to the route without conflating them with the final
assistant payload:

```ts
export interface LumiResult {
  summary: string;
  commands?: LumiCommand[];
  trip_draft?: LumiTripDraft;
  esim_suggestion?: LumiEsimSuggestion;
  tool_call?: LumiAuditToolCall;
  tool_events?: LumiToolEvent[];
}
```

Parse, validate, and append only successful commands. Return structured tool
errors to the model on failure.

- [ ] **Step 5: Run GREEN**

```bash
pnpm --filter @roam/api test -- src/lumi/validation/commands.test.ts src/lumi/openai.test.ts
```

Expected: PASS.

---

### Task 5: Exact-ID Execution Services

**Files:**
- Create: `services/api/src/lumi/execution/itinerary.ts`
- Create: `services/api/src/lumi/execution/attachments.ts`
- Modify: `services/api/src/routes/lumi.ts`
- Modify: `services/api/src/routes/lumi.test.ts`

**Interfaces:**
- Produces `executeItineraryCommand`, `executeAttachmentCommand`, and
  `ExecutedLumiCommand`.
- Consumes only validated commands plus authenticated user/trip context.

- [ ] **Step 1: Write failing exact-target tests**

Create two stops named `Louvre Museum` and `Louvre Museum evening tour`.
Execute an attachment command for the second stop ID and assert only that ID is
updated. Execute a stale ID and assert neither changes.

- [ ] **Step 2: Run RED**

```bash
pnpm --filter @roam/api test -- src/routes/lumi.test.ts
```

Expected: FAIL because `applyAttachmentPatch` uses `findMatchingStop`.

- [ ] **Step 3: Execute itinerary commands by ID**

Define the common outcome first:

```ts
export type ExecutedLumiCommand =
  | { type: LumiCommand["type"]; status: "success"; target_id: string }
  | {
      type: LumiCommand["type"];
      status: "error";
      target_id: string;
      code: "invalid_reference" | "conflict" | "execution_failed";
    };
```

```ts
export async function executeItineraryCommand(
  command: Extract<LumiCommand, {
    type: "update_trip_day" | "create_trip_day";
  }>,
  context: { userId: string; tripId: string },
): Promise<ExecutedLumiCommand>;
```

Select an update target by both `trip_day.id` and its owned trip aggregate.
Use `day_date` only as replacement content and ordering data.

- [ ] **Step 4: Execute attachments by ID**

```ts
export async function executeAttachmentCommand(
  command: Extract<LumiCommand, { type: "upsert_stop_attachment" }>,
  context: { userId: string; tripId: string },
): Promise<ExecutedLumiCommand>;
```

Load the stop by exact ID under the owned trip. Delete `findMatchingStop`.
Attachment de-duplication may use attachment ID or an exact key only after the
stop has already been selected by ID.

- [ ] **Step 5: Execute only validated commands in the route**

```ts
const executionResults = await executeLumiCommands({
  commands: result.commands ?? [],
  userId: user.id,
  tripId: editableTrip?.trip_id ?? null,
});
```

Persist proposed commands and execution results separately in audit metadata.

- [ ] **Step 6: Run GREEN**

```bash
pnpm --filter @roam/api test -- src/routes/lumi.test.ts src/lumi/openai.test.ts
```

Expected: PASS with no partial-name target lookup.

---

### Task 6: Remove Prompt Reparsing And Fabricated Draft Recovery

**Files:**
- Modify: `services/api/src/lumi/openai.ts`
- Modify: `services/api/src/lumi/openai.test.ts`

**Interfaces:**
- Consumes structured staged draft days only.
- Produces a draft or explicit structured incomplete-draft error.

- [ ] **Step 1: Write the failing regression**

Mock a create-trip prompt containing `9/27`, `9/28`, and `9/29`, but
stage only `2026-09-27`. Assert the server does not manufacture the other two
days or notes from prompt slices; it must retry for structured data and then
fail explicitly when the retry budget is exhausted.

- [ ] **Step 2: Run RED**

```bash
pnpm --filter @roam/api test -- src/lumi/openai.test.ts
```

Expected: FAIL because `completeTripDraftPromptDates` fabricates content.

- [ ] **Step 3: Delete prompt-derived helpers**

Delete `tripDraftPromptCoverageIssue`, `completeTripDraftPromptDates`,
`extractPromptItineraryDates`, `extractPromptDatedSections`,
`promptDateAnchor`, and `isoDateForMonthDay`.

- [ ] **Step 4: Validate structured staged state**

```ts
function stagedDraftIssue(
  draft: LumiTripDraft | null | undefined,
  stagedDays: LumiDay[],
): string | null {
  if (!draft && stagedDays.length === 0) {
    return "No structured trip draft days were staged.";
  }
  const days = stagedDays.length > 0 ? stagedDays : draft?.days ?? [];
  return days.every(lumiDayHasDraftContent)
    ? null
    : "One or more structured trip draft days are empty.";
}
```

Return `incomplete_structured_draft` to the model during bounded retries and
throw after the final iteration. Do not pass `input.prompt` to validation.

- [ ] **Step 5: Run GREEN and audit**

```bash
pnpm --filter @roam/api test -- src/lumi/openai.test.ts
rg -n 'prompt\.(match|matchAll|includes|toLowerCase)|\.test\(.*prompt|findMatchingStop|completeTripDraftPromptDates' services/api/src/lumi services/api/src/routes/lumi.ts
```

Expected: tests pass; no heuristic prompt inspection or fuzzy entity matching.
Direct forwarding of `input.prompt` to the model user message is allowed.

---

### Task 7: Response Assembly From Executed Results

**Files:**
- Create: `services/api/src/lumi/response-assembly.ts`
- Create: `services/api/src/lumi/response-assembly.test.ts`
- Modify: `services/api/src/routes/lumi.ts`

**Interfaces:**
- Produces `assembleLumiResponse`.
- Consumes proposed response plus executed command outcomes.

- [ ] **Step 1: Write failing response-integrity test**

```ts
const result = assembleLumiResponse({
  proposedSummary: "Updated the museum ticket.",
  executions: [{
    type: "upsert_stop_attachment",
    target_id: stopId,
    status: "error",
    code: "invalid_reference",
  }],
});
expect(result.summary).toBe(
  "I couldn't apply that change because the trip changed. Reload and try again.",
);
expect(result.mutations).toEqual([]);
```

- [ ] **Step 2: Run RED**

```bash
pnpm --filter @roam/api test -- src/lumi/response-assembly.test.ts
```

Expected: FAIL because response assembly does not exist.

- [ ] **Step 3: Implement execution-backed assembly**

Expose successful mutation metadata only for `status: "success"`. When a
requested mutation fails, replace unsupported success prose with the stable
error summary and retain the structured error only in audit metadata.

- [ ] **Step 4: Run GREEN**

```bash
pnpm --filter @roam/api test -- src/lumi/response-assembly.test.ts src/routes/lumi.test.ts
```

Expected: PASS.

---

### Task 8: Split Provider, Prompt, Context, And Tool Loop

**Files:**
- Create: `services/api/src/lumi/provider/openai.ts`
- Create: `services/api/src/lumi/provider/tool-loop.ts`
- Create: `services/api/src/lumi/prompts.ts`
- Create: `services/api/src/lumi/context.ts`
- Modify: `services/api/src/lumi/openai.ts`
- Modify: `services/api/src/lumi/openai.test.ts`

**Interfaces:**
- Provider transport has no persistence imports.
- Tool loop consumes definitions, validators, and progress callbacks.
- Prompts consume mode/capabilities, never raw request classification.
- Context serializes exact IDs without authorizing tools.

- [ ] **Step 1: Write failing module-boundary tests**

```ts
expect(buildModePrompt({ mode: null })).toContain("read-only");
expect(buildModePrompt({ mode: "edit-trip" })).toContain("exact IDs");
expect(serializeLumiContext(snapshot)).toContain(snapshot.days[0]!.day_id);
expect(serializeLumiContext(snapshot)).toContain(
  snapshot.days[0]!.stops[0]!.stop_id,
);
```

- [ ] **Step 2: Run RED**

```bash
pnpm --filter @roam/api test -- src/lumi/openai.test.ts
```

Expected: FAIL because the focused modules do not exist.

- [ ] **Step 3: Move static prompts and structured context**

Move `SKILL_REGISTRY`, mode instructions, and loaded-skill formatting to
`prompts.ts`. Move page/snapshot serialization to `context.ts`. Neither
module receives the raw prompt for matching.

- [ ] **Step 4: Move transport and iteration**

Move OpenAI HTTP/stream parsing to `provider/openai.ts`. Move bounded
tool-call dispatch, validation-error feedback, and retry limits to
`provider/tool-loop.ts`. Keep domain validation and persistence outside both.

- [ ] **Step 5: Reduce the compatibility entry point**

```ts
export async function runLumiTurn(input: LumiInput): Promise<LumiResult> {
  const authorization = authorizationForInput(input);
  const capabilities = capabilitiesForTurn(authorization);
  const snapshot = input.editableTrip ?? null;
  return runOpenAiToolLoop({
    prompt: input.prompt,
    history: input.history ?? [],
    capabilities,
    snapshot,
    modelContext: serializeLumiContext({ snapshot, page: input.context }),
    onProgress: input.onProgress,
  });
}
```

- [ ] **Step 6: Run GREEN**

```bash
pnpm --filter @roam/api test
pnpm --filter @roam/api typecheck
```

Expected: both exit 0.

---

### Task 9: Document And Verify

**Files:**
- Modify: `docs/ARCHITECTURE.md`
- Verify: all files changed above

**Interfaces:**
- Produces project documentation and fresh verification evidence.

- [ ] **Step 1: Document the boundary**

```md
## Lumi Agent Boundary

Lumi receives natural language only at the model-provider boundary. Structured
`requested_skill` mode and owned resource context determine which tools are
available; free-form chat is read-only. Model commands reference existing trip
entities by stable IDs, pass through authorization/reference/domain validation,
and are executed by domain services. Routes and executors must not infer intent
or mutation targets from prompt text, display names, or substring matching.
```

- [ ] **Step 2: Run the forbidden-pattern audit**

```bash
rg -n 'prompt\.(match|matchAll|includes|toLowerCase)|\.test\(.*prompt|findMatchingStop|extractPromptDatedSections|completeTripDraftPromptDates' services/api/src/lumi services/api/src/routes/lumi.ts
```

Expected: no heuristic inspection matches.

- [ ] **Step 3: Run fresh API verification**

```bash
pnpm --filter @roam/api typecheck
pnpm --filter @roam/api test
pnpm verify:api
```

Expected: all commands exit 0 with zero test failures.

- [ ] **Step 4: Inspect without staging**

```bash
git diff --check
git status --short
```

Expected: `git diff --check` exits 0; status contains the pre-existing user
changes plus only scoped Lumi architecture files. Do not stage or commit.
