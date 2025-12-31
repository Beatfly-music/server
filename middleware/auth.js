// authMiddleware.js
const jwt = require('jsonwebtoken');
const pool = require('../utils/db');

const authenticate = async (req, res, next) => {
  // Expect the token in the Authorization header as: Bearer <token>
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: 'Authorization header missing' });
  }

  const token = authHeader.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: 'Token missing' });
  }

  try {
    // Verify token (make sure to set JWT_SECRET in your environment)
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // decoded payload should include the user id (e.g., decoded.id)

    // Check if user is banned
    const [banRows] = await pool.query(
      `SELECT reason, expires_at FROM banned_users
       WHERE user_id = ? AND (expires_at IS NULL OR expires_at > NOW())`,
      [decoded.id]
    );

    if (banRows.length > 0) {
      const ban = banRows[0];
      return res.status(403).json({
        error: 'Account banned',
        reason: ban.reason || 'Violation of terms of service',
        expiresAt: ban.expires_at || 'permanent'
      });
    }

    next();
  } catch (error) {
    console.error('Authentication error:', error);
    return res.status(401).json({ error: 'Invalid token' });
  }
};

module.exports = authenticate;
