require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');
const payments = require('./src/routes/payments');
const { renderIndexHtmlForRequest } = require('./src/services/seoMeta');
const http = require('http');
const WebSocket = require('ws');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ noServer: true });

const broadcast = (data) => {
  const payload = JSON.stringify(data);
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  });
};

app.set('wss', wss);
app.set('broadcast', broadcast);

wss.on('connection', (ws) => {
  console.log('Client connected to Live Hub.');
  ws.send(JSON.stringify({ type: 'WELCOME', message: 'Connected to Live Hub' }));
});

server.on('upgrade', (request, socket, head) => {
  wss.handleUpgrade(request, socket, head, (ws) => {
    wss.emit('connection', ws, request);
  });
});

app.use(helmet({ contentSecurityPolicy: false }));

app.use((req, res, next) => {
  res.setHeader("Content-Security-Policy", "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://challenges.cloudflare.com https://js.stripe.com; frame-src https://challenges.cloudflare.com https://js.stripe.com;");
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

app.use(cookieParser());

// IMPORTANTE: il webhook Stripe deve ricevere il body grezzo (raw)
app.use('/api/payments/stripe-webhook',
  express.raw({ type: 'application/json' }),
  payments.webhook
);

// Webhook Stripe per ClutchVault ricarica crediti
app.use('/api/webhooks/stripe',
  express.raw({ type: 'application/json' }),
  require('./src/routes/stripe')
);

app.use(express.json({ limit: '10mb' }));

// Rate limiting globale (escluso webhook Stripe)
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5000,
  skip: (req) => req.originalUrl.includes('/stripe-webhook'),
  message: { error: 'Troppe richieste, riprova tra poco.' }
}));

// Serve uploaded local images
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use('/api/auth', require('./src/routes/auth'));
app.use('/api/listings', require('./src/routes/listings'));
app.use('/api/users', require('./src/routes/users'));
app.use('/api/payments', payments.router);
app.use('/api/shipping', require('./src/routes/shipping'));
app.use('/api/orders', require('./src/routes/orders'));
app.use('/api/notifications', require('./src/routes/notifications'));
app.use('/api/sets', require('./src/routes/sets'));
app.use('/api/reviews', require('./src/routes/reviews'));
app.use('/api/support', require('./src/routes/support'));
app.use('/api/admin', require('./src/routes/admin'));
app.use('/api/analytics', require('./src/routes/analyticsTrack'));
app.use('/api/geo', require('./src/routes/geo'));
app.use('/api/catalog/magic', require('./src/routes/catalogMagic'));
app.use('/api/catalog/yugioh', require('./src/routes/catalogYugioh'));
app.use('/api/catalog/lorcana', require('./src/routes/catalogLorcana'));
app.use('/api/catalog/pokemon', require('./src/routes/catalogPokemon'));
app.use('/api/catalog/onepiece', require('./src/routes/catalogOnepiece'));
app.use('/api/catalog/dragonball', require('./src/routes/catalogDragonball'));
app.use('/api/catalog/funko', require('./src/routes/catalogFunko'));
app.use('/api/catalog', require('./src/routes/catalog'));

// ClutchVault specific integrations
const cvDb = require('./src/db/clutchvault-db');
const { authenticateToken } = require('./src/routes/contest');

app.use('/api/wallet', require('./src/routes/wallet'));
app.use('/api/contest', require('./src/routes/contest').router);
app.use('/api/webhooks', require('./src/routes/stripe')); // simulate-checkout

app.use(require('./src/routes/sitemap'));

// Admin Jigsaw Puzzle Image Upload Router
const { upload } = require('./src/services/cloudinary');
const { uploadOrSaveProcessedImage } = require('./src/services/image');
const crypto = require('crypto');

// Keep in sync with client/src/config/catalogGames.js CATALOG_GAMES slugs
// and the products.category CHECK constraint (src/db/migrate_products_category_all_games.js).
const ALLOWED_PUZZLE_CATEGORIES = ['lego', 'magic', 'yugioh', 'lorcana', 'pokemon', 'onepiece', 'dragonball', 'funko'];

