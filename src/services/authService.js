const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const userRepository = require('../repositories/userRepository');
const { sendRecoveryEmail } = require('./email');
const { withTransaction } = require('../db');

class AuthError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function generateToken(user) {
  return jwt.sign(
    { userId: user.id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
}

async function register(data) {
  const existing = await userRepository.findByEmailOrUsername(data.email, data.username);
  if (existing) {
    throw new AuthError(409, 'Email o username già in uso');
  }

  const passwordHash = await bcrypt.hash(data.password, 12);
  const user = await userRepository.createUser({ ...data, passwordHash });
  const token = generateToken(user);

  return { token, user };
}

async function login(identifier, password) {
  const user = await userRepository.findByEmailOrUsernameLogin(identifier);

  // Also rejects OAuth-only accounts (no password_hash) attempting classic login.
  if (!user || !user.password_hash || !(await bcrypt.compare(password, user.password_hash))) {
    throw new AuthError(401, 'Credenziali non valide');
  }

  if (user.is_active === false) {
    throw new AuthError(403, 'Account disabilitato.');
  }

  const token = generateToken(user);
  return {
    token,
    user: { id: user.id, email: user.email, username: user.username, role: user.role },
  };
}

async function requestPasswordReset(email) {
  const user = await userRepository.findByEmail(email);
  if (!user) {
    // Prevenzione enumerazione account: nessun segnale al chiamante.
    return;
  }

  const resetToken = crypto.randomBytes(32).toString('hex');
  const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');
  const expires = new Date(Date.now() + 3600000); // 1 ora

  await userRepository.setResetToken(email, hashedToken, expires);

  const resetLink = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/reset-password?token=${resetToken}`;
  await sendRecoveryEmail(email.toLowerCase(), resetLink);
}

async function resetPassword(token, newPassword) {
  const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
  const user = await userRepository.findByResetToken(hashedToken);

  if (!user) {
    throw new AuthError(400, 'Il link di reset è invalido o scaduto. Ritenta.');
  }

  const passwordHash = await bcrypt.hash(newPassword, 12);
  await userRepository.updatePassword(user.id, passwordHash);

  return { email: user.email };
}

function sanitizeUsernameBase(email) {
  const local = email.split('@')[0].toLowerCase().replace(/[^a-z0-9_]/g, '');
  return (local.length >= 3 ? local : `user${local}`).slice(0, 90);
}

async function generateUniqueUsername(base, client) {
  if (!(await userRepository.usernameExists(base, client))) {
    return base;
  }
  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = `${base}${crypto.randomInt(1000, 9999)}`;
    if (!(await userRepository.usernameExists(candidate, client))) {
      return candidate;
    }
  }
  throw new AuthError(500, 'Impossibile generare uno username univoco. Riprova.');
}

/**
 * Login-or-register via an external OAuth/OIDC provider (Google, Apple).
 * The caller must have already verified the id_token's signature/audience/
 * issuer — this function only trusts the already-verified claims passed in.
 *
 * Linking strategy: an existing identity wins first; otherwise an existing
 * local/other-provider account with the same email is linked to the new
 * provider — but only if the provider itself asserts the email is verified,
 * to prevent an attacker from hijacking an account via an unverified email
 * on a rogue/compromised social account.
 */
async function loginOrRegisterWithProvider({ provider, providerUserId, email, emailVerified, fullName }) {
  return withTransaction(async (client) => {
    const existingIdentity = await userRepository.findIdentity(provider, providerUserId, client);
    if (existingIdentity) {
      const user = await userRepository.findById(existingIdentity.user_id, client);
      if (!user) {
        throw new AuthError(404, 'Utente non trovato.');
      }
      if (user.is_active === false) {
        throw new AuthError(403, 'Account disabilitato.');
      }
      return { token: generateToken(user), user, isNewUser: false };
    }

    if (!email) {
      throw new AuthError(400, `${provider} non ha fornito un indirizzo email. Impossibile procedere.`);
    }

    const existingByEmail = await userRepository.findByEmailFull(email, client);

    if (existingByEmail) {
      if (existingByEmail.is_active === false) {
        throw new AuthError(403, 'Account disabilitato.');
      }
      if (!emailVerified) {
        throw new AuthError(
          409,
          'Esiste già un account con questa email. Accedi con il metodo originale per collegare il provider social.'
        );
      }
      await userRepository.createIdentity(existingByEmail.id, provider, providerUserId, email, client);
      const user = await userRepository.findById(existingByEmail.id, client);
      return { token: generateToken(user), user, isNewUser: false };
    }

    const usernameBase = sanitizeUsernameBase(email);
    const username = await generateUniqueUsername(usernameBase, client);

    const newUser = await userRepository.createOAuthUser(
      { email, username, fullName, emailVerified },
      client
    );
    await userRepository.createIdentity(newUser.id, provider, providerUserId, email, client);
    const user = await userRepository.findById(newUser.id, client);
    return { token: generateToken(user), user, isNewUser: true };
  });
}

module.exports = {
  AuthError,
  generateToken,
  register,
  login,
  requestPasswordReset,
  resetPassword,
  loginOrRegisterWithProvider,
};
