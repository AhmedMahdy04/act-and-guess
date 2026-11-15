const siteSettings = require('../services/siteSettings');
const express = require('express');
const { RateLimiterMemory } = require('rate-limiter-flexible');
const adminService = require('../services/adminService');
const wordService = require('../services/wordService');
const { adminAuth, requireHeadAdmin } = require('../middleware/adminAuth');
const { notifyAdmins, disconnectAdminSession, disconnectAdminSessions } = require('../services/adminEvents');
const Admin = require('../models/Admin');
const Category = require('../models/Category');
const Game = require('../models/Game');
const Word = require('../models/Word');

const router = express.Router();
const { adminError } = adminService;
const loginByIp = new RateLimiterMemory({ points: 10, duration: 60 });
const loginByAccount = new RateLimiterMemory({ points: 15, duration: 900 });
const passwordChangesByAccount = new RateLimiterMemory({ points: 5, duration: 60 });

function handle(action) {
  return (req, res, next) => Promise.resolve(action(req, res)).catch(next);
}

function textField(value, label, limit, required = false) {
  if (typeof value !== 'string') throw adminError(label + ' must be text.');
  const trimmed = value.trim();
  if (required && !trimmed) throw adminError(label + ' is required.');
  if (trimmed.length > limit) throw adminError(label + ' must be ' + limit + ' characters or fewer.');
  return trimmed;
}

function objectId(id, label) {
  if (!/^[a-f\d]{24}$/i.test(id)) throw adminError(label + ' not found.', 404);
  return id;
}

function revisionFilter({ expectedUpdatedAt, expectedVersion }) {
  const filter = {};
  if (expectedUpdatedAt !== undefined) {
    if (typeof expectedUpdatedAt !== 'string' || !Number.isFinite(Date.parse(expectedUpdatedAt))) {
      throw adminError('The record version is invalid.');
    }
    filter.updatedAt = new Date(expectedUpdatedAt);
  }
  if (expectedVersion !== undefined) {
    if (!Number.isSafeInteger(expectedVersion) || expectedVersion < 0) {
      throw adminError('The record version is invalid.');
    }
    if (expectedVersion === 0) filter.$or = [{ __v: 0 }, { __v: { $exists: false } }];
    else filter.__v = expectedVersion;
  }
  return filter;
}

function activeFields(active, email) {
  if (typeof active !== 'boolean') throw adminError('Archive status is invalid.');
  return active ? { active } : { active, archivedAt: new Date(), archivedBy: email };
}

function serializeWord(word) {
  return {
    id: word._id.toString(),
    word: word.word,
    category: word.category,
    difficulty: wordService.DIFFICULTIES.includes(word.difficulty) ? word.difficulty : 'medium',
    active: word.active !== false,
    createdBy: word.createdBy,
    updatedBy: word.updatedBy,
    createdAt: word.createdAt,
    updatedAt: word.updatedAt,
    version: word.__v ?? 0,
    archivedAt: word.archivedAt
  };
}

function serializeCategory(category, difficultyCounts = {}) {
  return {
    id: category._id?.toString() || 'derived:' + category.slug,
    slug: category.slug,
    name: category.name,
    description: category.description || '',
    icon: category.icon || '',
    active: category.active !== false,
    updatedBy: category.updatedBy,
    updatedAt: category.updatedAt,
    version: category.__v ?? 0,
    difficultyCounts,
    wordCount: Object.values(difficultyCounts).reduce((sum, count) => sum + count, 0)
  };
}

async function requireWordCategory(slug) {
  if (!slug || slug === 'random') throw adminError('Choose a valid category.');
  const category = await Category.findOne({ slug }).select('active').lean();
  if (category?.active === false) throw adminError('Restore this category before adding words to it.');
  if (!category && !await Word.exists({ category: slug })) {
    throw adminError('Choose an existing category.');
  }
}

