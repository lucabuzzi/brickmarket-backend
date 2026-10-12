// Pure helpers for the "create an auction" wizard (pages/CreateAuction.jsx). Same shape as lib/sell/form.js
// (and most of its exports are re-exported unchanged below) except the fixed `price` field is replaced by
// `startingBid` + a duration choice: `durationMode` ('standard' = free 7-day auction, 'custom' = seller picks
// the end date/time) and `customEndDate`.
export {
  PRODUCT_TYPES, MAIN_CATEGORIES, LEGO_CONDITIONS, TCG_CONDITIONS, MAX_PHOTOS,
  IMAGE_ORIENTATIONS, defaultImageOrientation, parseDecimal, isPositive,
  changeProductType, selectGame, selectedCarriers,
} from '../sell/form.js';

export const INITIAL_FORM = Object.freeze({
  productType: 'lego',
  game: '',
  title: '',
  setNumber: '',
  mainCategory: '',
  category: '',
  year: '',
  condition: '',
  boxCondition: '',
  instructions: '',
  isComplete: false,
  startingBid: '',
  durationMode: 'standard', // 'standard' (fixed 7 days) | 'custom' (seller picks customEndDate)
  customEndDate: '',
  shippingOptions: {},
  weightKg: '',
  lengthCm: '',
  widthCm: '',
  heightCm: '',
  description: '',
  proNotes: '',
  cardLanguage: '',
  cardRarity: '',
  gradingCompany: '',
  cardGrade: '',
  cardSetId: '',
  cardSetName: '',
  cardNumber: '',
  cardExternalId: '',
  imageOrientation: '',
});

const STANDARD_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

/** The auction's end date for the current form state, or null when a custom date is missing/invalid. */
export function auctionEndDate(form, now = new Date()) {
  if (form.durationMode === 'custom') {
    const d = new Date(form.customEndDate);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return new Date(now.getTime() + STANDARD_DURATION_MS);
}
