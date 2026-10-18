"use client";

import { MonitorIcon, MoonIcon, SunIcon } from "lucide-react";
import { useEffect, useSyncExternalStore } from "react";

import { type Theme, applyTheme, readTheme, saveTheme, subscribeTheme } from "@/lib/theme";

const ORDER: Theme[] = ["system", "light", "dark"];
const LABEL: Record<Theme, string> = { system: "Match device", light: "Light", dark: "Dark" };
const ICON = { system: MonitorIcon, light: SunIcon, dark: MoonIcon };

/** One button: tap to cycle Match device, Light, Dark. */
export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribeTheme, readTheme, (): Theme => "system");

  useEffect(() => {
    // While on "Match device", follow the phone or laptop if its setting changes.
    const media = matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyTheme(readTheme());
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  const Icon = ICON[theme];
  const next = ORDER[(ORDER.indexOf(theme) + 1) % ORDER.length];
  return (
    <button
      type="button"
      aria-label={`Theme: ${LABEL[theme]}. Switch to ${LABEL[next]}`}
      title={`Theme: ${LABEL[theme]}`}
      onClick={() => saveTheme(next)}
      className="flex size-9 items-center justify-center rounded-full text-ink-muted hover:bg-chip hover:text-ink"
    >
      <Icon className="size-[18px]" />
    </button>
  );
}
