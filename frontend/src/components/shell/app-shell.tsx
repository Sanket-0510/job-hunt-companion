"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ChevronDownIcon } from "lucide-react";

import { Brand } from "@/components/brand";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { API_URL } from "@/lib/api";
import { initials } from "@/lib/format";
import { useLogout, useMe, useProfile } from "@/lib/queries";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: "/icons/tab-dashboard.svg" },
  { href: "/jobs", label: "Jobs", icon: "/icons/tab-jobs.svg" },
  { href: "/settings", label: "Settings", icon: "/icons/tab-settings.svg" },
] as const;

function useActive() {
  const pathname = usePathname();
  return (href: string) => pathname === href || pathname.startsWith(`${href}/`);
}

export function AvatarMenu() {
  const me = useMe();
  const profile = useProfile();
  const logout = useLogout();
  const router = useRouter();
  if (!me.data) return null;
  const label = initials(profile.data?.full_name, me.data.email);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="flex items-center gap-1.5 rounded-full outline-offset-2"
        aria-label="Account menu"
      >
        <span className="flex size-8 items-center justify-center rounded-full bg-referral font-mono text-xs font-medium text-white">
          {label}
        </span>
        <ChevronDownIcon className="hidden size-4 text-ink-muted md:block" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem onClick={() => router.push("/settings")}>Profile</DropdownMenuItem>
        <DropdownMenuItem
          // The API answers with a file download, so the page stays where it is.
          onClick={() => window.open(`${API_URL}/jobs/export.csv`, "_self")}
        >
          Export CSV
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="text-destructive"
          onClick={() => logout.mutate(undefined, { onSuccess: () => router.replace("/login") })}
        >
          Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Top bar: brand, desktop tabs, avatar menu. On phones the tabs move to the bottom bar. */
function AppHeader() {
  const isActive = useActive();
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-card">
      <div className="mx-auto flex h-14 max-w-[1440px] items-center gap-2 px-4 md:h-16 md:px-8">
        <Brand href="/dashboard" />
        <nav aria-label="Main" className="ml-10 hidden h-full items-stretch md:flex">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive(item.href) ? "page" : undefined}
              className={cn(
                "flex items-center border-b-2 px-3 text-sm",
                isActive(item.href)
                  ? "border-ink font-semibold text-ink"
                  : "border-transparent text-ink-muted hover:text-ink",
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <span className="flex-1" />
        <ThemeToggle />
        <AvatarMenu />
      </div>
    </header>
  );
}

/**
 * Phone bottom tab bar (Figma TabBar): indicator line, icon, label. The strip under the icons
 * is left empty on purpose: Netlify floats a "Powered by Netlify" badge in the bottom corner,
 * and the icons sit above it instead of underneath.
 */
function TabBar() {
  const isActive = useActive();
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-30 flex border-t border-line bg-card pt-1.5 pb-[calc(env(safe-area-inset-bottom)+66px)] md:hidden"
    >
      {NAV.map((item) => {
        const active = isActive(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className="flex flex-1 flex-col items-center gap-1 py-1"
          >
            <span className={cn("h-[3px] w-7 rounded-[2px]", active ? "bg-ink" : "bg-transparent")} />
            {/* Figma icon used as a mask so its colour follows the active state. */}
            <span
              aria-hidden
              className={cn("size-[22px]", active ? "bg-ink" : "bg-ink-muted")}
              style={{ mask: `url(${item.icon}) center / contain no-repeat`, WebkitMask: `url(${item.icon}) center / contain no-repeat` }}
            />
            <span className={cn("text-xs", active ? "font-semibold text-ink" : "text-ink-muted")}>
              {item.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <AppHeader />
      <main className="mx-auto w-full max-w-[1104px] flex-1 px-4 pt-6 pb-44 md:px-8 md:pt-10 md:pb-16">
        {children}
      </main>
      <TabBar />
    </div>
  );
}
