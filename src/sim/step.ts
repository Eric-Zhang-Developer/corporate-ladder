import { carrierCapacity, carrierDef, SPARE_PLATE_CAP } from "../data/carriers";
import { CALIBERS, floorDef } from "../data/floors";
import { AP_COSTS } from "../data/costs";
import { itemDef, type ItemDef } from "../data/items";
import {
  PRICES,
  SHOP_CONSUMABLES,
  priceWithPerks,
  type ShopEntry,
  type ShopState,
} from "../data/shop";
import {
  HP_PER_PROMOTION,
  PERK_IDS,
  PERK_OFFER_SIZE,
  perkDef,
  xpForLevel,
} from "../data/perks";
import { maxRange, weaponDef, type Caliber } from "../data/weapons";
import type { Action } from "./actions";
import { runEnemyTurns } from "./ai";
import { detonate } from "./aoe";
import { apToFire, fireWeapon, meleeAttack } from "./combat";
import { applyFloor, carriedCalibers, hashSeed, LAST_FLOOR } from "./floor";
import { recomputeFov } from "./fov";
import { hasLos } from "./los";
import { createSimRng, simRngFromState, type SimRNG } from "./rng";
import {
  distance,
  entityAt,
  hasPerk,
  idx,
  isFloor,
  pushLog,
  spawnItemNear,
  type Entity,
  type GameState,
  type GroundItemPayload,
  type WeaponSlot,
} from "./state";

/** Keeps the perk draw off the map and floor-content streams. */
const PERK_OFFER_SALT = 7;
/** Keeps shop stock off the map, spawn and perk streams. */
const SHOP_SALT = 11;
/** Per-item prices, narrowed away from the nested ammo/weapon tables. */
const ITEM_PRICES = PRICES as unknown as Record<string, number>;

/**
 * The whole game advances through this single entry point. A player turn is
 * a budget of AP spent across several actions; when it runs out (or the
 * player waits), every enemy takes its full turn, then AP refills.
 */
export function applyAction(state: GameState, action: Action): GameState {
  // A promotion pauses the game between turns: the only legal move is picking
  // a certification, and the choice is a sim action so replays stay exact.
  if (state.phase === "promoting") {
    if (action.type === "choosePerk") resolvePromotion(state, action.perkId);
    return state;
  }
  if (state.phase === "shopping") {
    if (action.type === "buy") handlePurchase(state, action.index, action.replaceSlot);
    if (action.type === "leaveShop") {
      delete state.shop;
      state.phase = "playing";
      applyFloor(state, state.floor + 1);
      state.player.ap = state.player.maxAp; // fresh floor, fresh turn
      recomputeFov(state);
    }
    return state;
  }
  if (state.phase !== "playing") return state;
  const rng = simRngFromState(state.rngState);

  handlePlayerAction(state, rng, action);

  if (state.phase === "playing" && state.player.ap <= 0) {
    runEnemyTurns(state, rng);
    state.turn += 1;
    refillAp(state.player);
    for (const e of state.enemies) refillAp(e);
    delete state.platedThisTurn;
    grantHazardPay(state);
  }

  // Checked after the enemy phase so the review lands between turns rather
  // than interrupting a half-spent one.
  if (state.phase === "playing") checkPromotion(state);

  recomputeFov(state);
  state.rngState = rng.getState();
  return state;
}

/**
 * Hazard Pay: the one AP perk, and it is deliberately confined to turns that
 * begin with nothing in sight. It speeds up walking, never fighting — which is
 * what keeps it clear of the no-AP-progression rule.
 */
function grantHazardPay(state: GameState): void {
  if (!hasPerk(state, "hazard_pay")) return;
  const anyVisible = state.enemies.some((e) => state.visible[idx(state.map, e.x, e.y)]);
  if (!anyVisible) state.player.ap += perkDef("hazard_pay").value ?? 1;
}

function checkPromotion(state: GameState): void {
  if (state.xp < xpForLevel(state.level + 1)) return;
  state.level += 1;
  state.player.maxHp += HP_PER_PROMOTION;
  // A full heal per promotion is the genre's pressure-release valve, and it is
  // why consumable healing only has to cover within-floor attrition.
  state.player.hp = state.player.maxHp;
  state.phase = "promoting";
  state.perkOffer = rollPerkOffer(state);
  pushLog(state, `PERFORMANCE REVIEW — promoted to level ${state.level}.`);
}

