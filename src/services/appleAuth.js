const jwt = require('jsonwebtoken');
const jwksClient = require('jwks-rsa');

const APPLE_ISSUER = 'https://appleid.apple.com';

const client = jwksClient({
  jwksUri: `${APPLE_ISSUER}/auth/keys`,
  cache: true,
  cacheMaxAge: 24 * 60 * 60 * 1000, // Apple rotates keys infrequently.
  rateLimit: true,
});

function getSigningKey(kid) {
  return new Promise((resolve, reject) => {
    client.getSigningKey(kid, (err, key) => {
      if (err) return reject(err);
      resolve(key.getPublicKey());
    });
  });
}

/**
 * Verifies an Apple Sign-In id_token: signature against Apple's rotating
 * JWKS, plus issuer/audience/expiry. Throws on any invalid/tampered token.
 * Apple sends email_verified as either a boolean or the string "true"/"false"
 * depending on client SDK version, so it's normalized here.
 */
async function verifyAppleIdToken(idToken) {
  const decoded = jwt.decode(idToken, { complete: true });
  if (!decoded?.header?.kid) {
    throw new Error('Apple id_token malformato.');
  }

  const publicKey = await getSigningKey(decoded.header.kid);

  const payload = jwt.verify(idToken, publicKey, {
    algorithms: ['RS256'],
    issuer: APPLE_ISSUER,
    audience: process.env.APPLE_CLIENT_ID,
  });

  return {
    providerUserId: payload.sub,
    email: payload.email || null,
    emailVerified: payload.email_verified === true || payload.email_verified === 'true',
    isPrivateRelayEmail: payload.is_private_email === true || payload.is_private_email === 'true',
  };
}

module.exports = { verifyAppleIdToken };
