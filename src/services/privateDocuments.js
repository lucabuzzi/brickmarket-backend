// Identity documents (ID scan, business registration) uploaded at pro-seller registration. Unlike listing photos
// these must never sit behind a public URL: on Cloudinary they're stored as type 'authenticated' (no URL works
// without a signature), on the local-disk fallback in private_uploads/, which nothing serves statically.
// The DB keeps an opaque reference ("cloudinary:<public_id>" / "local:<filename>"), never a URL; an admin gets a
// link that expires after a few minutes via getDocumentUrl().
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { cloudinary, hasCloudinaryConfig } = require('./cloudinary');
const { processImage } = require('./image');
const { getJwtSecret } = require('../config/jwtSecret');

const CLOUDINARY_FOLDER = 'brickmarket_secure';
const PRIVATE_DIR = path.join(__dirname, '..', '..', 'private_uploads');
const LINK_TTL_SECONDS = 5 * 60;
// Only names this module generates; anything else (../, absolute paths) is rejected before touching the disk.
const LOCAL_NAME_RE = /^doc-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.webp$/;

/** Re-encodes the upload (same pipeline as every other image) and stores it privately. Returns the DB reference. */
async function savePrivateDocument(buffer) {
  const processed = await processImage(buffer);

  if (hasCloudinaryConfig) {
    const result = await new Promise((resolve, reject) => {
      cloudinary.uploader
        .upload_stream({ folder: CLOUDINARY_FOLDER, type: 'authenticated', format: 'webp' }, (err, res) => (err ? reject(err) : resolve(res)))
        .end(processed);
    });
    return `cloudinary:${result.public_id}`;
  }

  await fs.promises.mkdir(PRIVATE_DIR, { recursive: true });
  const filename = `doc-${crypto.randomUUID()}.webp`;
  await fs.promises.writeFile(path.join(PRIVATE_DIR, filename), processed);
  return `local:${filename}`;
}

function signLocal(filename, expiresAt) {
  return crypto.createHmac('sha256', getJwtSecret()).update(`${filename}:${expiresAt}`).digest('hex');
}

/** A link to the document that stops working after LINK_TTL_SECONDS; null for an empty/unknown reference. */
function getDocumentUrl(ref, now = Date.now()) {
  if (!ref) return null;
  const expiresAt = Math.floor(now / 1000) + LINK_TTL_SECONDS;

  if (ref.startsWith('cloudinary:')) {
    const publicId = ref.slice('cloudinary:'.length);
    return cloudinary.utils.private_download_url(publicId, 'webp', { type: 'authenticated', expires_at: expiresAt });
  }
  if (ref.startsWith('local:')) {
    const filename = ref.slice('local:'.length);
    if (!LOCAL_NAME_RE.test(filename)) return null;
    return `/api/admin/documents/${filename}?exp=${expiresAt}&sig=${signLocal(filename, expiresAt)}`;
  }
  return null;
}

/** Absolute path of a local document if the signed link is genuine and unexpired, otherwise null. */
function resolveSignedLocalDocument(filename, exp, sig, now = Date.now()) {
  if (!LOCAL_NAME_RE.test(String(filename)) || !/^\d+$/.test(String(exp)) || typeof sig !== 'string') return null;
  if (Number(exp) < Math.floor(now / 1000)) return null;
  const expected = Buffer.from(signLocal(filename, exp));
  const given = Buffer.from(sig);
  if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) return null;
  return path.join(PRIVATE_DIR, filename);
}

module.exports = { savePrivateDocument, getDocumentUrl, resolveSignedLocalDocument, PRIVATE_DIR, LINK_TTL_SECONDS };
