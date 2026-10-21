"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { RequireUser } from "@/components/auth/guards";
import { Brand } from "@/components/brand";
import { AvatarMenu } from "@/components/shell/app-shell";
import { Button } from "@/components/ui/button";
import { Icon, SelectField } from "@/components/ui/controls";
import { Field } from "@/components/ui/field";
import { TagInput } from "@/components/ui/tag-input";
import { toast } from "@/components/ui/toaster";
import { ApiError, type Schemas } from "@/lib/api";
import {
  type Profile,
  type ProfileUpdate,
  type Resume,
  getResume,
  uploadResume,
  useMarkOnboarded,
  useProfile,
  useUpdateProfile,
} from "@/lib/queries";
import { cn } from "@/lib/utils";

type Parsed = Schemas["ParsedResume"];
type PastCompany = Schemas["PastCompany"];
type Education = Schemas["Education"];

const MAX_BYTES = 5 * 1024 * 1024; // Figma copy says "PDF up to 5 MB"
const POLL_MS = 1500;
const POLL_TIMEOUT_MS = 60_000;
const STEPS = ["Resume", "About you", "How you apply"] as const;

// ---------------------------------------------------------------- layout

function Progress({ step }: { step: number }) {
  return (
    <div className="flex flex-col gap-2.5">
      <div aria-hidden className="relative h-1.5 overflow-hidden rounded-full bg-line">
        <span
          className="absolute inset-0 origin-left rounded-full bg-direct transition-transform duration-[450ms] ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-none"
          style={{ transform: `scaleX(${(step + 1) / STEPS.length})` }}
        />
      </div>
      <p className="flex gap-2 text-xs">
        <span className="font-mono text-ink-muted">
          Step {step + 1} of {STEPS.length}
        </span>
        <span className="font-semibold text-ink">{STEPS[step]}</span>
      </p>
    </div>
  );
}

function Heading({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <h1 className="text-[28px] leading-8 font-semibold text-ink">{title}</h1>
      <p className="text-[15px] leading-[22px] text-ink-muted">{subtitle}</p>
    </div>
  );
}

/** Sticky bottom bar with the step's actions (Figma "Action bar"). */
function ActionBar({ children }: { children: React.ReactNode }) {
  return (
    <div className="sticky bottom-0 -mx-4 mt-auto border-t border-line bg-card px-4 pt-3 pb-[max(28px,env(safe-area-inset-bottom))] md:static md:mx-0 md:mb-10 md:rounded-xl md:border md:pb-3">
      <div className="mx-auto flex max-w-[560px] items-center gap-2">{children}</div>
    </div>
  );
}

// ---------------------------------------------------------------- step 1: resume

type UploadState =
  | { kind: "idle" }
  | { kind: "reading"; file: File; resumeId?: string }
  | { kind: "done"; file: File; parsed: Parsed }
  | { kind: "failed"; file: File };

