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
            btc_balance: 0,
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

/* ─── GET CONTRACT FROM URL ──────────────────────────────── */
function getContractIdFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get('contract');
}

/* ─── LOAD CONTRACT DATA ────────────────────────────────── */
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

/* ─── RENDER PAGE ────────────────────────────────────────── */
let _timerInterval = null;

function renderPage(contract) {
  if (!contract) return;

  const planName = contract.plan || contract.name || 'Mining Contract';
  const hashrate = contract.hashrate != null ? contract.hashrate.toFixed(1) : '—';
  const dailyProfit = Number(contract.daily_profit || 0);
  const dailyProfitStr = dailyProfit > 0 ? dailyProfit.toFixed(8) + ' BTC' : '—';
  const progress = Math.min(100, Math.max(0, Number(contract.progress || 0)));
  const daysLeft = contract.days_left != null ? contract.days_left : '∞';

  const startDate = contract.created_at ? new Date(contract.created_at) : new Date();
  const startDateStr = startDate.toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' });
  const startTimeStr = startDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

  const now = new Date();
  const msPerDay = 24 * 60 * 60 * 1000;
  const elapsedMs = now - startDate;
  const daysActive = Math.max(0, elapsedMs / msPerDay);
  const totalEarned = dailyProfit * daysActive;
  const totalEarnedStr = totalEarned > 0 ? totalEarned.toFixed(8) + ' BTC' : '0.00000000 BTC';

  const btcPrice = BTCPrice.get();
  const totalEarnedUSD = btcPrice != null ? '≈ $' + (totalEarned * btcPrice).toFixed(2) + ' USD' : '';
  const dailyProfitUSD = btcPrice != null ? '≈ $' + (dailyProfit * btcPrice).toFixed(2) + ' USD' : '';
  const projectedMonthly = dailyProfit * 30;
  const projectedMonthlyStr = projectedMonthly > 0 ? projectedMonthly.toFixed(8) + ' BTC' : '—';

  // Hero Section
  setText('planHeroName', planName + ' Plan');
  setText('planHeroEarned', totalEarnedStr);

  // Stats Cards
  setText('planStartDate', startDateStr);
  setText('planStartTime', startTimeStr);
  setText('planDaysActive', Math.floor(daysActive));
  setText('planDaysLeft', daysLeft === '∞' ? 'Unlimited' : daysLeft + ' days');
  setText('planHashrate', hashrate + ' TH/s');

  // Timer Section
  setText('planTimerAmount', dailyProfitStr);
  setText('planTimerUSD', dailyProfitUSD);

  // Progress
  setText('planProgressBadge', progress.toFixed(0) + '%');
  const bar = $('planProgressBar');
  if (bar) bar.style.width = progress + '%';
  setText('planProgressText', progress.toFixed(0) + '% Complete · ' + hashrate + ' TH/s');

  // Daily Earnings Card
  setText('planDailyEarnings', dailyProfitStr);
  setText('planDailyEarningsUSD', dailyProfitUSD);

  // Chart Stats
  setText('planChartTotal', totalEarnedStr);
  setText('planChartAvg', dailyProfitStr);
  setText('planChartMonthly', projectedMonthlyStr);

  // Info Table
  setText('infoPlanName', planName);
  setText('infoContractId', contract.id);
  setText('infoStartDate', startDateStr + ' at ' + startTimeStr);
  setText('infoHashrate', hashrate + ' TH/s');
  setText('infoDailyProfit', dailyProfitStr + ' / day');
  setText('infoStatus', contract.active ? '● Active' : '● Inactive');

  // Start Live Timer
  if (_timerInterval) clearInterval(_timerInterval);
  _timerInterval = setInterval(() => updateTimer(contract), 1000);
  updateTimer(contract);

  // Draw Chart
  drawEarningsChart(contract);
}

/* ─── LIVE TIMER ─────────────────────────────────────────── */
function updateTimer(contract) {
  const base = contract.last_payout_at
    ? new Date(contract.last_payout_at)
    : new Date(contract.created_at || Date.now());
  const now = new Date();
  const msPerDay = 24 * 60 * 60 * 1000;
  const elapsed = now - base;

  const cycles = Math.floor(elapsed / msPerDay);
  const nextPayout = new Date(base.getTime() + (cycles + 1) * msPerDay);
  let timeUntil = nextPayout - now;
  if (timeUntil < 0) timeUntil = 0;

  const hours = Math.floor(timeUntil / (60 * 60 * 1000));
  const minutes = Math.floor((timeUntil % (60 * 60 * 1000)) / (60 * 1000));
  const seconds = Math.floor((timeUntil % (60 * 1000)) / 1000);

  const display =
    String(hours).padStart(2, '0') + ':' +
    String(minutes).padStart(2, '0') + ':' +
    String(seconds).padStart(2, '0');

  setText('planTimerDisplay', display);
  setText('planTimerHours', hours);

  if (timeUntil === 0 && !contract._payoutTriggered) {
    contract._payoutTriggered = true;
    triggerPayout(contract);
  }
}

