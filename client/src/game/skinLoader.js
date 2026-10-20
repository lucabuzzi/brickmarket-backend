// Loads the character sheets (PNG + region mask) once and builds the player's recoloured sheet on demand.
// Browser-only (Image, canvas, Vite asset URLs); the pure recolouring maths lives in lib/game/skins.js.
import manifest from '../assets/game/skins/manifest.json';
import { FRAME, COLS, ROWS, recolorPixels, sanitizeAvatar } from '../lib/game/skins';

const urls = import.meta.glob('../assets/game/skins/*.png', { eager: true, query: '?url', import: 'default' });
const urlOf = (name) => urls[`../assets/game/skins/${name}.png`];
const cache = new Map();

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

async function loadLook(look) {
  if (!cache.has(look)) {
    cache.set(look, (async () => {
      const [sheetImg, maskImg] = await Promise.all([loadImage(urlOf(look)), loadImage(urlOf(`${look}-mask`))]);
      const w = FRAME.w * COLS;
      const h = FRAME.h * ROWS.length;
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(sheetImg, 0, 0);
      const sheet = ctx.getImageData(0, 0, w, h).data;
      ctx.clearRect(0, 0, w, h);
      ctx.drawImage(maskImg, 0, 0);
      const rgba = ctx.getImageData(0, 0, w, h).data;
      const mask = new Uint8Array(w * h);
      for (let k = 0; k < w * h; k++) mask[k] = rgba[k * 4];
      return { sheet, mask, w, h, stats: manifest.looks[look].regions };
    })());
  }
  return cache.get(look);
}

/** The whole sheet (4 rows x 4 frames of 48x56) of `avatar`, recoloured, as a canvas. */
export async function buildAvatarSheet(avatar) {
  const a = sanitizeAvatar(avatar);
  const { sheet, mask, w, h, stats } = await loadLook(a.look);
  const pixels = recolorPixels(sheet, mask, stats, a);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  canvas.getContext('2d').putImageData(new ImageData(pixels, w, h), 0, 0);
  return canvas;
}
