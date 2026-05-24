/* ══════════════════════════════════════════════════════════════
   CRYPTOVAULT — dashboard.js  (Supabase-powered)
   Auth guard · user data · charts · mining stats · transactions
══════════════════════════════════════════════════════════════ */

'use strict';

/* ─── SUPABASE INIT ─────────────────────────────────────── */
const SUPABASE_URL = 'https://fwgqydxkdbuzrehqifjw.supabase.co';
const SUPABASE_KEY = 'sb_publishable_Pbn_Z0wwsqMUyLWYg3udmQ_MC-Qz1kj';
let _supabase = null;

try {
  if (typeof supabase !== 'undefined' && supabase.createClient) {
    _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
  } else {
    console.error('Supabase library not loaded. Auth and data features will not work.');
  }
} catch (err) {
  console.error('Failed to initialize Supabase client:', err);
}

/* ─── AUTH MODULE ───────────────────────────────────────── */
const Auth = (() => {
  let _session  = null;   // raw Supabase session
  let _profile  = null;   // profiles row

  async function init() {
    try {
      if (!_supabase) {
        console.error('Supabase client not available');
        window.location.href = 'login.html';
        return false;
      }

      /* 1. Restore persisted session */
      const { data: { session } } = await _supabase.auth.getSession();

      if (!session) {
        /* Not logged in → redirect */
        window.location.href = 'login.html';
        return false;
      }

      _session = session;

      /* 2. Fetch or create profile row */
      const { data: prof, error } = await _supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single();

      if (error || !prof) {
        /* Profile missing — create it */
        try {
          const { data: newProf, error: upsertError } = await _supabase
            .from('profiles')
            .upsert({
              id:            session.user.id,
              email:         session.user.email,
              btc_balance:   0.00042,
              usdt_balance:  0.00,
              ref_code:      'CV' + Math.random().toString(36).substring(2, 8).toUpperCase()
            })
            .select()
            .single();
          if (upsertError) {
            console.error('Failed to create profile:', upsertError);
            _profile = {
              id: session.user.id,
              email: session.user.email,
              btc_balance: 0.00042,
              usdt_balance: 0.00,
              ref_code: 'CV' + Math.random().toString(36).substring(2, 8).toUpperCase()
            };
          } else {
            _profile = newProf;
          }
        } catch (profileErr) {
          console.error('Exception creating profile:', profileErr);
          _profile = {
            id: session.user.id,
            email: session.user.email,
            btc_balance: 0.00042,
            usdt_balance: 0.00,
            ref_code: 'CV' + Math.random().toString(36).substring(2, 8).toUpperCase()
          };
        }
      } else {
        _profile = prof;
      }

      /* 3. Listen for auth state changes (token refresh / logout from another tab) */
      _supabase.auth.onAuthStateChange((event) => {
        if (event === 'SIGNED_OUT') window.location.href = 'login.html';
      });

      return true;
    } catch (err) {
      console.error('Auth init failed:', err);
      window.location.href = 'login.html';
      return false;
    }
  }

  async function logout() {
    try {
      if (_supabase) {
        await _supabase.auth.signOut();
      }
    } catch (err) {
      console.error('Logout error:', err);
    }
    try {
      localStorage.removeItem('cv_remember');
    } catch (e) { /* ignore */ }
    window.location.href = 'login.html';
  }

  function getUser()    { return _session?.user  || null; }
  function getProfile() { return _profile        || {};   }

  async function updateProfile(fields) {
    if (!_session || !_supabase) return null;
    try {
      const { data, error } = await _supabase
        .from('profiles')
        .update(fields)
        .eq('id', _session.user.id)
        .select()
        .single();
      if (error) {
        console.error('Profile update error:', error);
        return null;
      }
      if (data) _profile = data;
      return data;
    } catch (err) {
      console.error('Exception updating profile:', err);
      return null;
    }
  }

  return { init, logout, getUser, getProfile, updateProfile };
})();

/* ─── BTC PRICE (public API, no auth needed) ─────────────── */
const BTCPrice = (() => {
  let _price    = 67842;
  let _cbs      = [];

  function onChange(cb) { _cbs.push(cb); cb(_price); }

  async function _fetch() {
    try {
      const r = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd');
      if (r.ok) {
        const j = await r.json();
        _price = j.bitcoin?.usd || _price;
        _cbs.forEach(cb => cb(_price));
      }
    } catch (_) { /* use cached price */ }
  }

  _fetch();
  setInterval(_fetch, 60_000);
  return { onChange, get: () => _price };
})();

