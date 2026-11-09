const crypto = require('crypto');
const { EventEmitter } = require('node:events');

const Word = require('../models/Word');
const Category = require('../models/Category');
const LEGACY_WORDS = require('../defaultWords');
const PACKS = require('../data/catalog');

const DIFFICULTIES = ['easy', 'medium', 'hard'];
const DIFFICULTY_FILTERS = [...DIFFICULTIES, 'mixed'];
const CATALOG_VERSION = 'launch-1';
const ACTIVE = { $ne: false };
const catalogEvents = new EventEmitter();

const packedWords = Object.entries(PACKS).flatMap(([category, pack]) => (
  DIFFICULTIES.flatMap((difficulty) => pack[difficulty].map((word) => ({ word, category, difficulty })))
));
const bundledWords = [...LEGACY_WORDS, ...packedWords].map(normalizeWordInput);
let memoryWords = [...bundledWords];

function isDbReady() {
  return Word.db.readyState === 1;
}

function sanitizeWord(value) {
  return String(value ?? '')
    .normalize('NFC')
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, 64);
}

function slugifyCategory(value, fallback = 'general') {
  const cleaned = String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 32)
    .replace(/_+$/, '');

  return cleaned || fallback;
}

function normalizeDifficulty(value, fallback = 'medium') {
  const cleaned = String(value ?? '').trim().toLowerCase();
  return DIFFICULTIES.includes(cleaned) ? cleaned : fallback;
}

function normalizeDifficultyFilter(value, fallback = 'mixed') {
  const cleaned = String(value ?? '').trim().toLowerCase();
  return DIFFICULTY_FILTERS.includes(cleaned) ? cleaned : fallback;
}

function normalizeCategoryFilter(value, fallback = 'random') {
  const slug = slugifyCategory(value, fallback);
  return slug === 'random' ? fallback : slug;
}

function normalizeWordInput(entry = {}) {
  const word = sanitizeWord(entry.word);
  return {
    word,
    normalizedWord: word.toLowerCase(),
    category: slugifyCategory(entry.category),
    difficulty: normalizeDifficulty(entry.difficulty),
    active: entry.active !== false,
    createdBy: String(entry.createdBy || 'system').slice(0, 64)
  };
}

