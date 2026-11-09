const mongoose = require('mongoose');

const adminSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, trim: true, lowercase: true },
  passwordHash: { type: String, required: true, select: false },
  isHeadAdmin: { type: Boolean, default: false },
  credentialVersion: Number,
  sessionVersion: { type: String, default: null },
  createdBy: { type: String, default: null },
  disabledAt: { type: Date, default: null },
  disabledBy: { type: String, default: null },
  lastLoginAt: { type: Date, default: null }
}, { timestamps: true });

module.exports = mongoose.model('Admin', adminSchema);
