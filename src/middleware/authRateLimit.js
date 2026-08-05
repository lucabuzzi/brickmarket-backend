const rateLimit = require('express-rate-limit');

// Più stringente del rate limit globale: mitiga brute-force e credential stuffing
// sulle rotte di autenticazione, dove il costo di un tentativo è basso per l'attaccante.
const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Troppi tentativi. Riprova tra qualche minuto.' },
});

module.exports = authRateLimit;
