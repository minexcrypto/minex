/* ══════════════════════════════════════════════════════════════════════
   CRYPTOVAULT — admin.js  (final, production build)

   Auth:      Supabase Auth — email + password
   SDK:       window.supabase  (CDN global, @supabase/supabase-js v2)
   Tables:    deposits   (id, user_id, amount, status, created_at)
              profiles   (id, email, name, balance)
              transactions (id, user_id, type, amount, status)
              contracts  (id, user_id, plan, hashrate, active)

   Deploy:    Works on Cloudflare Workers / Pages static hosting.
              Credentials injected via window globals BEFORE this file.

   REQUIRED in HTML before this script:
     <script>
       window.CRYPTOVAULT_SUPABASE_URL = "https://fwgqydxkdbuzrehqifjw.supabase.co";
       window.CRYPTOVAULT_SUPABASE_KEY = "sb_publishable_Pbn_Z0wwsqMUyLWYg3udmQ_MC-Qz1k";
     </script>
     <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js"></script>
     <script src="admin.js"></script>
══════════════════════════════════════════════════════════════════════ */

'use strict';

/* ══════════════════════════════════════════════════════════════════════
   §1  SUPABASE CLIENT
       window.supabase is the CDN UMD global from @supabase/supabase-js v2.
       The .createClient method lives directly on that object.
══════════════════════════════════════════════════════════════════════ */

/** @type {import('@supabase/supabase-js').SupabaseClient | null} */
let sb = null;

/**
 * Initialise the Supabase client from window globals.
 * Returns true on success, false with a visible banner on failure.
 * Never throws.
 */
function initSupabaseClient() {
  const url = window.CRYPTOVAULT_SUPABASE_URL || '';
  const key = window.CRYPTOVAULT_SUPABASE_KEY || '';

  if (!url || !key) {
    AdminUI.banner(
      '⚠ Supabase credentials missing. ' +
      'Define window.CRYPTOVAULT_SUPABASE_URL and window.CRYPTOVAULT_SUPABASE_KEY ' +
      'before admin.js loads.',
      'error'
    );
    return false;
  }

  // window.supabase is set by the CDN UMD bundle
  if (typeof window.supabase?.createClient !== 'function') {
    AdminUI.banner(
      '⚠ Supabase SDK not found. ' +
      'Load the CDN script before admin.js.',
      'error'
    );
    return false;
  }

  try {
    sb = window.supabase.createClient(url, key);
    return true;
  } catch (err) {
    AdminUI.banner('⚠ Supabase init error: ' + err.message, 'error');
    return false;
  }
}

/* ══════════════════════════════════════════════════════════════════════
   §2  SAFE DOM HELPERS
       All selectors are wrapped — missing elements never throw.
══════════════════════════════════════════════════════════════════════ */

/** @param {string} sel @param {ParentNode} [ctx] */
const $  = (sel, ctx = document) => { try { return ctx.querySelector(sel);     } catch { return null; } };
/** @param {string} sel @param {ParentNode} [ctx] */
const $$ = (sel, ctx = document) => { try { return [...ctx.querySelectorAll(sel)]; } catch { return []; } };

/** Set innerHTML safely. sel can be a CSS string or an Element. */
function setHTML(sel, html)  { const el = resolve(sel); if (el) el.innerHTML  = html;  }
/** Set textContent safely. */
function setText(sel, text)  { const el = resolve(sel); if (el) el.textContent = text; }
/** Remove display:none. */
function show(sel)           { const el = resolve(sel); if (el) el.style.display = ''; }
/** Set display:none. */
function hide(sel)           { const el = resolve(sel); if (el) el.style.display = 'none'; }
/** Attach an event listener safely. */
function on(sel, evt, fn, ctx = document) {
  const el = typeof sel === 'string' ? $(sel, ctx) : sel;
  if (el) el.addEventListener(evt, fn);
}
/** Resolve a selector string or return an element directly. */
function resolve(sel) { return typeof sel === 'string' ? $(sel) : (sel || null); }

/* ══════════════════════════════════════════════════════════════════════
   §3  UI PRIMITIVES  — toast, banner, loaders, badges
══════════════════════════════════════════════════════════════════════ */

