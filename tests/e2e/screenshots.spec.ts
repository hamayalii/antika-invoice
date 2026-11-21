import { expect, test, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { PDFDocument } from "pdf-lib";

const OUT_DIR = path.join("test-results", "screenshots");
const USERNAME = process.env.E2E_USERNAME ?? "admin";
const PASSWORD = process.env.E2E_PASSWORD ?? "ChangeMe!1234";

async function login(page: Page) {
  await page.goto("/login");
  await page.locator("#username").fill(USERNAME);
  await page.locator("#password").fill(PASSWORD);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL((url) => url.pathname === "/" || url.pathname === "/change-password");
  if (new URL(page.url()).pathname === "/change-password") {
    throw new Error(
      "The admin password must be changed before running the E2E tests. " +
        "Log in once and complete the forced password change, or set E2E_PASSWORD to the active password.",
    );
  }
}

/** Exact paper boxes: 210 × 297 mm and 210 × 148 mm converted to points. */
const A4_PT = { width: 595.28, height: 841.89 };
const A5_PT = { width: 595.28, height: 419.53 };
const PT_TOLERANCE = 0.5;

async function expectSinglePageBox(pdf: Buffer, paper: { width: number; height: number }, label: string) {
  expect(pdf.subarray(0, 4).toString("latin1")).toBe("%PDF");
  const doc = await PDFDocument.load(pdf);
  expect(doc.getPageCount(), `${label}: page count`).toBe(1);
  const { width, height } = doc.getPage(0).getSize();
  expect(Math.abs(width - paper.width), `${label}: width ${width.toFixed(2)} pt`).toBeLessThanOrEqual(PT_TOLERANCE);
  expect(Math.abs(height - paper.height), `${label}: height ${height.toFixed(2)} pt`).toBeLessThanOrEqual(PT_TOLERANCE);
}

test.describe("sample documents", () => {
  test.beforeAll(() => {
    fs.mkdirSync(OUT_DIR, { recursive: true });
  });

  test("renders the Kurdish A4 invoice and serves a single-page PDF", async ({ page }) => {
    await login(page);
    await page.goto("/print/invoice/1?lang=ku");
    await expect(page.locator('[data-print-ready="true"]')).toBeVisible();
    await expect(page.locator(".invoice-sheet")).toBeVisible();

    const box = await page.locator(".invoice-sheet").boundingBox();
    expect(box?.width).toBeGreaterThan(700);
    expect(box?.height).toBeGreaterThan(1000);

    await page.screenshot({ path: path.join(OUT_DIR, "invoice-a4-ku.png"), fullPage: true });

    const pdf = await page.request.get("/api/invoices/1/pdf");
    expect(pdf.status()).toBe(200);
    expect(pdf.headers()["content-type"]).toContain("application/pdf");
    const buffer = await pdf.body();
    await expectSinglePageBox(buffer, A4_PT, "invoice A4");
    fs.writeFileSync(path.join(OUT_DIR, "invoice-a4-ku.pdf"), buffer);
  });

  test("renders the Arabic A5 landscape voucher and serves a single-page PDF", async ({ page }) => {
    await login(page);
    await page.goto("/print/voucher/1?lang=ar");
    await expect(page.locator('[data-print-ready="true"]')).toBeVisible();
    await expect(page.locator(".voucher-sheet")).toBeVisible();

    const box = await page.locator(".voucher-sheet").boundingBox();
    expect(box?.width).toBeGreaterThan(700);
    expect(box?.height).toBeGreaterThan(500);

    await page.screenshot({ path: path.join(OUT_DIR, "voucher-a5-ar.png"), fullPage: true });

    const pdf = await page.request.get("/api/vouchers/1/pdf");
    expect(pdf.status()).toBe(200);
    expect(pdf.headers()["content-type"]).toContain("application/pdf");
    const buffer = await pdf.body();
    await expectSinglePageBox(buffer, A5_PT, "voucher A5");
    fs.writeFileSync(path.join(OUT_DIR, "voucher-a5-ar.pdf"), buffer);
  });
});

