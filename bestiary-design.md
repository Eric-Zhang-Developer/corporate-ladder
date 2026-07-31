# Bestiary Design — Alpha

**Status: design draft, pre-implementation.** Fourth and final doc of the alpha design set
(`arsenal-design.md`, `progression-design.md`, `consumables-design.md`). Numbers are
provisional; bot playtests and the balance test are the referees; this beats the handoff
where they conflict.

This doc pays the IOUs the other three wrote against it:

- **Enemy damage anchors** (contracted in progression §2): on-tier hits land ~3 (T1),
  ~4.5 (T2), ~6.5 (T3), ~8.5 (T4). Every stat line below honors the table.
- **`machine: boolean`** on EnemyDef — the EMP/flashbang targeting split, and more (§1).
- **Armor values** for the DR system the arsenal doc priced guns against.
- **Camera rework**: 2 alarm waves, then dark (progression §4).
- **Melee pressure stays 28–45% of spawn weight per floor** — the anti-camping pillar,
  already data-asserted in `floor.test.ts`.

---

## 1. Philosophy

### Every enemy is a counter to a habit

DCSS's bestiary is secretly a list of punishments for player habits (hydras punish
blade-swinging; oklobs punish impatience). Ours adopts that as the admission rule: a new
enemy must be nameable as "the counter to X," where X is something a player actually
does. Camping → melee rush. Spray reliance → armor. Sniping from darkness → the stealth
unit. Doorway kill zones → the FPV drone that trades itself. Open lanes → the turret and
the marksman. An enemy that doesn't counter a habit is a stat bag, and stat bags don't
get in.

### Trash and elites, on every floor

No floor is all robots or all humans. Each floor pairs **trashy machines** with
**increasingly serious humans**, and the quality gap tells the story: the machines are
cheap because they're products; the humans get scarier because the ones who survived
automation are the genuinely dangerous ones. The tilt still climbs — floor 6 (DATA
CENTER) is the one deliberate exception, **zero humans**, which should feel eerie after
five floors of people yelling spot lines.

The trash half is load-bearing for the arsenal: chaff stays soft all game (1–2 pistol
hits), which is what keeps the pistol contract honest on floor 7.

### Machines vs organics

`machine: true` means: EMP hurts it, flashbangs don't, it drops no cash (capital
expenditure — humans are the ones getting paid), it never flinches or flees (no morale,
ever — which future flee/fear design must respect), and blades bypass its armor (gaps in
the chassis). Machines are also the tone valve: they speak in product-manual politeness
while hurting you. Humans scream; machines apologize.

### Drops: ammo and cash only — biometric locks

No enemy drops its weapon, ever. Company-issue guns are DRM'd to their contract-holder
(**biometric trigger locks** — of course this firm bills per bullet), which is also why
the guns you *can* use are pawnshop junk, loot-room stock, and the merchant's off-book
inventory. Armed humans drop caliber-matched ammo; humans drop cash; machines drop
nothing. The shotgun guard's legacy 30% Serbu drop is deleted when this lands. Weapon
acquisition lives in loot rooms and shops — item luck becomes a storyline, DCSS-style.

### Behavior budget

Invariant 3 discipline: ~15 new enemies ride on **five** new behavior functions —
`detonate`, `stealthApproach`, `overwatch` (turret and marksman share it), `spinup`
(Dozer and Warden share it), `duelist` (CEO only) — plus flags on existing behaviors
(supervisor = `cameraAlarm` on legs; prototype = `meleeRush` + an erratic-step flag;
handler = `meleeRush` + pack flag). If an enemy concept needs a sixth function, it
replaces one of these on merit or waits.

### Bosses are guaranteed

One miniboss per floor pair — Janitor → K9 Handler → Server Warden → Dozer — then the
CEO. Guaranteed, not DCSS-variance uniques: every run gets the same skeleton of landmark
fights, which alpha playtests need for comparability. Spawn-variance named uniques are a
good post-alpha layer *on top*, where variance is bonus rather than a missing boss.

---

## 2. Floor identity (spawn-table skeleton)

