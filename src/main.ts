import { floorDef, LAST_FLOOR } from "./data/floors";
import { itemDef } from "./data/items";
import { CLOSE_KEYS, OPEN_KEYS } from "./input/controls";
import { actionForKey } from "./input/keyboard";
import { buildAtlas, TILE } from "./render/atlas";
import { playEvents, playSound, toggleMute, unlockAudio } from "./render/audio";
import { buildSidebar, updateSidebar } from "./render/dom/sidebar";
import { updateScreens } from "./render/dom/screens";
import { renderViewport, type UIState } from "./render/tiles";
import type { Action } from "./sim/actions";
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

// Dev-tools corner (ux-design.md §2): DEV is a build-time constant, so this
// block — and the dynamically imported modules behind it — is dead-code-
// eliminated from every build output. The debug panel mounts here too.
if (import.meta.env.DEV) {
  const corner = document.createElement("div");
  corner.id = "dev-corner";
  document.body.append(corner);
  void import("./render/dom/soundboard").then(({ mountSoundboard }) => mountSoundboard(corner));
}

let seed = seedFromUrl() ?? randomSeed();
writeSeedToUrl(seed);
let state = newGame(seed);
const ui: UIState = { targetId: null };
// Two-key input modes live here, never in the sim.
let dropMode = false;
let hint = "";
let throwAim: { slot: number; x: number; y: number; radius: number; range: number } | null = null;
/** Trading a gun in at the merchant: pick a slot, then confirm. */
let tradeIn: { index: number; slot?: 0 | 1 | 2 } | null = null;
/** The controls panel. Reference only — it never reaches the sim or costs AP. */
let controlsOpen = false;
/** The ARSENAL overlay — same contract as the controls panel. */
let arsenalOpen = false;

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

/** True when this shop line is a gun and there is nowhere to put it. */
function needsTradeIn(index: number): boolean {
  const entry = state.shop?.entries[index];
  if (!entry || entry.kind !== "weapon" || state.shop?.sold.includes(index)) return false;
  const slots = state.player.slots;
  if (!slots) return false;
  return !slots.some((slot, i) => slot === null && i !== state.player.activeSlot);
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
  updateScreens(overlay, state, { tradeIn, controlsOpen, arsenalOpen });
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

/** Every sim action goes through here: apply, hand the diary to sound. */
function dispatch(action: Action): void {
  const events = applyAction(state, action);
  playEvents(events, state);
}

function cycleTarget(): void {
  const p = state.player;
  const candidates = state.enemies
    .filter((e) => !e.hidden && state.visible[idx(state.map, e.x, e.y)] && hasLos(state.map, p.x, p.y, e.x, e.y))
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
  // Browsers gate audio behind a gesture — any keypress is the unlock.
  unlockAudio();
  // Mute is UI-side, works in every phase, and deliberately sits above the
  // input modes: even mid-drop or mid-aim, M is always the volume knob.
  if (e.key === "m" || e.key === "M") {
    const muted = toggleMute();
    hint = muted ? "SFX muted. (M to unmute)" : "SFX on.";
    render();
    return;
  }
  // Ahead of every phase branch, because they all return early. While the panel
  // is up, keys that do not close it are swallowed rather than passed through:
  // in a permadeath run, reading the controls must not be able to spend AP.
  if (controlsOpen) {
    e.preventDefault();
    if (CLOSE_KEYS.has(e.key)) {
      controlsOpen = false;
      render();
    }
    return;
  }
  if (OPEN_KEYS.has(e.key)) {
    e.preventDefault(); // F1 would otherwise open the browser's own help
    controlsOpen = true;
    render();
    return;
  }
  // The ARSENAL overlay follows the controls panel's rules exactly: above the
  // phase branches so it opens at the shop (where comparing guns matters most),
  // and while open every key but its closers is swallowed.
  if (arsenalOpen) {
    e.preventDefault();
    if (e.key === "Escape" || e.key.toLowerCase() === "i") {
      arsenalOpen = false;
      render();
    }
    return;
  }
  if (e.key.toLowerCase() === "i") {
    e.preventDefault();
    arsenalOpen = true;
    render();
    return;
  }

  if (state.phase === "promoting") {
    const pick = Number(e.key) - 1;
    const perkId = state.perkOffer?.[pick];
    if (perkId) {
      e.preventDefault();
      dispatch({ type: "choosePerk", perkId });
      render();
    }
    return;
  }
  if (state.phase === "shopping") {
    e.preventDefault();
    const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;

    if (tradeIn) {
      if (tradeIn.slot === undefined) {
        const slot = "123".indexOf(key);
        if (slot === -1) tradeIn = null; // anything else backs out
        else tradeIn.slot = slot as 0 | 1 | 2;
      } else if (key === "y" || key === "Enter") {
        // Permadeath: never let one keystroke destroy a gun you were carrying.
        dispatch({ type: "buy", index: tradeIn.index, replaceSlot: tradeIn.slot });
        tradeIn = null;
      } else {
        tradeIn = null;
      }
      render();
      return;
    }

    if (key === "Enter") {
      dispatch({ type: "leaveShop" });
    } else {
      const index = Number(key) - 1;
      if (Number.isInteger(index) && index >= 0) {
        if (needsTradeIn(index)) tradeIn = { index };
        else dispatch({ type: "buy", index });
      }
    }
    render();
    return;
  }
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
    // Restarts bypass applyAction, so the badge-scan plays directly.
    playSound("game_start");
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
    dispatch(
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
      dispatch({ type: "throwItem", slot, x, y });
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
  dispatch(action);
  render();
});
