import { useEffect, useRef } from "react";

const TILE_W = 9;
const TILE_H = 12;
const PITCH_X = TILE_W + 1;
const PITCH_Y = TILE_H + 1;
const RADIUS = 1.5;
const GLYPH_SIZE = 10;
const GRID_PITCH = 12;
const BASE_ALPHA = 0.45;
const HOVER_RADIUS = 80;
const HOVER_FADE = 0.6;
const FPS = 30;
const CYCLE = 14;
const TRAIL_COUNT = 8;
const TRAIL_LIFE = 1.2;
/* Compact crane: a fixed tile box centered in the sidebar, sitting above the
 * user card so the base, counterweight and jib tip all stay on screen. */
const CRANE_COLS = 22;
const CRANE_ROWS = 19;
const SAFE_BOTTOM = 96;

type Rgb = readonly [number, number, number];
type TileKind = "orange" | "grey";

interface Tile {
  cx: number;
  cy: number;
  level: number;
  glyph: string;
  kind: TileKind;
  role: string;
  isStatic: boolean;
}

interface CraneLayout {
  cols: number;
  rows: number;
  groundRow: number;
  mastX: number;
  mastW: number;
  topRow: number;
  jibRow: number;
  jibEnd: number;
  counterEnd: number;
  homeCol: number;
  pickupCol: number;
  placeCol: number;
  pickupRow: number;
  placeRow: number;
  travelBeamRow: number;
  tiles: Tile[];
}

const GREYS = ["#BDBDBD", "#CFCFCF", "#DCDCDC", "#E8E8E8", "#F2F2F2"];
const GREY_RGB: Rgb[] = [
  [189, 189, 189],
  [207, 207, 207],
  [220, 220, 220],
  [232, 232, 232],
  [242, 242, 242],
];
const GLYPH_FLICKER = ["S", "X", "t", "%", "8", ":", "o", "#", "/", "\\", "|", "=", "+"];
const DETAIL_GLYPHS = ["o", ".", "'", "-"];

function mulberry32(seed: number): () => number {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash(a: number, b: number): number {
  let h = Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul((b + 0x165667b1) | 0, 0xc2b2ae35);
  h ^= h >>> 13;
  h = Math.imul(h, 0x27d4eb2f);
  h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}

function parseColor(input: string): Rgb | null {
  const value = input.trim();
  const long = /^#([0-9a-f]{6})$/i.exec(value);
  if (long) {
    const n = parseInt(long[1], 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  const rgb = /^rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/i.exec(value);
  if (rgb) return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])];
  return null;
}

function mixRgb(from: Rgb, to: Rgb, amount: number): Rgb {
  const t = Math.min(1, Math.max(0, amount));
  return [
    Math.round(from[0] + (to[0] - from[0]) * t),
    Math.round(from[1] + (to[1] - from[1]) * t),
    Math.round(from[2] + (to[2] - from[2]) * t),
  ];
}

function cssColor(color: Rgb): string {
  return `rgb(${color[0]}, ${color[1]}, ${color[2]})`;
}

function ease(value: number): number {
  const t = Math.min(1, Math.max(0, value));
  return t * t * (3 - 2 * t);
}