/* ─── SIMULATED MINING DATA ─────────────────────────────── */
const MiningData = {
  hashrates: [82,78,85,91,88,94,87,96,92,98,95,100,97,103,99,105,101,108,104,110,107,112,109,115],
  earnings:  [0.00031,0.00028,0.00033,0.00035,0.00032,0.00038,0.00034,0.00039,0.00037,0.00041,0.00036,0.00043],
  labels:    ['May 13','May 14','May 15','May 16','May 17','May 18','May 19','May 20','May 21','May 22','May 23','May 24'],

  /* Simulated mining rewards & withdrawals — temporary fake data */
  transactions: [
    { id:'TX001', type:'mining', coin:'BTC', amount:'+0.000032', usd:'+$2.17',  status:'success', date:'May 24, 2026', desc:'Daily Mining Reward' },
    { id:'TX003', type:'mining', coin:'BTC', amount:'+0.000031', usd:'+$2.10',  status:'success', date:'May 23, 2026', desc:'Daily Mining Reward' },
    { id:'TX005', type:'mining', coin:'BTC', amount:'+0.000029', usd:'+$1.97',  status:'success', date:'May 22, 2026', desc:'Daily Mining Reward' },
    { id:'TX007', type:'mining', coin:'BTC', amount:'+0.000033', usd:'+$2.24',  status:'success', date:'May 21, 2026', desc:'Daily Mining Reward' },
    { id:'TX004', type:'withdrawals',    coin:'BTC', amount:'-0.00080',  usd:'-$54.3',  status:'success', date:'May 22, 2026', desc:'Withdrawal' },
    { id:'TX008', type:'withdrawals',    coin:'BTC', amount:'-0.00120',  usd:'-$81.4',  status:'success', date:'May 20, 2026', desc:'Withdrawal' },
  ],

  contracts: [
    { name:'Starter Plan', hashrate:10,  power:500,  dailyProfit:'0.000032 BTC', progress:73, daysLeft:22 },
    { name:'Silver Plan',  hashrate:50,  power:1200, dailyProfit:'0.000158 BTC', progress:45, daysLeft:41 },
    { name:'Gold Plan',    hashrate:100, power:2200, dailyProfit:'0.000315 BTC', progress:12, daysLeft:79 },
  ]
};

/* ─── REAL DEPOSIT DATA MODULE ──────────────────────────── */
const DepositData = (() => {
  let _deposits = [];
  let _btcPrice = 67842;

  /* Listen to BTC price for USD conversion */
  BTCPrice.onChange((price) => { _btcPrice = price; });

  /* Fetch real deposits from Supabase */
  async function fetchDeposits() {
    try {
      const user = Auth.getUser();
      if (!user || !_supabase) return [];

      const { data, error } = await _supabase
        .from('deposits')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Failed to fetch deposits:', error);
        return [];
      }

      _deposits = data || [];
      return _deposits;
    } catch (err) {
      console.error('Exception fetching deposits:', err);
      return [];
    }
  }

  /* Convert a deposit row into transaction row format */
  function depositToTx(deposit) {
    try {
      const coinLabel = deposit.coin === 'usdt_bep20' ? 'USDT (BEP20)' : 'BTC';
      const amount    = parseFloat(deposit.amount) || 0;
      const isUSDT    = deposit.coin === 'usdt_bep20';

      /* USD value estimation */
      let usdVal = 0;
      if (isUSDT) {
        usdVal = amount;
      } else {
        /* BTC → USD */
        usdVal = amount * _btcPrice;
      }
      const usdStr = '+$' + usdVal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

      /* Format date: 2026-05-24T14:30:00 → "May 24, 2026" */
      const d = new Date(deposit.created_at);
      const dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

      /* Format amount with + sign */
      const amountStr = '+' + amount.toFixed(isUSDT ? 2 : 8) + ' ' + coinLabel.split(' ')[0];

      return {
        id:        'DEP-' + (deposit.id ? deposit.id.slice(-6).toUpperCase() : 'UNKNOWN'),
        type:      'deposits',
        coin:      coinLabel,
        amount:    amountStr,
        usd:       usdStr,
        status:    deposit.status || 'pending',
        date:      dateStr,
        desc:      'Deposit',
        createdAt: deposit.created_at,
        isReal:    true
      };
    } catch (err) {
      console.error('Error converting deposit to transaction:', err);
      return null;
    }
  }

  /* Merge real deposits with simulated data, sort newest first */
  function getMergedTransactions() {
    try {
      /* Convert all real deposits */
      const realTxs = _deposits.map(depositToTx).filter(tx => tx !== null);

      /* Simulated transactions with a fake createdAt for sorting */
      const simTxs = MiningData.transactions.map((tx, idx) => ({
        ...tx,
        createdAt: '2026-05-20T00:00:00.000Z', /* older than any real deposit */
        isReal: false
      }));

      /* Merge and sort by date descending (newest first) */
      const merged = [...realTxs, ...simTxs];
      merged.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

      return merged;
    } catch (err) {
      console.error('Error merging transactions:', err);
      return MiningData.transactions;
    }
  }

  /* Get only real deposits (for re-rendering after submit) */
  function getDeposits() { return _deposits; }

  /* Manually add a deposit (called immediately after successful submit) */
  function addDeposit(deposit) {
    if (deposit) {
      _deposits.unshift(deposit);
    }
  }

  return { fetchDeposits, getMergedTransactions, getDeposits, addDeposit, depositToTx };
})();