async function triggerPayout(contract) {
  try {
    const user = Auth.getUser();
    if (!user || !_supabase) return;

    const msPerDay = 24 * 60 * 60 * 1000;
    const now      = new Date();
    const base     = contract.last_payout_at
      ? new Date(contract.last_payout_at)
      : new Date(contract.created_at || Date.now());
    const diffMs   = now - base;
    const cycles   = Math.floor(diffMs / msPerDay);
    if (cycles <= 0) return;

    const dailyProfit = Number(contract.daily_profit || 0); // USDT
    if (!dailyProfit || dailyProfit <= 0) return;

    const payoutUSDT = dailyProfit * cycles;

    const { data: profileData, error: profErr } = await _supabase
      .from('profiles')
      .select('usdt_balance')
      .eq('id', user.id)
      .single();
    if (profErr) throw profErr;

    const currentUSDT = Number(profileData?.usdt_balance || 0);
    const newUSDT     = currentUSDT + payoutUSDT;

    const { error: balErr } = await _supabase
      .from('profiles')
      .update({ usdt_balance: newUSDT })
      .eq('id', user.id);
    if (balErr) throw balErr;

    const { error: txErr } = await _supabase
      .from('transactions')
      .insert({
        user_id:    user.id,
        type:       'mining',
        amount:     payoutUSDT,
        coin:       'usdt',
        status:     'success',
        created_at: now.toISOString(),
      });
    if (txErr) throw txErr;

    const newLastPayout = now.toISOString();
    const { error: cErr } = await _supabase
      .from('contracts')
      .update({ last_payout_at: newLastPayout })
      .eq('id', contract.id);
    if (cErr) throw cErr;

    contract.last_payout_at = newLastPayout;
    contract._payoutTriggered = false;

    Toast.show(`✅ Mining payout credited: $${payoutUSDT.toFixed(2)} USDT`, 'success', 4500);
  } catch (err) {
    console.error('[PlanDetail] triggerPayout failed:', err);
    Toast.show('Failed to process payout: ' + err.message, 'error', 5000);
  }
}

async function claimDailyEarnings() {
  const contract = await loadContractData();
  if (!contract) return;
  await triggerPayout(contract);
}

/* ─── EARNINGS CHART ─────────────────────────────────────── */
function drawEarningsChart(contract) {
  const canvas = $('planEarningsChart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const w = canvas.width = canvas.offsetWidth || 800;
  const h = canvas.height = 200;

  const start = new Date(contract.created_at || Date.now());
  const now = new Date();
  const days = Math.min(30, Math.ceil((now - start) / (24 * 60 * 60 * 1000)));
  const dailyProfit = Number(contract.daily_profit || 0);

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

  // Gradient fill
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

  // Line
  ctx.beginPath();
  ctx.strokeStyle = '#f59e0b';
  ctx.lineWidth = 2.5;
  ctx.lineJoin = 'round';
  data.forEach((v, i) => { i === 0 ? ctx.moveTo(getX(i), getY(v)) : ctx.lineTo(getX(i), getY(v)); });
  ctx.stroke();

  // Points
  data.forEach((v, i) => {
    ctx.beginPath();
    ctx.arc(getX(i), getY(v), 3, 0, Math.PI * 2);
    ctx.fillStyle = '#f59e0b';
    ctx.fill();
    ctx.strokeStyle = '#1a2236';
    ctx.lineWidth = 2;
    ctx.stroke();
  });
}

/* ─── POPULATE USER UI ─────────────────────────────────── */
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

/* ─── WIRE DROPDOWNS ────────────────────────────────────── */
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

/* ─── LOGOUT ────────────────────────────────────────────── */
function wireLogout() {
  document.querySelectorAll('[data-logout]').forEach(el => {
    el.addEventListener('click', async e => {
      e.preventDefault();
      try { if (_supabase) await _supabase.auth.signOut(); } catch {}
      window.location.href = 'login.html';
    });
  });
}

/* ─── MAIN INIT ─────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', async () => {
  const ok = await Auth.init();
  if (!ok) return;

  await populateUserUI();
  wireDropdowns();
  wireLogout();

  const contract = await loadContractData();
  if (contract) {
    renderPage(contract);
  }

  // Resize chart on window resize
  window.addEventListener('resize', () => {
    if (contract) drawEarningsChart(contract);
  });

  window.toggleSidebar = toggleSidebar;
});
