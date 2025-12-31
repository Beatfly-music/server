const pool = require('../utils/db');

const ADMIN_IDS = (process.env.ADMIN_IDS || '')
  .split(',')
  .map(id => parseInt(id, 10))
  .filter(id => !Number.isNaN(id));

const requireAdmin = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const [rows] = await pool.query('SELECT is_admin FROM users WHERE id = ?', [userId]);
    const dbAdmin = rows.length ? rows[0].is_admin === 1 : false;
    const isAdmin = dbAdmin || ADMIN_IDS.includes(Number(userId));

    if (!isAdmin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    req.isAdmin = true;
    next();
  } catch (err) {
    console.error('Admin check failed:', err);
    res.status(500).json({ error: 'Failed to verify admin privileges' });
  }
};

module.exports = requireAdmin;
