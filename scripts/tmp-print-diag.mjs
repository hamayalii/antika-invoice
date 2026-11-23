import { chromium } from "playwright";
import fs from "node:fs";

const base = "http://127.0.0.1:5173";
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
const fontRequests = [];
page.on("response", (r) => {
  if (r.url().includes("/fonts/")) fontRequests.push({ url: r.url().split("/").pop(), status: r.status(), type: r.headers()["content-type"] });
});
page.on("pageerror", (e) => console.log("[pageerror]", e.message));

await page.goto(base + "/login");
await page.locator("#username").fill("admin");
await page.locator("#password").fill("ChangeMe!1234");
await page.locator('button[type="submit"]').click();
await page.waitForURL((u) => u.pathname === "/");

const list = await page.evaluate(async () => {
  const r = await fetch("/api/vouchers?pageSize=5", { credentials: "include" });
  return r.json();
});
console.log("vouchers:", JSON.stringify(list.items?.map((v) => ({ id: v.id, n: v.number, lang: v.lang }))));

const id = list.items?.[0]?.id ?? 1;
await page.goto(`${base}/print/voucher/${id}?lang=ar`);
await page.locator('[data-print-ready="true"]').waitFor();
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(600);

const diag = await page.evaluate(async () => {
  const faces = [];
  document.fonts.forEach((f) => faces.push({ family: f.family, weight: f.weight, style: f.style, status: f.status }));
  const sheet = document.querySelector(".voucher-sheet");
  const words = document.querySelector(".vch-words .value");
  const title = document.querySelector(".vch-title .main");
  const cs = getComputedStyle(sheet);
  const ws = getComputedStyle(words);
  const ts = getComputedStyle(title);
  const styleText = (el) => {
    const s = getComputedStyle(el);
    return {
      fontFamily: s.fontFamily,
      fontSize: s.fontSize,
      fontWeight: s.fontWeight,
      transform: s.transform,
      textRendering: s.textRendering,
      fontSynthesis: s.fontSynthesis,
      fontKerning: s.fontKerning,
      fontFeatureSettings: s.fontFeatureSettings,
      fontVariantLigatures: s.fontVariantLigatures,
      letterSpacing: s.letterSpacing,
      textAlign: s.textAlign,
      unicodeBidi: s.unicodeBidi,
      opacity: s.opacity,
      filter: s.filter,
      backdropFilter: s.backdropFilter,
      mixBlendMode: s.mixBlendMode,
      willChange: s.willChange,
      webkitFontSmoothing: s.webkitFontSmoothing,
      lineHeight: s.lineHeight,
    };
  };
  return {
    faces,
    check: document.fonts.check("16px Arkan", "ێڵۆڕەڤ"),
    sheet: styleText(sheet),
    words: styleText(words),
    title: styleText(title),
    bodyFont: getComputedStyle(document.body).fontFamily,
    microtext: styleText(document.querySelector(".doc-microtext")),
  };
});
console.log(JSON.stringify(diag, null, 2));

fs.mkdirSync("test-results/bug2", { recursive: true });
await page.screenshot({ path: "test-results/bug2/voucher-screen.png", fullPage: true });
await page.emulateMedia({ media: "print" });
await page.waitForTimeout(300);
await page.screenshot({ path: "test-results/bug2/voucher-print.png", fullPage: true });

// also element screenshot of the sheet in print media
const sheet = page.locator(".print-sheet-wrap").first();
await sheet.screenshot({ path: "test-results/bug2/voucher-print-sheet.png" });

console.log("font requests:", JSON.stringify(fontRequests, null, 2));
await browser.close();
