"use client";

import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Brand } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { API_URL, ApiError, api, unwrap } from "@/lib/api";
import { keys } from "@/lib/queries";

type Mode = "signup" | "login";

const COPY = {
  signup: {
    title: "Create your account",
    subtitle: "Set up takes about five minutes.",
    submit: "Create account",
    switchText: "Already have an account?",
    switchLink: "Log in",
    switchHref: "/login",
  },
  login: {
    title: "Log in to your tracker",
    subtitle: "Pick up where you left off.",
    submit: "Log in",
    switchText: "New here?",
    switchLink: "Create an account",
    switchHref: "/signup",
  },
} as const;

type Errors = { email?: string; password?: string; form?: string };

/** Errors go under the field they relate to (spec S2). */
function toFieldErrors(err: unknown): Errors {
  if (!(err instanceof ApiError)) return { form: "Something went wrong. Try again." };
  switch (err.code) {
    case "invalid_credentials":
      return { password: "That password does not match this email. Check it and try again." };
    case "email_taken":
      return { email: "An account with this email already exists. Log in instead." };
    case "rate_limited":
      return { password: err.message };
    case "validation_error":
      return {
        email: err.fields.email && "Enter a valid email address.",
        password: err.fields.password && "Use at least 8 characters.",
      };
    default:
      return { form: err.message };
  }
}

export function AuthForm({ mode, googleError }: { mode: Mode; googleError?: boolean }) {
  const copy = COPY[mode];
  const router = useRouter();
  const qc = useQueryClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<Errors>(
    googleError ? { form: "Google sign-in didn't work. Try again or use email." } : {},
  );
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});
    setPending(true);
    try {
      const body = { email: email.trim(), password };
      const user = await unwrap(
        mode === "signup" ? api.POST("/auth/signup", { body }) : api.POST("/auth/login", { body }),
      );
      qc.setQueryData(keys.me, user);
      // The app layout sends anyone not yet onboarded to /onboarding.
      router.replace("/dashboard");
    } catch (err) {
      setErrors(toFieldErrors(err));
      setPending(false);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-[440px] flex-1 flex-col gap-8 px-4 pt-14 pb-10">
      <Brand size="lg" className="self-center" />
      <div className="flex flex-col gap-5 rounded-2xl border border-line bg-card p-6 shadow-[0_4px_16px_rgba(23,33,43,0.12)]">
        <div className="flex flex-col gap-1.5">
          <h1 className="text-[26px] font-semibold text-ink">{copy.title}</h1>
          <p className="text-[15px] text-ink-muted">{copy.subtitle}</p>
        </div>

        <Button
          variant="outline"
          className="w-full"
          nativeButton={false}
          render={<a href={`${API_URL}/auth/google/login`} />}
        >
          Continue with Google
        </Button>

        <div className="flex items-center gap-3" aria-hidden>
          <span className="h-px flex-1 bg-line" />
          <span className="text-[13px] text-ink-muted">or</span>
          <span className="h-px flex-1 bg-line" />
        </div>

        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
          <div className="flex flex-col gap-4">
            <Field
              label="Email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              error={errors.email}
              required
            />
            <Field
              label="Password"
              type="password"
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              placeholder={mode === "signup" ? "At least 8 characters" : ""}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              error={errors.password}
              required
            />
            {mode === "login" && (
              <Link href="/reset-password" className="-mt-1 self-end text-[13px] font-semibold text-direct">
                Forgot password?
              </Link>
            )}
          </div>
          {errors.form && (
            <p role="alert" className="text-sm text-destructive">
              {errors.form}
            </p>
          )}
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Please wait…" : copy.submit}
          </Button>
        </form>

        <p className="flex justify-center gap-1 text-sm">
          <span className="text-ink-muted">{copy.switchText}</span>
          <Link href={copy.switchHref} className="font-semibold text-direct">
            {copy.switchLink}
          </Link>
        </p>
      </div>
    </main>
  );
}
