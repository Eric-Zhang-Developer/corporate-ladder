import { carrierDef } from "../../data/carriers";
import { itemDef } from "../../data/items";
import { perkDef } from "../../data/perks";
import type { ShopEntry } from "../../data/shop";
import { weaponDef } from "../../data/weapons";
import type { GameState } from "../../sim/state";

/** Death / win / promotion overlays. Input stays on the keyboard. */
export function updateScreens(overlay: HTMLElement, state: GameState): void {
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
        <p class="hint">Number keys to buy &nbsp;&nbsp; [Enter] climb on</p>
      </div>
    `;
    return;
  }
  const won = state.phase === "won";
  overlay.hidden = false;
  overlay.innerHTML = `
    <div class="end-box ${won ? "won" : "dead"}">
      <h1>${won ? "EXIT INTERVIEW PASSED" : "TERMINATED"}</h1>
      <p>${won ? `Cleared the slice — Seed ${state.seed} — Turn ${state.turn}` : escapeHtml(state.killedBy ?? "You die.")}</p>
      <p class="hint">[Enter] new run &nbsp;&nbsp; [S] same seed</p>
    </div>
  `;
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
