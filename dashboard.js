/* ══════════════════════════════════════════════════════════════
   CRYPTOVAULT — dashboard.js
   Premium Vanilla JS · Production Ready
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
    const colours = { success: '#22c55e', error: '#ef4444', info: '#f59e0b', warning: '#f97316' };
    const border  = colours[type] || colours.info;
    const toast   = document.createElement('div');
    toast.style.cssText = [
      'background:#111827', 'border:1px solid #1e2d45',
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
    requestAnimationFrame(() => {
      toast.style.opacity = '1';
      toast.style.transform = 'translateX(0)';
    });
    setTimeout(() => {
      Object.assign(toast.style, { opacity: '0', transform: 'translateX(16px)' });
      setTimeout(() => toast.remove(), 320);
    }, duration);
  }
  return { show };
})();

/* Global wrappers */
function showToast(msg, type, duration) { Toast.show(msg, type, duration); }

/* ─── DOM HELPERS ────────────────────────────────────────── */
function $(id)            { return document.getElementById(id); }
function setText(id, val) { const el = $(id); if (el) el.textContent = val; }
function toNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}
function toUsdt(value, fallback = 0) {
  const n = toNumber(value, fallback);
  return n < 0 ? 0 : n;
}

function escapeHtml(text) {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function normalizeTxType(raw) {
  const t = String(raw || '').trim().toLowerCase();
  if (['deposit', 'deposits', 'approved_deposit'].includes(t)) return 'deposit';
  if (['withdrawal', 'withdrawals'].includes(t)) return 'withdrawal';
  if (['mining', 'mining_reward', 'reward'].includes(t)) return 'mining';
  if (['purchase', 'purchases', 'plan_purchase'].includes(t)) return 'purchase';
  return t || 'other';
}

const PLAN_MS_PER_DAY = 24 * 60 * 60 * 1000;
const PLAN_CONFIG_FALLBACK = {
  starter:  { priceUsd: 500,   hashrate: 10,  durationDays: 1460, monthlyRate: 0.05, icon: '🌱', color: 'var(--green)' },
  silver:   { priceUsd: 2500,  hashrate: 50,  durationDays: 1095, monthlyRate: 0.10, icon: '🥈', color: 'var(--blue)' },
  gold:     { priceUsd: 5000,  hashrate: 100, durationDays: 730,  monthlyRate: 0.15, icon: '🥇', color: 'var(--gold)' },
  platinum: { priceUsd: 10000, hashrate: 300, durationDays: 365,  monthlyRate: 0.20, icon: '💎', color: 'var(--purple)' },
};

let PLAN_CONFIG = { ...PLAN_CONFIG_FALLBACK };

function normalizePlanKey(planName) {
  return String(planName || '').trim().toLowerCase();
}

function getPlanConfig(planName) {
  return PLAN_CONFIG[normalizePlanKey(planName)] || null;
}

function normalizeMonthlyRate(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n > 1 ? n / 100 : n;
}

function getPlanPriceFromSource(source, fallback = null) {
  const price = Number(source?.priceUsd ?? source?.plan_price ?? source?.price ?? source?.amount ?? fallback);
  return Number.isFinite(price) && price > 0 ? price : null;
}

function getPlanMonthlyRateFromSource(source, fallback = null) {
  const rate = normalizeMonthlyRate(source?.monthlyRate ?? source?.plan_monthly_rate ?? source?.monthly_return_pct ?? source?.monthly_return ?? fallback);
  return rate ?? null;
}

function getPlanDurationFromSource(source, fallback = null) {
  const days = Number(source?.durationDays ?? source?.duration_days ?? fallback);
  return Number.isFinite(days) && days > 0 ? Math.floor(days) : null;
}

function getContractPriceUsd(contract) {
  const planCfg = getPlanConfig(contract?.plan || contract?.name);
  return getPlanPriceFromSource(contract, planCfg?.priceUsd) ?? 0;
}

function getContractMonthlyRate(contract) {
  const planCfg = getPlanConfig(contract?.plan || contract?.name);
  return Number(planCfg?.monthlyRate || 0) || 0;
}

function getContractDurationDays(contract) {
  return getPlanDurationDays(contract?.plan || contract?.name) ?? 0;
}

function getPlanDurationDays(planName, fallbackDays = null) {
  return getPlanDurationFromSource(getPlanConfig(planName), fallbackDays);
}

function getPlanPriceUsd(planName, fallbackPrice = null) {
  return getPlanPriceFromSource(getPlanConfig(planName), fallbackPrice);
}

function getPlanHashrate(planName, fallbackHashrate = null) {
  const plan = getPlanConfig(planName);
  return Number.isFinite(Number(plan?.hashrate ?? fallbackHashrate)) ? Number(plan?.hashrate ?? fallbackHashrate) : null;
}

function getPlanMonthlyRate(planName, fallbackRate = null) {
  return getPlanMonthlyRateFromSource(getPlanConfig(planName), fallbackRate) ?? 0;
}

function getPlanDailyProfitUsd(planName, priceUsd = null) {
  const price = Number.isFinite(Number(priceUsd)) ? Number(priceUsd) : getPlanPriceUsd(planName, 0);
  const monthlyRate = getPlanMonthlyRate(planName, 0);
  return price > 0 ? (price * monthlyRate) / 30 : 0;
}

function getPlanMonthlyProfitUsd(planName, priceUsd = null) {
  const price = Number.isFinite(Number(priceUsd)) ? Number(priceUsd) : getPlanPriceUsd(planName, 0);
  return price > 0 ? price * getPlanMonthlyRate(planName, 0) : 0;
}

function getContractDurationDays(contract) {
  return getPlanDurationDays(contract?.plan || contract?.name) || 0;
}

function getContractExpiryDate(contract) {
  const createdAt = new Date(contract?.created_at || Date.now());
  const durationDays = getContractDurationDays(contract);
  if (!durationDays || !Number.isFinite(createdAt.getTime())) return null;
  return new Date(createdAt.getTime() + durationDays * PLAN_MS_PER_DAY);
}

function getContractRemainingDays(contract, refDate = new Date()) {
  const durationDays = getContractDurationDays(contract);
  if (!durationDays) return null;
  const createdAt = new Date(contract?.created_at || Date.now());
  const elapsedDays = Math.max(0, (refDate.getTime() - createdAt.getTime()) / PLAN_MS_PER_DAY);
  const remaining = durationDays - elapsedDays;
  if (remaining <= 0) return 0;
  return Math.max(1, Math.ceil(remaining));
}

function isContractExpired(contract, refDate = new Date()) {
  const expiryDate = getContractExpiryDate(contract);
  return !!expiryDate && refDate.getTime() >= expiryDate.getTime();
}

function getContractProgressPercent(contract, refDate = new Date()) {
  const durationDays = getContractDurationDays(contract);
  if (!durationDays) return Math.min(100, Math.max(0, Number(contract?.progress || 0)));
  const createdAt = new Date(contract?.created_at || Date.now());
  const elapsedDays = Math.max(0, (refDate.getTime() - createdAt.getTime()) / PLAN_MS_PER_DAY);
  return Math.min(100, Math.max(0, (elapsedDays / durationDays) * 100));
}

function getContractDailyProfitUsd(contract) {
  const daily = Number(contract?.daily_profit);
  if (Number.isFinite(daily) && daily > 0) return daily;
  const price = getContractPriceUsd(contract);
  const monthlyRate = getContractMonthlyRate(contract);
  return price > 0 && monthlyRate > 0 ? (price * monthlyRate) / 30 : 0;
}

function getContractMonthlyProfitUsd(contract) {
  const price = getContractPriceUsd(contract);
  const monthlyRate = getContractMonthlyRate(contract);
  return price > 0 && monthlyRate > 0 ? price * monthlyRate : getContractDailyProfitUsd(contract) * 30;
}

function getContractHashrate(contract) {
  const direct = Number(contract?.hashrate ?? contract?.hash_rate ?? 0);
  if (Number.isFinite(direct) && direct > 0) return direct;
  const plan = getPlanConfig(contract?.plan || contract?.name);
  const planHash = Number(plan?.hashrate ?? 0);
  return Number.isFinite(planHash) && planHash > 0 ? planHash : 0;
}

function getMiningSummary(contracts = [], refDate = new Date()) {
  const activeContracts = (contracts || []).filter(c => c?.active === true && !isContractExpired(c, refDate));
  const count = activeContracts.length;
  const totalHashrate = activeContracts.reduce((sum, contract) => sum + getContractHashrate(contract), 0);
  const totalPower = totalHashrate * 32;
  const dailyProfit = activeContracts.reduce((sum, contract) => sum + getContractDailyProfitUsd(contract), 0);
  const monthlyProjection = dailyProfit * 30;
  const efficiency = totalHashrate > 0 ? (dailyProfit / totalHashrate) : 0;
  return { activeContracts, count, totalHashrate, totalPower, dailyProfit, monthlyProjection, efficiency };
}

function formatActiveContractCount(count) {
  if (!count) return 'No active contracts';
  return count === 1 ? '1 Active Contract' : `${count} Active Contracts`;
}

function updateMiningHeaderSubtitle(text) {
  const title = [...document.querySelectorAll('#tab-mining .card-title')]
    .find(el => (el.textContent || '').trim() === 'Active Mining Contracts');
  const subtitle = title?.closest('.card-header')?.querySelector('.card-subtitle');
  if (subtitle) subtitle.textContent = text;
}

function updateMiningCardStates(summary) {
  const liveCard = document.getElementById('liveHashrate')?.closest('.stat-card');
  const dailyCard = document.getElementById('dailyProfitEl')?.closest('.stat-card');
  const liveStatus = liveCard?.querySelector('.stat-change');
  const dailyStatus = dailyCard?.querySelector('.stat-change');

  if (liveStatus) liveStatus.textContent = summary.count ? formatActiveContractCount(summary.count) : 'No active contracts';
  if (dailyStatus) dailyStatus.textContent = summary.dailyProfit > 0 ? 'Daily mining income active' : 'No active contracts';

  updateMiningHeaderSubtitle(summary.count ? 'Your active mining contracts' : 'No active contracts');
}

async function loadPlanCatalog() {
  if (!_supabase) return PLAN_CONFIG;
  try {
    const { data, error } = await _supabase
      .from('plans')
      .select('*');
    if (error || !Array.isArray(data) || !data.length) return PLAN_CONFIG;

    const next = { ...PLAN_CONFIG_FALLBACK };
    data.forEach(row => {
      const key = normalizePlanKey(row?.name || row?.plan_name || row?.title || row?.slug);
      if (!key) return;
      next[key] = {
        ...next[key],
        priceUsd: getPlanPriceFromSource(row, next[key]?.priceUsd) ?? next[key]?.priceUsd,
        hashrate: Number(row?.hashrate ?? row?.hash_rate ?? next[key]?.hashrate ?? 0) || next[key]?.hashrate,
        durationDays: getPlanDurationFromSource(row, next[key]?.durationDays) ?? next[key]?.durationDays,
        monthlyRate: getPlanMonthlyRateFromSource(row, next[key]?.monthlyRate) ?? next[key]?.monthlyRate,
      };
    });
    PLAN_CONFIG = next;
  } catch (err) {
    console.warn('[CryptoVault] loadPlanCatalog failed:', err.message);
  }
  return PLAN_CONFIG;
}

function normalizeContractLifecycle(contract) {
  if (!contract) return contract;
  const plan = contract.plan || contract.name || '';
  const priceUsd = getPlanPriceUsd(plan, contract.plan_price);
  return {
    ...contract,
    plan_price: priceUsd ?? contract.plan_price ?? null,
    active: contract.active === true && !isContractExpired(contract),
  };
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
  const _roleAuth = window.CVAuthRole;

  async function init() {
    if (!_supabase || !_roleAuth) { window.location.replace('login.html'); return false; }
    try {
      const { session, role } = await _roleAuth.getSessionWithRole(_supabase);
      if (!session) { window.location.replace('login.html'); return false; }
      if (role === 'admin') { window.location.replace('admin.html'); return false; }
      _session = session;

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
            usdt_balance: 0,
            ref_code,
          })
          .select()
          .single();
        _profile = newProf || {
          id: session.user.id,
          email: session.user.email,
          usdt_balance: 0,
          ref_code,
        };
      } else {
        _profile = prof;
        if (!_profile.ref_code && _supabase) {
          const ref_code = 'CV' + Math.random().toString(36).substring(2, 8).toUpperCase();
          await _supabase.from('profiles').update({ ref_code }).eq('id', session.user.id);
          _profile.ref_code = ref_code;
        }
      }

      _supabase.auth.onAuthStateChange(event => {
        if (event === 'SIGNED_OUT') {
          _roleAuth.clearRole();
          window.location.replace('login.html');
        }
      });
      return true;
    } catch (err) {
      console.error('Auth init failed:', err);
      window.location.replace('login.html');
      return false;
    }
  }

  async function logout() {
    try { if (_supabase) await _supabase.auth.signOut(); } catch { /* ignore */ }
    _roleAuth.clearRole();
    window.location.replace('login.html');
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

function updateBTCPrice() {
  BTCPrice.onChange(({ price, change }) => {
    const tickerPrice  = $('tickerPrice');
    const tickerChange = $('tickerChange');
    if (tickerPrice)  tickerPrice.textContent  = BTCPrice.fmt(price);
    if (tickerChange) {
      const pctStr = change != null
        ? ((change >= 0 ? '▲' : '▼') + ' ' + Math.abs(change).toFixed(2) + '%')
        : '';
      const pctClass = change != null ? (change >= 0 ? 'ticker-up' : 'ticker-down') : '';
      tickerChange.textContent = pctStr;
      tickerChange.className   = 'ticker-change ' + pctClass;
    }
  });
}

/* ══════════════════════════════════════════════════════════════
   DATA LOADERS
══════════════════════════════════════════════════════════════ */
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

async function loadContracts() {
  const user = Auth.getUser();
  if (!user || !_supabase) return [];
  const { data, error } = await _supabase
    .from('contracts')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });
  if (error) { console.error('loadContracts:', error); return []; }
  return (data || []).map(normalizeContractLifecycle);
}

