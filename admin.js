/* ══════════════════════════════════════════════════════════════
   CRYPTOVAULT — admin.js
   All data is real — read from Supabase tables:
     deposits · profiles · transactions · contracts · notifications
══════════════════════════════════════════════════════════════ */

'use strict';

/* ══════════════════════════════════════════════════════════════
   §1  SUPABASE CLIENT
══════════════════════════════════════════════════════════════ */
let sb = null;

function initSupabaseClient() {
  const url = window.CRYPTOVAULT_SUPABASE_URL || '';
  const key = window.CRYPTOVAULT_SUPABASE_KEY || '';

  if (!url || !key) {
    AdminUI.banner(
      '⚠ Supabase credentials missing. ' +
      'Define window.CRYPTOVAULT_SUPABASE_URL and window.CRYPTOVAULT_SUPABASE_KEY before admin.js loads.',
      'error'
    );
    return false;
  }
  if (typeof window.supabase?.createClient !== 'function') {
    AdminUI.banner('⚠ Supabase SDK not found. Load the CDN script before admin.js.', 'error');
    return false;
  }
  try {
    sb = window.supabase.createClient(url, key);
    console.log('[CryptoVault] Supabase client initialized.');
    return true;
  } catch (err) {
    AdminUI.banner('⚠ Supabase init error: ' + err.message, 'error');
    return false;
  }
}

/* ══════════════════════════════════════════════════════════════
   §2  DOM HELPERS
══════════════════════════════════════════════════════════════ */
const $  = (sel, ctx = document) => { try { return ctx.querySelector(sel);        } catch { return null; } };
const $$ = (sel, ctx = document) => { try { return [...ctx.querySelectorAll(sel)]; } catch { return []; } };

function setHTML(sel, html)  { const el = resolve(sel); if (el) el.innerHTML   = html;  }
function setText(sel, text)  { const el = resolve(sel); if (el) el.textContent = text; }
function show(sel)           { resolve(sel)?.classList.remove('hidden'); }
function hide(sel)           { resolve(sel)?.classList.add('hidden'); }
function on(sel, evt, fn, ctx = document) {
  const el = typeof sel === 'string' ? $(sel, ctx) : (sel || null);
  if (el) el.addEventListener(evt, fn);
}
function resolve(sel) { return typeof sel === 'string' ? $(sel) : (sel || null); }

/* ══════════════════════════════════════════════════════════════
   §3  UI PRIMITIVES
══════════════════════════════════════════════════════════════ */
const AdminUI = {

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
    const palette = { success: '#10b981', error: '#ef4444', info: '#f59e0b', warning: '#f97316' };
    const icons   = { success: '✅', error: '❌', info: '💡', warning: '⚠️' };

    /* FIX: renamed 'border' → 'borderColor' to avoid identifier conflict */
    const borderColor = palette[type] || palette.info;

    const t = document.createElement('div');
    /* FIX: rewrote cssText as a clean string instead of array.join to eliminate the syntax error */
    t.style.cssText =
      'background:#111720;' +
      'border:1px solid #1e2d45;' +
      'border-left:3px solid ' + borderColor + ';' +
      'border-radius:12px;' +
      'padding:14px 18px;' +
      'display:flex;' +
      'align-items:center;' +
      'gap:12px;' +
      'font-size:13px;' +
      'color:#94a3b8;' +
      'min-width:280px;' +
      'max-width:400px;' +
      'box-shadow:0 4px 24px rgba(0,0,0,.45);' +
      'animation:_cvSlideIn .3s ease;';

    t.innerHTML =
      `<span style="font-size:17px;flex-shrink:0">${icons[type] || '💡'}</span>` +
      `<span style="flex:1;line-height:1.45">${msg}</span>`;
    wrap.appendChild(t);
    setTimeout(() => {
      Object.assign(t.style, { opacity: '0', transform: 'translateX(16px)', transition: '.3s ease' });
      setTimeout(() => t.remove(), 320);
    }, ms);
  },

  banner(msg, type = 'warning') {
    const colours = { warning: '#f59e0b', error: '#ef4444', success: '#10b981', info: '#3b82f6' };
    const c = colours[type] || colours.warning;
    document.getElementById('_cvBanner')?.remove();
    const b = document.createElement('div');
    b.id = '_cvBanner';
    b.style.cssText =
      `background:${c}18;border-bottom:1px solid ${c}44;` +
      `padding:11px 24px;font-size:13px;font-weight:600;color:${c};text-align:center;`;
    b.textContent = msg;
    document.body.prepend(b);
  },

  loading(msg = 'Loading…') {
    return `
      <div style="padding:48px;text-align:center;color:#475569;font-size:13px;">
        <div style="width:26px;height:26px;border:2px solid #1e2d45;border-top-color:#f59e0b;
          border-radius:50%;animation:_cvSpin .8s linear infinite;margin:0 auto 14px;"></div>
        ${msg}
      </div>`;
  },

  error(msg = 'Failed to load data.') {
    return `<div style="padding:48px;text-align:center;color:#ef4444;font-size:13px;">❌ ${msg}</div>`;
  },

  empty(msg = 'No records found.') {
    return `<div style="padding:48px;text-align:center;color:#475569;font-size:13px;">📭 ${msg}</div>`;
  },

  badge(status) {
    const map = {
      pending:    { bg: 'rgba(245,158,11,.15)',  fg: '#f59e0b', label: 'Pending'    },
      approved:   { bg: 'rgba(16,185,129,.15)',  fg: '#10b981', label: 'Approved'   },
      rejected:   { bg: 'rgba(239,68,68,.15)',   fg: '#ef4444', label: 'Rejected'   },
      success:    { bg: 'rgba(16,185,129,.15)',  fg: '#10b981', label: 'Success'    },
      failed:     { bg: 'rgba(239,68,68,.15)',   fg: '#ef4444', label: 'Failed'     },
      active:     { bg: 'rgba(16,185,129,.15)',  fg: '#10b981', label: 'Active'     },
      inactive:   { bg: 'rgba(100,116,139,.15)', fg: '#64748b', label: 'Inactive'   },
      completed:  { bg: 'rgba(59,130,246,.15)',  fg: '#3b82f6', label: 'Completed'  },
      mining:     { bg: 'rgba(249,115,22,.15)',  fg: '#f97316', label: 'Mining'     },
      deposit:    { bg: 'rgba(16,185,129,.15)',  fg: '#10b981', label: 'Deposit'    },
      withdrawal: { bg: 'rgba(239,68,68,.15)',   fg: '#ef4444', label: 'Withdrawal' },
      referral:   { bg: 'rgba(139,92,246,.15)',  fg: '#8b5cf6', label: 'Referral'   },
      purchase:   { bg: 'rgba(59,130,246,.15)',  fg: '#3b82f6', label: 'Purchase'   },
      info:       { bg: 'rgba(59,130,246,.15)',  fg: '#3b82f6', label: 'Info'       },
      warning:    { bg: 'rgba(245,158,11,.15)',  fg: '#f59e0b', label: 'Warning'    },
      error:      { bg: 'rgba(239,68,68,.15)',   fg: '#ef4444', label: 'Error'      },
      announcement:{ bg: 'rgba(139,92,246,.15)',  fg: '#8b5cf6', label: 'Announcement'},
    };
    const s = map[String(status).toLowerCase()] || {
      bg: 'rgba(100,116,139,.15)', fg: '#64748b', label: status || '—',
    };
    return `<span style="
      display:inline-flex;align-items:center;padding:3px 10px;border-radius:20px;
      font-size:11px;font-weight:700;background:${s.bg};color:${s.fg};
      white-space:nowrap;">${s.label}</span>`;
  },

  activateTab(name) {
    $$('[data-admin-tab]').forEach(btn =>
      btn.classList.toggle('active', btn.dataset.adminTab === name)
    );
    $$('[data-admin-section]').forEach(sec => {
      const match = sec.dataset.adminSection === name;
      sec.classList.toggle('active', match);
      sec.style.display = match ? '' : 'none';
    });
    const TITLES = {
      overview:     'Dashboard Overview',
      deposits:     'Deposit Requests',
      users:        'User Management',
      transactions: 'Transaction History',
      contracts:    'Mining Contracts',
      settings:     'Admin Settings',
      notifications:'Send Notifications',
    };
    setText('#adminPageTitle', TITLES[name] || name);
  },
};

