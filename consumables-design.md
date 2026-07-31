# Consumables Design — Alpha

**Status: design draft, pre-implementation.** Third of the alpha design set, alongside
`arsenal-design.md` (weapons) and `progression-design.md` (health, plates, promotions,
cash). Same authority model: numbers are provisional, bot playtests and the balance test
are the referees, this beats the handoff where they disagree.

This document also **settles the promotion-heal question** the progression doc deferred
(§2 there): promotions keep the full heal. Rationale in §4 below.

---

## 1. Philosophy

### Steal DCSS's jobs, not its items

Strip the flavor off DCSS's potion/scroll/wand lists and they cover six jobs: emergency
healing, escape, information, crowd control, tempo, and charged utility. Every job has a
grounded corporate/near-future translation — nothing needs to stay magic, and one cheap
lore container (Meridian R&D, floors 5–6) holds anything genuinely weird as **prototype
inventory**: gear that isn't street-legal yet.

| DCSS job | archetype there | ours |
| --- | --- | --- |
| emergency heal | heal wounds | med shot / medkit |
| escape | blinking, fog | smoke, breaching charge *(deferred)* |
| information | magic mapping | building schematics |
| crowd control | paralysis, fear | flashbang, EMP |
| tempo | haste | adrenal stim |
| charged utility | wands | prototype gadgets *(deferred)* |

No identification minigame. DCSS's unidentified potions are a whole subgame; our items
are corporate products, and the joke is they're *over*-labeled ("MERIDIAN WELLNESS
INJECTABLE. DO NOT INJECT.").

### AP cost is the healing balance lever

A heal's power is not its HP number — it's *when you can afford to use it*. The healing
line is priced in turn-fractions: 1 AP heals are combat verbs, 2 AP heals are
between-fights verbs, the 3 AP heal is the whole-turn-helpless commitment (the LMG reload
trade wearing a red cross). Rarity runs opposite to AP cost: the cheaper it is to *use*,
the harder it is to *have*.

### One field per effect — no status framework

The taser set the precedent: it doesn't use a "status system," it uses one field
(`pendingApDrain`) checked at one site. Every consumable effect follows the same
one-touchpoint rule as perks: an effect is one plain-data field plus one check site, or it
doesn't get in. No buff bars, no duration manager, no effect stacking rules. This is the
whole answer to "how do we get the complexity right" — we don't build the machinery that
makes complexity possible.

### System-cost accounting

Items are batched by what they cost *us*, and later waves are gated behind demonstrated
demand, not completeness. Wave 1 needs zero new systems. Wave 2 buys exactly one (AoE) —
which the kamikaze FPV drone already wanted, so two designs split one bill. Wave 3 items
each need a real system and wait their turn.

---

## 2. Wave 1 — zero new systems

| Item | AP | Effect | Rarity/price (prov.) |
| --- | --- | --- | --- |
| Vending snack | 1 | +3 HP | 8cr — vending machines (unlimited stock); occasional desk/cache find; never an enemy drop |
| Bandage | 2 | +5 HP | common; 6cr, frequent drops |
| Med shot | 1 | +7 HP | uncommon; 15cr — *the* mid-fight button |
| Medkit | 3 | full heal | rare; 30cr, loot rooms + merchant jackpot slot |
| Adrenal stim | 1 | +2 AP at next refill; −1 AP at the one after | uncommon; 12cr |
| Building schematics | 1 | reveal floor layout (sets `explored`) | uncommon; 10cr |
| Armor plate | 1 | +shield (see progression doc) | 12cr |

Notes:

- The healing triangle is deliberate: snack/bandage cover within-floor attrition cheaply
  but cost tempo; the med shot is the only heal you can use and still fight; the medkit
  trades your entire turn — using it mid-combat is a positioning decision, not a menu
  click.
- **Snacks are a vending-machine economy, not a drop.** Machines never run out — the
  limit is cash, carry cap (5), and the walk back through a hostile floor to restock.
  That makes vending an explicit cash→HP conversion valve: income caps total healing,
  and the tempo cost is real. Elsewhere snacks appear only as occasional desk/drawer
  cache finds, never on bodies.
- The stim is berserk-with-a-comedown: one glorious 5-AP turn, one 2-AP hangover. Both
  halves ride the existing `pendingApDrain` refill machinery (a bonus is just a negative
  drain). One-shot and self-limiting, so it doesn't violate the no-AP-progression rule —
  that rule bans *permanent* AP, not purchased turns.
- Schematics reveal layout only — not items, not enemies. Knowing where the stairs are
  changes routing; knowing where everything is deletes exploration.

## 3. Wave 2 — buys the AoE system once

The system: tile-targeted radius effects. New action `{type: "throw", slot, x, y}`,
radius application in one helper, and the FPV drone's detonation reuses it from the enemy
side (self-targeted, so enemy AI needs no targeting code).

| Item | AP | Effect | Rarity/price (prov.) |
| --- | --- | --- | --- |
| Frag grenade | 1 | ~9 damage, radius 1 (3×3), everyone | uncommon; 15cr |
| Flashbang | 1 | **complete stun**, one turn, radius 1, *organics only*; no damage | uncommon-rare; 15cr |
| EMP grenade | 1 | ~12 damage + one-turn stun, radius 1, *machines only* | uncommon-rare; 18cr |

The taxonomy is the point: each grenade answers a different half of the mixed bestiary
(frag = everyone, flashbang = the humans and dogs, EMP = the robots), so a throwable
loadout is a bet on what you expect to fight.

Stun rules:

