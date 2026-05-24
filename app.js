/* ══════════════════════════════════════════════════════════════
   CRYPTOVAULT — app.js
   Shared utilities: auth, BTC price, sidebar, toast, modals
══════════════════════════════════════════════════════════════ */

'use strict';

/* ─── AUTH ──────────────────────────────────────────────── */
const Auth = {
  key: 'cv_user',
  sessKey: 'cv_session',

  register(name, email, password) {
    const users = JSON.parse(localStorage.getItem('cv_users') || '[]');
    if (users.find(u => u.email === email)) return { ok: false, msg: 'Email already registered.' };
    const user = {
      id: 'usr_' + Date.now(),
      name, email,
      password: btoa(password),
      createdAt: new Date().toISOString(),
      level: 'Starter',
      balance: 0.00042,
      totalMined: 0.00217,
      refCode: 'CV' + Math.random().toString(36).substring(2,8).toUpperCase(),
      refEarnings: 0,
      refCount: 0,
      contracts: [
        { id: 1, name: 'Starter Plan', hashrate: 10, dailyProfit: 0.000032, duration: 30, daysLeft: 22, active: true }
      ]
    };
    users.push(user);
    localStorage.setItem('cv_users', JSON.stringify(users));
    this.setSession(user);
    return { ok: true, user };
  },

  login(email, password) {
    const users = JSON.parse(localStorage.getItem('cv_users') || '[]');
    const user = users.find(u => u.email === email && u.password === btoa(password));
    if (!user) return { ok: false, msg: 'Invalid email or password.' };
    this.setSession(user);
    return { ok: true, user };
  },

  setSession(user) {
    sessionStorage.setItem(this.sessKey, JSON.stringify(user));
  },

  getSession() {
    const s = sessionStorage.getItem(this.sessKey);
    return s ? JSON.parse(s) : null;
  },

  updateSession(updates) {
    const user = this.getSession();
    if (!user) return;
    const updated = { ...user, ...updates };
    this.setSession(updated);
    // persist to users array
    const users = JSON.parse(localStorage.getItem('cv_users') || '[]');
    const idx = users.findIndex(u => u.id === updated.id);
    if (idx !== -1) { users[idx] = updated; localStorage.setItem('cv_users', JSON.stringify(users)); }
    return updated;
  },

  logout() {
    sessionStorage.removeItem(this.sessKey);
    window.location.href = 'login.html';
  },

  requireAuth() {
    if (!this.getSession()) window.location.href = 'login.html';
  }
};

/* ─── BTC PRICE ─────────────────────────────────────────── */
const BTCPrice = {
  current: 67842,
  prev: 67100,
  handlers: [],

  async fetch() {
    try {
      const res = await fetch('https://api.coinbase.com/v2/prices/BTC-USD/spot');
      const data = await res.json();
      this.prev = this.current;
      this.current = parseFloat(data.data.amount);
      this.handlers.forEach(fn => fn(this.current, this.prev));
    } catch {
      // simulate fluctuation if API fails
      this.prev = this.current;
      this.current += (Math.random() - 0.49) * 120;
      this.handlers.forEach(fn => fn(this.current, this.prev));
    }
  },

  onChange(fn) { this.handlers.push(fn); },

  start() {
    this.fetch();
    setInterval(() => this.fetch(), 15000);
  },

  format(n) { return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); },
  pctChange() { return ((this.current - this.prev) / this.prev * 100).toFixed(2); }
};

/* ─── TOAST ─────────────────────────────────────────────── */
const Toast = {
  show(msg, type = 'info', duration = 3500) {
    let container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      document.body.appendChild(container);
    }

    const icons = { success: '✅', error: '❌', info: '💡', warning: '⚠️' };
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<span class="toast-icon">${icons[type] || '💡'}</span><span>${msg}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(20px)';
      toast.style.transition = '0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, duration);
  }
};