app.post('/api/admin/upload-puzzle-image', authenticateToken, upload.single('image'), async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin permissions required to create contests.' });
    }

    const {
      title, description, category = 'lego', marketValue = 100,
      slotCostCredits = 10, condition = 'New in Box', gradingInfo = 'Ungraded', totalSlots = 5
    } = req.body;

    if (!title) {
      return res.status(400).json({ error: 'Title is required' });
    }
    if (!ALLOWED_PUZZLE_CATEGORIES.includes(category)) {
      return res.status(400).json({ error: `Invalid category. Must be one of: ${ALLOWED_PUZZLE_CATEGORIES.join(', ')}` });
    }

    let imageUrl = null;
    if (req.file) {
      imageUrl = await uploadOrSaveProcessedImage(req.file.buffer, 'jigsaw_puzzles');
    } else {
      imageUrl = 'https://images.unsplash.com/photo-1585336139080-b019d07c312e?auto=format&fit=crop&w=800&q=80';
    }

    // Must be real UUIDs, not just UUID-shaped strings: the products/contests id
    // columns are typed UUID in Postgres, which rejects anything non-hex (the old
    // 'c'/'p' prefix here — copied from the mock DB's placeholder ids, which don't
    // enforce a format — caused every real upload to fail with "invalid input
    // syntax for type uuid").
    const newContestId = crypto.randomUUID();
    const newProductId = crypto.randomUUID();

    if (cvDb.isMock) {
      const mockDb = cvDb.getMockDbState();
      const newProduct = {
        id: newProductId,
        title,
        description: description || '',
        image_url: imageUrl,
        category,
        market_value: parseFloat(marketValue),
        condition,
        grading_info: gradingInfo,
        stock: 1
      };
      mockDb.products.push(newProduct);

      const newContest = {
        id: newContestId,
        product_id: newProductId,
        total_slots: parseInt(totalSlots, 10),
        filled_slots: 0,
        slot_cost_credits: parseFloat(slotCostCredits),
        status: 'open',
        winner_id: null
      };
      mockDb.contests.push(newContest);
    } else {
      await cvDb.query(`
        INSERT INTO public.products (id, title, description, image_url, category, market_value, condition, grading_info, stock)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 1)
      `, [newProductId, title, description || '', imageUrl, category, parseFloat(marketValue), condition, gradingInfo]);

      await cvDb.query(`
        INSERT INTO public.contests (id, product_id, total_slots, filled_slots, slot_cost_credits, status)
        VALUES ($1, $2, $3, 0, $4, 'open')
      `, [newContestId, newProductId, parseInt(totalSlots, 10), parseFloat(slotCostCredits)]);
    }

    const broadcast = app.get('broadcast');
    if (broadcast) {
      broadcast({
        type: 'CONTEST_CREATED',
        payload: {
          id: newContestId,
          title,
          imageUrl,
          category,
          marketValue: parseFloat(marketValue),
          slotCostCredits: parseFloat(slotCostCredits),
          totalSlots: parseInt(totalSlots, 10),
          filledSlots: 0,
          status: 'open'
        }
      });
    }

    return res.json({
      success: true,
      message: 'Jigsaw puzzle uploaded successfully!',
      contestId: newContestId,
      imageUrl
    });
  } catch (err) {
    console.error('Upload puzzle route error:', err);
    return res.status(500).json({ error: 'Failed to upload puzzle image: ' + err.message });
  }
});

// Fetch ClutchVault products
app.get('/api/products', async (req, res) => {
  try {
    const result = await cvDb.query('SELECT * FROM public.products ORDER BY created_at DESC');
    return res.json({ products: result.rows });
  } catch (error) {
    console.error('Fetch products error:', error);
    return res.status(500).json({ error: 'Database error fetching products' });
  }
});

// Fetch ClutchVault auctions
app.get('/api/auctions', async (req, res) => {
  try {
    const result = await cvDb.query(
      `SELECT a.*, p.title, p.description, p.image_url, p.category, p.market_value, p.condition, p.grading_info
       FROM public.auctions a
       JOIN public.products p ON a.product_id = p.id
       WHERE a.status = 'active'
       ORDER BY a.ends_at ASC`
    );
    const auctions = result.rows.map(row => ({
      id: row.id,
      productId: row.product_id,
      title: row.title,
      description: row.description,
      imageUrl: row.image_url,
      category: row.category,
      marketValue: parseFloat(row.market_value),
      condition: row.condition,
      gradingInfo: row.grading_info,
      currentBid: parseFloat(row.current_bid),
      highestBidderId: row.highest_bidder_id,
      buyNowPrice: parseFloat(row.buy_now_price),
      endsAt: row.ends_at,
      status: row.status
    }));
    return res.json({ auctions });
  } catch (error) {
    console.error('Fetch auctions error:', error);
    return res.status(500).json({ error: 'Database error fetching auctions' });
  }
});

