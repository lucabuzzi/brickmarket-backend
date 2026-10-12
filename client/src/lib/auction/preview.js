// Turns the wizard state into the listing object the real <ListingCard> renders (as a live, bid-free
// auction), so the live preview is the card buyers will actually see.
import { isPositive, parseDecimal, auctionEndDate } from './form.js';
import { PREVIEW_PLACEHOLDER } from '../sell/preview.js';

export { PREVIEW_PLACEHOLDER };

/**
 * @param {object} form
 * @param {{sellerName?: string, image?: string}} opts  image = URL of the first photo (blob:, data: or http)
 */
export function buildPreviewListing(form, { sellerName = '', image = '' } = {}) {
  const bid = parseDecimal(form.startingBid);
  const end = auctionEndDate(form);
  return {
    id: 'preview',
    title: String(form.title || '').trim(),
    type: 'auction',
    is_auction: true,
    current_bid: isPositive(form.startingBid) ? bid : null,
    auction_start: isPositive(form.startingBid) ? bid : null,
    auction_end: end ? end.toISOString() : null,
    bids_count: 0,
    status: 'active',
    condition: form.condition || '—',
    product_type: form.productType,
    game: form.game || null,
    set_number: String(form.setNumber || '').trim() || null,
    images: [image || PREVIEW_PLACEHOLDER],
    seller_username: sellerName,
  };
}