/* ══════════════════════════════════════════════════════════════
   UI — POPULATE USER DATA
══════════════════════════════════════════════════════════════ */
async function populateUserUI() {
  const user    = Auth.getUser();
  const profile = Auth.getProfile();
  const email   = user?.email || '';
  const name    = profile.name || email.split('@')[0] || 'User';
  const initial = name.charAt(0).toUpperCase();

  document.querySelectorAll('.user-avatar-display').forEach(el => { el.textContent = initial; });
  document.querySelectorAll('.user-name-display').forEach(el  => { el.textContent = name; });
  document.querySelectorAll('.user-email-display').forEach(el => { el.textContent = email; });

  const usdtBalance = toUsdt(profile.usdt_balance);
  const walletDisplay = '$' + usdtBalance.toFixed(2) + ' USDT';
  setText('walletBalanceCounter', walletDisplay);
  setText('walletBigBalance',     walletDisplay);
  setText('walletBigUSD',         walletDisplay);
  setText('walletItemUSD',        walletDisplay);
  setText('portfolioBTCusd',      walletDisplay);
  setText('usdtBalanceEl',        usdtBalance.toFixed(2) + ' USDT');

  BTCPrice.onChange(({ price, change }) => {
    const pctStr = change != null
      ? ((change >= 0 ? '▲' : '▼') + ' ' + Math.abs(change).toFixed(2) + '%')
      : '';
    const pctClass = change != null ? (change >= 0 ? 'ticker-up' : 'ticker-down') : '';

    const tickerPrice  = $('tickerPrice');
    const tickerChange = document.querySelector('.ticker-change');
    if (tickerPrice)  tickerPrice.textContent  = BTCPrice.fmt(price);
    if (tickerChange && pctStr) {
      tickerChange.textContent = pctStr;
      tickerChange.className   = 'ticker-change ' + pctClass;
    }
  });

  /* ─── REFERRAL CODE SYSTEM ─────────────────────────────────
     Sirf referral CODE dikhao — koi link nahi
  ────────────────────────────────────────────────────────── */
  let refCode = profile.ref_code || '';

  // Agar ref_code nahi hai to generate karo aur database mein save karo
  if (!refCode && _supabase && user) {
    refCode = 'CV' + Math.random().toString(36).substring(2, 8).toUpperCase();
    await _supabase.from('profiles').update({ ref_code: refCode }).eq('id', user.id);
    profile.ref_code = refCode;
  }

  // Referral CODE display karo (link nahi)
  setText('refLinkDisplay', refCode || '—');

  /* ─── USER ID DISPLAY (5-letter) ─────────────────────────── */
  const userId = profile.user_id || '—';
  let userIdEl = $('userIdDisplay');
  if (!userIdEl) {
    const refEl = $('refLinkDisplay');
    if (refEl && refEl.parentElement) {
      userIdEl = document.createElement('div');
      userIdEl.id = 'userIdDisplay';
      userIdEl.style.cssText = 'margin-top:6px;font-size:13px;color:#f59e0b;font-weight:700;font-family:monospace;';
      refEl.parentElement.appendChild(userIdEl);
    }
  }
  if (userIdEl) userIdEl.textContent = 'User ID: ' + userId;

  // Copy button sirf CODE copy karega
  const copyRefBtn = $('copyRefBtn');
  if (copyRefBtn) {
    if (refCode) {
      copyRefBtn.onclick = () => copyToClipboard(refCode, '🎟️ Referral code copied!');
      copyRefBtn.disabled = false;
      copyRefBtn.style.opacity = '1';
    } else {
      copyRefBtn.disabled = true;
      copyRefBtn.style.opacity = '0.5';
      copyRefBtn.onclick = null;
    }
  }

  // Referral stats update
  setText('refCountEl',    profile.ref_count    || 0);
  setText('refEarningsEl', '₿ ' + (Number(profile.ref_earnings) || 0).toFixed(8));
  setText('activeRefEl',   profile.ref_count    || 0);

  const sName  = $('settingName');
  const sEmail = $('settingEmail');
  if (sName)  sName.value  = profile.name  || '';
  if (sEmail) sEmail.value = email;
}

