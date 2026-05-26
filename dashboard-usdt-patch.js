/* ══════════════════════════════════════════════════════════════
   CRYPTOVAULT — USDT PATCH
   Yeh file dashboard.js ke baad load hogi aur BTC functions
   ko USDT-first se override karegi.
   dashboard.html mein <script src="dashboard.js"> ke BAAD
   <script src="dashboard-usdt-patch.js"> add karo.
══════════════════════════════════════════════════════════════ */
'use strict';

/* ─── Wait for dashboard.js to fully initialize ─── */
document.addEventListener('DOMContentLoaded', () => {
  /* Small delay to let Auth + populateUserUI run first */
  setTimeout(applyUSDTPatch, 800);
});

/* ─── MAIN PATCH FUNCTION ─── */
function applyUSDTPatch() {

  /* ── 1. Override populateUserUI to show USDT balance ── */
  const _origPopulateUserUI = window.populateUserUI || function(){};

  async function populateUserUI_USDT() {
    /* Call original first */
    await _origPopulateUserUI();

    const profile = window.Auth ? window.Auth.getProfile() : {};
    const usdtBalance = typeof profile.usdt_balance === 'number' ? profile.usdt_balance : 0;
    const usdtStr = '$ ' + usdtBalance.toFixed(2);

    /* Dashboard stat card #1 — Wallet Balance */
    const wbc = document.getElementById('walletBalanceCounter');
    if (wbc) wbc.textContent = usdtStr;

    /* Wallet tab — big balance */
    const wbb = document.getElementById('walletBigBalance');
    if (wbb) wbb.textContent = usdtStr;

    const wbu = document.getElementById('walletBigUSD');
    if (wbu) wbu.textContent = '≈ ' + usdtBalance.toFixed(2) + ' USDT';

    /* Portfolio card — USDT amount */
    const wua = document.getElementById('walletUSDTAmount');
    if (wua) wua.textContent = usdtBalance.toFixed(2) + ' USDT';

    const puu = document.getElementById('portfolioUSDTusd');
    if (puu) puu.textContent = '$ ' + usdtBalance.toFixed(2);

    /* portfolioTotalUSD */
    const ptu = document.getElementById('portfolioTotalUSD');
    if (ptu) ptu.textContent = '$ ' + usdtBalance.toFixed(2);

    /* portfolioSubLabel */
    const psl = document.getElementById('portfolioSubLabel');
    if (psl) psl.textContent = '≈ ' + usdtBalance.toFixed(2) + ' USDT';

    /* Wallet tab balances */
    const wub = document.getElementById('walletUSDTBalance');
    if (wub) wub.textContent = usdtBalance.toFixed(2) + ' USDT';

    const wiu = document.getElementById('walletItemUSD');
    if (wiu) wiu.textContent = '$ ' + usdtBalance.toFixed(2);
  }

  window.populateUserUI = populateUserUI_USDT;

  /* ── 2. Override renderWalletSummary to show USDT amounts ── */
  window.renderWalletSummary = function() {
    const txns = window._allTransactions || [];

    const totalDeposited  = txns.filter(t => normTxType(t.type) === 'deposit')
      .reduce((s, t) => s + Number(t.amount || 0), 0);
    const totalWithdrawn  = txns.filter(t => normTxType(t.type) === 'withdrawal')
      .reduce((s, t) => s + Number(t.amount || 0), 0);
    const miningIncome    = txns.filter(t => normTxType(t.type) === 'mining')
      .reduce((s, t) => s + Number(t.amount || 0), 0);
    const referralBonuses = txns.filter(t => t.type === 'referral')
      .reduce((s, t) => s + Number(t.amount || 0), 0);

    /* Convert BTC mining amounts to USDT using live price */
    const price = window.BTCPrice ? window.BTCPrice.get() : null;
    const miningUSDT = price ? miningIncome * price : miningIncome;
    const refUSDT    = price ? referralBonuses * price : referralBonuses;

    setText('walletTotalDeposited',  '$ ' + totalDeposited.toFixed(2));
    setText('walletTotalWithdrawn',  '$ ' + totalWithdrawn.toFixed(2));
    setText('walletMiningIncome',    '$ ' + miningUSDT.toFixed(2));
    setText('walletReferralBonuses', '$ ' + refUSDT.toFixed(2));
    setText('walletTotalMinedEarnings', '$ ' + miningUSDT.toFixed(2));
    setText('walletTotalReferralEarnings', '$ ' + refUSDT.toFixed(2));
  };

  /* ── 3. Override populateDashboardStats to show USDT ── */
  const _origPopulateDashboardStats = window.populateDashboardStats || function(){};

  window.populateDashboardStats = async function(contracts) {
    await _origPopulateDashboardStats(contracts);

    const activeContracts = (contracts || []).filter(c => c.active === true);
    const dailyProfit = activeContracts.reduce((s, c) => s + Number(c.daily_profit || 0), 0);

    /* Convert BTC daily profit to USDT */
    const price = window.BTCPrice ? window.BTCPrice.get() : null;
    const dailyUSDT = price ? dailyProfit * price : dailyProfit * 67000;
    setText('dailyProfitEl', '$ ' + dailyUSDT.toFixed(2));

    /* Total mined in USDT */
    const user = window.Auth ? window.Auth.getUser() : null;
    if (user && window._supabase) {
      /* _allTransactions is already loaded */
      const txns = window._allTransactions || [];
      const miningBTC = txns.filter(t => normTxType(t.type) === 'mining')
        .reduce((s, t) => s + Number(t.amount || 0), 0);
      const miningUSDT = price ? miningBTC * price : miningBTC * 67000;
      setText('totalMinedEl', '$ ' + miningUSDT.toFixed(2));
    } else {
      setText('totalMinedEl', '$ 0.00');
    }

    /* chart stats in USDT */
    updateChartLabelsUSDT();
  };

  /* ── 4. Update chart bottom labels to USDT ── */
  function updateChartLabelsUSDT() {
    const price = window.BTCPrice ? window.BTCPrice.get() : null;
    if (!price) return;

    const parseAmt = id => {
      const el = document.getElementById(id);
      if (!el) return 0;
      const txt = el.textContent.replace(/[₿$,\s]/g, '');
      return parseFloat(txt) || 0;
    };

    const total = parseAmt('chartTotal12d');
    const avg   = parseAmt('chartAvgDaily');
    const best  = parseAmt('chartBestDay');

    /* If values look like BTC (very small), convert */
    if (total < 1) {
      setText('chartTotal12d', '$ ' + (total * price).toFixed(2));
      setText('chartAvgDaily',  '$ ' + (avg   * price).toFixed(2));
      setText('chartBestDay',   '$ ' + (best  * price).toFixed(2));
    }
  }

  /* ── 5. updatePortfolioValue → USDT ── */
  window.updatePortfolioValue = function() {
    const profile  = window.Auth ? window.Auth.getProfile() : {};
    const usdt     = typeof profile.usdt_balance === 'number' ? profile.usdt_balance : 0;
    const str      = '$ ' + usdt.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    setText('portfolioTotalUSD', str);
    setText('walletBalanceUSD',  str);

    const wua = document.getElementById('walletUSDTAmount');
    if (wua) wua.textContent = usdt.toFixed(2) + ' USDT';

    const puu = document.getElementById('portfolioUSDTusd');
    if (puu) puu.textContent = str;
  };

  /* ── 6. Re-run patch immediately ── */
  populateUserUI_USDT();

  /* ── 7. Re-apply whenever BTC price updates ── */
  if (window.BTCPrice) {
    window.BTCPrice.onChange(() => {
      window.updatePortfolioValue();
      window.renderWalletSummary && window.renderWalletSummary();
      updateChartLabelsUSDT();
    });
  }

  console.log('[USDT Patch] Applied successfully.');
}

/* ─── HELPER: normalize tx type (same as dashboard.js) ─── */
function normTxType(raw) {
  const t = String(raw || '').trim().toLowerCase();
  if (['deposit', 'deposits', 'approved_deposit'].includes(t)) return 'deposit';
  if (['withdrawal', 'withdrawals'].includes(t)) return 'withdrawal';
  if (['mining', 'mining_reward', 'reward'].includes(t)) return 'mining';
  if (['purchase', 'purchases', 'plan_purchase'].includes(t)) return 'purchase';
  return t || 'other';
}

/* ─── HELPER: setText ─── */
function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}
