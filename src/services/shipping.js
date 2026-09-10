// Shipping rate table
const RATES = {
  DHL: { 
    'small': { domestic: 5.90, eu: 14.90 }, 
    'medium': { domestic: 8.90, eu: 19.90 }, 
    'large': { domestic: 12.90, eu: 29.90 } 
  },
  BRT: { 
    'small': { domestic: 4.50, eu: 15.00 }, 
    'medium': { domestic: 6.50, eu: 22.00 }, 
    'large': { domestic: 10.00, eu: 30.00 } 
  },
  UPS: { 
    'small': { domestic: 6.90, eu: 16.90 }, 
    'medium': { domestic: 9.90, eu: 21.90 }, 
    'large': { domestic: 15.90, eu: 35.90 } 
  },
  SDA: { 
    'small': { domestic: 5.00, eu: null }, 
    'medium': { domestic: 7.00, eu: null }, 
    'large': { domestic: 11.00, eu: null } 
  },
  POSTE: { 
    'small': { domestic: 4.00, eu: null }, 
    'medium': { domestic: 6.00, eu: null }, 
    'large': { domestic: 9.00, eu: null } 
  }
};

/**
 * Calcola i costi di spedizione in base ai carrier selezionati, paese del venditore,
 * paese dell'acquirente e dimensione del pacco.
 */
function calculateShippingRates(carriersArray, sellerCountry, buyerCountry, packageSize = 'medium') {
  if (!carriersArray || !Array.isArray(carriersArray)) return [];
  
  const size = (packageSize || 'medium').toLowerCase();
  // We assume default countries are 'it' if missing
  const sCountry = (sellerCountry || 'it').toLowerCase();
  const bCountry = (buyerCountry || 'it').toLowerCase();
  
  const zone = sCountry === bCountry ? 'domestic' : 'eu';

  const calculatedOptions = [];

  for (const opt of carriersArray) {
    const carrierCode = typeof opt === 'string' ? opt : opt.carrier;
    if (!carrierCode || !RATES[carrierCode]) continue;

    const rateConfig = RATES[carrierCode][size];
    if (!rateConfig) continue;

    const cost = rateConfig[zone];
    // Se il costo è null (es. SDA non spedisce in EU), non offriamo l'opzione
    if (cost !== null && cost !== undefined) {
      calculatedOptions.push({
        carrier: carrierCode,
        cost: cost
      });
    }
  }

  return calculatedOptions;
}

// ── Trading-card shipping ───────────────────────────────────────────────────
// Cards have no meaningful package size; shipping is one shipment per seller,
// priced by how many cards and the group's total value. Above €20 only tracked
// methods are offered (buyer/seller protection), Cardmarket-style.
const TCG_SHIPPING_TIERS = [
  { id: 'tcg_plain',      label: 'Busta ordinaria',            tracked: false, price: 1.50, eligible: (n, v) => n <= 4  && v < 20 },
  { id: 'tcg_padded',     label: 'Busta imbottita',            tracked: false, price: 2.90, eligible: (n, v) => n <= 15 && v < 20 },
  { id: 'tcg_registered', label: 'Raccomandata tracciata',     tracked: true,  price: 4.90, eligible: (n, v) => n <= 40 && v <= 100 },
  { id: 'tcg_parcel',     label: 'Pacco tracciato assicurato', tracked: true,  price: 7.90, eligible: () => true },
];

/** Public shape of the tier table (no predicates) for the client. */
function tcgTiersPublic() {
  return TCG_SHIPPING_TIERS.map(({ id, label, tracked, price }) => ({ id, label, tracked, price }));
}

/** Tiers that can carry `cardCount` cards worth `value` EUR, cheapest first. */
function eligibleTcgTiers(cardCount, value) {
  const n = Number(cardCount) || 0;
  const v = Number(value) || 0;
  return TCG_SHIPPING_TIERS
    .filter((t) => t.eligible(n, v))
    .map(({ id, label, tracked, price }) => ({ id, label, tracked, price }))
    .sort((a, b) => a.price - b.price);
}

/** Price for a chosen TCG tier, validated against the group; falls back to the
 *  cheapest eligible tier when the id is missing or not allowed. */
function resolveTcgShipping(tierId, cardCount, value) {
  const eligible = eligibleTcgTiers(cardCount, value);
  const picked = eligible.find((t) => t.id === tierId) || eligible[0];
  return picked ? { tierId: picked.id, cost: picked.price } : { tierId: 'tcg_parcel', cost: 7.90 };
}

// ── Physical (LEGO / Funko) grouped shipping ────────────────────────────────
// One shipment per seller: the chosen carrier is charged once, at the rate of
// the largest package in the group; smaller items ride along for free. Legacy
// listings with no carrier options contribute their flat shipping_cost.

/** Carriers offered by EVERY item in the group (so one carrier ships them all),
 *  each with the group price = max single-item rate for that carrier.
 *  Returns [{ carrier, cost }], cheapest first. Legacy flat-cost items don't
 *  restrict the carrier set but their flat cost still raises every option. */
function physicalGroupCarriers(items, sellerCountry, buyerCountry) {
  const withCarriers = items.filter((it) => Array.isArray(it.shipping_options) && it.shipping_options.length > 0);
  const flatMax = items
    .filter((it) => !Array.isArray(it.shipping_options) || it.shipping_options.length === 0)
    .reduce((m, it) => Math.max(m, Number(it.shipping_cost) || 0), 0);

  if (withCarriers.length === 0) {
    // whole group is legacy flat-cost -> single implicit option
    return [{ carrier: null, cost: flatMax }];
  }

  const perItemRates = withCarriers.map((it) => {
    const rates = calculateShippingRates(it.shipping_options, sellerCountry, buyerCountry, it.package_size);
    return new Map(rates.map((r) => [r.carrier, r.cost]));
  });

  // intersection of carrier codes
  let common = [...perItemRates[0].keys()];
  for (const m of perItemRates.slice(1)) common = common.filter((c) => m.has(c));

  return common
    .map((carrier) => {
      const maxRate = perItemRates.reduce((mx, m) => Math.max(mx, m.get(carrier) || 0), 0);
      return { carrier, cost: Math.max(maxRate, flatMax) };
    })
    .sort((a, b) => a.cost - b.cost);
}

/** Group shipping cost for a chosen carrier; falls back to the cheapest option. */
function resolvePhysicalShipping(carrier, items, sellerCountry, buyerCountry) {
  const options = physicalGroupCarriers(items, sellerCountry, buyerCountry);
  const picked = options.find((o) => o.carrier === carrier) || options[0];
  return picked ? { carrier: picked.carrier, cost: picked.cost } : { carrier: null, cost: 0 };
}

module.exports = {
  RATES,
  calculateShippingRates,
  TCG_SHIPPING_TIERS,
  tcgTiersPublic,
  eligibleTcgTiers,
  resolveTcgShipping,
  physicalGroupCarriers,
  resolvePhysicalShipping,
};
