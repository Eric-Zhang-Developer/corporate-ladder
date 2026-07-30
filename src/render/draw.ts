import type { Display } from "rot-js";
import { weaponDef } from "../data/weapons";
import { idx, type GameState } from "../sim/state";
import { MAP_H } from "../sim/mapgen";
import { LOG_LINES, VIEW_W } from "./display";

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

  for (const item of state.items) {
    if (state.visible[idx(map, item.x, item.y)]) {
      const glyph = item.kind === "weapon" ? "/" : "=";
      display.draw(item.x, item.y, glyph, item.kind === "weapon" ? "#66dddd" : "#ddcc55", "#000");
    }
  }
  for (const e of state.enemies) {
    if (!state.visible[idx(map, e.x, e.y)]) continue;
    // Telegraph (§9): an armed camera shows its countdown instead of a glyph.
    const glyph = e.alarmTimer !== undefined ? String(e.alarmTimer) : e.glyph;
    display.draw(e.x, e.y, glyph, e.color, "#000");
  }
  display.draw(player.x, player.y, player.glyph, COLOR.player, "#000");

  const recent = state.log.slice(-LOG_LINES);
  for (let i = 0; i < recent.length; i++) {
    const isLatest = i === recent.length - 1;
    display.drawText(0, MAP_H + i, `%c{${isLatest ? "#dddddd" : COLOR.logOld}}${recent[i]}`);
  }

  const weapon = player.weaponId ? weaponDef(player.weaponId) : null;
  const weaponText = weapon
    ? `${weapon.name} ${player.ammoInMag}/${weapon.magSize} [${weapon.caliber}]`
    : "Unarmed";
  const pips = "◆".repeat(player.ap) + "◇".repeat(player.maxAp - player.ap);
  display.drawText(
    0,
    MAP_H + LOG_LINES,
    `HP ${player.hp}/${player.maxHp}  AP ${pips}  ${weaponText}  S${state.ammo.small} M${state.ammo.medium} L${state.ammo.large}`,
  );
  display.drawText(
    0,
    MAP_H + LOG_LINES + 1,
    `Floor ${state.floor}  Seed ${state.seed}  Turn ${state.turn}`,
  );

  if (state.phase === "dead") drawDeathScreen(display, state);
}

function drawDeathScreen(display: Display, state: GameState): void {
  const lines: Array<[string, string]> = [
    ["*** TERMINATED ***", "#ff5555"],
    [state.killedBy ?? "You die.", "#dddddd"],
    ["[Enter] new run    [S] same seed", "#999999"],
  ];
  const startY = Math.floor(MAP_H / 2) - 2;
  lines.forEach(([text, color], i) => {
    const x = Math.max(0, Math.floor((VIEW_W - text.length) / 2));
    const y = startY + i * 2;
    for (let cx = x - 1; cx <= x + text.length; cx++) display.draw(cx, y, " ", "#000", "#000");
    display.drawText(x, y, `%c{${color}}${text}`);
  });
}
