import { useEffect, useRef } from "react";
import "./dot-banner.css";

const PITCH = 14;
const CELL = 10;
const CORNER = 2;
const GAP = 4;
const LAYOUT_SEED = 0x51ed2701;
const HOVER_RADIUS = 100;
const CLEAR_MARGIN = 24;
const MAX_COVERAGE = 0.12;
const AUTO_MAX_SHARE = 0.08;
const AUTO_GROUP_MAX = 6;
const LEVEL_MIX = [0.25, 0.45, 0.7, 1];

type Rgb = readonly [number, number, number];

const GREY_LEVELS: Rgb[] = [
  [228, 230, 232],
  [211, 214, 217],
  [192, 196, 200],
  [174, 179, 184],
];
const BG_TOP: Rgb = [248, 248, 248];
const BG_BOTTOM: Rgb = [229, 231, 231];

interface Cell {
  x: number;
  y: number;
  level: number;
  cluster: number;
}

interface AutoState {
  start: number;
  fadeIn: number;
  hold: number;
  fadeOut: number;
}

interface Cluster {
  cx: number;
  cy: number;
  r: number;
  seed: number;
}

interface Sprinkle {
  cx: number;
  cy: number;
  seed: number;
  count: number;
}

interface ClearRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

function mulberry32(seed: number): () => number {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Per-cell seed: the pattern of a cell never depends on the grid size. */
function cellSeed(column: number, row: number): number {
  return (Math.imul(column + 1, 374761393) ^ Math.imul(row + 1, 668265263)) >>> 0;
}

/** Smooth angle noise: gives every cluster an irregular, organic outline. */
function angleNoise(seed: number, angle: number): number {
  const buckets = 10;
  const t = ((angle + Math.PI) / (Math.PI * 2)) * buckets;
  const index = Math.floor(t);
  const fraction = t - index;
  const sample = (key: number) =>
    mulberry32((seed ^ Math.imul(((key % buckets) + buckets) % buckets + 1, 0x9e3779b1)) >>> 0)();
  const a = sample(index);
  const b = sample(index + 1);
  const s = fraction * fraction * (3 - 2 * fraction);
  return a + (b - a) * s;
}

function parseColor(input: string): Rgb | null {
  const value = input.trim();
  const short = /^#([0-9a-f]{3})$/i.exec(value);
  if (short) {
    const [r, g, b] = short[1].split("").map((part) => parseInt(part + part, 16));
    return [r, g, b];
  }
  const long = /^#([0-9a-f]{6})$/i.exec(value);
  if (long) {
    const n = parseInt(long[1], 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  const rgb = /^rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/i.exec(value);
  if (rgb) return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])];
  return null;
}

function mix(from: Rgb, to: Rgb, amount: number): Rgb {
  const t = Math.min(1, Math.max(0, amount));
  return [
    Math.round(from[0] + (to[0] - from[0]) * t),
    Math.round(from[1] + (to[1] - from[1]) * t),
    Math.round(from[2] + (to[2] - from[2]) * t),
  ];
}

function css(color: Rgb): string {
  return `rgb(${color[0]}, ${color[1]}, ${color[2]})`;
}

