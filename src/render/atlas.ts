import { ENEMIES } from "../data/enemies";

/**
 * Provisional pixel atlas: every sprite is a 14×14 pixel grid drawn once to an
 * offscreen canvas at 2px per pixel. Enemy sprites are shared body templates
 * (guard, suit, heavy, quadruped, …) tinted by the enemy's data `color` — the
 * P/p palette slots — plus an accessory overlay (rifle, baton, shield) so the
 * role reads at a glance. Identity therefore still lives in src/data.
 * The renderer only asks for a key and blits a cell, so the eventual real art
 * pass is a PNG with the same keys, nothing else changes.
 */
export const TILE = 28;

/** Sprite pixels per side; TILE / GRID canvas pixels per sprite pixel. */
const GRID = 14;

type Grid = string[];

/**
 * Shared palette letters. P/p (primary + its shadow) are resolved per sprite;
 * rows shorter than GRID are implicitly padded with "." (transparent).
 */
const FIXED: Record<string, string> = {
  S: "#d9a066", // skin
  K: "#15151a", // near-black: hair, guns, boots
  M: "#9aa1ad", // light metal
  m: "#565d68", // dark metal
  W: "#f2f2f2", // white
  R: "#ff4433", // red accent: lenses, warning lights
  Y: "#ffd94a", // yellow accent: sparks, ammo
};

function shade(hex: string, f: number): string {
  const n = parseInt(hex.slice(1), 16);
  const ch = (v: number) =>
    Math.round(v * f)
      .toString(16)
      .padStart(2, "0");
  return `#${ch((n >> 16) & 255)}${ch((n >> 8) & 255)}${ch(n & 255)}`;
}

// ---- enemy body templates ----