/* inject keyframes */
(() => {
  if (document.getElementById('_cvKF')) return;
  const s = document.createElement('style');
  s.id = '_cvKF';
  s.textContent = `
    @keyframes _cvSlideIn { from{opacity:0;transform:translateX(14px)} to{opacity:1;transform:translateX(0)} }
    @keyframes _cvSpin    { to{transform:rotate(360deg)} }
    .hidden { display: none !important; }
    .admin-btn {
      display:inline-flex;align-items:center;justify-content:center;gap:6px;
      padding:6px 13px;border-radius:8px;font-size:12px;font-weight:600;
      cursor:pointer;border:none;transition:all .2s;font-family:inherit;white-space:nowrap;
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

const TH = [
  'font-size:11px', 'font-weight:700', 'letter-spacing:.8px',
  'text-transform:uppercase', 'color:#475569', 'padding:11px 16px',
  'text-align:left', 'white-space:nowrap', 'border-bottom:1px solid #1e2d45',
].join(';');

const TD = 'padding:13px 16px;font-size:13px;color:#94a3b8;border-bottom:1px solid rgba(30,45,69,.5);';

/* ══════════════════════════════════════════════════════════════
   §4  ADMIN AUTH
══════════════════════════════════════════════════════════════ */
const AdminAuth = {
  user: null,

  async check() {
    if (!sb) return false;
    try {
      const { data, error } = await sb.auth.getUser();
      if (error || !data?.user) return false;
      if (!(await this._isAdmin(data.user))) return false;
      this.user = data.user;
      this._fillUI(data.user);
      return true;
    } catch { return false; }
  },

  async login(email, password) {
    if (!sb) throw new Error('Supabase client not ready.');
    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    if (error) throw new Error(error.message);
    if (!(await this._isAdmin(data.user))) {
      await sb.auth.signOut().catch(() => {});
      throw new Error('Access denied — this account does not have admin privileges.');
    }
    this.user = data.user;
    this._fillUI(data.user);
    return data.user;
  },

  async logout() {
    if (sb) await sb.auth.signOut().catch(() => {});
    this.user = null;
    hide('#adminAppShell');
    show('#adminLoginScreen');
    setHTML('#adminLoginError', '');
  },

  async _isAdmin(user) {
    if (user?.app_metadata?.role === 'admin') return true;
    try {
      const { data } = await sb.from('admins').select('id').eq('id', user.id).maybeSingle();
      if (data) return true;
    } catch { /* skip */ }
    try {
      const { data } = await sb
        .from('profiles')
        .select('is_admin')
        .eq('id', user.id)
        .maybeSingle();
      if (data?.is_admin === true) return true;
    } catch { /* skip */ }
    return false;
  },

  _fillUI(user) {
    const name  = user.user_metadata?.name || user.email?.split('@')[0] || 'Admin';
    const email = user.email || '';
    setText('#adminUserName',  name);
    setText('#adminUserEmail', email);
    const av = document.getElementById('adminAvatarText');
    if (av) av.textContent = (email[0] || 'A').toUpperCase();
  },
};

/* ══════════════════════════════════════════════════════════════
   §5  LOGIN FORM
══════════════════════════════════════════════════════════════ */
function initLoginForm() {
  const form   = document.getElementById('adminLoginForm');
  const errEl  = document.getElementById('adminLoginError');
  const btnEl  = document.getElementById('adminLoginBtn');
  const passEl = document.getElementById('adminLoginPassword');
  const eyeEl  = document.getElementById('adminTogglePassword');
  if (!form) return;

  on(eyeEl, 'click', () => {
    if (!passEl) return;
    passEl.type = passEl.type === 'password' ? 'text' : 'password';
    if (eyeEl) eyeEl.textContent = passEl.type === 'password' ? '👁' : '🙈';
  });

  form.addEventListener('submit', async e => {
    e.preventDefault();
    const email    = (document.getElementById('adminLoginEmail')?.value || '').trim();
    const password = passEl?.value || '';
    if (!email || !password) { if (errEl) errEl.textContent = 'Email and password are required.'; return; }
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

/* ══════════════════════════════════════════════════════════════
   §6  BTC PRICE WIDGET
══════════════════════════════════════════════════════════════ */
const PriceService = {
  _handlers: [],
  current: null,

  onChange(fn) { this._handlers.push(fn); },

  async fetch() {
    try {
      const ctrl  = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 8000);
      const res   = await fetch(
        'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd&include_24hr_change=true',
        { signal: ctrl.signal }
      );
      clearTimeout(timer);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const json   = await res.json();
      const price  = json?.bitcoin?.usd            ?? null;
      const change = json?.bitcoin?.usd_24h_change ?? null;
      if (price !== null) {
        this.current = { price, change };
        this._handlers.forEach(fn => fn(this.current));
      }
    } catch { /* silent */ }
  },

  fmt(n) {
    if (n == null) return '--';
    return '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  },

  start(ms = 30_000) { this.fetch(); setInterval(() => this.fetch(), ms); },
};

function initPriceWidget() {
  PriceService.onChange(({ price, change }) => {
    const priceStr  = PriceService.fmt(price);
    const up        = change != null && change >= 0;
    const changeStr = change != null ? ((up ? '▲ ' : '▼ ') + Math.abs(change).toFixed(2) + '%') : '--';
    const colour    = change != null ? (up ? '#10b981' : '#ef4444') : '#64748b';
    $$('.admin-btc-price').forEach(el  => { el.textContent = priceStr; });
    $$('.admin-btc-change').forEach(el => { el.textContent = changeStr; el.style.color = colour; });
    setText('#overviewBTCPrice', priceStr);
  });
  PriceService.start();
}

/* ══════════════════════════════════════════════════════════════
   §7  OVERVIEW — real aggregates from Supabase
══════════════════════════════════════════════════════════════ */
const OverviewModule = {

  async load() {
    await Promise.allSettled([
      this._depositStats(),
      this._userStats(),
      this._contractStats(),
      this._transactionStats(),
    ]);
  },

  async _depositStats() {
    try {
      const { data, error } = await sb.from('deposits').select('id, status, amount, coin');
      if (error) throw error;
      const rows     = data || [];
      const pending  = rows.filter(r => r.status === 'pending');
      const approved = rows.filter(r => r.status === 'approved');
      const rejected = rows.filter(r => r.status === 'rejected');
      const btcVol  = approved.filter(r => r.coin === 'btc').reduce((s, r) => s + Number(r.amount || 0), 0);
      const usdtVol = approved.filter(r => r.coin === 'usdt_bep20').reduce((s, r) => s + Number(r.amount || 0), 0);
      const volStr  = btcVol.toFixed(6) + ' BTC' + (usdtVol > 0 ? ' + ' + usdtVol.toFixed(2) + ' USDT' : '');
      setText('#overviewTotalDeposits',    rows.length);
      setText('#overviewApprovedVolume',   volStr);
      setText('#overviewPendingDeposits',  pending.length);
      setText('#overviewRejectedDeposits', rejected.length);
      setText('#sidebarDepositBadge',      pending.length > 0 ? pending.length : '');
      setText('#depositCountPending',      pending.length);
      setText('#depositCountApproved',     approved.length);
      setText('#depositCountRejected',     rejected.length);
    } catch (err) {
      console.warn('[Admin] deposit stats:', err.message);
    }
  },

  async _userStats() {
    try {
      const { count, error } = await sb
        .from('profiles')
        .select('id', { count: 'exact', head: true });
      if (error) throw error;
      setText('#overviewTotalUsers', count ?? '—');
      setText('#overviewActiveUsers', count ?? '—');
    } catch (err) {
      console.warn('[Admin] user stats:', err.message);
    }
  },

  async _contractStats() {
    try {
      const { data, error } = await sb.from('contracts').select('active, hashrate');
      if (error) throw error;
      const rows      = data || [];
      const active    = rows.filter(r => r.active === true);
      const totalHash = active.reduce((s, r) => s + Number(r.hashrate || 0), 0);
      setText('#overviewActiveContracts', active.length);
      setText('#overviewTotalHashrate',   totalHash.toFixed(1) + ' TH/s');
    } catch (err) {
      console.warn('[Admin] contract stats:', err.message);
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
      console.warn('[Admin] transaction stats:', err.message);
    }
  },
};

/* ══════════════════════════════════════════════════════════════
   §8  DEPOSITS MODULE
══════════════════════════════════════════════════════════════ */
const DepositsModule = {
  _rows: [],

  async load(statusFilter = 'all') {
    const container = document.getElementById('depositsTableWrap');
    if (!container || !sb) return;

    setHTML(container, AdminUI.loading('Loading deposits…'));

    try {
      let q = sb
        .from('deposits')
        .select('*')
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

  _render(container, rows) {
    if (!rows.length) { setHTML(container, AdminUI.empty('No deposit records.')); return; }

    const tbodyHTML = rows.map(d => {
      const coinLabel = d.coin === 'usdt_bep20' ? 'USDT (BEP20)' : 'BTC';
      const decimals  = d.coin === 'usdt_bep20' ? 2 : 8;
      const amount    = Number(d.amount || 0).toFixed(decimals);
      const email     = d.user_email || (d.user_id ? d.user_id.slice(0, 8) + '…' : '—');
      const date      = d.created_at
        ? new Date(d.created_at).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })
        : '—';
      const screenshotBtn = d.screenshot_url
        ? `<a href="${d.screenshot_url}" target="_blank" class="admin-btn admin-btn-outline" style="margin-left:6px;">📎</a>`
        : '';
      const actions = d.status === 'pending'
        ? `<button class="admin-btn admin-btn-approve" data-action="approve" data-id="${d.id}">✅ Approve</button>
           <button class="admin-btn admin-btn-reject"  data-action="reject"  data-id="${d.id}" style="margin-left:6px;">❌ Reject</button>
           ${screenshotBtn}`
        : `<span style="font-size:12px;color:#475569">—</span>${screenshotBtn}`;

      return `
        <tr data-deposit-row="${d.id}">
          <td style="${TD};font-family:monospace;font-size:11px;color:#64748b">${String(d.id || '').slice(0, 8)}…</td>
          <td style="${TD}">
            <div style="font-weight:600;color:#f1f5f9;font-size:13px">${email}</div>
          </td>
          <td style="${TD};font-family:monospace;color:#fbbf24;font-weight:600">
            ${amount} <span style="font-size:10px;color:#64748b">${coinLabel}</span>
          </td>
          <td style="${TD};font-size:12px;color:#94a3b8">${d.tx_hash ? d.tx_hash.slice(0, 20) + '…' : '—'}</td>
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
            <th style="${TH}">TXID</th>
            <th style="${TH}">Status</th>
            <th style="${TH}">Date</th>
            <th style="${TH}">Actions</th>
          </tr>
        </thead>
        <tbody id="depositsBody">${tbodyHTML}</tbody>
      </table>`;

    setHTML(container, tableHTML);

    on('#depositsBody', 'click', e => {
      const btn = e.target.closest('[data-action][data-id]');
      if (!btn || btn.disabled) return;
      this.updateStatus(btn.dataset.id, btn.dataset.action === 'approve' ? 'approved' : 'rejected');
    }, container);
  },

  async updateStatus(depositId, newStatus) {
    if (!sb || !depositId) return;

    if (this._processing && this._processing.has(depositId)) {
      console.log('[Admin] Duplicate approval prevented for deposit', depositId);
      return;
    }
    if (!this._processing) this._processing = new Set();
    this._processing.add(depositId);

    $$(`[data-actions-cell="${depositId}"] .admin-btn`).forEach(btn => {
      btn.disabled = true;
      btn.textContent = 'Saving…';
    });

    try {
      const { data: currentRow, error: fetchErr } = await sb
        .from('deposits')
        .select('id, status, user_id, amount, coin')
        .eq('id', depositId)
        .maybeSingle();
      if (fetchErr) throw fetchErr;
      if (!currentRow) throw new Error('Deposit not found');

      if (currentRow.status === 'approved') {
        console.log('[Admin] Deposit already approved:', depositId);
        AdminUI.toast('Deposit already approved — no balance change.', 'warning');
        setHTML(`[data-status-cell="${depositId}"]`, AdminUI.badge('approved'));
        setHTML(`[data-actions-cell="${depositId}"]`, '<span style="font-size:12px;color:#475569">—</span>');
        this._rows = this._rows.map(r => r.id === depositId ? { ...r, status: 'approved' } : r);
        this._syncBadges(this._rows);
        return;
      }

      if (currentRow.status !== 'pending') {
        console.log('[Admin] Deposit status is', currentRow.status, '- skipping');
        AdminUI.toast('Deposit status is ' + currentRow.status + ' — no action taken.', 'info');
        return;
      }

      const { error: updErr } = await sb
        .from('deposits')
        .update({ status: newStatus })
        .eq('id', depositId)
        .eq('status', 'pending');
      if (updErr) throw updErr;

      setHTML(`[data-status-cell="${depositId}"]`, AdminUI.badge(newStatus));
      setHTML(`[data-actions-cell="${depositId}"]`, '<span style="font-size:12px;color:#475569">—</span>');

      this._rows = this._rows.map(r => r.id === depositId ? { ...r, status: newStatus } : r);
      this._syncBadges(this._rows);

      if (newStatus === 'approved') {
        await this._creditBalance(depositId, currentRow);
      }

      AdminUI.toast(
        `Deposit marked as <strong>${newStatus}</strong>.`,
        newStatus === 'approved' ? 'success' : 'warning'
      );
    } catch (err) {
      const dep = this._rows.find(r => r.id === depositId);
      if (dep && dep.status === 'pending') {
        setHTML(`[data-actions-cell="${depositId}"]`,
          `<button class="admin-btn admin-btn-approve" data-action="approve" data-id="${depositId}">✅ Approve</button>
           <button class="admin-btn admin-btn-reject"  data-action="reject"  data-id="${depositId}" style="margin-left:6px;">❌ Reject</button>`
        );
      }
      AdminUI.toast('Update failed: ' + err.message, 'error');
    } finally {
      this._processing.delete(depositId);
    }
  },

  async _creditBalance(depositId, dep) {
    if (!dep?.user_id || !dep?.amount) return;

    const { data: existingTx, error: txCheckErr } = await sb
      .from('transactions')
      .select('id')
      .eq('user_id', dep.user_id)
      .eq('type', 'deposit')
      .eq('amount', dep.amount)
      .eq('status', 'success')
      .gte('created_at', new Date(Date.now() - 300000).toISOString())
      .maybeSingle();
    if (txCheckErr) console.warn('[Admin] Transaction check error:', txCheckErr.message);
    if (existingTx) {
      console.log('[Admin] Transaction record already exists — skipping deposit', depositId);
      AdminUI.toast('Deposit already credited — no duplicate balance added.', 'warning');
      return;
    }

    const isUSDT = dep.coin === 'usdt_bep20';
    const field  = isUSDT ? 'usdt_balance' : 'btc_balance';

    const _createTx = async () => {
      const { error: txErr } = await sb.from('transactions').insert({
        user_id: dep.user_id,
        type: 'deposit',
        amount: Number(dep.amount || 0),
        coin: dep.coin || (isUSDT ? 'usdt_bep20' : 'btc'),
        status: 'success',
        created_at: new Date().toISOString(),
      });

      if (txErr) {
        console.error('[Admin] Deposit transaction insert failed:', txErr);
        alert('Deposit transaction insert failed:\n' + txErr.message);
        throw txErr;
      }
      console.log('[Admin] Deposit transaction saved successfully');
    };

    const rpcName = isUSDT ? 'increment_user_usdt_balance' : 'increment_user_balance';
    const { error: rpcErr } = await sb.rpc(rpcName, {
      p_user_id: dep.user_id,
      p_amount:  dep.amount,
    });
    if (!rpcErr) {
      console.log('[Admin] Balance credited via RPC for deposit', depositId);
      await _createTx();
      return;
    }

    try {
      const { data: profile, error: fetchErr } = await sb
        .from('profiles')
        .select(field)
        .eq('id', dep.user_id)
        .maybeSingle();
      if (fetchErr || profile == null) throw fetchErr || new Error('Profile not found');

      const newBal = Number(profile[field] || 0) + Number(dep.amount);
      const { error: updErr } = await sb
        .from('profiles')
        .update({ [field]: newBal })
        .eq('id', dep.user_id);
      if (updErr) throw updErr;

      console.log('[Admin] Balance credited via fallback for deposit', depositId);
      await _createTx();
    } catch (err) {
      console.warn('[Admin] Balance credit failed for', depositId, err.message);
      AdminUI.toast('⚠ Deposit approved but balance credit failed — check manually.', 'warning', 7000);
    }
  },

  _syncBadges(rows) {
    const pending  = rows.filter(r => r.status === 'pending').length;
    const approved = rows.filter(r => r.status === 'approved').length;
    const rejected = rows.filter(r => r.status === 'rejected').length;
    setText('#depositCountPending',     pending);
    setText('#depositCountApproved',    approved);
    setText('#depositCountRejected',    rejected);
    setText('#overviewPendingDeposits', pending);
    setText('#sidebarDepositBadge',     pending > 0 ? String(pending) : '');
  },
};

/* ══════════════════════════════════════════════════════════════
   §9  USERS MODULE
══════════════════════════════════════════════════════════════ */
const UsersModule = {
  _rows: [],

  async load() {
    const container = document.getElementById('usersTableWrap');
    if (!container || !sb) return;
    setHTML(container, AdminUI.loading('Loading users…'));
    try {
      const { data, error } = await sb
        .from('profiles')
        .select('id, email, name, btc_balance, usdt_balance, level, is_active, ref_code, created_at')
        .order('created_at', { ascending: false })
        .limit(500);
      if (error) throw error;
      this._rows = data || [];
      this._render(container, this._rows);
      setText('#overviewTotalUsers',  this._rows.length);
      setText('#overviewActiveUsers', this._rows.filter(u => u.is_active !== false).length);
    } catch (err) {
      setHTML(container, AdminUI.error('Could not load users: ' + err.message));
    }
  },

  _render(container, rows) {
    if (!rows.length) { setHTML(container, AdminUI.empty('No users found.')); return; }

    const tbodyHTML = rows.map(u => {
      const joined     = u.created_at
        ? new Date(u.created_at).toLocaleDateString('en-US', { dateStyle: 'medium' })
        : '—';
      const btcBalance = Number(u.btc_balance || 0).toFixed(8);
      const active     = u.is_active !== false;

      return `
        <tr>
          <td style="${TD};font-family:monospace;font-size:11px;color:#64748b">${String(u.id || '').slice(0, 8)}…</td>
          <td style="${TD}">
            <div style="font-weight:600;color:#f1f5f9;font-size:13px">${u.name || '—'}</div>
            <div style="font-size:11px;color:#64748b;margin-top:2px">${u.email || '—'}</div>
          </td>
          <td style="${TD};font-family:monospace;color:#fbbf24;font-weight:500">
            ${btcBalance} <span style="font-size:10px;color:#64748b">BTC</span>
          </td>
          <td style="${TD};font-size:12px;color:#94a3b8">${u.level || 'Standard'}</td>
          <td style="${TD}">${AdminUI.badge(active ? 'active' : 'inactive')}</td>
          <td style="${TD};font-size:12px;color:#64748b">${joined}</td>
          <td style="${TD}">
            <button class="admin-btn admin-btn-outline" onclick="UsersModule.viewUser('${u.id}')">View</button>
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
            <th style="${TH}">BTC Balance</th>
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
      `<strong>${u.name || u.email}</strong> — ` +
      `BTC: ${Number(u.btc_balance || 0).toFixed(8)} · ` +
      `USDT: ${Number(u.usdt_balance || 0).toFixed(2)}`,
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
      _loaded.delete('users');
      await this.load();
    } catch (err) {
      AdminUI.toast('Failed: ' + err.message, 'error');
    }
  },
};

