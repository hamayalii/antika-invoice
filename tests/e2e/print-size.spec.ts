import { expect, test, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { PDFDocument } from "pdf-lib";
import { createCanvas } from "@napi-rs/canvas";

/**
 * Print-size guarantees:
 *  - A4 portrait  : 210 × 297 mm  = 595.28 × 841.89 pt  = 2480 × 3508 px @300dpi
 *  - A5 landscape : 210 × 148 mm  = 595.28 × 419.53 pt  = 2480 × 1748 px @300dpi
 * Page boxes must match within 0.5 pt, rasters within 2 px (Chrome rounds the
 * MediaBox by ~0.3 pt), and no ink may touch the paper edge (footer inside).
 */
const OUT_DIR = path.join("test-results", "print-verification");
const USERNAME = process.env.E2E_USERNAME ?? "admin";
const PASSWORD = process.env.E2E_PASSWORD ?? "ChangeMe!1234";
const PT_TOLERANCE = 0.5;
const PX_TOLERANCE = 2;
const MM_TO_CSS_PX = 96 / 25.4;

const A4 = { widthMm: 210, heightMm: 297, widthPt: 595.28, heightPt: 841.89, widthPx: 2480, heightPx: 3508 };
const A5 = { widthMm: 210, heightMm: 148, widthPt: 595.28, heightPt: 419.53, widthPx: 2480, heightPx: 1748 };

async function login(page: Page) {
  await page.goto("/login");
  await page.locator("#username").fill(USERNAME);
  await page.locator("#password").fill(PASSWORD);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL((url) => url.pathname === "/" || url.pathname === "/change-password");
  if (new URL(page.url()).pathname === "/change-password") {
    throw new Error("E2E_PASSWORD is a temporary password; complete the forced change first.");
  }
}

async function fetchPdf(page: Page, url: string, file: string): Promise<Buffer> {
  const response = await page.request.get(url);
  expect(response.status(), `${url} must return a PDF`).toBe(200);
  expect(response.headers()["content-type"]).toContain("application/pdf");
  const buffer = Buffer.from(await response.body());
  expect(buffer.subarray(0, 4).toString("latin1")).toBe("%PDF");
  fs.writeFileSync(path.join(OUT_DIR, file), buffer);
  return buffer;
}

async function assertSinglePageBox(pdf: Buffer, paper: typeof A4, label: string) {
  const doc = await PDFDocument.load(pdf);
  expect(doc.getPageCount(), `${label}: page count`).toBe(1);
  const { width, height } = doc.getPage(0).getSize();
  expect(Math.abs(width - paper.widthPt), `${label}: width in pt (${width.toFixed(2)})`).toBeLessThanOrEqual(
    PT_TOLERANCE,
  );
  expect(Math.abs(height - paper.heightPt), `${label}: height in pt (${height.toFixed(2)})`).toBeLessThanOrEqual(
    PT_TOLERANCE,
  );
}

interface RasterResult {
  width: number;
  height: number;
  /** Lowest row containing non-background ink, in pixels. */
  lastInkRow: number;
  /** First and last columns containing non-background ink. */
  firstInkColumn: number;
  lastInkColumn: number;
  /** PNG bytes of the 300 dpi raster. */
  png: Buffer;
}

async function rasterize300Dpi(pdf: Buffer): Promise<RasterResult> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const canvasFactory = {
    create(width: number, height: number) {
      const canvas = createCanvas(Math.ceil(width), Math.ceil(height));
      return { canvas, context: canvas.getContext("2d") };
    },
    reset() {
      /* handled by a fresh canvas */
    },
    destroy() {
      /* no-op: canvases are garbage collected */
    },
  };
  const doc = await pdfjs.getDocument({
    data: new Uint8Array(pdf),
    canvasFactory,
    useSystemFonts: true,
  }).promise;
  expect(doc.numPages, "rasterized PDF page count").toBe(1);
  const pdfPage = await doc.getPage(1);
  const viewport = pdfPage.getViewport({ scale: 300 / 72 });
  const canvas = createCanvas(Math.round(viewport.width), Math.round(viewport.height));
  const context = canvas.getContext("2d");
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  await pdfPage.render({ canvasContext: context, viewport, canvasFactory }).promise;

  const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
  let lastInkRow = -1;
  let firstInkColumn = canvas.width;
  let lastInkColumn = -1;
  for (let y = 0; y < canvas.height; y += 1) {
    for (let x = 0; x < canvas.width; x += 1) {
      const offset = (y * canvas.width + x) * 4;
      const r = data[offset];
      const g = data[offset + 1];
      const b = data[offset + 2];
      if (r < 245 || g < 245 || b < 245) {
        lastInkRow = y;
        if (x < firstInkColumn) firstInkColumn = x;
        if (x > lastInkColumn) lastInkColumn = x;
      }
    }
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });
  return {
    width: canvas.width,
    height: canvas.height,
    lastInkRow,
    firstInkColumn,
    lastInkColumn,
    png: canvas.toBuffer("image/png"),
  };
}