| Floor | Name | Texture |
| --- | --- | --- |
| 1 | LOBBY | human security + custodial trash; the tutorial economy |
| 2 | OFFICES | same cast, denser; Janitor boss on 1 or 2 |
| 3 | HUMAN RESOURCES | first machines-with-teeth; supervisors; riot guard debuts |
| 4 | SECURITY | the armory floor — most guns-per-square-tile; Handler boss on 3 or 4 |
| 5 | R&D | prototypes, stealth unit debut, lab chaos; weirdness budget lives here |
| 6 | DATA CENTER | **zero humans** — turrets, drones, K9s, server hum; Warden boss on 5 or 6 |
| 7 | CONTRACTS | the professionals: exo troopers, fixers, marksmen; Dozer on 7 or 8 |
| 8 | EXECUTIVE | protection detail gauntlet → the CEO |

Bosses spawn on either floor of their pair (seeded) — small placement variance without
threatening the guaranteed-skeleton rule.

---

## 3. Tier 1 — floors 1–2 (on-tier hit ~3)

### Rent-a-Cop *(implemented)*
`HP 6 · AP 2 · glock_cop (~2/hit) · sight 8 · pursueAndShoot · XP 5 · human`
The control group, unchanged. Everything in the bestiary is measured against the guy who
shouts "Hey! You can't be up here!" and misses a third of his shots. He teaches the
game's core loop — spot, close, trade, punish his reload — at a price of ~2 damage per
mistake, and dies in one or two hits from anything. His mag-cycle punish window is the
single most important tutorial in the game and no redesign may touch it. Drops small
ammo and pocket cash: he's salaried, poorly.

### Baton Guard *(new)*
`HP 5 · AP 3 · melee 3 · sight 8 · meleeRush · XP 5 · human`
The plain melee statistic — the body that backfills the Janitor's departure from the
regular pool. Never got firearm certification, carries a collapsible baton and a
grievance, moves at 3 AP so he genuinely pressures a repositioning player. His job is
contrast: next to him, the taser guard reads clearly as "the *scary* melee human" and
the dog as "the *fast* one." No gimmick, and that's the design — every tier needs one
melee enemy whose entire identity is "closing, now," so the exotic ones have a baseline
to be exotic against. Deadpan spot line; he's not angry, he's hourly.

### Guard Dog *(implemented)*
`HP 4 · AP 3 · bite 3 · sight 9 · meleeRush · XP 5 · organic`
The tempo check. Fastest spotter in T1, reaches a stationary player in two or three
turns, and dies to one revolver round — a fight about *when*, never *whether*. The dog
exists to interrupt plans: mid-reload, mid-loot, mid-kite, here is a thing that closes
faster than your plan finishes. Flashbangs work on it (eyes), EMP doesn't (dog),
which quietly teaches the organics/machines grenade split with the game's most
sympathetic victim. No cash, no ammo — it's a dog.

### Taser Guard *(implemented)*
`HP 6 · AP 2 · prod 1 + AP drain 2 · sight 8 · meleeRush · XP 6 · human`
The scariest effect in T1 attached to the weakest damage — deliberately inverted
priorities that teach threat-reading. One damage is nothing; losing 2 AP at next refill
is a stolen turn, which against a shotgun guard's approach can be a stolen *life*. He
made the flashbang possible (his `pendingApDrain` field is the whole stun system) and
remains its living tutorial. Kill-priority puzzles on mixed spawns start here: the
correct target order in a taser+shotgun room is the answer to the vertical slice's
kill-question, still true six floors later.

### Shotgun Guard *(implemented)*
`HP 7 · AP 2 · serbu_guard (~4/hit close) · sight 8 · pursueAndShoot @2 · XP 7 · human`
The range-band lesson with legs: he advances until his cliff-shaped gun works, so the
player learns "never let it close" from the receiving end before ever owning a shotgun.
Tankiest regular in T1 by design — he's slow pressure, a wall that walks, and the punish
window (2-AP reload after three shells) is generous enough to teach but real enough to
matter. Loses his legacy weapon drop under the biometric-lock rule; keeps dropping
shells. Turned into a memo by.

