// Automatic local draft of the auction wizard: mirrors lib/sell/draft.js (text only, one per user id,
// expires after 30 days, never used while editing), with `startingBid`/`durationMode`/`customEndDate`
// standing in for `price`, and its own storage key so it never collides with a /sell draft.
import { INITIAL_FORM } from './form.js';
import { PRODUCT_TYPES } from '../sell/form.js';

export const DRAFT_VERSION = 1;
export const DRAFT_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

export const draftKey = (userId) => `cardbrix_auction_draft_v${DRAFT_VERSION}:${userId || 'anon'}`;

const SHORT = 400;
const LONG = 10000;
const TEXT_FIELDS = {
  game: SHORT, title: SHORT, setNumber: SHORT, mainCategory: SHORT, category: SHORT, year: 8,
  condition: SHORT, boxCondition: SHORT, instructions: SHORT, startingBid: 16, durationMode: 16, customEndDate: 40,
  weightKg: 16, lengthCm: 16, widthCm: 16, heightCm: 16, description: LONG, proNotes: 2000,
  cardLanguage: 8, cardRarity: 60, gradingCompany: 8, cardGrade: 10,
  cardSetId: 60, cardSetName: 300, cardNumber: 20, cardExternalId: 60,
};
const CARRIER_ID = /^[A-Z0-9_]{2,16}$/;

/** Does the form hold anything worth keeping? An untouched form must not create a draft. */
export function isDraftWorthSaving(form) {
  return ['title', 'setNumber', 'description', 'startingBid', 'condition'].some((k) => String(form[k] ?? '').trim() !== '');
}

export function serializeDraft(form, step, now = Date.now()) {
  const shipping = {};
  for (const [id, o] of Object.entries(form.shippingOptions || {})) if (o && o.selected && CARRIER_ID.test(id)) shipping[id] = { selected: true };
  const clean = { productType: form.productType, isComplete: !!form.isComplete, shippingOptions: shipping };
  for (const k of Object.keys(TEXT_FIELDS)) clean[k] = String(form[k] ?? '').slice(0, TEXT_FIELDS[k]);
  return JSON.stringify({ v: DRAFT_VERSION, savedAt: now, step, form: clean });
}

/** -> { form, step, savedAt } or null when absent, malformed, from another version or too old. */
export function parseDraft(raw, now = Date.now()) {
  if (!raw || typeof raw !== 'string') return null;
  let data;
  try { data = JSON.parse(raw); } catch { return null; }
  if (!data || typeof data !== 'object' || data.v !== DRAFT_VERSION) return null;
  if (typeof data.savedAt !== 'number' || now - data.savedAt > DRAFT_MAX_AGE_MS || data.savedAt > now + 60_000) return null;
  const src = data.form;
  if (!src || typeof src !== 'object' || !PRODUCT_TYPES.includes(src.productType)) return null;

  const form = { ...INITIAL_FORM, shippingOptions: {}, productType: src.productType, isComplete: src.isComplete === true };
  for (const k of Object.keys(TEXT_FIELDS)) if (typeof src[k] === 'string') form[k] = src[k].slice(0, TEXT_FIELDS[k]);
  if (src.shippingOptions && typeof src.shippingOptions === 'object') {
    for (const [id, o] of Object.entries(src.shippingOptions)) if (CARRIER_ID.test(id) && o && o.selected === true) form.shippingOptions[id] = { selected: true };
  }
  if (form.durationMode !== 'custom') form.durationMode = 'standard';
  const step = Number.isInteger(data.step) ? Math.min(Math.max(data.step, 1), 4) : 1;
  return isDraftWorthSaving(form) ? { form, step, savedAt: data.savedAt } : null;
}
