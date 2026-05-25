/* ══════════════════════════════════════════════════════════════
   CRYPTOVAULT — app.js
   Shared utilities: BTC price, sidebar, toast, modals
   NOTE: Auth is handled entirely in dashboard.js via Supabase.
         This file provides UI utilities only.
══════════════════════════════════════════════════════════════ */

'use strict';

/* ─── BTC PRICE ─────────────────────────────────────────── */
const BTCPrice = {
  current: null,
  handlers: [],

  async fetch() {
    try {
      const res = await fetch(
        'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd&include_24hr_change=true'
      );
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      const price  = data.bitcoin?.usd           ?? null;
      const change = data.bitcoin?.usd_24h_change ?? null;
      if (price !== null) {
        this.current = { price, change };
        this.handlers.forEach(fn => fn(this.current));
      }
    } catch {
      /* silent — keep stale value */
    }
  },

  onChange(fn) { this.handlers.push(fn); },

  start(ms = 60_000) {
    this.fetch();
    setInterval(() => this.fetch(), ms);
  },

  format(n) {
    if (n == null) return '—';
    return '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  },
};

/* ─── TOAST ─────────────────────────────────────────────── */
const Toast = {
  show(msg, type = 'info', duration = 3500) {
    let container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      Object.assign(container.style, {
        position: 'fixed', bottom: '24px', right: '24px',
        zIndex: '9999', display: 'flex', flexDirection: 'column', gap: '10px',
      });
      document.body.appendChild(container);
    }

    const icons = { success: '✅', error: '❌', info: '💡', warning: '⚠️' };
    const colours = { success: '#10b981', error: '#ef4444', info: '#f59e0b', warning: '#f97316' };
    const border = colours[type] || colours.info;

    const toast = document.createElement('div');
    toast.style.cssText = [
      'background:#111720', 'border:1px solid #1e2d45',
      `border-left:3px solid ${border}`, 'border-radius:12px',
      'padding:14px 18px', 'display:flex', 'align-items:center', 'gap:12px',
      'font-size:13px', 'color:#94a3b8', 'min-width:260px', 'max-width:380px',
      'box-shadow:0 4px 24px rgba(0,0,0,.45)',
      'animation:_cvSlideIn .3s ease',
    ].join(';');
    toast.innerHTML =
      `<span style="font-size:17px;flex-shrink:0">${icons[type] || '💡'}</span>` +
      `<span style="flex:1;line-height:1.45">${msg}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
      Object.assign(toast.style, { opacity: '0', transform: 'translateX(16px)', transition: '.3s ease' });
      setTimeout(() => toast.remove(), 320);
    }, duration);
  },
};

/* ─── SIDEBAR ───────────────────────────────────────────── */
function initSidebar() {
  const sidebar = document.getElementById('sidebar');
  const toggle  = document.getElementById('menuToggle');
  const overlay = document.getElementById('sidebarOverlay');
  if (!sidebar) return;

  toggle?.addEventListener('click', () => {
    sidebar.classList.toggle('open');
    overlay?.classList.toggle('open');
  });
  overlay?.addEventListener('click', () => {
    sidebar.classList.remove('open');
    overlay?.classList.remove('open');
  });

  const path = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-item').forEach(a => {
    if (a.getAttribute('href') === path) a.classList.add('active');
  });
}

/* ─── MODAL ─────────────────────────────────────────────── */
function openModal(id) {
  const el = document.getElementById(id);
  if (el) el.style.display = 'flex';
}

function closeModal(id) {
  const el = document.getElementById(id);
  if (el) el.style.display = 'none';
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
      if (e.target === overlay) overlay.style.display = 'none';
    });
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
function copyToClipboard(text, msg = 'Copied!') {
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(text)
      .then(() => Toast.show(msg, 'success'))
      .catch(() => _fallbackCopy(text, msg));
  } else {
    _fallbackCopy(text, msg);
  }
}

function _fallbackCopy(text, msg) {
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    Object.assign(ta.style, { position: 'fixed', opacity: '0' });
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    Toast.show(msg, 'success');
  } catch {
    Toast.show('Copy failed. Please copy manually.', 'error');
  }
}

/* inject keyframe once */
(() => {
  if (document.getElementById('_cvAppKF')) return;
  const s = document.createElement('style');
  s.id = '_cvAppKF';
  s.textContent = `@keyframes _cvSlideIn { from{opacity:0;transform:translateX(14px)} to{opacity:1;transform:translateX(0)} }`;
  document.head.appendChild(s);
})();

/* ─── INIT ──────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  initSidebar();
  initModals();
  initDropdowns();
});
