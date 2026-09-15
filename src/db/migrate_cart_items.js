// One-off migration — run manually: node src/db/migrate_cart_items.js
// Adds server-side cart persistence so the cart survives across devices/browsers,
// instead of living only in each browser's localStorage (see client/src/context/CartContext.jsx).
const { query } = require('./index');

async function migrate() {
  await query(`
    CREATE TABLE IF NOT EXISTS public.cart_items (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
      listing_id UUID NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
      added_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (user_id, listing_id)
    );
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_cart_items_user_id ON public.cart_items(user_id);
  `);

  console.log('✅ cart_items table ready.');
  process.exit(0);
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