const AdminUI = {

  /* ── Toast (bottom-right notification) ─────────────────────────── */
  toast(msg, type = 'info', ms = 4000) {
    let wrap = document.getElementById('_cvToastWrap');
    if (!wrap) {
      wrap = document.createElement('div');
      wrap.id = '_cvToastWrap';
      Object.assign(wrap.style, {
        position: 'fixed', bottom: '24px', right: '24px',
        zIndex: '9999', display: 'flex', flexDirection: 'column', gap: '10px',
      });
      document.body.appendChild(wrap);
    }

    const palette = {
      success: '#10b981', error: '#ef4444', info: '#f59e0b', warning: '#f97316',
    };
    const icons = { success: '✅', error: '❌', info: '💡', warning: '⚠️' };
    const border = palette[type] || palette.info;

    const t = document.createElement('div');
    t.style.cssText = [
      'background:#111720', 'border:1px solid #1e2d45',
      `border-left:3px solid ${border}`, 'border-radius:12px',
      'padding:14px 18px', 'display:flex', 'align-items:center', 'gap:12px',
      'font-size:13px', 'color:#94a3b8', 'min-width:280px', 'max-width:400px',
      'box-shadow:0 4px 24px rgba(0,0,0,.45)',
      'animation:_cvSlideIn .3s ease',
    ].join(';');

    t.innerHTML =
      `<span style="font-size:17px;flex-shrink:0">${icons[type] || '💡'}</span>` +
      `<span style="flex:1;line-height:1.45">${msg}</span>`;

    wrap.appendChild(t);

    setTimeout(() => {
      Object.assign(t.style, { opacity: '0', transform: 'translateX(16px)', transition: '.3s ease' });
      setTimeout(() => t.remove(), 320);
    }, ms);
  },

  /* ── Full-width config / error banner ───────────────────────────── */
  banner(msg, type = 'warning') {
    const colours = { warning: '#f59e0b', error: '#ef4444', success: '#10b981', info: '#3b82f6' };
    const c = colours[type] || colours.warning;
    const id = '_cvBanner';
    document.getElementById(id)?.remove();
    const b = document.createElement('div');
    b.id = id;
    b.style.cssText =
      `background:${c}18;border-bottom:1px solid ${c}44;` +
      `padding:11px 24px;font-size:13px;font-weight:600;color:${c};text-align:center;`;
    b.textContent = msg;
    document.body.prepend(b);
  },

  /* ── Section loading skeleton ────────────────────────────────────── */
  loading(msg = 'Loading…') {
    return `
      <div style="padding:48px;text-align:center;color:#475569;font-size:13px;">
        <div style="width:26px;height:26px;border:2px solid #1e2d45;border-top-color:#f59e0b;
          border-radius:50%;animation:_cvSpin .8s linear infinite;margin:0 auto 14px;"></div>
        ${msg}
      </div>`;
  },

  /* ── Error state ─────────────────────────────────────────────────── */
  error(msg = 'Failed to load data.') {
    return `<div style="padding:48px;text-align:center;color:#ef4444;font-size:13px;">❌ ${msg}</div>`;
  },

  /* ── Empty state ─────────────────────────────────────────────────── */
  empty(msg = 'No records found.') {
    return `<div style="padding:48px;text-align:center;color:#475569;font-size:13px;">📭 ${msg}</div>`;
  },

  /* ── Status badge ────────────────────────────────────────────────── */
  badge(status) {
    const map = {
      pending:  { bg: 'rgba(245,158,11,.15)',  fg: '#f59e0b', label: 'Pending'  },
      approved: { bg: 'rgba(16,185,129,.15)',  fg: '#10b981', label: 'Approved' },
      rejected: { bg: 'rgba(239,68,68,.15)',   fg: '#ef4444', label: 'Rejected' },
      active:   { bg: 'rgba(16,185,129,.15)',  fg: '#10b981', label: 'Active'   },
      inactive: { bg: 'rgba(100,116,139,.15)', fg: '#64748b', label: 'Inactive' },
      completed:{ bg: 'rgba(59,130,246,.15)',  fg: '#3b82f6', label: 'Completed'},
      mining:   { bg: 'rgba(249,115,22,.15)',  fg: '#f97316', label: 'Mining'   },
      deposit:  { bg: 'rgba(16,185,129,.15)',  fg: '#10b981', label: 'Deposit'  },
      withdrawal:{ bg:'rgba(239,68,68,.15)',   fg: '#ef4444', label: 'Withdrawal'},
      referral: { bg: 'rgba(139,92,246,.15)',  fg: '#8b5cf6', label: 'Referral' },
    };
    const s = map[String(status).toLowerCase()] || {
      bg: 'rgba(100,116,139,.15)', fg: '#64748b', label: status || '—',
    };
    return `<span style="
      display:inline-flex;align-items:center;padding:3px 10px;border-radius:20px;
      font-size:11px;font-weight:700;background:${s.bg};color:${s.fg};
      white-space:nowrap;">${s.label}</span>`;
  },

  /* ── Switch active tab ───────────────────────────────────────────── */
  activateTab(name) {
    $$('[data-admin-tab]').forEach(btn =>
      btn.classList.toggle('active', btn.dataset.adminTab === name)
    );
    $$('[data-admin-section]').forEach(sec =>
      Object.assign(sec.style, { display: sec.dataset.adminSection === name ? '' : 'none' })
    );
    const TITLES = {
      overview:     'Dashboard Overview',
      deposits:     'Deposit Requests',
      users:        'User Management',
      transactions: 'Transaction History',
      contracts:    'Mining Contracts',
      settings:     'Admin Settings',
    };
    setText('#adminPageTitle', TITLES[name] || name);
  },
};

/* inject keyframes once */
(() => {
  if (document.getElementById('_cvKF')) return;
  const s = document.createElement('style');
  s.id = '_cvKF';
  s.textContent = `
    @keyframes _cvSlideIn { from{opacity:0;transform:translateX(14px)} to{opacity:1;transform:translateX(0)} }
    @keyframes _cvSpin    { to{transform:rotate(360deg)} }
    @keyframes _cvFadeUp  { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
    .admin-btn {
      display:inline-flex;align-items:center;justify-content:center;gap:6px;
      padding:6px 13px;border-radius:8px;font-size:12px;font-weight:600;
      cursor:pointer;border:none;transition:all .2s;font-family:inherit;
      white-space:nowrap;
    }
    .admin-btn:disabled { opacity:.5;cursor:default; }
    .admin-btn-approve  { background:rgba(16,185,129,.15);color:#10b981; }
    .admin-btn-approve:hover:not(:disabled) { background:rgba(16,185,129,.25); }
    .admin-btn-reject   { background:rgba(239,68,68,.15);color:#ef4444; }
    .admin-btn-reject:hover:not(:disabled)  { background:rgba(239,68,68,.25); }
    .admin-btn-outline  { background:rgba(255,255,255,.04);color:#94a3b8;border:1px solid #1e2d45; }
    .admin-btn-outline:hover:not(:disabled) { border-color:#f59e0b;color:#f59e0b; }
    .admin-btn-primary  { background:linear-gradient(135deg,#f59e0b,#f97316);color:#080b10; }
    .admin-btn-primary:hover:not(:disabled) { filter:brightness(1.1); }
  `;
  document.head.appendChild(s);
})();

