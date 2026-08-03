# Progression Design — Alpha

**Status: design draft, pre-implementation.** Companion to `arsenal-design.md` (weapons,
tiers, ammo channels) — this document covers the player's growth: health scaling, the
plate system, promotions (XP + perks), and cash. Same authority model: numbers are
starting points, `test/sim/balance.test.ts` and bot playtests are the referees, and where
this conflicts with `tower-design-handoff.md`, this wins.

**This document consciously reverses one handoff cut:** §5 cut the merchant; alpha
reinstates it as a stairwell-landing shop plus vending-machine tiles (rationale in §6
below). Everything else stays cut — no meta-progression, no chrono anything.

---

## 1. Philosophy

### The invariant is hits, not numbers

The §8 guardrail — *player dies in 3–5 unanswered hits, most enemies die in 1–3* — is a
statement about **ratios**, and it survives scaling. Player HP and enemy damage inflate
together across the tower so that time-to-kill in *hits* stays constant on-tier: floor 1
and floor 7 feel equally deadly, the numbers underneath are just bigger. "Make both sides
more lethal, not tankier" governs relative tankiness (hits-to-kill drift), not absolute
values. Flat player HP was never actually an option once weapons tiered at +35% per step —
a floor-7 rifle hit against floor-1 HP breaks the death guardrail arithmetic on its own.

### Three currencies, three textures

- **XP** → permanent growth (promotions: small HP + a perk choice). Rewards engaging.
- **Plates** → the tactical buffer (a renewable blue bar over a slow red one). Rewards
  preparation.
- **Cash** → liquidity (spend at merchants/vending on plates, ammo, consumables). Rewards
  thoroughness.

Each currency answers a different player question — "what am I becoming," "how do I
survive this room," "what can I afford" — and none can substitute for another.

### The no-multipliers rule

Player progression must never multiply the combat formula. Damage-per-AP-at-band is the
game's balance currency; a stacking +X% damage or accuracy stat debases it until guns stop
being patterns. Every perk below is **flat, discrete, and bounded** — a new option or a
constant, never a percentage on damage or accuracy. Corollary: **no progression ever
grants max AP.** +1 AP in a 3-AP economy is a 33% action inflation that beats any other
reward; the moment it's on a menu, the menu has one item.

### Theming: the corporate ladder

Levels are **promotions**. XP is performance. Perks are certifications and benefits. The
one person climbing the company's advancement structure is doing it with a shotgun, and
the level-up screen is a performance review. The repo was named for this; lean in.

---

## 2. Health scaling

Anchors (from current data): starting HP **10**; on-tier enemy hits land ~3 at T1 (cop
Glock 2, dog 3, janitor 4). Enemy per-hit damage anchors by tier — the bestiary doc must
hold these:

| Enemy tier | on-tier hit | player HP at par level | hits to die (unplated) |
| --- | --- | --- | --- |
| T1 (fl 1–2) | ~3 | 10–13 | 3.3–4.3 |
| T2 (fl 3–4) | ~4.5 | 16–19 | 3.6–4.2 |
| T3 (fl 5–6) | ~6.5 | 22–25 | 3.4–3.8 |
| T4 (fl 7–8) | ~8.5 | 28–34 | 3.3–4.0 |

Mechanism: **+3 max HP per promotion**, with level ≈ floor pacing (§4). That lands the
whole table inside the 3–5 guardrail with no other machinery. The "Corporate Wellness"
perk (+6) is the opt-in for players who want to tank; everyone else's HP curve is
automatic and small, because plates are the real defensive system.

**Promotions fully heal.** The genre's best pressure-release valve (Rogue Fable does
this), it paces to roughly one reset per floor, and it quietly does half the healing
economy's job — consumable healing then only has to cover *within-floor* attrition.
⚠ **Hesitation, flagged honestly:** this is the loosest number in the document. A full
heal per floor may crowd out the consumable healing economy entirely (why buy snacks?).
If the consumables doc or playtests show that, the fallback is heal-to-50%-of-max on
promotion — decided there, not here.

---

## 3. The plate system

The signature defensive mechanic. Warzone's armor model, translated into AP:

### Rules

1. Plates fill a **shield pool** — a blue bar that absorbs damage before HP. One
   subtraction in `dealDamage`, state is a plain number.
2. **Inserting a plate costs 1 AP.** Re-plating mid-fight competes with shooting and
   moving, exactly like reloading. This is what makes the system turn-based rather than
   borrowed.
3. **Melee and blades bypass plates entirely** — symmetric with the player's knife/bayonet
   bypassing enemy armor. Blades find gaps. A fully-plated player is confident against
   gunfire and still afraid of the dog, the taser guard, and the Cloaker unit — the plate
   system *reinforces* melee pressure as the anti-camping pillar instead of eroding it.
   This rule is load-bearing; if plates ever feel too safe, cut plate values, never this.