window.UsersModule = UsersModule;

/* ══════════════════════════════════════════════════════════════
   §10  TRANSACTIONS MODULE
══════════════════════════════════════════════════════════════ */

/* Helper: fetch profiles for a list of user IDs and return a lookup map */
async function _fetchProfiles(userIds) {
  if (!sb || !userIds.length) return {};
  const { data, error } = await sb
    .from('profiles')
    .select('id, email, name')
    .in('id', userIds);
  if (error) { console.warn('[Admin] Profile fetch error:', error.message); return {}; }
  const map = {};
  (data || []).forEach(p => { map[p.id] = p; });
  return map;
}

const TransactionsModule = {

  async load(typeFilter = 'all') {
    const container = document.getElementById('transactionsTableWrap');
    if (!container || !sb) return;
    setHTML(container, AdminUI.loading('Loading transactions…'));
    try {
      let q = sb
        .from('transactions')
        .select('id, user_id, plan, hashrate, daily_profit, active, days_left, progress, created_at')
        .order('created_at', { ascending: false })
        .limit(400);
      if (typeFilter !== 'all') {
        const normalizedFilter = String(typeFilter || '').trim().toLowerCase();
        const typeMap = {
          deposit:     ['deposit'],
          deposits:    ['deposit'],
          mining:      ['mining', 'mining_reward', 'reward'],
          withdrawal:  ['withdrawal'],
          withdrawals: ['withdrawal'],
          purchase:    ['purchase', 'plan_purchase'],
          purchases:   ['purchase', 'plan_purchase'],
        };
        const allowedTypes = typeMap[normalizedFilter] || [normalizedFilter];
        console.log('[Admin] Transaction filter:', normalizedFilter, allowedTypes);
        q = q.in('type', allowedTypes);
      }
      const { data, error } = await q;
      if (error) throw error;
      const rows = data || [];
      const nUserIds = [...new Set(rows.map(r => r.user_id).filter(Boolean))];
      const nProfileMap = await _fetchProfiles(nUserIds);

      const nUserIds = [...new Set(rows.map(r => r.user_id).filter(Boolean))];
      const nProfileMap = await _fetchProfiles(nUserIds);
      const cUserIds = [...new Set(rows.map(r => r.user_id).filter(Boolean))];
      const cProfileMap = await _fetchProfiles(cUserIds);
      if (!rows.length) { setHTML(container, AdminUI.empty('No transactions found.')); return; }

      const TYPE_ICON = { mining: '⛏️', deposit: '📥', withdrawal: '📤', referral: '👥', transfer: '↔️', purchase: '🛒' };
      const tbodyHTML = rows.map(tx => {
        const email  = (txProfileMap[tx.user_id]?.email || '—') || '—';
        const name   = (txProfileMap[tx.user_id]?.name || email)  || email;
        const amount = Number(tx.amount || 0).toFixed(8);
        const date   = tx.created_at
          ? new Date(tx.created_at).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })
          : '—';
        const isOut  = tx.type === 'withdrawal' || tx.type === 'purchase';
        const amtCol = isOut ? '#ef4444' : '#10b981';
        const amtPfx = isOut ? '−' : '+';
        return `
          <tr>
            <td style="${TD};font-family:monospace;font-size:11px;color:#64748b">${String(tx.id || '').slice(0, 8)}…</td>
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

/* ══════════════════════════════════════════════════════════════
   §11  CONTRACTS MODULE
══════════════════════════════════════════════════════════════ */
const ContractsModule = {

  async load() {
    const container = document.getElementById('contractsTableWrap');
    if (!container || !sb) return;
    setHTML(container, AdminUI.loading('Loading contracts…'));
    try {
      const { data, error } = await sb
        .from('contracts')
        .select('id, user_id, title, message, type, is_read, created_at')
        .order('created_at', { ascending: false })
        .limit(300);
      if (error) throw error;
      const rows = data || [];
      if (!rows.length) { setHTML(container, AdminUI.empty('No contracts found.')); return; }

      const tbodyHTML = rows.map(c => {
        const email    = (cProfileMap[c.user_id]?.email || '—') || '—';
        const name     = (cProfileMap[c.user_id]?.name || email)  || email;
        const date     = c.created_at
          ? new Date(c.created_at).toLocaleDateString('en-US', { dateStyle: 'medium' })
          : '—';
        const hashrate = Number(c.hashrate || 0).toFixed(1);
        const daily    = c.daily_profit != null ? Number(c.daily_profit).toFixed(8) : '—';
        return `
          <tr>
            <td style="${TD};font-family:monospace;font-size:11px;color:#64748b">${String(c.id || '').slice(0, 8)}…</td>
            <td style="${TD}">
              <div style="font-size:13px;font-weight:600;color:#f1f5f9">${name}</div>
              <div style="font-size:11px;color:#64748b;margin-top:2px">${email}</div>
            </td>
            <td style="${TD};font-size:13px;font-weight:600;color:#f1f5f9">${c.plan || '—'}</td>
            <td style="${TD};font-family:monospace;color:#fbbf24;font-weight:500">
              ${hashrate} <span style="font-size:10px;color:#64748b">TH/s</span>
            </td>
            <td style="${TD};font-family:monospace;color:#10b981;font-size:12px">${daily}</td>
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
              <th style="${TH}">Daily Profit</th>
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

/* ══════════════════════════════════════════════════════════════
   §12  NOTIFICATIONS MODULE
══════════════════════════════════════════════════════════════ */
const NotificationsModule = {
  async load() {
    const container = document.getElementById('adminNotifTableWrap');
    if (!container || !sb) return;
    setHTML(container, AdminUI.loading('Loading notifications…'));
    try {
      const { data, error } = await sb
        .from('notifications')
        .select('id, user_id, title, message, type, is_read, created_at')
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      const rows = data || [];
      if (!rows.length) { setHTML(container, AdminUI.empty('No notifications sent yet.')); return; }

      const tbodyHTML = rows.map(n => {
        const email = (nProfileMap[n.user_id]?.email || 'All Users') || 'All Users';
        const name = (nProfileMap[n.user_id]?.name || email) || email;
        const date = n.created_at ? new Date(n.created_at).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }) : '—';
        return `
          <tr>
            <td style="${TD};font-family:monospace;font-size:11px;color:#64748b">${String(n.id || '').slice(0, 8)}…</td>
            <td style="${TD}">${name}</td>
            <td style="${TD}">${n.title || '—'}</td>
            <td style="${TD};font-size:12px;color:#94a3b8;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${n.message || '—'}</td>
            <td style="${TD}">${AdminUI.badge(n.type)}</td>
            <td style="${TD}">${AdminUI.badge(n.is_read ? 'success' : 'pending')}</td>
            <td style="${TD};font-size:12px;color:#64748b">${date}</td>
          </tr>`;
      }).join('');

      setHTML(container, `
        <table style="width:100%;border-collapse:collapse">
          <thead>
            <tr>
              <th style="${TH}">ID</th>
              <th style="${TH}">User</th>
              <th style="${TH}">Title</th>
              <th style="${TH}">Message</th>
              <th style="${TH}">Type</th>
              <th style="${TH}">Status</th>
              <th style="${TH}">Date</th>
            </tr>
          </thead>
          <tbody>${tbodyHTML}</tbody>
        </table>`);
    } catch (err) {
      setHTML(container, AdminUI.error('Could not load notifications: ' + err.message));
    }
  },

  async send() {
    const target = document.getElementById('notifTarget')?.value || 'all';
    const title = document.getElementById('notifTitle')?.value.trim();
    const message = document.getElementById('notifMessage')?.value.trim();
    const type = document.getElementById('notifType')?.value || 'info';
    const email = document.getElementById('notifUserEmail')?.value.trim();

    if (!title || !message) {
      AdminUI.toast('Title and message are required.', 'error');
      return;
    }

    if (!sb) { AdminUI.toast('Supabase not ready.', 'error'); return; }

    const btn = document.getElementById('sendNotifBtn');
    if (btn) { btn.disabled = true; btn.textContent = 'Sending…'; }

    try {
      let userIds = [];
      if (target === 'all') {
        const { data: profiles, error: profErr } = await sb.from('profiles').select('id');
        if (profErr) throw profErr;
        userIds = (profiles || []).map(p => p.id);
      } else {
        if (!email) throw new Error('Please enter a user email.');
        const { data: prof, error: profErr } = await sb.from('profiles').select('id').eq('email', email).maybeSingle();
        if (profErr) throw profErr;
        if (!prof) throw new Error('User not found with that email.');
        userIds = [prof.id];
      }

      if (!userIds.length) throw new Error('No target users found.');

      const rows = userIds.map(uid => ({
        user_id: uid,
        title,
        message,
        type,
        is_read: false,
        created_at: new Date().toISOString(),
      }));

      const BATCH = 500;
      for (let i = 0; i < rows.length; i += BATCH) {
        const batch = rows.slice(i, i + BATCH);
        const { error } = await sb.from('notifications').insert(batch);
        if (error) throw error;
      }

      AdminUI.toast(`Notification sent to ${userIds.length} user${userIds.length > 1 ? 's' : ''}.`, 'success');
      document.getElementById('notifTitle').value = '';
      document.getElementById('notifMessage').value = '';
      this.load();
    } catch (err) {
      AdminUI.toast('Send failed: ' + err.message, 'error');
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = '📤 Send Notification'; }
    }
  }
};

