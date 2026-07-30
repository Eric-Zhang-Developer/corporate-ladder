import { createDisplay } from "./render/display";
import { renderState } from "./render/draw";
import { actionForKey } from "./input/keyboard";
import { applyAction } from "./sim/step";
import { newGame } from "./sim/state";
import { randomSeed, seedFromUrl, writeSeedToUrl } from "./seed";

const display = createDisplay();
const container = display.getContainer();
if (!container) throw new Error("rot.js display has no container");
document.body.appendChild(container);

let seed = seedFromUrl() ?? randomSeed();
writeSeedToUrl(seed);
let state = newGame(seed);
renderState(display, state);

window.addEventListener("keydown", (e) => {
  if (state.phase === "dead") {
    if (e.key === "Enter") {
      seed = randomSeed();
      writeSeedToUrl(seed);
      state = newGame(seed);
    } else if (e.key.toLowerCase() === "s") {
      state = newGame(seed);
    } else {
      return;
    }
    e.preventDefault();
  } else {
    const action = actionForKey(e);
    if (!action) return;
    e.preventDefault();
    state = applyAction(state, action);
  }
  renderState(display, state);
});
