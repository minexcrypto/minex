'use strict';

(function () {
  const STORAGE_KEY = 'cv_active_role';

  function persistRole(role) {
    try {
      localStorage.setItem(STORAGE_KEY, role);
    } catch (_) {}
  }

  function clearRole() {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (_) {}
  }

  async function isAdminUser(sb, user) {
    if (!sb || !user) return false;
    if (user.app_metadata?.role === 'admin') return true;

    try {
      const { data } = await sb.from('admins').select('id').eq('id', user.id).maybeSingle();
      if (data) return true;
    } catch (_) {}

    try {
      const { data } = await sb.from('profiles').select('is_admin').eq('id', user.id).maybeSingle();
      if (data?.is_admin === true) return true;
    } catch (_) {}

    return false;
  }

  async function resolveUserRole(sb, user) {
    const isAdmin = await isAdminUser(sb, user);
    const role = isAdmin ? 'admin' : 'user';
    persistRole(role);
    return role;
  }

  async function getSessionWithRole(sb) {
    if (!sb) return { session: null, user: null, role: null };
    const { data: { session } } = await sb.auth.getSession();
    if (!session?.user) return { session: null, user: null, role: null };
    const role = await resolveUserRole(sb, session.user);
    return { session, user: session.user, role };
  }

  window.CVAuthRole = {
    STORAGE_KEY,
    persistRole,
    clearRole,
    isAdminUser,
    resolveUserRole,
    getSessionWithRole
  };
})();