window.NotificationsModule = NotificationsModule;

/* ══════════════════════════════════════════════════════════════
   §13  SEARCH / FILTER WIRING
══════════════════════════════════════════════════════════════ */
function initFilters() {
  on('#depositStatusFilter', 'change', e => {
    _loaded.delete('deposits');
    DepositsModule.load(e.target.value || 'all');
    _loaded.add('deposits');
  });

  on('#transactionTypeFilter', 'change', e => {
    _loaded.delete('transactions');
    TransactionsModule.load(e.target.value || 'all');
    _loaded.add('transactions');
  });

  on('#depositSearchInput', 'input', e => {
    const term = e.target.value.toLowerCase();
    $$('#depositsTableWrap tbody tr').forEach(row => {
      row.style.display = row.textContent.toLowerCase().includes(term) ? '' : 'none';
    });
  });

  on('#userSearchInput', 'input', e => {
    const term = e.target.value.toLowerCase();
    $$('#usersTableWrap tbody tr').forEach(row => {
      row.style.display = row.textContent.toLowerCase().includes(term) ? '' : 'none';
    });
  });
}

function initNotificationForm() {
  on('#notifTarget', 'change', e => {
    const grp = document.getElementById('notifUserGroup');
    if (grp) grp.style.display = e.target.value === 'specific' ? '' : 'none';
  });

  on('#sendNotifBtn', 'click', e => {
    e.preventDefault();
    NotificationsModule.send();
  });
}

