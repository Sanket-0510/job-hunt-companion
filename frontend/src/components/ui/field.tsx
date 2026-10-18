import { useId } from "react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type FieldProps = React.ComponentProps<"input"> & {
  label: string;
  error?: string;
  helper?: string;
};

/** Label + input + helper or error text under it (Figma "Field"). */
export function Field({ label, error, helper, className, id, ...props }: FieldProps) {
  const auto = useId();
  const inputId = id ?? auto;
  const noteId = `${inputId}-note`;
  return (
    <div className={cn("flex w-full flex-col gap-1.5", className)}>
      <label htmlFor={inputId} className="text-[13px] font-medium text-ink">
        {label}
      </label>
      <Input
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={error || helper ? noteId : undefined}
        className="text-ink aria-invalid:border-destructive aria-invalid:ring-0"
        {...props}
      />
      {(error || helper) && (
        <p id={noteId} className={cn("text-xs", error ? "text-destructive" : "text-ink-muted")}>
          {error ?? helper}
        </p>
      )}
    </div>
  );
}