/* ─── UI HELPERS ─────────────────────────────────────────── */
function $(id) { return document.getElementById(id); }

function setText(id, val) {
  const el = $(id);
  if (el) el.textContent = val;
}

function copyToClipboard(text, msg) {
  msg = msg || 'Copied!';
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(() => Toast.show(msg, 'success')).catch((err) => {
      console.error('Clipboard copy failed:', err);
      fallbackCopy(text, msg);
    });
  } else {
    fallbackCopy(text, msg);
  }
}

function fallbackCopy(text, msg) {
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    Toast.show(msg, 'success');
  } catch (err) {
    console.error('Fallback copy failed:', err);
    Toast.show('Copy failed. Please copy manually.', 'error');
  }
}

/* ─── TOAST ──────────────────────────────────────────────── */
const Toast = (() => {
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

  function show(msg, type, duration) {
    type = type || 'info';
    duration = duration || 3000;
    _ensure();
    const colors = { success:'#22c55e', error:'#ef4444', info:'#f59e0b' };
    el.style.borderColor = colors[type] || colors.info;
    el.textContent = msg;
    el.style.transform = 'translateY(0)';
    el.style.opacity   = '1';
    setTimeout(() => {
      if (el) {
        el.style.transform = 'translateY(20px)';
        el.style.opacity   = '0';
      }
    }, duration);
  }

  return { show };
})();

