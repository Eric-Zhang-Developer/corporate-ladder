# Arsenal Design — Alpha

**Status: design draft, pre-implementation.** Numbers are starting points, not commitments —
`test/sim/balance.test.ts` and bot playtests are the referees, and every stat here is subject
to change the moment either disagrees. Where this document conflicts with
`tower-design-handoff.md` §4.2–§4.3, this document wins; it was argued from playtests and
design merits, which outrank the handoff.

Companion decisions from the same brainstorm (bestiary: mixed trashy-robot/elite-human
floors, armor as flat DR, Dozer/marksman minibosses, the man-in-a-suit CEO) will get their
own document. This one is the guns.

---

## 1. Design philosophy

### Guns are patterns, not numbers

The handoff's one rule worth engraving: two weapons in the same tier must never differ only
in magnitude. Every gun below is defined by its *shape* — band profile, AP rhythm, pellet
count, reload posture, one gimmick at most — and the tier system exists only so that shapes
can be compared fairly. If a new gun's pitch is "like X but more damage," it doesn't get in.

### Tier architecture

Five tiers: **T0** (the starter Glock) and **T1–T4**, one tier per floor pair (T1 ≈ floors
1–2 … T4 ≈ floors 7–8), with each tier's loot bleeding one floor upward so runs overlap.
The fiction tracks the economy: T1 is pawnshop junk, T2 is duty gear, T3 is Meridian field
issue, T4 is the next-gen procurement program the company bought before the Army did.

Balance currency is **expected damage per AP at the intended band** (`dmgPerAp`). Targets:

| Tier | dmg/AP target | window (±20%) |
| --- | --- | --- |
| T0 | ~2.6 | — (single gun) |
| T1 | ~3.5 | 2.8 – 4.2 |
| T2 | ~4.7 | 3.8 – 5.6 |
| T3 | ~6.4 | 5.1 – 7.7 |
| T4 | ~8.6 | 6.9 – 10.3 |

The ~+35% step per tier means T4 output is ≈ 3.3× the starter — enemies scale to match
through lethality and armor, never through HP sponging (§8: *make both sides more lethal,
not tankier*).

Two sanctioned exceptions to the window:

- **Shotguns run ~+20% hot** at their intended band. Their band is 1–2 tiles; the cliff is
  the payment. (Precedent: Serbu at 4.2 in a 3.5 tier.)
- **Pistols are exempt from the tier curve entirely** — see the pistol contract.

### The pistol contract

Pistols cap at T2 and never compete with the tier curve. Their permanent relevance is
structural, not statistical:

1. **Chaff stays soft all game.** Roombas, FPV drones, cameras — the trash half of every
   floor's bestiary dies in 1–2 pistol hits on floor 8, same as floor 1. The correct play
   forever: pistol the trash, save rifle rounds for the elites.
2. **Pistol ammo is the most common drop in the game**, on every floor. The sidearm is the
   gun that never starves.
3. Balance test assertions: every pistol ≥ lethal-in-2 vs chaff HP; every pistol's dmg/AP
   strictly below same-floor rifle-class weapons vs elite HP+armor.

### Four ammo channels

The three calibers become four (a rename plus one split — reserves, drops, and loot tables
migrate):

| Channel | Old name | Feeds | Feel |
| --- | --- | --- | --- |
| `pistol` | small | all pistols, all SMGs | plentiful everywhere |
| `shell` | medium | all shotguns | chunky, room-scale |
| `rifle` | — (new) | ARs, SKS/AKM line, LMGs | the mid/late workhorse |
| `heavy` | large | snipers, battle rifles/DMRs, Deagle | scarce, hits like a truck |

Channels are economy valves, not realism. The deliberate tensions: **heavy feeds the most
mouths** (Mosin → Garand → FAL → SR-25/XM7 → AWP, *plus* the Deagle), so owning two heavy
guns is a real bet; **LMGs eat the rifle channel** so a belt-fed run starves your AR.

### Armor is the second axis

The bestiary doc introduces flat damage reduction (`armor` on EnemyDef): subtract armor
from **each pellet** of each hit. No special cases needed — subtraction already makes spray
weapons shred flesh and fold against plate, while single big hits punch through. Bands
differentiate guns by *distance*; armor differentiates them by *target*. Late-game weapon
choice is a two-axis question, and the 1-AP swap cost finally matters mid-fight.

