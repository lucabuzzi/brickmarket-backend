const express = require('express');
const jwt = require('jsonwebtoken');
const db = require('./db');
const { authenticateToken, JWT_SECRET } = require('./auth');

const router = express.Router();

// GET LIST OF ALL CONTESTS (Skill Zone)
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

// BUY CONTEST SLOT (Using atomic PL/pgSQL function)
router.post('/buy-slot', authenticateToken, async (req, res) => {
  const { contestId } = req.body;

  if (!contestId) {
    return res.status(400).json({ error: 'contestId is required.' });
  }

  try {
    // 1. Fetch slot cost
    const contestResult = await db.query(
      'SELECT slot_cost_credits FROM public.contests WHERE id = $1',
      [contestId]
    );

    if (contestResult.rows.length === 0) {
      return res.status(404).json({ error: 'Contest not found.' });
    }

    const slotCost = parseFloat(contestResult.rows[0].slot_cost_credits);

    // 2. Call the atomic function
    const result = await db.query(
      'SELECT public.buy_contest_slot($1, $2, $3) AS result',
      [req.user.id, contestId, slotCost]
    );

    const callResult = result.rows[0].result;

    if (!callResult.success) {
      return res.status(400).json({ error: callResult.message });
    }

    // Broadcast update via Websocket
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

// GET CONTEST LEADERBOARD
router.get('/leaderboard/:contestId', async (req, res) => {
  const { contestId } = req.params;

  try {
    const result = await db.query(
      `SELECT cp.*, pr.username 
       FROM public.contest_participants cp
       JOIN public.profiles pr ON cp.user_id = pr.id
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

// START CONTEST ATTEMPT (Registers database timestamp & returns signed JWT start token)
router.post('/start', authenticateToken, async (req, res) => {
  const { contestId } = req.body;

  if (!contestId) {
    return res.status(400).json({ error: 'contestId is required.' });
  }

  try {
    // Verify user is registered in this contest and attempt is currently pending
    const participantResult = await db.query(
      'SELECT status FROM public.contest_participants WHERE contest_id = $1 AND user_id = $2',
      [contestId, req.user.id]
    );

    if (participantResult.rows.length === 0) {
      return res.status(403).json({ error: 'You are not registered in this contest. Buy a slot first.' });
    }

    const { status } = participantResult.rows[0];
    if (status !== 'pending') {
      return res.status(400).json({ error: `You have already completed or voided this attempt. Status: ${status}` });
    }

    const startedAt = new Date().toISOString();

    // Register start time in DB
    await db.query(
      'UPDATE public.contest_participants SET started_at = $1 WHERE contest_id = $2 AND user_id = $3',
      [startedAt, contestId, req.user.id]
    );

    // Generate signed, short-lived JWT token containing encrypted start details
    const attemptToken = jwt.sign(
      {
        userId: req.user.id,
        contestId,
        startedAt
      },
      JWT_SECRET,
      { expiresIn: '15m' } // 15-minute maximum window for solving the puzzle
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

// COMPLETE CONTEST ATTEMPT (Verifies signed JWT, anti-cheat, latency, updates leaderboard)
router.post('/complete', authenticateToken, async (req, res) => {
  const { contestId, attemptToken, totalBlurTimeMs = 0, blurCount = 0 } = req.body;

  if (!contestId || !attemptToken) {
    return res.status(400).json({ error: 'contestId and attemptToken are required.' });
  }

  try {
    // 1. Verify start-timestamp JWT token
    let decoded;
    try {
      decoded = jwt.verify(attemptToken, JWT_SECRET);
    } catch (err) {
      // Flag as cheat if token is expired or manipulated
      console.warn(`Anti-Cheat Alert: Invalid/Expired attempt token for user ${req.user.id}.`);
      await db.query(
        "UPDATE public.contest_participants SET status = 'cheated' WHERE contest_id = $1 AND user_id = $2",
        [contestId, req.user.id]
      );
      return res.status(400).json({
        error: 'Invalid or expired attempt token. Entry marked as void/cheated.',
        cheated: true
      });
    }

    // Verify token payload matches request context
    if (decoded.userId !== req.user.id || decoded.contestId !== contestId) {
      return res.status(400).json({ error: 'Attempt token verification mismatch.' });
    }

    const startedAtTime = new Date(decoded.startedAt);
    const endedAtTime = new Date();
    
    // Server-side elapsed time calculation (un-manipulatable by client clock alterations)
    const serverTimeMs = endedAtTime.getTime() - startedAtTime.getTime();

    // 2. Gameplay Anti-Cheat Verification Rules
    let status = 'completed';
    let cheatReason = null;

    // RULE A: Speed Threshold Check.
    // Solving a 50-piece classic jigsaw puzzle in under 5.0 seconds is humanly impossible
    if (serverTimeMs < 5000) {
      status = 'cheated';
      cheatReason = 'Impossible puzzle completion speed (under 5 seconds).';
    }

    // RULE B: Out-of-focus check.
    // If the browser tab was tabbed out / blurred for too long (e.g. > 15s total)
    // they might be utilizing script assistance, screenshot solvers, or cheating tools
    if (totalBlurTimeMs > 15000) {
      status = 'cheated';
      cheatReason = 'Browser tab lost focus for an excessive duration (>15 seconds).';
    }

    // Apply network latency buffer of 200ms (we calculate total time server-side directly,
    // so network latency naturally adds to their score, which is secure. No deduction,
    // but we log it correctly)
    const finalScoreMs = Math.round(serverTimeMs);

    console.log(`[Anti-Cheat Debug] User ${req.user.username} finished. Elapsed: ${finalScoreMs}ms. Blur time: ${totalBlurTimeMs}ms. Status: ${status}.`);

    // 3. Register final scores in database
    await db.query(
      `UPDATE public.contest_participants 
       SET ended_at = $1, total_time_ms = $2, status = $3 
       WHERE contest_id = $4 AND user_id = $5`,
      [endedAtTime.toISOString(), finalScoreMs, status, contestId, req.user.id]
    );

    // 4. Check if the contest is ready to be finalized
    // We auto-finalize if all slots are filled AND all participants have completed/cheated
    const contestResult = await db.query(
      'SELECT status, total_slots, filled_slots FROM public.contests WHERE id = $1',
      [contestId]
    );
    const contest = contestResult.rows[0];

    let contestFinalized = false;
    let winnerName = null;

    if (contest && contest.filled_slots >= contest.total_slots) {
      // Check count of players who finished
      const finishesResult = await db.query(
        `SELECT COUNT(*) as count 
         FROM public.contest_participants 
         WHERE contest_id = $1 AND status != 'pending'`,
        [contestId]
      );
      
      const finishedCount = parseInt(finishesResult.rows[0].count);
      
      if (finishedCount >= contest.total_slots) {
        // Evaluate Winner!
        const leaderboardResult = await db.query(
          `SELECT cp.user_id, cp.total_time_ms, pr.username
           FROM public.contest_participants cp
           JOIN public.profiles pr ON cp.user_id = pr.id
           WHERE cp.contest_id = $1 AND cp.status = 'completed'
           ORDER BY cp.total_time_ms ASC
           LIMIT 1`,
          [contestId]
        );

        if (leaderboardResult.rows.length > 0) {
          const winner = leaderboardResult.rows[0];
          
          // Set contest winner
          await db.query(
            "UPDATE public.contests SET status = 'completed', winner_id = $1 WHERE id = $2",
            [winner.user_id, contestId]
          );
          
          contestFinalized = true;
          winnerName = winner.username;
          console.log(`🏆 Contest ${contestId} finalized! Winner: ${winnerName} (${winner.total_time_ms}ms)`);
        } else {
          // If everyone cheated or failed to submit a clean score
          await db.query(
            "UPDATE public.contests SET status = 'cancelled' WHERE id = $2",
            [contestId]
          );
          console.log(`Contest ${contestId} cancelled because no participants had a clean 'completed' status.`);
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

// REFUND ROUTE (Admin/Cancellation logic: Refunds full standard credits to participants)
router.post('/refund/:contestId', authenticateToken, async (req, res) => {
  const { contestId } = req.params;

  try {
    // 1. Verify user is admin
    const profileResult = await db.query(
      'SELECT role FROM public.profiles WHERE id = $1',
      [req.user.id]
    );

    if (profileResult.rows.length === 0 || profileResult.rows[0].role !== 'admin') {
      return res.status(403).json({ error: 'Admin permissions required to refund contests' });
    }

    // 2. Fetch contest slots cost and status
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

    // 3. Find participants to refund
    const participants = await db.query(
      'SELECT user_id FROM public.contest_participants WHERE contest_id = $1',
      [contestId]
    );

    if (participants.rows.length > 0) {
      if (db.isMock) {
        // Process in mock database
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
      } else {
        // Postgres transaction
        await db.query('BEGIN');
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
        await db.query('COMMIT');
      }
    }

    // Update contest status to cancelled
    await db.query(
      "UPDATE public.contests SET status = 'cancelled' WHERE id = $1",
      [contestId]
    );

    return res.json({
      success: true,
      message: `Contest successfully cancelled and fully refunded. Refunded ${participants.rows.length} participants with ${refundAmount} credits each.`
    });

  } catch (error) {
    if (!db.isMock) {
      await db.query('ROLLBACK');
    }
    console.error('Refund contest error:', error);
    return res.status(500).json({ error: 'Refund transaction failed: ' + error.message });
  }
});

module.exports = router;
