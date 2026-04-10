require('dotenv').config();
console.log('IL MIO SEGRETO È:', process.env.JWT_SECRET);
const express   = require('express');
const cors      = require('cors');
const helmet    = require('helmet');
const rateLimit = require('express-rate-limit');

const app = express();

// Sicurezza base
app.use(helmet());
app.use(cors({ origin: process.env.FRONTEND_URL }));

// IMPORTANTE: il webhook Stripe deve ricevere il body grezzo (raw)
// quindi lo montiamo PRIMA di express.json()
app.use('/api/payments/stripe-webhook', 
    express.raw({ type: 'application/json' }),
    (req, res, next) => {
        // Questa è una funzione temporanea per evitare errori finché non scriviamo la rotta reale
        next();
    }
);

app.use(express.json({ limit: '10mb' }));

// Rate limiting globale (evita attacchi che intasano il server)
app.use(rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minuti
    max: 100, // limite di 100 richieste per IP
    message: { error: 'Troppe richieste, riprova tra poco.' }
}));

// Rotte (Route)// Rotta di benvenuto per la home page
app.get('/', (req, res) => {
    res.send('Benvenuto su Brickmansion API! Il server risponde correttamente. 🧱');
});
app.use('/api/auth',     require('./src/routes/auth'));
app.use('/api/listings', require('./src/routes/listings'));
app.use('/api/payments', require('./src/routes/payments').router); // Nota il .router
app.use('/api/shipping', require('./src/routes/shipping'));

// Health check (per vedere se il server è vivo)
app.get('/health', (req, res) => res.json({ status: 'ok' }));

// Gestione errori globale
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(err.status || 500).json({
        error: err.message || 'Errore interno del server'
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`BrickMarket backend in ascolto su porta ${PORT}`));