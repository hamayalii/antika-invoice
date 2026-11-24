import { expect, test, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { createCanvas, loadImage } from "@napi-rs/canvas";

/**
 * Settings → Protection & marking: the live preview must sit directly under
 * that section, show one real-document overview per selected document, and
 * follow every toggle/slider immediately — without writing the saved settings
 * (and therefore without changing what the print route renders).
 */
const OUT_DIR = path.join("artifacts", "e2e", "settings-preview");
const USERNAME = process.env.E2E_USERNAME ?? "admin";
const PASSWORD = process.env.E2E_PASSWORD ?? "ChangeMe!1234";
const DOC_STORAGE_KEY = "antika.settings.preview.document";
const SAMPLE = "ێڵۆڕەڤ";

const PARTS = ["watermark", "guilloche", "microtext", "qr"] as const;
type Part = (typeof PARTS)[number];

const PART_TITLE: Record<Part, string> = {
  watermark: "لۆگۆی ئەنتیکە",
  guilloche: "نقشی ئاسایی",
  microtext: "دەقی ورد",
  qr: "کۆدی QR و پشکنین",
};

const SAVED_KEY: Record<Part, "watermarkEnabled" | "guillocheEnabled" | "microtextEnabled" | "qrEnabled"> = {
  watermark: "watermarkEnabled",
  guilloche: "guillocheEnabled",
  microtext: "microtextEnabled",
  qr: "qrEnabled",
};

interface SecurityDto {
  watermarkEnabled: boolean;
  watermarkOpacity: number;
  watermarkScale: number;
  guillocheEnabled: boolean;
  microtextEnabled: boolean;
  qrEnabled: boolean;
}

interface SettingsDto {
  security: SecurityDto;
  [key: string]: unknown;
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

/** Collects console/page errors. Attach after login (the login page logs a 401). */
function trackErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(String(error)));
  return errors;
}

async function readSaved(page: Page): Promise<SettingsDto> {
  const response = await page.request.get("/api/settings");
  expect(response.ok(), "GET /api/settings").toBeTruthy();
  const body = (await response.json()) as { settings: SettingsDto };
  return body.settings;
}

function toggle(page: Page, part: Part) {
  return page.locator(`[data-testid="settings-toggle-${part}"] input`);
}

async function setToggle(page: Page, part: Part, on: boolean) {
  const input = toggle(page, part);
  if ((await input.isChecked()) !== on) {
    await input.click();
    await expect(input).toBeChecked({ checked: on });
  }
}

async function saveSettings(page: Page) {
  const saved = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === "/api/settings" &&
      response.request().method() === "PUT",
  );
  await page.locator('#settings-form button[type="submit"]').last().click();
  const response = await saved;
  expect(response.ok(), "PUT /api/settings").toBeTruthy();
}

function overview(page: Page, kind: "invoice" | "voucher") {
  return page.locator(`[data-testid="preview-overview-${kind}"]`);
}

async function partCount(page: Page, kind: "invoice" | "voucher", part: Part) {
  const root = overview(page, kind);
  // The verification strip always prints the human-readable code; the QR
  // checkbox only adds/removes the actual QR image inside it.
  if (part === "qr") {
    return root.locator('[data-doc-part="qr"] .doc-auth-qr').count();
  }
  return root.locator(`[data-doc-part="${part}"]`).count();
}

