const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();

const db = require('./db');
const { router: authRouter, authenticateToken } = require('./auth');
const walletRouter = require('./wallet');
const stripeRouter = require('./stripe');
const contestRouter = require('./contest');

const app = express();
const server = http.createServer(app);

// 1. WebSocket Server Setup
const wss = new WebSocket.Server({ noServer: true });

// Broadcast utility to send real-time events to all active clients
const broadcast = (data) => {
  const payload = JSON.stringify(data);
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  });
};

// Share WebSocket server globally via app settings
app.set('wss', wss);
app.set('broadcast', broadcast);

wss.on('connection', (ws) => {
  console.log('🔌 Client connected to ClutchVault Live Stream.');
  ws.send(JSON.stringify({ type: 'WELCOME', message: 'Connected to ClutchVault Real-Time Hub' }));

  ws.on('close', () => {
    console.log('🔌 Client disconnected.');
  });
});

// Upgrade HTTP connection to WebSocket
server.on('upgrade', (request, socket, head) => {
  wss.handleUpgrade(request, socket, head, (ws) => {
    wss.emit('connection', ws, request);
  });
});

// 2. Middlewares
app.use(cors());

// Apply raw body parser ONLY for Stripe webhooks to preserve request signatures
app.use((req, res, next) => {
  if (req.originalUrl === '/api/webhooks/stripe') {
    next();
  } else {
    express.json()(req, res, next);
  }
});

// 3. Mount Routers
app.use('/api/auth', authRouter);
app.use('/api/wallet', walletRouter);
app.use('/api/webhooks', stripeRouter); // /api/webhooks/stripe & /api/webhooks/simulate-checkout
app.use('/api/contest', contestRouter);

// 4. Products & Live Auction Routes
// Fetch all products
app.get('/api/products', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM public.products ORDER BY created_at DESC');
    return res.json({ products: result.rows });
  } catch (error) {
    console.error('Fetch products error:', error);
    return res.status(500).json({ error: 'Database error fetching products' });
  }
});

// Fetch all live auctions
app.get('/api/auctions', async (req, res) => {
  try {
    const result = await db.query(
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

// Place Bid on Auction (Real-time update via WebSocket broadcast)
app.post('/api/auctions/bid', authenticateToken, async (req, res) => {
  const { auctionId, bidAmount } = req.body;

  if (!auctionId || !bidAmount || bidAmount <= 0) {
    return res.status(400).json({ error: 'auctionId and positive bidAmount are required' });
  }

  try {
    // 1. Fetch auction details
    const auctionResult = await db.query(
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
    const buyNowPrice = parseFloat(auction.buy_now_price);

    if (bidAmount <= currentBid) {
      return res.status(400).json({ error: `Bid must be higher than current bid of ${currentBid} credits.` });
    }

    // Check if the user has enough credits in standard wallet to bid
    const walletResult = await db.query(
      'SELECT balance_credits FROM public.user_wallets WHERE user_id = $1',
      [req.user.id]
    );

    if (walletResult.rows.length === 0 || parseFloat(walletResult.rows[0].balance_credits) < bidAmount) {
      return res.status(400).json({ error: 'Insufficient credits in wallet to place this bid' });
    }

    // 2. Submit Bid
    await db.query(
      'UPDATE public.auctions SET current_bid = $1, highest_bidder_id = $2 WHERE id = $3',
      [bidAmount, req.user.id, auctionId]
    );

    // 3. Broadcast bid details to all users via WebSocket
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

// 5. Start Server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`⚡ ClutchVault Hyper Backend running on port ${PORT}`);
  if (db.isMock) {
    console.log('ℹ️ Running in Mock Database Mode. Database credentials not configured.');
  }
});
