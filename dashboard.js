/* ══════════════════════════════════════════════════════════════
   CRYPTOVAULT — dashboard.js  (Supabase-powered)
   Uses supabase.js shared client: _sb, CV_Auth, CV_Wallet, CV_Deposits, CV_Plans
   Auth guard · user data · charts · mining stats · transactions
══════════════════════════════════════════════════════════════ */

'use strict';

/* ════════════════════════════════════════════════════════════
   IMMEDIATE GLOBAL EXPORTS (for inline onclick handlers)
   These are defined FIRST so they're available before DOM loads
════════════════════════════════════════════════════════════ */

let _switchTab_fn = null;
let _selectCoin_fn = null;
let _submitDeposit_fn = null;
let _copyDepositAddress_fn = null;
let _saveSettings_fn = null;
let _purchasePlan_fn = null;
let _copyToClipboard_fn = null;

/* Proxy functions that will call the real ones once loaded */
function switchTab(name)       { return _switchTab_fn?.(name); }
function selectCoin(coin)       { return _selectCoin_fn?.(coin); }
function submitDeposit()        { return _submitDeposit_fn?.(); }
function copyDepositAddress()   { return _copyDepositAddress_fn?.(); }
function saveSettings()         { return _saveSettings_fn?.(); }
function purchasePlan(n, p, h)  { return _purchasePlan_fn?.(n, p, h); }
function copyToClipboard(t, m)  { return _copyToClipboard_fn?.(t, m); }

/* Expose immediately to window */
window.switchTab         = switchTab;
window.selectCoin        = selectCoin;
window.submitDeposit     = submitDeposit;
window.copyDepositAddress = copyDepositAddress;
window.saveSettings      = saveSettings;
window.purchasePlan      = purchasePlan;
window.copyToClipboard   = copyToClipboard;

/* ─── USE SUPABASE.JS SHARED CLIENT ─────────────────────── */
/* supabase.js already creates: _sb, CV_Auth, CV_Wallet, CV_Deposits, CV_Plans, Toast, BTCPrice */
/* We use those directly — no duplicate Supabase client creation */

/* ─── SIMULATED MINING DATA ─────────────────────────────── */
const MiningData = {
  hashrates: [82,78,85,91,88,94,87,96,92,98,95,100,97,103,99,105,101,108,104,110,107,112,109,115],
  earnings:  [0.00031,0.00028,0.00033,0.00035,0.00032,0.00038,0.00034,0.00039,0.00037,0.00041,0.00036,0.00043],
  labels:    ['May 13','May 14','May 15','May 16','May 17','May 18','May 19','May 20','May 21','May 22','May 23','May 24'],

  transactions: [
    { id:'TX001', type:'mining', coin:'BTC', amount:'+0.000032', usd:'+$2.17',  status:'success', date:'May 24, 2026', desc:'Daily Mining Reward' },
    { id:'TX002', type:'in',     coin:'BTC', amount:'+0.00150',  usd:'+$101.7', status:'success', date:'May 23, 2026', desc:'Deposit' },
    { id:'TX003', type:'mining', coin:'BTC', amount:'+0.000031', usd:'+$2.10',  status:'success', date:'May 23, 2026', desc:'Daily Mining Reward' },
    { id:'TX004', type:'out',    coin:'BTC', amount:'-0.00080',  usd:'-$54.3',  status:'success', date:'May 22, 2026', desc:'Withdrawal' },
    { id:'TX005', type:'mining', coin:'BTC', amount:'+0.000029', usd:'+$1.97',  status:'success', date:'May 22, 2026', desc:'Daily Mining Reward' },
    { id:'TX006', type:'in',     coin:'BTC', amount:'+0.00200',  usd:'+$135.6', status:'pending', date:'May 21, 2026', desc:'Deposit' },
    { id:'TX007', type:'mining', coin:'BTC', amount:'+0.000033', usd:'+$2.24',  status:'success', date:'May 21, 2026', desc:'Daily Mining Reward' },
    { id:'TX008', type:'out',    coin:'BTC', amount:'-0.00120',  usd:'-$81.4',  status:'success', date:'May 20, 2026', desc:'Withdrawal' },
  ],

  contracts: [
    { name:'Starter Plan', hashrate:10,  power:500,  dailyProfit:'0.000032 BTC', progress:73, daysLeft:22 },
    { name:'Silver Plan',  hashrate:50,  power:1200, dailyProfit:'0.000158 BTC', progress:45, daysLeft:41 },
    { name:'Gold Plan',    hashrate:100, power:2200, dailyProfit:'0.000315 BTC', progress:12, daysLeft:79 },
  ]
};

