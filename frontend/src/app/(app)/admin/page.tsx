"use client";

import { useQuery } from "@tanstack/react-query";

import { API_URL } from "@/lib/api";

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

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-line bg-card p-4 md:p-5">
      <h2 className="mb-3 text-lg font-semibold text-ink">{title}</h2>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-3">{children}</dl>
    </section>
  );
}

function Stat({ label, value, big }: { label: string; value: number | string; big?: boolean }) {
  return (
    <div className={big ? "col-span-2" : undefined}>
      <dd className={`font-heading font-bold text-ink ${big ? "text-4xl" : "text-2xl"}`}>{value}</dd>
      <dt className="text-[13px] text-ink-muted">{label}</dt>
    </div>
  );
}

function SignupsChart({ days }: { days: Stats["signups_by_day"] }) {
  const max = Math.max(1, ...days.map((d) => d.signups));
  return (
    <section className="rounded-xl border border-line bg-card p-4 md:p-5">
      <h2 className="mb-3 text-lg font-semibold text-ink">Signups, last 30 days</h2>
      <div className="flex h-28 items-end gap-[3px]" role="img" aria-label="Daily signups, last 30 days">
        {days.map((d) => (
          <div
            key={d.day}
            title={`${d.day}: ${d.signups}`}
            className="min-w-0 flex-1 rounded-sm bg-direct"
            style={{ height: `${Math.max(d.signups ? 8 : 2, (d.signups / max) * 100)}%`, opacity: d.signups ? 1 : 0.25 }}
          />
        ))}
      </div>
      <div className="mt-2 flex justify-between font-mono text-[11px] text-ink-muted">
        <span>{days[0]?.day}</span>
        <span>{days.at(-1)?.day}</span>
      </div>
    </section>
  );
}

export default function AdminPage() {
  const { data, isPending, isError } = useQuery({ queryKey: ["admin-stats"], queryFn: fetchStats });

  if (isPending) return <p className="text-sm text-ink-muted">Loading...</p>;
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
      <div className="flex flex-col gap-1.5">
        <h1 className="text-[28px] font-semibold text-ink md:text-4xl">Analytics</h1>
        <p className="text-[15px] text-ink-muted">Counts only. No names, emails or resume contents.</p>
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)] gap-5 md:grid-cols-2 md:gap-6">
        <Card title="Users">
          <Stat big label="Total users" value={users.total} />
          <Stat label="Joined today" value={users.today} />
          <Stat label="Last 7 days" value={users.last_7_days} />
          <Stat label="Last 30 days" value={users.last_30_days} />
          <Stat label="Finished onboarding" value={users.onboarded} />
          <Stat label="Sign in with Google" value={users.with_google} />
          <Stat label="Have a password" value={users.with_password} />
        </Card>
        <Card title="Active users">
          <Stat big label="Seen in the last 7 days" value={active.last_7_days} />
          <Stat label="Last 24 hours" value={active.last_day} />
          <Stat label="Last 30 days" value={active.last_30_days} />
        </Card>
        <Card title="Resumes">
          <Stat big label="Resumes uploaded" value={resumes.total} />
          <Stat label="Last 7 days" value={resumes.last_7_days} />
          <Stat label="Users with a resume" value={resumes.users_with_resume} />
          <Stat label="Read successfully" value={resumes.parsed} />
          <Stat label="Failed" value={resumes.failed} />
          <Stat label="In progress" value={resumes.in_progress} />
        </Card>
        <Card title="Jobs">
          <Stat big label="Jobs tracked" value={jobs.total} />
          <Stat label="Last 7 days" value={jobs.last_7_days} />
          <Stat label="Users with a job" value={jobs.users_with_jobs} />
          <Stat label="Average per user" value={jobs.per_user_average} />
          <Stat label="Direct apply started" value={jobs.direct_started} />
          <Stat label="Referral started" value={jobs.referral_started} />
        </Card>
        <Card title="Suggestions">
          <Stat label="Added to tracker" value={suggestions.added_to_tracker} />
          <Stat label="Dismissed" value={suggestions.dismissed} />
          <Stat label="Waiting" value={suggestions.waiting} />
        </Card>
        <Card title="Morning emails">
          <Stat label="Users with reminders on" value={emails.reminders_on} />
          <Stat label="Sent today" value={emails.sent_today} />
          <Stat label="Sent in last 7 days" value={emails.sent_last_7_days} />
        </Card>
      </div>
      <SignupsChart days={data.signups_by_day} />
    </div>
  );
}
