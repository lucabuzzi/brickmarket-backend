// Pure rules behind the photo crop editor (components/sell/CropEditor.jsx). No React, no browser globals, so
// the Jest suite can import them (same convention as the other modules in this folder).

/** Aspect ratios (width / height) the editor offers. The listing's portrait/landscape choice picks the first one. */
export const CROP_ASPECTS = Object.freeze({ portrait: 3 / 4, landscape: 4 / 3, square: 1 });
export const CROP_ASPECT_IDS = Object.keys(CROP_ASPECTS);

/** Which ratio the editor opens with: the same as the orientation chosen for the listing. */
export const initialCropAspect = (imageOrientation) => (imageOrientation === 'portrait' ? 'portrait' : 'landscape');

// The server shrinks everything to 1200px anyway; keep some headroom without sending a 12 MP file over mobile data.
export const CROP_MAX_SIDE = 1600;

/**
 * Size of the exported image for a crop region of `width` x `height` source pixels: the same shape, scaled down
 * (never up) so the longest side is at most `maxSide`.
 */
export function cropOutputSize(width, height, maxSide = CROP_MAX_SIDE) {
  const w = Math.max(1, Math.round(width));
  const h = Math.max(1, Math.round(height));
  const scale = Math.min(1, maxSide / Math.max(w, h));
  return { width: Math.max(1, Math.round(w * scale)), height: Math.max(1, Math.round(h * scale)) };
}

/**
 * Keeps a crop region inside the image (react-easy-crop can report fractions of a pixel past the edge) and
 * rounds it to whole pixels. Returns null when nothing usable is left.
 */
export function clampCropRegion(area, imageWidth, imageHeight) {
  if (!area || !(imageWidth > 0) || !(imageHeight > 0)) return null;
  const x = Math.min(Math.max(0, Math.round(area.x)), imageWidth - 1);
  const y = Math.min(Math.max(0, Math.round(area.y)), imageHeight - 1);
  const width = Math.min(Math.round(area.width), imageWidth - x);
  const height = Math.min(Math.round(area.height), imageHeight - y);
  return width >= 1 && height >= 1 ? { x, y, width, height } : null;
}

/** "IMG_0042.HEIC" -> "IMG_0042.jpg": the exported crop is always a JPEG. */
export function croppedFileName(name) {
  const base = String(name || 'photo').replace(/\.[^./\\]+$/, '') || 'photo';
  return `${base}.jpg`;
}
