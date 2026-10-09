import { CROP_MAX_SIDE, clampCropRegion, cropOutputSize, croppedFileName } from '../../lib/sell/crop';

const loadImage = (url) => new Promise((resolve, reject) => {
  const img = new Image();
  img.onload = () => resolve(img);
  img.onerror = () => reject(new Error('image_decode_failed'));
  img.src = url;
});

/**
 * Cuts `area` (source pixels, as reported by react-easy-crop) out of `file` and returns it as a new JPEG File.
 * The browser applies the photo's EXIF orientation when it decodes the <img>, which is the same picture the
 * crop editor shows, so the coordinates line up. Resolves to null if the crop cannot be produced.
 */
export async function cropImageFile(file, area, maxSide = CROP_MAX_SIDE) {
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    const region = clampCropRegion(area, img.naturalWidth, img.naturalHeight);
    if (!region) return null;
    const out = cropOutputSize(region.width, region.height, maxSide);
    const canvas = document.createElement('canvas');
    canvas.width = out.width;
    canvas.height = out.height;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, region.x, region.y, region.width, region.height, 0, 0, out.width, out.height);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.9));
    if (!blob) return null;
    return new File([blob], croppedFileName(file.name), { type: 'image/jpeg', lastModified: Date.now() });
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}
