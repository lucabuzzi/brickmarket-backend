import { useEffect, useRef, useState } from 'react';
import { fileKey } from '../../lib/sell/photos';
import { QUALITY, assessQuality, laplacianVariance, toGrayscale } from '../../lib/sell/quality';

/**
 * Reads a photo the seller just picked and measures it (size + sharpness, see lib/sell/quality.js).
 * Browser-only and best-effort: resolves to null if the image cannot be decoded, never throws.
 * It decodes the File itself (own object URL, revoked at the end), so it does not depend on the preview URLs.
 */
export function analyzePhoto(file) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const done = (result) => {
      URL.revokeObjectURL(url);
      resolve(result);
    };
    const img = new Image();
    img.onload = () => {
      try {
        const { naturalWidth: width, naturalHeight: height } = img;
        const cw = Math.max(3, Math.min(width, QUALITY.analysisWidth));
        const ch = Math.max(3, Math.round((height * cw) / width));
        const canvas = document.createElement('canvas');
        canvas.width = cw;
        canvas.height = ch;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, cw, ch);
        const { data } = ctx.getImageData(0, 0, cw, ch);
        const sharpness = laplacianVariance(toGrayscale(data, cw, ch), cw, ch);
        done({ width, height, sharpness, ...assessQuality({ width, height, sharpness }) });
      } catch {
        done(null);
      }
    };
    img.onerror = () => done(null);
    img.src = url;
  });
}

/** { [fileKey]: { small, blurry, ... } | null } for the given files, filled in as each one is measured. */
export default function usePhotoQuality(files) {
  const [results, setResults] = useState({});
  const seen = useRef(new Set());
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; };
  }, []);

  useEffect(() => {
    files.forEach(async (file) => {
      const key = fileKey(file);
      if (seen.current.has(key)) return;
      seen.current.add(key);
      const result = await analyzePhoto(file);
      if (alive.current) setResults((prev) => ({ ...prev, [key]: result }));
    });
  }, [files]);

  return results;
}
