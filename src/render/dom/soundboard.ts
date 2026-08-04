/**
 * Sound-test modal (docs/sound-design.md §8). A development tool: auditions
 * the generated palette in public/sounds/, grouped by manifest category.
 * Pure DOM + fetch — it never touches GameState, and while open it swallows
 * keydown at capture phase so auditioning can't spend AP in a permadeath run.
 *
 * Mounted only under import.meta.env.DEV, from the same dev-corner the debug
 * panel will occupy (ux-design.md §2) — this module is absent from every
 * build output, so nothing here may be imported by shipping code. (Importing
 * shipping code the other way — render/audio's player below — is fine.)
 */

import { playSound, unlockAudio } from "../audio";

export interface ManifestCategory {
  category: string;
  sounds: string[];
}

export interface FlatSound {
  name: string;
  category: number;
}

/** Manifest -> ordered flat list; arrow keys walk this. Pure, tested. */
export function flatten(manifest: ManifestCategory[]): FlatSound[] {
  return manifest.flatMap((cat, ci) => cat.sounds.map((name) => ({ name, category: ci })));
}

/** Wrapping step through the flat list. Pure, tested. */
export function step(index: number, delta: number, length: number): number {
  if (length === 0) return 0;
  return (((index + delta) % length) + length) % length;
}

/** First flat index of a category — Up/Down jump targets. Pure, tested. */
export function categoryStart(flat: FlatSound[], category: number): number {
  const at = flat.findIndex((s) => s.category === category);
  return at === -1 ? 0 : at;
}

/** Create the ♪ button in the dev corner and the modal root, then wire them. */
export function mountSoundboard(corner: HTMLElement): void {
  const button = document.createElement("button");
  button.className = "dev-btn";
  button.title = "Sound test";
  button.innerHTML = "&#9834; SFX";
  corner.append(button);
  const root = document.createElement("div");
  root.id = "soundboard";
  root.hidden = true;
  document.body.append(root);
  initSoundboard(button, root);
}

export function initSoundboard(button: HTMLElement, root: HTMLElement): void {
  let manifest: ManifestCategory[] = [];
  let flat: FlatSound[] = [];
  let open = false;
  let index = 0;

  function play(name: string): void {
    // The shipping WebAudio player — the board auditions exactly what the
    // game plays, mute toggle included.
    unlockAudio();
    playSound(name, 1);
  }

  function renderBoard(): void {
    root.hidden = !open;
    if (!open) return;
    const current = flat[index];
    const tabs = manifest
      .map(
        (cat, ci) =>
          `<button class="sb-tab${ci === current?.category ? " active" : ""}" data-cat="${ci}">${cat.category}</button>`,
      )
      .join("");
    const items = flat
      .map(
        (s, i) =>
          s.category === current?.category
            ? `<button class="sb-sound${i === index ? " active" : ""}" data-index="${i}">${s.name}</button>`
            : "",
      )
      .join("");
    root.innerHTML = `
      <div class="sb-box">
        <h1>SOUND TEST</h1>
        <div class="sb-tabs">${tabs}</div>
        <div class="sb-grid">${items}</div>
        <div class="sb-hint">←/→ step &amp; play · ↑/↓ category · Enter replay · Esc close</div>
      </div>`;
    root.querySelector(`.sb-sound.active`)?.scrollIntoView({ block: "nearest" });
  }

  function moveTo(next: number, audition: boolean): void {
    index = step(next, 0, flat.length);
    if (audition && flat[index]) play(flat[index]!.name);
    renderBoard();
  }

  async function openBoard(): Promise<void> {
    if (manifest.length === 0) {
      try {
        const res = await fetch("/sounds/manifest.json");
        manifest = (await res.json()) as ManifestCategory[];
        flat = flatten(manifest);
      } catch {
        manifest = [{ category: "no sounds found — run tools/soundgen/generate.py", sounds: [] }];
        flat = [];
      }
    }
    open = true;
    renderBoard();
  }

  button.addEventListener("click", () => {
    if (open) {
      open = false;
      renderBoard();
    } else void openBoard();
  });

  root.addEventListener("click", (e) => {
    const target = e.target as HTMLElement;
    if (target === root) {
      // Backdrop click closes — the box itself swallows clicks below.
      open = false;
      renderBoard();
      return;
    }
    const cat = target.getAttribute("data-cat");
    if (cat !== null) {
      moveTo(categoryStart(flat, Number(cat)), false);
      return;
    }
    const idx = target.getAttribute("data-index");
    if (idx !== null) moveTo(Number(idx), true);
  });

  // Capture phase: while the board is open the game must hear nothing.
  window.addEventListener(
    "keydown",
    (e) => {
      if (!open) return;
      e.preventDefault();
      e.stopPropagation();
      const current = flat[index];
      switch (e.key) {
        case "Escape":
          open = false;
          renderBoard();
          break;
        case "ArrowRight":
          moveTo(step(index, 1, flat.length), true);
          break;
        case "ArrowLeft":
          moveTo(step(index, -1, flat.length), true);
          break;
        case "ArrowDown":
          if (current) moveTo(categoryStart(flat, step(current.category, 1, manifest.length)), true);
          break;
        case "ArrowUp":
          if (current) moveTo(categoryStart(flat, step(current.category, -1, manifest.length)), true);
          break;
        case "Enter":
        case " ":
          if (current) play(current.name);
          break;
      }
    },
    true,
  );
}
