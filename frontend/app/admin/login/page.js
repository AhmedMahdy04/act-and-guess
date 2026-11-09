'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Card from '../../../components/ui/Card';
import Button from '../../../components/ui/Button';
import Logo from '../../../components/Logo';
import { adminApi, storeAdminToken } from '../../../lib/adminApi';

export default function AdminLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    setError('');

    try {
      const data = await adminApi.login(email, password);
      storeAdminToken(data.token);
      router.replace('/admin/dashboard');
    } catch (err) {
      setError(err.message || 'Login failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex items-center justify-center px-4 py-12 sm:py-20">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <Logo size="lg" className="justify-center mb-2" />
          <h1 className="text-2xl font-bold text-slate-100">Admin sign-in</h1>
          <p className="mt-1 text-sm text-slate-400">Manage the game’s word library and categories.</p>
        </div>

        <Card className="p-6 sm:p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-semibold text-slate-400">Email</span>
              <input
                type="email"
                autoComplete="username"
                maxLength={254}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@example.com"
                required
                className="w-full bg-base-800 border border-white/[0.08] rounded-xl px-4 py-3.5 text-base text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-semibold text-slate-400">Password</span>
              <input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full bg-base-800 border border-white/[0.08] rounded-xl px-4 py-3.5 text-base text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </label>

            {error && (
              <div role="alert" className="text-center text-rose-200 bg-rose-500/10 border border-rose-500/20 rounded-xl px-4 py-3 text-sm">
                {error}
              </div>
            )}

            <Button type="submit" disabled={loading} size="lg" className="w-full justify-center">
              {loading ? 'Signing in...' : 'Sign In'}
            </Button>
          </form>
        </Card>
        <p className="mt-5 text-center">
          <Link href="/" className="text-sm font-semibold text-indigo-200 hover:underline">Back to game</Link>
        </p>
      </div>
    </main>
  );
}