/* ─── POPULATE USER DATA INTO UI ─────────────────────────── */
function populateUserUI() {
  try {
    const user    = Auth.getUser();
    const profile = Auth.getProfile();

    const email   = user?.email || 'user@cryptovault.io';
    const name    = profile.name  || email.split('@')[0];
    const btcBalance  = typeof profile.btc_balance  === 'number' ? profile.btc_balance  : 0.00042;
    const usdtBalance = typeof profile.usdt_balance === 'number' ? profile.usdt_balance : 0.00;
    const refCode = profile.ref_code || 'CVXXXXXX';
    const initial = name.charAt(0).toUpperCase();

    /* Avatars & name */
    document.querySelectorAll('.user-avatar-display').forEach(el => { if (el) el.textContent = initial; });
    document.querySelectorAll('.user-name-display').forEach(el => { if (el) el.textContent = name; });
    document.querySelectorAll('.user-email-display').forEach(el => { if (el) el.textContent = email; });

    /* Stat cards — FIX: use btcBalance instead of undefined 'balance' */
    const walletBalanceCounter = $('walletBalanceCounter');
    if (walletBalanceCounter) walletBalanceCounter.textContent = '₿ ' + btcBalance.toFixed(6);

    const dailyProfitEl = $('dailyProfitEl');
    if (dailyProfitEl) dailyProfitEl.textContent = '₿ 0.00003200';

    /* Wallet tab — FIX: use btcBalance instead of undefined 'balance' */
    const walletBigBalance = $('walletBigBalance');
    if (walletBigBalance) walletBigBalance.textContent = '₿ ' + btcBalance.toFixed(8);

    /* Referral */
    const refLink = 'https://cryptovault.io/ref/' + refCode;
    setText('refLinkDisplay', refLink);
    const copyRefBtn = $('copyRefBtn');
    if (copyRefBtn) {
      copyRefBtn.onclick = () => copyToClipboard(refLink, 'Referral link copied!');
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
    BTCPrice.onChange((price) => {
      try {
        const btcUsd = (btcBalance * price).toLocaleString('en-US', { minimumFractionDigits:2, maximumFractionDigits:2 });
        setText('walletBalanceUSD',  '$' + btcUsd);
        setText('walletBigUSD',      '≈ $' + btcUsd + ' USD');
        setText('walletItemUSD',     '$' + btcUsd);
        setText('portfolioBTCusd',   '$' + btcUsd);
        setText('usdtBalanceUSD',    '$' + usdtBalance.toFixed(2));

        /* Live BTC ticker in navbar */
        const tickerPrice = $('tickerPrice');
        if (tickerPrice) tickerPrice.textContent = '$' + price.toLocaleString('en-US');
      } catch (err) {
        console.error('Error updating BTC price UI:', err);
      }
    });
  } catch (err) {
    console.error('Error in populateUserUI:', err);
  }
}

/* ─── LOGOUT ─────────────────────────────────────────────── */
function wireLogout() {
  document.querySelectorAll('[data-logout]').forEach(el => {
    if (!el) return;
    el.addEventListener('click', async (e) => {
      e.preventDefault();
      try {
        Toast.show('Logging out…', 'info', 1500);
        setTimeout(() => Auth.logout(), 800);
      } catch (err) {
        console.error('Logout handler error:', err);
        Auth.logout();
      }
    });
  });
}

/* ─── SAVE SETTINGS ──────────────────────────────────────── */
async function saveSettings() {
  try {
    const nameEl  = $('settingName');
    const emailEl = $('settingEmail');
    const name  = nameEl ? nameEl.value.trim() : '';
    const email = emailEl ? emailEl.value.trim() : '';

    const updates = {};
    if (name)  updates.name  = name;
    if (email) updates.email = email;   // display only; email change requires Supabase auth API

    if (Object.keys(updates).length) {
      await Auth.updateProfile(updates);
      if (name) document.querySelectorAll('.user-name-display').forEach(el => { if (el) el.textContent = name; });
      Toast.show('Settings saved!', 'success');
    } else {
      Toast.show('Nothing to save.', 'info');
    }
  } catch (err) {
    console.error('Error saving settings:', err);
    Toast.show('Failed to save settings.', 'error');
  }
}

/* ─── TAB NAVIGATION ─────────────────────────────────────── */
function switchTab(name) {
  try {
    document.querySelectorAll('.tab-content').forEach(t  => { if (t) t.style.display = 'none'; });
    document.querySelectorAll('.nav-item').forEach(a    => { if (a) a.classList.remove('active'); });

    const tab     = $('tab-' + name);
    const navItem = $('nav-' + name);

    if (tab)     tab.style.display = '';
    if (navItem) navItem.classList.add('active');

    const titles = {
      dashboard:'Dashboard', mining:'Mining', wallet:'Wallet',
      transactions:'Transactions', plans:'Mining Plans',
      referral:'Referral Program', settings:'Settings'
    };
    setText('pageTitle', titles[name] || name);

    /* Close mobile sidebar */
    const sidebar = $('sidebar');
    const sidebarOverlay = $('sidebarOverlay');
    if (sidebar) sidebar.classList.remove('open');
    if (sidebarOverlay) sidebarOverlay.classList.remove('open');
  } catch (err) {
    console.error('Error switching tab:', err);
  }
}

/* ─── MODAL HELPERS ──────────────────────────────────────── */
function openDepositModal() {
  try {
    const modal = $('depositModal');
    if (modal) {
      modal.style.display = 'flex';
    } else {
      console.warn('depositModal element not found');
      /* Fallback: switch to wallet tab if modal doesn't exist */
      switchTab('wallet');
    }
  } catch (err) {
    console.error('Error opening deposit modal:', err);
  }
}

function openWithdrawModal() {
  try {
    const modal = $('withdrawModal');
    if (modal) {
      modal.style.display = 'flex';
    } else {
      console.warn('withdrawModal element not found');
    }
  } catch (err) {
    console.error('Error opening withdraw modal:', err);
  }
}

/* ─── PURCHASE PLAN ──────────────────────────────────────── */
function purchasePlan(name, price, hashrate) {
  Toast.show('✅ ' + name + ' Plan purchased! ' + hashrate + ' TH/s added to your account.', 'success', 4500);
}

/* ─── EARNINGS CHART ─────────────────────────────────────── */
function initEarningsChart() {
  try {
    const canvas = $('earningsChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const w   = canvas.width = canvas.offsetWidth || 400;
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
  } catch (err) {
    console.error('Error initializing earnings chart:', err);
  }
}

/* ─── HASHRATE CHART ─────────────────────────────────────── */
function initHashrateChart() {
  try {
    const canvas = $('hashrateChart');
    if (!canvas) return;
    const ctx  = canvas.getContext('2d');
    if (!ctx) return;
    const w    = canvas.width = canvas.offsetWidth || 400;
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
  } catch (err) {
    console.error('Error initializing hashrate chart:', err);
  }
}

/* ─── DONUT CHART ────────────────────────────────────────── */
function initDonut() {
  try {
    const canvas = $('donutChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
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
  } catch (err) {
    console.error('Error initializing donut chart:', err);
  }
}

/* ══════════════════════════════════════════════════════════════
   REAL TRANSACTION TABLE — Supabase deposits + simulated data
══════════════════════════════════════════════════════════════ */

let _currentTxFilter = 'all';

function renderTransactions(filter) {
  try {
    filter = filter || 'all';
    _currentTxFilter = filter;
    const tbody = $('txTableBody');
    if (!tbody) return;

    /* Get merged data (real deposits + simulated mining/withdrawals) */
    const allRows = DepositData.getMergedTransactions();

    /* Apply filter */
    const rows = filter === 'all'
      ? allRows
      : allRows.filter(t => t.type === filter);

    /* Status badge renderer */
    const statusBadge = (s) => {
      if (s === 'success' || s === 'approved') {
        return '<span style="background:rgba(34,197,94,0.15);color:#22c55e;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:600;">Success</span>';
      } else if (s === 'pending') {
        return '<span style="background:rgba(245,158,11,0.15);color:#f59e0b;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:600;">Pending</span>';
      } else if (s === 'rejected') {
        return '<span style="background:rgba(239,68,68,0.15);color:#ef4444;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:600;">Rejected</span>';
      }
      return '<span style="background:rgba(148,163,184,0.15);color:#94a3b8;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:600;">' + s + '</span>';
    };

    /* Amount color: green for +, red for - */
    const amountColor = (amt) => {
      const firstChar = String(amt).trim()[0];
      return firstChar === '+' ? '#10b981' : '#ef4444';
    };

    tbody.innerHTML = rows.map(tx => `
      <tr>
        <td>${tx.desc || ''}</td>
        <td>${tx.coin || ''}</td>
        <td style="color:${amountColor(tx.amount)};font-family:'DM Mono',monospace;">${tx.amount || ''}</td>
        <td style="font-family:'DM Mono',monospace;color:#94a3b8;">${tx.usd || ''}</td>
        <td>${statusBadge(tx.status)}</td>
        <td style="color:#94a3b8;">${tx.date || ''}</td>
      </tr>
    `).join('');
  } catch (err) {
    console.error('Error rendering transactions:', err);
  }
}

/* Refresh transactions after a new deposit is submitted */
async function refreshTransactions() {
  try {
    await DepositData.fetchDeposits();
    renderTransactions(_currentTxFilter);
  } catch (err) {
    console.error('Error refreshing transactions:', err);
  }
}

/* ─── TX FILTER TABS ─────────────────────────────────────── */
function wireTransactionFilters() {
  document.querySelectorAll('[data-tx-filter]').forEach(btn => {
    if (!btn) return;
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-tx-filter]').forEach(b => { if (b) b.classList.remove('active'); });
      btn.classList.add('active');
      renderTransactions(btn.dataset.txFilter);
    });
  });
}