/* shared <th> style string */
const TH = [
  'font-size:11px', 'font-weight:700', 'letter-spacing:.8px',
  'text-transform:uppercase', 'color:#475569', 'padding:11px 16px',
  'text-align:left', 'white-space:nowrap', 'border-bottom:1px solid #1e2d45',
].join(';');

/* shared <td> style string */
const TD = 'padding:13px 16px;font-size:13px;color:#94a3b8;border-bottom:1px solid rgba(30,45,69,.5);';

/* ══════════════════════════════════════════════════════════════════════
   §4  ADMIN AUTH
       • Supabase email + password login (confirmed spec).
       • Role verified via three progressive strategies so it works
         regardless of whether the project uses app_metadata, a custom
         admins table, or a role column on the profiles table.
══════════════════════════════════════════════════════════════════════ */

const AdminAuth = {
  /** @type {import('@supabase/supabase-js').User | null} */
  user: null,

  /* ── Check an existing Supabase session ─────────────────────────── */
  async check() {
    if (!sb) return false;
    let user;
    try {
      const { data, error } = await sb.auth.getUser();
      if (error || !data?.user) return false;
      user = data.user;
    } catch {
      return false;
    }
    if (!(await this._isAdmin(user))) return false;
    this.user = user;
    this._fillUI(user);
    return true;
  },

  /* ── Login with email + password ────────────────────────────────── */
  async login(email, password) {
    if (!sb) throw new Error('Supabase client not ready.');

    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    if (error) throw new Error(error.message);

    const user = data.user;

    if (!(await this._isAdmin(user))) {
      // Sign out immediately so the session is not persisted
      await sb.auth.signOut().catch(() => {});
      throw new Error('Access denied — this account does not have admin privileges.');
    }

    this.user = user;
    this._fillUI(user);
    return user;
  },

  /* ── Logout ─────────────────────────────────────────────────────── */
  async logout() {
    if (sb) await sb.auth.signOut().catch(() => {});
    this.user = null;
    hide('#adminAppShell');
    show('#adminLoginScreen');
    setHTML('#adminLoginError', '');
  },

  /* ── Role verification (three strategies, in order) ──────────────
     1. app_metadata.role === 'admin'         (set via service-key / SQL)
     2. 'admins' table row matching user.id
     3. profiles.role === 'admin'
  ─────────────────────────────────────────────────────────────────── */
  async _isAdmin(user) {
    // Strategy 1 — app_metadata (most reliable, set server-side)
    if (user?.app_metadata?.role === 'admin') return true;

    // Strategy 2 — separate admins table: CREATE TABLE admins (id uuid PRIMARY KEY)
    try {
      const { data, error } = await sb
        .from('admins')
        .select('id')
        .eq('id', user.id)
        .maybeSingle();
      if (!error && data) return true;
    } catch { /* table may not exist — skip */ }

    // Strategy 3 — profiles.role column
    try {
      const { data, error } = await sb
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .maybeSingle();
      if (!error && data?.role === 'admin') return true;
    } catch { /* skip */ }

    return false;
  },

  _fillUI(user) {
    const name  = user.user_metadata?.name || user.email?.split('@')[0] || 'Admin';
    const email = user.email || '';
    setText('#adminUserName',   name);
    setText('#adminUserEmail',  email);
    const av = document.getElementById('adminAvatarText');
    if (av) av.textContent = (email[0] || 'A').toUpperCase();
  },
};

/* ══════════════════════════════════════════════════════════════════════
   §5  LOGIN FORM
══════════════════════════════════════════════════════════════════════ */

function initLoginForm() {
  const form   = document.getElementById('adminLoginForm');
  const errEl  = document.getElementById('adminLoginError');
  const btnEl  = document.getElementById('adminLoginBtn');
  const passEl = document.getElementById('adminLoginPassword');
  const eyeEl  = document.getElementById('adminTogglePassword');

  if (!form) return; // admin.html may not have a login screen

  // Password visibility toggle
  on(eyeEl, 'click', () => {
    if (!passEl) return;
    passEl.type = passEl.type === 'password' ? 'text' : 'password';
    if (eyeEl) eyeEl.textContent = passEl.type === 'password' ? '👁' : '🙈';
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const email    = (document.getElementById('adminLoginEmail')?.value || '').trim();
    const password = passEl?.value || '';

    if (!email || !password) {
      if (errEl) errEl.textContent = 'Email and password are required.';
      return;
    }

    if (errEl) errEl.textContent = '';
    if (btnEl) { btnEl.disabled = true; btnEl.textContent = 'Signing in…'; }

    try {
      await AdminAuth.login(email, password);
      hide('#adminLoginScreen');
      show('#adminAppShell');
      await _bootPanel();
    } catch (err) {
      if (errEl) errEl.textContent = err.message;
    } finally {
      if (btnEl) { btnEl.disabled = false; btnEl.textContent = 'Sign In'; }
    }
  });
}

/* ══════════════════════════════════════════════════════════════════════
   §6  BTC PRICE WIDGET  (CoinGecko — safe fallback if unavailable)
══════════════════════════════════════════════════════════════════════ */

