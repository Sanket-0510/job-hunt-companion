"use client";

import Link from "next/link";

import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toaster";
import { copyText } from "@/lib/clipboard";
import {
  DIRECT_LABELS,
  REFERRAL_LABELS,
  STAGE_LABELS,
  STAGE_STYLES,
  daysAgo,
  shortDate,
} from "@/lib/format";
import { ApiError } from "@/lib/api";
import {
  type DueItem,
  type Job,
  type PipelineCounts,
  useAddSuggestion,
  useDismissSuggestion,
  useRefreshSuggestions,
  useSnooze,
  useSuggestions,
} from "@/lib/queries";
import { cn } from "@/lib/utils";

function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <section className={cn("overflow-hidden rounded-xl border border-line bg-card", className)}>
      {children}
    </section>
  );
}

function CardHeader({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2.5 px-4 pt-4 pb-3">
      <h2 className="text-lg font-semibold text-ink">{title}</h2>
      {children}
    </div>
  );
}

export function TrackBadge({ track }: { track: "direct" | "referral" }) {
  return (
    <span
      className={cn(
        "rounded-md px-2 py-0.5 text-xs font-semibold",
        track === "referral" ? "bg-referral-tint text-referral" : "bg-direct-tint text-direct",
      )}
    >
      {track === "referral" ? "Referral" : "Direct apply"}
    </span>
  );
}

function waitingText(item: DueItem): string {
  const when = daysAgo(item.days_waiting);
  if (item.waiting_track === "referral") {
    const who = item.job.referral_contact;
    return who ? `Asked ${who} ${when}` : `Asked ${when}`;
  }
  return item.waiting_since ? `Applied ${when}` : "Follow-up due";
}

function DueRow({ item, index }: { item: DueItem; index: number }) {
  const snooze = useSnooze();
  const { job } = item;
  return (
    <div
      className="enter-up flex flex-col gap-2.5 border-t border-line px-5 py-4"
      style={{ animationDelay: `${Math.min(index, 6) * 70}ms` }}
    >
      <p className="flex min-w-0 items-baseline gap-1.5">
        <span className="max-w-[60%] shrink-0 truncate text-base font-semibold text-ink">{job.company}</span>
        <span className="truncate text-sm text-ink-muted">{job.role}</span>
      </p>
      <p className="flex items-center gap-2 text-[13px] text-ink">
        <TrackBadge track={item.waiting_track === "referral" ? "referral" : "direct"} />
        {waitingText(item)}
      </p>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={() => copyText(job.messages.follow_up.text)}>
          Copy follow-up
        </Button>
        <Button
          variant="ghost"
          size="sm"
          disabled={snooze.isPending}
          onClick={() =>
            snooze.mutate(job.id, {
              onSuccess: () => toast(`Snoozed ${job.company} for 3 days`),
              onError: () => toast("Couldn't snooze that. Try again.", "error"),
            })
          }
        >
          Snooze 3 days
        </Button>
      </div>
    </div>
  );
}

/** The memorable element of the dashboard: the count of follow-ups due, large, with the list under it. */
export function DueTodayCard({ items }: { items: DueItem[] }) {
  return (
    <Card>
      <div className="flex items-end gap-5 px-5 pt-6 pb-5">
        <span
          aria-hidden
          className={cn(
            "font-heading text-[72px] leading-[0.9] font-bold tracking-[-0.04em] tabular-nums md:text-[88px]",
            items.length > 0 ? "text-due" : "text-ink-muted",
          )}
        >
          {items.length}
        </span>
        <div className="flex flex-col gap-1 pb-1">
          <h2 className="text-2xl font-semibold text-ink md:text-[28px]">Due today</h2>
          <p className="text-sm text-ink-muted">
            {items.length > 0 ? "Oldest first. Copy the follow-up or snooze it." : "You are clear for today."}
          </p>
        </div>
      </div>
      {items.length === 0 ? (
        <p className="border-t border-line px-5 py-5 text-sm text-ink-muted">
          Nothing due. Nice. Snoozed follow-ups come back in three days.
        </p>
      ) : (
        items.map((item, i) => <DueRow key={item.job.id} item={item} index={i} />)
      )}
    </Card>
  );
}

