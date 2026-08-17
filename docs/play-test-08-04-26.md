# Playtest — 2026-08-04 (floors 1–8, died on 8 to an Exo Trooper)

## Summary

The difficulty curve is an S lying on its side: a wall at the T2 step (bot data
agrees — deaths cluster on floor 3), a sag through floors 4–6 ("demolishing the
server warden", "not that scary if you know how to play"), then a cliff on 7–8
built out of burst math. Most findings below are symptoms of that one curve.

The headline breach: an Exo Trooper can fire **3× per consolidated turn** (3 AP,
`xm7_exo` apFire 1) for 11 a hit — 33 max, ~25 expected in-band, against ~26–30
maxHp. That kills from full health and breaks the §8 guardrail (player dies in
3–5 *unanswered* hits). The 20-round magazine means a reload window does not
normally occur during the fight. (Audit correction: `armorPierce` reduces entity
armor; it does not bypass the player's shield pool.)

**Resolved 2026-08-17:** the Exo now has 2 AP and its enemy XM7 matches the
player's 10 damage, while both versions retain 1-AP fire and a 20-round magazine.
At the intended band the Exo falls from ~25 to ~15.3 expected damage per turn,
with a 20-damage ceiling. The Fixer retains the three-action glass-cannon extreme;
the armored Exo pays for durability with the missing third action.

What's working and should get more investment: the information layer (gun card,
band strip, ARSENAL panel — "illuminated so much"), the sounds ("so much more
satisfying"), the bolt-action feel, braced indicator, stealth units, the M249's
position. The praise all landed on information + juice work.

## Do immediately

- [x] **Cap the Exo's consolidated burst** — Exo AP 3 → 2 and `xm7_exo`
      damage 11 → 10. This preserves the roster-wide 1-AP firing rule and makes
      the enemy's XM7 match the player's. Audit `m4_merc` and `m249_gunner`
      separately after the enemy-turn behavior fixes land.
- [x] **Keep the XM7's 20-round magazine** — the proposed artificial mag cut
      was rejected. Reload is not every shooter's weakness; the Exo pays for
      armor through its two-action budget instead.
- [ ] **Shotgun point-blank accuracy → ~100%** in band 0, paid for with a
      harsher falloff. A shotgun at arm's length that misses 30% of the time
      reads as a dice insult. (Knockback is a *new mechanic* — separate scope
      decision, not a balance patch.)
- [ ] **Controls panel on first launch** until the first keypress. The game's
      own designer forgot the drop key exists (X, then a slot) — a stranger
      has no chance.
- [ ] **QoL trio**: cut enemy consumable drop rates hard, unlimited stacking,
      dedupe shop stock vs next-floor loot pool.
- [ ] **CEO plates visible** — he runs `shield` (duelist plates), the target
      card only reads `armor`; render a blue plate row for shielded enemies.
- [ ] **Marksman wording** — overwatch shows "on sight" where "telegraphed"
      was expected; unify the card vocabulary with the telegraph events.

## Most annoying (in order)

1. Inventory: consumable shower from enemy drops + no stacking + six slots.
   Fix supply (drop rates) before adding slots — scarcity of slots is doing
   real work; the *volume* is the bug.
2. Controls discoverability (see above — the forgotten drop key is the proof).
3. Corridor-crest ambushes: mapgen sightlines let you step into three sets of
   waiting guns. Fix as a spawn-placement filter (no enemy spawns within ~2
   tiles of corridor mouths/doors), not a mapgen rewrite.
4. Movement tedium — wants auto-explore (`o`, A* to unexplored, interrupt on
   any enemy entering FOV / damage / item underfoot).

## Balance decisions pending

- [ ] **Snipers "slightly OP"** — resist accuracy/damage nerfs (alpha *is* the
      identity). The 3-AP-reload idea punishes sustained fire, not the alpha.
      Prefer: audit mid-floor closer pressure first (melee weight within the
      28–45% band on floors 4–6) — snipers are strongest exactly where nothing
      closes distance. Revisit after the burst cap lands.
- [ ] **AKM → 2-round burst** (`pellets: 2`, lower per-pellet damage): pattern
      differentiation from the FAL per §2, ammo premium prices it.
- [ ] **CEO fight is burstable** — phase acts gated on plate breaks (he
      re-plates), not new AI. Pairs with the difficulty table (`spares`/mode).
- [ ] **K9 Handler** — summoning would be a 9th behavior (registry capped at 8
      by design). Cheaper, flavor-true: paired spawn rule — handler spawns
      *with* dogs. Also decide whether tec9_thug earns its slot.

## Brainstormed, agreed in principle (not yet scheduled)

- **Difficulty modes** as one `data/difficulty.ts` delta table, part of the
  seed contract (`?seed=X&mode=...`). Corporate ladder naming: INTERN /
  SALARIED (the balance-pass target, single source of truth) / SENIOR / PIP.
  Knobs change the price of error, never the skill check: burst cap per mode,
  cloaker melee damage (ambush counterplay is identical, lapses cost more —
  ceiling ~40% of expected maxHp, never lethal from full), ammo abundance,
  shop prices, starting kit (carrier/plate ladder — also fixes "why don't I
  start with a carrier?"), boss plate count. Rejected knobs: enemy HP sponge
  (breaks 1–3 hits-to-kill), hiding UI information.
- **Near-term adds, ranked**: death recap ("performance review": stats folded
  from the event stream + seed — closure, share-bait, and balance telemetry),
  save-and-resume (state is JSON-serializable by invariant; one slot, deleted
  on death), title screen + first-run controls, floating damage numbers (event
  stream consumer #3 — makes band falloff visible per hit), auto-explore,
  corridor spawn guard. Deliberately deferred: attachments (Stage 3), music,
  meta-progression (§5 cut list), mouse support (Phase D).

## Bugs to investigate

- [ ] **Supervisor is a camera in a suit** — he runs `cameraAlarm` verbatim:
      stands frozen, counts down, summons a wave. Correct code, wrong fantasy
      for a human (the target card even prints "raises the alarm · no attack"
      on a person). Fix without a 9th behavior: `cameraAlarm` spends AP
      fleeing the player while the countdown runs — the camera has `ap: 0`,
      so the same code leaves it bolted to the wall, and the supervisor
      becomes a chase decision (run him down through your worst band, into
      rooms he's calling reinforcements toward, or eat the wave). One
      behavior, differentiated by data.
- [ ] Bought gun spawned on the next floor — check whether shop stock and
      floor loot draw from one pool with no exclusion.

---

## Raw transcript

What I'm noticing mostly is that this is a balance. I'm playing through my game and a couple balance things, so I'm playing on the first few levels.

1. I feel like you don't start with an armor carrier. Honestly, a little weird. I feel like you could start maybe with a level one carrier with one full plate, or maybe no plate, depending on difficulty. You have to find your full plate, but the fact you don't start with any armor is kind of weird. You should start, at the very least, with a carrier.
2. The next thing I notice is that shotguns fucking suck because they are shotguns. Really fucking suck.They're inaccurate. They're really inaccurate. They hit hard, but they have no range. The shotgun is terrible, so a potential buff would probably be to raise the accuracy to 100% because you're not going to miss with a shotgun, right? Probably potentially nerf damage at range more, like having a higher, harsher falloff. Maybe it does knock back, knocking an enemy back a tile, would be interesting.

Also, I've noticed heavy weapons, snipers, are quite op because they do a lot of damage at range. Snipers and DMRs have an insane alpha, so possibly finding a way to nerf snipers, in a sense. I don't know how.

Another thing is that later-game enemies, the mercenary rifleman or the security contractor with their heavier weapons that can fire in bursts, are incredibly deadly. Let's say it does an average of 6.5 damage. If they fire twice, using 2 AP, it can hit you for 15 damage, which is a lot. That will kill you in two hits, or the elite rifleman, the one with the XM7, hurts a lot as well. Versus melee enemies, you can kite a lot of them or just kill them before they reach you. In a sense, I do like the damagingness of the game. It forces harsh play, but also the 3 AP of a mini turn. The AP of the enemy is kind of consolidated into one turn, where you can get really fucked if you're not careful.

Thing I did well: I really like the weapon UI. Now the weapon tooltip UI is so good. First, the quick panel that you just see when you're playing the game regularly, and then the arsenal panel with the eye has actually illuminated so much. It's very great UI/UX, and honestly, it makes me so happy.

What annoys me is the lack of inventory space, and there are too many consumables. You pick up a fuck ton of consumables from just spawning, and also dead enemies. Maybe enemies not dropping consumables could be something, but you don't have space for them. Inventory management is the worst part of roguelikes, so I think a change I'll make is to expand inventory slots. We would need to set up an inventory system because then your hotbar wouldn't have anything, or maybe even just adding one more slot, like a tent slot, so it would be seven inventory slots. Also, allow for unlimited stacking. That's an ad hoc fix from a UI perspective.

Also, the controls panel is very nice, but it's quite obscure. I don't know how playtesting would work if someone doesn't know how to get to the controls. Maybe show them when they first log in, because it's quite small and quite obscure. Also, something I would like to add is a timing panel, so we have a turn panel or turn counter, maybe like a real-time counter.

All right, now I'm just gonna live narrate for floor. I'm on floor six, the data center, and I've been really liking the Remington 700. It hits hard, and I really like the bolt mechanic because it makes snipers feel so heavy and makes them do a lot of damage. They're good, really good, too. Honestly, I am demolishing the server warden on floor six.
Also, I feel like these unique enemies, or the bosses, might want to drop some cool loot. I just demolished the mini boss. I feel like this game isn't that scary if you know how to play. On ammo, I have a lot of ammo, which is good. You want to have a lot of ammo late game. I feel like I have:

- 175 pistol bullets
- 11 shells
- 159 rifle ammo
- 126 heavy
  I've also been buying a lot of ammo. Oh, fuck, a cloaker, and I miss the cloaker. The stealth unit is good design. I'm in a pickle. I'm gonna have to stim. That's good design. I always take expense account when I get it because 25% off. I buy so much random crap from the merchant.
  Oh yeah, boy, we just got an M249. This is my first time getting an M249. I'm low-key excited. I'm suffering from success. I'm at the plate cap on max health. I don't drop the med kit. I gotta get a med kit. I've got a level 4 carrier now. That's nice. I haven't really used throwables that much.
  Oh, and I really like how the UI shows the braced. That's really cool. Okay, time to go to the next floor, buy some more ammo, and there we go.
  I'm thinking, right? I feel like another thing is that maybe to nerf the machine gun, it takes 3 AP to shoot, but it does more damage. An interesting quirk about this game is really utilizing your AP to do a shit ton of alpha damage and burst down people.
  Oh shit, I really like the south units. They add a lot of the cloakers. They add a lot of variety. Damn, exo troopers do a lot. Oh, hit me for 11 and kill this canine unit. Yeah, I'm doing 1 damage to this actual trooper because it's too armored. That's smart. The actual trooper is really fucking scary, though. I'm gonna run away because these range troopers, late game, have a lot of range. Yeah, they can just chase after you and hit you for 11. Exo troopers can kill you for frickin' 33 burst damage if you get unlucky. That's ridiculous.
  Oh, I killed the exo trooper. That was really scary. Heavy gunner, not too bad. I do like the M249. I do think it sits in a good position. I think this game is actually pretty well balanced, all things considered. It's taking a little long, though. Only mildly concerning. I'm on floor 7, and the troops are quite scary. Melee units are not the scariest. If I had to be honest, I would like to find a better weapon for the last floor.
  Dozer, dozer. Yeah, you kind of can kite the dozer with a sniper. Oh ouch, but dozer didn't do that much damage with the minigun. I feel like I should have been punished more because I've messed up my kiting, but also I'm pretty good at roguelikes and pretty good at my own game. All these droppables on the floor are really annoying me. I want to pick them up. Okay, so I'm going into the last floor. I have a ton of ammo. I'm not worried. I would like a better weapon.

All right, going into last floor, I'm just going to be buying everything I can. Again, I can't buy stuff because my inventory is full. How annoying. Oh, a little bug: I'm 82 marksman. Does not have, I guess, the telegraphed thing because he does telegraph. f

Yeah, fighting two exo troopers right now. This is a tough fight. Yeah, being able to shoot twice and deal 22 damage, and it's not even super uncommon. I don't know how armor works. I think I have armor, but yeah, it fucking hurts a lot. I'm down, I gotta heal. I don't know about the whole two-tap and being able to shoot multiple times for enemies. It does make the game harder and more punishing, which I think I'll keep it for now. Yeah, oh, I actually just died to the X, a singular exo trooper hit me for 22. Was not paying attention at all. Enemies being able to hit that hard is concerning-ish. Like, the ranged enemies, maybe it's a game feature. Bullets do hurt, I guess.

This game also needs an auto-explorer feature because having to use WASD or arrow keys to move around is quite tedious and slow.
I think snipers need a slight nerf somehow. I don't want to decrease accuracy or damage, but maybe the reload should cost 3 AP points to make it really punishing.

Okay, I don't know if I'm going really lucky, but on this run, I bought a few guns. I bought a gun just for it to spawn on the next floor. We should make that not impossible, but relatively uncommon. Maybe I'm just getting unlucky. I'm going to take a look at the odds for this.

Another thing I'm really happy with is the sounds. They make this game so much more satisfying. It adds a lot of clunk and juiciness.

Don't know why the tech nine exists, and I don't know why the canine handler has one. I feel like the canine handler also should be able to summon canines. If it has only tec-9

Oh, the supervisor enemy is kind of bugged. The camera has tears. The camera stuff, I don't know about that. That needs a little bit of work.

Oh, in terms of inventory as well, there's no way to drop stuff.

In terms of the map generation, there's a big problem with the map generation, and that is sight lines. There would be a lot of times when the sight lines are such that you crest a 1x1 corridor and you're immediately besieged by a bunch of enemies.

I really like the uniqueness of the sniper, bolt-action snipers. It's really good. Even though snipers are a little OP, it's probably the most unique weapon class

Yeah, the fact that the mercenary rifleman can hit you for 18 damage is insane. I'd say a core mistake, or I don't know if this is a mistake, but a gameplay decision is basing the weapons right off the weapons that we use, which is fair, right? It does make for punishing gameplay. Right now, I had to use my golden parachute, which is a great use of the golden parachute because I would have been dead.

I feel like the AKM should do slightly less damage, but maybe fire two shots. Because the AKM, as a single-shot weapon, is a little boring, kind of is it worse FN FAL? But the AKM is very strong, so I guess.

The CEO does a lot of damage, which is good, but also it's a little underwhelming of a fight. As in, you can kind of burst him down, which is boring. Also, his plates don't show up as armor or health. He should be able to plate up. He should be able to heal. He should have more complicated AI, honestly. You can burst him down, which hurts. A big problem is that a lot of these enemies can kill you when you're pretty high on health. .>