async function openSettings(page: Page) {
  await page.goto("/settings");
  await expect(page.locator('[data-testid="settings-preview"]')).toBeVisible();
  await page.locator('[data-testid="preview-doc-invoice"]').click();
  await expect(overview(page, "invoice")).toBeVisible();
  await expect(overview(page, "invoice").locator(".invoice-sheet")).toBeVisible();
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

test.describe("Settings live preview", () => {
  test.beforeAll(() => {
    fs.mkdirSync(OUT_DIR, { recursive: true });
  });

  test("sits under Protection & marking and renders the real documents", async ({ page }) => {
    await login(page);
    const errors = trackErrors(page);
    await openSettings(page);

    // 1. Directly under the security section (same form flow, before Assets).
    const gap = await page.evaluate(() => {
      const heading = [...document.querySelectorAll("h2")].find((node) =>
        node.textContent?.includes("پاراستن"),
      );
      const section = heading?.closest("section");
      const panel = document.querySelector('[data-testid="settings-preview"]');
      if (!section || !panel) return Number.NaN;
      return panel.getBoundingClientRect().top - section.getBoundingClientRect().bottom;
    });
    expect(gap, "preview sits right below the security card").toBeGreaterThanOrEqual(0);
    expect(gap).toBeLessThanOrEqual(40);

    // 2. Orange 2px / 12px card, real sheet inside.
    const card = await overview(page, "invoice").evaluate((node) => {
      const style = getComputedStyle(node);
      return {
        borderWidth: style.borderWidth,
        borderStyle: style.borderStyle,
        borderColor: style.borderColor,
        radius: style.borderRadius,
      };
    });
    expect(card.borderWidth).toBe("2px");
    expect(card.borderStyle).toBe("solid");
    expect(card.borderColor).toBe("rgb(255, 90, 0)");
    expect(card.radius).toBe("12px");

    // 3. Every protected layer can be seen together in one overview.
    for (const part of PARTS) await setToggle(page, part, true);
    for (const part of PARTS) {
      await expect
        .poll(() => partCount(page, "invoice", part), { message: `invoice ${part}` })
        .toBeGreaterThan(0);
    }

    const invoiceBox = await overview(page, "invoice").locator(".invoice-sheet").boundingBox();
    expect(invoiceBox).not.toBeNull();
    expect(invoiceBox!.width / invoiceBox!.height).toBeCloseTo(210 / 297, 2);

    // The tiny «?» explains what each layer protects against (and never toggles it).
    const helpDot = page.locator('[data-testid="settings-help-dot"]').first();
    await helpDot.click();
    await expect(page.locator('[data-testid="settings-help-tip"]')).toBeVisible();
    await helpDot.click();
    await expect(page.locator('[data-testid="settings-help-tip"]')).toHaveCount(0);

    const fontFamily = await overview(page, "invoice")
      .locator(".invoice-sheet")
      .evaluate((node) => getComputedStyle(node).fontFamily);
    expect(fontFamily).toContain("Arkan");
    await expect
      .poll(() => page.evaluate((text) => document.fonts.check(`16px Arkan`, text), SAMPLE))
      .toBe(true);

    // 4. Voucher: A5 landscape sheet, same four layers.
    await page.locator('[data-testid="preview-doc-voucher"]').click();
    await expect(overview(page, "voucher").locator(".voucher-sheet")).toBeVisible();
    for (const part of PARTS) {
      await expect
        .poll(() => partCount(page, "voucher", part), { message: `voucher ${part}` })
        .toBeGreaterThan(0);
    }
    const voucherBox = await overview(page, "voucher").locator(".voucher-sheet").boundingBox();
    expect(voucherBox).not.toBeNull();
    expect(voucherBox!.width / voucherBox!.height).toBeCloseTo(210 / 148, 2);

    // 5. "Both" shows one overview per document and is remembered on reload.
    await page.locator('[data-testid="preview-doc-both"]').click();
    await expect(overview(page, "invoice")).toBeVisible();
    await expect(overview(page, "voucher")).toBeVisible();
    expect(await page.evaluate((key) => localStorage.getItem(key), DOC_STORAGE_KEY)).toBe("both");

    await page.reload();
    await expect(overview(page, "invoice")).toBeVisible();
    await expect(overview(page, "voucher")).toBeVisible();
    await expect(page.locator('[data-testid="preview-doc-both"]')).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    await page.screenshot({ path: path.join(OUT_DIR, "settings-preview.png"), fullPage: true });
    expect(errors, errors.join("\n")).toEqual([]);
  });

  test("every toggle and slider updates the preview live, before saving", async ({ page }) => {
    await login(page);
    const errors = trackErrors(page);
    const saved = await readSaved(page);

    const writes: string[] = [];
    page.on("request", (request) => {
      if (
        request.method() === "PUT" &&
        new URL(request.url()).pathname === "/api/settings"
      ) {
        writes.push(request.url());
      }
    });

    await openSettings(page);
    await setToggle(page, "watermark", true);
    const watermark = overview(page, "invoice").locator('[data-doc-part="watermark"]');
    await expect(watermark).toBeVisible();

    // Opacity slider: computed opacity follows the range input.
    const opacity = () => watermark.evaluate((node) => getComputedStyle(node).opacity);
    const opacitySlider = page.locator('[data-testid="settings-watermark-opacity"]');
    await opacitySlider.focus();
    await page.keyboard.press("End");
    await expect.poll(opacity).toBe("0.3");
    await page.keyboard.press("Home");
    await expect.poll(opacity).toBe("0.05");

    // Scale slider: the watermark width follows, ×0.5 → ×2 = 4×.
    const width = () => watermark.evaluate((node) => node.getBoundingClientRect().width);
    const scaleSlider = page.locator('[data-testid="settings-watermark-scale"]');
    await scaleSlider.focus();
    await page.keyboard.press("End");
    const wide = await width();
    await page.keyboard.press("Home");
    const narrow = await width();
    expect(wide / narrow).toBeGreaterThan(3.5);
    expect(wide / narrow).toBeLessThan(4.6);

    // Each of the four toggles adds/removes exactly its own layer, unsaved.
    for (const part of PARTS) {
      await setToggle(page, part, true);
      await expect
        .poll(() => partCount(page, "invoice", part), { message: `on ${part}` })
        .toBeGreaterThan(0);
      await setToggle(page, part, false);
      await expect
        .poll(() => partCount(page, "invoice", part), { message: `off ${part}` })
        .toBe(0);
    }

    // Hovering a control outlines its layer (2px orange, radius 6, pulsing).
    await setToggle(page, "guilloche", true);
    await page.locator('[data-testid="settings-toggle-guilloche"]').hover();
    await expect(page.locator('[data-testid="preview-highlight-label"]')).toContainText(
      PART_TITLE.guilloche,
    );
    const outline = await overview(page, "invoice")
      .locator('[data-doc-part="guilloche"]')
      .evaluate((node) => {
        const style = getComputedStyle(node);
        return {
          style: style.outlineStyle,
          width: style.outlineWidth,
          color: style.outlineColor,
          radius: style.borderRadius,
          animation: style.animationName,
        };
      });
    expect(outline.style).toBe("solid");
    expect(outline.width).toBe("2px");
    expect(outline.color).toMatch(/rgba?\(255, 90, 0/);
    expect(outline.radius).toBe("6px");
    expect(outline.animation).toBe("preview-pulse");

    // A switched-off layer gets a dashed placeholder and "inactive" wording.
    await setToggle(page, "microtext", false);
    await page.locator('[data-testid="settings-toggle-microtext"]').hover();
    const bubble = page.locator('[data-testid="preview-highlight-label"]');
    await expect(bubble).toContainText(PART_TITLE.microtext);
    await expect(bubble).toContainText("ناچالاکە");
    const ghost = page.locator('[data-testid="preview-ghost-invoice"]');
    await expect(ghost).toBeVisible();
    const ghostStyle = await ghost.evaluate((node) => {
      const style = getComputedStyle(node);
      return {
        style: style.borderStyle,
        width: style.borderWidth,
        color: style.borderColor,
        animation: style.animationName,
      };
    });
    expect(ghostStyle.style).toBe("dashed");
    expect(ghostStyle.width).toBe("2px");
    expect(ghostStyle.color).toMatch(/rgba?\(255, 90, 0/);
    expect(ghostStyle.animation).toBe("preview-pulse-dashed");

    // Dirty badge appears, but the store is untouched until Save.
    await expect(page.locator('[data-testid="settings-dirty"]')).toBeVisible();
    expect(writes, "no settings write before Save").toEqual([]);
    const after = await readSaved(page);
    expect(after.security).toEqual(saved.security);

    // Reset-to-saved drops the dirty state and restores the layers.
    await page.locator('[data-testid="settings-reset"]').click();
    await expect(page.locator('[data-testid="settings-dirty"]')).toHaveCount(0);
    await expect
      .poll(() => partCount(page, "invoice", "guilloche"))
      .toBe(saved.security.guillocheEnabled ? 1 : 0);

    // Reload proves nothing was persisted.
    await page.reload();
    await expect(overview(page, "invoice")).toBeVisible();
    for (const part of PARTS) {
      await expect(toggle(page, part)).toBeChecked({
        checked: saved.security[SAVED_KEY[part]],
      });
    }
    await expect(page.locator('[data-testid="settings-dirty"]')).toHaveCount(0);
    expect(errors, errors.join("\n")).toEqual([]);
  });

  test("saving persists the preview settings; the print route stays identical", async ({
    page,
  }) => {
    await login(page);
    const errors = trackErrors(page);
    const saved = await readSaved(page);

    // Reference print render with the saved settings.
    const printPage = await page.context().newPage();
    await printPage.emulateMedia({ media: "print" });
    await printPage.goto("/print/invoice/1?autoprint=0");
    await expect(printPage.locator('[data-print-ready="true"]')).toBeVisible();
    await printPage.evaluate(async () => {
      await document.fonts.ready;
      await Promise.all(
        Array.from(document.images).map((image) => image.decode().catch(() => undefined)),
      );
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      );
    });
    const before = await printPage
      .locator(".invoice-sheet")
      .screenshot({ path: path.join(OUT_DIR, "print-before.png") });

    // Toggle all four layers (unsaved) on the settings page.
    await openSettings(page);
    const desired = {} as Record<Part, boolean>;
    for (const part of PARTS) {
      desired[part] = !saved.security[SAVED_KEY[part]];
      await setToggle(page, part, desired[part]);
    }
    await expect(page.locator('[data-testid="settings-dirty"]')).toBeVisible();
    expect((await readSaved(page)).security).toEqual(saved.security);

    // The print route reads the store, not the preview: pixels must match.
    await printPage.reload();
    await expect(printPage.locator('[data-print-ready="true"]')).toBeVisible();
    await printPage.evaluate(async () => {
      await document.fonts.ready;
      await Promise.all(
        Array.from(document.images).map((image) => image.decode().catch(() => undefined)),
      );
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      );
    });
    const after = await printPage
      .locator(".invoice-sheet")
      .screenshot({ path: path.join(OUT_DIR, "print-after.png") });
    const ratio = await pixelDiffRatio(before, after);
    console.log(`[pixel diff] print route before/after unsaved preview = ${(ratio * 100).toFixed(3)}%`);
    expect(ratio).toBeLessThan(0.01);
    await printPage.close();

    // Save → reload keeps the new values and the preview reflects them.
    await saveSettings(page);
    await page.reload();
    await expect(overview(page, "invoice")).toBeVisible();
    for (const part of PARTS) {
      await expect(toggle(page, part)).toBeChecked({ checked: desired[part] });
      if (desired[part]) {
        await expect
          .poll(() => partCount(page, "invoice", part), { message: `persisted ${part}` })
          .toBeGreaterThan(0);
      } else {
        await expect
          .poll(() => partCount(page, "invoice", part), { message: `persisted ${part}` })
          .toBe(0);
      }
    }
    const persisted = await readSaved(page);
    for (const part of PARTS) {
      expect(persisted.security[SAVED_KEY[part]], part).toBe(desired[part]);
    }

    // Restore the original settings so other specs see the seeded state.
    for (const part of PARTS) {
      await setToggle(page, part, saved.security[SAVED_KEY[part]]);
    }
    await saveSettings(page);
    await page.reload();
    await expect(overview(page, "invoice")).toBeVisible();
    const restored = await readSaved(page);
    expect(restored.security).toEqual(saved.security);
    for (const part of PARTS) {
      await expect(toggle(page, part)).toBeChecked({
        checked: saved.security[SAVED_KEY[part]],
      });
    }
    expect(errors, errors.join("\n")).toEqual([]);
  });
});
