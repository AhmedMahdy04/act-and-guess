const { authenticate } = require('../services/adminService');

async function adminAuth(req, res, next) {
  const match = req.headers.authorization?.match(/^Bearer (\S+)$/i);
  if (!match) return res.status(401).json({ error: 'Sign in to continue.' });

  try {
    const session = await authenticate(match[1]);
    if (!session) return res.status(401).json({ error: 'Your session expired. Sign in again.' });
    req.admin = session.admin;
    req.adminSessionKey = session.key;
    next();
  } catch (error) {
    next(error);
  }
}

function requireHeadAdmin(req, res, next) {
  if (!req.admin.isHeadAdmin) {
    return res.status(403).json({ error: 'Head admin access is required.' });
  }
  next();
}

module.exports = { adminAuth, requireHeadAdmin };
