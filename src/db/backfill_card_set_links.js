/**
 * Data backfill: links the card listings published before the expansion catalogs to their expansion and card
 * (listings.card_set_id / card_number / card_external_id), using the checked list in data/cardSetLinks.js.
 *
 * Needs migrate_card_sets.js to have run. Only touches the listed ids, only card listings of the entry's game, and only when
 * they have no link yet, so it never overwrites something a seller chose: safe to run more than once.
 *
 * Reversible (always through the wrapper — src/db/index.js refuses direct runs):
 *   node scripts/run-db-script.js src/db/backfill_card_set_links.js --target=production          (link)
 *   node scripts/run-db-script.js src/db/backfill_card_set_links.js --target=production --down   (unlink)
 * "--down" clears the link only where it is still exactly what this script wrote.
 */
require('dotenv').config();
const { query } = require('./index');
const { CARD_SET_LINKS } = require('./data/cardSetLinks');

async function up() {
  let linked = 0;
  for (const l of CARD_SET_LINKS) {
    const r = await query(
      `UPDATE public.listings
          SET card_set_id = $2, card_number = $3, card_external_id = $4
        WHERE id = $1 AND product_type = 'tcg' AND game = $5 AND card_set_id IS NULL`,
      [l.id, l.cardSetId, l.cardNumber, l.cardExternalId, l.game || 'pokemon']
    );
    linked += r.rowCount;
    console.log(`${r.rowCount ? '✅ linked  ' : '⏭  skipped '} ${l.title}  ->  ${l.cardSetId} #${l.cardNumber}`);
  }
  console.log(`Done: ${linked} of ${CARD_SET_LINKS.length} listings linked.`);
}

async function down() {
  let unlinked = 0;
  for (const l of CARD_SET_LINKS) {
    const r = await query(
      `UPDATE public.listings
          SET card_set_id = NULL, card_number = NULL, card_external_id = NULL
        WHERE id = $1 AND card_set_id = $2 AND card_external_id = $3`,
      [l.id, l.cardSetId, l.cardExternalId]
    );
    unlinked += r.rowCount;
    console.log(`${r.rowCount ? '✅ unlinked' : '⏭  skipped '} ${l.title}`);
  }
  console.log(`Done: ${unlinked} of ${CARD_SET_LINKS.length} listings unlinked.`);
}

const direction = process.argv.includes('--down') ? down : up;

direction()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌  Backfill failed:', err);
    process.exit(1);
  });

module.exports = { up, down };