function patternHash(cells: Cell[]): string {
  let hash = 0x811c9dc5;
  for (const cell of cells) {
    hash ^= Math.round(cell.x) * 4096 + Math.round(cell.y);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

function makeLayout(): { clusters: Cluster[]; sprinkles: Sprinkle[] } {
  const random = mulberry32(LAYOUT_SEED);
  const clusters: Cluster[] = [];
  const clusterCount = 8 + Math.floor(random() * 3);
  for (let index = 0; index < clusterCount; index += 1) {
    clusters.push({
      cx: 0.05 + random() * 0.9,
      cy: 0.05 + random() * 0.9,
      r: 6 + random() * 4,
      seed: Math.floor(random() * 0xffffffff) >>> 0,
    });
  }
  const sprinkles: Sprinkle[] = [];
  const sprinkleCount = 14 + Math.floor(random() * 8);
  for (let index = 0; index < sprinkleCount; index += 1) {
    sprinkles.push({
      cx: 0.03 + random() * 0.94,
      cy: 0.03 + random() * 0.94,
      seed: Math.floor(random() * 0xffffffff) >>> 0,
      count: 1 + Math.floor(random() * 3),
    });
  }
  return { clusters, sprinkles };
}

export function DotCanvas({ clearSelector }: { clearSelector?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const host = canvas?.parentElement;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !host || !ctx) return;

    const accentValue = getComputedStyle(canvas).getPropertyValue("--dot-accent");
    const accent = parseColor(accentValue) ?? [255, 90, 0];
    const reducedQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const { clusters, sprinkles } = makeLayout();
    const layoutKey = `${clusters
      .map((cluster) => `${cluster.cx.toFixed(4)},${cluster.cy.toFixed(4)},${cluster.r.toFixed(3)}`)
      .join(";")}|${sprinkles
      .map((sprinkle) => `${sprinkle.cx.toFixed(4)},${sprinkle.cy.toFixed(4)},${sprinkle.count},${sprinkle.seed}`)
      .join(";")}`;

    let width = 0;
    let height = 0;
    let clearRects: ClearRect[] = [];
    let cells: Cell[] = [];
    let heat = new Float32Array(0);
    let autoLevel = new Float32Array(0);
    let autoState: Array<AutoState | null> = [];
    let autoPool: number[] = [];
    let neighbors = new Map<number, number[]>();
    let nextAutoPick = 0;
    let rafId = 0;
    let running = false;
    let pageVisible = document.visibilityState !== "hidden";
    let inViewport = true;
    let lastFrame = 0;
    const pointer = { x: 0, y: 0, targetX: 0, targetY: 0, active: false };
    let disposed = false;

    const reduced = () => reducedQuery.matches;

    const clearNodes = () =>
      clearSelector ? Array.from(host.querySelectorAll<HTMLElement>(clearSelector)) : [];

    const measureText = () => {
      const frame = canvas.getBoundingClientRect();
      clearRects = clearNodes().map((element) => {
        const box = element.getBoundingClientRect();
        return {
          x: box.left - frame.left - CLEAR_MARGIN,
          y: box.top - frame.top - CLEAR_MARGIN,
          w: box.width + CLEAR_MARGIN * 2,
          h: box.height + CLEAR_MARGIN * 2,
        };
      });
      canvas.dataset.clear = clearRects
        .map((rect) => [rect.x, rect.y, rect.w, rect.h].map((value) => Math.round(value)).join(","))
        .join(";");
    };

    const bgAt = (y: number): Rgb => mix(BG_TOP, BG_BOTTOM, Math.min(1, Math.max(0, y / height)));

    const idleColor = (level: number): Rgb => {
      const clamped = Math.min(4, Math.max(1, level));
      const index = Math.floor(clamped) - 1;
      if (index >= 3) return GREY_LEVELS[3];
      return mix(GREY_LEVELS[index], GREY_LEVELS[index + 1], clamped - Math.floor(clamped));
    };

    const hoverColor = (cell: Cell): Rgb =>
      mix(bgAt(cell.y), accent, LEVEL_MIX[Math.min(3, Math.max(0, Math.round(cell.level) - 1))]);

    const build = () => {
      const box = canvas.getBoundingClientRect();
      if (box.width < 2 || box.height < 2) return;
      width = box.width;
      height = box.height;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      measureText();

      const columns = Math.max(1, Math.floor((width - GAP) / PITCH));
      const rows = Math.max(1, Math.floor((height - GAP) / PITCH));
      const startX = Math.round((width - (columns * PITCH - GAP)) / 2);
      const startY = Math.round((height - (rows * PITCH - GAP)) / 2);
      const gridCells = columns * rows;

      const inClear = (x: number, y: number) =>
        clearRects.some(
          (rect) =>
            x + CELL > rect.x && x < rect.x + rect.w && y + CELL > rect.y && y < rect.y + rect.h,
        );

      const picked = new Map<number, Cell>();

      for (let row = 0; row < rows; row += 1) {
        for (let column = 0; column < columns; column += 1) {
          const x = startX + column * PITCH;
          const y = startY + row * PITCH;
          if (inClear(x, y)) continue;
          const centerX = x + CELL / 2;
          const centerY = y + CELL / 2;
          let bestEdge = 2;
          let bestLevel = 0;
          let bestCluster = -1;
          for (let clusterIndex = 0; clusterIndex < clusters.length; clusterIndex += 1) {
            const cluster = clusters[clusterIndex];
            const dx = centerX - cluster.cx * width;
            const dy = centerY - cluster.cy * height;
            const distance = Math.hypot(dx, dy);
            const radius = cluster.r * PITCH;
            if (distance > radius) continue;
            const lobe = 0.72 + 0.32 * angleNoise(cluster.seed, Math.atan2(dy, dx));
            const edge = distance / (radius * lobe);
            if (edge >= 1) continue;
            const random = mulberry32(cellSeed(column, row) ^ cluster.seed);
            if (random() >= 1 - edge) continue;
            if (edge < bestEdge) {
              bestEdge = edge;
              const level = Math.round(4 - 3.2 * edge + (random() - 0.5) * 1.1);
              bestLevel = Math.min(4, Math.max(1, level));
              bestCluster = clusterIndex;
            }
          }
          if (bestLevel > 0) {
            picked.set(row * 4096 + column, {
              x,
              y,
              level: bestLevel,
              cluster: bestCluster,
            });
          }
        }
      }

      const nearCluster = (x: number, y: number) =>
        clusters.some(
          (cluster) =>
            Math.hypot(
              x + CELL / 2 - cluster.cx * width,
              y + CELL / 2 - cluster.cy * height,
            ) <
            cluster.r * PITCH * 1.05,
        );

      let placedGroups = 0;
      for (const sprinkle of sprinkles) {
        const random = mulberry32(sprinkle.seed);
        let placed = false;
        for (let attempt = 0; attempt < 12 && !placed; attempt += 1) {
          const baseColumn = Math.min(
            columns - 1,
            Math.max(
              0,
              Math.round((sprinkle.cx * width) / PITCH) + Math.round((random() - 0.5) * 6),
            ),
          );
          const baseRow = Math.min(
            rows - 1,
            Math.max(
              0,
              Math.round((sprinkle.cy * height) / PITCH) + Math.round((random() - 0.5) * 6),
            ),
          );
          for (let index = 0; index < sprinkle.count; index += 1) {
            const column = Math.min(
              columns - 1,
              Math.max(0, baseColumn + Math.round((random() - 0.5) * 4)),
            );
            const row = Math.min(rows - 1, Math.max(0, baseRow + Math.round((random() - 0.5) * 4)));
            const key = row * 4096 + column;
            if (picked.has(key)) continue;
            const x = startX + column * PITCH;
            const y = startY + row * PITCH;
            if (inClear(x, y) || nearCluster(x, y)) continue;
            const level = 1 + Math.floor(random() * 4);
            picked.set(key, { x, y, level, cluster: -1 });
            placed = true;
          }
        }
        if (placed) placedGroups += 1;
      }

      let candidates = Array.from(picked.values());
      const maxCells = Math.floor(gridCells * MAX_COVERAGE);
      if (candidates.length > maxCells) {
        const ratio = maxCells / candidates.length;
        candidates = candidates.filter((cell) => {
          const column = Math.round((cell.x - startX) / PITCH);
          const row = Math.round((cell.y - startY) / PITCH);
          return mulberry32(cellSeed(column, row) ^ 0xa5a5a5a5)() < ratio;
        });
      }

      cells = candidates;
      heat = new Float32Array(cells.length);
      autoLevel = new Float32Array(cells.length);
      autoState = cells.map(() => null);
      autoPool = [];
      nextAutoPick = 0;
      pointer.active = false;

      // Every square can light up on its own, except those behind the solid cards.
      const occluders = Array.from(host.querySelectorAll<HTMLElement>(".card")).map((element) => {
        const rect = element.getBoundingClientRect();
        return {
          x: rect.left - box.left,
          y: rect.top - box.top,
          w: rect.width,
          h: rect.height,
        };
      });
      const indexByKey = new Map<number, number>();
      const cellColumns: number[] = [];
      const cellRows: number[] = [];
      cells.forEach((cell, index) => {
        const column = Math.round((cell.x - startX) / PITCH);
        const row = Math.round((cell.y - startY) / PITCH);
        cellColumns.push(column);
        cellRows.push(row);
        indexByKey.set(row * 4096 + column, index);
        const hidden = occluders.some(
          (rect) =>
            cell.x + CELL > rect.x && cell.x < rect.x + rect.w && cell.y + CELL > rect.y && cell.y < rect.y + rect.h,
        );
        if (!hidden) autoPool.push(index);
      });
      const poolSet = new Set<number>(autoPool);
      neighbors = new Map();
      for (const index of autoPool) {
        const column = cellColumns[index];
        const row = cellRows[index];
        const list: number[] = [];
        if (cells[index].cluster >= 0) {
          // Chebyshev distance 2: sparse clusters rarely have 8-adjacent runs, and a
          // 1-6 square patch should still read as one small local group.
          for (let dy = -2; dy <= 2; dy += 1) {
            for (let dx = -2; dx <= 2; dx += 1) {
              if (dx === 0 && dy === 0) continue;
              const next = indexByKey.get((row + dy) * 4096 + column + dx);
              if (next === undefined || !poolSet.has(next)) continue;
              if (cells[next].cluster !== cells[index].cluster) continue;
              list.push(next);
            }
          }
        }
        neighbors.set(index, list);
      }

      canvas.dataset.style = "heatmap";
      canvas.dataset.cell = String(CELL);
      canvas.dataset.radius = String(CORNER);
      canvas.dataset.gap = String(GAP);
      canvas.dataset.pitch = String(PITCH);
      canvas.dataset.levels = "4";
      canvas.dataset.idleColors = GREY_LEVELS.map((color) => css(color)).join("|");
      canvas.dataset.clusters = String(clusters.length);
      canvas.dataset.sprinkles = String(placedGroups);
      canvas.dataset.layout = layoutKey;
      canvas.dataset.cells = String(gridCells);
      canvas.dataset.drawn = String(cells.length);
      canvas.dataset.coverage = (cells.length / gridCells).toFixed(4);
      canvas.dataset.area = ((cells.length * CELL * CELL) / (width * height)).toFixed(4);
      canvas.dataset.pattern = patternHash(cells);
      canvas.dataset.accent = css(accent);
      canvas.dataset.hot = "0";
      canvas.dataset.autoCells = "0";
      canvas.dataset.autoRatio = "0.0000";
      for (const attribute of [
        "hoverLevel",
        "hoverColor",
        "hoverColors",
        "hoverX",
        "hoverY",
        "autoPeak",
        "autoX",
        "autoY",
      ]) {
        delete canvas.dataset[attribute];
      }
    };

    /** Pick one square, or 1-6 neighbours of one cluster, for a slow orange fade. */
    const scheduleAuto = (time: number) => {
      nextAutoPick = time + 0.6 + 1.4 * Math.random() ** 2;
      if (autoPool.length === 0) return;
      let active = 0;
      for (const state of autoState) if (state) active += 1;
      const budget = Math.floor(cells.length * AUTO_MAX_SHARE) - active;
      if (budget <= 0) return;
      const start = autoPool[Math.floor(Math.random() * autoPool.length)];
      // Two rolls, keep the larger: small patches beat single squares on average.
      const wanted = Math.min(
        budget,
        1 + Math.max(Math.floor(Math.random() * AUTO_GROUP_MAX), Math.floor(Math.random() * AUTO_GROUP_MAX)),
      );
      const group = [start];
      if (wanted > 1) {
        const seen = new Set<number>([start]);
        const queue = [start];
        while (queue.length > 0 && group.length < wanted) {
          const index = queue.shift()!;
          for (const next of neighbors.get(index) ?? []) {
            if (seen.has(next)) continue;
            seen.add(next);
            group.push(next);
            queue.push(next);
            if (group.length >= wanted) break;
          }
        }
      }
      for (const index of group) {
        if (autoState[index]) continue;
        autoState[index] = {
          start: time,
          fadeIn: 1.8 + Math.random(),
          hold: 0.8 + Math.random() * 1.2,
          fadeOut: 2.5 + Math.random(),
        };
      }
    };

    const update = (now: number) => {
      const dt = lastFrame ? Math.min(0.05, (now - lastFrame) / 1000) : 1 / 60;
      lastFrame = now;
      const time = now / 1000;

      pointer.x = pointer.targetX;
      pointer.y = pointer.targetY;

      if (time >= nextAutoPick) scheduleAuto(time);

      const riseStep = dt / 0.4;
      const fallStep = dt / 0.7;
      let hot = 0;
      let nearest: Cell | null = null;
      let nearestDistance = HOVER_RADIUS;
      let autoCells = 0;
      let autoPeak = 0;
      let autoCell: Cell | null = null;

      for (let index = 0; index < cells.length; index += 1) {
        const cell = cells[index];

        // Automatic fade: grey -> own orange level -> grey, one timeline per square.
        const timeline = autoState[index];
        let auto = 0;
        if (timeline) {
          const elapsed = time - timeline.start;
          if (elapsed < timeline.fadeIn) {
            const t = Math.max(0, elapsed / timeline.fadeIn);
            auto = t * t * (3 - 2 * t);
          } else if (elapsed < timeline.fadeIn + timeline.hold) {
            auto = 1;
          } else if (elapsed < timeline.fadeIn + timeline.hold + timeline.fadeOut) {
            const t = (elapsed - timeline.fadeIn - timeline.hold) / timeline.fadeOut;
            auto = 1 - t * t * (3 - 2 * t);
          } else {
            autoState[index] = null;
          }
        }
        autoLevel[index] = auto;
        if (auto > 0.02) {
          autoCells += 1;
          if (auto > autoPeak) {
            autoPeak = auto;
            autoCell = cell;
          }
        }

        // Cursor: a flat orange falloff within 100px, stronger of the two tints.
        let target = 0;
        if (pointer.active) {
          const distance = Math.hypot(cell.x + CELL / 2 - pointer.x, cell.y + CELL / 2 - pointer.y);
          if (distance < HOVER_RADIUS) {
            const falloff = 1 - distance / HOVER_RADIUS;
            target = falloff * falloff * (3 - 2 * falloff);
            if (distance < nearestDistance) {
              nearestDistance = distance;
              nearest = cell;
            }
          }
        }
        const current = heat[index];
        if (target > current) heat[index] = Math.min(target, current + riseStep);
        else if (target < current) heat[index] = Math.max(target, current - fallStep);
        if (heat[index] > 0.15) hot += 1;
      }

      canvas.dataset.hot = String(hot);
      canvas.dataset.autoCells = String(autoCells);
      canvas.dataset.autoRatio = (autoCells / Math.max(1, cells.length)).toFixed(4);
      if (autoCell && autoPeak > 0.02) {
        canvas.dataset.autoPeak = autoPeak.toFixed(2);
        canvas.dataset.autoX = String(autoCell.x + CELL / 2);
        canvas.dataset.autoY = String(autoCell.y + CELL / 2);
      } else {
        delete canvas.dataset.autoPeak;
        delete canvas.dataset.autoX;
        delete canvas.dataset.autoY;
      }

      if (nearest) {
        const level = Math.min(4, Math.max(1, Math.round(nearest.level)));
        canvas.dataset.hoverLevel = String(level);
        canvas.dataset.hoverColor = css(hoverColor(nearest));
        canvas.dataset.hoverColors = [1, 2, 3, 4]
          .map((value) => css(mix(bgAt(nearest!.y), accent, LEVEL_MIX[value - 1])))
          .join("|");
        canvas.dataset.hoverX = String(nearest.x + CELL / 2);
        canvas.dataset.hoverY = String(nearest.y + CELL / 2);
      } else {
        for (const attribute of ["hoverLevel", "hoverColor", "hoverColors", "hoverX", "hoverY"]) {
          delete canvas.dataset[attribute];
        }
      }

      return true;
    };

    const paint = () => {
      ctx.clearRect(0, 0, width, height);
      for (let index = 0; index < cells.length; index += 1) {
        const cell = cells[index];
        const idle = idleColor(cell.level);
        const tint = Math.max(heat[index], autoLevel[index]);
        const color = tint > 0.002 ? mix(idle, hoverColor(cell), Math.min(1, tint)) : idle;
        ctx.beginPath();
        ctx.roundRect(cell.x, cell.y, CELL, CELL, CORNER);
        ctx.fillStyle = css(color);
        ctx.fill();
      }
    };

    const start = () => {
      if (running || disposed || reduced() || !pageVisible || !inViewport) return;
      running = true;
      lastFrame = 0;
      nextAutoPick = 0;
      canvas.dataset.running = "true";
      canvas.dataset.mode = "animated";
      rafId = requestAnimationFrame(frame);
    };

    const stop = () => {
      running = false;
      if (rafId) cancelAnimationFrame(rafId);
      rafId = 0;
      canvas.dataset.running = "false";
    };

    function frame(now: number) {
      rafId = 0;
      if (!running) return;
      update(now);
      paint();
      rafId = requestAnimationFrame(frame);
    }

    if (reduced()) {
      canvas.dataset.mode = "reduced";
      canvas.dataset.running = "false";
      canvas.dataset.hot = "0";
    }

    const onResize = () => {
      build();
      if (reduced()) {
        paint();
      } else {
        paint();
        start();
      }
    };

    let rebuildHandle = 0;
    const scheduleResize = () => {
      if (rebuildHandle) return;
      rebuildHandle = requestAnimationFrame(() => {
        rebuildHandle = 0;
        onResize();
      });
    };

    const onPointerMove = (event: PointerEvent) => {
      if (reduced()) return;
      const box = canvas.getBoundingClientRect();
      pointer.targetX = event.clientX - box.left;
      pointer.targetY = event.clientY - box.top;
      pointer.active = true;
      start();
    };

    const onPointerDown = (event: PointerEvent) => {
      if (reduced()) return;
      const box = canvas.getBoundingClientRect();
      pointer.targetX = event.clientX - box.left;
      pointer.targetY = event.clientY - box.top;
      pointer.x = pointer.targetX;
      pointer.y = pointer.targetY;
      pointer.active = true;
      start();
    };

    const onPointerLeave = () => {
      pointer.active = false;
    };

    const onVisibility = () => {
      pageVisible = document.visibilityState !== "hidden";
      if (pageVisible) start();
      else stop();
    };

    const onReducedChange = () => {
      if (reduced()) {
        stop();
        heat.fill(0);
        autoLevel.fill(0);
        autoState.fill(null);
        canvas.dataset.mode = "reduced";
        canvas.dataset.hot = "0";
        canvas.dataset.autoCells = "0";
        canvas.dataset.autoRatio = "0.0000";
        delete canvas.dataset.autoPeak;
        delete canvas.dataset.autoX;
        delete canvas.dataset.autoY;
        paint();
      } else {
        canvas.dataset.mode = "animated";
        start();
      }
    };

    const resizeObserver = new ResizeObserver(scheduleResize);
    resizeObserver.observe(host);
    for (const node of clearNodes()) resizeObserver.observe(node);

    const intersectionObserver = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        inViewport = entry ? entry.isIntersecting : true;
        if (inViewport) start();
        else stop();
      },
      { threshold: 0.01 },
    );
    intersectionObserver.observe(host);

    host.addEventListener("pointermove", onPointerMove);
    host.addEventListener("pointerdown", onPointerDown);
    host.addEventListener("pointerleave", onPointerLeave);
    host.addEventListener("pointerup", onPointerLeave);
    host.addEventListener("pointercancel", onPointerLeave);
    document.addEventListener("visibilitychange", onVisibility);
    reducedQuery.addEventListener("change", onReducedChange);

    build();
    if (reduced()) {
      paint();
    } else {
      paint();
      start();
    }

    let fontHandle = 0;
    void document.fonts?.ready.then(() => {
      if (disposed) return;
      fontHandle = requestAnimationFrame(() => {
        onResize();
      });
    });

    return () => {
      disposed = true;
      running = false;
      if (rafId) cancelAnimationFrame(rafId);
      rafId = 0;
      cancelAnimationFrame(rebuildHandle);
      cancelAnimationFrame(fontHandle);
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      host.removeEventListener("pointermove", onPointerMove);
      host.removeEventListener("pointerdown", onPointerDown);
      host.removeEventListener("pointerleave", onPointerLeave);
      host.removeEventListener("pointerup", onPointerLeave);
      host.removeEventListener("pointercancel", onPointerLeave);
      document.removeEventListener("visibilitychange", onVisibility);
      reducedQuery.removeEventListener("change", onReducedChange);
    };
  }, [clearSelector]);

  return <canvas ref={canvasRef} className="dot-surface__canvas" aria-hidden="true" />;
}
