const mongoose = require('mongoose');

const adminSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, trim: true, lowercase: true },
  passwordHash: { type: String, required: true },
  isHeadAdmin: { type: Boolean, default: false },
  createdBy: { type: String, default: null }, // email of creator (null for seeded head admin)
  createdAt: { type: Date, default: Date.now }
}, { timestamps: true });

module.exports = mongoose.model('Admin', adminSchema);