/**
 * Offers derive from hash(seed, level), never from sim history, so a shared
 * seed shows the same two certifications at the same promotion.
 */
function rollPerkOffer(state: GameState): string[] {
  const pool = PERK_IDS.filter((id) => !state.perks.includes(id));
  if (pool.length <= PERK_OFFER_SIZE) return [...pool];
    // Salted so the perk stream never collides with map or spawn rolls.
  const rng = createSimRng(hashSeed(state.seed, state.level, PERK_OFFER_SALT));
  const offer: string[] = [];
  const remaining = [...pool];
  while (offer.length < PERK_OFFER_SIZE && remaining.length > 0) {
    offer.push(remaining.splice(Math.floor(rng.next() * remaining.length), 1)[0]!);
  }
  return offer;
}

function resolvePromotion(state: GameState, perkId: string): void {
  if (!state.perkOffer?.includes(perkId)) return; // not on the menu
  state.perks.push(perkId);
  delete state.perkOffer;
  state.phase = "playing";
  const def = perkDef(perkId);
  if (perkId === "wellness") {
    state.player.maxHp += def.value ?? 0;
    state.player.hp += def.value ?? 0;
  }
  if (perkId === "field_awareness") recomputeFov(state);
  pushLog(state, `Certification acquired: ${def.name}.`);
  // A second threshold can be crossed by one big kill; review again at once.
  checkPromotion(state);
}

