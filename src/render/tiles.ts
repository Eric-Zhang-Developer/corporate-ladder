import { enemyDef } from "../data/enemies";
import { lineTiles } from "../sim/los";
import { idx, type GameState, type GroundItem } from "../sim/state";
import { TILE, type Atlas } from "./atlas";
import { chargeLineIsVisible, type CameraRect } from "./camera";

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
  /**
   * DEV debug panel: draw the whole map lit, camo included. Render-side rather
   * than a sim action on purpose — writing `explored` would reveal terrain but
   * not enemies (they draw off `visible`), and it could not be toggled back.
   */
  revealAll?: boolean;
}

const DIM = "rgba(0, 0, 0, 0.62)";

export function renderViewport(
  ctx: CanvasRenderingContext2D,
  atlas: Atlas,
  state: GameState,
  ui: UIState,
  camera: CameraRect,
): void {
  const { map } = state;
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.save();
  ctx.translate(-camera.x * TILE, -camera.y * TILE);

  // One reveal gate for the whole pass; the sim's own arrays stay untouched.
  const reveal = ui.revealAll === true;
  const seen = (i: number): boolean => reveal || state.explored[i] === true;
  const lit = (i: number): boolean => reveal || state.visible[i] === true;

  const blit = (key: string, x: number, y: number): void => {
    const i = atlas.index.get(key);
    if (i === undefined) return;
    ctx.drawImage(atlas.canvas, i * TILE, 0, TILE, TILE, x * TILE, y * TILE, TILE, TILE);
  };

  for (let y = camera.y; y < camera.y + camera.height; y++) {
    for (let x = camera.x; x < camera.x + camera.width; x++) {
      const i = idx(map, x, y);
      if (!seen(i)) continue;
      blit(map.tiles[i] === 0 ? "wall" : "floor", x, y);
    }
  }

  // Stairs are architecture: remembered once explored.
  if (seen(idx(map, state.stairs.x, state.stairs.y))) {
    blit("stairs", state.stairs.x, state.stairs.y);
  }

  for (const item of state.items) {
    if (!lit(idx(map, item.x, item.y))) continue;
    blit(ITEM_TILE[item.kind], item.x, item.y);
  }

  for (const e of state.enemies) {
    if (e.hidden && !reveal) continue; // active camo: nothing to draw
    if (!lit(idx(map, e.x, e.y))) continue;
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

  // Throw preview, drawn under the shroud pass so unseen tiles stay unseen.
  const aim = ui.throwAim;
  if (aim) {
    const tint = aim.valid ? "rgba(255, 140, 60, 0.30)" : "rgba(255, 60, 60, 0.22)";
    for (let y = aim.y - aim.radius; y <= aim.y + aim.radius; y++) {
      for (let x = aim.x - aim.radius; x <= aim.x + aim.radius; x++) {
        if (Math.hypot(x - aim.x, y - aim.y) > aim.radius) continue;
        if (!seen(idx(state.map, x, y))) continue;
        ctx.fillStyle = tint;
        ctx.fillRect(x * TILE, y * TILE, TILE, TILE);
      }
    }
    ctx.strokeStyle = aim.valid ? "#ff9944" : "#ff5555";
    ctx.lineWidth = 2;
    ctx.strokeRect(aim.x * TILE + 1, aim.y * TILE + 1, TILE - 2, TILE - 2);
  }

  ctx.fillStyle = DIM;
  for (let y = camera.y; y < camera.y + camera.height; y++) {
    for (let x = camera.x; x < camera.x + camera.width; x++) {
      const i = idx(map, x, y);
      if (seen(i) && !lit(i)) {
        ctx.fillRect(x * TILE, y * TILE, TILE, TILE);
      }
    }
  }

  // Charge warnings sit above the shroud: their entire job is to communicate
  // danger before damage. Overwatch is allowed to originate beyond FOV — the
  // clipped lane entering the viewport is the counterplay information. Other
  // charge styles still require their source to be visible, so the camera does
  // not leak a hidden Dozer or Warden.
  for (const e of state.enemies) {
    const sourceIsVisible = lit(idx(state.map, e.x, e.y));
    if (
      !chargeLineIsVisible(
        e.chargeTimer,
        e.hidden === true,
        sourceIsVisible,
        enemyDef(e.defId).behavior,
        reveal,
      )
    ) {
      continue;
    }
    ctx.fillStyle = "rgba(255, 70, 70, 0.22)";
    for (const tile of lineTiles(e.x, e.y, state.player.x, state.player.y)) {
      ctx.fillRect(tile.x * TILE, tile.y * TILE, TILE, TILE);
    }
  }

  ctx.restore();
}