/* ─── UI HELPERS ─────────────────────────────────────────── */
function $(id) { return document.getElementById(id); }

function setText(id, val) { const el = $(id); if (el) el.textContent = val; }

/* ─── TOAST (fallback if supabase.js not loaded) ─────────── */
const Toast = window.Toast || (() => {
  let el = null;
  function _ensure() {
    if (el) return;
    el = document.createElement('div');
    el.style.cssText = `
      position:fixed;bottom:28px;right:28px;z-index:9999;
      background:#1e2d45;border:1px solid rgba(255,255,255,0.1);
      color:#fff;padding:14px 20px;border-radius:12px;
      font-size:14px;font-weight:500;box-shadow:0 8px 32px rgba(0,0,0,0.4);
      transform:translateY(20px);opacity:0;transition:all 0.3s;pointer-events:none;
    `;
    document.body.appendChild(el);
  }

  function show(msg, type = 'info', duration = 3000) {
    _ensure();
    const colors = { success:'#22c55e', error:'#ef4444', info:'#f59e0b' };
    el.style.borderColor = colors[type] || colors.info;
    el.textContent = msg;
    el.style.transform = 'translateY(0)';
    el.style.opacity   = '1';
    setTimeout(() => {
      el.style.transform = 'translateY(20px)';
      el.style.opacity   = '0';
    }, duration);
  }

  return { show };
})();

/* ─── POPULATE USER DATA INTO UI ─────────────────────────── */
function populateUserUI() {
  /* Use CV_Auth from supabase.js if available, else fallback */
  const user    = (typeof CV_Auth !== 'undefined') ? CV_Auth.getUser() : { email: 'demo@cryptovault.io' };
  const profile = (typeof CV_Auth !== 'undefined') ? CV_Auth.getProfile() : {};

  const email   = user?.email || 'user@cryptovault.io';
  const name    = profile.name  || email.split('@')[0];
  const balance = typeof profile.balance === 'number' ? profile.balance : 0.00042;
  const refCode = profile.ref_code || 'CVXXXXXX';
  const initial = name.charAt(0).toUpperCase();

  /* Avatars & name */
  document.querySelectorAll('.user-avatar-display').forEach(el => el.textContent = initial);
  document.querySelectorAll('.user-name-display').forEach(el => el.textContent = name);
  document.querySelectorAll('.user-email-display').forEach(el => el.textContent = email);

  /* Stat cards */
  setText('walletBalanceCounter', '₿ ' + balance.toFixed(6));
  setText('dailyProfitEl',        '₿ 0.00003200');
  setText('statBalance',          '$' + (balance * 67842).toFixed(2));

  /* Wallet tab */
  setText('walletBigBalance', '₿ ' + balance.toFixed(8));
  setText('walletBtcEquiv', '≈ $' + (balance * 67842).toFixed(2) + ' USD');

  /* Referral */
  const refLink = 'https://cryptovault.io/ref/' + refCode;
  setText('refLinkDisplay', refLink);
  const copyRefBtn = $('copyRefBtn');
  if (copyRefBtn) {
    copyRefBtn.onclick = () => _copyToClipboard_impl(refLink, 'Referral link copied!');
  }

  const refCount = profile.ref_count || 0;
  setText('refCountEl',    refCount);
  setText('refEarningsEl', '₿ ' + (profile.ref_earnings || 0).toFixed(8));
  setText('activeRefEl',   refCount);

  /* Settings form */
  const sName  = $('settingName');
  const sEmail = $('settingEmail');
  if (sName)  sName.value  = profile.name  || '';
  if (sEmail) sEmail.value = email;

  /* Update USD values when BTC price arrives */
  const btcPrice = window.BTCPrice || BTCPrice;
  btcPrice.onChange((price) => {
    const usd = (balance * price).toLocaleString('en-US', { minimumFractionDigits:2, maximumFractionDigits:2 });
    setText('walletBalanceUSD',  '$' + usd);
    setText('walletBigUSD',      '≈ $' + usd + ' USD');
    setText('walletItemUSD',     '$' + usd);
    setText('portfolioBTCusd',   '$' + usd);
    setText('statBalance',       '$' + usd);
    setText('walletBtcEquiv',    '≈ $' + usd + ' USD');

    /* Live BTC ticker in navbar */
    const tickerPrice = $('tickerPrice');
    if (tickerPrice) tickerPrice.textContent = '$' + price.toLocaleString('en-US');
  });
}

