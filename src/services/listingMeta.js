// <title> and meta description for a listing page, built from its own data.
//
// Sellers write whatever they like: a listing called "Froakie" with the description "ok" produced
// "Froakie | CardBrix" (18 chars) and a 2-char description, both too thin to be useful in search
// results or link previews. Good titles/descriptions are used as written; short ones are completed with
// facts the page already states (what it is, sale type, price, condition). Nothing is invented.
// Pure module: no DB, no network. Targets: title 30-65 chars, description 70-160 (what the SEO audit checks).
const { eur, conditionLabel, descriptorFor } = require('./listingText');

const SUFFIX = ' | CardBrix';
const TITLE_MIN = 30;
const TITLE_MAX = 65;
const DESC_MIN = 70;
const DESC_MAX = 160;
const SELLER_NOTE_MIN = 12;

const squash = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();

/** Cuts at a word boundary and adds an ellipsis; strings that already fit are returned untouched. */
function cut(str, max) {
  if (str.length <= max) return str;
  return `${str.slice(0, max - 1).replace(/\s+\S*$/, '').replace(/[\s,;:.–-]+$/, '')}…`;
}

const endWithPeriod = (s) => (/[.!?…]$/.test(s) ? s : `${s}.`);

function buildListingTitle(listing) {
  const name = squash(listing.title) || 'Annuncio';
  const isAuction = listing.type === 'auction';
  const descriptor = descriptorFor(listing);
  // do not repeat what the title already says ("LEGO Icons Fiori – LEGO")
  const redundant = descriptor && name.toLowerCase().includes(descriptor.replace(/^carta /, '').toLowerCase());
  const kind = descriptor && !redundant ? descriptor : null;

  const mode = isAuction ? "all'asta" : 'in vendita';
  const candidates = [
    name,
    kind ? `${name} – ${kind}` : null,
    `${name}${kind ? ` – ${kind}` : ''} ${mode}`,
    `${name} – annuncio ${mode} online`, // last resort for one-word titles of an unknown category
  ].filter(Boolean);

  const chosen = candidates.find((c) => c.length + SUFFIX.length >= TITLE_MIN) || candidates[candidates.length - 1];
  return `${cut(chosen, TITLE_MAX - SUFFIX.length)}${SUFFIX}`;
}

function buildListingDescription(listing) {
  const name = squash(listing.title) || 'Annuncio';
  const seller = squash(listing.description);
  if (seller.length >= DESC_MIN) return cut(seller, DESC_MAX); // the seller wrote enough: keep their words

  const isAuction = listing.type === 'auction';
  const descriptor = descriptorFor(listing);
  const condition = conditionLabel(listing.condition);
  const price = eur(isAuction ? listing.current_bid ?? listing.auction_start : listing.price);
  // fixed price reads "... su CardBrix a 3,00 €"; an auction "... all'asta su CardBrix, offerta attuale 77,00 €"
  const head = `${name}: ${descriptor ? `${descriptor} ` : ''}${isAuction ? "all'asta" : 'in vendita'} su CardBrix${price && !isAuction ? ` a ${price}` : ''}`;
  const facts = [
    head,
    price && isAuction ? `${listing.current_bid != null ? 'offerta attuale' : "base d'asta"} ${price}` : null,
    condition ? `condizione: ${condition.toLowerCase()}` : null,
  ].filter(Boolean);
  let text = endWithPeriod(facts.join(', '));
  // a seller note of a couple of characters ("ok", "5 car") adds noise, not information
  if (seller.length >= SELLER_NOTE_MIN) text = `${text} ${endWithPeriod(seller.charAt(0).toUpperCase() + seller.slice(1))}`;
  if (text.length < DESC_MIN) {
    text = `${text} ${isAuction ? 'Consulta foto e dettagli, poi fai la tua offerta prima della scadenza.' : 'Consulta foto, dettagli e condizioni del pezzo prima di acquistare.'}`;
  }
  return cut(text, DESC_MAX);
}

module.exports = { buildListingTitle, buildListingDescription, TITLE_MIN, TITLE_MAX, DESC_MIN, DESC_MAX };
