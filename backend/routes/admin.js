const express = require('express');
const adminService = require('../services/adminService');
const wordService = require('../services/wordService');
const { adminAuth, requireHeadAdmin, signAdminToken } = require('../middleware/adminAuth');
const Admin = require('../models/Admin');
const Category = require('../models/Category');
const Word = require('../models/Word');

const router = express.Router();

// ── Auth ──────────────────────────────────────────────

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const admin = await adminService.validateAdminLogin(email, password);
    if (!admin) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const token = signAdminToken(admin);
    res.json({ token, admin: { id: admin.id, email: admin.email, isHeadAdmin: admin.isHeadAdmin } });
  } catch (err) {
    console.error('Admin login error:', err);
    res.status(500).json({ error: 'Login failed.' });
  }
});

router.post('/logout', adminAuth, async (req, res) => {
  // Stateless JWT — client just discards token
  res.json({ ok: true });
});

router.get('/me', adminAuth, async (req, res) => {
  try {
    const admin = await Admin.findById(req.admin.id, { passwordHash: 0 }).lean();
    if (!admin) {
      return res.status(404).json({ error: 'Admin not found.' });
    }
    res.json({
      id: admin._id.toString(),
      email: admin.email,
      isHeadAdmin: admin.isHeadAdmin,
      createdAt: admin.createdAt
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch admin.' });
  }
});

// ── Admin Management (Head Admin only) ────────────────

router.post('/admins', adminAuth, requireHeadAdmin, async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const admin = await adminService.createAdmin({
      email,
      password,
      createdBy: req.admin.email
    });

    res.status(201).json(admin);
  } catch (err) {
    console.error('Create admin error:', err);
    res.status(400).json({ error: err.message });
  }
});

router.get('/admins', adminAuth, requireHeadAdmin, async (req, res) => {
  try {
    const admins = await adminService.listAdmins();
    res.json({ admins: admins.map((a) => ({
      id: a._id.toString(),
      email: a.email,
      isHeadAdmin: a.isHeadAdmin,
      createdBy: a.createdBy,
      createdAt: a.createdAt
    })) });
  } catch (err) {
    res.status(500).json({ error: 'Failed to list admins.' });
  }
});