`armorPierce` (T3+ only, rare) subtracts from target armor before the DR math. The knife
and the SKS bayonet bypass armor entirely — blades find the gaps, which turns armored
enemies into the one class you'd rather charge than shoot.

### AP rhythm is identity

At 3 AP per turn, `apFire`/`apReload` define a gun's verbs-per-turn budget. The roster
deliberately spans the rhythm space: 1-AP spammers (Glock, AR-15), commit-reloaders
(revolver, FAL at 2 AP), the bolt guns' fire/cycle split, and the LMGs' 3-AP full-turn
helpless reload — the enemy punish-window mechanic imported to the player's side.

---

## 2. New mechanics (all data-first)

Each is one optional data field plus at most one touch in the sim, per invariant 3.

- **`armor` / `armorPierce`** — flat DR per pellet; pierce subtracts from armor. One
  subtraction in `dealDamage`. Blades bypass.
- **`boltAction: true`** — fire costs `apFire`, then the chamber is empty. Firing
  unchambered auto-cycles first (+1 AP). `R` with a full mag cycles manually for 1 AP.
  Amortized cost is unchanged (2 AP/shot) but you may *defer* the cycle: shoot, move twice,
  regret it later. Needs a `chambered` flag in slot state.
- **`bayonet: n`** — while equipped, bump-melee uses this damage instead of the knife and
  keeps the blade armor-bypass.
- **`reloadDiscards: true`** — Garand en-bloc: reloading throws away whatever's left in the
  clip. Log line warns ("3 rounds wasted"). Shoot it dry or pay.
- **`bracedBonus: n`** — LMGs: added to accuracy if the shooter spent no AP on movement
  this turn. One boolean tracked per turn. The cheap version of a bipod; full
  deploy/undeploy states only if playtests demand them.
- **`silentKills: true`** — VSS: a hit that *kills* does not alert anyone; a hit that
  wounds still does. Previews the Stage-3 suppressor attachment with zero new systems.

---

## 3. The arsenal

28 player weapons. Stat lines are provisional; `~n.n` is dmg/AP at the intended band
(bolt guns amortized over fire + cycle).

### Matrix

| Class | T1 pawnshop | T2 duty gear | T3 field issue | T4 next-gen |
| --- | --- | --- | --- | --- |
| **Pistol** (T0: Glock 19) | Revolver · Tec-9 | Deagle · Five-seveN · 93R | — | — |
| **SMG** | Micro Uzi | MP5 | UMP-45 | P90 |
| **Shotgun** | Serbu | 870 pump | SPAS-12 | AA-12 |
| **Rifle** | Mini-14 | AR-15 | M4 · AKM | AN-94 |
| **DMR / BR** | SKS | M1 Garand | FN FAL | XM7 · SR-25 |
| **Sniper** | Mosin | Rem 700 | VSS | AWP |
| **LMG** | — | — | M249 | XM250 |

Empty cells are choices: pistols cap at T2 by contract; pawnshops don't stock belt-feds
(the LMG class first *existing* at T3 is itself a progression beat); the T3 sniper slot
going to the weird one (VSS) instead of a bigger bolt gun keeps the Rem 700 → AWP jump
steep.

### Pistols — the guns that never starve

**Glock 19 — T0 starter** *(implemented)*
`1 AP fire / 1 reload · dmg 3 · acc .95 · mag 7 · pistol · bands 1/1.0 → 4/0.9 → 8/0.55 · ~2.6`
The control group. Highest base accuracy in the game, no band it truly loves, no gimmick,
eats the commonest ammo. Its job is to make every other gun legible by contrast: when you
pick up a revolver you *feel* the chunk; when you pick up an Uzi you *feel* the spray. At
~80% of T1 output it exits your active slots around floor 3 without ever being humiliated —
and the pistol contract means it re-enters on floor 7 when a Roomba isn't worth a rifle
round. The gun equivalent of sensible shoes.

**.38 Revolver — T1** *(implemented)*
`1 AP fire / 2 reload · dmg 5 · acc .80 · mag 6 · pistol · bands 1/1.0 → 4/0.85 → 7/0.45 · ~3.4`
The chunk pistol. Five damage per squeeze means floor-1 chaff dies *now*, and the whole gun
is downstream of one number: the 2-AP reload. Six shots is two-and-a-bit fights, so the
decision "do I reload here, or knife the last cop" is the revolver teaching the game's real
subject — AP budgeting — earlier and cheaper than any tutorial could. Feel: deliberate,
old, certain. The gun your character probably owned before the layoffs.

