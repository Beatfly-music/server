// authMiddleware.js
const jwt = require('jsonwebtoken');

const authenticate = (req, res, next) => {
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
    next();
  } catch (error) {
    console.error('Authentication error:', error);
    return res.status(401).json({ error: 'Invalid token' });
  }
};

module.exports = authenticate;
