const express      = require('express');
const cors         = require('cors');
const helmet       = require('helmet');
const cookieParser = require('cookie-parser');
const path         = require('path');

const authRoutes           = require('./routes/auth');
const balanceRoutes        = require('./routes/balance');
const gameRoutes           = require('./routes/games');
const { router: adminRoutes } = require('./routes/admin');
const { verifyToken }      = require('./middleware/auth');

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(cookieParser());

// Static files
app.use(express.static(path.join(__dirname, '../public')));

// API
app.use('/api/auth',    authRoutes);
app.use('/api/balance', verifyToken, balanceRoutes);
app.use('/api/games',   verifyToken, gameRoutes);
app.use('/api/admin',   adminRoutes);

// Admin dashboard page
app.get('/admin', (_req, res) =>
  res.sendFile(path.join(__dirname, '../public/admin.html'))
);

app.get('/api/ping', (_req, res) => res.json({ ok: true, ts: Date.now() }));

// SPA fallback
app.get('*', (_req, res) =>
  res.sendFile(path.join(__dirname, '../public/index.html'))
);

app.listen(PORT, () => {
  console.log(`\n  ♠  Casino Royale → http://localhost:${PORT}`);
  console.log(`  ♦  Admin panel   → http://localhost:${PORT}/admin\n`);
});