/* ─── SIDEBAR ───────────────────────────────────────────── */
function initSidebar() {
  const sidebar = document.getElementById('sidebar');
  const toggle  = document.getElementById('menuToggle');
  const overlay = document.getElementById('sidebarOverlay');

  if (!sidebar) return;

  toggle?.addEventListener('click', () => {
    sidebar.classList.toggle('open');
    overlay.classList.toggle('open');
  });

  overlay?.addEventListener('click', () => {
    sidebar.classList.remove('open');
    overlay.classList.remove('open');
  });

  // active nav item
  const path = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-item').forEach(a => {
    if (a.getAttribute('href') === path) a.classList.add('active');
  });
}

/* ─── BTC TICKER WIDGET ─────────────────────────────────── */
function initTickerWidget() {
  const widgets = document.querySelectorAll('.btc-ticker');
  if (!widgets.length) return;

  BTCPrice.onChange((price, prev) => {
    const up = price >= prev;
    const pct = BTCPrice.pctChange();
    widgets.forEach(w => {
      const priceEl = w.querySelector('.ticker-price');
      const changeEl = w.querySelector('.ticker-change');
      if (priceEl) priceEl.textContent = BTCPrice.format(price);
      if (changeEl) {
        changeEl.textContent = (up ? '▲' : '▼') + ' ' + Math.abs(pct) + '%';
        changeEl.className = 'ticker-change ' + (up ? 'ticker-up' : 'ticker-down');
      }
    });
  });

  BTCPrice.start();
}

/* ─── MODAL ─────────────────────────────────────────────── */
function openModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.add('open');
}

function closeModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.remove('open');
}

function initModals() {
  document.querySelectorAll('[data-modal]').forEach(btn => {
    btn.addEventListener('click', () => openModal(btn.dataset.modal));
  });

  document.querySelectorAll('[data-close-modal]').forEach(btn => {
    btn.addEventListener('click', () => closeModal(btn.dataset.closeModal));
  });

  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', e => {
      if (e.target === overlay) overlay.classList.remove('open');
    });
  });
}

/* ─── USER MENU ─────────────────────────────────────────── */
function initUserMenu() {
  const user = Auth.getSession();
  if (!user) return;

  document.querySelectorAll('.user-name-display').forEach(el => el.textContent = user.name);
  document.querySelectorAll('.user-level-display').forEach(el => el.textContent = user.level);
  document.querySelectorAll('.user-avatar-display').forEach(el => el.textContent = user.name[0].toUpperCase());

  document.querySelectorAll('[data-logout]').forEach(el => {
    el.addEventListener('click', () => Auth.logout());
  });
}

/* ─── DROPDOWN ──────────────────────────────────────────── */
function initDropdowns() {
  document.querySelectorAll('[data-dropdown-toggle]').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const menu = document.getElementById(btn.dataset.dropdownToggle);
      menu?.classList.toggle('open');
    });
  });

  document.addEventListener('click', () => {
    document.querySelectorAll('.dropdown-menu.open').forEach(m => m.classList.remove('open'));
  });
}

/* ─── COPY UTILITY ──────────────────────────────────────── */
function copyToClipboard(text, msg = 'Copied to clipboard!') {
  navigator.clipboard.writeText(text).then(() => Toast.show(msg, 'success'));
}

document.querySelectorAll('[data-copy]').forEach(btn => {
  btn.addEventListener('click', () => copyToClipboard(btn.dataset.copy));
});

/* ─── NUMBER COUNTER ANIMATION ──────────────────────────── */
function animateCounter(el, target, decimals = 0, prefix = '', suffix = '') {
  const start = 0;
  const duration = 1800;
  const startTime = performance.now();

  function update(now) {
    const elapsed = now - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    const value = start + (target - start) * eased;
    el.textContent = prefix + value.toFixed(decimals) + suffix;
    if (progress < 1) requestAnimationFrame(update);
  }
  requestAnimationFrame(update);
}

/* ─── INIT ──────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  initSidebar();
  initTickerWidget();
  initModals();
  initUserMenu();
  initDropdowns();
});
