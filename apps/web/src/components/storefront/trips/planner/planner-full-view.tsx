"use client";

// D-2, the second half: one item at a time, expanded to the fields its own
// type actually has. The compact sheet stays universal; everything
// type-specific lives here.

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import {
  COMPACT_SHEET_FIELDS,
  TYPE_SPECIFIC_FIELDS,
  type PlannerItem,
  type TicketState,
} from "./planner-model";
import {
  fill,
  type PlannerFieldLabels,
  type PlannerLabels,
} from "./planner-labels";

export interface PlannerItemDraft {
  title: string;
  date: string;
  startTime: string;
  durationMin: number;
  ticket: { state: TicketState; label: string };
  fields: Record<string, string>;
}

export function draftFromItem(item: PlannerItem): PlannerItemDraft {
  return {
    title: item.title,
    date: item.date,
    startTime: item.startTime,
    durationMin: item.durationMin,
    ticket: { ...item.ticket },
    fields: { ...(item.fields as unknown as Record<string, string>) },
  };
}

const TICKET_STATES: TicketState[] = ["missing", "needed", "attached"];

export function PlannerFullView({
  item,
  labels,
  onSave,
  onClose,
}: {
  item: PlannerItem;
  labels: PlannerLabels;
  onSave: (draft: PlannerItemDraft) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<PlannerItemDraft>(() => draftFromItem(item));
  const [saved, setSaved] = useState(false);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (savedTimer.current) clearTimeout(savedTimer.current);
    },
    [],
  );

  const typeFields = useMemo(
    () => TYPE_SPECIFIC_FIELDS[item.type],
    [item.type],
  );

  const ticketLabel = (state: TicketState): string => labels.ticket[state];

  function commit() {
    onSave(draft);
    setSaved(true);
    if (savedTimer.current) clearTimeout(savedTimer.current);
    savedTimer.current = setTimeout(() => setSaved(false), 2400);
  }

  return (
    <div
      className="planner-full-view"
      role="dialog"
      aria-modal="true"
      aria-label={labels.item.full_title}
      data-testid="planner-full-view"
      data-item-type={item.type}
    >
      <header className="planner-chrome planner-full-view__bar">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="-ml-2 h-9 gap-1 rounded-full px-2 text-[13px]"
          onClick={onClose}
          data-testid="planner-full-view-back"
        >
          <ChevronLeft className="h-4 w-4" />
          {labels.item.back}
        </Button>
        <span className="planner-full-view__type">
          {labels.item.types[item.type]}
        </span>
      </header>

      <div className="planner-full-view__body">
        <h1
          className="planner-full-view__title"
          data-testid="planner-full-view-title"
        >
          {draft.title}
        </h1>

        {/* Universal core — the same four rows the compact sheet shows. */}
        <section className="planner-field-group" aria-label={labels.sheet.region}>
          <FieldRow
            field="date"
            label={labels.item.date}
            value={draft.date}
            type="date"
            onChange={(value) => setDraft((prev) => ({ ...prev, date: value }))}
          />
          <FieldRow
            field="startTime"
            label={labels.item.start_time}
            value={draft.startTime}
            type="time"
            onChange={(value) =>
              setDraft((prev) => ({ ...prev, startTime: value }))
            }
          />
          <FieldRow
            field="durationMin"
            label={labels.item.duration}
            value={String(draft.durationMin)}
            type="number"
            onChange={(value) =>
              setDraft((prev) => ({
                ...prev,
                durationMin: Number.parseInt(value, 10) || 0,
              }))
            }
          />

          <div className="planner-field" data-field="ticket">
            <Label
              className="planner-field__label"
              htmlFor="planner-ticket-state"
            >
              {labels.ticket.title}
            </Label>
            <div className="flex flex-col gap-2">
              <Select
                value={draft.ticket.state}
                onValueChange={(value) =>
                  setDraft((prev) => ({
                    ...prev,
                    ticket: { ...prev.ticket, state: value as TicketState },
                  }))
                }
              >
                <SelectTrigger
                  id="planner-ticket-state"
                  className="h-10 w-full rounded-xl"
                  aria-label={labels.ticket.state_label}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TICKET_STATES.map((state) => (
                    <SelectItem key={state} value={state}>
                      {ticketLabel(state)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                className="h-10 rounded-xl"
                value={draft.ticket.label}
                aria-label={labels.ticket.title}
                data-testid="planner-field-ticketLabel"
                onChange={(event) =>
                  setDraft((prev) => ({
                    ...prev,
                    ticket: { ...prev.ticket, label: event.target.value },
                  }))
                }
              />
            </div>
          </div>
        </section>

        {/* Type-specific — the only place these fields exist. */}
        <section
          className="planner-field-group"
          aria-label={fill(labels.item.type_section, {
            type: labels.item.types[item.type],
          })}
          data-testid="planner-type-fields"
        >
          <h2 className="planner-field-group__heading">
            {fill(labels.item.type_section, {
              type: labels.item.types[item.type],
            })}
          </h2>
          {typeFields.map((field) => (
            <FieldRow
              key={field}
              field={field}
              label={labels.fields[field as keyof PlannerFieldLabels]}
              value={draft.fields[field] ?? ""}
              onChange={(value) =>
                setDraft((prev) => ({
                  ...prev,
                  fields: { ...prev.fields, [field]: value },
                }))
              }
            />
          ))}
        </section>

        <div className="planner-full-view__actions">
          <Button
            type="button"
            className="h-11 flex-1 rounded-full"
            onClick={commit}
            data-testid="planner-save"
          >
            {labels.item.save}
          </Button>
          <span
            className="planner-full-view__saved"
            data-testid="planner-saved"
            role="status"
            aria-live="polite"
          >
            {saved ? labels.item.saved : ""}
          </span>
        </div>
      </div>
    </div>
  );
}

function FieldRow({
  field,
  label,
  value,
  type = "text",
  onChange,
}: {
  field: string;
  label: string;
  value: string;
  type?: string;
  onChange: (value: string) => void;
}) {
  const id = `planner-field-${field}`;
  return (
    <div className="planner-field" data-field={field}>
      <Label className="planner-field__label" htmlFor={id}>
        {label}
      </Label>
      <Input
        id={id}
        type={type}
        className="h-10 rounded-xl"
        value={value}
        data-testid={`planner-field-${field}`}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}

/** Exported for the render-order assertions in the e2e suite. */
export const FULL_VIEW_COMPACT_FIELDS = COMPACT_SHEET_FIELDS;