/* ══════════════════════════════════════════════════════════════
   UI — DASHBOARD STATS
══════════════════════════════════════════════════════════════ */
async function populateDashboardStats(contracts) {
  const summary = getMiningSummary(contracts);
  setText('liveHashrate',  summary.totalHashrate > 0 ? summary.totalHashrate.toFixed(1) + ' TH/s' : '0 TH/s');
  setText('liveHashrate2', summary.totalHashrate > 0 ? summary.totalHashrate.toFixed(1) + ' TH/s' : '0 TH/s');

  setText('dailyProfitEl', '$ ' + summary.dailyProfit.toFixed(2) + ' USDT');
  updateMiningCardStates(summary);

  const statChangeHashrate = document.getElementById('statChangeHashrate');
  const statChangeContracts = document.getElementById('statChangeContracts');
  if (statChangeHashrate)  statChangeHashrate.textContent  = formatActiveContractCount(summary.count);
  if (statChangeContracts) statChangeContracts.textContent = summary.count ? 'Mining income active' : 'No active contracts';

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
    setText('totalMinedEl', '$ ' + totalMined.toFixed(2) + ' USDT');
  } else {
    setText('totalMinedEl', '$ 0.00 USDT');
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
    if (f === 'deposit' || f === 'deposits') return 'deposit';
    if (f === 'withdrawal' || f === 'withdrawals') return 'withdrawal';
    if (f === 'mining') return 'mining';
    if (f === 'purchase' || f === 'purchases') return 'purchase';
    if (f === 'all') return 'all';
    return f;
  };

  filter = normalizeFilter(filter);
  _currentTxFilter = filter;
  const tbody = $('txTableBody');
  if (!tbody) return;

  const txRows = _allTransactions.map(tx => {
    const txType = normalizeTxType(tx.type);
    const coinLbl = 'USDT';
    const decimals = 2;
    const amt = Number(tx.amount || 0);
    const isOut = amt < 0 || txType === 'withdrawal' || txType === 'purchase';
    const amtStr = (isOut ? '-' : '+') + Math.abs(amt).toFixed(decimals) + ' USDT';
    const usdVal = (isOut ? '-' : '+') + '$' + Math.abs(amt).toFixed(2);

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

  const pendingDepRows = _allDeposits
    .filter(d => d.status === 'pending')
    .map(d => {
      const coinLbl = 'USDT';
      const amt     = Number(d.amount || 0);
      const amtStr  = '+' + amt.toFixed(2) + ' USDT';
      const usdVal  = '+$' + amt.toFixed(2);
      return {
        desc:   'Deposit (Pending)',
        coin:   coinLbl,
        amount: amtStr,
        usd:    usdVal,
        status: 'pending',
        date:   _fmtDate(d.created_at),
        type:   'deposit',
        createdAt: d.created_at,
      };
    });

  const merged = [...txRows, ...pendingDepRows].sort(
    (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
  );

  let filtered = merged;
  const activeFilter = normalizeFilter(filter);

  if (activeFilter !== 'all') {
    filtered = merged.filter(tx => {
      const type = normalizeTxType(tx.type);
      if (activeFilter === 'mining') {
        return (type === 'mining' || type === 'purchase');
      }
      return type === activeFilter;
    });
  }

  const rows = filtered;

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
      <td>${escapeHtml(tx.desc)}</td>
      <td>${tx.coin}</td>
      <td style="color:${tx.amount.startsWith('+') ? '#22c55e' : '#ef4444'};font-family:'DM Mono',monospace;">${tx.amount}</td>
      <td style="font-family:'DM Mono',monospace;color:#94a3b8;">${tx.usd}</td>
      <td>${_statusBadge(tx.status)}</td>
      <td style="color:#94a3b8;">${tx.date}</td>
    </tr>
  `).join('');
}

function _txLabel(type) {
  const t = String(type || '').toLowerCase();
  const map = {
    mining:      'Mining Reward',
    deposit:     'Deposit',
    deposits:    'Deposit',
    withdrawal:  'Withdrawal',
    withdrawals: 'Withdrawal',
    purchase:    'Mining Plan Purchase',
    purchases:   'Mining Plan Purchase',
    referral:    'Referral Bonus',
    transfer:    'Transfer',
  };
  return map[t] || type || '—';
}

function _fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function _statusBadge(s) {
  const map = {
    success:  { bg: 'rgba(34,197,94,.15)',  fg: '#22c55e', label: 'Success'  },
    approved: { bg: 'rgba(34,197,94,.15)',  fg: '#22c55e', label: 'Approved' },
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
   UI — RECENT ACTIVITY
══════════════════════════════════════════════════════════════ */
function renderRecentActivity() {
  const container = $('recentActivityList');
  if (!container) return;

  const txRows = _allTransactions.map(tx => {
    const txType = normalizeTxType(tx.type);
    const symbol = 'USDT';
    const decimals = 2;
    const amt = Number(tx.amount || 0);
    const isOut = amt < 0 || txType === 'withdrawal' || txType === 'purchase';
    return {
      icon:   _txIcon(txType),
      desc:   _txLabel(tx.type),
      date:   _fmtDate(tx.created_at),
      amount: (isOut ? '-' : '+') + Math.abs(amt).toFixed(decimals) + ' USDT',
      isOut:  isOut,
      createdAt: tx.created_at,
    };
  });

  const pendingDepRows = _allDeposits
    .filter(d => d.status === 'pending')
    .map(d => {
      return {
        icon:   '⏳',
        desc:   'Deposit (Pending)',
        date:   _fmtDate(d.created_at),
        amount: '+' + Number(d.amount || 0).toFixed(2) + ' USDT',
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
        <div class="rig-name">${escapeHtml(item.desc)}</div>
        <div class="rig-specs">${item.date}</div>
      </div>
      <div class="rig-metrics">
        <div class="rig-hash" style="color:${item.isOut ? 'var(--red)' : 'var(--green)'}">${item.amount}</div>
      </div>
    </div>
  `).join('');
}

function _txIcon(type) {
  const t = String(type || '').toLowerCase();
  const map = {
    mining:      '⛏️',
    deposit:     '📥',
    deposits:    '📥',
    withdrawal:  '📤',
    withdrawals: '📤',
    purchase:    '⛏️',
    purchases:   '⛏️',
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

  const summary = getMiningSummary(contracts);
  const active = summary.activeContracts;
  window._activeContracts = active; // 👈 modal ke liye store kar rahe hain
  updateMiningCardStates(summary);

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
    const progress    = getContractProgressPercent(c);
    const remaining   = getContractRemainingDays(c);
    const daysLeft    = remaining != null ? remaining + ' days left' : 'Unlimited';
    const hashrate    = c.hashrate  != null ? Number(c.hashrate).toFixed(1) + ' TH/s' : '—';
    const dailyProfit = getContractDailyProfitUsd(c) > 0
      ? '$ ' + getContractDailyProfitUsd(c).toFixed(2) + ' USDT'
      : '—';
    const planName    = c.plan || c.name || 'Mining Contract';

    return `
      <div class="rig-card plan-contract-card" style="margin-bottom:12px;" onclick="window.location.href='plan-detail.html?contract=${c.id}'">
        <div class="tx-icon mining">⛏️</div>
        <div class="rig-info">
          <div class="rig-name">${planName}</div>
          <div class="rig-specs">${hashrate} · ${daysLeft}</div>
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
  const summary = getMiningSummary(contracts);

  setText('miningStatHashrate',  summary.totalHashrate > 0 ? summary.totalHashrate.toFixed(1) + ' TH/s' : '0 TH/s');
  setText('miningStatPower',     summary.totalPower > 0 ? summary.totalPower.toFixed(0) + ' W' : '0 W');
  setText('miningStatDaily',     '$ ' + summary.dailyProfit.toFixed(2) + ' USDT');
  setText('miningStatMonthly',   '$ ' + summary.monthlyProjection.toFixed(2) + ' USDT');
  setText('miningStatEfficiency', summary.totalHashrate > 0 ? summary.efficiency.toFixed(3) + ' USDT/TH' : '—');

  updateMiningCardStates(summary);
  renderContractProgress(summary.activeContracts);
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
    const progress = getContractProgressPercent(c);
    const remaining = getContractRemainingDays(c);
    const daysLeft = remaining != null ? remaining + ' days left' : 'Unlimited';
    const planName = c.plan || c.name || 'Contract';
    const hashrate = c.hashrate != null ? c.hashrate.toFixed(1) : '—';
    return `
      <div style="margin-bottom:16px;">
        <div class="progress-label">
          <span>${planName}</span>
          <span>${daysLeft}</span>
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

  const txns = _allTransactions;

  const totalDeposited  = txns.filter(t => normalizeTxType(t.type) === 'deposit')
    .reduce((s, t) => s + Number(t.amount || 0), 0);
  const totalWithdrawn  = txns.filter(t => normalizeTxType(t.type) === 'withdrawal')
    .reduce((s, t) => s + Number(t.amount || 0), 0);
  const miningIncome    = txns.filter(t => normalizeTxType(t.type) === 'mining')
    .reduce((s, t) => s + Number(t.amount || 0), 0);
  const referralBonuses = txns.filter(t => t.type === 'referral')
    .reduce((s, t) => s + Number(t.amount || 0), 0);

  setText('walletTotalDeposited',  '$ ' + totalDeposited.toFixed(2) + ' USDT');
  setText('walletTotalWithdrawn',  '$ ' + totalWithdrawn.toFixed(2) + ' USDT');
  setText('walletMiningIncome',    '$ ' + miningIncome.toFixed(2) + ' USDT');
  setText('walletReferralBonuses', '$ ' + referralBonuses.toFixed(2) + ' USDT');

  const profile    = Auth.getProfile();
  const usdtBalance = toUsdt(profile.usdt_balance);
  setText('walletBTCAmount', usdtBalance.toFixed(2) + ' USDT');
  setText('walletUSDTAmount', usdtBalance.toFixed(2) + ' USDT');
}

/* ══════════════════════════════════════════════════════════════
   UI — EARNINGS CHART
══════════════════════════════════════════════════════════════ */
function initEarningsChart(transactions) {
  const canvas = $('earningsChart');
  if (!canvas) return;

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

  const total12d = data.reduce((s, v) => s + v, 0);
  const avgDaily = total12d / days;
  const bestDay  = Math.max(...data);
  setText('chartTotal12d', hasData ? '$ ' + total12d.toFixed(2) + ' USDT' : '$ 0.00 USDT');
  setText('chartAvgDaily', hasData ? '$ ' + avgDaily.toFixed(2) + ' USDT' : '$ 0.00 USDT');
  setText('chartBestDay',  hasData ? '$ ' + bestDay.toFixed(2) + ' USDT' : '$ 0.00 USDT');

  if (!hasData) {
    _drawEmptyChart(canvas, 'No mining earnings yet');
    return;
  }

  _drawLineChart(canvas, data, '#f59e0b', 'rgba(245,158,11,0.25)');
}

function initHashrateChart(contracts) {
  const canvas = $('hashrateChart');
  if (!canvas) return;

  const summary = getMiningSummary(contracts);
  const active = summary.activeContracts;
  if (!active.length) {
    _drawEmptyChart(canvas, 'No active contracts');
    setText('hashrateStatPeak', '—');
    setText('hashrateStatAvg',  '—');
    setText('hashrateStatEff',  '—');
    return;
  }

  const totalHash = summary.totalHashrate;
  const flatData  = Array(24).fill(totalHash);

  _drawLineChart(canvas, flatData, '#22c55e', 'rgba(34,197,94,0.2)');

  setText('hashrateStatPeak', totalHash.toFixed(1) + ' TH/s');
  setText('hashrateStatAvg',  totalHash.toFixed(1) + ' TH/s');
  setText('hashrateStatEff',  summary.efficiency.toFixed(3) + ' USDT/TH');
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

  const usdt = toUsdt(profile.usdt_balance);
  const total  = usdt;

  if (total <= 0) {
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
  if (usdt > 0) segments.push({ pct: 1, color: '#26a17b' });

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

  ctx.fillStyle = '#f8fafc'; ctx.font = 'bold 13px Arial';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('USDT', cx, cy - 6);
  ctx.font = '10px Arial'; ctx.fillStyle = '#94a3b8';
  ctx.fillText('$ ' + usdt.toFixed(2), cx, cy + 8);
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
  const usdt     = toUsdt(profile.usdt_balance);
  const str      = '$' + usdt.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' USDT';
  setText('walletBalanceUSD', str);
  setText('portfolioTotalUSD', str);
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

  if (name === 'transactions') {
    Notifications.markRead(null, ['deposit','withdrawal','mining','purchase','referral']);
  }

  $('sidebar')?.classList.remove('open');
  $('sidebarOverlay')?.classList.remove('open');
}

/* ─── SIDEBAR TOGGLE ─────────────────────────────────────── */
function toggleSidebar() {
  const sidebar = $('sidebar');
  const overlay = $('sidebarOverlay');
  if (!sidebar) return;
  const isOpen = sidebar.classList.contains('open');
  if (isOpen) {
    sidebar.classList.remove('open');
    overlay?.classList.remove('open');
  } else {
    sidebar.classList.add('open');
    overlay?.classList.add('open');
  }
}

/* ══════════════════════════════════════════════════════════════
   MODAL HELPERS
══════════════════════════════════════════════════════════════ */
function openModal(id) {
  const modal = $(id);
  if (modal) {
    modal.style.display = 'flex';
    modal.classList.add('open');
  }
}
function closeModal(id) {
  const modal = $(id);
  if (modal) {
    modal.style.display = 'none';
    modal.classList.remove('open');
  }
}

function openDepositModal()   { openModal('depositModal'); }
function openWithdrawModal()  { openModal('withdrawModal'); }

/* ══════════════════════════════════════════════════════════════
   PURCHASE PLAN — WITH CONFIRMATION
══════════════════════════════════════════════════════════════ */
let _pendingPurchase = null;

/* ══════════════════════════════════════════════════════════════
   PLAN DETAIL MODAL  —  Live 24h Payout Timer
══════════════════════════════════════════════════════════════ */
let _planDetailTimerInterval = null;

function openPlanDetailModal(contractId) {
  const contract = (window._activeContracts || []).find(c => c.id === contractId || c.id == contractId);
  if (!contract) { Toast.show('Contract not found', 'error'); return; }
  if (isContractExpired(contract)) { Toast.show('This contract has expired.', 'warning'); return; }

  // Purana timer band karo
  if (_planDetailTimerInterval) { clearInterval(_planDetailTimerInterval); _planDetailTimerInterval = null; }

  const modal = $('planDetailModal');
  const body  = $('planDetailBody');
  const title = $('planDetailTitle');
  if (!modal || !body) return;

  const planName      = escapeHtml(contract.plan || contract.name || 'Mining Contract');
  const hashrate      = contract.hashrate != null ? Number(contract.hashrate).toFixed(1) + ' TH/s' : '—';
  const dailyProfit   = getContractDailyProfitUsd(contract);
  const dailyProfitStr= dailyProfit > 0 ? '$ ' + dailyProfit.toFixed(2) + ' USDT' : '—';
  const progress      = getContractProgressPercent(contract);
  const remainingDays = getContractRemainingDays(contract);
  const daysLeft      = remainingDays != null ? remainingDays + ' days' : 'Unlimited';
  const durationDays  = getContractDurationDays(contract);

  const startDate     = contract.created_at ? new Date(contract.created_at) : new Date();
  const startDateStr  = startDate.toLocaleDateString('en-US', { day:'numeric', month:'short', year:'numeric' });
  const startTimeStr  = startDate.toLocaleTimeString('en-US', { hour:'2-digit', minute:'2-digit' });

  const now           = new Date();
  const msPerDay      = 24 * 60 * 60 * 1000;
  const elapsedMs     = now - startDate;
  const daysActive    = Math.max(0, Math.min(elapsedMs / msPerDay, durationDays || elapsedMs / msPerDay));
  const totalEarned   = Number.isFinite(Number(contract.total_earned))
    ? Number(contract.total_earned)
    : dailyProfit * daysActive;
  const totalEarnedStr= totalEarned > 0 ? '$ ' + totalEarned.toFixed(2) + ' USDT' : '$ 0.00 USDT';
  const totalEarnedUSD= '$' + totalEarned.toFixed(2) + ' USDT';
  const durationText  = durationDays ? 'Duration: ' + durationDays + ' days' : 'Duration: —';

  title.textContent = planName + ' Plan';

  body.innerHTML = `
    <div class="plan-detail-body">
      <div class="plan-detail-top">
        <div class="plan-detail-icon-large">⛏️</div>
        <div class="plan-detail-status-badge ${contract.active ? 'active' : 'inactive'}">${contract.active ? '● Active' : 'Inactive'}</div>
      </div>

      <div class="plan-detail-grid">
        <div class="plan-detail-cell">
          <div class="plan-detail-cell-label">🚀 Started On</div>
          <div class="plan-detail-cell-value">${startDateStr}</div>
          <div class="plan-detail-cell-sub">${startTimeStr}</div>
        </div>
        <div class="plan-detail-cell">
          <div class="plan-detail-cell-label">📅 Days Active</div>
          <div class="plan-detail-cell-value">${Math.floor(daysActive)}</div>
          <div class="plan-detail-cell-sub">days running</div>
        </div>
        <div class="plan-detail-cell">
          <div class="plan-detail-cell-label">⏳ Days Left</div>
          <div class="plan-detail-cell-value">${daysLeft}</div>
          <div class="plan-detail-cell-sub">remaining</div>
        </div>
        <div class="plan-detail-cell">
          <div class="plan-detail-cell-label">💰 Total Earned</div>
          <div class="plan-detail-cell-value gold">${totalEarnedStr}</div>
          <div class="plan-detail-cell-sub">${totalEarnedUSD}</div>
        </div>
      </div>

      <div class="plan-detail-timer-box">
        <div class="plan-detail-timer-header">
          <span class="plan-detail-timer-icon">⏱️</span>
          <span>Next Payout Timer (24h Cycle)</span>
        </div>
        <div class="plan-detail-timer-display" id="planDetailTimer">00:00:00</div>
        <div class="plan-detail-timer-info">
          <span>Daily Earnings</span>
          <span class="plan-detail-timer-amount">${dailyProfitStr}</span>
          <span style="font-size:12px;">${durationText}</span>
        </div>
      </div>

      <div class="plan-detail-progress-wrap">
        <div class="plan-detail-progress-label">
          <span>Contract Progress</span>
          <span>${progress.toFixed(0)}%</span>
        </div>
        <div class="progress-bar">
          <div class="progress-fill" style="width:${progress}%"></div>
        </div>
        <div class="plan-detail-progress-meta">
          <span>${hashrate}</span>
          <span>${dailyProfitStr} / day</span>
        </div>
      </div>
    </div>
  `;

  openModal('planDetailModal');

  // 🔥 Live timer start — har second update hoga
  _planDetailTimerInterval = setInterval(() => _updatePlanDetailTimer(contract), 1000);
  _updatePlanDetailTimer(contract); // immediate first run
}

function _updatePlanDetailTimer(contract) {
  if (isContractExpired(contract)) {
    const timerEl = $('planDetailTimer');
    if (timerEl) timerEl.textContent = '00:00:00';
    return;
  }

  const now     = new Date();
  const nextPayout = contract?.next_payout_at ? new Date(contract.next_payout_at) : new Date((contract.last_payout_at ? new Date(contract.last_payout_at) : new Date(contract.created_at || Date.now())).getTime() + 24 * 60 * 60 * 1000);
  const timeUntil   = Math.max(0, nextPayout - now);

  const hours   = Math.floor(timeUntil / (60 * 60 * 1000));
  const minutes = Math.floor((timeUntil % (60 * 60 * 1000)) / (60 * 1000));
  const seconds = Math.floor((timeUntil % (60 * 1000)) / 1000);

  const timerEl = $('planDetailTimer');
  if (timerEl) {
    timerEl.textContent =
      String(hours).padStart(2, '0') + ':' +
      String(minutes).padStart(2, '0') + ':' +
      String(seconds).padStart(2, '0');
  }
}

function closePlanDetailModal() {
  if (_planDetailTimerInterval) {
    clearInterval(_planDetailTimerInterval);
    _planDetailTimerInterval = null;
  }
  closeModal('planDetailModal');
}

function purchasePlan(planName, priceUsd, hashrate, dailyUsd = null, durationDays = null) {
  const modal = $('purchaseModal');
  const body  = $('purchaseModalBody');
  if (!modal || !body) return;

  const plan = getPlanConfig(planName);
  const price = getPlanPriceUsd(planName, priceUsd) ?? Number(priceUsd) ?? 0;
  const hash  = getPlanHashrate(planName, hashrate) ?? Number(hashrate) ?? 0;
  const days  = getPlanDurationDays(planName, durationDays) ?? Number(durationDays) ?? 0;
  const dailyFallback = Number(dailyUsd);
  const rate  = getPlanMonthlyRate(planName, plan?.monthlyRate)
    || (price > 0 && Number.isFinite(dailyFallback) && dailyFallback > 0 ? (dailyFallback * 30) / price : 0);
  const daily = price > 0 && rate > 0 ? (price * rate) / 30 : (Number.isFinite(dailyFallback) && dailyFallback > 0 ? dailyFallback : getPlanDailyProfitUsd(planName, price));
  const monthly = getPlanMonthlyProfitUsd(planName, price);
  const daysText = days ? `${days} Days` : 'Unlimited';
  const icon  = plan?.icon || '⛏️';
  const color = plan?.color || 'var(--gold)';

  body.innerHTML = `
    <div style="text-align:center;margin-bottom:20px;">
      <div style="font-size:48px;margin-bottom:8px;">${icon}</div>
      <div style="font-family:'Syne',sans-serif;font-size:22px;font-weight:700;">${planName} Plan</div>
      <div style="color:var(--text-muted);font-size:14px;">${hash} TH/s · ${daysText}</div>
    </div>
    <div style="background:var(--bg-base);border:1px solid var(--border);border-radius:12px;padding:16px;margin-bottom:20px;">
      <div class="flex justify-between" style="margin-bottom:10px;"><span style="color:var(--text-muted);">Price</span><span style="font-weight:700;">$${price.toLocaleString('en-US')}</span></div>
      <div class="flex justify-between" style="margin-bottom:10px;"><span style="color:var(--text-muted);">Hashrate</span><span style="font-weight:700;">${hash} TH/s</span></div>
      <div class="flex justify-between" style="margin-bottom:10px;"><span style="color:var(--text-muted);">Duration</span><span style="font-weight:700;color:${color};">${daysText}</span></div>
      <div class="flex justify-between" style="margin-bottom:10px;"><span style="color:var(--text-muted);">Daily Profit</span><span style="font-weight:700;color:${color};">~$${daily.toFixed(2)} USDT</span></div>
      <div class="flex justify-between"><span style="color:var(--text-muted);">Est. Monthly</span><span style="font-weight:700;color:var(--gold);">~$${monthly.toFixed(2)} USDT</span></div>
    </div>
    <div style="display:flex;gap:12px;">
      <button class="btn btn-ghost btn-full" onclick="closeModal('purchaseModal')">Cancel</button>
      <button class="btn btn-primary btn-full" onclick="confirmPurchase()">Confirm Purchase</button>
    </div>
  `;

  _pendingPurchase = { planName, priceUsd: price, hashrate: hash, daily, days, monthlyRate: rate };
  openModal('purchaseModal');
}

async function confirmPurchase() {
  if (!_pendingPurchase) return;
  const { planName, priceUsd, hashrate, daily, days, monthlyRate } = _pendingPurchase;
  closeModal('purchaseModal');
  _pendingPurchase = null;
  await _executePurchase(planName, priceUsd, hashrate, daily, days, monthlyRate);
}

async function _executePurchase(planName, priceUsd, hashrate, dailyUsd = null, durationDays = null, monthlyRate = null) {
  const latestProfile = await Auth.refreshProfile();
  const balance = toUsdt(latestProfile?.usdt_balance);
  const cost    = toUsdt(priceUsd);
  const plan    = getPlanConfig(planName);
  const rate    = Number.isFinite(Number(monthlyRate)) ? Number(monthlyRate) : getPlanMonthlyRate(planName, plan?.monthlyRate);
  const daily   = cost > 0 && rate > 0 ? (cost * rate) / 30 : (Number.isFinite(Number(dailyUsd)) ? Number(dailyUsd) : getPlanDailyProfitUsd(planName, cost));
  const days    = Number.isFinite(Number(durationDays)) ? Number(durationDays) : getPlanDurationDays(planName, plan?.durationDays);

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
    console.log('[CryptoVault] contract creation started', { planName, cost, hashrate, daily, days, monthlyRate });
    Toast.show('Processing…', 'info', 2000);

  const contractPayload = {
      user_id:        user.id,
      plan:           planName,
      plan_price:     cost,
      hashrate:       Number(hashrate),
      active:         true,
      daily_profit:   daily,
      progress:       0,
      last_payout_at: null,
      next_payout_at: new Date(Date.now() + (24 * 60 * 60 * 1000)).toISOString(),
      total_earned:   0,
      created_at:     new Date().toISOString(),
    };

    const { data: contractRow, error: contractErr } = await _supabase
      .from('contracts')
      .insert(contractPayload)
      .select()
      .single();
    if (contractErr) throw contractErr;
    console.log('[CryptoVault] contract insert success', contractRow?.id || 'ok');

    const transactionPayload = {
      user_id:    user.id,
      type:       'purchase',
      amount:     cost,
      coin:       'usdt',
      status:     'success',
      created_at: new Date().toISOString(),
    };

    const { error: txErr } = await _supabase
      .from('transactions')
      .insert(transactionPayload);
    if (txErr) {
      console.error('Transaction insert failed:', txErr);
      if (contractRow?.id) {
        await _supabase.from('contracts').delete().eq('id', contractRow.id).catch(() => {});
      }
      throw txErr;
    }
    console.log('[CryptoVault] transaction insert success');

    const newBalance = Math.max(0, balance - cost);
    const { error: balErr } = await _supabase
      .from('profiles')
      .update({ usdt_balance: newBalance })
      .eq('id', user.id);
    if (balErr) {
      console.error('Balance update failed:', balErr);
      await Promise.allSettled([
        contractRow?.id ? _supabase.from('contracts').delete().eq('id', contractRow.id) : Promise.resolve(),
        _supabase.from('transactions').delete().eq('user_id', user.id).eq('type', 'purchase').eq('amount', cost).eq('created_at', transactionPayload.created_at),
      ]);
      throw balErr;
    }
    console.log('[CryptoVault] wallet deduction success');

    Toast.show(`✅ ${planName} Plan activated! ${hashrate} TH/s added.`, 'success', 5000);
    console.log('[CryptoVault] purchase completed');

    await Auth.refreshProfile();
    populateUserUI();
    await refreshAll();
  } catch (err) {
    console.error('purchasePlan:', err);
    Toast.show('Purchase failed: ' + err.message, 'error', 5000);
  }
}

function _planDays(name) {
  return getPlanDurationDays(name);
}

async function approveDeposit(deposit) {
  if (!_supabase || !deposit?.id || !deposit?.user_id) {
    throw new Error('Invalid approveDeposit payload.');
  }

  const coin = String(deposit.coin || '').toLowerCase();
  const amount = Number(deposit.amount || 0);
  if (amount <= 0) throw new Error('Invalid deposit amount.');

  const { error: depErr } = await _supabase
    .from('deposits')
    .update({ status: 'approved', approved_at: new Date().toISOString() })
    .eq('id', deposit.id);
  if (depErr) throw depErr;

  const { data: prof, error: profErr } = await _supabase
    .from('profiles')
    .select('usdt_balance')
    .eq('id', deposit.user_id)
    .single();
  if (profErr) throw profErr;

  const usdt = toUsdt(prof?.usdt_balance);
  const profilePatch = { usdt_balance: usdt + amount };

  const { error: balErr } = await _supabase
    .from('profiles')
    .update(profilePatch)
    .eq('id', deposit.user_id);
  if (balErr) throw balErr;

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
      openModal(btn.dataset.modal);
    });
  });
  document.querySelectorAll('[data-close-modal]').forEach(btn => {
    btn.addEventListener('click', () => {
      closeModal(btn.dataset.closeModal);
    });
  });
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', e => {
      if (e.target === overlay) overlay.style.display = 'none';
    });
  });

  $('withdrawForm')?.addEventListener('submit', e => {
    e.preventDefault();
    closeModal('withdrawModal');
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

function wirePlanButtons() {
  document.querySelectorAll('.plan-purchase-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const plan  = btn.dataset.plan;
      const price = btn.dataset.price;
      const hash  = btn.dataset.hash;
      const daily = btn.dataset.daily;
      const days  = btn.dataset.duration;
      purchasePlan(plan, price, hash, daily, days);
    });
  });
}

