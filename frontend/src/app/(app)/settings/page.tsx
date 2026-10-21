"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { AutosaveInput, SelectField } from "@/components/ui/controls";
import { Field } from "@/components/ui/field";
import { TagInput } from "@/components/ui/tag-input";
import { toast } from "@/components/ui/toaster";
import { API_URL, ApiError, api, unwrap, type Schemas } from "@/lib/api";
import { longDate } from "@/lib/format";
import {
  type Profile,
  type ProfileUpdate,
  getResume,
  keys,
  uploadResume,
  useProfile,
  useUpdateProfile,
} from "@/lib/queries";
import { cn } from "@/lib/utils";

type Parsed = Schemas["ParsedResume"];

const SECTIONS = [
  { id: "profile", label: "Profile" },
  { id: "emails", label: "Emails" },
  { id: "templates", label: "Message templates" },
  { id: "reminders", label: "Reminders" },
  { id: "data", label: "Data" },
] as const;

function Card({
  id,
  title,
  subtitle,
  danger,
  children,
}: {
  id: (typeof SECTIONS)[number]["id"];
  title: string;
  subtitle?: string;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      className={cn(
        "enter-up scroll-mt-32 overflow-hidden md:scroll-mt-24 rounded-xl border bg-card",
        danger ? "border-destructive" : "border-line",
      )}
    >
      <div className="flex flex-col gap-1 border-b border-line px-4 py-4 md:px-6">
        <h2 className="text-xl font-semibold text-ink">{title}</h2>
        {subtitle && <p className="text-sm text-ink-muted">{subtitle}</p>}
      </div>
      <div className="flex flex-col gap-5 p-4 md:p-6">{children}</div>
    </section>
  );
}

