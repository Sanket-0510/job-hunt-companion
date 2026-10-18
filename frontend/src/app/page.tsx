"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { Landing } from "@/components/landing/landing";
import { useMe } from "@/lib/queries";

// S1 Landing. Signed-in users (e.g. back from Google sign-in) go straight to the dashboard.
export default function Home() {
  const me = useMe();
  const router = useRouter();
  useEffect(() => {
    if (me.data) router.replace("/dashboard");
  }, [me.data, router]);

  return <Landing />;
}
