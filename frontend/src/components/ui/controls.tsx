"use client";

import { useId, useRef } from "react";

import { TONE_CLASSES, type Tone, longDate, shortDate } from "@/lib/format";
import { cn } from "@/lib/utils";

/** A Figma SVG icon drawn with the current text colour (mask), so tones can recolour it. */
export function Icon({ name, size = 16, className }: { name: string; size?: number; className?: string }) {
  const url = `url(/icons/${name}.svg) center / contain no-repeat`;
  return (
    <span
      aria-hidden
      className={cn("inline-block shrink-0 bg-current", className)}
      style={{ width: size, height: size, mask: url, WebkitMask: url }}
    />
  );
}

function SmallLabel({ htmlFor, children }: { htmlFor: string; children: React.ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="text-xs font-medium text-ink-muted">
      {children}
    </label>
  );
}

type Option<T extends string> = { value: T; label: string };

/** Native select styled as the Figma Select (40px, tinted by tone). Native keeps phones happy. */
export function SelectField<T extends string>({
  label,
  hideLabel,
  value,
  options,
  onChange,
  tone = "neutral",
  className,
  disabled,
}: {
  label: string;
  hideLabel?: boolean;
  value: T;
  options: Option<T>[];
  onChange: (value: T) => void;
  tone?: Tone;
  className?: string;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <div className={cn("flex min-w-0 flex-col gap-1", className)}>
      {hideLabel ? null : <SmallLabel htmlFor={id}>{label}</SmallLabel>}
      <div className={cn("relative flex h-10 items-center rounded-lg border", TONE_CLASSES[tone])}>
        <select
          id={id}
          aria-label={hideLabel ? label : undefined}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value as T)}
          className="h-full w-full cursor-pointer appearance-none truncate rounded-lg bg-transparent pr-8 pl-2.5 text-sm font-medium outline-offset-2"
        >
          {options.map((o) => (
            <option key={o.value} value={o.value} className="text-ink">
              {o.label}
            </option>
          ))}
        </select>
        <Icon name="chevron-down" className="pointer-events-none absolute right-2.5" />
      </div>
    </div>
  );
}

/** Date field: shows "12 Oct 2026" in Plex Mono and opens the native picker (which has Clear). */
export function DateField({
  label,
  value,
  onChange,
  due,
  suffix,
  className,
}: {
  label: string;
  value: string | null | undefined;
  onChange: (value: string | null) => void;
  due?: boolean;
  suffix?: string;
  className?: string;
}) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  return (
    <div className={cn("flex min-w-0 flex-col gap-1", className)}>
      <SmallLabel htmlFor={id}>{label}</SmallLabel>
      <div
        className={cn(
          "relative flex h-10 items-center gap-2 rounded-lg border px-2.5",
          due ? "border-due bg-due-tint text-due" : "border-line bg-white text-ink",
        )}
      >
        <Icon name="calendar" className={due ? "text-due" : "text-ink-muted"} />
        <span className={cn("flex-1 truncate font-mono text-[13px]", due && "font-medium")}>
          {/* With a suffix ("due") the year is dropped so it fits, as in Figma: "17 Oct · due". */}
          {value ? (suffix ? `${shortDate(value)} · ${suffix}` : longDate(value)) : "—"}
        </span>
        <input
          ref={input}
          id={id}
          type="date"
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value || null)}
          onClick={() => input.current?.showPicker?.()}
          className="absolute inset-0 cursor-pointer opacity-0"
        />
      </div>
    </div>
  );
}

/** 18px checkbox with label (Figma Checkbox). */
export function CheckboxField({
  label,
  checked,
  onChange,
  title,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  title?: string;
}) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-ink" title={title}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="size-[18px] cursor-pointer rounded-[4px] border-[1.5px] border-[#9aa4ae] accent-ink"
      />
      {label}
    </label>
  );
}

/** Text input that saves when you leave it (or press Enter): the card autosave rule. */
export function AutosaveInput({
  label,
  value,
  onSave,
  placeholder,
  type = "text",
  multiline,
  className,
}: {
  label: string;
  value: string | null | undefined;
  onSave: (value: string | null) => void;
  placeholder?: string;
  type?: "text" | "url";
  multiline?: boolean;
  className?: string;
}) {
  const id = useId();
  const commit = (raw: string) => {
    const next = raw.trim() || null;
    if (next !== (value ?? null)) onSave(next);
  };
  const shared = {
    id,
    defaultValue: value ?? "",
    placeholder,
    onBlur: (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => commit(e.target.value),
    className:
      "w-full rounded-lg border border-line bg-white px-3 text-sm text-ink placeholder:text-[#6b7785] outline-offset-2",
  };
  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      <label htmlFor={id} className="text-[13px] font-medium text-ink">
        {label}
      </label>
      {multiline ? (
        // key: show the server value again after a save, but keep the user's text if it failed.
        <textarea key={value ?? ""} {...shared} rows={2} className={cn(shared.className, "min-h-11 py-2.5")} />
      ) : (
        <input
          key={value ?? ""}
          {...shared}
          type={type}
          onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
          className={cn(shared.className, "h-11")}
        />
      )}
    </div>
  );
}
