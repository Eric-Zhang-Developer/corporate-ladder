# Sound Design — Severance Package

Alpha sound direction and the full SFX inventory. Companion pieces:
`tools/soundgen/` (the generator — every sound in this document is code, not a
recording) and `public/sounds/` (its output, one WAV per entry plus
`manifest.json`). The in-app soundboard (♪ button) auditions the whole set.

Scope note: this document covers the *palette* — what each sound is and why.
Playback integration (which game moment triggers which file) is §7 and is
deliberately thin; it lands after the palette survives an audition pass.

## 1. Aesthetic: 16-bit, a little pixely, not that pixely

The target is the SNES era, stated operationally:

- **32 kHz, mono, 16-bit** — the SPC700's world. High enough that nothing
  sounds like a telephone, low enough that the top octave has that dusty
  softness instead of modern sparkle.
- **Composed, not sampled.** Every sound is layers of synthesis — transient +
  body + sub + tail — the way 16-bit sound designers built "realistic" effects
  out of chips and tiny samples. Nothing in the set is a recording.
- **Warmth over crunch.** A gentle lowpass rounds every sound (the SNES's
  gaussian interpolation, emulated); *some* layers carry mild bit reduction
  for grain. What we refuse: raw NES squares as a lead voice, 4-bit volume
  staircases, chip-tune bleep as identity. That was the 8-bit draft; this
  supersedes it.
- **Echo is a place.** The SNES DSP had one global echo and games used it to
  make small speakers sound like rooms. Big sounds here (shotguns, snipers,
  explosions, stingers) carry a short feedback echo (~90–130 ms, damped).
  Small sounds are dry. The tower should feel like drywall and server rooms.
- **Pitch is expression.** Falling tones for damage and death, rising for
  telegraphs and elevators, a flat note in the promotion fanfare. 16-bit
  sound talks in melody more than texture.

One test for every sound: *would it sit in a SNES-era action game without
sounding like a Game Boy or like a movie?*

## 2. Hard constraints

1. **The sim never hears anything.** Detection is already modeled numerically
   (`wakeNeighbours` / `NOISE_RADIUS` in `sim/combat.ts`); audio is for the
   player, produced renderer-side. No sim change is part of this work.
2. **Assets are generated, deterministic, and cheap.** `tools/soundgen/` is
   pure-stdlib Python; per-sound RNG is seeded by the sound's name, so
   regeneration is byte-stable. Retuning a gun is editing two numbers and
   rerunning — never re-exporting audio from a DAW.
3. **Output lives in `public/sounds/`** — Vite serves `public/` verbatim, so
   `/sounds/<name>.wav` works identically in dev and the Pages build. The
   whole set is ~2–3 MB. (The `build:zip` single-file mode does not inline
   fetched assets; audio degrades to silence there, which is acceptable —
   that build exists to be double-clicked, not to be the good version.)
4. **The generator is source; the WAVs are build output — both committed.**
   The `.py` recipes are the only editable form the sounds have; the WAVs
   are committed alongside them so clone-and-run needs no Python. Same
   discipline as the golden snapshot: regenerate deliberately, in a
   reviewed commit, never reflexively.

## 3. Synthesis architecture

The library (`tools/soundgen/synth.py`) provides:

- **Oscillators**: sine, triangle, saw, pulse (variable duty + PWM), and a
  2-operator FM pair — FM is the 16-bit workhorse for bells, barks, servos,
  and anything metallic-musical.
- **Noise**: white (seeded) and the 15-bit LFSR in both taps — long tap for
  gun bodies and blasts, short tap for pitched metallic ring (ricochets,
  clatter, mechanisms).
- **Filters**: one-pole low/highpass and a resonant state-variable filter;
  swept cutoffs make blasts bloom and cloaks drop.
- **Envelopes**: exponential decays, attack-decay curves, per-layer; pitch
  envelopes and vibrato on any oscillator.
- **Effects**: SNES-style damped feedback echo, soft-clip saturation, subtle
  bit/rate reduction, peak normalization to per-category targets.
- **Assembly**: `mix`, `at` (delay a layer), `seq` — every sound is a small
  declarative recipe, ~10–25 lines.

## 4. The gun grammar

Thirty player weapons need thirty voices that stay legible in a firefight.
The grammar: **caliber picks the family, stats pick the build, the id gets a
hand voice.** Four families:

| Family | Body | Sub | Character |
|---|---|---|---|
| `pistol` | bright bandpassed snap | small, fast | dry, polite, close |
| `shell` | wide LP noise boom | deep, pitch-drops | room-scale, ragged tail |
| `rifle` | mid crack + growl | moderate | echo tail — corridors |
| `heavy` | dark low crack | biggest | long whip tail, authority |

Stat mappings applied on top:

