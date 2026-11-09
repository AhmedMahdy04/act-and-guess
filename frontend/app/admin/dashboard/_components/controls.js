import { useEffect, useState } from 'react';
import Button from '../../../../components/ui/Button';

export const DIFFICULTIES = ['easy', 'medium', 'hard'];

export const inputClass = 'w-full min-w-0 rounded-xl border border-white/10 bg-base-950 px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-primary/30';
export const tableClass = 'w-full min-w-[34rem] text-left text-sm text-slate-300';
export const headClass = 'border-b border-white/10 bg-white/[0.03] text-xs font-semibold text-slate-400';
export const rowClass = 'border-b border-white/5 last:border-0 hover:bg-white/[0.025]';
export const cellClass = 'px-4 py-3';
export const actionsClass = 'flex flex-wrap justify-end gap-2';

export function useAdminData(load, revision, onUnauthorized, enabled = true) {
  const [state, setState] = useState({ data: null, error: '', loading: true });

  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    setState((previous) => ({ ...previous, error: '', loading: true }));

    load(controller.signal).then((data) => {
      if (!controller.signal.aborted) setState({ data, error: '', loading: false });
    }).catch((error) => {
      if (controller.signal.aborted) return;
      if (error.status === 401) onUnauthorized();
      else setState((previous) => ({ ...previous, error: error.message, loading: false }));
    });

    return () => controller.abort();
  }, [enabled, load, revision, onUnauthorized]);

  return state;
}

export function Field({ label, children }) {
  return (
    <label className="flex min-w-0 flex-col gap-1.5 text-sm font-medium text-slate-300">
      {label}
      {children}
    </label>
  );
}

export function Badge({ children, tone = 'neutral' }) {
  const color = {
    easy: 'bg-emerald-400/10 text-emerald-300',
    medium: 'bg-amber-400/10 text-amber-200',
    hard: 'bg-rose-400/10 text-rose-300',
    neutral: 'bg-white/[0.06] text-slate-300',
    indigo: 'bg-indigo-400/10 text-indigo-200'
  }[tone];
  return <span className={'inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold capitalize ' + color}>{children}</span>;
}

export function RowAction({ children, danger = false, ...props }) {
  return (
    <button
      type="button"
      className={'rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-400 disabled:opacity-50 ' + (danger ? 'text-rose-300 hover:bg-rose-500/10' : 'text-indigo-200 hover:bg-white/[0.07]')}
      {...props}
    >
      {children}
    </button>
  );
}

export function PanelTitle({ title, description, children }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 className="text-xl font-bold text-white">{title}</h2>
        <p className="mt-1 text-sm leading-relaxed text-slate-400">{description}</p>
      </div>
      {children}
    </div>
  );
}

export function PanelStatus({ request, onRetry }) {
  if (request.error) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-400/20 bg-rose-500/10 p-3 text-sm text-rose-200" role="alert">
        {request.error}
        <Button variant="ghost" size="sm" onClick={onRetry}>Try again</Button>
      </div>
    );
  }
  if (request.loading && !request.data) return <p className="py-5 text-sm text-slate-400" role="status">Loading from the database…</p>;
  return null;
}

export function FormActions({ pending, onCancel, label = 'Save changes' }) {
  return (
    <div className="flex flex-wrap gap-2">
      <Button size="sm" type="submit" disabled={pending}>{pending ? 'Saving…' : label}</Button>
      <Button size="sm" variant="ghost" onClick={onCancel} disabled={pending}>Cancel</Button>
    </div>
  );
}

export function formatDate(value) {
  return value ? new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '—';
}