function buildLayout(cols: number, rows: number, groundRow: number): CraneLayout {
  const boxCols = Math.min(CRANE_COLS, Math.max(9, cols));
  const startCol = Math.max(0, Math.floor((cols - boxCols) / 2));
  const mastW = 3;
  const mastX = startCol + Math.min(6, Math.floor(boxCols * 0.3));
  const counterEnd = startCol;
  const jibEnd = Math.min(cols - 1, startCol + boxCols - 1);
  const topRow = Math.max(1, groundRow - CRANE_ROWS + 1);
  const jibRow = topRow + 4;
  const homeCol = Math.min(jibEnd, mastX + mastW + 1);
  const pickupCol = Math.min(jibEnd, Math.max(homeCol + 3, jibEnd - 3));
  const placeCol = Math.max(homeCol + 2, pickupCol - 4);
  const pickupRow = groundRow - 1;
  const placeRow = groundRow - 4;
  const travelBeamRow = groundRow - 6;
  const tiles = new Map<number, Tile>();

  const add = (
    cx: number,
    cy: number,
    level: number,
    glyph: string,
    kind: TileKind,
    role: string,
  ) => {
    if (cx < 0 || cy < 0 || cx >= cols || cy >= rows) return;
    const key = (cx + 8) * 16384 + (cy + 8);
    tiles.set(key, {
      cx,
      cy,
      level: Math.min(4, Math.max(1, level)),
      glyph,
      kind,
      role,
      isStatic: true,
    });
  };

  // Ground line: light grey tiles across the bottom.
  for (let cx = 0; cx < cols; cx += 1) {
    add(cx, groundRow, 2, "-", "grey", "ground");
  }

  // Concrete base block (2 rows) under the mast.
  for (let cy = groundRow - 2; cy <= groundRow - 1; cy += 1) {
    for (let cx = mastX - 1; cx <= mastX + mastW + 1; cx += 1) {
      add(cx, cy, 1, "#", "orange", "base");
    }
  }

  // Lattice mast with diagonal bracing between two rails.
  for (let cy = jibRow + 4; cy <= groundRow - 3; cy += 1) {
    add(mastX, cy, 2, cy % 5 === 0 ? "#" : "|", "orange", "lattice");
    add(mastX + mastW - 1, cy, 2, cy % 5 === 0 ? "#" : "|", "orange", "lattice");
    const cross = (cy - jibRow) % 3 === 0;
    const glyph = cross ? "X" : (cy + mastX) % 2 === 0 ? "/" : "\\";
    add(mastX + 1, cy, cy % 3 === 0 ? 3 : 2, glyph, "orange", "lattice");
  }

  // Slightly wider bracing at the base.
  for (let cy = groundRow - 6; cy <= groundRow - 3; cy += 1) {
    add(mastX - 1, cy, 2, "\\", "orange", "lattice");
    add(mastX + mastW, cy, 2, "/", "orange", "lattice");
  }

  // Cabin (2x2, darker) under the jib.
  for (let cy = jibRow + 2; cy <= jibRow + 3; cy += 1) {
    for (let cx = mastX; cx <= mastX + 1; cx += 1) {
      add(cx, cy, 1, "#", "orange", "cabin");
    }
  }

  // Cathead triangle above the jib, connected by a short spine.
  add(mastX + 1, topRow, 4, "#", "orange", "cathead");
  add(mastX, topRow + 1, 3, "/", "orange", "cathead");
  add(mastX + 2, topRow + 1, 3, "\\", "orange", "cathead");
  for (let cy = topRow + 2; cy < jibRow; cy += 1) {
    add(mastX + 1, cy, 3, "|", "orange", "cathead");
  }

  // Jib and counter-jib: two-tile-high lattice arms.
  for (let cx = mastX + mastW; cx <= jibEnd; cx += 1) {
    add(cx, jibRow, 3, cx % 4 === 0 ? "+" : "-", "orange", "jib");
    add(
      cx,
      jibRow + 1,
      cx % 4 === 0 ? 2 : 3,
      cx % 4 === 0 ? "X" : cx % 2 === 0 ? "/" : "\\",
      "orange",
      "jib",
    );
  }
  for (let cx = counterEnd; cx <= mastX - 1; cx += 1) {
    add(cx, jibRow, 3, cx % 3 === 0 ? "+" : "-", "orange", "jib");
    add(cx, jibRow + 1, 2, cx % 2 === 0 ? "/" : "\\", "orange", "jib");
  }

  // Counterweight block (3x2, darkest orange).
  for (let cy = jibRow; cy <= jibRow + 1; cy += 1) {
    for (let cx = counterEnd; cx <= Math.min(counterEnd + 2, cols - 1); cx += 1) {
      add(cx, cy, 1, "#", "orange", "counter");
    }
  }

  // Tie lines from the apex to both jib ends.
  const tie = (x0: number, y0: number, x1: number, y1: number) => {
    const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
    for (let index = 1; index <= steps; index += 1) {
      const cx = Math.round(x0 + ((x1 - x0) * index) / steps);
      const cy = Math.round(y0 + ((y1 - y0) * index) / steps);
      add(cx, cy, 3, x1 > x0 ? "\\" : "/", "orange", "tie");
    }
  };
  tie(mastX + 1, topRow + 1, jibEnd, jibRow);
  tie(mastX + 1, topRow + 1, counterEnd, jibRow);

  // Second (delivery) stack: a small crate on the ground.
  for (let cy = groundRow - 3; cy <= groundRow - 1; cy += 1) {
    for (let cx = placeCol - 1; cx <= placeCol + 1; cx += 1) {
      add(cx, cy, 2, "#", "grey", "crate");
    }
  }

  // About 8 percent of the orange body tiles are grey, like the video.
  for (const tile of tiles.values()) {
    if (tile.kind !== "orange") continue;
    if (tile.role === "base" || tile.role === "counter") continue;
    if (hash(tile.cx * 131 + tile.cy, 0x51ed) < 0.08) tile.kind = "grey";
  }

  return {
    cols,
    rows,
    groundRow,
    mastX,
    mastW,
    topRow,
    jibRow,
    jibEnd,
    counterEnd,
    homeCol,
    pickupCol,
    placeCol,
    pickupRow,
    placeRow,
    travelBeamRow,
    tiles: Array.from(tiles.values()),
  };
}

