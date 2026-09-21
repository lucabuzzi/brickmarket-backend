const authService = require('../services/authService');
const userRepository = require('../repositories/userRepository');
const identitySignalRepository = require('../repositories/identitySignalRepository');
const { uploadOrSaveProcessedImage } = require('../services/image');
const { verifyTurnstile } = require('../services/turnstile');
const { verifyGoogleIdToken } = require('../services/googleAuth');
const { verifyAppleIdToken } = require('../services/appleAuth');
const {
  registerSchema, loginSchema, forgotPasswordSchema, resetPasswordSchema, verifyEmailSchema, updateProfileSchema,
  googleAuthSchema, appleAuthSchema, validate,
} = require('../validators/authValidators');

function handleAuthError(res, err, fallbackMessage) {
  if (err instanceof authService.AuthError) {
    return res.status(err.status).json({ error: err.message });
  }
  console.error(fallbackMessage, err.message);
  return res.status(500).json({ error: fallbackMessage });
}

async function registerHandler(req, res) {
  const { error, value } = validate(registerSchema, req.body);
  if (error) {
    return res.status(400).json({ error });
  }

  const captchaOk = await verifyTurnstile(value.turnstileToken, req.ip);
  if (!captchaOk) {
    return res.status(400).json({ error: 'Verifica anti-bot non superata. Riprova.' });
  }

  let idScanUrl = null;
  let businessLicenseUrl = null;

  if (req.files?.id_scan?.[0]) {
    idScanUrl = await uploadOrSaveProcessedImage(req.files.id_scan[0].buffer, 'brickmarket_secure');
  }
  if (req.files?.business_license?.[0]) {
    businessLicenseUrl = await uploadOrSaveProcessedImage(req.files.business_license[0].buffer, 'brickmarket_secure');
  }

  try {
    const { token, user } = await authService.register({
      email: value.email,
      password: value.password,
      username: value.username,
      fullName: value.fullName,
      city: value.city || null,
      fiscalCode: value.fiscalCode || null,
      iban: value.iban || null,
      sellerType: value.sellerType || null,
      companyName: value.companyName || null,
      street: value.street || null,
      houseNumber: value.houseNumber || null,
      zipCode: value.zipCode || null,
      country: value.country || null,
      phone: value.phone || null,
      idScanUrl,
      businessLicenseUrl,
      referralCode: value.referralCode || null,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.status(201).json({
      message: 'Registrazione completata! Benvenuto nel club.',
      token,
      user,
    });
  } catch (err) {
    handleAuthError(res, err, 'Errore durante la registrazione');
  }
}

async function loginHandler(req, res) {
  const { error, value } = validate(loginSchema, req.body);
  if (error) {
    return res.status(400).json({ error });
  }

  const captchaOk = await verifyTurnstile(value.turnstileToken, req.ip);
  if (!captchaOk) {
    return res.status(400).json({ error: 'Verifica anti-bot non superata. Riprova.' });
  }

  try {
    const { token, user } = await authService.login(value.email, value.password, req.ip, req.headers['user-agent']);
    res.json({ token, user });
  } catch (err) {
    handleAuthError(res, err, 'Errore login');
  }
}

async function meHandler(req, res) {
  try {
    const user = await userRepository.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ error: 'Utente non trovato' });
    }
    res.json(user);
  } catch (err) {
    console.error('ERRORE PROFILO:', err.message);
    res.status(500).json({ error: 'Errore nel recupero del profilo' });
  }
}

async function updateMeHandler(req, res) {
  const { error, value } = validate(updateProfileSchema, req.body);
  if (error) {
    return res.status(400).json({ error });
  }

  try {
    let newAvatarUrl;
    if (req.file) {
      newAvatarUrl = await uploadOrSaveProcessedImage(req.file.buffer, 'brickmarket_avatars');
    }

    const fields = {};

    if (value.city !== undefined) {
      fields.city = value.city || null;
    }
    if (value.full_name !== undefined) fields.full_name = value.full_name || null;
    if (newAvatarUrl !== undefined) fields.avatar_url = newAvatarUrl;
    if (value.street !== undefined) fields.address_street = value.street || null;
    if (value.houseNumber !== undefined) fields.address_house_number = value.houseNumber || null;
    if (value.zipCode !== undefined) fields.address_zip_code = value.zipCode || null;
    if (value.country !== undefined) fields.address_country = value.country || null;
    if (value.phone !== undefined) fields.phone = value.phone || null;

    if (Object.keys(fields).length === 0) {
      return res.status(400).json({ error: 'Nessun dato da aggiornare' });
    }

    const updated = await userRepository.updateProfile(req.user.userId, fields);
    if (!updated) {
      return res.status(404).json({ error: 'Utente non trovato' });
    }

    // Anti-abuso (CLAUDE.md): se l'utente ha appena impostato/cambiato il proprio
    // indirizzo, aggiorna anche il segnale usato per il confronto venditore-compratore.
    if (updated.address_street) {
      await identitySignalRepository.recordAddressSignal(updated.id, {
        street: updated.address_street,
        houseNumber: updated.address_house_number,
        zip: updated.address_zip_code,
        country: updated.address_country,
      });
    }

    res.json(updated);
  } catch (err) {
    console.error('ERRORE AGGIORNAMENTO PROFILO:', err.message);
    res.status(500).json({ error: "Errore durante l'aggiornamento del profilo" });
  }
}

