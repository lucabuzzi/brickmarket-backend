const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const contestRepository = require('../repositories/contestRepository');
const { uploadOrSaveProcessedImage } = require('../services/image');

const JWT_SECRET = process.env.JWT_SECRET || 'clutchvault_secret_key_1337';

async function listContestsHandler(req, res) {
  try {
    const rows = await contestRepository.listOpenContests();
    const contests = rows.map((row) => ({
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
      winnerId: row.winner_id,
    }));
    return res.json({ contests });
  } catch (error) {
    console.error('Fetch contests error:', error);
    return res.status(500).json({ error: 'Database error fetching contests' });
  }
}

async function buySlotHandler(req, res) {
  const { contestId } = req.body;
  if (!contestId) {
    return res.status(400).json({ error: 'contestId is required.' });
  }

  try {
    const contest = await contestRepository.getSlotCost(contestId);
    if (!contest) {
      return res.status(404).json({ error: 'Contest not found.' });
    }

    const slotCost = parseFloat(contest.slot_cost_credits);
    const callResult = await contestRepository.buySlot(req.user.id, contestId, slotCost, req.user.username);

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
          contestStatus: callResult.contest_status,
        },
      });
    }

    return res.json({
      success: true,
      message: callResult.message,
      newBalance: parseFloat(callResult.new_balance),
      filledSlots: callResult.filled_slots,
      contestStatus: callResult.contest_status,
    });
  } catch (error) {
    console.error('Buy contest slot error:', error);
    return res.status(500).json({ error: 'Transaction failed: ' + error.message });
  }
}

async function leaderboardHandler(req, res) {
  const { contestId } = req.params;
  try {
    const rows = await contestRepository.getLeaderboard(contestId);
    const leaderboard = rows.map((row) => ({
      id: row.id,
      contestId: row.contest_id,
      userId: row.user_id,
      username: row.username,
      startedAt: row.started_at,
      endedAt: row.ended_at,
      totalTimeMs: row.total_time_ms,
      status: row.status,
    }));
    return res.json({ leaderboard });
  } catch (error) {
    console.error('Fetch leaderboard error:', error);
    return res.status(500).json({ error: 'Database error fetching leaderboard' });
  }
}

async function startAttemptHandler(req, res) {
  const { contestId } = req.body;
  if (!contestId) {
    return res.status(400).json({ error: 'contestId is required.' });
  }

  try {
    const participant = await contestRepository.findUnstartedParticipant(contestId, req.user.id);
    if (!participant) {
      return res.status(403).json({ error: 'You are not registered in this contest. Buy a slot first.' });
    }

    const { id: participantId, status } = participant;
    if (status !== 'pending') {
      return res.status(400).json({ error: `You have already completed or voided this attempt. Status: ${status}` });
    }

    const startedAt = new Date().toISOString();
    await contestRepository.markParticipantStarted(participantId, startedAt);

    const attemptToken = jwt.sign(
      { userId: req.user.id, contestId, participantId, startedAt },
      process.env.JWT_SECRET || JWT_SECRET,
      { expiresIn: '15m' }
    );

    return res.json({
      success: true,
      message: 'Contest attempt started! Puzzle timer is ticking.',
      attemptToken,
    });
  } catch (error) {
    console.error('Start contest attempt error:', error);
    return res.status(500).json({ error: 'Database error starting attempt: ' + error.message });
  }
}

async function completeAttemptHandler(req, res) {
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
      await contestRepository.voidInFlightAttempt(contestId, req.user.id);
      return res.status(400).json({
        error: 'Invalid or expired attempt token. Entry marked as void/cheated.',
        cheated: true,
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

    await contestRepository.completeParticipant(decoded.participantId, endedAtTime.toISOString(), finalScoreMs, status);

    const contest = await contestRepository.getContestSlots(contestId);

    let contestFinalized = false;
    let winnerName = null;

    if (contest && contest.filled_slots >= contest.total_slots) {
      const finishedCount = await contestRepository.countFinishedParticipants(contestId);

      if (finishedCount >= contest.total_slots) {
        const winner = await contestRepository.getFastestCompletedParticipant(contestId);

        if (winner) {
          await contestRepository.finalizeContestWinner(contestId, winner.user_id);
          contestFinalized = true;
          winnerName = winner.username;
          console.log(`🏆 Contest ${contestId} finalized! Winner: ${winnerName}`);
        } else {
          await contestRepository.cancelContest(contestId);
        }
      }
    }

    return res.json({
      success: true,
      message: status === 'cheated' ? `Submission processed. Cheat detected: ${cheatReason}` : 'Attempt registered successfully!',
      status,
      timeMs: finalScoreMs,
      contestFinalized,
      winnerName,
    });
  } catch (error) {
    console.error('Complete attempt error:', error);
    return res.status(500).json({ error: 'Database error processing completion: ' + error.message });
  }
}

async function refundContestHandler(req, res) {
  const { contestId } = req.params;
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin permissions required to refund contests' });
    }

    const contest = await contestRepository.getContestForRefund(contestId);
    if (!contest) {
      return res.status(404).json({ error: 'Contest not found' });
    }

    const { status, slot_cost_credits } = contest;
    if (status === 'completed' || status === 'cancelled') {
      return res.status(400).json({ error: `Cannot refund contest which is already ${status}` });
    }

    const refundAmount = parseFloat(slot_cost_credits);
    const participants = await contestRepository.getContestParticipantUserIds(contestId);

    for (const row of participants) {
      await contestRepository.refundParticipant(row.user_id, refundAmount, contestId);
    }

    await contestRepository.cancelContest(contestId);

    return res.json({
      success: true,
      message: `Contest cancelled. Refunded ${participants.length} participants with ${refundAmount} credits each.`,
    });
  } catch (error) {
    console.error('Refund contest error:', error);
    return res.status(500).json({ error: 'Refund transaction failed: ' + error.message });
  }
}

// POST /api/contest/create - Create a new timed jigsaw contest (Admin only)
async function createContestHandler(req, res) {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin permissions required to create contests.' });
    }

    const {
      title, description, category, marketValue,
      slotCostCredits, condition, gradingInfo, totalSlots = 5,
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

    await contestRepository.createContestProduct({
      contestId: newContestId,
      productId: newProductId,
      title,
      description,
      imageUrl,
      category,
      marketValue,
      condition,
      gradingInfo,
      totalSlots,
      slotCostCredits,
    });

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
          status: 'open',
        },
      });
    }

    return res.json({
      success: true,
      message: 'Jigsaw puzzle contest uploaded and registered successfully!',
      contestId: newContestId,
    });
  } catch (err) {
    console.error('Create contest error:', err);
    return res.status(500).json({ error: 'Failed to create contest: ' + err.message });
  }
}

module.exports = {
  listContestsHandler,
  buySlotHandler,
  leaderboardHandler,
  startAttemptHandler,
  completeAttemptHandler,
  refundContestHandler,
  createContestHandler,
};
