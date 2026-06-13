const jwt = require('jsonwebtoken');
const config = require('../config');

module.exports = function verifyToken(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }

  const token = authHeader.slice(7);
  try {
    // 1. Try agent secret
    const payload = jwt.verify(token, config.jwt.secret);
    req.user = payload;
    return next();
  } catch (err) {
    try {
      // 2. Try customer invite secret
      const payload = jwt.verify(token, config.jwt.inviteSecret);
      req.user = {
        role: 'customer',
        name: 'Customer',
        ...payload
      };
      return next();
    } catch (inviteErr) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
  }
};
