export function randomSeed(): number {
  return Math.floor(Math.random() * 1_000_000_000);
}

export function seedFromUrl(): number | null {
  const raw = new URLSearchParams(window.location.search).get("seed");
  if (raw === null) return null;
  const n = Number(raw);
  return Number.isInteger(n) && n >= 0 ? n : null;
}

export function writeSeedToUrl(seed: number): void {
  const url = new URL(window.location.href);
  url.searchParams.set("seed", String(seed));
  history.replaceState(null, "", url);
}
