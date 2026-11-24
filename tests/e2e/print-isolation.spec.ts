import { expect, test, type Page } from "@playwright/test";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { createCanvas, loadImage } from "@napi-rs/canvas";

/**
 * Bug 2 regression: printing must never rasterise the app shell.
 *
 *  - the Print button opens `/print/<doc>/:id?autoprint=1` in a separate tab
 *    (or hard-navigates the current tab if a popup is blocked);
 *  - the dashboard/SPA `window.print` is never called, so its glyph cache is
 *    never touched and the text area stays pixel-identical;
 *  - the standalone print route waits for every font face, prints itself and
 *    closes; Back is a hard navigation.
 */
const OUT_DIR = path.join("artifacts", "e2e", "print-isolation");
const USERNAME = process.env.E2E_USERNAME ?? "admin";
const PASSWORD = process.env.E2E_PASSWORD ?? "ChangeMe!1234";
const SAMPLE = "ێڵۆڕەڤ";

test.use({ deviceScaleFactor: 2 });

type NumWindow = Window & { __printCalls?: number; __marker?: string };

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

/** Counts window.print without opening a native dialog, on every page/tab in the context. */
async function instrumentPrint(page: Page) {
  await page.context().addInitScript(() => {
    (window as NumWindow).__printCalls = 0;
    window.print = () => {
      (window as NumWindow).__printCalls = ((window as NumWindow).__printCalls ?? 0) + 1;
    };
  });
}

async function expectArkanFullyLoaded(page: Page, label: string) {
  const result = await page.evaluate(async (sample) => {
    await document.fonts.ready;
    const faces: Array<{ family: string; weight: string; status: string }> = [];
    document.fonts.forEach((face) => {
      faces.push({ family: face.family, weight: face.weight, status: face.status });
    });
    return {
      check: document.fonts.check("16px Arkan", sample),
      faces,
    };
  }, SAMPLE);
  const arkan = result.faces.filter((face) => /Arkan/i.test(face.family));
  expect(arkan.length, `${label}: Arkan faces declared`).toBeGreaterThan(0);
  const pending = arkan.filter((face) => face.status !== "loaded");
  expect(pending, `${label}: every Arkan face loaded (${JSON.stringify(pending)})`).toHaveLength(0);
  expect(result.check, `${label}: document.fonts.check('16px Arkan', '${SAMPLE}')`).toBe(true);
}

async function expectArkanAvailable(page: Page, label: string) {
  const check = await page.evaluate(async (sample) => {
    await document.fonts.load("16px Arkan", sample);
    await document.fonts.ready;
    return document.fonts.check("16px Arkan", sample);
  }, SAMPLE);
  expect(check, `${label}: document.fonts.check('16px Arkan', '${SAMPLE}')`).toBe(true);
}

/** Fraction of pixels whose RGB differs by more than a small antialias margin. */
async function pixelDiffRatio(before: Buffer, after: Buffer): Promise<number> {
  const [imageA, imageB] = await Promise.all([loadImage(before), loadImage(after)]);
  const width = Math.min(imageA.width, imageB.width);
  const height = Math.min(imageA.height, imageB.height);
  const surfaceA = createCanvas(width, height);
  const surfaceB = createCanvas(width, height);
  const ctxA = surfaceA.getContext("2d");
  const ctxB = surfaceB.getContext("2d");
  ctxA.drawImage(imageA, 0, 0);
  ctxB.drawImage(imageB, 0, 0);
  const dataA = ctxA.getImageData(0, 0, width, height).data;
  const dataB = ctxB.getImageData(0, 0, width, height).data;
  let different = 0;
  for (let i = 0; i < dataA.length; i += 4) {
    const delta =
      Math.abs(dataA[i] - dataB[i]) +
      Math.abs(dataA[i + 1] - dataB[i + 1]) +
      Math.abs(dataA[i + 2] - dataB[i + 2]);
    if (delta > 24) different += 1;
  }
  return different / (width * height);
}

