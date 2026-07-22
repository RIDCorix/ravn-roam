import { lumiCommandTarget, type CorrelatedLumiCommand, type LumiCommand } from "../contracts/commands.js";
import { executeAttachmentCommand } from "./attachments.js";
import { executeItineraryCommand, type ExecutedLumiCommand } from "./itinerary.js";
import { executeTripDetailCommand } from "./trip-details.js";

type Context = { userId: string; tripId: string };
type Executors = {
  executeItinerary: (command: Extract<LumiCommand, { type: "update_trip_day" | "create_trip_day" }>, context: Context) => Promise<ExecutedLumiCommand>;
  executeAttachment: (command: Extract<LumiCommand, { type: "upsert_stop_attachment" }>, context: Context) => Promise<ExecutedLumiCommand>;
  executeTripDetail: (command: Exclude<LumiCommand, { type: "update_trip_day" | "create_trip_day" | "upsert_stop_attachment" }>, context: Context) => Promise<ExecutedLumiCommand>;
};

const defaultExecutors: Executors = {
  executeItinerary: executeItineraryCommand,
  executeAttachment: executeAttachmentCommand,
  executeTripDetail: executeTripDetailCommand,
};

export async function executeLumiCommands({ commands, userId, tripId, executors = defaultExecutors }: {
  commands: readonly CorrelatedLumiCommand[];
  userId: string;
  tripId: string | null;
  executors?: Partial<Executors>;
}): Promise<ExecutedLumiCommand[]> {
  const active = { ...defaultExecutors, ...executors };
  if (!tripId) return commands.map((command) => ({
    type: command.type,
    status: "error" as const,
    target_id: lumiCommandTarget(command),
    code: "invalid_reference" as const,
  }));
  const context = { userId, tripId };
  const indexed = commands.map((command, index) => ({ command, index }));
  const priority = (command: LumiCommand) => command.type === "upsert_stop_attachment" ? 2 : 1;
  indexed.sort((a, b) => priority(a.command) - priority(b.command));
  const outcomes: ExecutedLumiCommand[] = new Array(commands.length);
  for (const { command, index } of indexed) {
    const outcome = command.type === "update_trip_day" || command.type === "create_trip_day"
      ? await active.executeItinerary(command, context)
      : command.type === "upsert_stop_attachment"
        ? await active.executeAttachment(command, context)
        : await active.executeTripDetail(command, context);
    outcomes[index] = { ...outcome, attempt_id: command.attempt_id };
  }
  return outcomes;
}