**Tec-9 — T1**
`1 AP fire / 1 reload · dmg 3 ×2 pellets · acc .60 · mag 32 · pistol · bands 1/0.9 → 3/0.85 → 5/0.35 · ~3.1`
The machine pistol that lies about being an SMG. Two sloppy pellets per pull off a 32-round
mag: it sprays *almost* like an Uzi and hits *almost* like a Glock, and "almost" is its
whole personality. Cheap, loud, ammo-hungry, slightly embarrassing — the gun you use
enthusiastically until you find the real thing, and the one Meridian's floor-1 contractors
carry because procurement hasn't reached the lobby. Deliberately the worst-feeling trigger
in the game that's still worth pulling.

**Desert Eagle — T2**
`1 AP fire / 1 reload · dmg 7 · acc .72 · mag 7 · heavy · bands 1/1.0 → 3/0.9 → 5/0.4 · ~4.5`
The armor puncher you wear, not carry. Seven damage per hit shrugs off flat DR that zeroes
whole SMG bursts, so the Deagle's late-game job is executing robot K9s and cracked riot
guards without waking your rifle's ammo pool — except its ammo pool is *worse*: every
round comes out of the same scarce heavy channel as your sniper. Carrying a Deagle next to
an AWP is a standing bet that you'll need the hand cannon more than the fifth long-range
round. Short bands, big flash, no apologies.

**Five-seveN — T2**
`1 AP fire / 1 reload · dmg 4 · acc .85 · pierce 2 · mag 20 · pistol · bands 1/1.0 → 4/0.9 → 6/0.5 · ~3.1`
The scalpel. Modest paper damage — worse than a revolver against meat — but `pierce 2`
means machines take it at face value while every other pistol bounces. It's the anti-robot
sidearm: twenty quiet rounds of pistol-channel ammo that treat a K9 chassis like a janitor.
The design bet is that a gun can be *situationally* first-rate and *generally* third-rate
and still earn a slot; if players never swap to it, the pierce number goes up before the
damage does. Feel: clinical, light, slightly smug.

**Beretta 93R — T2**
`1 AP fire / 1 reload · dmg 2 ×3 pellets · acc .68 · mag 21 · pistol · bands 1/0.95 → 3/0.85 → 5/0.35 · ~3.5`
Three-round burst from a pistol frame — the Tec-9's idea executed by someone with a
machining budget (and the platform RoboCop's Auto-9 was built on, which is exactly the
corporate-dystopia energy this game runs on). Tighter than the Tec-9, longer-legged, still
falls off a cliff past 3 tiles. The last word in the pistol class: after the 93R there are
no better pistols, only different ones, and that's the point — the class *completes*
instead of inflating.

### SMGs — volume as a lifestyle

**Micro Uzi — T1** *(implemented)*
`1 AP fire / 1 reload · dmg 2 ×4 pellets · acc .50 · mag 20 · pistol · bands 1/0.9 → 3/0.85 → 6/0.4 · ~3.4`
The feast-or-famine gun and the roster's historical dominance risk (§10). Four independent
2-damage rolls: sometimes a cop evaporates, sometimes you fan the air, and the mag is empty
either way — five pulls and you're reloading. Its guards are structural: per-pellet
accuracy collapse past 3 tiles, dmg/AP parity with the revolver, and now armor, which taxes
each tiny pellet separately and quietly retires the Uzi against anything plated. If it
dominates anyway: cut pellet damage, raise pellet count. Keep the spray *feel*.

**MP5 — T2**
`1 AP fire / 1 reload · dmg 2 ×3 pellets · acc .85 · mag 30 · pistol · bands 1/0.95 → 4/0.9 → 7/0.4 · ~4.6`
The professional's spray. Three pellets at real accuracy instead of four at a coin flip:
fewer spikes, fewer whiffs, a band that reaches 4 tiles, and a 30-round mag that makes
reload timing a choice instead of a metronome. This is the gun that teaches what "duty
gear" means in this economy — not more power, more *reliability*. If the Uzi is a slot
machine, the MP5 is a salary. Still folds against armor; that's the class's tax, paid so
the UMP has a reason to exist.

