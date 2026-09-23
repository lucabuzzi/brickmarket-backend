// Pure builders for the JSON-LD injected into listing pages (see seoMeta.js). No DB, no network.

const TCG_BRANDS = {
  pokemon: 'Pokémon',
  magic: 'Magic: The Gathering',
  yugioh: 'Yu-Gi-Oh!',
  lorcana: 'Disney Lorcana',
  onepiece: 'One Piece Card Game',
  dragonball: 'Dragon Ball Super Card Game',
};

/** Path segment used by the client routes for each TCG (see client/src/App.jsx). */
const TCG_PATHS = new Set(Object.keys(TCG_BRANDS));

function brandFor(listing) {
  if (listing.product_type === 'lego') return 'LEGO';
  if (listing.product_type === 'funko') return 'Funko';
  if (listing.product_type === 'tcg') return TCG_BRANDS[String(listing.game || '').toLowerCase()] || null;
  return null;
}

/** listings.condition is constrained to new / used / 'Like New' / damaged (+ TCG grades, all "used"). */
function conditionUrl(condition) {
  const c = String(condition || '').trim().toLowerCase();
  if (c === 'new') return 'https://schema.org/NewCondition';
  if (c === 'damaged') return 'https://schema.org/DamagedCondition';
  if (!c) return null;
  return 'https://schema.org/UsedCondition';
}

function buildProductJsonLd({ listing, canonical, images, description, effectivePrice }) {
  const isAuction = listing.type === 'auction';
  const brand = brandFor(listing);
  const condition = conditionUrl(listing.condition);
  const offer = {
    '@type': 'Offer',
    url: canonical,
    priceCurrency: 'EUR',
    price: effectivePrice != null && effectivePrice !== '' ? Number(effectivePrice).toFixed(2) : undefined,
    availability: listing.status === 'active' ? 'https://schema.org/InStock' : 'https://schema.org/SoldOut',
    itemCondition: condition || undefined,
    seller: { '@type': 'Organization', name: 'CardBrix' },
  };
  if (isAuction && listing.auction_end && listing.status === 'active') {
    offer.priceValidUntil = new Date(listing.auction_end).toISOString().slice(0, 10);
  }

  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: listing.title,
    description,
    image: images.length > 1 ? images : images[0],
    url: canonical,
    sku: listing.set_number ? String(listing.set_number) : `cardbrix-${listing.id}`,
    mpn: listing.set_number ? String(listing.set_number) : undefined,
    brand: brand ? { '@type': 'Brand', name: brand } : undefined,
    offers: offer,
  };
}

function buildBreadcrumbJsonLd(items) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: it.name,
      ...(it.url ? { item: it.url } : {}),
    })),
  };
}

/** Home > Annunci|Aste > category > this listing. Category pages are the client routes that exist today. */
function breadcrumbForListing(listing, baseUrl) {
  const isAuction = listing.type === 'auction';
  const root = isAuction ? '/aste' : '/annunci';
  const items = [
    { name: 'CardBrix', url: `${baseUrl}/` },
    { name: isAuction ? 'Aste' : 'Annunci', url: `${baseUrl}${root}` },
  ];
  if (listing.product_type === 'lego') items.push({ name: 'LEGO', url: `${baseUrl}${root}/lego` });
  else if (listing.product_type === 'funko') items.push({ name: 'Funko', url: `${baseUrl}${root}/funko` });
  else if (listing.product_type === 'tcg') {
    items.push({ name: 'Carte collezionabili', url: `${baseUrl}${root}/carte-collezionabili` });
    const game = String(listing.game || '').toLowerCase();
    if (TCG_PATHS.has(game)) items.push({ name: TCG_BRANDS[game], url: `${baseUrl}${root}/carte-collezionabili/${game}` });
  }
  items.push({ name: listing.title }); // last crumb = current page, no link
  return buildBreadcrumbJsonLd(items);
}

module.exports = { TCG_BRANDS, buildProductJsonLd, buildBreadcrumbJsonLd, breadcrumbForListing, brandFor, conditionUrl };