router.delete('/admins/:id', adminAuth, requireHeadAdmin, async (req, res) => {
  try {
    const result = await adminService.deleteAdmin(req.params.id, req.admin.email);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ── Words ─────────────────────────────────────────────

router.get('/words', adminAuth, async (req, res) => {
  try {
    const { category, difficulty, search } = req.query;
    const query = { active: true };

    if (category && category !== 'all') {
      query.category = category.toLowerCase().trim();
    }
    if (difficulty && difficulty !== 'all') {
      query.difficulty = difficulty;
    }
    if (search) {
      query.normalizedWord = { $regex: search.toLowerCase().trim(), $options: 'i' };
    }

    const words = await Word.find(query)
      .sort({ createdAt: -1 })
      .lean();

    res.json({
      words: words.map((w) => ({
        id: w._id.toString(),
        word: w.word,
        category: w.category,
        difficulty: w.difficulty,
        createdBy: w.createdBy,
        createdAt: w.createdAt
      }))
    });
  } catch (err) {
    console.error('List words error:', err);
    res.status(500).json({ error: 'Failed to load words.' });
  }
});

router.post('/words', adminAuth, async (req, res) => {
  try {
    const { word, category, difficulty } = req.body || {};
    if (!word || !category) {
      return res.status(400).json({ error: 'Word and category are required.' });
    }

    const result = await wordService.addWord(
      { word, category, difficulty },
      req.admin.email
    );

    res.status(201).json(result);
  } catch (err) {
    console.error('Add word error:', err);
    res.status(400).json({ error: err.message });
  }
});

router.put('/words/:id', adminAuth, async (req, res) => {
  try {
    const { word, category, difficulty, active } = req.body || {};
    const update = {};

    if (word !== undefined) {
      const sanitized = String(word).trim().slice(0, 64);
      update.word = sanitized;
      update.normalizedWord = sanitized.toLowerCase();
    }
    if (category !== undefined) {
      update.category = wordService.slugifyCategory(category);
    }
    if (difficulty !== undefined) {
      update.difficulty = wordService.normalizeDifficulty(difficulty);
    }
    if (active !== undefined) {
      update.active = Boolean(active);
    }

    const updated = await Word.findByIdAndUpdate(
      req.params.id,
      { $set: update },
      { new: true }
    ).lean();

    if (!updated) {
      return res.status(404).json({ error: 'Word not found.' });
    }

    res.json({
      id: updated._id.toString(),
      word: updated.word,
      category: updated.category,
      difficulty: updated.difficulty,
      active: updated.active
    });
  } catch (err) {
    console.error('Update word error:', err);
    res.status(400).json({ error: err.message });
  }
});

router.delete('/words/:id', adminAuth, async (req, res) => {
  try {
    const deleted = await Word.findByIdAndDelete(req.params.id).lean();
    if (!deleted) {
      return res.status(404).json({ error: 'Word not found.' });
    }
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ── Categories ────────────────────────────────────────

router.get('/categories', adminAuth, async (req, res) => {
  try {
    const categories = await Category.find({ active: true })
      .sort({ name: 1 })
      .lean();

    // Count words per category
    const wordCounts = await Word.aggregate([
      { $match: { active: true } },
      { $group: { _id: '$category', count: { $sum: 1 } } }
    ]);

    const countMap = Object.fromEntries(wordCounts.map((w) => [w._id, w.count]));

    res.json({
      categories: categories.map((c) => ({
        id: c._id.toString(),
        slug: c.slug,
        name: c.name,
        description: c.description,
        icon: c.icon,
        wordCount: countMap[c.slug] || 0
      }))
    });
  } catch (err) {
    console.error('List categories error:', err);
    res.status(500).json({ error: 'Failed to load categories.' });
  }
});

router.post('/categories', adminAuth, async (req, res) => {
  try {
    const { name, description, icon } = req.body || {};
    if (!name) {
      return res.status(400).json({ error: 'Category name is required.' });
    }

    const slug = wordService.slugifyCategory(name);
    const existing = await Category.findOne({ slug });
    if (existing) {
      return res.status(400).json({ error: 'A category with this name already exists.' });
    }

    const category = await Category.create({
      slug,
      name: name.trim(),
      description: String(description || '').trim(),
      icon: String(icon || '').trim()
    });

    res.status(201).json({
      id: category._id.toString(),
      slug: category.slug,
      name: category.name,
      description: category.description,
      icon: category.icon
    });
  } catch (err) {
    console.error('Create category error:', err);
    res.status(400).json({ error: err.message });
  }
});

router.put('/categories/:id', adminAuth, async (req, res) => {
  try {
    const { name, description, icon } = req.body || {};
    const update = {};

    if (name !== undefined) update.name = name.trim();
    if (description !== undefined) update.description = String(description).trim();
    if (icon !== undefined) update.icon = String(icon).trim();

    const updated = await Category.findByIdAndUpdate(
      req.params.id,
      { $set: update },
      { new: true }
    ).lean();

    if (!updated) {
      return res.status(404).json({ error: 'Category not found.' });
    }

    res.json({
      id: updated._id.toString(),
      slug: updated.slug,
      name: updated.name,
      description: updated.description,
      icon: updated.icon
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete('/categories/:id', adminAuth, async (req, res) => {
  try {
    const category = await Category.findById(req.params.id).lean();
    if (!category) {
      return res.status(404).json({ error: 'Category not found.' });
    }

    // Check if words exist in this category
    const wordCount = await Word.countDocuments({ category: category.slug, active: true });
    if (wordCount > 0) {
      return res.status(400).json({
        error: `Cannot delete: ${wordCount} word(s) use this category. Reassign or delete them first.`
      });
    }

    await Category.deleteOne({ _id: req.params.id });
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;

