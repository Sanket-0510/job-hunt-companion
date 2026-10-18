import type { Schemas } from "./api";

type DirectStatus = Schemas["DirectStatus"];
type ReferralStatus = Schemas["ReferralStatus"];
export type JobStage = Schemas["JobStage"];

export const DIRECT_LABELS: Record<DirectStatus, string> = {
  not_applied: "Not applied",
  applied: "Applied",
  interviewing: "Interviewing",
  offer: "Offer",
  rejected: "Rejected",
};

export const REFERRAL_LABELS: Record<ReferralStatus, string> = {
  not_asked: "Not asked",
  asked: "Asked",
  referred_internally: "Referred internally",
  referral_link_received: "Link received",
  applied_via_referral: "Applied via referral",
  interviewing: "Interviewing",
  offer: "Offer",
  rejected: "Rejected",
  no_response: "No response",
};

export const STAGE_LABELS: Record<JobStage, string> = {
  to_do: "To do",
  referral: "Referral",
  applied: "Applied",
  interview: "Interview",
  offer: "Offer",
  closed: "Closed",
};

/** Tailwind classes per stage: stripe colour, badge text and badge tint. */
export const STAGE_STYLES: Record<JobStage, { stripe: string; badge: string }> = {
  to_do: { stripe: "bg-stage-to-do", badge: "bg-stage-to-do-tint text-stage-to-do" },
  referral: { stripe: "bg-stage-referral", badge: "bg-stage-referral-tint text-stage-referral" },
  applied: { stripe: "bg-stage-applied", badge: "bg-stage-applied-tint text-stage-applied" },
  interview: { stripe: "bg-stage-interview", badge: "bg-stage-interview-tint text-stage-interview" },
  offer: { stripe: "bg-stage-offer", badge: "bg-stage-offer-tint text-stage-offer" },
  closed: { stripe: "bg-stage-closed", badge: "bg-stage-closed-tint text-stage-closed" },
};

/** "16 Oct" for dates in lists (IBM Plex Mono in the design). */
export function shortDate(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export function daysAgo(days: number | null | undefined): string {
  if (days == null) return "";
  if (days === 0) return "today";
  return days === 1 ? "1 day ago" : `${days} days ago`;
}

export function greeting(now = new Date()): string {
  const h = now.getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

export function initials(name: string | null | undefined, email: string): string {
  const source = name?.trim() || email.split("@")[0];
  const parts = source.split(/[\s._-]+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

export function firstName(name: string | null | undefined): string | null {
  return name?.trim().split(/\s+/)[0] || null;
}

type JobPriority = Schemas["JobPriority"];
export type JobSort = Schemas["JobSort"];

export const PRIORITY_LABELS: Record<JobPriority, string> = {
  high: "P1 · High",
  medium: "P2 · Medium",
  low: "P3 · Low",
};

export const PRIORITY_BADGE: Record<JobPriority, { text: string; className: string }> = {
  high: { text: "P1", className: "bg-stage-closed-tint text-stage-closed" },
  medium: { text: "P2", className: "bg-stage-interview-tint text-stage-interview" },
  low: { text: "P3", className: "bg-stage-to-do-tint text-stage-to-do" },
};

export const SORT_LABELS: Record<JobSort, string> = {
  priority: "Priority",
  follow_up_date: "Follow-up date",
  newest_found: "Newest found",
  company_az: "Company A–Z",
};

/** Status menus are tinted to match the status (Figma Select tones). */
export type Tone = "neutral" | "grey" | "blue" | "purple" | "amber" | "green" | "red";

export const TONE_CLASSES: Record<Tone, string> = {
  neutral: "bg-white border-line text-ink",
  grey: "bg-stage-to-do-tint border-line text-ink-muted",
  blue: "bg-stage-applied-tint border-[#b9cdee] text-stage-applied",
  purple: "bg-stage-referral-tint border-[#cfc3ec] text-stage-referral",
  amber: "bg-stage-interview-tint border-[#ecd3a3] text-stage-interview",
  green: "bg-stage-offer-tint border-[#b7e0c4] text-stage-offer",
  red: "bg-stage-closed-tint border-[#efc0bb] text-stage-closed",
};

export const DIRECT_TONES: Record<DirectStatus, Tone> = {
  not_applied: "grey",
  applied: "blue",
  interviewing: "amber",
  offer: "green",
  rejected: "red",
};

export const REFERRAL_TONES: Record<ReferralStatus, Tone> = {
  not_asked: "grey",
  asked: "purple",
  referred_internally: "purple",
  referral_link_received: "purple",
  applied_via_referral: "blue",
  interviewing: "amber",
  offer: "green",
  rejected: "red",
  no_response: "red",
};

/** "12 Oct 2026" for date fields. */
export function longDate(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
