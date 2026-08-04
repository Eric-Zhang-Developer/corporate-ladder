import { carrierDef } from "../../data/carriers";
import { CONTROL_GROUPS } from "../../input/controls";
import { itemDef } from "../../data/items";
import { perkDef } from "../../data/perks";
import type { ShopEntry } from "../../data/shop";
import { weaponDef } from "../../data/weapons";
import type { GameState } from "../../sim/state";
import { bandRows, costLine, formulaLine, stripHtml, traitLine } from "../weaponinfo";

/** Overlay modes that live in the UI, never in GameState. */
export interface ScreenUI {
  tradeIn?: { index: number; slot?: 0 | 1 | 2 } | null;
  controlsOpen?: boolean;
  arsenalOpen?: boolean;
}

/**
 * The controls panel, built from `CONTROL_GROUPS` so it cannot drift from the
 * bindings. Pure and string-returning so the test can read it without a DOM.
 */
export function controlsBox(): string {
  const groups = CONTROL_GROUPS.map(
    (group) => `
      <section class="ctrl-group">
        <h2>${escapeHtml(group.title)}</h2>
        ${group.rows
          .map(
            (row) =>
              `<div class="ctrl-row"><span class="ctrl-keys">${escapeHtml(row.keys)}</span>` +
              `<span class="ctrl-label">${escapeHtml(row.label)}</span></div>`,
          )
          .join("")}
      </section>`,
  ).join("");
  return `
    <div class="end-box controls-box">
      <h1>CONTROLS</h1>
      ${groups}
      <p class="hint">[ESC] or [?] to close</p>
    </div>
  `;
}

/**
 * The ARSENAL overlay: full stats for all three carried guns, side by side.
 * Same recipe as the controls panel — pure string, opened by a UI-mode key,
 * never reaches the sim. It renders above the phase checks so it works at the
 * shop, which is exactly where comparing guns matters most.
 */
export function arsenalBox(state: GameState): string {
  const player = state.player;
  const cols = [0, 1, 2]
    .map((i) => {
      const stored = player.slots?.[i] ?? null;
      // The active slot's stored copy is stale while a gun is in hand — mirror
      // the live fields, same rule the sidebar slot row uses.
      const shown =
        i === player.activeSlot && player.weaponId
          ? { weaponId: player.weaponId, ammoInMag: player.ammoInMag }
          : stored;
      const active = i === player.activeSlot ? " active" : "";
      if (!shown) {
        return `<div class="ars-col empty"><div class="ars-name"><span class="perk-key">${i + 1}</span> empty</div></div>`;
      }
      const def = weaponDef(shown.weaponId);
      const bands = bandRows(def)
        .map((row) =>
          row.dpa === null
            ? `<div class="ars-band out"><span class="rng">${row.span}</span><span>—</span><span>—</span><span class="dpa">out</span></div>`
            : `<div class="ars-band${row.intended ? " intended" : ""}">` +
              `<span class="rng">${row.intended ? "▸" : ""}${row.span}</span>` +
              `<span>${Math.round(row.acc! * 100)}%</span>` +
              `<span>${row.dmg!.toFixed(1)}</span>` +
              `<span class="dpa">${row.dpa.toFixed(2)}</span></div>`,
        )
        .join("");
      // Pellets sit with the traits up top; the DMG line repeats the ×N so
      // "3.0 damage" is never mistaken for the whole pull.
      const specials = [def.pellets ? `${def.pellets} rds/pull` : "", traitLine(def)]
        .filter(Boolean)
        .join(" · ");
      return `
        <div class="ars-col${active}">
          <div class="ars-name"><span class="perk-key">${i + 1}</span> ${escapeHtml(def.name)}</div>
          <div class="ars-sub">${def.caliber} · ${shown.ammoInMag}/${def.magSize} mag</div>
          <div class="ars-sub">${escapeHtml(costLine(def))}</div>
          ${specials ? `<div class="ars-flags">${escapeHtml(specials)}</div>` : ""}
          <div class="ars-stat"><span class="lbl">DMG</span> ${def.damage.toFixed(1)} /round${def.pellets ? ` ×${def.pellets}` : ""}</div>
          <div class="ars-stat"><span class="lbl">ACC</span> ${Math.round(def.baseAccuracy * 100)}% base</div>
          <div class="ars-strip">${stripHtml(def, null)}</div>
          <div class="ars-table">
            <div class="ars-th"><span class="rng">RANGE</span><span>ACC</span><span>DMG</span><span class="dpa">/AP</span></div>
            ${bands}
          </div>
          <div class="ars-formula">${escapeHtml(formulaLine(def))}</div>
        </div>`;
    })
    .join("");
  return `
    <div class="end-box arsenal-box">
      <h1>ARSENAL</h1>
      <div class="ars-grid">${cols}</div>
      <p class="hint">[ESC] or [I] to close</p>
    </div>
  `;
}

