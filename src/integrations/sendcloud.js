// Sendcloud API v3 client — rate quotes + label generation, mockable exactly
// like src/db/clutchvault-db.js's isMock/getMockDbState pattern: when
// SENDCLOUD_API_KEY/SENDCLOUD_API_SECRET aren't configured, every call
// returns deterministic fake data instead of hitting the real API, so the
// rest of the shipping flow (quote persistence, checkout, label trigger,
// seller UI) is fully exercisable without a Sendcloud account.
//
// Contract below is grounded in Sendcloud's real v3 docs (sendcloud.dev),
// fetched while building this — not guessed from memory. Two things that
// still need verifying against a real sandbox account once one exists:
//   - the exact field names on the parcel_status_changed webhook payload
//     (their docs describe it as "same shape as GET one parcel" without
//     listing every field — see verifyAndParseWebhook below)
//   - whether SENDCLOUD_DEFAULT_CONTRACT_ID is actually required for this
//     account's carrier contracts, or whether Sendcloud can auto-select one
const crypto = require('crypto');

const SENDCLOUD_API_KEY = process.env.SENDCLOUD_API_KEY;
const SENDCLOUD_API_SECRET = process.env.SENDCLOUD_API_SECRET;
const SENDCLOUD_WEBHOOK_SECRET = process.env.SENDCLOUD_WEBHOOK_SECRET;
const SENDCLOUD_DEFAULT_CONTRACT_ID = process.env.SENDCLOUD_DEFAULT_CONTRACT_ID || undefined;
const BASE_URL = 'https://panel.sendcloud.sc/api/v3';

const isMock = !SENDCLOUD_API_KEY || !SENDCLOUD_API_SECRET;

if (isMock) {
  console.warn('⚠️ SENDCLOUD_API_KEY/SENDCLOUD_API_SECRET not set. Shipping aggregator running in MOCK mode — rate quotes and labels are simulated, no real Sendcloud account is used.');
}

function authHeader() {
  const token = Buffer.from(`${SENDCLOUD_API_KEY}:${SENDCLOUD_API_SECRET}`).toString('base64');
  return `Basic ${token}`;
}

function toApiAddress(addr) {
  return {
    name: addr.fullName,
    address_line_1: [addr.addressStreet, addr.addressHouseNumber].filter(Boolean).join(' '),
    postal_code: addr.zip,
    city: addr.city,
    country_code: (addr.country || 'IT').toUpperCase(),
  };
}

// ── Mock implementations ────────────────────────────────────────────────────
// Same shape the real branch normalizes to (see fetchRates/createLabel
// return values below) — callers never need to know which mode is active.

function mockFetchRates({ weightKg }) {
  const w = Number(weightKg) || 1;
  const carriers = [
    { shippingOptionCode: 'mock:standard', carrierCode: 'mock', carrierName: 'Corriere Standard (mock)', base: 4.5 },
    { shippingOptionCode: 'mock:express', carrierCode: 'mock', carrierName: 'Corriere Espresso (mock)', base: 8.5 },
  ];
  return carriers.map((c) => ({
    shippingOptionCode: c.shippingOptionCode,
    carrierCode: c.carrierCode,
    carrierName: c.carrierName,
    price: Math.round((c.base + w * 1.2) * 100) / 100,
    currency: 'EUR',
  }));
}

function mockCreateLabel({ shipmentId }) {
  const trackingNumber = `MOCK${String(shipmentId).replace(/-/g, '').slice(0, 12).toUpperCase()}`;
  return {
    sendcloudParcelId: `mock_${trackingNumber}`,
    trackingNumber,
    trackingUrl: `https://example-mock-tracking.invalid/${trackingNumber}`,
    labelUrl: `https://example-mock-tracking.invalid/${trackingNumber}/label.pdf`,
    carrierCode: 'mock',
    statusCode: 'READY_TO_SEND',
  };
}

// ── Real API calls ──────────────────────────────────────────────────────────

