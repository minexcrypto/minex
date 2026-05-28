/* ──────────────────────────────────────────────────────────────
   CRYPTOVAULT — USDT PATCH
   Keeps balance displays in sync with profiles.usdt_balance only.
────────────────────────────────────────────────────────────── */
'use strict';

function setText(id, val) {
  const el = document.getElementById(id);
  if (el && el.textContent !== val) el.textContent = val;
}

function toUsdt(value, fallback = 0) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return n < 0 ? 0 : n;
}

function syncUSDTDisplays() {
  const profile = window.Auth ? window.Auth.getProfile() : {};
  const usdt = toUsdt(profile.usdt_balance);
  const display = '$ ' + usdt.toFixed(2) + ' USDT';

  setText('walletBalanceCounter', display);
  setText('walletBigBalance', display);
  setText('walletBigUSD', display);
  setText('walletItemUSD', display);
  setText('walletUSDTAmount', usdt.toFixed(2) + ' USDT');
  setText('walletBalanceUSD', display);
  setText('portfolioTotalUSD', display);
  setText('portfolioUSDTusd', display);
}

function applyUSDTPatch() {
  syncUSDTDisplays();

  if (window.Auth && typeof window.Auth.refreshProfile === 'function') {
    const originalPopulate = window.populateUserUI;
    if (typeof originalPopulate === 'function' && !originalPopulate.__usdtWrapped) {
      const wrapped = async function() {
        await originalPopulate.apply(this, arguments);
        syncUSDTDisplays();
      };
      wrapped.__usdtWrapped = true;
      window.populateUserUI = wrapped;
    }
  }

  if (window.BTCPrice && typeof window.BTCPrice.onChange === 'function') {
    window.BTCPrice.onChange(() => syncUSDTDisplays());
  }

  console.log('[USDT Patch] Applied.');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => setTimeout(applyUSDTPatch, 500));
} else {
  setTimeout(applyUSDTPatch, 500);
}