### Custodial Unit *(new — the Roomba)*
`HP 2 · AP 2 · bump 1 · sight 6 · meleeRush · XP 2 · machine`
The tutorial robot. A hostile floor-cleaning disc that nudges your ankles for 1 damage
and dies to a knife — and in doing so teaches every machine rule at zero stakes: it
doesn't flinch, it doesn't flee, it drops nothing, the flashbang does nothing to it,
and the EMP deletes it (wasteful, hilarious, allowed). It is also the pistol contract's
first client: chaff that stays 1–2 pistol hits forever. Spot line is a chirpy
"Cleaning in progress." — the first machine politeness, five floors before the
politeness gets frightening. Comedy now, calibration later.

### Security Camera *(implemented — reworked)*
`HP 1 · AP 0 · alarm: 2-turn countdown → 2 cops at entrance · **max 2 waves, then dark** · XP 3 · machine`
The stealth-and-routing pressure. Unchanged in role — LOS starts a visible countdown,
expiry ships a response team from the floor entrance — but now the response budget is
finite: after two waves the camera goes dark (inactive glyph) and stops mattering,
which kills XP-farming and loot-farming with one counter field. The response team bills
hourly. Still dies to any hit; killing it before expiry still cancels the wave; the
4-cop live cap still limits bursts. On floors 5+ the *alarm response* upgrades (drones,
not cops) — same machinery, scarier cavalry.

---

## 4. Tier 2 — floors 3–4 (on-tier hit ~4.5)

### Security Contractor *(new)*
`HP 10 · AP 2 · mp5_sec (~4.5/burst) · sight 8 · pursueAndShoot @4 · XP 8 · human`
The rent-a-cop's replacement when the company starts paying real money: same behavior,
professional numbers. He exists because every tier needs its baseline gun-line body, and
because the player's mental model ("cops shoot twice, then reload") must be gently
broken — the contractor's 30-round MP5 variant cycles far less often, so the punish
windows the player learned to farm get scarcer exactly when the player got comfortable.
That's the tier's thesis taught by its most ordinary member: the tower doesn't get
different at T2, it gets *better at its job*. Drops pistol-channel ammo and a
middle-class wallet.

### Riot Guard *(new)*
`HP 12 · armor 2 · AP 2 · melee 5 (shield bash) · sight 7 · meleeRush · XP 10 · human`
The armor system's teaching moment, rebuilt from the handoff's rejected
directional-immunity design into honest math: flat DR 2 per pellet. The Uzi does
*nothing* to him; the revolver does 3s; the Deagle does 5s; the knife and bayonet
ignore the plate entirely — so the correct answers are a hard-hitting caliber or the
nerve to charge him, and the wrong answer is the spray weapon the player probably
loves by floor 3. Slow advance, wants to pin you in a corner and bash. Deliberately
over the 1–3-hit guardrail *with the wrong tool* — he's the exception that teaches
the rule. Drops nothing but cash; his kit is bolted on.

### K9 Unit *(new)*
`HP 9 · armor 1 · AP 3 · bite 5 · sight 9 · meleeRush · XP 9 · machine`
The guard dog's product-line successor: same lunge tempo, new math. Armor 1 quietly
taxes every pellet — the Uzi's four 2s become four 1s — so the player who answered
"dog" with "spray" for two floors watches the answer stop working and learns to read
the `machine` tag as "check your caliber." EMP stuns it; the flashbang it simply
ignores, which in one moment converts grenade choice from flavor to doctrine. It
doesn't flinch when shot (machines never do), so wounding it buys nothing — kill it
or reposition. The bark is a speaker playing a bark; somehow that's worse.

### FPV Drone *(new)*
`HP 1 · AP 4 · detonate: 8 dmg on adjacency (AoE r1) · sight 10 · detonate · XP 3 · machine`
The doorway-kill-zone punisher and the reason the AoE system pays for itself twice.
Fast, fragile, single-minded: it closes at 4 AP and trades itself for ~8 damage to
everything adjacent — including its own side, which clever players will engineer. It
cannot be ignored (8 is two bandages and a plate) and it dies to literally anything,
so its real cost is *attention and one round* — an ammo-and-AP tax that arrives on a
timer. The counter to fighting from a fortified doorway is a thing that doesn't care
about doorways. Spot line is a rising motor whine in the log; by floor 5 players will
flinch at the sound. Drops nothing; it *is* the drop.

