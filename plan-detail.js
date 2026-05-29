/* ══════════════════════════════════════════════════════════════
   CRYPTOVAULT — plan-detail.js
   Standalone Plan Detail Page with Live Timer
══════════════════════════════════════════════════════════════ */
'use strict';

/* ─── SUPABASE INIT ─────────────────────────────────────── */
const SUPABASE_URL = 'https://fwgqydxkdbuzrehqifjw.supabase.co';
const SUPABASE_KEY = 'sb_publishable_Pbn_Z0wwsqMUyLWYg3udmQ_MC-Qz1kj';
let _supabase = null;

try {
  if (typeof supabase !== 'undefined' && supabase.createClient) {
    _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
  }
} catch (err) {
  console.error('Supabase init failed:', err);
}

/* ─── DOM HELPERS ────────────────────────────────────────── */
function $(id) { return document.getElementById(id); }
function setText(id, val) { const el = $(id); if (el) el.textContent = val; }

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
            id: session.user.id,
            email: session.user.email,
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
      }
      return true;
    } catch (err) {
      console.error('Auth init failed:', err);
      window.location.href = 'login.html';
      return false;
    }
  }

  function getUser() { return _session?.user || null; }
  function getProfile() { return _profile || {}; }

  return { init, getUser, getProfile };
})();

/* ─── BTC PRICE ──────────────────────────────────────────── */
const BTCPrice = (() => {
  let _data = null;
  async function _fetch() {
    try {
      const r = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd&include_24hr_change=true');
      if (r.ok) {
        const j = await r.json();
        _data = { price: j.bitcoin?.usd ?? null, change: j.bitcoin?.usd_24h_change ?? null };
      }
    } catch {}
  }
  _fetch();
  setInterval(_fetch, 60000);
  return {
    get: () => _data?.price ?? null,
    fmt: (n) => n == null ? '—' : '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
  };
})();

/* ─── MINING PAYOUT HELPERS ─────────────────────────────── */
const MINING_MS_PER_DAY = 24 * 60 * 60 * 1000;
const LIVE_HASHRATE_INTERVAL_MS = 5 * 60 * 1000;
const PLAN_CONFIG_FALLBACK = {
  starter:  { priceUsd: 500,   durationDays: 1460, monthlyRate: 0.05, hashrate: 10 },
  silver:   { priceUsd: 2500,  durationDays: 1095, monthlyRate: 0.10, hashrate: 50 },
  gold:     { priceUsd: 5000,  durationDays: 730,  monthlyRate: 0.15, hashrate: 100 },
  platinum: { priceUsd: 10000, durationDays: 365,  monthlyRate: 0.20, hashrate: 300 },
};
let PLAN_CONFIG = { ...PLAN_CONFIG_FALLBACK };

const LIVE_HASHRATE_PRESETS = {
  starter:  { base: 0.6, cap: 2.5, zeroChance: 0.46, boosts: [0.5, 1, 1.5, 2.5, 4] },
  silver:   { base: 0.9, cap: 4.0, zeroChance: 0.40, boosts: [0.5, 1, 2, 3.5, 5] },
  gold:     { base: 1.3, cap: 6.0, zeroChance: 0.34, boosts: [0.5, 1, 2, 4, 6] },
  platinum: { base: 1.7, cap: 8.0, zeroChance: 0.28, boosts: [0.5, 1, 2.5, 5, 8] },
  default:  { base: 0.8, cap: 4.5, zeroChance: 0.40, boosts: [0.5, 1, 2, 3, 5] },
};

function _hashCode(input) {
  let hash = 0;
  const str = String(input || '');
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return hash >>> 0;
}