const PriceService = {
  _handlers: [],
  current: null,

  onChange(fn) { this._handlers.push(fn); },

  async fetch() {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 8000);
      const res = await fetch(
        'https://api.coingecko.com/api/v3/simple/price' +
        '?ids=bitcoin&vs_currencies=usd&include_24hr_change=true',
        { signal: ctrl.signal }
      );
      clearTimeout(timer);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const json = await res.json();
      const price  = json?.bitcoin?.usd   ?? null;
      const change = json?.bitcoin?.usd_24h_change ?? null;
      if (price !== null) {
        this.current = { price, change };
        this._handlers.forEach(fn => fn(this.current));
      }
    } catch {
      // silent — UI shows '--' until a fetch succeeds
    }
  },

  fmt(n) {
    if (n == null) return '--';
    return '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  },

  start(ms = 30_000) {
    this.fetch();
    setInterval(() => this.fetch(), ms);
  },
};

function initPriceWidget() {
  PriceService.onChange(({ price, change }) => {
    const priceStr  = PriceService.fmt(price);
    const up        = change != null && change >= 0;
    const changeStr = change != null
      ? (up ? '▲ ' : '▼ ') + Math.abs(change).toFixed(2) + '%'
      : '--';
    const colour    = change != null ? (up ? '#10b981' : '#ef4444') : '#64748b';

    $$('.admin-btc-price').forEach(el => { el.textContent = priceStr; });
    $$('.admin-btc-change').forEach(el => {
      el.textContent  = changeStr;
      el.style.color  = colour;
    });
    setText('#overviewBTCPrice', priceStr);
  });

  PriceService.start();
}

/* ══════════════════════════════════════════════════════════════════════
   §7  OVERVIEW / DASHBOARD STATS
       All queries are independent — one failure never blocks another.
══════════════════════════════════════════════════════════════════════ */

const OverviewModule = {

  async load() {
    // Run all four stat queries in parallel; settle individually
    await Promise.allSettled([
      this._depositStats(),
      this._userStats(),
      this._contractStats(),
      this._transactionStats(),
    ]);
  },

  async _depositStats() {
    try {
      // Select only the columns we need — no join required here
      const { data, error } = await sb
        .from('deposits')
        .select('amount, status');
      if (error) throw error;

      const rows     = data || [];
      const pending  = rows.filter(r => r.status === 'pending');
      const approved = rows.filter(r => r.status === 'approved');
      const rejected = rows.filter(r => r.status === 'rejected');
      const volume   = approved.reduce((s, r) => s + Number(r.amount || 0), 0);

      setText('#overviewTotalDeposits',   rows.length);
      setText('#overviewApprovedVolume',  volume.toFixed(6) + ' BTC');
      setText('#overviewPendingDeposits', pending.length);
      setText('#overviewRejectedDeposits', rejected.length);

      // Keep sidebar / filter badges in sync
      setText('#sidebarDepositBadge', pending.length > 0 ? pending.length : '');
      setText('#depositCountPending',  pending.length);
      setText('#depositCountApproved', approved.length);
      setText('#depositCountRejected', rejected.length);
    } catch (err) {
      console.warn('[CryptoVault] deposit stats:', err.message);
    }
  },

  async _userStats() {
    try {
      // head:true returns only the count, no row data
      const { count, error } = await sb
        .from('profiles')
        .select('id', { count: 'exact', head: true });
      if (error) throw error;
      setText('#overviewTotalUsers', count ?? '—');
    } catch (err) {
      console.warn('[CryptoVault] user stats:', err.message);
    }
  },

  async _contractStats() {
    try {
      const { data, error } = await sb
        .from('contracts')
        .select('active, hashrate');
      if (error) throw error;

      const rows      = data || [];
      const active    = rows.filter(r => r.active === true);
      const totalHash = active.reduce((s, r) => s + Number(r.hashrate || 0), 0);

      setText('#overviewActiveContracts', active.length);
      setText('#overviewTotalHashrate',   totalHash.toFixed(1) + ' TH/s');
    } catch (err) {
      console.warn('[CryptoVault] contract stats:', err.message);
    }
  },

  async _transactionStats() {
    try {
      const { count, error } = await sb
        .from('transactions')
        .select('id', { count: 'exact', head: true });
      if (error) throw error;
      setText('#overviewTotalTxns', count ?? '—');
    } catch (err) {
      console.warn('[CryptoVault] transaction stats:', err.message);
    }
  },
};

/* ══════════════════════════════════════════════════════════════════════
   §8  DEPOSITS MODULE
       Table: deposits (id, user_id, amount, status, created_at)
       Joined: profiles (email, name) via user_id → profiles.id
══════════════════════════════════════════════════════════════════════ */