**UMP-45 — T3**
`1 AP fire / 1 reload · dmg 4 ×2 pellets · acc .85 · mag 25 · pistol · bands 1/0.95 → 4/0.9 → 6/0.45 · ~6.1`
The armor-aware SMG. Two fat pellets instead of four thin ones means flat DR taxes it half
as often — the only spray gun that still does honest work on a robot K9 without pierce.
Slower-feeling, thuddier, less lottery: where the MP5 hoses, the UMP punches twice. It
exists because the armor system would otherwise silently delete the whole SMG class on
floors 5+, and the fix should be a *gun with a different shape*, not an exception in the
damage code. The .45 of it all is just flavor gravy.

**P90 — T4**
`1 AP fire / 1 reload · dmg 2 ×5 pellets · acc .88 · pierce 1 · mag 50 · pistol · bands 1/0.95 → 4/0.9 → 7/0.5 · ~7.9 (+pierce)`
The spray weapon that refuses to die of armor. Five accurate pellets, each with `pierce 1`,
off a 50-round toploader: the Uzi's fantasy fulfilled by a defense contractor. Against
flesh it's a monsoon; against plate it's the only hose that still cuts. Its nominal dmg/AP
sits under the T4 target and the pierce makes up the difference against exactly the enemies
T4 is about — that asymmetry is deliberate and the balance test needs an armored-target
column to see it. Feel: sci-fi adjacent, eager, faintly illegal.

### Shotguns — the cliff family

**Serbu Shorty — T1** *(implemented)*
`1 AP fire / 2 reload · dmg 6 · acc .70 · mag 3 · shell · bands 1/1.0 → 2/0.9×0.9 → 3/0.5×0.35 · ~4.2 hot`
The thesis gun for the whole class: devastating at arm's length, a paperweight past it. 4.2
dmg/AP at adjacency — hottest thing in T1 — bought with a band so short you must *build*
your fights around doorways and corners to collect it. Three shells and a 2-AP reload mean
every trigger pull is a third of your wallet. The shotgun class never abandons this shape;
it just extends the ledge before the drop. Feel: a legal technicality with a trigger.

**Remington 870 — T2**
`1 AP fire / 2 reload · dmg 8 · acc .70 · mag 5 · shell · bands 1/1.0 → 3/0.85×0.8 → 4/0.4×0.35 · ~5.6 hot`
The Serbu's pattern with room to breathe: the cliff moves from 2 tiles to 3, the tube holds
five, and 8 damage per shell deletes most of the mid-game bestiary in one or two. The pump
gun is the *reliable* cliff — no gimmick, no trick, just the knowledge that anything inside
your band is already dead and anything outside it might as well be on another floor.
Candidate future mechanic: per-shell tube loading (top up 1 AP at a time, fire anytime) as
the class gimmick — deferred until the reload UI can carry it.

**SPAS-12 — T3**
`1 AP fire / 2 reload · dmg 10 · acc .75 · mag 8 · shell · bands 1/1.0 → 3/0.9×0.85 → 4/0.5×0.4 · ~7.5 hot`
The room-clearer. Semi-auto — no pump rhythm — so with 3 AP you can put *three* shells into
a doorway in one turn, which is the highest burst damage in the game until T4 and feels
like an event every time. Eight in the tube makes it the first shotgun that can fight a
whole room without touching the reload button, and the movie-icon silhouette does the
"field issue" storytelling by itself. The tax is unchanged: past 4 tiles you are holding an
expensive club.

**AA-12 — T4**
`1 AP fire / 2 reload · dmg 6 ×2 shells · acc .80 · mag 20 · shell · bands 1/1.0 → 3/0.9×0.85 → 4/0.5×0.4 · ~9.6 hot`
Two shells per trigger pull off a 20-round drum: the cliff turned into a wall of meat. The
deepest ammo furnace in the roster — one greedy turn is six shells — balanced by shell
scarcity on floors 7–8 and by armor taxing each shell separately, which keeps it honest
against exactly the Dozers it most wants to delete. This is the gun for the player whose
answer to the final floors is "I will stand in the doorway and become weather." The drum
reload staying at 2 AP is a mercy; raise it to 3 if playtests say the weather is too cheap.

### Rifles — the workhorse channel