/* ══════════════════════════════════════════════════════════════
   DEPOSIT FORM
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

  if (coinSelect) coinSelect.value = 'usdt_bep20';
  if (amountSuffix) amountSuffix.textContent = 'USDT';
  if (amountHint)   amountHint.textContent   = 'Minimum deposit: 10 USDT';
  if (amountInput)  { amountInput.placeholder = '0.00'; amountInput.step = '0.01'; amountInput.min = '10'; }

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

  form.addEventListener('submit', async e => {
    e.preventDefault();
    const coin    = 'usdt_bep20';
    const amount  = amountInput?.value || '';
    const txHash  = $('depositTxHash')?.value.trim() || '';
    const hasFile = fileInput?.files?.length > 0;

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
        coin:           'usdt_bep20',
        amount:         parseFloat(amount),
        tx_hash:        txHash,
        screenshot_url: urlData?.publicUrl || '',
        status:         'pending',
        created_at:     new Date().toISOString(),
      })
      .select()
      .single();

    if (insertErr) {
      await _supabase.storage.from('deposit-screenshots').remove([filePath]).catch(() => {});
      Toast.show('Failed to save deposit: ' + insertErr.message, 'error', 5000);
      return;
    }

    Toast.show(`✅ Deposit submitted! ${amount} USDT — pending review.`, 'success', 5000);

    if (dep) _allDeposits.unshift(dep);
    renderTransactions(_currentTxFilter);

    form.reset();
    _resetFileInput();
    if (amountSuffix) amountSuffix.textContent = 'USDT';
    if (amountHint)   amountHint.textContent   = 'Enter the exact amount you sent';
    closeModal('depositModal');
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

  await Notifications.load();

  setTimeout(() => {
    initEarningsChart(txns);
    initHashrateChart(contracts);
    initDonut(Auth.getProfile());
  }, 120);
}

/* ══════════════════════════════════════════════════════════════
   NOTIFICATIONS MODULE
══════════════════════════════════════════════════════════════ */
const Notifications = (() => {
  let _notifications = [];

  async function load() {
    const user = Auth.getUser();
    if (!user || !_supabase) return [];
    const { data, error } = await _supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20);
    if (error) { console.error('loadNotifications:', error); return []; }
    _notifications = data || [];
    render();
    updateBadge();
    return _notifications;
  }

  function render() {
    const list = $('notificationList');
    if (!list) return;

    if (!_notifications.length) {
      list.innerHTML = `<div style="padding:32px;text-align:center;color:#475569;font-size:13px;">📭 No notifications yet.</div>`;
      return;
    }

    const typeColors = {
      success: '#22c55e', warning: '#f97316', error: '#ef4444', info: '#3b82f6',
      deposit: '#22c55e', withdrawal: '#ef4444', mining: '#f59e0b', purchase: '#3b82f6',
      announcement: '#8b5cf6', referral: '#8b5cf6',
    };
    const icons = {
      success: '✅', warning: '⚠️', error: '❌', info: '💡',
      deposit: '📥', withdrawal: '📤', mining: '⛏️', purchase: '🛒',
      announcement: '📢', referral: '👥',
    };

    list.innerHTML = _notifications.map(n => {
      const isUnread = !n.is_read;
      const color = typeColors[n.type] || typeColors.info;
      const icon = icons[n.type] || '🔔';
      const preview = escapeHtml(String(n.message || '').replace(/\n/g, ' ').slice(0, 60));
      const showEllipsis = String(n.message || '').length > 60;
      return `
        <div class="notification-item ${isUnread ? 'unread' : ''}" data-notif-id="${n.id}">
          <div class="notification-dot" style="background:${color};box-shadow:0 0 8px ${color}66;"></div>
          <div class="notification-content">
            <div class="notification-title">${icon} ${escapeHtml(n.title) || 'Notification'}</div>
            <div class="notification-preview">${preview}${showEllipsis ? '…' : ''}</div>
            <div class="notification-time">${_fmtDate(n.created_at)}</div>
          </div>
        </div>`;
    }).join('');

    list.querySelectorAll('.notification-item').forEach(item => {
      item.addEventListener('click', () => {
        const id = item.dataset.notifId;
        const notif = _notifications.find(n => n.id === id);
        if (notif) openNotificationModal(notif);
        if (id) markRead(id);
      });
    });
  }

  function updateBadge() {
    const unread = _notifications.filter(n => !n.is_read).length;
    const badge = $('notifBadge');
    const txBadge = document.querySelector('#nav-transactions .nav-badge');

    if (badge) {
      if (unread > 0) {
        badge.textContent = unread > 99 ? '99+' : String(unread);
        badge.style.display = 'flex';
      } else {
        badge.style.display = 'none';
      }
    }

    const txUnread = _notifications.filter(n => !n.is_read && ['deposit','withdrawal','mining','purchase','referral'].includes(n.type)).length;
    if (txBadge) {
      if (txUnread > 0) {
        txBadge.textContent = txUnread > 99 ? '99+' : String(txUnread);
        txBadge.style.display = 'flex';
      } else {
        txBadge.style.display = 'none';
      }
    }

    const label = $('notifCountLabel');
    if (label) label.textContent = unread + ' unread';
  }

  async function markRead(ids = null, types = null) {
    const user = Auth.getUser();
    if (!user || !_supabase) return;

    let query = _supabase.from('notifications').update({ is_read: true });

    if (ids) {
      query = query.in('id', Array.isArray(ids) ? ids : [ids]);
    } else if (types) {
      const typeArr = Array.isArray(types) ? types : [types];
      query = query.eq('user_id', user.id).eq('is_read', false).in('type', typeArr);
    } else {
      query = query.eq('user_id', user.id).eq('is_read', false);
    }

    const { error } = await query;
    if (error) { console.error('markRead:', error); return; }

    if (ids) {
      const idArr = Array.isArray(ids) ? ids : [ids];
      _notifications.forEach(n => { if (idArr.includes(n.id)) n.is_read = true; });
    } else if (types) {
      const typeArr = Array.isArray(types) ? types : [types];
      _notifications.forEach(n => { if (typeArr.includes(n.type)) n.is_read = true; });
    } else {
      _notifications.forEach(n => { n.is_read = true; });
    }
    render();
    updateBadge();
  }

  return { load, render, updateBadge, markRead, getUnread: () => _notifications.filter(n => !n.is_read).length };
})();