/* ─── LOGOUT ─────────────────────────────────────────────── */
function wireLogout() {
  document.querySelectorAll('[data-logout]').forEach(el => {
    el.addEventListener('click', async (e) => {
      e.preventDefault();
      Toast.show('Logging out…', 'info', 1500);
      setTimeout(() => {
        if (typeof CV_Auth !== 'undefined') {
          CV_Auth.logout();
        } else {
          window.location.href = 'login.html';
        }
      }, 800);
    });
  });
}

/* ─── SAVE SETTINGS ──────────────────────────────────────── */
async function _saveSettings_impl() {
  const name  = $('settingName')?.value?.trim();
  const email = $('settingEmail')?.value?.trim();

  const updates = {};
  if (name)  updates.name  = name;
  if (email) updates.email = email;

  if (Object.keys(updates).length) {
    if (typeof CV_Auth !== 'undefined') {
      await CV_Auth.updateProfile(updates);
    }
    if (name) document.querySelectorAll('.user-name-display').forEach(el => el.textContent = name);
    Toast.show('Settings saved!', 'success');
  } else {
    Toast.show('Nothing to save.', 'info');
  }
}

/* ─── TAB NAVIGATION ─────────────────────────────────────── */
function _switchTab_impl(name) {
  document.querySelectorAll('.tab-content').forEach(t  => t.style.display = 'none');
  document.querySelectorAll('.nav-item').forEach(a    => a.classList.remove('active'));

  const tab     = $('tab-' + name);
  const navItem = $('nav-' + name);

  if (tab)     tab.style.display = '';
  if (navItem) navItem.classList.add('active');

  const titles = {
    dashboard:'Dashboard', mining:'Mining', wallet:'Wallet',
    transactions:'Transactions', plans:'Mining Plans',
    referral:'Referral Program', settings:'Settings',
    deposit:'Deposit'
  };
  setText('pageTitle', titles[name] || name);

  /* Close mobile sidebar */
  $('sidebar')?.classList.remove('open');
  $('sidebarOverlay')?.classList.remove('open');
}

/* ─── PURCHASE PLAN ──────────────────────────────────────── */
function _purchasePlan_impl(name, price, hashrate) {
  Toast.show(`✅ ${name} Plan purchased! ${hashrate} TH/s added to your account.`, 'success', 4500);
}

/* ─── COPY TO CLIPBOARD ─────────────────────────────────── */
function _copyToClipboard_impl(text, msg = 'Copied!') {
  navigator.clipboard.writeText(text).then(() => Toast.show(msg, 'success'))
    .catch(() => {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      Toast.show(msg, 'success');
    });
}

