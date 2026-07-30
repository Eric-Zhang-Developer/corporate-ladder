import { floorDef, LAST_FLOOR } from "./data/floors";
import { actionForKey } from "./input/keyboard";
import { buildAtlas, TILE } from "./render/atlas";
import { buildSidebar, updateSidebar } from "./render/dom/sidebar";
import { updateScreens } from "./render/dom/screens";
import { renderViewport, type UIState } from "./render/tiles";
import { newGame } from "./sim/floor";
import { hasLos } from "./sim/los";
import { distance, idx } from "./sim/state";
import { applyAction } from "./sim/step";
import { randomSeed, seedFromUrl, writeSeedToUrl } from "./seed";

function el<T extends HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) throw new Error(`missing #${id}`);
  return node as T;
}

const viewport = el<HTMLCanvasElement>("viewport");
const sidebar = el<HTMLElement>("sidebar");
const overlay = el<HTMLElement>("overlay");
const logPanel = el<HTMLElement>("log");
const header = el<HTMLElement>("floor-header");

const ctx = viewport.getContext("2d");
if (!ctx) throw new Error("no 2d context");
const atlas = buildAtlas();
buildSidebar(sidebar);

let seed = seedFromUrl() ?? randomSeed();
writeSeedToUrl(seed);
let state = newGame(seed);
const ui: UIState = { targetId: null };

function render(): void {
  if (viewport.width !== state.map.width * TILE || viewport.height !== state.map.height * TILE) {
    viewport.width = state.map.width * TILE;
    viewport.height = state.map.height * TILE;
  }
  // Drop the target if it died or left sight.
  if (ui.targetId !== null) {
    const t = state.enemies.find((e) => e.id === ui.targetId);
    if (!t || !state.visible[idx(state.map, t.x, t.y)]) ui.targetId = null;
  }
  renderViewport(ctx!, atlas, state, ui);
  updateSidebar(sidebar, state, ui);
  updateScreens(overlay, state);
  header.innerHTML = `<b>${floorDef(state.floor).name}</b>: ${state.floor}/${LAST_FLOOR}`;
  const recent = state.log.slice(-3);
  logPanel.innerHTML = recent
    .map((line, i) => `<div class="${i === recent.length - 1 ? "new" : "old"}">${line}</div>`)
    .join("");
}

function cycleTarget(): void {
  const p = state.player;
  const candidates = state.enemies
    .filter((e) => state.visible[idx(state.map, e.x, e.y)] && hasLos(state.map, p.x, p.y, e.x, e.y))
    .sort((a, b) => distance(p, a) - distance(p, b));
  if (candidates.length === 0) {
    ui.targetId = null;
    return;
  }
  const at = candidates.findIndex((e) => e.id === ui.targetId);
  ui.targetId = candidates[(at + 1) % candidates.length]!.id;
}

render();

window.addEventListener("keydown", (e) => {
  if (state.phase !== "playing") {
    if (e.key === "Enter") {
      seed = randomSeed();
      writeSeedToUrl(seed);
      state = newGame(seed);
      ui.targetId = null;
    } else if (e.key.toLowerCase() === "s") {
      state = newGame(seed);
      ui.targetId = null;
    } else {
      return;
    }
    e.preventDefault();
    render();
    return;
  }

  if (e.key === "Tab") {
    e.preventDefault();
    cycleTarget();
    render();
    return;
  }

  let action = actionForKey(e);
  if (!action) return;
  if (action.type === "fire" && ui.targetId !== null) {
    action = { type: "fire", targetId: ui.targetId };
  }
  e.preventDefault();
  state = applyAction(state, action);
  render();
});