/** Two fields side by side on desktop, stacked on phones. */
function Row({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-5 md:grid-cols-2">{children}</div>;
}

function SectionNav() {
  return (
    <nav
      aria-label="Settings sections"
      className="sticky top-14 z-20 -mx-4 border-b border-line bg-page px-4 py-2 md:top-6 md:z-auto md:mx-0 md:self-start md:border-0 md:bg-transparent md:p-0"
    >
      <ul className="flex gap-1.5 overflow-x-auto md:flex-col md:gap-0.5 md:overflow-visible">
        {SECTIONS.map((sec) => (
          <li key={sec.id} className="shrink-0">
            <a
              href={`#${sec.id}`}
              className="press block rounded-full border border-line bg-card px-3.5 py-1.5 text-sm font-medium whitespace-nowrap text-ink-muted transition-colors hover:bg-chip hover:text-ink md:rounded-lg md:border-0 md:bg-transparent md:px-3"
            >
              {sec.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

function withHttps(url: string): string | null {
  const v = url.trim();
  if (!v) return null;
  return /^https?:\/\//i.test(v) ? v : `https://${v}`;
}

function errorText(err: unknown): string {
  if (err instanceof ApiError && err.code === "validation_error") {
    const [field, msg] = Object.entries(err.fields)[0] ?? [];
    return field ? `${field.replace(/_/g, " ")}: ${msg}` : err.message;
  }
  return err instanceof Error ? err.message : "Couldn't save. Try again.";
}

// ---------------------------------------------------------------- resume

const MAX_BYTES = 5 * 1024 * 1024;

function ResumeBox({ profile, onParsed }: { profile: Profile; onParsed: (p: Parsed) => void }) {
  const qc = useQueryClient();
  const input = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<"idle" | "reading" | "failed">("idle");
  const resume = useQuery({
    queryKey: ["resume", profile.active_resume_id],
    queryFn: () => getResume(profile.active_resume_id!),
    enabled: Boolean(profile.active_resume_id),
  });

  async function replace(file: File) {
    if (file.size > MAX_BYTES) {
      toast("That file is over 5 MB. Try a smaller PDF.", "error");
      return;
    }
    setStatus("reading");
    try {
      let r = await uploadResume(file);
      qc.invalidateQueries({ queryKey: keys.profile });
      const started = Date.now();
      while (r.parse_status === "pending" || r.parse_status === "running") {
        if (Date.now() - started > 60_000) break;
        await new Promise((res) => setTimeout(res, 1500));
        r = await getResume(r.id);
      }
      if (r.parse_status === "done" && r.parsed_data) {
        setStatus("idle");
        onParsed(r.parsed_data);
        toast("Resume read. Check the fields above, then Save profile.", "default", 4000);
      } else {
        setStatus("failed");
      }
    } catch (err) {
      setStatus("failed");
      toast(err instanceof ApiError ? err.message : "Upload failed. Try again.", "error");
    }
  }

  const file = resume.data;
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[13px] font-medium text-ink">Resume</span>
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-line p-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-chip font-mono text-[10px] text-ink-muted">
          PDF
        </span>
        <span className="flex min-w-[140px] flex-1 flex-col">
          <span className="truncate text-sm font-medium text-ink">
            {status === "reading" ? "Reading your resume…" : (file?.original_filename ?? "No resume uploaded")}
          </span>
          <span className={cn("text-[13px]", status === "failed" ? "text-destructive" : "text-ink-muted")}>
            {status === "failed"
              ? "We couldn't read that file. Your details are unchanged."
              : file
                ? `Uploaded ${longDate(file.created_at.slice(0, 10))}`
                : "PDF up to 5 MB"}
          </span>
        </span>
        <Button variant="outline" size="sm" disabled={status === "reading"} onClick={() => input.current?.click()}>
          {file ? "Replace resume" : "Upload resume"}
        </Button>
        <input
          ref={input}
          type="file"
          accept="application/pdf,.pdf"
          className="sr-only"
          tabIndex={-1}
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (f) replace(f);
          }}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- profile

function ProfileCard({ profile }: { profile: Profile }) {
  const update = useUpdateProfile();
  const [f, setF] = useState(() => ({
    full_name: profile.full_name ?? "",
    target_role: profile.target_role ?? "",
    years: profile.years_experience != null ? String(Number(profile.years_experience)) : "",
    cities: profile.preferred_cities,
    skills: profile.skills,
    companies: profile.past_companies,
    highlights: profile.highlights ?? "",
    resume_link: profile.resume_link ?? "",
    linkedin_url: profile.linkedin_url ?? "",
    whatsapp: profile.whatsapp_number ?? "",
  }));
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((s) => ({ ...s, [k]: v }));
  const years = Array.from({ length: 21 }, (_, i) => String(i));
  if (f.years && !years.includes(f.years)) years.push(f.years);

  function applyParsed(p: Parsed) {
    setF((s) => ({
      ...s,
      full_name: p.full_name || s.full_name,
      skills: p.skills?.length ? p.skills : s.skills,
      companies: p.past_companies?.length ? p.past_companies : s.companies,
    }));
  }

  async function save() {
    const body: ProfileUpdate = {
      full_name: f.full_name.trim() || null,
      target_role: f.target_role.trim() || null,
      years_experience: f.years === "" ? null : Number(f.years),
      preferred_cities: f.cities,
      skills: f.skills,
      past_companies: f.companies,
      highlights: f.highlights.trim() || null,
      resume_link: withHttps(f.resume_link),
      linkedin_url: withHttps(f.linkedin_url),
      whatsapp_number: f.whatsapp.trim() || null,
    };
    try {
      await update.mutateAsync(body);
      toast("Saved");
    } catch (err) {
      toast(`Couldn't save: ${errorText(err)}`, "error", 5000);
    }
  }

  return (
    <Card id="profile" title="Profile" subtitle="Used in your messages and the Jobs header.">
      <Row>
        <Field label="Full name" value={f.full_name} onChange={(e) => set("full_name", e.target.value)} />
        <Field label="Target role" value={f.target_role} onChange={(e) => set("target_role", e.target.value)} helper="For example, SDE-1 Backend" />
        <SelectField
          label="Years of experience"
          value={f.years}
          options={[{ value: "", label: "Choose" }, ...years.map((y) => ({ value: y, label: y === "1" ? "1 year" : `${y} years` }))]}
          onChange={(v) => set("years", v)}
        />
        <Field label="LinkedIn URL" type="url" inputMode="url" placeholder="linkedin.com/in/…" value={f.linkedin_url} onChange={(e) => set("linkedin_url", e.target.value)} />
      </Row>
      <Row>
        <TagInput label="Preferred cities" values={f.cities} onChange={(v) => set("cities", v)} placeholder="Add a city" helper="The first city is your preferred one." starFirst />
        <TagInput label="Skills" values={f.skills} onChange={(v) => set("skills", v)} placeholder="Add a skill" />
      </Row>
      <TagInput
        label="Past companies"
        values={f.companies.map((c) => c.company)}
        onChange={(names) => set("companies", names.map((n) => f.companies.find((c) => c.company === n) ?? { company: n }))}
        placeholder="Add a company"
        max={30}
      />
      <div className="flex flex-col gap-1.5">
        <label htmlFor="highlights" className="text-[13px] font-medium text-ink">
          Highlights line
        </label>
        <textarea
          id="highlights"
          rows={3}
          value={f.highlights}
          onChange={(e) => set("highlights", e.target.value)}
          placeholder="I've worked at PhonePe, SuperMoney (Flipkart) and as an LFX mentee with Hyperledger."
          className="rounded-lg border border-line bg-card px-3 py-2.5 text-base text-ink md:text-sm"
        />
        <p className="text-xs text-ink-muted">One sentence that goes into your referral message.</p>
      </div>
      <ResumeBox profile={profile} onParsed={applyParsed} />
      <Row>
        <Field
          label="Resume link (Google Drive)"
          type="url"
          inputMode="url"
          placeholder="drive.google.com/…"
          value={f.resume_link}
          onChange={(e) => set("resume_link", e.target.value)}
          helper="Messages use this as {resume link}. Set sharing to 'Anyone with the link'."
        />
        <Field
          label="WhatsApp number (optional)"
          type="tel"
          inputMode="tel"
          placeholder="+91 98xxx xxxxx"
          value={f.whatsapp}
          onChange={(e) => set("whatsapp", e.target.value)}
          helper="We'll use this when WhatsApp reminders launch"
        />
      </Row>
      <div className="flex border-t border-line pt-4 md:justify-end">
        <Button className="w-full md:w-auto" onClick={save} disabled={update.isPending}>
          {update.isPending ? "Saving…" : "Save profile"}
        </Button>
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------- emails

function EmailsCard({ profile }: { profile: Profile }) {
  const update = useUpdateProfile();
  const save = (body: ProfileUpdate) =>
    update.mutate(body, {
      onSuccess: () => toast("Saved", "default", 1500),
      onError: () => toast("That doesn't look like an email address.", "error"),
    });
  return (
    <Card id="emails" title="Emails" subtitle="Shown on each track so you know which inbox to watch.">
      <Row>
        <div className="[&_input]:font-mono">
          <AutosaveInput label="Email for direct applies" value={profile.direct_email} onSave={(v) => save({ direct_email: v })} />
        </div>
        <div className="[&_input]:font-mono">
          <AutosaveInput label="Email for referrals" value={profile.referral_email} onSave={(v) => save({ referral_email: v })} />
        </div>
      </Row>
    </Card>
  );
}

// ---------------------------------------------------------------- templates

const FIELDS = ["[Name]", "[Role]", "[Company]", "[link]", "{full name}", "{years}", "{skills}", "{resume link}", "{highlights}"];

function TemplatesCard({ profile }: { profile: Profile }) {
  const update = useUpdateProfile();
  const defaults = useQuery({ queryKey: ["templates"], queryFn: () => unwrap(api.GET("/messages/templates")) });
  const [referral, setReferral] = useState<string | null>(null);
  const [followUp, setFollowUp] = useState<string | null>(null);
  const d = defaults.data;
  const referralText = referral ?? profile.referral_template ?? d?.referral_default ?? "";
  const followUpText = followUp ?? profile.follow_up_template ?? d?.follow_up_default ?? "";

  async function save(reset = false) {
    if (!d) return;
    // Wording equal to the default is stored as null, so future default improvements apply.
    const norm = (text: string, def: string) => (reset || text.trim() === def.trim() ? null : text);
    try {
      await update.mutateAsync({
        referral_template: norm(referralText, d.referral_default),
        follow_up_template: norm(followUpText, d.follow_up_default),
      });
      setReferral(null);
      setFollowUp(null);
      toast(reset ? "Templates reset to default" : "Templates saved");
    } catch (err) {
      toast(`Couldn't save: ${errorText(err)}`, "error");
    }
  }

  const area =
    "min-h-[220px] rounded-lg border border-line bg-card px-3 py-2.5 text-base leading-5 text-ink md:text-sm";
  return (
    <Card id="templates" title="Message templates" subtitle="Your wording for the copy-ready messages on every job.">
      <Row>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="tpl-referral" className="text-[13px] font-medium text-ink">Referral message</label>
          <textarea id="tpl-referral" className={cn(area, "flex-1")} value={referralText} onChange={(e) => setReferral(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="tpl-followup" className="text-[13px] font-medium text-ink">Follow-up message</label>
          <textarea id="tpl-followup" className={cn(area, "flex-1")} value={followUpText} onChange={(e) => setFollowUp(e.target.value)} />
        </div>
      </Row>
      <div className="flex flex-col gap-2">
        <span className="text-[13px] font-medium text-ink">Fill-in fields</span>
        <div className="flex flex-wrap gap-1.5">
          {FIELDS.map((f) => (
            <code
              key={f}
              title={d?.fields[f]}
              className={cn("rounded-md px-2 py-0.5 font-mono text-xs", f === "[Name]" ? "bg-due-tint text-due" : "bg-chip text-ink")}
            >
              {f}
            </code>
          ))}
        </div>
        <p className="text-xs text-ink-muted">[Name] stays blank for you to type. The rest fills in from the job and your profile.</p>
      </div>
      <div className="flex flex-col-reverse gap-2 border-t border-line pt-4 sm:flex-row sm:justify-end">
        <Button variant="ghost" className="w-full sm:w-auto" onClick={() => save(true)} disabled={update.isPending || !d}>Reset to default</Button>
        <Button className="w-full sm:w-auto" onClick={() => save()} disabled={update.isPending || !d}>
          Save templates
        </Button>
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------- reminders

function timeLabel(hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}
const TIMES = Array.from({ length: 48 }, (_, i) => `${String(Math.floor(i / 2)).padStart(2, "0")}:${i % 2 ? "30" : "00"}`);

function RemindersCard({ profile }: { profile: Profile }) {
  const update = useUpdateProfile();
  const [zones] = useState<string[]>(() => {
    try {
      return Intl.supportedValuesOf("timeZone");
    } catch {
      return ["Asia/Kolkata"];
    }
  });
  const save = (body: ProfileUpdate) =>
    update.mutate(body, {
      onSuccess: () => toast("Saved", "default", 1500),
      onError: (err) => toast(`Couldn't save: ${errorText(err)}`, "error"),
    });
  const time = profile.reminder_time.slice(0, 5);
  const times = TIMES.includes(time) ? TIMES : [...TIMES, time].sort();
  const zoneList = zones.includes(profile.timezone) ? zones : [profile.timezone, ...zones];
  const radio = "size-[18px] accent-ink";

  return (
    <Card id="reminders" title="Reminders" subtitle="A morning email lists what is due. No email on days with nothing due.">
      <fieldset className="flex flex-wrap gap-x-6 gap-y-3">
        <legend className="mb-3 text-[13px] font-medium text-ink">Reminder channel</legend>
        {(["email", "none"] as const).map((c) => (
          <label key={c} className="flex items-center gap-2 text-sm text-ink">
            <input type="radio" name="channel" className={radio} checked={profile.reminder_channel === c} onChange={() => save({ reminder_channel: c })} />
            {c === "email" ? "Email" : "None"}
          </label>
        ))}
        <label className="flex items-center gap-2 text-sm text-ink-muted opacity-60">
          <input type="radio" name="channel" className={radio} disabled />
          WhatsApp
          <span className="rounded-md bg-chip px-2 py-0.5 text-xs font-semibold">Coming soon</span>
        </label>
      </fieldset>
      <Row>
        <SelectField
          label="Morning email time"
          value={time}
          options={times.map((t) => ({ value: t, label: timeLabel(t) }))}
          onChange={(t) => save({ reminder_time: `${t}:00` })}
        />
        <SelectField
          label="Timezone"
          value={profile.timezone}
          options={zoneList.map((z) => ({ value: z, label: z === "Asia/Kolkata" ? "Asia/Kolkata (IST)" : z }))}
          onChange={(timezone) => save({ timezone })}
        />
      </Row>
    </Card>
  );
}

// ---------------------------------------------------------------- data

function DataCard() {
  const router = useRouter();
  const qc = useQueryClient();
  const [confirming, setConfirming] = useState(false);
  const [typed, setTyped] = useState("");
  const [pending, setPending] = useState(false);

  async function remove() {
    setPending(true);
    try {
      await unwrap(api.DELETE("/auth/account", { body: { confirm: "DELETE" } }));
      qc.clear();
      qc.setQueryData(keys.me, null);
      router.replace("/");
    } catch {
      toast("Couldn't delete your account. Try again.", "error");
      setPending(false);
    }
  }

  return (
    <Card id="data" title="Data" subtitle="Take your jobs with you, or remove your account." danger={confirming}>
      <Row>
      <div className="flex flex-col gap-1.5">
        <Button variant="outline" className="w-full" nativeButton={false} render={<a href={`${API_URL}/jobs/export.csv`} />}>
          Export all jobs as CSV
        </Button>
        <p className="text-xs text-ink-muted">Every job and every field, ready for a spreadsheet.</p>
      </div>
      {!confirming ? (
        <div className="flex flex-col gap-1.5">
          <Button variant="outline" className="w-full text-destructive" onClick={() => setConfirming(true)}>
            Delete my account
          </Button>
          <p className="text-xs text-ink-muted">Removes your account and all your jobs.</p>
        </div>
      ) : null}
      </Row>
      {confirming && (
        <div role="alertdialog" aria-labelledby="delete-warning" className="flex flex-col gap-3 rounded-lg border border-[var(--edge-red)] bg-stage-closed-tint p-4">
          <p id="delete-warning" className="flex gap-2 text-sm font-semibold text-destructive">
            <span aria-hidden>⚠</span>
            This deletes your account and every job you&apos;ve tracked. It can&apos;t be undone. Export your jobs first if you want a copy.
          </p>
          <Field label="Type DELETE to confirm" className="[&_input]:font-mono" value={typed} onChange={(e) => setTyped(e.target.value)} autoFocus />
          <div className="flex flex-wrap gap-2">
            <Button className="bg-destructive text-white hover:bg-destructive/90" disabled={typed !== "DELETE" || pending} onClick={remove}>
              {pending ? "Deleting…" : "Delete my account"}
            </Button>
            <Button variant="ghost" onClick={() => { setConfirming(false); setTyped(""); }}>
              Keep account
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------- page

export default function SettingsPage() {
  const profile = useProfile();
  useEffect(() => {
    if (window.location.hash) document.querySelector(window.location.hash)?.scrollIntoView();
  }, [profile.data]);

  return (
    <div className="mx-auto flex max-w-[1040px] flex-col gap-5 md:gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-[28px] font-semibold text-ink md:text-4xl">Settings</h1>
        <p className="text-sm text-ink-muted">Changes here apply to every job.</p>
      </div>
      {!profile.data ? (
        <span className="mx-auto mt-10 size-6 animate-spin rounded-full border-2 border-line border-t-ink" />
      ) : (
        <div className="grid grid-cols-[minmax(0,1fr)] gap-4 md:grid-cols-[190px_minmax(0,1fr)] md:gap-8">
          <SectionNav />
          <div className="flex min-w-0 flex-col gap-5 md:gap-6">
            <ProfileCard profile={profile.data} />
            <EmailsCard profile={profile.data} />
            <TemplatesCard profile={profile.data} />
            <RemindersCard profile={profile.data} />
            <DataCard />
          </div>
        </div>
      )}
    </div>
  );
}