**Mini-14 — T1**
`1 AP fire / 1 reload · dmg 4 · acc .92 · mag 10 · rifle · bands 1/0.6 → 6/0.95 → 8/0.6 · ~3.5`
The ranch rifle: the marksman's starter and the cleanest gun in T1. One honest 5.56 round
at real accuracy out to 6 tiles — the first weapon whose band rewards *standing still and
aiming* rather than closing or spraying. Its adjacency penalty teaches rifle discipline
(something wants that tile — move) two floors before an AKM makes the lesson expensive.
Deliberately gimmick-free: it exists so the AR-15 feels like the same gun growing up, and
so the SKS next to it on the pawnshop shelf reads as a *temperament choice*, not a stat
line.

**SKS — T1**
`1 AP fire / 2 reload · dmg 6 · acc .65 · mag 10 · rifle · bayonet 4 · bands 1/0.8 → 5/0.9 → 7/0.5 · ~3.5`
The brawler's starter. Hits half again as hard as the Mini-14 per round, sloppy accuracy,
and the folding bayonet — while it's equipped, bump-melee does 4 armor-bypassing damage
instead of the knife's 2. Every other rifle panics when the dog closes; the SKS shrugs and
stabs. Same tier, same ammo, same 1-AP pattern as the Mini-14, opposite soul: the loot-room
choice between them is the game's first real *build* decision. The peasant's
do-everything gun, and on 7.62×39 it's also the AKM's ancestor — the rifle channel's
origin story.

**AR-15 — T2**
`1 AP fire / 1 reload · dmg 5 · acc .90 · mag 20 · rifle · bands 1/0.7 → 6/0.95 → 8/0.65 · ~4.3`
The generalist. No gimmick, no cliff, no burst: its identity is *having no bad band except
adjacent*, and its 20-round mag makes it the first gun you can take through two fights
without arithmetic. This is the run's spine weapon — the pickup that marks "the game has
started in earnest" — and the reference point the T2 window is tuned around. If any T2 gun
outclasses the AR-15 *everywhere*, that gun is wrong. Feel: neutral in the way a good tool
is neutral.

**M4 — T3**
`1 AP fire / 1 reload · dmg 3 ×3 pellets · acc .78 · mag 30 · rifle · bands 1/0.9 → 5/0.9 → 8/0.45 · ~6.3`
The mid-game bully and the roster's biggest ammo furnace. Three rifle-grade pellets per
pull: the AR-15's precision traded for volume, which is what "field issue" means when the
issuer expects you to miss under stress. Burst reliability against flesh, triple-taxed by
armor — the M4 wants soft targets and gets fewer of them every floor it climbs, which is
the intended pressure toward the AKM, the FAL, or discipline. Watch it in the balance test;
burst guns are where dominance historically hides.

**AKM — T3**
`1 AP fire / 1 reload · dmg 9 · acc .78 · mag 30 · rifle · bands 2/0.95 → 5/0.85 → 7/0.4 · ~6.0`
The M4's foil: one heavy slap instead of three taps, and a *generous close band* — full
performance out to 2 tiles, where every other rifle sweats. The AKM is the rifle that
doesn't panic when a Cloaker-type closes: it fights in the hallway, in the doorway, in your
face, and its single fat round treats armor with disrespect the M4 can't afford. The cost
is reach — past 5 tiles it's a noise machine. Feel: agricultural, dependable, loud in a way
that seems structural.

**AN-94 — T4**
`1 AP fire / 1 reload · dmg 5 ×2 pellets · acc .90 · mag 30 · rifle · bands 1/0.85 → 6/0.95 → 8/0.6 · ~8.6`
The hyperburst. The real AN-94's party trick — the second round leaves the barrel before
recoil arrives — translates directly into data: two pellets at *full* per-pellet accuracy,
no burst penalty. Every other multi-hit gun in the game pays the spray tax; the AN-94 is
the one that doesn't, which makes it T4's rifle statement: not a bigger gun, a gun that
breaks a rule the player has internalized for six floors. Double-tap reliability, real
range, moderate armor exposure (two pellets, taxed twice). Feel: Soviet over-engineering as
a luxury good.

### DMRs / Battle rifles — the heavy channel's workhorses