function findPdffonts(): string | null {
  const explicit = process.env.PDFFONTS_BIN;
  if (explicit && fs.existsSync(explicit)) return explicit;
  const candidates = ["/usr/bin/pdffonts", "/usr/local/bin/pdffonts"];
  const localAppData = process.env.LOCALAPPDATA;
  if (localAppData) {
    const packages = path.join(localAppData, "Microsoft", "WinGet", "Packages");
    if (fs.existsSync(packages)) {
      for (const dir of fs.readdirSync(packages)) {
        if (!/poppler/i.test(dir)) continue;
        const root = path.join(packages, dir);
        for (const sub of fs.readdirSync(root)) {
          for (const bin of ["Library/bin/pdffonts.exe", "bin/pdffonts.exe"]) {
            const candidate = path.join(root, sub, bin);
            if (fs.existsSync(candidate)) candidates.push(candidate);
          }
        }
      }
    }
  }
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

test.describe("Print isolation (Bug 2)", () => {
  test.beforeAll(() => {
    fs.mkdirSync(OUT_DIR, { recursive: true });
  });

  test("Print opens an isolated window; the app tab never prints and stays pixel-identical", async ({
    page,
  }) => {
    await instrumentPrint(page);
    await login(page);
    await page.goto("/invoices");
    await expect(page.locator('[data-testid="print-invoice-1"]')).toBeVisible();

    // Text area of the app shell, captured BEFORE any print action.
    const textArea = page.locator("table.data-table").first();
    await expect(textArea).toBeVisible();
    const before = await textArea.screenshot({
      path: path.join(OUT_DIR, "app-text-before-print.png"),
    });
    await page.evaluate(() => {
      (window as NumWindow).__marker = "alive";
    });

    const [popup] = await Promise.all([
      page.waitForEvent("popup"),
      page.locator('[data-testid="print-invoice-1"]').click(),
    ]);
    await popup.waitForLoadState("load");

    // Isolated route, autoprint flag set, app tab untouched.
    const printUrl = new URL(popup.url());
    expect(printUrl.pathname).toBe("/print/invoice/1");
    expect(printUrl.searchParams.get("autoprint")).toBe("1");
    expect(new URL(page.url()).pathname).toBe("/invoices");
    expect(await page.evaluate(() => (window as NumWindow).__printCalls)).toBe(0);

    // The print document is standalone: no app shell, no sidebar.
    await expect(popup.locator('[data-print-route="invoice"]')).toBeVisible();
    await expect(popup.locator('[data-print-ready="true"]')).toBeVisible();
    expect(await popup.getByRole("navigation").count()).toBe(0);

    await expectArkanFullyLoaded(popup, "invoice print window");

    // Autoprint fires only after the fonts/images are in.
    await expect
      .poll(() => popup.evaluate(() => (window as NumWindow).__printCalls ?? 0), { timeout: 20_000 })
      .toBeGreaterThan(0);

    // Print-media render at 2x (deviceScaleFactor above).
    await popup.emulateMedia({ media: "print" });
    await popup.screenshot({
      path: path.join(OUT_DIR, "invoice-print-media-2x.png"),
      fullPage: true,
    });
    await popup.emulateMedia({ media: "screen" });

    // afterprint → the isolated window closes itself.
    const closed = popup.waitForEvent("close", { timeout: 10_000 });
    await popup.evaluate(() => window.dispatchEvent(new Event("afterprint")));
    await closed;

    // The app tab was not reloaded and its text area is unchanged.
    expect(await page.evaluate(() => (window as NumWindow).__marker)).toBe("alive");
    expect(await page.evaluate(() => (window as NumWindow).__printCalls)).toBe(0);
    const after = await textArea.screenshot({
      path: path.join(OUT_DIR, "app-text-after-print.png"),
    });
    const ratio = await pixelDiffRatio(before, after);
    console.log(`[pixel diff] app text area before/after print = ${(ratio * 100).toFixed(3)}%`);
    expect(ratio, "app text must not change after a print").toBeLessThan(0.01);

    // No glyph corruption: the shell still renders Kurdish with Arkan.
    await expectArkanAvailable(page, "app tab after print");
  });

  test("blocked popup hard-navigates the same tab to the print route (full reload)", async ({
    page,
  }) => {
    await instrumentPrint(page);
    await login(page);
    await page.goto("/vouchers");
    await expect(page.locator('[data-testid="print-voucher-1"]')).toBeVisible();

    await page.evaluate(() => {
      window.open = () => null;
      (window as NumWindow).__marker = "alive";
    });

    const navigated = page.waitForEvent("framenavigated", {
      predicate: (frame) => frame === page.mainFrame(),
      timeout: 20_000,
    });
    await page.locator('[data-testid="print-voucher-1"]').click();
    await navigated;

    const url = new URL(page.url());
    expect(url.pathname).toBe("/print/voucher/1");
    expect(url.searchParams.get("autoprint")).toBe("1");
    // A real document load: the previous JS context (and its marker) is gone.
    expect(await page.evaluate(() => (window as NumWindow).__marker)).toBeUndefined();

    await expect(page.locator('[data-print-route="voucher"]')).toBeVisible();
    await expect(page.locator('[data-print-ready="true"]')).toBeVisible();
    await expectArkanFullyLoaded(page, "voucher print route (same-tab fallback)");

    await expect
      .poll(() => page.evaluate(() => (window as NumWindow).__printCalls ?? 0), { timeout: 20_000 })
      .toBeGreaterThan(0);

    await page.emulateMedia({ media: "print" });
    await page.screenshot({
      path: path.join(OUT_DIR, "voucher-print-media-2x.png"),
      fullPage: true,
    });
    await page.emulateMedia({ media: "screen" });

    // A tab that was not opened by script cannot close itself: the manual
    // close bar must appear instead of leaving a blank/stuck window.
    await page.evaluate(() => window.dispatchEvent(new Event("afterprint")));
    await expect(page.locator('[data-testid="print-close"]')).toBeVisible();
    await page.screenshot({ path: path.join(OUT_DIR, "voucher-close-bar.png") });

    // A tab that was not opened by script cannot be closed; the button then
    // hard-navigates back to the editor (never a router transition).
    await page.evaluate(() => {
      (window as NumWindow).__marker = "alive";
    });
    const leftPrintRoute = page.waitForEvent("framenavigated", {
      predicate: (frame) => frame === page.mainFrame(),
    });
    await page.locator('[data-testid="print-close"]').click();
    await leftPrintRoute;
    expect(new URL(page.url()).pathname).toBe("/vouchers/1/edit");
    expect(await page.evaluate(() => (window as NumWindow).__marker)).toBeUndefined();
  });

  test("print route Back is a hard navigation (new document, not a SPA route)", async ({ page }) => {
    await instrumentPrint(page);
    await login(page);

    await page.goto("/print/voucher/1");
    await expect(page.locator('[data-testid="print-back"]')).toBeVisible();
    await page.evaluate(() => {
      (window as NumWindow).__marker = "alive";
    });
    const navigated = page.waitForEvent("framenavigated", {
      predicate: (frame) => frame === page.mainFrame(),
    });
    await page.locator('[data-testid="print-back"]').click();
    await navigated;
    expect(new URL(page.url()).pathname).toBe("/vouchers/1/edit");
    expect(await page.evaluate(() => (window as NumWindow).__marker)).toBeUndefined();

    await page.goto("/print/invoice/1");
    await expect(page.locator('[data-testid="print-back"]')).toBeVisible();
    await page.evaluate(() => {
      (window as NumWindow).__marker = "alive";
    });
    const navigatedInvoice = page.waitForEvent("framenavigated", {
      predicate: (frame) => frame === page.mainFrame(),
    });
    await page.locator('[data-testid="print-back"]').click();
    await navigatedInvoice;
    expect(new URL(page.url()).pathname).toBe("/invoices/1/edit");
    expect(await page.evaluate(() => (window as NumWindow).__marker)).toBeUndefined();
  });

  test("dashboard self-heals once after a same-tab print", async ({ page }) => {
    await instrumentPrint(page);
    await login(page);
    await expect(page.locator("h1").first()).toBeVisible();

    const navigated = page.waitForEvent("framenavigated", {
      predicate: (frame) => frame === page.mainFrame(),
    });
    await page.evaluate(() => {
      (window as NumWindow).__marker = "alive";
      sessionStorage.setItem("antika.printedAt", String(Date.now()));
      window.dispatchEvent(new Event("afterprint"));
    });
    await navigated;

    // Exactly one reload: the marker is gone and the print flag was cleared.
    expect(await page.evaluate(() => (window as NumWindow).__marker)).toBeUndefined();
    expect(await page.evaluate(() => sessionStorage.getItem("antika.printedAt"))).toBeNull();

    // A second afterprint must not reload again.
    await page.evaluate(() => {
      (window as NumWindow).__marker = "alive";
      window.dispatchEvent(new Event("afterprint"));
    });
    await page.waitForTimeout(800);
    expect(await page.evaluate(() => (window as NumWindow).__marker)).toBe("alive");
  });

  test("voucher PDF embeds Arkan and the font cmap covers the printed script", async ({
    page,
  }) => {
    await login(page);
    const voucher = await page.request.get("/api/vouchers/1/pdf");
    expect(voucher.status()).toBe(200);
    const pdfPath = path.join(OUT_DIR, "voucher-a5.pdf");
    fs.writeFileSync(pdfPath, await voucher.body());

    const bin = findPdffonts();
    expect(bin, "pdffonts must be installed (winget install oschwartz10612.Poppler)").not.toBeNull();
    const output = execFileSync(bin!, [pdfPath], { encoding: "utf8" });
    fs.writeFileSync(`${pdfPath}.pdffonts.txt`, output);
    console.log(`[pdffonts] voucher\n${output}`);
    const arkanLines = output
      .split(/\r?\n/)
      .filter((line) => /Arkan/i.test(line) && !/^name\s/i.test(line));
    expect(arkanLines.length).toBeGreaterThan(0);
    const embedded = arkanLines.some((line) => {
      const match = line.match(/\s(yes|no)\s+(yes|no)\s+(yes|no)\s+\d+\s+\d+\s*$/);
      return match?.[1] === "yes";
    });
    expect(embedded, `Arkan must be embedded\n${output}`).toBe(true);
    expect(output).not.toMatch(/Type 3/i);

    const glyphReport = execFileSync("python", ["scripts/glyphcheck.py"], { encoding: "utf8" });
    fs.writeFileSync(path.join(OUT_DIR, "glyphcheck.txt"), glyphReport);
    console.log(`[glyphcheck]\n${glyphReport}`);
    const lines = glyphReport.trim().split(/\r?\n/);
    expect(lines).toHaveLength(5);
    for (const line of lines) {
      expect(line, "every Arkan cut covers the printed sample").toContain("missing: -");
    }
  });
});