const BODIES = {
  // Capped uniform with shades: the archetypal shooter.
  guard: [
    "..............",
    "....PPPP......",
    "...PPPPPP.....",
    "....KKKK......",
    "....SSSS......",
    "...PPPPPP.....",
    "..PPPPPPPP....",
    "..PpPPPPpP....",
    "..PpPPPPpP....",
    "...PPPPPP.....",
    "...pp..pp.....",
    "...pp..pp.....",
    "...KK..KK.....",
  ],
  // Bare-headed workwear: the melee crowd.
  melee: [
    "..............",
    "..............",
    "....KKKK......",
    "...KSSSSK.....",
    "....SSSS......",
    "...PPPPPP.....",
    "..PPPPPPPP....",
    "..PpPPPPpP....",
    "..PpPPPPpP....",
    "...PPPPPP.....",
    "...pp..pp.....",
    "...pp..pp.....",
    "...KK..KK.....",
  ],
  // Jacket over a white shirt and tie: management and professionals.
  suit: [
    "..............",
    "..............",
    "....KKKK......",
    "...KSSSSK.....",
    "....SSSS......",
    "..PPPWWPPP....",
    "..PPWKKWPP....",
    "..PpWKKWpP....",
    "..PpPKKPpP....",
    "...PPPPPP.....",
    "...pp..pp.....",
    "...pp..pp.....",
    "...KK..KK.....",
  ],
  // Full helmet with a dark visor, broad shoulders: armored troops.
  heavy: [
    "..............",
    "...PPPPPP.....",
    "...PPPPPP.....",
    "...pKKKKp.....",
    "...PPPPPP.....",
    ".PPPPPPPPPP...",
    ".PpPPPPPPpP...",
    ".PpPPPPPPpP...",
    ".PPPPPPPPPP...",
    "..PPPPPPPP....",
    "..pp....pp....",
    "..pp....pp....",
    "..KK....KK....",
  ],
  // A humanoid outline with nothing inside: active camo flickering.
  stealth: [
    "..............",
    "....PPPP......",
    "...P....P.....",
    "....PPPP......",
    "..PP....PP....",
    ".P........P...",
    ".P........P...",
    ".P........P...",
    "..P......P....",
    "...P....P.....",
    "...P....P.....",
    "...P....P.....",
    "...PP..PP.....",
  ],
  dog: [
    "..............",
    "..............",
    "..............",
    "..............",
    ".........PP...",
    "........PKPP..",
    "..p.....PPPPP.",
    "..PPPPPPPPP...",
    "..PPPPPPPPP...",
    "...PP...PP....",
    "...PP...PP....",
    "...pp...pp....",
  ],
  robodog: [
    "..............",
    "..............",
    "..............",
    ".........M....",
    ".........MM...",
    "........MRMM..",
    "..m.....MMMMM.",
    "..MMMMMMMMM...",
    "..MPPPPPPMM...",
    "...Mm...Mm....",
    "...Mm...Mm....",
    "...mm...mm....",
  ],
  camera: [
    "......KK......",
    "......KK......",
    "...mmmmmm.....",
    "..mPPPPPPm....",
    "..mPKWPPPm....",
    "...mmmmmm.....",
  ],
  roomba: [
    "..............",
    "..............",
    "..............",
    "..............",
    "..............",
    "..............",
    "..............",
    "....pppppp....",
    "..PPPPPPPPPP..",
    "..PPRPPPPPPP..",
    "..pppppppppp..",
    "...mm....mm...",
  ],
  // Top-down quad: four bright rotor discs around a camera body.
  drone: [
    "..............",
    ".MMMM....MMMM.",
    ".MWMM....MMWM.",
    ".MMMm....mMMM.",
    "....m....m....",
    "....PPPPPP....",
    "....PPRRPP....",
    "....PPPPPP....",
    "....m....m....",
    ".MMMm....mMMM.",
    ".MWMM....MMWM.",
    ".MMMM....MMMM.",
  ],
  turret: [
    "..............",
    "..............",
    "..............",
    "...PPPPP......",
    "..PPPPPPPKKKK.",
    "..PPPPPPPKKKK.",
    "...PPPPP......",
    ".....mm.......",
    "....mmmm......",
    "...mm..mm.....",
    "..mm....mm....",
  ],
  // Humanoid chassis, red eyes, stray sparks: the malfunctioning prototype.
  robot: [
    "..............",
    "...MMMMMM.....",
    "...MRMMRM..Y..",
    "...MMMMMM.....",
    "....mMMm......",
    "..PPPPPPPP....",
    "..PmPPPPmP....",
    "..PmPPPPmP.Y..",
    "..PPPPPPPP....",
    "...mm..mm.....",
    "...mm..mm.....",
    "...MM..MM.....",
  ],
  // A server rack with blinkenlights: the Warden.
  rack: [
    ".KKKKKKKKKK...",
    ".KPPPPPPPPK...",
    ".KPWPPRPPPK...",
    ".KPPPPPPPPK...",
    ".KKKKKKKKKK...",
    ".KPPPPPPPPK...",
    ".KPRPPYPPPK...",
    ".KPPPPPPPPK...",
    ".KKKKKKKKKK...",
    ".KPPPPPPPPK...",
    ".KPYPPWPPPK...",
    ".KPPPPPPPPK...",
    ".KKKKKKKKKK...",
  ],
  // Armored slab on treads, barrel cluster forward.
  dozer: [
    "..............",
    "..............",
    "..PPPPPPPP....",
    ".PPPPPPPPPP...",
    ".PPKKPPPPPMMM.",
    ".PPKKPPPPPMMM.",
    ".PPPPPPPPPP...",
    ".pPPPPPPPPp...",
    ".KKKKKKKKKKK..",
    ".KmKKmKKmKKm..",
    ".KKKKKKKKKKK..",
  ],
} satisfies Record<string, Grid>;

// ---- accessory overlays, drawn over a body ----

const OVERLAYS = {
  gun: [
    "..............",
    "..............",
    "..............",
    "..............",
    "..............",
    "..............",
    "..............",
    ".........MMMMM",
    "..........Km..",
  ],
  pistol: [
    "..............",
    "..............",
    "..............",
    "..............",
    "..............",
    "..............",
    "..............",
    ".........MMM..",
    "..........K...",
  ],
  longgun: [
    "..............",
    "..............",
    "..............",
    "..............",
    "..............",
    "..............",
    "...........KK.",
    ".........MMMMM",
    ".........K....",
  ],
  baton: [
    "..............",
    "..............",
    "..............",
    "..............",
    "...........M..",
    "...........M..",
    "...........M..",
    "..........pM..",
  ],
  taser: [
    "..............",
    "..............",
    "..............",
    "...........Y..",
    "...........M..",
    "...........M..",
    "...........M..",
    "..........pM..",
  ],
  mop: [
    "..............",
    "..............",
    "..............",
    "...........M..",
    "...........M..",
    "...........M..",
    "...........M..",
    "..........pM..",
    "...........M..",
    "...........M..",
    "..........WWW.",
    "..........WWW.",
  ],
  shield: [
    "..............",
    "..............",
    "..............",
    ".........MMM..",
    ".........MMM..",
    ".........MWM..",
    ".........MMM..",
    ".........MMM..",
    ".........MMM..",
    ".........MMM..",
    ".........MMM..",
    ".........mmm..",
  ],
} satisfies Record<string, Grid>;

