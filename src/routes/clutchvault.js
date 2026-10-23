// ClutchVault routes that used to live inline in server.js: the admin puzzle upload, the product and auction
// lists, and the (disabled) auction bid. Mounted at the root (full paths below) in the same place in the chain
// as before, after the other /api routers. They use the ClutchVault DB module, which in development falls back
// to an in-memory mock (see src/db/clutchvault-db.js).
const crypto = require('crypto');
const express = require('express');
const cvDb = require('../db/clutchvault-db');
const { adminAuth } = require('../middleware/auth');
const { authenticateToken } = require('./contest');
const { upload } = require('../services/cloudinary');
const { uploadOrSaveProcessedImage } = require('../services/image');

const router = express.Router();

// Keep in sync with client/src/config/catalogGames.js CATALOG_GAMES slugs
// and the products.category CHECK constraint (src/db/migrate_products_category_all_games.js).
const ALLOWED_PUZZLE_CATEGORIES = ['lego', 'magic', 'yugioh', 'lorcana', 'pokemon', 'onepiece', 'dragonball', 'funko'];

const DEFAULT_PUZZLE_IMAGE = 'https://images.unsplash.com/photo-1585336139080-b019d07c312e?auto=format&fit=crop&w=800&q=80';

// adminAuth (src/middleware/auth.js) ricontrola role e is_active dal DB ad ogni
// richiesta — un admin disattivato o degradato perde l'accesso anche con un JWT
// ancora valido, a differenza del vecchio authenticateToken locale di contest.js
// (che non ricontrollava is_active) + check inline su req.user.role.
router.post('/api/admin/upload-puzzle-image', adminAuth, upload.single('image'), async (req, res) => {
  try {
    const {
      title, description, category = 'lego', marketValue = 100,
      slotCostCredits = 10, condition = 'New in Box', gradingInfo = 'Ungraded', totalSlots = 5,
    } = req.body;

    if (!title) {
      return res.status(400).json({ error: 'Title is required' });
    }
    if (!ALLOWED_PUZZLE_CATEGORIES.includes(category)) {
      return res.status(400).json({ error: `Invalid category. Must be one of: ${ALLOWED_PUZZLE_CATEGORIES.join(', ')}` });
    }

    const imageUrl = req.file
      ? await uploadOrSaveProcessedImage(req.file.buffer, 'jigsaw_puzzles')
      : DEFAULT_PUZZLE_IMAGE;

    // Must be real UUIDs, not just UUID-shaped strings: the products/contests id
    // columns are typed UUID in Postgres, which rejects anything non-hex (the old
    // 'c'/'p' prefix here — copied from the mock DB's placeholder ids, which don't
    // enforce a format — caused every real upload to fail with "invalid input
    // syntax for type uuid").
    const newContestId = crypto.randomUUID();
    const newProductId = crypto.randomUUID();
    const values = {
      marketValue: parseFloat(marketValue),
      slotCostCredits: parseFloat(slotCostCredits),
      totalSlots: parseInt(totalSlots, 10),
    };

    if (cvDb.isMock) {
      const mockDb = cvDb.getMockDbState();
      mockDb.products.push({
        id: newProductId,
        title,
        description: description || '',
        image_url: imageUrl,
        category,
        market_value: values.marketValue,
        condition,
        grading_info: gradingInfo,
        stock: 1,
      });
      mockDb.contests.push({
        id: newContestId,
        product_id: newProductId,
        total_slots: values.totalSlots,
        filled_slots: 0,
        slot_cost_credits: values.slotCostCredits,
        status: 'open',
        winner_id: null,
      });
    } else {
      await cvDb.query(`
        INSERT INTO public.products (id, title, description, image_url, category, market_value, condition, grading_info, stock)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 1)
      `, [newProductId, title, description || '', imageUrl, category, values.marketValue, condition, gradingInfo]);

      await cvDb.query(`
        INSERT INTO public.contests (id, product_id, total_slots, filled_slots, slot_cost_credits, status)
        VALUES ($1, $2, $3, 0, $4, 'open')
      `, [newContestId, newProductId, values.totalSlots, values.slotCostCredits]);
    }

    const broadcast = req.app.get('broadcast');
    if (broadcast) {
      broadcast({
        type: 'CONTEST_CREATED',
        payload: {
          id: newContestId,
          title,
          imageUrl,
          category,
          marketValue: values.marketValue,
          slotCostCredits: values.slotCostCredits,
          totalSlots: values.totalSlots,
          filledSlots: 0,
          status: 'open',
        },
      });
    }

    return res.json({
      success: true,
      message: 'Jigsaw puzzle uploaded successfully!',
      contestId: newContestId,
      imageUrl,
    });
  } catch (err) {
    console.error('Upload puzzle route error:', err);
    return res.status(500).json({ error: 'Failed to upload puzzle image: ' + err.message });
  }
});

// Fetch ClutchVault products
router.get('/api/products', async (req, res) => {
  try {
    const result = await cvDb.query('SELECT * FROM public.products ORDER BY created_at DESC');
    return res.json({ products: result.rows });
  } catch (error) {
    console.error('Fetch products error:', error);
    return res.status(500).json({ error: 'Database error fetching products' });
  }
});

const toAuction = (row) => ({
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
  status: row.status,
});

// Fetch ClutchVault auctions
router.get('/api/auctions', async (req, res) => {
  try {
    const result = await cvDb.query(
      `SELECT a.*, p.title, p.description, p.image_url, p.category, p.market_value, p.condition, p.grading_info
       FROM public.auctions a
       JOIN public.products p ON a.product_id = p.id
       WHERE a.status = 'active'
       ORDER BY a.ends_at ASC`
    );
    return res.json({ auctions: result.rows.map(toAuction) });
  } catch (error) {
    console.error('Fetch auctions error:', error);
    return res.status(500).json({ error: 'Database error fetching auctions' });
  }
});

// Place bid on ClutchVault auctions — DISATTIVATO. Il vecchio handler non addebitava mai
// il wallet né chiudeva/finalizzava l'asta (nessun job di finalizzazione esiste in questo
// codebase), e non esiste nessun endpoint di creazione asta raggiungibile da client/API:
// le righe di public.auctions possono nascere solo da SQL/seed diretto. Il codice del
// vecchio handler (_disabledAuctionBidHandler) è nella storia git, in server.js prima
// del refactor/foundations: va riscritto con addebito transazionale prima di riattivarlo.
router.post('/api/auctions/bid', authenticateToken, async (req, res) => {
  return res.status(503).json({ error: 'Aste temporaneamente non disponibili.' });
});

module.exports = router;
module.exports.ALLOWED_PUZZLE_CATEGORIES = ALLOWED_PUZZLE_CATEGORIES;
