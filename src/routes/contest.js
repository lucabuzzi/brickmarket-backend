const express = require('express');
const jwt = require('jsonwebtoken');
const mainDb = require('../db');
const JWT_SECRET = process.env.JWT_SECRET || 'clutchvault_secret_key_1337';
const { upload } = require('../services/cloudinary');
const contestController = require('../controllers/contestController');

// Custom JWT Authentication Middleware for ClutchVault endpoints
// Resolves the real registered username from the main marketplace DB (always real
// Postgres, independent of whether the ClutchVault-specific tables/mock are in use),
// so leaderboards and wallet transactions show the actual account, not a placeholder.
const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || JWT_SECRET);
    const uId = decoded.userId || decoded.id;

    const userRes = await mainDb.query(
      'SELECT id, username, email, role FROM users WHERE id = $1',
      [uId]
    );
    const user = userRes.rows[0];

    if (!user) {
      return res.status(403).json({ error: 'User not found.' });
    }

    req.user = user;
    next();
  } catch (err) {
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
};

const router = express.Router();

router.get('/list', contestController.listContestsHandler);
router.post('/buy-slot', authenticateToken, contestController.buySlotHandler);
router.get('/leaderboard/:contestId', contestController.leaderboardHandler);
router.post('/start', authenticateToken, contestController.startAttemptHandler);
router.post('/complete', authenticateToken, contestController.completeAttemptHandler);
router.post('/refund/:contestId', authenticateToken, contestController.refundContestHandler);
router.post('/create', authenticateToken, upload.single('image'), contestController.createContestHandler);

module.exports = { router, authenticateToken };
