import type { Display } from "rot-js";
import { idx, type GameState } from "../sim/state";
import { MAP_H } from "../sim/mapgen";
import { LOG_LINES } from "./display";

const COLOR = {
  wallLit: "#9a9a9a",
  wallDim: "#3d3d3d",
  floorLit: "#555555",
  floorDim: "#232323",
  player: "#ffffff",
};

export function renderState(display: Display, state: GameState): void {
  display.clear();
  const { map } = state;

  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < map.width; x++) {
      const i = idx(map, x, y);
      if (!state.explored[i]) continue;
      const lit = state.visible[i] === true;
      const wall = map.tiles[i] === 0;
      const glyph = wall ? "#" : ".";
      const fg = wall ? (lit ? COLOR.wallLit : COLOR.wallDim) : lit ? COLOR.floorLit : COLOR.floorDim;
      display.draw(x, y, glyph, fg, "#000");
    }
  }

  display.draw(state.player.x, state.player.y, "@", COLOR.player, "#000");

  display.drawText(0, MAP_H + LOG_LINES, `Explore with arrows / WASD`);
  display.drawText(0, MAP_H + LOG_LINES + 1, `Seed ${state.seed}  Turn ${state.turn}`);
}
