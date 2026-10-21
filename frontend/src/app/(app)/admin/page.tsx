"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { API_URL } from "@/lib/api";
import { cn } from "@/lib/utils";

type Stats = {
  users: {
    total: number;
    today: number;
    last_7_days: number;
    last_30_days: number;
    with_google: number;
    with_password: number;
    onboarded: number;
  };
  active_users: { last_day: number; last_7_days: number; last_30_days: number };
  resumes: {
    total: number;
    last_7_days: number;
    users_with_resume: number;
    parsed: number;
    failed: number;
    in_progress: number;
  };
  jobs: {
    total: number;
    last_7_days: number;
    users_with_jobs: number;
    per_user_average: number;
    direct_started: number;
    referral_started: number;
  };
  suggestions: { added_to_tracker: number; dismissed: number; waiting: number };
  emails: { reminders_on: number; sent_today: number; sent_last_7_days: number };
  signups_by_day: { day: string; signups: number }[];
};

/** null means "not an admin" (the API answers 404 on purpose). */
async function fetchStats(): Promise<Stats | null> {
  const res = await fetch(`${API_URL}/admin/stats`, { credentials: "include" });
  if (res.status === 404 || res.status === 401) return null;
  if (!res.ok) throw new Error("Could not load stats.");
  return res.json();
}

const fmt = (n: number) => (Number.isInteger(n) ? n.toLocaleString() : n.toFixed(1));

/** Counts up to the value once on mount; jumps straight there when motion is reduced. */
function CountUp({ value }: { value: number }) {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const duration = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 700;
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = duration === 0 ? 1 : Math.min(1, (now - start) / duration);
      setShown(value * (1 - Math.pow(1 - t, 3)));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  const out = Number.isInteger(value) ? Math.round(shown) : Number(shown.toFixed(1));
  return <>{fmt(out)}</>;
}

type Tone = "direct" | "referral" | "due" | "ink";
const TONE_BG: Record<Tone, string> = { direct: "bg-direct", referral: "bg-referral", due: "bg-due", ink: "bg-ink" };
const TONE_TEXT: Record<Tone, string> = { direct: "text-direct", referral: "text-referral", due: "text-due", ink: "text-ink" };

/** Headline number with a coloured rail along the top. */
function Kpi({ label, value, note, tone, index }: { label: string; value: number; note: string; tone: Tone; index: number }) {
  return (
    <div
      className="enter-up relative overflow-hidden rounded-xl border border-line bg-card px-4 pt-5 pb-4"
      style={{ animationDelay: `${index * 60}ms` }}
    >
      <span aria-hidden className={cn("grow-x absolute inset-x-0 top-0 h-1", TONE_BG[tone])} style={{ animationDelay: `${index * 60 + 120}ms` }} />
      <p className="text-[13px] text-ink-muted">{label}</p>
      <p className={cn("font-heading text-4xl leading-tight font-bold tabular-nums", TONE_TEXT[tone])}>
        <CountUp value={value} />
      </p>
      <p className="mt-0.5 font-mono text-xs text-ink-muted">{note}</p>
    </div>
  );
}

function Panel({ title, subtitle, index, className, children }: { title: string; subtitle?: string; index: number; className?: string; children: React.ReactNode }) {
  return (
    <section
      className={cn("enter-up flex flex-col gap-4 rounded-xl border border-line bg-card p-4 md:p-5", className)}
      style={{ animationDelay: `${240 + index * 60}ms` }}
    >
      <div className="flex flex-col gap-0.5">
        <h2 className="text-lg font-semibold text-ink">{title}</h2>
        {subtitle && <p className="text-[13px] text-ink-muted">{subtitle}</p>}
      </div>
      {children}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="min-w-0">
      <p className="font-heading text-2xl font-bold text-ink tabular-nums">
        <CountUp value={value} />
      </p>
      <p className="text-[13px] text-ink-muted">{label}</p>
    </div>
  );
}

