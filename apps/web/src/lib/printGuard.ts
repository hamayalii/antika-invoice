/**
 * Safety net for the Chromium print-dialog font corruption.
 *
 * Chromium sometimes keeps a broken glyph cache after the native print dialog
 * closes, which makes the app text render with missing/half-drawn letters until
 * the page is refreshed. A print is recorded in sessionStorage; the next time
 * the tab is visible again (or after the `afterprint` event) the page reloads
 * exactly once so the font stack is rebuilt from scratch.
 */
const PRINT_FLAG = "antika.printedAt";
const PRINT_WINDOW_MS = 2 * 60 * 1000;

export function markPrintStarted(): void {
  try {
    sessionStorage.setItem(PRINT_FLAG, String(Date.now()));
  } catch {
    // Storage can be blocked; the reload safety net is then simply skipped.
  }
}

export function clearPrintMark(): void {
  try {
    sessionStorage.removeItem(PRINT_FLAG);
  } catch {
    // Ignore.
  }
}

export function printedRecently(): boolean {
  try {
    const raw = sessionStorage.getItem(PRINT_FLAG);
    if (!raw) return false;
    const at = Number(raw);
    if (!Number.isFinite(at)) return false;
    return Date.now() - at < PRINT_WINDOW_MS;
  } catch {
    return false;
  }
}

/** Reloads the document once when a print happened in this tab recently. */
export function reloadIfPrintedRecently(): boolean {
  if (!printedRecently()) return false;
  clearPrintMark();
  window.location.reload();
  return true;
}