const DepositsModule = {
  /** @type {Array} */
  _rows: [],

  /* ── Load (with optional status filter) ─────────────────────────── */
  async load(statusFilter = 'all') {
    const container = document.getElementById('depositsTableWrap');
    if (!container || !sb) return;

    setHTML(container, AdminUI.loading('Loading deposits…'));

    try {
      // Join profiles to show name + email
      let q = sb
        .from('deposits')
        .select('id, user_id, amount, status, created_at, profiles(email, name)')
        .order('created_at', { ascending: false })
        .limit(300);

      if (statusFilter !== 'all') q = q.eq('status', statusFilter);

      const { data, error } = await q;
      if (error) throw error;

      this._rows = data || [];
      this._render(container, this._rows);
      this._syncBadges(this._rows);
    } catch (err) {
      setHTML(container, AdminUI.error('Could not load deposits: ' + err.message));
    }
  },

  /* ── Render table ────────────────────────────────────────────────── */
  _render(container, rows) {
    if (!rows.length) { setHTML(container, AdminUI.empty('No deposit records.')); return; }

    const tbodyHTML = rows.map(d => {
      const email  = d.profiles?.email || '—';
      const name   = d.profiles?.name  || '—';
      const amount = Number(d.amount   || 0).toFixed(8);
      const date   = d.created_at
        ? new Date(d.created_at).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })
        : '—';

      const actions = d.status === 'pending'
        ? `<button class="admin-btn admin-btn-approve"
              data-action="approve" data-id="${d.id}">✅ Approve</button>
           <button class="admin-btn admin-btn-reject"
              style="margin-left:6px"
              data-action="reject" data-id="${d.id}">❌ Reject</button>`
        : `<span style="font-size:12px;color:#475569">—</span>`;

      return `
        <tr data-deposit-row="${d.id}">
          <td style="${TD};font-family:monospace;font-size:11px;color:#64748b">
            ${String(d.id || '').slice(0, 8)}…
          </td>
          <td style="${TD}">
            <div style="font-weight:600;color:#f1f5f9;font-size:13px">${name}</div>
            <div style="font-size:11px;color:#64748b;margin-top:2px">${email}</div>
          </td>
          <td style="${TD};font-family:monospace;color:#fbbf24;font-weight:600">
            ${amount} <span style="font-size:10px;color:#64748b">BTC</span>
          </td>
          <td data-status-cell="${d.id}" style="${TD}">${AdminUI.badge(d.status)}</td>
          <td style="${TD};font-size:12px;color:#64748b">${date}</td>
          <td data-actions-cell="${d.id}" style="${TD}">${actions}</td>
        </tr>`;
    }).join('');

    const tableHTML = `
      <table style="width:100%;border-collapse:collapse">
        <thead>
          <tr>
            <th style="${TH}">ID</th>
            <th style="${TH}">User</th>
            <th style="${TH}">Amount</th>
            <th style="${TH}">Status</th>
            <th style="${TH}">Date</th>
            <th style="${TH}">Actions</th>
          </tr>
        </thead>
        <tbody id="depositsBody">${tbodyHTML}</tbody>
      </table>`;

    setHTML(container, tableHTML);

    // Single delegated listener on the tbody
    on('#depositsBody', 'click', (e) => {
      const btn = e.target.closest('[data-action][data-id]');
      if (!btn || btn.disabled) return;
      this.updateStatus(btn.dataset.id, btn.dataset.action === 'approve' ? 'approved' : 'rejected');
    }, container);
  },

  /* ── Approve / Reject a deposit ─────────────────────────────────── */
  async updateStatus(depositId, newStatus) {
    if (!sb || !depositId) return;

    // Disable both action buttons immediately (optimistic lock)
    $$(`[data-actions-cell="${depositId}"] .admin-btn`).forEach(btn => {
      btn.disabled = true;
      btn.textContent = 'Saving…';
    });

    try {
      const { error } = await sb
        .from('deposits')
        .update({ status: newStatus })
        .eq('id', depositId);

      if (error) throw error;

      // Update badge in row without a full re-render
      setHTML(`[data-status-cell="${depositId}"]`, AdminUI.badge(newStatus));
      setHTML(`[data-actions-cell="${depositId}"]`, '<span style="font-size:12px;color:#475569">—</span>');

      // Patch local cache
      this._rows = this._rows.map(r =>
        r.id === depositId ? { ...r, status: newStatus } : r
      );
      this._syncBadges(this._rows);

      // Credit user balance when approving
      if (newStatus === 'approved') await this._creditBalance(depositId);

      AdminUI.toast(
        `Deposit ${depositId.slice(0, 8)}… marked as <strong>${newStatus}</strong>.`,
        newStatus === 'approved' ? 'success' : 'warning'
      );
    } catch (err) {
      // Re-enable buttons so the admin can retry
      const row = document.querySelector(`[data-deposit-row="${depositId}"]`);
      const actCell = row?.querySelector(`[data-actions-cell="${depositId}"]`);
      if (actCell) {
        actCell.innerHTML =
          `<button class="admin-btn admin-btn-approve" data-action="approve" data-id="${depositId}">✅ Approve</button>
           <button class="admin-btn admin-btn-reject" style="margin-left:6px"
             data-action="reject" data-id="${depositId}">❌ Reject</button>`;
      }
      AdminUI.toast('Update failed: ' + err.message, 'error');
    }
  },

  /* ── Credit balance on approval ─────────────────────────────────── */
  async _creditBalance(depositId) {
    const dep = this._rows.find(r => r.id === depositId);
    if (!dep?.user_id || !dep?.amount) return;

    // Prefer an atomic RPC if the project has one:
    //   CREATE FUNCTION increment_user_balance(p_user_id uuid, p_amount numeric)
    const { error: rpcErr } = await sb.rpc('increment_user_balance', {
      p_user_id: dep.user_id,
      p_amount:  dep.amount,
    });

    if (!rpcErr) return; // RPC handled it

    // Fallback: read-modify-write on profiles.balance
    try {
      const { data: profile, error: fetchErr } = await sb
        .from('profiles')
        .select('balance')
        .eq('id', dep.user_id)
        .maybeSingle();

      if (fetchErr || profile == null) throw fetchErr || new Error('Profile not found');

      const newBalance = Number(profile.balance || 0) + Number(dep.amount);
      const { error: updateErr } = await sb
        .from('profiles')
        .update({ balance: newBalance })
        .eq('id', dep.user_id);

      if (updateErr) throw updateErr;
    } catch (err) {
      // Non-fatal — the status was already updated; log for manual reconciliation
      console.warn('[CryptoVault] balance credit failed for deposit', depositId, err.message);
      AdminUI.toast('⚠ Deposit approved but balance credit failed — check manually.', 'warning', 7000);
    }
  },

  /* ── Sync sidebar / filter count badges ─────────────────────────── */
  _syncBadges(rows) {
    const pending  = rows.filter(r => r.status === 'pending').length;
    const approved = rows.filter(r => r.status === 'approved').length;
    const rejected = rows.filter(r => r.status === 'rejected').length;
    setText('#depositCountPending',  pending);
    setText('#depositCountApproved', approved);
    setText('#depositCountRejected', rejected);
    setText('#overviewPendingDeposits', pending);
    setText('#sidebarDepositBadge', pending > 0 ? String(pending) : '');
  },
};

