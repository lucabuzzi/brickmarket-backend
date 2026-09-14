const express = require('express');
const router = express.Router();
const sendcloud = require('../services/sendcloud');
const shipmentRepository = require('../repositories/shipmentRepository');

// Sendcloud's parcel_status_changed webhook — tracking updates for shipments
// booked via /api/shipments/:id/prepare. Must receive the RAW body (see the
// express.raw mount in server.js, kept above the global express.json() the
// same way the Stripe webhooks are) since the signature is computed over the
// exact bytes received, not a re-serialized JSON.parse of them.
router.post('/', async (req, res) => {
  const signature = req.headers['sendcloud-signature'];
  const payload = sendcloud.verifyAndParseWebhook(req.body, signature);
  if (!payload) {
    return res.status(400).json({ error: 'Invalid signature' });
  }

  // Sendcloud's docs describe this payload as "the same shape you'd get
  // retrieving one parcel" without listing exact field names — read
  // defensively from the couple of plausible shapes until this is verified
  // against a real sandbox payload (no Sendcloud account exists yet).
  const parcel = payload.parcel || payload.data || payload;
  const parcelId = parcel?.id != null ? String(parcel.id) : null;
  const statusCode = parcel?.status?.code || parcel?.status_code || null;

  if (!parcelId || !statusCode) {
    console.warn('Sendcloud webhook: could not read parcel id/status from payload:', JSON.stringify(payload));
    return res.status(200).json({ received: true, ignored: true });
  }

  try {
    const shipmentId = await shipmentRepository.applyCarrierStatus(parcelId, statusCode);
    if (!shipmentId) {
      console.warn(`Sendcloud webhook: no shipment for parcel ${parcelId}, or status "${statusCode}" isn't mapped (see CARRIER_STATUS_MAP in shipmentRepository.js)`);
    }
    res.json({ received: true });
  } catch (err) {
    console.error('Sendcloud webhook processing failed:', err.message);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

module.exports = router;
