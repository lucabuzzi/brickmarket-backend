// Turns the wizard state into the listing object the real <ListingCard> renders, so the live preview is the
// card buyers will actually see.
import { isPositive, parseDecimal } from './form.js';

// Branded stand-in shown until a photo is chosen (a data: URI, so it needs no network request).
const PLACEHOLDER_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600">' +
  '<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#17141f"/><stop offset="1" stop-color="#0d0c12"/></linearGradient></defs>' +
  '<rect width="800" height="600" fill="url(#g)"/>' +
  '<g fill="none" stroke="#c6ff3d" stroke-width="10" stroke-linecap="round" stroke-linejoin="round" opacity=".85">' +
  '<path d="M300 250h40l22-34h76l22 34h40a22 22 0 0 1 22 22v130a22 22 0 0 1-22 22H300a22 22 0 0 1-22-22V272a22 22 0 0 1 22-22z"/>' +
  '<circle cx="400" cy="337" r="48"/></g></svg>';

export const PREVIEW_PLACEHOLDER = `data:image/svg+xml;utf8,${encodeURIComponent(PLACEHOLDER_SVG)}`;

/**
 * @param {object} form
 * @param {{sellerName?: string, image?: string}} opts  image = URL of the first photo (blob:, data: or http)
 */
export function buildPreviewListing(form, { sellerName = '', image = '' } = {}) {
  const price = parseDecimal(form.price);
  return {
    id: 'preview',
    title: String(form.title || '').trim(),
    price: isPositive(form.price) ? price : null,
    type: 'used',
    status: 'active',
    // "—" renders as a neutral badge; leaving it empty would make the card say "Usato" before the seller chose
    condition: form.condition || '—',
    product_type: form.productType,
    game: form.game || null,
    set_number: String(form.setNumber || '').trim() || null,
    images: [image || PREVIEW_PLACEHOLDER],
    seller_username: sellerName,
  };
}
