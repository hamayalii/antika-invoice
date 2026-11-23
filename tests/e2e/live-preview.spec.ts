import { expect, test, type Locator, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

/**
 * Bug 1 regression: the editor preview and the totals block must follow the
 * form on EVERY keystroke, with no blur, no save and no second click. The old
 * code watched the mutable `control._formValues` object through useMemo, whose
 * identity never changed, so the preview froze on its first render.
 *
 * All input happens through the keyboard (`pressSequentially`), never through
 * `fill()`, so React sees real per-character input events.
 */
const OUT_DIR = path.join("test-results", "live-preview");
const USERNAME = process.env.E2E_USERNAME ?? "admin";
const PASSWORD = process.env.E2E_PASSWORD ?? "ChangeMe!1234";

const EASTERN = "٠١٢٣٤٥٦٧٨٩";
const PERSIAN = "۰۱۲۳۴۵۶۷۸۹";

/** Documents can render eastern digits; compare numbers as ASCII. */
function asciiDigits(value: string): string {
  return value.replace(/[٠-٩۰-۹]/g, (char) => {
    const eastern = EASTERN.indexOf(char);
    if (eastern >= 0) return String(eastern);
    return String(PERSIAN.indexOf(char));
  });
}

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

/** Clears the field and types the new value with real key events. */
async function typeKeys(locator: Locator, text: string) {
  await locator.click();
  await locator.press("ControlOrMeta+a");
  await locator.press("Backspace");
  if (text.length > 0) await locator.pressSequentially(text, { delay: 20 });
}

test.describe("Live preview (Bug 1)", () => {
  test.beforeAll(() => {
    fs.mkdirSync(OUT_DIR, { recursive: true });
  });

  test("invoice editor: preview, line total, totals and info follow each keystroke", async ({
    page,
  }) => {
    await login(page);
    await page.goto("/invoices/new");
    const preview = page.locator('[data-testid="invoice-preview"]');
    await expect(preview).toBeVisible();
    await expect(preview.locator(".invoice-sheet")).toBeVisible();

    const emptyLineTotal = (await page.locator('[data-testid="line-total-0"]').innerText()).trim();
    expect(emptyLineTotal, "an empty line starts at 0, never NaN").toBe("0");
    const emptyTotal = (await page.locator('[data-testid="totals-total"]').innerText()).trim();
    expect(emptyTotal, "an empty invoice totals 0, never NaN").toBe("0");

    // 1. Customer name appears in the preview as soon as it is typed.
    const customer = "کۆمپانیای تاقیکردنەوەی ئەنتیکە";
    await typeKeys(page.locator("#customer-name"), customer);
    await expect(preview.locator(".inv-customer .cell").first().locator(".value")).toHaveText(
      customer,
    );

    // 2. Item name appears in the preview table row immediately.
    const itemName = "سندوقی ڕەنگاوڕەنگ";
    await typeKeys(page.locator('[data-testid="item-name-0"]'), itemName);
    await expect(preview.locator(".inv-table tbody tr").first().locator(".cell-name")).toHaveText(
      itemName,
    );

    // 3. Qty → price → discount. Each keystroke must recompute.
    await typeKeys(page.locator('[data-testid="item-qty-0"]'), "7");
    await typeKeys(page.locator('[data-testid="item-price-0"]'), "1200");
    await expect(page.locator('[data-testid="line-total-0"]')).toHaveText("8,400");
    await expect(page.locator('[data-testid="totals-total"]')).toHaveText("8,400");

    await typeKeys(page.locator('[data-testid="item-discount-0"]'), "100");
    await expect(page.locator('[data-testid="line-total-0"]')).toHaveText("8,300");
    await expect(page.locator('[data-testid="totals-total"]')).toHaveText("8,300");

    // The document sheet itself must show the same grand total.
    await expect
      .poll(async () =>
        asciiDigits(
          (await preview.locator(".inv-totals .inv-total-item .box").first().innerText()).trim(),
        ),
      )
      .toBe("8,300");

    // 4. Notes on the row follow live too.
    const notes = "داشکاندنی ١٠٠ دینار";
    await typeKeys(page.locator('[data-testid="item-notes-0"]'), notes);
    await expect(
      preview.locator(".inv-table tbody tr").first().locator(".cell-notes"),
    ).toHaveText(notes);

    // 5. Free-text section follows live.
    const info = "زانیاری کاڵا و شێوازی بەرهەمهێنان";
    await typeKeys(page.locator('[data-testid="invoice-item-info"]'), info);
    await expect(preview.locator(".inv-info .content").first()).toHaveText(info);

    // No field was blurred, no save happened: the app is still on /invoices/new.
    expect(new URL(page.url()).pathname).toBe("/invoices/new");

    await page.screenshot({ path: path.join(OUT_DIR, "invoice-live.png"), fullPage: true });
    // Close-up of the preview so the changed values are readable in the report.
    await preview.screenshot({ path: path.join(OUT_DIR, "invoice-preview.png") });
  });

  test("voucher editor: amount, words and recipient follow each keystroke", async ({ page }) => {
    await login(page);
    await page.goto("/vouchers/new");
    const preview = page.locator('[data-testid="voucher-preview"]');
    await expect(preview).toBeVisible();
    await expect(preview.locator(".voucher-sheet")).toBeVisible();

    const wordsBefore = (await preview.locator(".vch-words .value").first().innerText()).trim();

    const recipient = "بەڕێز کاک کارزان محەمەد";
    await typeKeys(page.locator('[data-testid="voucher-received-from"]'), recipient);
    await expect(preview.locator(".vch-topline .vch-field.grow .value").first()).toHaveText(
      recipient,
    );

    const paymentFor = "پارەی پێشینەی سندوقی ئەنتیکە";
    await typeKeys(page.locator('[data-testid="voucher-payment-for"]'), paymentFor);
    await expect(preview.locator(".vch-payfor .value").first()).toHaveText(paymentFor);

    // Amount → the numeric box and the amount-in-words must both change.
    await typeKeys(page.locator('[data-testid="voucher-amount"]'), "1250");
    await expect
      .poll(async () =>
        asciiDigits((await preview.locator(".vch-field.amount .value").first().innerText()).trim()),
      )
      .toBe("1,250");

    await expect
      .poll(async () => (await preview.locator(".vch-words .value").first().innerText()).trim())
      .not.toBe(wordsBefore);

    const wordsAfter = (await preview.locator(".vch-words .value").first().innerText()).trim();
    expect(wordsAfter.length).toBeGreaterThan(0);

    // An empty amount must read as 0 (never NaN) and still render words.
    await typeKeys(page.locator('[data-testid="voucher-amount"]'), "");
    await expect
      .poll(async () =>
        asciiDigits((await preview.locator(".vch-field.amount .value").first().innerText()).trim()),
      )
      .toBe("0");
    await expect(preview.locator(".vch-field.amount .value").first()).not.toContainText("NaN");

    await typeKeys(page.locator('[data-testid="voucher-amount"]'), "1250");

    expect(new URL(page.url()).pathname).toBe("/vouchers/new");
    await page.screenshot({ path: path.join(OUT_DIR, "voucher-live.png"), fullPage: true });
    await preview.screenshot({ path: path.join(OUT_DIR, "voucher-preview.png") });
  });
});
