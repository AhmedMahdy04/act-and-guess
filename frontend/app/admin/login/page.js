'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import Card from '../../../components/ui/Card';
import Button from '../../../components/ui/Button';
import Logo from '../../../components/Logo';
import { adminApi } from '../../../lib/adminApi';

export default function AdminLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const data = await adminApi.login(email, password);
      localStorage.setItem('admin_token', data.token);
      localStorage.setItem('admin_user', JSON.stringify(data.admin));
      router.push('/admin/dashboard');
    } catch (err) {
      setError(err.message || 'Login failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="w-full max-w-sm"
      >
        <div className="text-center mb-6">
          <Logo size="lg" className="justify-center mb-2" />
          <h1 className="text-xl font-bold text-slate-200">Admin Portal</h1>
          <p className="text-sm text-slate-500">Sign in to manage words and categories.</p>
        </div>

        <Card className="p-6 sm:p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-semibold text-slate-400">Email</span>
              <input
                type="email"
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
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full bg-base-800 border border-white/[0.08] rounded-xl px-4 py-3.5 text-base text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </label>

            {error && (
              <div className="text-center text-rose-200 bg-rose-500/10 border border-rose-500/20 rounded-xl px-4 py-3 text-sm">
                {error}
              </div>
            )}

            <Button type="submit" disabled={loading} size="lg" className="w-full justify-center">
              {loading ? 'Signing in...' : 'Sign In'}
            </Button>
          </form>
        </Card>
      </motion.div>
    </main>
  );
}