router.use((req, res, next) => {
  res.set('Cache-Control', 'no-store');
  if (Admin.db.readyState !== 1) {
    return res.status(503).json({ error: 'The admin database is unavailable. Try again shortly.' });
  }
  next();
});

router.post('/login', handle(async (req, res) => {
  const { email: emailValue, password } = req.body || {};
  const email = adminService.normalizeEmail(emailValue);
  if (!email || !adminService.validPasswordInput(password)) {
    throw adminError('Enter a valid email and password.');
  }

  try {
    await loginByIp.consume(req.ip || req.socket.remoteAddress || 'unknown');
    await loginByAccount.consume(email);
  } catch (rateLimit) {
    res.set('Retry-After', String(Math.max(1, Math.ceil(rateLimit.msBeforeNext / 1000))));
    throw adminError('Too many sign-in attempts. Try again later.', 429);
  }

  const session = await adminService.createSession(email, password);
  if (!session) throw adminError('Invalid email or password.', 401);
  await loginByAccount.delete(email);
  res.json(session);
}));

router.use(adminAuth);

router.post('/logout', handle(async (req, res) => {
  await adminService.revokeSession(req.adminSessionKey);
  disconnectAdminSession(req.adminSessionKey);
  res.json({ ok: true });
}));

router.get('/me', (req, res) => res.json(req.admin));

router.post('/me/password', handle(async (req, res) => {
  const { currentPassword, password } = req.body || {};
  try {
    await passwordChangesByAccount.consume(req.admin.id);
  } catch (rateLimit) {
    res.set('Retry-After', String(Math.max(1, Math.ceil(rateLimit.msBeforeNext / 1000))));
    throw adminError('Too many password changes. Try again later.', 429);
  }
  await adminService.changePassword(req.admin.id, currentPassword, password);
  disconnectAdminSessions(req.admin.id);
  res.json({ ok: true });
}));

router.get('/admins', requireHeadAdmin, handle(async (req, res) => {
  res.json({ admins: await adminService.listAdmins() });
}));

router.post('/admins', requireHeadAdmin, handle(async (req, res) => {
  const { email, password } = req.body || {};
  const admin = await adminService.createAdmin({ email, password, createdBy: req.admin.email });
  notifyAdmins('admins');
  res.status(201).json(admin);
}));

router.delete('/admins/:id', requireHeadAdmin, handle(async (req, res) => {
  const id = objectId(req.params.id, 'Admin');
  await adminService.disableAdmin(id, req.admin.email);
  disconnectAdminSessions(id);
  notifyAdmins('admins');
  res.json({ ok: true });
}));

router.get('/words', handle(async (req, res) => {
  const { category, difficulty, search, status, page, limit } = req.query;
  const query = { active: status === 'archived' ? false : { $ne: false } };

  if (typeof category === 'string' && category && category !== 'all') {
    query.category = wordService.slugifyCategory(category, '');
  }
  if (wordService.DIFFICULTIES.includes(difficulty)) query.difficulty = difficulty;
  if (typeof search === 'string' && search.trim()) {
    const term = search.trim().slice(0, 64).toLowerCase();
    query.normalizedWord = { $regex: term.replace(/[.*+?^\${}()|[\]\\]/g, '\\$&') };
  }

  const pageNum = Math.max(1, Math.min(10000, (typeof page === 'string' && parseInt(page, 10)) || 1));
  const limitNum = Math.max(1, Math.min(100, (typeof limit === 'string' && parseInt(limit, 10)) || 20));
  const [words, total] = await Promise.all([
    Word.find(query).sort({ createdAt: -1, _id: -1 }).skip((pageNum - 1) * limitNum).limit(limitNum).lean(),
    Word.countDocuments(query)
  ]);

  res.json({ words: words.map(serializeWord), total, page: pageNum, limit: limitNum });
}));

