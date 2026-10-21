"use client";

import { DIRECT_LABELS, REFERRAL_LABELS } from "@/lib/format";
import type { JobFilters } from "@/lib/jobs";
import type { PipelineCounts as Counts } from "@/lib/queries";
import { cn } from "@/lib/utils";

type FilterKey = "all" | `d:${string}` | `r:${string}` | "due" | "reversed";

/** Which count tile matches the current filters (it gets the dark outline). */
function activeKey(f: JobFilters): FilterKey | null {
  if (f.direct_status) return `d:${f.direct_status}`;
  if (f.referral_status) return `r:${f.referral_status}`;
  if (f.due) return "due";
  if (f.emails_reversed) return "reversed";
  return "all";
}

function Count({
  number,
  label,
  active,
  due,
  track,
  onClick,
}: {
  number: number;
  label: string;
  active: boolean;
  due?: boolean;
  /** Stage counts are drawn as weighted segments in their track colour; others stay neutral chips. */
  track?: "direct" | "referral";
  onClick: () => void;
}) {
  const tone = track
    ? active
      ? track === "direct"
        ? "bg-direct text-white"
        : "bg-referral text-white"
      : track === "direct"
        ? "bg-direct-tint text-direct"
        : "bg-referral-tint text-referral"
    : active
      ? "bg-ink text-page"
      : "bg-chip text-ink";
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      style={track ? { flexGrow: Math.max(number, 1) } : undefined}
      className={cn(
        "press flex min-h-14 min-w-[84px] shrink-0 flex-col items-start justify-center gap-0.5 rounded-xl px-3.5 py-2 text-left",
        "transition-[transform,box-shadow,opacity] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)]",
        tone,
        active && "-translate-y-1 shadow-[0_10px_24px_rgba(23,33,43,0.2)]",
      )}
    >
      <span
        className={cn(
          "font-heading text-[22px] leading-tight font-bold tabular-nums",
          due && number > 0 && !active && "text-due",
        )}
      >
        {number}
      </span>
      <span className="text-xs font-medium whitespace-nowrap opacity-90">{label}</span>
    </button>
  );
}

function Row({
  track,
  email,
  children,
}: {
  track: "direct" | "referral";
  email: string | null | undefined;
  children: React.ReactNode;
}) {
  const color = track === "direct" ? "text-direct" : "text-referral";
  return (
    <div className="flex flex-col gap-2 md:flex-row md:gap-6">
      <div className={cn("flex shrink-0 flex-col gap-0.5 md:w-[170px] md:pt-1", color)}>
        <span className="text-[13px] font-semibold">{track === "direct" ? "Direct apply" : "Referral"}</span>
        <span className="truncate font-mono text-[11px]">{email ?? "No email set"}</span>
      </div>
      {/* Chips wrap onto new lines on every screen size; nothing scrolls sideways. */}
      <div className="flex flex-wrap gap-2">
        {children}
      </div>
    </div>
  );
}

/** Two rows of counts, one per track; each count is a filter (tap again to clear). */
export function PipelineCounts({
  counts,
  filters,
  directEmail,
  referralEmail,
  onFilter,
}: {
  counts: Counts;
  filters: JobFilters;
  directEmail?: string | null;
  referralEmail?: string | null;
  onFilter: (patch: Partial<JobFilters>) => void;
}) {
  const active = activeKey(filters);
  const cleared = { direct_status: undefined, referral_status: undefined, due: undefined, emails_reversed: undefined };
  const toggle = (key: FilterKey, patch: Partial<JobFilters>) =>
    onFilter(active === key ? cleared : { ...cleared, ...patch });

  return (
    <section aria-label="Pipeline counts" className="flex flex-col gap-3.5 rounded-xl border border-line bg-card p-3.5 md:p-5">
      <Row track="direct" email={directEmail}>
        <Count number={counts.all_jobs} label="All jobs" active={active === "all"} onClick={() => onFilter(cleared)} />
        {(Object.keys(DIRECT_LABELS) as (keyof typeof DIRECT_LABELS)[]).map((s) => (
          <Count
            key={s}
            number={counts.direct[s] ?? 0}
            label={DIRECT_LABELS[s]}
            active={active === `d:${s}`}
            track="direct"
            onClick={() => toggle(`d:${s}`, { direct_status: s })}
          />
        ))}
        <Count
          number={counts.follow_up_due}
          label="Follow-up due"
          due
          active={active === "due"}
          onClick={() => toggle("due", { due: true })}
        />
        <Count
          number={counts.emails_reversed}
          label="Emails reversed"
          active={active === "reversed"}
          onClick={() => toggle("reversed", { emails_reversed: true })}
        />
      </Row>
      <hr className="border-line" />
      <Row track="referral" email={referralEmail}>
        {(Object.keys(REFERRAL_LABELS) as (keyof typeof REFERRAL_LABELS)[]).map((s) => (
          <Count
            key={s}
            number={counts.referral[s] ?? 0}
            label={REFERRAL_LABELS[s]}
            active={active === `r:${s}`}
            track="referral"
            onClick={() => toggle(`r:${s}`, { referral_status: s })}
          />
        ))}
      </Row>
    </section>
  );
}
