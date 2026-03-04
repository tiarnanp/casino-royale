const jwt = require('jsonwebtoken');

const SECRET = process.env.JWT_SECRET || 'vaultbet-dev-secret-change-in-production';

/**
 * Signs a JWT for a given username.
 * Expires in 7 days so users stay logged in.
 */
function signToken(username) {
  return jwt.sign({ username }, SECRET, { expiresIn: '7d' });
}

/**
 * Express middleware — reads the Bearer token from the Authorization header
 * OR from an HttpOnly cookie named `token`.
 * Attaches req.user = { username } on success.
 */
function verifyToken(req, res, next) {
  // 1. Try Authorization: Bearer <token>
  const header = req.headers['authorization'];
  const fromHeader = header && header.startsWith('Bearer ') ? header.slice(7) : null;

  // 2. Try cookie (set by login route)
  const fromCookie = req.cookies?.token || null;

  const token = fromHeader || fromCookie;

  if (!token) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const payload = jwt.verify(token, SECRET);
    req.user = { username: payload.username };
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

module.exports = { signToken, verifyToken };
