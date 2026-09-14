// Replaces the old seller-facing package_size dropdown (small/medium/large)
// with real weight_kg/length_cm/width_cm/height_cm on the listing. Only
// applies to physical items (LEGO/Funko) — TCG listings ship via the
// card-count/value tier system in shipping.js and never carry these.
//
// package_size itself isn't gone: src/services/shipping.js's static rate
// table (calculateShippingRates) and physicalGroupCarriers still bucket by
// it, and Step 3's aggregator quote will want a size class too. It's now a
// DERIVED value — computed from weight_kg here — rather than something the
// seller picks directly, so there's exactly one source of truth.
//
// Defaults below are working assumptions, not measured data — reasonable
// placeholders so a listing that skips weight/dimensions still gets a
// workable shipping estimate instead of nulls breaking downstream code.
// Worth revisiting once there's real usage to calibrate against.
const DEFAULT_DIMENSIONS = {
  lego: {
    sets: { weightKg: 1.2, lengthCm: 40, widthCm: 30, heightCm: 15 },
    mocs: { weightKg: 1.0, lengthCm: 35, widthCm: 25, heightCm: 15 },
    minifigures: { weightKg: 0.05, lengthCm: 10, widthCm: 5, heightCm: 5 },
  },
  funko: {
    // Sell.jsx always sends category='sets' for non-LEGO listings — there's
    // no real Funko-specific category today — so this is the only entry.
    sets: { weightKg: 0.35, lengthCm: 15, widthCm: 11, heightCm: 10 },
  },
};

const FALLBACK_DIMENSIONS = { weightKg: 1.5, lengthCm: 30, widthCm: 20, heightCm: 15 };

// Legacy package_size buckets, used only to backfill existing rows that have
// a package_size but no weight/dimensions yet (see migrate_shipping_dimensions.js).
const LEGACY_PACKAGE_SIZE_DIMENSIONS = {
  small: { weightKg: 1.0, lengthCm: 30, widthCm: 20, heightCm: 10 },
  medium: { weightKg: 3.5, lengthCm: 40, widthCm: 30, heightCm: 20 },
  large: { weightKg: 7.0, lengthCm: 50, widthCm: 40, heightCm: 30 },
};

function defaultDimensionsFor(productType, category) {
  return (DEFAULT_DIMENSIONS[productType] && DEFAULT_DIMENSIONS[productType][category])
    || FALLBACK_DIMENSIONS;
}

/** Fills in whichever of weightKg/lengthCm/widthCm/heightCm the seller left
 *  out, from the category default — never partially-null on a physical
 *  listing. Returns the same shape back untouched for TCG (not applicable). */
function applyDimensionDefaults({ productType, category, weightKg, lengthCm, widthCm, heightCm }) {
  if (productType === 'tcg') {
    return { weightKg: null, lengthCm: null, widthCm: null, heightCm: null };
  }
  const fallback = defaultDimensionsFor(productType, category);
  return {
    weightKg: weightKg ?? fallback.weightKg,
    lengthCm: lengthCm ?? fallback.lengthCm,
    widthCm: widthCm ?? fallback.widthCm,
    heightCm: heightCm ?? fallback.heightCm,
  };
}

/** Derives the legacy small/medium/large bucket from a real weight, for the
 *  code that still keys off package_size (shipping.js's static rate table). */
function packageSizeFromWeight(weightKg) {
  const w = Number(weightKg);
  if (!Number.isFinite(w) || w <= 0) return 'medium';
  if (w < 2) return 'small';
  if (w < 5) return 'medium';
  return 'large';
}

module.exports = {
  DEFAULT_DIMENSIONS,
  FALLBACK_DIMENSIONS,
  LEGACY_PACKAGE_SIZE_DIMENSIONS,
  defaultDimensionsFor,
  applyDimensionDefaults,
  packageSizeFromWeight,
};
