import { ENEMIES } from "../data/enemies";

/**
 * Programmatic placeholder atlas (Stage 2 decision): every sprite is a
 * colored cell + glyph drawn once to an offscreen canvas. Swapping in real
 * pixel art later means loading a PNG with the same keys — the renderer
 * only ever asks for a key and blits a cell.
 */
export const TILE = 24;

interface SpriteSpec {
  key: string;
  glyph: string;
  fg: string;
  bg: string;
  /** Draw a subtle inset border (walls read as solid). */
  solid?: boolean;
}

export interface Atlas {
  canvas: HTMLCanvasElement;
  index: Map<string, number>;
}

export function buildAtlas(): Atlas {
  const specs: SpriteSpec[] = [
    { key: "floor", glyph: "", fg: "#2e2e36", bg: "#17171c" },
    { key: "wall", glyph: "", fg: "#4a4a55", bg: "#34343e", solid: true },
    { key: "stairs", glyph: ">", fg: "#ffffff", bg: "#17242b" },
    { key: "player", glyph: "@", fg: "#ffffff", bg: "#17171c" },
    { key: "item_weapon", glyph: "/", fg: "#66dddd", bg: "#17171c" },
    { key: "item_ammo", glyph: "=", fg: "#ddcc55", bg: "#17171c" },
  ];
  for (const def of Object.values(ENEMIES)) {
    specs.push({ key: def.id, glyph: def.glyph, fg: def.color, bg: "#17171c" });
  }

  const canvas = document.createElement("canvas");
  canvas.width = TILE * specs.length;
  canvas.height = TILE;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no 2d context for atlas");

  const index = new Map<string, number>();
  specs.forEach((spec, i) => {
    index.set(spec.key, i);
    const x = i * TILE;
    ctx.fillStyle = spec.bg;
    ctx.fillRect(x, 0, TILE, TILE);
    if (spec.solid) {
      ctx.fillStyle = spec.fg;
      ctx.fillRect(x, 0, TILE, TILE);
      ctx.fillStyle = spec.bg;
      ctx.fillRect(x + 2, 2, TILE - 4, TILE - 4);
    } else if (spec.key === "floor") {
      ctx.fillStyle = spec.fg;
      ctx.fillRect(x + TILE / 2 - 1, TILE / 2 - 1, 2, 2);
    }
    if (spec.glyph) {
      ctx.fillStyle = spec.fg;
      ctx.font = `bold ${TILE - 7}px ui-monospace, Menlo, monospace`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(spec.glyph, x + TILE / 2, TILE / 2 + 1);
    }
  });

  return { canvas, index };
}
