import { ENEMIES } from "../data/enemies";

/**
 * ASCII atlas: every sprite is a bare glyph on black, drawn once to an
 * offscreen canvas. This is the working aesthetic until the MVP content
 * is done — the renderer only asks for a key and blits a cell, so the
 * eventual art pass is a PNG with the same keys, nothing else changes.
 */
export const TILE = 28;

interface SpriteSpec {
  key: string;
  glyph: string;
  fg: string;
}

export interface Atlas {
  canvas: HTMLCanvasElement;
  index: Map<string, number>;
}

export function buildAtlas(): Atlas {
  const specs: SpriteSpec[] = [
    { key: "floor", glyph: ".", fg: "#4a4a55" },
    { key: "wall", glyph: "#", fg: "#9a9aa5" },
    { key: "stairs", glyph: ">", fg: "#ffffff" },
    { key: "player", glyph: "@", fg: "#ffffff" },
    { key: "item_weapon", glyph: "/", fg: "#66dddd" },
    { key: "item_ammo", glyph: "=", fg: "#ddcc55" },
  ];
  for (const def of Object.values(ENEMIES)) {
    specs.push({ key: def.id, glyph: def.glyph, fg: def.color });
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
    ctx.fillStyle = "#000000";
    ctx.fillRect(x, 0, TILE, TILE);
    ctx.fillStyle = spec.fg;
    ctx.font = `bold ${TILE - 6}px ui-monospace, Menlo, monospace`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(spec.glyph, x + TILE / 2, TILE / 2 + 1);
  });

  return { canvas, index };
}
