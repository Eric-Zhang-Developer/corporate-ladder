import { floorDef, LAST_FLOOR } from "./data/floors";
import { itemDef } from "./data/items";
import { actionForKey } from "./input/keyboard";
import { buildAtlas, TILE } from "./render/atlas";
import { buildSidebar, updateSidebar } from "./render/dom/sidebar";
import { updateScreens } from "./render/dom/screens";
import { renderViewport, type UIState } from "./render/tiles";
import { newGame } from "./sim/floor";
import { hasLos } from "./sim/los";
import { distance, idx, isFloor } from "./sim/state";
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
// Two-key input modes live here, never in the sim.
let dropMode = false;
let hint = "";
let throwAim: { slot: number; x: number; y: number; radius: number; range: number } | null = null;

const AIM_KEYS: Record<string, [number, number]> = {
  arrowup: [0, -1],
  arrowdown: [0, 1],
  arrowleft: [-1, 0],
  arrowright: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  w: [0, -1],
  s: [0, 1],
  a: [-1, 0],
  d: [1, 0],
};

/** Mirrors the aim cursor into render-side state, with its legality. */
function syncAim(): void {
  if (!throwAim) {
    ui.throwAim = null;
    return;
  }
  const p = state.player;
  const inRange = distance(p, throwAim) <= throwAim.range;
  const clear = hasLos(state.map, p.x, p.y, throwAim.x, throwAim.y);
  ui.throwAim = {
    x: throwAim.x,
    y: throwAim.y,
    radius: throwAim.radius,
    valid: inRange && clear,
  };
}

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
  // Escaped, not interpolated raw: log text is internal today, but it is about
  // to carry a lot more content and this is the statement that would leak.
  logPanel.innerHTML =
    recent
      .map((line, i) => `<div class="${i === recent.length - 1 ? "new" : "old"}">${escapeHtml(line)}</div>`)
      .join("") + (hint ? `<div class="hint">${escapeHtml(hint)}</div>` : "");
}

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (c) =>
    c === "&" ? "&amp;" : c === "<" ? "&lt;" : c === ">" ? "&gt;" : c === '"' ? "&quot;" : "&#39;",
  );
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

  // Drop is a two-key mode (X, then a slot) rather than its own key per slot:
  // an infrequent verb should not spend nine bindings. Mode state is UI-side —
  // the sim only ever sees the finished action.
  if (dropMode) {
    e.preventDefault();
    dropMode = false;
    const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    const slot = "123456789".indexOf(key);
    if (slot === -1) {
      hint = "";
      render();
      return;
    }
    state = applyAction(
      state,
      slot < 3
        ? { type: "drop", kind: "weapon", slot }
        : { type: "drop", kind: "item", slot: slot - 3 },
    );
    hint = "";
    render();
    return;
  }
  if (e.key.toLowerCase() === "x") {
    e.preventDefault();
    dropMode = true;
    hint = "DROP — press 1-3 for a weapon, 4-9 for an item, anything else to cancel.";
    render();
    return;
  }

  // Grenade aiming. First tap of the hotbar key opens the cursor, arrows move
  // it, and only the confirm key commits — a mis-tap should never spend the
  // grenade in a permadeath run.
  if (throwAim) {
    e.preventDefault();
    const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    const step = AIM_KEYS[key];
    if (step) {
      const nx = throwAim.x + step[0];
      const ny = throwAim.y + step[1];
      if (isFloor(state.map, nx, ny)) {
        throwAim.x = nx;
        throwAim.y = ny;
      }
    } else if (key === "Enter" || key === "f") {
      const { slot, x, y } = throwAim;
      throwAim = null;
      hint = "";
      state = applyAction(state, { type: "throwItem", slot, x, y });
    } else {
      throwAim = null;
      hint = "";
    }
    syncAim();
    render();
    return;
  }

  let action = actionForKey(e);
  if (!action) return;

  // Using a throwable *means* throwing it, so the hotbar key opens the cursor
  // instead of dispatching a useItem the sim would only refuse.
  if (action.type === "useItem") {
    const stack = state.hotbar[action.slot];
    const effect = stack ? itemDef(stack.itemId).effect : null;
    if (effect?.kind === "throw") {
      e.preventDefault();
      const start = state.enemies.find((en) => en.id === ui.targetId) ?? state.player;
      throwAim = {
        slot: action.slot,
        x: start.x,
        y: start.y,
        radius: effect.radius,
        range: effect.range,
      };
      hint = `THROW ${itemDef(stack!.itemId).name} — move the cursor, Enter to throw, any other key to cancel.`;
      syncAim();
      render();
      return;
    }
  }

  if (action.type === "fire" && ui.targetId !== null) {
    action = { type: "fire", targetId: ui.targetId };
  }
  e.preventDefault();
  state = applyAction(state, action);
  render();
});
