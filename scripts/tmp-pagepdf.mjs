import { chromium } from "playwright";
import fs from "node:fs";

const base = "http://127.0.0.1:5173";
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1240, height: 1754 } });
const page = await ctx.newPage();
await page.goto(base + "/login");
await page.locator("#username").fill("admin");
await page.locator("#password").fill("ChangeMe!1234");
await page.locator('button[type="submit"]').click();
await page.waitForURL((u) => u.pathname === "/");

await page.goto(`${base}/print/voucher/9?lang=ar`);
await page.locator('[data-print-ready="true"]').waitFor();
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(500);
await page.emulateMedia({ media: "print" });
const pdf = await page.pdf({ width: "210mm", height: "148mm", printBackground: true, preferCSSPageSize: true, margin: { top: 0, right: 0, bottom: 0, left: 0 } });
fs.writeFileSync("test-results/bug2/voucher-pagepdf.pdf", pdf);
console.log("pdf bytes", pdf.length);
await browser.close();
