const jwt = require('jsonwebtoken');

const verify = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'No authorization token provided',
      error: 'No token provided'
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    if (typeof next === 'function') {
      return next();
    }
  } catch (err) {
    return res.status(401).json({
      success: false,
      message: 'Invalid or expired authorization token: ' + err.message,
      error: 'Invalid token'
    });
  }
};

const authenticateUser = (req, res, next) => {
  verify(req, res, () => {
    if (req.user?.role !== 'user') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. User role required.',
        error: 'Access denied. Users only.'
      });
    }
    if (typeof next === 'function') {
      return next();
    }
  });
};

const authenticateAdmin = (req, res, next) => {
  verify(req, res, () => {
    if (req.user?.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin role required.',
        error: 'Access denied. Admins only.'
      });
    }
    if (typeof next === 'function') {
      return next();
    }
  });
};

module.exports = verify;
module.exports.authenticateUser  = authenticateUser;
module.exports.authenticateAdmin = authenticateAdmin;
