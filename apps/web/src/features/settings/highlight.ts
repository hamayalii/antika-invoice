import { useSyncExternalStore } from "react";

/**
 * Which protected layer is currently being pointed at (hover, focus or tap on
 * one of the security controls). Kept in a tiny external store so the settings
 * form itself never has to re-render for a hover.
 */
export type DocPart = "watermark" | "guilloche" | "microtext" | "qr";

let current: DocPart | null = null;
const listeners = new Set<() => void>();
let releaseTimer: ReturnType<typeof setTimeout> | null = null;

function emit() {
  for (const listener of listeners) listener();
}

export function getHighlightedPart(): DocPart | null {
  return current;
}

export function setHighlightedPart(part: DocPart | null) {
  if (releaseTimer) {
    clearTimeout(releaseTimer);
    releaseTimer = null;
  }
  if (current === part) return;
  current = part;
  emit();
}

/**
 * Touch has no "leave" event, so a tap is held for a few seconds and then
 * released automatically.
 */
export function tapHighlightedPart(part: DocPart) {
  setHighlightedPart(part);
  releaseTimer = setTimeout(() => {
    releaseTimer = null;
    if (current === part) setHighlightedPart(null);
  }, 3500);
}

export function subscribeHighlightedPart(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useHighlightedPart(): DocPart | null {
  return useSyncExternalStore(
    subscribeHighlightedPart,
    getHighlightedPart,
    getHighlightedPart,
  );
}
