// The "Rivedi" step and the screen after publishing: what to show, what is still blocking, where "Modifica" goes.
// Pure functions (no React): tested in tests/sell-review.test.js.
import { parseDecimal, selectedCarriers } from './form.js';
import { FIELD_STEP, validateAll } from './validate.js';

/**
 * What stops the listing from being published, one entry per problem, in wizard order:
 * [{ field, step, code }]. Empty = ready. The page shows each with a "go and fix it" button.
 */
export function publishBlockers(form, ctx) {
  const { errors } = validateAll(form, ctx, 'publish');
  return Object.entries(errors)
    .map(([field, code]) => ({ field, step: FIELD_STEP[field], code }))
    .sort((a, b) => Object.keys(FIELD_STEP).indexOf(a.field) - Object.keys(FIELD_STEP).indexOf(b.field));
}

/** "12,5" -> "12,50" (always two decimals, the way prices are written in the listing); '' for an invalid price. */
export function formatPrice(value) {
  const n = parseDecimal(value);
  return Number.isFinite(n) && n > 0 ? n.toFixed(2).replace('.', ',') : '';
}

/** First `max` characters of a text, cut at a word boundary, with an ellipsis when something was cut. */
export function snippet(text, max = 140) {
  const s = String(text || '').replace(/\s+/g, ' ').trim();
  if (s.length <= max) return s;
  const cut = s.slice(0, max);
  const space = cut.lastIndexOf(' ');
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).replace(/[\s,.;:-]+$/, '')}…`;
}

/** Ids of the carriers the seller ticked, in the order of `knownIds` (so the summary does not depend on click order). */
export function chosenCarrierIds(shippingOptions, knownIds) {
  const chosen = new Set(selectedCarriers(shippingOptions));
  return knownIds.filter((id) => chosen.has(id));
}

/**
 * Where "see your listing" goes after publishing: the page of the listing the server just created,
 * or null when the response has no usable id (then the page falls back to "my listings").
 */
export function publishedPath(result) {
  const id = result && typeof result === 'object' ? result.id : null;
  const ok = (typeof id === 'number' && Number.isInteger(id) && id > 0) || (typeof id === 'string' && /^[A-Za-z0-9-]{1,64}$/.test(id));
  return ok ? `/product/${encodeURIComponent(String(id))}` : null;
}
