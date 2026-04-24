const API_BASE = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4001';

function getToken() {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('admin_token');
}

async function fetchAdmin(path, options = {}) {
  const token = getToken();
  const res = await fetch(`${API_BASE}/api/admin${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers
    }
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const error = new Error(data.error || `Request failed (${res.status})`);
    error.status = res.status;
    throw error;
  }

  return data;
}

export const adminApi = {
  login: (email, password) =>
    fetchAdmin('/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    }),

  me: () => fetchAdmin('/me'),

  listWords: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return fetchAdmin(`/words?${query}`);
  },

  createWord: (word) =>
    fetchAdmin('/words', {
      method: 'POST',
      body: JSON.stringify(word)
    }),

  updateWord: (id, word) =>
    fetchAdmin(`/words/${id}`, {
      method: 'PUT',
      body: JSON.stringify(word)
    }),

  deleteWord: (id) =>
    fetchAdmin(`/words/${id}`, { method: 'DELETE' }),

  listCategories: () => fetchAdmin('/categories'),

  createCategory: (category) =>
    fetchAdmin('/categories', {
      method: 'POST',
      body: JSON.stringify(category)
    }),

  updateCategory: (id, category) =>
    fetchAdmin(`/categories/${id}`, {
      method: 'PUT',
      body: JSON.stringify(category)
    }),

  deleteCategory: (id) =>
    fetchAdmin(`/categories/${id}`, { method: 'DELETE' }),

  listAdmins: () => fetchAdmin('/admins'),

  createAdmin: (email, password) =>
    fetchAdmin('/admins', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    }),

  deleteAdmin: (id) =>
    fetchAdmin(`/admins/${id}`, { method: 'DELETE' })
};

