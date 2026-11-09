const { authenticate } = require('./adminService');
const { onCatalogChanged } = require('./wordService');

let namespace;
let matchRefreshTimer;

function registerAdminEvents(io) {
  namespace = io.of('/admin');
  const stopCatalogEvents = onCatalogChanged(() => notifyAdmins('catalog'));
  io.httpServer.once('close', stopCatalogEvents);
  namespace.use(async (socket, next) => {
    try {
      const session = await authenticate(socket.handshake.auth?.token);
      if (!session) return next(new Error('Sign in to continue.'));
      socket.data.adminSession = session;
      next();
    } catch {
      next(new Error('Admin events are unavailable.'));
    }
  });

  namespace.on('connection', (socket) => {
    const { admin, key, expiresAt } = socket.data.adminSession;
    socket.join([`account:${admin.id}`, `session:${key}`, ...(admin.isHeadAdmin ? ['head-admins'] : [])]);
    const expire = setTimeout(() => socket.disconnect(), Math.max(0, expiresAt - Date.now()));
    socket.once('disconnect', () => clearTimeout(expire));
  });
}

function notifyAdmins(scope) {
  if (scope === 'catalog') namespace?.emit('admin:changed', scope);
  else namespace?.to('head-admins').emit('admin:changed', scope);
}

function notifyMatchChanged() {
  if (!namespace?.adapter.rooms.has('head-admins') || matchRefreshTimer) return;
  matchRefreshTimer = setTimeout(() => {
    matchRefreshTimer = undefined;
    notifyAdmins('matches');
  }, 750);
  matchRefreshTimer.unref();
}

function disconnectAdminSessions(adminId) {
  namespace?.in(`account:${adminId}`).disconnectSockets();
}

function disconnectAdminSession(key) {
  namespace?.in(`session:${key}`).disconnectSockets();
}

module.exports = { registerAdminEvents, notifyAdmins, notifyMatchChanged, disconnectAdminSession, disconnectAdminSessions };
