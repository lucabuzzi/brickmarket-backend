// Live-data parts of the content shell: lists of active listings for hubs/categories/home, and the
// full text of a listing page. Only public data of ACTIVE listings is used (title, description, price,
// condition, category); never seller identity, addresses or anything else the public page does not show.
// Every read goes through cache.js (5 min, bounded time) so crawler traffic cannot hammer the database.
const { query } = require('../../db');
const { cached } = require('./cache');
const { esc, link, paragraphs, list, section } = require('./html');
const { t } = require('./copy');
const { eur, conditionLabel, TYPE_LABELS } = require('../listingText');

const TTL_MS = 5 * 60 * 1000;

const priceOf = (l) => eur(l.type === 'auction' ? l.current_bid ?? l.auction_start : l.price);

/** Same visibility rules as the public API: active, and auctions that have not already ended. */
async function fetchListings({ auction, productType, game, limit = 12 }) {
  const params = [];
  const where = ["l.status = 'active'"];
  where.push(auction
    ? "(l.type = 'auction' OR l.is_auction = true) AND (l.auction_end IS NULL OR l.auction_end > NOW())"
    : "(l.type <> 'auction' AND (l.is_auction = false OR l.is_auction IS NULL))");
  if (productType) { params.push(productType); where.push(`l.product_type = $${params.length}`); }
  if (game) { params.push(game); where.push(`l.game = $${params.length}`); }
  params.push(Math.min(Math.max(Number(limit) || 12, 1), 50));
  const { rows } = await query(
    `SELECT l.id, l.title, l.price, l.current_bid, l.auction_start, l.type, l.condition, l.product_type, l.game
     FROM listings l
     WHERE ${where.join(' AND ')}
     ORDER BY l.created_at DESC NULLS LAST
     LIMIT $${params.length}`,
    params
  );
  return rows;
}

function listingItems(rows) {
  return list(
    rows.map((l) => {
      const bits = [priceOf(l), conditionLabel(l.condition)].filter(Boolean);
      return `${link(`/product/${l.id}`, l.title)}${bits.length ? ` – ${esc(bits.join(' · '))}` : ''}`;
    }),
    'seo-listings'
  );
}

/**
 * One block of the page definition's `listings` array -> "<section><h2>…</h2><ul>…</ul></section>".
 * When the category is genuinely empty and the block has an `empty` text, say so (an honest sentence beats a
 * missing section); when the read failed or timed out (null) nothing is invented: the section is left out.
 */
async function listingsBlock(block) {
  const key = `list:${block.auction ? 'a' : 'f'}:${block.productType || '*'}:${block.game || '*'}:${block.limit || 12}`;
  const rows = await cached(key, TTL_MS, () => fetchListings(block));
  if (!rows) return '';
  if (rows.length === 0) return block.empty ? section(block.heading, `<p>${esc(block.empty)}</p>`) : '';
  return section(block.heading, listingItems(rows));
}

// ------------------------------------------------------------------ catalog: latest reference entries
/** The most recently indexed catalog entries of one game (or LEGO sets): what the catalog page shows first. */
async function fetchCatalogRecent(slug, limit = 12) {
  if (slug === 'lego') {
    const { rows } = await query('SELECT set_num AS id, name, year AS extra FROM master_sets ORDER BY fetched_at DESC LIMIT $1', [limit]);
    return rows;
  }
  const { rows } = await query('SELECT external_id AS id, name, set_name AS extra FROM master_cards WHERE game = $1 ORDER BY fetched_at DESC LIMIT $2', [slug, limit]);
  return rows;
}

/** { slug, heading, limit? } -> "<section><h2>…</h2><ul>…</ul></section>" linking each entry's catalog page, or ''. */
async function catalogBlock({ slug, heading, limit = 12 }) {
  const rows = await cached(`catalog:${slug}:${limit}`, TTL_MS, () => fetchCatalogRecent(slug, limit));
  if (!rows || rows.length === 0) return '';
  const items = rows
    .filter((r) => r.id && r.name)
    .map((r) => `${link(`/catalog/${slug}/${encodeURIComponent(r.id)}`, r.name)}${r.extra ? ` – ${esc(r.extra)}` : ''}`);
  return section(heading, list(items, 'seo-catalog'));
}