/* ══════════════════════════════════════════════════════════════
   §14  REALTIME
══════════════════════════════════════════════════════════════ */
function initRealtime() {
  if (typeof sb?.channel !== 'function') return;
  try {
    sb.channel('admin-realtime')
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'deposits' },
        payload => {
          if (payload.new?.status === 'pending') {
            AdminUI.toast('🆕 New deposit request received.', 'info', 6000);
            const badge = document.getElementById('sidebarDepositBadge');
            const cur   = parseInt(badge?.textContent || '0', 10);
            setText('#sidebarDepositBadge', String(cur + 1));
          }
          if (_loaded.has('deposits')) {
            const filter = document.getElementById('depositStatusFilter')?.value || 'all';
            DepositsModule.load(filter);
          }
        }
      )
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'deposits' },
        () => {
          if (_loaded.has('deposits')) {
            const filter = document.getElementById('depositStatusFilter')?.value || 'all';
            DepositsModule.load(filter);
          }
        }
      )
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'transactions' },
        () => { if (_loaded.has('transactions')) TransactionsModule.load(); }
      )
      .subscribe(status => {
        if (status === 'SUBSCRIBED') console.info('[Admin] Realtime subscribed.');
      });
  } catch (err) {
    console.warn('[Admin] Realtime unavailable:', err.message);
  }
}

