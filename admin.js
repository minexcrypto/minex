'use strict';

/* Core state */
let sb = null;

/* DOM helpers */
const $ = (sel, ctx = document) => { try { return ctx.querySelector(sel); } catch { return null; } };
const $$ = (sel, ctx = document) => { try { return Array.from(ctx.querySelectorAll(sel)); } catch { return []; } };
function setHTML(sel, html) { const el = typeof sel === 'string' ? $(sel) : sel; if (el) el.innerHTML = html; }
function setText(sel, text) { const el = typeof sel === 'string' ? $(sel) : sel; if (el) el.textContent = text; }
function show(sel) { const el = typeof sel === 'string' ? $(sel) : sel; if (el) { el.classList.remove('hidden'); el.style.display = ''; } }
function hide(sel) { const el = typeof sel === 'string' ? $(sel) : sel; if (el) { el.classList.add('hidden'); } }
function on(sel, evt, fn) { const el = typeof sel === 'string' ? $(sel) : sel; if (el) el.addEventListener(evt, fn); }

/* Table styles */
const TH = 'font-size:11px;font-weight:700;letter-spacing:.8px;text-transform:uppercase;color:#475569;padding:11px 16px;text-align:left;white-space:nowrap;border-bottom:1px solid #1e2d45';
const TD = 'padding:12px 16px;font-size:13px;color:#94a3b8;border-bottom:1px solid rgba(30,45,69,.5);';

/* UI */
const AdminUI = {
  toast(msg, type = 'info') {
    const id = 'adminSimpleToast';
    const old = document.getElementById(id);
    if (old) old.remove();
    const t = document.createElement('div');
    t.id = id;
    t.style.cssText = 'position:fixed;right:20px;bottom:20px;z-index:99999;background:#111720;color:#f1f5f9;padding:10px 14px;border:1px solid #1e2d45;border-radius:8px;font-size:12px;max-width:360px';
    if (type === 'error') t.style.borderColor = '#ef4444';
    if (type === 'success') t.style.borderColor = '#10b981';
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 3500);
  },
  loading(msg = 'Loading...') { return `<div style="padding:24px;color:#94a3b8">${msg}</div>`; },
  error(msg = 'Error') { return `<div style="padding:24px;color:#ef4444">${msg}</div>`; },
  empty(msg = 'No records found.') { return `<div style="padding:24px;color:#94a3b8">${msg}</div>`; },
  badge(status) {
    const s = String(status || 'active').toLowerCase();
    const color = s === 'active' ? '#10b981' : s === 'suspended' ? '#f59e0b' : s === 'banned' ? '#ef4444' : '#64748b';
    return `<span style="display:inline-flex;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:700;color:${color};background:${color}22">${s}</span>`;
  },
  activateTab(name) {
    $$('[data-admin-tab]').forEach(btn => btn.classList.toggle('active', btn.dataset.adminTab === name));
    $$('[data-admin-section]').forEach(sec => {
      const match = sec.dataset.adminSection === name;
      sec.classList.toggle('active', match);
      sec.style.display = match ? '' : 'none';
    });
    setText('#adminPageTitle', name.replace(/-/g, ' '));
  }
};

function paginate(rows, pageSize, page, pagerId, renderFn, moduleName) {
  const list = Array.isArray(rows) ? rows : [];
  const pages = Math.max(1, Math.ceil(list.length / pageSize));
  const safePage = Math.min(Math.max(page, 1), pages);
  const start = (safePage - 1) * pageSize;
  renderFn(list.slice(start, start + pageSize));

  const pager = document.getElementById(pagerId);
  if (!pager) return;
  if (pages <= 1) { pager.innerHTML = ''; return; }

  let html = '';
  for (let i = 1; i <= pages; i++) {
    html += `<button class="${i === safePage ? 'active' : ''}" onclick="${moduleName}.goPage(${i})">${i}</button>`;
  }
  pager.innerHTML = html;
}

async function logAdminAction() { /* no-op fallback */ }

function initSupabaseClient() {
  const url = window.CRYPTOVAULT_SUPABASE_URL || '';
  const key = window.CRYPTOVAULT_SUPABASE_KEY || '';
  if (!url || !key) {
    AdminUI.toast('Supabase credentials missing.', 'error');
    return false;
  }
  if (typeof window.supabase?.createClient !== 'function') {
    AdminUI.toast('Supabase SDK not loaded.', 'error');
    return false;
  }
  try {
    sb = window.supabase.createClient(url, key);
    return true;
  } catch (err) {
    AdminUI.toast('Supabase init error: ' + err.message, 'error');
    return false;
  }
}

