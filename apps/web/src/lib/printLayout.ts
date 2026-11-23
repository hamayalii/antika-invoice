export interface PrintLayout {
  /** Width of one printed sheet in millimetres (also the page width unless two-up). */
  sheetWidthMm: number;
  /** Height of one printed sheet in millimetres. */
  sheetHeightMm: number;
  /** Physical paper width in millimetres. */
  pageWidthMm: number;
  /** Physical paper height in millimetres. */
  pageHeightMm: number;
  /** Minimum distance that document content keeps from the paper edge. */
  safeMarginMm: number;
  /** Stack two A5 sheets on one A4 page with a cut line. */
  twoUp?: boolean;
}

/** CSS px per mm (the CSS reference pixel is 1/96 in, 1 mm = 96/25.4 px). */
export const MM_TO_CSS_PX = 96 / 25.4;

export function mmToCssPx(mm: number): number {
  return mm * MM_TO_CSS_PX;
}

export function pageSizeAttribute(widthMm: number, heightMm: number): string {
  return `${widthMm}x${heightMm}`;
}

/**
 * Print CSS shared by the invoice, voucher and calibration routes.
 * Every printed dimension is expressed in millimetres; the paper size is
 * declared with explicit mm values (never only with a keyword) and the sheet
 * is exactly page-sized with `box-sizing: border-box` and `overflow: hidden`.
 */