/* ══════════════════════════════════════════════════════════════
   §15  NAVIGATION
══════════════════════════════════════════════════════════════ */
const _loaded = new Set();

function initNavigation() {
  $$('[data-admin-tab]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const name = btn.dataset.adminTab;
      AdminUI.activateTab(name);
      await loadSection(name);
      document.getElementById('adminSidebar')?.classList.remove('open');
      document.getElementById('adminSidebarOverlay')?.classList.remove('open');
    });
  });

  on('#adminMenuToggle', 'click', () => {
    document.getElementById('adminSidebar')?.classList.toggle('open');
    document.getElementById('adminSidebarOverlay')?.classList.toggle('open');
  });
  on('#adminSidebarOverlay', 'click', () => {
    document.getElementById('adminSidebar')?.classList.remove('open');
    document.getElementById('adminSidebarOverlay')?.classList.remove('open');
  });

  $$('[data-admin-logout]').forEach(btn => {
    btn.addEventListener('click', () => AdminAuth.logout());
  });
}

async function loadSection(name) {
  if (_loaded.has(name)) return;
  _loaded.add(name);
  switch (name) {
    case 'overview':     await OverviewModule.load();     break;
    case 'deposits':     await DepositsModule.load();     break;
    case 'users':        await UsersModule.load();        break;
    case 'transactions': await TransactionsModule.load(); break;
    case 'contracts':    await ContractsModule.load();    break;
    case 'notifications': await NotificationsModule.load(); break;
  }
}

