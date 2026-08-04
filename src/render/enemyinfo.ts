/**
 * The target card, as pure HTML (tested like the other formatters). Armor
 * readability is this card's founding job — the player must see plate and
 * MACHINE before wasting a magazine — and it now extends that to the rest of
 * what the sim knows: the enemy's AP budget, their live mag (the punish-window
 * clock), and their expected threat at the current distance.
 *
 * Three fixed rows: identity + state chips, the stat row (HP · armor · AP ·
 * distance — dashes hold absent columns so the eye always lands in the same
 * place), and a threat line that flexes by what the enemy actually does.
 *
 * Colors are semantic channels shared with the rest of the UI, never local
 * decoration: yellow is the action economy (their ◆ match the player's pips),
 * blue is armor (the layer blades ignore, both sides), orange is incoming
 * threat, green is opportunity (UNAWARE, and a mag at 0 — window open). Every
 * channel is redundantly encoded in text, so color accelerates the read but
 * never carries it alone.
 */
import { enemyDef } from "../data/enemies";
import { dmgPerAp, maxRange, weaponDef } from "../data/weapons";
import type { Entity } from "../sim/state";

export function alertChip(target: Entity): string {
  return target.alerted
    ? `<span class="tgt-alert">ALERT</span>`
    : `<span class="tgt-unaware">UNAWARE</span>`;
}

/** "6/6 HP · ▣▣ · ◆◆" — dashes, not blanks, when a stat is absent. */
export function statRow(target: Entity): string {
  const armor = target.armor ? `<span class="tgt-armor">${"▣".repeat(target.armor)}</span>` : "—";
  const ap = target.maxAp > 0 ? `<span class="tgt-ap">${"◆".repeat(target.maxAp)}</span>` : "—";
  return `${target.hp}/${target.maxHp} HP · ${armor} · ${ap}`;
}

/**
 * What this enemy does to you, in its own terms. Shooters get their gun, the
 * live mag, and dmg/AP at the current distance through their own band table —
 * which quietly teaches "his Glock is bad at 7 tiles" and turns into an
 * explicit "out of range" past the last band, since absence of threat is
 * information too.
 */
export function threatLine(target: Entity, dist: number): string {
  const def = enemyDef(target.defId);
  if (target.weaponId) {
    const gun = weaponDef(target.weaponId);
    // An empty mag is the punish window — the one green fact on the card.
    const mag =
      target.ammoInMag === 0
        ? `<span class="tgt-open">mag 0/${gun.magSize}</span>`
        : `mag ${target.ammoInMag}/${gun.magSize}`;
    const dpa = dmgPerAp(gun, dist);
    const threat =
      dpa > 0
        ? `<span class="tgt-threat">hits ~${dpa.toFixed(1)}/AP</span>`
        : `out of range (${maxRange(gun)})`;
    const note = def.behavior === "overwatch" ? " · on sight" : def.behavior === "spinup" ? " · telegraphed" : "";
    return `${gun.name} · ${mag} · ${threat}${note}`;
  }
  if (def.detonateDamage) return `detonates for <span class="tgt-threat">${def.detonateDamage}</span>`;
  if (def.meleeDamage) {
    const drain = def.apDrainOnHit ? ` · <span class="tgt-threat">drains ${def.apDrainOnHit} AP</span>` : "";
    return `melee <span class="tgt-threat">${def.meleeDamage}</span>${drain}`;
  }
  if (def.behavior === "cameraAlarm") return "raises the alarm · no attack";
  return "no attack";
}

export function targetCardHtml(target: Entity, dist: number): string {
  const def = enemyDef(target.defId);
  const machine = def.machine ? `<span class="tgt-machine">MACHINE</span>` : "";
  return (
    `<div class="tgt-row"><span class="tgt-name">${target.name}</span>` +
    `<span class="tgt-chips">${machine}${alertChip(target)}</span></div>` +
    `<div class="tgt-row"><span class="tgt-stats">${statRow(target)}</span>` +
    `<span class="tgt-dist">${dist.toFixed(1)} tiles</span></div>` +
    `<div class="tgt-row tgt-line3">${threatLine(target, dist)}</div>`
  );
}