/* ══════════════════════════════════════════════════════════════════════
   §9  USERS MODULE
       Table: profiles (id, email, name, balance)
══════════════════════════════════════════════════════════════════════ */

const UsersModule = {
  /** @type {Array} */
  _rows: [],

  async load() {
    const container = document.getElementById('usersTableWrap');
    if (!container || !sb) return;

    setHTML(container, AdminUI.loading('Loading users…'));

    try {
      const { data, error } = await sb
        .from('profiles')
        .select('id, email, name, balance, level, is_active, created_at')
        .order('created_at', { ascending: false })
        .limit(500);

      if (error) throw error;

      this._rows = data || [];
      this._render(container, this._rows);
      setText('#overviewTotalUsers', this._rows.length);
      setText('#overviewActiveUsers', this._rows.filter(u => u.is_active !== false).length);
    } catch (err) {
      setHTML(container, AdminUI.error('Could not load users: ' + err.message));
    }
  },

  _render(container, rows) {
    if (!rows.length) { setHTML(container, AdminUI.empty('No users found.')); return; }

    const tbodyHTML = rows.map(u => {
      const joined  = u.created_at
        ? new Date(u.created_at).toLocaleDateString('en-US', { dateStyle: 'medium' })
        : '—';
      const balance = Number(u.balance || 0).toFixed(8);
      const active  = u.is_active !== false;

      return `
        <tr>
          <td style="${TD};font-family:monospace;font-size:11px;color:#64748b">
            ${String(u.id || '').slice(0, 8)}…
          </td>
          <td style="${TD}">
            <div style="font-weight:600;color:#f1f5f9;font-size:13px">${u.name || '—'}</div>
            <div style="font-size:11px;color:#64748b;margin-top:2px">${u.email || '—'}</div>
          </td>
          <td style="${TD};font-family:monospace;color:#fbbf24;font-weight:500">
            ${balance} <span style="font-size:10px;color:#64748b">BTC</span>
          </td>
          <td style="${TD};font-size:12px;color:#94a3b8">${u.level || 'Starter'}</td>
          <td style="${TD}">${AdminUI.badge(active ? 'active' : 'inactive')}</td>
          <td style="${TD};font-size:12px;color:#64748b">${joined}</td>
          <td style="${TD}">
            <button class="admin-btn admin-btn-outline"
              onclick="UsersModule.viewUser('${u.id}')">View</button>
            <button class="admin-btn ${active ? 'admin-btn-reject' : 'admin-btn-approve'}"
              style="margin-left:6px"
              onclick="UsersModule.toggleActive('${u.id}', ${active})">
              ${active ? 'Suspend' : 'Reinstate'}
            </button>
          </td>
        </tr>`;
    }).join('');

    setHTML(container, `
      <table style="width:100%;border-collapse:collapse">
        <thead>
          <tr>
            <th style="${TH}">ID</th>
            <th style="${TH}">User</th>
            <th style="${TH}">Balance</th>
            <th style="${TH}">Level</th>
            <th style="${TH}">Status</th>
            <th style="${TH}">Joined</th>
            <th style="${TH}">Actions</th>
          </tr>
        </thead>
        <tbody>${tbodyHTML}</tbody>
      </table>`);
  },

  viewUser(userId) {
    const u = this._rows.find(r => r.id === userId);
    if (!u) return;
    AdminUI.toast(
      `<strong>${u.name || u.email}</strong> &mdash; ` +
      `Balance: ${Number(u.balance || 0).toFixed(8)} BTC &mdash; ` +
      `Level: ${u.level || 'Starter'}`,
      'info', 6000
    );
  },

  async toggleActive(userId, currentlyActive) {
    if (!sb) return;
    try {
      const { error } = await sb
        .from('profiles')
        .update({ is_active: !currentlyActive })
        .eq('id', userId);
      if (error) throw error;
      AdminUI.toast(
        `User ${currentlyActive ? 'suspended' : 'reinstated'} successfully.`,
        currentlyActive ? 'warning' : 'success'
      );
      // Mark section as needing a refresh
      _loaded.delete('users');
      await this.load();
    } catch (err) {
      AdminUI.toast('Failed: ' + err.message, 'error');
    }
  },
};

// Expose for inline onclick handlers in the rendered table HTML
window.UsersModule = UsersModule;

/* ══════════════════════════════════════════════════════════════════════
   §10  TRANSACTIONS MODULE
        Table: transactions (id, user_id, type, amount, status)
        Joined: profiles (email) via user_id
══════════════════════════════════════════════════════════════════════ */

