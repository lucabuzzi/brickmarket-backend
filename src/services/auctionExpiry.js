const { query } = require('../db');

/**
 * Lazy housekeeping: marks ended auctions as expired. Called inline from the
 * listings routes rather than on a cron, since there's no scheduler tick
 * dedicated to it — any GET that lists/archives listings triggers it.
 */
async function expireEndedAuctions() {
  try {
    await query(
      `UPDATE listings SET status = 'expired' WHERE status = 'active' AND type = 'auction' AND auction_end < NOW()`
    );
  } catch (err) {
    console.error('AUCTION EXPIRE ERROR:', err.message);
  }
}

module.exports = { expireEndedAuctions };
