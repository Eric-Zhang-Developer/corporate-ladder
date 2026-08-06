/**
 * Pure log-panel logic: which lines arrived, whether to stay pinned to the
 * bottom, how many rows to evict.
 *
 * The panel appends rather than rewrites. Rewriting innerHTML and restoring
 * scrollTop is simpler but wrong in one specific way: when the buffer trims at
 * the top while the reader is scrolled up, the restored offset points a line
 * lower and the text slides under them. Appending makes that unrepresentable —
 * at the cost of the renderer needing to know what is new, which is what
 * `GameState.logSeq` is for.
 */

/**
 * DOM rows kept. Deliberately not the sim's LOG_LIMIT: that one bounds
 * serialized state, this one bounds nodes. Growing the sim's window for a
 * presentational reason would grow every save.
 */
export const SCROLLBACK = 100;

/** Browsers don't land on exactly 0 under zoom or fractional line-heights. */
export const STICK_EPS = 2;

export interface ScrollMetrics {
  scrollTop: number;
  scrollHeight: number;
  clientHeight: number;
}

/**
 * Must be measured BEFORE appending — after the write, everything is at the
 * bottom by construction and the reader's intent is lost.
 */
export function stickToBottom(m: ScrollMetrics): boolean {
  // clientHeight 0 is first paint (or a hidden panel): there is no scroll
  // position to preserve yet, so the honest answer is "pin me".
  if (m.clientHeight === 0) return true;
  return m.scrollHeight - m.scrollTop - m.clientHeight <= STICK_EPS;
}

/** Lines that arrived since `seenSeq`, clamped to what the window still holds. */
export function logDelta(log: string[], logSeq: number, seenSeq: number): string[] {
  // The clamp covers a frame gap wider than the sim's window — impossible
  // today (a render runs every dispatch) but degrading to "show the whole
  // window" beats duplicating lines or slicing past the end if that changes.
  const pending = Math.min(Math.max(0, logSeq - seenSeq), log.length);
  return pending === 0 ? [] : log.slice(log.length - pending);
}

/** How many rows to drop from the front so `current + incoming` fits `max`. */
export function evictCount(current: number, incoming: number, max = SCROLLBACK): number {
  return Math.max(0, current + incoming - max);
}
