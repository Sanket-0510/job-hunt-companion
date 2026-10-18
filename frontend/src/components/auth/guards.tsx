"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { useMe, useProfile } from "@/lib/queries";

function FullPageSpinner() {
  return (
    <div className="flex flex-1 items-center justify-center" aria-busy="true">
      <span className="size-6 animate-spin rounded-full border-2 border-line border-t-ink" />
    </div>
  );
}

/**
 * Client-side guard: the session cookie belongs to the API's origin, so only the API can tell
 * whether we're logged in. Shows a spinner while asking, then renders or redirects.
 */
export function RequireUser({ children }: { children: React.ReactNode }) {
  const me = useMe();
  const router = useRouter();
  useEffect(() => {
    if (me.data === null) router.replace("/login");
  }, [me.data, router]);
  if (!me.data) return <FullPageSpinner />;
  return <>{children}</>;
}

/** Login and signup pages: someone already signed in goes straight to the dashboard. */
export function RedirectIfLoggedIn({ children }: { children: React.ReactNode }) {
  const me = useMe();
  const router = useRouter();
  useEffect(() => {
    if (me.data) router.replace("/dashboard");
  }, [me.data, router]);
  if (me.isPending || me.data) return <FullPageSpinner />;
  return <>{children}</>;
}

/** Logged-in screens: users who haven't finished onboarding are sent there first. */
export function RequireOnboarded({ children }: { children: React.ReactNode }) {
  const profile = useProfile();
  const router = useRouter();
  const pending = profile.data && !profile.data.onboarded_at;
  useEffect(() => {
    if (pending) router.replace("/onboarding");
  }, [pending, router]);
  if (!profile.data || pending) return <FullPageSpinner />;
  return <>{children}</>;
}
