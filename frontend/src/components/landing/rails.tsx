"use client";

import { useState, type CSSProperties } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type TrackKey = "direct" | "referral";

const TRACKS: Record<
  TrackKey,
  { name: string; color: string; tint: string; labels: string[]; hints: string[] }
> = {
  direct: {
    name: "Direct apply",
    color: "var(--direct)",
    tint: "var(--direct-tint)",
    labels: ["Saved", "Applied", "Screen", "Interview", "Offer"],
    hints: [
      "Saved for later. Nothing sent yet.",
      "Applied. A follow-up is set for 7 days from now.",
      "Recruiter screen booked. Prep notes are one tap away.",
      "In interviews. The follow-up date moves after each round.",
      "Offer in hand. Time to compare and decide.",
    ],
  },
  referral: {
    name: "Referral",
    color: "var(--referral)",
    tint: "var(--referral-tint)",
    labels: ["Asked", "Referred", "Link sent", "Applied", "Interview"],
    hints: [
      "Asked for a referral. Reminder set for 5 days.",
      "Referred internally. Now wait for the link.",
      "Referral link received. Apply through it today.",
      "Applied via the referral link. No direct apply needed.",
      "Interviewing through the referral.",
    ],
  },
};

function railStyle(track: TrackKey): CSSProperties {
  const t = TRACKS[track];
  return { "--rail": t.color, "--rail-tint": t.tint } as CSSProperties;
}

/** Looping rail for the hero: a token travels along the track and lights each step. Decorative. */
export function AnimatedRail({ track, delayed }: { track: TrackKey; delayed?: boolean }) {
  const t = TRACKS[track];
  return (
    <div className="flex flex-col gap-4">
      <p className="flex items-center gap-2 text-[13px] font-semibold" style={{ color: t.color }}>
        <span aria-hidden className="size-2 rounded-full" style={{ background: t.color }} />
        {t.name}
      </p>
      <div aria-hidden className={cn("rail-track rail-anim", delayed && "rail-delayed")} style={railStyle(track)}>
        <div className="rail-line" />
        <div className="rail-fill" />
        <div className="rail-run">
          <span className="rail-token" />
        </div>
        {t.labels.map((label, i) => (
          <span key={label} className={`rail-node rail-n${i + 1}`} style={{ left: `${i * 25}%` }} />
        ))}
        {t.labels.map((label, i) => (
          <span key={label} className="rail-label" style={{ left: `${i * 25}%` }}>
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}

export function RailsHero() {
  return (
    <div
      aria-label="Example job moving along both tracks"
      className="flex w-full flex-col gap-8 rounded-2xl border border-line bg-card p-5 shadow-[0_4px_16px_rgba(23,33,43,0.12)] md:w-[500px] md:shrink-0 md:p-7"
    >
      <div className="flex items-center gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="font-heading text-[22px] font-semibold text-ink">Razorpay</span>
          <span className="text-sm text-ink-muted">SDE-1 Backend · Bengaluru</span>
        </div>
        <span className="rounded-md bg-due-tint px-2 py-0.5 text-xs font-semibold text-due">Follow up today</span>
      </div>
      <AnimatedRail track="direct" />
      <AnimatedRail track="referral" delayed />
      <div className="flex items-center gap-2.5 rounded-[10px] bg-page py-2.5 pr-2.5 pl-3.5">
        <span className="flex-1 text-[13px] text-ink">Follow-up for Rohit is ready to send</span>
        <span className="rounded-lg bg-ink px-3 py-2 text-[13px] font-semibold text-page">Copy follow-up</span>
      </div>
    </div>
  );
}

/** Interactive demo: pick a track, advance the card, the rail fills with a transform transition. */
export function TrackDemo() {
  const [track, setTrack] = useState<TrackKey>("direct");
  const [stage, setStage] = useState(1);
  const t = TRACKS[track];
  const last = stage === t.labels.length - 1;

  return (
    <div
      className="flex flex-col gap-8 rounded-3xl bg-page p-5 md:p-10"
      style={railStyle(track)}
    >
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div role="group" aria-label="Track" className="flex gap-1.5 rounded-full bg-chip p-1">
          {(Object.keys(TRACKS) as TrackKey[]).map((k) => (
            <button
              key={k}
              type="button"
              aria-pressed={track === k}
              onClick={() => setTrack(k)}
              className={cn(
                "press min-h-11 rounded-full px-5 text-[15px] font-medium transition-colors duration-200",
                track === k ? "text-white" : "text-ink hover:bg-line/60",
              )}
              style={track === k ? { background: TRACKS[k].color } : undefined}
            >
              {TRACKS[k].name}
            </button>
          ))}
        </div>
        <span className="font-heading text-xl font-bold text-ink">Zerodha · Backend engineer</span>
      </div>

      <div className="relative mx-6 h-[72px] md:mx-14">
        <div className="rail-line" style={{ top: 21 }} />
        <div
          className="rail-fill transition-transform duration-[550ms] ease-[cubic-bezier(0.23,1,0.32,1)]"
          style={{ top: 20, transform: `scaleX(${stage / (t.labels.length - 1)})` }}
        />
        {t.labels.map((label, i) => (
          <button
            key={label}
            type="button"
            aria-label={`${label}${i === stage ? " (current)" : ""}`}
            aria-current={i === stage ? "step" : undefined}
            onClick={() => setStage(i)}
            className="absolute top-[-14px] -ml-12 flex h-[72px] w-24 cursor-pointer flex-col items-center gap-2 bg-transparent pt-3.5 text-xs"
            style={{ left: `${(i * 100) / (t.labels.length - 1)}%` }}
          >
            <span
              aria-hidden
              className="size-4 rounded-full border-2 transition-[background-color,border-color,box-shadow] duration-200"
              style={{
                background: i < stage ? t.color : "var(--card)",
                borderColor: i <= stage ? t.color : "var(--field)",
                boxShadow: i === stage ? `0 0 0 7px ${t.tint}` : undefined,
              }}
            />
            <span className={i === stage ? "font-semibold text-ink" : "text-ink-muted"}>{label}</span>
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <p aria-live="polite" className="max-w-[560px] text-base text-ink-muted">
          {t.hints[stage]}
        </p>
        <Button onClick={() => setStage(last ? 0 : stage + 1)}>
          {last ? "Start over" : `Move to ${t.labels[stage + 1]}`}
        </Button>
      </div>
    </div>
  );
}
