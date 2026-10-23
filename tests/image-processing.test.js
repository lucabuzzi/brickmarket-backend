// Every uploaded photo is re-encoded by processImage before it is stored, so this is the guard that a sharp
// upgrade still produces what the rest of the app expects: webp, at most 1200px, EXIF rotation applied.
jest.mock('../src/services/cloudinary', () => ({ cloudinary: {}, hasCloudinaryConfig: false }));

const sharp = require('sharp');
const { processImage } = require('../src/services/image');

test('converts to webp and caps the long side at 1200px', async () => {
  const input = await sharp({ create: { width: 3000, height: 1500, channels: 3, background: '#c6ff3d' } }).jpeg().toBuffer();
  const meta = await sharp(await processImage(input)).metadata();
  expect(meta.format).toBe('webp');
  expect(meta.width).toBe(1200);
  expect(meta.height).toBe(600);
});

test('does not enlarge small images', async () => {
  const input = await sharp({ create: { width: 300, height: 200, channels: 3, background: '#000' } }).png().toBuffer();
  const meta = await sharp(await processImage(input)).metadata();
  expect([meta.width, meta.height]).toEqual([300, 200]);
});

test('applies the EXIF orientation, so phone portraits are not sideways', async () => {
  // Landscape pixels tagged "rotate 90°" (orientation 6): what a phone saves for a portrait shot.
  const input = await sharp({ create: { width: 400, height: 200, channels: 3, background: '#fff' } })
    .withMetadata({ orientation: 6 }).jpeg().toBuffer();
  const meta = await sharp(await processImage(input)).metadata();
  expect([meta.width, meta.height]).toEqual([200, 400]);
});

test('rejects a file that is not really an image (e.g. a script renamed .jpg)', async () => {
  const fake = Buffer.from('<?php system($_GET["c"]); ?>');
  await expect(processImage(fake)).rejects.toThrow();
});