const CARRIER_NAMES = { DHL: 'DHL Express', BRT: 'BRT Corriere', UPS: 'UPS', SDA: 'SDA', POSTE: 'Poste Italiane' };

/** "Spedizione" section from the listing's own shipping options (carrier + cost), or '' when it has none. */
function shippingSection(listing) {
  let options = listing.shipping_options;
  if (typeof options === 'string') { try { options = JSON.parse(options); } catch { options = null; } }
  if (!Array.isArray(options) || options.length === 0) return '';
  const items = options
    .filter((o) => o && CARRIER_NAMES[o.carrier])
    .map((o) => {
      const cost = Number(o.cost);
      return `${esc(CARRIER_NAMES[o.carrier])}: ${Number.isFinite(cost) && cost > 0 ? esc(eur(cost)) : 'costo indicato al checkout'}`;
    });
  return items.length ? section('Spedizione', list(items)) : '';
}

// ------------------------------------------------------------------ single listing
async function relatedListings(listing) {
  if (!listing.product_type) return [];
  const key = `related:${listing.product_type}:${listing.game || '*'}`;
  const rows = await cached(key, TTL_MS, () => fetchListings({ auction: false, productType: listing.product_type, game: listing.game, limit: 8 }));
  return (rows || []).filter((r) => r.id !== listing.id).slice(0, 6);
}

function crumbsFor(listing) {
  const isAuction = listing.type === 'auction';
  const root = isAuction ? '/aste' : '/annunci';
  const crumbs = [{ name: 'CardBrix', href: '/' }, { name: isAuction ? 'Aste' : 'Annunci', href: root }];
  if (listing.product_type === 'lego' || listing.product_type === 'funko') {
    crumbs.push({ name: TYPE_LABELS[listing.product_type], href: `${root}/${listing.product_type}` });
  } else if (listing.product_type === 'tcg') {
    crumbs.push({ name: TYPE_LABELS.tcg, href: `${root}/carte-collezionabili` });
  }
  crumbs.push({ name: listing.title });
  return crumbs;
}

function formatEnd(date) {
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat('it-IT', { dateStyle: 'long', timeStyle: 'short', timeZone: 'Europe/Rome' }).format(d);
}

/**
 * Page definition (same shape as pages.js entries) for /product/:id from the row seoMeta already loaded.
 * `images` are absolute URLs. Related listings are best-effort: no answer, no section.
 */
async function productPage(listing, images = []) {
  const isAuction = listing.type === 'auction';
  const price = priceOf(listing);
  const ends = isAuction && listing.auction_end ? formatEnd(listing.auction_end) : null;

  const lead = [
    price ? `${isAuction ? (listing.current_bid != null ? t('landing.auctions.current_bid') || 'Offerta attuale' : t('landing.auctions.starting_price') || "Base d'asta") : 'Prezzo'}: ${price}` : null,
    ends ? `Scade il ${ends}` : null,
  ].filter(Boolean).join('. ');

  const details = [
    ['Tipo', isAuction ? 'Asta' : 'Prezzo fisso'],
    ['Categoria', TYPE_LABELS[listing.product_type] || null],
    ['Condizione', conditionLabel(listing.condition)],
    ['Numero set', listing.set_number],
    ['Tema', listing.theme],
    ['Anno', listing.year],
    ['Pezzi', listing.pieces],
    ['Condizione scatola', listing.box_condition],
  ].filter(([, v]) => v != null && v !== '');

  const related = await relatedListings(listing);
  const image = images[0] ? `<p><img src="${esc(images[0])}" alt="${esc(listing.title)}" loading="lazy" decoding="async"></p>` : '';

  const body =
    image +
    (listing.description ? section('Descrizione', paragraphs(listing.description)) : '') +
    section('Dettagli', `<dl>${details.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl>`) +
    shippingSection(listing) +
    (related.length ? section('Altri annunci simili', listingItems(related)) : '') +
    section('Come funziona', `<p>${esc(t('how_it_works_page.step2_long_desc'))}</p><p>${link('/come-funziona', t('how_it_works_page.page_title'))} · ${link('/faq', t('nav.faq') || 'FAQ')}</p>`);

  return { h1: listing.title, lead, body, crumbs: crumbsFor(listing) };
}

module.exports = { listingsBlock, catalogBlock, productPage, fetchListings, fetchCatalogRecent, shippingSection, conditionLabel };
