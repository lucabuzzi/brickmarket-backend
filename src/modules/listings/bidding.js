// Auction rules, pure: who may bid, the minimum next bid, and anti-sniping. No DB, no HTTP.
const HttpError = require('../../http/HttpError');

const MIN_INCREMENT = 1.00;
const ANTI_SNIPING_MS = 2 * 60 * 1000;

/**
 * Throws the HttpError a bidder sees when `listing` can't take a bid from them right now.
 * Statuses kept from the original route: 400 by default, 410 once ended, 403 on one's own listing.
 */
function assertBiddable(listing, bidderId, now) {
  if (!listing) throw new HttpError(400, 'Annuncio non trovato');
  if (!listing.is_auction && listing.type !== 'auction') throw new HttpError(400, 'Questo articolo non è un\'asta');
  if (listing.status !== 'active') throw new HttpError(400, 'L\'asta non è attiva');
  const auctionEnd = auctionEndOf(listing);
  if (auctionEnd && auctionEnd < now) throw new HttpError(410, 'Questa asta è già terminata.');
  if (listing.seller_id === bidderId) throw new HttpError(403, 'Non puoi fare un\'offerta sul tuo annuncio');
}

function auctionEndOf(listing) {
  return listing.auction_end ? new Date(listing.auction_end) : null;
}

/** The first bid must reach the starting price; later ones must beat the current bid by MIN_INCREMENT. */
function minimumBid(listing) {
  const isFirstBid = listing.bids_count === 0;
  if (isFirstBid) return parseFloat(listing.starting_price || listing.auction_start || 0);
  return parseFloat(listing.current_bid || 0) + MIN_INCREMENT;
}

function assertAmountAccepted(listing, amount) {
  const required = minimumBid(listing);
  if (amount < required) {
    throw new HttpError(400, `Offerta troppo bassa. Il minimo richiesto è ${required.toFixed(2)}€`);
  }
}

/** A bid in the last two minutes pushes the end to two minutes from now; otherwise null (end unchanged). */
function extendedAuctionEnd(listing, now) {
  const auctionEnd = auctionEndOf(listing);
  if (auctionEnd && (auctionEnd.getTime() - now.getTime()) <= ANTI_SNIPING_MS) {
    return new Date(now.getTime() + ANTI_SNIPING_MS);
  }
  return null;
}

module.exports = { assertBiddable, minimumBid, assertAmountAccepted, extendedAuctionEnd, MIN_INCREMENT };
