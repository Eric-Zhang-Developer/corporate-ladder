import { idx, type GameState, type GroundItem } from "../sim/state";
import { TILE, type Atlas } from "./atlas";

/** Ground items are drawn by kind. */
const ITEM_TILE: Record<GroundItem["kind"], string> = {
  weapon: "item_weapon",
  ammo: "item_ammo",
  plate: "item_plate",
  carrier: "item_carrier",
  consumable: "item_consumable",
};

/** Render-side state the sim never sees (Tab targeting, etc.). */
export interface UIState {
  targetId: number | null;
}

const DIM = "rgba(0, 0, 0, 0.62)";

export function renderViewport(
  ctx: CanvasRenderingContext2D,
  atlas: Atlas,
  state: GameState,
  ui: UIState,
): void {
  const { map } = state;
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);

  const blit = (key: string, x: number, y: number): void => {
    const i = atlas.index.get(key);
    if (i === undefined) return;
    ctx.drawImage(atlas.canvas, i * TILE, 0, TILE, TILE, x * TILE, y * TILE, TILE, TILE);
  };

  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < map.width; x++) {
      const i = idx(map, x, y);
      if (!state.explored[i]) continue;
      blit(map.tiles[i] === 0 ? "wall" : "floor", x, y);
    }
  }

  // Stairs are architecture: remembered once explored.
  if (state.explored[idx(map, state.stairs.x, state.stairs.y)]) {
    blit("stairs", state.stairs.x, state.stairs.y);
  }

  for (const item of state.items) {
    if (!state.visible[idx(map, item.x, item.y)]) continue;
    blit(ITEM_TILE[item.kind], item.x, item.y);
  }

  for (const e of state.enemies) {
    if (!state.visible[idx(map, e.x, e.y)]) continue;
    blit(e.defId, e.x, e.y);
    // §9 telegraph: an armed camera shows its countdown one turn ahead.
    if (e.alarmTimer !== undefined) {
      ctx.fillStyle = "#ff5555";
      ctx.font = `bold ${TILE - 6}px ui-monospace, Menlo, monospace`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(String(e.alarmTimer), e.x * TILE + TILE / 2, e.y * TILE + TILE / 2);
      ctx.strokeStyle = "#ff5555";
      ctx.lineWidth = 2;
      ctx.strokeRect(e.x * TILE + 1, e.y * TILE + 1, TILE - 2, TILE - 2);
    }
    if (ui.targetId === e.id) {
      ctx.strokeStyle = "#ffee66";
      ctx.lineWidth = 2;
      ctx.strokeRect(e.x * TILE + 1, e.y * TILE + 1, TILE - 2, TILE - 2);
    }
  }

  blit("player", state.player.x, state.player.y);

  // FOV shroud: explored-but-unseen dims, unseen stays black.
  ctx.fillStyle = DIM;
  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < map.width; x++) {
      const i = idx(map, x, y);
      if (state.explored[i] && !state.visible[i]) {
        ctx.fillRect(x * TILE, y * TILE, TILE, TILE);
      }
    }
  }
}
