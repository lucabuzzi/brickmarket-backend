// Placing a bid: one transaction that locks the listing, applies the auction rules (bidding.js), stores the
// bid and the new top price, then tells the previous top bidder they were outbid.
const { getClient } = require('../../db');
const HttpError = require('../../http/HttpError');
const repo = require('./listings.repository');
const { assertBiddable, assertAmountAccepted, extendedAuctionEnd } = require('./bidding');

/**
 * @returns the listing row after the bid
 * @throws HttpError for every refusal; any failure inside the transaction is answered with its own message
 *   (status 400 unless it carries one), as the original route did
 */
async function placeBid(listingId, bidderId, rawAmount) {
  const amount = parseFloat(rawAmount);
  if (isNaN(amount) || amount <= 0) throw new HttpError(400, 'Invalid Number');

  // Outside the try on purpose: a pool failure here is not answered, exactly as before (see http/handle.js).
  const client = await getClient();
  try {
    await client.query('BEGIN');

    const listing = await repo.lockForBid(client, listingId);
    const now = new Date();
    assertBiddable(listing, bidderId, now);
    assertAmountAccepted(listing, amount);
    const newAuctionEnd = extendedAuctionEnd(listing, now);

    const previousBidderId = await repo.findTopBidderId(client, listingId);
    await repo.insertBid(client, listingId, bidderId, amount);
    const updated = await repo.recordTopBid(client, listingId, amount, newAuctionEnd);

    await client.query('COMMIT');

    // Not awaited: the bid is already committed, the notification must not delay the answer.
    if (previousBidderId && previousBidderId !== bidderId) {
      repo.insertOutbidNotification(client, previousBidderId, listingId)
        .catch((err) => console.error('Outbid notification error:', err));
    }
    return updated;
  } catch (err) {
    await client.query('ROLLBACK');
    if (err instanceof HttpError) throw err;
    throw new HttpError(err.status || 400, err.message);
  } finally {
    client.release();
  }
}

module.exports = { placeBid };
