const express = require('express');
const router = express.Router();
const { query } = require('../db');
const auth = require('../middleware/auth');
const { upload, hasCloudinaryConfig } = require('../services/cloudinary');
const { uploadOrSaveProcessedImage } = require('../services/image');
const { calculateShippingRates } = require('../services/shipping');
const jwt = require('jsonwebtoken');
const Joi = require('joi');

/** Wraps multer middleware in a promise so we can catch upload errors explicitly */
function runUpload(req, res) {
  return new Promise((resolve, reject) => {
    upload.array('images', 10)(req, res, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

/** Valori ammessi da src/db/schema.sql → listings.type CHECK */
const LISTING_TYPES_DB = ['used', 'sealed', 'moc', 'auction'];
/** Alias legacy ancora accettato in input, normalizzato prima dell'INSERT */
const LISTING_TYPE_LEGACY_ALIASES = ['fixed'];

/** Normalizza campi numerici inviati come stringhe vuote da multipart/form-data */
function normalizeListingBody(body) {
  const b = { ...body };
  ['price', 'year', 'pieces', 'shippingCost', 'auctionStart', 'auctionReserve'].forEach((k) => {
    if (b[k] === '' || b[k] === undefined) delete b[k];
  });
  if (b.type === '' || b.type === undefined) delete b.type;
  return b;
}

/** Converte valori legacy nel tipo salvabile secondo schema.sql */
function coerceListingTypeForDb(type) {
  if (type == null) return 'used';
  const t = String(type).trim().toLowerCase();
  if (t === 'fixed') return 'used';
  return t;
}

/** Maps UI condition values to what the DB CHECK constraint actually allows */
function coerceConditionForDb(condition) {
  if (!condition) return 'used';
  const c = String(condition).trim().toLowerCase();
  // DB allows: 'new', 'used', 'New', 'Used', 'Like New', 'damaged'
  if (c === 'new')       return 'new';
  if (c === 'sealed')    return 'new';
  if (c === 'used')      return 'used';
  if (c === 'complete')  return 'used';   // "complete" used set
  if (c === 'good')      return 'used';
  if (c === 'fair')      return 'used';
  if (c === 'parts')     return 'used';   // spare parts listing
  if (c === 'like new')  return 'Like New';
  if (c === 'damaged')   return 'damaged';
  return 'used'; // safe fallback
}

function validateDraftListing(body) {
  const schema = Joi.object({
    title: Joi.string().trim().min(1).max(300).required(),
    description: Joi.string().max(10000).allow('', null),
    setNumber: Joi.string().max(20).allow('', null),
    theme: Joi.string().max(100).allow('', null),
    year: Joi.number().integer().min(1900).max(2100).allow(null),
    pieces: Joi.number().integer().min(1).allow(null),
    type: Joi.string()
      .valid(...LISTING_TYPES_DB.filter((x) => x !== 'auction'), ...LISTING_TYPE_LEGACY_ALIASES)
      .default('used'),
    condition: Joi.string().valid('complete', 'good', 'fair', 'parts', 'new', 'used').allow(null),
    boxCondition: Joi.string().max(100).allow('', null),
    instructions: Joi.string().max(100).allow('', null),
    proNotes: Joi.string().max(2000).allow('', null),
    isComplete: Joi.boolean().default(false),
    price: Joi.number().positive().allow(null),
    shippingCost: Joi.number().min(0).default(0),
    shippingMethod: Joi.string().max(50).allow('', null),
    shippingOptions: Joi.string().allow('', null),
    packageSize: Joi.string().valid('small', 'medium', 'large').default('medium'),
    category: Joi.string().valid('sets', 'mocs', 'minifigures').default('sets'),
    status: Joi.string().valid('draft').required(),
  });

  const { error, value } = schema.validate(body, { abortEarly: false, stripUnknown: true, convert: true });
  if (error) {
    return { error: error.details[0].message, value: null };
  }
  return { error: null, value };
}

function validatePublishListing(body) {
  const schema = Joi.object({
    title: Joi.string().trim().min(5).max(300).required(),
    description: Joi.string().max(10000).allow('', null),
    setNumber: Joi.string().max(20).allow('', null),
    theme: Joi.string().max(100).allow('', null),
    year: Joi.number().integer().min(1900).max(2100).allow(null),
    pieces: Joi.number().integer().min(1).allow(null),
    type: Joi.string().valid(...LISTING_TYPES_DB, ...LISTING_TYPE_LEGACY_ALIASES).required(),
    condition: Joi.string().valid('complete', 'good', 'fair', 'parts', 'new', 'used').required(),
    boxCondition: Joi.string().max(100).allow('', null),
    instructions: Joi.string().max(100).allow('', null),
    proNotes: Joi.string().max(2000).allow('', null),
    isComplete: Joi.boolean().default(false),
    price: Joi.number().positive().required(),
    auctionStart: Joi.number().positive().allow(null),
    auctionEnd: Joi.date().iso().allow(null),
    auctionReserve: Joi.number().min(0).allow(null),
    shippingCost: Joi.number().min(0).default(0),
    shippingMethod: Joi.string().max(50).allow('', null),
    shippingOptions: Joi.string().allow('', null),
    packageSize: Joi.string().valid('small', 'medium', 'large').required(),
    category: Joi.string().valid('sets', 'mocs', 'minifigures').required(),
    status: Joi.string().valid('active').required(),
  });

  const { error, value } = schema.validate(body, { abortEarly: false, stripUnknown: true, convert: true });
  if (error) {
    return { error: error.details[0].message, value: null };
  }

  if (value.type === 'auction') {
    if (value.auctionStart == null || value.auctionEnd == null) {
      return { error: 'Per le aste servono auctionStart e auctionEnd', value: null };
    }
  }

  return { error: null, value };
}

const patchSchema = Joi.object({
  title: Joi.string().min(5).max(300),
  description: Joi.string().max(10000).allow('', null),
  setNumber: Joi.string().max(20).allow('', null),
  theme: Joi.string().max(100).allow('', null),
  year: Joi.number().integer().min(1900).max(2100).allow(null),
  pieces: Joi.number().integer().min(1).allow(null),
  condition: Joi.string().valid('complete', 'good', 'fair', 'parts', 'new', 'used').allow(null),
  boxCondition: Joi.string().max(100).allow('', null),
  instructions: Joi.string().max(100).allow('', null),
  proNotes: Joi.string().max(2000).allow('', null),
  isComplete: Joi.boolean().allow(null),
  price: Joi.number().positive().allow(null),
  shippingCost: Joi.number().min(0),
  shippingMethod: Joi.string().max(50).allow('', null),
  shippingOptions: Joi.string().allow('', null),
  packageSize: Joi.string().valid('small', 'medium', 'large'),
  category: Joi.string().valid('sets', 'mocs', 'minifigures'),
  status: Joi.string().valid('draft', 'active', 'removed'),
});

// POST — crea annuncio (multipart: campi + images[])
router.post('/', auth, async (req, res) => {
  // Run multer upload middleware explicitly so errors are catchable
  try {
    await runUpload(req, res);
  } catch (uploadErr) {
    console.error('\n=== UPLOAD MIDDLEWARE CRASH ===', uploadErr.message);
    return res.status(500).json({ error: 'Errore caricamento immagini: ' + uploadErr.message });
  }


  const raw = normalizeListingBody(req.body);
  const isDraft = raw.status === 'draft';
  const { error, value } = isDraft ? validateDraftListing(raw) : validatePublishListing(raw);
  if (error) {
    return res.status(400).json({ error });
  }

  value.type = coerceListingTypeForDb(value.type);
  if (!LISTING_TYPES_DB.includes(value.type)) {
    return res.status(400).json({
      error: `type non valido. Valori ammessi: ${LISTING_TYPES_DB.join(', ')}`,
    });
  }

  // Coerce condition to DB-valid value
  if (value.condition) {
    value.condition = coerceConditionForDb(value.condition);
  }

  if (!isDraft && (!req.files || req.files.length === 0)) {
    return res.status(400).json({ error: 'Almeno un\'immagine è obbligatoria per pubblicare' });
  }

  // Optimization Pipeline: Process with sharp and upload/save
  const imageUrls = [];
  if (req.files && req.files.length > 0) {
    try {
      for (const file of req.files) {
        const url = await uploadOrSaveProcessedImage(file.buffer);
        imageUrls.push(url);
      }
    } catch (procErr) {
      console.error('Image processing failed:', procErr);
      return res.status(500).json({ error: 'Errore durante l\'ottimizzazione delle immagini' });
    }
  }

  const v = value;
  const auctionEnd = v.type === 'auction' ? new Date(v.auctionEnd) : null;
  const currentBid = v.type === 'auction' ? v.auctionStart : null;

  try {
    let parsedShippingOptions = [];
    if (v.shippingOptions) {
      try { parsedShippingOptions = JSON.parse(v.shippingOptions); } catch(e) {}
    }

    const result = await query(
      `INSERT INTO listings (
        seller_id, title, description, set_number, theme, year, pieces,
        type, condition,
        price, auction_start, auction_end, auction_reserve, current_bid,
        status, images, shipping_cost, shipping_method, shipping_options,
        box_condition, instructions, pro_notes, is_complete,
        category, package_size
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25
      ) RETURNING *`,
      [
        req.user.userId,
        v.title,
        v.description || null,
        v.setNumber || null,
        v.theme || null,
        v.year ?? null,
        v.pieces ?? null,
        v.type,
        v.condition || null,
        v.type === 'auction' ? null : v.price,
        v.type === 'auction' ? v.auctionStart : null,
        auctionEnd,
        v.auctionReserve ?? null,
        currentBid,
        v.status,
        imageUrls.length ? imageUrls : null,
        v.shippingCost,
        v.shippingMethod || null,
        JSON.stringify(parsedShippingOptions),
        v.boxCondition || null,
        v.instructions || null,
        v.proNotes || null,
        v.isComplete ?? false,
        v.category,
        v.packageSize || 'medium'
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('\n=== FULL DB ERROR ===');
    console.error('Message:', err.message);
    console.error('Detail:', err.detail);
    console.error('Code:', err.code);
    console.error('Stack:', err.stack);
    res.status(500).json({ error: 'Errore durante la creazione: ' + err.message });
  }
});

router.get('/user/me', auth, async (req, res) => {
  try {
    const result = await query(
      "SELECT * FROM listings WHERE seller_id = $1 AND status <> 'removed' ORDER BY created_at DESC",
      [req.user.userId]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Errore nel recupero dei tuoi annunci' });
  }
});

// Lista pubblica (default: solo active; ?status=all per tutti gli stati, ESCLUSO draft)
router.get('/', async (req, res) => {
  const { status: statusQ, type, theme, is_auction, sort, limit, is_featured, category } = req.query;
  try {
    // Auto-Expire Logic: Check for expired auctions and mark them as expired
    await query(`UPDATE listings SET status = 'expired' WHERE status = 'active' AND type = 'auction' AND auction_end < NOW()`);

    const params = [];
    const parts = [];

    // Escludiamo SEMPRE i draft dalla lista pubblica, a meno che non sia richiesto specificamente (ma solitamente no)
    // Per sicurezza, se statusQ è 'all', aggiungiamo AND status <> 'draft'
    if (statusQ === undefined || statusQ === '') {
      params.push('active');
      parts.push(`l.status = $${params.length}`);
    } else if (statusQ === 'all') {
      // Se viene chiesto "all", mostriamo tutto TRANNE i draft
      parts.push(`l.status <> 'draft'`);
    } else {
      params.push(statusQ);
      parts.push(`l.status = $${params.length}`);
    }

    if (type) {
      params.push(type);
      parts.push(`l.type = $${params.length}`);
    }
    
    if (is_auction === 'true') {
      parts.push(`(l.type = 'auction' OR l.is_auction = true)`);
    } else if (is_auction === 'false') {
      parts.push(`(l.type <> 'auction' AND (l.is_auction = false OR l.is_auction IS NULL))`);
    }

    if (theme) {
      params.push(`%${theme}%`);
      parts.push(`l.theme ILIKE $${params.length}`);
    }
    
    if (is_featured === 'true') {
      parts.push(`l.is_featured = true`);
    } else if (is_featured === 'false') {
      parts.push(`l.is_featured = false`);
    }
    
    if (category) {
      params.push(category);
      parts.push(`l.category = $${params.length}`);
    }

    const where = parts.length ? `WHERE ${parts.join(' AND ')}` : '';
    
    let orderBy = 'ORDER BY l.created_at DESC';
    if (sort === 'auction') {
      orderBy = `ORDER BY CASE WHEN l.status = 'active' THEN 0 ELSE 1 END, l.auction_end ASC NULLS LAST, l.created_at DESC`;
    }

    let limitClause = '';
    if (limit) {
      const parsedLimit = parseInt(limit, 10);
      if (!isNaN(parsedLimit) && parsedLimit > 0) {
        params.push(parsedLimit);
        limitClause = `LIMIT $${params.length}`;
      }
    }
    
    // JOIN con users per avere i dati del venditore
    const result = await query(
      `SELECT l.*, 
              u.username as seller_username, 
              u.avatar_url as seller_avatar,
              u.rating_avg as seller_rating,
              u.is_verified as seller_is_verified,
              u.is_pro as seller_is_pro
       FROM listings l
       JOIN users u ON l.seller_id = u.id
       ${where} 
       ${orderBy}
       ${limitClause}`,
      params
    );

    // Mappiamo i dati per farli digerire al frontend (che si aspetta l.seller.username)
    const formatted = result.rows.map(row => {
      const { seller_username, seller_avatar, seller_rating, seller_is_verified, seller_is_pro, ...listing } = row;
      return {
        ...listing,
        seller: {
          username: seller_username,
          avatar_url: seller_avatar,
          rating_avg: seller_rating,
          is_verified: seller_is_verified ?? false,
          is_pro: seller_is_pro ?? false,
        }
      };
    });

    res.json(formatted);
  } catch (err) {
    console.error('LISTINGS ERROR:', err.message);
    res.status(500).json({ error: 'Errore nel recupero degli annunci' });
  }
});

router.get('/archive', async (req, res) => {
  try {
    // Ensure auto-expire is run here too, just in case
    await query(`UPDATE listings SET status = 'expired' WHERE status = 'active' AND type = 'auction' AND auction_end < NOW()`);

    const result = await query(
      `SELECT l.*,
              u.username as seller_username,
              u.avatar_url as seller_avatar,
              u.rating_avg as seller_rating,
              u.is_verified as seller_is_verified,
              u.is_pro as seller_is_pro
       FROM listings l
       JOIN users u ON l.seller_id = u.id
       WHERE l.status IN ('sold', 'expired')
       ORDER BY l.updated_at DESC, l.created_at DESC`
    );

    const formatted = result.rows.map(row => {
      const { seller_username, seller_avatar, seller_rating, seller_is_verified, seller_is_pro, ...listing } = row;
      return {
        ...listing,
        seller: {
          username: seller_username,
          avatar_url: seller_avatar,
          rating_avg: seller_rating,
          is_verified: seller_is_verified ?? false,
          is_pro: seller_is_pro ?? false,
        }
      };
    });

    res.json(formatted);
  } catch (err) {
    console.error('ARCHIVE ERROR:', err.message);
    res.status(500).json({ error: "Errore nel recupero dell'archivio" });
  }
});

router.get('/search', async (req, res) => {
  const { q } = req.query;
  try {
    if (!q) {
      return res.json([]);
    }
    const result = await query(
      `SELECT l.*,
              u.username as seller_username,
              u.avatar_url as seller_avatar,
              u.rating_avg as seller_rating,
              u.is_verified as seller_is_verified,
              u.is_pro as seller_is_pro
       FROM listings l
       JOIN users u ON l.seller_id = u.id
       WHERE (l.title ILIKE $1 OR l.set_number ILIKE $1 OR l.theme ILIKE $1)
         AND l.status = 'active'
       ORDER BY l.created_at DESC`,
      [`%${q}%`]
    );
    const formatted = result.rows.map(row => {
      const { seller_username, seller_avatar, seller_rating, seller_is_verified, seller_is_pro, ...listing } = row;
      return {
        ...listing,
        seller: {
          username: seller_username,
          avatar_url: seller_avatar,
          rating_avg: seller_rating,
          is_verified: seller_is_verified ?? false,
          is_pro: seller_is_pro ?? false,
        }
      };
    });
    res.json(formatted);
  } catch (err) {
    console.error('SEARCH ERROR:', err.message);
    res.status(500).json({ error: 'Errore durante la ricerca' });
  }
});

router.post('/checkout', auth, async (req, res) => {
  const { itemIds, shippingSelections = {} } = req.body;
  if (!Array.isArray(itemIds) || itemIds.length === 0) {
    return res.status(400).json({ error: 'Nessun articolo selezionato' });
  }
  try {
    const itemsResult = await query(`SELECT id, seller_id, price FROM listings WHERE id = ANY($1)`, [itemIds]);
    
    for (const item of itemsResult.rows) {
      const price = item.price || 0;
      const platformFee = price * 0.05;
      
      const shipping = shippingSelections[item.id] || { carrier: null, cost: 0 };
      const selectedCarrier = shipping.carrier;
      const shippingCost = Number(shipping.cost);

      const totalBuyer = Number(price) + Number(platformFee) + shippingCost;
      await query(
        `INSERT INTO orders (buyer_id, seller_id, listing_id, item_price, platform_fee, seller_fee, total_buyer, seller_payout, status, selected_carrier, shipping_cost)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'completed', $9, $10)`,
        [req.user.userId, item.seller_id, item.id, price, platformFee, platformFee, totalBuyer, price - platformFee, selectedCarrier, shippingCost]
      );
    }

    const result = await query(
      `UPDATE listings SET status = 'sold', updated_at = NOW() WHERE id = ANY($1) RETURNING id`,
      [itemIds]
    );
    res.json({ success: true, updated: result.rows.length });
  } catch (err) {
    console.error('CHECKOUT ERROR:', err.message);
    res.status(500).json({ error: 'Errore durante il checkout' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    // Recuperiamo l'annuncio con JOIN venditore (u.country non è nella schema, usiamo 'it' come default)
    const result = await query(
      `SELECT l.*, 
              u.username as seller_username, 
              u.avatar_url as seller_avatar,
              u.rating_avg as seller_rating,
              u.is_verified as seller_is_verified,
              u.is_pro as seller_is_pro,
              (SELECT u2.username FROM bids b JOIN users u2 ON b.bidder_id = u2.id WHERE b.listing_id = l.id ORDER BY b.amount DESC, b.created_at ASC LIMIT 1) as highest_bidder_username
       FROM listings l
       JOIN users u ON l.seller_id = u.id
       WHERE l.id = $1`,
      [req.params.id]
    );

    if (result.rows.length === 0) return res.status(404).json({ error: 'Non trovato' });

    // Incrementa viste in background (opzionale: non blocca la risposta)
    query(`UPDATE listings SET views_count = views_count + 1 WHERE id = $1`, [req.params.id]).catch(console.error);

    const row = result.rows[0];
    const { seller_username, seller_avatar, seller_rating, seller_is_verified, seller_is_pro, highest_bidder_username, ...listing } = row;
    
    const formatted = {
      ...listing,
      highest_bidder_username,
      seller: {
        username: seller_username,
        avatar_url: seller_avatar,
        rating_avg: seller_rating,
        is_verified: seller_is_verified ?? false,
        is_pro: seller_is_pro ?? false,
        country: 'it'  // default
      }
    };

    let buyerCountry = 'it';
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret_di_sviluppo_super_sicuro');
        if (decoded.userId) {
          const userRes = await query('SELECT address_country FROM users WHERE id = $1', [decoded.userId]);
          if (userRes.rows.length > 0 && userRes.rows[0].address_country) {
            buyerCountry = userRes.rows[0].address_country;
          }
        }
      } catch (e) {}
    }

    formatted.shipping_options = calculateShippingRates(
      listing.shipping_options,
      formatted.seller.country,
      buyerCountry,
      listing.package_size
    );

    res.json(formatted);
  } catch (err) {
    console.error('GET single listing:', err.message);
    res.status(500).json({ error: 'Errore nel recupero dell\'annuncio' });
  }
});

router.patch('/:id', auth, upload.array('images', 10), async (req, res) => {
  const { error, value } = patchSchema.validate(req.body, { stripUnknown: true });
  if (error) {
    return res.status(400).json({ error: error.details[0].message });
  }

  let newImages = null;
  if (req.files && req.files.length > 0) {
    newImages = [];
    try {
      for (const file of req.files) {
        const url = await uploadOrSaveProcessedImage(file.buffer);
        newImages.push(url);
      }
    } catch (procErr) {
      console.error('Image processing failed:', procErr);
      return res.status(500).json({ error: 'Errore durante l\'ottimizzazione delle immagini' });
    }
  }

  const fieldMap = {
    title: 'title',
    description: 'description',
    setNumber: 'set_number',
    theme: 'theme',
    year: 'year',
    pieces: 'pieces',
    condition: 'condition',
    boxCondition: 'box_condition',
    instructions: 'instructions',
    proNotes: 'pro_notes',
    isComplete: 'is_complete',
    price: 'price',
    shippingCost: 'shipping_cost',
    shippingMethod: 'shipping_method',
    status: 'status',
    category: 'category',
    packageSize: 'package_size',
  };

  const sets = [];
  const params = [];
  Object.entries(value).forEach(([k, v]) => {
    if (k === 'shippingOptions') return; // Handled separately
    const col = fieldMap[k];
    if (!col || v === undefined) return;
    params.push(v);
    sets.push(`${col} = $${params.length}`);
  });

  if (value.shippingOptions !== undefined) {
    let parsedShippingOptions = [];
    if (value.shippingOptions) {
      try { parsedShippingOptions = JSON.parse(value.shippingOptions); } catch(e) {}
    }
    params.push(JSON.stringify(parsedShippingOptions));
    sets.push(`shipping_options = $${params.length}`);
  }

  if (newImages) {
    params.push(newImages);
    sets.push(`images = $${params.length}`);
  }

  if (sets.length === 0) {
    return res.status(400).json({ error: 'Nessun campo da aggiornare' });
  }

  const idPlaceholder = params.length + 1;
  const sellerPlaceholder = params.length + 2;
  params.push(req.params.id, req.user.userId);

  try {
    const result = await query(
      `UPDATE listings SET ${sets.join(', ')}, updated_at = NOW()
       WHERE id = $${idPlaceholder} AND seller_id = $${sellerPlaceholder}
       RETURNING *`,
      params
    );
    if (result.rows.length === 0) {
      return res.status(403).json({ error: 'Non autorizzato o annuncio inesistente' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('PATCH listing:', err.message);
    res.status(500).json({ error: 'Errore aggiornamento' });
  }
});

// Soft delete: stato removed
router.delete('/:id', auth, async (req, res) => {
  try {
    const result = await query(
      `UPDATE listings SET status = 'removed', updated_at = NOW()
       WHERE id = $1 AND seller_id = $2 AND status <> 'sold'
       RETURNING id`,
      [req.params.id, req.user.userId]
    );
    if (result.rows.length === 0) {
      return res.status(403).json({ error: 'Non autorizzato o annuncio non eliminabile' });
    }
    res.json({ message: 'Annuncio rimosso' });
  } catch (err) {
    res.status(500).json({ error: 'Errore cancellazione' });
  }
});

/** 
 * POST /api/listings/:id/bid
 * Piazzamento offerta per un'asta
 */
router.post('/:id/bid', auth, async (req, res) => {

  const { id } = req.params;
  const bidderId = req.user.userId;

  // Final bypass: direct parse
  const amount = parseFloat(req.body.amount);

  if (isNaN(amount) || amount <= 0) {
    return res.status(400).json({ error: 'Invalid Number' });
  }

  const { getClient } = require('../db');
  const client = await getClient();

  try {
    await client.query('BEGIN');

    // Lock listing row to prevent race conditions
    const listingRes = await client.query(
      `SELECT * FROM listings WHERE id = $1 FOR UPDATE`,
      [id]
    );

    if (listingRes.rows.length === 0) {
      throw new Error('Annuncio non trovato');
    }

    const listing = listingRes.rows[0];

    // Check if it's an auction
    if (!listing.is_auction && listing.type !== 'auction') {
      throw new Error('Questo articolo non è un\'asta');
    }

    // Check status
    if (listing.status !== 'active') {
      throw new Error('L\'asta non è attiva');
    }

    // Check expiry
    const now = new Date();
    let auctionEnd = listing.auction_end ? new Date(listing.auction_end) : null;
    
    if (auctionEnd && auctionEnd < now) {
      const err = new Error('Questa asta è già terminata.');
      err.status = 410;
      throw err;
    }

    // Seller cannot bid on own listing
    if (listing.seller_id === bidderId) {
      const err = new Error('Non puoi fare un\'offerta sul tuo annuncio');
      err.status = 403;
      throw err;
    }

    const currentBid = parseFloat(listing.current_bid || 0);
    const minIncrement = 1.00;
    const isFirstBid = (listing.bids_count === 0);
    const startingPrice = parseFloat(listing.starting_price || listing.auction_start || 0);

    let minBidRequired = isFirstBid ? startingPrice : (currentBid + minIncrement);

    if (parseFloat(amount) < minBidRequired) {
      throw new Error(`Offerta troppo bassa. Il minimo richiesto è ${minBidRequired.toFixed(2)}€`);
    }

    // Anti-sniping: extend by 2 mins if bid is placed within last 2 minutes
    let newAuctionEnd = null;
    if (auctionEnd && (auctionEnd.getTime() - now.getTime()) <= 2 * 60 * 1000) {
      newAuctionEnd = new Date(now.getTime() + 2 * 60 * 1000);
    }

    // Get previous highest bidder for "Outbid" notification
    const previousBidderRes = await client.query(
      `SELECT bidder_id FROM bids WHERE listing_id = $1 ORDER BY amount DESC, created_at ASC LIMIT 1`,
      [id]
    );
    const previousBidderId = previousBidderRes.rows.length > 0 ? previousBidderRes.rows[0].bidder_id : null;

    // Insert bid
    await client.query(
      `INSERT INTO bids (listing_id, bidder_id, amount, created_at) VALUES ($1, $2, $3, NOW())`,
      [id, bidderId, amount]
    );

    // Update listing
    let updateRes;
    if (newAuctionEnd) {
      updateRes = await client.query(
        `UPDATE listings SET current_bid = $1, bids_count = bids_count + 1, updated_at = NOW(), auction_end = $3 WHERE id = $2 RETURNING *`,
        [amount, id, newAuctionEnd]
      );
    } else {
      updateRes = await client.query(
        `UPDATE listings SET current_bid = $1, bids_count = bids_count + 1, updated_at = NOW() WHERE id = $2 RETURNING *`,
        [amount, id]
      );
    }

    await client.query('COMMIT');
    
    // Asynchronous notification insert, no need to block the response
    if (previousBidderId && previousBidderId !== bidderId) {
      client.query(
        `INSERT INTO notifications (user_id, message_key, listing_id) VALUES ($1, $2, $3)`,
        [previousBidderId, 'notifications.outbid', id]
      ).catch(err => console.error('Outbid notification error:', err));
    }

    res.json(updateRes.rows[0]);

  } catch (err) {
    await client.query('ROLLBACK');
    res.status(err.status || 400).json({ error: err.message });
  } finally {
    client.release();
  }
});


/**
 * POST /api/listings/:id/bid-debug
 * Versione semplificata senza alcuna validazione per test forense
 */
router.post('/:id/bid-debug', async (req, res) => {

  const { id } = req.params;
  const { amount } = req.body;
  
  try {
    const result = await query(
      `UPDATE listings SET current_bid = $1, bids_count = bids_count + 1 WHERE id = $2 RETURNING *`,
      [amount, id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