function kb(bytes: number) {
  return bytes < 1024 * 1024 ? `${Math.round(bytes / 1024)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function ResumeStep({
  driveLink,
  setDriveLink,
  onParsed,
  onNext,
}: {
  driveLink: string;
  setDriveLink: (v: string) => void;
  onParsed: (parsed: Parsed | null) => void;
  onNext: () => void;
}) {
  const [state, setState] = useState<UploadState>({ kind: "idle" });
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string>();
  const fileInput = useRef<HTMLInputElement>(null);
  const cancelled = useRef(false);

  // Stop polling if the user leaves the page. (Reset on mount: dev mode mounts effects twice.)
  useEffect(() => {
    cancelled.current = false;
    return () => {
      cancelled.current = true;
    };
  }, []);

  async function start(file: File) {
    setError(undefined);
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      setError("Please choose a PDF file.");
      return;
    }
    if (file.size > MAX_BYTES) {
      setError("That file is over 5 MB. Try a smaller PDF.");
      return;
    }
    setState({ kind: "reading", file });
    let resume: Resume;
    try {
      resume = await uploadResume(file);
    } catch (err) {
      setState({ kind: "failed", file });
      if (err instanceof ApiError && err.code !== "unknown") setError(err.message);
      return;
    }
    // Poll the parse status every 1.5 s, giving up after 60 s (the worker does the reading).
    const startedAt = Date.now();
    while (!cancelled.current) {
      if (resume.parse_status === "done" && resume.parsed_data) {
        setState({ kind: "done", file, parsed: resume.parsed_data });
        onParsed(resume.parsed_data);
        onNext();
        return;
      }
      if (resume.parse_status === "failed" || Date.now() - startedAt > POLL_TIMEOUT_MS) {
        setState({ kind: "failed", file });
        onParsed(null);
        return;
      }
      await new Promise((r) => setTimeout(r, POLL_MS));
      try {
        resume = await getResume(resume.id);
      } catch {
        // Network blip: keep polling until the timeout.
      }
    }
  }

  const reading = state.kind === "reading";
  const failed = state.kind === "failed";

  return (
    <>
      <div className="flex flex-col gap-6">
        <Heading
          title="Start with your resume"
          subtitle="We read it and fill in your details. You can change anything before saving."
        />

        {failed && (
          <div role="alert" className="flex gap-2.5 rounded-xl bg-stage-closed-tint px-4 py-3 text-sm font-medium text-destructive">
            <span aria-hidden>ⓘ</span>
            We couldn&apos;t read that file. Fill in the details below.
          </div>
        )}

        {state.kind === "idle" ? (
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              const f = e.dataTransfer.files[0];
              if (f) start(f);
            }}
            className={cn(
              "flex flex-col items-center gap-2.5 rounded-[14px] border-[1.5px] border-dashed bg-card px-5 py-8 text-center",
              dragging ? "border-ink bg-page" : "border-field",
            )}
          >
            <span className="flex size-11 items-center justify-center rounded-full bg-chip text-ink">
              <Icon name="upload" size={22} />
            </span>
            <p className="text-[15px] font-semibold text-ink">Drop your resume PDF here</p>
            <p className="text-[13px] text-ink-muted">PDF up to 5 MB</p>
            <Button variant="outline" size="sm" onClick={() => fileInput.current?.click()}>
              Choose file
            </Button>
            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>
        ) : (
          <div
            className={cn(
              "flex flex-col gap-3 rounded-xl border bg-card p-4",
              failed ? "border-destructive" : "border-line",
            )}
          >
            <div className="flex items-center gap-3">
              <span
                className={cn(
                  "flex size-9 shrink-0 items-center justify-center rounded-md font-mono text-[10px]",
                  failed ? "bg-stage-closed-tint text-destructive" : "bg-chip text-ink-muted",
                )}
              >
                PDF
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-sm font-medium text-ink">{state.file.name}</span>
                <span className={cn("text-[13px]", failed ? "text-destructive" : "text-ink-muted")}>
                  {failed ? "Could not be read" : `${kb(state.file.size)} · Reading your resume…`}
                </span>
              </span>
              {failed && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setState({ kind: "idle" });
                    fileInput.current?.click();
                  }}
                >
                  Replace
                </Button>
              )}
            </div>
            {reading && (
              <span className="h-1 overflow-hidden rounded-full bg-chip" aria-hidden>
                <span className="block h-full w-1/3 animate-[progress_1.2s_ease-in-out_infinite] rounded-full bg-ink" />
              </span>
            )}
            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>
        )}
        {reading && (
          <p role="status" className="flex items-center gap-2 text-sm font-medium text-ink">
            <span className="size-4 animate-spin rounded-full border-2 border-line border-t-ink" />
            Reading your resume…
          </p>
        )}

        <input
          ref={fileInput}
          type="file"
          accept="application/pdf,.pdf"
          className="sr-only"
          tabIndex={-1}
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (f) start(f);
          }}
        />

        {!reading && (
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3" aria-hidden>
              <span className="h-px flex-1 bg-line" />
              <span className="text-[13px] text-ink-muted">or</span>
              <span className="h-px flex-1 bg-line" />
            </div>
            <Field
              label="Paste Google Drive link"
              type="url"
              inputMode="url"
              placeholder="drive.google.com/…"
              value={driveLink}
              onChange={(e) => setDriveLink(e.target.value)}
              helper="Messages use this link as {resume link}. Make sure anyone with the link can view it."
            />
          </div>
        )}
      </div>
      <ActionBar>
        <Button className="flex-1" disabled={reading} onClick={onNext}>
          {failed ? "Fill in by hand" : "Continue"}
        </Button>
      </ActionBar>
    </>
  );
}

// ---------------------------------------------------------------- step 2: about you

type About = {
  full_name: string;
  target_role: string;
  years_experience: string;
  preferred_cities: string[];
  skills: string[];
  past_companies: PastCompany[];
  education: string;
  education_list: Education[];
  linkedin_url: string;
};

function educationText(list: Education[]): string {
  const e = list[0];
  if (!e) return "";
  return [e.degree, e.institution].filter(Boolean).join(", ") + (e.year ? `, ${e.year}` : "");
}

function aboutFrom(profile: Profile | undefined, parsed: Parsed | null): About {
  const pick = <T,>(a: T[] | undefined, b: T[] | undefined) => (a && a.length ? a : (b ?? []));
  const education = pick(parsed?.education, profile?.education);
  return {
    full_name: parsed?.full_name || profile?.full_name || "",
    target_role: profile?.target_role ?? "",
    years_experience: profile?.years_experience != null ? String(Number(profile.years_experience)) : "",
    preferred_cities: profile?.preferred_cities ?? [],
    skills: pick(parsed?.skills, profile?.skills),
    past_companies: pick(parsed?.past_companies, profile?.past_companies),
    education: educationText(education),
    education_list: education,
    linkedin_url: profile?.linkedin_url ?? "",
  };
}

const YEARS = Array.from({ length: 21 }, (_, i) => String(i));

function withHttps(url: string): string | null {
  const v = url.trim();
  if (!v) return null;
  return /^https?:\/\//i.test(v) ? v : `https://${v}`;
}