/** Live rate quote for one parcel. Returns [{ shippingOptionCode, carrierCode, carrierName, price, currency }]. */
async function fetchRates({ fromAddress, toAddress, weightKg, lengthCm, widthCm, heightCm }) {
  if (isMock) return mockFetchRates({ weightKg });

  const body = {
    calculate_quotes: true,
    from_address: toApiAddress(fromAddress),
    to_address: toApiAddress(toAddress),
    parcels: [{
      weight: { value: String(weightKg), unit: 'kg' },
      ...(lengthCm && widthCm && heightCm
        ? { dimensions: { length: String(lengthCm), width: String(widthCm), height: String(heightCm), unit: 'cm' } }
        : {}),
    }],
  };

  const res = await fetch(`${BASE_URL}/shipping-options`, {
    method: 'POST',
    headers: { Authorization: authHeader(), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Sendcloud rate request failed (${res.status}): ${text}`);
  }
  const json = await res.json();
  const options = Array.isArray(json.data) ? json.data : [];

  return options
    .filter((opt) => !opt.quote_error && Array.isArray(opt.quotes) && opt.quotes.length > 0)
    .map((opt) => ({
      shippingOptionCode: opt.code,
      carrierCode: opt.carrier?.code || null,
      carrierName: opt.carrier?.name || opt.name || opt.code,
      price: Number(opt.quotes[0]?.price?.total?.value) || 0,
      currency: opt.quotes[0]?.price?.total?.currency || 'EUR',
    }));
}

/** Books a real shipment + label. Returns { sendcloudParcelId, trackingNumber, trackingUrl, labelUrl, carrierCode, statusCode }. */
async function createShipmentLabel({
  shipmentId, fromAddress, toAddress, weightKg, lengthCm, widthCm, heightCm,
  shippingOptionCode, contractId,
}) {
  if (isMock) return mockCreateLabel({ shipmentId });

  const body = {
    external_reference_id: shipmentId, // our own shipments.id — unique per shipment, doubles as idempotency key
    sender_address: toApiAddress(fromAddress),
    recipient_address: toApiAddress(toAddress),
    parcels: [{
      weight: { value: String(weightKg), unit: 'kg' },
      ...(lengthCm && widthCm && heightCm
        ? { dimensions: { length: String(lengthCm), width: String(widthCm), height: String(heightCm), unit: 'cm' } }
        : {}),
    }],
    ship_with: {
      type: 'shipping_option_code',
      properties: {
        shipping_option_code: shippingOptionCode,
        ...(contractId || SENDCLOUD_DEFAULT_CONTRACT_ID ? { contract_id: contractId || SENDCLOUD_DEFAULT_CONTRACT_ID } : {}),
      },
    },
  };

  const res = await fetch(`${BASE_URL}/shipments/announce`, {
    method: 'POST',
    headers: { Authorization: authHeader(), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Sendcloud label request failed (${res.status}): ${text}`);
  }
  const json = await res.json();
  const parcel = json.data?.parcels?.[0];
  if (!parcel) throw new Error('Sendcloud label response had no parcel data');

  return {
    sendcloudParcelId: parcel.id != null ? String(parcel.id) : null,
    trackingNumber: parcel.tracking_number || null,
    trackingUrl: parcel.tracking_url || null,
    labelUrl: parcel.documents?.find((d) => d.type === 'label')?.link || null,
    carrierCode: json.data?.carrier?.code || null,
    statusCode: parcel.status?.code || null,
  };
}

/** Verifies the Sendcloud-Signature header (HMAC-SHA256 over the raw body)
 *  and returns the parsed payload, or null if the signature doesn't match.
 *  rawBody must be the untouched request body Buffer/string (express.raw). */
function verifyAndParseWebhook(rawBody, signatureHeader) {
  if (isMock) {
    // Mock mode never receives real Sendcloud traffic; nothing to verify
    // against. Kept as a distinct branch so this is obvious if it's ever hit.
    try { return JSON.parse(rawBody.toString('utf8')); } catch { return null; }
  }
  if (!signatureHeader || !SENDCLOUD_WEBHOOK_SECRET) return null;

  const expected = crypto
    .createHmac('sha256', SENDCLOUD_WEBHOOK_SECRET)
    .update(rawBody)
    .digest('hex');

  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(signatureHeader, 'utf8');
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  try {
    return JSON.parse(rawBody.toString('utf8'));
  } catch {
    return null;
  }
}

module.exports = {
  get isMock() { return isMock; },
  fetchRates,
  createShipmentLabel,
  verifyAndParseWebhook,
};
