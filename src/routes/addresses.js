const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const addressRepository = require('../repositories/addressRepository');
const { addressSchema, addressPatchSchema, validate } = require('../validators/addressValidators');

// Buyer's shipping address book — backs the checkout address picker in the
// cart (Cart.jsx). Every route is scoped to the authenticated user; there's
// no cross-user read/write path here.

router.get('/', auth, async (req, res) => {
  try {
    const addresses = await addressRepository.listByUser(req.user.userId);
    res.json(addresses);
  } catch (err) {
    console.error('addresses list:', err.message);
    res.status(500).json({ error: 'Errore nel recupero degli indirizzi' });
  }
});

router.post('/', auth, async (req, res) => {
  const { error, value } = validate(addressSchema, req.body);
  if (error) return res.status(400).json({ error });

  try {
    const address = await addressRepository.create(req.user.userId, value);
    res.status(201).json(address);
  } catch (err) {
    console.error('address create:', err.message);
    res.status(500).json({ error: 'Errore nella creazione dell\'indirizzo' });
  }
});

router.patch('/:id', auth, async (req, res) => {
  const { error, value } = validate(addressPatchSchema, req.body);
  if (error) return res.status(400).json({ error });

  try {
    const address = await addressRepository.update(req.user.userId, req.params.id, value);
    if (!address) return res.status(404).json({ error: 'Indirizzo non trovato' });
    res.json(address);
  } catch (err) {
    console.error('address update:', err.message);
    res.status(500).json({ error: 'Errore nell\'aggiornamento dell\'indirizzo' });
  }
});

router.post('/:id/default', auth, async (req, res) => {
  try {
    const address = await addressRepository.setDefault(req.user.userId, req.params.id);
    if (!address) return res.status(404).json({ error: 'Indirizzo non trovato' });
    res.json(address);
  } catch (err) {
    console.error('address set-default:', err.message);
    res.status(500).json({ error: 'Errore nell\'impostazione dell\'indirizzo predefinito' });
  }
});

router.delete('/:id', auth, async (req, res) => {
  try {
    const deleted = await addressRepository.remove(req.user.userId, req.params.id);
    if (!deleted) return res.status(404).json({ error: 'Indirizzo non trovato' });
    res.json({ success: true });
  } catch (err) {
    console.error('address delete:', err.message);
    res.status(500).json({ error: 'Errore nell\'eliminazione dell\'indirizzo' });
  }
});

module.exports = router;