function handlePlayerAction(state: GameState, rng: SimRNG, action: Action): void {
  const player = state.player;
  switch (action.type) {
    case "move": {
      const nx = player.x + action.dx;
      const ny = player.y + action.dy;
      // Invalid moves cost nothing — never charge AP for a typo.
      if (!isFloor(state.map, nx, ny)) {
        pushLog(state, "You bump into the wall.");
        return;
      }
      const blocker = entityAt(state, nx, ny);
      if (blocker && blocker.id !== player.id) {
        // Bump-to-melee: moving into an enemy is the knife attack.
        player.ap -= AP_COSTS.melee;
        meleeAttack(state, rng, player, blocker);
        return;
      }
      player.x = nx;
      player.y = ny;
      player.ap -= AP_COSTS.move;
      player.movedThisTurn = true; // forfeits the braced bonus until next refill
      return;
    }
    case "fire": {
      if (!player.weaponId) {
        pushLog(state, "You have no gun.");
        return;
      }
      const weapon = weaponDef(player.weaponId);
      if (player.ammoInMag <= 0) {
        pushLog(state, "Click. (R to reload)");
        return;
      }
      if (player.ap < apToFire(player, weapon)) {
        pushLog(state, "Not enough AP to fire.");
        return;
      }
      const target = pickTarget(state, action.targetId);
      if (!target) {
        pushLog(state, "No target in sight.");
        return;
      }
      if (distance(player, target) > maxRange(weapon)) {
        pushLog(state, `The ${target.name} is out of range.`);
        return;
      }
      fireWeapon(state, rng, player, target);
      return;
    }
    case "reload": {
      if (!player.weaponId) {
        pushLog(state, "Nothing to reload.");
        return;
      }
      const weapon = weaponDef(player.weaponId);
      // R means "make the gun ready". On a bolt gun with the bolt left open,
      // that is the cycle — not a reload — so the deferred cycle has a key.
      if (weapon.boltAction && player.chambered === false) {
        if (player.ap < AP_COSTS.cycle) {
          pushLog(state, "Not enough AP to work the bolt.");
          return;
        }
        player.ap -= AP_COSTS.cycle;
        delete player.chambered;
        pushLog(state, "You work the bolt.");
        return;
      }
      if (player.ammoInMag >= weapon.magSize) {
        pushLog(state, "Magazine already full.");
        return;
      }
      const reserve = state.ammo[weapon.caliber];
      if (reserve <= 0) {
        pushLog(state, `No ${weapon.caliber} rounds left.`);
        return;
      }
      const reloadCost = hasPerk(state, "time_management")
        ? Math.max(1, weapon.apReload - (perkDef("time_management").value ?? 1))
        : weapon.apReload;
      if (player.ap < reloadCost) {
        pushLog(state, "Not enough AP to reload.");
        return;
      }
      // En-bloc clips go in whole and come out whole: whatever was left in the
      // magazine is thrown away with the clip. Shoot it dry or pay for it.
      const wasted = weapon.reloadDiscards ? player.ammoInMag : 0;
      const room = weapon.magSize - (weapon.reloadDiscards ? 0 : player.ammoInMag);
      const take = Math.min(room, reserve);
      player.ap -= reloadCost;
      player.ammoInMag = weapon.reloadDiscards ? take : player.ammoInMag + take;
      state.ammo[weapon.caliber] -= take;
      delete player.chambered; // a fresh magazine closes the bolt
      pushLog(
        state,
        wasted > 0
          ? `You reload — ${wasted} rounds wasted. (${state.ammo[weapon.caliber]} ${weapon.caliber} left)`
          : `You reload. (${state.ammo[weapon.caliber]} ${weapon.caliber} left)`,
      );
      return;
    }
    case "swap": {
      const slots = player.slots;
      const active = player.activeSlot;
      if (!slots || active === undefined) return;
      if (action.slot === active) {
        pushLog(state, "Already in hand.");
        return;
      }
      const target = slots[action.slot];
      if (!target) {
        pushLog(state, "That slot is empty.");
        return;
      }
      if (player.ap < AP_COSTS.swap) {
        pushLog(state, "Not enough AP to swap.");
        return;
      }
      // Stowing a rifle does not close its bolt, so the flag rides in the slot.
      if (player.weaponId) {
        const stowed: WeaponSlot = { weaponId: player.weaponId, ammoInMag: player.ammoInMag };
        if (player.chambered === false) stowed.chambered = false;
        slots[active] = stowed;
      } else {
        slots[active] = null;
      }
      player.weaponId = target.weaponId;
      player.ammoInMag = target.ammoInMag;
      if (target.chambered === false) player.chambered = false;
      else delete player.chambered;
      player.activeSlot = action.slot;
      player.ap -= AP_COSTS.swap;
      pushLog(state, `You draw the ${weaponDef(target.weaponId).name}.`);
      return;
    }
    case "pickup": {
      // A vending machine shares its tile with whatever the fight left behind.
      // Real loot wins: a machine you can use any time must never mask a
      // magazine you cannot.
      const here = state.items.filter((i) => i.x === player.x && i.y === player.y);
      const item = here.find((i) => i.kind !== "vending") ?? here[0];
      if (!item) {
        pushLog(state, "Nothing here to pick up.");
        return;
      }
      if (player.ap < AP_COSTS.pickup) {
        pushLog(state, "Not enough AP to pick that up.");
        return;
      }
      if (item.kind === "ammo") {
        player.ap -= AP_COSTS.pickup;
        state.ammo[item.caliber] += item.amount;
        state.items = state.items.filter((i) => i.id !== item.id);
        pushLog(state, `You pocket ${item.amount} ${item.caliber} rounds.`);
        return;
      }
      if (item.kind === "plate") {
        const cap =
          SPARE_PLATE_CAP + (hasPerk(state, "deep_pockets") ? (perkDef("deep_pockets").value ?? 0) : 0);
        if (state.spareplates >= cap) {
          pushLog(state, "You cannot carry another plate.");
          return;
        }
        player.ap -= AP_COSTS.pickup;
        state.spareplates += 1;
        state.items = state.items.filter((i) => i.id !== item.id);
        pushLog(state, `You stow a plate. (${state.spareplates} spare)`);
        return;
      }
      if (item.kind === "carrier") {
        const worn = state.carrierId;
        // Only an upgrade is worth the AP — and refusing sideways swaps keeps
        // the dropped-carrier pickup loop from existing at all.
        if (worn && carrierCapacity(worn) >= carrierCapacity(item.carrierId)) {
          pushLog(state, `Your ${carrierDef(worn).name} is already better.`);
          return;
        }
        player.ap -= AP_COSTS.pickup;
        state.items = state.items.filter((i) => i.id !== item.id);
        if (worn) {
          state.items.push({ id: state.nextId++, x: player.x, y: player.y, kind: "carrier", carrierId: worn });
        }
        state.carrierId = item.carrierId;
        pushLog(state, `You strap on the ${carrierDef(item.carrierId).name}.`);
        return;
      }
      if (item.kind === "vending") {
        const price = priceWithPerks(PRICES.snack, hasPerk(state, "expense_account"));
        if (state.cash < price) {
          pushLog(state, `The machine wants ${price} credits. You have ${state.cash}.`);
          return;
        }
        const slot = hotbarSlotFor(state, "snack");
        if (slot === -1) {
          pushLog(state, "No room for another snack.");
          return;
        }
        player.ap -= AP_COSTS.pickup;
        state.cash -= price;
        const stack = state.hotbar[slot];
        if (stack) stack.count += 1;
        else state.hotbar[slot] = { itemId: "snack", count: 1 };
        // Machines never run out: the limit is cash, the carry cap, and the
        // walk back through a hostile floor.
        pushLog(state, `The machine clunks. (-${price} credits)`);
        return;
      }
      if (item.kind === "consumable") {
        const def = itemDef(item.itemId);
        const slot = hotbarSlotFor(state, item.itemId);
        if (slot === -1) {
          pushLog(state, `No room for the ${def.name}.`);
          return;
        }
        player.ap -= AP_COSTS.pickup;
        state.items = state.items.filter((i) => i.id !== item.id);
        const stack = state.hotbar[slot];
        if (stack) stack.count += 1;
        else state.hotbar[slot] = { itemId: item.itemId, count: 1 };
        pushLog(state, `You pick up the ${def.name}.`);
        return;
      }
      // Weapon: fill an empty slot; if all three are full, swap with the
      // gun in hand (which drops where you stand).
      const slots = player.slots;
      const active = player.activeSlot;
      if (!slots || active === undefined) return;
      player.ap -= AP_COSTS.pickup;
      state.items = state.items.filter((i) => i.id !== item.id);
      const empty = slots.findIndex((s, i) => s === null && i !== active);
      if (empty !== -1) {
        slots[empty] = { weaponId: item.weaponId, ammoInMag: item.ammoInMag };
        pushLog(state, `You stow the ${weaponDef(item.weaponId).name} (slot ${empty + 1}).`);
        return;
      }
      if (player.weaponId) {
        state.items.push({
          id: state.nextId++,
          x: player.x,
          y: player.y,
          kind: "weapon",
          weaponId: player.weaponId,
          ammoInMag: player.ammoInMag,
        });
        pushLog(state, `You drop the ${weaponDef(player.weaponId).name}.`);
      }
      player.weaponId = item.weaponId;
      player.ammoInMag = item.ammoInMag;
      slots[active] = { weaponId: item.weaponId, ammoInMag: item.ammoInMag };
      pushLog(state, `You take the ${weaponDef(item.weaponId).name}.`);
      return;
    }
    case "ascend": {
      if (player.x !== state.stairs.x || player.y !== state.stairs.y) {
        pushLog(state, "No stairs here.");
        return;
      }
      if (state.floor >= LAST_FLOOR) {
        state.phase = "won";
        pushLog(state, "The severance package is on the desk. You take what you are owed.");
        return;
      }
      // The stairwell landing: a safe breather with a merchant on it. The
      // next floor is not built until the player leaves.
      state.phase = "shopping";
      state.shop = rollShop(state, state.floor + 1);
      pushLog(state, "You duck into the stairwell. Someone has set up shop.");
      return;
    }
    case "plate": {
      if (!state.carrierId) {
        pushLog(state, "You have no plate carrier.");
        return;
      }
      const capacity = carrierCapacity(state.carrierId);
      if ((player.shield ?? 0) >= capacity) {
        pushLog(state, "Your carrier is full.");
        return;
      }
      if (state.spareplates <= 0) {
        pushLog(state, "No spare plates.");
        return;
      }
      const freePlate = hasPerk(state, "osha") && !state.platedThisTurn;
      const plateCost = freePlate ? 0 : AP_COSTS.plate;
      if (player.ap < plateCost) {
        pushLog(state, "Not enough AP to plate up.");
        return;
      }
      player.ap -= plateCost;
      state.platedThisTurn = true;
      state.spareplates -= 1;
      player.shield = Math.min(capacity, (player.shield ?? 0) + carrierDef(state.carrierId).plateValue);
      pushLog(state, `You slot a plate. (${player.shield}/${capacity})`);
      return;
    }
    case "useItem": {
      const stack = state.hotbar[action.slot];
      if (!stack) {
        pushLog(state, "That slot is empty.");
        return;
      }
      const def = itemDef(stack.itemId);
      if (player.ap < def.apUse) {
        pushLog(state, `Not enough AP to use the ${def.name}.`);
        return;
      }
      if (!applyItemEffect(state, def)) return; // refused, and refused for free
      player.ap -= def.apUse;
      stack.count -= 1;
      if (stack.count <= 0) state.hotbar[action.slot] = null;
      return;
    }
    case "throwItem": {
      const stack = state.hotbar[action.slot];
      if (!stack) {
        pushLog(state, "That slot is empty.");
        return;
      }
      const def = itemDef(stack.itemId);
      if (def.effect.kind !== "throw") {
        pushLog(state, `The ${def.name} is not for throwing.`);
        return;
      }
      const blast = def.effect;
      if (!isFloor(state.map, action.x, action.y)) {
        pushLog(state, "You cannot throw into a wall.");
        return;
      }
      if (distance(player, action) > blast.range) {
        pushLog(state, "That is out of throwing range.");
        return;
      }
      // LOS, not arcs: lobbing over walls would need trajectory rules this
      // game has not bought.
      if (!hasLos(state.map, player.x, player.y, action.x, action.y)) {
        pushLog(state, "You have no line to throw there.");
        return;
      }
      if (player.ap < def.apUse) {
        pushLog(state, `Not enough AP to throw the ${def.name}.`);
        return;
      }
      player.ap -= def.apUse;
      stack.count -= 1;
      if (stack.count <= 0) state.hotbar[action.slot] = null;
      pushLog(state, `You throw the ${def.name}.`);
      detonate(
        state,
        rng,
        action.x,
        action.y,
        {
          radius: blast.radius,
          ...(blast.damage !== undefined ? { damage: blast.damage } : {}),
          ...(blast.stun ? { stun: true } : {}),
          ...(blast.targets ? { targets: blast.targets } : {}),
          ...(blast.sparesPlayer ? { sparesPlayer: true } : {}),
        },
        player,
        "Blown up by",
      );
      return;
    }
    case "drop": {
      if (player.ap < AP_COSTS.drop) {
        pushLog(state, "Not enough AP to drop that.");
        return;
      }
      if (action.kind === "weapon") {
        const slots = player.slots;
        if (!slots) return;
        const isActive = player.activeSlot === action.slot;
        const held = isActive
          ? player.weaponId
            ? { weaponId: player.weaponId, ammoInMag: player.ammoInMag }
            : null
          : slots[action.slot];
        if (!held) {
          pushLog(state, "That slot is empty.");
          return;
        }
        player.ap -= AP_COSTS.drop;
        slots[action.slot] = null;
        if (isActive) {
          player.weaponId = null;
          player.ammoInMag = 0;
          delete player.chambered;
        }
        scatterItem(state, { kind: "weapon", weaponId: held.weaponId, ammoInMag: held.ammoInMag });
        pushLog(state, `You drop the ${weaponDef(held.weaponId).name}.`);
        return;
      }
      const stack = state.hotbar[action.slot];
      if (!stack) {
        pushLog(state, "That slot is empty.");
        return;
      }
      player.ap -= AP_COSTS.drop;
      stack.count -= 1;
      if (stack.count <= 0) state.hotbar[action.slot] = null;
      scatterItem(state, { kind: "consumable", itemId: stack.itemId });
      pushLog(state, `You drop the ${itemDef(stack.itemId).name}.`);
      return;
    }
    case "wait": {
      player.ap = 0;
      return;
    }
  }
}