**M1 Garand — T2**
`1 AP fire / 1 reload · dmg 6 · acc .85 · mag 8 en-bloc · heavy · bands 2/0.7 → 7/0.95 → 9/0.7 · ~4.8`
The DMR archetype with a built-in dilemma: eight stout rounds, semi-auto, real reach — and
`reloadDiscards`. The en-bloc clip goes in whole and comes out whole, so topping up throws
away whatever's left, and the game's scarcest economy watches you do it. Shoot it dry
(*ping* — one free log line of pure flavor) or waste heavy rounds: a micro-decision every
fight, unique in the roster. Grandpa's rifle in a near-future tower is also exactly the
kind of thing a pawnshop-tier economy coughs up on floor 3. Feel: wood, brass, judgment.

**FN FAL — T3**
`1 AP fire / 2 reload · dmg 9 · acc .82 · mag 20 · heavy · bands 2/0.75 → 7/0.9 → 9/0.6 · ~6.6`
The right arm of the free world, cast as the anti-flesh specialist: the hardest-hitting
1-AP trigger in T3, twenty rounds deep, accurate to 7 tiles — and **zero pierce**. Against
elite humans it is the correct answer to almost every question; against a Dozer chassis
it's a very loud way to ask for help. The FAL exists to make the XM7 mean something: same
silhouette-class, opposite armor politics. Its 2-AP reload on the heavy channel is the
commit moment — twenty rounds is a long time, and the twenty-first is a decision.
Feel: colonial-surplus confidence.

**XM7 — T4**
`1 AP fire / 2 reload · dmg 10 · acc .85 · pierce 2 · mag 20 · heavy · bands 2/0.8 → 7/0.9 → 9/0.6 · ~7.7 (+pierce)`
Meridian's flagship, and the lore is the mechanic: the real XM7 exists because the Army
demanded a rifle that defeats body armor, so ours carries `pierce 2` and simply does not
care about plate. Ten damage a round through 20 rounds of the scarce channel: against the
armored late bestiary it out-damages everything its size, against soft targets the FAL
quietly beats it — a T3 gun outperforming a T4 gun on the right target is the armor axis
working as designed. The exo troopers carry the enemy-tuned variant; taking one from their
hands should feel like disarming the company itself.

**SR-25 — T4**
`1 AP fire / 2 reload · dmg 9 · acc .95 · mag 10 · heavy · bands 2/0.6 → 9/1.0 · ~8.6`
The sniper that follows up. Near-AWP damage at 1 AP semi-auto: two aimed 9s a turn versus
the AWP's one 18-and-cycle. It trades the guaranteed delete for insurance — the second
round for the second cop, the wounded runner, the miss you couldn't afford. Per turn the
math converges with the AWP's; per *decision* they're opposites, which is why both exist.
Punishing adjacency band keeps the pistol-swap ritual alive. The professional's spreadsheet
answer to "what if I miss?" Feel: black rifle, clean bench, no romance.

### Snipers — one shot, one cycle

**Mosin-Nagant — T1** *(implemented; gains bolt-split)*
`1 AP fire + 1 cycle / 2 reload · dmg 8 · acc .90 · mag 5 · heavy · bands 2/0.55 → 8/1.0 · ~3.6`
The kiting gun, now with the class mechanic: fire for 1 AP, cycle for 1, and the cycle can
be *deferred* — shoot, move twice, start the next fight unchambered and regretful. The
Mosin teaches the sniper rhythm (and the sniper-plus-sidearm loadout it implies) at
pawnshop prices, floor 1. Hates adjacency, sings at 8 tiles, one-shots floor-1 chaff on a
good roll. A hundred-year-old rifle in a near-future tower is the whole tone of the T1
economy in one object. Feel: a fence post that went to war.

**Remington 700 — T2**
`1 AP fire + 1 cycle / 2 reload · dmg 11 · acc .92 · mag 4 · heavy · bands 2/0.5 → 9/1.0 · ~5.1`
The hunting rifle: the Mosin's pattern with modern glass. Eleven damage deletes T2's elite
humans in one hit more often than not, the band stretches to 9, and the four-round internal
mag keeps the reload commitment honest. No gimmick beyond the bolt — the Rem 700's job is
to be the *reliable* middle of the sniper line so the VSS can be weird and the AWP can be
mythic. Scoped, civil, patient: the gun for players who have started reading floors as
sightline maps, which is exactly when the marksman enemies start doing it back.

