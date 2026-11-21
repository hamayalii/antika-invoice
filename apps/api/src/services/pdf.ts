import puppeteer, { type Browser } from "puppeteer";
import { PDFDocument } from "pdf-lib";
import { config } from "../config";

let browserPromise: Promise<Browser> | null = null;
let queue: Promise<unknown> = Promise.resolve();

async function launch(): Promise<Browser> {
  const executablePath = config.PUPPETEER_EXECUTABLE_PATH || undefined;
  const browser = await puppeteer.launch({
    headless: true,
    executablePath,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--font-render-hinting=none",
      "--force-color-profile=srgb",
    ],
  });
  browser.on("disconnected", () => {
    browserPromise = null;
  });
  return browser;
}

async function getBrowser(): Promise<Browser> {
  if (!browserPromise) browserPromise = launch();
  try {
    return await browserPromise;
  } catch (error) {
    browserPromise = null;
    throw error;
  }
}

export function warmUpPdfRenderer(): void {
  if (config.NODE_ENV === "production") {
    void getBrowser().catch((error) => console.error("[pdf] warm-up failed", error));
  }
}

export interface PdfSheetSize {
  /** Physical page width, in millimetres. */
  pageWidthMm: number;
  /** Physical page height, in millimetres. */
  pageHeightMm: number;
}

/** CSS reference pixel: 1 mm = 96/25.4 px. */
const MM_TO_CSS_PX = 96 / 25.4;
/** Sub-pixel tolerance for the DOM guard (browser layout rounds to 1/64 px). */
const SIZE_TOLERANCE_PX = 1;

/**
 * Chrome rounds the CSS page box to its own pixel grid (≈0.3 pt). Pin the
 * MediaBox/CropBox to the exact millimetre size and refuse multi-page output,
 * so the delivered PDF always declares the requested paper size.
 */
async function normalizePageBox(pdf: Uint8Array, widthPt: number, heightPt: number): Promise<Buffer> {
  const doc = await PDFDocument.load(pdf);
  const pages = doc.getPageCount();
  if (pages !== 1) throw new Error(`Expected a single PDF page, produced ${pages}`);
  const page = doc.getPage(0);
  page.setMediaBox(0, 0, widthPt, heightPt);
  page.setCropBox(0, 0, widthPt, heightPt);
  return Buffer.from(await doc.save());
}

async function render(pathname: string, token: string, size: PdfSheetSize): Promise<Buffer> {
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    await page.setViewport({ width: 1240, height: 1754, deviceScaleFactor: 1 });
    await page.emulateMediaType("print");
    await page.setCookie({
      name: config.cookieName,
      value: token,
      url: config.WEB_BASE_URL,
      httpOnly: true,
      sameSite: "Strict",
    });
    const url = new URL(pathname, config.WEB_BASE_URL).toString();
    await page.goto(url, { waitUntil: "networkidle0", timeout: config.PDF_TIMEOUT_MS });
    await page.waitForSelector('[data-print-ready="true"]', { timeout: config.PDF_TIMEOUT_MS });
    await page.evaluate(async () => {
      await document.fonts.ready;
      await Promise.all(
        Array.from(document.images)
          .filter((img) => !img.complete)
          .map(
            (img) =>
              new Promise<void>((resolve) => {
                img.addEventListener("load", () => resolve(), { once: true });
                img.addEventListener("error", () => resolve(), { once: true });
              }),
          ),
      );
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      );
    });

    /*
     * Refuse to produce a PDF when the rendered sheet is not exactly the
     * requested size. This catches CSS regressions before they reach paper.
     */
    const measured = await page.evaluate(() => {
      const wrap = document.querySelector('[data-print-ready="true"]');
      if (!wrap) return null;
      const rect = wrap.getBoundingClientRect();
      return {
        width: rect.width,
        height: rect.height,
      };
    });
    if (!measured) throw new Error("Print sheet did not render");
    const expectedWidth = size.pageWidthMm * MM_TO_CSS_PX;
    const expectedHeight = size.pageHeightMm * MM_TO_CSS_PX;
    if (
      Math.abs(measured.width - expectedWidth) > SIZE_TOLERANCE_PX ||
      Math.abs(measured.height - expectedHeight) > SIZE_TOLERANCE_PX
    ) {
      throw new Error(
        `Print size mismatch: expected ${size.pageWidthMm}×${size.pageHeightMm} mm ` +
          `(${expectedWidth.toFixed(1)}×${expectedHeight.toFixed(1)} px), got ` +
          `${measured.width.toFixed(1)}×${measured.height.toFixed(1)} px`,
      );
    }

    await new Promise((resolve) => setTimeout(resolve, 250));
    const pdf = await page.pdf({
      width: `${size.pageWidthMm}mm`,
      height: `${size.pageHeightMm}mm`,
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
      scale: 1,
    });
    return normalizePageBox(
      pdf,
      (size.pageWidthMm / 25.4) * 72,
      (size.pageHeightMm / 25.4) * 72,
    );
  } finally {
    await page.close().catch(() => undefined);
  }
}

/** Serialized so a burst of PDF requests cannot exhaust the container. */
export function renderPdf(pathname: string, token: string, size: PdfSheetSize): Promise<Buffer> {
  const task = queue.then(() => render(pathname, token, size));
  queue = task.catch(() => undefined);
  return task;
}

export async function closePdfRenderer(): Promise<void> {
  if (!browserPromise) return;
  try {
    const browser = await browserPromise;
    await browser.close();
  } finally {
    browserPromise = null;
  }
}
