const jwt = require('jsonwebtoken');

const verify = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token provided' });
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
};

const authenticateUser = (req, res, next) => {
  verify(req, res, () => {
    if (req.user.role !== 'user') return res.status(403).json({ error: 'Access denied. Users only.' });
    next();
  });
};

const authenticateAdmin = (req, res, next) => {
  verify(req, res, () => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Access denied. Admins only.' });
    next();
  });
};

module.exports = verify;
module.exports.authenticateUser  = authenticateUser;
module.exports.authenticateAdmin = authenticateAdmin;
