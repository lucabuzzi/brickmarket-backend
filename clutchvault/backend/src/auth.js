const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const db = require('./db');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'clutchvault_secret_key_1337';

// Middleware to authenticate JWT tokens
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer <TOKEN>

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
};

// SIGN UP ROUTE
router.post('/signup', async (req, res) => {
  const { username, email, password } = req.body;

  if (!username || !email || !password) {
    return res.status(400).json({ error: 'All fields (username, email, password) are required' });
  }

  try {
    // Check if user already exists
    const existingUser = await db.query(
      'SELECT * FROM public.profiles WHERE email = $1',
      [email]
    );

    if (existingUser.rows.length > 0) {
      return res.status(400).json({ error: 'A user with this email already exists' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);
    
    // Generate UUID
    const userId = crypto.randomUUID();

    // Insert into profiles (and triggers wallet creation in Supabase / mock DB)
    const result = await db.query(
      'INSERT INTO public.profiles (id, username, email, password_hash, role) VALUES ($1, $2, $3, $4, $5) RETURNING id, username, email, role',
      [userId, username, email, passwordHash, 'user']
    );

    const user = result.rows[0];

    // Ensure wallet is created (failsafe for standard Postgres setups without the trigger)
    try {
      await db.query(
        'INSERT INTO public.user_wallets (user_id, balance_credits) VALUES ($1, 100.00) ON CONFLICT (user_id) DO NOTHING',
        [userId]
      );
    } catch (walletErr) {
      console.warn('Wallet insertion warning:', walletErr.message);
    }

    // Generate JWT token
    const token = jwt.sign(
      { id: user.id, username: user.username, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    return res.status(201).json({
      message: 'Signup successful! Welcome to ClutchVault.',
      token,
      user
    });
  } catch (error) {
    console.error('Signup error:', error);
    return res.status(500).json({ error: 'Database error during signup: ' + error.message });
  }
});

// LOGIN ROUTE
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  try {
    const result = await db.query(
      'SELECT * FROM public.profiles WHERE email = $1',
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid email or password' });
    }

    const user = result.rows[0];

    // Verify password
    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(400).json({ error: 'Invalid email or password' });
    }

    // Generate JWT token
    const token = jwt.sign(
      { id: user.id, username: user.username, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    return res.json({
      message: 'Login successful!',
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ error: 'Database error during login' });
  }
});

// GET ME ROUTE
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const result = await db.query(
      'SELECT id, username, email, role FROM public.profiles WHERE id = $1',
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.json({ user: result.rows[0] });
  } catch (error) {
    console.error('Get me error:', error);
    return res.status(500).json({ error: 'Database error fetching user' });
  }
});

module.exports = {
  router,
  authenticateToken,
  JWT_SECRET
};
