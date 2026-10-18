"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  AutosaveInput,
  CheckboxField,
  DateField,
  Icon,
  SelectField,
} from "@/components/ui/controls";
import { toast } from "@/components/ui/toaster";
import { ApiError } from "@/lib/api";
import { copyText } from "@/lib/clipboard";
import {
  DIRECT_LABELS,
  DIRECT_TONES,
  PRIORITY_BADGE,
  PRIORITY_LABELS,
  REFERRAL_LABELS,
  REFERRAL_TONES,
  STAGE_LABELS,
  STAGE_STYLES,
  shortDate,
} from "@/lib/format";
import { type JobUpdate, useDeleteJob, useUpdateJob } from "@/lib/jobs";
import type { Job } from "@/lib/queries";
import { cn } from "@/lib/utils";

import { MessagePanel } from "./message-panel";

const options = <T extends string>(labels: Record<T, string>) =>
  (Object.keys(labels) as T[]).map((value) => ({ value, label: labels[value] }));

function LinkPill({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="rounded-full border border-line bg-card px-2.5 py-[5px] text-xs font-medium text-ink hover:bg-page"
    >
      {children} ↗
    </a>
  );
}

function TrackPanel({
  track,
  email,
  children,
}: {
  track: "direct" | "referral";
  email: string | null | undefined;
  children: React.ReactNode;
}) {
  const direct = track === "direct";
  return (
    <section
      aria-label={direct ? "Direct apply" : "Referral"}
      className="overflow-hidden rounded-[10px] border border-line bg-card"
    >
      <header
        className={cn(
          "flex items-center gap-2 px-3 py-2.5",
          direct ? "bg-direct-tint text-direct" : "bg-referral-tint text-referral",
        )}
      >
        <span aria-hidden className={cn("size-2 rounded-full", direct ? "bg-direct" : "bg-referral")} />
        <span className="text-[13px] font-semibold">{direct ? "Direct apply" : "Referral"}</span>
        <span className="flex-1" />
        <span className="truncate font-mono text-[11px]">{email ?? "Add email in Settings"}</span>
      </header>
      <div className="flex flex-col gap-3 p-3">{children}</div>
    </section>
  );
}

function RemoveButton({ job }: { job: Job }) {
  const [confirming, setConfirming] = useState(false);
  const remove = useDeleteJob();
  if (!confirming) {
    return (
      <Button variant="ghost" size="sm" className="px-2 text-destructive" onClick={() => setConfirming(true)}>
        Remove
      </Button>
    );
  }
  return (
    <span role="group" aria-label="Confirm removal" className="flex items-center gap-1 text-[13px]">
      <span className="text-ink">Remove this job?</span>
      <Button
        variant="ghost"
        size="sm"
        className="text-destructive"
        disabled={remove.isPending}
        onClick={() =>
          remove.mutate(job.id, {
            onSuccess: () => toast(`Removed ${job.company}`),
            onError: () => toast("Couldn't remove that job. Try again.", "error"),
          })
        }
      >
        Yes, remove
      </Button>
      <Button variant="ghost" size="sm" onClick={() => setConfirming(false)}>
        Keep
      </Button>
    </span>
  );
}

