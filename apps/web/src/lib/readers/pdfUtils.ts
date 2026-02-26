export type FitMode = 'fit-width' | 'fit-page' | 'custom';

export const ZOOM_STEPS = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0] as const;

// Clamps a page number to the valid range [1, total]
export function clampPage(page: number, total: number): number {
  return Math.max(1, Math.min(Math.floor(page), total));
}

// Computes the render scale for a given fit mode and container/page dimensions.
export function computeScale(
  fitMode: FitMode,
  containerW: number,
  containerH: number,
  pageW: number,
  pageH: number,
  customScale: number,
): number {
  if (fitMode === 'fit-width') return containerW / pageW;
  if (fitMode === 'fit-page') return Math.min(containerW / pageW, containerH / pageH);
  return customScale;
}

// Returns the next smaller zoom step, or null if already at minimum.
export function zoomOutStep(current: number): number | null {
  const smaller = ZOOM_STEPS.filter((s) => s < current - 0.01);
  return smaller.length ? smaller[smaller.length - 1] : null;
}

// Returns the next larger zoom step, or null if already at maximum.
export function zoomInStep(current: number): number | null {
  const larger = ZOOM_STEPS.filter((s) => s > current + 0.01);
  return larger.length ? larger[0] : null;
}

// Parses a stored progress string into a page number, defaulting to 1.
export function parseStoredPage(raw: string | null | undefined): number {
  if (!raw) return 1;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n >= 1 ? n : 1;
}