### Supervisor *(new)*
`HP 8 · AP 2 · unarmed · sight 9 · cameraAlarm (mobile, 1 wave) · XP 8 · human`
A human security camera with a lanyard and a walkie-talkie: when alerted, he starts
the same visible countdown, and if he finishes it, a response wave ships from the
entrance. He carries no weapon — his threat is *procedure*. Suddenly a mixed room has
a clock in it: kill the supervisor first (he's soft) or fight the room *and* the
cavalry. He converts kill-order from optimization to necessity, which is the
vertical-slice kill-question escalated to policy. One wave only, then he cowers —
he's middle management, not a hero. Satire payload: his spot line is him reporting
you as a "workplace incident." Drops a decent wallet; management is compensated.

---

## 5. Tier 3 — floors 5–6 (on-tier hit ~6.5)

### Merc Rifleman *(new)*
`HP 14 · AP 2 · m4_merc (~6.5/burst) · sight 9 · pursueAndShoot @5 · XP 11 · human`
T3's gun-line baseline, and the first enemy who *repositions* — he prefers 5 tiles,
and when the player closes he backs off while firing, which breaks the two-floor-old
habit of "walk at shooters, they stand still." Burst weapon on the enemy side means
his damage arrives lumpy: fine turns, then an 11. His mag cycles slowly but his
discipline is worse than his gear — he reloads early when unthreatened, which sharp
players can bait. The lesson of the whole tier lives in him: from here up, the humans
have training, and geometry beats bravery. Drops rifle-channel ammo, which the
player's own M4 is now starving for — his corpse is a supply line.

### Heavy Gunner *(new)*
`HP 16 · AP 2 · m249_gunner (~6.5/burst, brutal in-lane) · sight 9 · pursueAndShoot @6, prefers braced · XP 12 · human`
The player's LMG rules, pointed backwards — murderous when set up in a lane, helpless
for the full turn of his 3-AP reload. He advances reluctantly, plants, and converts
a corridor into a no; the counter is the counter to all lane threats: don't be in the
lane, or be in his face when the belt runs dry. He is the punish-window mechanic
grown into a character, and the loudest single argument for the player's own smoke
grenades when those land. Fighting him fair is a mistake; fighting him during the
reload is a ritual. Drops a generous pile of rifle ammo — the belt is the loot.

### Stealth Unit *(new)*
`HP 10 · AP 3 · melee 7 · sight 10 · stealthApproach: invisible until within 2 tiles · XP 12 · machine`
The counter to sniping from darkness. Active-camo chassis: it does not appear in FOV
until it's 2 tiles away — the log gives one turn of warning ("Something shimmers.")
and then it's adjacent, hitting for 7, and your Mosin is a paperweight. Fragile once
seen (10 HP, armor 0 — the camo *is* the armor budget), so the fight is entirely
about the reveal moment: sidearm swap, bayonet, or the flashbang you kept— no. It's
a machine. The EMP you kept. In a turn-based game, one tile of surprise is worth
more than any stat, and this enemy is that sentence with servos. Floor 5–6 only;
its existence retroactively justifies every paranoid corner-check.

### Sentry Turret *(new)*
`HP 12 · armor 2 · AP 2 · turret gun (~7/hit, high accuracy) · sight 10 · overwatch: no movement, fires down LOS · XP 10 · machine`
The lane made literal: a fixed emplacement with brutal accuracy and no legs. It
teaches the marksman's lesson two floors early at survivable prices — cross its
sightline and pay, or read the room and never enter the lane at all. Flanking is a
full solution (it can't turn the corner after you), blades ignore its armor at
arm's length (charming: you can knife a turret), and the EMP shuts it up. Because
it never moves, it's the one enemy that makes *map knowledge* the whole fight —
schematics consumables quietly appreciate in value on turret floors. Data center
standard issue; the DATA CENTER's zero-human eeriness is mostly turret hum.

### Malfunctioning Prototype *(new)*
`HP 15 · AP 3 · melee 7 · sight 8 · meleeRush + erratic step · XP 11 · machine`
R&D's contribution to the org chart: a bipedal something that failed QA and roams
floors 5–6 hitting very hard on an approach path no one can predict — its pathing
takes a seeded random step roughly one turn in three, which breaks kiting rhythms
that work on every other melee enemy (you cannot count its approach, so you cannot
cut it that fine). The habit it counters is *optimization itself*: players who've
turned melee-kiting into arithmetic meet the one enemy whose arithmetic is broken.
Hits like T3 (7), soaks like a janitor, drops nothing, and its spot line is a
corrupted product-manual greeting with the customer-service warmth garbled into
menace. The weirdness budget, spent exactly where the lore said it lives.

---

## 6. Tier 4 — floors 7–8 (on-tier hit ~8.5)

### Exo Trooper *(new)*
`HP 20 · armor 2 · AP 3 · xm7_exo (~8.5/hit) · sight 9 · pursueAndShoot @5 · XP 14 · human`
The human/machine blur and the tier's thesis body: a Meridian contractor in a
powered frame carrying the company flagship. 3 AP on a *ranged* enemy is the real
escalation — he shoots twice and still repositions, the first gun-line body that
plays at the player's tempo. Armor 2 on a human (the frame, not plates — no shield
bar) makes the FAL/XM7 target-choice math personal. He's what the tower was
building toward: procurement's answer to you. His XM7 dies with him (biometric
locks — taking one from the *loot room* on 7 is the rhyme). Drops heavy ammo and
an executive-grade wallet. Spot line is calm, on-comms, procedural — the scariest
tone in the building until the CEO's.

