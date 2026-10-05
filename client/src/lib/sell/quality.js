// Soft photo-quality hints. They never block anything: a seller can always publish, we only say
// "this one looks small / a little blurry, retake it if you can".
//
// Two cheap checks, both done in the browser on the file just picked:
//   small   - the long side is under MIN_LONG_SIDE pixels (the server shows photos up to 1200px wide)
//   blurry  - low sharpness: variance of the Laplacian of a grayscale thumbnail (the classic focus measure).
//             Sharp photos have lots of strong edges (high variance), out-of-focus or motion-blurred ones do not.
// Pure functions on plain arrays, so they are tested without a browser; reading pixels lives in the component folder.

// blurThreshold was calibrated on real listing photos from this site, measured at analysisWidth: sharp photos with
// texture scored 196-3233; the same photos softened to 1/3 of their resolution scored 21-61, to 1/4 below 35, to
// 1/6 below 15. 60 therefore flags clear blur and leaves a wide margin below every sharp photo tested. It cannot
// see mild blur, and graphic/screenshot-like images (big hard edges) always read as sharp: that is the price of
// never nagging about a good photo. Plain low-texture subjects (white box on white) may be flagged by mistake,
// which is why the hint is soft.
export const QUALITY = {
  minLongSide: 800,
  analysisWidth: 640, // the thumbnail the sharpness is measured on (small enough to be fast, large enough to see blur)
  blurThreshold: 60,
};

/** RGBA bytes (canvas ImageData.data) -> luma 0..255 per pixel. */
export function toGrayscale(rgba, width, height) {
  const out = new Float32Array(width * height);
  for (let i = 0, p = 0; i < out.length; i += 1, p += 4) {
    out[i] = 0.299 * rgba[p] + 0.587 * rgba[p + 1] + 0.114 * rgba[p + 2];
  }
  return out;
}

/** Variance of the 3x3 Laplacian response over the interior pixels. 0 for a flat image. */
export function laplacianVariance(gray, width, height) {
  if (width < 3 || height < 3) return 0;
  let sum = 0;
  let sumSq = 0;
  let n = 0;
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const i = y * width + x;
      const r = gray[i - width] + gray[i + width] + gray[i - 1] + gray[i + 1] - 4 * gray[i];
      sum += r;
      sumSq += r * r;
      n += 1;
    }
  }
  const mean = sum / n;
  return sumSq / n - mean * mean;
}

/** -> { small, blurry } from the photo's size and its measured sharpness (null sharpness = unknown = fine). */
export function assessQuality({ width, height, sharpness }) {
  const longSide = Math.max(width || 0, height || 0);
  return {
    small: longSide > 0 && longSide < QUALITY.minLongSide,
    blurry: typeof sharpness === 'number' && Number.isFinite(sharpness) && sharpness < QUALITY.blurThreshold,
  };
}