/** Which template + accessories each enemy renders with. Tint comes from data. */
export const ENEMY_LOOK: Record<
  keyof typeof ENEMIES,
  { body: keyof typeof BODIES; overlays?: (keyof typeof OVERLAYS)[] }
> = {
  rentacop: { body: "guard", overlays: ["pistol"] },
  dog: { body: "dog" },
  taser: { body: "melee", overlays: ["taser"] },
  shotgun: { body: "guard", overlays: ["gun"] },
  camera: { body: "camera" },
  janitor: { body: "melee", overlays: ["mop"] },
  roomba: { body: "roomba" },
  baton: { body: "melee", overlays: ["baton"] },
  contractor: { body: "guard", overlays: ["gun"] },
  riot: { body: "heavy", overlays: ["shield"] },
  k9: { body: "robodog" },
  fpv: { body: "drone" },
  supervisor: { body: "suit" },
  handler: { body: "guard", overlays: ["pistol"] },
  rifleman: { body: "guard", overlays: ["gun"] },
  gunner: { body: "heavy", overlays: ["gun"] },
  stealth: { body: "stealth" },
  turret: { body: "turret" },
  prototype: { body: "robot" },
  warden: { body: "rack" },
  exo: { body: "heavy", overlays: ["gun"] },
  fixer: { body: "suit", overlays: ["pistol"] },
  marksman: { body: "guard", overlays: ["longgun"] },
  detail: { body: "suit", overlays: ["gun"] },
  dozer: { body: "dozer" },
  ceo: { body: "suit", overlays: ["pistol"] },
};

// ---- terrain, items, player ----

const FLOOR_ROW = "FFFFFFFFFFFFFf";
const FLOOR: Grid = [...Array(13).fill(FLOOR_ROW), "ffffffffffffff"];

const WALL: Grid = [
  "BBBBBBBBBBBBBB",
  ...Array(6).fill("AAAAAAAAAAAAAA"),
  "DDDDDDDDDDDDDD",
  ...Array(4).fill("AAAAAAAAAAAAAA"),
  "CCCCCCCCCCCCCC",
  "CCCCCCCCCCCCCC",
];

const STAIRS_ARROW: Grid = [
  "..............",
  "..............",
  "......WW......",
  ".....WWWW.....",
  "....WWWWWW....",
  "...WWWWWWWW...",
  "......WW......",
  "......WW......",
  "......WW......",
  "......WW......",
  "......WW......",
];

const PLAYER: Grid = [
  "..............",
  "..............",
  "....KKKK......",
  "...KSSSSK.....",
  "....SSSS......",
  "..WWWWWWWW....",
  "..WWWKKWWW....",
  "..WWWKKWWW....",
  "..WWWWWWWW....",
  "...WWWWWW.....",
  "...KK..KK.....",
  "...KK..KK.....",
  "...mm..mm.....",
];

const ITEM_WEAPON: Grid = [
  "..............",
  "..............",
  "..............",
  "..............",
  "...........M..",
  "..MMMMMMMMMMM.",
  "..mmMMMMMMMMM.",
  "......mm......",
  "......mm......",
];

const ITEM_AMMO: Grid = [
  "..............",
  "..............",
  "..............",
  "..............",
  "....yyyyyy....",
  "...YYYYYYYY...",
  "...YYYYYYYY...",
  "...YmmmmmmY...",
  "...YYYYYYYY...",
  "...yyyyyyyy...",
];

