"use client";

import { RequireOnboarded, RequireUser } from "@/components/auth/guards";
import { AppShell } from "@/components/shell/app-shell";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireUser>
      <RequireOnboarded>
        <AppShell>{children}</AppShell>
      </RequireOnboarded>
    </RequireUser>
  );
}