/* ─── CONTRACTS ──────────────────────────────────────────── */
function renderContracts() {
  try {
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
  } catch (err) {
    console.error('Error rendering contracts:', err);
  }
}

/* ─── LIVE HASHRATE TICKER ───────────────────────────────── */
function startLiveTicker() {
  try {
    const els = [$('liveHashrate'), $('liveHashrate2')];
    let base  = 115.3;
    setInterval(() => {
      base += (Math.random() - 0.48) * 1.2;
      base  = Math.max(100, Math.min(130, base));
      const text = base.toFixed(1) + ' TH/s';
      els.forEach(el => { if (el) el.textContent = text; });
    }, 2500);
  } catch (err) {
    console.error('Error starting live ticker:', err);
  }
}

/* ─── DAILY PROFIT TICKER ────────────────────────────────── */
function animateDailyProfit() {
  try {
    const el = $('dailyProfitEl');
    if (!el) return;
    let val = 0.000032;
    setInterval(() => {
      val += 0.0000001 * Math.random();
      el.textContent = '₿ ' + val.toFixed(8);
    }, 3000);
  } catch (err) {
    console.error('Error animating daily profit:', err);
  }
}

/* ─── MOBILE MENU ────────────────────────────────────────── */
function wireMobileMenu() {
  try {
    const toggle  = $('menuToggle');
    const sidebar = $('sidebar');
    const overlay = $('sidebarOverlay');
    if (!toggle || !sidebar) return;

    toggle.addEventListener('click', () => {
      sidebar.classList.toggle('open');
      if (overlay) overlay.classList.toggle('open');
    });

    if (overlay) {
      overlay.addEventListener('click', () => {
        sidebar.classList.remove('open');
        overlay.classList.remove('open');
      });
    }
  } catch (err) {
    console.error('Error wiring mobile menu:', err);
  }
}

