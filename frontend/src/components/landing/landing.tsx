"use client";

import Link from "next/link";

import { Brand } from "@/components/brand";
import { ThemeToggle } from "@/components/theme-toggle";
import { JobCard } from "@/components/jobs/job-card";
import { PipelineCounts } from "@/components/jobs/pipeline-counts";
import { RailsHero, TrackDemo } from "@/components/landing/rails";
import { Button } from "@/components/ui/button";
import type { Job, PipelineCounts as Counts } from "@/lib/queries";
import { cn } from "@/lib/utils";

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
    <div className="relative h-[560px] overflow-hidden rounded-2xl border border-line bg-card md:h-[640px]">
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
        <JobCard job={SAMPLE_JOB} defaultOpen />
      </div>
      <span aria-hidden className="absolute inset-x-0 bottom-0 h-[120px] bg-gradient-to-b from-page/0 to-page" />
    </div>
  );
}

// ---------------------------------------------------------------- page

const DUE_SAMPLE = [
  { title: "Follow up with Rohit at Razorpay", sub: "Referral asked 6 days ago", why: "due today", late: true, track: "var(--referral)" },
  { title: "Check status at Postman", sub: "Applied directly 9 days ago", why: "1 day late", late: true, track: "var(--direct)" },
  { title: "Send resume to Arjun at Freshworks", sub: "Referral link received", why: "tomorrow", late: false, track: "var(--referral)" },
  { title: "Prep for CRED interview round 2", sub: "Interviewing", why: "in 3 days", late: false, track: "var(--direct)" },
];

export function Landing() {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="border-b border-line bg-card">
        <div className="mx-auto flex h-14 max-w-[1440px] items-center gap-2 px-4 md:h-16 md:px-8">
          <Brand href="/" />
          <span className="flex-1" />
          <ThemeToggle />
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
          <RailsHero />
        </section>

        <section aria-label="Try it" className="flex flex-col gap-8">
          <div className="flex max-w-[640px] flex-col gap-3">
            <h2 className="text-[30px] leading-[1.1] font-semibold tracking-[-0.015em] text-ink md:text-[44px]">
              Move a job forward and watch it follow.
            </h2>
            <p className="text-[17px] leading-7 text-ink-muted">
              Pick a track, then advance the card. Each job keeps its direct application and its referral side by
              side, so nothing sits in a spreadsheet cell you forgot about.
            </p>
          </div>
          <TrackDemo />
        </section>

        <section aria-label="Reminders" className="flex flex-col gap-10 md:flex-row md:items-start md:gap-14">
          <div className="flex flex-1 flex-col gap-5">
            <h2 className="text-[30px] leading-[1.1] font-semibold tracking-[-0.015em] text-ink md:text-[40px]">
              Open it in the morning. Know what is due.
            </h2>
            <p className="max-w-[480px] text-[17px] leading-7 text-ink-muted">
              Set a follow-up date and get a morning email listing what is due. Nothing due means no email. Every job
              also has a referral and a follow-up message filled in with your profile. Copy, paste, send.
            </p>
            <span className="self-start rounded-md bg-chip px-2 py-0.5 text-xs font-semibold text-ink-muted">
              WhatsApp reminders: coming soon
            </span>
          </div>
          <ul className="flex flex-1 flex-col gap-2.5">
            {DUE_SAMPLE.map((d) => (
              <li key={d.title} className="nudge flex items-center gap-4 rounded-[14px] bg-card px-5 py-4">
                <span aria-hidden className="size-2.5 flex-none rounded-full" style={{ background: d.track }} />
                <span className="min-w-0 flex-1">
                  <span className="block font-medium text-ink">{d.title}</span>
                  <span className="mt-0.5 block font-mono text-xs text-ink-muted">{d.sub}</span>
                </span>
                <span className={cn("font-mono text-xs font-medium", d.late ? "text-due" : "text-ink-muted")}>{d.why}</span>
              </li>
            ))}
          </ul>
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
