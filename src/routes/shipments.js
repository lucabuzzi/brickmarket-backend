const express = require('express');
const router = express.Router();
const Joi = require('joi');
const auth = require('../middleware/auth');
const shipmentRepository = require('../repositories/shipmentRepository');
const paymentsRepository = require('../repositories/paymentsRepository');
const sendcloud = require('../services/sendcloud');

// Seller-facing shipment endpoints, backing the "Le mie spedizioni" page
// (client/src/pages/SellerShipments.jsx).

router.get('/mine', auth, async (req, res) => {
  try {
    const shipments = await shipmentRepository.listBySellerWithOrders(req.user.userId);
    res.json(shipments);
  } catch (err) {
    console.error('shipments/mine:', err.message);
    res.status(500).json({ error: 'Errore nel recupero delle spedizioni' });
  }
});

/** Attempts label generation for an aggregator-quoted physical shipment and
 *  applies the result (success or failure) to both the shipment and its
 *  orders. Shared by /prepare and /retry-label so a retry runs the exact
 *  same logic as the first attempt. */
async function attemptLabelGeneration(shipment) {
  await shipmentRepository.markLabelPending(shipment.id);
  try {
    const label = await sendcloud.createShipmentLabel({
      shipmentId: shipment.id,
      fromAddress: shipment.ship_from_address,
      toAddress: shipment.ship_to_address,
      weightKg: shipment.total_weight_kg,
      shippingOptionCode: shipment.sendcloud_shipping_option_code,
    });
    await shipmentRepository.markLabelCreated(shipment.id, {
      sendcloudParcelId: label.sendcloudParcelId,
      trackingNumber: label.trackingNumber,
      trackingUrl: label.trackingUrl,
      labelUrl: label.labelUrl,
      carrier: label.carrierCode,
    });
    await paymentsRepository.markOrdersShippedByShipment(shipment.id, {
      trackingNumber: label.trackingNumber,
      carrier: label.carrierCode,
    });
    return { ok: true, label };
  } catch (err) {
    console.error(`Label generation failed for shipment ${shipment.id}:`, err.message);
    await shipmentRepository.markLabelFailed(shipment.id);
    return { ok: false, error: err.message };
  }
}

// A shipment is only eligible for an automatic label when it was quoted live
// by the aggregator — TCG (tier system, no carrier booking involved) and
// fallback_static quotes (no real carrier rate behind the price the buyer
// was shown, see shippingQuote.js) fall back to the pre-existing manual
// tracking-entry flow (PATCH /api/orders/:id/ship) instead.
function isLabelEligible(shipment) {
  return shipment.macro_category === 'physical' && shipment.rate_source === 'aggregator';
}

// "Pronto per la spedizione" — the seller's trigger. Moves every order in
// the shipment to 'preparing' (already a valid orders_status_check value,
// just unused before this), then, only if eligible, immediately requests a
// label. Ineligible shipments stay in 'preparing': the seller ships them the
// same manual way as before this feature existed.
router.post('/:id/prepare', auth, async (req, res) => {
  try {
    const shipment = await shipmentRepository.findById(req.params.id);
    if (!shipment || shipment.seller_id !== req.user.userId) {
      return res.status(404).json({ error: 'Spedizione non trovata' });
    }
    if (shipment.status !== 'awaiting_preparation') {
      return res.status(400).json({ error: `Spedizione non pronta per questa azione (stato attuale: ${shipment.status})` });
    }

    const updated = await paymentsRepository.markOrdersPreparingByShipment(shipment.id, req.user.userId);
    if (updated.rowCount === 0) {
      return res.status(400).json({ error: 'Nessun ordine in stato valido per questa azione' });
    }

    if (!isLabelEligible(shipment)) {
      const fresh = await shipmentRepository.findById(shipment.id);
      return res.json({ shipment: fresh, labelGenerated: false, manualShippingRequired: true });
    }

    const result = await attemptLabelGeneration(shipment);
    const fresh = await shipmentRepository.findById(shipment.id);
    res.json({ shipment: fresh, labelGenerated: result.ok, error: result.ok ? undefined : result.error });
  } catch (err) {
    console.error('shipment prepare:', err.message);
    res.status(500).json({ error: 'Errore nella preparazione della spedizione' });
  }
});

// Retries label generation after a label_failed — same eligibility rule,
// same shared logic as the first attempt inside /prepare.
router.post('/:id/retry-label', auth, async (req, res) => {
  try {
    const shipment = await shipmentRepository.findById(req.params.id);
    if (!shipment || shipment.seller_id !== req.user.userId) {
      return res.status(404).json({ error: 'Spedizione non trovata' });
    }
    if (shipment.status !== 'label_failed') {
      return res.status(400).json({ error: `Nessuna etichetta da riprovare (stato attuale: ${shipment.status})` });
    }
    if (!isLabelEligible(shipment)) {
      return res.status(400).json({ error: 'Questa spedizione non genera etichetta automatica' });
    }

    const result = await attemptLabelGeneration(shipment);
    const fresh = await shipmentRepository.findById(shipment.id);
    res.json({ shipment: fresh, labelGenerated: result.ok, error: result.ok ? undefined : result.error });
  } catch (err) {
    console.error('shipment retry-label:', err.message);
    res.status(500).json({ error: 'Errore nel nuovo tentativo di generazione etichetta' });
  }
});

const markShippedSchema = Joi.object({
  trackingNumber: Joi.string().trim().min(3).max(100).required(),
  carrier: Joi.string().trim().min(2).max(50).required(),
});

// Manual completion for shipments that don't get an automatic label — TCG
// (tier system) or a fallback_static quote (see isLabelEligible above).
// Does what /prepare + a label success would have done together in one
// call, since there's no label-generation step to wait through here: moves
// any still-payment_received orders to 'preparing' (a no-op if /prepare was
// already called) and straight on to 'shipped' with the tracking the seller
// typed in — the same outcome the old PATCH /api/orders/:id/ship produced,
// just applied to every order in the shipment at once instead of one row
// at a time.
router.post('/:id/mark-shipped', auth, async (req, res) => {
  const { error, value } = markShippedSchema.validate(req.body);
  if (error) return res.status(400).json({ error: error.details[0].message });

  try {
    const shipment = await shipmentRepository.findById(req.params.id);
    if (!shipment || shipment.seller_id !== req.user.userId) {
      return res.status(404).json({ error: 'Spedizione non trovata' });
    }
    if (isLabelEligible(shipment)) {
      return res.status(400).json({ error: 'Questa spedizione genera etichetta automatica: usa "Pronto per la spedizione" invece' });
    }
    if (shipment.status !== 'awaiting_preparation') {
      return res.status(400).json({ error: `Spedizione non pronta per questa azione (stato attuale: ${shipment.status})` });
    }

    await paymentsRepository.markOrdersPreparingByShipment(shipment.id, req.user.userId);
    await shipmentRepository.markManualShipped(shipment.id, value);
    await paymentsRepository.markOrdersShippedByShipment(shipment.id, value);

    const fresh = await shipmentRepository.findById(shipment.id);
    res.json({ shipment: fresh });
  } catch (err) {
    console.error('shipment mark-shipped:', err.message);
    res.status(500).json({ error: 'Errore nella registrazione della spedizione' });
  }
});

module.exports = router;
