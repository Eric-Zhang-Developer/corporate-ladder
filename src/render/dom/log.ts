import type { GameState } from "../../sim/state";
import { evictCount, logDelta, stickToBottom } from "../log";

/**
 * The message log: a scrollback region plus a fixed hint row.
 *
 * Built once and appended to per action — see `render/log.ts` for why appending
 * rather than rewriting. That makes this the one renderer module holding
 * mutable cursor state, so it returns an updater closure (the shape
 * `mountDebugPanel` uses) rather than exporting an `update(root, …)` that would
 * need module globals to remember where it was.
 */
export function buildLog(root: HTMLElement): (state: GameState, hint: string) => void {
  root.innerHTML = `<div id="log-scroll"></div><div id="log-hint"></div>`;
  const scroll = root.querySelector<HTMLElement>("#log-scroll")!;
  const hintRow = root.querySelector<HTMLElement>("#log-hint")!;

  let seenSeq = 0;
  /** Last action's rows, held so they can be demoted when the next batch lands. */
  let fresh: HTMLElement[] = [];
  let lastState: GameState | null = null;

  return function updateLog(state: GameState, hint: string): void {
    // Restarts reassign `state` to a new object while applyAction mutates in
    // place, so identity is the restart signal — no reset call for a new call
    // site to forget. logSeq is the belt-and-braces check for an in-place one.
    if (state !== lastState || state.logSeq < seenSeq) {
      scroll.replaceChildren();
      fresh = [];
      seenSeq = 0;
      lastState = state;
    }

    const rows = logDelta(state.log, state.logSeq, seenSeq);
    if (rows.length > 0) {
      // Before the append: afterwards everything is at the bottom by
      // construction and the reader's scroll intent is gone.
      const stick = stickToBottom(scroll);

      for (const row of fresh) row.className = "old";
      fresh = rows.map((text) => {
        const line = document.createElement("div");
        line.className = "new";
        // textContent, not innerHTML: the log is about to carry spot lines,
        // telegraphs and CEO dialogue, and this closes the injection seam
        // structurally rather than by remembering to escape.
        line.textContent = text;
        scroll.append(line);
        return line;
      });

      // Evict only while pinned. Trimming under a scrolled-up reader shifts
      // the text they are reading — the exact failure appending exists to
      // avoid — so the buffer is allowed to run long until they come back.
      if (stick) {
        const drop = evictCount(scroll.childElementCount - rows.length, rows.length);
        for (let i = 0; i < drop; i++) scroll.firstElementChild?.remove();
        scroll.scrollTop = scroll.scrollHeight;
      }
      seenSeq = state.logSeq;
    }

    // Outside the branch: entering drop or throw mode changes the hint without
    // pushing any log line.
    hintRow.textContent = hint;
  };
}
