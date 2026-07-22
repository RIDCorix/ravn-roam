"use client";

import { Pencil } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Input } from "@/components/ui/input";

export function TripTitleEditor({
  title,
  editLabel,
  saveErrorLabel,
  saveError,
  onRename,
}: {
  title: string;
  editLabel: string;
  saveErrorLabel: string;
  saveError: boolean;
  onRename: (title: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const currentTitleRef = useRef(title);
  const [currentTitle, setCurrentTitle] = useState(title);
  const [value, setValue] = useState(title);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (!editing) return;
    inputRef.current?.focus();
    inputRef.current?.select();
  }, [editing]);

  function saveTitle() {
    const nextTitle = value.trim();
    if (!nextTitle) {
      setValue(currentTitleRef.current);
      setEditing(false);
      return;
    }
    if (nextTitle === currentTitleRef.current) {
      setEditing(false);
      return;
    }
    currentTitleRef.current = nextTitle;
    setCurrentTitle(nextTitle);
    setValue(nextTitle);
    setEditing(false);
    onRename(nextTitle);
  }

  if (editing) {
    return (
      <form
        className="mt-1 max-w-[680px]"
        onSubmit={(event) => {
          event.preventDefault();
          saveTitle();
        }}
      >
        <Input
          ref={inputRef}
          value={value}
          maxLength={200}
          aria-label={editLabel}
          onChange={(event) => setValue(event.target.value)}
          onBlur={saveTitle}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              setValue(currentTitleRef.current);
              setEditing(false);
            }
          }}
          className="h-[52px] rounded-2xl border-white/80 bg-white/86 px-4 text-[26px] font-semibold tracking-normal text-fg shadow-sm backdrop-blur focus-visible:ring-accent/30 sm:h-14 sm:text-[34px]"
        />
        {saveError ? (
          <p className="mt-2 text-[12px] font-semibold text-destructive">
            {saveErrorLabel}
          </p>
        ) : null}
      </form>
    );
  }

  return (
    <div className="mt-1 min-w-0">
      <button
        type="button"
        aria-label={editLabel}
        onClick={() => setEditing(true)}
        className="group inline-flex max-w-full items-start gap-2 rounded-2xl pr-2 text-left transition-colors hover:bg-white/62 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30"
      >
        <h1 className="line-clamp-2 text-[30px] font-semibold leading-tight tracking-normal text-fg sm:text-[42px]">
          {currentTitle}
        </h1>
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/80 text-fg-muted opacity-75 shadow-sm transition group-hover:text-accent group-hover:opacity-100">
          <Pencil className="h-4 w-4" />
        </span>
      </button>
      {saveError ? (
        <p className="mt-2 text-[12px] font-semibold text-destructive">
          {saveErrorLabel}
        </p>
      ) : null}
    </div>
  );
}
