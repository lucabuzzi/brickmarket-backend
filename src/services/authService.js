const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const userRepository = require('../repositories/userRepository');
const walletRepository = require('../repositories/walletRepository');
const creditConfigRepository = require('../repositories/creditConfigRepository');
const identitySignalRepository = require('../repositories/identitySignalRepository');
const { sendRecoveryEmail, sendVerificationEmail } = require('./email');
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
  const referralCode = await generateUniqueReferralCode();
  const user = await userRepository.createUser({ ...data, passwordHash, referralCode });
  const token = generateToken(user);

  // Anti-abuso (CLAUDE.md): segnali di identità raccolti alla registrazione, usati
  // per capire più avanti se un venditore e un compratore sono la stessa persona.
  await identitySignalRepository.recordSignal(user.id, 'ip', data.ip);
  await identitySignalRepository.recordSignal(user.id, 'device', data.userAgent);
  if (data.street) {
    await identitySignalRepository.recordAddressSignal(user.id, {
      street: data.street, houseNumber: data.houseNumber, zip: data.zipCode, country: data.country,
    });
  }

  // Un codice referral errato/inventato non deve mai impedire la registrazione:
  // se non corrisponde a nessuno, semplicemente non si crea nessun legame.
  if (data.referralCode) {
    try {
      await linkReferral(data.referralCode, user.id);
    } catch (err) {
      console.error('Collegamento referral fallito (registrazione comunque completata):', err.message);
    }
  }

  // Un fornitore email temporaneamente giù non deve impedire la creazione
  // dell'account (già scritto in DB, token già emesso): l'utente può sempre
  // richiedere un nuovo invio con /api/auth/resend-verification-email.
  try {
    await sendEmailVerification(user.id, user.email);
  } catch (err) {
    console.error('Invio email di verifica fallito (registrazione comunque completata):', err.message);
  }

  return { token, user };
}

async function generateUniqueReferralCode(client) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = randomReferralCode();
    if (!(await userRepository.referralCodeExists(candidate, client))) {
      return candidate;
    }
  }
  throw new AuthError(500, 'Impossibile generare un codice referral univoco. Riprova.');
}

// Esclude caratteri ambigui (I/1, O/0) per codici leggibili/digitabili a mano.
const REFERRAL_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function randomReferralCode(length = 8) {
  let code = '';
  for (let i = 0; i < length; i++) {
    code += REFERRAL_CODE_CHARS[crypto.randomInt(REFERRAL_CODE_CHARS.length)];
  }
  return code;
}

async function linkReferral(enteredCode, referredId) {
  const code = enteredCode.trim().toUpperCase();
  if (!code) return;

  const referrer = await userRepository.findUserByReferralCode(code);
  if (!referrer || referrer.id === referredId) return; // codice sconosciuto, o auto-referral impossibile ma per sicurezza

  await userRepository.createReferral(referrer.id, referredId, code);
}