/**
 * Stock for the landing above `floor`. Seeded from (seed, floor) like every
 * other piece of floor content, so a shared seed shows the same shelf.
 * Always at least one plate lot and one ammo lot; a weapon is the jackpot slot.
 */
function rollShop(state: GameState, floor: number): ShopState {
  const rng = createSimRng(hashSeed(state.seed, floor, SHOP_SALT));
  const def = floorDef(Math.min(floor, LAST_FLOOR));
  const entries: ShopEntry[] = [{ kind: "plate", price: PRICES.plate }];

  // Ammo biased toward what the player actually carries (§4.3's 60% rule).
  const carried = carriedCalibers(state.player);
  for (let i = 0; i < 2; i++) {
    const caliber: Caliber =
      carried.length > 0 && rng.next() < 0.6
        ? carried[Math.floor(rng.next() * carried.length)]!
        : CALIBERS[Math.floor(rng.next() * CALIBERS.length)]!;
    const amount = 8 + Math.floor(rng.next() * 9);
    entries.push({
      kind: "ammo",
      caliber,
      amount,
      price: Math.max(4, Math.round(amount * PRICES.ammo[caliber])),
    });
  }

  const pool = SHOP_CONSUMABLES[floor] ?? SHOP_CONSUMABLES[1]!;
  for (let i = 0; i < 2; i++) {
    const itemId = pool[Math.floor(rng.next() * pool.length)]!;
    entries.push({
      kind: "consumable",
      itemId,
      price: ITEM_PRICES[itemId] ?? 12,
    });
  }

  // The jackpot slot: a gun from the floor's pool, most of the time.
  if (rng.next() < 0.7 && def.lootWeapons.length > 0) {
    const weaponId = def.lootWeapons[Math.floor(rng.next() * def.lootWeapons.length)]!;
    const tier = weaponDef(weaponId).tier ?? 1;
    entries.push({ kind: "weapon", weaponId, price: PRICES.weapon[tier] ?? 50 });
  }
  if (def.carrier && rng.next() < 0.4) {
    entries.push({ kind: "carrier", carrierId: def.carrier, price: PRICES.carrier });
  }
  return { entries, sold: [] };
}

