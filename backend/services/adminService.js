const bcrypt = require('bcryptjs');
const Admin = require('../models/Admin');

const HEAD_ADMIN_EMAIL = 'ahmed2004mahdy@gmail.com';
const HEAD_ADMIN_PASSWORD = 'Ahmed2004$';
const SALT_ROUNDS = 12;

async function seedHeadAdmin() {
  try {
    const count = await Admin.countDocuments();
    if (count > 0) {
      return { created: false, reason: 'Admins already exist' };
    }

    const passwordHash = await bcrypt.hash(HEAD_ADMIN_PASSWORD, SALT_ROUNDS);
    await Admin.create({
      email: HEAD_ADMIN_EMAIL,
      passwordHash,
      isHeadAdmin: true,
      createdBy: null
    });

    console.log(`✅ Head admin seeded: ${HEAD_ADMIN_EMAIL}`);
    return { created: true, email: HEAD_ADMIN_EMAIL };
  } catch (err) {
    console.error('❌ Failed to seed head admin:', err.message);
    return { created: false, error: err.message };
  }
}

async function createAdmin({ email, password, createdBy }) {
  const existing = await Admin.findOne({ email: email.toLowerCase().trim() });
  if (existing) {
    throw new Error('An admin with this email already exists.');
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  const admin = await Admin.create({
    email: email.toLowerCase().trim(),
    passwordHash,
    isHeadAdmin: false,
    createdBy
  });

  return {
    id: admin._id.toString(),
    email: admin.email,
    isHeadAdmin: admin.isHeadAdmin,
    createdAt: admin.createdAt
  };
}

async function validateAdminLogin(email, password) {
  const admin = await Admin.findOne({ email: email.toLowerCase().trim() });
  if (!admin) {
    return null;
  }

  const valid = await bcrypt.compare(password, admin.passwordHash);
  if (!valid) {
    return null;
  }

  return {
    id: admin._id.toString(),
    email: admin.email,
    isHeadAdmin: admin.isHeadAdmin
  };
}

async function listAdmins() {
  return Admin.find({}, { passwordHash: 0 })
    .sort({ createdAt: -1 })
    .lean();
}

async function deleteAdmin(adminId, requesterEmail) {
  const admin = await Admin.findById(adminId);
  if (!admin) {
    throw new Error('Admin not found.');
  }

  if (admin.isHeadAdmin) {
    throw new Error('The head admin cannot be deleted.');
  }

  await Admin.deleteOne({ _id: adminId });
  return { ok: true };
}

module.exports = {
  seedHeadAdmin,
  createAdmin,
  validateAdminLogin,
  listAdmins,
  deleteAdmin
};