function openNotificationModal(notification) {
  const old = document.getElementById('notifModal');
  if (old) old.remove();

  const modal = document.createElement('div');
  modal.id = 'notifModal';
  modal.className = 'notif-modal';
  modal.innerHTML = `
    <div class="notif-modal-overlay">
      <div class="notif-modal-box">
        <div class="notif-modal-header">
          <div class="notif-modal-meta">
            <span class="notif-modal-icon">${notification.type === 'success' ? '✅' : notification.type === 'error' ? '❌' : notification.type === 'warning' ? '⚠️' : notification.type === 'deposit' ? '📥' : notification.type === 'withdrawal' ? '📤' : notification.type === 'mining' ? '⛏️' : notification.type === 'purchase' ? '🛒' : notification.type === 'announcement' ? '📢' : notification.type === 'referral' ? '👥' : '🔔'}</span>
            <h3>${escapeHtml(notification.title) || 'Notification'}</h3>
          </div>
          <button class="notif-modal-close" aria-label="Close">✕</button>
        </div>
        <div class="notif-modal-body">
          <div class="notif-modal-message">${escapeHtml(notification.message)}</div>
          <div class="notif-modal-date">${new Date(notification.created_at).toLocaleString('en-US', { dateStyle: 'full', timeStyle: 'short' })}</div>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  requestAnimationFrame(() => {
    modal.querySelector('.notif-modal-overlay').classList.add('show');
    modal.querySelector('.notif-modal-box').classList.add('show');
  });

  const closeModal = () => {
    const overlay = modal.querySelector('.notif-modal-overlay');
    const box = modal.querySelector('.notif-modal-box');
    overlay.classList.remove('show');
    box.classList.remove('show');
    setTimeout(() => modal.remove(), 300);
  };

  modal.querySelector('.notif-modal-close').addEventListener('click', closeModal);
  modal.querySelector('.notif-modal-overlay').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeModal();
  });
  document.addEventListener('keydown', function escHandler(e) {
    if (e.key === 'Escape') {
      closeModal();
      document.removeEventListener('keydown', escHandler);
    }
  });
}

function wireNotificationBell() {
  const bell = $('notificationBell');
  if (!bell) return;

  bell.addEventListener('click', () => {
    requestAnimationFrame(() => {
      const menu = $('notificationMenu');
      if (menu && menu.classList.contains('open')) {
        Notifications.markRead();
      }
    });
  });
}

function initNotificationRealtime() {
  if (!_supabase || typeof _supabase.channel !== 'function') return;
  const userId = Auth.getUser()?.id;
  if (!userId) return;
  try {
    _supabase.channel('user-notifications')
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications' },
        payload => {
          if (payload.new && payload.new.user_id === userId) {
            Notifications.load();
            Toast.show(payload.new.title || 'New notification', payload.new.type || 'info', 4000);
          }
        }
      )
      .subscribe(status => {
        if (status === 'SUBSCRIBED') console.log('[Dashboard] Notification realtime subscribed.');
      });
  } catch (err) {
    console.warn('[Dashboard] Notification realtime error:', err);
  }
}

/* ══════════════════════════════════════════════════════════════
   REALTIME SYNC FOR ADMIN CHANGES
══════════════════════════════════════════════════════════════ */
function initAdminChangeRealtime() {
  if (!_supabase || typeof _supabase.channel !== 'function') return;
  const userId = Auth.getUser()?.id;
  if (!userId) return;

  try {
    const channel = _supabase.channel('dashboard-admin-sync');

    channel.on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${userId}` }, payload => {
      if (payload.new) {
        console.log('[Dashboard] Profile updated via realtime');
        Auth.refreshProfile().then(() => {
          populateUserUI();
          updatePortfolioValue();
          renderWalletSummary();
        });
      }
    });

    channel.on('postgres_changes', { event: '*', schema: 'public', table: 'contracts', filter: `user_id=eq.${userId}` }, () => {
      console.log('[Dashboard] Contracts updated via realtime');
      loadContracts().then(contracts => {
        renderContracts(contracts);
        renderMiningStats(contracts);
        populateDashboardStats(contracts);
        initHashrateChart(contracts);
      });
    });

    channel.on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'transactions', filter: `user_id=eq.${userId}` }, () => {
      console.log('[Dashboard] New transaction via realtime');
      refreshTransactions();
    });

    channel.on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'deposits', filter: `user_id=eq.${userId}` }, () => {
      console.log('[Dashboard] Deposit updated via realtime');
      loadDeposits().then(deps => {
        _allDeposits = deps;
        renderTransactions(_currentTxFilter);
        renderRecentActivity();
      });
    });

    channel.subscribe(status => {
      if (status === 'SUBSCRIBED') console.log('[Dashboard] Admin-sync realtime subscribed.');
    });
  } catch (err) {
    console.warn('[Dashboard] Admin-sync realtime error:', err);
  }
}