4. Shield does not regenerate. Plates are consumable items — found on armored enemies,
   bought at merchants. "Armor is ammo for your health bar."

### Carriers and plates

Carriers are the *permanent* progression (found gear, like weapons); plates are the
*consumable* economy. Realism (NIJ protection levels) lives on the carriers:

| Carrier | found | slots | per-plate value | full stack | ≈ extra hits when full |
| --- | --- | --- | --- | --- | --- |
| none | start | 0 | — | 0 | 0 |
| Level II carrier | ~floor 2–3 | 2 | 4 | 8 | +1.8 @ T2 |
| Level III carrier | ~floor 4–5 | 3 | 5 | 15 | +2.3 @ T3 |
| Level IV carrier | ~floor 6–7 | 3 | 6 | 18 | +2.1 @ T4 |

Fully plated at floor 7 ≈ 46 effective HP ≈ 5.4 on-tier hits — deliberately *at* the
guardrail ceiling, because reaching it costs AP, cash, and drops, and melee ignores all of
it.

⚠ **Simplification, flagged:** plates are **one fungible item type**; the carrier
determines each plate's value. No per-slot plate-quality tracking, no mixed-plate
bookkeeping — `shield: number`, `spareplates: number`, done. The Warzone segmented-bar UI
reads the same. If plate-quality-as-loot turns out to be wanted (finding ceramic IVs as a
drop moment), it's an additive change later; starting there is state complexity the sim
shouldn't pay yet.

Spare plate carry cap: **3** (a "Deep Pockets" perk raises it). Uncapped spares turn
floor-1 thoroughness into floor-7 invincibility.

Non-interactions (v1, deliberate): carriers grant no flat DR (shield pool only — enemy
armor is DR, player armor is shields; the asymmetry keeps both readable). `armorPierce`
does not interact with shields. Both are open design space if plates need texture later
(an M82 that shreds plates is flavorful — and cuttable until proven needed).

---

## 4. Promotions (XP and perks)

### XP

- Every enemy def gets a flat `xp` value. Kills grant it — including stealth kills
  (the VSS build must not starve). No other sources in v1.
- Provisional values by role: chaff (Roomba, camera, FPV) 2–3 · standard (cop, dog,
  taser) 5–7 · elite (hitman, riot guard, exo) 10–14 · miniboss (Dozer) 25.
- Thresholds tuned so that clearing ~⅔ of a floor earns one promotion → **level ≈ floor**
  for a normal-violence run, one ahead for completionists, one behind for stair-sprinters.
  Provisional: promotion N costs `12 + 8·(N−1)` XP (a curve to tune from bot-run logs,
  nothing sacred).
- **Farming, resolved at the source:** cameras spawn at most **2 waves**, then go dark
  (inactive glyph, no further alarms — the response team bills hourly and the budget is
  exhausted). Finite waves kill XP farming and loot farming with one counter field,
  where loot-gating alone would have left XP farming alive. The 4-cop live cap stays as
  the burst limiter within those waves.

### Promotion grant

**+3 max HP, full heal, and a choice of 1 from 2 perks.** The pair is drawn seeded from
the pool below (draw derives from `hash(seed, level)`; the *choice* is a sim action —
`{type: "choosePerk", perkId}` — so replays and the golden test stay deterministic; the
game pauses in a `"promoting"` phase until the choice resolves, like death/won phases).

### Perk rules

1. **One-touchpoint rule** (invariant 3 applied to perks): a perk must be implementable as
   one conditional at one site in the sim. A perk needing systems code across multiple
   files is two perks or zero perks.
2. Flat, discrete, bounded. No percentages on damage or accuracy. Never AP capacity.
3. Perks are data entries (`data/perks.ts`): id, name, blurb, and a flag the sim checks.

### Perk pool (v1 — ~14 entries, corporate-certification named)

| Perk | Effect | Touchpoint |
| --- | --- | --- |
| Corporate Wellness | +6 max HP now | apply on choose |
| Severance Bonus | +4 damage on your first hit vs an unalerted target | dealDamage |
| Letter Opener | knife/bayonet +2 damage | meleeAttack |
| IT Certification | +2 flat damage vs machines | dealDamage |
| Time Management | reloads cost 1 less AP (min 1) | reload handler |
| OSHA Compliance | first plate inserted each turn costs 0 AP | plate handler |
| Ergonomic Workspace | braced bonus applies to every gun, not just LMGs | fireWeapon |
| Follow-Up Meeting | pellet volleys reroll one missed pellet | fireWeapon |
| Asset Recovery | ammo drops +50% (round up) | rollDrops |
| Expense Account | merchant & vending prices −25% | shop pricing |
| Deep Pockets | spare-plate cap +2 | pickup handler |
| Field Awareness | +1 sight range | FOV radius |
| Overtime | +1 AP on the first turn of each fight (first turn after being spotted) | refillAp |
| Golden Parachute | once per run: a killing blow leaves you at 1 HP instead | dealDamage |