/* ─── DROPDOWN ───────────────────────────────────────────── */
function wireDropdowns() {
  try {
    document.querySelectorAll('[data-dropdown-toggle]').forEach(trigger => {
      if (!trigger) return;
      trigger.addEventListener('click', (e) => {
        e.stopPropagation();
        const menu = $(trigger.dataset.dropdownToggle);
        if (!menu) return;
        const isOpen = menu.classList.contains('open');
        document.querySelectorAll('.dropdown-menu').forEach(m => { if (m) m.classList.remove('open'); });
        if (!isOpen) menu.classList.add('open');
      });
    });
    document.addEventListener('click', () => {
      document.querySelectorAll('.dropdown-menu').forEach(m => { if (m) m.classList.remove('open'); });
    });
  } catch (err) {
    console.error('Error wiring dropdowns:', err);
  }
}

/* ─── MODALS ─────────────────────────────────────────────── */
function wireModals() {
  try {
    /* Open */
    document.querySelectorAll('[data-modal]').forEach(btn => {
      if (!btn) return;
      btn.addEventListener('click', () => {
        const modal = $(btn.dataset.modal);
        if (modal) modal.style.display = 'flex';
      });
    });

    /* Close button */
    document.querySelectorAll('[data-close-modal]').forEach(btn => {
      if (!btn) return;
      btn.addEventListener('click', () => {
        const modal = $(btn.dataset.closeModal);
        if (modal) modal.style.display = 'none';
      });
    });

    /* Click outside */
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
      if (!overlay) return;
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) overlay.style.display = 'none';
      });
    });

    /* Withdraw form */
    const withdrawForm = $('withdrawForm');
    if (withdrawForm) {
      withdrawForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const withdrawModal = $('withdrawModal');
        if (withdrawModal) withdrawModal.style.display = 'none';
        Toast.show('📤 Withdrawal submitted. Processing within 24 hours.', 'info', 4000);
      });
    }
  } catch (err) {
    console.error('Error wiring modals:', err);
  }
}

