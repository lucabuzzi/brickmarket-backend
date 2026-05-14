const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { query } = require('../db');
const { sendRecoveryEmail } = require('../services/email');
const { upload, secureUpload } = require('../services/cloudinary');
const { uploadOrSaveProcessedImage } = require('../services/image');
const router = express.Router();

// POST /api/auth/register
router.post('/register', secureUpload.fields([{ name: 'id_scan', maxCount: 1 }, { name: 'business_license', maxCount: 1 }]), async (req, res) => {
  // Prendiamo i dati, ma usiamo dei valori di default se mancano
  // Prendiamo i dati, ma usiamo dei valori di default se mancano
  const { 
    email, password, username, fullName, 
    role = 'buyer', city = null, 
    fiscalCode = null, iban = null, sellerType = null,
    companyName = null, street = null, houseNumber = null, zipCode = null, country = null, phone = null 
  } = req.body;

  let idScanUrl = null;
  let businessLicenseUrl = null;

  if (req.files && req.files['id_scan'] && req.files['id_scan'][0]) {
    idScanUrl = await uploadOrSaveProcessedImage(req.files['id_scan'][0].buffer, 'brickmarket_secure');
  }
  if (req.files && req.files['business_license'] && req.files['business_license'][0]) {
    businessLicenseUrl = await uploadOrSaveProcessedImage(req.files['business_license'][0].buffer, 'brickmarket_secure');
  }

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
        (email, password_hash, username, full_name, role, city, fiscal_code, iban, seller_type,
         company_name, address_street, address_house_number, address_zip_code, address_country, phone, id_scan_url, business_license_url)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
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
      sellerType,
      companyName, street, houseNumber, zipCode, country, phone, idScanUrl, businessLicenseUrl
    ]);

    const user = result.rows[0];
    const token = jwt.sign(
      { userId: user.id, role: user.role }, 
      process.env.JWT_SECRET, 
      { expiresIn: '7d' }
    );

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
      // Cerca per email o per username (email nel body può contenere anche l'username ora)
      const input = email.toLowerCase();
      const result = await query(
        'SELECT * FROM users WHERE email=$1 OR username=$2', 
        [input, email] // username è case-sensitive in questo schema, ma email no
      );
      const user = result.rows[0];
      if (!user || !(await bcrypt.compare(password, user.password_hash))) {
        return res.status(401).json({ error: 'Credenziali non valide' });
      }
      const token = jwt.sign(
        { userId: user.id, role: user.role }, 
        process.env.JWT_SECRET, 
        { expiresIn: '7d' }
      );
      res.json({ token, user: { id: user.id, email: user.email, username: user.username, role: user.role } });
    } catch (err) {
      console.error('LOGIN ERROR:', err.message);
      res.status(500).json({ error: 'Errore login' });
    }
  });

const auth = require('../middleware/auth'); // Importa il middleware se non c'è già

// GET /api/auth/me - Recupera i dati dell'utente loggato
router.get('/me', auth, async (req, res) => {
  try {
    const result = await query(
      `SELECT id, email, username, full_name, role, city, avatar_url, seller_type, company_name,
              stripe_account_id, stripe_account_status,
              rating_avg, rating_count, sales_count, is_verified,
              created_at, updated_at
       FROM users WHERE id = $1`,
      [req.user.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Utente non trovato' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('ERRORE PROFILO:', err.message);
    res.status(500).json({ error: 'Errore nel recupero del profilo' });
  }
});

// PATCH /api/auth/me - Aggiorna il profilo utente loggato
router.patch('/me', auth, upload.single('avatar'), async (req, res) => {
  try {
    const { role, city, full_name } = req.body;
    let newAvatarUrl = undefined;
    if (req.file) {
      newAvatarUrl = await uploadOrSaveProcessedImage(req.file.buffer, 'brickmarket_avatars');
    }

    // Assicuriamoci che il city sia nullo se il ruolo è "buyer"
    let finalCity = city;
    if (role === 'buyer') {
      finalCity = null;
    }

    // Costruiamo la query di update dinamicamente per aggiornare solo quello che ci arriva
    const fields = [];
    const values = [];
    let count = 1;

    if (role !== undefined) {
      fields.push(`role = $${count}`);
      values.push(role);
      count++;
    }
    if (finalCity !== undefined || role === 'buyer') {
      fields.push(`city = $${count}`);
      values.push(finalCity || null);
      count++;
    }
    if (full_name !== undefined) {
      fields.push(`full_name = $${count}`);
      values.push(full_name || null);
      count++;
    }
    if (newAvatarUrl !== undefined) {
      fields.push(`avatar_url = $${count}`);
      values.push(newAvatarUrl);
      count++;
    }

    if (fields.length === 0) {
        return res.status(400).json({ error: 'Nessun dato da aggiornare' });
    }

    values.push(req.user.userId);
    const queryStr = `
        UPDATE users 
        SET ${fields.join(', ')} 
        WHERE id = $${count} 
        RETURNING id, email, username, full_name, role, city, avatar_url
    `;

    const result = await query(queryStr, values);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Utente non trovato' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('ERRORE AGGIORNAMENTO PROFILO:', err.message);
    res.status(500).json({ error: 'Errore durante l\'aggiornamento del profilo' });
  }
});

// POST /api/auth/forgot-password
router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Indirizzo email richiesto.' });

  try {
    const userResult = await query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
    if (userResult.rows.length === 0) {
      // Prevenzione enumerazione account: restituiamo sempre successo
      return res.json({ message: 'Se l\'email esiste, riceverai un link per reimpostare la tua password.' });
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');
    const expires = new Date(Date.now() + 3600000); // 1 ora

    await query(`UPDATE users SET reset_password_token = $1, reset_password_expires = $2 WHERE email = $3`, [hashedToken, expires, email.toLowerCase()]);

    const resetLink = `http://localhost:5173/reset-password?token=${resetToken}`;
    await sendRecoveryEmail(email.toLowerCase(), resetLink);

    res.json({ message: 'Se l\'email esiste, riceverai un link per reimpostare la tua password.' });
  } catch (err) {
    console.error('ERRORE FORGOT PASSWORD:', err);
    res.status(500).json({ error: 'Errore interno nel processo di reset.' });
  }
});

// POST /api/auth/reset-password
router.post('/reset-password', async (req, res) => {
  const { token, newPassword } = req.body;
  if (!token || !newPassword) return res.status(400).json({ error: 'Token e nuova password richiesti.' });
  
  if (newPassword.length < 8) return res.status(400).json({ error: 'La password deve avere almeno 8 caratteri.' });

  try {
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
    
    // Controlla se il token è valido e non scaduto
    const userResult = await query(
      'SELECT id, email FROM users WHERE reset_password_token = $1 AND reset_password_expires > NOW()',
      [hashedToken]
    );

    if (userResult.rows.length === 0) {
      return res.status(400).json({ error: 'Il link di reset è invalido o scaduto. Ritenta.' });
    }

    const userId = userResult.rows[0].id;
    const userEmail = userResult.rows[0].email;
    const passwordHash = await bcrypt.hash(newPassword, 12);

    // Aggiorna la pw e pulisci i token
    await query(`UPDATE users SET password_hash = $1, reset_password_token = NULL, reset_password_expires = NULL WHERE id = $2`, [passwordHash, userId]);

    res.json({ message: 'La tua password è stata aggiornata con successo. Puoi effettuare il login.', email: userEmail });
  } catch (err) {
    console.error('ERRORE RESET PASSWORD:', err);
    res.status(500).json({ error: 'Errore interno al server.' });
  }
});

module.exports = router;