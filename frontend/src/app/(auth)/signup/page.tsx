"use client";

import { AuthForm } from "@/components/auth/auth-form";
import { RedirectIfLoggedIn } from "@/components/auth/guards";

export default function SignupPage() {
  return (
    <RedirectIfLoggedIn>
      <AuthForm mode="signup" />
    </RedirectIfLoggedIn>
  );
}
