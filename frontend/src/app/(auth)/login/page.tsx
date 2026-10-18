"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

import { AuthForm } from "@/components/auth/auth-form";
import { RedirectIfLoggedIn } from "@/components/auth/guards";

function Login() {
  const params = useSearchParams();
  return <AuthForm mode="login" googleError={params.get("error") === "google"} />;
}

export default function LoginPage() {
  return (
    <RedirectIfLoggedIn>
      <Suspense>
        <Login />
      </Suspense>
    </RedirectIfLoggedIn>
  );
}