- "Complete stun" is `pendingApDrain` at full — the victim's next refill is 0 AP and its
  turn simply doesn't happen. Same field as the taser; the taser was the prototype.
- **One turn, never two.** An AoE full stun is the strongest crowd-control verb in the
  game (a stunned room is a free alpha-strike turn); duration is the line that holds.
- **The Dozer is flash-immune** (sealed chassis, sensor shrouds — the fiction agrees).
  Minibosses that can be stun-locked stop being minibosses. Regular elites stay
  vulnerable; that's what makes the item feel great. EMP works on the Dozer — that's
  half of why EMP exists.
- Flashbangs are **player-safe** in v1 ("you were trained for this during onboarding").
  Self-stun is one line of code and real comedy; revisit if testers want the skill
  expression.
- Machines-vs-organics needs a `machine: boolean` on EnemyDef — a bestiary-doc contract.

Throw range: ~5 tiles, requires LOS to the target tile (no lobbing over walls in v1 —
bounce/arc physics is a system we're not buying).

## 4. The healing economy, settled

**Promotions keep the full heal.** With this catalog the economy is coherent:

- **Between floors:** the promotion heal resets you roughly once per floor. Consumable
  healing does *not* need to solve full-run attrition.
- **Within a floor:** snacks/bandages patch between fights at tempo cost.
- **Within a fight:** the med shot (1 AP) and the medkit (your whole turn) are emergency
  gear — rare, priced, and dramatic.
- **On top:** plates absorb before HP ever moves, and melee ignores them — so the healing
  items matter most against exactly the enemies plates don't stop.

The fallback (promotion heals 50%) stays on the books if bot runs show healing income
trivializing the HP clock — the smoke test is total healing available per floor vs
expected damage intake; healing should cover roughly half of a fight-everything route,
never all of it. "Ammo is the soft clock" needs HP to be one too.

## 5. Wave 3 — each needs a real system (deferred, ranked)

1. **Claymore** — deployable trap entity; triggers when an enemy enters an adjacent
   tile; AoE damage via the wave-2 helper; then gone. Cheapest wave-3 item (one entity
   kind + one check in enemy movement) and the first to add. ⚠ Flagged tension: it's
   *pro-camping* — a doorway claymore buys a safe window in the game whose third pillar
   is melee pressure punishing exactly that. Acceptable because it's finite (like
   plates: consumables are allowed to sell safety in bounded units), but watch it.
2. **Smoke grenade** — temporary LOS-blocking cells with turn-based decay; touches
   `hasLos`, FOV, and enemy AI. The escape job's real answer, and the designed counter
   to the M82 marksman's lanes — build it the same milestone the marksman lands, not
   before.
3. **Breaching charge** — map mutation (wall → floor). Rewrites the hunt geometry;
   needs reachability/pathing care. The blink-scroll analog, arguably better in a tower.
4. **Prototype gadgets** — the wand category: charged reusables from R&D floors
   (2-charge cloak module, deployable sentry). Alpha ships at most zero of these;
   they're the sequel valve for the category.

Deliberately not covered from the DCSS lists: summoning (fiction-awkward, AI cost), fear
(needs flee behavior — a bestiary option later, not an item), immolation/torment-style
chaos (every one is a bespoke system). Noise we get for free — guns are loud and being
attacked alerts; a thrown-object distraction item is a cheap future stealth verb if the
VSS build wants company.

---

## 6. Carrying and UI

- **Hotbar: 4 slots**, keys 4–7 (1–3 are weapons). One item *type* per slot, stacking:
  snacks/bandages to 5, med shots/grenades to 3, medkit/claymore to 1. Caps are data
  (`data/items.ts`); the sidebar's planned consumable row renders count badges.
- Using is an action through `applyAction` (`{type: "useItem", slot}` or throw); invalid
  use (empty slot, full HP snack) costs 0 AP per the typo rule.
- Pickup with G like weapons; a full hotbar prompts a swap-drop, same as slots. Items on
  the ground are `GroundItem` entries — the type union grows `kind: "consumable"`.
- Drop sources: humans drop bandages occasionally (they have first-aid training), loot
  rooms carry the rare tier, merchants stock per the progression doc, vending tiles sell
  snacks (unlimited stock) and plates, and furniture caches (desks, drawers) hold snacks
  and small finds.

## 7. Balance-test & bot-run extensions

1. **Healing budget log** (bot runs): total healing obtainable per floor vs expected
   damage intake on a fight-everything route — target ratio ~0.5, alarm at ≥0.8. Count
   cash-convertible vending healing (income ÷ snack price × 3 HP) in the budget; the
   snack valve is bounded by cash, but only if cash income says so.
2. **Stun economy**: flashbang count available per floor stays ≤ ~2 without merchant
   focus; a full-clear bot that never takes a hit on floors 5+ is the smell.
3. **Item lint**: every consumable def's effect maps to a known one-touchpoint mechanism
   (heal / apDrain / reveal / aoeDamage); anything else fails the data test — the
   no-status-framework rule as an assertion.

## 8. Open questions (playtest-owned)

- Flashbang player-safety (v1 safe) — flip if testers want the risk.
- Claymore vs the camping pillar — finite-safety argument accepted provisionally.
- Stim numbers (+2/−1) — the comedown must sting enough that stims aren't every-fight
  fuel.
- Whether frag damage should scale by floor region or stay flat (~9 kills chaff forever,
  chunks elites early, tickles them late — flat may be *correct* as a chaff-clearer).
- Snack silliness calibration — the tone dial says deadpan corporate, not wacky; item
  names carry the satire, effects stay dry.