const TransactionsModule = {

  async load(typeFilter = 'all') {
    const container = document.getElementById('transactionsTableWrap');
    if (!container || !sb) return;

    setHTML(container, AdminUI.loading('Loading transactions…'));

    try {
      let q = sb
        .from('transactions')
        .select('id, user_id, type, amount, status, created_at, profiles(email, name)')
        .order('created_at', { ascending: false })
        .limit(400);

      if (typeFilter !== 'all') q = q.eq('type', typeFilter);

      const { data, error } = await q;
      if (error) throw error;

      const rows = data || [];
      if (!rows.length) { setHTML(container, AdminUI.empty('No transactions found.')); return; }

      const TYPE_ICON = {
        mining: '⛏️', deposit: '📥', withdrawal: '📤',
        referral: '👥', transfer: '↔️',
      };

      const tbodyHTML = rows.map(tx => {
        const email  = tx.profiles?.email || '—';
        const name   = tx.profiles?.name  || email;
        const amount = Number(tx.amount || 0).toFixed(8);
        const date   = tx.created_at
          ? new Date(tx.created_at).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })
          : '—';
        const isOut  = tx.type === 'withdrawal';
        const amtCol = isOut ? '#ef4444' : '#10b981';
        const amtPfx = isOut ? '−' : '+';

        return `
          <tr>
            <td style="${TD};font-family:monospace;font-size:11px;color:#64748b">
              ${String(tx.id || '').slice(0, 8)}…
            </td>
            <td style="${TD}">
              <div style="font-size:13px;font-weight:600;color:#f1f5f9">${name}</div>
              <div style="font-size:11px;color:#64748b;margin-top:2px">${email}</div>
            </td>
            <td style="${TD}">
              <span style="font-size:15px;margin-right:6px">${TYPE_ICON[tx.type] || '💱'}</span>
              <span style="font-size:12px;color:#94a3b8">${tx.type || '—'}</span>
            </td>
            <td style="${TD};font-family:monospace;font-weight:600;color:${amtCol}">
              ${amtPfx}${amount} <span style="font-size:10px;color:#64748b">BTC</span>
            </td>
            <td style="${TD}">${AdminUI.badge(tx.status)}</td>
            <td style="${TD};font-size:12px;color:#64748b">${date}</td>
          </tr>`;
      }).join('');

      setHTML(container, `
        <table style="width:100%;border-collapse:collapse">
          <thead>
            <tr>
              <th style="${TH}">ID</th>
              <th style="${TH}">User</th>
              <th style="${TH}">Type</th>
              <th style="${TH}">Amount</th>
              <th style="${TH}">Status</th>
              <th style="${TH}">Date</th>
            </tr>
          </thead>
          <tbody>${tbodyHTML}</tbody>
        </table>`);
    } catch (err) {
      setHTML(container, AdminUI.error('Could not load transactions: ' + err.message));
    }
  },
};

/* ══════════════════════════════════════════════════════════════════════
   §11  CONTRACTS MODULE  (read-only for now)
        Table: contracts (id, user_id, plan, hashrate, active)
══════════════════════════════════════════════════════════════════════ */

const ContractsModule = {

  async load() {
    const container = document.getElementById('contractsTableWrap');
    if (!container || !sb) return;

    setHTML(container, AdminUI.loading('Loading contracts…'));

    try {
      const { data, error } = await sb
        .from('contracts')
        .select('id, user_id, plan, hashrate, active, created_at, profiles(email, name)')
        .order('created_at', { ascending: false })
        .limit(300);

      if (error) throw error;

      const rows = data || [];
      if (!rows.length) { setHTML(container, AdminUI.empty('No contracts found.')); return; }

      const tbodyHTML = rows.map(c => {
        const email   = c.profiles?.email || '—';
        const name    = c.profiles?.name  || email;
        const date    = c.created_at
          ? new Date(c.created_at).toLocaleDateString('en-US', { dateStyle: 'medium' })
          : '—';
        const hashrate = Number(c.hashrate || 0).toFixed(1);

        return `
          <tr>
            <td style="${TD};font-family:monospace;font-size:11px;color:#64748b">
              ${String(c.id || '').slice(0, 8)}…
            </td>
            <td style="${TD}">
              <div style="font-size:13px;font-weight:600;color:#f1f5f9">${name}</div>
              <div style="font-size:11px;color:#64748b;margin-top:2px">${email}</div>
            </td>
            <td style="${TD};font-size:13px;font-weight:600;color:#f1f5f9">${c.plan || '—'}</td>
            <td style="${TD};font-family:monospace;color:#fbbf24;font-weight:500">
              ${hashrate} <span style="font-size:10px;color:#64748b">TH/s</span>
            </td>
            <td style="${TD}">${AdminUI.badge(c.active ? 'active' : 'inactive')}</td>
            <td style="${TD};font-size:12px;color:#64748b">${date}</td>
          </tr>`;
      }).join('');

      setHTML(container, `
        <table style="width:100%;border-collapse:collapse">
          <thead>
            <tr>
              <th style="${TH}">ID</th>
              <th style="${TH}">User</th>
              <th style="${TH}">Plan</th>
              <th style="${TH}">Hashrate</th>
              <th style="${TH}">Status</th>
              <th style="${TH}">Started</th>
            </tr>
          </thead>
          <tbody>${tbodyHTML}</tbody>
        </table>`);
    } catch (err) {
      setHTML(container, AdminUI.error('Could not load contracts: ' + err.message));
    }
  },
};

/* ══════════════════════════════════════════════════════════════════════
   §12  SEARCH / FILTER WIRING
══════════════════════════════════════════════════════════════════════ */

