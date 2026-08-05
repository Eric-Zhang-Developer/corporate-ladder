/**
 * DEBUG panel (ux-design.md §2, M14). A development tool: it exists so the
 * balance pass can reach floor 6 with a chosen loadout in a click instead of a
 * twenty-minute replay.
 *
 * Mounted only under import.meta.env.DEV, from the same dev-corner as the
 * soundboard — this module is absent from every build output, so nothing here
 * may be imported by shipping code.
 *
 * Two rules it does not share with the soundboard:
 *
 * 1. It is **docked, not modal**. The point of the tool is to spawn something
 *    and then watch it act, which a full-screen overlay makes impossible.
 * 2. Because the game stays live beside it, the panel is entirely click-driven
 *    — it owns no gameplay keys. Its one keyboard listener swallows keydown
 *    originating *inside* the panel (a <select>, a focused button), so nothing
 *    typed at it can reach applyAction and spend AP in a permadeath run.
 *
 * It never writes GameState. Every mutation is a `{type: "debug"}` action
 * dispatched through the host's own dispatch, so the sim stays the only writer
 * and the ops stay testable (test/sim/debug.test.ts).
 */

import { CARRIERS } from "../../data/carriers";
import { ENEMIES, enemyDef } from "../../data/enemies";
import { CALIBERS, FLOORS, LAST_FLOOR } from "../../data/floors";
import { ITEMS, itemDef } from "../../data/items";
import { WEAPONS, weaponDef } from "../../data/weapons";
import type { Action } from "../../sim/actions";
import type { GameState } from "../../sim/state";
import type { UIState } from "../tiles";

export interface OptionGroup {
  label: string;
  ids: string[];
}

/** What the host hands the panel. `getState` is a getter on purpose. */
export interface DebugContext {
  /** main.ts reassigns `state` on restart — a captured reference goes stale. */
  getState: () => GameState;
  dispatch: (action: Action) => void;
  render: () => void;
  ui: UIState;
}

const AMMO_GRANT = 60;
const CASH_GRANT = 500;
const XP_GRANT = 50;

/**
 * Every enemy bucketed under the first floor that can produce it. Derived from
 * the spawn tables rather than hand-listed, so a new entry in data/enemies.ts
 * shows up in the panel without anyone remembering to add it — the "other"
 * bucket at the end is what guarantees that (debugpanel.test.ts pins it).
 */
export function enemyOptions(): OptionGroup[] {
  const groups: OptionGroup[] = [];
  const seen = new Set<string>();
  for (const floor of FLOORS) {
    const ids: string[] = [];
    const consider = [...Object.keys(floor.weights), ...(floor.boss ? [floor.boss] : [])];
    for (const id of consider) {
      if (seen.has(id) || !(id in ENEMIES)) continue;
      seen.add(id);
      ids.push(id);
    }
    if (ids.length > 0) groups.push({ label: `${floor.depth} ${floor.name}`, ids });
  }
  const rest = Object.keys(ENEMIES).filter((id) => !seen.has(id));
  if (rest.length > 0) groups.push({ label: "other", ids: rest });
  return groups;
}

/** Guns by loot tier; enemy-only variants keep their own bucket. */
export function weaponOptions(): OptionGroup[] {
  const byTier = new Map<number, string[]>();
  const enemyOnly: string[] = [];
  for (const id of Object.keys(WEAPONS)) {
    const tier = weaponDef(id).tier;
    if (tier === undefined) enemyOnly.push(id);
    else byTier.set(tier, [...(byTier.get(tier) ?? []), id]);
  }
  const groups = [...byTier.keys()]
    .sort((a, b) => a - b)
    .map((tier) => ({ label: `T${tier}`, ids: byTier.get(tier)! }));
  if (enemyOnly.length > 0) groups.push({ label: "enemy-only", ids: enemyOnly });
  return groups;
}

export function itemOptions(): OptionGroup[] {
  return [{ label: "consumables", ids: Object.keys(ITEMS) }];
}

