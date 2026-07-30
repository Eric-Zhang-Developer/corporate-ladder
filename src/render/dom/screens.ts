import type { GameState } from "../../sim/state";

/** Death / win overlays. Restart input stays on the keyboard (Enter / S). */
export function updateScreens(overlay: HTMLElement, state: GameState): void {
  if (state.phase === "playing") {
    overlay.hidden = true;
    return;
  }
  const won = state.phase === "won";
  overlay.hidden = false;
  overlay.innerHTML = `
    <div class="end-box ${won ? "won" : "dead"}">
      <h1>${won ? "EXIT INTERVIEW PASSED" : "TERMINATED"}</h1>
      <p>${won ? `Cleared the slice — Seed ${state.seed} — Turn ${state.turn}` : escapeHtml(state.killedBy ?? "You die.")}</p>
      <p class="hint">[Enter] new run &nbsp;&nbsp; [S] same seed</p>
    </div>
  `;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