function initFilters() {
  // Deposit status dropdown — server-side filter
  on('#depositStatusFilter', 'change', e => {
    _loaded.delete('deposits');
    DepositsModule.load(e.target.value || 'all');
    _loaded.add('deposits');
  });

  // Transaction type dropdown — server-side filter
  on('#transactionTypeFilter', 'change', e => {
    _loaded.delete('transactions');
    TransactionsModule.load(e.target.value || 'all');
    _loaded.add('transactions');
  });

  // Client-side search for deposits
  on('#depositSearchInput', 'input', e => {
    const term = e.target.value.toLowerCase();
    $$('#depositsTableWrap tbody tr').forEach(row => {
      row.style.display = row.textContent.toLowerCase().includes(term) ? '' : 'none';
    });
  });

  // Client-side search for users
  on('#userSearchInput', 'input', e => {
    const term = e.target.value.toLowerCase();
    $$('#usersTableWrap tbody tr').forEach(row => {
      row.style.display = row.textContent.toLowerCase().includes(term) ? '' : 'none';
    });
  });
}

/* ══════════════════════════════════════════════════════════════════════
   §13  REALTIME  (optional Supabase channel — graceful no-op if absent)
══════════════════════════════════════════════════════════════════════ */

function initRealtime() {
  if (typeof sb?.channel !== 'function') return; // realtime not in this SDK version

  try {
    sb.channel('admin-realtime')
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'deposits' },
        payload => {
          if (payload.new?.status === 'pending') {
            AdminUI.toast('🆕 New deposit request received.', 'info', 6000);
            setText('#sidebarDepositBadge',
              String((parseInt(document.getElementById('sidebarDepositBadge')?.textContent || '0') + 1))
            );
          }
          // Refresh deposits list if it's already loaded
          if (_loaded.has('deposits')) {
            const filter = document.getElementById('depositStatusFilter')?.value || 'all';
            DepositsModule.load(filter);
          }
          if (_loaded.has('overview')) OverviewModule.load();
        }
      )
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'transactions' },
        () => {
          if (_loaded.has('overview')) OverviewModule.load();
        }
      )
      .subscribe(status => {
        if (status === 'SUBSCRIBED') {
          console.info('[CryptoVault] Realtime subscribed.');
        }
      });
  } catch (err) {
    console.warn('[CryptoVault] Realtime unavailable:', err.message);
  }
}

/* ══════════════════════════════════════════════════════════════════════
   §14  NAVIGATION  (tabs + mobile sidebar + logout)
══════════════════════════════════════════════════════════════════════ */

/** Tracks which sections have been loaded at least once this session. */
const _loaded = new Set();

function initNavigation() {
  // Tab buttons (sidebar links)
  $$('[data-admin-tab]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const name = btn.dataset.adminTab;
      AdminUI.activateTab(name);
      await loadSection(name);
      // Close mobile drawer
      document.getElementById('adminSidebar')?.classList.remove('open');
      document.getElementById('adminSidebarOverlay')?.classList.remove('open');
    });
  });

  // Mobile hamburger
  on('#adminMenuToggle', 'click', () => {
    document.getElementById('adminSidebar')?.classList.toggle('open');
    document.getElementById('adminSidebarOverlay')?.classList.toggle('open');
  });
  on('#adminSidebarOverlay', 'click', () => {
    document.getElementById('adminSidebar')?.classList.remove('open');
    document.getElementById('adminSidebarOverlay')?.classList.remove('open');
  });

  // Logout — any element with data-admin-logout
  $$('[data-admin-logout]').forEach(btn => {
    btn.addEventListener('click', () => AdminAuth.logout());
  });
}

/** Load a section's data lazily (once per session unless cleared). */
async function loadSection(name) {
  if (_loaded.has(name)) return;
  _loaded.add(name);

  switch (name) {
    case 'overview':     await OverviewModule.load();     break;
    case 'deposits':     await DepositsModule.load();     break;
    case 'users':        await UsersModule.load();        break;
    case 'transactions': await TransactionsModule.load(); break;
    case 'contracts':    await ContractsModule.load();    break;
    // 'settings' has no async data to load
  }
}

/* ══════════════════════════════════════════════════════════════════════
   §15  PANEL BOOT  (called after successful auth)
══════════════════════════════════════════════════════════════════════ */

async function _bootPanel() {
  _loaded.clear();              // allow fresh loads on re-login
  initFilters();                // wire search + dropdowns
  initPriceWidget();            // start BTC price polling
  initRealtime();               // subscribe to live changes

  AdminUI.activateTab('overview');
  await loadSection('overview');
}

/* ══════════════════════════════════════════════════════════════════════
   §16  ENTRY POINT
══════════════════════════════════════════════════════════════════════ */

document.addEventListener('DOMContentLoaded', async () => {
  // 1. Wire navigation and login form so they work regardless of auth state
  initNavigation();
  initLoginForm();

  // 2. Initialise Supabase — show banner and stop here if config is missing
  if (!initSupabaseClient()) {
    hide('#adminAppShell');
    show('#adminLoginScreen');
    return;
  }

  // 3. Check for a persisted Supabase session (user already logged in)
  const alreadyLoggedIn = await AdminAuth.check();

  if (alreadyLoggedIn) {
    hide('#adminLoginScreen');
    show('#adminAppShell');
    await _bootPanel();
  } else {
    hide('#adminAppShell');
    show('#adminLoginScreen');
  }
});

/* ══════════════════════════════════════════════════════════════════════
   §17  PUBLIC EXPORTS  (for admin.html inline calls if needed)
══════════════════════════════════════════════════════════════════════ */

Object.assign(window, {
  AdminAuth,
  AdminUI,
  DepositsModule,
  UsersModule,
  TransactionsModule,
  ContractsModule,
  OverviewModule,
  PriceService,
});