- `pellets` → grain count and spacing. A volley is *n* small shots in rhythm,
  never one long burst — the spray feel lives in the timing. Signature cases:
  AN-94 fires its two grains 18 ms apart (the hyperburst flam), the P90 runs
  five at 28 ms (sewing machine), the AA-12 is two full booms at 80 ms.
- `damage` → sub depth and pitch center (heavier round = lower).
- `apReload`/mechanism → which reload voice it gets (§5 Mechanisms).
- `boltAction` → nothing on the fire sound; the bolt is its own event.
- `silentKills` → the whole family is replaced: thup + action clack.
- Pump guns (M870) append the shuck-shuck 180 ms after the boom — the pump is
  more the shotgun's identity than the bang.

Enemy variants (`glock_cop`, `serbu_guard`, `tec9_thug`, `mp5_sec`,
`m4_merc`, `m249_gunner`, `xm7_exo`, `spas_detail`) reuse the player gun's
voice — same gun, same sound, and hearing *your* future gun in enemy hands is
free foreshadowing. Five enemy-only weapons get their own voices below.

### Per-gun voice notes

**Pistol channel** — `glock` the office stapler: tight polite snap, no tail ·
`revolver` single fat iron crack with a ring · `tec9` two cheap tinny grains
plus rattle · `fiveseven` high, fast, almost toy-like but precise · `b93r`
three small grains at 35 ms · `deagle` pistol envelope, heavy-channel body —
the showoff · `uzi` four tight grains, slight upward drift (muzzle climb) ·
`mp5` three round warm grains — the movie SMG · `ump45` two fat slow .45
thumps · `p90` five zippy grains at 28 ms.

**Shell channel** — `serbu` short-barrel blast, clipped tail, big 70 Hz sub ·
`m870` full boom + pump appendix · `spas12` harder, tighter boom with a steel
receiver clang · `aa12` thud-thud auto double, less pitch drop.

**Rifle channel** — `mini14` clean flat ranch-rifle crack · `sks` mid crack
with quiet post-shot action clatter · `ar15` the classic bright 5.56 pop ·
`m4` three ar15 grains, slightly lower · `akm` wood-and-steel 7.62 thunk,
dusty tail · `an94` the 18 ms hyperburst flam · `m249` five rattly grains
with a chain-jingle layer · `xm250` five deeper, smoother grains.

**Heavy channel** — `mosin` heaviest T1 crack, long dusty echo · `garand`
big flat crack (its glory is the reload ping) · `fal` right-arm-of-the-free-
world boom, long tail · `rem700` clean deep crack, lonely echo · `sr25`
precise crack + whip · `xm7` modern, dark, controlled · `awp` the biggest
player crack, whip echo, faint bell — the flex · `vss` thup + clack, a quiet
ping when it lands.

**Enemy-only** — `fixer_pistol` suppressed but potent: more body than the
VSS, still a whisper · `m82` near-explosion crack + sub + long echo — fear at
a distance · `turret_gun` servo pre-blip then one robotic snap · `warden_slam`
no gunpowder: FM servo whir into metal impact · `minigun` six grains at 25 ms
over a motor whine.

## 5. Full inventory

Everything below ships as `public/sounds/<name>.wav`. Categories are the
manifest's grouping and the soundboard's tabs.

**Mechanisms (7)** — `bolt_cycle` two-stage clack (open, close) ·
`pump_rack` shuck-shuck alone (enemy pumps off-screen) · `reload_mag` mag
out, mag in, slide snap — three stages · `reload_shells` three ascending
shell pushes · `reload_belt` cover clank, belt rattle, cover slam ·
`reload_enbloc` the Garand PING plus clip clunk — the one legendary reload ·
`dry_click` tiny; costs 0 AP, should cost ~0 attention.

**Feedback (13)** — `hit_flesh` low wet thud, no pitch identity ·
`hit_hard` metallic thunk — machines feel different to shoot ·
`miss_ricochet` pweeong: short-tap LFSR + falling whistle ·
`armor_clatter` bright clank cluster, zero low end — rounds landed and did
nothing; the armor lesson by ear · `plate_break` ceramic crack + falling
shards · `plate_slot` a solid confident chunk-in · `player_hurt` deep thud +
brief falling wince tone · `player_hurt_blade` schwick + thud — sharper, so
"that ignored my plates" is audible · `kill_human` body-drop thud + small
descending resolve · `kill_machine` powering-down whine + spark ticks ·
`knife_stab` schunk (bump-melee) · `low_hp` soft heartbeat double-thump
(loopable) · `boss_sting` dark two-chord sting — a miniboss has seen you.