**VSS Vintorez — T3**
`1 AP fire / 2 reload · dmg 8 · acc .85 · mag 10 · heavy · silentKills · bands 2/0.7 → 6/0.95 · ~6.5`
The assassin's sniper. Integrally suppressed and subsonic: semi-auto (no bolt), a
deliberately short 6-tile band — and `silentKills`. A hit that kills alerts *no one*; a hit
that wounds still does. On mixed floors that's a new verb: thin the patrol from the dark,
one clean kill at a time, and the fights you do take are the ones you chose. It previews
the Stage-3 suppressor attachment as a whole-gun identity first, which is the cheapest
possible playtest of whether stealth verbs belong in this game at all. Feel: whisper,
thump, silence, count to three.

**AWP — T4**
`1 AP fire + 1 cycle / 2 reload · dmg 18 · acc .95 · mag 5 · heavy · bands 3/0.45 → 10/1.0 · ~8.6`
The executioner. Eighteen damage one-shots everything in the tower short of a Dozer, at 10
tiles, at 95% — and costs your rhythm to do it: fire, cycle, and the room has moved. Inside
3 tiles it's a very expensive walking stick, which keeps the pistol-swap ritual and the
positioning game alive at the top of the roster. Every heavy round it eats is a round the
Deagle wanted. The tower's marksmen point M82s down the same kind of lanes — the AWP is the
player finally holding the argument from the right end. Feel: inevitability with a scope.

### LMGs — suppression as a purchase

**M249 — T3**
`1 AP fire / 3 reload · dmg 2 ×5 pellets · acc .68 · mag 50 · rifle · braced +0.15 · bands 1/0.8 → 5/0.9 → 8/0.5 · ~6.1`
The class debut, and the debut *is* the content: floors 5–6 are where belt-feds start
existing, and shouldering one reconfigures how you play. Five sloppy pellets a pull, fifty
in the box, `braced` (+15 accuracy if you spent no AP moving — set your feet, hold the
doorway) — and the 3-AP reload: a full turn, helpless, the enemy punish-window mechanic
finally pointed at you. The M249 is a contract: I will not move, and things will not
approach. Armor taxes its confetti pellets hard; that's the UMP lesson at scale.

**XM250 — T4**
`1 AP fire / 3 reload · dmg 3 ×5 pellets · acc .62 · mag 60 · rifle · braced +0.15 · bands 1/0.8 → 5/0.9 → 8/0.55 · ~8.4`
The M249's next-gen replacement and the XM7's issued sibling — Meridian bought the matched
pair, which is why the top floors feel like fighting a procurement catalog. Bigger pellets
(armor taxes them less), deeper box, same brutal posture: no other weapon converts standing
still into output this efficiently, and no other weapon punishes ambition — a mid-fight
3-AP reload — this hard. With `braced` active it approaches minigun arithmetic from the
player's side, which is the closest the roster comes to letting you *be* the Dozer. Feel:
logistics made audible.

---

## 4. Enemy-exclusive hardware

Enemy variants of player guns (`glock_cop` pattern) continue as normal. Genuinely exclusive:

- **Minigun** — the Dozer's weapon. Spin-up telegraph (camera-countdown machinery reused):
  one full turn of warning, then a burst that kills in the open. Breaking LOS during
  spin-up resets it — the fight is about geometry, never DPS.
- **M82** — the marksman's weapon, floors 7–8. Overwatch, not pursuit: a telegraphed lane;
  end your turn in it and take a truck's worth of damage. Turns open corridors into
  terrain. Deliberately not player-obtainable in alpha (its balance case — one full turn
  per shot — is written up if we ever want it).
- **Tec-9 (thug-tuned)** — same gun the player can use, worse hands.

---

## 5. Balance test extensions

Current test: dmg/AP at intended band within ±20% of tier mean; falloff cliff outside band.
The roster above needs four more assertions:

1. **Armored column**: recompute effective dmg/AP against armor 2 and armor 4 profiles.
   Pierce guns must lead their tier vs armor; spray guns must trail it. (This is where
   P90/XM7 earn their under-target nominal numbers.)
2. **Pistol contract**: every pistol 2-hit-kills the chaff HP profile at its intended band;
   no pistol beats any same-floor rifle-class gun vs the elite profile.
3. **Shotgun heat cap**: hot shotguns stay ≤ +25% over tier mean at intended band, and
   their band-2 (or past-cliff) dmg/AP drops below the *previous* tier's mean.
4. **Bolt amortization**: bolt guns' tier math always uses (apFire + 1); the deferred-cycle
   tempo advantage is bought with the unchambered state, not free dmg/AP.

## 6. Open questions (playtest-owned)

