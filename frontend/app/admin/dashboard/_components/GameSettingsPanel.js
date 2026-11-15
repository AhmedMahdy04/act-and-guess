'use client';

import { useState } from 'react';
import Button from '../../../../components/ui/Button';
import { adminApi } from '../../../../lib/adminApi';
import { Field, inputClass, PanelStatus, PanelTitle, useAdminData } from './controls';

const themes = [
  { id: 'midnight', label: 'Midnight', background: '#111320', accent: '#6366f1' },
  { id: 'christmas', label: 'Christmas', background: '#0e221a', accent: '#dc3e50' },
  { id: 'winter', label: 'Winter', background: '#10213a', accent: '#0e8db3' }
];

const limits = [
  { key: 'teamCount', label: 'Teams', min: 2, max: 6 },
  { key: 'playersPerTeam', label: 'Players per team', min: 2, max: 8 },
  { key: 'targetScore', label: 'Points to win', min: 1, max: 50 },
  { key: 'roundTime', label: 'Round length (seconds)', min: 1, max: 60 }
];

export default function GameSettingsPanel({ execute, pending, onUnauthorized }) {
  const [revision, setRevision] = useState(0);
  const [draft, setDraft] = useState(null);
  const request = useAdminData(adminApi.getSiteSettings, revision, onUnauthorized);
  const values = draft || request.data;
  const changed = draft && Object.keys(draft).some((key) => draft[key] !== request.data?.[key]);

  function edit(key, value) {
    setDraft({ ...values, [key]: value });
  }

  async function publish(event) {
    event.preventDefault();
    if (!changed) return;
    const ok = await execute(async () => {
      const saved = await adminApi.saveSiteSettings(values);
      window.dispatchEvent(new CustomEvent('actguess:settings', { detail: saved }));
      setRevision((current) => current + 1);
    }, 'Game settings published.');
    if (ok) setDraft(null);
  }

  return (
    <div className="space-y-5">
      <PanelTitle title="Game settings" description="Choose the public theme and the starting settings that hosts can customize when they create a room." />
      <PanelStatus request={request} onRetry={() => setRevision((current) => current + 1)} />
      {values && (
        <form className="space-y-6" onSubmit={publish}>
          <fieldset disabled={pending} className="space-y-3">
            <legend className="font-semibold text-white">Theme</legend>
            <div className="grid gap-2 sm:grid-cols-3">
              {themes.map(({ id, label, background, accent }) => (
                <label key={id} className="flex cursor-pointer items-center gap-3 rounded-xl border border-white/10 p-3 has-[:checked]:border-indigo-300">
                  <input type="radio" name="siteTheme" checked={values.theme === id} onChange={() => edit('theme', id)} />
                  <span aria-hidden="true" className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-white/10" style={{ backgroundColor: background }}>
                    <span className="size-4 rounded-full" style={{ backgroundColor: accent }} />
                  </span>
                  <span className="text-sm font-semibold text-slate-100">{label}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <fieldset disabled={pending} className="space-y-3">
            <legend className="font-semibold text-white">New room defaults</legend>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {limits.map(({ key, label, min, max }) => (
                <Field key={key} label={label}>
                  <input className={inputClass} type="number" required min={min} max={max} value={values[key]}
                    onChange={(event) => edit(key, event.target.value === '' ? '' : event.target.valueAsNumber)} />
                </Field>
              ))}
              <Field label="Difficulty">
                <select className={inputClass} value={values.difficulty} onChange={(event) => edit('difficulty', event.target.value)}>
                  {['mixed', 'easy', 'medium', 'hard'].map((value) => (
                    <option key={value} value={value}>{value[0].toUpperCase() + value.slice(1)}</option>
                  ))}
                </select>
              </Field>
            </div>
          </fieldset>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={pending || !changed}>{pending ? 'Publishing…' : 'Publish settings'}</Button>
            {changed && <Button variant="ghost" disabled={pending} onClick={() => setDraft(null)}>Discard changes</Button>}
          </div>
        </form>
      )}
    </div>
  );
}