function fieldErrors(err: unknown): Record<string, string> {
  if (err instanceof ApiError && err.code === "validation_error") return err.fields;
  return { form: err instanceof Error ? err.message : "Couldn't save. Try again." };
}

function AboutStep({
  initial,
  fromResume,
  onBack,
  onNext,
}: {
  initial: About;
  fromResume: boolean;
  onBack: () => void;
  onNext: () => void;
}) {
  const [a, setA] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const update = useUpdateProfile();
  const set = <K extends keyof About>(k: K, v: About[K]) => setA((s) => ({ ...s, [k]: v }));
  const years = YEARS.includes(a.years_experience) || !a.years_experience ? YEARS : [...YEARS, a.years_experience];

  async function save() {
    const educationChanged = a.education.trim() !== educationText(a.education_list);
    const body: ProfileUpdate = {
      full_name: a.full_name.trim() || null,
      target_role: a.target_role.trim() || null,
      years_experience: a.years_experience === "" ? null : Number(a.years_experience),
      preferred_cities: a.preferred_cities,
      skills: a.skills,
      past_companies: a.past_companies,
      education: educationChanged ? (a.education.trim() ? [{ institution: a.education.trim() }] : []) : a.education_list,
      linkedin_url: withHttps(a.linkedin_url),
    };
    try {
      await update.mutateAsync(body);
      onNext();
    } catch (err) {
      setErrors(fieldErrors(err));
    }
  }

  return (
    <>
      <div className="flex flex-col gap-5">
        <Heading title="About you" subtitle="Check what we found and fix anything that is off." />
        {fromResume && (
          <p className="flex gap-2.5 rounded-xl bg-direct-tint px-4 py-3 text-sm font-medium text-direct">
            <span aria-hidden>✓</span>
            Filled in from your resume. Review each field before you continue.
          </p>
        )}
        <Field label="Full name" value={a.full_name} onChange={(e) => set("full_name", e.target.value)} error={errors.full_name} />
        <Field
          label="Target role"
          value={a.target_role}
          onChange={(e) => set("target_role", e.target.value)}
          helper="For example, SDE-1 Backend"
          error={errors.target_role}
        />
        <SelectField
          label="Years of experience"
          value={a.years_experience}
          options={[{ value: "", label: "Choose" }, ...years.map((y) => ({ value: y, label: y === "1" ? "1 year" : `${y} years` }))]}
          onChange={(v) => set("years_experience", v)}
        />
        <TagInput
          label="Preferred cities"
          values={a.preferred_cities}
          onChange={(v) => set("preferred_cities", v)}
          placeholder="Add a city"
          helper="The first city is your preferred one."
          starFirst
        />
        <TagInput label="Skills" values={a.skills} onChange={(v) => set("skills", v)} placeholder="Add a skill" />
        <TagInput
          label="Past companies"
          values={a.past_companies.map((c) => c.company)}
          onChange={(names) =>
            set(
              "past_companies",
              names.map((n) => a.past_companies.find((c) => c.company === n) ?? { company: n }),
            )
          }
          placeholder="Add a company"
          max={30}
        />
        <Field label="Education" value={a.education} onChange={(e) => set("education", e.target.value)} placeholder="B.E. Computer Engineering, 2021" />
        <Field
          label="LinkedIn URL"
          type="url"
          inputMode="url"
          value={a.linkedin_url}
          onChange={(e) => set("linkedin_url", e.target.value)}
          placeholder="linkedin.com/in/…"
          error={errors.linkedin_url && "Enter a full link, e.g. linkedin.com/in/you"}
        />
        {errors.form && <p className="text-sm text-destructive">{errors.form}</p>}
      </div>
      <ActionBar>
        <Button variant="ghost" onClick={onBack}>
          Back
        </Button>
        <span className="flex-1" />
        <Button variant="ghost" onClick={onNext}>
          Skip
        </Button>
        <Button onClick={save} disabled={update.isPending}>
          {update.isPending ? "Saving…" : "Continue"}
        </Button>
      </ActionBar>
    </>
  );
}