function CountChip({ count, label, href, due }: { count: number; label: string; href: string; due?: boolean }) {
  const orange = due && count > 0;
  return (
    <Link
      href={href}
      className={cn(
        "flex items-baseline gap-1.5 rounded-lg px-2.5 py-1.5 hover:ring-1 hover:ring-line",
        orange ? "bg-due-tint text-due" : "bg-page",
      )}
    >
      <span className={cn("font-heading text-[17px] font-semibold", !orange && "text-ink")}>{count}</span>
      <span className={cn("text-xs", !orange && "text-ink-muted")}>{label}</span>
    </Link>
  );
}

function TrackLabel({ track }: { track: "direct" | "referral" }) {
  const color = track === "direct" ? "text-direct" : "text-referral";
  return (
    <p className={cn("flex items-center gap-1.5 text-[13px] font-semibold", color)}>
      <span aria-hidden className={cn("size-2 rounded-full", track === "direct" ? "bg-direct" : "bg-referral")} />
      {track === "direct" ? "Direct apply" : "Referral"}
    </p>
  );
}

/** Compact pipeline counts; each count opens Jobs filtered to it. */
export function PipelineCard({ counts }: { counts: PipelineCounts }) {
  return (
    <Card className="pb-4">
      <CardHeader title="Pipeline">
        <span className="flex-1" />
        <Link href="/jobs" className="text-[13px] font-semibold text-direct">
          Open Jobs
        </Link>
      </CardHeader>
      <div className="flex flex-col gap-4 px-4">
        <div className="flex flex-col gap-2">
          <TrackLabel track="direct" />
          <div className="flex flex-wrap gap-1.5">
            {(Object.keys(DIRECT_LABELS) as (keyof typeof DIRECT_LABELS)[]).map((s) => (
              <CountChip key={s} count={counts.direct[s] ?? 0} label={DIRECT_LABELS[s]} href={`/jobs?direct_status=${s}`} />
            ))}
            <CountChip count={counts.follow_up_due} label="Follow-up due" href="/jobs?due=true" due />
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <TrackLabel track="referral" />
          <div className="flex flex-wrap gap-1.5">
            {(Object.keys(REFERRAL_LABELS) as (keyof typeof REFERRAL_LABELS)[]).map((s) => (
              <CountChip key={s} count={counts.referral[s] ?? 0} label={s === "referred_internally" ? "Referred" : REFERRAL_LABELS[s]} href={`/jobs?referral_status=${s}`} />
            ))}
          </div>
        </div>
      </div>
    </Card>
  );
}

export function RecentlyAddedCard({ jobs }: { jobs: Job[] }) {
  return (
    <Card>
      <CardHeader title="Recently added">
        <span className="flex-1" />
        <Link href="/jobs" className="text-[13px] font-semibold text-direct">
          See all jobs
        </Link>
      </CardHeader>
      {jobs.map((job) => {
        const style = STAGE_STYLES[job.stage];
        return (
          <Link
            key={job.id}
            href={`/jobs#job-${job.id}`}
            className={cn(
              "nudge flex items-center gap-3 border-t border-line px-4 py-3 hover:bg-page/60",
              job.stage === "closed" && "opacity-55",
            )}
          >
            <span
              aria-hidden
              className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-chip font-heading text-base font-bold text-ink"
            >
              {job.company.charAt(0).toUpperCase()}
            </span>
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="truncate text-sm font-semibold text-ink">{job.company}</span>
              <span className="truncate text-[13px] text-ink-muted">
                {[job.role, job.location].filter(Boolean).join(" · ")}
              </span>
            </span>
            <span className={cn("shrink-0 rounded-md px-2 py-0.5 text-xs font-semibold", style.badge)}>
              {STAGE_LABELS[job.stage]}
            </span>
            <span className="shrink-0 font-mono text-xs text-ink-muted">{shortDate(job.date_found)}</span>
          </Link>
        );
      })}
    </Card>
  );
}

