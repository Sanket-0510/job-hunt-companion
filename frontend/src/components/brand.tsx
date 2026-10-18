import Link from "next/link";

import { cn } from "@/lib/utils";

/** Dark square with a teal and a purple bar: the two tracks. */
export function BrandMark({ size = 28 }: { size?: number }) {
  const bar = Math.round(size / 2);
  return (
    <span
      aria-hidden
      className="inline-flex shrink-0 items-center justify-center gap-[3px] rounded-[8px] bg-[#17212b]"
      style={{ width: size, height: size }}
    >
      <span className="w-1 rounded-[2px] bg-[#3fa7b2]" style={{ height: bar }} />
      <span className="w-1 rounded-[2px] bg-[#9b83dd]" style={{ height: bar }} />
    </span>
  );
}

export function Brand({ href = "/", className, size = "md" }: { href?: string; className?: string; size?: "md" | "lg" }) {
  return (
    <Link href={href} className={cn("inline-flex items-center gap-2.5", className)}>
      <BrandMark size={size === "lg" ? 28 : 26} />
      <span className={cn("font-heading font-semibold text-ink", size === "lg" ? "text-lg" : "text-[17px]")}>
        Job Hunt Companion
      </span>
    </Link>
  );
}
