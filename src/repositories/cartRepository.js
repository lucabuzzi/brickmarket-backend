const { query } = require('../db');

function getCart(userId) {
  return query(
    `SELECT l.id, l.title, l.price, l.images, l.status, l.product_type, l.seller_id,
            u.username AS seller_username,
            ci.added_at
     FROM public.cart_items ci
     JOIN public.listings l ON l.id = ci.listing_id
     LEFT JOIN public.users u ON u.id = l.seller_id
     WHERE ci.user_id = $1
     ORDER BY ci.added_at ASC`,
    [userId]
  ).then((r) => r.rows);
}

function addItem(userId, listingId) {
  return query(
    `INSERT INTO public.cart_items (user_id, listing_id)
     VALUES ($1, $2)
     ON CONFLICT (user_id, listing_id) DO NOTHING
     RETURNING id`,
    [userId, listingId]
  );
}

function removeItem(userId, listingId) {
  return query(
    'DELETE FROM public.cart_items WHERE user_id = $1 AND listing_id = $2',
    [userId, listingId]
  );
}

function clearCart(userId) {
  return query('DELETE FROM public.cart_items WHERE user_id = $1', [userId]);
}

module.exports = { getCart, addItem, removeItem, clearCart };
