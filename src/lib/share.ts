/**
 * Lightweight wrapper around the Web Share API with a clipboard fallback.
 *
 * navigator.share works on iOS/Android Safari + Chrome, on macOS Safari, and
 * on some Windows browsers. Desktop Chrome on Linux/Windows doesn't support
 * it — we fall back to copying the text to the clipboard.
 */

import { toast } from "@/hooks/useToast";

interface SharePayload {
  title?: string;
  text:   string;
  url?:   string;
}

export async function share(payload: SharePayload): Promise<boolean> {
  if (typeof navigator === "undefined") return false;

  if (typeof navigator.share === "function") {
    try {
      await navigator.share({
        title: payload.title,
        text:  payload.text,
        url:   payload.url,
      });
      return true;
    } catch (err) {
      // User cancelled or share failed — silently fall through to clipboard
      if ((err as Error).name === "AbortError") return false;
    }
  }

  // Clipboard fallback
  const combined = [payload.title, payload.text, payload.url].filter(Boolean).join("\n\n");
  try {
    await navigator.clipboard.writeText(combined);
    toast.success("Copied to clipboard");
    return true;
  } catch {
    toast.error("Couldn't share or copy");
    return false;
  }
}