export function JobCard({ job }: { job: Job }) {
  const update = useUpdateJob();
  const [editLinkedIn, setEditLinkedIn] = useState(false);
  const closed = job.stage === "closed";
  const stage = STAGE_STYLES[job.stage];
  const priority = PRIORITY_BADGE[job.priority];

  /** Autosave one change; on failure keep what the user typed and say so (spec S5). */
  function save(changes: JobUpdate) {
    update.mutate(
      { id: job.id, changes: { ...changes, expected_updated_at: job.updated_at } },
      {
        onSuccess: () => toast("Saved", "default", 1500),
        onError: (err) =>
          toast(
            err instanceof ApiError && err.code === "job_changed"
              ? "This job changed on another device. Showing the latest."
              : err instanceof ApiError && err.code === "validation_error"
                ? `Couldn't save: ${err.message}`
                : "Couldn't save that change. Try again.",
            "error",
            4000,
          ),
      },
    );
  }

  const meta = [job.location, job.experience_asked, job.source].filter(Boolean).join(" · ");

  return (
    <article
      id={`job-${job.id}`}
      className={cn(
        "flex scroll-mt-24 overflow-hidden rounded-xl border border-line bg-card transition-opacity",
        closed && "opacity-55 focus-within:opacity-100 hover:opacity-100",
      )}
    >
      <span aria-hidden className={cn("w-[5px] shrink-0", stage.stripe)} />
      <div className="flex min-w-0 flex-1 flex-col gap-4 p-4 md:p-6">
        {/* Top: company, role, badges, apply actions */}
        <div className="flex flex-col gap-3 md:flex-row md:items-start">
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <div className="flex items-center gap-2">
              <h3 className="truncate text-xl font-semibold text-ink">{job.company}</h3>
              <span className="flex-1" />
              <span className={cn("shrink-0 rounded-md px-2 py-0.5 text-xs font-semibold md:hidden", stage.badge)}>
                {STAGE_LABELS[job.stage]}
              </span>
            </div>
            <p className="text-[15px] font-medium text-ink">{job.role}</p>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
              <span className={cn("rounded-md px-2 py-0.5 text-xs font-semibold", priority.className)}>
                {priority.text}
              </span>
              {job.emails_reversed && (
                <span className="rounded-md bg-due-tint px-2 py-0.5 text-xs font-semibold text-due">
                  Emails reversed
                </span>
              )}
              {meta && <span className="text-[13px] text-ink-muted">{meta}</span>}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={cn("hidden rounded-md px-2 py-0.5 text-xs font-semibold md:inline", stage.badge)}>
              {STAGE_LABELS[job.stage]}
            </span>
            {job.apply_url && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  nativeButton={false}
                  render={<a href={job.apply_url} target="_blank" rel="noopener noreferrer" />}
                >
                  Open apply link ↗
                </Button>
                <Button variant="ghost" size="sm" onClick={() => copyText(job.apply_url!)}>
                  Copy link
                </Button>
              </>
            )}
          </div>
        </div>

        {/* LinkedIn helpers: plain links to LinkedIn's own search; the app never acts there */}
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-1.5">
            {job.linkedin.company_page && <LinkPill href={job.linkedin.company_page}>Company on LinkedIn</LinkPill>}
            {job.linkedin.recruiter && (
              <LinkPill href={job.linkedin.recruiter}>TA: {job.recruiter_name ?? "Recruiter"}</LinkPill>
            )}
            <LinkPill href={job.linkedin.find_recruiters}>Find recruiters</LinkPill>
            <LinkPill href={job.linkedin.find_engineers}>Find engineers for referral</LinkPill>
            <button
              type="button"
              aria-expanded={editLinkedIn}
              onClick={() => setEditLinkedIn((v) => !v)}
              className="flex items-center gap-1 px-1.5 py-[5px] text-xs font-medium text-ink-muted"
            >
              <Icon name={editLinkedIn ? "chevron-down-open" : "edit-linkedin"} size={14} />
              Edit LinkedIn
            </button>
          </div>
          {editLinkedIn && (
            <div className="grid gap-3 rounded-lg bg-page p-3 md:grid-cols-3">
              <AutosaveInput
                label="Company LinkedIn page"
                type="url"
                placeholder="https://linkedin.com/company/…"
                value={job.company_linkedin_url}
                onSave={(v) => save({ company_linkedin_url: v })}
              />
              <AutosaveInput
                label="Recruiter name"
                value={job.recruiter_name}
                onSave={(v) => save({ recruiter_name: v })}
              />
              <AutosaveInput
                label="Recruiter profile link"
                type="url"
                placeholder="https://linkedin.com/in/…"
                value={job.recruiter_linkedin_url}
                onSave={(v) => save({ recruiter_linkedin_url: v })}
              />
            </div>
          )}
        </div>

        {/* Two tracks: stacked on phones, side by side on desktop (referral slightly wider) */}
        <div className="grid gap-3 md:grid-cols-[minmax(0,0.85fr)_minmax(0,1fr)] md:items-start md:gap-4">
          <TrackPanel track="direct" email={job.emails.direct}>
            <div className="grid grid-cols-2 gap-3">
              <SelectField
                label="Status"
                value={job.direct_status}
                tone={DIRECT_TONES[job.direct_status]}
                options={options(DIRECT_LABELS)}
                onChange={(direct_status) => save({ direct_status })}
              />
              <DateField label="Applied on" value={job.applied_on} onChange={(applied_on) => save({ applied_on })} />
            </div>
          </TrackPanel>
          <TrackPanel track="referral" email={job.emails.referral}>
            <div className="grid grid-cols-2 gap-3">
              <SelectField
                label="Status"
                value={job.referral_status}
                tone={REFERRAL_TONES[job.referral_status]}
                options={options(REFERRAL_LABELS)}
                onChange={(referral_status) => save({ referral_status })}
              />
              <DateField label="Asked on" value={job.asked_on} onChange={(asked_on) => save({ asked_on })} />
            </div>
            <AutosaveInput
              label="Referral contact"
              placeholder="Add a name"
              value={job.referral_contact}
              onSave={(v) => save({ referral_contact: v })}
            />
            <MessagePanel title="Referral message" message={job.messages.referral} />
            <MessagePanel title="Follow-up message" message={job.messages.follow_up} />
          </TrackPanel>
        </div>

        {/* Extras: priority, follow-up date, notes */}
        <div className="grid gap-3 md:grid-cols-[180px_180px_minmax(0,1fr)] md:items-end md:gap-4">
          <div className="grid grid-cols-2 gap-3 md:contents">
            <SelectField
              label="Priority"
              value={job.priority}
              options={options(PRIORITY_LABELS)}
              onChange={(priority) => save({ priority })}
            />
            <DateField
              label="Follow-up"
              value={job.follow_up_date}
              due={job.is_due}
              suffix={job.is_due ? "due" : undefined}
              onChange={(follow_up_date) => save({ follow_up_date })}
            />
          </div>
          <AutosaveInput label="Notes" value={job.notes} onSave={(v) => save({ notes: v })} />
        </div>

        {/* Footer */}
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-line pt-3">
          <span className="font-mono text-xs text-ink-muted">Found {shortDate(job.date_found)}</span>
          <span className="flex-1" />
          <CheckboxField
            label="Emails reversed"
            checked={job.emails_reversed}
            title="Swaps which email you used for each track on this job"
            onChange={(emails_reversed) => save({ emails_reversed })}
          />
          <RemoveButton job={job} />
        </div>
      </div>
    </article>
  );
}
