"use client";

// Drop-in replacement for `<select name="…" defaultValue="…">` that
// renders a shadcn Select but still posts the value via the parent
// `<form>` (using a hidden input). Empty values are mapped to a
// sentinel because Radix Select disallows "" as an item value.

import * as React from "react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const NONE = "__none";

export interface FormSelectOption {
  label: string;
  value: string;
}

export interface FormSelectProps {
  name?: string;
  defaultValue?: string;
  value?: string;
  onValueChange?: (v: string) => void;
  options: FormSelectOption[];
  placeholder?: string;
  className?: string;
  triggerClassName?: string;
  ariaLabel?: string;
  disabled?: boolean;
  required?: boolean;
}

export function FormSelect({
  name,
  defaultValue,
  value: controlled,
  onValueChange,
  options,
  placeholder,
  className,
  triggerClassName,
  ariaLabel,
  disabled,
  required,
}: FormSelectProps) {
  const isControlled = controlled !== undefined;
  const [uncontrolled, setUncontrolled] = React.useState(defaultValue ?? "");
  const value = isControlled ? controlled : uncontrolled;
  const setValue = (v: string) => {
    if (!isControlled) setUncontrolled(v);
    onValueChange?.(v);
  };

  const display = value === "" ? NONE : value;
  return (
    <div className={className}>
      {name ? <input type="hidden" name={name} value={value} required={required} /> : null}
      <Select
        value={display}
        onValueChange={(v) => setValue(v === NONE ? "" : v)}
        disabled={disabled}
      >
        <SelectTrigger
          aria-label={ariaLabel}
          className={triggerClassName ?? "w-full"}
        >
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value || NONE} value={o.value || NONE}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
