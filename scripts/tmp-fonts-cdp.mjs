import { chromium } from "playwright";

const base = "http://127.0.0.1:5173";
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
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

const client = await ctx.newCDPSession(page);
await client.send("DOM.enable");
await client.send("CSS.enable");
const { root } = await client.send("DOM.getDocument", { depth: -1 });

async function platformFonts(selector) {
  const { nodeId } = await client.send("DOM.querySelector", { nodeId: root.nodeId, selector });
  if (!nodeId) return `no node ${selector}`;
  const { fonts } = await client.send("CSS.getPlatformFontsForNode", { nodeId });
  return fonts.map((f) => `${f.familyName} (${f.glyphCount} glyphs${f.isCustomFont ? ", custom" : ""})`);
}

for (const sel of [".vch-title .main", ".vch-words .value", ".vch-field .value", ".vch-sign .role", ".vch-footer .address-lines", ".doc-microtext"]) {
  console.log(sel, "=>", JSON.stringify(await platformFonts(sel)));
}

console.log("--- print media ---");
await page.emulateMedia({ media: "print" });
await page.waitForTimeout(300);
for (const sel of [".vch-title .main", ".vch-words .value", ".vch-field .value", ".vch-sign .role"]) {
  console.log(sel, "=>", JSON.stringify(await platformFonts(sel)));
}

const probe = await page.evaluate(async () => {
  const mk = (family) => {
    const el = document.createElement("span");
    el.style.cssText = `position:absolute;left:-9999px;font:700 40px ${family};`;
    el.textContent = "ێڵۆڕەڤ ئەنتیکە";
    document.body.appendChild(el);
    const w = el.getBoundingClientRect().width;
    el.remove();
    return w;
  };
  await document.fonts.load("700 40px Arkan", "ێڵۆڕەڤ");
  await document.fonts.load("400 40px Arkan", "ێڵۆڕەڤ");
  return {
    arkan: mk('"Arkan"'),
    tahoma: mk("Tahoma"),
    noto: mk('"Noto Naskh Arabic"'),
    check400: document.fonts.check("400 16px Arkan", "ێڵۆڕەڤ"),
    check700: document.fonts.check("700 16px Arkan", "ێڵۆڕەڤ"),
    checkLatin: document.fonts.check("400 16px Arkan", "ANTIKA"),
    loaded: (() => { const a = []; document.fonts.forEach((f) => a.push(`${f.family}/${f.weight}:${f.status}`)); return a; })(),
  };
});
console.log("probe:", JSON.stringify(probe, null, 2));
await browser.close();
