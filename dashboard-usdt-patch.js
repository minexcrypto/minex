/* ══════════════════════════════════════════════════════════════
   CRYPTOVAULT — USDT PATCH (Fixed)
   Hamesha USDT values dikhata hai, BTC kabhi nahi.
══════════════════════════════════════════════════════════════ */
'use strict';

/* ─── Helper ─── */
function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

function normTxType(raw) {
  const t = String(raw || '').trim().toLowerCase();
  if (['deposit', 'deposits', 'approved_deposit'].includes(t)) return 'deposit';
  if (['withdrawal', 'withdrawals'].includes(t)) return 'withdrawal';
  if (['mining', 'mining_reward', 'reward'].includes(t)) return 'mining';
  if (['purchase', 'purchases', 'plan_purchase'].includes(t)) return 'purchase';
  return t || 'other';
}

/* ─── USDT display karo — har jagah ─── */
function applyUSDTDisplay() {
  const profile = window.Auth ? window.Auth.getProfile() : {};
  const usdtBalance = typeof profile.usdt_balance === 'number' ? profile.usdt_balance : 0;
  const usdtStr  = '$ ' + usdtBalance.toFixed(2);
  const usdtLabel = usdtBalance.toFixed(2) + ' USDT';
  const approxStr = '≈ ' + usdtBalance.toFixed(2) + ' USDT';

  /* Stat card #1 — Wallet Balance */
  setText('walletBalanceCounter', usdtStr);

  /* Wallet tab — big balance */
  setText('walletBigBalance', usdtStr);
  setText('walletBigUSD',    approxStr);

  /* Wallet item USD */
  setText('walletItemUSD', usdtStr);

  /* Portfolio */
  setText('walletUSDTAmount',  usdtLabel);
  setText('portfolioUSDTusd',  usdtStr);
  setText('portfolioTotalUSD', usdtStr);
  setText('portfolioSubLabel', approxStr);

  /* Wallet balances */
  setText('walletUSDTBalance', usdtLabel);
  setText('walletBalanceUSD',  usdtStr);

  /* Stat cards — Daily Profit aur Total Mined (agar BTC me dikha raha to USDT me convert) */
  _fixBTCStatCard('dailyProfitEl');
  _fixBTCStatCard('totalMinedEl');

  /* Chart bottom labels */
  _fixChartLabels();
}

/* Agar koi element ₿ se shuru ho raha hai to USDT me convert karo */
function _fixBTCStatCard(id) {
  const el = document.getElementById(id);
  if (!el) return;
  const txt = el.textContent || '';
  if (txt.includes('₿') || txt.startsWith('B ') || txt.startsWith('Ƀ')) {
    const num = parseFloat(txt.replace(/[^0-9.]/g, '')) || 0;
    const price = window.BTCPrice ? window.BTCPrice.get() : null;
    if (price && num > 0 && num < 1) {
      // BTC value lagti hai, convert karo
      el.textContent = '$ ' + (num * price).toFixed(2);
    } else if (num === 0) {
      el.textContent = '$ 0.00';
    }
  }
}

function _fixChartLabels() {
  ['chartTotal12d', 'chartAvgDaily', 'chartBestDay'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    const txt = el.textContent || '';
    if (txt.includes('₿') || (txt.includes('0.0') && !txt.includes('$'))) {
      const num = parseFloat(txt.replace(/[^0-9.]/g, '')) || 0;
      const price = window.BTCPrice ? window.BTCPrice.get() : null;
      if (price) {
        el.textContent = '$ ' + (num < 1 ? (num * price).toFixed(2) : num.toFixed(2));
      } else {
        el.textContent = '$ ' + (num < 1 ? '0.00' : num.toFixed(2));
      }
    }
  });
}

/* ─── populateUserUI override ─── */
function patchPopulateUserUI() {
  const _orig = window.populateUserUI || function(){};

  window.populateUserUI = async function() {
    await _orig();
    applyUSDTDisplay();
  };
}

