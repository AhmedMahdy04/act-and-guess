import { useState } from 'react';
import { adminApi } from '../../../../lib/adminApi';
import Button from '../../../../components/ui/Button';
import {
  Badge, cellClass, Field, FormActions, formatDate, headClass, inputClass, PanelStatus,
  PanelTitle, RowAction, rowClass, tableClass, useAdminData
} from './controls';

const NEW_ACCOUNT = { email: '', password: '' };

export function AccountsPanel({ revision, refresh, onUnauthorized, execute, pending }) {
  const [editor, setEditor] = useState(null);
  const request = useAdminData(adminApi.listAdmins, revision, onUnauthorized);

  async function save(event) {
    event.preventDefault();
    const saved = await execute(
      () => adminApi.createAdmin({ email: editor.email, password: editor.password }),
      editor.restoring ? 'Account restored.' : 'Admin account created.',
      'admins'
    );
    if (saved) setEditor(null);
  }

  return (
    <div className="space-y-5">
      <PanelTitle title="Admin accounts" description="Grant access to the catalog and revoke it when an administrator leaves.">
        <Button size="sm" disabled={pending} onClick={() => setEditor(NEW_ACCOUNT)}>Add account</Button>
      </PanelTitle>

      {editor && (
        <form onSubmit={save} className="space-y-4 rounded-2xl border border-indigo-400/20 bg-indigo-950/25 p-4">
          <h3 className="font-semibold text-slate-100">{editor.restoring ? 'Restore admin account' : 'New admin account'}</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Email">
              <input className={inputClass} type="email" autoComplete="off" required maxLength={254} readOnly={editor.restoring} value={editor.email} onChange={(event) => setEditor({ ...editor, email: event.target.value })} />
            </Field>
            <Field label="Initial password">
              <input className={inputClass} type="password" autoComplete="new-password" minLength={12} maxLength={72} required value={editor.password} onChange={(event) => setEditor({ ...editor, password: event.target.value })} />
            </Field>
          </div>
          <p className="text-xs text-slate-400">Use at least 12 characters.</p>
          <FormActions pending={pending} onCancel={() => setEditor(null)} label={editor.restoring ? 'Restore account' : 'Create account'} />
        </form>
      )}

      <PanelStatus request={request} onRetry={() => refresh('admins')} />

      {request.data && (
        <div className="overflow-x-auto rounded-xl border border-white/10" aria-busy={request.loading}>
          <table className={tableClass}>
            <thead className={headClass}>
              <tr>
                <th scope="col" className={cellClass}>Account</th>
                <th scope="col" className={cellClass}>Access</th>
                <th scope="col" className={cellClass}>Last sign-in</th>
                <th scope="col" className={cellClass + ' text-right'}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {request.data.admins.map((account) => (
                <tr className={rowClass} key={account.id}>
                  <td className={cellClass + ' break-all font-semibold text-slate-100'}>{account.email}</td>
                  <td className={cellClass}>
                    <Badge tone={account.disabledAt ? 'hard' : account.isHeadAdmin ? 'indigo' : 'neutral'}>
                      {account.disabledAt ? 'Disabled' : account.isHeadAdmin ? 'Head admin' : 'Catalog admin'}
                    </Badge>
                  </td>
                  <td className={cellClass + ' whitespace-nowrap'}>{formatDate(account.lastLoginAt)}</td>
                  <td className={cellClass + ' text-right'}>
                    {!account.isHeadAdmin && (account.disabledAt ? (
                      <RowAction disabled={pending} onClick={() => setEditor({ email: account.email, password: '', restoring: true })}>Restore</RowAction>
                    ) : (
                      <RowAction danger disabled={pending} onClick={() => {
                        if (window.confirm('Disable this account and end its active sessions?')) {
                          execute(() => adminApi.disableAdmin(account), 'Account disabled.', 'admins');
                        }
                      }}>Disable</RowAction>
                    ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export function MatchesPanel({ categories, revision, refresh, onUnauthorized }) {
  const request = useAdminData(adminApi.listMatches, revision, onUnauthorized);
  const categoryNames = new Map(categories.map((category) => [category.slug, category.name]));
  const matches = request.data?.matches || [];

  return (
    <div className="space-y-5">
      <PanelTitle title="Recent game rooms" description="The 30 most recently updated rooms and their recorded match counts." />
      <PanelStatus request={request} onRetry={() => refresh('matches')} />
      {request.data && (
        <div className="overflow-x-auto rounded-xl border border-white/10" aria-busy={request.loading}>
          <table className={tableClass}>
            <thead className={headClass}>
              <tr>
                <th scope="col" className={cellClass}>Category</th>
                <th scope="col" className={cellClass}>Status</th>
                <th scope="col" className={cellClass}>Players</th>
                <th scope="col" className={cellClass}>Rounds</th>
                <th scope="col" className={cellClass}>Matches</th>
                <th scope="col" className={cellClass}>Last updated</th>
              </tr>
            </thead>
            <tbody>
              {matches.map((match) => (
                <tr className={rowClass} key={match.id}>
                  <td className={cellClass}>
                    <p className="font-semibold capitalize text-slate-100">{categoryNames.get(match.category) || match.category?.replaceAll('_', ' ') || 'Random'}</p>
                    <p className="mt-1 text-xs capitalize text-slate-400">{match.visibility} · {match.difficulty}</p>
                  </td>
                  <td className={cellClass}><Badge tone={match.status === 'playing' ? 'easy' : 'neutral'}>{match.status?.replaceAll('_', ' ') || 'Lobby'}</Badge></td>
                  <td className={cellClass}>{match.playerCount} <span className="whitespace-nowrap text-xs text-slate-400">/ {match.teamCount || 0} teams</span></td>
                  <td className={cellClass}>{match.currentRound || 0}</td>
                  <td className={cellClass}>{match.completedMatches}</td>
                  <td className={cellClass + ' whitespace-nowrap'}>{formatDate(match.updatedAt || match.createdAt)}</td>
                </tr>
              ))}
              {!matches.length && <tr><td colSpan={6} className="p-7 text-center text-slate-400">No game rooms have been saved yet.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
