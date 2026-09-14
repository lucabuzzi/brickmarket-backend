const Joi = require('joi');

// ISO 3166-1 alpha-2, uppercase — matches the format Sendcloud/most carrier
// aggregators expect, and lets it double as a 2-letter zone key the way
// src/services/shipping.js already does with sellerCountry/buyerCountry
// (it lowercases before comparing, so case here doesn't matter downstream).
const COUNTRY = Joi.string().trim().uppercase().length(2).required();

const addressSchema = Joi.object({
  label: Joi.string().trim().max(50).allow('', null),
  fullName: Joi.string().trim().min(2).max(200).required(),
  addressStreet: Joi.string().trim().min(2).max(200).required(),
  addressHouseNumber: Joi.string().trim().max(20).required(),
  city: Joi.string().trim().min(1).max(100).required(),
  zip: Joi.string().trim().min(3).max(10).required(),
  province: Joi.string().trim().max(5).allow('', null),
  country: COUNTRY,
  phone: Joi.string().trim().max(30).required(),
  isDefault: Joi.boolean().default(false),
}).unknown(false);

const addressPatchSchema = Joi.object({
  label: Joi.string().trim().max(50).allow('', null),
  fullName: Joi.string().trim().min(2).max(200),
  addressStreet: Joi.string().trim().min(2).max(200),
  addressHouseNumber: Joi.string().trim().max(20),
  city: Joi.string().trim().min(1).max(100),
  zip: Joi.string().trim().min(3).max(10),
  province: Joi.string().trim().max(5).allow('', null),
  country: Joi.string().trim().uppercase().length(2),
  phone: Joi.string().trim().max(30),
}).unknown(false).min(1);

// Shape of the snapshot taken at checkout time, whether the buyer picked a
// saved address (addressId) or typed one ad hoc (fields inline). Exactly one
// of the two must be present.
const checkoutAddressSchema = Joi.object({
  addressId: Joi.string().uuid(),
  fullName: Joi.string().trim().min(2).max(200),
  addressStreet: Joi.string().trim().min(2).max(200),
  addressHouseNumber: Joi.string().trim().max(20),
  city: Joi.string().trim().min(1).max(100),
  zip: Joi.string().trim().min(3).max(10),
  province: Joi.string().trim().max(5).allow('', null),
  country: Joi.string().trim().uppercase().length(2),
  phone: Joi.string().trim().max(30),
})
  .xor('addressId', 'fullName')
  .and('fullName', 'addressStreet', 'addressHouseNumber', 'city', 'zip', 'country', 'phone')
  .unknown(false);

function validate(schema, payload) {
  const { error, value } = schema.validate(payload, { abortEarly: false, stripUnknown: true, convert: true });
  if (error) {
    return { error: error.details[0].message, value: null };
  }
  return { error: null, value };
}

module.exports = {
  addressSchema,
  addressPatchSchema,
  checkoutAddressSchema,
  validate,
};
