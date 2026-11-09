const mongoose = require('mongoose');

const adminSessionSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  adminId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
  sessionVersion: { type: String, default: null },
  expiresAt: { type: Date, required: true, expires: 0 }
});

module.exports = mongoose.model('AdminSession', adminSessionSchema);
