import { chromium } from "playwright";

const base = "http://127.0.0.1:5173";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
page.on("pageerror", (e) => console.log("[pageerror]", e.message));
page.on("console", (m) => { if (m.text().startsWith("[render]")) console.log(m.text()); });

await page.goto(base + "/login");
await page.locator("#username").fill("admin");
await page.locator("#password").fill("ChangeMe!1234");
await page.locator('button[type="submit"]').click();
await page.waitForURL((u) => u.pathname === "/");

await page.goto(base + "/invoices/new");
await page.waitForTimeout(1200);

const dump = async (label) => {
  const tbody = await page.locator(".invoice-sheet .inv-table tbody").innerText().catch(() => "ERR");
  const totalBox = await page.locator(".invoice-sheet .inv-total-item .box").first().innerText().catch(() => "ERR");
  const formTotal = await page.locator("text=کۆی گشتی").first().innerText().catch(() => "");
  console.log(`--- ${label} ---`);
  console.log("tbody:", JSON.stringify(tbody));
  console.log("preview grand total:", JSON.stringify(totalBox));
};

await dump("initial");

const name = page.locator('input[name="items.0.name"]');
await name.click();
await page.keyboard.type("تەختە", { delay: 60 });
console.log("name value after typing:", await name.inputValue());
await dump("after name");

const qty = page.locator('input[name="items.0.qty"]');
await qty.click();
await page.keyboard.press("Control+A");
await page.keyboard.type("3", { delay: 60 });
console.log("qty value after typing:", await qty.inputValue());
await dump("after qty");

const price = page.locator('input[name="items.0.price"]');
await price.click();
await page.keyboard.type("1000", { delay: 60 });
console.log("price value after typing:", await price.inputValue());
await dump("after price");

await page.screenshot({ path: "test-results/repro-invoice-editor.png", fullPage: true });
await browser.close();
