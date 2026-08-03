import { lineTiles } from "../sim/los";
import { idx, type GameState, type GroundItem } from "../sim/state";
import { TILE, type Atlas } from "./atlas";

/** Ground items are drawn by kind. */
const ITEM_TILE: Record<GroundItem["kind"], string> = {
  weapon: "item_weapon",
  ammo: "item_ammo",
  plate: "item_plate",
  carrier: "item_carrier",
  consumable: "item_consumable",
  vending: "vending",
};

/** Render-side state the sim never sees (Tab targeting, etc.). */
export interface UIState {
  targetId: number | null;
  /** Live grenade cursor: the tile under aim and the blast it would make. */
  throwAim?: { x: number; y: number; radius: number; valid: boolean } | null;
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
    if (e.hidden) continue; // active camo: nothing to draw
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
  // A charging overwatch shooter shows the tiles he covers. The player must be
  // able to see the line they are about to die in, not infer it.
  for (const e of state.enemies) {
    if (e.chargeTimer === undefined || e.hidden) continue;
    if (!state.visible[idx(state.map, e.x, e.y)]) continue;
    ctx.fillStyle = "rgba(255, 70, 70, 0.22)";
    for (const tile of lineTiles(e.x, e.y, state.player.x, state.player.y)) {
      ctx.fillRect(tile.x * TILE, tile.y * TILE, TILE, TILE);
    }
  }

  // Throw preview, drawn under the shroud pass so unseen tiles stay unseen.
  const aim = ui.throwAim;
  if (aim) {
    const tint = aim.valid ? "rgba(255, 140, 60, 0.30)" : "rgba(255, 60, 60, 0.22)";
    for (let y = aim.y - aim.radius; y <= aim.y + aim.radius; y++) {
      for (let x = aim.x - aim.radius; x <= aim.x + aim.radius; x++) {
        if (Math.hypot(x - aim.x, y - aim.y) > aim.radius) continue;
        if (!state.explored[idx(state.map, x, y)]) continue;
        ctx.fillStyle = tint;
        ctx.fillRect(x * TILE, y * TILE, TILE, TILE);
      }
    }
    ctx.strokeStyle = aim.valid ? "#ff9944" : "#ff5555";
    ctx.lineWidth = 2;
    ctx.strokeRect(aim.x * TILE + 1, aim.y * TILE + 1, TILE - 2, TILE - 2);
  }

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
