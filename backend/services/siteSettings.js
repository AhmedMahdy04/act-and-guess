const SiteSettings = require('../models/SiteSettings');

const DEFAULTS = {
  theme: 'midnight',
  teamCount: 2,
  playersPerTeam: 3,
  targetScore: 10,
  roundTime: 30,
  difficulty: 'mixed'
};

function publicSettings(record = {}) {
  return Object.fromEntries(Object.entries(DEFAULTS).map(([key, fallback]) => (
    [key, record[key] ?? fallback]
  )));
}

async function getSettings() {
  if (SiteSettings.db.readyState !== 1) return publicSettings();
  return publicSettings(await SiteSettings.findById('site').lean() || {});
}

async function saveSettings(body) {
  const input = {};
  for (const [key, fallback] of Object.entries(DEFAULTS)) {
    const value = body?.[key];
    if (typeof value !== typeof fallback || (typeof value === 'number' && !Number.isInteger(value))) {
      throw Object.assign(new Error('Enter a valid value for every setting.'), { status: 400 });
    }
    input[key] = value;
  }
  await new SiteSettings({ _id: 'site', ...input }).validate();
  const record = await SiteSettings.findByIdAndUpdate('site', { $set: input }, {
    upsert: true, new: true, runValidators: true
  }).lean();
  return publicSettings(record);
}

module.exports = { getSettings, saveSettings };
