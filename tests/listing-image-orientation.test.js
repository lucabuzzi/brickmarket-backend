// Photo orientation: (1) EXIF rotation is applied when an upload is processed, (2) the seller's portrait/landscape
// choice reaches the API. No DB, no network.
const sharp = require('sharp');
const { processImage } = require('../src/services/image');
const { INITIAL_FORM, changeProductType, defaultImageOrientation, IMAGE_ORIENTATIONS } = require('../client/src/lib/sell/form.js');
const { buildListingFields } = require('../client/src/lib/sell/payload.js');

const F = (over = {}) => ({ ...INITIAL_FORM, shippingOptions: {}, title: 'Charizard', condition: 'near_mint', price: '10', ...over });
const field = (fields, name) => (fields.find(([k]) => k === name) || [])[1];

// A phone shot of an upright card: the sensor writes 40x20 landscape pixels and tags them "rotate 90° clockwise".
const phonePortraitJpeg = () =>
  sharp({ create: { width: 40, height: 20, channels: 3, background: '#ff0000' } }).jpeg().withMetadata({ orientation: 6 }).toBuffer();

describe('processImage: EXIF orientation', () => {
  test('a portrait phone photo (EXIF 6) comes out portrait', async () => {
    const out = await sharp(await processImage(await phonePortraitJpeg())).metadata();
    expect([out.width, out.height]).toEqual([20, 40]);
  });

  test('a photo without EXIF orientation is left as it is', async () => {
    const plain = await sharp({ create: { width: 40, height: 20, channels: 3, background: '#00ff00' } }).jpeg().toBuffer();
    const out = await sharp(await processImage(plain)).metadata();
    expect([out.width, out.height]).toEqual([40, 20]);
  });

  test('the 1200px limit still applies after rotating', async () => {
    const big = await sharp({ create: { width: 2400, height: 1200, channels: 3, background: '#0000ff' } }).jpeg().withMetadata({ orientation: 6 }).toBuffer();
    const out = await sharp(await processImage(big)).metadata();
    expect([out.width, out.height]).toEqual([600, 1200]);
  });
});

describe('image orientation choice', () => {
  test('default: cards portrait, everything else landscape', () => {
    expect(defaultImageOrientation('tcg')).toBe('portrait');
    expect(defaultImageOrientation('lego')).toBe('landscape');
    expect(defaultImageOrientation('funko')).toBe('landscape');
    expect(IMAGE_ORIENTATIONS).toEqual(['portrait', 'landscape']);
  });

  test('nothing is sent until the seller picks one (the server applies the default)', () => {
    expect(field(buildListingFields(F({ productType: 'tcg', game: 'pokemon' }), 'publish'), 'imageOrientation')).toBeUndefined();
  });

  test('an explicit choice is sent, for publish and draft', () => {
    for (const mode of ['publish', 'draft']) {
      expect(field(buildListingFields(F({ imageOrientation: 'landscape' }), mode), 'imageOrientation')).toBe('landscape');
      expect(field(buildListingFields(F({ imageOrientation: 'portrait' }), mode), 'imageOrientation')).toBe('portrait');
    }
  });

  test('switching product type drops the choice so the new default applies', () => {
    expect(changeProductType(F({ productType: 'lego', imageOrientation: 'portrait' }), 'tcg').imageOrientation).toBe('');
  });
});