/** Brand-new user: one large card (Figma "Dashboard · New user"). */
export function FirstJobCard() {
  return (
    <Card className="flex flex-col items-center gap-4 px-6 py-8 text-center">
      <span aria-hidden className="flex flex-col items-center gap-1.5">
        <span className="h-1 w-[120px] rounded-full bg-direct" />
        <span className="h-1 w-[84px] -translate-x-[18px] rounded-full bg-referral" />
      </span>
      <h2 className="text-2xl font-semibold text-ink">Add your first job</h2>
      <p className="max-w-[300px] text-[15px] text-ink-muted">
        Company, role and apply link are enough to start. You can fill in the rest later.
      </p>
      <Button nativeButton={false} render={<Link href="/jobs?add=1" />}>
        Add job
      </Button>
    </Card>
  );
}

/** Openings from company job boards that Groq picked for this user, each with a reason. */
export function SuggestionsCard() {
  const list = useSuggestions();
  const add = useAddSuggestion();
  const dismiss = useDismissSuggestion();
  const refresh = useRefreshSuggestions();
  const items = list.data?.suggestions ?? [];

  return (
    <Card>
      <div className="flex items-center gap-3 px-4 pt-4 pb-3 md:px-5">
        <div className="flex min-w-0 flex-col gap-0.5">
          <h2 className="text-lg font-semibold text-ink">Suggested for you</h2>
          <p className="text-[13px] text-ink-muted">
            {items.length > 0 ? `${items.length} openings picked from company job boards` : "Picked from company job boards"}
          </p>
        </div>
        <span className="flex-1" />
        <Button
          variant="outline"
          size="sm"
          disabled={refresh.isPending}
          onClick={() =>
            refresh.mutate(undefined, {
              onSuccess: () => toast("Looking for openings. New picks appear in a minute."),
              onError: (err) => toast(err instanceof ApiError ? err.message : "Couldn't refresh. Try again.", "error"),
            })
          }
        >
          {refresh.isPending ? "Refreshing…" : "Refresh"}
        </Button>
      </div>
      {list.isPending ? (
        <p className="border-t border-line px-5 py-5 text-sm text-ink-muted">Loading…</p>
      ) : items.length === 0 ? (
        <p className="border-t border-line px-5 py-5 text-sm text-ink-muted">
          No picks yet. We check company job boards every 6 hours, or press Refresh. Add a target role and
          cities in Settings for better matches. Some roles, like doctors, are not listed on these boards.
        </p>
      ) : (
        items.map((s, i) => (
          <div
            key={s.id}
            className="enter-up flex flex-col gap-3 border-t border-line px-4 py-4 transition-colors hover:bg-page/50 md:flex-row md:items-start md:gap-4 md:px-5"
            style={{ animationDelay: `${Math.min(i, 6) * 70}ms` }}
          >
            <span
              aria-hidden
              className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-chip font-heading text-lg font-bold text-ink"
            >
              {s.company.charAt(0).toUpperCase()}
            </span>
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <div className="min-w-0">
                <p className="truncate text-[15px] font-semibold text-ink">{s.company}</p>
                <p className="text-sm text-ink-muted">
                  {s.title}
                  {s.location ? ` · ${s.location}` : ""}
                </p>
              </div>
              <p className="border-l-2 border-direct/40 pl-2.5 text-[13px] leading-5 text-ink">{s.reason}</p>
            </div>
            <div className="flex shrink-0 items-center gap-2 md:flex-col md:items-stretch">
              <Button
                size="sm"
                disabled={add.isPending}
                onClick={() =>
                  add.mutate(s.id, {
                    onSuccess: () => toast(`Added ${s.company} to your tracker`),
                    onError: (err) =>
                      toast(err instanceof ApiError ? err.message : "Couldn't add that job. Try again.", "error"),
                  })
                }
              >
                {add.isPending && add.variables === s.id ? "Adding…" : "Add to tracker"}
              </Button>
              <div className="flex items-center gap-1 md:justify-between">
                <Button
                  variant="outline"
                  size="sm"
                  nativeButton={false}
                  render={<a href={s.url} target="_blank" rel="noopener noreferrer" />}
                >
                  Open ↗
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-ink-muted"
                  aria-label={`Dismiss ${s.company}`}
                  onClick={() => dismiss.mutate(s.id)}
                >
                  Dismiss
                </Button>
              </div>
            </div>
          </div>
        ))
      )}
      <p className="border-t border-line px-5 py-2.5 text-xs text-ink-muted">
        From public Greenhouse, Lever and Ashby job boards. We never apply or contact anyone for you.
      </p>
    </Card>
  );
}
