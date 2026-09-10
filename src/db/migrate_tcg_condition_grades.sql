-- Applied to Supabase (project nrfyvnkoixmotmjdpnss) on 2026-09-10.
-- Widens listings.condition CHECK to accept TCG card-grade codes alongside the
-- existing LEGO/Funko values. Additive only: no existing rows change.

ALTER TABLE listings DROP CONSTRAINT listings_condition_check;

ALTER TABLE listings ADD CONSTRAINT listings_condition_check CHECK (
  (condition)::text = ANY ((ARRAY[
    'complete', 'good', 'fair', 'parts', 'new', 'used', 'Like New', 'damaged',
    'near_mint', 'slightly_played', 'moderately_played', 'heavy_played', 'poor_damaged'
  ])::text[])
);