function assertRaster(result: RasterResult, paper: typeof A4, label: string) {
  expect(Math.abs(result.width - paper.widthPx), `${label}: raster width`).toBeLessThanOrEqual(PX_TOLERANCE);
  expect(Math.abs(result.height - paper.heightPx), `${label}: raster height`).toBeLessThanOrEqual(PX_TOLERANCE);

  // 5 mm at 300 dpi ≈ 59 px. The footer must be fully inside the paper.
  const minMarginPx = Math.round((5 / 25.4) * 300);
  expect(result.lastInkRow, `${label}: ink must stop before the bottom edge`).toBeLessThan(
    result.height - minMarginPx,
  );
  expect(result.lastInkRow, `${label}: footer band must exist`).toBeGreaterThan(result.height * 0.8);
  expect(result.firstInkColumn, `${label}: ink must stop before the left edge`).toBeGreaterThan(minMarginPx);
  expect(result.lastInkColumn, `${label}: ink must stop before the right edge`).toBeLessThan(
    result.width - minMarginPx,
  );
}

async function assertSheetInDom(page: Page, paper: typeof A4) {
  await expect(page.locator('[data-print-ready="true"]')).toBeVisible();
  const box = await page.locator(".print-sheet-wrap").first().boundingBox();
  expect(box, "sheet bounding box").not.toBeNull();
  expect(Math.abs(box!.width - paper.widthMm * MM_TO_CSS_PX)).toBeLessThanOrEqual(PX_TOLERANCE);
  expect(Math.abs(box!.height - paper.heightMm * MM_TO_CSS_PX)).toBeLessThanOrEqual(PX_TOLERANCE);
}

