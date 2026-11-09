const inputClass = 'w-full rounded-xl border border-white/10 bg-base-800 px-4 py-3.5 text-base font-semibold text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary/50';
const difficulties = ['mixed', 'easy', 'medium', 'hard'];
const limits = [
  { key: 'teamCount', label: 'Teams', min: 2, max: 6 },
  { key: 'playersPerTeam', label: 'Max players per team', min: 2, max: 8 },
  { key: 'targetScore', label: 'Target score', min: 1, max: 50 },
  { key: 'roundTime', label: 'Seconds per round', min: 1, max: 60 }
];

export function formatLabel(value) {
  return String(value || '').split(/[_-]/).filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
}

function getDifficultyCount(catalog, category, difficulty) {
  if (!catalog) return undefined;
  if (difficulty === 'mixed') return category === 'random' ? catalog.totalWords : catalog.categoryCounts?.[category];
  const counts = category === 'random' ? catalog.difficultyCounts : catalog.categoryDifficultyCounts?.[category];
  return counts?.[difficulty];
}

export function getSettingsProblem(settings, catalog) {
  if (!catalog) return '';
  if (!catalog.categoryOptions.includes(settings.category)) return 'Choose a category with active words.';
  if (catalog.totalWords === 0 || getDifficultyCount(catalog, settings.category, settings.difficulty) === 0) {
    return 'Choose a difficulty with words in this category.';
  }
  return '';
}

export default function GameSettingsFields({ settings, onChange, catalog, catalogStatus }) {
  const categoryOptions = catalog?.categoryOptions || ['random'];
  const categoryDetails = catalog?.categoryDetails || [];
  const selectedCategory = categoryDetails.find(({ slug }) => slug === settings.category);
  const problem = getSettingsProblem(settings, catalog);

  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {limits.map(({ key, label, min, max }) => (
          <label className="flex flex-col gap-1.5" key={key}>
            <span className="text-sm font-semibold text-slate-300">{label}</span>
            <input
              type="number"
              inputMode="numeric"
              min={min}
              max={max}
              required
              value={settings[key]}
              onChange={(event) => onChange(key, event.target.value === '' ? '' : event.target.valueAsNumber)}
              className={inputClass}
            />
          </label>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold text-slate-300">Room visibility</span>
          <select value={settings.visibility} onChange={(event) => onChange('visibility', event.target.value)} className={inputClass}>
            <option value="private">Private · invite only</option>
            <option value="public">Public · listed on home</option>
          </select>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold text-slate-300">Category</span>
          <select value={settings.category} onChange={(event) => onChange('category', event.target.value)} className={inputClass}>
            {!categoryOptions.includes(settings.category) && (
              <option value={settings.category} disabled>{formatLabel(settings.category)} · unavailable</option>
            )}
            {categoryOptions.map((category) => {
              const details = categoryDetails.find(({ slug }) => slug === category);
              return <option key={category} value={category}>{details?.name || (category === 'random' ? 'Random · all categories' : formatLabel(category))}</option>;
            })}
          </select>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold text-slate-300">Difficulty</span>
          <select value={settings.difficulty} onChange={(event) => onChange('difficulty', event.target.value)} className={inputClass}>
            {difficulties.map((difficulty) => {
              const count = getDifficultyCount(catalog, settings.category, difficulty);
              return (
                <option key={difficulty} value={difficulty} disabled={count === 0}>
                  {formatLabel(difficulty)}{count === undefined ? '' : ` · ${count} words`}
                </option>
              );
            })}
          </select>
        </label>
      </div>

      <div className="rounded-xl border border-white/10 bg-base-800/40 px-4 py-3 text-sm text-slate-300" aria-live="polite">
        {catalog ? (
          <>
            <span className="font-semibold text-slate-100">
              {selectedCategory ? `${selectedCategory.wordCount} words in ${selectedCategory.name}` : `${catalog.totalWords} words across ${categoryOptions.length - 1} categories`}
            </span>
            {selectedCategory?.description && <p className="mt-1 text-slate-400">{selectedCategory.description}</p>}
          </>
        ) : catalogStatus === 'error' ? 'The word catalog is temporarily unavailable.' : 'Loading the word catalog…'}
        {catalog && catalogStatus === 'error' && <p className="mt-1 text-amber-300">Could not refresh the word catalog. Showing the last loaded list.</p>}
        {problem && <p className="mt-1 text-amber-300">{problem}</p>}
      </div>
    </>
  );
}