/* ─── renderWalletSummary override ─── */
function patchRenderWalletSummary() {
  window.renderWalletSummary = function() {
    const txns = window._allTransactions || [];
    const price = window.BTCPrice ? window.BTCPrice.get() : null;

    const totalDeposited  = txns.filter(t => normTxType(t.type) === 'deposit')
      .reduce((s, t) => s + Number(t.amount || 0), 0);
    const totalWithdrawn  = txns.filter(t => normTxType(t.type) === 'withdrawal')
      .reduce((s, t) => s + Number(t.amount || 0), 0);
    const miningIncome    = txns.filter(t => normTxType(t.type) === 'mining')
      .reduce((s, t) => s + Number(t.amount || 0), 0);
    const referralBonuses = txns.filter(t => t.type === 'referral')
      .reduce((s, t) => s + Number(t.amount || 0), 0);

    /* Mining amounts BTC me hain to convert karo */
    const miningUSDT = (price && miningIncome < 1) ? miningIncome * price : miningIncome;
    const refUSDT    = (price && referralBonuses < 1) ? referralBonuses * price : referralBonuses;

    setText('walletTotalDeposited',       '$ ' + totalDeposited.toFixed(2));
    setText('walletTotalWithdrawn',       '$ ' + totalWithdrawn.toFixed(2));
    setText('walletMiningIncome',         '$ ' + miningUSDT.toFixed(2));
    setText('walletReferralBonuses',      '$ ' + refUSDT.toFixed(2));
    setText('walletTotalMinedEarnings',   '$ ' + miningUSDT.toFixed(2));
    setText('walletTotalReferralEarnings','$ ' + refUSDT.toFixed(2));
  };
}

/* ─── updatePortfolioValue override ─── */
function patchUpdatePortfolioValue() {
  window.updatePortfolioValue = function() {
    const profile = window.Auth ? window.Auth.getProfile() : {};
    const usdt    = typeof profile.usdt_balance === 'number' ? profile.usdt_balance : 0;
    const str     = '$ ' + usdt.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    setText('portfolioTotalUSD', str);
    setText('walletBalanceUSD',  str);
    setText('walletUSDTAmount',  usdt.toFixed(2) + ' USDT');
    setText('portfolioUSDTusd',  str);
    setText('walletBalanceCounter', str);
    setText('walletBigBalance',     str);
  };
}

/* ─── MutationObserver: DOM change hote hi BTC values replace karo ─── */
function watchAndReplaceAll() {
  const targets = [
    'walletBalanceCounter', 'walletBigBalance', 'walletBigUSD',
    'walletItemUSD', 'walletUSDTAmount', 'portfolioUSDTusd',
    'portfolioTotalUSD', 'portfolioSubLabel', 'walletUSDTBalance',
    'walletBalanceUSD', 'dailyProfitEl', 'totalMinedEl',
    'chartTotal12d', 'chartAvgDaily', 'chartBestDay'
  ];

  const observer = new MutationObserver(() => {
    /* Koi bhi change ho, check karo BTC symbol dikha to nahi */
    let needsFix = false;
    targets.forEach(id => {
      const el = document.getElementById(id);
      if (el && (el.textContent.includes('₿') || el.textContent.includes('Ƀ'))) {
        needsFix = true;
      }
    });
    if (needsFix) {
      applyUSDTDisplay();
    }
  });

  targets.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      observer.observe(el, { childList: true, characterData: true, subtree: true });
    }
  });
}

/* ─── MAIN: Patch karo ─── */
function applyUSDTPatch() {
  patchPopulateUserUI();
  patchRenderWalletSummary();
  patchUpdatePortfolioValue();

  /* Turant display fix karo */
  applyUSDTDisplay();

  /* BTCPrice update hone par bhi fix karo */
  if (window.BTCPrice) {
    window.BTCPrice.onChange(() => {
      window.updatePortfolioValue && window.updatePortfolioValue();
      window.renderWalletSummary && window.renderWalletSummary();
      _fixChartLabels();
    });
  }

  /* DOM watch karo */
  watchAndReplaceAll();

  /* Thodi der baad ek aur pass — timing issues ke liye */
  setTimeout(applyUSDTDisplay, 500);
  setTimeout(applyUSDTDisplay, 1500);
  setTimeout(applyUSDTDisplay, 3000);

  console.log('[USDT Patch] Applied — USDT hamesha dikhega.');
}

/* ─── DOMContentLoaded wait karo, phir patch lagao ─── */
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => setTimeout(applyUSDTPatch, 900));
} else {
  setTimeout(applyUSDTPatch, 900);
}
