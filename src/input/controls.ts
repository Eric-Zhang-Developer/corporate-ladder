/**
 * The printed keymap — the single source the controls panel renders from.
 *
 * This is a data table rather than hand-authored HTML for one reason: `P` and
 * `4`-`9` once shipped completely unbound, and nothing noticed because nothing
 * tied the input layer to anything checkable. A controls screen that drifts is
 * worse than no controls screen at all, so `controls.test.ts` walks this table
 * against `actionForKey` in both directions.
 */
export interface ControlRow {
  /** What the key column prints. Display text — "1-3" is not a key. */
  keys: string;
  label: string;
  /**
   * The real `KeyboardEvent.key` values this row documents, ranges expanded.
   * This is the handle the drift test holds; `keys` is only for human eyes.
   */
  covers: string[];
  /**
   * Set when the key opens a UI mode instead of producing an Action, and the
   * value is the reason. Mirrors `UI_DRIVEN` in `test/sim/input.test.ts`: these
   * keys are legitimately absent from `actionForKey` and have to say why.
   */
  mode?: string;
}

export interface ControlGroup {
  title: string;
  rows: ControlRow[];
}

const ARROWS = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"];
/** 4-9. Written out because the binding is a range check, not a lookup. */
const HOTBAR_KEYS = ["4", "5", "6", "7", "8", "9"];

export const CONTROL_GROUPS: ControlGroup[] = [
  {
    title: "MOVE",
    rows: [
      { keys: "WASD / ↑↓←→", label: "move — walk into an enemy to knife it", covers: ["w", "a", "s", "d", ...ARROWS] },
      { keys: "SPACE / .", label: "wait — ends your turn", covers: [" ", "."] },
      { keys: ">", label: "take the stairs", covers: [">"] },
    ],
  },
  {
    title: "COMBAT",
    rows: [
      { keys: "F", label: "fire at the current target", covers: ["f"] },
      { keys: "TAB", label: "cycle target", covers: ["Tab"], mode: "targeting is UI-side; the sim only sees the chosen id" },
      { keys: "R", label: "reload — works the bolt if one is open", covers: ["r"] },
      { keys: "P", label: "slot a plate", covers: ["p"] },
    ],
  },
  {
    title: "GEAR",
    rows: [
      { keys: "1-3", label: "draw a weapon", covers: ["1", "2", "3"] },
      { keys: "4-9", label: "use an item — a grenade opens the throw cursor", covers: HOTBAR_KEYS },
      { keys: "G", label: "pick up what you are standing on", covers: ["g"] },
      { keys: "X", label: "drop, then a slot key", covers: ["x"], mode: "two-key mode: X selects, the next key names the slot" },
    ],
  },
];

/** Keys that dismiss the panel — printed in its footer, so keep the two in step. */
export const CLOSE_KEYS = new Set(["Escape", "?", "F1"]);
/** Keys that summon it. `?` is the roguelike convention; F1 is for everyone else. */
export const OPEN_KEYS = new Set(["?", "F1"]);
