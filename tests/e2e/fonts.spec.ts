import { expect, test, type Page } from "@playwright/test";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

/**
 * Arkan font guarantees:
 *  - the dashboard, the invoice print route and the dashboard after returning
 *    all report document.fonts.check('16px Arkan', 'ێڵۆڕەڤ') === true;
 *  - every /fonts/arkan/* request returns 200;
 *  - both PDFs embed an Arkan face (pdffonts "emb yes").
 */
const OUT_DIR = path.join("test-results", "fonts");
const USERNAME = process.env.E2E_USERNAME ?? "admin";
const PASSWORD = process.env.E2E_PASSWORD ?? "ChangeMe!1234";
const SAMPLE = "ێڵۆڕەڤ";

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

async function expectArkanLoaded(page: Page, label: string) {
  const result = await page.evaluate(async (sample) => {
    await document.fonts.load("16px Arkan", sample);
    await document.fonts.ready;
    return {
      loaded: document.fonts.check("16px Arkan", sample),
      bodyFamily: getComputedStyle(document.body).fontFamily,
    };
  }, SAMPLE);
  expect(result.loaded, `${label}: document.fonts.check('16px Arkan', '${SAMPLE}')`).toBe(true);
  expect(result.bodyFamily, `${label}: body font stack`).toContain("Arkan");
}

/** Locate pdffonts without requiring it to be on PATH (winget installs a link). */
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
  try {
    execFileSync(process.platform === "win32" ? "where" : "which", ["pdffonts"], { stdio: "pipe" });
    return "pdffonts";
  } catch {
    return null;
  }
}

function expectArkanEmbedded(pdfPath: string, label: string): string {
  const bin = findPdffonts();
  expect(bin, "pdffonts must be installed (winget install oschwartz10612.Poppler)").not.toBeNull();
  const output = execFileSync(bin!, [pdfPath], { encoding: "utf8" });
  fs.writeFileSync(`${pdfPath}.pdffonts.txt`, output);
  const arkanLines = output
    .split(/\r?\n/)
    .filter((line) => /Arkan/i.test(line) && !/^name\s/i.test(line));
  expect(arkanLines.length, `${label}: pdffonts must list an Arkan face\n${output}`).toBeGreaterThan(0);
  const embedded = arkanLines.some((line) => {
    // Columns are name / type / encoding / emb / sub / uni / object ID.
    // "type" contains spaces ("CID TrueType", "Type 3"), so parse the trailing flags.
    const match = line.match(/\s(yes|no)\s+(yes|no)\s+(yes|no)\s+\d+\s+\d+\s*$/);
    return match?.[1] === "yes";
  });
  expect(embedded, `${label}: pdffonts must report emb=yes for Arkan\n${output}`).toBe(true);
  return output;
}

test.describe("Arkan font", () => {
  test.beforeAll(() => {
    fs.mkdirSync(OUT_DIR, { recursive: true });
  });

  test("dashboard, print route and back all use Arkan with 200 font responses", async ({ page }) => {
    const fontResponses: { url: string; status: number }[] = [];
    page.on("response", (response) => {
      if (response.url().includes("/fonts/arkan/")) {
        fontResponses.push({ url: response.url(), status: response.status() });
      }
    });

    await login(page);
    await expect(page.locator('[data-testid="print-button"], a[href="/invoices/new"]').first()).toBeVisible();
    await expectArkanLoaded(page, "dashboard");
    await page.screenshot({ path: path.join(OUT_DIR, "dashboard.png"), fullPage: true });

    await page.goto("/print/invoice/1?lang=ku");
    await expect(page.locator('[data-print-ready="true"]')).toBeVisible();
    await expectArkanLoaded(page, "invoice print route");
    await page.screenshot({ path: path.join(OUT_DIR, "invoice-print.png"), fullPage: true });

    await page.goBack();
    await page.waitForURL((url) => url.pathname === "/");
    await expectArkanLoaded(page, "dashboard after print");
    await page.screenshot({ path: path.join(OUT_DIR, "dashboard-after-print.png"), fullPage: true });

    const arkanFiles = fontResponses.filter((entry) => /\.(woff2|ttf|otf)$/i.test(new URL(entry.url).pathname));
    expect(arkanFiles.length, "the browser must request the bundled Arkan files").toBeGreaterThan(0);
    const byUrl = new Map<string, number[]>();
    for (const entry of arkanFiles) {
      const statuses = byUrl.get(entry.url) ?? [];
      statuses.push(entry.status);
      byUrl.set(entry.url, statuses);
    }
    for (const [url, statuses] of byUrl) {
      // 304 is a cache revalidation of an already-downloaded file.
      expect(statuses, `${url} returned ${statuses.join(",")}`).toContain(200);
      expect(statuses.every((status) => status === 200 || status === 304), `${url} returned ${statuses.join(",")}`).toBe(true);
    }
  });

  test("both generated PDFs embed Arkan (pdffonts emb=yes)", async ({ page }) => {
    await login(page);

    const invoice = await page.request.get("/api/invoices/1/pdf");
    expect(invoice.status()).toBe(200);
    const invoicePath = path.join(OUT_DIR, "invoice-a4-ku.pdf");
    fs.writeFileSync(invoicePath, await invoice.body());
    const invoiceFonts = expectArkanEmbedded(invoicePath, "invoice A4");
    console.log(`[pdffonts] invoice\n${invoiceFonts}`);

    const voucher = await page.request.get("/api/vouchers/1/pdf");
    expect(voucher.status()).toBe(200);
    const voucherPath = path.join(OUT_DIR, "voucher-a5-ar.pdf");
    fs.writeFileSync(voucherPath, await voucher.body());
    const voucherFonts = expectArkanEmbedded(voucherPath, "voucher A5");
    console.log(`[pdffonts] voucher\n${voucherFonts}`);
  });
});