/* ══════════════════════════════════════════════════════════════
   §16  PANEL BOOT
══════════════════════════════════════════════════════════════ */
async function _bootPanel() {
  _loaded.clear();
  initFilters();
  initPriceWidget();
  initRealtime();
  initNotificationForm();
  AdminUI.activateTab('deposits');
  await loadSection('deposits');
}

/* ══════════════════════════════════════════════════════════════
   §17  ENTRY POINT
══════════════════════════════════════════════════════════════ */
console.log('[CryptoVault] admin.js loaded.');

document.addEventListener('DOMContentLoaded', async () => {
  initNavigation();
  initLoginForm();

  if (!initSupabaseClient()) {
    show('#adminLoginScreen');
    hide('#adminAppShell');
    return;
  }

  let alreadyLoggedIn = false;
  try { alreadyLoggedIn = await AdminAuth.check(); } catch (err) {
    console.warn('[Admin] Session check error:', err.message);
  }

  if (alreadyLoggedIn) {
    hide('#adminLoginScreen');
    show('#adminAppShell');
    try { await _bootPanel(); }
    catch (err) { AdminUI.banner('⚠ Panel boot error: ' + err.message, 'error'); }
  } else {
    show('#adminLoginScreen');
    hide('#adminAppShell');
  }
});

/* ══════════════════════════════════════════════════════════════
   §18  PUBLIC EXPORTS
══════════════════════════════════════════════════════════════ */
Object.assign(window, {
  AdminAuth,
  AdminUI,
  DepositsModule,
  UsersModule,
  TransactionsModule,
  ContractsModule,
  OverviewModule,
  PriceService,
  NotificationsModule,
});