/* ════════════════════════════════════════════════════════════
   NEW FEATURES (Coin Switch, Deposit, etc.)
════════════════════════════════════════════════════════════ */

/* ─── COIN SWITCH ────────────────────────────────────────── */
function _selectCoin_impl(coin) {
  const addressDisplay = $('depositAddressDisplay');
  if (!addressDisplay) return;

  /* Use addresses from supabase.js if available */
  const addresses = (typeof DEPOSIT_ADDRESSES !== 'undefined')
    ? DEPOSIT_ADDRESSES
    : {
        BTC:   'bc1qzffpufy57a0r4jpyv7w6qj7w48vzj8jeamusxe',
        USDT:  '0x3484Eb517732AA21A5f410bF9b5E991e9FB251d0'
      };

  addressDisplay.textContent = addresses[coin] || addresses.BTC;

  /* Highlight active coin button */
  document.querySelectorAll('.coin-select-btn').forEach(btn => {
    btn.classList.toggle('active', btn.id === 'btn' + coin);
  });

  const coinLabel = $('coinLabel');
  if (coinLabel) coinLabel.textContent = coin;

  Toast.show(`Switched to ${coin} deposit address`, 'info', 1500);
}

/* ─── COPY DEPOSIT ADDRESS ───────────────────────────────── */
function _copyDepositAddress_impl() {
  const address = $('depositAddressDisplay')?.textContent;
  if (!address) return;
  _copyToClipboard_impl(address, 'Deposit address copied!');
}

/* ─── SUBMIT DEPOSIT ─────────────────────────────────────── */
async function _submitDeposit_impl() {
  const amount   = $('depositAmount')?.value?.trim();
  const txHash   = $('depositTxid')?.value?.trim();
  const coinBtn  = document.querySelector('.coin-select-btn.active');
  const coin     = coinBtn ? coinBtn.id.replace('btn', '') : 'BTC';

  if (!amount || parseFloat(amount) <= 0) {
    Toast.show('Please enter a valid amount', 'error');
    return;
  }

  /* If CV_Deposits available (supabase.js loaded), use real API */
  if (typeof CV_Deposits !== 'undefined') {
    try {
      const { data, error } = await CV_Deposits.submit({
        coin,
        amount: parseFloat(amount),
        txid: txHash || null,
        screenshotUrl: null
      });
      if (error) {
        Toast.show('Error: ' + error.message, 'error');
        return;
      }
      Toast.show(`✅ ${coin} deposit of $${amount} submitted! Pending admin approval.`, 'success', 4000);
    } catch (err) {
      Toast.show('Error submitting deposit', 'error');
      return;
    }
  } else {
    /* Fallback demo mode */
    Toast.show(`✅ ${coin} deposit of $${amount} submitted! Pending confirmation...`, 'success', 4000);
  }

  /* Clear form */
  if ($('depositAmount')) $('depositAmount').value = '';
  if ($('depositTxid')) $('depositTxid').value = '';
}