async function sendEmailVerification(userId, email) {
  const rawToken = crypto.randomBytes(32).toString('hex');
  const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');
  const expires = new Date(Date.now() + 24 * 3600000); // 24 ore

  await userRepository.setEmailVerificationToken(userId, hashedToken, expires);

  const verifyLink = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/verifica-email?token=${rawToken}`;
  await sendVerificationEmail(email.toLowerCase(), verifyLink);
}

// Idempotente per costruzione: se questo utente ha già una riga signup_bonus nel
// ledger, non ne accredita una seconda. Protegge i (rari) retry manuali — il
// percorso normale è già reso a-vincitore-unico dall'UPDATE atomica in
// userRepository.verifyEmailByToken, che questa funzione presuppone sia già passata.
async function grantSignupBonusOnce(userId) {
  const already = await walletRepository.findTransactionByTypeAndReference(userId, 'signup_bonus', userId);
  if (already) return 0;

  const amount = await creditConfigRepository.get('signup_bonus');
  if (!(amount > 0)) return 0;

  await walletRepository.creditWallet(userId, amount, { referenceId: userId, type: 'signup_bonus' });
  return amount;
}

async function verifyEmail(rawToken) {
  const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');
  const user = await userRepository.verifyEmailByToken(hashedToken);

  if (!user) {
    throw new AuthError(400, 'Il link di verifica è invalido, scaduto o già usato.');
  }

  const bonusAmount = await grantSignupBonusOnce(user.id);

  // Un problema qui non deve mai far fallire la risposta al neo-verificato: il suo
  // bonus è già al sicuro, il bonus al referrer è un side-effect indipendente.
  try {
    await completeReferralAndCreditReferrer(user.id);
  } catch (err) {
    console.error(`Referral completion failed for referred user ${user.id}:`, err.message);
  }

  return { email: user.email, bonusAmount };
}

// completeReferral è una UPDATE atomica pending->completed: se questo invitato non
// era stato invitato da nessuno, o il suo referral è già stato completato da un
// tentativo precedente, non ritorna nulla e non si accredita nulla di nuovo.
async function completeReferralAndCreditReferrer(referredId) {
  const referral = await userRepository.completeReferral(referredId);
  if (!referral) return;

  const amount = await creditConfigRepository.get('referral_bonus');
  if (!(amount > 0)) return;

  await walletRepository.creditWallet(referral.referrer_id, amount, {
    referenceId: referredId,
    type: 'referral_bonus',
  });
}

async function getReferralInfo(userId) {
  const user = await userRepository.findById(userId);
  if (!user) {
    throw new AuthError(404, 'Utente non trovato.');
  }

  const stats = await userRepository.getReferralStats(userId);
  return {
    referralCode: user.referral_code,
    completedReferrals: stats.completed,
    pendingReferrals: stats.pending,
  };
}

async function resendVerificationEmail(userId) {
  const user = await userRepository.findById(userId);
  if (!user) {
    throw new AuthError(404, 'Utente non trovato.');
  }
  if (user.email_verified) {
    throw new AuthError(400, 'Email già verificata.');
  }

  await sendEmailVerification(user.id, user.email);
}

async function login(identifier, password, ip, userAgent) {
  const user = await userRepository.findByEmailOrUsernameLogin(identifier);

  // Also rejects OAuth-only accounts (no password_hash) attempting classic login.
  if (!user || !user.password_hash || !(await bcrypt.compare(password, user.password_hash))) {
    throw new AuthError(401, 'Credenziali non valide');
  }

  if (user.is_active === false) {
    throw new AuthError(403, 'Account disabilitato.');
  }

  await identitySignalRepository.recordSignal(user.id, 'ip', ip);
  await identitySignalRepository.recordSignal(user.id, 'device', userAgent);

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
async function loginOrRegisterWithProvider({
  provider, providerUserId, email, emailVerified, fullName, ip, userAgent,
  referralCode: enteredReferralCode,
}) {
  const result = await withTransaction(async (client) => {
    const existingIdentity = await userRepository.findIdentity(provider, providerUserId, client);
    if (existingIdentity) {
      const user = await userRepository.findById(existingIdentity.user_id, client);
      if (!user) {
        throw new AuthError(404, 'Utente non trovato.');
      }
      if (user.is_active === false) {
        throw new AuthError(403, 'Account disabilitato.');
      }
      await identitySignalRepository.recordSignal(user.id, 'ip', ip, client);
      await identitySignalRepository.recordSignal(user.id, 'device', userAgent, client);
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
      await identitySignalRepository.recordSignal(user.id, 'ip', ip, client);
      await identitySignalRepository.recordSignal(user.id, 'device', userAgent, client);
      return { token: generateToken(user), user, isNewUser: false };
    }

    const usernameBase = sanitizeUsernameBase(email);
    const username = await generateUniqueUsername(usernameBase, client);
    const referralCode = await generateUniqueReferralCode(client);

    const newUser = await userRepository.createOAuthUser(
      { email, username, fullName, emailVerified, referralCode },
      client
    );
    await userRepository.createIdentity(newUser.id, provider, providerUserId, email, client);
    const user = await userRepository.findById(newUser.id, client);
    await identitySignalRepository.recordSignal(newUser.id, 'ip', ip, client);
    await identitySignalRepository.recordSignal(newUser.id, 'device', userAgent, client);

    return { token: generateToken(user), user, isNewUser: true };
  });

  // Bonus registrazione + referral vivono sul pool ClutchVault (wallet/crediti), una
  // connessione del tutto separata da quella main-db appena usata sopra: devono girare
  // SOLO dopo che la transazione ha fatto commit, altrimenti la FK di
  // user_wallets/credit_transactions/referrals su questo utente fallirebbe contro una
  // riga per loro ancora invisibile (non ancora committata). A differenza del signup
  // classico, qui l'email è già verificata dal provider fin dalla creazione
  // dell'account: bonus e referral scattano subito, non serve un link da cliccare.
  if (result.isNewUser && emailVerified) {
    try {
      await grantSignupBonusOnce(result.user.id);
    } catch (err) {
      console.error(`OAuth signup bonus grant failed for user ${result.user.id}:`, err.message);
    }

    if (enteredReferralCode) {
      try {
        await linkReferral(enteredReferralCode, result.user.id);
        await completeReferralAndCreditReferrer(result.user.id);
      } catch (err) {
        console.error(`OAuth referral link/complete failed for user ${result.user.id}:`, err.message);
      }
    }
  }

  return result;
}

module.exports = {
  AuthError,
  generateToken,
  register,
  login,
  requestPasswordReset,
  resetPassword,
  verifyEmail,
  resendVerificationEmail,
  getReferralInfo,
  loginOrRegisterWithProvider,
};
