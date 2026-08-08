import { describe, expect, it } from "vitest";
import { CONTROL_GROUPS, type ControlRow } from "../../src/input/controls";
import { actionForKey } from "../../src/input/keyboard";
import { controlsBox } from "../../src/render/dom/screens";

/**
 * A controls screen that drifts is worse than no controls screen: it teaches
 * the wrong thing with authority. `P` and `4`-`9` once shipped unbound, so the
 * failure mode is not hypothetical. These walk the printed table against the
 * real bindings in BOTH directions — a key can neither be advertised without
 * working nor work without being advertised.
 */
const ROWS: ControlRow[] = CONTROL_GROUPS.flatMap((g) => g.rows);

function press(key: string) {
  return actionForKey({ key } as KeyboardEvent);
}

describe("the printed keymap matches the real one", () => {
  it("advertises nothing that does not work", () => {
    for (const row of ROWS) {
      if (row.mode) continue; // reached through a UI mode, not an Action
      for (const key of row.covers) {
        expect(press(key), `panel lists "${row.keys}" but ${JSON.stringify(key)} is dead`).not.toBeNull();
      }
    }
  });

  it("leaves nothing that works undocumented", () => {
    // Same alphabet input.test.ts walks, so the two stay in step.
    const KEYSPACE = [
      ..."abcdefghijklmnopqrstuvwxyz0123456789 .><".split(""),
      "ArrowUp",
      "ArrowDown",
      "ArrowLeft",
      "ArrowRight",
    ];
    const documented = new Set(ROWS.flatMap((r) => r.covers));
    for (const key of KEYSPACE) {
      if (!press(key)) continue;
      expect(documented.has(key), `${JSON.stringify(key)} is bound but the panel never mentions it`).toBe(true);
    }
  });

  it("makes every mode row say why it is not a binding", () => {
    for (const row of ROWS) {
      if (press(row.covers[0]!)) continue;
      expect(row.mode, `${row.keys} resolves to no action and gives no reason`).toBeTruthy();
    }
  });
});

describe("the rendered panel", () => {
  const html = controlsBox();

  it("prints every group and every row", () => {
    for (const group of CONTROL_GROUPS) {
      expect(html).toContain(group.title);
      for (const row of group.rows) expect(html).toContain(row.label);
    }
  });

  it("escapes the keys that are HTML — > is a real binding", () => {
    expect(html).toContain("&gt;");
    expect(html).not.toMatch(/<span class="ctrl-keys">>/);
  });

  it("names its own exit, since nothing on screen is clickable", () => {
    expect(html).toContain("[ESC]");
  });
});
