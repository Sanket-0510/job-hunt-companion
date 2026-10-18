"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { SelectField } from "@/components/ui/controls";
import { Field } from "@/components/ui/field";
import { toast } from "@/components/ui/toaster";
import { ApiError, type Schemas } from "@/lib/api";
import {
  DIRECT_LABELS,
  DIRECT_TONES,
  PRIORITY_LABELS,
  REFERRAL_LABELS,
  REFERRAL_TONES,
} from "@/lib/format";
import { type JobCreate, useCreateJob } from "@/lib/jobs";

const options = <T extends string>(labels: Record<T, string>) =>
  (Object.keys(labels) as T[]).map((value) => ({ value, label: labels[value] }));

const EMPTY = {
  company: "",
  role: "",
  location: "",
  experience_asked: "",
  apply_url: "",
  source: "",
  referral_contact: "",
  notes: "",
};

/** Inline "Add a job" panel under the toolbar (spec S5 item 4). */
export function AddJobPanel({ onClose }: { onClose: () => void }) {
  const create = useCreateJob();
  const [text, setText] = useState(EMPTY);
  const [priority, setPriority] = useState<Schemas["JobPriority"]>("medium");
  const [direct, setDirect] = useState<Schemas["DirectStatus"]>("not_applied");
  const [referral, setReferral] = useState<Schemas["ReferralStatus"]>("not_asked");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const bind = (key: keyof typeof EMPTY) => ({
    value: text[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => setText((t) => ({ ...t, [key]: e.target.value })),
    error: errors[key],
  });

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const missing: Record<string, string> = {};
    if (!text.company.trim()) missing.company = "Add the company name.";
    if (!text.role.trim()) missing.role = "Add the role.";
    setErrors(missing);
    if (Object.keys(missing).length) return;

    let applyUrl = text.apply_url.trim();
    if (applyUrl && !/^https?:\/\//i.test(applyUrl)) applyUrl = `https://${applyUrl}`;
    const body: JobCreate = {
      company: text.company.trim(),
      role: text.role.trim(),
      priority,
      direct_status: direct,
      referral_status: referral,
    };
    for (const key of ["location", "experience_asked", "source", "referral_contact", "notes"] as const) {
      if (text[key].trim()) body[key] = text[key].trim();
    }
    if (applyUrl) body.apply_url = applyUrl;

    try {
      await create.mutateAsync(body);
      toast(`Added ${body.company}`);
      setText(EMPTY);
      onClose();
    } catch (err) {
      if (err instanceof ApiError && err.code === "validation_error") {
        setErrors(
          Object.fromEntries(
            Object.keys(err.fields).map((k) => [k, k === "apply_url" ? "Enter a full link, e.g. https://…" : err.fields[k]]),
          ),
        );
      } else {
        toast("Couldn't save the job. Try again.", "error");
      }
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      aria-label="Add a job"
      className="flex flex-col gap-4 rounded-xl border-2 border-ink bg-white p-4 md:p-6"
    >
      <div className="flex items-start gap-2">
        <div className="flex flex-1 flex-col gap-1 md:flex-row md:items-baseline md:gap-2">
          <h2 className="text-xl font-semibold text-ink">Add a job</h2>
          <p className="text-[13px] text-ink-muted">Company and role are required. Everything else can wait.</p>
        </div>
        <button type="button" aria-label="Close" onClick={onClose} className="px-1 text-xl leading-none text-ink-muted hover:text-ink">
          ×
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Field label="Company (required)" autoFocus {...bind("company")} />
        <Field label="Role (required)" {...bind("role")} />
        <Field label="Location" {...bind("location")} />
        <Field label="Experience asked" placeholder="e.g. 1–3 yrs" {...bind("experience_asked")} />
        <Field label="Apply link" type="url" inputMode="url" {...bind("apply_url")} />
        <Field label="Source" placeholder="LinkedIn, careers page, friend…" {...bind("source")} />
      </div>
      <div className="grid gap-4 md:grid-cols-4 md:items-end">
        <SelectField label="Priority" value={priority} options={options(PRIORITY_LABELS)} onChange={setPriority} />
        <SelectField
          label="Direct apply status"
          value={direct}
          tone={DIRECT_TONES[direct]}
          options={options(DIRECT_LABELS)}
          onChange={setDirect}
        />
        <SelectField
          label="Referral status"
          value={referral}
          tone={REFERRAL_TONES[referral]}
          options={options(REFERRAL_LABELS)}
          onChange={setReferral}
        />
        <Field label="Referral contact" placeholder="Name of the person you ask" {...bind("referral_contact")} />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="add-job-notes" className="text-[13px] font-medium text-ink">
          Notes
        </label>
        <textarea
          id="add-job-notes"
          rows={3}
          value={text.notes}
          onChange={(e) => setText((t) => ({ ...t, notes: e.target.value }))}
          className="rounded-lg border border-line bg-white px-3 py-2.5 text-sm text-ink"
        />
      </div>
      <div className="flex gap-2">
        <Button type="submit" disabled={create.isPending}>
          {create.isPending ? "Saving…" : "Save job"}
        </Button>
        <Button type="button" variant="ghost" onClick={onClose}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