### Fixer *(new)*
`HP 12 · AP 3 · suppressed pistol (~8/hit, high accuracy) · sight 10 · pursueAndShoot, repositions every turn · XP 13 · human`
The glass cannon and the player's dark mirror before the CEO provides the true one:
low HP, immaculate accuracy, a suppressed pistol that hits like a rifle, and he
*never stands still* — every turn he takes his shot and relocates, so the player's
"turn 2: shoot where they were" habit whiffs. His suppressor means his shots don't
alert the room (the VSS rule, enemy-side): on floor 7 you can start losing HP
before you know the fight began. Fragile by every measure — two good hits end him —
but finding him is the fight. Counters the habit of treating spotted-status as
symmetric. Drops pistol ammo, a very good wallet, and no gun (his is locked, and
he'd be insulted by your trigger discipline anyway).

### M82 Marksman *(new)*
`HP 14 · AP 2 · m82 (~14/hit) · sight 12 · overwatch: holds position, telegraphed lane shot · XP 13 · human`
The tower's answer to the AWP fantasy, aimed down at you. He does not pursue: he
sets up on a long sightline, and his threat is the *lane* — a full-turn telegraph
(glinting scope, log line), then anything ending its turn in the line takes ~14,
which strips plates whole and two-shots the unlucky. Open corridors on floors 7–8
become terrain hazards; the map starts reading like a route puzzle, which is the
sentry turret's lesson at lethal prices. Counters: never end turns in glint lanes,
flank wide, or (when smoke lands) blind him — he shares `overwatch` with the
turret, so the counter-vocabulary transfers. Repositions only when flanked. The
player's own AWP is taking *his* argument to *his* colleagues.

### Protection Detail *(new)*
`HP 18 · AP 2 · spas_detail (~8.5/hit close) · sight 8 · pursueAndShoot @2 · XP 13 · human`
The shotgun guard, seven floors later: same "never let it close" pattern at
executive prices, because floor 8's approach gauntlet should rhyme with floor 1
and let the player *feel* the distance traveled. SPAS-armed, disciplined, and
deployed in pairs flanking chokepoints outside the CEO's suite — the last exam on
crossfire geometry before the final. Nothing novel, deliberately: the game's last
regular enemy should test everything and teach nothing. Suits, not armor plates
(armor 0 — flesh and salary); the vulnerability is the statement. Drops shells
and the best regular-wallet in the game. Spot line: quiet, apologetic, final —
"Sir, I'm going to have to stop you here."

---

## 7. Minibosses — one per floor pair, guaranteed

### The Janitor — floors 1–2 (the joke boss)
`HP 26 · AP 2 · wrench 6 · sight 7 · meleeRush · XP 25 · human · boss`
Promoted out of the regular pool entirely — his appearance is now an event. The
joke *is* the fight: he's slow, unarmored, immune to nothing, and simply does not
stop. ~Three focused turns of T1 damage to drop, during which he closes, sighing,
wrench up, at 2 AP — perfectly kiteable by anyone calm, lethal to anyone greedy
(6 damage is two-plus mistakes against a 10–13 HP player). No phases, no
mechanics: a wall of seniority, thirty years of this. The Employee of the Month
plaque in the lobby foreshadows him. Drops a real chunk of cash and his personal
medkit — the man was OSHA-certified. Spot line: he puts down the mop first.
Death screen: "Mopped up by the Janitor." The tone calibration test for the
whole game: deadpan plaque, lethal wrench.

### The K9 Handler — floors 3–4
`HP 18 · AP 2 · machine pistol (~4.5/hit) · sight 9 · pursueAndShoot + pack: two K9 Units · XP 25 · human · boss`
The pack-leader steal from DCSS's gnoll logic: he's ordinary, his *context* isn't.
Arrives with two K9 units; while he lives, the dogs coordinate (both commit
simultaneously — his flag suppresses their stagger); kill him first and they
revert to ordinary K9s you can fight one at a time — but he stands behind them,
so reaching him means eating the charge. Kill-order as boss mechanic, taught by
the tier that introduced kill-order. Armor-1 dogs plus a soft handler makes the
loadout question sharp: pierce for the dogs or reach for the man. Drops cash,
plates, and pistol ammo. His whistle is the fight's start bell; the dogs' speaker
-bark answering is the pack flag made audible.

### The Server Warden — floors 5–6
`HP 30 · armor 3 · AP 2 · slam 8 · sight 8 · spinup: 2-turn charge → floor-wide alarm pulse · XP 25 · machine · boss`
The data center's landlord: a prototype heavy chassis that guards the zero-human
floor and fights like infrastructure. Armor 3 walls out spray entirely (the P90
alone among SMGs still scratches); blades bypass; EMP is the graduation exam —
it staggers him (one-turn stun) where nothing else does. His mechanic reuses
`spinup`: a 2-turn telegraphed charge that, uninterrupted, pulses a floor-wide
alarm (every dormant machine on the floor wakes). The fight is therefore about
*interruption* — stun, burst, or geometry — not attrition. Slow (moves 1),
inevitable-feeling, server-hum soundtrack. Drops nothing but the silence
afterward, plus the loot room he was standing in front of. Politeness level:
maximum. "Thank you for your patience."

### The Dozer — floors 7–8
`HP 40 · armor 4 · AP 2 · minigun (spin-up: 1 telegraph turn → ~6×3 burst) · sight 9 · spinup · XP 30 · machine · boss`
The miniboss as geometry exam. Spin-up gives one full turn of warning (glyph
change, rising whine); the burst that follows kills unplated players in the open
— so the fight is corners, never cover-less courage. Breaking LOS resets the
spin; he lumbers (moves 1) and re-acquires; armor 4 means only heavy calibers,
the AWP, EMPs, and blades-at-terrifying-range do honest work, and the FAL —
T3's monster — bounces. Flash-immune (sealed sensors — minibosses that can be
stun-locked stop being minibosses); EMP stuns him once, and he adapts (immune
thereafter — one panic button per customer). The minigun dies with him,
enemy-only forever. Drops the floor's biggest cash pile and two plates.
Payday's Dozer, our physics: scary because of *where you're standing*.

