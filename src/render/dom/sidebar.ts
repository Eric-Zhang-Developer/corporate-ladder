import { dmgPerAp, weaponDef } from "../../data/weapons";
import { KNIFE } from "../../data/costs";
import { carrierCapacity, carrierDef } from "../../data/carriers";
import { CALIBERS, LAST_FLOOR } from "../../data/floors";
import { HOTBAR_SLOTS, itemDef } from "../../data/items";
import { distance, idx, type GameState } from "../../sim/state";
import type { UIState } from "../tiles";

/**
 * §9 sidebar, top to bottom: vitals / ammo / minimap / equipped cards /
 * weapon slots / consumables / seed+turn. Built once; updated per action.
 * Pure reader of GameState — the DOM never talks back to the sim.
 */
export function buildSidebar(root: HTMLElement): void {
  root.innerHTML = `
    <section class="vitals">
      <div class="shield-row"><span class="label">AR</span><div class="shield-bar"></div><span class="shield-num"></span></div>
      <div class="hp-row"><span class="label">HP</span><div class="hp-bar"><div class="hp-fill"></div></div><span class="hp-num"></span></div>
      <div class="ap-row"><span class="label">AP</span><span class="ap-pips"></span><span class="floor-cell"></span></div>
    </section>
    <section class="ammo">
      ${CALIBERS.map(
        (cal) =>
          `<div class="ammo-cell"><span class="cal">${cal.toUpperCase()}</span><span class="amt" data-cal="${cal}"></span></div>`,
      ).join("")}
    </section>
    <section class="minimap-wrap">
      <canvas class="minimap" width="144" height="90"></canvas>
      <div class="minimap-placeholder">UNEXPLORED</div>
    </section>
    <section class="equipped">
      <div class="card gun-card">
        <div class="card-name"></div>
        <div class="card-mag"></div>
        <div class="card-dpa"></div>
        <div class="card-state"></div>
      </div>
      <div class="card knife-card">
        <div class="card-name">Knife</div>
        <div class="card-mag">bump</div>
        <div class="card-dpa">${KNIFE.damage.toFixed(1)} dmg/AP</div>
      </div>
    </section>
    <section class="slots">
      <div class="slot" data-slot="0"><span class="key">1</span><span class="slot-name"></span><span class="slot-mag"></span></div>
      <div class="slot" data-slot="1"><span class="key">2</span><span class="slot-name"></span><span class="slot-mag"></span></div>
      <div class="slot" data-slot="2"><span class="key">3</span><span class="slot-name"></span><span class="slot-mag"></span></div>
    </section>
    <section class="consumables">
      ${Array.from(
        { length: HOTBAR_SLOTS },
        (_, i) =>
          `<div class="hotbar-cell" data-hot="${i}"><span class="key">${i + 4}</span><span class="hot-name">—</span><span class="hot-count"></span></div>`,
      ).join("")}
    </section>
    <footer class="run-meta"><span class="seed"></span><span class="turn"></span></footer>
  `;
}

