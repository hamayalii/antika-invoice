import { expect, test, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const OUT_DIR = path.join("docs", "dot-banner");
const CANVAS = ".dot-surface__canvas";
const CRANE = ".sidebar-crane";
const SIDEBAR = "[data-sidebar]";
const USERNAME = process.env.E2E_USERNAME ?? "admin";
const PASSWORD = process.env.E2E_PASSWORD ?? "ChangeMe!1234";

const IDLE_COLORS = ["rgb(228, 230, 232)", "rgb(211, 214, 217)", "rgb(192, 196, 200)", "rgb(174, 179, 184)"];

const CRANE_GLYPHS = "S X t % 8 : o # / \\ | = +";
const CRANE_PITCH_X = 10;
const CRANE_PITCH_Y = 13;
const CRANE_ROWS_SPAN = 18;

test.use({ video: "on" });

async function login(page: Page) {
  await page.goto("/login");
  await page.locator("#username").fill(USERNAME);
  await page.locator("#password").fill(PASSWORD);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL((url) => url.pathname === "/");
}

async function waitForCanvas(page: Page) {
  const canvas = page.locator(CANVAS);
  await expect(canvas).toBeVisible();
  await expect
    .poll(async () => Number(await canvas.getAttribute("data-drawn")), { timeout: 15_000 })
    .toBeGreaterThan(0);
  await expect
    .poll(async () => page.locator("main ul > li").count(), { timeout: 15_000 })
    .toBeGreaterThan(0);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(800);
  return canvas;
}

async function openDashboard(page: Page) {
  await login(page);
  await waitForCanvas(page);
  await expect(page.locator('[role="status"]')).toHaveCount(0, { timeout: 15_000 });
}

async function dataset(page: Page, selector = CANVAS) {
  return page.evaluate((target) => {
    const canvas = document.querySelector<HTMLCanvasElement>(target)!;
    return { ...canvas.dataset } as Record<string, string>;
  }, selector);
}

interface CellHit {
  x: number;
  y: number;
  wx: number;
  wy: number;
  levelY: number;
}

/** Finds a real drawn cell from the canvas pixels and returns page coordinates. */
async function findCell(page: Page): Promise<CellHit | null> {
  return page.evaluate((selector) => {
    const canvas = document.querySelector<HTMLCanvasElement>(selector)!;
    const context = canvas.getContext("2d")!;
    const box = canvas.getBoundingClientRect();
    const scale = canvas.width / box.width;
    const width = canvas.width;
    const height = canvas.height;
    const data = context.getImageData(0, 0, width, height).data;

    const cellSize = 10 * scale;
    for (let y = 0; y < height; y += 2) {
      const starts: number[] = [];
      const widths: number[] = [];
      let runStart = -1;
      for (let x = 0; x < width; x += 1) {
        const alpha = data[(y * width + x) * 4 + 3];
        if (alpha > 240) {
          if (runStart < 0) runStart = x;
        } else if (runStart >= 0) {
          widths.push(x - runStart);
          starts.push(runStart);
          runStart = -1;
        }
      }
      if (runStart >= 0) {
        widths.push(width - runStart);
        starts.push(runStart);
      }
      const filled = widths.filter((value) => Math.abs(value - cellSize) <= 1.5);
      if (filled.length >= 2) {
        // Skip cells hidden behind a solid card so the pointer really meets the canvas.
        const absX = box.left + starts[0] / scale + cellSize / 2;
        const absY = box.top + y / scale;
        const top = document.elementFromPoint(absX, absY);
        if (top && top.closest(".card")) continue;
        return {
          x: starts[0] + cellSize / 2,
          y,
          wx: absX,
          wy: absY,
          levelY: y / scale,
        };
      }
    }
    return null;
  }, CANVAS);
}

async function cellPixel(page: Page, cell: CellHit) {
  return page.evaluate(
    ({ selector, x, y }) => {
      const canvas = document.querySelector<HTMLCanvasElement>(selector)!;
      const context = canvas.getContext("2d")!;
      const scale = canvas.width / canvas.getBoundingClientRect().width;
      const px = Math.round(x * scale);
      const py = Math.round(y * scale);
      const data = context.getImageData(px - 1, py - 1, 3, 3).data;
      let r = 0;
      let g = 0;
      let b = 0;
      let n = 0;
      for (let index = 0; index < data.length; index += 4) {
        if (data[index + 3] > 200) {
          r += data[index];
          g += data[index + 1];
          b += data[index + 2];
          n += 1;
        }
      }
      return n ? [Math.round(r / n), Math.round(g / n), Math.round(b / n)] : null;
    },
    { selector: CANVAS, x: cell.x, y: cell.y },
  );
}

/** Alpha in the 4px gaps around a heatmap cell; a flat fill leaves them empty. */
async function gapAlpha(page: Page, cx: number, cy: number) {
  return page.evaluate(
    ({ selector, cx, cy }) => {
      const canvas = document.querySelector<HTMLCanvasElement>(selector)!;
      const context = canvas.getContext("2d")!;
      const scale = canvas.width / canvas.getBoundingClientRect().width;
      const points = [
        [cx + 7, cy],
        [cx - 7, cy],
        [cx, cy + 7],
        [cx, cy - 7],
        [cx + 7, cy + 7],
        [cx - 7, cy - 7],
        [cx + 7, cy - 7],
        [cx - 7, cy + 7],
      ];
      const result: Array<number | null> = [];
      for (const [x, y] of points) {
        const px = Math.round(x * scale);
        const py = Math.round(y * scale);
        if (px < 0 || py < 0 || px >= canvas.width || py >= canvas.height) {
          result.push(null);
          continue;
        }
        result.push(context.getImageData(px, py, 1, 1).data[3]);
      }
      return result;
    },
    { selector: CANVAS, cx, cy },
  );
}

interface MenuSample {
  label: string;
  ratio: number;
  text: string;
  background: string;
}

/** Decodes a sidebar screenshot and measures WCAG contrast of every inactive label. */
async function menuContrast(page: Page): Promise<MenuSample[]> {
  const host = page.locator(`${SIDEBAR}:visible`);
  await expect(host).toHaveCount(1);
  const layout = await page.evaluate((selector) => {
    const root = Array.from(document.querySelectorAll<HTMLElement>(selector)).find(
      (node) => node.getClientRects().length > 0,
    )!;
    const rootBox = root.getBoundingClientRect();
    const links = Array.from(root.querySelectorAll<HTMLElement>("nav a"));
    return {
      width: rootBox.width,
      height: rootBox.height,
      labels: links
        .filter((link) => !link.className.includes("bg-brand-orange"))
        .map((link) => {
          const span = link.querySelector<HTMLElement>("span")!;
          const box = span.getBoundingClientRect();
          return {
            label: span.textContent?.trim() ?? "",
            x: box.left - rootBox.left,
            y: box.top - rootBox.top,
            width: box.width,
            height: box.height,
            color: getComputedStyle(span).color,
          };
        }),
    };
  }, SIDEBAR);
  expect(layout.labels.length).toBeGreaterThanOrEqual(4);

  const png = (await host.screenshot()).toString("base64");
  return page.evaluate(
    async ({ png, width, height, labels }) => {
      const binary = atob(png);
      const bytes = new Uint8Array(binary.length);
      for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
      const bitmap = await createImageBitmap(new Blob([bytes], { type: "image/png" }));
      const surface = document.createElement("canvas");
      surface.width = bitmap.width;
      surface.height = bitmap.height;
      const context = surface.getContext("2d", { willReadFrequently: true })!;
      context.drawImage(bitmap, 0, 0);
      const scaleX = bitmap.width / width;
      const scaleY = bitmap.height / height;

      const channel = (value: number) => {
        const unit = value / 255;
        return unit <= 0.03928 ? unit / 12.92 : Math.pow((unit + 0.055) / 1.055, 2.4);
      };
      const luminance = (r: number, g: number, b: number) =>
        0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
      const colorLuminance = (value: string) => {
        const match = value.match(/\d+/g);
        if (!match) return 0;
        return luminance(Number(match[0]), Number(match[1]), Number(match[2]));
      };

      return labels.map((label) => {
        const x0 = Math.max(0, Math.floor((label.x - 1) * scaleX));
        const y0 = Math.max(0, Math.floor((label.y - 1) * scaleY));
        const x1 = Math.min(bitmap.width, Math.ceil((label.x + label.width + 1) * scaleX));
        const y1 = Math.min(bitmap.height, Math.ceil((label.y + label.height + 1) * scaleY));
        const image = context.getImageData(x0, y0, Math.max(1, x1 - x0), Math.max(1, y1 - y0)).data;
        const values: number[] = [];
        for (let index = 0; index < image.length; index += 4) {
          values.push(luminance(image[index], image[index + 1], image[index + 2]));
        }
        values.sort((a, b) => a - b);
        const pick = (fraction: number) => values[Math.min(values.length - 1, Math.floor(values.length * fraction))];
        // Text colour comes from the computed style (WCAG uses the specified colours);
        // the backdrop is sampled from the screenshot so any crane tint behind the
        // label is part of the measured contrast.
        const text = colorLuminance(label.color);
        const background = (pick(0.5) + pick(0.65) + pick(0.8)) / 3;
        return {
          label: label.label,
          ratio: (background + 0.05) / (text + 0.05),
          text: label.color,
          background: `luminance ${background.toFixed(3)}`,
        };
      });
    },
    { png, width: layout.width, height: layout.height, labels: layout.labels },
  );
}

interface CraneGeometry {
  hostWidth: number;
  hostHeight: number;
  canvasWidth: number;
  canvasHeight: number;
  canvasLeft: number;
  canvasTop: number;
  cols: number;
  rows: number;
  c0: number;
  t0: number;
  c1: number;
  ground: number;
  craneLeft: number;
  craneRight: number;
  craneTop: number;
  craneBottom: number;
  craneWidth: number;
  craneHeight: number;
  headerH: number;
  cardTop: number;
  position: string;
  pointer: string;
  aria: string;
  zIndex: string;
  mode: string;
  running: string;
}

async function craneGeometry(page: Page): Promise<CraneGeometry> {
  return page.evaluate(() => {
    const canvases = Array.from(document.querySelectorAll<HTMLCanvasElement>(".sidebar-crane"));
    const canvas = canvases.find(
      (node) => node.getClientRects().length > 0 && getComputedStyle(node).visibility !== "hidden",
    )!;
    const host = canvas.closest<HTMLElement>("[data-sidebar]")!;
    const hostBox = host.getBoundingClientRect();
    const canvasBox = canvas.getBoundingClientRect();
    const card = host.lastElementChild as HTMLElement;
    const [c0, t0, c1, ground] = (canvas.dataset.box ?? "0,0,0,0").split(",").map(Number);
    const pitchX = 10;
    const pitchY = 13;
    const tileHeight = 12;
    const craneLeft = c0 * pitchX;
    const craneTop = t0 * pitchY;
    const craneRight = (c1 + 1) * pitchX - 1;
    const craneBottom = ground * pitchY + tileHeight;
    const style = getComputedStyle(canvas);
    return {
      hostWidth: hostBox.width,
      hostHeight: hostBox.height,
      canvasWidth: canvasBox.width,
      canvasHeight: canvasBox.height,
      canvasLeft: canvasBox.left - hostBox.left,
      canvasTop: canvasBox.top - hostBox.top,
      cols: Number(canvas.dataset.cols),
      rows: Number(canvas.dataset.rows),
      c0,
      t0,
      c1,
      ground,
      craneLeft,
      craneRight,
      craneTop,
      craneBottom,
      craneWidth: craneRight - craneLeft + 1,
      craneHeight: craneBottom - craneTop,
      headerH: parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--header-h")) || 76,
      cardTop: card.getBoundingClientRect().top - hostBox.top,
      position: style.position,
      pointer: style.pointerEvents,
      aria: canvas.getAttribute("aria-hidden") ?? "",
      zIndex: style.zIndex,
      mode: canvas.dataset.mode ?? "",
      running: canvas.dataset.running ?? "",
    };
  });
}

function expectCraneInside(geometry: CraneGeometry) {
  expect(geometry.cols).toBeGreaterThanOrEqual(22);
  expect(geometry.rows).toBeGreaterThanOrEqual(28);
  expect(geometry.c0).toBeGreaterThanOrEqual(0);
  expect(geometry.c1).toBeLessThan(geometry.cols);
  expect(geometry.ground).toBeLessThan(geometry.rows);
  expect(geometry.ground - geometry.t0, "the crane keeps its 19-row compact box").toBe(CRANE_ROWS_SPAN);

  // Whole machine on screen, standing on the user card.
  expect(geometry.craneTop).toBeGreaterThanOrEqual(0);
  expect(
    geometry.craneBottom,
    "the ground line may tuck at most half a row behind the card",
  ).toBeLessThanOrEqual(geometry.cardTop + 7);
  expect(
    Math.abs(geometry.craneBottom - geometry.cardTop),
    "the crane stands on the card, not floating above it",
  ).toBeLessThanOrEqual(6.5);
  expect(geometry.craneLeft).toBeGreaterThanOrEqual(0);
  expect(geometry.craneRight).toBeLessThanOrEqual(geometry.hostWidth);
  // The sidebar lives below the full-width header, so compare the crane with
  // the full sidebar-plus-header column it used to occupy.
  expect(geometry.craneHeight / (geometry.hostHeight + geometry.headerH), "the crane stays compact").toBeLessThanOrEqual(0.46);
  expect(
    Math.abs(geometry.craneLeft - (geometry.hostWidth - geometry.craneRight)),
    "the crane box is centred in the sidebar",
  ).toBeLessThanOrEqual(14);

  // The canvas still covers the whole sidebar exactly.
  expect(Math.abs(geometry.canvasWidth - geometry.hostWidth)).toBeLessThan(1);
  expect(Math.abs(geometry.canvasHeight - geometry.hostHeight)).toBeLessThan(1);
  expect(Math.abs(geometry.canvasLeft)).toBeLessThan(1);
  expect(Math.abs(geometry.canvasTop)).toBeLessThan(1);
  expect(geometry.position).toBe("absolute");
  expect(geometry.pointer).toBe("none");
  expect(geometry.aria).toBe("true");
  expect(geometry.zIndex).toBe("0");
}

async function craneTileColor(page: Page, col: number, row: number) {
  return page.evaluate(
    ({ selector, col, row }) => {
      const canvases = Array.from(document.querySelectorAll<HTMLCanvasElement>(selector));
      const canvas = canvases.find((node) => node.getClientRects().length > 0)!;
      const context = canvas.getContext("2d")!;
      const scale = canvas.width / canvas.getBoundingClientRect().width;
      const pitchX = 10;
      const pitchY = 13;
      const x0 = Math.round((col * pitchX + 1) * scale);
      const y0 = Math.round((row * pitchY + 1) * scale);
      const x1 = Math.round((col * pitchX + 9) * scale);
      const y1 = Math.round((row * pitchY + 11) * scale);
      const image = context.getImageData(x0, y0, Math.max(1, x1 - x0), Math.max(1, y1 - y0)).data;
      const counts = new Map<string, number>();
      for (let index = 0; index < image.length; index += 4) {
        // Tiles are painted at 45% alpha; glyph ink is fainter still, so only the
        // flat fill survives this threshold.
        if (image[index + 3] < 110) continue;
        const key = `${image[index]},${image[index + 1]},${image[index + 2]}`;
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
      let best = "";
      let bestCount = 0;
      for (const [key, count] of counts) {
        if (count > bestCount) {
          best = key;
          bestCount = count;
        }
      }
      return best ? { color: best.split(",").map(Number), count: bestCount } : null;
    },
    { selector: CRANE, col, row },
  );
}

test.describe("dashboard background: flat heatmap and one compact sidebar crane", () => {
  test.beforeAll(() => {
    fs.mkdirSync(OUT_DIR, { recursive: true });
  });

  test("squares, levels, clusters and identical layout after reload and resize", async ({ page }) => {
    await page.setViewportSize({ width: 1905, height: 1080 });
    await openDashboard(page);
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(String(error)));
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });

    const state = await dataset(page);
    console.log(
      `[heatmap] cells=${state.cells} drawn=${state.drawn} coverage=${state.coverage} area=${state.area} clusters=${state.clusters} sprinkles=${state.sprinkles} cell=${state.cell}px radius=${state.radius} gap=${state.gap} pitch=${state.pitch}`,
    );
    expect(state.style).toBe("heatmap");
    expect(state.cell).toBe("10");
    expect(state.radius).toBe("2");
    expect(state.gap).toBe("4");
    expect(state.pitch).toBe("14");
    expect(state.levels).toBe("4");
    expect(state.idleColors).toBe(IDLE_COLORS.join("|"));
    expect(state.accent).toBe("rgb(255, 90, 0)");
    const clusters = Number(state.clusters);
    const sprinkles = Number(state.sprinkles);
    expect(clusters).toBeGreaterThanOrEqual(8);
    expect(clusters).toBeLessThanOrEqual(10);
    expect(sprinkles).toBeGreaterThanOrEqual(10);
    expect(sprinkles).toBeLessThanOrEqual(21);
    // Squares are a sparse accent, never the whole page.
    expect(Number(state.coverage)).toBeGreaterThan(0.03);
    expect(Number(state.coverage)).toBeLessThan(0.12);
    expect(Number(state.area)).toBeGreaterThan(0.012);
    expect(Number(state.area)).toBeLessThan(0.06);

    const layout = await page.evaluate((selector) => {
      const main = document.querySelector("main")!;
      const canvas = document.querySelector<HTMLCanvasElement>(selector)!;
      const card = document.querySelector<HTMLElement>("main .card")!;
      const mainStyle = getComputedStyle(main);
      const canvasStyle = getComputedStyle(canvas);
      const cardStyle = getComputedStyle(card);
      const mainBox = main.getBoundingClientRect();
      const canvasBox = canvas.getBoundingClientRect();
      return {
        gradient: mainStyle.backgroundImage,
        parent: canvas.parentElement?.tagName ?? "",
        position: canvasStyle.position,
        pointer: canvasStyle.pointerEvents,
        aria: canvas.getAttribute("aria-hidden"),
        widthDelta: Math.abs(canvasBox.width - mainBox.width),
        heightDelta: Math.abs(canvasBox.height - mainBox.height),
        cardBackground: cardStyle.backgroundColor,
      };
    }, CANVAS);
    expect(layout.gradient).toContain("rgb(248, 248, 248)");
    expect(layout.gradient).toContain("rgb(229, 231, 231)");
    expect(layout.parent).toBe("MAIN");
    expect(layout.position).toBe("absolute");
    expect(layout.pointer).toBe("none");
    expect(layout.aria).toBe("true");
    expect(layout.widthDelta).toBeLessThan(1);
    expect(layout.heightDelta).toBeLessThan(1);
    expect(layout.cardBackground).toBe("rgb(255, 255, 255)");

    // The welcome text is still text only, not a box.
    const hero = await page.evaluate(() => {
      const node = document.querySelector<HTMLElement>(".dot-banner")!;
      const style = getComputedStyle(node);
      return {
        border: style.borderTopWidth,
        radius: style.borderRadius,
        shadow: style.boxShadow,
        background: style.backgroundColor,
        image: style.backgroundImage,
      };
    });
    expect(hero.border).toBe("0px");
    expect(hero.radius).toBe("0px");
    expect(hero.shadow).toBe("none");
    expect(hero.background).toBe("rgba(0, 0, 0, 0)");
    expect(hero.image).toBe("none");
    await expect(page.locator(".dot-banner__actions")).toHaveCount(0);

    // Geometry: 10x10 squares, 2px rounded corners, 4px gaps, four grey levels.
    const geometry = await page.evaluate((selector) => {
      const canvas = document.querySelector<HTMLCanvasElement>(selector)!;
      const context = canvas.getContext("2d")!;
      const box = canvas.getBoundingClientRect();
      const scale = canvas.width / box.width;
      const width = canvas.width;
      const height = canvas.height;
      const image = context.getImageData(0, 0, width, height).data;
      const alphaAt = (x: number, y: number) => image[(y * width + x) * 4 + 3];

      const greys = [
        [228, 230, 232],
        [211, 214, 217],
        [192, 196, 200],
        [174, 179, 184],
      ];
      const levelCounts = [0, 0, 0, 0];
      let opaque = 0;
      for (let index = 0; index < image.length; index += 4) {
        if (image[index + 3] < 250) continue;
        opaque += 1;
        for (let level = 0; level < 4; level += 1) {
          const grey = greys[level];
          if (
            Math.abs(image[index] - grey[0]) <= 2 &&
            Math.abs(image[index + 1] - grey[1]) <= 2 &&
            Math.abs(image[index + 2] - grey[2]) <= 2
          ) {
            levelCounts[level] += 1;
            break;
          }
        }
      }

      const target = Math.round(10 * scale);
      let scanY = -1;
      let starts: number[] = [];
      let widths: number[] = [];
      for (let y = 0; y < height; y += 1) {
        const rowStarts: number[] = [];
        const rowWidths: number[] = [];
        let runStart = -1;
        for (let x = 0; x < width; x += 1) {
          const alpha = image[(y * width + x) * 4 + 3];
          if (alpha > 240) {
            if (runStart < 0) runStart = x;
          } else if (runStart >= 0) {
            rowWidths.push(x - runStart);
            rowStarts.push(runStart);
            runStart = -1;
          }
        }
        if (runStart >= 0) {
          rowWidths.push(width - runStart);
          rowStarts.push(runStart);
        }
        if (rowWidths.filter((value) => Math.abs(value - target) <= 1.5).length >= 3) {
          scanY = y;
          starts = rowStarts;
          widths = rowWidths;
          break;
        }
      }

      let cellHeight = 0;
      let cornerAlpha = 255;
      let insideAlpha = 0;
      let pitch = 0;
      if (scanY >= 0 && starts.length > 0) {
        const center = Math.round(starts[0] + target / 2);
        let top = scanY;
        while (top > 0 && alphaAt(center, top - 1) > 240) top -= 1;
        let bottom = scanY;
        while (bottom < height - 1 && alphaAt(center, bottom + 1) > 240) bottom += 1;
        cellHeight = bottom - top + 1;
        cornerAlpha = alphaAt(starts[0], top);
        insideAlpha = alphaAt(starts[0] + Math.round(3 * scale), top + Math.round(3 * scale));
        const diffs: number[] = [];
        for (let index = 1; index < starts.length; index += 1) {
          const diff = starts[index] - starts[index - 1];
          if (diff > target * 1.2) diffs.push(diff);
        }
        pitch = diffs.length ? Math.min(...diffs) : 0;
      }

      const text = document.querySelector<HTMLElement>(".dot-banner__text")!.getBoundingClientRect();
      const x0 = Math.max(0, Math.round((text.left - box.left) * scale));
      const y0 = Math.max(0, Math.round((text.top - box.top) * scale));
      const x1 = Math.min(width, Math.round((text.right - box.left) * scale));
      const y1 = Math.min(height, Math.round((text.bottom - box.top) * scale));
      let textOpaque = 0;
      for (let y = y0; y < y1; y += 1) {
        for (let x = x0; x < x1; x += 1) {
          if (image[(y * width + x) * 4 + 3] > 0) textOpaque += 1;
        }
      }

      return {
        scale,
        opaque,
        levelCounts,
        scanY,
        runWidths: widths.slice(0, 5),
        cellHeight,
        cornerAlpha,
        insideAlpha,
        pitch,
        textOpaque,
      };
    }, CANVAS);

    expect(geometry.scanY).toBeGreaterThan(0);
    for (const width of geometry.runWidths) {
      expect(Math.abs(width - 10 * geometry.scale)).toBeLessThanOrEqual(1.5);
    }
    expect(geometry.cellHeight).toBeGreaterThanOrEqual(Math.round(9.5 * geometry.scale));
    expect(geometry.cellHeight).toBeLessThanOrEqual(Math.round(10.5 * geometry.scale));
    expect(geometry.pitch, "horizontal pitch must be 14px (10px cell + 4px gap)").toBeGreaterThanOrEqual(
      Math.round(13.5 * geometry.scale),
    );
    expect(geometry.pitch).toBeLessThanOrEqual(Math.round(14.5 * geometry.scale));
    expect(geometry.cornerAlpha, "corners are rounded").toBeLessThan(200);
    expect(geometry.insideAlpha, "the square is solid").toBeGreaterThan(240);
    expect(geometry.textOpaque, "welcome text area and its margin stay empty").toBe(0);
    geometry.levelCounts.forEach((count, level) => {
      expect(count, `grey level ${level + 1} must be present`).toBeGreaterThan(2);
    });

    // Both halves of the page participate, without covering everything.
    expect(geometry.opaque).toBeGreaterThan(0);

    await page.mouse.move(2, 2);
    await page.waitForTimeout(700);
    await page.screenshot({ path: path.join(OUT_DIR, "desktop-1905.png") });

    // Deterministic layout: identical after a reload at the same size.
    expect(state.layout).toBeTruthy();
    expect(state.pattern).toBeTruthy();
    await page.reload();
    await waitForCanvas(page);
    const reloaded = await dataset(page);
    expect(reloaded.layout, "cluster/sprinkle fractions must survive a reload").toBe(state.layout);
    expect(reloaded.pattern, "the drawn pattern must survive a reload").toBe(state.pattern);
    expect(reloaded.coverage).toBe(state.coverage);

    // Resize round-trip keeps the fractional layout and restores the same picture.
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.waitForTimeout(900);
    const middle = await dataset(page);
    expect(middle.layout, "layout fractions are size independent").toBe(state.layout);
    expect(middle.clusters).toBe(state.clusters);
    // Sprinkle groups are placed on a different grid at a different width, so a few
    // rejections can differ; the cluster layout itself stays identical.
    expect(Math.abs(Number(middle.sprinkles) - sprinkles)).toBeLessThanOrEqual(8);
    expect(Number(middle.drawn)).toBeGreaterThan(0);
    await page.setViewportSize({ width: 1905, height: 1080 });
    await page.waitForTimeout(900);
    const restored = await dataset(page);
    expect(restored.pattern).toBe(state.pattern);
    expect(restored.layout).toBe(state.layout);
    expect(restored.coverage).toBe(state.coverage);

    expect(errors, `console/page errors: ${errors.join(" | ")}`).toEqual([]);
  });

  test("hover turns cells orange by level, empties stay dark, idle squares light on their own", async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 1905, height: 1080 });
    await openDashboard(page);
    const canvas = page.locator(CANVAS);

    await page.mouse.move(2, 2);
    await expect.poll(async () => Number(await canvas.getAttribute("data-hot")), { timeout: 4_000 }).toBe(0);

    const cell = await findCell(page);
    expect(cell, "at least one square must be available outside the cards").toBeTruthy();
    await page.mouse.move(cell!.wx - 130, cell!.wy, { steps: 6 });
    await page.waitForTimeout(250);
    await page.mouse.move(cell!.wx, cell!.wy, { steps: 18 });
    await page.waitForTimeout(1_000);
    await expect.poll(async () => Number(await canvas.getAttribute("data-hot")), { timeout: 4_000 }).toBeGreaterThan(0);
    expect(
      Number(await canvas.getAttribute("data-hot")),
      "hover lights a flat 100px radius by level, with no glow around it",
    ).toBeGreaterThan(4);

    const hover = await page.evaluate((selector) => {
      const node = document.querySelector<HTMLCanvasElement>(selector)!;
      return {
        level: Number(node.dataset.hoverLevel),
        color: node.dataset.hoverColor ?? "",
        colors: (node.dataset.hoverColors ?? "").split("|"),
        cyan: node.dataset.hoverX,
        yellow: node.dataset.hoverY,
      };
    }, CANVAS);
    expect(hover.level).toBeGreaterThanOrEqual(1);
    expect(hover.level).toBeLessThanOrEqual(4);
    expect(hover.colors).toHaveLength(4);
    expect(hover.color).toBe(hover.colors[hover.level - 1]);
    expect(hover.cyan).toBeTruthy();
    expect(hover.yellow).toBeTruthy();

    const parse = (value: string) => value.match(/\d+/g)!.slice(0, 3).map(Number);
    const targets = hover.colors.map(parse);
    const distance = (color: number[]) => Math.hypot(color[0] - 248, color[1] - 248, color[2] - 248);
    for (let index = 1; index < targets.length; index += 1) {
      expect(distance(targets[index]), "hover intensity grows with the level").toBeGreaterThan(
        distance(targets[index - 1]) + 1,
      );
    }
    expect(distance(parse(hover.color)), "the hovered square is clearly orange").toBeGreaterThan(60);
    const [red, green, blue] = parse(hover.color);
    expect(red).toBeGreaterThanOrEqual(240);
    expect(green, "orange pulls green down").toBeLessThanOrEqual(215);
    expect(blue, "orange pulls blue down").toBeLessThanOrEqual(195);
    expect(green).toBeGreaterThan(blue);
    if (hover.level === 4) expect(parse(hover.color)).toEqual([255, 90, 0]);

    const hotColor = await cellPixel(page, cell!);
    expect(hotColor).toBeTruthy();
    const expected = parse(hover.color);
    hotColor!.forEach((channel, index) => {
      expect(Math.abs(channel - expected[index]), `channel ${index} matches the level colour`).toBeLessThanOrEqual(10);
    });
    await page.screenshot({ path: path.join(OUT_DIR, "hover-heatmap.png") });

    // Empty welcome area: no square may appear under the pointer.
    const emptyArea = await page.evaluate((selector) => {
      const text = document.querySelector<HTMLElement>(".dot-banner__text")!.getBoundingClientRect();
      return { x: text.left + text.width / 2, y: text.top + text.height / 2 };
    }, CANVAS);
    await page.mouse.move(emptyArea.x, emptyArea.y, { steps: 14 });
    await page.waitForTimeout(600);
    const textPixels = await page.evaluate((selector) => {
      const canvas = document.querySelector<HTMLCanvasElement>(selector)!;
      const context = canvas.getContext("2d")!;
      const box = canvas.getBoundingClientRect();
      const scale = canvas.width / box.width;
      const text = document.querySelector<HTMLElement>(".dot-banner__text")!.getBoundingClientRect();
      const x0 = Math.max(0, Math.round((text.left - box.left) * scale));
      const y0 = Math.max(0, Math.round((text.top - box.top) * scale));
      const x1 = Math.min(canvas.width, Math.round((text.right - box.left) * scale));
      const y1 = Math.min(canvas.height, Math.round((text.bottom - box.top) * scale));
      const image = context.getImageData(x0, y0, Math.max(1, x1 - x0), Math.max(1, y1 - y0)).data;
      let drawn = 0;
      for (let index = 3; index < image.length; index += 4) if (image[index] > 0) drawn += 1;
      return drawn;
    }, CANVAS);
    expect(textPixels, "hover must not light up the empty welcome area").toBe(0);

    // Leaving fades back to grey within roughly 0.7s. Poll, because the same square
    // may also be lit by its own automatic fade at that moment.
    await page.mouse.move(2, 2, { steps: 8 });
    await expect.poll(async () => Number(await canvas.getAttribute("data-hot")), { timeout: 4_000 }).toBe(0);
    const greyDistance = async () => {
      const pixel = await cellPixel(page, cell!);
      if (!pixel) return Number.POSITIVE_INFINITY;
      return Math.min(
        ...[[228, 230, 232], [211, 214, 217], [192, 196, 200], [174, 179, 184]].map((grey) =>
          Math.hypot(pixel[0] - grey[0], pixel[1] - grey[1], pixel[2] - grey[2]),
        ),
      );
    };
    await expect
      .poll(greyDistance, { timeout: 12_000, intervals: [250, 500, 1_000] })
      .toBeLessThan(22);

    // Idle: with no pointer on the canvas, squares turn orange on their own,
    // hold, then fade back to grey. Nothing here moves the mouse.
    await page.mouse.move(2, 2, { steps: 4 });
    await page.waitForTimeout(1_000);
    const before = await canvas.evaluate((node: HTMLCanvasElement) => node.toDataURL());
    const autoHandle = await page.waitForFunction(
      (selector) => {
        const node = document.querySelector<HTMLCanvasElement>(selector);
        if (!node) return false;
        const peak = Number(node.dataset.autoPeak ?? 0);
        const cells = Number(node.dataset.autoCells ?? 0);
        if (peak < 0.99 || cells < 1) return false;
        const x = Number(node.dataset.autoX);
        const y = Number(node.dataset.autoY);
        if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
        const context = node.getContext("2d")!;
        const scale = node.width / node.getBoundingClientRect().width;
        const data = context.getImageData(Math.round(x * scale), Math.round(y * scale), 1, 1).data;
        return {
          peak,
          cells,
          ratio: Number(node.dataset.autoRatio),
          x,
          y,
          hot: Number(node.dataset.hot),
          pixel: [data[0], data[1], data[2], data[3]],
        };
      },
      CANVAS,
      { timeout: 25_000 },
    );
    const auto = (await autoHandle.jsonValue()) as {
      peak: number;
      cells: number;
      ratio: number;
      x: number;
      y: number;
      hot: number;
      pixel: number[];
    };
    expect(auto.hot, "the automatic squares are independent of the cursor").toBe(0);
    expect(auto.peak).toBeGreaterThanOrEqual(0.99);
    expect(auto.ratio, "never more than 8% of the squares are orange at once").toBeLessThanOrEqual(0.0801);
    expect(Number.isFinite(auto.x) && Number.isFinite(auto.y)).toBe(true);

    // A square lit by itself uses its own level colour: flat orange, no glow.
    const autoColor = auto.pixel;
    expect(autoColor[3]).toBeGreaterThan(240);
    expect(autoColor[0], "the automatic square is orange").toBeGreaterThanOrEqual(235);
    expect(autoColor[0], "red dominates green").toBeGreaterThan(autoColor[1]);
    expect(autoColor[1], "green dominates blue").toBeGreaterThan(autoColor[2]);
    expect(autoColor[0] - autoColor[2], "clearly orange, not grey").toBeGreaterThan(55);

    const gaps = await gapAlpha(page, auto.x, auto.y);
    const measured = gaps.filter((alpha): alpha is number => alpha !== null);
    expect(measured.length).toBeGreaterThanOrEqual(2);
    for (const alpha of measured) {
      expect(alpha, "no halo may bleed into the 4px gaps").toBe(0);
    }

    await page.screenshot({ path: path.join(OUT_DIR, "auto-squares.png") });

    // The share of orange squares stays inside 3-8 % the whole time, never flashing.
    const shares: number[] = [];
    for (let sample = 0; sample < 48; sample += 1) {
      shares.push(await canvas.evaluate((node: HTMLCanvasElement) => Number(node.dataset.autoRatio ?? 0)));
      await page.waitForTimeout(250);
    }
    const meanShare = shares.reduce((sum, value) => sum + value, 0) / shares.length;
    const maxShare = Math.max(...shares);
    console.log(`[auto] peak=${auto.peak} cells=${auto.cells} share mean=${meanShare.toFixed(4)} max=${maxShare.toFixed(4)}`);
    expect(maxShare, "the automatic share never spikes past the 8% cap").toBeLessThanOrEqual(0.0801);
    expect(maxShare, "the automatic effect is visibly on").toBeGreaterThanOrEqual(0.025);
    expect(meanShare, "roughly 3-8% of squares stay orange or in transition").toBeGreaterThanOrEqual(0.025);
    expect(meanShare, "the effect stays slow and sparse").toBeLessThanOrEqual(0.08);

    const after = await canvas.evaluate((node: HTMLCanvasElement) => node.toDataURL());
    expect(after, "idle squares must change on their own, without any pointer").not.toBe(before);
    await expect(canvas).toHaveAttribute("data-running", "true");
    await expect(canvas).toHaveAttribute("data-mode", "animated");

    // Hidden tab: the animation pauses on a frozen frame, then resumes when visible.
    await page.evaluate(() => {
      Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "hidden" });
      Object.defineProperty(document, "hidden", { configurable: true, get: () => true });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await expect(canvas).toHaveAttribute("data-running", "false");
    const parked = await canvas.evaluate((node: HTMLCanvasElement) => node.toDataURL());
    await page.waitForTimeout(800);
    expect(await canvas.evaluate((node: HTMLCanvasElement) => node.toDataURL())).toBe(parked);
    await page.evaluate(() => {
      Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "visible" });
      Object.defineProperty(document, "hidden", { configurable: true, get: () => false });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await expect(canvas).toHaveAttribute("data-running", "true");
    await expect
      .poll(async () => canvas.evaluate((node: HTMLCanvasElement) => Number(node.dataset.autoCells ?? 0)), {
        timeout: 8_000,
      })
      .toBeGreaterThan(0);
  });

  test("one compact crane: every part on screen, full 14s loop, flat orange hover", async ({ page }) => {
    test.setTimeout(180_000);
    await page.setViewportSize({ width: 1905, height: 1080 });
    await openDashboard(page);

    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(String(error)));
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });

    // Exactly one canvas crane, and the old ASCII/sea decorations are gone.
    const crane = page.locator(`${CRANE}:visible`);
    await expect(crane).toHaveCount(1);
    expect(await page.locator(CRANE).count()).toBe(1);
    await expect(page.locator(".ascii-crane")).toHaveCount(0);
    await expect(page.locator("[data-visible]")).toHaveCount(0);

    await expect.poll(async () => Number(await crane.getAttribute("data-frame")), { timeout: 10_000 }).toBeGreaterThan(5);
    const start = await dataset(page, CRANE);
    console.log(
      `[crane] tiles=${start.tiles} orange=${start.orange} grey=${start.grey} box=${start.box} cols=${start.cols} rows=${start.rows} height=${start.craneheight}`,
    );
    expect(start.style).toBe("crane");
    expect(start.tile).toBe("9x12");
    expect(start.gap).toBe("1");
    expect(start.grid).toBe("12");
    expect(start.font).toBe("monospace");
    expect(start.alpha).toBe("0.45");
    expect(start.glyphs).toBe(CRANE_GLYPHS);
    expect(Number(start.cols)).toBeGreaterThanOrEqual(22);
    expect(Number(start.rows)).toBeGreaterThanOrEqual(28);
    expect(Number(start.tiles)).toBeGreaterThan(120);
    expect(Number(start.orange)).toBeGreaterThan(80);
    expect(Number(start.grey)).toBeGreaterThan(8);
    expect(Number(start.craneheight), "the crane is a compact box, not a full-height tower").toBeLessThan(0.3);
    expect(start.running).toBe("true");
    expect(start.mode).toBe("animated");

    const geometry = await craneGeometry(page);
    expectCraneInside(geometry);
    // The user card keeps its exact desktop position.
    expect(
      Math.abs(geometry.craneBottom - geometry.cardTop),
      "the crane sits on the user card",
    ).toBeLessThanOrEqual(6.5);

    // Menu labels stay readable on top of the faint crane.
    const contrast = await menuContrast(page);
    console.log(`[contrast 1080] ${contrast.map((sample) => `${sample.label}=${sample.ratio.toFixed(2)}`).join(" ")}`);
    for (const sample of contrast) {
      expect(sample.ratio, `menu label "${sample.label}" must keep WCAG AA contrast`).toBeGreaterThanOrEqual(4.5);
    }

    // One full loop: all phases, both light states, all load states, dust trail.
    const phases = new Set<string>();
    const trolleys = new Set<number>();
    const blinks = new Set<string>();
    const loads = new Set<string>();
    const cycles = new Set<number>();
    let trailSeen = false;
    let maxTiles = 0;
    const momentFiles: Record<string, string> = {
      out: "sidebar-crane-1.png",
      lower: "sidebar-crane-2.png",
      back: "sidebar-crane-3.png",
      release: "sidebar-crane-4.png",
    };
    const captured = new Set<string>();
    const aside = page.locator("aside");
    const deadline = Date.now() + 32_000;
    while (Date.now() < deadline) {
      const frame = (await crane.evaluate((node) => ({
        phase: node.dataset.phase ?? "",
        trolley: Number(node.dataset.trolley),
        blink: node.dataset.blink ?? "",
        load: node.dataset.load ?? "",
        trail: Number(node.dataset.trail),
        cycle: Number(node.dataset.cycle),
        tiles: Number(node.dataset.tiles),
      }))) as {
        phase: string;
        trolley: number;
        blink: string;
        load: string;
        trail: number;
        cycle: number;
        tiles: number;
      };
      if (frame.phase) phases.add(frame.phase);
      if (Number.isFinite(frame.trolley)) trolleys.add(frame.trolley);
      if (frame.blink) blinks.add(frame.blink);
      if (frame.load) loads.add(frame.load);
      if (Number.isFinite(frame.cycle)) cycles.add(frame.cycle);
      if (frame.phase === "back" && frame.trail > 0) trailSeen = true;
      maxTiles = Math.max(maxTiles, frame.tiles);
      if (momentFiles[frame.phase] && !captured.has(frame.phase)) {
        captured.add(frame.phase);
        await aside.screenshot({ path: path.join(OUT_DIR, momentFiles[frame.phase]) });
      }
      await page.waitForTimeout(180);
    }

    console.log(
      `[crane loop] phases=${Array.from(phases).join(",")} loads=${Array.from(loads).join(",")} trolleys=${Array.from(trolleys)
        .sort((a, b) => a - b)
        .join(",")} blinks=${Array.from(blinks).join(",")} cycles=${Array.from(cycles).join(",")}`,
    );
    for (const phase of ["out", "lower", "lift", "back", "lower2", "release", "rise", "return", "idle"]) {
      expect(phases, `the loop must pass through ${phase}`).toContain(phase);
    }
    for (const load of ["pickup", "carried", "placed"]) {
      expect(loads, `the loop must show the load ${load}`).toContain(load);
    }
    expect(trolleys.size, "the trolley must travel along the jib").toBeGreaterThanOrEqual(3);
    expect(blinks, "the apex light must blink").toEqual(new Set(["0", "1"]));
    expect(cycles.size, "a full cycle completes inside the sample window").toBeGreaterThanOrEqual(1);
    expect(trailSeen, "the carried load leaves a dust trail").toBe(true);
    expect(maxTiles).toBeGreaterThan(120);
    expect(captured.size).toBe(4);

    // Hover: the dark base block turns bright orange and fades back to its shade.
    const current = await dataset(page, CRANE);
    const baseCol = Math.round(Number(current.mast!.split(",")[0])) + 1;
    const baseRow = Number(current.ground) - 2;
    const idleColor = await craneTileColor(page, baseCol, baseRow);
    expect(idleColor).toBeTruthy();
    expect(idleColor!.color[0]).toBeGreaterThanOrEqual(185);
    expect(idleColor!.color[0]).toBeLessThanOrEqual(198);
    expect(idleColor!.color[1]).toBeGreaterThanOrEqual(62);
    expect(idleColor!.color[1]).toBeLessThanOrEqual(74);
    expect(idleColor!.color[2]).toBeLessThanOrEqual(4);

    const craneBox = await crane.boundingBox();
    expect(craneBox).toBeTruthy();
    await page.mouse.move(
      craneBox!.x + baseCol * CRANE_PITCH_X + 5,
      craneBox!.y + baseRow * CRANE_PITCH_Y + 6,
      { steps: 10 },
    );
    await expect.poll(async () => Number(await crane.getAttribute("data-hover")), { timeout: 4_000 }).toBeGreaterThan(0);
    await page.waitForTimeout(120);
    const hoverColor = await craneTileColor(page, baseCol, baseRow);
    expect(hoverColor).toBeTruthy();
    expect(hoverColor!.color[0]).toBeGreaterThanOrEqual(230);
    expect(hoverColor!.color[1]).toBeGreaterThanOrEqual(105);
    expect(hoverColor!.color[1]).toBeLessThanOrEqual(168);
    expect(hoverColor!.color[2]).toBeGreaterThanOrEqual(45);

    await page.mouse.move(2, 2, { steps: 6 });
    await expect.poll(async () => Number(await crane.getAttribute("data-hover")), { timeout: 4_000 }).toBe(0);
    await page.waitForTimeout(900);
    const fadedColor = await craneTileColor(page, baseCol, baseRow);
    expect(fadedColor).toBeTruthy();
    fadedColor!.color.forEach((channel, index) => {
      expect(Math.abs(channel - idleColor!.color[index]), `channel ${index} fades back`).toBeLessThanOrEqual(10);
    });

    // Laptop and short windows keep the whole crane above the user card.
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.waitForTimeout(900);
    const laptop = await craneGeometry(page);
    expectCraneInside(laptop);
    await aside.screenshot({ path: path.join(OUT_DIR, "sidebar-crane-720.png") });
    await page.screenshot({ path: path.join(OUT_DIR, "crane-1280x720.png") });
    for (const sample of await menuContrast(page)) {
      expect(sample.ratio, `720p menu label "${sample.label}"`).toBeGreaterThanOrEqual(4.5);
    }
    console.log(
      `[crane 720] box=${laptop.c0},${laptop.t0},${laptop.c1},${laptop.ground} top=${laptop.craneTop} bottom=${laptop.craneBottom} card=${laptop.cardTop}`,
    );

    await page.setViewportSize({ width: 1905, height: 560 });
    await page.waitForTimeout(900);
    const short = await craneGeometry(page);
    expectCraneInside(short);
    const shortLayout = await page.evaluate(() => {
      const nav = document.querySelector("nav")!;
      const links = Array.from(nav.querySelectorAll("a"));
      return {
        scrollOverflow: nav.scrollHeight - nav.clientHeight,
        cardBottom: document.querySelector("[data-sidebar]")!.lastElementChild!.getBoundingClientRect().bottom,
        firstTop: links[0].getBoundingClientRect().top,
        lastBottom: links[links.length - 1].getBoundingClientRect().bottom,
      };
    });
    expect(shortLayout.scrollOverflow, "the whole menu still fits").toBeLessThanOrEqual(0);
    expect(shortLayout.cardBottom).toBeGreaterThanOrEqual(558);
    expect(shortLayout.cardBottom).toBeLessThanOrEqual(561);
    expect(shortLayout.firstTop).toBeGreaterThanOrEqual(91);
    expect(shortLayout.firstTop).toBeLessThanOrEqual(93);
    expect(shortLayout.lastBottom).toBeLessThanOrEqual(shortLayout.cardBottom - 1);
    await aside.screenshot({ path: path.join(OUT_DIR, "sidebar-crane-560.png") });
    console.log(
      `[crane 560] box=${short.c0},${short.t0},${short.c1},${short.ground} top=${short.craneTop} bottom=${short.craneBottom} card=${short.cardTop}`,
    );

    await page.setViewportSize({ width: 1905, height: 1080 });
    await page.waitForTimeout(600);
    const resumed = Number(await crane.getAttribute("data-frame"));
    await page.waitForTimeout(500);
    expect(Number(await crane.getAttribute("data-frame"))).toBeGreaterThan(resumed);
    expectCraneInside(await craneGeometry(page));

    expect(errors, `console/page errors: ${errors.join(" | ")}`).toEqual([]);
  });

  test("reduced motion: static heatmap and one static crane frame", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.setViewportSize({ width: 1905, height: 1080 });
    await login(page);
    await waitForCanvas(page);

    const reduced = await dataset(page);
    expect(reduced.mode).toBe("reduced");
    expect(reduced.running).toBe("false");
    expect(reduced.hot).toBe("0");
    expect(reduced.autoCells).toBe("0");
    expect(reduced.autoRatio).toBe("0.0000");
    const first = await page.locator(CANVAS).evaluate((node: HTMLCanvasElement) => node.toDataURL());
    await page.waitForTimeout(800);
    const second = await page.locator(CANVAS).evaluate((node: HTMLCanvasElement) => node.toDataURL());
    expect(second).toBe(first);

    const crane = page.locator(`${CRANE}:visible`);
    await expect(crane).toHaveCount(1);
    await expect(crane).toHaveAttribute("data-mode", "static");
    await expect(crane).toHaveAttribute("data-running", "false");
    const frame = await crane.evaluate((node: HTMLCanvasElement) => node.toDataURL());
    expect(frame.length).toBeGreaterThan(1_000);

    // Hover is inert when motion is reduced.
    await page.mouse.move(104, 900, { steps: 8 });
    await page.waitForTimeout(500);
    expect(await crane.getAttribute("data-hover")).toBe("0");
    expect(await crane.evaluate((node: HTMLCanvasElement) => node.toDataURL())).toBe(frame);

    await page.waitForTimeout(1_200);
    expect(await crane.evaluate((node: HTMLCanvasElement) => node.toDataURL())).toBe(frame);
    await page.screenshot({ path: path.join(OUT_DIR, "reduced-motion.png") });
  });

  test("Arabic RTL, 390px mobile drawer and route isolation", async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem("antika.lang", "ar"));
    await page.setViewportSize({ width: 1905, height: 1080 });
    await openDashboard(page);

    await expect(page.locator(".dot-banner__title")).toContainText("مرحباً بك،");
    const arabic = await page.evaluate(() => {
      const title = document.querySelector<HTMLElement>(".dot-banner__title")!;
      return {
        dir: getComputedStyle(document.documentElement).direction,
        font: getComputedStyle(title).fontFamily,
        softColor: getComputedStyle(document.querySelector<HTMLElement>(".dot-banner__title-soft")!).color,
        crane: document.querySelectorAll(".sidebar-crane").length,
      };
    });
    expect(arabic.dir).toBe("rtl");
    expect(arabic.font).toContain("Arkan");
    expect(arabic.softColor).toBe("rgb(154, 160, 166)");
    expect(arabic.crane).toBe(1);
    expect(Number((await dataset(page)).clusters)).toBeGreaterThanOrEqual(6);
    await expect(page.locator(`${CRANE}:visible`)).toHaveCount(1);
    await page.mouse.move(2, 2);
    await page.screenshot({ path: path.join(OUT_DIR, "arabic.png") });

    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(900);
    const mobile = await page.evaluate((selector) => {
      const main = document.querySelector("main")!;
      const canvas = document.querySelector<HTMLCanvasElement>(selector)!;
      const mainBox = main.getBoundingClientRect();
      const canvasBox = canvas.getBoundingClientRect();
      return {
        titleSize: getComputedStyle(document.querySelector(".dot-banner__title")!).fontSize,
        canvasWidthDelta: Math.abs(canvasBox.width - mainBox.width),
        canvasHeightDelta: Math.abs(canvasBox.height - mainBox.height),
        drawn: Number(canvas.dataset.drawn),
        overflow: document.documentElement.scrollWidth - window.innerWidth,
        asideDisplay: getComputedStyle(document.querySelector("aside")!).display,
      };
    }, CANVAS);
    expect(mobile.titleSize).toBe("30px");
    expect(mobile.canvasWidthDelta).toBeLessThan(1);
    expect(mobile.canvasHeightDelta).toBeLessThan(1);
    expect(mobile.drawn).toBeGreaterThan(0);
    expect(mobile.overflow).toBeLessThanOrEqual(0);
    expect(mobile.asideDisplay, "the desktop sidebar (and its crane) is hidden on mobile").toBe("none");
    await expect(page.locator(`${CRANE}:visible`)).toHaveCount(0);
    await page.mouse.move(2, 2);
    await page.screenshot({ path: path.join(OUT_DIR, "mobile-390.png") });

    // The drawer brings back exactly one crane, fully inside the drawer.
    await page.locator('button[aria-label="menu"]').click();
    await expect(page.locator(`${CRANE}:visible`)).toHaveCount(1);
    await expect.poll(async () => (await dataset(page, CRANE)).style, { timeout: 10_000 }).toBe("crane");
    const drawer = await craneGeometry(page);
    expectCraneInside(drawer);
    expect(Math.abs(drawer.hostWidth - 288), "the drawer keeps its width").toBeLessThanOrEqual(1);
    const drawerContrast = await menuContrast(page);
    for (const sample of drawerContrast) {
      expect(sample.ratio, `drawer menu label "${sample.label}"`).toBeGreaterThanOrEqual(4.5);
    }
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(OUT_DIR, "mobile-drawer-390.png") });

    // Close the drawer through the backdrop.
    await page.mouse.click(40, 500);
    await expect(page.locator(`${CRANE}:visible`)).toHaveCount(0);

    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(600);
    const scrolled = await page.evaluate((selector) => {
      const canvas = document.querySelector<HTMLCanvasElement>(selector)!;
      const box = canvas.getBoundingClientRect();
      return {
        top: box.top,
        bottom: box.bottom,
        viewport: window.innerHeight,
        scrollY: window.scrollY,
        headerTop: document.querySelector("header")!.getBoundingClientRect().top,
      };
    }, CANVAS);
    expect(scrolled.scrollY).toBeGreaterThan(0);
    expect(scrolled.headerTop).toBe(0);
    expect(scrolled.top).toBeLessThanOrEqual(1);
    expect(scrolled.bottom).toBeGreaterThanOrEqual(scrolled.viewport - 1);
    await page.screenshot({ path: path.join(OUT_DIR, "scrolled-mobile-390.png") });

    // The heatmap is dashboard-only; the crane only lives inside the app sidebar.
    await page.goto("/invoices");
    await expect(page.locator(CANVAS)).toHaveCount(0);
    await expect(page.locator(".dot-surface")).toHaveCount(0);
    expect(await page.locator(CRANE).count()).toBe(1);
    await expect(page.locator(`${CRANE}:visible`)).toHaveCount(0);

    const printPage = await page.context().newPage();
    await printPage.goto("/print/invoice/1?lang=ku");
    await printPage.locator('[data-print-ready="true"]').waitFor();
    await expect(printPage.locator(CANVAS)).toHaveCount(0);
    await expect(printPage.locator(CRANE)).toHaveCount(0);
    await printPage.close();
  });
});