function formatCategoryLabel(category) {
  if (Object.hasOwn(PACKS, category)) return PACKS[category].name;
  return String(category || '')
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

async function getCategoryLabels(slugs) {
  const labels = new Map([...new Set(slugs)].map((slug) => [slug, formatCategoryLabel(slug)]));
  const storedSlugs = [...labels.keys()].filter((slug) => slug !== 'random');
  if (isDbReady() && storedSlugs.length) {
    const categories = await Category.find({ slug: { $in: storedSlugs } }, 'slug name').lean();
    for (const { slug, name } of categories) {
      if (name) labels.set(slug, name);
    }
  }
  return Object.fromEntries(labels);
}

function onCatalogChanged(listener) {
  catalogEvents.on('change', listener);
  return () => catalogEvents.off('change', listener);
}

function notifyCatalogChanged() {
  catalogEvents.emit('change');
}

async function ensureCatalogSeeded() {
  if (!isDbReady()) return;

  const seeds = Word.db.collection('catalog_seeds');
  const filter = { _id: CATALOG_VERSION };
  let state = await seeds.findOne(filter);
  if (state?.completedAt) return;

  await Promise.all([Word.init(), Category.init()]);
  if (!state) {
    const [word, category] = await Promise.all([Word.exists({}), Category.exists({})]);
    // A populated legacy catalog may already contain deliberate edits to the original prompts.
    state = await seeds.findOneAndUpdate(filter, {
      $setOnInsert: { includeLegacy: !word && !category }
    }, { upsert: true, returnDocument: 'after' });
    if (state.completedAt) return;
  }

  const now = new Date();
  const words = state.includeLegacy ? bundledWords : packedWords.map(normalizeWordInput);
  await Word.bulkWrite(words.map((entry) => ({
    updateOne: {
      filter: { normalizedWord: entry.normalizedWord, category: entry.category },
      update: { $setOnInsert: { ...entry, createdAt: now, updatedAt: now } },
      upsert: true
    }
  })), { ordered: false, timestamps: false });

  await Category.bulkWrite(Object.entries(PACKS).map(([slug, { name, description, icon }]) => ({
    updateOne: {
      filter: { slug },
      update: { $setOnInsert: { slug, name, description, icon, active: true, createdAt: now, updatedAt: now } },
      upsert: true
    }
  })), { ordered: false, timestamps: false });

  await seeds.updateOne(filter, { $set: { completedAt: new Date() } });
}

function emptyDifficultyCounts() {
  return { easy: 0, medium: 0, hard: 0 };
}

async function getCatalogSummary() {
  const [groups, categories] = isDbReady()
    ? await Promise.all([
      Word.aggregate([
        { $match: { active: ACTIVE, difficulty: { $in: DIFFICULTIES }, word: { $gt: '' } } },
        { $group: { _id: { category: '$category', difficulty: '$difficulty' }, count: { $sum: 1 } } }
      ]),
      Category.find({}, 'slug name description icon active').lean()
    ])
    : [memoryWords.filter((entry) => entry.active).map((entry) => ({ _id: entry, count: 1 })), []];

  const categoryMetadata = new Map(categories.map((category) => [category.slug, category]));
  const countsByCategory = new Map();
  const difficultyCounts = emptyDifficultyCounts();
  let totalWords = 0;

  for (const { _id: { category, difficulty }, count } of groups) {
    if (!category || category === 'random' || categoryMetadata.get(category)?.active === false) continue;
    if (!countsByCategory.has(category)) countsByCategory.set(category, emptyDifficultyCounts());
    countsByCategory.get(category)[difficulty] += count;
    difficultyCounts[difficulty] += count;
    totalWords += count;
  }

  const slugs = [...countsByCategory.keys()].sort();
  const categoryDetails = slugs.map((slug) => {
    const metadata = categoryMetadata.get(slug) || (Object.hasOwn(PACKS, slug) ? PACKS[slug] : {});
    const counts = countsByCategory.get(slug);
    return {
      slug,
      name: metadata.name || formatCategoryLabel(slug),
      description: metadata.description || '',
      icon: metadata.icon || '',
      wordCount: counts.easy + counts.medium + counts.hard,
      difficultyCounts: counts
    };
  });

  return {
    totalWords,
    categories: slugs,
    categoryOptions: ['random', ...slugs],
    categoryDetails,
    categoryCounts: Object.fromEntries(categoryDetails.map(({ slug, wordCount }) => [slug, wordCount])),
    categoryDifficultyCounts: Object.fromEntries(countsByCategory),
    difficultyCounts
  };
}

async function buildWordDeck({ category = 'random', difficulty = 'mixed' } = {}) {
  const selectedCategory = normalizeCategoryFilter(category);
  const selectedDifficulty = normalizeDifficultyFilter(difficulty);
  let words;

  if (isDbReady()) {
    const archivedCategories = await Category.distinct('slug', { active: false });
    const categoryFilter = selectedCategory === 'random'
      ? { $nin: ['random', ...archivedCategories] }
      : { $eq: selectedCategory, $nin: archivedCategories };
    words = await Word.find({
      active: ACTIVE,
      category: categoryFilter,
      difficulty: selectedDifficulty === 'mixed' ? { $in: DIFFICULTIES } : selectedDifficulty
    }, 'word').lean();
  } else {
    words = memoryWords.filter((entry) => (
      entry.active &&
      (selectedCategory === 'random' || entry.category === selectedCategory) &&
      (selectedDifficulty === 'mixed' || entry.difficulty === selectedDifficulty)
    ));
  }

  const distinct = new Map();
  for (const entry of words) {
    const word = sanitizeWord(entry.word);
    if (word) distinct.set(word.toLowerCase(), word);
  }
  const deck = [...distinct.values()];
  if (!deck.length) {
    throw new Error('No prompts match that category and difficulty. Choose another combination.');
  }

  for (let index = deck.length - 1; index > 0; index -= 1) {
    const swapIndex = crypto.randomInt(index + 1);
    [deck[index], deck[swapIndex]] = [deck[swapIndex], deck[index]];
  }
  return deck;
}

async function addWord(input, createdBy = 'host') {
  const normalized = normalizeWordInput({ ...input, createdBy });
  if (!normalized.word) throw new Error('Word cannot be empty.');
  const { normalizedWord, category, difficulty } = normalized;
  const identity = { normalizedWord, category, difficulty };

  if (isDbReady()) {
    const result = await Word.findOneAndUpdate(identity, { $setOnInsert: normalized }, {
      new: true, upsert: true, includeResultMetadata: true
    });
    if (!result.lastErrorObject.updatedExisting) notifyCatalogChanged();
    return { word: result.value.word, category, difficulty };
  }

  const exists = memoryWords.some((entry) => (
    entry.normalizedWord === normalizedWord && entry.category === category && entry.difficulty === difficulty
  ));
  if (!exists) {
    memoryWords = [normalized, ...memoryWords];
    notifyCatalogChanged();
  }
  return { word: normalized.word, category, difficulty };
}

module.exports = {
  DIFFICULTIES,
  addWord,
  buildWordDeck,
  ensureCatalogSeeded,
  formatCategoryLabel,
  getCategoryLabels,
  getCatalogSummary,
  normalizeCategoryFilter,
  normalizeDifficulty,
  normalizeDifficultyFilter,
  normalizeWordInput,
  notifyCatalogChanged,
  onCatalogChanged,
  slugifyCategory
};
