'use strict';

(function () {
  const STORAGE_KEY = 'cv_active_role';
  const AUTH_ACTIVITY_KEY = 'cv_last_auth_activity_ms';
  const DEFAULT_IDLE_TIMEOUT_MS = 30 * 60 * 1000;

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

  function assertSafePublicKey(key) {
    const token = String(key || '').trim();
    if (!token) throw new Error('Missing Supabase publishable key.');
    if (/service_role/i.test(token) || /^sb_secret_/i.test(token)) {
      throw new Error('Refusing to run with a privileged Supabase key in frontend code.');
    }
    return token;
  }

  function isStrongPassword(password) {
    const value = String(password || '');
    const longEnough = value.length >= 12;
    const hasLower = /[a-z]/.test(value);
    const hasUpper = /[A-Z]/.test(value);
    const hasDigit = /\d/.test(value);
    const hasSpecial = /[^A-Za-z0-9]/.test(value);
    return longEnough && hasLower && hasUpper && hasDigit && hasSpecial;
  }

  function passwordPolicyMessage() {
    return 'Password must be at least 12 characters and include uppercase, lowercase, number, and special character.';
  }

  function touchAuthActivity() {
    try { localStorage.setItem(AUTH_ACTIVITY_KEY, String(Date.now())); } catch (_) {}
  }

  function startSessionInactivityGuard(onExpired, timeoutMs = DEFAULT_IDLE_TIMEOUT_MS) {
    const expire = () => {
      try {
        const last = Number(localStorage.getItem(AUTH_ACTIVITY_KEY) || '0');
        if (!last || (Date.now() - last) > timeoutMs) onExpired?.();
      } catch (_) {
        onExpired?.();
      }
    };

    const bump = () => touchAuthActivity();
    ['click', 'keydown', 'mousemove', 'touchstart', 'scroll'].forEach(evt => {
      window.addEventListener(evt, bump, { passive: true });
    });
    touchAuthActivity();
    const interval = window.setInterval(expire, 60 * 1000);
    return () => window.clearInterval(interval);
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
    getSessionWithRole,
    assertSafePublicKey,
    isStrongPassword,
    passwordPolicyMessage,
    touchAuthActivity,
    startSessionInactivityGuard
  };
})();
