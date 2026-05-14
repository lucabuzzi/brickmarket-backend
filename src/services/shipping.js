// Shipping rate table
const RATES = {
  DHL: { 
    'small': { domestic: 5.90, eu: 14.90 }, 
    'medium': { domestic: 8.90, eu: 19.90 }, 
    'large': { domestic: 12.90, eu: 29.90 } 
  },
  BRT: { 
    'small': { domestic: 4.50, eu: 15.00 }, 
    'medium': { domestic: 6.50, eu: 22.00 }, 
    'large': { domestic: 10.00, eu: 30.00 } 
  },
  UPS: { 
    'small': { domestic: 6.90, eu: 16.90 }, 
    'medium': { domestic: 9.90, eu: 21.90 }, 
    'large': { domestic: 15.90, eu: 35.90 } 
  },
  SDA: { 
    'small': { domestic: 5.00, eu: null }, 
    'medium': { domestic: 7.00, eu: null }, 
    'large': { domestic: 11.00, eu: null } 
  },
  POSTE: { 
    'small': { domestic: 4.00, eu: null }, 
    'medium': { domestic: 6.00, eu: null }, 
    'large': { domestic: 9.00, eu: null } 
  }
};

/**
 * Calcola i costi di spedizione in base ai carrier selezionati, paese del venditore,
 * paese dell'acquirente e dimensione del pacco.
 */
function calculateShippingRates(carriersArray, sellerCountry, buyerCountry, packageSize = 'medium') {
  if (!carriersArray || !Array.isArray(carriersArray)) return [];
  
  const size = (packageSize || 'medium').toLowerCase();
  // We assume default countries are 'it' if missing
  const sCountry = (sellerCountry || 'it').toLowerCase();
  const bCountry = (buyerCountry || 'it').toLowerCase();
  
  const zone = sCountry === bCountry ? 'domestic' : 'eu';

  const calculatedOptions = [];

  for (const opt of carriersArray) {
    const carrierCode = typeof opt === 'string' ? opt : opt.carrier;
    if (!carrierCode || !RATES[carrierCode]) continue;

    const rateConfig = RATES[carrierCode][size];
    if (!rateConfig) continue;

    const cost = rateConfig[zone];
    // Se il costo è null (es. SDA non spedisce in EU), non offriamo l'opzione
    if (cost !== null && cost !== undefined) {
      calculatedOptions.push({
        carrier: carrierCode,
        cost: cost
      });
    }
  }

  return calculatedOptions;
}

module.exports = {
  RATES,
  calculateShippingRates
};