/* ─── EARNINGS CHART ─────────────────────────────────────── */
function initEarningsChart() {
  const canvas = $('earningsChart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const w   = canvas.width = canvas.offsetWidth;
  const h   = canvas.height = 160;
  const data = MiningData.earnings;
  const max  = Math.max(...data), min = Math.min(...data);
  const range = max - min || 0.0001;

  const getX = i => (i / (data.length - 1)) * (w - 40) + 20;
  const getY = v => h - 20 - ((v - min) / range) * (h - 50);

  const gradient = ctx.createLinearGradient(0, 0, 0, h);
  gradient.addColorStop(0, 'rgba(245,158,11,0.3)');
  gradient.addColorStop(1, 'rgba(245,158,11,0.0)');

  /* Grid lines */
  ctx.strokeStyle = 'rgba(30,45,69,0.6)'; ctx.lineWidth = 1;
  for (let i = 0; i < 4; i++) {
    const y = 20 + (i * (h - 50) / 3);
    ctx.beginPath(); ctx.moveTo(20, y); ctx.lineTo(w - 20, y); ctx.stroke();
  }

  /* Area fill */
  ctx.beginPath(); ctx.moveTo(getX(0), h - 20);
  data.forEach((v, i) => ctx.lineTo(getX(i), getY(v)));
  ctx.lineTo(getX(data.length - 1), h - 20); ctx.closePath();
  ctx.fillStyle = gradient; ctx.fill();

  /* Line */
  ctx.beginPath(); ctx.strokeStyle = '#f59e0b'; ctx.lineWidth = 2.5; ctx.lineJoin = 'round';
  data.forEach((v, i) => { i === 0 ? ctx.moveTo(getX(i), getY(v)) : ctx.lineTo(getX(i), getY(v)); });
  ctx.stroke();

  /* Dots */
  data.forEach((v, i) => {
    ctx.beginPath(); ctx.arc(getX(i), getY(v), 3.5, 0, Math.PI * 2);
    ctx.fillStyle = '#f59e0b'; ctx.fill();
    ctx.strokeStyle = '#1a2236'; ctx.lineWidth = 2; ctx.stroke();
  });
}

/* ─── HASHRATE CHART ─────────────────────────────────────── */
function initHashrateChart() {
  const canvas = $('hashrateChart');
  if (!canvas) return;
  const ctx  = canvas.getContext('2d');
  const w    = canvas.width = canvas.offsetWidth;
  const h    = canvas.height = 100;
  const data = MiningData.hashrates;
  const max  = Math.max(...data), min = Math.min(...data);
  const range = max - min || 1;

  const getX = i => (i / (data.length - 1)) * (w - 20) + 10;
  const getY = v => h - 10 - ((v - min) / range) * (h - 24);

  const gradient = ctx.createLinearGradient(0, 0, 0, h);
  gradient.addColorStop(0, 'rgba(16,185,129,0.25)');
  gradient.addColorStop(1, 'rgba(16,185,129,0.0)');

  ctx.beginPath(); ctx.moveTo(getX(0), h);
  data.forEach((v, i) => ctx.lineTo(getX(i), getY(v)));
  ctx.lineTo(getX(data.length - 1), h); ctx.closePath();
  ctx.fillStyle = gradient; ctx.fill();

  ctx.beginPath(); ctx.strokeStyle = '#10b981'; ctx.lineWidth = 2; ctx.lineJoin = 'round';
  data.forEach((v, i) => { i === 0 ? ctx.moveTo(getX(i), getY(v)) : ctx.lineTo(getX(i), getY(v)); });
  ctx.stroke();
}

/* ─── DONUT CHART ────────────────────────────────────────── */
function initDonut() {
  const canvas = $('donutChart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const size = 120; canvas.width = size; canvas.height = size;
  const cx = size / 2, cy = size / 2, r = 44, rw = 16;
  const segments = [
    { pct:0.58, color:'#f7931a' }, { pct:0.22, color:'#627eea' },
    { pct:0.12, color:'#34c1c7' }, { pct:0.08, color:'#26a17b' },
  ];
  let start = -Math.PI / 2;
  segments.forEach(seg => {
    const angle = seg.pct * 2 * Math.PI;
    ctx.beginPath();
    ctx.arc(cx, cy, r, start, start + angle);
    ctx.arc(cx, cy, r - rw, start + angle, start, true);
    ctx.closePath(); ctx.fillStyle = seg.color; ctx.fill();
    start += angle + 0.03;
  });
  ctx.fillStyle = '#f1f5f9'; ctx.font = 'bold 13px Arial';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('BTC', cx, cy - 6);
  ctx.font = '10px Arial'; ctx.fillStyle = '#94a3b8';
  ctx.fillText('58%', cx, cy + 8);
}

/* ─── TRANSACTION TABLE ──────────────────────────────────── */
function renderTransactions(filter = 'all') {
  const tbody = $('txTableBody');
  if (!tbody) return;
  const rows = filter === 'all'
    ? MiningData.transactions
    : MiningData.transactions.filter(t => t.type === filter);

  const statusBadge = s => s === 'success'
    ? `<span style="background:rgba(34,197,94,0.15);color:#22c55e;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:600;">Success</span>`
    : `<span style="background:rgba(245,158,11,0.15);color:#f59e0b;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:600;">Pending</span>`;

  tbody.innerHTML = rows.map(tx => `
    <tr>
      <td>${tx.desc}</td>
      <td>${tx.coin}</td>
      <td style="color:${tx.amount[0] === '+' ? '#10b981' : '#ef4444'};font-family:'DM Mono',monospace;">${tx.amount}</td>
      <td style="font-family:'DM Mono',monospace;color:#94a3b8;">${tx.usd}</td>
      <td>${statusBadge(tx.status)}</td>
      <td style="color:#94a3b8;">${tx.date}</td>
    </tr>
  `).join('');
}

/* ─── TX FILTER TABS ─────────────────────────────────────── */
function wireTransactionFilters() {
  document.querySelectorAll('[data-tx-filter]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-tx-filter]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderTransactions(btn.dataset.txFilter);
    });
  });
}

