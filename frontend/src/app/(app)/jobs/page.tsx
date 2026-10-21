"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";

import { AddJobPanel } from "@/components/jobs/add-job-panel";
import { JobCard } from "@/components/jobs/job-card";
import { PipelineCounts } from "@/components/jobs/pipeline-counts";
import { Button } from "@/components/ui/button";
import { CheckboxField, Icon, SelectField } from "@/components/ui/controls";
import { Skeleton } from "@/components/ui/skeleton";
import { API_URL, type Schemas } from "@/lib/api";
import { SORT_LABELS, type JobSort } from "@/lib/format";
import { type JobFilters, exportUrl, useJobs } from "@/lib/jobs";
import { type Profile, useProfile } from "@/lib/queries";

/** Filters live in the URL, so pipeline links from the Dashboard and the back button work. */
function useFilters(): [JobFilters, (patch: Partial<JobFilters>) => void] {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const filters = useMemo<JobFilters>(
    () => ({
      q: params.get("q") || undefined,
      direct_status: (params.get("direct_status") as Schemas["DirectStatus"]) || undefined,
      referral_status: (params.get("referral_status") as Schemas["ReferralStatus"]) || undefined,
      due: params.get("due") === "true" || undefined,
      emails_reversed: params.get("emails_reversed") === "true" || undefined,
      preferred_city: params.get("preferred_city") === "true" || undefined,
      sort: (params.get("sort") as JobSort) || undefined,
    }),
    [params],
  );
  const update = (patch: Partial<JobFilters>) => {
    const next = new URLSearchParams(params);
    next.delete("add");
    for (const [k, v] of Object.entries(patch)) {
      if (v === undefined || v === false || v === "") next.delete(k);
      else next.set(k, String(v));
    }
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };
  return [filters, update];
}

function ProfileSummary({ profile }: { profile?: Profile }) {
  if (!profile) return null;
  const city = profile.preferred_cities[0];
  const before = [profile.target_role, profile.years_experience != null ? `${Math.floor(Number(profile.years_experience))} yrs` : null]
    .filter(Boolean)
    .join(" · ");
  const skills = profile.skills.join(", ");
  if (!before && !city && !skills) return null;
  return (
    <p className="text-sm leading-5 text-ink-muted">
      {before}
      {before && city ? " · " : ""}
      {city && <strong className="font-semibold text-ink">{city}</strong>}
      {skills ? `${before || city ? " · " : ""}${skills}` : ""}
    </p>
  );
}

function SearchBox({ value, onChange }: { value: string; onChange: (q: string) => void }) {
  const [text, setText] = useState(value);
  const [synced, setSynced] = useState(value);
  // The URL changed from outside (e.g. "Clear filters"): show that value.
  if (value !== synced) {
    setSynced(value);
    setText(value);
  }
  // Debounce typing so every keystroke doesn't hit the API.
  useEffect(() => {
    const t = setTimeout(() => {
      if (text !== synced) onChange(text);
    }, 300);
    return () => clearTimeout(t);
  }, [text, synced, onChange]);
  return (
    <label className="flex h-11 shrink-0 items-center gap-2 rounded-lg md:flex-1 border border-line bg-card px-3 focus-within:border-ink">
      <Icon name="search" size={18} className="text-ink-muted" />
      <span className="sr-only">Search jobs</span>
      <input
        type="search"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Search company, role, location, notes, contact, source"
        className="h-full flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-faint"
      />
    </label>
  );
}

function EmptyState({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-xl border-2 border-dashed border-line px-6 py-12 text-center">
      <span aria-hidden className="flex flex-col items-center gap-1.5">
        <span className="h-1 w-[72px] rounded-full bg-direct" />
        <span className="h-1 w-[52px] -translate-x-[10px] rounded-full bg-referral" />
      </span>
      <p className="max-w-[300px] text-xl font-semibold text-ink">{title}</p>
      {action}
    </div>
  );
}

function JobsScreen() {
  const [filters, setFilters] = useFilters();
  const params = useSearchParams();
  const [adding, setAdding] = useState(params.get("add") === "1");
  const jobs = useJobs(filters);
  const profile = useProfile();
  const data = jobs.data;
  const sort = filters.sort ?? data?.sort ?? "priority";
  const hasFilters = Boolean(
    filters.q || filters.direct_status || filters.referral_status || filters.due || filters.emails_reversed || filters.preferred_city,
  );

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3.5 md:flex-row md:items-end">
        <div className="flex flex-1 flex-col gap-1">
          <h1 className="text-[28px] font-semibold text-ink md:text-4xl">Jobs</h1>
          <ProfileSummary profile={profile.data} />
        </div>
        <div className="flex gap-2 md:flex-row-reverse">
          <Button className="flex-1 md:flex-none" onClick={() => setAdding(true)}>
            Add job
          </Button>
          <Button
            variant="outline"
            className="flex-1 md:flex-none"
            nativeButton={false}
            render={<a href={exportUrl(API_URL, filters)} />}
          >
            Export CSV
          </Button>
        </div>
      </div>

      {data && (
        <PipelineCounts
          counts={data.counts}
          filters={filters}
          directEmail={profile.data?.direct_email}
          referralEmail={profile.data?.referral_email}
          onFilter={setFilters}
        />
      )}

      <div className="flex flex-col gap-2.5 md:flex-row md:items-center md:gap-4">
        <SearchBox value={filters.q ?? ""} onChange={(q) => setFilters({ q })} />
        <div className="flex items-center gap-2 md:gap-4">
          <CheckboxField
            label="Preferred city only"
            checked={Boolean(filters.preferred_city)}
            onChange={(on) => setFilters({ preferred_city: on })}
          />
          <span className="flex-1" />
          <SelectField
            label="Sort"
            hideLabel
            className="w-[176px] md:w-[200px]"
            value={sort}
            options={(Object.keys(SORT_LABELS) as JobSort[]).map((s) => ({ value: s, label: `Sort: ${SORT_LABELS[s]}` }))}
            onChange={(s) => setFilters({ sort: s })}
          />
        </div>
      </div>

      {adding && <AddJobPanel onClose={() => setAdding(false)} />}

      {jobs.isPending ? (
        <div className="flex flex-col gap-4" aria-busy="true" aria-label="Loading jobs">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-56 w-full rounded-xl" />
          ))}
        </div>
      ) : jobs.isError ? (
        <p className="text-destructive">Couldn&apos;t load your jobs. Refresh to try again.</p>
      ) : data!.jobs.length === 0 ? (
        hasFilters ? (
          <EmptyState
            title="No jobs match these filters."
            action={
              <Button variant="outline" onClick={() => setFilters({ q: undefined, direct_status: undefined, referral_status: undefined, due: undefined, emails_reversed: undefined, preferred_city: undefined })}>
                Clear filters
              </Button>
            }
          />
        ) : (
          !adding && (
            <EmptyState
              title="No jobs yet. Use Add job to track your first opening."
              action={<Button onClick={() => setAdding(true)}>Add job</Button>}
            />
          )
        )
      ) : (
        <div className="flex flex-col gap-3">
          {data!.jobs.map((job, i) => (
            <div key={job.id} className="enter-up" style={{ animationDelay: `${Math.min(i, 8) * 45}ms` }}>
              <JobCard job={job} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function JobsPage() {
  return (
    <Suspense>
      <JobsScreen />
    </Suspense>
  );
}