async function forgotPasswordHandler(req, res) {
  const { error, value } = validate(forgotPasswordSchema, req.body);
  if (error) {
    return res.status(400).json({ error });
  }

  try {
    await authService.requestPasswordReset(value.email);
    // Risposta sempre identica, a prescindere dall'esistenza dell'account.
    res.json({ message: "Se l'email esiste, riceverai un link per reimpostare la tua password." });
  } catch (err) {
    console.error('ERRORE FORGOT PASSWORD:', err);
    res.status(500).json({ error: 'Errore interno nel processo di reset.' });
  }
}

async function resetPasswordHandler(req, res) {
  const { error, value } = validate(resetPasswordSchema, req.body);
  if (error) {
    return res.status(400).json({ error });
  }

  try {
    const { email } = await authService.resetPassword(value.token, value.newPassword);
    res.json({ message: 'La tua password è stata aggiornata con successo. Puoi effettuare il login.', email });
  } catch (err) {
    handleAuthError(res, err, 'Errore interno al server.');
  }
}

async function verifyEmailHandler(req, res) {
  const { error, value } = validate(verifyEmailSchema, req.body);
  if (error) {
    return res.status(400).json({ error });
  }

  try {
    const { email, bonusAmount } = await authService.verifyEmail(value.token);
    res.json({ message: 'Email verificata con successo.', email, bonusAmount });
  } catch (err) {
    handleAuthError(res, err, 'Errore nella verifica email.');
  }
}

async function referralInfoHandler(req, res) {
  try {
    const info = await authService.getReferralInfo(req.user.userId);
    res.json(info);
  } catch (err) {
    handleAuthError(res, err, 'Errore nel recupero dei dati referral.');
  }
}

async function resendVerificationEmailHandler(req, res) {
  try {
    await authService.resendVerificationEmail(req.user.userId);
    res.json({ message: 'Email di verifica inviata.' });
  } catch (err) {
    handleAuthError(res, err, "Errore nell'invio della email di verifica.");
  }
}

async function googleAuthHandler(req, res) {
  const { error, value } = validate(googleAuthSchema, req.body);
  if (error) {
    return res.status(400).json({ error });
  }

  try {
    const { providerUserId, email, emailVerified, fullName } = await verifyGoogleIdToken(value.credential);

    const { token, user, isNewUser } = await authService.loginOrRegisterWithProvider({
      provider: 'google',
      providerUserId,
      email,
      emailVerified,
      fullName,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      referralCode: value.referralCode || null,
    });

    res.status(isNewUser ? 201 : 200).json({ token, user, isNewUser });
  } catch (err) {
    if (err instanceof authService.AuthError) {
      return res.status(err.status).json({ error: err.message });
    }
    console.error('GOOGLE AUTH ERROR:', err.message);
    res.status(401).json({ error: 'Token Google non valido.' });
  }
}

async function appleAuthHandler(req, res) {
  const { error, value } = validate(appleAuthSchema, req.body);
  if (error) {
    return res.status(400).json({ error });
  }

  try {
    const { providerUserId, email, emailVerified } = await verifyAppleIdToken(value.id_token);

    // Il nome arriva solo alla primissima autorizzazione, nel body "user".
    const nameParts = value.user?.name;
    const fullName = nameParts
      ? [nameParts.firstName, nameParts.lastName].filter(Boolean).join(' ') || null
      : null;

    const { token, user, isNewUser } = await authService.loginOrRegisterWithProvider({
      provider: 'apple',
      providerUserId,
      email,
      emailVerified,
      fullName,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      referralCode: value.referralCode || null,
    });

    res.status(isNewUser ? 201 : 200).json({ token, user, isNewUser });
  } catch (err) {
    if (err instanceof authService.AuthError) {
      return res.status(err.status).json({ error: err.message });
    }
    console.error('APPLE AUTH ERROR:', err.message);
    res.status(401).json({ error: 'Token Apple non valido.' });
  }
}

module.exports = {
  registerHandler,
  loginHandler,
  meHandler,
  updateMeHandler,
  forgotPasswordHandler,
  resetPasswordHandler,
  verifyEmailHandler,
  resendVerificationEmailHandler,
  referralInfoHandler,
  googleAuthHandler,
  appleAuthHandler,
};