/** Death / win / promotion overlays. Input stays on the keyboard. */
export function updateScreens(overlay: HTMLElement, state: GameState, ui: ScreenUI = {}): void {
  const { tradeIn } = ui;
  // Above the phase checks on purpose: the panel has to open during live play,
  // which is the only time anyone needs it, and over the death screen, so it
  // cannot trap you.
  if (ui.controlsOpen) {
    overlay.hidden = false;
    overlay.innerHTML = controlsBox();
    return;
  }
  if (ui.arsenalOpen) {
    overlay.hidden = false;
    overlay.innerHTML = arsenalBox(state);
    return;
  }
  if (state.phase === "playing") {
    overlay.hidden = true;
    return;
  }
  if (state.phase === "promoting") {
    // Styled as a performance review, because the joke is the whole premise.
    const offers = state.perkOffer ?? [];
    overlay.hidden = false;
    overlay.innerHTML = `
      <div class="end-box review">
        <h1>PERFORMANCE REVIEW</h1>
        <p>Level ${state.level}. Maximum HP raised to ${state.player.maxHp}. Select one benefit.</p>
        <div class="perk-list">
          ${offers
            .map((id, i) => {
              const def = perkDef(id);
              return `<div class="perk"><span class="perk-key">${i + 1}</span><span class="perk-name">${escapeHtml(def.name)}</span><span class="perk-blurb">${escapeHtml(def.blurb)}</span></div>`;
            })
            .join("")}
        </div>
        <p class="hint">Press 1 or 2 to accept.</p>
      </div>
    `;
    return;
  }
  if (state.phase === "shopping") {
    const shop = state.shop;
    overlay.hidden = false;
    overlay.innerHTML = `
      <div class="end-box shop">
        <h1>STAIRWELL LANDING</h1>
        <p>He does not care about the lockdown. His invoice is net-30 either way.</p>
        <p class="cash">${state.cash} credits</p>
        <div class="perk-list">
          ${(shop?.entries ?? [])
            .map((entry, i) => {
              const sold = shop?.sold.includes(i);
              return `<div class="perk${sold ? " sold" : ""}"><span class="perk-key">${i + 1}</span><span class="perk-name">${escapeHtml(describeEntry(entry))}</span><span class="perk-blurb">${sold ? "sold" : `${entry.price} credits`}</span></div>`;
            })
            .join("")}
        </div>
        <p class="hint">${tradePrompt(state, shop?.entries ?? [], tradeIn)}</p>
      </div>
    `;
    return;
  }
  const won = state.phase === "won";
  overlay.hidden = false;
  overlay.innerHTML = `
    <div class="end-box ${won ? "won" : "dead"}">
      <h1>${won ? "SEVERANCE COLLECTED" : "TERMINATED"}</h1>
      <p>${won ? `Eight floors — Level ${state.level} — Seed ${state.seed} — Turn ${state.turn}` : escapeHtml(state.killedBy ?? "You die.")}</p>
      <p class="hint">[Enter] new run &nbsp;&nbsp; [S] same seed</p>
    </div>
  `;
}

/** The two-step trade-in prompt, or the normal shop footer. */
function tradePrompt(
  state: GameState,
  entries: ShopEntry[],
  tradeIn: ScreenUI["tradeIn"],
): string {
  if (!tradeIn) return "Number keys to buy &nbsp;&nbsp; [Enter] climb on";
  const entry = entries[tradeIn.index];
  const buying = entry && entry.kind === "weapon" ? weaponDef(entry.weaponId).name : "that";
  if (tradeIn.slot === undefined) {
    const held = (state.player.slots ?? [])
      .map((slot, i) => {
        const shown =
          i === state.player.activeSlot && state.player.weaponId
            ? state.player.weaponId
            : slot?.weaponId;
        return `[${i + 1}] ${shown ? escapeHtml(weaponDef(shown).name) : "empty"}`;
      })
      .join(" &nbsp; ");
    return `Slots full. Trade in which gun for the ${escapeHtml(buying)}? &nbsp; ${held} &nbsp; (any other key cancels)`;
  }
  const slots = state.player.slots ?? [];
  const losingId =
    tradeIn.slot === state.player.activeSlot && state.player.weaponId
      ? state.player.weaponId
      : slots[tradeIn.slot]?.weaponId;
  const losing = losingId ? weaponDef(losingId).name : "that slot";
  return `Give up the ${escapeHtml(losing)} for the ${escapeHtml(buying)}? &nbsp; [Y] confirm &nbsp; any other key cancels`;
}

function describeEntry(entry: ShopEntry): string {
  switch (entry.kind) {
    case "weapon":
      return weaponDef(entry.weaponId).name;
    case "ammo":
      return `${entry.amount} ${entry.caliber} rounds`;
    case "plate":
      return "Armor Plate";
    case "consumable":
      return itemDef(entry.itemId).name;
    case "carrier":
      return carrierDef(entry.carrierId).name;
  }
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