/* ─── CONTRACTS ──────────────────────────────────────────── */
function renderContracts() {
  const container = $('contractsContainer');
  if (!container) return;
  container.innerHTML = MiningData.contracts.map(c => `
    <div class="rig-card" style="margin-bottom:12px;">
      <div class="tx-icon mining">⛏️</div>
      <div class="rig-info">
        <div class="rig-name">${c.name}</div>
        <div class="rig-specs">${c.hashrate} TH/s · ${c.power}W · ${c.daysLeft} days left</div>
      </div>
      <div class="rig-metrics">
        <div class="rig-hash" style="color:var(--green)">${c.dailyProfit}/day</div>
        <div class="text-xs text-muted">${c.progress}% complete</div>
      </div>
    </div>
  `).join('');
}

/* ─── LIVE HASHRATE TICKER ───────────────────────────────── */
function startLiveTicker() {
  const els = [$('liveHashrate'), $('liveHashrate2')];
  let base  = 115.3;
  setInterval(() => {
    base += (Math.random() - 0.48) * 1.2;
    base  = Math.max(100, Math.min(130, base));
    const text = base.toFixed(1) + ' TH/s';
    els.forEach(el => { if (el) el.textContent = text; });
  }, 2500);
}

/* ─── DAILY PROFIT TICKER ────────────────────────────────── */
function animateDailyProfit() {
  const el = $('dailyProfitEl');
  if (!el) return;
  let val = 0.000032;
  setInterval(() => {
    val += 0.0000001 * Math.random();
    el.textContent = '₿ ' + val.toFixed(8);
  }, 3000);
}

/* ─── MOBILE MENU ────────────────────────────────────────── */
function wireMobileMenu() {
  const toggle  = $('menuToggle');
  const sidebar = $('sidebar');
  const overlay = $('sidebarOverlay');
  if (!toggle || !sidebar) return;

  toggle.addEventListener('click', () => {
    sidebar.classList.toggle('open');
    overlay?.classList.toggle('open');
  });

  overlay?.addEventListener('click', () => {
    sidebar.classList.remove('open');
    overlay.classList.remove('open');
  });
}

/* ─── DROPDOWN ───────────────────────────────────────────── */
function wireDropdowns() {
  document.querySelectorAll('[data-dropdown-toggle]').forEach(trigger => {
    trigger.addEventListener('click', (e) => {
      e.stopPropagation();
      const menu = $(trigger.dataset.dropdownToggle);
      if (!menu) return;
      const isOpen = menu.classList.contains('open');
      document.querySelectorAll('.dropdown-menu').forEach(m => m.classList.remove('open'));
      if (!isOpen) menu.classList.add('open');
    });
  });
  document.addEventListener('click', () => {
    document.querySelectorAll('.dropdown-menu').forEach(m => m.classList.remove('open'));
  });
}

