"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api, unwrap, type Schemas } from "./api";
import { keys, type Job } from "./queries";

export type JobFilters = {
  q?: string;
  direct_status?: Schemas["DirectStatus"];
  referral_status?: Schemas["ReferralStatus"];
  due?: boolean;
  emails_reversed?: boolean;
  preferred_city?: boolean;
  sort?: Schemas["JobSort"];
};
export type JobList = Schemas["JobList"];
export type JobCreate = Schemas["JobCreate"];
export type JobUpdate = Schemas["JobUpdate"];

export function useJobs(filters: JobFilters) {
  return useQuery({
    queryKey: [...keys.jobs, filters],
    queryFn: () => unwrap(api.GET("/jobs", { params: { query: filters } })),
    placeholderData: keepPreviousData,
  });
}

function refreshJobViews(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: keys.jobs });
  qc.invalidateQueries({ queryKey: keys.dashboard });
}

export function useCreateJob() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: JobCreate) => unwrap(api.POST("/jobs", { body })),
    onSuccess: () => refreshJobViews(qc),
  });
}

/** Write a saved job into every cached list so the card shows server values at once. */
function putJob(qc: ReturnType<typeof useQueryClient>, job: Job) {
  qc.setQueriesData<JobList>({ queryKey: keys.jobs }, (list) =>
    list ? { ...list, jobs: list.jobs.map((j) => (j.id === job.id ? job : j)) } : list,
  );
}

/** Card autosave: one field (or a few) at a time, with the last-seen updated_at. */
export function useUpdateJob() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, changes }: { id: string; changes: JobUpdate }) =>
      unwrap(api.PATCH("/jobs/{job_id}", { params: { path: { job_id: id } }, body: changes })),
    onSuccess: (job) => {
      putJob(qc, job);
      refreshJobViews(qc);
    },
  });
}

export function useSnoozeJob() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      unwrap(api.POST("/jobs/{job_id}/snooze", { params: { path: { job_id: id } } })),
    onSuccess: (job) => {
      putJob(qc, job);
      refreshJobViews(qc);
    },
  });
}

export function useDeleteJob() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      unwrap(api.DELETE("/jobs/{job_id}", { params: { path: { job_id: id } } })),
    onSuccess: (_, id) => {
      qc.setQueriesData<JobList>({ queryKey: keys.jobs }, (list) =>
        list ? { ...list, jobs: list.jobs.filter((j) => j.id !== id) } : list,
      );
      refreshJobViews(qc);
    },
  });
}

/** Same filters as the list, so Export CSV downloads exactly what is shown (spec F11). */
export function exportUrl(base: string, filters: JobFilters): string {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(filters)) {
    if (v !== undefined && v !== false && v !== "") params.set(k, String(v));
  }
  const qs = params.toString();
  return `${base}/jobs/export.csv${qs ? `?${qs}` : ""}`;
}