function _seededRandom(seed) {
  let value = seed >>> 0;
  return function next() {
    value += 0x6D2B79F5;
    let t = value;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function _getLivePreset(contract) {
  const key = normalizePlanKey(contract?.plan || contract?.name);
  return LIVE_HASHRATE_PRESETS[key] || LIVE_HASHRATE_PRESETS.default;
}

function _getLivePhase(refDate = new Date()) {
  const hour = refDate.getHours();
  if (hour >= 6 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 17) return 'afternoon';
  if (hour >= 17 && hour < 22) return 'evening';
  return 'night';
}

function _getDailyTrendPercent(contract, refDate, preset) {
  const config = preset || LIVE_HASHRATE_PRESETS.default;
  const dayBucket = Math.floor(refDate.getTime() / (24 * 60 * 60 * 1000));
  const seed = _hashCode([
    contract.id || contract.user_id || contract.plan || contract.name || 'contract',
    'day',
    dayBucket,
  ].join('|'));
  const rand = _seededRandom(seed);
  const sign = rand() < 0.5 ? -1 : 1;
  const trend = (0.35 + (rand() * 0.95)) * config.base;
  return sign * Math.min(6, trend);
}

function _getPhaseOffsetPercent(contract, refDate, preset) {
  const config = preset || LIVE_HASHRATE_PRESETS.default;
  const phase = _getLivePhase(refDate);
  const hourSeed = _hashCode([
    contract.id || contract.user_id || contract.plan || contract.name || 'contract',
    'phase',
    Math.floor(refDate.getTime() / LIVE_HASHRATE_INTERVAL_MS),
  ].join('|'));
  const rand = _seededRandom(hourSeed);
  const jitter = 0.15 + (rand() * 0.35);

  const phaseMap = {
    night: -0.35,
    morning: 0.15,
    afternoon: 0.30,
    evening: 0.45,
  };

  return (phaseMap[phase] || 0) * config.base * jitter;
}

function _getRareSpikePercent(contract, refDate, preset) {
  const config = preset || LIVE_HASHRATE_PRESETS.default;
  const seed = _hashCode([
    contract.id || contract.user_id || contract.plan || contract.name || 'contract',
    'spike',
    Math.floor(refDate.getTime() / LIVE_HASHRATE_INTERVAL_MS),
  ].join('|'));
  const rand = _seededRandom(seed);
  const chance = 0.025 + (config.base * 0.0035);
  if (rand() > chance) return 0;

  const direction = rand() < 0.5 ? -1 : 1;
  const spike = (2 + (rand() * 5)) * config.base;
  return direction * Math.min(config.cap * 1.5, spike);
}

function _pickLiveHashrateDelta(rand, preset) {
  const config = preset || LIVE_HASHRATE_PRESETS.default;
  const roll = rand();
  if (roll < config.zeroChance) return 0;

  const tierRoll = rand();
  const tierIndex =
    tierRoll < 0.50 ? 0 :
    tierRoll < 0.75 ? 1 :
    tierRoll < 0.90 ? 2 :
    tierRoll < 0.97 ? 3 : 4;
  const boost = config.boosts[Math.min(tierIndex, config.boosts.length - 1)];
  const sign = rand() < 0.5 ? -1 : 1;
  return sign * Math.min(config.cap, config.base * boost);
}

function getLiveHashrateForContract(contract, refDate = new Date()) {
  if (!contract || contract.active !== true || isContractExpired(contract, refDate)) return 0;

  const baseHashrate = Number(contract?.hashrate || getPlanHashrate(contract?.plan || contract?.name, 0) || 0);
  if (!baseHashrate) return 0;

  const bucket = Math.floor(refDate.getTime() / LIVE_HASHRATE_INTERVAL_MS);
  const seed = _hashCode([
    contract.id || contract.user_id || contract.plan || contract.name || 'contract',
    bucket,
  ].join('|'));
  const rand = _seededRandom(seed);
  const preset = _getLivePreset(contract);
  const delta =
    _getDailyTrendPercent(contract, refDate, preset) +
    _getPhaseOffsetPercent(contract, refDate, preset) +
    _pickLiveHashrateDelta(rand, preset) +
    _getRareSpikePercent(contract, refDate, preset);
  return Math.max(0, baseHashrate * (1 + (delta / 100)));
}

function getLiveHashrateMovementForContract(contract, refDate = new Date()) {
  const baseHashrate = Number(contract?.hashrate || getPlanHashrate(contract?.plan || contract?.name, 0) || 0);
  const liveHashrate = getLiveHashrateForContract(contract, refDate);
  const delta = liveHashrate - baseHashrate;
  const deltaPct = baseHashrate > 0 ? (delta / baseHashrate) * 100 : 0;
  const direction = deltaPct > 0.04 ? 'up' : deltaPct < -0.04 ? 'down' : 'flat';
  return { baseHashrate, liveHashrate, delta, deltaPct, direction };
}

function normalizePlanKey(planName) {
  return String(planName || '').trim().toLowerCase();
}
function normalizeMonthlyRate(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n > 1 ? n / 100 : n;
}
function getPlanConfig(planName) {
  return PLAN_CONFIG[normalizePlanKey(planName)] || null;
}
function getPlanPriceFromSource(source, fallback = null) {
  const price = Number(source?.priceUsd ?? source?.plan_price ?? source?.price ?? fallback);
  return Number.isFinite(price) && price > 0 ? price : null;
}
function getPlanMonthlyRateFromSource(source, fallback = null) {
  return normalizeMonthlyRate(source?.monthlyRate ?? source?.monthly_return_pct ?? source?.monthly_return ?? fallback);
}
function getPlanDurationFromSource(source, fallback = null) {
  const days = Number(source?.durationDays ?? source?.duration_days ?? fallback);
  return Number.isFinite(days) && days > 0 ? Math.floor(days) : null;
}
function getPlanPriceUsd(planName, fallbackPrice = null) {
  return getPlanPriceFromSource(getPlanConfig(planName), fallbackPrice);
}
function getPlanMonthlyRate(planName, fallbackRate = null) {
  return getPlanMonthlyRateFromSource(getPlanConfig(planName), fallbackRate) ?? 0;
}
function getPlanDurationDays(planName, fallbackDays = null) {
  return getPlanDurationFromSource(getPlanConfig(planName), fallbackDays) ?? 0;
}
function getPlanHashrate(planName, fallbackHashrate = null) {
  const plan = getPlanConfig(planName);
  return Number.isFinite(Number(plan?.hashrate ?? fallbackHashrate)) ? Number(plan?.hashrate ?? fallbackHashrate) : null;
}
function getDaysInCurrentMonth(refDate = new Date()) {
  return new Date(refDate.getFullYear(), refDate.getMonth() + 1, 0).getDate();
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
function getPlanDurationDaysFromContract(contract) {
  return getPlanDurationDays(contract?.plan || contract?.name);
}
function getDailyProfitUsdt(contract) {
  const daily = Number(contract?.daily_profit);
  if (Number.isFinite(daily) && daily > 0) return daily;
  const planName = contract?.plan || contract?.name || '';
  const planPrice = Number(contract?.plan_price || 0) || getPlanPriceUsd(planName, 0);
  const rate = getPlanMonthlyRate(planName, 0);
  return planPrice > 0 && rate > 0 ? (planPrice * rate) / 30 : 0;
}
function getMonthlyProfitUsdt(contract, refDate = new Date()) {
  const planName = contract?.plan || contract?.name || '';
  const planPrice = Number(contract?.plan_price || 0) || getPlanPriceUsd(planName, 0);
  if (planPrice > 0) return planPrice * getPlanMonthlyRate(planName, 0);
  return getDailyProfitUsdt(contract) * getDaysInCurrentMonth(refDate);
}
function getContractDurationDays(contract) {
  return getPlanDurationDaysFromContract(contract);
}
function getContractExpiryDate(contract) {
  const durationDays = getContractDurationDays(contract);
  if (!durationDays) return null;
  const createdAt = new Date(contract?.created_at || Date.now());
  return new Date(createdAt.getTime() + durationDays * MINING_MS_PER_DAY);
}
function getContractRemainingDays(contract, refDate = new Date()) {
  const expiry = getContractExpiryDate(contract);
  if (!expiry) return null;
  const remainingMs = expiry.getTime() - refDate.getTime();
  if (remainingMs <= 0) return 0;
  return Math.max(1, Math.ceil(remainingMs / MINING_MS_PER_DAY));
}
function isContractExpired(contract, refDate = new Date()) {
  const expiry = getContractExpiryDate(contract);
  return !!expiry && refDate.getTime() >= expiry.getTime();
}
function getContractProgressPercent(contract, refDate = new Date()) {
  const durationDays = getContractDurationDays(contract);
  if (!durationDays) return Math.min(100, Math.max(0, Number(contract?.progress || 0)));
  const createdAt = new Date(contract?.created_at || Date.now());
  const elapsedDays = Math.max(0, (refDate.getTime() - createdAt.getTime()) / MINING_MS_PER_DAY);
  return Math.min(100, Math.max(0, (elapsedDays / durationDays) * 100));
}
function getPayoutAnchorDate(contract) {
  const createdAt = new Date(contract?.created_at || Date.now());
  if (contract?.last_payout_at) return new Date(contract.last_payout_at);
  return createdAt;
}
function getNextPayoutDate(contract) {
  if (contract?.next_payout_at) {
    const next = new Date(contract.next_payout_at);
    if (Number.isFinite(next.getTime())) return next;
  }
  return new Date(getPayoutAnchorDate(contract).getTime() + MINING_MS_PER_DAY);
}

async function loadPlanCatalog() {
  if (!_supabase) return PLAN_CONFIG;
  try {
    const { data, error } = await _supabase.from('plans').select('*');
    if (error || !Array.isArray(data) || !data.length) return PLAN_CONFIG;
    const next = { ...PLAN_CONFIG_FALLBACK };
    data.forEach(row => {
      const key = normalizePlanKey(row?.name || row?.plan_name || row?.title || row?.slug);
      if (!key) return;
      next[key] = {
        ...next[key],
        priceUsd: getPlanPriceFromSource(row, next[key]?.priceUsd) ?? next[key]?.priceUsd,
        durationDays: getPlanDurationFromSource(row, next[key]?.durationDays) ?? next[key]?.durationDays,
        monthlyRate: getPlanMonthlyRateFromSource(row, next[key]?.monthlyRate) ?? next[key]?.monthlyRate,
        hashrate: Number(row?.hashrate ?? row?.hash_rate ?? next[key]?.hashrate ?? 0) || next[key]?.hashrate,
      };
    });
    PLAN_CONFIG = next;
  } catch (err) {
    console.warn('[PlanDetail] loadPlanCatalog failed:', err.message);
  }
  return PLAN_CONFIG;
}

function getPlanMonthlyRateFromSource(source, fallback = null) {
  return normalizeMonthlyRate(source?.monthlyRate ?? source?.plan_monthly_rate ?? source?.monthly_return_pct ?? source?.monthly_return ?? fallback);
}

function getContractIdFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get('contract');
}

async function loadContractData() {
  const contractId = getContractIdFromUrl();
  if (!contractId) {
    Toast.show('No contract specified', 'error');
    setTimeout(() => window.location.href = 'dashboard.html', 2000);
    return null;
  }

  const user = Auth.getUser();
  if (!user || !_supabase) return null;

  const { data, error } = await _supabase
    .from('contracts')
    .select('*')
    .eq('id', contractId)
    .eq('user_id', user.id)
    .single();

  if (error || !data) {
    Toast.show('Contract not found', 'error');
    setTimeout(() => window.location.href = 'dashboard.html', 2000);
    return null;
  }

  return data;
}

let _timerInterval = null;
let _refreshInterval = null;

function renderPage(contract) {
  if (!contract) return;

  const planName = contract.plan || contract.name || 'Mining Contract';
  const movement = getLiveHashrateMovementForContract(contract);
  const liveHashrate = getLiveHashrateForContract(contract);
  const hashrate = liveHashrate > 0 ? liveHashrate.toFixed(1) : '—';
  const expired = isContractExpired(contract);
  const dailyProfit = expired ? 0 : getDailyProfitUsdt(contract);
  const dailyProfitStr = formatUsdtDaily(dailyProfit);
  const progress = getContractProgressPercent(contract);
  const remainingDays = getContractRemainingDays(contract);
  const daysLeft = remainingDays != null ? remainingDays : '∞';
  const durationDays = getContractDurationDays(contract);

  const startDate = contract.created_at ? new Date(contract.created_at) : new Date();
  const startDateStr = startDate.toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' });
  const startTimeStr = startDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

  const now = new Date();
  const msPerDay = MINING_MS_PER_DAY;
  const elapsedMs = now - startDate;
  const planDailyProfit = getDailyProfitUsdt(contract);
  const daysActive = Math.max(0, Math.min(elapsedMs / msPerDay, durationDays || elapsedMs / msPerDay));
  const payoutDays = durationDays > 0 ? Math.min(daysActive, durationDays) : daysActive;
  const totalEarned = Number.isFinite(Number(contract.total_earned))
    ? Number(contract.total_earned)
    : planDailyProfit * payoutDays;
  const totalEarnedStr = formatUsdtDaily(totalEarned);
  const dailyProfitUSD = '$ ' + dailyProfit.toFixed(2) + ' USDT';
  const projectedMonthly = getMonthlyProfitUsdt(contract);
  const projectedMonthlyStr = formatUsdtDaily(projectedMonthly);
  const durationLabel = durationDays ? durationDays + ' Days' : '—';

  setText('planHeroName', planName + ' Plan');
  setText('planHeroEarned', totalEarnedStr);
  setText('planStartDate', startDateStr);
  setText('planStartTime', startTimeStr);
  setText('planDaysActive', Math.floor(daysActive));
  setText('planDaysLeft', daysLeft === '∞' ? 'Unlimited' : daysLeft + ' days');
  setText('planHashrate', hashrate + ' TH/s');
  setText('planTimerAmount', dailyProfitStr);
  setText('planTimerUSD', 'You will receive this amount daily');
  setText('planProgressBadge', progress.toFixed(0) + '%');
  const bar = $('planProgressBar');
  if (bar) bar.style.width = progress + '%';
  setText('planProgressText', progress.toFixed(0) + '% Complete · ' + hashrate + ' TH/s');
  setText('planDailyEarnings', dailyProfitStr);
  setText('planDailyEarningsUSD', 'Duration: ' + durationLabel + ' · Estimated daily reward: ' + dailyProfitUSD);
  setText('planChartTotal', totalEarnedStr);
  setText('planChartAvg', dailyProfitStr);
  setText('planChartMonthly', projectedMonthlyStr);
  setText('infoPlanName', planName);
  setText('infoContractId', contract.id);
  setText('infoStartDate', startDateStr + ' at ' + startTimeStr);
  setText('infoDuration', durationLabel);
  setText('infoHashrate', hashrate + ' TH/s');
  setText('infoDailyProfit', dailyProfitStr + ' / day');
  setText('infoStatus', expired ? '● Expired' : (contract.active ? '● Active' : '● Inactive'));
  updatePlanHashrateTrend(movement);

  if (_timerInterval) clearInterval(_timerInterval);
  _timerInterval = setInterval(() => updateTimer(contract), 1000);
  updateTimer(contract);
  drawEarningsChart(contract);
}

function updatePlanHashrateTrend(movement) {
  const el = $('planHashrateTrend');
  if (!el) return;

  if (!movement?.baseHashrate) {
    el.textContent = 'Live';
    el.className = 'stat-change up';
    return;
  }

  const pct = Math.abs(Number(movement.deltaPct || 0));
  const arrow = movement.direction === 'down' ? '▼' : movement.direction === 'up' ? '▲' : '•';
  el.textContent = movement.direction === 'flat' ? 'Stable' : `${arrow} ${pct.toFixed(2)}%`;
  el.className = 'stat-change ' + (movement.direction === 'down' ? 'down' : 'up');
}

function formatUsdtDaily(amount) {
  return amount > 0 ? '$ ' + amount.toFixed(2) + ' USDT' : '—';
}

function updateTimer(contract) {
  if (isContractExpired(contract)) {
    const timerEl = $('planDetailTimer');
    if (timerEl) timerEl.textContent = '00:00:00';
    return;
  }

  const nextPayout = getNextPayoutDate(contract);
  const timeUntil = Math.max(0, nextPayout - new Date());
  const hours = Math.floor(timeUntil / (60 * 60 * 1000));
  const minutes = Math.floor((timeUntil % (60 * 60 * 1000)) / (60 * 1000));
  const seconds = Math.floor((timeUntil % (60 * 1000)) / 1000);
  const display =
    String(hours).padStart(2, '0') + ':' +
    String(minutes).padStart(2, '0') + ':' +
    String(seconds).padStart(2, '0');

  setText('planTimerDisplay', display);
  setText('planTimerHours', hours);
}

async function refreshCurrentContract(contractId) {
  const fresh = await loadContractData();
  if (fresh && fresh.id === contractId) {
    renderPage(fresh);
    return fresh;
  }
  return null;
}

function drawEarningsChart(contract) {
  const canvas = $('planEarningsChart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const w = canvas.width = canvas.offsetWidth || 800;
  const h = canvas.height = 200;

  const start = new Date(contract.created_at || Date.now());
  const now = new Date();
  const durationDays = getContractDurationDays(contract);
  const days = Math.min(durationDays > 0 ? durationDays : 30, Math.min(30, Math.ceil((now - start) / MINING_MS_PER_DAY)));
  const dailyProfit = getDailyProfitUsdt(contract);

  if (days <= 0 || dailyProfit <= 0) {
    ctx.fillStyle = '#475569';
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('No earnings data yet', w / 2, h / 2);
    return;
  }

  const data = Array.from({ length: days }, (_, i) => dailyProfit * (i + 1));
  const max = Math.max(...data);
  const min = 0;
  const range = max - min || 0.0000001;
  const getX = i => (i / (data.length - 1)) * (w - 60) + 30;
  const getY = v => h - 30 - ((v - min) / range) * (h - 60);

  const gradient = ctx.createLinearGradient(0, 0, 0, h);
  gradient.addColorStop(0, 'rgba(245,158,11,0.25)');
  gradient.addColorStop(1, 'rgba(0,0,0,0)');

  ctx.beginPath();
  ctx.moveTo(getX(0), h - 30);
  data.forEach((v, i) => ctx.lineTo(getX(i), getY(v)));
  ctx.lineTo(getX(data.length - 1), h - 30);
  ctx.closePath();
  ctx.fillStyle = gradient;
  ctx.fill();

  ctx.beginPath();
  ctx.strokeStyle = '#f59e0b';
  ctx.lineWidth = 2.5;
  ctx.lineJoin = 'round';
  data.forEach((v, i) => { i === 0 ? ctx.moveTo(getX(i), getY(v)) : ctx.lineTo(getX(i), getY(v)); });
  ctx.stroke();
}

async function populateUserUI() {
  const user = Auth.getUser();
  const profile = Auth.getProfile();
  const email = user?.email || '';
  const name = profile.name || email.split('@')[0] || 'User';
  const initial = name.charAt(0).toUpperCase();
  document.querySelectorAll('.user-avatar-display').forEach(el => { el.textContent = initial; });
  document.querySelectorAll('.user-name-display').forEach(el => { el.textContent = name; });
  document.querySelectorAll('.user-email-display').forEach(el => { el.textContent = email; });
}

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

function wireLogout() {
  document.querySelectorAll('[data-logout]').forEach(el => {
    el.addEventListener('click', async e => {
      e.preventDefault();
      try { if (_supabase) await _supabase.auth.signOut(); } catch {}
      window.location.href = 'login.html';
    });
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  await loadPlanCatalog();
  const ok = await Auth.init();
  if (!ok) return;

  await populateUserUI();
  wireDropdowns();
  wireLogout();

  let contract = await loadContractData();
  if (contract) {
    const user = Auth.getUser();
    if (user && _supabase) {
      const { data: txns } = await _supabase
        .from('transactions')
        .select('amount,type,created_at')
        .eq('user_id', user.id)
        .in('type', ['mining', 'mining_reward', 'reward']);
      void txns;
    }
    renderPage(contract);
    if (_refreshInterval) clearInterval(_refreshInterval);
    _refreshInterval = setInterval(async () => {
      const fresh = await loadContractData();
      if (fresh) renderPage(fresh);
    }, 60000);
  }

  window.toggleSidebar = toggleSidebar;
  window.updateTimer = updateTimer;
});
