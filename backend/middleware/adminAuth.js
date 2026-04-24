const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.ADMIN_JWT_SECRET || 'dev-admin-secret-change-me';

function adminAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized. No token provided.' });
  }

  const token = authHeader.slice(7);

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.admin = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Unauthorized. Invalid or expired token.' });
  }
}

function requireHeadAdmin(req, res, next) {
  if (!req.admin?.isHeadAdmin) {
    return res.status(403).json({ error: 'Forbidden. Head admin access required.' });
  }
  next();
}

function signAdminToken(admin) {
  return jwt.sign(
    { id: admin.id, email: admin.email, isHeadAdmin: admin.isHeadAdmin },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

module.exports = { adminAuth, requireHeadAdmin, signAdminToken, JWT_SECRET };

