// Alt text for images that carry information a screen reader user would otherwise miss.
// Rule of thumb: describe the image only when no visible text next to it already names it; in that
// case (thumbnail + title in the same link) keep alt="" instead of making the title be read twice.

const MAX_ALT_LENGTH = 125;

const clip = (text) => (text.length > MAX_ALT_LENGTH ? `${text.slice(0, MAX_ALT_LENGTH - 1).trimEnd()}…` : text);

/** "Titolo, Nuovo" from a listing/auction row; falls back to the title alone when the condition is unknown. */
export function altForListing(listing, t) {
  const title = String(listing?.title || '').trim();
  if (!title) return '';
  const condition = String(listing?.condition || '').trim();
  const label = condition ? t(`details.condition_${condition.toLowerCase()}`, { defaultValue: '' }) : '';
  return clip(label ? `${title}, ${label}` : title);
}

/** Accessible name for gallery thumbnail buttons: "Titolo, foto 2 di 5". */
export function galleryPhotoLabel(title, index, total, t) {
  return t('a11y.gallery_photo', { title: String(title || '').trim(), index: index + 1, total }).replace(/^,\s*/, '');
}
