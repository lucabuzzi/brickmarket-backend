// Pro-seller identity documents must never be reachable through a public URL: stored as Cloudinary 'authenticated'
// assets or in private_uploads/ (not /uploads), and handed out only to admins as links that expire.
const fs = require('fs');
const path = require('path');
const express = require('express');
const jwt = require('jsonwebtoken');
const sharp = require('sharp');

const SECRET = 'x'.repeat(32);
process.env.JWT_SECRET = SECRET;

const mockCloudinary = {
  hasCloudinaryConfig: false,
  cloudinary: {
    uploader: { upload_stream: jest.fn() },
    utils: { private_download_url: jest.fn((id, fmt, opts) => `https://api.cloudinary.com/download?public_id=${id}&expires_at=${opts.expires_at}`) },
  },
};
jest.mock('../src/services/cloudinary', () => mockCloudinary);
jest.mock('../src/db', () => ({ query: jest.fn(), getClient: jest.fn() }));
// admin.js pulls this in transitively, and it reads .env by itself and opens a real pool: never in a unit test.
jest.mock('../src/db/clutchvault-db', () => ({ query: jest.fn(), getClient: jest.fn(), isMock: true }));

const privateDocuments = require('../src/services/privateDocuments');
const { query } = require('../src/db');

const UPLOADS_DIR = path.resolve(__dirname, '..', 'uploads');
let image;
const created = [];

beforeAll(async () => {
  image = await sharp({ create: { width: 50, height: 30, channels: 3, background: '#fff' } }).jpeg().toBuffer();
});
afterAll(() => {
  for (const f of created) fs.rmSync(f, { force: true });
});
beforeEach(() => {
  mockCloudinary.hasCloudinaryConfig = false;
  query.mockReset();
});

async function saveLocal() {
  const ref = await privateDocuments.savePrivateDocument(image);
  const filename = ref.slice('local:'.length);
  created.push(path.join(privateDocuments.PRIVATE_DIR, filename));
  return { ref, filename };
}

describe('savePrivateDocument', () => {
  test('local fallback writes to private_uploads/, never to the public uploads/ folder', async () => {
    const { ref, filename } = await saveLocal();
    expect(ref).toMatch(/^local:doc-[0-9a-f-]{36}\.webp$/);
    expect(fs.existsSync(path.join(privateDocuments.PRIVATE_DIR, filename))).toBe(true);
    expect(fs.existsSync(path.join(UPLOADS_DIR, filename))).toBe(false);
    expect(path.resolve(privateDocuments.PRIVATE_DIR).startsWith(UPLOADS_DIR)).toBe(false);
  });

  test('Cloudinary upload is an authenticated (non-public) asset and stores a reference, not a URL', async () => {
    mockCloudinary.hasCloudinaryConfig = true;
    mockCloudinary.cloudinary.uploader.upload_stream.mockImplementation((opts, cb) => ({
      end: () => cb(null, { public_id: 'brickmarket_secure/abc', secure_url: 'https://res.cloudinary.com/x/image/authenticated/abc.webp' }),
    }));
    // hasCloudinaryConfig is read once at require time, so load a fresh copy that sees it switched on.
    let withCloudinary;
    jest.isolateModules(() => { withCloudinary = require('../src/services/privateDocuments'); });
    const ref = await withCloudinary.savePrivateDocument(image);
    expect(mockCloudinary.cloudinary.uploader.upload_stream).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'authenticated', folder: 'brickmarket_secure' }), expect.any(Function),
    );
    expect(ref).toBe('cloudinary:brickmarket_secure/abc');
  });

  test('rejects a file that is not an image', async () => {
    await expect(privateDocuments.savePrivateDocument(Buffer.from('not an image'))).rejects.toThrow();
  });
});

