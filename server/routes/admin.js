const express = require('express');
const bcrypt  = require('bcryptjs');
const db      = require('../db');
const { signToken } = require('../middleware/auth');

const router = express.Router();
const ADMIN_SECRET = process.env.ADMIN_PASSWORD || 'admin1234';

// POST /api/admin/login
router.post('/login', async (req, res) => {
  const { password } = req.body;
  if (!password) return res.status(400).json({ error: 'Password required.' });
  if (password !== ADMIN_SECRET) return res.status(401).json({ error: 'Invalid admin password.' });
  const token = signToken('__admin__');
  res.cookie('admin_token', token, { httpOnly: true, sameSite: 'lax', maxAge: 4 * 60 * 60 * 1000 });
  res.json({ ok: true });
});

// Middleware: verify admin token
function adminAuth(req, res, next) {
  const jwt    = require('jsonwebtoken');
  const SECRET = process.env.JWT_SECRET || 'vaultbet-dev-secret-change-in-production';
  const token  = req.cookies?.admin_token;
  if (!token) return res.status(401).json({ error: 'Not authenticated as admin.' });
  try { jwt.verify(token, SECRET); next(); }
  catch { res.status(401).json({ error: 'Invalid admin token.' }); }
}

// GET /api/admin/players — all players with live data
router.get('/players', adminAuth, (req, res) => {
  const users = db.getAllUsers().map(u => ({
    username:  u.username,
    email:     u.email,
    balance:   u.balance,
    lastSeen:  u.lastSeen,
    lastGame:  u.lastGame,
    createdAt: u.createdAt,
    totalRounds: u.gameLog?.length || 0,
    recentActivity: u.gameLog?.slice(0, 5) || [],
  }));
  res.json({ players: users });
});

// GET /api/admin/player/:username — single player detail
router.get('/player/:username', adminAuth, (req, res) => {
  const user = db.getUser(req.params.username);
  if (!user) return res.status(404).json({ error: 'User not found.' });
  res.json({
    username: user.username, email: user.email, balance: user.balance,
    createdAt: user.createdAt, lastSeen: user.lastSeen, lastGame: user.lastGame,
    balanceHistory: user.balanceHistory,
    gameLog: user.gameLog?.slice(0, 100) || [],
  });
});

// POST /api/admin/balance — edit a player's balance
router.post('/balance', adminAuth, (req, res) => {
  const { username, amount, note } = req.body;
  if (!username || typeof amount !== 'number') return res.status(400).json({ error: 'username and amount required.' });
  if (!db.userExists(username)) return res.status(404).json({ error: 'User not found.' });
  try {
    const current = db.getBalance(username);
    const delta   = amount - current;
    const balance = db.adjustBalance(username, delta, 'admin', note || 'Admin adjustment');
    res.json({ balance, message: `Balance set to ◈${balance}` });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE /api/admin/player/:username — remove player
router.delete('/player/:username', adminAuth, (req, res) => {
  const fs   = require('fs');
  const path = require('path');
  const file = path.join(__dirname, '../../../data/users', `${req.params.username}.json`);
  if (!fs.existsSync(file)) return res.status(404).json({ error: 'User not found.' });
  fs.unlinkSync(file);
  res.json({ message: `${req.params.username} deleted.` });
});

module.exports = { router, adminAuth };
