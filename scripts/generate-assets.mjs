import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import puppeteer from "puppeteer";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const publicDir = path.join(root, "apps", "web", "public", "assets");
const fontDir = path.join(root, "apps", "web", "public", "fonts");
fs.mkdirSync(publicDir, { recursive: true });

const browser = await puppeteer.launch({
  headless: true,
  args: ["--no-sandbox", "--disable-setuid-sandbox"],
});

async function render(html, width, height, outfile) {
  const page = await browser.newPage();
  await page.setViewport({ width, height, deviceScaleFactor: 3 });
  await page.setContent(html, { waitUntil: "networkidle0" });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({
    path: path.join(publicDir, outfile),
    omitBackground: true,
    clip: { x: 0, y: 0, width, height },
  });
  await page.close();
  console.log(`[assets] wrote ${outfile}`);
}

const fontUrl = pathToFileURL(path.join(fontDir, "arkan-bold.ttf")).href;
const brandHtml = (word, size = 82) => `<!doctype html>
<html><head><meta charset="utf-8"><style>
@font-face { font-family: ArkanLocal; src: url("${fontUrl}") format("truetype"); font-weight: 700 900; }
html,body { margin:0; background:transparent; }
body { width: 460px; height: 130px; display:flex; align-items:center; justify-content:center; }
span { font-family: ArkanLocal; font-weight: 800; font-size:${size}px; color:#FF5A00; line-height:1; }
</style></head><body><span>${word}</span></body></html>`;

await render(brandHtml("ئەنتیکە", 82), 460, 130, "brand-ku.png");
await render(brandHtml("انتــيــكــه", 80), 460, 130, "brand-ar.png");

const logoUrl = pathToFileURL(path.join(publicDir, "logo.svg")).href;
const logoSvg = fs.readFileSync(path.join(publicDir, "logo.svg"), "utf8");
await render(
  `<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;background:transparent}svg{display:block;width:154px;height:87px}</style></head><body>${logoSvg}</body></html>`,
  154,
  87,
  "logo.png",
);

await browser.close();
console.log("[assets] done");
