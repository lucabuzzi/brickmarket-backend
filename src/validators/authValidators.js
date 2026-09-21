const Joi = require('joi');

const registerSchema = Joi.object({
  email: Joi.string().trim().email().required(),
  password: Joi.string().min(8).max(200).required(),
  username: Joi.string().trim().min(3).max(100).required(),
  fullName: Joi.string().trim().max(200).allow('', null),
  city: Joi.string().trim().max(100).allow('', null),
  fiscalCode: Joi.string().trim().max(20).allow('', null),
  iban: Joi.string().trim().max(34).allow('', null),
  sellerType: Joi.string().valid('private', 'professional').allow('', null),
  companyName: Joi.string().trim().max(200).allow('', null),
  street: Joi.string().trim().max(200).allow('', null),
  houseNumber: Joi.string().trim().max(20).allow('', null),
  zipCode: Joi.string().trim().max(20).allow('', null),
  country: Joi.string().trim().max(100).allow('', null),
  phone: Joi.string().trim().max(30).allow('', null),
  turnstileToken: Joi.string().allow('', null),
  referralCode: Joi.string().trim().max(20).allow('', null),
}).unknown(false);

const loginSchema = Joi.object({
  email: Joi.string().trim().min(1).required(), // può contenere email o username
  password: Joi.string().required(),
  turnstileToken: Joi.string().allow('', null),
});

const forgotPasswordSchema = Joi.object({
  email: Joi.string().trim().email().required(),
});

const resetPasswordSchema = Joi.object({
  token: Joi.string().required(),
  newPassword: Joi.string().min(8).max(200).required(),
});

const verifyEmailSchema = Joi.object({
  token: Joi.string().required(),
});

const updateProfileSchema = Joi.object({
  city: Joi.string().trim().max(100).allow('', null),
  full_name: Joi.string().trim().max(200).allow('', null),
  // Was signup-only (authController.registerHandler is the only writer of
  // these before this change) — sellers had no way to fix or complete this
  // after registering, which also silently blocked real shipping-rate quotes
  // for anyone who skipped it at signup (it was never required).
  street: Joi.string().trim().max(200).allow('', null),
  houseNumber: Joi.string().trim().max(20).allow('', null),
  zipCode: Joi.string().trim().max(20).allow('', null),
  country: Joi.string().trim().max(100).allow('', null),
  phone: Joi.string().trim().max(30).allow('', null),
}).unknown(false);

// Google Identity Services restituisce un unico JWT firmato ("credential").
const googleAuthSchema = Joi.object({
  credential: Joi.string().required(),
  referralCode: Joi.string().trim().max(20).allow('', null),
}).unknown(false);

// Apple invia il nome dell'utente SOLO alla primissima autorizzazione, dentro
// l'oggetto "user" — non verrà ripetuto nelle richieste successive.
const appleAuthSchema = Joi.object({
  id_token: Joi.string().required(),
  user: Joi.object({
    name: Joi.object({
      firstName: Joi.string().trim().max(100).allow('', null),
      lastName: Joi.string().trim().max(100).allow('', null),
    }).unknown(true),
  }).unknown(true).allow(null),
  referralCode: Joi.string().trim().max(20).allow('', null),
}).unknown(false);

function validate(schema, payload) {
  const { error, value } = schema.validate(payload, { abortEarly: false, stripUnknown: true, convert: true });
  if (error) {
    return { error: error.details[0].message, value: null };
  }
  return { error: null, value };
}

module.exports = {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  verifyEmailSchema,
  updateProfileSchema,
  googleAuthSchema,
  appleAuthSchema,
  validate,
};