export function updateSidebar(root: HTMLElement, state: GameState, ui: UIState): void {
  const q = <T extends HTMLElement>(sel: string): T => {
    const el = root.querySelector<T>(sel);
    if (!el) throw new Error(`sidebar missing ${sel}`);
    return el;
  };
  const player = state.player;

  // Plates: a segmented blue bar, one cell per plate the carrier holds, so the
  // player reads "two plates left" at a glance rather than a number.
  const carrier = state.carrierId ? carrierDef(state.carrierId) : null;
  const shield = player.shield ?? 0;
  const capacity = carrier ? carrierCapacity(carrier.id) : 0;
  const bar = q<HTMLDivElement>(".shield-bar");
  if (carrier) {
    const filled = shield / carrier.plateValue;
    bar.innerHTML = Array.from({ length: carrier.slots }, (_, i) => {
      const frac = Math.max(0, Math.min(1, filled - i));
      return `<span class="plate-cell"><span class="plate-fill" style="width:${frac * 100}%"></span></span>`;
    }).join("");
  } else {
    bar.innerHTML = "";
  }
  q(".shield-num").textContent = carrier
    ? `${shield}/${capacity}${state.spareplates > 0 ? ` +${state.spareplates}` : ""}`
    : "none";

  // Vitals
  q<HTMLDivElement>(".hp-fill").style.width = `${Math.max(0, (player.hp / player.maxHp) * 100)}%`;
  q(".hp-num").textContent = `${Math.max(0, player.hp)}/${player.maxHp}`;
  q(".ap-pips").textContent = "◆".repeat(Math.max(0, player.ap)) + "◇".repeat(player.maxAp - Math.max(0, player.ap));
  q(".floor-cell").textContent = `F${state.floor}/${LAST_FLOOR}`;

  // Ammo — always on screen; it is the food clock (§9.2)
  for (const cal of CALIBERS) {
    q(`.amt[data-cal="${cal}"]`).textContent = String(state.ammo[cal]);
  }

  // Minimap
  const mini = q<HTMLCanvasElement>(".minimap");
  const anyExplored = state.explored.some(Boolean);
  q(".minimap-placeholder").style.display = anyExplored ? "none" : "block";
  mini.style.display = anyExplored ? "block" : "none";
  if (anyExplored) drawMinimap(mini, state);

  // Equipped gun card with live dmg/AP at the current target's distance
  const gun = player.weaponId ? weaponDef(player.weaponId) : null;
  q(".gun-card .card-name").textContent = gun ? gun.name : "Unarmed";
  q(".gun-card .card-mag").textContent = gun ? `${player.ammoInMag}/${gun.magSize} [${gun.caliber}]` : "";
  const target =
    state.enemies.find((e) => e.id === ui.targetId) ??
    state.enemies
      .filter((e) => state.visible[idx(state.map, e.x, e.y)])
      .sort((a, b) => distance(player, a) - distance(player, b))[0];
  q(".gun-card .card-dpa").textContent =
    gun && target ? `${dmgPerAp(gun, distance(player, target)).toFixed(2)} dmg/AP @ target` : "— dmg/AP";

  // Weapon states the player cannot otherwise see: an open bolt costs an extra
  // AP on the next shot, and braced is live only until they move.
  const flags: string[] = [];
  if (gun?.boltAction) flags.push(player.chambered === false ? "CYCLE" : "READY");
  if (gun?.bracedBonus && !player.movedThisTurn) flags.push("BRACED");
  if (gun?.reloadDiscards && player.ammoInMag > 0) flags.push(`CLIP ${player.ammoInMag}`);
  const stateEl = q<HTMLDivElement>(".gun-card .card-state");
  stateEl.textContent = flags.join(" · ");
  stateEl.classList.toggle("warn", flags.includes("CYCLE"));

  // Melee card: a bayonet replaces the knife while its rifle is in hand
  q(".knife-card .card-name").textContent = gun?.bayonet ? "Bayonet" : "Knife";
  q(".knife-card .card-dpa").textContent = `${(gun?.bayonet ?? KNIFE.damage).toFixed(1)} dmg/AP`;

  // Weapon slots
  for (let i = 0; i < 3; i++) {
    const cell = q<HTMLDivElement>(`.slot[data-slot="${i}"]`);
    const stored = player.slots?.[i] ?? null;
    const isActive = player.activeSlot === i;
    const shown = isActive && player.weaponId ? { weaponId: player.weaponId, ammoInMag: player.ammoInMag } : stored;
    cell.classList.toggle("active", isActive);
    cell.querySelector(".slot-name")!.textContent = shown ? weaponDef(shown.weaponId).name : "empty";
    cell.querySelector(".slot-mag")!.textContent = shown ? `${shown.ammoInMag}/${weaponDef(shown.weaponId).magSize}` : "";
  }

  // Hotbar: one item type per slot with a stack badge (§9.6)
  for (let i = 0; i < HOTBAR_SLOTS; i++) {
    const cell = q<HTMLDivElement>(`.hotbar-cell[data-hot="${i}"]`);
    const stack = state.hotbar[i] ?? null;
    cell.classList.toggle("filled", stack !== null);
    cell.querySelector(".hot-name")!.textContent = stack ? itemDef(stack.itemId).name : "—";
    cell.querySelector(".hot-count")!.textContent = stack && stack.count > 1 ? `x${stack.count}` : "";
  }

  // Seed / turn — the seeded-runs rule made public (§9.7)
  q(".seed").textContent = `Seed ${state.seed}`;
  q(".turn").textContent = `Turn ${state.turn}`;
}

function drawMinimap(canvas: HTMLCanvasElement, state: GameState): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const { map } = state;
  const cell = Math.max(1, Math.floor(Math.min(canvas.width / map.width, canvas.height / map.height)));
  ctx.fillStyle = "#0b0b0e";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < map.width; x++) {
      const i = idx(map, x, y);
      if (!state.explored[i]) continue;
      ctx.fillStyle = map.tiles[i] === 0 ? "#3a3a44" : "#20202a";
      ctx.fillRect(x * cell, y * cell, cell, cell);
    }
  }
  if (state.explored[idx(map, state.stairs.x, state.stairs.y)]) {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(state.stairs.x * cell, state.stairs.y * cell, cell, cell);
  }
  ctx.fillStyle = "#66dd66";
  ctx.fillRect(state.player.x * cell, state.player.y * cell, cell, cell);
}