// ---------------------------------------------------------------- step 3: how you apply

function ApplyStep({ profile, driveLink, onBack }: { profile?: Profile; driveLink: string; onBack: () => void }) {
  const router = useRouter();
  const update = useUpdateProfile();
  const done = useMarkOnboarded();
  const [direct, setDirect] = useState(profile?.direct_email ?? "");
  const [referral, setReferral] = useState(profile?.referral_email ?? "");
  const [whatsapp, setWhatsapp] = useState(profile?.whatsapp_number ?? "");
  const [channel, setChannel] = useState<"email" | "none">(profile?.reminder_channel === "none" ? "none" : "email");
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function finish(save: boolean) {
    try {
      if (save) {
        await update.mutateAsync({
          direct_email: direct.trim() || null,
          referral_email: referral.trim() || null,
          whatsapp_number: whatsapp.trim() || null,
          reminder_channel: channel,
          ...(driveLink.trim() ? { resume_link: withHttps(driveLink) } : {}),
        });
      } else if (driveLink.trim()) {
        await update.mutateAsync({ resume_link: withHttps(driveLink) });
      }
      await done.mutateAsync();
      router.replace("/dashboard");
    } catch (err) {
      const e = fieldErrors(err);
      setErrors(e);
      if (e.resume_link) toast("That Drive link doesn't look right. Go back to step 1 to fix it.", "error", 5000);
    }
  }

  const pending = update.isPending || done.isPending;
  const radio = "size-[18px] accent-ink";
  return (
    <>
      <div className="flex flex-col gap-5">
        <Heading title="How you apply" subtitle="Tell us which email you use for each track. We show it on every job." />
        <Field
          label="Email for direct applies"
          type="email"
          className="[&_input]:font-mono"
          value={direct}
          onChange={(e) => setDirect(e.target.value)}
          error={errors.direct_email && "Enter a valid email address."}
        />
        <Field
          label="Email for referrals"
          type="email"
          className="[&_input]:font-mono"
          value={referral}
          onChange={(e) => setReferral(e.target.value)}
          error={errors.referral_email && "Enter a valid email address."}
        />
        <Field
          label="WhatsApp number (optional)"
          type="tel"
          inputMode="tel"
          placeholder="+91 98xxx xxxxx"
          value={whatsapp}
          onChange={(e) => setWhatsapp(e.target.value)}
          helper="We'll use this when WhatsApp reminders launch"
          error={errors.whatsapp_number}
        />
        <fieldset className="flex flex-col gap-3">
          <legend className="mb-2 text-[13px] font-medium text-ink">Reminder channel</legend>
          <label className="flex items-center gap-2 text-sm text-ink">
            <input type="radio" name="channel" className={radio} checked={channel === "email"} onChange={() => setChannel("email")} />
            Email
          </label>
          <label className="flex items-center gap-2 text-sm text-ink">
            <input type="radio" name="channel" className={radio} checked={channel === "none"} onChange={() => setChannel("none")} />
            None
          </label>
          <label className="flex items-center gap-2 text-sm text-ink-muted opacity-60">
            <input type="radio" name="channel" className={radio} disabled />
            WhatsApp
            <span className="rounded-md bg-chip px-2 py-0.5 text-xs font-semibold">Coming soon</span>
          </label>
        </fieldset>
        {errors.form && <p className="text-sm text-destructive">{errors.form}</p>}
      </div>
      <ActionBar>
        <Button variant="ghost" onClick={onBack}>
          Back
        </Button>
        <span className="flex-1" />
        <Button variant="ghost" disabled={pending} onClick={() => finish(false)}>
          Skip
        </Button>
        <Button disabled={pending} onClick={() => finish(true)}>
          {pending ? "Saving…" : "Go to my tracker"}
        </Button>
      </ActionBar>
    </>
  );
}

