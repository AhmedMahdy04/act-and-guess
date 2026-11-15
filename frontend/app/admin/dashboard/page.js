'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Button from '../../../components/ui/Button';
import Card from '../../../components/ui/Card';
import { adminApi, clearAdminToken, getAdminToken, subscribeToAdminChanges } from '../../../lib/adminApi';
import GameSettingsPanel from './_components/GameSettingsPanel';
import { CategoriesPanel, WordsPanel } from './_components/CatalogPanels';
import { AccountsPanel, MatchesPanel } from './_components/OperationsPanels';
import { DIFFICULTIES, Field, FormActions, inputClass, PanelStatus, useAdminData } from './_components/controls';

const TABS = [
  { id: 'words', label: 'Word library' },
  { id: 'categories', label: 'Categories' },
  { id: 'settings', label: 'Game settings', headOnly: true },
  { id: 'matches', label: 'Game history', headOnly: true },
  { id: 'admins', label: 'Admin accounts', headOnly: true }
];

export default function AdminDashboard() {
  const router = useRouter();
  const [auth, setAuth] = useState({ admin: null, loading: true, error: '' });
  const [authRetry, setAuthRetry] = useState(0);
  const [tab, setTab] = useState('words');
  const [initialCategory, setInitialCategory] = useState('');
  const [connected, setConnected] = useState(false);
  const [versions, setVersions] = useState({ catalog: 0, admins: 0, matches: 0 });
  const [notice, setNotice] = useState(null);
  const [pending, setPending] = useState(false);
  const [passwordForm, setPasswordForm] = useState(null);
  const activeAction = useRef(false);

  const onUnauthorized = useCallback(() => {
    clearAdminToken();
    setAuth({ admin: null, loading: true, error: '' });
    router.replace('/admin/login');
  }, [router]);

  const refresh = useCallback((scope) => {
    setVersions((current) => ({
      catalog: current.catalog + (!scope || scope === 'catalog' ? 1 : 0),
      admins: current.admins + (!scope || scope === 'admins' ? 1 : 0),
      matches: current.matches + (!scope || scope === 'matches' ? 1 : 0)
    }));
  }, []);

  useEffect(() => {
    if (!getAdminToken()) {
      onUnauthorized();
      return;
    }

    const controller = new AbortController();
    setAuth({ admin: null, loading: true, error: '' });
    adminApi.me(controller.signal).then((admin) => {
      if (!controller.signal.aborted) setAuth({ admin, loading: false, error: '' });
    }).catch((error) => {
      if (controller.signal.aborted) return;
      if (error.status === 401) onUnauthorized();
      else setAuth({ admin: null, loading: false, error: error.message });
    });
    return () => controller.abort();
  }, [authRetry, onUnauthorized]);

  const admin = auth.admin;
  useEffect(() => {
    if (!admin) return;
    const unsubscribe = subscribeToAdminChanges(setConnected, refresh);
    const sync = () => { if (!document.hidden) refresh(); };
    const timer = setInterval(sync, 15000);
    window.addEventListener('focus', sync);
    document.addEventListener('visibilitychange', sync);

    return () => {
      unsubscribe();
      clearInterval(timer);
      window.removeEventListener('focus', sync);
      document.removeEventListener('visibilitychange', sync);
    };
  }, [admin, refresh]);

  const categoryRequest = useAdminData(adminApi.listCategories, versions.catalog, onUnauthorized, Boolean(admin));
  const categories = categoryRequest.data?.categories || [];
  const available = categories.filter((category) => category.active);
  const wordCount = available.reduce((sum, category) => sum + category.wordCount, 0);
  const playableCategories = available.filter((category) => category.wordCount > 0);
  const levels = DIFFICULTIES.filter((difficulty) => available.some((category) => category.difficultyCounts[difficulty] > 0));

  async function execute(action, success, scope) {
    if (activeAction.current) return false;
    activeAction.current = true;
    setPending(true);
    setNotice(null);
    try {
      await action();
      if (success) setNotice({ message: success, error: false });
      if (scope) refresh(scope);
      return true;
    } catch (error) {
      if (error.status === 401) onUnauthorized();
      else {
        if (error.status === 409 && scope) refresh(scope);
        setNotice({ message: error.message, error: true });
      }
      return false;
    } finally {
      activeAction.current = false;
      setPending(false);
    }
  }

  async function logout() {
    if (await execute(adminApi.logout)) onUnauthorized();
  }

  async function changePassword(event) {
    event.preventDefault();
    if (await execute(() => adminApi.changePassword(passwordForm))) onUnauthorized();
  }

  function selectTab(next) {
    setNotice(null);
    setInitialCategory('');
    setTab(next);
  }

  function viewWords(category) {
    setInitialCategory(category);
    setTab('words');
  }

  if (!admin) {
    return (
      <main className="mx-auto max-w-xl px-4 py-16">
        <Card className="p-6">
          <h1 className="text-xl font-bold text-slate-100">Admin dashboard</h1>
          <PanelStatus request={auth} onRetry={() => setAuthRetry(authRetry + 1)} />
          <Link href="/" className="mt-4 inline-block text-sm font-semibold text-indigo-200 hover:underline">Back to game</Link>
        </Card>
      </main>
    );
  }

  const panelProps = { refresh, onUnauthorized, execute, pending };

  return (
    <main className="mx-auto max-w-7xl space-y-5 px-4 py-6 sm:px-6 sm:py-10">
      <section className="overflow-hidden rounded-3xl border border-indigo-300/15 bg-gradient-to-br from-indigo-950/80 via-base-900 to-base-950 p-5 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-300">Act &amp; Guess · Admin</p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-white sm:text-4xl">Game operations</h1>
            <p className="mt-2 break-all text-sm text-slate-300">{admin.email} · {admin.isHeadAdmin ? 'Head admin' : 'Catalog admin'}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/admin/testing" className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white hover:brightness-110">
              Open game testing
            </Link>
            <Button size="sm" variant="ghost" disabled={pending} onClick={() => setPasswordForm({ currentPassword: '', password: '' })}>Change password</Button>
            <Button size="sm" variant="ghost" disabled={pending} onClick={logout}>Sign out</Button>
          </div>
        </div>
        <div className="mt-6 grid grid-cols-3 gap-2 sm:gap-3">
          {[
            ['Playable words', wordCount],
            ['Categories with words', playableCategories.length],
            ['Difficulty levels', levels.length]
          ].map(([label, value]) => (
            <div className="rounded-2xl border border-white/10 bg-base-950/40 p-3 sm:p-4" key={label}>
              <p className="text-xl font-bold tabular-nums text-white sm:text-3xl">{categoryRequest.data ? value.toLocaleString() : '—'}</p>
              <p className="mt-1 text-xs leading-tight text-slate-400 sm:text-sm">{label}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav aria-label="Admin sections" className="flex max-w-full gap-1 overflow-x-auto rounded-xl border border-white/10 bg-base-900 p-1">
          {TABS.filter((item) => !item.headOnly || admin.isHeadAdmin).map((item) => (
            <button
              key={item.id}
              type="button"
              aria-current={tab === item.id ? 'page' : undefined}
              onClick={() => selectTab(item.id)}
              className={'whitespace-nowrap rounded-lg px-3 py-2 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-300 sm:px-4 ' + (tab === item.id ? 'bg-indigo-500 text-white' : 'text-slate-400 hover:bg-white/5 hover:text-slate-200')}
            >
              {item.label}
            </button>
          ))}
        </nav>

        <div className="flex flex-wrap items-center gap-3">
          <span className="flex items-center gap-2 text-xs text-slate-300" role="status">
            <span aria-hidden="true" className={'h-2 w-2 rounded-full ' + (connected ? 'bg-emerald-400' : 'bg-amber-400')} />
            {connected ? 'Live updates connected' : 'Refreshing every 15 seconds'}
          </span>
          <Button size="sm" variant="ghost" onClick={() => refresh()}>Refresh</Button>
        </div>
      </div>

      {passwordForm && (
        <Card className="p-4 sm:p-5">
          <form onSubmit={changePassword} className="space-y-4">
            <h2 className="font-semibold text-slate-100">Change password</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Current password">
                <input type="password" autoComplete="current-password" className={inputClass} required value={passwordForm.currentPassword} onChange={(event) => setPasswordForm({ ...passwordForm, currentPassword: event.target.value })} />
              </Field>
              <Field label="New password">
                <input type="password" autoComplete="new-password" className={inputClass} required minLength={12} maxLength={72} value={passwordForm.password} onChange={(event) => setPasswordForm({ ...passwordForm, password: event.target.value })} />
              </Field>
            </div>
            <p className="text-xs text-slate-400">Use at least 12 characters. You’ll sign in again after saving.</p>
            <FormActions pending={pending} onCancel={() => setPasswordForm(null)} />
          </form>
        </Card>
      )}

      {notice && (
        <div className={'rounded-xl border px-4 py-3 text-sm ' + (notice.error ? 'border-rose-400/25 bg-rose-500/10 text-rose-200' : 'border-emerald-400/25 bg-emerald-500/10 text-emerald-200')} role={notice.error ? 'alert' : 'status'}>
          {notice.message}
        </div>
      )}

      {['words', 'matches'].includes(tab) && categoryRequest.error && <PanelStatus request={categoryRequest} onRetry={() => refresh('catalog')} />}

      <Card className="p-4 sm:p-6">
        {tab === 'words' && <WordsPanel {...panelProps} categories={categories} revision={versions.catalog} initialCategory={initialCategory} />}
        {tab === 'categories' && <CategoriesPanel {...panelProps} categories={categories} request={categoryRequest} viewWords={viewWords} />}
        {tab === 'settings' && admin.isHeadAdmin && <GameSettingsPanel {...panelProps} />}
        {tab === 'matches' && admin.isHeadAdmin && <MatchesPanel {...panelProps} categories={categories} revision={versions.matches} />}
        {tab === 'admins' && admin.isHeadAdmin && <AccountsPanel {...panelProps} revision={versions.admins} />}
      </Card>
    </main>
  );
}
