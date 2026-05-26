/* ══════════════════════════════════════════════════════════════
   CRYPTOVAULT — app.js
   Shared UI utilities ONLY. 
   NOTE: Auth, BTCPrice, Toast, copyToClipboard, modals are all 
         handled in dashboard.js. This file provides sidebar + 
         dropdown helpers for pages that don't load dashboard.js.
══════════════════════════════════════════════════════════════ */

'use strict';

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

/* ─── MODAL (fallback only if dashboard.js not loaded) ─── */
if (typeof openModal !== 'function') {
  window.openModal = function(id) {
    const el = document.getElementById(id);
    if (el) el.style.display = 'flex';
  };
}
if (typeof closeModal !== 'function') {
  window.closeModal = function(id) {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  };
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

/* ─── TOAST (fallback only if dashboard.js not loaded) ─── */
if (typeof Toast === 'undefined') {
  window.Toast = {
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
      const icons   = { success: '✅', error: '❌', info: '💡', warning: '⚠️' };
      const colours = { success: '#10b981', error: '#ef4444', info: '#f59e0b', warning: '#f97316' };
      const border  = colours[type] || colours.info;
      const toast   = document.createElement('div');
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
}

/* ─── COPY (fallback only if dashboard.js not loaded) ──── */
if (typeof copyToClipboard !== 'function') {
  window.copyToClipboard = function(text, msg = 'Copied!') {
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text)
        .then(() => Toast.show(msg, 'success'))
        .catch(() => _fallbackCopy(text, msg));
    } else {
      _fallbackCopy(text, msg);
    }
  };
  window._fallbackCopy = function(text, msg) {
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
  };
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
