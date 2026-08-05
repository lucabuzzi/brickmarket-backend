
const express = require('express');
const jwt = require('jsonwebtoken');
const db = require('../db/clutchvault-db');
const mainDb = require('../db');
const JWT_SECRET = process.env.JWT_SECRET || 'clutchvault_secret_key_1337';
const { upload } = require('../services/cloudinary');
const { uploadOrSaveProcessedImage } = require('../services/image');
const crypto = require('crypto');

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

router.get('/list', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT c.*, p.title, p.image_url, p.category, p.market_value, p.condition, p.grading_info
       FROM public.contests c
       JOIN public.products p ON c.product_id = p.id
       ORDER BY c.created_at DESC`
    );

    const contests = result.rows.map(row => ({
      id: row.id,
      productId: row.product_id,
      title: row.title,
      imageUrl: row.image_url,
      category: row.category,
      marketValue: parseFloat(row.market_value),
      condition: row.condition,
      gradingInfo: row.grading_info,
      totalSlots: row.total_slots,
      filledSlots: row.filled_slots,
      slotCostCredits: parseFloat(row.slot_cost_credits),
      status: row.status,
      winnerId: row.winner_id
    }));

    return res.json({ contests });
  } catch (error) {
    console.error('Fetch contests error:', error);
    return res.status(500).json({ error: 'Database error fetching contests' });
  }
});

router.post('/buy-slot', authenticateToken, async (req, res) => {
  const { contestId } = req.body;
  if (!contestId) {
    return res.status(400).json({ error: 'contestId is required.' });
  }

  try {
    const contestResult = await db.query(
      'SELECT slot_cost_credits FROM public.contests WHERE id = $1',
      [contestId]
    );

    if (contestResult.rows.length === 0) {
      return res.status(404).json({ error: 'Contest not found.' });
    }

    const slotCost = parseFloat(contestResult.rows[0].slot_cost_credits);

    const result = await db.query(
      'SELECT public.buy_contest_slot($1, $2, $3, $4) AS result',
      [req.user.id, contestId, slotCost, req.user.username]
    );

    const callResult = result.rows[0].result;

    if (!callResult.success) {
      return res.status(400).json({ error: callResult.message });
    }

    const broadcast = req.app.get('broadcast');
    if (broadcast) {
      broadcast({
        type: 'SLOT_FILLED',
        payload: {
          contestId,
          filledSlots: callResult.filled_slots,
          contestStatus: callResult.contest_status
        }
      });
    }

    return res.json({
      success: true,
      message: callResult.message,
      newBalance: parseFloat(callResult.new_balance),
      filledSlots: callResult.filled_slots,
      contestStatus: callResult.contest_status
    });
  } catch (error) {
    console.error('Buy contest slot error:', error);
    return res.status(500).json({ error: 'Transaction failed: ' + error.message });
  }
});

router.get('/leaderboard/:contestId', async (req, res) => {
  const { contestId } = req.params;
  try {
    const result = await db.query(
      `SELECT cp.*
       FROM public.contest_participants cp
       WHERE cp.contest_id = $1
       ORDER BY
         CASE WHEN cp.status = 'completed' THEN 0 ELSE 1 END,
         cp.total_time_ms ASC,
         cp.created_at ASC`,
      [contestId]
    );

    const leaderboard = result.rows.map(row => ({
      id: row.id,
      contestId: row.contest_id,
      userId: row.user_id,
      username: row.username,
      startedAt: row.started_at,
      endedAt: row.ended_at,
      totalTimeMs: row.total_time_ms,
      status: row.status
    }));

    return res.json({ leaderboard });
  } catch (error) {
    console.error('Fetch leaderboard error:', error);
    return res.status(500).json({ error: 'Database error fetching leaderboard' });
  }
});

router.post('/start', authenticateToken, async (req, res) => {
  const { contestId } = req.body;
  if (!contestId) {
    return res.status(400).json({ error: 'contestId is required.' });
  }

  try {
    // A user can hold multiple paid entries in the same contest — find the most recently
    // bought one that hasn't been started yet (buy-slot always calls /start right after).
    const participantResult = await db.query(
      `SELECT id, status FROM public.contest_participants
       WHERE contest_id = $1 AND user_id = $2 AND started_at IS NULL
       ORDER BY created_at DESC LIMIT 1`,
      [contestId, req.user.id]
    );

    if (participantResult.rows.length === 0) {
      return res.status(403).json({ error: 'You are not registered in this contest. Buy a slot first.' });
    }

    const { id: participantId, status } = participantResult.rows[0];
    if (status !== 'pending') {
      return res.status(400).json({ error: `You have already completed or voided this attempt. Status: ${status}` });
    }

    const startedAt = new Date().toISOString();

    await db.query(
      'UPDATE public.contest_participants SET started_at = $1 WHERE id = $2',
      [startedAt, participantId]
    );

    const attemptToken = jwt.sign(
      {
        userId: req.user.id,
        contestId,
        participantId,
        startedAt
      },
      process.env.JWT_SECRET || JWT_SECRET,
      { expiresIn: '15m' }
    );

    return res.json({
      success: true,
      message: 'Contest attempt started! Puzzle timer is ticking.',
      attemptToken
    });
  } catch (error) {
    console.error('Start contest attempt error:', error);
    return res.status(500).json({ error: 'Database error starting attempt: ' + error.message });
  }
});

router.post('/complete', authenticateToken, async (req, res) => {
  const { contestId, attemptToken, totalBlurTimeMs = 0, blurCount = 0 } = req.body;
  if (!contestId || !attemptToken) {
    return res.status(400).json({ error: 'contestId and attemptToken are required.' });
  }

  try {
    let decoded;
    try {
      decoded = jwt.verify(attemptToken, process.env.JWT_SECRET || JWT_SECRET);
    } catch (err) {
      console.warn(`Anti-Cheat Alert: Invalid/Expired attempt token for user ${req.user.id}.`);
      // Only void the currently in-flight attempt (started but not yet completed) —
      // a user can hold other pending/completed entries in the same contest.
      await db.query(
        "UPDATE public.contest_participants SET status = 'cheated' WHERE contest_id = $1 AND user_id = $2 AND started_at IS NOT NULL AND ended_at IS NULL",
        [contestId, req.user.id]
      );
      return res.status(400).json({
        error: 'Invalid or expired attempt token. Entry marked as void/cheated.',
        cheated: true
      });
    }

    if (decoded.userId !== req.user.id || decoded.contestId !== contestId) {
      return res.status(400).json({ error: 'Attempt token verification mismatch.' });
    }

    const startedAtTime = new Date(decoded.startedAt);
    const endedAtTime = new Date();
    const serverTimeMs = endedAtTime.getTime() - startedAtTime.getTime();

    let status = 'completed';
    let cheatReason = null;

    if (serverTimeMs < 5000) {
      status = 'cheated';
      cheatReason = 'Impossible puzzle completion speed (under 5 seconds).';
    }

    if (totalBlurTimeMs > 15000) {
      status = 'cheated';
      cheatReason = 'Browser tab lost focus for an excessive duration (>15 seconds).';
    }

    const finalScoreMs = Math.round(serverTimeMs);
    console.log(`[Anti-Cheat Debug] User ${req.user.username} finished. Elapsed: ${finalScoreMs}ms. Status: ${status}.`);

    await db.query(
      `UPDATE public.contest_participants
       SET ended_at = $1, total_time_ms = $2, status = $3
       WHERE id = $4`,
      [endedAtTime.toISOString(), finalScoreMs, status, decoded.participantId]
    );

    const contestResult = await db.query(
      'SELECT status, total_slots, filled_slots FROM public.contests WHERE id = $1',
      [contestId]
    );
    const contest = contestResult.rows[0];

    let contestFinalized = false;
    let winnerName = null;

    if (contest && contest.filled_slots >= contest.total_slots) {
      const finishesResult = await db.query(
        `SELECT COUNT(*) as count 
         FROM public.contest_participants 
         WHERE contest_id = $1 AND status != 'pending'`,
        [contestId]
      );
      
      const finishedCount = parseInt(finishesResult.rows[0].count);
      
      if (finishedCount >= contest.total_slots) {
        const leaderboardResult = await db.query(
          `SELECT cp.user_id, cp.total_time_ms, cp.username
           FROM public.contest_participants cp
           WHERE cp.contest_id = $1 AND cp.status = 'completed'
           ORDER BY cp.total_time_ms ASC
           LIMIT 1`,
          [contestId]
        );

        if (leaderboardResult.rows.length > 0) {
          const winner = leaderboardResult.rows[0];
          
          await db.query(
            "UPDATE public.contests SET status = 'completed', winner_id = $1 WHERE id = $2",
            [winner.user_id, contestId]
          );
          
          contestFinalized = true;
          winnerName = winner.username;
          console.log(`🏆 Contest ${contestId} finalized! Winner: ${winnerName}`);
        } else {
          await db.query(
            "UPDATE public.contests SET status = 'cancelled' WHERE id = $1",
            [contestId]
          );
        }
      }
    }

    return res.json({
      success: true,
      message: status === 'cheated' ? `Submission processed. Cheat detected: ${cheatReason}` : 'Attempt registered successfully!',
      status,
      timeMs: finalScoreMs,
      contestFinalized,
      winnerName
    });

  } catch (error) {
    console.error('Complete attempt error:', error);
    return res.status(500).json({ error: 'Database error processing completion: ' + error.message });
  }
});

router.post('/refund/:contestId', authenticateToken, async (req, res) => {
  const { contestId } = req.params;
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin permissions required to refund contests' });
    }

    const contestResult = await db.query(
      "SELECT status, slot_cost_credits FROM public.contests WHERE id = $1",
      [contestId]
    );

    if (contestResult.rows.length === 0) {
      return res.status(404).json({ error: 'Contest not found' });
    }

    const { status, slot_cost_credits } = contestResult.rows[0];
    if (status === 'completed' || status === 'cancelled') {
      return res.status(400).json({ error: `Cannot refund contest which is already ${status}` });
    }

    const refundAmount = parseFloat(slot_cost_credits);

    const participants = await db.query(
      'SELECT user_id FROM public.contest_participants WHERE contest_id = $1',
      [contestId]
    );

    if (participants.rows.length > 0) {
      for (const row of participants.rows) {
        const uId = row.user_id;
        await db.query(
          'UPDATE public.user_wallets SET balance_credits = balance_credits + $1 WHERE user_id = $2',
          [refundAmount, uId]
        );
        await db.query(
          'INSERT INTO public.credit_transactions (user_id, amount, type, reference_id) VALUES ($1, $2, $3, $4)',
          [uId, refundAmount, 'contest_refund', contestId]
        );
      }
    }

    await db.query(
      "UPDATE public.contests SET status = 'cancelled' WHERE id = $1",
      [contestId]
    );

    return res.json({
      success: true,
      message: `Contest cancelled. Refunded ${participants.rows.length} participants with ${refundAmount} credits each.`
    });

  } catch (error) {
    console.error('Refund contest error:', error);
    return res.status(500).json({ error: 'Refund transaction failed: ' + error.message });
  }
});

// POST /api/contest/create - Create a new timed jigsaw contest (Admin only)
router.post('/create', authenticateToken, upload.single('image'), async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin permissions required to create contests.' });
    }

    const { 
      title, description, category, marketValue, 
      slotCostCredits, condition, gradingInfo, totalSlots = 5 
    } = req.body;

    if (!title || !category || !marketValue || !slotCostCredits) {
      return res.status(400).json({ error: 'Title, category, marketValue, and slotCostCredits are required.' });
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

    if (db.isMock) {
      const mockDb = db.getMockDbState();
      const newProduct = {
        id: newProductId,
        title,
        description: description || '',
        image_url: imageUrl,
        category,
        market_value: parseFloat(marketValue),
        condition: condition || 'New',
        grading_info: gradingInfo || 'Ungraded',
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
      // Postgres insert product
      await db.query(`
        INSERT INTO public.products (id, title, description, image_url, category, market_value, condition, grading_info, stock)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 1)
      `, [newProductId, title, description || '', imageUrl, category, parseFloat(marketValue), condition || 'New', gradingInfo || 'Ungraded']);

      // Postgres insert contest
      await db.query(`
        INSERT INTO public.contests (id, product_id, total_slots, filled_slots, slot_cost_credits, status)
        VALUES ($1, $2, $3, 0, $4, 'open')
      `, [newContestId, newProductId, parseInt(totalSlots, 10), parseFloat(slotCostCredits)]);
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
      message: 'Jigsaw puzzle contest uploaded and registered successfully!',
      contestId: newContestId
    });

  } catch (err) {
    console.error('Create contest error:', err);
    return res.status(500).json({ error: 'Failed to create contest: ' + err.message });
  }
});

module.exports = { router, authenticateToken };
