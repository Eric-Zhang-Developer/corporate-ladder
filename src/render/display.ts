import { Display } from "rot-js";
import { MAP_H, MAP_W } from "../sim/mapgen";

export const LOG_LINES = 2;
export const HUD_LINES = 2;
export const VIEW_W = MAP_W;
export const VIEW_H = MAP_H + LOG_LINES + HUD_LINES;

export function createDisplay(): Display {
  return new Display({
    width: VIEW_W,
    height: VIEW_H,
    fontSize: 18,
    fontFamily: "monospace",
    fg: "#ddd",
    bg: "#000",
  });
}
