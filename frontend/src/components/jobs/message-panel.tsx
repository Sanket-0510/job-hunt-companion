"use client";

import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/controls";
import type { Schemas } from "@/lib/api";
import { copyText } from "@/lib/clipboard";

type Message = Schemas["Message"];

/** Show the message with unfilled blanks ([Name], {resume link}...) highlighted in orange. */
function Highlighted({ text, blanks }: { text: string; blanks: string[] }) {
  if (blanks.length === 0) return <>{text}</>;
  const escaped = blanks.map((b) => b.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const parts = text.split(new RegExp(`(${escaped.join("|")})`, "g"));
  return (
    <>
      {parts.map((part, i) =>
        blanks.includes(part) ? (
          <mark key={i} className="bg-transparent font-semibold text-due">
            {part}
          </mark>
        ) : (
          part
        ),
      )}
    </>
  );
}

/** Collapsible "Referral message" / "Follow-up message" with a Copy button (Figma Message panel). */
export function MessagePanel({ title, message }: { title: string; message: Message }) {
  const [open, setOpen] = useState(false);
  const body = useRef<HTMLDivElement>(null);
  return (
    <div className="overflow-hidden rounded-lg border border-line bg-white">
      <div className="flex items-center gap-2 py-2 pr-2 pl-3">
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
          className="flex flex-1 items-center gap-2 text-left text-sm font-medium text-ink"
        >
          <Icon name={open ? "chevron-down-open" : "chevron-right"} className="text-ink-muted" />
          {title}
        </button>
        <Button
          size="sm"
          variant={open ? "default" : "outline"}
          onClick={() => copyText(message.text, body.current)}
        >
          Copy message
        </Button>
      </div>
      {open && (
        <div
          ref={body}
          className="border-t border-line bg-page p-3 text-[13px] leading-5 whitespace-pre-wrap text-ink"
        >
          <Highlighted text={message.text} blanks={message.blanks} />
        </div>
      )}
    </div>
  );
}
