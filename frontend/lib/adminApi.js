import { io } from 'socket.io-client';

const API_BASE = (process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4001').replace(/\/+$/, '');
const TOKEN_KEY = 'admin_token';

export function getAdminToken() {
  return sessionStorage.getItem(TOKEN_KEY);
}

export function storeAdminToken(token) {
  sessionStorage.setItem(TOKEN_KEY, token);
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem('admin_user');
}

export function clearAdminToken() {
  sessionStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem('admin_user');
}

async function fetchAdmin(path, { method = 'GET', body, signal } = {}) {
  const token = getAdminToken();
  const res = await fetch(API_BASE + '/api/admin' + path, {
    method,
    signal,
    cache: 'no-store',
    body: body === undefined ? undefined : JSON.stringify(body),
    headers: {
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...(token ? { Authorization: 'Bearer ' + token } : {})
    }
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw Object.assign(new Error(data.error || 'Admin request failed (' + res.status + ').'), { status: res.status });
  }

  return data;
}

function revision(record) {
  return { expectedUpdatedAt: record.updatedAt, expectedVersion: record.version };
}

function recordPath(collection, record) {
  return '/' + collection + '/' + encodeURIComponent(record.id);
}

export function subscribeToAdminChanges(onStatus, onChange) {
  const socket = io(API_BASE + '/admin', { autoConnect: false, auth: { token: getAdminToken() } });
  socket.on('connect', () => {
    onStatus(true);
    onChange();
  });
  socket.on('disconnect', () => onStatus(false));
  socket.on('connect_error', () => onStatus(false));
  socket.on('admin:changed', onChange);
  socket.connect();
  return () => {
    socket.removeAllListeners();
    socket.disconnect();
  };
}

export const adminApi = {
  login: (email, password) => fetchAdmin('/login', { method: 'POST', body: { email, password } }),
  logout: () => fetchAdmin('/logout', { method: 'POST' }),
  me: (signal) => fetchAdmin('/me', { signal }),
  changePassword: (body) => fetchAdmin('/me/password', { method: 'POST', body }),

  listWords: (params, signal) => fetchAdmin('/words?' + new URLSearchParams(params).toString(), { signal }),
  createWord: (body) => fetchAdmin('/words', { method: 'POST', body }),
  updateWord: (record, body) => fetchAdmin(recordPath('words', record), { method: 'PUT', body: { ...body, ...revision(record) } }),
  archiveWord: (record) => fetchAdmin(recordPath('words', record), { method: 'DELETE', body: revision(record) }),

  listCategories: (signal) => fetchAdmin('/categories', { signal }),
  createCategory: (body) => fetchAdmin('/categories', { method: 'POST', body }),
  updateCategory: (record, body) => fetchAdmin(recordPath('categories', record), { method: 'PUT', body: { ...body, ...revision(record) } }),
  archiveCategory: (record) => fetchAdmin(recordPath('categories', record), { method: 'DELETE', body: revision(record) }),

  listAdmins: (signal) => fetchAdmin('/admins', { signal }),
  createAdmin: (body) => fetchAdmin('/admins', { method: 'POST', body }),
  disableAdmin: (record) => fetchAdmin(recordPath('admins', record), { method: 'DELETE' }),

  listMatches: (signal) => fetchAdmin('/matches', { signal })
};
