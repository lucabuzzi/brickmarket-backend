// Admin listing moderation ("Gestione Annunci & Aste") and the paid-promotion tariffs.
const express = require('express');
const { adminAuth } = require('../../../middleware/auth');
const c = require('./listings.controller');

const router = express.Router();

router.get('/featured-tariffs', adminAuth, c.tariffs);
router.put('/featured-tariffs/:id', adminAuth, c.setTariffPrice);
router.get('/listings', adminAuth, c.list);
router.post('/listings/:id/hide', adminAuth, c.hide);
router.post('/listings/:id/unhide', adminAuth, c.unhide);
router.delete('/listings/:id', adminAuth, c.remove);
router.post('/listings/:id/feature', adminAuth, c.setFeatured);
router.post('/listings/:id/restore', adminAuth, c.restore);

module.exports = router;
