"use client";

import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

type Toast = { id: number; message: string; tone: "default" | "error" };
type Listener = (toasts: Toast[]) => void;

let toasts: Toast[] = [];
let nextId = 1;
const listeners = new Set<Listener>();

function emit() {
  for (const l of listeners) l(toasts);
}

/** Bottom-centre toast for "Copied", "Saved" and errors (spec: global layout). */
export function toast(message: string, tone: Toast["tone"] = "default", ms = 2500) {
  const id = nextId++;
  toasts = [...toasts.slice(-2), { id, message, tone }];
  emit();
  setTimeout(() => {
    toasts = toasts.filter((t) => t.id !== id);
    emit();
  }, ms);
}

export function Toaster() {
  const [items, setItems] = useState<Toast[]>([]);
  useEffect(() => {
    listeners.add(setItems);
    return () => {
      listeners.delete(setItems);
    };
  }, []);

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-20 z-50 flex flex-col items-center gap-2 px-4 md:bottom-6"
    >
      {items.map((t) => (
        <div
          key={t.id}
          role={t.tone === "error" ? "alert" : "status"}
          className={cn(
            "pointer-events-auto rounded-full px-4 py-2 text-sm font-medium shadow-lg",
            t.tone === "error" ? "bg-destructive text-white" : "bg-ink text-white",
          )}
        >
          {t.message}
        </div>
      ))}
    </div>
  );
}