const ITEM_PLATE: Grid = [
  "..............",
  "..............",
  "..............",
  "....MMMMMM....",
  "...MMMMMMMM...",
  "...MWMMMMMM...",
  "...MMMMMMMM...",
  "...MMMMMMMM...",
  "...MMMMMMMM...",
  "....mmmmmm....",
];

const ITEM_CARRIER: Grid = [
  "..............",
  "..............",
  "..............",
  "...VV....VV...",
  "...VV....VV...",
  "..VVVVVVVVVV..",
  "..VVVVVVVVVV..",
  "..VVvvVVvvVV..",
  "..VVVVVVVVVV..",
  "..vvvvvvvvvv..",
];

const ITEM_CONSUMABLE: Grid = [
  "..............",
  "..............",
  "..............",
  "..............",
  "..............",
  "....WWWRRR....",
  "...WWWWRRRR...",
  "...WWWWRRRR...",
  "....WWWRRR....",
];

const VENDING: Grid = [
  "..KKKKKKKKKK..",
  "..KGGGGGGGGK..",
  "..KGWWWWWWGK..",
  "..KGWRYCWWGK..",
  "..KGWWWWWWGK..",
  "..KGWCRYWWGK..",
  "..KGWWWWWWGK..",
  "..KGGGGGGGGK..",
  "..KGKKKKKKGK..",
  "..KGGGGGGGGK..",
  "..KKKKKKKKKK..",
  "..mm......mm..",
];

export interface SpriteSpec {
  key: string;
  layers: Grid[];
  colors: Record<string, string>;
}

function tinted(primary: string, extra: Record<string, string> = {}): Record<string, string> {
  return { ...FIXED, P: primary, p: shade(primary, 0.55), ...extra };
}

/** The full atlas contents, resolved to plain data — testable without a DOM. */
export function spriteSpecs(): SpriteSpec[] {
  const specs: SpriteSpec[] = [
    { key: "floor", layers: [FLOOR], colors: { F: "#232328", f: "#1d1d22" } },
    {
      key: "wall",
      layers: [WALL],
      colors: { A: "#454552", B: "#565664", C: "#33333e", D: "#3d3d4a" },
    },
    {
      key: "stairs",
      layers: [FLOOR, STAIRS_ARROW],
      colors: { ...FIXED, F: "#232328", f: "#1d1d22" },
    },
    { key: "player", layers: [PLAYER], colors: FIXED },
    { key: "item_weapon", layers: [ITEM_WEAPON], colors: FIXED },
    { key: "item_ammo", layers: [ITEM_AMMO], colors: { ...FIXED, y: "#b89a2e" } },
    { key: "item_plate", layers: [ITEM_PLATE], colors: FIXED },
    {
      key: "item_carrier",
      layers: [ITEM_CARRIER],
      colors: { ...FIXED, V: "#5599dd", v: shade("#5599dd", 0.55) },
    },
    { key: "item_consumable", layers: [ITEM_CONSUMABLE], colors: FIXED },
    {
      key: "vending",
      layers: [VENDING],
      colors: { ...FIXED, G: "#66bb88", C: "#66dddd" },
    },
  ];
  for (const def of Object.values(ENEMIES)) {
    const look = ENEMY_LOOK[def.id as keyof typeof ENEMIES];
    specs.push({
      key: def.id,
      layers: [BODIES[look.body], ...(look.overlays ?? []).map((o) => OVERLAYS[o])],
      colors: tinted(def.color),
    });
  }
  return specs;
}

export interface Atlas {
  canvas: HTMLCanvasElement;
  index: Map<string, number>;
}

export function buildAtlas(): Atlas {
  const specs = spriteSpecs();
  const canvas = document.createElement("canvas");
  canvas.width = TILE * specs.length;
  canvas.height = TILE;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no 2d context for atlas");

  const px = TILE / GRID;
  const index = new Map<string, number>();
  specs.forEach((spec, i) => {
    index.set(spec.key, i);
    const x0 = i * TILE;
    for (const grid of spec.layers) {
      grid.forEach((row, gy) => {
        for (let gx = 0; gx < GRID; gx++) {
          const color = spec.colors[row[gx] ?? "."];
          if (color === undefined) continue;
          ctx.fillStyle = color;
          ctx.fillRect(x0 + gx * px, gy * px, px, px);
        }
      });
    }
  });

  return { canvas, index };
}
