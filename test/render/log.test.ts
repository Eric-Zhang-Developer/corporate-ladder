import { describe, expect, it } from "vitest";
import { evictCount, logDelta, SCROLLBACK, stickToBottom, STICK_EPS } from "../../src/render/log";

/**
 * The log panel appends rather than rewrites, which buys scrollback that
 * doesn't slide under the reader — and costs three decisions the sim cannot
 * see and the bot never renders: what arrived since the last frame, whether
 * the reader wants to stay pinned, and when it is safe to trim. Each has a
 * failure mode that reads as "the log is haunted" rather than as an exception.
 */

describe("stickToBottom", () => {
  it("pins when the viewport is already at the bottom", () => {
    expect(stickToBottom({ scrollTop: 400, scrollHeight: 500, clientHeight: 100 })).toBe(true);
  });

  it("releases when the reader has scrolled up", () => {
    expect(stickToBottom({ scrollTop: 0, scrollHeight: 500, clientHeight: 100 })).toBe(false);
    expect(stickToBottom({ scrollTop: 200, scrollHeight: 500, clientHeight: 100 })).toBe(false);
  });

  it("tolerates subpixel rounding at the bottom", () => {
    // Zoom and fractional line-heights leave a sliver; treating it as
    // "scrolled up" would silently kill autoscroll for anyone not at 100%.
    expect(stickToBottom({ scrollTop: 400 - STICK_EPS, scrollHeight: 500, clientHeight: 100 })).toBe(true);
    expect(stickToBottom({ scrollTop: 400 - STICK_EPS - 1, scrollHeight: 500, clientHeight: 100 })).toBe(false);
  });

  it("pins on first paint, when there is no scroll position yet", () => {
    expect(stickToBottom({ scrollTop: 0, scrollHeight: 0, clientHeight: 0 })).toBe(true);
  });

  it("pins when the content is shorter than the viewport", () => {
    expect(stickToBottom({ scrollTop: 0, scrollHeight: 40, clientHeight: 100 })).toBe(true);
  });
});

describe("logDelta", () => {
  it("returns nothing when no line has been pushed since the last frame", () => {
    expect(logDelta(["a", "b"], 2, 2)).toEqual([]);
  });

  it("returns the whole window on the first frame", () => {
    expect(logDelta(["a", "b"], 2, 0)).toEqual(["a", "b"]);
  });

  it("returns every line an action pushed, not just the last", () => {
    // An enemy turn dumps several lines at once; all of them are new.
    expect(logDelta(["a", "b", "c", "d"], 4, 1)).toEqual(["b", "c", "d"]);
  });

  it("reads through the sim's window trim", () => {
    // The window dropped its front, so index 0 is no longer line 0 — the
    // delta has to be counted from the tail, which is the whole point of seq.
    expect(logDelta(["c", "d", "e"], 5, 4)).toEqual(["e"]);
  });

  it("clamps a gap wider than the window instead of slicing past its end", () => {
    expect(logDelta(["c", "d", "e"], 40, 1)).toEqual(["c", "d", "e"]);
  });

  it("returns nothing if the counter is behind (a restart mid-frame)", () => {
    expect(logDelta(["a"], 1, 90)).toEqual([]);
  });
});

describe("evictCount", () => {
  it("keeps everything below the cap", () => {
    expect(evictCount(10, 3)).toBe(0);
    expect(evictCount(SCROLLBACK - 3, 3)).toBe(0);
  });

  it("drops exactly the overflow", () => {
    expect(evictCount(SCROLLBACK, 1)).toBe(1);
    expect(evictCount(SCROLLBACK - 2, 5)).toBe(3);
  });

  it("catches up when the buffer ran long while the reader was scrolled up", () => {
    expect(evictCount(SCROLLBACK + 20, 2)).toBe(22);
  });
});