---

## 8. The final boss — the CEO

`HP 35 · armor 0 · shield 15 (plates ×3) + 3 spares · AP 3 · engraved pistol (~9/hit, never misses in band ≤5) · sight 10 · duelist · human · final`

After seven floors of machines and augmented professionals, the last door opens on
one unaugmented man in a very good suit, and he is the scariest thing in the
building because he is the only enemy who plays **your game**:

- **Full player ruleset.** 3 AP spent like a player spends them: shoot-move,
  move-move-shoot, reload behind cover. One behavior function (`duelist`), zero new
  systems — his arsenal is the player's own systems list.
- **He plates up.** Mid-fight, 1 AP, blue bar refills while you watch — the plate
  system taught by mirror, and the first time the player sees their signature
  mechanic from the wrong side. Three spares; strip them faster than he slots them.
- **He punishes reloads.** The duelist reads your mag state — empty chamber means he
  advances and takes the free shot. Every punish window the player has farmed for
  eight floors, farmed back. He knows your file.
- **He pops a stim when first dropped below half** — one glorious 5-AP turn, then
  the comedown, which is the fight's built-in crescendo and mercy: survive the stim
  turn and his hangover turn is yours.
- **Armor 0, full damage from everything.** After a tower of subtraction math, the
  final fight takes your numbers at face value. The vulnerability is the statement:
  he doesn't need armor. He needs to be better than you, and for two or three
  turns, he is.

