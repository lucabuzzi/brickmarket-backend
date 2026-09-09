const Joi = require('joi');

// Messages match the hand-written checks these schemas replace exactly, so
// switching to Joi doesn't change what the frontend displays to the user.
const createTopupIntentSchema = Joi.object({
  amountEuros: Joi.number().min(1).required().messages({
    'number.base': 'Importo non valido (minimo 1€)',
    'number.min': 'Importo non valido (minimo 1€)',
    'any.required': 'Importo non valido (minimo 1€)',
  }),
}).unknown(true);

const confirmTopupSchema = Joi.object({
  paymentIntentId: Joi.string().required().messages({
    'string.base': 'paymentIntentId richiesto',
    'string.empty': 'paymentIntentId richiesto',
    'any.required': 'paymentIntentId richiesto',
  }),
}).unknown(true);

const buyProductSchema = Joi.object({
  productId: Joi.string().required().messages({
    'string.base': 'Product ID is required for purchase',
    'string.empty': 'Product ID is required for purchase',
    'any.required': 'Product ID is required for purchase',
  }),
}).unknown(true);

const convertSchema = Joi.object({
  credits: Joi.number().greater(0).required().messages({
    'number.base': 'Importo crediti non valido',
    'number.greater': 'Importo crediti non valido',
    'any.required': 'Importo crediti non valido',
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
  createTopupIntentSchema,
  confirmTopupSchema,
  buyProductSchema,
  convertSchema,
  validate,
};
