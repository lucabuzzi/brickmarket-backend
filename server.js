require('dotenv').config();
const express   = require('express');
const cors      = require('cors');
const helmet    = require('helmet');
const rateLimit = require('express-rate-limit');
const payments  = require('./src/routes/payments');

const app = express();

// Sicurezza base
app.use(helmet());
const corsOrigins = [
  process.env.FRONTEND_URL,
  'http://localhost:5173',
  'http://127.0.0.1:5173',
].filter(Boolean);
app.use(
  cors({
    origin: corsOrigins.length ? corsOrigins : true,
    credentials: true,
  })
);

// IMPORTANTE: il webhook Stripe deve ricevere il body grezzo (raw)
app.use('/api/payments/stripe-webhook',
    express.raw({ type: 'application/json' }),
    payments.webhook
);

app.use(express.json({ limit: '10mb' }));

// Rate limiting globale (escluso webhook Stripe)
app.use(rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    skip: (req) => req.originalUrl.includes('/stripe-webhook'),
    message: { error: 'Troppe richieste, riprova tra poco.' }
}));

app.get('/', (req, res) => {
    res.send('Benvenuto su BrickMarket API! Il server risponde correttamente.');
});
app.use('/api/auth',     require('./src/routes/auth'));
app.use('/api/listings', require('./src/routes/listings'));
app.use('/api/payments', payments.router);
app.use('/api/shipping', require('./src/routes/shipping'));
app.use('/api/orders',   require('./src/routes/orders'));

app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(err.status || 500).json({
        error: err.message || 'Errore interno del server'
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`BrickMarket backend in ascolto su porta ${PORT}`));