router.post('/words', handle(async (req, res) => {
  const { word, category, difficulty = 'medium' } = req.body || {};
  const wordText = textField(word, 'Word', 64, true);
  const slug = wordService.slugifyCategory(textField(category, 'Category', 32, true), '');
  if (!wordService.DIFFICULTIES.includes(difficulty)) throw adminError('Choose a valid difficulty.');
  await requireWordCategory(slug);

  const normalized = wordService.normalizeWordInput({ word: wordText, category: slug, difficulty, createdBy: req.admin.email });
  const result = await Word.create({ ...normalized, updatedBy: req.admin.email });
  wordService.notifyCatalogChanged();
  res.status(201).json(serializeWord(result));
}));

router.put('/words/:id', handle(async (req, res) => {
  const id = objectId(req.params.id, 'Word');
  const { word, category, difficulty, active } = req.body || {};
  const current = await Word.findById(id).lean();
  if (!current) throw adminError('Word not found.', 404);

  const update = {};
  if (word !== undefined) {
    const normalized = wordService.normalizeWordInput({ word: textField(word, 'Word', 64, true) });
    update.word = normalized.word;
    update.normalizedWord = normalized.normalizedWord;
  }
  if (category !== undefined) {
    const slug = wordService.slugifyCategory(textField(category, 'Category', 32, true), '');
    if (slug !== current.category) await requireWordCategory(slug);
    update.category = slug;
  }
  if (difficulty !== undefined) {
    if (!wordService.DIFFICULTIES.includes(difficulty)) throw adminError('Choose a valid difficulty.');
    update.difficulty = difficulty;
  }
  if (active === true) await requireWordCategory(update.category || current.category);
  if (active !== undefined) Object.assign(update, activeFields(active, req.admin.email));

  const result = await Word.findOneAndUpdate(
    { _id: id, ...revisionFilter(req.body || {}) },
    { $set: { ...update, updatedBy: req.admin.email }, $inc: { __v: 1 } },
    { new: true, runValidators: true }
  ).lean();
  if (!result) throw adminError('This word changed while you were editing. Reopen it and try again.', 409);
  wordService.notifyCatalogChanged();
  res.json(serializeWord(result));
}));

router.delete('/words/:id', handle(async (req, res) => {
  const result = await Word.updateOne(
    { _id: objectId(req.params.id, 'Word'), active: { $ne: false }, ...revisionFilter(req.body || {}) },
    { $set: { ...activeFields(false, req.admin.email), updatedBy: req.admin.email }, $inc: { __v: 1 } }
  );
  if (!result.matchedCount) throw adminError('This word was already changed or archived.', 409);
  wordService.notifyCatalogChanged();
  res.json({ ok: true });
}));

router.get('/categories', handle(async (req, res) => {
  const [categories, counts] = await Promise.all([
    Category.find().sort({ active: -1, name: 1 }).lean(),
    Word.aggregate([{
      $group: {
        _id: { category: '$category', difficulty: { $ifNull: ['$difficulty', 'medium'] } },
        count: { $sum: { $cond: [{ $eq: ['$active', false] }, 0, 1] } }
      }
    }])
  ]);

  const bySlug = new Map(categories.map((category) => [category.slug, category]));
  const countsBySlug = new Map();
  for (const { _id: { category, difficulty }, count } of counts) {
    if (!category) continue;
    if (!bySlug.has(category)) {
      bySlug.set(category, { slug: category, name: wordService.formatCategoryLabel(category) });
    }
    if (!countsBySlug.has(category)) countsBySlug.set(category, {});
    countsBySlug.get(category)[difficulty || 'medium'] = count;
  }

  res.json({
    categories: [...bySlug.values()].map((category) => serializeCategory(category, countsBySlug.get(category.slug)))
  });
}));

