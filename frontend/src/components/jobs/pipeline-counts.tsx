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
  onClick,
}: {
  number: number;
  label: string;
  active: boolean;
  due?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "flex min-w-[76px] shrink-0 flex-col items-start gap-0.5 rounded-lg border bg-white px-3 py-2 text-left",
        active ? "border-2 border-ink px-[11px] py-[7px]" : "border-line hover:border-ink-muted",
      )}
    >
      <span className={cn("font-heading text-[22px] leading-tight font-bold", due && number > 0 ? "text-due" : "text-ink")}>
        {number}
      </span>
      <span className="font-mono text-[11px] tracking-[0.05em] whitespace-nowrap text-ink-muted uppercase">{label}</span>
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
      {/* Phones: one row that scrolls sideways. Desktop: wraps. */}
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] md:mx-0 md:flex-wrap md:overflow-visible md:px-0 md:pb-0">
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
    <section aria-label="Pipeline counts" className="flex flex-col gap-3.5 rounded-xl border border-line bg-white p-3.5 md:p-5">
      <Row track="direct" email={directEmail}>
        <Count number={counts.all_jobs} label="All jobs" active={active === "all"} onClick={() => onFilter(cleared)} />
        {(Object.keys(DIRECT_LABELS) as (keyof typeof DIRECT_LABELS)[]).map((s) => (
          <Count
            key={s}
            number={counts.direct[s] ?? 0}
            label={DIRECT_LABELS[s]}
            active={active === `d:${s}`}
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
            onClick={() => toggle(`r:${s}`, { referral_status: s })}
          />
        ))}
      </Row>
    </section>
  );
}
