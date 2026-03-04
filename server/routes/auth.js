const express  = require('express');
const bcrypt   = require('bcryptjs');
const db       = require('../db');
const { signToken, verifyToken } = require('../middleware/auth');

const router = express.Router();
const SALT_ROUNDS = 12;

router.post('/signup', async (req, res) => {
  const { username, email, password } = req.body;
  if (!username || !email || !password) return res.status(400).json({ error: 'All fields required.' });
  if (username.length < 3 || username.length > 20) return res.status(400).json({ error: 'Username must be 3–20 characters.' });
  if (!/^[a-zA-Z0-9_]+$/.test(username)) return res.status(400).json({ error: 'Username: letters, numbers, underscores only.' });
  if (password.length < 6) return res.status(400).json({ error: 'Password must be 6+ characters.' });
  if (!/\S+@\S+\.\S+/.test(email)) return res.status(400).json({ error: 'Invalid email address.' });
  if (db.userExists(username)) return res.status(409).json({ error: 'Username already taken.' });

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  const user = db.createUser({ username, email, passwordHash });
  const token = signToken(username);
  setTokenCookie(res, token);
  return res.status(201).json({ message: 'Account created!', user: safeUser(user), token });
});

router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Username and password required.' });
  const user = db.getUser(username);
  if (!user) return res.status(401).json({ error: 'Invalid username or password.' });
  const match = await bcrypt.compare(password, user.passwordHash);
  if (!match) return res.status(401).json({ error: 'Invalid username or password.' });
  db.touchUser(username);
  const token = signToken(username);
  setTokenCookie(res, token);
  return res.json({ message: 'Logged in.', user: safeUser(user), token });
});

router.post('/logout', (_req, res) => {
  res.clearCookie('token');
  res.json({ message: 'Logged out.' });
});

router.get('/me', verifyToken, (req, res) => {
  const user = db.getUser(req.user.username);
  if (!user) return res.status(404).json({ error: 'User not found.' });
  res.json(safeUser(user));
});

function setTokenCookie(res, token) {
  res.cookie('token', token, {
    httpOnly: true, sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
    secure: process.env.NODE_ENV === 'production',
  });
}

function safeUser(u) {
  return { username: u.username, email: u.email, balance: u.balance, isAdmin: u.isAdmin, createdAt: u.createdAt };
}

module.exports = router;
