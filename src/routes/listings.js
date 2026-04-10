const express = require('express');
const router = express.Router();
const { query } = require('../db');
const auth = require('../middleware/auth');
const { upload } = require('../services/cloudinary');
const Joi = require('joi'); // Importiamo Joi

// --- 1. SCHEMA DI VALIDAZIONE (Il nostro "Regolamento") ---
const listingSchema = Joi.object({
  title: Joi.string().min(5).max(100).required().messages({
    'string.min': 'Il titolo deve avere almeno 5 caratteri',
    'any.required': 'Il titolo è obbligatorio'
  }),
  price: Joi.number().positive().required().messages({
    'number.positive': 'Il prezzo deve essere un numero positivo',
    'any.required': 'Il prezzo è obbligatorio'
  }),
  description: Joi.string().max(1000).allow(''),
  category: Joi.string().default('Generico'),
  condition: Joi.string().valid('new', 'used', 'damaged').default('used'),
  location: Joi.string().default('Italia'),
  type: Joi.string().valid('fixed', 'auction').default('fixed')
});

// --- 2. ROTTE ---

// A. CREA NUOVO ANNUNCIO (POST)
router.post('/', auth, upload.single('image'), async (req, res) => {
  // Validazione con Joi
  const { error, value } = listingSchema.validate(req.body);

  if (error) {
    return res.status(400).json({ error: error.details[0].message });
  }

  // Dati validati presi da 'value'
  const { title, description, price, category, condition, location, type } = value;
  const imageUrl = req.file ? req.file.path : null;

  try {
    const result = await query(
      `INSERT INTO listings 
        (seller_id, title, description, price, category, condition, location, type, image_url) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) 
       RETURNING *`,
      [req.user.userId, title, description, price, category, condition, location, type, imageUrl]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('ERRORE CREAZIONE:', err.message);
    res.status(500).json({ error: 'Errore durante la creazione' });
  }
});

// B. RECUPERA I MIEI ANNUNCI (GET user/me)
// Nota: Messo SOPRA :id per evitare conflitti
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

// C. RECUPERA TUTTI GLI ANNUNCI (GET)
router.get('/', async (req, res) => {
  try {
    const result = await query('SELECT * FROM listings ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Errore nel recupero' });
  }
});

// D. DETTAGLIO SINGOLO ANNUNCIO (GET :id)
router.get('/:id', async (req, res) => {
  try {
    const result = await query('SELECT * FROM listings WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Non trovato' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Errore nel recupero dell\'annuncio' });
  }
});

// E. CANCELLAZIONE (DELETE)
router.delete('/:id', auth, async (req, res) => {
  try {
    const result = await query(
      'DELETE FROM listings WHERE id = $1 AND seller_id = $2 RETURNING *',
      [req.params.id, req.user.userId]
    );
    if (result.rows.length === 0) return res.status(403).json({ error: 'Non autorizzato' });
    res.json({ message: 'Eliminato!' });
  } catch (err) {
    res.status(500).json({ error: 'Errore cancellazione' });
  }
});

module.exports = router;