const jwt = require('jsonwebtoken');
const { getKey } = require('../utils/encryption');

const JWT_SECRET = process.env.JWT_SECRET || 'budget-app-secret-key-change-in-production';

function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.userId;
    req.encryptionKey = getKey(decoded.userId) || null;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

module.exports = { authenticate, JWT_SECRET };
