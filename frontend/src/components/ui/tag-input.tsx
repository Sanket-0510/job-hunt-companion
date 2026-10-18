"use client";

import { useId, useState } from "react";

import { cn } from "@/lib/utils";

/**
 * Chips with × plus a text box: Enter or comma adds, Backspace on an empty box removes the
 * last chip (Figma tag field). `starFirst` marks the first chip, e.g. the preferred city.
 */
export function TagInput({
  label,
  values,
  onChange,
  placeholder,
  helper,
  starFirst,
  max = 50,
}: {
  label: string;
  values: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  helper?: string;
  starFirst?: boolean;
  max?: number;
}) {
  const id = useId();
  const [draft, setDraft] = useState("");

  function add(raw: string) {
    const next = raw
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean)
      .filter((v) => !values.some((x) => x.toLowerCase() === v.toLowerCase()));
    if (next.length) onChange([...values, ...next].slice(0, max));
    setDraft("");
  }

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[13px] font-medium text-ink">
        {label}
      </label>
      <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-line bg-card p-2 focus-within:border-ink">
        {values.map((v, i) => {
          const starred = starFirst && i === 0;
          return (
            <span
              key={v}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[13px] font-medium text-ink",
                starred ? "border border-ink bg-card" : "bg-chip",
              )}
            >
              {starred && <span aria-label="Preferred">★</span>}
              {v}
              <button
                type="button"
                aria-label={`Remove ${v}`}
                onClick={() => onChange(values.filter((_, j) => j !== i))}
                className="text-ink-muted hover:text-ink"
              >
                ×
              </button>
            </span>
          );
        })}
        <input
          id={id}
          value={draft}
          placeholder={placeholder}
          aria-describedby={helper ? `${id}-help` : undefined}
          onChange={(e) => (e.target.value.includes(",") ? add(e.target.value) : setDraft(e.target.value))}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add(draft);
            } else if (e.key === "Backspace" && !draft && values.length) {
              onChange(values.slice(0, -1));
            }
          }}
          onBlur={() => draft && add(draft)}
          className="h-7 min-w-[120px] flex-1 bg-transparent px-1 text-sm text-ink outline-none placeholder:text-faint"
        />
      </div>
      {helper && (
        <p id={`${id}-help`} className="text-xs text-ink-muted">
          {helper}
        </p>
      )}
    </div>
  );
}
