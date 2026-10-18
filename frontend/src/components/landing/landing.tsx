"use client";

import Link from "next/link";

import { Brand } from "@/components/brand";
import { JobCard } from "@/components/jobs/job-card";
import { PipelineCounts } from "@/components/jobs/pipeline-counts";
import { Button } from "@/components/ui/button";
import type { Job, PipelineCounts as Counts } from "@/lib/queries";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------- hero visual

type Step = { label: string; state: "done" | "current" | "todo" };

/** One track drawn as a rail of steps (Figma "Two tracks visual"). */
function Rail({ track, steps }: { track: "direct" | "referral"; steps: Step[] }) {
  const color = track === "direct" ? "bg-direct" : "bg-referral";
  const text = track === "direct" ? "text-direct" : "text-referral";
  const ring = track === "direct" ? "border-direct-tint" : "border-referral-tint";
  return (
    <div className="flex flex-col gap-3">
      <p className={cn("flex items-center gap-2 text-[13px] font-semibold", text)}>
        <span aria-hidden className={cn("size-2 rounded-full", color)} />
        {track === "direct" ? "Direct apply" : "Referral"}
      </p>
      <ol className="flex items-start">
        {steps.map((s, i) => (
          <li key={s.label} className={cn("flex items-start", i > 0 && "flex-1")}>
            {i > 0 && (
              <span aria-hidden className="flex-1 px-1 pt-1.5">
                <span className={cn("block h-0.5 rounded-[1px]", s.state === "todo" ? "bg-line" : color)} />
              </span>
            )}
            <span
              className={cn(
                "flex flex-col gap-2",
                i === 0 ? "items-start" : i === steps.length - 1 ? "items-end" : "items-center",
              )}
            >
              <span
                aria-hidden
                className={cn(
                  "size-3.5 rounded-full",
                  s.state === "todo" ? "border-[1.5px] border-[#b8c1ca] bg-white" : color,
                  s.state === "current" && cn("border-4", ring),
                )}
              />
              <span
                className={cn(
                  "text-xs whitespace-nowrap",
                  s.state === "current" ? cn("font-semibold", text) : s.state === "todo" ? "text-ink-muted" : "text-ink",
                )}
              >
                {s.label}
              </span>
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function TwoTracksVisual() {
  return (
    <div
      aria-label="Example job with both tracks"
      className="flex w-full flex-col gap-6 rounded-2xl border border-line bg-white p-5 shadow-[0_4px_16px_rgba(23,33,43,0.12)] md:w-[500px] md:shrink-0 md:p-7"
    >
      <div className="flex items-center gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="font-heading text-[22px] font-semibold text-ink">Razorpay</span>
          <span className="text-sm text-ink-muted">SDE-1 Backend · Bengaluru</span>
        </div>
        <span className="rounded-md bg-due-tint px-2 py-0.5 text-xs font-semibold text-due">Follow up today</span>
      </div>
      <Rail
        track="direct"
        steps={[
          { label: "Not applied", state: "done" },
          { label: "Applied", state: "current" },
          { label: "Interviewing", state: "todo" },
          { label: "Offer", state: "todo" },
        ]}
      />
      <Rail
        track="referral"
        steps={[
          { label: "Not asked", state: "done" },
          { label: "Asked", state: "done" },
          { label: "Referred", state: "current" },
          { label: "Applied", state: "todo" },
        ]}
      />
      <div className="flex items-center gap-2.5 rounded-[10px] bg-page py-2.5 pr-2.5 pl-3.5">
        <span className="flex-1 text-[13px] text-ink">Follow-up for Rohit is ready to send</span>
        <span className="rounded-lg bg-ink px-3 py-2 text-[13px] font-semibold text-white">Copy follow-up</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- jobs preview (sample data)

const SAMPLE_COUNTS: Counts = {
  all_jobs: 24,
  direct: { not_applied: 9, applied: 8, interviewing: 3, offer: 1, rejected: 3 },
  referral: {
    not_asked: 10,
    asked: 6,
    referred_internally: 3,
    referral_link_received: 1,
    applied_via_referral: 2,
    interviewing: 1,
    offer: 0,
    rejected: 0,
    no_response: 1,
  },
  follow_up_due: 3,
  emails_reversed: 1,
};

const SAMPLE_JOB: Job = {
  id: "sample",
  company: "Razorpay",
  role: "SDE-1 Backend",
  location: "Bengaluru",
  experience_asked: "1–3 yrs",
  apply_url: "https://razorpay.com/jobs/",
  source: "LinkedIn Jobs",
  priority: "high",
  date_found: "2026-10-10",
  notes: "Rohit said the team is hiring two backend folks",
  direct_status: "applied",
  applied_on: "2026-10-12",
  referral_status: "asked",
  referral_contact: "Rohit Mehra",
  asked_on: "2026-10-12",
  company_linkedin_url: "https://www.linkedin.com/company/razorpay/",
  recruiter_name: "Priya Nair",
  recruiter_linkedin_url: "https://www.linkedin.com/",
  follow_up_date: "2026-10-17",
  snoozed_at: null,
  emails_reversed: false,
  stage: "referral",
  created_at: "2026-10-10T00:00:00Z",
  updated_at: "2026-10-10T00:00:00Z",
  is_due: true,
  emails: { direct: "you.applies@gmail.com", referral: "you@gmail.com" },
  messages: {
    referral: { text: "", blanks: [] },
    follow_up: { text: "", blanks: [] },
  },
  linkedin: {
    company_page: "https://www.linkedin.com/company/razorpay/",
    recruiter: "https://www.linkedin.com/",
    find_recruiters: "https://www.linkedin.com/search/results/people/?keywords=Razorpay%20recruiter",
    find_engineers: "https://www.linkedin.com/search/results/people/?keywords=Razorpay%20software%20engineer",
  },
};

/** The real Jobs components with sample data, made inert so nothing can be clicked. */
function JobsPreview() {
  return (
    <div className="relative h-[560px] overflow-hidden rounded-2xl border border-line bg-white md:h-[640px]">
      <div className="flex items-center gap-1.5 border-b border-line px-3.5 py-2.5" aria-hidden>
        <span className="size-2.5 rounded-full bg-line" />
        <span className="size-2.5 rounded-full bg-line" />
        <span className="size-2.5 rounded-full bg-line" />
        <span className="ml-2 text-xs font-medium text-ink-muted">Jobs</span>
      </div>
      <div inert className="flex flex-col gap-4 bg-page p-3 md:p-6">
        <PipelineCounts
          counts={SAMPLE_COUNTS}
          filters={{}}
          directEmail="you.applies@gmail.com"
          referralEmail="you@gmail.com"
          onFilter={() => {}}
        />
        <JobCard job={SAMPLE_JOB} />
      </div>
      <span aria-hidden className="absolute inset-x-0 bottom-0 h-[120px] bg-gradient-to-b from-page/0 to-page" />
    </div>
  );
}

// ---------------------------------------------------------------- page

const FEATURES = [
  {
    title: "Two tracks per job",
    body: "Track the direct application and the referral side by side, each with its own status and date.",
    border: "border-direct",
  },
  {
    title: "Reminders that find you",
    body: "Set a follow-up date and get a morning email listing what is due. Nothing due means no email.",
    border: "border-due",
    badge: "WhatsApp reminders: coming soon",
  },
  {
    title: "Referral messages in one click",
    body: "Every job has a referral and a follow-up message filled in with your profile and the job. Copy, paste, send.",
    border: "border-referral",
  },
];

export function Landing() {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex h-14 max-w-[1440px] items-center gap-2 px-4 md:h-16 md:px-8">
          <Brand href="/" />
          <span className="flex-1" />
          <Button variant="outline" size="sm" nativeButton={false} render={<Link href="/login" />}>
            Log in
          </Button>
          <Button size="sm" className="hidden sm:inline-flex" nativeButton={false} render={<Link href="/signup" />}>
            Get started free
          </Button>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-[1104px] flex-col gap-16 px-4 pt-10 pb-16 md:gap-[88px] md:px-8 md:pt-[72px] md:pb-24">
        <section className="flex flex-col gap-10 md:flex-row md:items-center md:gap-[72px] md:pt-8 md:pb-6">
          <div className="flex flex-1 flex-col gap-6">
            <h1 className="text-[40px] leading-[44px] font-bold tracking-[-0.02em] text-ink md:text-[64px] md:leading-[66px]">
              Run your job search without the spreadsheet.
            </h1>
            <p className="text-[17px] leading-7 text-ink-muted md:text-[19px] md:leading-[30px]">
              Job Hunt Companion sets itself up from your resume, tracks the direct application and the referral
              for every job, and tells you who to follow up with today.
            </p>
            <div className="flex gap-3 pt-2">
              <Button nativeButton={false} render={<Link href="/signup" />}>
                Get started free
              </Button>
              <Button variant="outline" nativeButton={false} render={<Link href="/login" />}>
                Log in
              </Button>
            </div>
            <p className="text-[13px] text-ink-muted">Free during the pilot. Export your data as CSV any time.</p>
          </div>
          <TwoTracksVisual />
        </section>

        <section aria-label="Features" className="grid gap-8 md:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.title} className={cn("flex flex-col gap-2.5 border-t-[3px] pt-5", f.border)}>
              <h2 className="text-[22px] font-semibold text-ink">{f.title}</h2>
              <p className="text-[15px] leading-6 text-ink-muted">{f.body}</p>
              {f.badge && (
                <span className="self-start rounded-md bg-[#eceff2] px-2 py-0.5 text-xs font-semibold text-ink-muted">
                  {f.badge}
                </span>
              )}
            </div>
          ))}
        </section>

        <section className="flex flex-col gap-6">
          <h2 className="text-[26px] font-semibold text-ink md:text-[32px]">Your whole search on one screen</h2>
          <JobsPreview />
        </section>

        <footer className="flex flex-col gap-1 pt-6 md:flex-row md:items-center md:gap-4">
          <span className="font-heading text-base font-semibold text-ink">Job Hunt Companion</span>
          <span className="text-sm text-ink-muted">Built for engineers running a job search in the evenings.</span>
        </footer>
      </main>
    </div>
  );
}
