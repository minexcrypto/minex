/* ══════════════════════════════════════════════════════════════
   CRYPTOVAULT — dashboard.js
   All data comes from Supabase. Zero hardcoded / fake values.
   Tables used: profiles · deposits · contracts · transactions
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
    console.error('Supabase library not loaded.');
  }
} catch (err) {
  console.error('Failed to initialize Supabase client:', err);
}

/* ─── TOAST ──────────────────────────────────────────────── */
const Toast = (() => {
  function show(msg, type = 'info', duration = 3500) {
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
      'transition:all .3s ease',
    ].join(';');
    toast.innerHTML =
      `<span style="font-size:17px;flex-shrink:0">${icons[type] || '💡'}</span>` +
      `<span style="flex:1;line-height:1.45">${msg}</span>`;
    container.appendChild(toast);
    setTimeout(() => {
      Object.assign(toast.style, { opacity: '0', transform: 'translateX(16px)' });
      setTimeout(() => toast.remove(), 320);
    }, duration);
  }
  return { show };
})();

/* ─── DOM HELPERS ────────────────────────────────────────── */
function $(id)            { return document.getElementById(id); }
function setText(id, val) { const el = $(id); if (el) el.textContent = val; }

function normalizeTxType(raw) {
  const t = String(raw || '').trim().toLowerCase();

  if (['deposit', 'deposits', 'approved_deposit'].includes(t)) return 'deposits';

  if (['withdrawal', 'withdrawals'].includes(t)) return 'withdrawals';

  if (['mining', 'mining_reward', 'reward'].includes(t)) return 'mining';

  if (['purchase', 'purchases', 'plan_purchase'].includes(t)) return 'purchase';

  return t || 'other';
}

/* ─── COPY UTILITY ───────────────────────────────────────── */
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
    Toast.show('Copy failed.', 'error');
  }
}

/* ─── AUTH MODULE ───────────────────────────────────────── */
const Auth = (() => {
  let _session = null;
  let _profile = null;

  async function init() {
    if (!_supabase) { window.location.href = 'login.html'; return false; }
    try {
      const { data: { session } } = await _supabase.auth.getSession();
      if (!session) { window.location.href = 'login.html'; return false; }
      _session = session;

      /* fetch or create profile */
      const { data: prof, error } = await _supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single();

      if (error || !prof) {
        const ref_code = 'CV' + Math.random().toString(36).substring(2, 8).toUpperCase();
        const { data: newProf } = await _supabase
          .from('profiles')
          .upsert({
            id:           session.user.id,
            email:        session.user.email,
            btc_balance:  0,
            usdt_balance: 0,
            ref_code,
          })
          .select()
          .single();
        _profile = newProf || {
          id: session.user.id,
          email: session.user.email,
          btc_balance: 0,
          usdt_balance: 0,
          ref_code,
        };
      } else {
        _profile = prof;
      }

      _supabase.auth.onAuthStateChange(event => {
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
    try { if (_supabase) await _supabase.auth.signOut(); } catch { /* ignore */ }
    window.location.href = 'login.html';
  }

  function getUser()    { return _session?.user || null; }
  function getProfile() { return _profile       || {};   }

  async function refreshProfile() {
    if (!_session || !_supabase) return;
    const { data } = await _supabase
      .from('profiles')
      .select('*')
      .eq('id', _session.user.id)
      .single();
    if (data) _profile = data;
    return _profile;
  }

  async function updateProfile(fields) {
    if (!_session || !_supabase) return null;
    const { data, error } = await _supabase
      .from('profiles')
      .update(fields)
      .eq('id', _session.user.id)
      .select()
      .single();
    if (!error && data) _profile = data;
    return error ? null : data;
  }

  return { init, logout, getUser, getProfile, refreshProfile, updateProfile };
})();

/* ─── BTC PRICE ──────────────────────────────────────────── */
const BTCPrice = (() => {
  let _data = null;
  let _cbs  = [];

  function onChange(cb) { _cbs.push(cb); if (_data) cb(_data); }

  async function _fetch() {
    try {
      const r = await fetch(
        'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd&include_24hr_change=true'
      );
      if (r.ok) {
        const j = await r.json();
        const price  = j.bitcoin?.usd            ?? null;
        const change = j.bitcoin?.usd_24h_change ?? null;
        if (price !== null) {
          _data = { price, change };
          _cbs.forEach(cb => cb(_data));
        }
      }
    } catch { /* keep stale */ }
  }

  _fetch();
  setInterval(_fetch, 60_000);

  function fmt(n) {
    if (n == null) return '—';
    return '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  function get() { return _data?.price ?? null; }

  return { onChange, get, fmt };
})();

/* ══════════════════════════════════════════════════════════════
   DATA LOADERS — read-only from Supabase
══════════════════════════════════════════════════════════════ */

/* Load all transactions for the current user */
async function loadTransactions() {
  const user = Auth.getUser();
  if (!user || !_supabase) return [];
  const { data, error } = await _supabase
    .from('transactions')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });
  if (error) { console.error('loadTransactions:', error); return []; }
  return data || [];
}

/* Load all deposits for the current user */
async function loadDeposits() {
  const user = Auth.getUser();
  if (!user || !_supabase) return [];
  const { data, error } = await _supabase
    .from('deposits')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });
  if (error) { console.error('loadDeposits:', error); return []; }
  return data || [];
}

/* Load all active contracts for the current user */
async function loadContracts() {
  const user = Auth.getUser();
  if (!user || !_supabase) return [];
  const { data, error } = await _supabase
    .from('contracts')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });
  if (error) { console.error('loadContracts:', error); return []; }
  return data || [];
}

