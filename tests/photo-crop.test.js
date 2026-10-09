// Pure rules behind the photo crop editor (client/src/lib/sell/crop.js). No React, no canvas, no network.
const {
  CROP_ASPECTS, CROP_ASPECT_IDS, CROP_MAX_SIDE, initialCropAspect, cropOutputSize, clampCropRegion, croppedFileName,
} = require('../client/src/lib/sell/crop.js');

describe('crop aspect', () => {
  test('the editor opens with the listing orientation', () => {
    expect(initialCropAspect('portrait')).toBe('portrait');
    expect(initialCropAspect('landscape')).toBe('landscape');
    expect(initialCropAspect('')).toBe('landscape');
    expect(initialCropAspect(undefined)).toBe('landscape');
  });

  test('portrait is taller than wide, landscape wider than tall, square is 1', () => {
    expect(CROP_ASPECTS.portrait).toBeCloseTo(3 / 4);
    expect(CROP_ASPECTS.landscape).toBeCloseTo(4 / 3);
    expect(CROP_ASPECTS.square).toBe(1);
    expect(CROP_ASPECT_IDS).toEqual(['portrait', 'landscape', 'square']);
  });
});

describe('cropOutputSize', () => {
  test('a small crop is never scaled up', () => {
    expect(cropOutputSize(300, 400)).toEqual({ width: 300, height: 400 });
  });

  test('a big crop is scaled down so the longest side is at most the limit, keeping its shape', () => {
    const out = cropOutputSize(3000, 4000);
    expect(Math.max(out.width, out.height)).toBe(CROP_MAX_SIDE);
    expect(out.width / out.height).toBeCloseTo(3 / 4, 2);
    expect(cropOutputSize(4000, 3000)).toEqual({ width: 1600, height: 1200 });
  });

  test('never returns a zero-sized image', () => {
    expect(cropOutputSize(0, 0)).toEqual({ width: 1, height: 1 });
    expect(cropOutputSize(0.2, 5000, 100)).toEqual({ width: 1, height: 100 });
  });
});

describe('clampCropRegion', () => {
  test('rounds a region that is inside the image', () => {
    expect(clampCropRegion({ x: 10.4, y: 20.6, width: 100.2, height: 150.7 }, 1000, 800)).toEqual({ x: 10, y: 21, width: 100, height: 151 });
  });

  test('pulls a region that sticks out past the edge back inside', () => {
    expect(clampCropRegion({ x: -3, y: 700, width: 500.4, height: 150 }, 1000, 800)).toEqual({ x: 0, y: 700, width: 500, height: 100 });
    expect(clampCropRegion({ x: 900, y: 0, width: 250, height: 800 }, 1000, 800)).toEqual({ x: 900, y: 0, width: 100, height: 800 });
  });

  test('returns null when there is nothing to cut', () => {
    expect(clampCropRegion(null, 1000, 800)).toBeNull();
    expect(clampCropRegion({ x: 0, y: 0, width: 0, height: 0 }, 1000, 800)).toBeNull();
    expect(clampCropRegion({ x: 0, y: 0, width: 10, height: 10 }, 0, 800)).toBeNull();
  });
});

describe('croppedFileName', () => {
  test('always ends in .jpg, whatever the original was', () => {
    expect(croppedFileName('IMG_0042.HEIC')).toBe('IMG_0042.jpg');
    expect(croppedFileName('card.front.png')).toBe('card.front.jpg');
    expect(croppedFileName('noext')).toBe('noext.jpg');
    expect(croppedFileName('')).toBe('photo.jpg');
    expect(croppedFileName(undefined)).toBe('photo.jpg');
  });
});
