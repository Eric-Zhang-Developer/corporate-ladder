/**
 * A fixed world span keeps weapon ranges the same apparent size on every
 * display. CSS scales this logical canvas into the available UI rectangle;
 * the renderer never changes how much of the floor a larger monitor reveals.
 *
 * Twenty-one rows are the conservative zoom: ten tiles above and below the
 * player, enough to contain the maximum nine-tile player FOV. Overwatch may
 * reach farther only because its lane is explicitly rendered from off-screen.
 */
export const CAMERA_COLUMNS = 34;
export const CAMERA_ROWS = 21;

export interface CameraRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Visible charge sources keep their existing warning. Overwatch alone may
 * warn from beyond sight: the clipped lane is what makes its range fair.
 */
export function chargeLineIsVisible(
  chargeTimer: number | undefined,
  sourceIsHidden: boolean,
  sourceIsVisible: boolean,
  behavior: string,
  revealAll: boolean,
): boolean {
  if (chargeTimer === undefined || (sourceIsHidden && !revealAll)) return false;
  return sourceIsVisible || behavior === "overwatch";
}

/** Center on the player where possible, then clamp to the floor's edges. */
export function cameraRect(
  mapWidth: number,
  mapHeight: number,
  playerX: number,
  playerY: number,
): CameraRect {
  const width = Math.min(CAMERA_COLUMNS, mapWidth);
  const height = Math.min(CAMERA_ROWS, mapHeight);
  const centeredX = playerX - Math.floor(width / 2);
  const centeredY = playerY - Math.floor(height / 2);

  return {
    x: Math.max(0, Math.min(centeredX, mapWidth - width)),
    y: Math.max(0, Math.min(centeredY, mapHeight - height)),
    width,
    height,
  };
}