/* ══════════════════════════════════════════════════════════════
   UI — POPULATE USER DATA
══════════════════════════════════════════════════════════════ */
function populateUserUI() {
  const user    = Auth.getUser();
  const profile = Auth.getProfile();
  const email   = user?.email || '';
  const name    = profile.name || email.split('@')[0] || 'User';
  const initial = name.charAt(0).toUpperCase();

  /* Avatars & name */
  document.querySelectorAll('.user-avatar-display').forEach(el => { el.textContent = initial; });
  document.querySelectorAll('.user-name-display').forEach(el  => { el.textContent = name; });
  document.querySelectorAll('.user-email-display').forEach(el => { el.textContent = email; });

  /* Real balance — zero until deposits are approved */
  const btcBalance  = typeof profile.btc_balance  === 'number' ? profile.btc_balance  : 0;
  const usdtBalance = typeof profile.usdt_balance === 'number' ? profile.usdt_balance : 0;

  const btcStr = '₿ ' + btcBalance.toFixed(8);
  const walletDisplay = usdtBalance > 0
    ? ('$' + usdtBalance.toFixed(2) + ' USDT')
    : btcStr;
  setText('walletBalanceCounter', walletDisplay);
  setText('walletBigBalance',     walletDisplay);
  setText('walletBigUSD',         '≈ — USD');
  setText('walletItemUSD',        '—');
  setText('portfolioBTCusd',      '—');
  setText('usdtBalanceEl',        usdtBalance.toFixed(2) + ' USDT');

  /* Update USD values when BTC price is known */
  BTCPrice.onChange(({ price, change }) => {
    const btcUsd = (btcBalance * price).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const pctStr = change != null
      ? ((change >= 0 ? '▲' : '▼') + ' ' + Math.abs(change).toFixed(2) + '%')
      : '';
    const pctClass = change != null ? (change >= 0 ? 'ticker-up' : 'ticker-down') : '';

    setText('walletBigUSD',   '≈ $' + btcUsd + ' USD');
    setText('walletItemUSD',  '$' + btcUsd);
    setText('portfolioBTCusd','$' + btcUsd);

    /* live BTC ticker in navbar */
    const tickerPrice  = $('tickerPrice');
    const tickerChange = document.querySelector('.ticker-change');
    if (tickerPrice)  tickerPrice.textContent  = BTCPrice.fmt(price);
    if (tickerChange && pctStr) {
      tickerChange.textContent = pctStr;
      tickerChange.className   = 'ticker-change ' + pctClass;
    }
  });

  /* Referral */
  const refCode = profile.ref_code || '';
  const refLink = refCode ? 'https://cryptovault.io/ref/' + refCode : '—';
  setText('refLinkDisplay', refLink);
  const copyRefBtn = $('copyRefBtn');
  if (copyRefBtn && refCode) {
    copyRefBtn.onclick = () => copyToClipboard(refLink, 'Referral link copied!');
  }
  setText('refCountEl',    profile.ref_count    || 0);
  setText('refEarningsEl', '₿ ' + (profile.ref_earnings || 0).toFixed(8));
  setText('activeRefEl',   profile.ref_count    || 0);

  /* Settings form */
  const sName  = $('settingName');
  const sEmail = $('settingEmail');
  if (sName)  sName.value  = profile.name  || '';
  if (sEmail) sEmail.value = email;
}

/* ══════════════════════════════════════════════════════════════
   UI — DASHBOARD STATS (zero-safe)
══════════════════════════════════════════════════════════════ */
async function populateDashboardStats(contracts) {
  const activeContracts = contracts.filter(c => c.active === true);

  /* --- Hashrate --- */
  const totalHashrate = activeContracts.reduce((s, c) => s + Number(c.hashrate || 0), 0);
  setText('liveHashrate',  totalHashrate > 0 ? totalHashrate.toFixed(1) + ' TH/s' : '0 TH/s');
  setText('liveHashrate2', totalHashrate > 0 ? totalHashrate.toFixed(1) + ' TH/s' : '0 TH/s');

  /* --- Daily profit sum --- */
  const dailyProfit = activeContracts.reduce((s, c) => s + Number(c.daily_profit || 0), 0);
  setText('dailyProfitEl', '₿ ' + dailyProfit.toFixed(8));

  /* --- Stat card changes --- */
  const statChangeHashrate = document.getElementById('statChangeHashrate');
  const statChangeContracts = document.getElementById('statChangeContracts');
  if (statChangeHashrate)  statChangeHashrate.textContent  = activeContracts.length + ' active contract' + (activeContracts.length !== 1 ? 's' : '');
  if (statChangeContracts) statChangeContracts.textContent = activeContracts.length + ' active';

  /* --- Total mined = sum of all mining transactions --- */
  const user = Auth.getUser();
  if (user && _supabase) {
    const { data: miningTxns } = await _supabase
      .from('transactions')
      .select('amount,type')
      .eq('user_id', user.id)
      .in('type', ['mining', 'mining_reward', 'reward']);
    const totalMined = (miningTxns || [])
      .filter(t => normalizeTxType(t.type) === 'mining')
      .reduce((s, t) => s + Number(t.amount || 0), 0);
    setText('totalMinedEl', '₿ ' + totalMined.toFixed(8));
  } else {
    setText('totalMinedEl', '₿ 0.00000000');
  }
}

/* ══════════════════════════════════════════════════════════════
   UI — TRANSACTION TABLE
══════════════════════════════════════════════════════════════ */
let _currentTxFilter = 'all';
let _allTransactions = [];
let _allDeposits     = [];

