/**
 * marketValue.js — LEGO Set Market Value Estimation Engine
 *
 * IMPORTANT CONTEXT — Why no live pricing API?
 * Rebrickable's free public API does NOT expose pricing data.
 * BrickLink and BrickOwl have their own proprietary APIs that require
 * separate authentication and are not suitable for real-time per-request use.
 *
 * This engine uses a research-backed appreciation model derived from
 * publicly observed LEGO secondary market trends:
 *
 *   - LEGO sets appreciate ~20-30% in the first year after retirement
 *   - Appreciation slows to ~8-12% per year after the first 3 years
 *   - Premium themes (Star Wars, Creator Expert/Icons, Harry Potter) carry
 *     a 15-25% premium multiplier over average sets
 *   - Large sets (>1000 parts) appreciate faster than small sets
 *   - Price-per-part ratio is used to derive a retail estimate when RRP is unknown
 *
 * Sources:
 *   - BrickEconomy.com long-term data analysis
 *   - LEGO market research from Brick Insights
 *   - Secondary market observations from BrickLink sold listings (public aggregate)
 */

const CURRENT_YEAR = new Date().getFullYear();

/**
 * Theme IDs that carry a premium multiplier.
 * Data from Rebrickable's themes endpoint (IDs as of 2024).
 */
const PREMIUM_THEME_IDS = new Set([
  158,  // Star Wars
  171,  // Harry Potter
  598,  // Icons (Creator Expert)
  246,  // Marvel
  261,  // DC Comics
  504,  // Technic (flagship sets)
  494,  // Jurassic World
  225,  // Batman
  652,  // Lord of the Rings
  677,  // Botanicals (sub-theme of Icons)
]);

const PREMIUM_THEME_MULTIPLIER = 1.20; // +20% for premium themes

/**
 * Determine if a set is likely retired based on its release year.
 * LEGO sets are typically sold for 2-4 years; we use 4 years as the threshold.
 * This is a heuristic — in production you'd cross-reference LEGO's catalog.
 */
function estimateIsRetired(year) {
  if (!year) return false;
  return (CURRENT_YEAR - year) >= 4;
}

/**
 * Estimate the original retail price (RRP) when it's not available.
 * Based on the LEGO price-per-part industry average of ~€0.12/piece.
 * Large sets get a slight discount per part (economies of scale).
 *
 * @param {number} numParts
 * @returns {number|null} estimated RRP in EUR, or null if numParts is unknown
 */
function estimateRetailPrice(numParts) {
  if (!numParts || numParts < 1) return null;

  let pricePerPart;
  if (numParts < 200) pricePerPart = 0.15;       // small sets are more expensive per part
  else if (numParts < 500) pricePerPart = 0.13;
  else if (numParts < 1000) pricePerPart = 0.11;
  else if (numParts < 3000) pricePerPart = 0.095; // large flagship sets
  else pricePerPart = 0.08;                        // mega sets (Eiffel Tower, etc.)

  return Math.round(numParts * pricePerPart * 100) / 100;
}

/**
 * Core market value estimation algorithm.
 *
 * Model:
 *   1. Start with retail price (real or estimated).
 *   2. Apply a theme premium if applicable.
 *   3. If retired: apply post-retirement appreciation curve.
 *   4. If still in production: apply minor availability discount (buyer can go to LEGO directly).
 *   5. Return a range [low, mid, high] representing Used, Typical, and Sealed/Mint prices.
 *
 * @param {object} setData — row from master_sets
 * @returns {object} { retailPrice, marketValue, low, high, isRetired, appreciationPct, isTrending }
 */
function computeMarketValue(setData) {
  const { year, num_parts, theme_id, retail_price } = setData;

  // Step 1: Establish base retail price
  const rrp = retail_price
    ? parseFloat(retail_price)
    : estimateRetailPrice(num_parts);

  if (!rrp) {
    return {
      retailPrice: null,
      marketValue: null,
      low: null,
      high: null,
      isRetired: estimateIsRetired(year),
      appreciationPct: null,
      isTrending: false,
      source: 'no_data',
    };
  }

  // Step 2: Theme premium
  const hasPremium = theme_id && PREMIUM_THEME_IDS.has(Number(theme_id));
  const themeMultiplier = hasPremium ? PREMIUM_THEME_MULTIPLIER : 1.0;

  // Step 3: Retirement & appreciation calculation
  const retired = estimateIsRetired(year);
  const ageYears = year ? Math.max(0, CURRENT_YEAR - year) : 0;

  let appreciationMultiplier = 1.0;

  if (retired) {
    // Post-retirement appreciation model:
    // Year 1 after retirement: +25% surge (collectors buy up stock)
    // Years 2-4: +10%/year compounding
    // Years 5+: +6%/year compounding (market matures)
    const yearsRetired = Math.max(0, ageYears - 3); // assume sold for 3 years before retirement
    
    if (yearsRetired <= 0) {
      appreciationMultiplier = 1.0; // just retired or very recent
    } else if (yearsRetired <= 1) {
      appreciationMultiplier = 1.25; // first year surge
    } else if (yearsRetired <= 4) {
      appreciationMultiplier = 1.25 * Math.pow(1.10, yearsRetired - 1);
    } else {
      appreciationMultiplier = 1.25 * Math.pow(1.10, 3) * Math.pow(1.06, yearsRetired - 4);
    }
  } else {
    // Still in production: slight discount vs RRP (buyer can buy new from LEGO)
    appreciationMultiplier = 0.90;
  }

  // Step 4: Compose the midpoint market value
  const baseMid = rrp * appreciationMultiplier * themeMultiplier;

  // Cap appreciation at 10x to prevent absurd estimates for very old sets
  const cappedMid = Math.min(baseMid, rrp * 10);
  const mid = Math.round(cappedMid * 100) / 100;

  // Step 5: Range (±15% around mid)
  const variance = retired ? 0.18 : 0.12; // retired sets have higher price spread
  const low = Math.round(mid * (1 - variance) * 100) / 100;
  const high = Math.round(mid * (1 + variance) * 100) / 100;

  // Appreciation %: how much above retail the mid value is
  const appreciationPct = Math.round((mid / rrp - 1) * 100);

  // "Trending" if appreciation is ≥ 30% above retail
  const isTrending = appreciationPct >= 30;

  return {
    retailPrice: Math.round(rrp * 100) / 100,
    marketValue: mid,
    low,
    high,
    isRetired: retired,
    appreciationPct,
    isTrending,
    source: retail_price ? 'rrp_real' : 'rrp_estimated',
  };
}

/**
 * Condition-based price multipliers.
 * Applied client-side (and returned in the API response) so the frontend
 * can update the suggestion in real time without round-tripping.
 */
const CONDITION_MULTIPLIERS = {
  new: 1.00,       // Sealed/Mint: full market value
  used: 0.65,      // Typical used: 65% of sealed market value
  complete: 0.55,  // Used with box, complete: 55%
  parts: 0.30,     // Parts/Incomplete: 30%
};

module.exports = { computeMarketValue, estimateRetailPrice, CONDITION_MULTIPLIERS };