/* ─── DEPOSIT FORM INIT ──────────────────────────────────── */
function initDepositForm() {
  try {
    const form = document.getElementById('depositForm');
    const coinSelect = document.getElementById('depositCoin');
    const amountInput = document.getElementById('depositAmount');
    const amountSuffix = document.getElementById('amountSuffix');
    const amountHint = document.getElementById('amountHint');
    const uploadArea = document.getElementById('uploadArea');
    const fileInput = document.getElementById('depositScreenshot');
    const uploadContent = document.getElementById('uploadContent');
    const uploadPreview = document.getElementById('uploadPreview');
    const previewImage = document.getElementById('previewImage');
    const previewFilename = document.getElementById('previewFilename');
    const removePreview = document.getElementById('removePreview');

    if (!form) return;

    /* Coin select change → update suffix & hint */
    if (coinSelect) {
      coinSelect.addEventListener('change', function() {
        const val = coinSelect.value;
        if (val === 'usdt_bep20') {
          if (amountSuffix) amountSuffix.textContent = 'USDT';
          if (amountHint) amountHint.textContent = 'Minimum deposit: 10 USDT';
          if (amountInput) {
            amountInput.placeholder = '0.00';
            amountInput.step = '0.01';
            amountInput.min = '10';
          }
        } else if (val === 'btc') {
          if (amountSuffix) amountSuffix.textContent = 'BTC';
          if (amountHint) amountHint.textContent = 'Minimum deposit: 0.0001 BTC';
          if (amountInput) {
            amountInput.placeholder = '0.00000000';
            amountInput.step = '0.00000001';
            amountInput.min = '0.0001';
          }
        } else {
          if (amountSuffix) amountSuffix.textContent = '—';
          if (amountHint) amountHint.textContent = 'Enter the exact amount you sent';
        }
      });
    }

    /* File upload handling */
    if (uploadArea && fileInput) {
      uploadArea.addEventListener('click', function(e) {
        if (e.target.closest('.preview-remove')) return;
        fileInput.click();
      });

      ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(function(eventName) {
        uploadArea.addEventListener(eventName, function(e) {
          e.preventDefault();
          e.stopPropagation();
        });
      });

      ['dragenter', 'dragover'].forEach(function(eventName) {
        uploadArea.addEventListener(eventName, function() {
          uploadArea.classList.add('dragover');
        });
      });

      ['dragleave', 'drop'].forEach(function(eventName) {
        uploadArea.addEventListener(eventName, function() {
          uploadArea.classList.remove('dragover');
        });
      });

      uploadArea.addEventListener('drop', function(e) {
        const files = e.dataTransfer.files;
        if (files.length) handleFile(files[0]);
      });

      fileInput.addEventListener('change', function() {
        if (fileInput.files.length) handleFile(fileInput.files[0]);
      });

      function handleFile(file) {
        var validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif'];
        if (validTypes.indexOf(file.type) === -1) {
          Toast.show('Please upload an image file (PNG, JPG, GIF)', 'error');
          return;
        }
        if (file.size > 5 * 1024 * 1024) {
          Toast.show('File too large. Maximum size is 5MB.', 'error');
          return;
        }
        var reader = new FileReader();
        reader.onload = function(e) {
          if (previewImage) previewImage.src = e.target.result;
          if (previewFilename) previewFilename.textContent = file.name;
          if (uploadContent) uploadContent.style.display = 'none';
          if (uploadPreview) uploadPreview.style.display = 'flex';
          uploadArea.classList.add('has-file');
          Toast.show('Screenshot uploaded successfully', 'success');
        };
        reader.onerror = function() {
          Toast.show('Failed to read file.', 'error');
        };
        reader.readAsDataURL(file);
      }

      if (removePreview) {
        removePreview.addEventListener('click', function(e) {
          e.stopPropagation();
          fileInput.value = '';
          if (previewImage) previewImage.src = '';
          if (uploadContent) uploadContent.style.display = 'flex';
          if (uploadPreview) uploadPreview.style.display = 'none';
          uploadArea.classList.remove('has-file');
        });
      }
    }

    /* ══════════════════════════════════════════════════════════════
       SUPABASE INTEGRATED DEPOSIT SUBMIT
    ══════════════════════════════════════════════════════════════ */
    form.addEventListener('submit', async function(e) {
      e.preventDefault();

      try {
        /* ── 1. Validate form ─────────────────────────────────── */
        var coin = coinSelect ? coinSelect.value : '';
        var amount = amountInput ? amountInput.value : '';
        var txHashEl = document.getElementById('depositTxHash');
        var txHash = txHashEl ? txHashEl.value.trim() : '';
        var hasFile = fileInput && fileInput.files && fileInput.files.length > 0;

        if (!coin) {
          Toast.show('Please select a coin', 'error');
          if (coinSelect) coinSelect.focus();
          return;
        }
        if (!amount || parseFloat(amount) <= 0) {
          Toast.show('Please enter a valid amount', 'error');
          if (amountInput) amountInput.focus();
          return;
        }
        if (!txHash) {
          Toast.show('Please enter the transaction hash', 'error');
          if (txHashEl) txHashEl.focus();
          return;
        }
        if (!hasFile) {
          Toast.show('Please upload a screenshot as proof of payment', 'error');
          return;
        }

        /* ── 2. Auth guard ────────────────────────────────────── */
        const user = Auth.getUser();
        if (!user) {
          Toast.show('Authentication required. Please log in again.', 'error', 4000);
          return;
        }

        if (!_supabase) {
          Toast.show('Supabase not available. Please try again later.', 'error', 4000);
          return;
        }

        /* ── 3. Upload screenshot to Supabase Storage ─────────── */
        const file = fileInput.files[0];
        const fileExt = file.name.split('.').pop();
        const fileName = user.id + '_' + Date.now() + '.' + fileExt;
        const filePath = user.id + '/' + fileName;

        Toast.show('⏳ Uploading screenshot…', 'info', 2000);

        const { data: uploadData, error: uploadError } = await _supabase
          .storage
          .from('deposit-screenshots')
          .upload(filePath, file, {
            cacheControl: '3600',
            upsert: false,
            contentType: file.type
          });

        if (uploadError) {
          console.error('Storage upload error:', uploadError);
          Toast.show('❌ Upload failed: ' + uploadError.message, 'error', 5000);
          return;
        }

        /* ── 4. Get public URL ───────────────────────────────── */
        const { data: urlData } = _supabase
          .storage
          .from('deposit-screenshots')
          .getPublicUrl(filePath);

        const screenshotUrl = urlData?.publicUrl || '';

        /* ── 5. Insert deposit record ────────────────────────── */
        const coinLabel = coin === 'usdt_bep20' ? 'USDT (BEP20)' : 'BTC';
        const numericAmount = parseFloat(amount);

        const { data: insertData, error: insertError } = await _supabase
          .from('deposits')
          .insert({
            user_id:        user.id,
            user_email:     user.email,
            coin:           coin,
            amount:         numericAmount,
            tx_hash:        txHash,
            screenshot_url: screenshotUrl,
            status:         'pending',
            created_at:     new Date().toISOString()
          })
          .select()
          .single();

        if (insertError) {
          console.error('Deposit insert failed:', insertError);

          /* ── CLEANUP: delete orphaned screenshot from Storage ── */
          try {
            const { error: removeError } = await _supabase
              .storage
              .from('deposit-screenshots')
              .remove([filePath]);

            if (removeError) {
              console.error('Failed to cleanup orphaned screenshot:', removeError);
            }
          } catch (cleanupErr) {
            console.error('Exception during cleanup:', cleanupErr);
          }

          Toast.show('❌ Failed to save deposit: ' + insertError.message, 'error', 5000);
          return;
        }

        /* ── 6. Success ───────────────────────────────────────── */
        console.log('Deposit inserted successfully');
        console.log('Deposit data:', insertData);
        Toast.show('✅ Deposit request submitted! ' + numericAmount + ' ' + coinLabel + ' — Pending review', 'success', 5000);

        /* ── 6b. INSTANTLY add to transaction table ───────────── */
        DepositData.addDeposit(insertData);
        renderTransactions(_currentTxFilter);

        /* ── 7. Reset form ────────────────────────────────────── */
        form.reset();
        if (removePreview) {
          fileInput.value = '';
          if (previewImage) previewImage.src = '';
          if (uploadContent) uploadContent.style.display = 'flex';
          if (uploadPreview) uploadPreview.style.display = 'none';
          uploadArea.classList.remove('has-file');
        }
        if (amountSuffix) amountSuffix.textContent = '—';
        if (amountHint) amountHint.textContent = 'Enter the exact amount you sent';

        var modal = document.getElementById('depositModal');
        if (modal) modal.style.display = 'none';
      } catch (err) {
        console.error('Exception during deposit submission:', err);
        Toast.show('❌ An unexpected error occurred. Please try again.', 'error', 5000);
      }
    });
  } catch (err) {
    console.error('Error initializing deposit form:', err);
  }
}

