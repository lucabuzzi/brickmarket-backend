const express = require('express');
const router = express.Router();
const { query } = require('../db');
const auth = require('../middleware/auth');
const { upload } = require('../services/cloudinary');
const Joi = require('joi');

function validateListingPayload(body) {
  const schema = Joi.object({
    title: Joi.string().min(5).max(300).required(),
    description: Joi.string().max(10000).allow('', null),
    setNumber: Joi.string().max(20).allow('', null),
    theme: Joi.string().max(100).allow('', null),
    year: Joi.number().integer().min(1900).max(2100).allow(null),
    pieces: Joi.number().integer().min(1).allow(null),
    type: Joi.string().valid('used', 'sealed', 'moc', 'auction').required(),
    condition: Joi.string().valid('complete', 'good', 'fair', 'parts').allow(null),
    price: Joi.number().positive().allow(null),
    auctionStart: Joi.number().positive().allow(null),
    auctionEnd: Joi.date().iso().allow(null),
    auctionReserve: Joi.number().min(0).allow(null),
    shippingCost: Joi.number().min(0).default(0),
    shippingMethod: Joi.string().max(50).allow('', null),
    status: Joi.string().valid('draft', 'active').default('active'),
  });

  const { error, value } = schema.validate(body, { abortEarly: false, stripUnknown: true });
  if (error) {
    return { error: error.details[0].message, value: null };
  }

  if (value.type === 'auction') {
    if (value.auctionStart == null || value.auctionEnd == null) {
      return { error: 'Per le aste servono auctionStart e auctionEnd', value: null };
    }
  } else {
    if (value.price == null) {
      return { error: 'Il prezzo è obbligatorio per questo tipo di annuncio', value: null };
    }
    if (!value.condition) {
      return { error: 'La condizione è obbligatoria', value: null };
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
  condition: Joi.string().valid('complete', 'good', 'fair', 'parts').allow(null),
  price: Joi.number().positive().allow(null),
  shippingCost: Joi.number().min(0),
  shippingMethod: Joi.string().max(50).allow('', null),
  status: Joi.string().valid('draft', 'active', 'removed'),
});

// POST — crea annuncio (multipart: campi + images[])
router.post('/', auth, upload.array('images', 10), async (req, res) => {
  const { error, value } = validateListingPayload(req.body);
  if (error) {
    return res.status(400).json({ error });
  }

  const imageUrls = (req.files && req.files.length)
    ? req.files.map((f) => f.path)
    : [];

  const v = value;
  const auctionEnd = v.type === 'auction' ? new Date(v.auctionEnd) : null;
  const currentBid = v.type === 'auction' ? v.auctionStart : null;

  try {
    const result = await query(
      `INSERT INTO listings (
        seller_id, title, description, set_number, theme, year, pieces,
        type, condition,
        price, auction_start, auction_end, auction_reserve, current_bid,
        status, images, shipping_cost, shipping_method
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18
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
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('ERRORE CREAZIONE:', err.message);
    res.status(500).json({ error: 'Errore durante la creazione' });
  }
});

router.get('/user/me', auth, async (req, res) => {
  try {
    const result = await query(
      'SELECT * FROM listings WHERE seller_id = $1 ORDER BY created_at DESC',
      [req.user.userId]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Errore nel recupero dei tuoi annunci' });
  }
});

// Lista pubblica (default: solo active; ?status=all per tutti gli stati)
router.get('/', async (req, res) => {
  const { status: statusQ, type, theme } = req.query;
  try {
    const params = [];
    const parts = [];

    if (statusQ === undefined || statusQ === '') {
      params.push('active');
      parts.push(`status = $${params.length}`);
    } else if (statusQ !== 'all') {
      params.push(statusQ);
      parts.push(`status = $${params.length}`);
    }

    if (type) {
      params.push(type);
      parts.push(`type = $${params.length}`);
    }
    if (theme) {
      params.push(`%${theme}%`);
      parts.push(`theme ILIKE $${params.length}`);
    }

    const where = parts.length ? `WHERE ${parts.join(' AND ')}` : '';
    const result = await query(
      `SELECT * FROM listings ${where} ORDER BY created_at DESC`,
      params
    );
    res.json(result.rows);
  } catch (err) {
    console.error('LISTINGS:', err.message);
    res.status(500).json({ error: 'Errore nel recupero' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const result = await query(
      `UPDATE listings SET views_count = views_count + 1 WHERE id = $1 RETURNING *`,
      [req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Non trovato' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Errore nel recupero dell\'annuncio' });
  }
});

router.patch('/:id', auth, upload.array('images', 10), async (req, res) => {
  const { error, value } = patchSchema.validate(req.body, { stripUnknown: true });
  if (error) {
    return res.status(400).json({ error: error.details[0].message });
  }

  const newImages = req.files && req.files.length ? req.files.map((f) => f.path) : null;

  const fieldMap = {
    title: 'title',
    description: 'description',
    setNumber: 'set_number',
    theme: 'theme',
    year: 'year',
    pieces: 'pieces',
    condition: 'condition',
    price: 'price',
    shippingCost: 'shipping_cost',
    shippingMethod: 'shipping_method',
    status: 'status',
  };

  const sets = [];
  const params = [];
  Object.entries(value).forEach(([k, v]) => {
    const col = fieldMap[k];
    if (!col || v === undefined) return;
    params.push(v);
    sets.push(`${col} = $${params.length}`);
  });

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

module.exports = router;
