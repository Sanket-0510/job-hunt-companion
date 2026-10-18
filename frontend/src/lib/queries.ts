"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { ApiError, api, unwrap, type Schemas } from "./api";

export const keys = {
  me: ["me"] as const,
  profile: ["profile"] as const,
  dashboard: ["dashboard"] as const,
  jobs: ["jobs"] as const,
};

export type User = Schemas["UserOut"];
export type Profile = Schemas["ProfileOut"];
export type Job = Schemas["JobOut"];
export type Dashboard = Schemas["Dashboard"];
export type DueItem = Schemas["DueItem"];
export type PipelineCounts = Schemas["PipelineCounts"];

/** The signed-in user, or null when logged out (401 is an answer, not an error). */
export function useMe() {
  return useQuery({
    queryKey: keys.me,
    queryFn: async (): Promise<User | null> => {
      try {
        return await unwrap(api.GET("/auth/me"));
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) return null;
        throw err;
      }
    },
  });
}

export function useLogout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => unwrap(api.POST("/auth/logout")),
    onSuccess: () => {
      qc.clear();
      qc.setQueryData(keys.me, null);
    },
  });
}

export function useProfile() {
  return useQuery({ queryKey: keys.profile, queryFn: () => unwrap(api.GET("/profile")) });
}

export function useDashboard() {
  return useQuery({ queryKey: keys.dashboard, queryFn: () => unwrap(api.GET("/dashboard")) });
}

/** Snooze 3 days moves the follow-up date; refresh everything that shows due jobs. */
export function useSnooze() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (jobId: string) =>
      unwrap(api.POST("/jobs/{job_id}/snooze", { params: { path: { job_id: jobId } } })),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.dashboard });
      qc.invalidateQueries({ queryKey: keys.jobs });
    },
  });
}

export function useMarkOnboarded() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => unwrap(api.POST("/profile/onboarded")),
    onSuccess: (profile) => qc.setQueryData(keys.profile, profile),
  });
}

export type ProfileUpdate = Schemas["ProfileUpdate"];
export type Resume = Schemas["ResumeOut"];

export function useUpdateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: ProfileUpdate) => unwrap(api.PATCH("/profile", { body })),
    onSuccess: (profile) => {
      qc.setQueryData(keys.profile, profile);
      qc.invalidateQueries({ queryKey: keys.jobs }); // messages and track emails use the profile
      qc.invalidateQueries({ queryKey: keys.dashboard });
    },
  });
}

/** Upload a resume PDF; parsing then runs in the background worker. */
export async function uploadResume(file: File): Promise<Resume> {
  const form = new FormData();
  form.append("file", file);
  return unwrap(
    api.POST("/resumes", {
      // openapi-fetch would JSON-encode the body; send the FormData as-is.
      body: form as unknown as Schemas["Body_upload_resume_resumes_post"],
      bodySerializer: (b) => b as unknown as FormData,
    }),
  );
}

export async function getResume(id: string): Promise<Resume> {
  return unwrap(api.GET("/resumes/{resume_id}", { params: { path: { resume_id: id } } }));
}

export type Suggestion = Schemas["SuggestionOut"];
const suggestionsKey = ["suggestions"] as const;

export function useSuggestions() {
  return useQuery({
    queryKey: suggestionsKey,
    queryFn: () => unwrap(api.GET("/suggestions")),
  });
}

/** Add to tracker: creates a job from the opening and removes it from suggestions. */
export function useAddSuggestion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      unwrap(api.POST("/suggestions/{suggestion_id}/add", { params: { path: { suggestion_id: id } } })),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: suggestionsKey });
      qc.invalidateQueries({ queryKey: keys.dashboard });
      qc.invalidateQueries({ queryKey: keys.jobs });
    },
    // A re-rank may have replaced it: show the current list.
    onError: () => qc.invalidateQueries({ queryKey: suggestionsKey }),
  });
}

export function useDismissSuggestion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      unwrap(api.POST("/suggestions/{suggestion_id}/dismiss", { params: { path: { suggestion_id: id } } })),
    onMutate: async (id) => {
      // Hide it at once; it's gone on the server too unless the call fails.
      qc.setQueryData<{ suggestions: Suggestion[] }>(suggestionsKey, (d) =>
        d ? { suggestions: d.suggestions.filter((s) => s.id !== id) } : d,
      );
    },
    onError: () => qc.invalidateQueries({ queryKey: suggestionsKey }),
  });
}

export function useRefreshSuggestions() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => unwrap(api.POST("/suggestions/refresh")),
    onSuccess: () => {
      // Ranking runs in the worker; check back a few times.
      for (const ms of [8000, 20000, 45000, 90000]) {
        setTimeout(() => qc.invalidateQueries({ queryKey: suggestionsKey }), ms);
      }
    },
  });
}
