// The "Rivedi" step and the screen after publishing an auction. `formatPrice`/`snippet`/`chosenCarrierIds`/
// `publishedPath` are generic (no "price" semantics baked in) and reused unchanged from lib/sell/review.js;
// only `publishBlockers` needs this module's own FIELD_STEP/validateAll.
import { FIELD_STEP, validateAll } from './validate.js';

export { formatPrice, snippet, chosenCarrierIds, publishedPath } from '../sell/review.js';

/**
 * What stops the auction from being published, one entry per problem, in wizard order:
 * [{ field, step, code }]. Empty = ready.
 */
export function publishBlockers(form, ctx) {
  const { errors } = validateAll(form, ctx, 'publish');
  return Object.entries(errors)
    .map(([field, code]) => ({ field, step: FIELD_STEP[field], code }))
    .sort((a, b) => Object.keys(FIELD_STEP).indexOf(a.field) - Object.keys(FIELD_STEP).indexOf(b.field));
}
