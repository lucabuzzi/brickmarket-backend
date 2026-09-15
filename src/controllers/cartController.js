const cartRepository = require('../repositories/cartRepository');

function formatItem(row) {
  return {
    id: row.id,
    title: row.title,
    price: row.price,
    images: row.images,
    status: row.status,
    product_type: row.product_type,
    seller_id: row.seller_id,
    seller: { username: row.seller_username },
  };
}

async function getCartHandler(req, res) {
  try {
    const rows = await cartRepository.getCart(req.user.userId);
    res.json({ items: rows.map(formatItem) });
  } catch (err) {
    console.error('GET /api/cart:', err.message);
    res.status(500).json({ error: 'Errore nel recupero del carrello.' });
  }
}

async function addItemHandler(req, res) {
  const { listingId } = req.body;
  if (!listingId) return res.status(400).json({ error: 'listingId è obbligatorio.' });
  try {
    await cartRepository.addItem(req.user.userId, listingId);
    res.json({ success: true });
  } catch (err) {
    if (err.code === '23503') return res.status(404).json({ error: 'Annuncio non trovato.' });
    console.error('POST /api/cart:', err.message);
    res.status(500).json({ error: 'Errore nell\'aggiunta al carrello.' });
  }
}

async function removeItemHandler(req, res) {
  try {
    await cartRepository.removeItem(req.user.userId, req.params.listingId);
    res.json({ success: true });
  } catch (err) {
    console.error('DELETE /api/cart/:listingId:', err.message);
    res.status(500).json({ error: 'Errore nella rimozione dal carrello.' });
  }
}

async function clearCartHandler(req, res) {
  try {
    await cartRepository.clearCart(req.user.userId);
    res.json({ success: true });
  } catch (err) {
    console.error('DELETE /api/cart:', err.message);
    res.status(500).json({ error: 'Errore nello svuotamento del carrello.' });
  }
}

module.exports = { getCartHandler, addItemHandler, removeItemHandler, clearCartHandler };
