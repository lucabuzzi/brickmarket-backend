const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const contestRepository = require('../repositories/contestRepository');
const { uploadOrSaveProcessedImage } = require('../services/image');
const { computeGridDimensions, layoutFromStoredGrid, isPieceInPlace } = require('../services/puzzleGeometry');

// Naive-automation deterrent, not a cryptographic guarantee: a script could
// still pace itself above this floor. Set low enough (50ms) that no genuine
// drag-release-then-grab-next-piece sequence could ever trip it — a real
// player's fastest realistic gap between two locks is at minimum a few
// hundred ms. A violation is a soft reject (the lock isn't recorded, the
// attempt isn't voided) precisely to avoid disqualifying a real winner over
// a timing edge case; consistently missing locks is what actually keeps
// them from reaching the 30/30 completeAttemptHandler requires.
const MIN_MS_BETWEEN_PIECE_LOCKS = 50;

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
  const { contestId, isPortrait } = req.body;
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

    // The client tells us the board's orientation (it already knows the
    // puzzle image's aspect ratio) — this only picks WHICH of the two fixed
    // grid shapes (5x6 or 6x5, always 30 pieces) applies, both equally
    // "hard" to satisfy, so trusting it here doesn't open a shortcut. Once
    // stored, it's what every subsequent lock-piece/complete call for this
    // attempt is checked against — the client can't change its mind later.
    const { gridRows, gridCols } = computeGridDimensions(!!isPortrait);

    const startedAt = new Date().toISOString();
    await contestRepository.markParticipantStarted(participantId, startedAt, gridRows, gridCols);

    const attemptToken = jwt.sign(
      { userId: req.user.id, contestId, participantId, startedAt },
      process.env.JWT_SECRET || JWT_SECRET,
      { expiresIn: '15m' }
    );

    return res.json({
      success: true,
      message: 'Contest attempt started! Puzzle timer is ticking.',
      attemptToken,
      gridRows,
      gridCols,
    });
  } catch (error) {
    console.error('Start contest attempt error:', error);
    return res.status(500).json({ error: 'Database error starting attempt: ' + error.message });
  }
}

// Verifies the anti-cheat JWT and that the decoded attempt is still the
// caller's own in-progress one. Shared by lockPieceHandler and
// completeAttemptHandler so both apply exactly the same checks.
function verifyAttemptToken(attemptToken, userId, contestId) {
  const decoded = jwt.verify(attemptToken, process.env.JWT_SECRET || JWT_SECRET);
  if (decoded.userId !== userId || decoded.contestId !== contestId) {
    throw new Error('Attempt token verification mismatch.');
  }
  return decoded;
}

// Called once per piece, in real time, as the player locks it in the UI
// (client/src/components/JigsawPuzzle.jsx's onPieceLocked) — this is the
// actual proof of play: the server independently recomputes where piece
// `pieceId` belongs from the grid dimensions decided at /start, and only
// records it if the submitted x/y/rotation genuinely match. completeAttemptHandler
// then just checks that all of them arrived this way.
async function lockPieceHandler(req, res) {
  const { contestId, attemptToken, pieceId, x, y, rotation } = req.body;
  if (!contestId || !attemptToken || pieceId === undefined || x === undefined || y === undefined || rotation === undefined) {
    return res.status(400).json({ error: 'contestId, attemptToken, pieceId, x, y and rotation are required.' });
  }

  let decoded;
  try {
    decoded = verifyAttemptToken(attemptToken, req.user.id, contestId);
  } catch (err) {
    return res.status(400).json({ error: 'Invalid or expired attempt token.' });
  }

  try {
    const participant = await contestRepository.getParticipantById(decoded.participantId);
    if (!participant || participant.status !== 'pending' || !participant.started_at) {
      return res.status(400).json({ error: 'This attempt is not in progress.' });
    }

    const layout = layoutFromStoredGrid(participant.grid_rows, participant.grid_cols);
    const totalPieces = layout.gridRows * layout.gridCols;
    const numericPieceId = Number(pieceId);

    if (!Number.isInteger(numericPieceId) || numericPieceId < 0 || numericPieceId >= totalPieces
      || !isPieceInPlace(numericPieceId, Number(x), Number(y), Number(rotation), layout)) {
      // A piece that doesn't match its real target isn't a timing edge case
      // or a network hiccup — the only way to submit one is by not actually
      // having the client's own snap logic produce it, so this fails closed.
      await contestRepository.markParticipantCheated(participant.id);
      console.warn(`Anti-Cheat Alert: invalid piece submission for participant ${participant.id} (piece ${pieceId}).`);
      return res.status(400).json({ error: 'Invalid piece position.', cheated: true });
    }

    const lastLockTime = await contestRepository.getMostRecentPieceLockTime(participant.id);
    const now = new Date();
    const sinceLast = lastLockTime ? now.getTime() - new Date(lastLockTime).getTime() : null;
    if (sinceLast !== null && sinceLast < MIN_MS_BETWEEN_PIECE_LOCKS) {
      // Soft reject — see MIN_MS_BETWEEN_PIECE_LOCKS comment above.
      const lockedCount = await contestRepository.countDistinctPieceLocks(participant.id);
      return res.status(429).json({ error: 'Too fast — piece not recorded.', lockedCount, totalPieces });
    }

    await contestRepository.insertPieceLock(participant.id, numericPieceId, now.toISOString());
    const lockedCount = await contestRepository.countDistinctPieceLocks(participant.id);

    return res.json({ success: true, lockedCount, totalPieces });
  } catch (error) {
    console.error('Lock piece error:', error);
    return res.status(500).json({ error: 'Database error recording piece: ' + error.message });
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
      decoded = verifyAttemptToken(attemptToken, req.user.id, contestId);
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

    // The real proof of play: every one of the board's pieces must have
    // gone through lockPieceHandler's own independent position check during
    // the attempt — nothing submitted here at completion time is trusted
    // for "was it actually solved" anymore.
    const participant = await contestRepository.getParticipantById(decoded.participantId);
    const totalPieces = (participant?.grid_rows || 0) * (participant?.grid_cols || 0);
    const verifiedLockedCount = participant ? await contestRepository.countDistinctPieceLocks(participant.id) : 0;

    if (status === 'completed' && (totalPieces === 0 || verifiedLockedCount < totalPieces)) {
      status = 'cheated';
      cheatReason = `Only ${verifiedLockedCount}/${totalPieces} pieces were server-verified as locked.`;
    }

    const finalScoreMs = Math.round(serverTimeMs);
    console.log(`[Anti-Cheat Debug] User ${req.user.username} finished. Elapsed: ${finalScoreMs}ms. Verified pieces: ${verifiedLockedCount}/${totalPieces}. Status: ${status}.`);

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
  lockPieceHandler,
  completeAttemptHandler,
  refundContestHandler,
  createContestHandler,
};
