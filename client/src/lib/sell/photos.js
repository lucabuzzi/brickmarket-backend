// Rules for adding photos to a listing. Choosing or dropping files ADDS to what is already selected (the page
// used to replace the selection on every pick), skips what is not an image or is already there, and stops at
// the maximum, reporting what it left out so the page can say so.
import { MAX_PHOTOS } from './form.js';

export const fileKey = (f) => `${f.name}|${f.size}|${f.lastModified}`;
export const isImageFile = (f) => !!f && typeof f.type === 'string' && f.type.startsWith('image/');

/**
 * @param {File[]} current   photos already selected
 * @param {File[]} incoming  files the seller just picked or dropped
 * @returns {{files: File[], notImage: number, duplicates: number, overflow: number}}
 */
export function mergePhotos(current, incoming, max = MAX_PHOTOS) {
  const seen = new Set(current.map(fileKey));
  const files = [...current];
  let notImage = 0;
  let duplicates = 0;
  let overflow = 0;
  for (const f of incoming) {
    if (!isImageFile(f)) { notImage += 1; continue; }
    if (seen.has(fileKey(f))) { duplicates += 1; continue; }
    if (files.length >= max) { overflow += 1; continue; }
    seen.add(fileKey(f));
    files.push(f);
  }
  return { files, notImage, duplicates, overflow };
}

export const removePhotoAt = (files, index) => files.filter((_, i) => i !== index);