/** Create the DBG button in the dev corner; returns the readout refresher. */
export function mountDebugPanel(corner: HTMLElement, ctx: DebugContext): () => void {
  const button = document.createElement("button");
  button.className = "dev-btn";
  button.title = "Debug panel (`)";
  button.textContent = "DBG";
  corner.append(button);
  const root = document.createElement("div");
  root.id = "debug-panel";
  root.hidden = true;
  document.body.append(root);
  return initDebugPanel(button, root, ctx);
}

export function initDebugPanel(
  button: HTMLElement,
  root: HTMLElement,
  ctx: DebugContext,
): () => void {
  let open = false;
  // Selections survive the readout refresh because the body is built once.
  const picks: Record<string, string> = {
    enemy: enemyOptions()[0]?.ids[0] ?? "",
    weapon: weaponOptions()[0]?.ids[0] ?? "",
    item: itemOptions()[0]?.ids[0] ?? "",
    carrier: Object.keys(CARRIERS)[0] ?? "",
  };

  const send = (op: Extract<Action, { type: "debug" }>["op"]): void => {
    ctx.dispatch({ type: "debug", op });
    ctx.render(); // which loops back to refresh() below
  };

  function select(kind: string, groups: OptionGroup[], nameOf: (id: string) => string): string {
    const options = groups
      .map(
        (g) =>
          `<optgroup label="${g.label}">${g.ids
            .map(
              (id) =>
                `<option value="${id}"${id === picks[kind] ? " selected" : ""}>${nameOf(id)}</option>`,
            )
            .join("")}</optgroup>`,
      )
      .join("");
    return `<select class="dbg-sel" data-pick="${kind}">${options}</select>`;
  }

  function body(): string {
    const floors = Array.from(
      { length: LAST_FLOOR },
      (_, i) => `<button class="dbg-btn" data-warp="${i + 1}">${i + 1}</button>`,
    ).join("");
    const ammo = CALIBERS.map(
      (c) => `<button class="dbg-btn" data-ammo="${c}">${c}</button>`,
    ).join("");
    const carriers = Object.values(CARRIERS)
      .map((c) => `<button class="dbg-btn" data-carrier="${c.id}">${c.name.split(" ")[1]}</button>`)
      .join("");
    return `
      <div class="dbg-head"><span>DEBUG</span><button class="dbg-btn" data-close>×</button></div>
      <div class="dbg-read"></div>
      <div class="dbg-row"><span class="dbg-key">FLOOR</span><span class="dbg-set">${floors}</span></div>
      <div class="dbg-row"><span class="dbg-key">SPAWN</span><span class="dbg-set">
        ${select("enemy", enemyOptions(), (id) => enemyDef(id).name)}
        <button class="dbg-btn" data-spawn>+</button></span></div>
      <div class="dbg-row"><span class="dbg-key">GUN</span><span class="dbg-set">
        ${select("weapon", weaponOptions(), (id) => weaponDef(id).name)}
        <button class="dbg-btn" data-give="weapon">+</button></span></div>
      <div class="dbg-row"><span class="dbg-key">ITEM</span><span class="dbg-set">
        ${select("item", itemOptions(), (id) => itemDef(id).name)}
        <button class="dbg-btn" data-give="item">+</button></span></div>
      <div class="dbg-row"><span class="dbg-key">AMMO</span><span class="dbg-set">${ammo}</span></div>
      <div class="dbg-row"><span class="dbg-key">ARMOR</span><span class="dbg-set">
        <button class="dbg-btn" data-give="plate">plate</button>${carriers}</span></div>
      <div class="dbg-row"><span class="dbg-key">GRANT</span><span class="dbg-set">
        <button class="dbg-btn" data-cash>¢+${CASH_GRANT}</button>
        <button class="dbg-btn" data-xp>xp+${XP_GRANT}</button>
        <button class="dbg-btn" data-heal>heal</button></span></div>
      <div class="dbg-row"><span class="dbg-key">TOGGLE</span><span class="dbg-set">
        <button class="dbg-btn" data-god>god</button>
        <button class="dbg-btn" data-reveal>reveal</button>
        <button class="dbg-btn" data-killall>kill all</button>
        <button class="dbg-btn" data-copy>copy state</button></span></div>
      <div class="dbg-hint">\` toggles · clicks cost no AP</div>`;
  }

  /**
   * Only the readout and the toggle lights are repainted per frame. Rebuilding
   * the whole body on every keypress would close an open dropdown mid-choice.
   */
  function refresh(): void {
    if (!open) return;
    const s = ctx.getState();
    const p = s.player;
    root.querySelector(".dbg-read")!.textContent =
      `f${s.floor} · t${s.turn} · ${p.hp}/${p.maxHp}hp · ${p.ap}ap · ¢${s.cash} · ` +
      `lv${s.level} (${s.xp}xp) · ${s.enemies.length} hostile · ${s.phase}`;
    root.querySelector("[data-god]")!.classList.toggle("on", s.god === true);
    root.querySelector("[data-reveal]")!.classList.toggle("on", ctx.ui.revealAll === true);
  }

  function toggle(): void {
    open = !open;
    root.hidden = !open;
    button.classList.toggle("on", open);
    if (open) {
      root.innerHTML = body();
      refresh();
    }
  }

  button.addEventListener("click", toggle);

  root.addEventListener("change", (e) => {
    const sel = e.target as HTMLSelectElement;
    const kind = sel.dataset?.pick;
    if (kind) picks[kind] = sel.value;
  });

  root.addEventListener("click", (e) => {
    const el = (e.target as HTMLElement).closest("button");
    if (!el) return;
    const d = el.dataset;
    const s = ctx.getState();

    if (d.close !== undefined) return toggle();
    if (d.warp !== undefined) return send({ kind: "warp", floor: Number(d.warp) });
    if (d.spawn !== undefined) return send({ kind: "spawn", defId: picks.enemy! });
    if (d.ammo !== undefined) {
      return send({
        kind: "give",
        payload: { kind: "ammo", caliber: d.ammo as never, amount: AMMO_GRANT },
      });
    }
    if (d.carrier !== undefined) {
      return send({ kind: "give", payload: { kind: "carrier", carrierId: d.carrier } });
    }
    if (d.give === "weapon") {
      const def = weaponDef(picks.weapon!);
      return send({
        kind: "give",
        payload: { kind: "weapon", weaponId: def.id, ammoInMag: def.magSize },
      });
    }
    if (d.give === "item") {
      return send({ kind: "give", payload: { kind: "consumable", itemId: picks.item! } });
    }
    if (d.give === "plate") return send({ kind: "give", payload: { kind: "plate" } });
    if (d.cash !== undefined) return send({ kind: "cash", amount: CASH_GRANT });
    if (d.xp !== undefined) return send({ kind: "xp", amount: XP_GRANT });
    if (d.heal !== undefined) return send({ kind: "heal" });
    if (d.god !== undefined) return send({ kind: "god", on: s.god !== true });
    if (d.killall !== undefined) return send({ kind: "kill" });
    if (d.reveal !== undefined) {
      // Visibility is not an outcome: it stays a render flag, never an action.
      ctx.ui.revealAll = !ctx.ui.revealAll;
      ctx.render();
      return;
    }
    if (d.copy !== undefined) {
      // Invariant 2 makes this free, and it turns "weird bug on floor 6" into
      // an exact repro.
      void navigator.clipboard?.writeText(JSON.stringify(s));
      el.textContent = "copied";
      window.setTimeout(() => (el.textContent = "copy state"), 900);
    }
  });

  // Non-capture: fires only for keys pressed *inside* the panel, and stops them
  // short of main.ts's window listener. Everything typed at the game itself
  // still reaches the sim, which is the whole point of docking rather than
  // going modal.
  root.addEventListener("keydown", (e) => e.stopPropagation());

  // Capture phase so the toggle key never reaches the game's own handler.
  window.addEventListener(
    "keydown",
    (e) => {
      if (e.key !== "`") return;
      e.preventDefault();
      e.stopPropagation();
      toggle();
    },
    true,
  );

  return refresh;
}