const AdminAuth = {
  user: null,

  async _isAdmin(user) {
    if (!user) return false;
    if (user?.app_metadata?.role === 'admin') return true;
    try {
      const { data } = await sb.from('admins').select('id').eq('id', user.id).maybeSingle();
      if (data) return true;
    } catch (_) {}
    try {
      const { data } = await sb.from('profiles').select('is_admin').eq('id', user.id).maybeSingle();
      if (data?.is_admin === true) return true;
    } catch (_) {}
    return false;
  },

  async check() {
    if (!sb) return false;
    const { data, error } = await sb.auth.getUser();
    if (error || !data?.user) return false;
    const ok = await this._isAdmin(data.user);
    if (!ok) return false;
    this.user = data.user;
    setText('#adminUserEmail', data.user.email || '');
    return true;
  },

  async login(email, password) {
    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    if (error) throw new Error(error.message || 'Login failed');
    const ok = await this._isAdmin(data.user);
    if (!ok) {
      await sb.auth.signOut().catch(() => {});
      throw new Error('Access denied. Admin role not found.');
    }
    this.user = data.user;
    setText('#adminUserEmail', data.user.email || '');
    return data.user;
  },

  async logout() {
    if (sb) await sb.auth.signOut().catch(() => {});
    this.user = null;
    show('#adminLoginScreen');
    hide('#adminAppShell');
  }
};

function initNavigation() {
  $$('[data-admin-tab]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      AdminUI.activateTab(btn.dataset.adminTab);
    });
  });
  $$('[data-admin-logout]').forEach(btn => btn.addEventListener('click', () => AdminAuth.logout()));
}

function initLoginForm() {
  const form = $('#adminLoginForm');
  if (!form) return;

  const toggleBtn = $('#adminTogglePassword');
  const passEl = $('#adminLoginPassword');
  if (toggleBtn && passEl) {
    toggleBtn.addEventListener('click', () => {
      passEl.type = passEl.type === 'password' ? 'text' : 'password';
    });
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = $('#adminLoginEmail')?.value?.trim();
    const password = $('#adminLoginPassword')?.value || '';
    const errEl = $('#adminLoginError');
    const btn = $('#adminLoginBtn');
    if (errEl) errEl.textContent = '';

    if (!email || !password) {
      if (errEl) errEl.textContent = 'Email and password required.';
      return;
    }

    try {
      if (btn) btn.disabled = true;
      await AdminAuth.login(email, password);
      hide('#adminLoginScreen');
      show('#adminAppShell');
      AdminUI.activateTab('overview');
      AdminUI.toast('Login successful', 'success');
    } catch (err) {
      if (errEl) errEl.textContent = err.message || 'Sign in failed';
      AdminUI.toast(err.message || 'Sign in failed', 'error');
    } finally {
      if (btn) btn.disabled = false;
    }
  });
}

/* Graceful stubs so UI buttons do not crash */
function createStub(name) {
  return new Proxy({}, {
    get() {
      return () => AdminUI.toast(name + ' module unavailable right now.', 'error');
    }
  });
}
const DepositsModule = createStub('Deposits');
const WithdrawalsModule = createStub('Withdrawals');
const TransactionsModule = createStub('Transactions');
const ContractsModule = createStub('Contracts');
const UsersModule = createStub('Users');
const ReferralModule = createStub('Referral');
const NotificationsModule = createStub('Notifications');
const SecurityLogsModule = createStub('Logs');
const NewUsersModule = createStub('NewUsers');
const OldUsersModule = createStub('OldUsers');
const GlobalSearch = { execute: () => AdminUI.toast('Global search unavailable.', 'error') };

/* ══════════════════════════════════════════════════════════════
   EDIT OLD USER MODULE
══════════════════════════════════════════════════════════════ */

