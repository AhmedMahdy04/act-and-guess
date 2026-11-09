import { useCallback, useEffect, useState } from 'react';
import { adminApi } from '../../../../lib/adminApi';
import Button from '../../../../components/ui/Button';
import {
  actionsClass, Badge, cellClass, DIFFICULTIES, Field, FormActions, headClass, inputClass,
  PanelStatus, PanelTitle, RowAction, rowClass, tableClass, useAdminData
} from './controls';

const PAGE_SIZE = 20;
const NEW_WORD = { word: '', category: '', difficulty: 'medium' };
const NEW_CATEGORY = { name: '', description: '', icon: '' };
const formClass = 'space-y-4 rounded-2xl border border-indigo-400/20 bg-indigo-950/25 p-4';

export function WordsPanel({ categories, revision, refresh, onUnauthorized, execute, pending, initialCategory }) {
  const [search, setSearch] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [category, setCategory] = useState(initialCategory);
  const [difficulty, setDifficulty] = useState('');
  const [status, setStatus] = useState('active');
  const [page, setPage] = useState(1);
  const [editor, setEditor] = useState(null);

  useEffect(() => {
    const timer = setTimeout(() => setSearchTerm(search.trim()), 250);
    return () => clearTimeout(timer);
  }, [search]);

  const load = useCallback((signal) => adminApi.listWords({
    page, limit: PAGE_SIZE, search: searchTerm, category, difficulty, status
  }, signal), [page, searchTerm, category, difficulty, status]);
  const request = useAdminData(load, revision, onUnauthorized);
  const { words = [], total = 0 } = request.data || {};
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const categoryNames = new Map(categories.map((item) => [item.slug, item.name]));

  useEffect(() => {
    if (request.data && !request.loading && page > pages) setPage(pages);
  }, [page, pages, request.data, request.loading]);

  function openEditor(record = null) {
    const value = record
      ? { word: record.word, category: record.category, difficulty: record.difficulty || 'medium' }
      : { ...NEW_WORD };
    setEditor({ record, value });
  }

  function editField(key, value) {
    setEditor((current) => ({ ...current, value: { ...current.value, [key]: value } }));
  }

  async function save(event) {
    event.preventDefault();
    const { record, value } = editor;
    const saved = await execute(
      () => record ? adminApi.updateWord(record, value) : adminApi.createWord(value),
      record ? 'Word updated.' : 'Word added.',
      'catalog'
    );
    if (saved) {
      setEditor(null);
      if (!record) {
        setSearch('');
        setSearchTerm('');
        setCategory('');
        setDifficulty('');
        setStatus('active');
        setPage(1);
      }
    }
  }

  return (
    <div className="space-y-5">
      <PanelTitle title="Word library" description="Search, edit, and restore the prompts used in games.">
        <Button size="sm" disabled={pending || !categories.some((item) => item.active)} onClick={() => openEditor()}>Add word</Button>
      </PanelTitle>

      {editor && (
        <form onSubmit={save} className={formClass}>
          <h3 className="font-semibold text-slate-100">{editor.record ? 'Edit word' : 'New word'}</h3>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Prompt">
              <input className={inputClass} required maxLength={64} value={editor.value.word} onChange={(event) => editField('word', event.target.value)} />
            </Field>
            <Field label="Category">
              <select className={inputClass} required value={editor.value.category} onChange={(event) => editField('category', event.target.value)}>
                <option value="">Choose a category</option>
                {categories.filter((item) => item.active || item.slug === editor.record?.category).map((item) => (
                  <option key={item.id} value={item.slug}>{item.name}{item.active ? '' : ' (archived)'}</option>
                ))}
              </select>
            </Field>
            <Field label="Difficulty">
              <select className={inputClass} value={editor.value.difficulty} onChange={(event) => editField('difficulty', event.target.value)}>
                {DIFFICULTIES.map((level) => <option key={level} value={level}>{level}</option>)}
              </select>
            </Field>
          </div>
          <FormActions pending={pending} onCancel={() => setEditor(null)} />
        </form>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[2fr_1.2fr_1fr_1fr]">
        <Field label="Search words">
          <input type="search" className={inputClass} placeholder="Find a prompt" maxLength={64} value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} />
        </Field>
        <Field label="Category">
          <select className={inputClass} value={category} onChange={(event) => { setCategory(event.target.value); setPage(1); }}>
            <option value="">All categories</option>
            {categories.map((item) => <option key={item.id} value={item.slug}>{item.name}{item.active ? '' : ' (archived)'}</option>)}
          </select>
        </Field>
        <Field label="Difficulty">
          <select className={inputClass} value={difficulty} onChange={(event) => { setDifficulty(event.target.value); setPage(1); }}>
            <option value="">All difficulties</option>
            {DIFFICULTIES.map((level) => <option key={level} value={level}>{level}</option>)}
          </select>
        </Field>
        <Field label="Status">
          <select className={inputClass} value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}>
            <option value="active">Active words</option>
            <option value="archived">Archived words</option>
          </select>
        </Field>
      </div>

      <PanelStatus request={request} onRetry={() => refresh('catalog')} />

      {request.data && (
        <>
          <div className="overflow-x-auto rounded-xl border border-white/10" aria-busy={request.loading}>
            <table className={tableClass}>
              <thead className={headClass}>
                <tr>
                  <th scope="col" className={cellClass}>Word</th>
                  <th scope="col" className={cellClass}>Category</th>
                  <th scope="col" className={cellClass}>Difficulty</th>
                  <th scope="col" className={cellClass + ' text-right'}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {words.map((word) => (
                  <tr key={word.id} className={rowClass}>
                    <td className={cellClass + ' font-semibold text-slate-100'}>{word.word}</td>
                    <td className={cellClass}>{categoryNames.get(word.category) || word.category}</td>
                    <td className={cellClass}><Badge tone={word.difficulty}>{word.difficulty}</Badge></td>
                    <td className={cellClass}>
                      <div className={actionsClass}>
                        <RowAction disabled={pending} onClick={() => openEditor(word)}>Edit</RowAction>
                        {word.active ? (
                          <RowAction danger disabled={pending} onClick={() => execute(() => adminApi.archiveWord(word), 'Word archived.', 'catalog')}>Archive</RowAction>
                        ) : (
                          <RowAction disabled={pending} onClick={() => execute(() => adminApi.updateWord(word, { active: true }), 'Word restored.', 'catalog')}>Restore</RowAction>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {!words.length && <tr><td colSpan={4} className="p-7 text-center text-slate-400">No words match these filters.</td></tr>}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-slate-400">{total.toLocaleString()} matching {total === 1 ? 'word' : 'words'}</p>
            {pages > 1 && (
              <div className="flex items-center gap-2">
                <Button size="sm" variant="ghost" disabled={page <= 1 || request.loading} onClick={() => setPage(page - 1)}>Previous</Button>
                <span className="whitespace-nowrap text-xs text-slate-400">Page {page} of {pages}</span>
                <Button size="sm" variant="ghost" disabled={page >= pages || request.loading} onClick={() => setPage(page + 1)}>Next</Button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export function CategoriesPanel({ categories, request, refresh, execute, pending, viewWords }) {
  const [editor, setEditor] = useState(null);
  const [showArchived, setShowArchived] = useState(false);
  const filtered = categories.filter((category) => category.active !== showArchived);

  function openEditor(record = null) {
    const value = record ? { name: record.name, description: record.description, icon: record.icon } : { ...NEW_CATEGORY };
    setEditor({ record, value });
  }

  function editField(key, value) {
    setEditor((current) => ({ ...current, value: { ...current.value, [key]: value } }));
  }

  async function save(event) {
    event.preventDefault();
    const { record, value } = editor;
    const saved = await execute(
      () => record ? adminApi.updateCategory(record, value) : adminApi.createCategory(value),
      record ? 'Category updated.' : 'Category created.',
      'catalog'
    );
    if (saved) {
      setEditor(null);
      if (!record) setShowArchived(false);
    }
  }

  return (
    <div className="space-y-5">
      <PanelTitle title="Categories" description="Organize prompts and check coverage at each difficulty.">
        <Button size="sm" disabled={pending} onClick={() => openEditor()}>Add category</Button>
      </PanelTitle>

      {editor && (
        <form onSubmit={save} className={formClass}>
          <h3 className="font-semibold text-slate-100">{editor.record ? 'Edit category' : 'New category'}</h3>
          <div className="grid gap-3 sm:grid-cols-[3fr_1fr]">
            <Field label="Category name">
              <input className={inputClass} required maxLength={48} value={editor.value.name} onChange={(event) => editField('name', event.target.value)} />
            </Field>
            <Field label="Icon (optional)">
              <input className={inputClass} maxLength={16} value={editor.value.icon} onChange={(event) => editField('icon', event.target.value)} />
            </Field>
          </div>
          <Field label="Description">
            <textarea className={inputClass} rows={2} maxLength={240} value={editor.value.description} onChange={(event) => editField('description', event.target.value)} />
          </Field>
          <FormActions pending={pending} onCancel={() => setEditor(null)} />
        </form>
      )}

      <Field label="Category status">
        <select className={inputClass + ' max-w-xs'} value={showArchived ? 'archived' : 'active'} onChange={(event) => setShowArchived(event.target.value === 'archived')}>
          <option value="active">Active categories</option>
          <option value="archived">Archived categories</option>
        </select>
      </Field>
      <PanelStatus request={request} onRetry={() => refresh('catalog')} />
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {filtered.map((category) => (
          <section key={category.id} className="flex flex-col gap-3 rounded-xl border border-white/10 bg-base-950/50 p-4">
            <div className="flex gap-3">
              <span aria-hidden="true" className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-indigo-400/10 text-xl">{category.icon || '▦'}</span>
              <div className="min-w-0">
                <h3 className="break-words font-semibold text-slate-100">{category.name}</h3>
                <p className="mt-0.5 break-words text-xs leading-relaxed text-slate-400">{category.description || category.slug.replaceAll('_', ' ')}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {DIFFICULTIES.map((level) => <Badge key={level} tone={level}>{level} {category.difficultyCounts[level] || 0}</Badge>)}
            </div>
            <div className="mt-auto flex flex-wrap gap-2 border-t border-white/10 pt-3">
              <RowAction onClick={() => viewWords(category.slug)}>View words</RowAction>
              <RowAction disabled={pending} onClick={() => openEditor(category)}>Edit</RowAction>
              {category.active ? (
                <RowAction danger disabled={pending} onClick={() => execute(() => adminApi.archiveCategory(category), 'Category archived. Its words are retained.', 'catalog')}>Archive</RowAction>
              ) : (
                <RowAction disabled={pending} onClick={() => execute(() => adminApi.updateCategory(category, { active: true }), 'Category restored.', 'catalog')}>Restore</RowAction>
              )}
            </div>
          </section>
        ))}
        {!filtered.length && request.data && <p className="py-5 text-sm text-slate-400">No {showArchived ? 'archived' : 'active'} categories.</p>}
      </div>
    </div>
  );
}
