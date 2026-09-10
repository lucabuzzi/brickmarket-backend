-- Featured-listing expiry + paid-promotion audit trail.
-- Apply once to Supabase (project nrfyvnkoixmotmjdpnss). Additive only.
--
--   featured_until NULL  -> "no expiry" (admin-pinned, legacy hand-featured rows)
--   in evidenza  <=>  is_featured = true AND (featured_until IS NULL OR featured_until > now())

ALTER TABLE listings ADD COLUMN IF NOT EXISTS featured_until  timestamptz;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS featured_source text;

-- Existing hand-featured rows become admin-pinned with no expiry.
UPDATE listings SET featured_source = 'admin'
WHERE is_featured = true AND featured_source IS NULL;

-- Audit trail + idempotency key for paid promotions. Lives in the main DB
-- (always real); the actual credit movement still goes through the ClutchVault
-- wallet, which may be in mock mode.
CREATE TABLE IF NOT EXISTS featured_purchases (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id     uuid NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  user_id        uuid NOT NULL REFERENCES users(id),
  tariff         text NOT NULL,
  days           integer NOT NULL,
  method         text NOT NULL,            -- 'wallet' | 'card' | 'admin'
  amount_credits numeric,                  -- NULL for admin grants
  payment_ref    text,                     -- Stripe PaymentIntent id / wallet tx ref
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS featured_purchases_payment_ref_key
  ON featured_purchases(payment_ref) WHERE payment_ref IS NOT NULL;
CREATE INDEX IF NOT EXISTS featured_purchases_listing_id_idx
  ON featured_purchases(listing_id);
