const crypto = require('crypto');

const Word = require('../models/Word');
const Category = require('../models/Category');
const DEFAULT_WORDS = require('../defaultWords');

const DIFFICULTIES = ['easy', 'medium', 'hard'];
const DIFFICULTY_FILTERS = ['easy', 'medium', 'hard', 'mixed'];

let memoryWords = DEFAULT_WORDS.map((entry) => normalizeWordInput(entry));

function isDbReady() {
  return Word.db?.readyState === 1;
}

function sanitizeWord(value) {
  return String(value || '')
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, 64);
}

function slugifyCategory(value, fallback = 'general') {
  const cleaned = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 32);

  return cleaned || fallback;
}

function normalizeDifficulty(value, fallback = 'medium') {
  const cleaned = String(value || '').trim().toLowerCase();
  return DIFFICULTIES.includes(cleaned) ? cleaned : fallback;
}

function normalizeDifficultyFilter(value, fallback = 'mixed') {
  const cleaned = String(value || '').trim().toLowerCase();
  return DIFFICULTY_FILTERS.includes(cleaned) ? cleaned : fallback;
}

function normalizeCategoryFilter(value, fallback = 'random') {
  const cleaned = String(value || '').trim().toLowerCase();
  if (!cleaned || cleaned === 'random') {
    return fallback;
  }

  return slugifyCategory(cleaned);
}

function normalizeWordInput(entry = {}) {
  const word = sanitizeWord(entry.word);
  const category = slugifyCategory(entry.category, 'general');
  const difficulty = normalizeDifficulty(entry.difficulty, 'medium');

  return {
    word,
    normalizedWord: word.toLowerCase(),
    category,
    difficulty,
    active: entry.active !== false,
    createdBy: String(entry.createdBy || 'system').slice(0, 64)
  };
}

function formatCategoryLabel(category) {
  if (category === 'random') {
    return 'Random';
  }

  return String(category || '')
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function shuffle(items) {
  const next = [...items];

  for (let index = next.length - 1; index > 0; index -= 1) {
    const swapIndex = crypto.randomInt(index + 1);
    [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
  }

  return next;
}

function dedupeWords(words) {
  const seen = new Set();

  return words.filter((entry) => {
    const key = String(entry.word || '').toLowerCase();
    if (!key || seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

async function ensureCatalogSeeded() {
  if (!isDbReady()) {
    return memoryWords;
  }

  // Seed words
  const wordOperations = DEFAULT_WORDS
    .map((entry) => normalizeWordInput(entry))
    .filter((entry) => entry.word)
    .map((entry) => ({
      updateOne: {
        filter: {
          normalizedWord: entry.normalizedWord,
          category: entry.category,
          difficulty: entry.difficulty
        },
        update: {
          $setOnInsert: entry
        },
        upsert: true
      }
    }));

  if (wordOperations.length) {
    await Word.bulkWrite(wordOperations, { ordered: false });
  }

  // Seed categories from default words
  const uniqueCategories = [...new Set(
    DEFAULT_WORDS
      .map((entry) => slugifyCategory(entry.category, ''))
      .filter(Boolean)
  )];

  const categoryOperations = uniqueCategories.map((slug) => ({
    updateOne: {
      filter: { slug },
      update: {
        $setOnInsert: {
          slug,
          name: formatCategoryLabel(slug),
          description: '',
          icon: '',
          active: true
        }
      },
      upsert: true
    }
  }));

  if (categoryOperations.length) {
    await Category.bulkWrite(categoryOperations, { ordered: false });
  }

  return Word.find({ active: true }).lean();
}

async function getAllWords() {
  if (isDbReady()) {
    return Word.find({ active: true }).sort({ createdAt: -1 }).lean();
  }

  return [...memoryWords].reverse();
}

async function getCatalogSummary() {
  const words = await getAllWords();
  const categories = [...new Set(words.map((entry) => entry.category).filter(Boolean))].sort();
  const categoryCounts = Object.fromEntries(categories.map((category) => [
    category,
    words.filter((entry) => entry.category === category).length
  ]));

  const difficultyCounts = Object.fromEntries(DIFFICULTIES.map((difficulty) => [
    difficulty,
    words.filter((entry) => entry.difficulty === difficulty).length
  ]));

  return {
    totalWords: words.length,
    categories,
    categoryCounts,
    difficultyCounts,
    recentWords: words.slice(0, 12).map((entry) => ({
      word: entry.word,
      category: entry.category,
      difficulty: entry.difficulty
    }))
  };
}

async function buildWordDeck({ category = 'random', difficulty = 'mixed' } = {}) {
  const normalizedCategory = normalizeCategoryFilter(category);
  const normalizedDifficulty = normalizeDifficultyFilter(difficulty);

  const words = await getAllWords();
  const filtered = dedupeWords(words.filter((entry) => {
    const categoryMatches = normalizedCategory === 'random' || entry.category === normalizedCategory;
    const difficultyMatches = normalizedDifficulty === 'mixed' || entry.difficulty === normalizedDifficulty;
    return categoryMatches && difficultyMatches;
  }));

  if (!filtered.length) {
    throw new Error('No words match that category and difficulty yet. Add more words or change the filters.');
  }

  return shuffle(filtered.map((entry) => entry.word));
}

async function addWord(input, createdBy = 'host') {
  const normalized = normalizeWordInput({ ...input, createdBy });
  if (!normalized.word) {
    throw new Error('Word cannot be empty.');
  }

  if (isDbReady()) {
    const word = await Word.findOneAndUpdate(
      {
        normalizedWord: normalized.normalizedWord,
        category: normalized.category,
        difficulty: normalized.difficulty
      },
      {
        $setOnInsert: normalized
      },
      {
        new: true,
        upsert: true
      }
    ).lean();

    return {
      word: word.word,
      category: word.category,
      difficulty: word.difficulty
    };
  }

  const exists = memoryWords.find((entry) => (
    entry.normalizedWord === normalized.normalizedWord &&
    entry.category === normalized.category &&
    entry.difficulty === normalized.difficulty
  ));

  if (!exists) {
    memoryWords = [normalized, ...memoryWords];
  }

  return {
    word: normalized.word,
    category: normalized.category,
    difficulty: normalized.difficulty
  };
}

module.exports = {
  DIFFICULTIES,
  addWord,
  buildWordDeck,
  ensureCatalogSeeded,
  formatCategoryLabel,
  getCatalogSummary,
  normalizeCategoryFilter,
  normalizeDifficulty,
  normalizeDifficultyFilter,
  slugifyCategory
};
