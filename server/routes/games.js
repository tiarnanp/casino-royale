/**
 * games.js — Provably fair game endpoints
 * Each game: POST /api/games/:game/play
 * Verify:    POST /api/games/verify
 */
const express = require('express');
const db      = require('../db');
const pf      = require('../provablyFair');
const router  = express.Router();

// GET new seeds for a session
router.get('/seeds', (req, res) => {
  const { serverSeed, serverSeedHash } = pf.generateServerSeed();
  // Store serverSeed in session (in production use Redis; here we send encrypted)
  // We'll use a simple approach: sign the serverSeed with JWT secret
  const jwt = require('jsonwebtoken');
  const SECRET = process.env.JWT_SECRET || 'vaultbet-dev-secret-change-in-production';
  const token = jwt.sign({ serverSeed }, SECRET, { expiresIn: '1h' });
  res.json({ serverSeedHash, seedToken: token });
});

// POST /api/games/play — unified game endpoint
router.post('/play', (req, res) => {
  const { game, bet, clientSeed, nonce, seedToken, extraData } = req.body;
  const username = req.user.username;
  const balance  = db.getBalance(username);

  if (!bet || bet <= 0)          return res.status(400).json({ error: 'Invalid bet.' });
  if (bet > balance)             return res.status(400).json({ error: 'Insufficient balance.' });
  if (bet > 50000)               return res.status(400).json({ error: 'Max bet is 50,000.' });

  // Recover serverSeed from token
  const jwt    = require('jsonwebtoken');
  const SECRET = process.env.JWT_SECRET || 'vaultbet-dev-secret-change-in-production';
  let serverSeed;
  try {
    const payload = jwt.verify(seedToken, SECRET);
    serverSeed = payload.serverSeed;
  } catch {
    // Generate fresh seed if token missing/expired
    serverSeed = require('crypto').randomBytes(32).toString('hex');
  }

  const cs     = clientSeed || 'default';
  const n      = nonce || 1;
  const result = pf.getResult(game, serverSeed, cs, n);
  const serverSeedHash = require('crypto').createHash('sha256').update(serverSeed).digest('hex');

  // Calculate payout per game
  let payout = 0;
  let outcome = 'lose';

  if (game === 'dice') {
    const { target = 50, direction = 'under' } = extraData || {};
    const roll = result.roll;
    const win  = direction === 'under' ? roll < target : roll > target;
    if (win) {
      const chance = direction === 'under' ? target : 100 - target;
      payout  = +(bet * (98 / chance)).toFixed(2);
      outcome = 'win';
    }
    result.target = target; result.direction = direction;
  }

  else if (game === 'crash') {
    const { cashoutAt } = extraData || {};
    const crashAt = result.multiplier;
    if (cashoutAt && cashoutAt <= crashAt) {
      payout  = +(bet * cashoutAt).toFixed(2);
      outcome = 'win';
    }
    result.crashAt = crashAt; result.cashoutAt = cashoutAt;
  }

  else if (game === 'roulette') {
    const { betType, betValue } = extraData || {};
    const num = result.number;
    const red = [1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36];
    let mult  = 0;
    if (betType === 'straight' && betValue === num)          mult = 36;
    else if (betType === 'red'   && red.includes(num) && num > 0)    mult = 2;
    else if (betType === 'black' && !red.includes(num) && num > 0)   mult = 2;
    else if (betType === 'even'  && num > 0 && num % 2 === 0)        mult = 2;
    else if (betType === 'odd'   && num % 2 === 1)                   mult = 2;
    else if (betType === 'low'   && num >= 1 && num <= 18)           mult = 2;
    else if (betType === 'high'  && num >= 19 && num <= 36)          mult = 2;
    if (mult > 0) { payout = bet * mult; outcome = 'win'; }
    result.betType = betType; result.betValue = betValue;
  }

  else if (game === 'slots') {
    const [a, b, c] = result.reels;
    if (a === b && b === c) {
      const mults = { '💎': 50, '7️⃣': 20, '⭐': 10, '🍊': 5, '🍋': 3, '🍒': 2 };
      payout  = bet * (mults[a] || 2);
      outcome = 'win';
    } else if (a === b || b === c || a === c) {
      payout  = bet * 1.5;
      outcome = 'win';
    }
  }

  // Apply balance change
  const delta = payout - bet;
  const newBalance = db.adjustBalance(username, delta, game,
    outcome === 'win' ? `Won ◈${payout}` : `Lost ◈${bet}`);

  // Log game round
  const logEntry = db.logGame(username, {
    game, bet, outcome, payout, result,
    serverSeed, serverSeedHash, clientSeed: cs, nonce: n,
  });

  res.json({
    outcome, payout, newBalance, result,
    serverSeedHash,
    roundId: logEntry?.id,
    verification: { serverSeedHash, clientSeed: cs, nonce: n },
  });
});

// POST /api/games/verify — verify any past round
router.post('/verify', (req, res) => {
  const { serverSeed, serverSeedHash, clientSeed, nonce, game } = req.body;
  if (!serverSeed || !serverSeedHash || !clientSeed) {
    return res.status(400).json({ error: 'serverSeed, serverSeedHash, and clientSeed required.' });
  }
  const hashValid = pf.verifyHash(serverSeed, serverSeedHash);
  const result    = pf.getResult(game || 'dice', serverSeed, clientSeed, nonce || 1);
  res.json({ hashValid, result, message: hashValid ? '✓ Seed is authentic' : '✗ Hash mismatch — game was tampered with' });
});

// GET /api/games/log — player's game history
router.get('/log', (req, res) => {
  const log = db.getGameLog(req.user.username, 100);
  res.json({ log });
});

module.exports = router;