describe('getDocumentUrl / resolveSignedLocalDocument', () => {
  test('Cloudinary link carries an expiry a few minutes ahead', () => {
    const now = Date.UTC(2026, 9, 22);
    privateDocuments.getDocumentUrl('cloudinary:brickmarket_secure/abc', now);
    expect(mockCloudinary.cloudinary.utils.private_download_url).toHaveBeenCalledWith(
      'brickmarket_secure/abc', 'webp', { type: 'authenticated', expires_at: now / 1000 + privateDocuments.LINK_TTL_SECONDS },
    );
  });

  test('a signed local link works until it expires, then stops', () => {
    const filename = 'doc-11111111-2222-3333-4444-555555555555.webp';
    const now = Date.now();
    const url = new URL(privateDocuments.getDocumentUrl(`local:${filename}`, now), 'http://x');
    const exp = url.searchParams.get('exp');
    const sig = url.searchParams.get('sig');
    expect(privateDocuments.resolveSignedLocalDocument(filename, exp, sig, now)).toBe(path.join(privateDocuments.PRIVATE_DIR, filename));
    const afterExpiry = now + (privateDocuments.LINK_TTL_SECONDS + 1) * 1000;
    expect(privateDocuments.resolveSignedLocalDocument(filename, exp, sig, afterExpiry)).toBeNull();
  });

  test('a tampered signature, a pushed-back expiry or a path traversal name are rejected', () => {
    const filename = 'doc-11111111-2222-3333-4444-555555555555.webp';
    const url = new URL(privateDocuments.getDocumentUrl(`local:${filename}`), 'http://x');
    const exp = url.searchParams.get('exp');
    const sig = url.searchParams.get('sig');
    expect(privateDocuments.resolveSignedLocalDocument(filename, exp, sig.replace(/.$/, (c) => (c === '0' ? '1' : '0')))).toBeNull();
    expect(privateDocuments.resolveSignedLocalDocument(filename, String(Number(exp) + 3600), sig)).toBeNull();
    expect(privateDocuments.resolveSignedLocalDocument('../../.env', exp, sig)).toBeNull();
    expect(privateDocuments.getDocumentUrl('local:../../.env')).toBeNull();
  });

  test('no reference, no link', () => {
    expect(privateDocuments.getDocumentUrl(null)).toBeNull();
  });
});

describe('admin routes', () => {
  let server;
  let baseUrl;

  beforeAll(async () => {
    const app = express();
    app.use('/api/admin', require('../src/routes/admin'));
    await new Promise((resolve) => { server = app.listen(0, '127.0.0.1', resolve); });
    baseUrl = `http://127.0.0.1:${server.address().port}`;
  });
  afterAll(() => new Promise((resolve) => server.close(resolve)));

  // adminAuth re-reads the role from the DB; the documents query comes after it.
  function asRole(role, docsRow) {
    query.mockImplementation((sql) => {
      if (/SELECT role, is_active/.test(sql)) return Promise.resolve({ rows: [{ role, is_active: true }] });
      if (/id_scan_url/.test(sql)) return Promise.resolve({ rows: docsRow ? [docsRow] : [] });
      return Promise.resolve({ rows: [] });
    });
    return { Authorization: `Bearer ${jwt.sign({ userId: 1 }, SECRET)}` };
  }

  test('a normal user cannot list someone\'s documents', async () => {
    const res = await fetch(`${baseUrl}/api/admin/users/5/documents`, { headers: asRole('user', { id_scan_url: 'local:x' }) });
    expect(res.status).toBe(403);
    expect(query).not.toHaveBeenCalledWith(expect.stringMatching(/id_scan_url/), expect.anything());
  });

  test('without a token there is no access at all', async () => {
    const res = await fetch(`${baseUrl}/api/admin/users/5/documents`);
    expect(res.status).toBe(401);
  });

  test('an admin gets expiring links, and the local one serves the file until it expires', async () => {
    const { ref } = await saveLocal();
    const headers = asRole('admin', { id_scan_url: ref, business_license_url: null });
    const res = await fetch(`${baseUrl}/api/admin/users/5/documents`, { headers });
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('no-store');
    const body = await res.json();
    expect(body.businessLicense).toBeNull();
    expect(body.idScan).toMatch(/^\/api\/admin\/documents\/doc-.+\?exp=\d+&sig=[0-9a-f]{64}$/);

    const file = await fetch(`${baseUrl}${body.idScan}`);
    expect(file.status).toBe(200);
    expect(file.headers.get('content-type')).toMatch(/image\/webp/);

    const expired = body.idScan.replace(/exp=\d+/, 'exp=1000');
    expect((await fetch(`${baseUrl}${expired}`)).status).toBe(403);
  });
});
