const Joi = require('joi');

// Messages match the hand-written checks this schema replaces exactly, so
// switching to Joi doesn't change what the frontend displays to the user.
const buyProductSchema = Joi.object({
  productId: Joi.string().required().messages({
    'string.base': 'Product ID is required for purchase',
    'string.empty': 'Product ID is required for purchase',
    'any.required': 'Product ID is required for purchase',
  }),
}).unknown(true);

function validate(schema, payload) {
  const { error, value } = schema.validate(payload, { abortEarly: false, convert: true });
  if (error) {
    return { error: error.details[0].message, value: null };
  }
  return { error: null, value };
}

module.exports = {
  buyProductSchema,
  validate,
};
