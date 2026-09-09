const Joi = require('joi');

const ROLES = ['buyer', 'seller', 'both', 'shop', 'admin'];
const STATUSES = ['active', 'banned', 'deleted'];

const updateUserSchema = Joi.object({
  role: Joi.string().valid(...ROLES),
  status: Joi.string().valid(...STATUSES),
})
  .or('role', 'status')
  .unknown(false)
  .messages({
    'object.missing': 'Specificare almeno uno tra role e status.',
  });

function validate(schema, payload) {
  const { error, value } = schema.validate(payload, { abortEarly: false, convert: true });
  if (error) {
    return { error: error.details[0].message, value: null };
  }
  return { error: null, value };
}

module.exports = { ROLES, STATUSES, updateUserSchema, validate };