function Stats({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-3 gap-x-4 gap-y-3">{children}</div>;
}

/** One bar showing value out of total, grows in from the left. */
function Meter({ label, value, total, tone }: { label: string; value: number; total: number; tone: Tone }) {
  const pct = total > 0 ? Math.min(100, (value / total) * 100) : 0;
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-3 text-[13px]">
        <span className="text-ink">{label}</span>
        <span className="font-mono text-xs text-ink-muted">
          {fmt(value)} · {Math.round(pct)}%
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-chip">
        <div className={cn("grow-x h-full rounded-full", TONE_BG[tone])} style={{ width: `${pct}%`, animationDelay: "300ms" }} />
      </div>
    </div>
  );
}

/** One bar split into parts, with a legend under it. */
function Split({ parts }: { parts: { label: string; value: number; tone: Tone }[] }) {
  const total = parts.reduce((n, p) => n + p.value, 0);
  return (
    <div className="flex flex-col gap-2.5">
      <div className="grow-x flex h-2.5 gap-0.5 overflow-hidden rounded-full bg-chip" style={{ animationDelay: "300ms" }}>
        {total > 0 &&
          parts.map((p) => <span key={p.label} className={cn("h-full", TONE_BG[p.tone])} style={{ width: `${(p.value / total) * 100}%` }} />)}
      </div>
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-[13px]">
        {parts.map((p) => (
          <li key={p.label} className="flex items-center gap-1.5 text-ink-muted">
            <span aria-hidden className={cn("size-2 rounded-full", TONE_BG[p.tone])} />
            {p.label} <span className="font-mono text-xs text-ink">{fmt(p.value)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function SignupsChart({ days, index }: { days: Stats["signups_by_day"]; index: number }) {
  const max = Math.max(1, ...days.map((d) => d.signups));
  const total = days.reduce((n, d) => n + d.signups, 0);
  return (
    <Panel title="Signups, last 30 days" subtitle={`${fmt(total)} in total. Peak day: ${max}.`} index={index} className="md:col-span-2">
      <div className="flex h-36 items-end gap-[3px]" role="img" aria-label="Daily signups, last 30 days">
        {days.map((d, i) => (
          <div key={d.day} title={`${d.day}: ${d.signups}`} className="group flex h-full min-w-0 flex-1 items-end">
            <div
              className={cn(
                "grow-y w-full rounded-sm transition-colors duration-150",
                d.signups ? "bg-direct group-hover:bg-ink" : "bg-line",
              )}
              style={{ height: `${Math.max(d.signups ? 8 : 2, (d.signups / max) * 100)}%`, animationDelay: `${300 + i * 14}ms` }}
            />
          </div>
        ))}
      </div>
      <div className="flex justify-between font-mono text-[11px] text-ink-muted">
        <span>{days[0]?.day}</span>
        <span>{days.at(-1)?.day}</span>
      </div>
    </Panel>
  );
}

export default function AdminPage() {
  const { data, isPending, isError } = useQuery({ queryKey: ["admin-stats"], queryFn: fetchStats });

  if (isPending) {
    return (
      <div className="flex flex-col gap-5" aria-busy="true">
        <div className="h-9 w-48 animate-pulse rounded-lg bg-chip" />
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-28 animate-pulse rounded-xl bg-chip" />
          ))}
        </div>
      </div>
    );
  }
  if (isError) return <p className="text-sm text-ink-muted">Could not load stats. Try again.</p>;
  if (data === null) {
    return (
      <div className="flex flex-col gap-1.5">
        <h1 className="text-[28px] font-semibold text-ink">Not found</h1>
        <p className="text-[15px] text-ink-muted">This page does not exist.</p>
      </div>
    );
  }

  const { users, active_users: active, resumes, jobs, suggestions, emails } = data;
  return (
    <div className="flex flex-col gap-5 md:gap-6">
      <div className="enter-up flex flex-col gap-1.5">
        <h1 className="text-[28px] font-semibold text-ink md:text-4xl">Analytics</h1>
        <p className="text-[15px] text-ink-muted">Counts only. No names, emails or resume contents.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi index={0} tone="direct" label="Total users" value={users.total} note={`+${users.today} today`} />
        <Kpi index={1} tone="referral" label="Active, last 7 days" value={active.last_7_days} note={`${active.last_day} in 24 hours`} />
        <Kpi index={2} tone="due" label="Jobs tracked" value={jobs.total} note={`+${jobs.last_7_days} this week`} />
        <Kpi index={3} tone="ink" label="Resumes uploaded" value={resumes.total} note={`+${resumes.last_7_days} this week`} />
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-5 md:grid-cols-2 md:gap-6">
        <Panel index={0} title="Users" subtitle="Who signed up and how.">
          <Stats>
            <Stat label="Joined today" value={users.today} />
            <Stat label="Last 7 days" value={users.last_7_days} />
            <Stat label="Last 30 days" value={users.last_30_days} />
          </Stats>
          <div className="flex flex-col gap-3">
            <Meter tone="direct" label="Finished onboarding" value={users.onboarded} total={users.total} />
            <Meter tone="referral" label="Sign in with Google" value={users.with_google} total={users.total} />
            <Meter tone="ink" label="Have a password" value={users.with_password} total={users.total} />
          </div>
        </Panel>

        <Panel index={1} title="Active users" subtitle="Seen in the app recently.">
          <Stats>
            <Stat label="Last 24 hours" value={active.last_day} />
            <Stat label="Last 7 days" value={active.last_7_days} />
            <Stat label="Last 30 days" value={active.last_30_days} />
          </Stats>
          <div className="flex flex-col gap-3">
            <Meter tone="direct" label="Active in 24 hours" value={active.last_day} total={users.total} />
            <Meter tone="referral" label="Active in 7 days" value={active.last_7_days} total={users.total} />
            <Meter tone="ink" label="Active in 30 days" value={active.last_30_days} total={users.total} />
          </div>
        </Panel>

        <Panel index={2} title="Resumes" subtitle="Uploads and how reading went.">
          <Stats>
            <Stat label="Uploaded" value={resumes.total} />
            <Stat label="Last 7 days" value={resumes.last_7_days} />
            <Stat label="Users with one" value={resumes.users_with_resume} />
          </Stats>
          <Split
            parts={[
              { label: "Read", value: resumes.parsed, tone: "direct" },
              { label: "In progress", value: resumes.in_progress, tone: "referral" },
              { label: "Failed", value: resumes.failed, tone: "due" },
            ]}
          />
        </Panel>

        <Panel index={3} title="Jobs" subtitle="What people track.">
          <Stats>
            <Stat label="Tracked" value={jobs.total} />
            <Stat label="Users with a job" value={jobs.users_with_jobs} />
            <Stat label="Average per user" value={jobs.per_user_average} />
          </Stats>
          <div className="flex flex-col gap-3">
            <Meter tone="direct" label="Direct apply started" value={jobs.direct_started} total={jobs.total} />
            <Meter tone="referral" label="Referral started" value={jobs.referral_started} total={jobs.total} />
          </div>
        </Panel>

        <Panel index={4} title="Suggestions" subtitle="Openings picked for users.">
          <Stats>
            <Stat label="Added" value={suggestions.added_to_tracker} />
            <Stat label="Dismissed" value={suggestions.dismissed} />
            <Stat label="Waiting" value={suggestions.waiting} />
          </Stats>
          <Split
            parts={[
              { label: "Added", value: suggestions.added_to_tracker, tone: "direct" },
              { label: "Dismissed", value: suggestions.dismissed, tone: "due" },
              { label: "Waiting", value: suggestions.waiting, tone: "ink" },
            ]}
          />
        </Panel>

        <Panel index={5} title="Morning emails" subtitle="Reminder reach.">
          <Stats>
            <Stat label="Reminders on" value={emails.reminders_on} />
            <Stat label="Sent today" value={emails.sent_today} />
            <Stat label="Sent in 7 days" value={emails.sent_last_7_days} />
          </Stats>
          <Meter tone="direct" label="Users with reminders on" value={emails.reminders_on} total={users.total} />
        </Panel>

        <SignupsChart days={data.signups_by_day} index={6} />
      </div>
    </div>
  );
}