**Enemy signatures (12)** — `spot_human` walkie-talkie squelch + chirp (the
one-turn warning, audible even off-screen) · `spot_machine` rising sensor
beep pair · `camera_alert` klaxon beep-beep + servo swivel · `alarm_klaxon`
two-tone alarm bar (loopable) · `elevator_arrival` ding, doors, boots — the
response team; funny and threatening at once · `dog_bark` classic 16-bit FM
bark, twice · `taser_zap` crackle burst + buzz · `drone_arm` rising whine
with beep accelerando — this sound means *run* · `turret_lock` targeting
beeps: beep… beep… beeep · `warden_spinup` heavy servo rumble rising ·
`stealth_reveal` cloak-drop shimmer sweeping down into a hiss ·
`minigun_spinup` motor pitch climbing ~0.8 s — the Dozer's telegraph.

Telegraph sounds are gameplay: `drone_arm`, `turret_lock`, `warden_spinup`,
`minigun_spinup` are audible countdowns for the enemies whose entire design
is "you get a warning, use it."

**Thrown & consumables (8)** — `grenade_throw` pin tink + whoosh ·
`frag_blast` the set's biggest sound: deep boom, debris, echo ·
`flashbang_blast` sharp crack into a long high sine whiteout ·
`emp_blast` FM zap sweep + digital sputter · `heal_small` warm two-note
blip (snack/bandage) · `heal_big` rising arp with a relief tone
(medshot/medkit) · `stim_use` sharp upward sweep + heart kick ·
`schematics` data chirp burst resolving to a tone — the map reveal.

**UI & economy (13)** — `pickup_ammo` two brass ticks · `pickup_weapon`
heavy clack + strap thump · `pickup_cash` double coin ding ·
`pickup_item` soft blip · `buy_ok` bell + drawer ka-ching · `buy_denied`
dull double buzz · `promote` three clean FM-brass notes and a fourth that
lands flat — triumph with a problem; the game's thesis in four notes ·
`perk_pick` stamp chunk + short affirmative chord · `ascend_elevator` doors,
motor hum rising, ding at the top · `ui_blip` cursor tick · `death` two
dial-tone beats into a four-note falling minor line — the voicemail motif ·
`win` rising major arp over a sustained pad, rooftop air · `game_start`
badge-scan beep + door unlock — clocking in.

Total: **88 files** (35 gun voices + 53 across the other categories).

## 6. Mix rules

- **Peak targets by category**: blasts/stingers 0.85, guns 0.80, feedback
  0.70, enemy signatures 0.65, UI 0.55. Loudness is hierarchy: the thing
  that kills you is never quieter than a menu.
- **Stagger simultaneity.** Enemy turns resolve in one `applyAction`, so one
  frame can demand five gunshots. The playback layer must fan simultaneous
  events out by 40–60 ms — which also makes the enemy turn *feel* sequential.
  Free juice.
- **Voice cap with priority.** `player_hurt` and `plate_break` always play;
  the sixth ricochet in a frame does not.
- **No sound longer than its information.** Guns ≤ 0.6 s, feedback ≤ 0.4 s,
  stingers ≤ 3 s. Turn-based pacing tolerates zero tail-stacking sludge.

## 7. Integration: the event stream

The sim writes a diary: `applyAction(state, action)` mutates state in place
and returns `SimEvent[]` — plain-data records (actor ids, positions, weapon
ids, damage) of everything that happened in that call, collected via
`sim/events.ts` and drained exactly once per action. Emission is additive:
it never consumes RNG and never changes log text, so the golden snapshot is
unaffected; events are never stored on GameState, so saves and the
serialization invariant are untouched.

Renderers are consumers. `render/sfx.ts` is the pure mapper —
`soundsFor(events, state)` names the cues (gun voices via the enemy-variant
alias table, reload mechanisms from weapon stats, off-screen events at 0.4×
gain) and `planPlayback` applies the §6 mix rules as data: 50 ms fan-out in
sim order, a cap of ~8, dropping texture before information and the
player's own pain never. `render/audio.ts` is the WebAudio player: one
context unlocked on first keypress, lazily decoded buffers, per-play gain,
mute on M persisted in localStorage. Sound is the first consumer; the
staggered-turn animation is the second, which is why events carry positions
and from/to movement (`step`) that sound ignores — and per-shot fidelity
inside a single enemy turn, the thing delta-detection could never see, is
now simply how it works.

The WAVs are the contract: whatever the playback layer becomes, it plays
these files by name. A future switch to runtime WebAudio synthesis (to feed
`build:zip`) would port `synth.py` 1:1 and keep this document as its spec.

## 8. The soundboard

A ♪ button in the app opens a modal listing every sound, grouped by
category tabs, click-to-play, with arrow-key navigation (each step
auto-plays, Esc closes). It reads `/sounds/manifest.json`, so a regenerated
palette shows up on reload with no code change.

It mounts in the dev-tools corner, gated by `import.meta.env.DEV` exactly
like the planned debug panel (ux-design.md §2): a build-time constant, so
the module is dead-code-eliminated from every build output — Pages and the
zip never contain the panel. The WAVs themselves still copy into `dist/`
(they are `public/` assets and gameplay playback will want them there); only
the audition UI is dev-only.