/* ─── QR CODE IMAGE FIX ──────────────────────────────────── */
function fixQRCodeImages() {
  try {
    document.querySelectorAll('img[data-qr]').forEach(img => {
      if (!img) return;
      const coin = img.dataset.qr;
      if (coin === 'btc') {
        img.src = './btc-qr.png';
      } else if (coin === 'usdt') {
        img.src = './usdt-qr.png';
      }
    });
  } catch (err) {
    console.error('Error fixing QR code images:', err);
  }
}

/* ─── DEPOSIT / WITHDRAW BUTTON WIRING ───────────────────── */
function wireDepositButtons() {
  try {
    document.querySelectorAll('[data-deposit-btn]').forEach(btn => {
      if (!btn) return;
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        openDepositModal();
      });
    });
  } catch (err) {
    console.error('Error wiring deposit buttons:', err);
  }
}

function wireWithdrawButtons() {
  try {
    document.querySelectorAll('[data-withdraw-btn]').forEach(btn => {
      if (!btn) return;
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        openWithdrawModal();
      });
    });
  } catch (err) {
    console.error('Error wiring withdraw buttons:', err);
  }
}

/* ─── GLOBAL ERROR HANDLER ───────────────────────────────── */
window.addEventListener('error', function(e) {
  console.error('Global error caught:', e.message, 'at', e.filename, ':', e.lineno);
});

window.addEventListener('unhandledrejection', function(e) {
  console.error('Unhandled promise rejection:', e.reason);
});

/* ─── MAIN INIT ──────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', async () => {
  try {
    /* 1. Auth guard — redirect to login.html if no session */
    const ok = await Auth.init();
    if (!ok) return;   // redirecting

    /* 2. Populate UI with real user data */
    populateUserUI();

    /* 3. Fetch real deposits BEFORE rendering transactions */
    await DepositData.fetchDeposits();

    /* 4. Wire interactions */
    wireLogout();
    wireMobileMenu();
    wireDropdowns();
    wireModals();
    wireTransactionFilters();
    wireDepositButtons();
    wireWithdrawButtons();
    initDepositForm();

    /* 5. Render dynamic content (now uses real deposits) */
    renderTransactions();
    renderContracts();

    /* 6. Fix QR code paths */
    fixQRCodeImages();

    /* 7. Charts (small delay to allow layout paint) */
    setTimeout(() => {
      try {
        initEarningsChart();
        initHashrateChart();
        initDonut();
      } catch (chartErr) {
        console.error('Chart initialization error:', chartErr);
      }
    }, 120);

    /* 8. Live tickers */
    startLiveTicker();
    animateDailyProfit();

    /* 9. Expose globals needed by dashboard.html inline scripts */
    window.switchTab     = switchTab;
    window.purchasePlan  = purchasePlan;
    window.saveSettings  = saveSettings;
    window.copyToClipboard = copyToClipboard;
    window.Toast         = Toast;
    window.BTCPrice      = BTCPrice;
    window.Auth          = Auth;
    window.DepositData   = DepositData;
    window.refreshTransactions = refreshTransactions;
    window.openDepositModal = openDepositModal;
    window.openWithdrawModal = openWithdrawModal;

    console.log('CryptoVault dashboard initialized successfully');
  } catch (err) {
    console.error('Fatal error during dashboard initialization:', err);
  }
});
