import { FOV } from "rot-js";
import { perkDef } from "../data/perks";
import { hasPerk, idx, inBounds, isFloor, type GameState } from "./state";

export const FOV_RADIUS = 8;

export function recomputeFov(state: GameState): void {
  const { map } = state;
  state.visible = new Array(map.tiles.length).fill(false);
  const radius =
    FOV_RADIUS + (hasPerk(state, "field_awareness") ? (perkDef("field_awareness").value ?? 0) : 0);
  const fov = new FOV.PreciseShadowcasting((x, y) => isFloor(map, x, y));
  fov.compute(state.player.x, state.player.y, radius, (x, y) => {
    if (!inBounds(map, x, y)) return;
    const i = idx(map, x, y);
    state.visible[i] = true;
    state.explored[i] = true;
  });
}
