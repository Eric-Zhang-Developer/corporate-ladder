import type { Display } from "rot-js";
import { weaponDef } from "../data/weapons";
import { idx, type GameState } from "../sim/state";
import { MAP_H } from "../sim/mapgen";
import { LOG_LINES } from "./display";

const COLOR = {
  wallLit: "#9a9a9a",
  wallDim: "#3d3d3d",
  floorLit: "#555555",
  floorDim: "#232323",
  logOld: "#777777",
  player: "#ffffff",
};

export function renderState(display: Display, state: GameState): void {
  display.clear();
  const { map, player } = state;

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

  for (const e of state.enemies) {
    if (state.visible[idx(map, e.x, e.y)]) display.draw(e.x, e.y, e.glyph, e.color, "#000");
  }
  display.draw(player.x, player.y, player.glyph, COLOR.player, "#000");

  const recent = state.log.slice(-LOG_LINES);
  for (let i = 0; i < recent.length; i++) {
    const isLatest = i === recent.length - 1;
    display.drawText(0, MAP_H + i, `%c{${isLatest ? "#dddddd" : COLOR.logOld}}${recent[i]}`);
  }

  const weapon = weaponDef(player.weaponId);
  const pips = "◆".repeat(player.ap) + "◇".repeat(player.maxAp - player.ap);
  display.drawText(
    0,
    MAP_H + LOG_LINES,
    `HP ${player.hp}/${player.maxHp}  AP ${pips}  ${weapon.name} ${player.ammoInMag}/${weapon.magSize} [${weapon.caliber}]`,
  );
  display.drawText(0, MAP_H + LOG_LINES + 1, `Seed ${state.seed}  Turn ${state.turn}`);
}
