"use client";

import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

import { Brand } from "@/components/brand";
import { AnimatedRail } from "@/components/landing/rails";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { ApiError, api, unwrap } from "@/lib/api";
import { keys } from "@/lib/queries";

function Card({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <main className="mx-auto flex w-full max-w-[440px] flex-1 flex-col gap-8 px-4 pt-14 pb-10">
      <Brand size="lg" className="self-center" />
      <div aria-hidden className="flex flex-col gap-5 px-2">
        <AnimatedRail track="direct" />
        <AnimatedRail track="referral" delayed />
      </div>
      <div className="flex flex-col gap-5 rounded-2xl border border-line bg-card p-6 shadow-[0_4px_16px_rgba(23,33,43,0.12)]">
        <div className="flex flex-col gap-1.5">
          <h1 className="text-[26px] font-semibold text-ink">{title}</h1>
          <p className="text-[15px] text-ink-muted">{subtitle}</p>
        </div>
        {children}
        <Link href="/login" className="self-center text-sm font-semibold text-direct">
          Back to log in
        </Link>
      </div>
    </main>
  );
}

function RequestLink() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(undefined);
    try {
      await unwrap(api.POST("/auth/password-reset/request", { body: { email: email.trim() } }));
      setSent(true);
    } catch (err) {
      setError(err instanceof ApiError && err.code === "validation_error" ? "Enter a valid email address." : (err as Error).message);
    } finally {
      setPending(false);
    }
  }

  if (sent) {
    return (
      <Card title="Check your email" subtitle={`If ${email} has an account, a reset link is on its way. It works for one hour.`}>
        <span />
      </Card>
    );
  }
  return (
    <Card title="Reset your password" subtitle="We'll email you a link to set a new one.">
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
        <Field label="Email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} error={error} required />
        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? "Sending…" : "Send reset link"}
        </Button>
      </form>
    </Card>
  );
}

function SetNewPassword({ token }: { token: string }) {
  const router = useRouter();
  const qc = useQueryClient();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(undefined);
    try {
      const user = await unwrap(api.POST("/auth/password-reset/confirm", { body: { token, password } }));
      qc.setQueryData(keys.me, user);
      router.replace("/dashboard");
    } catch (err) {
      setError(
        err instanceof ApiError && err.code === "validation_error" ? "Use at least 8 characters." : (err as Error).message,
      );
      setPending(false);
    }
  }

  return (
    <Card title="Set a new password" subtitle="You'll be logged out on your other devices.">
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
        <Field
          label="New password"
          type="password"
          autoComplete="new-password"
          placeholder="At least 8 characters"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={error}
          required
        />
        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? "Saving…" : "Save and log in"}
        </Button>
      </form>
    </Card>
  );
}

function ResetPassword() {
  const token = useSearchParams().get("token");
  return token ? <SetNewPassword token={token} /> : <RequestLink />;
}

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPassword />
    </Suspense>
  );
}
