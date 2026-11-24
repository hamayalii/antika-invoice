import { useCallback, useEffect, useRef, useState } from "react";
import { clearPrintMark, markPrintStarted } from "./printGuard";

/**
 * Loads every declared font face and waits until each one reports `loaded`.
 * `document.fonts.ready` alone resolves before a face that is only used by a
 * few glyphs has been fetched, which is exactly how a print snapshot ends up
 * with fallback glyphs inside a word.
 */
async function waitForFontFaces(): Promise<void> {
  if (typeof document === "undefined" || !("fonts" in document)) return;
  const faces: FontFace[] = [];
  document.fonts.forEach((face) => faces.push(face));
  await Promise.all(
    faces.map(async (face) => {
      if (face.status === "loaded") return;
      try {
        await face.load();
      } catch {
        // An unavailable face must not block printing.
      }
    }),
  );
  // Chromium flips FontFace.status asynchronously; give it a few frames.
  for (let attempt = 0; attempt < 30; attempt += 1) {
    let pending = 0;
    document.fonts.forEach((face) => {
      if (face.status !== "loaded") pending += 1;
    });
    if (pending === 0) break;
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => resolve());
    });
  }
  await document.fonts.ready;
}

async function waitForImages(): Promise<void> {
  const images = Array.from(document.images);
  await Promise.all(
    images.map(async (image) => {
      if (!image.complete || image.naturalWidth === 0) {
        await new Promise<void>((resolve) => {
          const done = () => resolve();
          image.addEventListener("load", done, { once: true });
          image.addEventListener("error", done, { once: true });
        });
      }
      try {
        await image.decode();
      } catch {
        // Broken or already-decoded images are fine.
      }
    }),
  );
}

/** Fonts → images/SVG → two animation frames (layout is final). */
export async function waitForPrintReady(): Promise<void> {
  await waitForFontFaces();
  await waitForImages();
  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
}

export interface PrintPageOptions {
  /** The document is rendered and the sheet has the `data-print-ready` flag. */
  ready: boolean;
  /** `?autoprint=1` was present in the URL. */
  autoPrint: boolean;
  /** Hard-navigation target for Back / Close (never a router navigation). */
  backTo: string;
}

export interface PrintPageState {
  /** The print window refused to close; the user must close it manually. */
  closeBlocked: boolean;
  closeWindow: () => void;
  goBack: () => void;
}

export function usePrintPage({ ready, autoPrint, backTo }: PrintPageOptions): PrintPageState {
  const [closeBlocked, setCloseBlocked] = useState(false);
  const printed = useRef(false);

  // The print route is a standalone document: no app animations, no hover
  // transitions and no smoothing tricks while Chromium builds the print job.
  useEffect(() => {
    document.body.classList.add("print-route");
    return () => document.body.classList.remove("print-route");
  }, []);

  // Any in-tab print marks the tab so the app can reload on the way back.
  useEffect(() => {
    const onBeforePrint = () => markPrintStarted();
    window.addEventListener("beforeprint", onBeforePrint);
    return () => window.removeEventListener("beforeprint", onBeforePrint);
  }, []);

  // Back/forward cache restore or a history pop must rebuild the document.
  useEffect(() => {
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) window.location.reload();
    };
    const onPopState = () => {
      window.location.reload();
    };
    window.addEventListener("pageshow", onPageShow);
    window.addEventListener("popstate", onPopState);
    return () => {
      window.removeEventListener("pageshow", onPageShow);
      window.removeEventListener("popstate", onPopState);
    };
  }, []);

  // Close the isolated window once the print job is handed to the printer.
  useEffect(() => {
    if (!autoPrint) return;
    const onAfterPrint = () => {
      if (!printed.current) return;
      clearPrintMark();
      try {
        window.close();
      } catch {
        // Fall through to the manual close message.
      }
      window.setTimeout(() => {
        if (!window.closed) setCloseBlocked(true);
      }, 300);
    };
    window.addEventListener("afterprint", onAfterPrint);
    return () => window.removeEventListener("afterprint", onAfterPrint);
  }, [autoPrint]);

  // Auto-print only when the document is fully rendered and every asset is in.
  useEffect(() => {
    if (!autoPrint || !ready || printed.current) return;
    let cancelled = false;
    void (async () => {
      await waitForPrintReady();
      if (cancelled) return;
      printed.current = true;
      markPrintStarted();
      window.print();
    })();
    return () => {
      cancelled = true;
    };
  }, [autoPrint, ready]);

  /**
   * The manual close button. `window.close()` is only allowed for windows the
   * script opened; in the same-tab fallback it is refused, so the button ends
   * the print view with a hard navigation instead of leaving a dead page.
   */
  const closeWindow = useCallback(() => {
    clearPrintMark();
    try {
      window.close();
    } catch {
      // Ignore.
    }
    window.setTimeout(() => {
      if (!window.closed) {
        setCloseBlocked(true);
        window.location.assign(backTo);
      }
    }, 250);
  }, [backTo]);

  const goBack = useCallback(() => {
    clearPrintMark();
    // Hard navigation on purpose: a router navigation would reuse the app
    // instance whose glyph cache was touched by the print pipeline.
    window.location.assign(backTo);
  }, [backTo]);

  return { closeBlocked, closeWindow, goBack };
}
