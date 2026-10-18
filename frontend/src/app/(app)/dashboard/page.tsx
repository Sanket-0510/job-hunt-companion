"use client";

import {
  DueTodayCard,
  FirstJobCard,
  PipelineCard,
  RecentlyAddedCard,
  SuggestionsCard,
} from "@/components/dashboard/dashboard-cards";
import { Skeleton } from "@/components/ui/skeleton";
import { firstName, greeting } from "@/lib/format";
import { useDashboard, useProfile } from "@/lib/queries";

export default function DashboardPage() {
  const dash = useDashboard();
  const profile = useProfile();
  const name = firstName(profile.data?.full_name);

  if (dash.isPending) {
    return (
      <div className="flex flex-col gap-5" aria-busy="true">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-48 w-full rounded-xl" />
        <Skeleton className="h-40 w-full rounded-xl" />
      </div>
    );
  }
  if (dash.isError) {
    return <p className="text-destructive">Couldn&apos;t load your dashboard. Refresh to try again.</p>;
  }

  const d = dash.data;
  const isNew = d.counts.all_jobs === 0;

  if (isNew) {
    return (
      <div className="flex max-w-[560px] flex-col gap-5">
        <div className="flex flex-col gap-1.5">
          <h1 className="text-[28px] font-semibold text-ink">{name ? `Welcome, ${name}` : "Welcome"}</h1>
          <p className="text-[15px] text-ink-muted">Your tracker is set up. Add the first job you are looking at.</p>
        </div>
        <FirstJobCard />
        <SuggestionsCard />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 md:gap-6">
      <div className="flex flex-col gap-1.5">
        <h1 className="text-[28px] font-semibold text-ink md:text-4xl">
          {greeting()}
          {name ? `, ${name}` : ""}
        </h1>
        <p className="text-[15px] text-ink-muted">
          {d.due_count > 0 ? (
            <span className="font-semibold text-due">
              {d.due_count} follow-up{d.due_count === 1 ? "" : "s"} due
            </span>
          ) : (
            "Nothing due"
          )}{" "}
          today · {d.active_count} active job{d.active_count === 1 ? "" : "s"}
        </p>
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)] gap-5 md:grid-cols-[minmax(0,1fr)_380px] md:items-start md:gap-6">
        <div className="flex min-w-0 flex-col gap-5 md:gap-6">
          <DueTodayCard items={d.due_today} />
          <SuggestionsCard />
          <div className="hidden md:block">
            <RecentlyAddedCard jobs={d.recently_added} />
          </div>
        </div>
        <PipelineCard counts={d.counts} />
        <div className="md:hidden">
          <RecentlyAddedCard jobs={d.recently_added} />
        </div>
      </div>
    </div>
  );
}
