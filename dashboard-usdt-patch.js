/* ══════════════════════════════════════════════════════════════
   CRYPTOVAULT — USDT PATCH (Optimized - No Lag)
══════════════════════════════════════════════════════════════ */
'use strict';

function setText(id, val) {
  const el = document.getElementById(id);
  if (el && el.textContent !== val) el.textContent = val;
}

function normTxType(raw) {
  const t = String(raw || '').trim().toLowerCase();
  if (['deposit', 'deposits', 'approved_deposit'].includes(t)) return 'deposit';
  if (['withdrawal', 'withdrawals'].includes(t)) return 'withdrawal';
  if (['mining', 'mining_reward', 'reward'].includes(t)) return 'mining';
  if (['purchase', 'purchases', 'plan_purchase'].includes(t)) return 'purchase';
  return t || 'other';
}

/* ─── USDT display — observer ke bahar call hoti hai ─── */
let _isApplying = false; // Re-entry guard

function applyUSDTDisplay() {
  if (_isApplying) return;
  _isApplying = true;

  try {
    const profile = window.Auth ? window.Auth.getProfile() : {};
    const usdt = typeof profile.usdt_balance === 'number' ? profile.usdt_balance : 0;
    const usdtStr   = '$ ' + usdt.toFixed(2);
    const usdtLabel = usdt.toFixed(2) + ' USDT';
    const approxStr = '≈ ' + usdt.toFixed(2) + ' USDT';

    setText('walletBalanceCounter', usdtStr);
    setText('walletBigBalance',     usdtStr);
    setText('walletBigUSD',         approxStr);
    setText('walletItemUSD',        usdtStr);
    setText('walletUSDTAmount',     usdtLabel);
    setText('portfolioUSDTusd',     usdtStr);
    setText('portfolioTotalUSD',    usdtStr);
    setText('portfolioSubLabel',    approxStr);
    setText('walletUSDTBalance',    usdtLabel);
    setText('walletBalanceUSD',     usdtStr);

    /* Daily Profit & Total Mined — BTC to USDT convert */
    const price = window.BTCPrice ? window.BTCPrice.get() : null;
    _convertBTCEl('dailyProfitEl', price);
    _convertBTCEl('totalMinedEl',  price);
    _convertBTCEl('chartTotal12d', price);
    _convertBTCEl('chartAvgDaily', price);
    _convertBTCEl('chartBestDay',  price);
  } finally {
    _isApplying = false;
  }
}

function _convertBTCEl(id, price) {
  const el = document.getElementById(id);
  if (!el) return;
  const txt = el.textContent || '';
  /* Sirf tab convert karo jab BTC symbol ho */
  if (txt.includes('₿') || txt.includes('Ƀ') || txt.startsWith('B ')) {
    const num = parseFloat(txt.replace(/[^0-9.]/g, '')) || 0;
    const usdVal = (price && num > 0) ? (num * price).toFixed(2) : '0.00';
    const newTxt = '$ ' + usdVal;
    if (el.textContent !== newTxt) el.textContent = newTxt;
  }
}

/* ─── Patches ─── */
function patchPopulateUserUI() {
  const _orig = window.populateUserUI || function(){};
  window.populateUserUI = async function() {
    await _orig();
    applyUSDTDisplay();
  };
}

function patchRenderWalletSummary() {
  window.renderWalletSummary = function() {
    const txns  = window._allTransactions || [];
    const price = window.BTCPrice ? window.BTCPrice.get() : null;

    const totalDeposited  = txns.filter(t => normTxType(t.type) === 'deposit')
      .reduce((s, t) => s + Number(t.amount || 0), 0);
    const totalWithdrawn  = txns.filter(t => normTxType(t.type) === 'withdrawal')
      .reduce((s, t) => s + Number(t.amount || 0), 0);
    const miningIncome    = txns.filter(t => normTxType(t.type) === 'mining')
      .reduce((s, t) => s + Number(t.amount || 0), 0);
    const referralBonuses = txns.filter(t => t.type === 'referral')
      .reduce((s, t) => s + Number(t.amount || 0), 0);

    const miningUSDT = (price && miningIncome < 1) ? miningIncome * price : miningIncome;
    const refUSDT    = (price && referralBonuses < 1) ? referralBonuses * price : referralBonuses;

    setText('walletTotalDeposited',        '$ ' + totalDeposited.toFixed(2));
    setText('walletTotalWithdrawn',        '$ ' + totalWithdrawn.toFixed(2));
    setText('walletMiningIncome',          '$ ' + miningUSDT.toFixed(2));
    setText('walletReferralBonuses',       '$ ' + refUSDT.toFixed(2));
    setText('walletTotalMinedEarnings',    '$ ' + miningUSDT.toFixed(2));
    setText('walletTotalReferralEarnings', '$ ' + refUSDT.toFixed(2));
  };
}

function patchUpdatePortfolioValue() {
  window.updatePortfolioValue = function() {
    const profile = window.Auth ? window.Auth.getProfile() : {};
    const usdt    = typeof profile.usdt_balance === 'number' ? profile.usdt_balance : 0;
    const str     = '$ ' + usdt.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    setText('portfolioTotalUSD',    str);
    setText('walletBalanceUSD',     str);
    setText('walletUSDTAmount',     usdt.toFixed(2) + ' USDT');
    setText('portfolioUSDTusd',     str);
    setText('walletBalanceCounter', str);
    setText('walletBigBalance',     str);
  };
}

/* ─── MutationObserver — DEBOUNCED, infinite loop nahi ─── */
function watchForBTCSymbol() {
  let debounceTimer = null;

  const observer = new MutationObserver(() => {
    if (_isApplying) return; // Apni hi changes ignore karo

    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      /* Sirf check karo ₿ symbol kahi dikh raha hai kya */
      const bodyText = document.body.innerText || '';
      if (bodyText.includes('₿') || bodyText.includes('Ƀ')) {
        applyUSDTDisplay();
      }
    }, 300); // 300ms debounce — bar bar fire nahi hoga
  });

  observer.observe(document.body, { childList: true, subtree: true, characterData: true });
}

/* ─── MAIN ─── */
function applyUSDTPatch() {
  patchPopulateUserUI();
  patchRenderWalletSummary();
  patchUpdatePortfolioValue();

  applyUSDTDisplay();

  if (window.BTCPrice) {
    window.BTCPrice.onChange(() => {
      window.updatePortfolioValue();
      window.renderWalletSummary();
    });
  }

  /* Sirf 2 baar delayed fix — loop nahi */
  setTimeout(applyUSDTDisplay, 800);
  setTimeout(applyUSDTDisplay, 2500);

  /* Observer lagao */
  watchForBTCSymbol();

  console.log('[USDT Patch] Applied — optimized, no lag.');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => setTimeout(applyUSDTPatch, 900));
} else {
  setTimeout(applyUSDTPatch, 900);
}