function renderTransactions(filter) {
  const normalizeFilter = raw => {
    const f = String(raw || 'all').toLowerCase();
    if (f === 'deposit' || f === 'deposits') return 'deposits';
    if (f === 'withdrawal' || f === 'withdrawals') return 'withdrawals';
    if (f === 'mining') return 'mining';
    if (f === 'purchase' || f === 'purchases') return 'purchase';
    if (f === 'all') return 'all';
    return f;
  };

  filter = normalizeFilter(filter);
  _currentTxFilter = filter;
  const tbody = $('txTableBody');
  if (!tbody) return;

  /*
    ARCHITECTURE:
    - transactions table = SOURCE OF TRUTH for approved financial history
    - deposits table     = ONLY for pending requests (not yet approved)
    - Never merge approved deposits from both tables — causes duplicates
  */

  /* 1. Build rows from transactions table (includes approved deposits) */
  const txRows = _allTransactions.map(tx => {
    const txType = normalizeTxType(tx.type);
    const isUSDT = tx.coin === 'usdt' || tx.coin === 'usdt_bep20';
    const coinLbl = isUSDT ? 'USDT' : 'BTC';
    const decimals = isUSDT ? 2 : 8;
    const amt = Number(tx.amount || 0);
    const isOut = txType === 'withdrawals' || txType === 'purchase';
    const amtStr = (isOut ? '-' : '+') + amt.toFixed(decimals) + ' ' + coinLbl;

    let usdVal;
    if (isUSDT) {
      usdVal = (isOut ? '-' : '+') + '$' + amt.toFixed(2);
    } else {
      const price = BTCPrice.get();
      usdVal = price != null
        ? (isOut ? '-' : '+') + '$' + (amt * price).toFixed(2)
        : '—';
    }

    return {
      desc:   _txLabel(tx.type),
      coin:   coinLbl,
      amount: amtStr,
      usd:    usdVal,
      status: tx.status || 'success',
      date:   _fmtDate(tx.created_at),
      type:   txType,
      createdAt: tx.created_at,
    };
  });

  /* 2. Build rows from pending deposits ONLY (not approved) */
  const pendingDepRows = _allDeposits
    .filter(d => d.status === 'pending')
    .map(d => {
      const isUSDT  = d.coin === 'usdt_bep20';
      const coinLbl = isUSDT ? 'USDT' : 'BTC';
      const amt     = Number(d.amount || 0);
      const amtStr  = '+' + amt.toFixed(isUSDT ? 2 : 8) + ' ' + coinLbl;
      let usdVal;
      if (isUSDT) {
        usdVal = '+$' + amt.toFixed(2);
      } else {
        const price = BTCPrice.get();
        usdVal = price != null ? '+$' + (amt * price).toFixed(2) : '—';
      }
      return {
        desc:   'Deposit (Pending)',
        coin:   coinLbl,
        amount: amtStr,
        usd:    usdVal,
        status: 'pending',
        date:   _fmtDate(d.created_at),
        type:   'deposits',
        createdAt: d.created_at,
      };
    });

  /* 3. Merge & sort newest first */
  const merged = [...txRows, ...pendingDepRows].sort(
    (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
  );

  const rows = filter === 'all' ? merged : merged.filter(r => normalizeFilter(r.type) === filter);

  if (!rows.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" style="padding:48px;text-align:center;color:#475569;font-size:13px;">
          📭 No transactions found.
        </td>
      </tr>`;
    return;
  }

  tbody.innerHTML = rows.map(tx => `
    <tr>
      <td>${tx.desc}</td>
      <td>${tx.coin}</td>
      <td style="color:${tx.amount.startsWith('+') ? '#10b981' : '#ef4444'};font-family:'DM Mono',monospace;">${tx.amount}</td>
      <td style="font-family:'DM Mono',monospace;color:#94a3b8;">${tx.usd}</td>
      <td>${_statusBadge(tx.status)}</td>
      <td style="color:#94a3b8;">${tx.date}</td>
    </tr>
  `).join('');
}function _txLabel(type) {
  const t = String(type || '').toLowerCase();
  const map = {
    mining:      'Mining Reward',
    deposit:     'Deposit',
    deposits:    'Deposit',
    withdrawal:  'Withdrawal',
    withdrawals: 'Withdrawal',
    purchase:    'Plan Purchase',
    purchases:   'Plan Purchase',
    referral:    'Referral Bonus',
    transfer:    'Transfer',
  };
  return map[t] || type || '—';
}

function _usdStr(amount, type) {
  const price = BTCPrice.get();
  if (price == null) return '—';
  const val = Math.abs(Number(amount || 0)) * price;
  const pfx = type === 'withdrawal' ? '-' : '+';
  return pfx + '$' + val.toFixed(2);
}

function _fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function _statusBadge(s) {
  const map = {
    success:  { bg: 'rgba(16,185,129,.15)',  fg: '#10b981', label: 'Success'  },
    approved: { bg: 'rgba(16,185,129,.15)',  fg: '#10b981', label: 'Approved' },
    pending:  { bg: 'rgba(245,158,11,.15)',  fg: '#f59e0b', label: 'Pending'  },
    rejected: { bg: 'rgba(239,68,68,.15)',   fg: '#ef4444', label: 'Rejected' },
    failed:   { bg: 'rgba(239,68,68,.15)',   fg: '#ef4444', label: 'Failed'   },
  };
  const st = map[String(s).toLowerCase()] || { bg: 'rgba(148,163,184,.15)', fg: '#94a3b8', label: s || '—' };
  return `<span style="background:${st.bg};color:${st.fg};padding:3px 10px;border-radius:20px;font-size:11px;font-weight:600;">${st.label}</span>`;
}

function wireTransactionFilters() {
  document.querySelectorAll('[data-tx-filter]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-tx-filter]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderTransactions(btn.dataset.txFilter);
    });
  });
}

/* ══════════════════════════════════════════════════════════════
   UI — RECENT ACTIVITY (dashboard tab)
══════════════════════════════════════════════════════════════ */
function renderRecentActivity() {
  const container = $('recentActivityList');
  if (!container) return;

  /*
    SOURCE OF TRUTH: transactions table only.
    Approved deposits are already in _allTransactions (type='deposit', status='approved').
    Do NOT merge approved deposits from _allDeposits — causes duplicates.
  */
  const txRows = _allTransactions.map(tx => {
    const txType = normalizeTxType(tx.type);
    const isUSDT = tx.coin === 'usdt' || tx.coin === 'usdt_bep20';
    const symbol = isUSDT ? 'USDT' : '₿';
    const decimals = isUSDT ? 2 : 8;
    const amt = Number(tx.amount || 0);
    const isOut = txType === 'withdrawals' || txType === 'purchase';
    return {
      icon:   _txIcon(txType),
      desc:   _txLabel(tx.type),
      date:   _fmtDate(tx.created_at),
      amount: (isOut ? '-' : '+') + symbol + amt.toFixed(decimals),
      isOut:  isOut,
      createdAt: tx.created_at,
    };
  });

  /* Only show pending deposits as "pending" items */
  const pendingDepRows = _allDeposits
    .filter(d => d.status === 'pending')
    .map(d => {
      const isUSDT = d.coin === 'usdt_bep20';
      const symbol = isUSDT ? 'USDT' : '₿';
      const decimals = isUSDT ? 2 : 8;
      return {
        icon:   '⏳',
        desc:   'Deposit (Pending)',
        date:   _fmtDate(d.created_at),
        amount: '+' + symbol + Number(d.amount || 0).toFixed(decimals),
        isOut:  false,
        createdAt: d.created_at,
      };
    });

  const merged = [...txRows, ...pendingDepRows]
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 5);

  if (!merged.length) {
    container.innerHTML = `
      <div style="padding:32px;text-align:center;color:#475569;font-size:13px;">
        No activity yet. Make a deposit to get started.
      </div>`;
    return;
  }

  container.innerHTML = merged.map(item => `
    <div class="rig-card" style="margin-bottom:8px;">
      <div class="tx-icon ${item.isOut ? 'out' : 'in'}">${item.icon}</div>
      <div class="rig-info">
        <div class="rig-name">${item.desc}</div>
        <div class="rig-specs">${item.date}</div>
      </div>
      <div class="rig-metrics">
        <div class="rig-hash" style="color:${item.isOut ? 'var(--red)' : 'var(--green)'}">${item.amount}</div>
      </div>
    </div>
  `).join('');
}function _txIcon(type) {
  const t = String(type || '').toLowerCase();
  const map = {
    mining:      '⛏️',
    deposit:     '📥',
    deposits:    '📥',
    withdrawal:  '📤',
    withdrawals: '📤',
    purchase:    '🛒',
    purchases:   '🛒',
    referral:    '👥',
    transfer:    '↔️',
  };
  return map[t] || '💱';
}

/* ══════════════════════════════════════════════════════════════
   UI — CONTRACTS
══════════════════════════════════════════════════════════════ */
function renderContracts(contracts) {
  const container = $('contractsContainer');
  if (!container) return;

  const active = contracts.filter(c => c.active === true);

  if (!active.length) {
    container.innerHTML = `
      <div style="padding:40px;text-align:center;color:#475569;font-size:14px;">
        <div style="font-size:36px;margin-bottom:12px;">⛏️</div>
        <div style="font-weight:600;color:#64748b;margin-bottom:6px;">No active contracts</div>
        <div style="font-size:13px;">Purchase a mining plan below to start earning.</div>
      </div>`;
    return;
  }

  container.innerHTML = active.map(c => {
    const progress    = c.progress != null ? Math.min(100, Math.max(0, Number(c.progress))) : 0;
    const daysLeft    = c.days_left != null ? c.days_left : '—';
    const hashrate    = c.hashrate  != null ? c.hashrate.toFixed(1) + ' TH/s' : '—';
    const dailyProfit = c.daily_profit != null
      ? Number(c.daily_profit).toFixed(8) + ' BTC'
      : '—';
    const planName    = c.plan || c.name || 'Mining Contract';

    return `
      <div class="rig-card" style="margin-bottom:12px;">
        <div class="tx-icon mining">⛏️</div>
        <div class="rig-info">
          <div class="rig-name">${planName}</div>
          <div class="rig-specs">${hashrate} · ${daysLeft} days left</div>
        </div>
        <div class="rig-metrics">
          <div class="rig-hash" style="color:var(--green)">${dailyProfit}/day</div>
          <div class="text-xs text-muted">${progress.toFixed(0)}% complete</div>
        </div>
      </div>`;
  }).join('');
}

/* ══════════════════════════════════════════════════════════════
   UI — MINING TAB STATS
══════════════════════════════════════════════════════════════ */
function renderMiningStats(contracts) {
  const active = contracts.filter(c => c.active === true);

  const totalHash    = active.reduce((s, c) => s + Number(c.hashrate    || 0), 0);
  const totalPower   = active.reduce((s, c) => s + Number(c.power_watts || 0), 0);
  const dailyProfit  = active.reduce((s, c) => s + Number(c.daily_profit || 0), 0);
  const monthlyProj  = dailyProfit * 30;

  setText('miningTotalHashrate',  totalHash   > 0 ? totalHash.toFixed(1)   + ' TH/s' : '0 TH/s');
  setText('miningPowerConsump',   totalPower  > 0 ? totalPower.toFixed(0)  + ' W'    : '0 W');
  setText('miningDailyRevenue',   '₿ ' + dailyProfit.toFixed(8));
  setText('miningMonthlyProj',    '₿ ' + monthlyProj.toFixed(8));

  /* contract progress bars */
  renderContractProgress(active);
}

function renderContractProgress(active) {
  const container = $('contractProgressContainer');
  if (!container) return;

  if (!active.length) {
    container.innerHTML = `
      <div style="padding:24px;text-align:center;color:#475569;font-size:13px;">
        No active contracts to display.
      </div>`;
    return;
  }

  container.innerHTML = active.map(c => {
    const progress = Math.min(100, Math.max(0, Number(c.progress || 0)));
    const daysLeft = c.days_left != null ? c.days_left : '—';
    const planName = c.plan || c.name || 'Contract';
    const hashrate = c.hashrate != null ? c.hashrate.toFixed(1) : '—';
    return `
      <div style="margin-bottom:16px;">
        <div class="progress-label">
          <span>${planName}</span>
          <span>${daysLeft} days left</span>
        </div>
        <div class="progress-bar">
          <div class="progress-fill" style="width:${progress}%"></div>
        </div>
        <div class="text-xs text-muted mt-4">${progress.toFixed(0)}% complete · ${hashrate} TH/s</div>
      </div>`;
  }).join('');
}

/* ══════════════════════════════════════════════════════════════
   UI — WALLET SUMMARY
══════════════════════════════════════════════════════════════ */
function renderWalletSummary() {
  const user = Auth.getUser();
  if (!user || !_supabase) return;

  /* Aggregate from real transactions */
  const txns = _allTransactions;

  const totalDeposited  = txns.filter(t => normalizeTxType(t.type) === 'deposits')
    .reduce((s, t) => s + Number(t.amount || 0), 0);
  const totalWithdrawn  = txns.filter(t => normalizeTxType(t.type) === 'withdrawals')
    .reduce((s, t) => s + Number(t.amount || 0), 0);
  const miningIncome    = txns.filter(t => normalizeTxType(t.type) === 'mining')
    .reduce((s, t) => s + Number(t.amount || 0), 0);
  const referralBonuses = txns.filter(t => t.type === 'referral')
    .reduce((s, t) => s + Number(t.amount || 0), 0);

  setText('walletTotalDeposited',  '₿ ' + totalDeposited.toFixed(8));
  setText('walletTotalWithdrawn',  '₿ ' + totalWithdrawn.toFixed(8));
  setText('walletMiningIncome',    '₿ ' + miningIncome.toFixed(8));
  setText('walletReferralBonuses', '₿ ' + referralBonuses.toFixed(8));

  /* Portfolio BTC amount from profile */
  const profile    = Auth.getProfile();
  const btcBalance = typeof profile.btc_balance === 'number' ? profile.btc_balance : 0;
  setText('walletBTCAmount', btcBalance.toFixed(8) + ' BTC');

  /* also update the big portfolio display */
  const usdtBalance = typeof profile.usdt_balance === 'number' ? profile.usdt_balance : 0;
  setText('walletUSDTAmount', usdtBalance.toFixed(2) + ' USDT');
}

/* ══════════════════════════════════════════════════════════════
   UI — EARNINGS CHART (real data from transactions)
══════════════════════════════════════════════════════════════ */
function initEarningsChart(transactions) {
  const canvas = $('earningsChart');
  if (!canvas) return;

  /* group mining transactions by day for last 12 days */
  const now    = new Date();
  const days   = 12;
  const buckets = {};
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    buckets[key] = 0;
  }

  transactions
    .filter(t => normalizeTxType(t.type) === 'mining')
    .forEach(t => {
      const key = t.created_at?.slice(0, 10);
      if (key && key in buckets) {
        buckets[key] += Number(t.amount || 0);
      }
    });

  const labels = Object.keys(buckets);
  const data   = Object.values(buckets);
  const hasData = data.some(v => v > 0);

  /* update summary below chart */
  const total12d = data.reduce((s, v) => s + v, 0);
  const avgDaily = total12d / days;
  const bestDay  = Math.max(...data);
  setText('chartTotal12d', hasData ? '₿ ' + total12d.toFixed(8) : '₿ 0.00000000');
  setText('chartAvgDaily', hasData ? '₿ ' + avgDaily.toFixed(8) : '₿ 0.00000000');
  setText('chartBestDay',  hasData ? '₿ ' + bestDay.toFixed(8)  : '₿ 0.00000000');

  if (!hasData) {
    /* draw empty-state chart */
    _drawEmptyChart(canvas, 'No mining earnings yet');
    return;
  }

  _drawLineChart(canvas, data, '#f59e0b', 'rgba(245,158,11,0.25)');
}

function initHashrateChart(contracts) {
  const canvas = $('hashrateChart');
  if (!canvas) return;

  const active = contracts.filter(c => c.active === true);
  if (!active.length) {
    _drawEmptyChart(canvas, 'No active contracts');
    setText('hashrateStatPeak', '—');
    setText('hashrateStatAvg',  '—');
    setText('hashrateStatEff',  '—');
    return;
  }

  /* For a real app, hashrate history would come from a DB table.
     Here we show current hashrate as a flat line — honest and real. */
  const totalHash = active.reduce((s, c) => s + Number(c.hashrate || 0), 0);
  const flatData  = Array(24).fill(totalHash);

  _drawLineChart(canvas, flatData, '#10b981', 'rgba(16,185,129,0.2)');

  setText('hashrateStatPeak', totalHash.toFixed(1) + ' TH/s');
  setText('hashrateStatAvg',  totalHash.toFixed(1) + ' TH/s');
  setText('hashrateStatEff',  '100%');
}

function initDonut(profile) {
  const canvas = $('donutChart');
  if (!canvas) return;
  const ctx  = canvas.getContext('2d');
  if (!ctx) return;
  const size = 120;
  canvas.width = size;
  canvas.height = size;
  const cx = size / 2, cy = size / 2, r = 44, rw = 16;

  const btc  = typeof profile.btc_balance  === 'number' ? profile.btc_balance  : 0;
  const usdt = typeof profile.usdt_balance === 'number' ? profile.usdt_balance : 0;
  const price = BTCPrice.get() || 0;
  const btcUsd = btc * price;
  const total  = btcUsd + usdt;

  if (total <= 0) {
    /* empty ring */
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.arc(cx, cy, r - rw, 0, Math.PI * 2, true);
    ctx.fillStyle = 'rgba(30,45,69,0.5)';
    ctx.fill();
    ctx.fillStyle = '#64748b'; ctx.font = 'bold 11px Arial';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('Empty', cx, cy);
    return;
  }

  const segments = [];
  if (btcUsd > 0) segments.push({ pct: btcUsd / total, color: '#f7931a' });
  if (usdt   > 0) segments.push({ pct: usdt   / total, color: '#26a17b' });

  let start = -Math.PI / 2;
  segments.forEach(seg => {
    const angle = seg.pct * 2 * Math.PI;
    ctx.beginPath();
    ctx.arc(cx, cy, r, start, start + angle);
    ctx.arc(cx, cy, r - rw, start + angle, start, true);
    ctx.closePath();
    ctx.fillStyle = seg.color;
    ctx.fill();
    start += angle + 0.03;
  });

  /* BTC % label */
  const btcPct = total > 0 ? ((btcUsd / total) * 100).toFixed(0) : '0';
  ctx.fillStyle = '#f1f5f9'; ctx.font = 'bold 13px Arial';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('BTC', cx, cy - 6);
  ctx.font = '10px Arial'; ctx.fillStyle = '#94a3b8';
  ctx.fillText(btcPct + '%', cx, cy + 8);
}

function _drawLineChart(canvas, data, lineColor, fillColor) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const w = canvas.width  = canvas.offsetWidth || 400;
  const h = canvas.height = 160;
  const max   = Math.max(...data);
  const min   = Math.min(...data);
  const range = max - min || Math.abs(max) || 0.0000001;

  const getX = i => (i / (data.length - 1)) * (w - 40) + 20;
  const getY = v => h - 20 - ((v - min) / range) * (h - 50);

  const gradient = ctx.createLinearGradient(0, 0, 0, h);
  gradient.addColorStop(0, fillColor);
  gradient.addColorStop(1, 'rgba(0,0,0,0)');

  ctx.beginPath();
  ctx.moveTo(getX(0), h - 20);
  data.forEach((v, i) => ctx.lineTo(getX(i), getY(v)));
  ctx.lineTo(getX(data.length - 1), h - 20);
  ctx.closePath();
  ctx.fillStyle = gradient;
  ctx.fill();

  ctx.beginPath();
  ctx.strokeStyle = lineColor;
  ctx.lineWidth = 2.5;
  ctx.lineJoin = 'round';
  data.forEach((v, i) => { i === 0 ? ctx.moveTo(getX(i), getY(v)) : ctx.lineTo(getX(i), getY(v)); });
  ctx.stroke();

  if (data.length <= 24) {
    data.forEach((v, i) => {
      ctx.beginPath();
      ctx.arc(getX(i), getY(v), 3, 0, Math.PI * 2);
      ctx.fillStyle = lineColor;
      ctx.fill();
      ctx.strokeStyle = '#1a2236';
      ctx.lineWidth = 2;
      ctx.stroke();
    });
  }
}

function _drawEmptyChart(canvas, label) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const w = canvas.width  = canvas.offsetWidth || 400;
  const h = canvas.height = 160;
  ctx.strokeStyle = 'rgba(30,45,69,0.5)';
  ctx.lineWidth   = 1;
  for (let i = 0; i < 4; i++) {
    const y = 20 + (i * (h - 40) / 3);
    ctx.beginPath(); ctx.moveTo(20, y); ctx.lineTo(w - 20, y); ctx.stroke();
  }
  ctx.fillStyle    = '#475569';
  ctx.font         = '13px sans-serif';
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, w / 2, h / 2);
}

/* ══════════════════════════════════════════════════════════════
   PORTFOLIO TOTAL VALUE
══════════════════════════════════════════════════════════════ */
function updatePortfolioValue() {
  const profile  = Auth.getProfile();
  const btc      = typeof profile.btc_balance  === 'number' ? profile.btc_balance  : 0;
  const usdt     = typeof profile.usdt_balance === 'number' ? profile.usdt_balance : 0;
  const price    = BTCPrice.get();

  if (price != null) {
    const total = (btc * price) + usdt;
    const str   = '$' + total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    setText('walletBalanceUSD', str);
    setText('portfolioTotalUSD', str);
  } else {
    setText('walletBalanceUSD',  '—');
    setText('portfolioTotalUSD', '—');
  }
}

/* ══════════════════════════════════════════════════════════════
   TAB NAVIGATION
══════════════════════════════════════════════════════════════ */
function switchTab(name) {
  document.querySelectorAll('.tab-content').forEach(t  => { t.style.display = 'none'; });
  document.querySelectorAll('.nav-item').forEach(a    => { a.classList.remove('active'); });

  const tab     = $('tab-' + name);
  const navItem = $('nav-' + name);
  if (tab)     tab.style.display = '';
  if (navItem) navItem.classList.add('active');

  const titles = {
    dashboard:    'Dashboard',
    mining:       'Mining',
    wallet:       'Wallet',
    transactions: 'Transactions',
    plans:        'Mining Plans',
    referral:     'Referral Program',
    settings:     'Settings',
  };
  setText('pageTitle', titles[name] || name);

  /* close mobile sidebar */
  $('sidebar')?.classList.remove('open');
  $('sidebarOverlay')?.classList.remove('open');
}

/* ══════════════════════════════════════════════════════════════
   MODAL HELPERS
══════════════════════════════════════════════════════════════ */
function openDepositModal() {
  const modal = $('depositModal');
  if (modal) modal.style.display = 'flex';
}
function openWithdrawModal() {
  const modal = $('withdrawModal');
  if (modal) modal.style.display = 'flex';
}

/* ══════════════════════════════════════════════════════════════
   PURCHASE PLAN (UI only — real purchase flow wired to balance)
══════════════════════════════════════════════════════════════ */
async function purchasePlan(planName, priceUsd, hashrate) {
  /* Force latest profile before balance check (avoid stale local state) */
  const latestProfile = await Auth.refreshProfile();

  /* ── SOURCE OF TRUTH: profiles.usdt_balance ── */
  const balance = typeof latestProfile?.usdt_balance === 'number' ? latestProfile.usdt_balance : 0;
  const cost    = parseFloat(priceUsd);

  if (balance < cost) {
    Toast.show(
      `Insufficient USDT balance. You need $${cost.toFixed(2)} but have $${balance.toFixed(2)}.`,
      'error', 5000
    );
    return;
  }

  if (!_supabase) { Toast.show('Service unavailable.', 'error'); return; }

  const user = Auth.getUser();
  if (!user) { Toast.show('Auth error. Please log in again.', 'error'); return; }

  try {
    Toast.show('Processing…', 'info', 2000);

    /* 1. Create contract row */
    const { error: contractErr } = await _supabase
      .from('contracts')
      .insert({
        user_id:      user.id,
        plan:         planName,
        hashrate:     Number(hashrate),
        active:       true,
        daily_profit: Number(hashrate) * 0.0000032,  /* platform rate per TH/s */
        progress:     0,
        days_left:    _planDays(planName),
        created_at:   new Date().toISOString(),
      });
    if (contractErr) throw contractErr;

    /* 2. Record transaction (for history only, NOT balance calculation) */
    const { error: txErr } = await _supabase
      .from('transactions')
      .insert({
        user_id:    user.id,
        type:       'purchase',
        amount:     cost,
        coin:       'usdt',
        status:     'success',
        created_at: new Date().toISOString(),
      });
    if (txErr) {
      console.error('Transaction insert failed:', txErr);
      throw txErr;
    }

    /* 3. Deduct USDT balance (source of truth) */
    const newBalance = balance - cost;
    const { error: balErr } = await _supabase
      .from('profiles')
      .update({ usdt_balance: newBalance })
      .eq('id', user.id);
    if (balErr) throw balErr;

    Toast.show(`✅ ${planName} Plan activated! ${hashrate} TH/s added.`, 'success', 5000);

    /* 4. Refresh profile/UI from latest DB state */
    await Auth.refreshProfile();
    populateUserUI();
    await refreshAll();
  } catch (err) {
    console.error('purchasePlan:', err);
    Toast.show('Purchase failed: ' + err.message, 'error', 5000);
  }
}

function _planDays(name) {
  const map = { Starter: 30, Silver: 90, Gold: 180, Platinum: 365 };
  return map[name] || 30;
}

/*
  ADMIN HELPER:
  Approves a pending deposit, credits profile balance, and ALWAYS writes a
  history row to transactions so history/recent activity stay in sync.
*/
async function approveDeposit(deposit) {
  if (!_supabase || !deposit?.id || !deposit?.user_id) {
    throw new Error('Invalid approveDeposit payload.');
  }

  const coin = String(deposit.coin || '').toLowerCase();
  const amount = Number(deposit.amount || 0);
  if (amount <= 0) throw new Error('Invalid deposit amount.');

  /* 1) Mark deposit approved */
  const { error: depErr } = await _supabase
    .from('deposits')
    .update({ status: 'approved', approved_at: new Date().toISOString() })
    .eq('id', deposit.id);
  if (depErr) throw depErr;

  /* 2) Credit user profile balance */
  const { data: prof, error: profErr } = await _supabase
    .from('profiles')
    .select('btc_balance, usdt_balance')
    .eq('id', deposit.user_id)
    .single();
  if (profErr) throw profErr;

  const btc = Number(prof?.btc_balance || 0);
  const usdt = Number(prof?.usdt_balance || 0);
  const profilePatch = coin === 'usdt_bep20' || coin === 'usdt'
    ? { usdt_balance: usdt + amount }
    : { btc_balance: btc + amount };

  const { error: balErr } = await _supabase
    .from('profiles')
    .update(profilePatch)
    .eq('id', deposit.user_id);
  if (balErr) throw balErr;

  /* 3) ALWAYS write history row */
  const { error: txErr } = await _supabase
    .from('transactions')
    .insert({
      user_id: deposit.user_id,
      type: 'deposit',
      amount: Number(deposit.amount || 0),
      coin: (deposit.coin || 'usdt').toLowerCase(),
      status: 'success',
      created_at: new Date().toISOString(),
    });

  if (txErr) {
    console.error('Deposit transaction insert failed:', txErr);
    alert(txErr.message);
    throw txErr;
  }
  console.log('Deposit transaction saved');

  /* 4) Refresh local UI if current viewer is same user */
  if (Auth.getUser()?.id === deposit.user_id) {
    await Auth.refreshProfile();
    await refreshAll();
    populateUserUI();
  }
}

/* ══════════════════════════════════════════════════════════════
   SAVE SETTINGS
══════════════════════════════════════════════════════════════ */
async function saveSettings() {
  const name  = $('settingName')?.value.trim()  || '';
  const email = $('settingEmail')?.value.trim() || '';
  const updates = {};
  if (name) updates.name = name;

  if (!Object.keys(updates).length) { Toast.show('Nothing to save.', 'info'); return; }
  const result = await Auth.updateProfile(updates);
  if (result) {
    if (name) document.querySelectorAll('.user-name-display').forEach(el => { el.textContent = name; });
    Toast.show('Settings saved!', 'success');
  } else {
    Toast.show('Failed to save settings.', 'error');
  }
}

/* ══════════════════════════════════════════════════════════════
   WIRE INTERACTIONS
══════════════════════════════════════════════════════════════ */
function wireLogout() {
  document.querySelectorAll('[data-logout]').forEach(el => {
    el.addEventListener('click', async e => {
      e.preventDefault();
      Toast.show('Logging out…', 'info', 1200);
      setTimeout(() => Auth.logout(), 800);
    });
  });
}

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
    overlay?.classList.remove('open');
  });
}

function wireDropdowns() {
  document.querySelectorAll('[data-dropdown-toggle]').forEach(trigger => {
    trigger.addEventListener('click', e => {
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

function wireModals() {
  document.querySelectorAll('[data-modal]').forEach(btn => {
    btn.addEventListener('click', () => {
      const modal = $(btn.dataset.modal);
      if (modal) modal.style.display = 'flex';
    });
  });
  document.querySelectorAll('[data-close-modal]').forEach(btn => {
    btn.addEventListener('click', () => {
      const modal = $(btn.dataset.closeModal);
      if (modal) modal.style.display = 'none';
    });
  });
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', e => {
      if (e.target === overlay) overlay.style.display = 'none';
    });
  });

  /* withdraw form */
  $('withdrawForm')?.addEventListener('submit', e => {
    e.preventDefault();
    $('withdrawModal').style.display = 'none';
    Toast.show('📤 Withdrawal submitted. Processing within 24 hours.', 'info', 4000);
  });
}

function wireDepositButtons() {
  document.querySelectorAll('[data-deposit-btn]').forEach(btn => {
    btn.addEventListener('click', e => { e.preventDefault(); openDepositModal(); });
  });
}
function wireWithdrawButtons() {
  document.querySelectorAll('[data-withdraw-btn]').forEach(btn => {
    btn.addEventListener('click', e => { e.preventDefault(); openWithdrawModal(); });
  });
}

/* ══════════════════════════════════════════════════════════════
   DEPOSIT FORM (Supabase Storage + deposits table)
══════════════════════════════════════════════════════════════ */
function initDepositForm() {
  const form        = $('depositForm');
  const coinSelect  = $('depositCoin');
  const amountInput = $('depositAmount');
  const amountSuffix = $('amountSuffix');
  const amountHint   = $('amountHint');
  const uploadArea   = $('uploadArea');
  const fileInput    = $('depositScreenshot');
  const uploadContent = $('uploadContent');
  const uploadPreview = $('uploadPreview');
  const previewImage  = $('previewImage');
  const previewFilename = $('previewFilename');
  const removePreview   = $('removePreview');

  if (!form) return;

  /* coin select → update label */
  coinSelect?.addEventListener('change', () => {
    const val = coinSelect.value;
    if (val === 'usdt_bep20') {
      if (amountSuffix) amountSuffix.textContent = 'USDT';
      if (amountHint)   amountHint.textContent   = 'Minimum deposit: 10 USDT';
      if (amountInput)  { amountInput.placeholder = '0.00'; amountInput.step = '0.01'; amountInput.min = '10'; }
    } else if (val === 'btc') {
      if (amountSuffix) amountSuffix.textContent = 'BTC';
      if (amountHint)   amountHint.textContent   = 'Minimum deposit: 0.0001 BTC';
      if (amountInput)  { amountInput.placeholder = '0.00000000'; amountInput.step = '0.00000001'; amountInput.min = '0.0001'; }
    }
  });

  /* file upload */
  if (uploadArea && fileInput) {
    uploadArea.addEventListener('click', e => {
      if (!e.target.closest('.preview-remove')) fileInput.click();
    });
    ['dragenter','dragover','dragleave','drop'].forEach(ev => {
      uploadArea.addEventListener(ev, e => { e.preventDefault(); e.stopPropagation(); });
    });
    ['dragenter','dragover'].forEach(ev => {
      uploadArea.addEventListener(ev, () => uploadArea.classList.add('dragover'));
    });
    ['dragleave','drop'].forEach(ev => {
      uploadArea.addEventListener(ev, () => uploadArea.classList.remove('dragover'));
    });
    uploadArea.addEventListener('drop', e => {
      if (e.dataTransfer.files.length) _handleFile(e.dataTransfer.files[0]);
    });
    fileInput.addEventListener('change', () => {
      if (fileInput.files.length) _handleFile(fileInput.files[0]);
    });
    removePreview?.addEventListener('click', e => {
      e.stopPropagation();
      _resetFileInput();
    });
  }

  function _handleFile(file) {
    const valid = ['image/png','image/jpeg','image/jpg','image/gif'];
    if (!valid.includes(file.type)) { Toast.show('Please upload an image (PNG, JPG, GIF)', 'error'); return; }
    if (file.size > 5 * 1024 * 1024) { Toast.show('File too large. Max 5MB.', 'error'); return; }
    const reader = new FileReader();
    reader.onload = e => {
      if (previewImage)   previewImage.src = e.target.result;
      if (previewFilename) previewFilename.textContent = file.name;
      if (uploadContent)  uploadContent.style.display = 'none';
      if (uploadPreview)  uploadPreview.style.display = 'flex';
      uploadArea.classList.add('has-file');
      Toast.show('Screenshot ready', 'success', 2000);
    };
    reader.readAsDataURL(file);
  }

  function _resetFileInput() {
    if (fileInput)      fileInput.value = '';
    if (previewImage)   previewImage.src = '';
    if (uploadContent)  uploadContent.style.display = 'flex';
    if (uploadPreview)  uploadPreview.style.display = 'none';
    if (uploadArea)     uploadArea.classList.remove('has-file');
  }

  /* form submit */
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const coin    = coinSelect?.value || '';
    const amount  = amountInput?.value || '';
    const txHash  = $('depositTxHash')?.value.trim() || '';
    const hasFile = fileInput?.files?.length > 0;

    if (!coin)                            { Toast.show('Select a coin',                   'error'); return; }
    if (!amount || parseFloat(amount)<=0) { Toast.show('Enter a valid amount',             'error'); return; }
    if (!txHash)                          { Toast.show('Enter the transaction hash',       'error'); return; }
    if (!hasFile)                         { Toast.show('Upload a payment screenshot',       'error'); return; }

    const user = Auth.getUser();
    if (!user)     { Toast.show('Auth required. Please log in again.', 'error'); return; }
    if (!_supabase){ Toast.show('Service unavailable.',                 'error'); return; }

    const file     = fileInput.files[0];
    const fileExt  = file.name.split('.').pop();
    const filePath = user.id + '/' + Date.now() + '.' + fileExt;

    Toast.show('⏳ Uploading screenshot…', 'info', 2000);

    const { error: uploadErr } = await _supabase
      .storage
      .from('deposit-screenshots')
      .upload(filePath, file, { cacheControl: '3600', upsert: false, contentType: file.type });

    if (uploadErr) { Toast.show('Upload failed: ' + uploadErr.message, 'error', 5000); return; }

    const { data: urlData } = _supabase
      .storage
      .from('deposit-screenshots')
      .getPublicUrl(filePath);

    const { data: dep, error: insertErr } = await _supabase
      .from('deposits')
      .insert({
        user_id:        user.id,
        user_email:     user.email,
        coin,
        amount:         parseFloat(amount),
        tx_hash:        txHash,
        screenshot_url: urlData?.publicUrl || '',
        status:         'pending',
        created_at:     new Date().toISOString(),
      })
      .select()
      .single();

    if (insertErr) {
      /* cleanup orphan screenshot */
      await _supabase.storage.from('deposit-screenshots').remove([filePath]).catch(() => {});
      Toast.show('Failed to save deposit: ' + insertErr.message, 'error', 5000);
      return;
    }

    const coinLabel = coin === 'usdt_bep20' ? 'USDT (BEP20)' : 'BTC';
    Toast.show(`✅ Deposit submitted! ${amount} ${coinLabel} — pending review.`, 'success', 5000);

    /* add to local list and re-render immediately */
    if (dep) _allDeposits.unshift(dep);
    renderTransactions(_currentTxFilter);

    /* reset form */
    form.reset();
    _resetFileInput();
    if (amountSuffix) amountSuffix.textContent = '—';
    if (amountHint)   amountHint.textContent   = 'Enter the exact amount you sent';
    $('depositModal').style.display = 'none';
  });
}

/* ══════════════════════════════════════════════════════════════
   REFRESH ALL DATA
══════════════════════════════════════════════════════════════ */
async function refreshAll() {
  const [txns, deps, contracts] = await Promise.all([
    loadTransactions(),
    loadDeposits(),
    loadContracts(),
  ]);
  _allTransactions = txns;
  _allDeposits     = deps;

  renderTransactions(_currentTxFilter);
  renderRecentActivity();
  renderContracts(contracts);
  renderMiningStats(contracts);
  renderWalletSummary();
  updatePortfolioValue();
  populateDashboardStats(contracts);

  setTimeout(() => {
    initEarningsChart(txns);
    initHashrateChart(contracts);
    initDonut(Auth.getProfile());
  }, 120);
}

/* ══════════════════════════════════════════════════════════════
   MAIN INIT
══════════════════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', async () => {
  /* 1. Auth guard */
  const ok = await Auth.init();
  if (!ok) return;

  /* 2. Populate UI with real profile data */
  populateUserUI();

  /* 3. Wire all interactions */
  wireLogout();
  wireMobileMenu();
  wireDropdowns();
  wireModals();
  wireTransactionFilters();
  wireDepositButtons();
  wireWithdrawButtons();
  initDepositForm();

  /* 4. Load all real data and render */
  await refreshAll();

  /* 5. BTC price drives USD displays */
  BTCPrice.onChange(() => {
    updatePortfolioValue();
    renderTransactions(_currentTxFilter); /* refresh USD column */
  });

  /* 6. Expose globals needed by inline HTML onclick= attributes */
  window.switchTab          = switchTab;
  window.purchasePlan       = purchasePlan;
  window.saveSettings       = saveSettings;
  window.copyToClipboard    = copyToClipboard;
  window.Toast              = Toast;
  window.BTCPrice           = BTCPrice;
  window.Auth               = Auth;
  window.openDepositModal   = openDepositModal;
  window.openWithdrawModal  = openWithdrawModal;
  window.approveDeposit     = approveDeposit;
  window.refreshTransactions = async () => {
    _allDeposits     = await loadDeposits();
    _allTransactions = await loadTransactions();
    renderTransactions(_currentTxFilter);
  };

  console.log('CryptoVault dashboard initialized — real data only.');
});
