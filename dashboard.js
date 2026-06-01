/* ══════════════════════════════════════════════════════════════
   CRYPTOVAULT — dashboard.js
   Premium Vanilla JS · Production Ready
══════════════════════════════════════════════════════════════ */
'use strict';

/* ─── SUPABASE INIT ─────────────────────────────────────── */
const SUPABASE_URL = 'https://fwgqydxkdbuzrehqifjw.supabase.co';
const SUPABASE_KEY = 'sb_publishable_Pbn_Z0wwsqMUyLWYg3udmQ_MC-Qz1kj';
let _supabase = null;
const AUTH_IDLE_TIMEOUT_MS = 30 * 60 * 1000;

function _assertSafePublicKey(key) {
  const token = String(key || '').trim();
  if (!token || /service_role/i.test(token) || /^sb_secret_/i.test(token)) {
    throw new Error('Unsafe Supabase key configuration.');
  }
  return token;
}

try {
  if (typeof supabase !== 'undefined' && supabase.createClient) {
    _supabase = supabase.createClient(SUPABASE_URL, _assertSafePublicKey(SUPABASE_KEY));
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

function renderReferralDetailsRows(rows = []) {
  const body = $('referralDetailsBody');
  if (!body) return;

  if (!Array.isArray(rows) || !rows.length) {
    body.innerHTML = '<tr><td colspan="6" style="padding:16px 10px;color:var(--text-muted);">No referred users found yet.</td></tr>';
    return;
  }

  body.innerHTML = rows.map((row) => {
    const profileUserCode = String(row?.user_code ?? row?.user_id ?? row?.ref_code ?? '').trim();
    const userId = profileUserCode ? escapeHtml(profileUserCode) : 'Profile pending';
    const email = row?.email ? escapeHtml(String(row.email)) : 'Profile pending';
    const wallet = Number(row?.wallet_balance || 0);
    const contractCount = Number(row?.contract_count || 0);
    const contractPlanRaw = String(row?.contract_plan || '').trim();
    const contractPlan = contractPlanRaw
      ? contractPlanRaw
          .split(',')
          .map((part) => {
            const token = String(part || '').trim();
            const match = token.match(/^([a-zA-Z]+)\s+(\d+)$/);
            if (match) return `${match[1].charAt(0).toUpperCase()}${match[1].slice(1).toLowerCase()} ${match[2]}`;
            return token.charAt(0).toUpperCase() + token.slice(1);
          })
          .join(', ')
      : (contractCount > 0 ? `${contractCount} Contract${contractCount === 1 ? '' : 's'}` : 'No Contract');
    const isActive = row?.id_active === true;
    const earning = Number(row?.referral_earning || 0);
    return `
      <tr style="border-bottom:1px solid rgba(30,45,69,0.45);">
        <td style="padding:12px 10px;font-size:13px;color:var(--text-primary);">${userId}</td>
        <td style="padding:12px 10px;font-size:13px;color:var(--text-primary);">${email}</td>
        <td style="padding:12px 10px;font-size:13px;color:var(--green);">$ ${wallet.toFixed(2)} USDT</td>
        <td style="padding:12px 10px;font-size:13px;color:var(--text-primary);">${escapeHtml(contractPlan)}</td>
        <td style="padding:12px 10px;font-size:13px;color:${isActive ? 'var(--green)' : 'var(--red)'};font-weight:600;">${isActive ? 'Active' : 'Inactive'}</td>
        <td style="padding:12px 10px;font-size:13px;color:var(--gold);font-weight:600;">$ ${earning.toFixed(2)} USDT</td>
      </tr>
    `;
  }).join('');
}

async function loadReferralDetails() {
  if (!_supabase) return [];
  try {
    const user = Auth.getUser?.();
    const { data, error } = await _supabase.rpc('get_referral_details_for_referrer', {
      p_referrer_id: user?.id || null,
    });
    if (error) {
      console.warn('[Referral] get_referral_details_for_referrer failed:', error.message);
      return await loadReferralDetailsFallback();
    }
    if (Array.isArray(data) && data.length) return await enrichReferralUserCodes(data);
    return await loadReferralDetailsFallback();
  } catch (err) {
    console.warn('[Referral] referral details load failed:', err?.message || err);
    return await loadReferralDetailsFallback();
  }
}

async function enrichReferralUserCodes(rows = []) {
  try {
    if (!_supabase || !Array.isArray(rows) || !rows.length) return rows || [];
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    const targets = rows
      .filter(r => {
        const code = String(r?.user_code ?? r?.user_id ?? '').trim();
        return !!r?.referred_user_id && (!code || UUID_RE.test(code));
      })
      .map(r => r.referred_user_id);
    if (!targets.length) return rows;

    const { data: profiles, error } = await _supabase
      .from('profiles')
      .select('id, user_id, ref_code')
      .in('id', targets);
    if (error || !Array.isArray(profiles) || !profiles.length) return rows;

    const byId = Object.fromEntries(profiles.map(p => [p.id, String(p?.user_id || p?.ref_code || '').trim()]));
    return rows.map(r => ({
      ...r,
      user_code: byId[r?.referred_user_id] || String(r?.user_code ?? r?.user_id ?? '').trim() || null,
    }));
  } catch {
    return rows || [];
  }
}

async function loadReferralDetailsFallback() {
  try {
    const user = Auth.getUser?.();
    if (!user?.id || !_supabase) return [];

    const { data: refs, error: refErr } = await _supabase
      .from('referrals')
      .select('referred_user_id, earnings, created_at')
      .eq('referrer_id', user.id)
      .order('created_at', { ascending: false });
    if (refErr || !Array.isArray(refs) || !refs.length) {
      if (refErr) console.warn('[Referral] fallback referrals query failed:', refErr.message);
      return [];
    }

    const referredIds = refs
      .map(r => r?.referred_user_id)
      .filter(Boolean);

    let profilesById = {};
    if (referredIds.length) {
      const { data: profiles, error: profErr } = await _supabase
        .from('profiles')
        .select('id, user_id, email, usdt_balance, created_at')
        .in('id', referredIds);
      if (profErr) {
        console.warn('[Referral] fallback profiles query failed:', profErr.message);
      } else {
        profilesById = Object.fromEntries((profiles || []).map(p => [p.id, p]));
      }
    }

    let contractsByUser = {};
    if (referredIds.length) {
      const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      const uuidKeys = Array.from(new Set(
        referredIds.map(id => String(id).trim()).filter(id => UUID_RE.test(id))
      ));
      const { data: contracts, error: ctrErr } = await _supabase
        .from('contracts')
        .select('user_id, active, plan, created_at')
        .in('user_id', uuidKeys);
      if (ctrErr) {
        console.warn('[Referral] fallback contracts query failed:', ctrErr.message);
      } else {
        contractsByUser = (contracts || []).reduce((acc, c) => {
          const key = String(c?.user_id || '').trim();
          if (!key) return acc;
          if (!acc[key]) acc[key] = { contract_count: 0, id_active: false, contract_plan: null, plan_counts: {} };
          acc[key].contract_count += 1;
          acc[key].id_active = acc[key].id_active || c?.active === true;
          const planKey = String(c?.plan || '').trim().toLowerCase();
          if (planKey) acc[key].plan_counts[planKey] = Number(acc[key].plan_counts[planKey] || 0) + 1;
          return acc;
        }, {});
        Object.keys(contractsByUser).forEach((key) => {
          const planCounts = contractsByUser[key]?.plan_counts || {};
          const parts = Object.entries(planCounts)
            .sort((a, b) => {
              if (b[1] !== a[1]) return b[1] - a[1];
              return String(a[0]).localeCompare(String(b[0]));
            })
            .map(([planName, count]) => `${planName} ${count}`);
          contractsByUser[key].contract_plan = parts.length ? parts.join(', ') : null;
        });
      }
    }

    return refs.map(r => {
      const uid = r?.referred_user_id;
      const p = profilesById[uid] || null;
      const profileCode = String(p?.user_id || '').trim();
      const c = contractsByUser[String(uid)] || contractsByUser[profileCode] || { contract_count: 0, id_active: false, contract_plan: null };
      return {
        referred_user_id: uid,
        user_code: String(p?.user_id || p?.ref_code || '').trim() || null,
        email: p?.email || null,
        wallet_balance: Number(p?.usdt_balance || 0),
        contract_count: Number(c.contract_count || 0),
        contract_plan: c.contract_plan || null,
        id_active: c.id_active === true,
        referral_earning: Number(r?.earnings || 0),
      };
    });
  } catch (err) {
    console.warn('[Referral] fallback load failed:', err?.message || err);
    return [];
  }
}

function sumReferralEarnings(rows = []) {
  return (Array.isArray(rows) ? rows : []).reduce((sum, row) => {
    return sum + Number(row?.referral_earning ?? row?.earnings ?? 0);
  }, 0);
}

function getCurrentMonthStartISO() {
  const start = new Date();
  start.setDate(1);
  start.setHours(0, 0, 0, 0);
  return start.toISOString();
}

async function loadCurrentMonthReferralEarnings(userId) {
  if (!userId || !_supabase) return 0;

  try {
    const { data, error } = await _supabase
      .from('transactions')
      .select('amount')
      .eq('user_id', userId)
      .eq('type', 'referral')
      .gte('created_at', getCurrentMonthStartISO());

    if (error) {
      console.warn('[Referral] monthly referral earnings query failed:', error.message);
      return 0;
    }

    return (Array.isArray(data) ? data : []).reduce((sum, row) => {
      return sum + Number(row?.amount || 0);
    }, 0);
  } catch (err) {
    console.warn('[Referral] monthly referral earnings load failed:', err?.message || err);
    return 0;
  }
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
const LIVE_HASHRATE_INTERVAL_MS = 5 * 60 * 1000;
const PLAN_CONFIG_FALLBACK = {
  starter:  { priceUsd: 500,   hashrate: 10,  durationDays: 1460, monthlyRate: 0.10, icon: '🌱', color: 'var(--green)' },
  silver:   { priceUsd: 2500,  hashrate: 50,  durationDays: 1095, monthlyRate: 0.15, icon: '🥈', color: 'var(--blue)' },
  gold:     { priceUsd: 5000,  hashrate: 100, durationDays: 730,  monthlyRate: 0.20, icon: '🥇', color: 'var(--gold)' },
  platinum: { priceUsd: 10000, hashrate: 300, durationDays: 365,  monthlyRate: 0.25, icon: '💎', color: 'var(--purple)' },
};

let PLAN_CONFIG = { ...PLAN_CONFIG_FALLBACK };
const PLAN_MONTHLY_RATE_LOCK = {
  starter: 0.10,
  silver: 0.15,
  gold: 0.20,
  platinum: 0.25,
};
let _latestContracts = [];
let _liveHashrateAlignTimer = null;
let _liveHashrateRefreshTimer = null;
let _earningsChartDays = 12;

const LIVE_HASHRATE_PRESETS = {
  starter:  { base: 0.6, cap: 2.5, zeroChance: 0.46, boosts: [0.5, 1, 1.5, 2.5, 4] },
  silver:   { base: 0.9, cap: 4.0, zeroChance: 0.40, boosts: [0.5, 1, 2, 3.5, 5] },
  gold:     { base: 1.3, cap: 6.0, zeroChance: 0.34, boosts: [0.5, 1, 2, 4, 6] },
  platinum: { base: 1.7, cap: 8.0, zeroChance: 0.28, boosts: [0.5, 1, 2.5, 5, 8] },
  default:  { base: 0.8, cap: 4.5, zeroChance: 0.40, boosts: [0.5, 1, 2, 3, 5] },
};

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
  const nextPayout = contract?.next_payout_at ? new Date(contract.next_payout_at) : null;
  if (nextPayout && Number.isFinite(nextPayout.getTime()) && nextPayout.getTime() > refDate.getTime()) {
    const remainingMs = nextPayout.getTime() - refDate.getTime();
    return Math.max(1, Math.ceil(remainingMs / PLAN_MS_PER_DAY));
  }
  if (!durationDays) return null;
  const createdAt = new Date(contract?.created_at || Date.now());
  const elapsedDays = Math.max(0, (refDate.getTime() - createdAt.getTime()) / PLAN_MS_PER_DAY);
  const remaining = durationDays - elapsedDays;
  if (remaining <= 0) return 0;
  return Math.max(1, Math.ceil(remaining));
}

function isContractExpired(contract, refDate = new Date()) {
  if (!contract) return true;
  if (contract.active === false) return true;
  const nextPayout = contract?.next_payout_at ? new Date(contract.next_payout_at) : null;
  if (contract.active === true && !nextPayout) return false;
  if (nextPayout && Number.isFinite(nextPayout.getTime()) && nextPayout.getTime() > refDate.getTime()) {
    return false;
  }
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

  const baseHashrate = getContractHashrate(contract);
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

function getLiveHashrateSummary(contracts = [], refDate = new Date()) {
  const activeContracts = (contracts || []).filter(c => c?.active === true && !isContractExpired(c, refDate));
  const count = activeContracts.length;
  const totalHashrate = activeContracts.reduce((sum, contract) => sum + getLiveHashrateForContract(contract, refDate), 0);
  const totalPower = totalHashrate * 32;
  const dailyProfit = activeContracts.reduce((sum, contract) => sum + getContractDailyProfitUsd(contract), 0);
  const monthlyProjection = dailyProfit * 30;
  const efficiency = totalHashrate > 0 ? (dailyProfit / totalHashrate) : 0;
  return { activeContracts, count, totalHashrate, totalPower, dailyProfit, monthlyProjection, efficiency };
}

function getStaticMiningSummary(contracts = [], refDate = new Date()) {
  const activeContracts = (contracts || []).filter(c => c?.active === true && !isContractExpired(c, refDate));
  const count = activeContracts.length;
  const totalHashrate = activeContracts.reduce((sum, contract) => sum + getContractHashrate(contract), 0);
  const totalPower = totalHashrate * 32;
  const dailyProfit = activeContracts.reduce((sum, contract) => sum + getContractDailyProfitUsd(contract), 0);
  const monthlyProjection = dailyProfit * 30;
  const efficiency = totalHashrate > 0 ? (dailyProfit / totalHashrate) : 0;
  return { activeContracts, count, totalHashrate, totalPower, dailyProfit, monthlyProjection, efficiency };
}

function getLiveHashrateMovement(contracts = [], refDate = new Date()) {
  const live = getLiveHashrateSummary(contracts, refDate);
  const base = getStaticMiningSummary(contracts, refDate);
  const delta = live.totalHashrate - base.totalHashrate;
  const deltaPct = base.totalHashrate > 0 ? (delta / base.totalHashrate) * 100 : 0;
  const direction = deltaPct > 0.04 ? 'up' : deltaPct < -0.04 ? 'down' : 'flat';
  return { live, base, delta, deltaPct, direction };
}

function getLiveHashrateSeries(contracts = [], points = 24, refDate = new Date()) {
  const safePoints = Math.max(2, points);
  const series = [];
  const nowBucket = Math.floor(refDate.getTime() / LIVE_HASHRATE_INTERVAL_MS);

  for (let offset = safePoints - 1; offset >= 0; offset--) {
    const sampleDate = new Date((nowBucket - offset) * LIVE_HASHRATE_INTERVAL_MS);
    const sampleSummary = getLiveHashrateSummary(contracts, sampleDate);
    series.push(sampleSummary.totalHashrate);
  }

  return series;
}

function getMiningSummary(contracts = [], refDate = new Date()) {
  return getLiveHashrateSummary(contracts, refDate);
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
        monthlyRate: PLAN_MONTHLY_RATE_LOCK[key] ?? (getPlanMonthlyRateFromSource(row, next[key]?.monthlyRate) ?? next[key]?.monthlyRate),
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

  async function _resolveReferrerId(user) {
    const meta = user?.user_metadata || {};
    if (meta.referrer_id) return meta.referrer_id;
    if (_profile?.referred_by) return _profile.referred_by;
    if (_profile?.referred_by_user_id) return _profile.referred_by_user_id;
    if (_profile?.referrer_id) return _profile.referrer_id;

    const refCode = String(meta.referrer_code || '').trim().toUpperCase();
    if (!refCode || !_supabase) return null;
    const { data: refProfile, error } = await _supabase
      .from('profiles')
      .select('id')
      .eq('ref_code', refCode)
      .maybeSingle();
    if (error) {
      console.warn('[Referral] code lookup failed:', error.message);
      return null;
    }
    return refProfile?.id || null;
  }

  async function _ensureReferralLinkFromMetadata(user) {
    const referredUserId = user?.id;
    const referrerId = await _resolveReferrerId(user);
    if (!_supabase || !referredUserId || !referrerId || referrerId === referredUserId) return;
    try {
      const { data: existing } = await _supabase
        .from('referrals')
        .select('id')
        .eq('referrer_id', referrerId)
        .eq('referred_user_id', referredUserId)
        .maybeSingle();
      if (existing) return;

      const { data: createdOk, error: insertErr } = await _supabase.rpc('create_referral_link', {
        p_referrer_id: referrerId,
        p_referred_user_id: referredUserId,
        p_referral_code: String(user?.user_metadata?.referrer_code || '').trim().toUpperCase() || null,
      });
      if (insertErr || createdOk === false) {
        console.warn('[Referral] insert failed:', insertErr?.message || 'returned false', insertErr || createdOk);
        return;
      }

      const { data: refProf } = await _supabase
        .from('profiles')
        .select('ref_count')
        .eq('id', referrerId)
        .maybeSingle();
      const nextCount = (Number(refProf?.ref_count) || 0) + 1;
      await _supabase.from('profiles').update({ ref_count: nextCount }).eq('id', referrerId);
    } catch (err) {
      console.warn('[Referral] metadata backfill failed:', err?.message || err);
    }
  }

  async function init() {
    if (!_supabase || !_roleAuth) { window.location.replace('login.html'); return false; }
    try {
      const { session, role } = await _roleAuth.getSessionWithRole(_supabase);
      if (!session) { window.location.replace('login.html'); return false; }
      if (!session?.user?.email_confirmed_at) { await _supabase.auth.signOut(); window.location.replace('login.html'); return false; }
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

      await _ensureReferralLinkFromMetadata(session.user);

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

async function loadWithdrawals() {
  const user = Auth.getUser();
  if (!user || !_supabase) return [];
  const { data, error } = await _supabase
    .from('withdrawals')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });
  if (error) { console.error('loadWithdrawals:', error); return []; }
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

function buildDepositHistoryRows() {
  return (_allDeposits || []).map(d => {
    const amount = Math.abs(Number(d?.amount || 0));
    const normalizedStatus = String(d?.status || 'success').toLowerCase();
    return {
      desc:   normalizedStatus === 'pending' ? 'Deposit (Pending)' : 'Deposit',
      coin:   'USDT',
      amount:  '+' + amount.toFixed(2) + ' USDT',
      usd:     '+$' + amount.toFixed(2),
      status:  normalizedStatus,
      date:    _fmtDate(d?.created_at),
      type:    'deposit',
      createdAt: d?.created_at || '',
      _source: 'deposit',
      _signature: [
        'deposit',
        amount.toFixed(2),
        String(d?.created_at || '').slice(0, 16),
      ].join('|'),
    };
  });
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
  setText('walletUSDTBalance',    usdtBalance.toFixed(2) + ' USDT');
  setText('portfolioBTCusd',      walletDisplay);
  setText('portfolioSubLabel',    '≈ ' + usdtBalance.toFixed(2) + ' USDT');
  setText('usdtBalanceEl',        usdtBalance.toFixed(2) + ' USDT');

  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? 'Good Morning! 👋' :
    hour < 17 ? 'Good Afternoon! 👋' :
                'Good Evening! 👋';
  setText('dashboardGreeting', greeting);
  setText('dashboardWelcomeText', `Here is what is happening with your mining today, ${name}.`);
  setText('dashboardHeroStatus', profile?.usdt_balance > 0 ? 'Earning' : 'Live');

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

  // Referral stats update (source of truth: referrals table)
  let referralCount = Number(profile.ref_count) || 0;
  let refEarnings = 0;
  let refMonthEarnings = 0;
  if (_supabase && user?.id) {
    try {
      const { data: refs } = await _supabase
        .from('referrals')
        .select('id')
        .eq('referrer_id', user.id);
      if (Array.isArray(refs)) {
        referralCount = refs.length;
      }
    } catch {}
  }
  const referralDetails = await loadReferralDetails();
  refEarnings = sumReferralEarnings(referralDetails);
  refMonthEarnings = await loadCurrentMonthReferralEarnings(user?.id);
  setText('refCountEl', referralCount);
  setText('refEarningsEl', '$ ' + refEarnings.toFixed(2) + ' USDT');
  setText('refMonthEl', '$ ' + refMonthEarnings.toFixed(2) + ' USDT');
  const activeReferrals = referralDetails.filter(row => row?.id_active === true).length;
  setText('activeRefEl', activeReferrals);
  renderReferralDetailsRows(referralDetails);

  const sName  = $('settingName');
  const sEmail = $('settingEmail');
  const sUserId = $('settingUserId');
  const sCountry = $('settingCountry');
  if (sName)  sName.value  = profile.name  || '';
  if (sEmail) sEmail.value = email;
  if (sUserId) sUserId.value = profile.user_id || profile.ref_code || profile.id || user?.id || '—';
  if (sCountry) {
    const currentCountry = String(profile.country || '').trim();
    if (currentCountry) {
      const match = [...sCountry.options].some(opt => String(opt.value || opt.textContent || '').trim().toLowerCase() === currentCountry.toLowerCase());
      if (match) sCountry.value = [...sCountry.options].find(opt => String(opt.value || opt.textContent || '').trim().toLowerCase() === currentCountry.toLowerCase())?.value || currentCountry;
      else sCountry.value = currentCountry;
    }
  }
}

/* ══════════════════════════════════════════════════════════════
   UI — DASHBOARD STATS
══════════════════════════════════════════════════════════════ */
function updateDashboardGreeting() {
  const hour = Number(new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour: 'numeric',
    hour12: false,
  }).format(new Date()));

  const greeting =
    hour < 12 ? 'Good Morning! 👋' :
    hour < 17 ? 'Good Afternoon! 👋' :
                'Good Evening! 👋';

  setText('dashboardGreeting', greeting);
}

async function populateDashboardStats(contracts, options = {}) {
  const summary = getMiningSummary(contracts);
  updateLiveHashrateTrend(getLiveHashrateMovement(contracts));
  setText('liveHashrate',  summary.totalHashrate > 0 ? summary.totalHashrate.toFixed(1) + ' TH/s' : '0 TH/s');
  setText('liveHashrate2', summary.totalHashrate > 0 ? summary.totalHashrate.toFixed(1) + ' TH/s' : '0 TH/s');

  setText('dailyProfitEl', '$ ' + summary.dailyProfit.toFixed(2) + ' USDT');
  updateMiningCardStates(summary);

  const statChangeHashrate = document.getElementById('statChangeHashrate');
  const statChangeContracts = document.getElementById('statChangeContracts');
  if (statChangeHashrate)  statChangeHashrate.textContent  = formatActiveContractCount(summary.count);
  if (statChangeContracts) statChangeContracts.textContent = summary.count ? 'Mining income active' : 'No active contracts';

  if (!options.skipMinedQuery) {
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
}

function refreshLiveMiningUI(contracts = _latestContracts) {
  const summary = getMiningSummary(contracts);
  const movement = getLiveHashrateMovement(contracts);
  setText('liveHashrate',  summary.totalHashrate > 0 ? summary.totalHashrate.toFixed(1) + ' TH/s' : '0 TH/s');
  setText('liveHashrate2', summary.totalHashrate > 0 ? summary.totalHashrate.toFixed(1) + ' TH/s' : '0 TH/s');
  setText('dailyProfitEl', '$ ' + summary.dailyProfit.toFixed(2) + ' USDT');
  updateMiningCardStates(summary);
  updateLiveHashrateTrend(movement);
  renderContracts(contracts);
  renderMiningStats(contracts);
  initHashrateChart(contracts);
}

function updateLiveHashrateTrend(movement) {
  const el = $('liveHashrateChange');
  if (!el) return;

  const pct = Number(movement?.deltaPct || 0);
  const absPct = Math.abs(pct);
  if (!movement?.base?.totalHashrate) {
    el.textContent = 'No active contracts';
    el.className = 'stat-change up';
    return;
  }

  const arrow = movement.direction === 'down' ? '▼' : movement.direction === 'up' ? '▲' : '•';
  const label = movement.direction === 'flat' ? 'Stable' : `${arrow} ${absPct.toFixed(2)}%`;
  el.textContent = label;
  el.className = 'stat-change ' + (movement.direction === 'down' ? 'down' : 'up');
}

function startLiveHashrateRefreshLoop() {
  if (_liveHashrateAlignTimer) {
    clearTimeout(_liveHashrateAlignTimer);
    _liveHashrateAlignTimer = null;
  }
  if (_liveHashrateRefreshTimer) {
    clearInterval(_liveHashrateRefreshTimer);
    _liveHashrateRefreshTimer = null;
  }

  const remaining = LIVE_HASHRATE_INTERVAL_MS - (Date.now() % LIVE_HASHRATE_INTERVAL_MS);
  const delay = remaining === 0 ? LIVE_HASHRATE_INTERVAL_MS : remaining;

  _liveHashrateAlignTimer = setTimeout(() => {
    if (_latestContracts.length) {
      refreshLiveMiningUI(_latestContracts);
    }
    _liveHashrateRefreshTimer = setInterval(() => {
      if (_latestContracts.length) {
        refreshLiveMiningUI(_latestContracts);
      }
    }, LIVE_HASHRATE_INTERVAL_MS);
  }, delay);
}

/* ══════════════════════════════════════════════════════════════
   UI — TRANSACTION TABLE
══════════════════════════════════════════════════════════════ */
let _currentTxFilter = 'all';
let _allTransactions = [];
let _allDeposits     = [];
let _allWithdrawals  = [];

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
    const effectiveStatus = getEffectiveTransactionStatus(tx);
    const amtStr = (isOut ? '-' : '+') + Math.abs(amt).toFixed(decimals) + ' USDT';
    const usdVal = (isOut ? '-' : '+') + '$' + Math.abs(amt).toFixed(2);

    return {
      desc:   _txLabel(tx.type),
      coin:   coinLbl,
      amount: amtStr,
      usd:    usdVal,
      status: effectiveStatus,
      date:   _fmtDate(tx.created_at),
      type:   txType,
      createdAt: tx.created_at,
      _signature: [
        txType,
        amt.toFixed(decimals),
        String(tx.created_at || '').slice(0, 16),
      ].join('|'),
    };
  });

  const txSignatures = new Set(
    txRows
      .filter(row => row.type === 'deposit')
      .map(row => row._signature)
  );

  const depositRows = buildDepositHistoryRows().filter(row => {
    if (!row._signature) return true;
    return !txSignatures.has(row._signature);
  });

  const merged = [...txRows, ...depositRows].sort(
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

function getEffectiveTransactionStatus(tx) {
  const baseStatus = String(tx?.status || '').toLowerCase() || 'success';
  if (normalizeTxType(tx?.type) !== 'withdrawal') return baseStatus;

  const withdrawalId = tx?.withdrawal_id || null;
  if (withdrawalId) {
    const matchById = _allWithdrawals.find(w => String(w.id) === String(withdrawalId));
    if (matchById?.status) return String(matchById.status).toLowerCase();
  }

  const txTime = new Date(tx?.created_at || 0).getTime();
  const amount = Number(tx?.amount || 0);
  const userId = String(tx?.user_id || '');
  const candidates = _allWithdrawals.filter(w => {
    if (String(w?.user_id || '') !== userId) return false;
    if (Number(w?.amount || 0) !== amount) return false;
    return ['pending', 'approved', 'rejected'].includes(String(w?.status || '').toLowerCase());
  });
  if (!candidates.length) return baseStatus;

  candidates.sort((a, b) => {
    const da = Math.abs(new Date(a.created_at || 0).getTime() - txTime);
    const db = Math.abs(new Date(b.created_at || 0).getTime() - txTime);
    return da - db;
  });
  return String(candidates[0]?.status || baseStatus).toLowerCase();
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

function _dateKeyInTimeZone(dateLike, timeZone = 'Asia/Kolkata') {
  const date = dateLike instanceof Date ? dateLike : new Date(dateLike);
  if (!Number.isFinite(date.getTime())) return '';
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(date);
  } catch {
    return date.toISOString().slice(0, 10);
  }
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
    const liveHashrate = getLiveHashrateForContract(c);
    const hashrate    = liveHashrate > 0 ? liveHashrate.toFixed(1) + ' TH/s' : '—';
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
    const liveHashrate = getLiveHashrateForContract(c);
    const hashrate = liveHashrate > 0 ? liveHashrate.toFixed(1) : '—';
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
  const totalWithdrawn  = txns.filter(t => normalizeTxType(t.type) === 'withdrawal' && String(t.status || '').toLowerCase() === 'success')
    .reduce((s, t) => s + Number(t.amount || 0), 0);
  const miningIncome    = txns.filter(t => normalizeTxType(t.type) === 'mining')
    .reduce((s, t) => s + Number(t.amount || 0), 0);
  const referralBonuses = txns.filter(t => normalizeTxType(t.type) === 'referral')
    .reduce((s, t) => s + Number(t.amount || 0), 0);

  setText('walletTotalDeposited',  '$ ' + totalDeposited.toFixed(2) + ' USDT');
  setText('walletTotalWithdrawn',  '$ ' + totalWithdrawn.toFixed(2) + ' USDT');
  setText('walletMiningIncome',    '$ ' + miningIncome.toFixed(2) + ' USDT');
  setText('walletReferralBonuses', '$ ' + referralBonuses.toFixed(2) + ' USDT');
  setText('walletTotalMinedEarnings', '$ ' + miningIncome.toFixed(2) + ' USDT');
  setText('walletTotalReferralEarnings', '$ ' + referralBonuses.toFixed(2) + ' USDT');

  const profile    = Auth.getProfile();
  const usdtBalance = toUsdt(profile.usdt_balance);
  setText('walletBTCAmount', usdtBalance.toFixed(2) + ' USDT');
  setText('walletUSDTAmount', usdtBalance.toFixed(2) + ' USDT');
  setText('walletUSDTBalance', usdtBalance.toFixed(2) + ' USDT');
  setText('portfolioUSDTusd', '$' + usdtBalance.toFixed(2));
  setText('portfolioSubLabel', '≈ ' + usdtBalance.toFixed(2) + ' USDT');
}

/* ══════════════════════════════════════════════════════════════
   UI — EARNINGS CHART
══════════════════════════════════════════════════════════════ */
function initEarningsChart(transactions, contracts = []) {
  const canvas = $('earningsChart');
  if (!canvas) return;

  const now    = new Date();
  const days   = Math.max(1, Number(_earningsChartDays || 12));
  const timeZone = 'Asia/Kolkata';
  const buckets = {};
  for (let i = days - 1; i >= 0; i--) {
    const bucketDate = new Date(now);
    bucketDate.setDate(bucketDate.getDate() - i);
    const key = _dateKeyInTimeZone(bucketDate, timeZone);
    if (key) buckets[key] = 0;
  }

  transactions
    .filter(t => normalizeTxType(t.type) === 'mining')
    .forEach(t => {
      const key = _dateKeyInTimeZone(t.created_at, timeZone);
      if (key && key in buckets) {
        buckets[key] += Number(t.amount || 0);
      }
    });

  const labels = Object.keys(buckets);
  const data = labels.map(key => Number(buckets[key] || 0));
  const hasData = data.some(v => v > 0);

  const total12d = data.reduce((s, v) => s + v, 0);
  const earningDays = data.filter(v => v > 0).length;
  // Average only across days that actually earned mining rewards.
  const avgDaily = earningDays > 0 ? total12d / earningDays : 0;
  const bestDay  = hasData ? Math.max(...data) : 0;
  setText('chartTotal12d', hasData ? '$ ' + total12d.toFixed(2) + ' USDT' : '$ 0.00 USDT');
  setText('chartAvgDaily', hasData ? '$ ' + avgDaily.toFixed(2) + ' USDT' : '$ 0.00 USDT');
  setText('chartBestDay',  hasData ? '$ ' + bestDay.toFixed(2) + ' USDT' : '$ 0.00 USDT');

  if (!hasData) {
    _drawEmptyChart(canvas, 'No mining earnings yet');
    return;
  }

  const chartLabels = labels.map(key => {
    try {
      return new Date(`${key}T00:00:00+05:30`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } catch {
      return key;
    }
  });
  _drawLineChart(canvas, data, '#f59e0b', 'rgba(245,158,11,0.25)', {
    xLabels: chartLabels,
    yValueMode: 'currency',
    currencyPrefix: '$',
    unitSuffix: 'USDT',
  });
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

  const liveData = getLiveHashrateSeries(active, 24);
  const peakHash = Math.max(...liveData);
  const avgHash = liveData.reduce((sum, value) => sum + value, 0) / liveData.length;

  _drawLineChart(canvas, liveData, '#22c55e', 'rgba(34,197,94,0.2)', { moodZones: true });

  setText('hashrateStatPeak', peakHash.toFixed(1) + ' TH/s');
  setText('hashrateStatAvg',  avgHash.toFixed(1) + ' TH/s');
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

function _drawLineChart(canvas, data, lineColor, fillColor, options = {}) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const w = canvas.width  = canvas.offsetWidth || 400;
  const h = canvas.height = 160;
  const leftPad = options.leftPad ?? 58;
  const rightPad = options.rightPad ?? 20;
  const topPad = options.topPad ?? 18;
  const bottomPad = options.bottomPad ?? 30;
  const plotW = Math.max(10, w - leftPad - rightPad);
  const plotH = Math.max(10, h - topPad - bottomPad);
  const max   = Math.max(...data);
  const min   = Math.min(...data);
  const range = max - min || Math.abs(max) || 0.0000001;

  const getX = i => leftPad + (i / Math.max(1, data.length - 1)) * plotW;
  const getY = v => topPad + plotH - ((v - min) / range) * plotH;

  const fmtYAxis = (value) => {
    const n = Number(value || 0);
    if (options.yValueMode === 'currency') {
      return `${options.currencyPrefix || '$'} ${n.toFixed(2)}${options.unitSuffix ? ' ' + options.unitSuffix : ''}`;
    }
    return String(n.toFixed(1));
  };

  if (options.moodZones) {
    const top = topPad;
    const height = plotH;
    const bandHeight = height / 3;
    const zones = [
      { y: top, fill: 'rgba(34,197,94,0.06)', stroke: 'rgba(34,197,94,0.15)' },
      { y: top + bandHeight, fill: 'rgba(245,158,11,0.06)', stroke: 'rgba(245,158,11,0.12)' },
      { y: top + bandHeight * 2, fill: 'rgba(239,68,68,0.05)', stroke: 'rgba(239,68,68,0.12)' },
    ];
    zones.forEach(zone => {
      ctx.fillStyle = zone.fill;
      ctx.fillRect(leftPad, zone.y, plotW, bandHeight);
      ctx.strokeStyle = zone.stroke;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(leftPad, zone.y);
      ctx.lineTo(w - rightPad, zone.y);
      ctx.stroke();
    });
    ctx.strokeStyle = 'rgba(255,255,255,0.04)';
    ctx.beginPath();
    ctx.moveTo(leftPad, top + height);
    ctx.lineTo(w - rightPad, top + height);
    ctx.stroke();
  }

  // Axis labels
  ctx.save();
  ctx.fillStyle = 'rgba(148,163,184,0.9)';
  ctx.font = '11px sans-serif';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  const yTicks = 4;
  for (let i = 0; i <= yTicks; i++) {
    const ratio = i / yTicks;
    const value = max - ((max - min) * ratio);
    const y = topPad + (plotH * ratio);
    ctx.fillText(fmtYAxis(value), leftPad - 8, y);
  }

  if (Array.isArray(options.xLabels) && options.xLabels.length) {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    const labelEvery = Math.max(1, Math.ceil(options.xLabels.length / 4));
    options.xLabels.forEach((label, index) => {
      if (index !== 0 && index !== options.xLabels.length - 1 && index % labelEvery !== 0) return;
      ctx.fillText(String(label), getX(index), h - bottomPad + 6);
    });
  }
  ctx.restore();

  const gradient = ctx.createLinearGradient(0, 0, 0, h);
  gradient.addColorStop(0, fillColor);
  gradient.addColorStop(1, 'rgba(0,0,0,0)');

  ctx.beginPath();
  ctx.moveTo(getX(0), getY(data[0]));
  data.forEach((v, i) => ctx.lineTo(getX(i), getY(v)));
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

function setSidebarOpen(isOpen) {
  const sidebar = $('sidebar');
  const overlay = $('sidebarOverlay');
  if (!sidebar || !overlay) return;
  sidebar.classList.toggle('open', !!isOpen);
  overlay.classList.toggle('open', !!isOpen);
  document.body.classList.toggle('sidebar-open', !!isOpen);
}

/* ══════════════════════════════════════════════════════════════
   TAB NAVIGATION
══════════════════════════════════════════════════════════════ */
function renderEarningsChart() {
  initEarningsChart(_allTransactions || [], _latestContracts || []);
}

function setEarningsChartRange(days) {
  const nextDays = [12, 30, 90].includes(Number(days)) ? Number(days) : 12;
  _earningsChartDays = nextDays;

  document.querySelectorAll('[data-earnings-range]').forEach(btn => {
    const match = Number(btn.dataset.earningsRange) === nextDays;
    btn.classList.toggle('active', match);
    btn.setAttribute('aria-pressed', match ? 'true' : 'false');
  });

  const subtitle = $('earningsChartSubtitle');
  if (subtitle) subtitle.textContent = `Last ${nextDays} days • USDT`;

  const totalLabel = $('chartTotalLabel');
  if (totalLabel) totalLabel.textContent = `Total Earned (${nextDays}d)`;
}

function wireEarningsChartControls() {
  const buttons = document.querySelectorAll('[data-earnings-range]');
  if (!buttons.length) return;

  buttons.forEach(btn => {
    btn.addEventListener('click', () => {
      setEarningsChartRange(Number(btn.dataset.earningsRange || 12));
      renderEarningsChart();
    });
  });

  setEarningsChartRange(_earningsChartDays);
}

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

  setSidebarOpen(false);
}

/* ─── SIDEBAR TOGGLE ─────────────────────────────────────── */
function toggleSidebar() {
  const sidebar = $('sidebar');
  if (!sidebar) return;
  const isOpen = sidebar.classList.contains('open');
  setSidebarOpen(!isOpen);
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
  const sessionUser = Auth.getUser();
  const isAdmin = await window.CVAuthRole?.isAdminUser?.(_supabase, sessionUser);
  if (!isAdmin) {
    throw new Error('Forbidden: admin access required.');
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
  const country = $('settingCountry')?.value.trim() || '';
  const updates = {};
  if (name) updates.name = name;
  if (country) updates.country = country;

  if (!Object.keys(updates).length) { Toast.show('Nothing to save.', 'info'); return; }
  const result = await Auth.updateProfile(updates);
  if (result) {
    if (name) document.querySelectorAll('.user-name-display').forEach(el => { el.textContent = name; });
    Toast.show('Settings saved!', 'success');
  } else {
    Toast.show('Failed to save settings.', 'error');
  }
}

async function changePasswordWithOldPassword(e) {
  e.preventDefault();
  if (!_supabase) { Toast.show('Service unavailable.', 'error'); return; }

  const user = Auth.getUser();
  const oldPassword = String($('oldPassword')?.value || '');
  const newPassword = String($('newPassword')?.value || '');
  const confirmNewPassword = String($('confirmNewPassword')?.value || '');
  const email = user?.email || Auth.getProfile()?.email || '';

  if (!user || !email) { Toast.show('Auth required. Please log in again.', 'error'); return; }
  if (!oldPassword || !newPassword || !confirmNewPassword) { Toast.show('Please fill all password fields.', 'error'); return; }
  if (!window.CVAuthRole?.isStrongPassword(newPassword)) { Toast.show(window.CVAuthRole?.passwordPolicyMessage?.() || 'Use a stronger password.', 'error'); return; }
  if (newPassword !== confirmNewPassword) { Toast.show('New password and confirm password do not match.', 'error'); return; }
  if (oldPassword === newPassword) { Toast.show('New password must be different from current password.', 'warning'); return; }

  try {
    const { error: verifyErr } = await _supabase.auth.signInWithPassword({ email, password: oldPassword });
    if (verifyErr) { Toast.show('Current password is incorrect.', 'error'); return; }

    const { error: updateErr } = await _supabase.auth.updateUser({ password: newPassword });
    if (updateErr) throw updateErr;

    $('changePasswordForm')?.reset();
    closeModal('changePasswordModal');
    Toast.show('Password updated successfully.', 'success', 4500);
  } catch (err) {
    Toast.show('Password update failed: ' + (err?.message || 'Unknown error'), 'error', 5000);
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
  if (!toggle || !sidebar) return;
  toggle.addEventListener('click', () => {
    toggleSidebar();
  });
  $('sidebarOverlay')?.addEventListener('click', () => {
    setSidebarOpen(false);
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

  $('withdrawForm')?.addEventListener('submit', submitWithdrawalForm);
  $('changePasswordForm')?.addEventListener('submit', changePasswordWithOldPassword);
}

async function submitWithdrawalForm(e) {
  e.preventDefault();
  const user = Auth.getUser();
  if (!user || !_supabase) { Toast.show('Auth required. Please log in again.', 'error'); return; }

  const address = String($('withdrawAddress')?.value || '').trim();
  const amount = Number($('withdrawAmount')?.value || 0);
  const profile = (await Auth.refreshProfile()) || Auth.getProfile();
  const available = Number(profile?.usdt_balance || 0);

  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) { Toast.show('Enter a valid BEP20 wallet address.', 'error'); return; }
  if (!Number.isFinite(amount) || amount < 50) { Toast.show('Minimum withdrawal is 50 USDT.', 'error'); return; }
  if (amount > available) { Toast.show('Insufficient USDT balance.', 'error'); return; }
  const netAmount = amount * 0.7;
  const newBalance = available - amount;

  const createdAt = new Date().toISOString();
  const withdrawalPayload = {
    user_id: user.id,
    user_email: user.email || profile?.email || '',
    coin: 'usdt_bep20',
    amount,
    address,
    status: 'pending',
    wallet_debited: true,
    created_at: createdAt,
  };

  const { data: withdrawalRow, error: withdrawalErr } = await _supabase
    .from('withdrawals')
    .insert(withdrawalPayload)
    .select()
    .single();
  if (withdrawalErr) {
    Toast.show('Withdrawal failed: ' + withdrawalErr.message, 'error', 5000);
    return;
  }

  const { error: balanceErr } = await _supabase
    .from('profiles')
    .update({ usdt_balance: newBalance })
    .eq('id', user.id);
  if (balanceErr) {
    await _supabase.from('withdrawals').delete().eq('id', withdrawalRow?.id).catch(() => {});
    Toast.show('Withdrawal failed: ' + balanceErr.message, 'error', 5000);
    return;
  }

  const transactionPayload = {
    user_id: user.id,
    type: 'withdrawal',
    amount,
    coin: 'usdt_bep20',
    status: 'pending',
    withdrawal_id: withdrawalRow?.id || null,
    created_at: createdAt,
  };

  const { error: txErr } = await _supabase
    .from('transactions')
    .insert(transactionPayload);
  if (txErr) {
    await Promise.allSettled([
      _supabase.from('withdrawals').delete().eq('id', withdrawalRow?.id),
      _supabase.from('profiles').update({ usdt_balance: available }).eq('id', user.id),
    ]);
    Toast.show('Withdrawal failed: ' + txErr.message, 'error', 5000);
    return;
  }

  $('withdrawForm')?.reset();
  closeModal('withdrawModal');
  Toast.show(`Withdrawal submitted. 30% charge applied, estimated receivable: ${netAmount.toFixed(2)} USDT.`, 'success', 5000);
  await Auth.refreshProfile();
  await Notifications.load();
  await refreshAll();
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
  _latestContracts = contracts;
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
    renderEarningsChart();
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
      query = query.eq('user_id', user.id).in('id', Array.isArray(ids) ? ids : [ids]);
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
  window.CVAuthRole?.startSessionInactivityGuard?.(() => Auth.logout(), AUTH_IDLE_TIMEOUT_MS);
  const ok = await Auth.init();
  if (!ok) return;

  await populateUserUI();
  updateDashboardGreeting();
  setInterval(updateDashboardGreeting, 60 * 1000);

  wireLogout();
  wireMobileMenu();
  wireDropdowns();
  wireModals();
  wireTransactionFilters();
  wireEarningsChartControls();
  wireDepositButtons();
  wireWithdrawButtons();
  wirePlanButtons();
  wireNotificationBell();
  initNotificationRealtime();
  initAdminChangeRealtime();

  initDepositForm();
  await loadPlanCatalog();

  await refreshAll();
  startLiveHashrateRefreshLoop();
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
    _allWithdrawals  = await loadWithdrawals();
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