// Place bid on ClutchVault auctions
app.post('/api/auctions/bid', authenticateToken, async (req, res) => {
  const { auctionId, bidAmount } = req.body;
  if (!auctionId || !bidAmount || bidAmount <= 0) {
    return res.status(400).json({ error: 'auctionId and positive bidAmount are required' });
  }

  try {
    const auctionResult = await cvDb.query(
      'SELECT current_bid, buy_now_price, status FROM public.auctions WHERE id = $1',
      [auctionId]
    );

    if (auctionResult.rows.length === 0) {
      return res.status(404).json({ error: 'Auction not found' });
    }

    const auction = auctionResult.rows[0];
    if (auction.status !== 'active') {
      return res.status(400).json({ error: 'Auction has already ended' });
    }

    const currentBid = parseFloat(auction.current_bid);
    if (bidAmount <= currentBid) {
      return res.status(400).json({ error: `Bid must be higher than current bid of ${currentBid} credits.` });
    }

    const walletResult = await cvDb.query(
      'SELECT balance_credits FROM public.user_wallets WHERE user_id = $1',
      [req.user.id]
    );

    if (walletResult.rows.length === 0 || parseFloat(walletResult.rows[0].balance_credits) < bidAmount) {
      return res.status(400).json({ error: 'Insufficient credits in wallet to place this bid' });
    }

    await cvDb.query(
      'UPDATE public.auctions SET current_bid = $1, highest_bidder_id = $2 WHERE id = $3',
      [bidAmount, req.user.id, auctionId]
    );

    broadcast({
      type: 'BID_PLACED',
      payload: {
        auctionId,
        currentBid: bidAmount,
        highestBidderId: req.user.id,
        highestBidderName: req.user.username
      }
    });

    return res.json({
      success: true,
      message: 'Bid placed successfully!',
      currentBid: bidAmount
    });
  } catch (error) {
    console.error('Place bid error:', error);
    return res.status(500).json({ error: 'Database error placing bid' });
  }
});

// Health check under /api for the frontend helper
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

// Serve the built React app (client/dist, produced by `npm run build`) and fall back to
// index.html for any non-API, non-uploads GET path so React Router's client-side routes
// (e.g. /product/:id) work on a hard refresh or a direct link, not just via in-app navigation.
// The fallback rewrites canonical/OG meta tags per-request (and injects Product JSON-LD for
// listings) since the static template always declares them as "/" — see src/services/seoMeta.js.
const clientDistPath = path.join(__dirname, 'client', 'dist');
app.use(express.static(clientDistPath));
app.get(/^\/(?!api\/|uploads\/).*/, async (req, res) => {
  const indexPath = path.join(clientDistPath, 'index.html');
  let baseHtml;
  try {
    baseHtml = fs.readFileSync(indexPath, 'utf-8');
  } catch (err) {
    return res.status(404).send('Frontend build not found — run `npm run build` first.');
  }

  try {
    const html = await renderIndexHtmlForRequest(req.path, baseHtml);
    res.set('Content-Type', 'text/html; charset=UTF-8');
    res.send(html);
  } catch (err) {
    console.error('index.html render error:', err.message);
    res.set('Content-Type', 'text/html; charset=UTF-8');
    res.send(baseHtml);
  }
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    error: err.message || 'Errore interno del server'
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Backend live on port ${PORT}`);
  console.log("SECURE MODE: CSP Disabled for development flow.");
});

// --- Analytics daily snapshots: archive from July 2026 onward ---
// On boot: backfill any day since ANALYTICS_ARCHIVE_START that's missing a
// snapshot (covers days the server was down at midnight). Then a daily cron
// keeps saving yesterday's snapshot going forward. Both paths are idempotent.
const cron = require('node-cron');
const { backfillSnapshots } = require('./src/services/analyticsSnapshot');
const ANALYTICS_ARCHIVE_START = '2026-07-01';

backfillSnapshots(ANALYTICS_ARCHIVE_START)
  .then((results) => console.log(`[Analytics] Backfilled ${results.length} daily snapshot(s) since ${ANALYTICS_ARCHIVE_START}.`))
  .catch((err) => console.error('[Analytics] Startup backfill failed:', err.message));

cron.schedule('10 0 * * *', () => {
  backfillSnapshots(ANALYTICS_ARCHIVE_START)
    .then((results) => console.log(`[Analytics] Daily snapshot job: ${results.length} day(s) computed.`))
    .catch((err) => console.error('[Analytics] Daily snapshot job failed:', err.message));
});
