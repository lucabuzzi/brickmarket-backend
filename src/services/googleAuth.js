const { OAuth2Client } = require('google-auth-library');

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

/**
 * Verifies a Google Identity Services id_token (signature, audience, issuer,
 * expiry all checked by the library). Throws on any invalid/tampered token.
 */
async function verifyGoogleIdToken(idToken) {
  const ticket = await client.verifyIdToken({
    idToken,
    audience: process.env.GOOGLE_CLIENT_ID,
  });

  const payload = ticket.getPayload();

  return {
    providerUserId: payload.sub,
    email: payload.email,
    emailVerified: payload.email_verified === true,
    fullName: payload.name || [payload.given_name, payload.family_name].filter(Boolean).join(' ') || null,
    picture: payload.picture || null,
  };
}

module.exports = { verifyGoogleIdToken };