Fought in the executive suite: open center (his preference — he wants band ≤5),
cover at the edges (yours). Kill him, and the severance package is on the desk.
Win screen. No orb run — the descent belongs to the sequel, in the note next to
the rewind mechanic.

His spot line is the game's title drop, delivered as a performance review. His
death line is one sentence, dry, and we will spend an entire evening on it.

---

## 9. Spawn-weight guidance (for `data/floors.ts`)

- Melee behaviors (`meleeRush`, `detonate`, `stealthApproach`) hold **28–45%** of
  total weight per floor — the existing data assertion extends to the new keys.
- Chaff (`XP ≤ 3`: Roomba, FPV, camera) holds 15–25% everywhere — the pistol
  contract's supply line.
- Each tier's gun-line baseline (cop → contractor → rifleman → exo) is the
  plurality armed spawn of its pair — the measuring stick stays visible.
- Debut enemies front-load in their tier's *first* floor (riot guard on 3,
  stealth unit on 5) so each pair opens with its lesson; second floors of pairs
  mix the full deck.
- Floor 6: `human: 0` — enforced in data, eeriness by assertion.
- Bosses are placed by `applyFloor` from the pair's seeded hash, one per pair,
  never in the entrance room.

## 10. Test extensions

1. **Anchor test:** every enemy's expected on-tier hit (weapon or melee) within
   ±20% of its tier anchor (3 / 4.5 / 6.5 / 8.5); every regular's HP dies in 1–3
   on-tier player hits *with an appropriate-class weapon* (riot guard & armor
   exceptions annotated in-data with `armorException: true` or similar).
2. **Machine-flag lint:** `machine: true` ⇔ no cash drops, flash-immune,
   EMP-vulnerable — one data assertion.
3. **Behavior-budget lint:** the `BEHAVIORS` registry holds ≤ 8 keys; a ninth
   fails the test until something is consolidated (the invariant-3 tripwire).
4. **Bot playtests:** full-tower runs must show: camera waves exhaust; supervisor
   kill-priority measurably changes room outcomes; Dozer kills bots that
   fight in the open and not bots that corner-peek; CEO duel lasts 4–8 turns
   against a competent bot.

## 11. Open questions (playtest-owned)

- Stealth unit reveal distance (2 tiles vs 3) — 2 is scarier, 3 is fairer; playtest.
- Prototype erratic-step frequency (1-in-3 feels right on paper).
- Exo trooper: armor 2 vs 3 — decided by whether FAL users feel punished or locked out.
- Dozer EMP: one-stun-then-immune vs full immunity — the panic-button economy.
- CEO stim: once vs twice per fight; duel length target 4–8 turns.
- Whether the Janitor deserves a health bar UI element (bosses generally: probably
  yes, sidebar target card suffices for v1).
