/**
 * db.js — Per-user JSON file storage
 * Each user gets their own file: data/users/<username>.json
 */
const fs   = require('fs');
const path = require('path');

const USERS_DIR  = path.join(__dirname, '../../data/users');
const ADMIN_FILE = path.join(__dirname, '../../data/admin.json');

function ensureDir() {
  if (!fs.existsSync(USERS_DIR)) fs.mkdirSync(USERS_DIR, { recursive: true });
}

function userPath(username) {
  // Sanitize: only allow alphanumeric + underscore to prevent path traversal
  const safe = username.replace(/[^a-zA-Z0-9_]/g, '');
  return path.join(USERS_DIR, `${safe}.json`);
}

function readUser(username) {
  ensureDir();
  const p = userPath(username);
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function writeUser(username, data) {
  ensureDir();
  fs.writeFileSync(userPath(username), JSON.stringify(data, null, 2));
}

function listUsers() {
  ensureDir();
  return fs.readdirSync(USERS_DIR)
    .filter(f => f.endsWith('.json'))
    .map(f => {
      try { return JSON.parse(fs.readFileSync(path.join(USERS_DIR, f), 'utf8')); }
      catch { return null; }
    })
    .filter(Boolean);
}

module.exports = {
  userExists(username) { return !!readUser(username); },

  getUser(username) { return readUser(username); },

  createUser({ username, email, passwordHash }) {
    const user = {
      username,
      email,
      passwordHash,
      balance: 1000,
      isAdmin: false,
      createdAt: Date.now(),
      lastSeen: Date.now(),
      lastGame: null,
      // Balance history: array of { ts, balance, delta, game, note }
      balanceHistory: [{ ts: Date.now(), balance: 1000, delta: 0, game: 'signup', note: 'Starting balance' }],
      // Game log: last 200 rounds
      gameLog: [],
    };
    writeUser(username, user);
    return user;
  },

  touchUser(username) {
    const u = readUser(username);
    if (u) { u.lastSeen = Date.now(); writeUser(username, u); }
  },

  setLastGame(username, game) {
    const u = readUser(username);
    if (u) { u.lastGame = game; u.lastSeen = Date.now(); writeUser(username, u); }
  },

  getBalance(username) {
    const u = readUser(username);
    return u ? u.balance : 0;
  },

  setBalance(username, amount) {
    const u = readUser(username);
    if (!u) throw new Error('User not found');
    const delta = amount - u.balance;
    u.balance = Math.max(0, Math.round(amount));
    writeUser(username, u);
    return u.balance;
  },

  adjustBalance(username, delta, game = 'unknown', note = '') {
    const u = readUser(username);
    if (!u) throw new Error('User not found');
    const oldBal = u.balance;
    u.balance = Math.max(0, Math.round(u.balance + delta));
    const entry = { ts: Date.now(), balance: u.balance, delta: Math.round(delta), game, note };
    u.balanceHistory.push(entry);
    // Keep last 1000 entries
    if (u.balanceHistory.length > 1000) u.balanceHistory = u.balanceHistory.slice(-1000);
    u.lastGame = game;
    u.lastSeen = Date.now();
    writeUser(username, u);
    return u.balance;
  },

  logGame(username, { game, bet, outcome, payout, serverSeed, clientSeed, nonce, result }) {
    const u = readUser(username);
    if (!u) return;
    const entry = {
      id: Date.now() + '_' + Math.random().toString(36).slice(2,7),
      ts: Date.now(),
      game, bet, outcome, payout, serverSeed, clientSeed, nonce, result
    };
    u.gameLog.unshift(entry);
    if (u.gameLog.length > 200) u.gameLog = u.gameLog.slice(0, 200);
    writeUser(username, u);
    return entry;
  },

  getBalanceHistory(username) {
    const u = readUser(username);
    return u ? u.balanceHistory : [];
  },

  getGameLog(username, limit = 50) {
    const u = readUser(username);
    return u ? u.gameLog.slice(0, limit) : [];
  },

  getAllUsers() { return listUsers(); },

  // Admin
  getAdmin() {
    if (!fs.existsSync(ADMIN_FILE)) return null;
    return JSON.parse(fs.readFileSync(ADMIN_FILE, 'utf8'));
  },

  createAdmin(passwordHash) {
    fs.writeFileSync(ADMIN_FILE, JSON.stringify({ passwordHash, createdAt: Date.now() }, null, 2));
  },
};