/* ─── MODALS ─────────────────────────────────────────────── */
function wireModals() {
  /* Open */
  document.querySelectorAll('[data-modal]').forEach(btn => {
    btn.addEventListener('click', () => {
      const modal = $(btn.dataset.modal);
      if (modal) modal.style.display = 'flex';
    });
  });

  /* Close button */
  document.querySelectorAll('[data-close-modal]').forEach(btn => {
    btn.addEventListener('click', () => {
      const modal = $(btn.dataset.closeModal);
      if (modal) modal.style.display = 'none';
    });
  });

  /* Click outside */
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.style.display = 'none';
    });
  });

  /* Deposit form */
  const depositForm = $('depositForm');
  if (depositForm) {
    depositForm.addEventListener('submit', (e) => {
      e.preventDefault();
      _submitDeposit_impl();
    });
  }

  /* Withdraw form */
  const withdrawForm = $('withdrawForm');
  if (withdrawForm) {
    withdrawForm.addEventListener('submit', (e) => {
      e.preventDefault();
      $('withdrawModal').style.display = 'none';
      Toast.show('📤 Withdrawal submitted. Processing within 24 hours.', 'info', 4000);
    });
  }
}

/* ─── FILE UPLOAD PREVIEW ────────────────────────────────── */
function wireFileUpload() {
  const input = $('screenshotInput');
  const zone  = $('uploadZone');
  const label = $('uploadLabel');
  if (!input || !zone) return;

  input.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
      if (label) label.textContent = '✅ ' + file.name;
      zone.style.borderColor = '#22c55e';
    }
  });
}

/* ─── MAIN INIT ──────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', async () => {

  /* Wire up the proxy functions to real implementations */
  _switchTab_fn         = _switchTab_impl;
  _selectCoin_fn        = _selectCoin_impl;
  _submitDeposit_fn     = _submitDeposit_impl;
  _copyDepositAddress_fn = _copyDepositAddress_impl;
  _saveSettings_fn      = _saveSettings_impl;
  _purchasePlan_fn      = _purchasePlan_impl;
  _copyToClipboard_fn   = _copyToClipboard_impl;

  /* 1. Auth via CV_Auth from supabase.js */
  let ok = false;
  if (typeof CV_Auth !== 'undefined') {
    ok = await CV_Auth.init();
  } else {
    console.warn('CV_Auth not found — running in demo mode');
    ok = true;
  }
  if (!ok) return;

  /* 2. Populate UI with real user data */
  populateUserUI();

  /* 3. Wire interactions */
  wireLogout();
  wireMobileMenu();
  wireDropdowns();
  wireModals();
  wireTransactionFilters();
  wireFileUpload();

  /* 4. Render dynamic content */
  renderTransactions();
  renderContracts();

  /* 5. Charts (small delay to allow layout paint) */
  setTimeout(() => {
    initEarningsChart();
    initHashrateChart();
    initDonut();
  }, 120);

  /* 6. Live tickers */
  startLiveTicker();
  animateDailyProfit();

  /* 7. Expose globals for any late-loading scripts */
  window.switchTab         = switchTab;
  window.selectCoin        = selectCoin;
  window.submitDeposit     = submitDeposit;
  window.copyDepositAddress = copyDepositAddress;
  window.saveSettings      = saveSettings;
  window.purchasePlan      = purchasePlan;
  window.copyToClipboard   = copyToClipboard;
  window.Toast             = Toast;
  window.BTCPrice          = window.BTCPrice || BTCPrice;
  window.Auth              = (typeof CV_Auth !== 'undefined') ? CV_Auth : null;
});
