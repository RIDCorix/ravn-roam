export interface ChecklistSubtaskDraft {
  text: string;
  done: boolean;
}

export function fallbackChecklistKind(type: string): string {
  if (type === "airport_transfer") return "transit";
  if (type === "reservation") return "stay";
  if (type === "booking" || type === "flight") return "flight";
  if (type === "upload" || type === "document") return "doc";
  if (type === "transit") return "transit";
  return "ticket";
}

export function checklistSubtasksFromDescription(
  description: string | null | undefined,
): ChecklistSubtaskDraft[] {
  if (!description) return [];
  return description
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith("- ") || line.startsWith("* "))
    .map((line) => ({ text: line.slice(2).trim(), done: false }))
    .filter((item) => item.text);
}