test.describe("print size guarantees", () => {
  test.beforeAll(() => {
    fs.mkdirSync(OUT_DIR, { recursive: true });
  });

  test("A4 invoice: exact page box, single page, 300 dpi raster, footer inside", async ({ page }) => {
    await login(page);
    await page.goto("/print/invoice/1?lang=ku");
    await assertSheetInDom(page, A4);
    const pdf = await fetchPdf(page, "/api/invoices/1/pdf", "invoice-a4-ku.pdf");
    await assertSinglePageBox(pdf, A4, "invoice A4");
    const raster = await rasterize300Dpi(pdf);
    assertRaster(raster, A4, "invoice A4");
    fs.writeFileSync(path.join(OUT_DIR, "invoice-a4-ku-300dpi.png"), raster.png);
    console.log(`[pass] invoice A4 raster ${raster.width}×${raster.height}px`);
  });

  test("A5 voucher: exact page box, single page, 300 dpi raster, footer inside", async ({ page }) => {
    await login(page);
    await page.goto("/print/voucher/1?lang=ar");
    await assertSheetInDom(page, A5);
    const pdf = await fetchPdf(page, "/api/vouchers/1/pdf", "voucher-a5-ar.pdf");
    await assertSinglePageBox(pdf, A5, "voucher A5");
    const raster = await rasterize300Dpi(pdf);
    assertRaster(raster, A5, "voucher A5");
    fs.writeFileSync(path.join(OUT_DIR, "voucher-a5-ar-300dpi.png"), raster.png);
    console.log(`[pass] voucher A5 raster ${raster.width}×${raster.height}px`);
  });

  test("two-up vouchers: two 148 mm copies on one exact A4 page", async ({ page }) => {
    await login(page);
    await page.goto("/print/voucher/1?lang=ar&imposition=2up");
    await expect(page.locator('[data-page-size="210x297"]')).toBeVisible();
    const sheets = page.locator(".print-sheet-wrap");
    await expect(sheets).toHaveCount(2);
    for (let index = 0; index < 2; index += 1) {
      const box = await sheets.nth(index).boundingBox();
      expect(Math.abs(box!.width - 210 * MM_TO_CSS_PX)).toBeLessThanOrEqual(PX_TOLERANCE);
      expect(Math.abs(box!.height - 148 * MM_TO_CSS_PX)).toBeLessThanOrEqual(PX_TOLERANCE);
    }
    const pdf = await fetchPdf(page, "/api/vouchers/1/pdf?imposition=2up", "voucher-a5-2up-a4.pdf");
    await assertSinglePageBox(pdf, A4, "voucher 2-up A4");
    const raster = await rasterize300Dpi(pdf);
    assertRaster(raster, A4, "voucher 2-up A4");
    fs.writeFileSync(path.join(OUT_DIR, "voucher-a5-2up-a4-300dpi.png"), raster.png);
    console.log(`[pass] 2-up voucher A4 raster ${raster.width}×${raster.height}px`);
  });

  test("print notice shows the exact printer settings once, and the help page keeps them", async ({ page }) => {
    await login(page);
    await page.goto("/print/invoice/1?lang=ku");
    await page.getByTestId("print-button").click();
    const notice = page.locator(".print-notice");
    await expect(notice).toBeVisible();
    await expect(notice).toContainText("210 × 297");
    await expect(notice).toContainText("100%");
    await expect(notice).toContainText("None");
    await expect(notice).toContainText("ON");
    await expect(notice).toContainText("OFF");

    await notice.locator("button.secondary").click();
    await expect(notice).toBeHidden();

    await page.getByTestId("print-button").click();
    await expect(notice).toBeVisible();
    await notice.locator("button.primary").click();
    await expect(notice).toBeHidden();

    await page.getByTestId("print-button").click();
    await expect(notice).toBeHidden();

    await page.goto("/help");
    await expect(page.locator("body")).toContainText("A4");
    await expect(page.locator("body")).toContainText("A5");
    await expect(page.getByRole("link", { name: /calibration|پشکنینی|معايرة/i }).first()).toBeVisible();
  });

  test("safe margin moves the content inward while the sheet stays exact", async ({ page }) => {
    await login(page);
    const current = await (await page.request.get("/api/settings")).json();
    const original: number = current.settings.defaults.safeMarginMm;
    const paddingPx = () =>
      page
        .locator(".voucher-sheet")
        .evaluate((element) => Number.parseFloat(getComputedStyle(element).paddingTop));
    try {
      await page.goto("/print/voucher/1?lang=ar");
      await expect(page.locator('[data-print-ready="true"]')).toBeVisible();
      const before = await paddingPx();
      await assertSheetInDom(page, A5);

      await page.request.put("/api/settings", { data: { defaults: { safeMarginMm: 10 } } });
      await page.reload();
      await expect(page.locator('[data-print-ready="true"]')).toBeVisible();
      const after = await paddingPx();
      expect(after, "10 mm safe margin must inset the content").toBeGreaterThan(before + 2);
      expect(Math.abs(after - 10 * MM_TO_CSS_PX), `safe padding ${after.toFixed(2)} px`).toBeLessThanOrEqual(
        PX_TOLERANCE,
      );
      await assertSheetInDom(page, A5);
    } finally {
      await page.request.put("/api/settings", { data: { defaults: { safeMarginMm: original } } });
    }
  });

  test("calibration sheets are exact A4 and A5 sizes in the print route", async ({ page }) => {
    await login(page);
    await page.goto("/print/calibration?size=a4");
    await assertSheetInDom(page, A4);
    await page.screenshot({ path: path.join(OUT_DIR, "calibration-a4.png"), fullPage: true });

    await page.goto("/print/calibration?size=a5");
    await assertSheetInDom(page, A5);
    await page.screenshot({ path: path.join(OUT_DIR, "calibration-a5.png"), fullPage: true });
  });
});