// ---------------------------------------------------------------- page

function Onboarding() {
  const profile = useProfile();
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [parsed, setParsed] = useState<Parsed | null>(null);
  const [driveLink, setDriveLink] = useState("");
  const [aboutKey, setAboutKey] = useState(0);

  // Already onboarded (e.g. opened /onboarding again): go to the dashboard.
  useEffect(() => {
    if (profile.data?.onboarded_at) router.replace("/dashboard");
  }, [profile.data?.onboarded_at, router]);

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [step]);

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="flex h-14 items-center border-b border-line bg-card px-4 md:h-16 md:px-8">
        <Brand href="/onboarding" />
        <span className="flex-1" />
        <AvatarMenu />
      </header>
      <main className="mx-auto flex w-full max-w-[560px] flex-1 flex-col gap-6 px-4 pt-5 md:pt-10">
        <Progress step={step} />
        {!profile.data ? (
          <span className="mx-auto size-6 animate-spin rounded-full border-2 border-line border-t-ink" />
        ) : step === 0 ? (
          <ResumeStep
            driveLink={driveLink}
            setDriveLink={setDriveLink}
            onParsed={(p) => {
              setParsed(p);
              setAboutKey((k) => k + 1);
            }}
            onNext={() => setStep(1)}
          />
        ) : step === 1 ? (
          <AboutStep
            key={aboutKey}
            initial={aboutFrom(profile.data, parsed)}
            fromResume={Boolean(parsed)}
            onBack={() => setStep(0)}
            onNext={() => setStep(2)}
          />
        ) : (
          <ApplyStep profile={profile.data} driveLink={driveLink} onBack={() => setStep(1)} />
        )}
      </main>
    </div>
  );
}

export default function OnboardingPage() {
  return (
    <RequireUser>
      <Onboarding />
    </RequireUser>
  );
}
