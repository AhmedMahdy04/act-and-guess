const { createHash, randomBytes } = require('node:crypto');
const bcrypt = require('bcryptjs');
const Admin = require('../models/Admin');
const AdminSession = require('../models/AdminSession');

const CREDENTIAL_VERSION = 2;
const SALT_ROUNDS = 12;
const SESSION_DURATION_MS = 8 * 60 * 60 * 1000;
// Check the same bcrypt cost for an unknown account so login does not disclose its existence.
const dummyPasswordHash = bcrypt.hash(randomBytes(32).toString('hex'), SALT_ROUNDS);
const eligibleAccount = {
  disabledAt: null,
  $or: [{ isHeadAdmin: { $ne: true } }, { credentialVersion: CREDENTIAL_VERSION }]
};

function adminError(message, status = 400) {
  return Object.assign(new Error(message), { status });
}

function normalizeEmail(value) {
  const email = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}

function validPasswordInput(value) {
  return typeof value === 'string' && value.length > 0 && Buffer.byteLength(value) <= 1024;
}

function validateNewPassword(value) {
  if (!validPasswordInput(value) || value.length < 12 || Buffer.byteLength(value) > 72) {
    throw adminError('Use a password of at least 12 characters and at most 72 UTF-8 bytes.');
  }
}

function serializeAdmin(admin) {
  return {
    id: admin._id.toString(),
    email: admin.email,
    isHeadAdmin: Boolean(admin.isHeadAdmin),
    createdAt: admin.createdAt,
    lastLoginAt: admin.lastLoginAt,
    disabledAt: admin.disabledAt
  };
}

async function seedHeadAdmin() {
  const emailValue = process.env.HEAD_ADMIN_EMAIL;
  const password = process.env.HEAD_ADMIN_PASSWORD;
  if (!emailValue && !password) return;
  const email = normalizeEmail(emailValue);

  try {
    if (!email) throw adminError('Set a valid HEAD_ADMIN_EMAIL before bootstrapping the admin account.');
    validateNewPassword(password);
    await Admin.init();

    const head = await Admin.findOne({ isHeadAdmin: true }).lean();
    if (head && head.credentialVersion === CREDENTIAL_VERSION) return;
    if (head && head.email !== email) {
      console.warn('Head admin bootstrap requires the existing head admin email.');
      return;
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    if (head) {
      await Admin.updateOne(
        { _id: head._id, credentialVersion: { $ne: CREDENTIAL_VERSION } },
        { $set: { passwordHash, credentialVersion: CREDENTIAL_VERSION } }
      );
      return;
    }

    await Admin.create({ email, passwordHash, isHeadAdmin: true, credentialVersion: CREDENTIAL_VERSION });
  } catch (error) {
    console.error('Head admin bootstrap failed.', error.status ? error.message : error.code || error.name);
  }
}

async function createAdmin({ email: emailValue, password, createdBy }) {
  const email = normalizeEmail(emailValue);
  if (!email) throw adminError('Enter a valid email address.');
  validateNewPassword(password);

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  // An archived standard account can be provisioned again with new credentials.
  const restored = await Admin.findOneAndUpdate(
    { email, isHeadAdmin: { $ne: true }, disabledAt: { $type: 'date' } },
    { $set: { passwordHash, credentialVersion: CREDENTIAL_VERSION, sessionVersion: randomBytes(16).toString('hex'), disabledAt: null, disabledBy: null, createdBy } },
    { new: true }
  ).lean();
  if (restored) return serializeAdmin(restored);

  const admin = await Admin.create({ email, passwordHash, credentialVersion: CREDENTIAL_VERSION, createdBy });
  return serializeAdmin(admin);
}

function sessionKey(token) {
  return createHash('sha256').update(token).digest('hex');
}

async function createSession(email, password) {
  const account = await Admin.findOne({ email, ...eligibleAccount }).select('+passwordHash').lean();
  const matches = await bcrypt.compare(password, account?.passwordHash || await dummyPasswordHash);
  if (!account || !matches) return null;

  const now = new Date();
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(now.getTime() + SESSION_DURATION_MS);
  // Check eligibility again after bcrypt. Disabling the account also invalidates its existing sessions.
  const admin = await Admin.findOneAndUpdate(
    { _id: account._id, passwordHash: account.passwordHash, ...eligibleAccount },
    { $set: { lastLoginAt: now } },
    { new: true, timestamps: false }
  ).lean();
  if (!admin) return null;

  await AdminSession.create({ _id: sessionKey(token), adminId: admin._id, sessionVersion: admin.sessionVersion, expiresAt });
  return { token, expiresAt, admin: serializeAdmin(admin) };
}

async function authenticate(token) {
  if (typeof token !== 'string' || !/^[\w-]{43}$/.test(token)) return null;

  const key = sessionKey(token);
  const session = await AdminSession.findOne({ _id: key, expiresAt: { $gt: new Date() } }).lean();
  if (!session) return null;

  const admin = await Admin.findOne({ _id: session.adminId, sessionVersion: session.sessionVersion ?? null, ...eligibleAccount }).lean();
  if (!admin) return null;
  return { key, expiresAt: session.expiresAt, admin: serializeAdmin(admin) };
}

async function revokeSession(key) {
  await AdminSession.deleteOne({ _id: key });
}

async function changePassword(adminId, currentPassword, password) {
  if (!validPasswordInput(currentPassword)) throw adminError('Enter your current password.');
  validateNewPassword(password);

  const admin = await Admin.findOne({ _id: adminId, ...eligibleAccount }).select('+passwordHash').lean();
  if (!admin || !(await bcrypt.compare(currentPassword, admin.passwordHash))) {
    throw adminError('Current password is incorrect.');
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  const updated = await Admin.updateOne(
    { _id: adminId, passwordHash: admin.passwordHash, ...eligibleAccount },
    { $set: { passwordHash, credentialVersion: CREDENTIAL_VERSION, sessionVersion: randomBytes(16).toString('hex') } }
  );
  if (!updated.modifiedCount) throw adminError('The account changed. Sign in and try again.', 409);
}

async function listAdmins() {
  const admins = await Admin.find().sort({ disabledAt: 1, createdAt: -1 }).lean();
  return admins.map(serializeAdmin);
}

async function disableAdmin(adminId, requesterEmail) {
  const admin = await Admin.findById(adminId).lean();
  if (!admin) throw adminError('Admin not found.', 404);
  if (admin.isHeadAdmin) throw adminError('The head admin cannot be disabled.');

  await Admin.updateOne(
    { _id: adminId, isHeadAdmin: { $ne: true }, disabledAt: null },
    { $set: { disabledAt: new Date(), disabledBy: requesterEmail, sessionVersion: randomBytes(16).toString('hex') } }
  );
}

module.exports = {
  adminError,
  authenticate,
  changePassword,
  createAdmin,
  createSession,
  disableAdmin,
  listAdmins,
  normalizeEmail,
  revokeSession,
  seedHeadAdmin,
  validPasswordInput
};
