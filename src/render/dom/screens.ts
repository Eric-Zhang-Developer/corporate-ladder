import { carrierDef } from "../../data/carriers";
import { itemDef } from "../../data/items";
import { perkDef } from "../../data/perks";
import type { ShopEntry } from "../../data/shop";
import { weaponDef } from "../../data/weapons";
import type { GameState } from "../../sim/state";

/** Death / win / promotion overlays. Input stays on the keyboard. */
export function updateScreens(
  overlay: HTMLElement,
  state: GameState,
  tradeIn?: { index: number; slot?: 0 | 1 | 2 } | null,
): void {
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
  tradeIn?: { index: number; slot?: 0 | 1 | 2 } | null,
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
