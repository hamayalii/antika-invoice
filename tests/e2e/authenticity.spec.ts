import { expect, test, type Browser, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { PDFDocument } from "pdf-lib";

const OUT_DIR = path.join("test-results", "screenshots");
const AUTH_FILE = path.join("test-results", ".auth.json");
const BASE_URL = process.env.E2E_BASE_URL ?? "http://127.0.0.1:5173";
const USERNAME = process.env.E2E_USERNAME ?? "admin";
const PASSWORD = process.env.E2E_PASSWORD ?? "ChangeMe!1234";

async function openPage(browser: Browser, storageState?: string): Promise<{ page: Page; close: () => Promise<void> }> {
  const context = await browser.newContext({
    baseURL: BASE_URL,
    viewport: { width: 1440, height: 1000 },
    storageState,
  });
  const page = await context.newPage();
  return { page, close: () => context.close() };
}

async function countChangedPixels(page: Page, before: Buffer, after: Buffer) {
  return page.evaluate(
    async ({ first, second }) => {
      const load = (base64: string) =>
        new Promise<HTMLImageElement>((resolve, reject) => {
          const image = new Image();
          image.onload = () => resolve(image);
          image.onerror = () => reject(new Error("image decode failed"));
          image.src = `data:image/png;base64,${base64}`;
        });
      const [left, right] = await Promise.all([load(first), load(second)]);
      if (left.width !== right.width || left.height !== right.height) return -1;
      const canvas = document.createElement("canvas");
      canvas.width = left.width;
      canvas.height = left.height;
      const context = canvas.getContext("2d");
      if (!context) return -2;
      context.drawImage(left, 0, 0);
      const leftData = context.getImageData(0, 0, canvas.width, canvas.height).data;
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.drawImage(right, 0, 0);
      const rightData = context.getImageData(0, 0, canvas.width, canvas.height).data;
      let changed = 0;
      for (let index = 0; index < leftData.length; index += 16) {
        if (
          Math.abs(leftData[index] - rightData[index]) > 2 ||
          Math.abs(leftData[index + 1] - rightData[index + 1]) > 2 ||
          Math.abs(leftData[index + 2] - rightData[index + 2]) > 2
        ) {
          changed += 1;
        }
      }
      return changed;
    },
    { first: before.toString("base64"), second: after.toString("base64") },
  );
}

test.describe("anti-copy watermark and authenticity layer", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeAll(async ({ playwright }) => {
    fs.mkdirSync(OUT_DIR, { recursive: true });
    const api = await playwright.request.newContext({ baseURL: BASE_URL });
    const response = await api.post("/api/auth/login", {
      data: { username: USERNAME, password: PASSWORD },
    });
    if (!response.ok()) {
      const body = await response.text();
      throw new Error(`E2E login failed (${response.status()}): ${body}`);
    }
    await api.storageState({ path: AUTH_FILE });
    await api.dispose();
  });

  test("A4 invoice contains watermark, microtext, QR and verify code; the watermark reaches the printed pixels", async ({
    browser,
  }) => {
    const { page, close } = await openPage(browser, AUTH_FILE);
    try {
      await page.goto("/print/invoice/1?lang=ku");
      await expect(page.locator('[data-print-ready="true"]')).toBeVisible();

      const watermark = page.locator(".doc-watermark");
      await expect(watermark).toBeVisible();
      const opacity = Number(await watermark.evaluate((element) => getComputedStyle(element).opacity));
      expect(opacity).toBeGreaterThanOrEqual(0.05);
      expect(opacity).toBeLessThanOrEqual(0.3);

      await expect(page.locator(".doc-guilloche").first()).toBeAttached();
      expect(await page.locator(".doc-microtext").count()).toBeGreaterThanOrEqual(2);
      await expect(page.locator(".doc-auth-verify")).toContainText(
        /Verify:\s*[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}/,
      );

      const qr = page.locator(".doc-auth-qr");
      await expect(qr).toBeVisible();
      await expect
        .poll(() => qr.evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth))
        .toBeGreaterThan(0);

      // Screenshot the exact sheet twice: with and without the watermark layer.
      const sheet = page.locator(".print-sheet-wrap");
      const withWatermark = await sheet.screenshot();
      fs.writeFileSync(path.join(OUT_DIR, "invoice-watermark-on.png"), withWatermark);
      await watermark.evaluate((element) => {
        (element as HTMLElement).style.display = "none";
      });
      const withoutWatermark = await sheet.screenshot();
      fs.writeFileSync(path.join(OUT_DIR, "invoice-watermark-off.png"), withoutWatermark);
      const changed = await countChangedPixels(page, withWatermark, withoutWatermark);
      expect(changed).toBeGreaterThan(1000);
      await watermark.evaluate((element) => {
        (element as HTMLElement).style.display = "";
      });

      const pdf = await page.request.get("/api/invoices/1/pdf");
      expect(pdf.status()).toBe(200);
      const buffer = await pdf.body();
      expect(buffer.subarray(0, 4).toString("latin1")).toBe("%PDF");
      expect((await PDFDocument.load(buffer)).getPageCount()).toBe(1);
      fs.writeFileSync(path.join(OUT_DIR, "invoice-a4-auth.pdf"), buffer);
    } finally {
      await close();
    }
  });

  test("A5 voucher keeps the original layout and carries the same layers", async ({ browser }) => {
    const { page, close } = await openPage(browser, AUTH_FILE);
    try {
      await page.goto("/print/voucher/1?lang=ar");
      await expect(page.locator('[data-print-ready="true"]')).toBeVisible();
      await expect(page.locator(".doc-watermark")).toBeVisible();
      await expect(page.locator(".doc-auth-verify")).toContainText(/Verify:/);

      const sheetBox = await page.locator(".voucher-sheet").boundingBox();
      expect(sheetBox?.width).toBeGreaterThan(780);
      expect(sheetBox?.height).toBeGreaterThan(555);
      expect(sheetBox?.height).toBeLessThan(565);

      const pdf = await page.request.get("/api/vouchers/1/pdf");
      expect(pdf.status()).toBe(200);
      const voucherPdf = await PDFDocument.load(await pdf.body());
      expect(voucherPdf.getPageCount()).toBe(1);
      const { width, height } = voucherPdf.getPage(0).getSize();
      expect(Math.abs(width - 595.28)).toBeLessThanOrEqual(0.5);
      expect(Math.abs(height - 419.53)).toBeLessThanOrEqual(0.5);
    } finally {
      await close();
    }
  });

  test("public verification page works without login, in Kurdish, Arabic and English", async ({ browser }) => {
    const auth = await openPage(browser, AUTH_FILE);
    let code: string;
    try {
      const list = await (await auth.page.request.get("/api/vouchers?pageSize=1")).json();
      code = list.items[0].verifyCode as string;
    } finally {
      await auth.close();
    }
    expect(code!).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/);

    const anonymous = await browser.newContext({ baseURL: BASE_URL, viewport: { width: 390, height: 844 } });
    const publicPage = await anonymous.newPage();
    try {
      await publicPage.goto(`/verify/${code!}`);
      await expect(publicPage.getByText("پشکنینی ڕەسەنایەتی بەڵگەنامە")).toBeVisible();
      await expect(publicPage.getByRole("textbox", { name: "کۆدی پشکنین" })).toBeVisible();
      const body = await publicPage.locator("body").innerText();
      expect(body).not.toContain("07701243724");
      expect(body).not.toContain("سلێمانی");

      await publicPage.getByRole("button", { name: "English" }).click();
      await expect(publicPage.locator("html")).toHaveAttribute("dir", "ltr");
      await expect(publicPage.getByText("Document authenticity check")).toBeVisible();

      await publicPage.goto("/verify/ZZZZ-ZZZZ-ZZZZ");
      await expect(publicPage.getByText("بەڵگەنامە نەدۆزرایەوە")).toBeVisible();
    } finally {
      await anonymous.close();
    }
  });
});
