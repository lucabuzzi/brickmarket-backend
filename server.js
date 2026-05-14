require('dotenv').config();
const express   = require('express');
const cors      = require('cors');
const helmet    = require('helmet');
const rateLimit = require('express-rate-limit');
const path      = require('path');
const payments  = require('./src/routes/payments');

const app = express();

app.use(helmet({ contentSecurityPolicy: false }));

app.use((req, res, next) => {
  res.setHeader("Content-Security-Policy", "script-src 'self' 'unsafe-inline' 'unsafe-eval';");
  next();
});

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
    max: 5000,
    skip: (req) => req.originalUrl.includes('/stripe-webhook'),
    message: { error: 'Troppe richieste, riprova tra poco.' }
}));

app.get('/', (req, res) => {
    res.send('Benvenuto su BrickMarket API! Il server risponde correttamente.');
});

// Serve uploaded local images
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use('/api/auth',     require('./src/routes/auth'));
app.use('/api/listings', require('./src/routes/listings'));
app.use('/api/users', require('./src/routes/users'));
app.use('/api/payments', payments.router);
app.use('/api/shipping', require('./src/routes/shipping'));
app.use('/api/orders',   require('./src/routes/orders'));
app.use('/api/notifications', require('./src/routes/notifications'));
app.use('/api/sets',          require('./src/routes/sets'));
app.use('/api/reviews',       require('./src/routes/reviews'));
app.use('/api/admin',         require('./src/routes/admin'));
app.use('/api/catalog',       require('./src/routes/catalog'));

// Health check under /api for the frontend helper
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(err.status || 500).json({
        error: err.message || 'Errore interno del server'
    });
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Backend live on port ${PORT}`);
    console.log("SECURE MODE: CSP Disabled for development flow.");
});
