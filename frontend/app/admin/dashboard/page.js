'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import Card from '../../../components/ui/Card';
import Button from '../../../components/ui/Button';
import Logo from '../../../components/Logo';
import { adminApi } from '../../../lib/adminApi';

const TABS = [
  { id: 'words', label: 'Words' },
  { id: 'categories', label: 'Categories' },
  { id: 'admins', label: 'Admins' }
];

const DIFFICULTIES = ['easy', 'medium', 'hard', 'mixed'];

export default function AdminDashboard() {
  const router = useRouter();
  const [admin, setAdmin] = useState(null);
  const [tab, setTab] = useState('words');
  const [loading, setLoading] = useState(true);

  // Words state
  const [words, setWords] = useState([]);
  const [wordPage, setWordPage] = useState(1);
  const [wordTotal, setWordTotal] = useState(0);
  const [wordFilter, setWordFilter] = useState({ category: '', difficulty: '', search: '' });
  const [showWordForm, setShowWordForm] = useState(false);
  const [wordForm, setWordForm] = useState({ word: '', category: '', difficulty: 'medium' });
  const [editingWord, setEditingWord] = useState(null);

  // Categories state
  const [categories, setCategories] = useState([]);
  const [showCatForm, setShowCatForm] = useState(false);
  const [catForm, setCatForm] = useState({ name: '', description: '', icon: '', difficulty: 'medium' });
  const [editingCat, setEditingCat] = useState(null);

  // Admins state
  const [admins, setAdmins] = useState([]);
  const [showAdminForm, setShowAdminForm] = useState(false);
  const [adminForm, setAdminForm] = useState({ email: '', password: '' });

  useEffect(() => {
    const token = localStorage.getItem('admin_token');
    if (!token) {
      router.replace('/admin/login');
      return;
    }

    const saved = localStorage.getItem('admin_user');
    if (saved) {
      try {
        setAdmin(JSON.parse(saved));
      } catch {
        localStorage.removeItem('admin_token');
        localStorage.removeItem('admin_user');
        router.replace('/admin/login');
        return;
      }
    }

    adminApi.me()
      .then((data) => {
        setAdmin(data);
        localStorage.setItem('admin_user', JSON.stringify(data));
      })
      .catch(() => {
        logout();
      })
      .finally(() => setLoading(false));
  }, [router]);

  useEffect(() => {
    if (!admin) return;
    if (tab === 'words') loadWords();
    if (tab === 'categories') loadCategories();
    if (tab === 'admins') loadAdmins();
  }, [tab, wordPage, wordFilter, admin]);

  const logout = () => {
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_user');
    router.push('/admin/login');
  };

  // ── Words ──
  const loadWords = async () => {
    try {
      const params = { page: wordPage, limit: 20 };
      if (wordFilter.category) params.category = wordFilter.category;
      if (wordFilter.difficulty) params.difficulty = wordFilter.difficulty;
      if (wordFilter.search) params.search = wordFilter.search;
      const data = await adminApi.listWords(params);
      setWords(data.words || []);
      setWordTotal(data.total || 0);
    } catch (err) {
      console.error('Failed to load words:', err.message);
    }
  };

  const handleSaveWord = async (e) => {
    e.preventDefault();
    try {
      if (editingWord) {
        await adminApi.updateWord(editingWord._id, wordForm);
      } else {
        await adminApi.createWord(wordForm);
      }
      setShowWordForm(false);
      setEditingWord(null);
      setWordForm({ word: '', category: '', difficulty: 'medium' });
      loadWords();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleDeleteWord = async (id) => {
    if (!confirm('Delete this word?')) return;
    try {
      await adminApi.deleteWord(id);
      loadWords();
    } catch (err) {
      alert(err.message);
    }
  };

  // ── Categories ──
  const loadCategories = async () => {
    try {
      const data = await adminApi.listCategories();
      setCategories(data.categories || []);
    } catch (err) {
      console.error('Failed to load categories:', err.message);
    }
  };

  const handleSaveCat = async (e) => {
    e.preventDefault();
    try {
      if (editingCat) {
        await adminApi.updateCategory(editingCat._id, catForm);
      } else {
        await adminApi.createCategory(catForm);
      }
      setShowCatForm(false);
      setEditingCat(null);
      setCatForm({ name: '', description: '', icon: '', difficulty: 'medium' });
      loadCategories();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleDeleteCat = async (id) => {
    if (!confirm('Delete this category? Associated words will not be deleted but will show as uncategorized.')) return;
    try {
      await adminApi.deleteCategory(id);
      loadCategories();
    } catch (err) {
      alert(err.message);
    }
  };

  // ── Admins ──
  const loadAdmins = async () => {
    try {
      const data = await adminApi.listAdmins();
      setAdmins(data.admins || []);
    } catch (err) {
      console.error('Failed to load admins:', err.message);
    }
  };

  const handleCreateAdmin = async (e) => {
    e.preventDefault();
    try {
      await adminApi.createAdmin(adminForm.email, adminForm.password);
      setShowAdminForm(false);
      setAdminForm({ email: '', password: '' });
      loadAdmins();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleDeleteAdmin = async (id) => {
    if (!confirm('Delete this admin?')) return;
    try {
      await adminApi.deleteAdmin(id);
      loadAdmins();
    } catch (err) {
      alert(err.message);
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-slate-500">Loading...</div>
      </main>
    );
  }

  const isHead = admin?.role === 'head';
  const totalPages = Math.ceil(wordTotal / 20);

  return (
    <main className="min-h-screen p-4 sm:p-6 lg:p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div className="flex items-center gap-4">
            <Logo size="md" />
            <div>
              <h1 className="text-lg font-bold text-slate-200">Admin Dashboard</h1>
              <p className="text-xs text-slate-500">Signed in as {admin?.email}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => router.push('/')}>Back to Game</Button>
            <Button variant="outline" size="sm" onClick={logout}>Logout</Button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 bg-base-900 border border-white/[0.06] rounded-xl p-1 mb-6 overflow-x-auto">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition ${
                tab === t.id
                  ? 'bg-primary text-white'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          {tab === 'words' && (
            <motion.div
              key="words"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.15 }}
            >
              <Card className="p-5">
                <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between mb-4">
                  <h2 className="text-base font-bold text-slate-200">Words</h2>
                  <Button size="sm" onClick={() => { setEditingWord(null); setWordForm({ word: '', category: '', difficulty: 'medium' }); setShowWordForm(true); }}>
                    + Add Word
                  </Button>
                </div>

                <div className="flex flex-wrap gap-2 mb-4">
                  <input
                    type="text"
                    placeholder="Search words..."
                    value={wordFilter.search}
                    onChange={(e) => { setWordFilter((f) => ({ ...f, search: e.target.value })); setWordPage(1); }}
                    className="bg-base-800 border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                  <select
                    value={wordFilter.difficulty}
                    onChange={(e) => { setWordFilter((f) => ({ ...f, difficulty: e.target.value })); setWordPage(1); }}
                    className="bg-base-800 border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none"
                  >
                    <option value="">All difficulties</option>
                    {DIFFICULTIES.map((d) => <option key={d} value={d}>{d}</option>)}
                  </select>
                  <select
                    value={wordFilter.category}
                    onChange={(e) => { setWordFilter((f) => ({ ...f, category: e.target.value })); setWordPage(1); }}
                    className="bg-base-800 border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none"
                  >
                    <option value="">All categories</option>
                    {categories.map((c) => <option key={c._id} value={c.name}>{c.name}</option>)}
                  </select>
                </div>

                {showWordForm && (
                  <form onSubmit={handleSaveWord} className="bg-base-900 border border-white/[0.06] rounded-xl p-4 mb-4 space-y-3">
                    <h3 className="text-sm font-bold text-slate-300">{editingWord ? 'Edit Word' : 'New Word'}</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <input
                        type="text"
                        placeholder="Word"
                        value={wordForm.word}
                        onChange={(e) => setWordForm((f) => ({ ...f, word: e.target.value }))}
                        required
                        className="bg-base-800 border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:outline-none"
                      />
                      <input
                        type="text"
                        placeholder="Category"
                        value={wordForm.category}
                        onChange={(e) => setWordForm((f) => ({ ...f, category: e.target.value }))}
                        required
                        className="bg-base-800 border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:outline-none"
                      />
                      <select
                        value={wordForm.difficulty}
                        onChange={(e) => setWordForm((f) => ({ ...f, difficulty: e.target.value }))}
                        className="bg-base-800 border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none"
                      >
                        {DIFFICULTIES.map((d) => <option key={d} value={d}>{d}</option>)}
                      </select>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" type="submit">Save</Button>
                      <Button variant="outline" size="sm" onClick={() => setShowWordForm(false)}>Cancel</Button>
                    </div>
                  </form>
                )}

                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="text-xs text-slate-500 uppercase border-b border-white/[0.06]">
                      <tr>
                        <th className="px-3 py-2">Word</th>
                        <th className="px-3 py-2">Category</th>
                        <th className="px-3 py-2">Difficulty</th>
                        <th className="px-3 py-2 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {words.map((w) => (
                        <tr key={w._id} className="border-b border-white/[0.04] hover:bg-white/[0.02]">
                          <td className="px-3 py-2 text-slate-300 font-medium">{w.word}</td>
                          <td className="px-3 py-2 text-slate-400">{w.category || '—'}</td>
                          <td className="px-3 py-2">
                            <span className={`text-xs px-2 py-0.5 rounded-full ${
                              w.difficulty === 'easy' ? 'bg-emerald-500/10 text-emerald-300' :
                              w.difficulty === 'hard' ? 'bg-rose-500/10 text-rose-300' :
                              'bg-amber-500/10 text-amber-300'
                            }`}>{w.difficulty}</span>
                          </td>
                          <td className="px-3 py-2 text-right space-x-2">
                            <button
                              onClick={() => { setEditingWord(w); setWordForm({ word: w.word, category: w.category, difficulty: w.difficulty }); setShowWordForm(true); }}
                              className="text-primary hover:underline text-xs"
                            >Edit</button>
                            <button
                              onClick={() => handleDeleteWord(w._id)}
                              className="text-rose-400 hover:underline text-xs"
                            >Delete</button>
                          </td>
                        </tr>
                      ))}
                      {!words.length && (
                        <tr><td colSpan={4} className="px-3 py-6 text-center text-slate-500">No words found.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {totalPages > 1 && (
                  <div className="flex items-center justify-center gap-2 mt-4">
                    <Button size="sm" variant="outline" disabled={wordPage <= 1} onClick={() => setWordPage((p) => Math.max(1, p - 1))}>Prev</Button>
                    <span className="text-sm text-slate-400">Page {wordPage} of {totalPages}</span>
                    <Button size="sm" variant="outline" disabled={wordPage >= totalPages} onClick={() => setWordPage((p) => Math.min(totalPages, p + 1))}>Next</Button>
                  </div>
                )}
              </Card>
            </motion.div>
          )}

          {tab === 'categories' && (
            <motion.div
              key="categories"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.15 }}
            >
              <Card className="p-5">
                <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between mb-4">
                  <h2 className="text-base font-bold text-slate-200">Categories</h2>
                  <Button size="sm" onClick={() => { setEditingCat(null); setCatForm({ name: '', description: '', icon: '', difficulty: 'medium' }); setShowCatForm(true); }}>
                    + Add Category
                  </Button>
                </div>

                {showCatForm && (
                  <form onSubmit={handleSaveCat} className="bg-base-900 border border-white/[0.06] rounded-xl p-4 mb-4 space-y-3">
                    <h3 className="text-sm font-bold text-slate-300">{editingCat ? 'Edit Category' : 'New Category'}</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <input
                        type="text"
                        placeholder="Name"
                        value={catForm.name}
                        onChange={(e) => setCatForm((f) => ({ ...f, name: e.target.value }))}
                        required
                        className="bg-base-800 border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:outline-none"
                      />
                      <input
                        type="text"
                        placeholder="Icon (emoji)"
                        value={catForm.icon}
                        onChange={(e) => setCatForm((f) => ({ ...f, icon: e.target.value }))}
                        className="bg-base-800 border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:outline-none"
                      />
                      <input
                        type="text"
                        placeholder="Description"
                        value={catForm.description}
                        onChange={(e) => setCatForm((f) => ({ ...f, description: e.target.value }))}
                        className="bg-base-800 border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:outline-none sm:col-span-2"
                      />
                      <select
                        value={catForm.difficulty}
                        onChange={(e) => setCatForm((f) => ({ ...f, difficulty: e.target.value }))}
                        className="bg-base-800 border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none"
                      >
                        {DIFFICULTIES.map((d) => <option key={d} value={d}>{d}</option>)}
                      </select>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" type="submit">Save</Button>
                      <Button variant="outline" size="sm" onClick={() => setShowCatForm(false)}>Cancel</Button>
                    </div>
                  </form>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {categories.map((c) => (
                    <div key={c._id} className="bg-base-900 border border-white/[0.06] rounded-xl p-4 hover:border-white/[0.12] transition">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <span className="text-2xl">{c.icon || '📦'}</span>
                          <div>
                            <h3 className="text-sm font-bold text-slate-200">{c.name}</h3>
                            <p className="text-xs text-slate-500">{c.description || 'No description'}</p>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => { setEditingCat(c); setCatForm({ name: c.name, description: c.description || '', icon: c.icon || '', difficulty: c.difficulty }); setShowCatForm(true); }} className="text-primary hover:underline text-xs">Edit</button>
                          <button onClick={() => handleDeleteCat(c._id)} className="text-rose-400 hover:underline text-xs">Delete</button>
                        </div>
                      </div>
                    </div>
                  ))}
                  {!categories.length && (
                    <div className="col-span-full text-center text-slate-500 py-8">No categories found.</div>
                  )}
                </div>
              </Card>
            </motion.div>
          )}

          {tab === 'admins' && (
            <motion.div
              key="admins"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.15 }}
            >
              <Card className="p-5">
                <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between mb-4">
                  <h2 className="text-base font-bold text-slate-200">Admins</h2>
                  {isHead && (
                    <Button size="sm" onClick={() => { setAdminForm({ email: '', password: '' }); setShowAdminForm(true); }}>
                      + Add Admin
                    </Button>
                  )}
                </div>

                {showAdminForm && (
                  <form onSubmit={handleCreateAdmin} className="bg-base-900 border border-white/[0.06] rounded-xl p-4 mb-4 space-y-3">
                    <h3 className="text-sm font-bold text-slate-300">New Admin</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <input
                        type="email"
                        placeholder="Email"
                        value={adminForm.email}
                        onChange={(e) => setAdminForm((f) => ({ ...f, email: e.target.value }))}
                        required
                        className="bg-base-800 border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:outline-none"
                      />
                      <input
                        type="password"
                        placeholder="Password"
                        value={adminForm.password}
                        onChange={(e) => setAdminForm((f) => ({ ...f, password: e.target.value }))}
                        required
                        className="bg-base-800 border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:outline-none"
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" type="submit">Create</Button>
                      <Button variant="outline" size="sm" onClick={() => setShowAdminForm(false)}>Cancel</Button>
                    </div>
                  </form>
                )}

                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="text-xs text-slate-500 uppercase border-b border-white/[0.06]">
                      <tr>
                        <th className="px-3 py-2">Email</th>
                        <th className="px-3 py-2">Role</th>
                        <th className="px-3 py-2">Created</th>
                        <th className="px-3 py-2 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {admins.map((a) => (
                        <tr key={a._id} className="border-b border-white/[0.04] hover:bg-white/[0.02]">
                          <td className="px-3 py-2 text-slate-300">{a.email}</td>
                          <td className="px-3 py-2">
                            <span className={`text-xs px-2 py-0.5 rounded-full ${
                              a.role === 'head' ? 'bg-amber-500/10 text-amber-300' : 'bg-slate-500/10 text-slate-300'
                            }`}>{a.role}</span>
                          </td>
                          <td className="px-3 py-2 text-slate-500 text-xs">{new Date(a.createdAt).toLocaleDateString()}</td>
                          <td className="px-3 py-2 text-right">
                            {isHead && a.role !== 'head' && (
                              <button onClick={() => handleDeleteAdmin(a._id)} className="text-rose-400 hover:underline text-xs">Delete</button>
                            )}
                          </td>
                        </tr>
                      ))}
                      {!admins.length && (
                        <tr><td colSpan={4} className="px-3 py-6 text-center text-slate-500">No admins found.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </main>
  );
}