- Bolt cycling: auto-on-fire (+1 AP, no new input) vs explicit action — current lean is
  auto with `R`-as-manual-cycle; ten minutes of playtesting decides.
- Garand en-bloc: flavor or new-player trap? The log warning is the mitigation; if testers
  still hate it, discard becomes "discard only above half clip."
- Does the SKS bayonet generalize (a `bayonet` on the AKM too?) or stay a T1 signature?
  Lean: signature. Scarcity is what makes it charming.
- AA-12 reload 2 AP vs 3 AP — decided by whether doorway-weather is dominant in floor 7–8
  playtests.
- Heavy-channel drop rates feed six guns — the stingiest economy in the game. First
  full-tower bot runs should log heavy starvation specifically.

---

## 10. Amendment: ammo is the second currency (balance pass)

**Found in play.** The Micro Uzi was never worth firing. It matched the
revolver's damage per AP exactly, as designed — and cost four times the ammo to
do it, while getting *fewer* trigger pulls per magazine (5 against 6). Its only
advantage in the whole stat line was a 1-AP reload. A player who noticed simply
used the revolver forever, which is the correct read.

### The mistake in the model

§1 says damage-per-AP is "the only balance currency". That is wrong, and the
data says so: the same 24 starting pistol rounds yield **81 damage** through a
revolver and **20** through an Uzi.

The game runs on two resources that behave oppositely. **AP renews every turn;
ammo does not.** Trading a non-renewable resource for a renewable one at parity
is always a losing trade, so every spray weapon in the roster was underwater —
and armor, being flat reduction *per pellet*, punished them a second time.
Sprays lost on two axes and gained on none but burst variance.

### The rule

Let **R = rounds spent per AP spent** (`pellets ÷ apPerShot`). It is the
ammo-intensity of a gun, and it already exists implicitly in the data: 1 for
every single-shot, 4 for the Uzi, 5 for the belt-feds, and **0.5 for bolt
guns**, which spend AP to save ammo.

A gun's damage-per-AP target is its tier baseline scaled by an ammo premium:

```
premium(R) = R < 1 ? -0.12 : min(0.40, 0.12 * (R - 1))
```

| R | guns | premium |
| --- | --- | --- |
| 0.5 | Mosin, Rem 700, AWP | **−12%** |
| 1 | every single-shot | baseline |
| 2 | Tec-9, UMP-45, AN-94, AA-12 | +12% |
| 3 | MP5, M4, Beretta 93R | +24% |
| 4 | Micro Uzi | +36% |
| 5 | M249, P90, XM250 | +40% (capped) |

The flat ±20% tier window becomes a **sloped** one: each gun is still checked to
±20%, but around its own ammo-adjusted target rather than a single tier mean.
Shotguns keep their separate +15% heat allowance on top.

**Why the ceiling.** At +100% the Uzi reliably one-pulls a 6 HP rent-a-cop,
which breaks the §8 guardrail downward and makes the revolver pointless in any
fight where ammo exists — §10's burst-dominance risk arriving on schedule. At
+36% it kills that cop in one or two pulls against the revolver's two: a real
tempo edge, worth paying ammo for, without collapsing the fight.

**Why the floor.** Below roughly +25% the four-times cost still is not worth
paying, and the change would have moved a number without changing a decision.

**Why the cap at 5.** A five-times burner does not get five times the
compensation. The belt-feds already carry fifty-round magazines and the braced
bonus; they stay deliberately a little underwater and pay for it with sustained
fire. These three (M249, P90, XM250) are the dominance watch items.

**The bolt penalty is −12%, not −6%.** Deferring the cycle already buys tempo,
and the sniper line was collecting an ammo discount worth twice what it paid
for. Snipers keep their one-shot-delete identity through raw per-round damage —
the AWP still hits for more in a single round than anything else in the game.

### What the premium does not fix

Two things the arithmetic cannot reach:

- **Magazines should be counted in pulls, not rounds.** An SMG getting fewer
  trigger pulls than a revolver is an insult no percentage repairs.
- **Sprays still have no job a single-shot cannot do.** They become "the
  expensive fast option" rather than a different pattern. Adjacent-tile
  spillover — deferred in §3 for want of tile targeting, which the grenade
  cursor now provides — is what would make them the crowd answer: bad on one
  target, excellent on three. That remains the change most worth making, and it
  would let the premium sit at the conservative end of this band.