export function SidebarCrane() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const host = canvas?.parentElement;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !host || !ctx) return;

    const accent =
      parseColor(getComputedStyle(canvas).getPropertyValue("--color-brand")) ?? [255, 90, 0];
    const orangeLevels: Rgb[] = [
      mixRgb(accent, [0, 0, 0], 0.25),
      accent,
      mixRgb(accent, [255, 255, 255], 0.18),
      mixRgb(accent, [255, 255, 255], 0.4),
    ];
    const reducedQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const reduced = () => reducedQuery.matches;

    let width = 0;
    let height = 0;
    let heatCols = 1;
    let heatRows = 1;
    let heat = new Float32Array(1);
    let layout: CraneLayout | null = null;
    let trail: Array<{ x: number; y: number; born: number }> = [];
    let details: Array<{ x: number; y: number; glyph: string }> = [];
    let clouds: Array<{ x: number; y: number; vx: number; vy: number }> = [];
    let frameCount = 0;
    let rafId = 0;
    let lastTime = 0;
    let running = false;
    let pageVisible = document.visibilityState !== "hidden";
    let inViewport = true;
    let disposed = false;
    let trailClock = 0;
    let pointerActive = false;
    let pointerX = 0;
    let pointerY = 0;

    let statTiles = 0;
    let statOrange = 0;
    let statGrey = 0;
    let statTrail = 0;
    let statHover = 0;

    const heatAt = (cx: number, cy: number) => {
      if (cx < 0 || cy < 0 || cx >= heatCols || cy >= heatRows) return 0;
      return heat[cy * heatCols + cx];
    };

    const stateAt = (time: number) => {
      const target = layout!;
      const t = time % CYCLE;
      const travelHook = target.travelBeamRow - 1;
      const pickupHook = target.pickupRow - 1;
      const placeHook = target.placeRow - 1;
      const span = (start: number, end: number) => ease((t - start) / (end - start));
      let phase = "idle";
      let column = target.homeCol;
      let hook = travelHook;
      let sway = 0;
      let carried = false;
      let placed = false;
      let pickup = false;

      if (t < 2.2) {
        phase = "out";
        column = target.homeCol + (target.pickupCol - target.homeCol) * ease(t / 2.2);
      } else if (t < 3.8) {
        phase = "lower";
        column = target.pickupCol;
        hook = travelHook + (pickupHook - travelHook) * span(2.2, 3.8);
      } else if (t < 5) {
        phase = "lift";
        column = target.pickupCol;
        carried = true;
        hook = pickupHook + (travelHook - pickupHook) * span(3.8, 5);
      } else if (t < 8.4) {
        phase = "back";
        column = target.pickupCol + (target.placeCol - target.pickupCol) * span(5, 8.4);
        carried = true;
        sway = Math.round(Math.sin((t - 5) * 3.5));
      } else if (t < 9.9) {
        phase = "lower2";
        column = target.placeCol;
        carried = true;
        hook = travelHook + (placeHook - travelHook) * span(8.4, 9.9);
      } else if (t < 10.4) {
        phase = "release";
        column = target.placeCol;
        placed = true;
        hook = placeHook;
      } else if (t < 11.6) {
        phase = "rise";
        column = target.placeCol;
        placed = true;
        hook = placeHook + (travelHook - placeHook) * span(10.4, 11.6);
      } else if (t < 13.2) {
        phase = "return";
        column = target.placeCol + (target.homeCol - target.placeCol) * span(11.6, 13.2);
        placed = true;
      } else {
        phase = "idle";
        column = target.homeCol;
        placed = true;
        pickup = true;
      }
      if (t < 3.8) pickup = true;
      const tc = Math.round(column);
      const hookRow = Math.round(hook);
      const beamRow = carried
        ? hookRow + 1
        : pickup
          ? target.pickupRow
          : placed
            ? target.placeRow
            : target.pickupRow;
      const load = carried ? "carried" : pickup ? "pickup" : placed ? "placed" : "none";
      return { phase, tc, hookRow, beamRow, carried, placed, pickup, sway, load, cycle: Math.floor(time / CYCLE) };
    };

    const drawGrid = () => {
      ctx.save();
      ctx.strokeStyle = "rgba(0, 0, 0, 0.035)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = 0.5; x < width; x += GRID_PITCH) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
      }
      for (let y = 0.5; y < height; y += GRID_PITCH) {
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
      }
      ctx.stroke();
      ctx.restore();
    };

    const drawTile = (tile: Tile, time: number) => {
      const target = layout!;
      if (tile.cx < 0 || tile.cy < 0 || tile.cx >= target.cols || tile.cy >= target.rows) return;
      let level = tile.level;
      const shimmer =
        tile.role === "lattice" ||
        tile.role === "jib" ||
        tile.role === "tie" ||
        tile.role === "cathead";
      if (shimmer && Math.sin(time * 1.6 + tile.cx * 0.8 + tile.cy * 0.6) > 0.9) {
        level = Math.min(4, level + 1);
      }
      const base = tile.kind === "grey" ? GREY_RGB[level - 1] : orangeLevels[level - 1];
      let glyph = tile.glyph;
      if (tile.isStatic) {
        const slot = Math.floor(time / 1.2);
        if (hash(tile.cx + slot, tile.cy * 3 + slot) > 0.975) {
          glyph = GLYPH_FLICKER[Math.abs(tile.cx + tile.cy + slot) % GLYPH_FLICKER.length];
        }
      }
      const hover = heatAt(tile.cx, tile.cy);
      let color = base;
      if (hover > 0.02) {
        const hoverTarget = tile.kind === "grey" ? orangeLevels[level - 1] : orangeLevels[3];
        color = mixRgb(base, hoverTarget, Math.min(1, hover));
      }
      const x = tile.cx * PITCH_X;
      const y = tile.cy * PITCH_Y;
      ctx.fillStyle = cssColor(color);
      ctx.beginPath();
      ctx.roundRect(x, y, TILE_W, TILE_H, RADIUS);
      ctx.fill();
      const ink = mixRgb(color, [0, 0, 0], 0.45);
      ctx.fillStyle = `rgba(${ink[0]}, ${ink[1]}, ${ink[2]}, 0.7)`;
      ctx.fillText(glyph, x + TILE_W / 2, y + TILE_H / 2 + 0.5);
      statTiles += 1;
      if (tile.kind === "grey") statGrey += 1;
      else statOrange += 1;
    };

    const dynamicTile = (
      cx: number,
      cy: number,
      level: number,
      glyph: string,
      kind: TileKind,
      role: string,
      time: number,
    ) => {
      drawTile({ cx, cy, level, glyph, kind, role, isStatic: false }, time);
    };

    const paint = (time: number) => {
      const target = layout!;
      statTiles = 0;
      statOrange = 0;
      statGrey = 0;
      statTrail = 0;
      statHover = 0;

      ctx.clearRect(0, 0, width, height);
      drawGrid();

      // Dust trail behind the moving load.
      for (let index = 0; index < trail.length; index += 1) {
        const point = trail[index];
        const age = Math.min(TRAIL_LIFE, Math.max(0, time - point.born));
        const alpha = 0.4 * (1 - age / TRAIL_LIFE);
        if (alpha <= 0.01) continue;
        ctx.globalAlpha = alpha;
        ctx.fillStyle = GREYS[1];
        ctx.beginPath();
        ctx.roundRect(point.x * PITCH_X, point.y * PITCH_Y, TILE_W, TILE_H, RADIUS);
        ctx.fill();
        statTrail += 1;
      }

      ctx.font = `${GLYPH_SIZE}px "JetBrains Mono", "Fira Code", Consolas, monospace`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.globalAlpha = BASE_ALPHA;

      for (const tile of target.tiles) drawTile(tile, time);

      const state = stateAt(time);

      // Pickup stack (a steel beam waiting on the ground).
      if (state.pickup) {
        for (let offset = -2; offset <= 3; offset += 1) {
          dynamicTile(
            target.pickupCol + offset,
            target.pickupRow,
            2,
            "=",
            "grey",
            "load",
            time,
          );
        }
      }

      // Delivered beam on the second stack.
      if (state.placed) {
        for (let offset = -2; offset <= 3; offset += 1) {
          dynamicTile(target.placeCol + offset, target.placeRow, 2, "=", "grey", "load", time);
        }
      }

      // Trolley (2x1) and cable from the jib down to the hook.
      dynamicTile(state.tc, target.jibRow + 2, 1, "=", "orange", "trolley", time);
      dynamicTile(state.tc + 1, target.jibRow + 2, 1, "=", "orange", "trolley", time);
      const cableCol = state.tc + state.sway;
      for (let cy = target.jibRow + 3; cy < state.hookRow; cy += 1) {
        dynamicTile(cableCol, cy, 2, cy % 2 === 0 ? ":" : "|", "orange", "cable", time);
      }
      const hookGlyph = hash(state.cycle, Math.floor(time * 2)) > 0.7 ? "U" : "J";
      dynamicTile(cableCol, state.hookRow, 3, hookGlyph, "orange", "hook", time);

      // Hanging load.
      if (state.carried) {
        for (let offset = -2; offset <= 3; offset += 1) {
          dynamicTile(cableCol + offset, state.beamRow, 2, "=", "grey", "load", time);
        }
      }

      // Blinking warning light on the apex, once per second.
      const blinkOn = Math.floor(time) % 2 === 0;
      dynamicTile(target.mastX + 1, target.topRow, blinkOn ? 4 : 1, "*", "orange", "light", time);

      // Loose glyphs and drifting dash clouds around the crane.
      ctx.fillStyle = "rgba(74, 79, 85, 0.7)";
      for (const detail of details) {
        ctx.fillText(detail.glyph, detail.x, detail.y);
      }
      for (const cloud of clouds) {
        ctx.fillText("- - -", cloud.x, cloud.y);
      }
      ctx.globalAlpha = 1;

      for (let index = 0; index < heat.length; index += 1) {
        if (heat[index] > 0.1) statHover += 1;
      }

      canvas.dataset.phase = state.phase;
      canvas.dataset.cycle = String(state.cycle);
      canvas.dataset.trolley = String(state.tc);
      canvas.dataset.hook = `${cableCol},${state.hookRow}`;
      canvas.dataset.load = state.load;
      canvas.dataset.blink = blinkOn ? "1" : "0";
      canvas.dataset.tiles = String(statTiles);
      canvas.dataset.orange = String(statOrange);
      canvas.dataset.grey = String(statGrey);
      canvas.dataset.trail = String(statTrail);
      canvas.dataset.hover = String(statHover);
      canvas.dataset.frame = String(frameCount);
    };

    const step = (dt: number, time: number) => {
      for (let index = 0; index < heat.length; index += 1) {
        if (heat[index] > 0) heat[index] = Math.max(0, heat[index] - dt / HOVER_FADE);
      }
      if (pointerActive) applyPointer(pointerX, pointerY);
      for (const cloud of clouds) {
        cloud.x += cloud.vx * dt;
        cloud.y += cloud.vy * dt;
        if (cloud.x < -60) cloud.x = width + 40;
        if (cloud.x > width + 60) cloud.x = -40;
        if (cloud.y < -30) cloud.y = height + 20;
        if (cloud.y > height + 30) cloud.y = -20;
      }
      const state = stateAt(time);
      if (state.phase === "back") {
        trailClock += dt;
        if (trailClock >= 0.16) {
          trailClock = 0;
          trail.push({
            x: state.tc + state.sway,
            y: state.beamRow,
            born: time,
          });
          while (trail.length > TRAIL_COUNT) trail.shift();
        }
      } else {
        trailClock = 0;
      }
      trail = trail.filter((point) => time - point.born < TRAIL_LIFE);
    };

    const frame = (now: number) => {
      rafId = requestAnimationFrame(frame);
      if (!running) return;
      if (lastTime && now - lastTime < 1000 / FPS - 2) return;
      const dt = lastTime ? Math.min(0.12, (now - lastTime) / 1000) : 1 / FPS;
      lastTime = now;
      frameCount += 1;
      step(dt, now / 1000);
      paint(now / 1000);
    };

    const start = () => {
      if (running || disposed || reduced() || !pageVisible || !inViewport) return;
      running = true;
      lastTime = 0;
      canvas.dataset.running = "true";
      canvas.dataset.mode = "animated";
      rafId = requestAnimationFrame(frame);
    };

    const stop = () => {
      running = false;
      if (rafId) cancelAnimationFrame(rafId);
      rafId = 0;
      canvas.dataset.running = "false";
      canvas.dataset.mode = reduced() ? "static" : "paused";
    };

    const resize = () => {
      const box = canvas.getBoundingClientRect();
      if (box.width < 2 || box.height < 2) return;
      width = box.width;
      height = box.height;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      heatCols = Math.max(1, Math.floor((width - 1) / PITCH_X) + 1);
      heatRows = Math.max(1, Math.floor((height - 1) / PITCH_Y) + 1);
      heat = new Float32Array(heatCols * heatRows);
      // Sit the ground line on the user card: snap to the nearest row so the
      // crane drops as low as the card allows.
      const card = host.lastElementChild;
      const cardTop = card ? card.getBoundingClientRect().top - box.top : height - SAFE_BOTTOM;
      const groundRow = Math.min(
        Math.max(1, heatRows - 1),
        Math.max(CRANE_ROWS + 1, Math.round((cardTop - TILE_H) / PITCH_Y)),
      );
      layout = buildLayout(heatCols, heatRows, groundRow);

      const random = mulberry32(0xc4a9e000);
      details = [0, 1, 2, 3, 4, 5].map(() => ({
        x: width * (0.15 + random() * 0.7),
        y: height * (0.2 + random() * 0.65),
        glyph: DETAIL_GLYPHS[Math.floor(random() * DETAIL_GLYPHS.length)],
      }));
      clouds = [0, 1, 2, 3].map(() => ({
        x: random() * width,
        y: random() * height,
        vx: (random() < 0.5 ? -1 : 1) * (2 + random() * 3),
        vy: (random() < 0.5 ? -1 : 1) * (1 + random() * 2),
      }));
      trail = [];

      canvas.dataset.style = "crane";
      canvas.dataset.tile = `${TILE_W}x${TILE_H}`;
      canvas.dataset.gap = String(PITCH_X - TILE_W);
      canvas.dataset.grid = String(GRID_PITCH);
      canvas.dataset.font = "monospace";
      canvas.dataset.alpha = String(BASE_ALPHA);
      canvas.dataset.cols = String(layout.cols);
      canvas.dataset.rows = String(layout.rows);
      canvas.dataset.mast = `${layout.mastX},${layout.topRow}`;
      canvas.dataset.jib = `${layout.mastX + layout.mastW},${layout.jibEnd}`;
      canvas.dataset.ground = String(layout.groundRow);
      canvas.dataset.box = `${layout.counterEnd},${layout.topRow},${layout.jibEnd},${layout.groundRow}`;
      canvas.dataset.craneheight = ((layout.groundRow - layout.topRow) / layout.rows).toFixed(3);
      canvas.dataset.glyphs = GLYPH_FLICKER.join(" ");
      canvas.dataset.running = running ? "true" : "false";
      canvas.dataset.mode = reduced() ? "static" : running ? "animated" : "paused";

      if (reduced()) {
        frameCount = 1;
        paint(6.2);
        canvas.dataset.running = "false";
        canvas.dataset.mode = "static";
      } else {
        paint(performance.now() / 1000);
      }
    };

    const applyPointer = (x: number, y: number) => {
      const minCol = Math.max(0, Math.floor((x - HOVER_RADIUS) / PITCH_X));
      const maxCol = Math.min(heatCols - 1, Math.ceil((x + HOVER_RADIUS) / PITCH_X));
      const minRow = Math.max(0, Math.floor((y - HOVER_RADIUS) / PITCH_Y));
      const maxRow = Math.min(heatRows - 1, Math.ceil((y + HOVER_RADIUS) / PITCH_Y));
      for (let rowIndex = minRow; rowIndex <= maxRow; rowIndex += 1) {
        for (let col = minCol; col <= maxCol; col += 1) {
          const dx = col * PITCH_X + TILE_W / 2 - x;
          const dy = rowIndex * PITCH_Y + TILE_H / 2 - y;
          const distance = Math.hypot(dx, dy);
          if (distance >= HOVER_RADIUS) continue;
          const falloff = 1 - distance / HOVER_RADIUS;
          const value = falloff * falloff * (3 - 2 * falloff);
          const index = rowIndex * heatCols + col;
          if (heat[index] < value) heat[index] = value;
        }
      }
    };

    const onPointerMove = (event: PointerEvent) => {
      if (reduced()) return;
      const box = canvas.getBoundingClientRect();
      const x = event.clientX - box.left;
      const y = event.clientY - box.top;
      if (x < -HOVER_RADIUS || y < -HOVER_RADIUS || x > width + HOVER_RADIUS || y > height + HOVER_RADIUS) {
        pointerActive = false;
        return;
      }
      pointerActive = true;
      pointerX = x;
      pointerY = y;
      applyPointer(x, y);
    };

    const onPointerLeave = () => {
      pointerActive = false;
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
        canvas.dataset.hover = "0";
        canvas.dataset.mode = "static";
        paint(6.2);
      } else {
        start();
      }
    };

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(host);
    const intersectionObserver = new IntersectionObserver(
      (observations) => {
        const entry = observations[0];
        inViewport = entry ? entry.isIntersecting : true;
        if (inViewport) start();
        else stop();
      },
      { threshold: 0.01 },
    );
    intersectionObserver.observe(host);

    host.addEventListener("pointermove", onPointerMove);
    host.addEventListener("pointerdown", onPointerMove);
    host.addEventListener("pointerleave", onPointerLeave);
    document.addEventListener("visibilitychange", onVisibility);
    reducedQuery.addEventListener("change", onReducedChange);

    resize();
    if (reduced()) {
      stop();
      canvas.dataset.running = "false";
      canvas.dataset.mode = "static";
    } else {
      start();
    }

    return () => {
      disposed = true;
      running = false;
      if (rafId) cancelAnimationFrame(rafId);
      rafId = 0;
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      host.removeEventListener("pointermove", onPointerMove);
      host.removeEventListener("pointerdown", onPointerMove);
      host.removeEventListener("pointerleave", onPointerLeave);
      document.removeEventListener("visibilitychange", onVisibility);
      reducedQuery.removeEventListener("change", onReducedChange);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="sidebar-crane pointer-events-none absolute inset-0 z-0 h-full w-full"
      aria-hidden="true"
    />
  );
}
