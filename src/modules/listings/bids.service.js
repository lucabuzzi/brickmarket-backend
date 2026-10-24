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

  // Outside the try: there's no transaction to roll back yet; the controller answers a pool failure with 500.
  const client = await getClient();
  let brokenConnection;
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

    // Not awaited: the bid is already committed, the notification must not delay the answer. It goes through
    // the pool, not `client`, which is released (and may be handed to another request) before it runs.
    if (previousBidderId && previousBidderId !== bidderId) {
      repo.insertOutbidNotification(previousBidderId, listingId)
        .catch((err) => console.error('Outbid notification error:', err));
    }
    return updated;
  } catch (err) {
    // A failed ROLLBACK (connection lost) must not hide the error that caused it, and that connection must
    // not go back to the pool.
    await client.query('ROLLBACK').catch((rbErr) => {
      console.error('Bid ROLLBACK error:', rbErr.message);
      brokenConnection = rbErr;
    });
    if (err instanceof HttpError) throw err;
    throw new HttpError(err.status || 400, err.message);
  } finally {
    client.release(brokenConnection);
  }
}

module.exports = { placeBid };
