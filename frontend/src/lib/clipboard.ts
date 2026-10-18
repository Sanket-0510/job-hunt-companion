import { toast } from "@/components/ui/toaster";

/**
 * Copy text and toast "Copied". If the device blocks clipboard access, select the text in
 * `fallbackEl` instead, as the spec asks.
 */
export async function copyText(text: string, fallbackEl?: HTMLElement | null): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    toast("Copied");
    return true;
  } catch {
    if (fallbackEl) {
      const range = document.createRange();
      range.selectNodeContents(fallbackEl);
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(range);
    }
    toast("Copy didn't work here. The message is selected, so press Ctrl+C.", "error", 4000);
    return false;
  }
}