⚠ **Hesitations, flagged:** (a) perk power variance is wide — Golden Parachute and +1
sight range are not peers; the pool needs rarity weights or curation passes once real
runs exist, and shipping v1 with the 8 safest is fine. (b) "Overtime" flirts with the
no-AP rule — it's bounded (one turn, on-spot) but it's the first perk to cut if AP
inflation shows anywhere. (c) 1-of-2 (not 1-of-3) keeps choices fast and the pool from
exhausting over ~9 promotions; if choices feel samey, widen to 3 before adding perks.

---

## 5. Cash

- **Sources:** human enemies drop cash (they're salaried); machines drop nothing (they're
  capital expenditure — the satire is free). Provisional: standard humans 5–10, elites
  15–25, found caches (registers, desks, safes) 10–40. Chaff robots pay you in nothing.
- **Sinks:** merchants and vending machines. Cash has no other use — no XP conversion, no
  door tolls (v1).
- Currency name/flavor: Meridian company scrip ("credits"). The company store, but you're
  shopping with a gun.

## 6. The merchant (handoff cut, reversed)

Why reverse: cash needs a sink from day one or it's a dead currency; plates need a
purchase point to be a dependable economy rather than pure drop-RNG; and a shop is a
*menu*, not a system — the expensive parts of "merchant" (AI, in-map presence, combat edge
cases) are exactly the parts this design skips.

- **Stairwell landing shop:** between floors, on the landing — a safe breather with no
  enemies possible. 4–6 items, seeded from `hash(seed, floor)` like all floor content.
  Stock rules: always ≥1 plate lot, always ≥1 ammo lot (biased toward calibers the player's
  slots use, same 60% bias as drops), a consumable, occasionally a weapon one tier up —
  the jackpot slot. No sell-back in v1 (inventory UX cost, exploit surface).
- **Vending machine tiles:** in-map impulse buys — bump, pay fixed price, receive fixed
  item (snack or a plate). No UI at all. Also a satisfying thing to shoot (drops its item;
  alerts the floor — the classic roguelike vending-machine-crime tradeoff), if we want one
  free bit of texture.
- Provisional prices: plate 12 · snack 8 · ammo lot 10–20 by channel · shop weapon 40–60.
  Meaningful at 5–10-per-kill income; tune from bot-run cash-flow logs.
- Flavor: the merchant is a fellow *contractor* — the one person in the tower who doesn't
  care about the lockdown, because his invoice is net-30 either way.

---

## 7. Sim architecture notes

- New `GameState`/player fields, all plain serializable data: `xp`, `level`, `shield`,
  `carrierId` (or null), `spareplates`, `cash`, `perks: string[]` (chosen ids),
  `phase: "promoting"` added to the union.
- Perk choice, plate insertion, and purchases are **actions** through `applyAction` —
  never UI-side mutations. Invalid ones (no spare plate, can't afford, full shield) cost
  0 AP per the typo rule.
- Perk draw pairs derive from `hash(seed, level)` — like floor content, never from sim
  history, so a shared seed shows identical offers.
- New data tables: `data/perks.ts`, `data/carriers.ts`, shop stock rules in
  `data/floors.ts` per-floor entries.

## 8. Balance-test extensions

1. **Guardrail table test:** for each tier, on-tier enemy hit vs par-level HP lands in
   3–5 hits unplated; fully-plated stays ≤ ~5.5.
2. **Perk lint:** every perk id in the pool has a def; no perk def contains a multiplier
   field (the no-multipliers rule as a greppable/data assertion).
3. **Economy smoke test (bot runs, not unit tests):** log cash income vs shop prices and
   heavy-channel ammo starvation across seeds; a full-clear bot should afford 60–80% of
   what it wants, never everything.

## 9. Open questions (playtest-owned)

- Full heal vs 50% heal on promotion — decided by the consumables doc + playtests (§2).
- 1-of-2 vs 1-of-3 perk offers; rarity weights on the pool.
- Does shooting a vending machine stay in (fun crime) or invite degenerate
  loot-everything play?
- Camera wave count (2 vs 3) — tune once the alarm rework lands.
- Whether plate-quality-as-loot (mixed plate types) ever earns its state complexity.