function handlePurchase(state: GameState, index: number, replaceSlot?: 0 | 1 | 2): void {
  const shop = state.shop;
  const entry = shop?.entries[index];
  if (!shop || !entry) return;
  if (shop.sold.includes(index)) {
    pushLog(state, "Already sold.");
    return;
  }
  const price = priceWithPerks(entry.price, hasPerk(state, "expense_account"));
  if (state.cash < price) {
    pushLog(state, `That costs ${price}. You have ${state.cash}.`);
    return;
  }
  // Delivery first: if it cannot be carried, nothing is charged.
  if (entry.kind === "ammo") {
    state.ammo[entry.caliber] += entry.amount;
  } else if (entry.kind === "plate") {
    const cap =
      SPARE_PLATE_CAP + (hasPerk(state, "deep_pockets") ? (perkDef("deep_pockets").value ?? 0) : 0);
    if (state.spareplates >= cap) {
      pushLog(state, "You cannot carry another plate.");
      return;
    }
    state.spareplates += 1;
  } else if (entry.kind === "consumable") {
    const slot = hotbarSlotFor(state, entry.itemId);
    if (slot === -1) {
      pushLog(state, `No room for the ${itemDef(entry.itemId).name}.`);
      return;
    }
    const stack = state.hotbar[slot];
    if (stack) stack.count += 1;
    else state.hotbar[slot] = { itemId: entry.itemId, count: 1 };
  } else if (entry.kind === "carrier") {
    if (state.carrierId && carrierCapacity(state.carrierId) >= carrierCapacity(entry.carrierId)) {
      pushLog(state, "You are already better equipped.");
      return;
    }
    state.carrierId = entry.carrierId;
  } else {
    const player = state.player;
    const slots = player.slots;
    if (!slots) return;
    const empty = slots.findIndex((s, i) => s === null && i !== player.activeSlot);
    // A free slot is always preferred; the trade-in only exists for a full rack.
    const target = empty !== -1 ? empty : replaceSlot;
    if (target === undefined || target < 0 || target >= slots.length) {
      pushLog(state, "Your slots are full — choose a gun to trade in.");
      return;
    }
    const fresh = { weaponId: entry.weaponId, ammoInMag: weaponDef(entry.weaponId).magSize };
    if (empty === -1) {
      // slots[activeSlot] is stale while a gun is in hand, so trading in the
      // ACTIVE slot has to move the mirrored pair too or the old gun survives.
      const discarded = target === player.activeSlot ? player.weaponId : slots[target]?.weaponId;
      if (discarded) pushLog(state, `You leave the ${weaponDef(discarded).name} on his counter.`);
      if (target === player.activeSlot) {
        player.weaponId = fresh.weaponId;
        player.ammoInMag = fresh.ammoInMag;
        delete player.chambered;
      }
    }
    slots[target] = fresh;
  }
  state.cash -= price;
  shop.sold.push(index);
  pushLog(state, `Bought. (-${price} credits, ${state.cash} left)`);
}

