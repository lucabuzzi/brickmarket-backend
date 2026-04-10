const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query } = require('../db');
const router = express.Router();

// POST /api/auth/register
router.post('/register', async (req, res) => {
  // Prendiamo i dati, ma usiamo dei valori di default se mancano
  const { 
    email, password, username, fullName, 
    role = 'buyer', city = null, 
    fiscalCode = null, iban = null, sellerType = null 
  } = req.body;

  if (!email || !password || !username) {
    return res.status(400).json({ error: 'Email, password e username sono obbligatori' });
  }

  try {
    // 1. Controlla se email/username sono già usati
    const exists = await query(
      'SELECT id FROM users WHERE email=$1 OR username=$2',
      [email.toLowerCase(), username]
    );

    if (exists.rows.length > 0) {
      return res.status(409).json({ error: 'Email o username già in uso' });
    }

    // 2. Cripta la password
    const passwordHash = await bcrypt.hash(password, 12);

    // 3. Inserimento nel DB (gestendo i valori mancanti come null)
    const result = await query(`
      INSERT INTO users 
        (email, password_hash, username, full_name, role, city, fiscal_code, iban, seller_type)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING id, email, username, role
    `, [
      email.toLowerCase(), 
      passwordHash, 
      username, 
      fullName || null, 
      role, 
      city, 
      fiscalCode, 
      iban, 
      sellerType
    ]);

    const user = result.rows[0];
    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '7d' });

    res.status(201).json({ 
        message: "Registrazione completata! Benvenuto nel club.",
        token, 
        user 
    });

  } catch (err) {
    // Questo ci aiuta a vedere nel terminale l'errore preciso di PostgreSQL
    console.error('ERRORE DATABASE:', err.message);
    res.status(500).json({ error: 'Errore durante la registrazione' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
    const { email, password } = req.body;
    try {
      const result = await query('SELECT * FROM users WHERE email=$1', [email.toLowerCase()]);
      const user = result.rows[0];
      if (!user || !(await bcrypt.compare(password, user.password_hash))) {
        return res.status(401).json({ error: 'Credenziali non valide' });
      }
      const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '7d' });
      res.json({ token, user: { id: user.id, email: user.email, username: user.username } });
    } catch (err) {
      res.status(500).json({ error: 'Errore login' });
    }
  });

const auth = require('../middleware/auth'); // Importa il middleware se non c'è già

// GET /api/auth/me - Recupera i dati dell'utente loggato
router.get('/me', auth, async (req, res) => {
  try {
    // Cerchiamo l'utente nel DB usando l'ID estratto dal Token
    const result = await query(
      'SELECT id, name, email, created_at FROM users WHERE id = $1',
      [req.user.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Utente non trovato' });
    }

    // Restituiamo i dati (SENZA la password per sicurezza!)
    res.json(result.rows[0]);
  } catch (err) {
    console.error('ERRORE PROFILO:', err.message);
    res.status(500).json({ error: 'Errore nel recupero del profilo' });
  }
});
  module.exports = router;