const EditOldUserModule = {

    _rows: [],
    _page: 1,
    _pageSize: 15,
    _selectedUser: null,

    goPage(n) {
        this._page = n;
        this._renderPage();
    },

    async loadUsers() {

        const container = document.getElementById('editOldUserTableWrap');

        if (!container || !sb) return;

        setHTML(container, AdminUI.loading('Loading users...'));

        try {

            const search =
                ($('#editOldUserSearchInput')?.value || '')
                .trim()
                .toLowerCase();

            const planFilter =
                ($('#editOldUserPlanFilter')?.value || 'all')
                .toLowerCase();

            let query = sb
                .from('profiles')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(1000);

            if (planFilter !== 'all') {
                query = query.eq('plan', planFilter);
            }

            const { data, error } = await query;

            if (error) throw error;

            let rows = data || [];

            if (search) {

                rows = rows.filter(u => {

                    const text =
                        `${u.email || ''} ${u.id || ''} ${u.name || ''}`
                        .toLowerCase();

                    return text.includes(search);
                });
            }

            this._rows = rows;

            this._page = 1;

            this._renderPage();

        } catch (err) {

            setHTML(
                container,
                AdminUI.error('Failed to load users: ' + err.message)
            );
        }
    },

    _renderPage() {

        const container = document.getElementById('editOldUserTableWrap');

        paginate(
            this._rows,
            this._pageSize,
            this._page,
            'editOldUserPagination',
            (pageRows) => this._render(container, pageRows),
            'EditOldUserModule'
        );
    },

    _render(container, rows) {

        if (!rows.length) {

            setHTML(container, AdminUI.empty('No users found.'));
            return;
        }

        const html = rows.map(u => {

            return `
            <tr>

                <td style="${TD}">
                    ${u.name || '-'}
                </td>

                <td style="${TD}">
                    ${u.email || '-'}
                </td>

                <td style="${TD}">
                    ${u.plan || 'starter'}
                </td>

                <td style="${TD}">
                    ${AdminUI.badge(u.status || 'active')}
                </td>

                <td style="${TD}">
                    ${Number(u.usdt_balance || 0).toFixed(2)} USDT
                </td>

                <td style="${TD}">
                    ${Number(u.daily_profit_balance || 0).toFixed(2)}
                </td>

                <td style="${TD}">
                    <button
                        class="admin-btn admin-btn-primary"
                        onclick="EditOldUserModule.selectUser('${u.id}')">
                        Edit
                    </button>
                </td>

            </tr>
            `;

        }).join('');

        setHTML(container, `
        <table style="width:100%;border-collapse:collapse">

            <thead>
                <tr>
                    <th style="${TH}">Name</th>
                    <th style="${TH}">Email</th>
                    <th style="${TH}">Plan</th>
                    <th style="${TH}">Status</th>
                    <th style="${TH}">Wallet</th>
                    <th style="${TH}">Daily Profit</th>
                    <th style="${TH}">Action</th>
                </tr>
            </thead>

            <tbody>
                ${html}
            </tbody>

        </table>
        `);
    },

    async selectUser(userId) {

        try {

            const { data, error } = await sb
                .from('profiles')
                .select('*')
                .eq('id', userId)
                .single();

            if (error) throw error;

            this._selectedUser = data;

            show('#editOldUserFormWrap');

            $('#eouName').value = data.name || '';
            $('#eouEmail').value = data.email || '';
            $('#eouPhone').value = data.phone || '';
            $('#eouCountry').value = data.country || '';

            $('#eouPlan').value =
                (data.plan || 'starter').toLowerCase();

            $('#eouStatus').value =
                (data.status || 'active').toLowerCase();

            $('#eouWalletBalance').value =
                Number(data.usdt_balance || 0);

            $('#eouDailyProfit').value =
                Number(data.daily_profit_balance || 0);

            window.scrollTo({
                top: document.body.scrollHeight,
                behavior: 'smooth'
            });

        } catch (err) {

            AdminUI.toast(err.message, 'error');
        }
    },

    async saveUser() {

        if (!this._selectedUser) {
            AdminUI.toast('No user selected.', 'error');
            return;
        }

        try {

            const payload = {

                name:
                    $('#eouName')?.value?.trim() || '',

                email:
                    $('#eouEmail')?.value?.trim() || '',

                phone:
                    $('#eouPhone')?.value?.trim() || '',

                country:
                    $('#eouCountry')?.value?.trim() || '',

                plan:
                    $('#eouPlan')?.value || 'starter',

                status:
                    $('#eouStatus')?.value || 'active',

                usdt_balance:
                    parseFloat(
                        $('#eouWalletBalance')?.value || 0
                    ),

                daily_profit_balance:
                    parseFloat(
                        $('#eouDailyProfit')?.value || 0
                    ),
            };

            const { error } = await sb
                .from('profiles')
                .update(payload)
                .eq('id', this._selectedUser.id);

            if (error) throw error;

            await logAdminAction(
                'edit_old_user',
                'profiles',
                this._selectedUser.id,
                this._selectedUser,
                payload
            );

            AdminUI.toast(
                'User updated successfully.',
                'success'
            );

            this.clearForm();

            await this.loadUsers();

        } catch (err) {

            AdminUI.toast(
                'Update failed: ' + err.message,
                'error'
            );
        }
    },

    clearForm() {

        this._selectedUser = null;

        hide('#editOldUserFormWrap');

        [
            '#eouName',
            '#eouEmail',
            '#eouPhone',
            '#eouCountry',
            '#eouWalletBalance',
            '#eouDailyProfit'
        ].forEach(id => {

            const el = $(id);

            if (el) el.value = '';
        });
    }
};

window.EditOldUserModule = EditOldUserModule;
window.AdminUI = AdminUI;
window.AdminAuth = AdminAuth;
window.DepositsModule = DepositsModule;
window.WithdrawalsModule = WithdrawalsModule;
window.TransactionsModule = TransactionsModule;
window.ContractsModule = ContractsModule;
window.UsersModule = UsersModule;
window.ReferralModule = ReferralModule;
window.NotificationsModule = NotificationsModule;
window.SecurityLogsModule = SecurityLogsModule;
window.NewUsersModule = NewUsersModule;
window.OldUsersModule = OldUsersModule;
window.GlobalSearch = GlobalSearch;

/* Boot */
document.addEventListener('DOMContentLoaded', async () => {
  initNavigation();
  initLoginForm();

  if (!initSupabaseClient()) {
    show('#adminLoginScreen');
    hide('#adminAppShell');
    return;
  }

  try {
    const ok = await AdminAuth.check();
    if (ok) {
      hide('#adminLoginScreen');
      show('#adminAppShell');
      AdminUI.activateTab('overview');
    } else {
      show('#adminLoginScreen');
      hide('#adminAppShell');
    }
  } catch (err) {
    console.error(err);
    show('#adminLoginScreen');
    hide('#adminAppShell');
  }
});