/* ══════════════════════════════════════════════════════════════
   MAIN INIT
══════════════════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', async () => {
  const ok = await Auth.init();
  if (!ok) return;

  await populateUserUI();

  wireLogout();
  wireMobileMenu();
  wireDropdowns();
  wireModals();
  wireTransactionFilters();
  wireDepositButtons();
  wireWithdrawButtons();
  wirePlanButtons();
  wireNotificationBell();
  initNotificationRealtime();
  initAdminChangeRealtime();

  initDepositForm();
  await loadPlanCatalog();

  await refreshAll();
  updateBTCPrice();

  BTCPrice.onChange(() => {
    updatePortfolioValue();
    renderTransactions(_currentTxFilter);
  });

  /* Expose globals */
  window.switchTab          = switchTab;
  window.toggleSidebar      = toggleSidebar;
  window.purchasePlan       = purchasePlan;
  window.confirmPurchase    = confirmPurchase;
  window.saveSettings       = saveSettings;
  window.copyToClipboard    = copyToClipboard;
  window.showToast          = showToast;
  window.Toast              = Toast;
  window.BTCPrice           = BTCPrice;
  window.Auth               = Auth;
  window.openModal          = openModal;
  window.closeModal         = closeModal;
  window.openDepositModal   = openDepositModal;
  window.openWithdrawModal  = openWithdrawModal;
  window.approveDeposit     = approveDeposit;
  window.updateBTCPrice     = updateBTCPrice;
  window.openPlanDetailModal  = openPlanDetailModal;
  window.closePlanDetailModal = closePlanDetailModal;
  window.refreshTransactions = async () => {
    _allDeposits     = await loadDeposits();
    _allTransactions = await loadTransactions();
    renderTransactions(_currentTxFilter);
  };

  // Escape key se plan detail modal band karo + timer stop karo
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && $('planDetailModal')?.style.display === 'flex') {
      closePlanDetailModal();
    }
  });

  // Overlay click se bhi timer band karo
  $('planDetailModal')?.addEventListener('click', e => {
    if (e.target === $('planDetailModal')) closePlanDetailModal();
  });

  console.log('CryptoVault dashboard initialized — real data only.');
});

