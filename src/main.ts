import { createDisplay } from "./render/display";
import { renderState } from "./render/draw";
import { moveForKey } from "./input/keyboard";
import { movePlayer, newGame } from "./sim/state";
import { randomSeed, seedFromUrl, writeSeedToUrl } from "./seed";

const display = createDisplay();
const container = display.getContainer();
if (!container) throw new Error("rot.js display has no container");
document.body.appendChild(container);

const seed = seedFromUrl() ?? randomSeed();
writeSeedToUrl(seed);
let state = newGame(seed);
renderState(display, state);

window.addEventListener("keydown", (e) => {
  const move = moveForKey(e);
  if (!move) return;
  e.preventDefault();
  movePlayer(state, move.dx, move.dy);
  renderState(display, state);
});
