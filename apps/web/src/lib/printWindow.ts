/**
 * Printing is always isolated from the app shell.
 *
 * The dashboard must never enter print mode: `window.print()` re-renders the
 * whole SPA inside Chromium's print pipeline, and with a webfont that has
 * several weights the renderer can come back with broken Arabic-script glyphs
 * (the "letters disappear after the print dialog" bug). We therefore open the
 * standalone print route in its own window, and only that document ever calls
 * `window.print()`.
 */

export function withAutoPrint(url: string): string {
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}autoprint=1`;
}

/**
 * Opens the print route in a new window. If the popup is blocked we fall back
 * to a hard same-tab navigation (never a client-side route change), so the app
 * is always re-created from scratch.
 */
export function openPrintWindow(url: string): void {
  const target = withAutoPrint(url);
  let win: Window | null = null;
  try {
    // `noopener` makes Chromium return null even on success, so the window is
    // opened without it and the opener link is severed immediately instead.
    win = window.open(target, "_blank");
  } catch {
    win = null;
  }
  if (!win) {
    window.location.assign(target);
    return;
  }
  try {
    win.opener = null;
  } catch {
    // Cross-window access can be blocked; the tab is still isolated.
  }
  try {
    win.focus();
  } catch {
    // Ignore: focus can be refused by the browser.
  }
}