router.post('/categories', handle(async (req, res) => {
  const { name, description = '', icon = '' } = req.body || {};
  const cleanedName = textField(name, 'Category name', 48, true);
  const slug = wordService.slugifyCategory(cleanedName, '');
  if (!slug || slug === 'random') throw adminError('Choose a category name containing letters or numbers other than Random.');

  const category = await Category.create({
    slug,
    name: cleanedName,
    description: textField(description, 'Description', 240),
    icon: textField(icon, 'Icon', 16),
    updatedBy: req.admin.email
  });
  wordService.notifyCatalogChanged();
  res.status(201).json(serializeCategory(category));
}));

async function editCategory(id, update, revision, email) {
  if (id.startsWith('derived:')) {
    const slug = id.slice(8);
    if (slug !== wordService.slugifyCategory(slug, '') || !slug ||
        !await Word.exists({ category: slug })) {
      throw adminError('Category not found.', 404);
    }
    return Category.create({
      slug,
      name: wordService.formatCategoryLabel(slug),
      ...update,
      updatedBy: email
    });
  }

  const category = await Category.findOneAndUpdate(
    { _id: objectId(id, 'Category'), ...revision },
    { $set: { ...update, updatedBy: email }, $inc: { __v: 1 } },
    { new: true, runValidators: true }
  ).lean();
  if (!category) throw adminError('This category was changed or removed. Refresh and try again.', 409);
  return category;
}

router.put('/categories/:id', handle(async (req, res) => {
  const { name, description, icon, active } = req.body || {};
  const update = {};
  if (name !== undefined) update.name = textField(name, 'Category name', 48, true);
  if (description !== undefined) update.description = textField(description, 'Description', 240);
  if (icon !== undefined) update.icon = textField(icon, 'Icon', 16);
  if (active !== undefined) Object.assign(update, activeFields(active, req.admin.email));

  const category = await editCategory(req.params.id, update, revisionFilter(req.body || {}), req.admin.email);
  wordService.notifyCatalogChanged();
  res.json(serializeCategory(category));
}));

router.delete('/categories/:id', handle(async (req, res) => {
  await editCategory(req.params.id, activeFields(false, req.admin.email), revisionFilter(req.body || {}), req.admin.email);
  wordService.notifyCatalogChanged();
  res.json({ ok: true });
}));

router.get('/site-settings', handle(async (_req, res) => {
  res.json(await siteSettings.getSettings());
}));

router.put('/site-settings', requireHeadAdmin, handle(async (req, res) => {
  try {
    res.json(await siteSettings.saveSettings(req.body));
  } catch (error) {
    if (error.name === 'ValidationError') {
      return res.status(400).json({ error: 'Choose a supported theme and difficulty, and keep the defaults within the listed ranges.' });
    }
    throw error;
  }
}));

router.get('/matches', requireHeadAdmin, handle(async (req, res) => {
  const games = await Game.find({ testOwner: { $exists: false } })
    .select('status visibility category difficulty currentRound players teamCount matchHistory.matchId closedAt createdAt updatedAt')
    .sort({ updatedAt: -1 })
    .limit(30)
    .lean();

  res.json({
    matches: games.map((game) => ({
      id: game._id.toString(),
      status: game.closedAt ? 'closed' : game.status,
      visibility: game.visibility,
      category: game.category,
      difficulty: game.difficulty,
      currentRound: game.currentRound,
      playerCount: game.players?.length || 0,
      teamCount: game.teamCount,
      completedMatches: game.matchHistory?.length || 0,
      createdAt: game.createdAt,
      updatedAt: game.updatedAt
    }))
  });
}));

router.use((error, req, res, next) => {
  if (res.headersSent) return next(error);
  if (error.code === 11000) {
    return res.status(409).json({ error: 'A record with these details already exists. Check the active and archived lists.' });
  }
  if (error.status >= 400 && error.status < 500) {
    return res.status(error.status).json({ error: error.message });
  }

  console.error('Admin request failed.', error.code || error.name);
  res.status(500).json({ error: 'The admin request could not be completed. Try again.' });
});

module.exports = router;