export function buildPrintCss(layout: PrintLayout): string {
  const { sheetWidthMm, sheetHeightMm, pageWidthMm, pageHeightMm } = layout;
  return `
  html, body {
    margin: 0 !important;
    padding: 0 !important;
    background: #eef1f6 !important;
  }
  .print-page {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 18px 12px 40px;
    gap: 14px;
  }
  .print-toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    width: ${sheetWidthMm}mm;
    max-width: 100%;
    background: #ffffff;
    border: 1px solid #e2e8f0;
    border-radius: 14px;
    padding: 10px 14px;
    box-shadow: 0 8px 24px rgba(224, 78, 0, 0.12);
    font-family: "Arkan", "Noto Naskh Arabic", Tahoma, sans-serif;
    direction: rtl;
  }
  .print-toolbar .meta {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }
  .print-toolbar .title {
    font-size: 13px;
    font-weight: 800;
    color: #0f172a;
    white-space: nowrap;
  }
  .print-toolbar .hint {
    font-size: 11px;
    font-weight: 600;
    color: #64748b;
  }
  .print-toolbar .actions {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
    justify-content: flex-end;
  }
  .print-toolbar button,
  .print-toolbar a {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    border-radius: 10px;
    padding: 8px 14px;
    font-size: 12px;
    font-weight: 700;
    cursor: pointer;
    text-decoration: none;
    border: 1px solid transparent;
    font-family: inherit;
  }
  .print-toolbar .primary {
    background: #ff5a00;
    color: #fff;
  }
  .print-toolbar .primary:hover {
    background: #e04e00;
  }
  .print-toolbar .secondary {
    background: #fff;
    color: #334155;
    border-color: #e2e8f0;
  }
  .print-toolbar .secondary:hover {
    background: #f8fafc;
  }
  .print-toolbar .ghost {
    background: transparent;
    color: #64748b;
    border-color: transparent;
    padding: 8px;
  }
  .print-toolbar .ghost:hover {
    background: #f1f5f9;
    color: #0f172a;
  }
  .print-sheet-wrap {
    width: ${sheetWidthMm}mm;
    height: ${sheetHeightMm}mm;
    box-sizing: border-box;
    background: #fff;
    box-shadow: 0 18px 50px rgba(15, 23, 42, 0.16);
    margin: 0 auto;
    overflow: hidden;
    flex: 0 0 auto;
  }
  /*
   * Print-route hygiene. The printed sheet must be rasterised exactly like the
   * screen render: no smoothing hints, no synthetic bold, no text-rendering
   * tweaks, no animations. These are the knobs Chromium uses to switch to a
   * different glyph rasterisation path while building a print job, which is
   * what produced missing / half-drawn Arabic-script letters on paper.
   */
  .print-route {
    text-rendering: auto;
    -webkit-font-smoothing: auto;
    -moz-osx-font-smoothing: auto;
    font-kerning: normal;
    font-variant-ligatures: normal;
    font-feature-settings: normal;
    font-synthesis: none;
  }
  .print-route *,
  .print-route *::before,
  .print-route *::after {
    animation: none !important;
    transition: none !important;
    text-rendering: auto !important;
    -webkit-font-smoothing: auto !important;
    -moz-osx-font-smoothing: auto !important;
    font-kerning: normal !important;
    font-variant-ligatures: normal !important;
    font-feature-settings: normal !important;
    font-synthesis: none !important;
  }
  .print-close-bar {
    position: fixed;
    top: 16px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 80;
    display: flex;
    align-items: center;
    gap: 12px;
    border-radius: 12px;
    background: #0f172a;
    color: #fff;
    padding: 10px 16px;
    font-family: "Arkan", "Noto Naskh Arabic", Tahoma, sans-serif;
    font-size: 13px;
    font-weight: 700;
    box-shadow: 0 18px 40px rgba(15, 23, 42, 0.35);
    direction: rtl;
  }
  .print-close-bar button {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    border: 0;
    border-radius: 8px;
    background: #ff5a00;
    color: #fff;
    padding: 6px 12px;
    font-family: inherit;
    font-size: 12px;
    font-weight: 800;
    cursor: pointer;
  }
  .print-two-up {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    width: ${pageWidthMm}mm;
    max-width: 100%;
  }
  .print-cutline {
    width: calc(100% - 12mm);
    height: 1mm;
    flex: 0 0 auto;
    margin: 0 auto;
    background:
      repeating-linear-gradient(
        to right,
        #94a3b8 0,
        #94a3b8 2mm,
        transparent 2mm,
        transparent 4mm
      )
      center / 100% 0.3mm no-repeat;
  }
  .print-notice-backdrop {
    position: fixed;
    inset: 0;
    z-index: 60;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
    background: rgba(15, 23, 42, 0.45);
    backdrop-filter: blur(4px);
    font-family: "Arkan", "Noto Naskh Arabic", Tahoma, sans-serif;
    direction: rtl;
  }
  .print-notice {
    width: 480px;
    max-width: 100%;
    max-height: 90vh;
    overflow-y: auto;
    border-radius: 18px;
    background: #fff;
    box-shadow: 0 30px 80px rgba(15, 23, 42, 0.35);
    padding: 22px 24px;
  }
  .print-notice h2 {
    margin: 0 0 4px;
    font-size: 17px;
    font-weight: 900;
    color: #0f172a;
  }
  .print-notice p.lead {
    margin: 0 0 14px;
    font-size: 12px;
    font-weight: 600;
    line-height: 1.7;
    color: #64748b;
  }
  .print-notice ul {
    margin: 0 0 16px;
    padding: 0;
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .print-notice li {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    border: 1px solid #e2e8f0;
    border-radius: 10px;
    padding: 8px 12px;
    font-size: 12px;
    font-weight: 700;
    color: #334155;
  }
  .print-notice li b {
    font-weight: 900;
    color: #0f172a;
    direction: ltr;
    unicode-bidi: isolate;
  }
  .print-notice .warn {
    margin: 0 0 16px;
    border: 1px solid #fed7aa;
    border-radius: 10px;
    background: #fff7ed;
    padding: 9px 12px;
    font-size: 12px;
    font-weight: 800;
    color: #9a3412;
  }
  .print-notice .notice-actions {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 8px;
  }
  .print-notice .notice-actions button {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    border-radius: 10px;
    padding: 9px 16px;
    font-size: 12px;
    font-weight: 800;
    cursor: pointer;
    border: 1px solid transparent;
    font-family: inherit;
  }
  .print-notice .notice-actions .primary {
    background: #ff5a00;
    color: #fff;
  }
  .print-notice .notice-actions .secondary {
    background: #fff;
    color: #334155;
    border-color: #e2e8f0;
  }
  @page {
    size: ${pageWidthMm}mm ${pageHeightMm}mm;
    margin: 0;
  }
  @media print {
    html, body {
      width: ${pageWidthMm}mm;
      height: ${pageHeightMm}mm;
      margin: 0 !important;
      padding: 0 !important;
      background: #fff !important;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .print-toolbar,
    .print-notice-backdrop,
    .print-close-bar {
      display: none !important;
    }
    .print-page {
      width: ${pageWidthMm}mm;
      height: ${pageHeightMm}mm;
      padding: 0 !important;
      gap: 0 !important;
      min-height: 0 !important;
      display: block !important;
    }
    .print-two-up {
      width: ${pageWidthMm}mm !important;
    }
    .print-sheet-wrap {
      width: ${sheetWidthMm}mm !important;
      height: ${sheetHeightMm}mm !important;
      margin: 0 !important;
      box-shadow: none !important;
      overflow: hidden !important;
      break-inside: avoid;
      page-break-inside: avoid;
      page-break-after: avoid;
      break-after: avoid;
    }
    .print-sheet-wrap:last-child {
      page-break-after: auto;
      break-after: auto;
    }
    .invoice-sheet,
    .voucher-sheet {
      box-shadow: none !important;
      margin: 0 !important;
    }
  }
`;
}
