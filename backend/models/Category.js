const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema({
  slug: { type: String, required: true, unique: true, trim: true, lowercase: true },
  name: { type: String, required: true, trim: true },
  description: { type: String, default: '', trim: true },
  icon: { type: String, default: '' },
  active: { type: Boolean, default: true },
  createdBy: { type: String, default: 'system' },
  updatedBy: { type: String, default: null },
  archivedAt: { type: Date, default: null },
  archivedBy: { type: String, default: null }
}, { timestamps: true });

module.exports = mongoose.model('Category', categorySchema);

