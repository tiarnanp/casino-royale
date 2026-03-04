const express = require('express');
const db      = require('../db');
const router  = express.Router();

router.get('/', (req, res) => {
  res.json({ balance: db.getBalance(req.user.username) });
});

router.post('/adjust', (req, res) => {
  const { delta, game, note } = req.body;
  if (typeof delta !== 'number' || isNaN(delta)) return res.status(400).json({ error: 'delta must be a number.' });
  if (Math.abs(delta) > 100_000) return res.status(400).json({ error: 'Adjustment out of range.' });
  try {
    const balance = db.adjustBalance(req.user.username, delta, game || 'unknown', note || '');
    res.json({ balance });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/history', (req, res) => {
  res.json({ history: db.getBalanceHistory(req.user.username) });
});

router.get('/gamelog', (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 50, 200);
  res.json({ log: db.getGameLog(req.user.username, limit) });
});

module.exports = router;