/** An existing stack of this type, else the first empty slot, else -1. */
function hotbarSlotFor(state: GameState, itemId: string): number {
  const cap = itemDef(itemId).stack;
  const existing = state.hotbar.findIndex((s) => s?.itemId === itemId && s.count < cap);
  if (existing !== -1) return existing;
  return state.hotbar.findIndex((s) => s === null);
}

/**
 * One item per tile is law — piles would mean pickup menus, and this game does
 * not have an inventory screen. Anything dropped onto an occupied tile walks
 * outward to the nearest free one.
 */
function scatterItem(state: GameState, item: GroundItemPayload): void {
  spawnItemNear(state, item, state.player.x, state.player.y);
}

/**
 * Returns false when the effect declines to happen (already at full HP, floor
 * already mapped), so the caller can honour the typo rule and charge nothing.
 */
function applyItemEffect(state: GameState, def: ItemDef): boolean {
  const player = state.player;
  switch (def.effect.kind) {
    case "heal": {
      if (player.hp >= player.maxHp) {
        pushLog(state, "You are not hurt.");
        return false;
      }
      const healed = Math.min(def.effect.amount, player.maxHp - player.hp);
      player.hp += healed;
      pushLog(state, `You use the ${def.name}. (+${healed} HP)`);
      return true;
    }
    case "healFull": {
      if (player.hp >= player.maxHp) {
        pushLog(state, "You are not hurt.");
        return false;
      }
      player.hp = player.maxHp;
      pushLog(state, `You work the ${def.name}. Patched up.`);
      return true;
    }
    case "stim": {
      player.ap += def.effect.bonus;
      player.pendingApDrain = Math.max(player.pendingApDrain ?? 0, def.effect.comedown);
      pushLog(state, `The stim bites. (+${def.effect.bonus} AP now, -${def.effect.comedown} next turn)`);
      return true;
    }
    case "reveal": {
      for (let i = 0; i < state.map.tiles.length; i++) {
        if (state.map.tiles[i] === 1) state.explored[i] = true;
      }
      pushLog(state, "You unfold the schematics. The floor plan resolves.");
      return true;
    }
    case "throw": {
      // Grenades are thrown at a tile, never "used" in place. The UI turns the
      // hotbar key into a targeting mode; reaching here means a stray action.
      pushLog(state, `The ${def.name} needs somewhere to go.`);
      return false;
    }
  }
}

/** Explicit target if given, else the nearest visible enemy with LOS. */
function pickTarget(state: GameState, targetId?: number): Entity | null {
  const { player, map } = state;
  const candidates = state.enemies.filter(
    (e) =>
      (targetId === undefined || e.id === targetId) &&
      !e.hidden &&
      state.visible[idx(map, e.x, e.y)] === true &&
      hasLos(map, player.x, player.y, e.x, e.y),
  );
  if (candidates.length === 0) return null;
  return candidates.reduce((a, b) => (distance(player, a) <= distance(player, b) ? a : b));
}

function refillAp(entity: {
  ap: number;
  maxAp: number;
  pendingApDrain?: number;
  movedThisTurn?: boolean;
}): void {
  entity.ap = Math.max(0, entity.maxAp - (entity.pendingApDrain ?? 0));
  delete entity.pendingApDrain;
  delete entity.movedThisTurn;
}
