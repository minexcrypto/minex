/* ══════════════════════════════════════════════════════════════
   CRYPTOVAULT — dashboard.js
   Dashboard-specific logic: charts, mining stats, transactions
══════════════════════════════════════════════════════════════ */

'use strict';

/* ─── SIMULATED MINING DATA ─────────────────────────────── */
const MiningData = {
  hashrates: [82, 78, 85, 91, 88, 94, 87, 96, 92, 98, 95, 100, 97, 103, 99, 105, 101, 108, 104, 110, 107, 112, 109, 115],
  earnings:  [0.00031, 0.00028, 0.00033, 0.00035, 0.00032, 0.00038, 0.00034, 0.00039, 0.00037, 0.00041, 0.00036, 0.00043],
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
    { name:'Starter Plan',   hashrate:10,  power:500,   dailyProfit:'0.000032 BTC', progress:73, daysLeft:22, status:'active'  },
    { name:'Silver Plan',    hashrate:50,  power:1200,  dailyProfit:'0.000158 BTC', progress:45, daysLeft:41, status:'active'  },
    { name:'Gold Plan',      hashrate:100, power:2200,  dailyProfit:'0.000315 BTC', progress:12, daysLeft:79, status:'active'  },
  ]
};

/* ─── EARNINGS CHART ────────────────────────────────────── */
function initEarningsChart() {
  const canvas = document.getElementById('earningsChart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const w = canvas.width = canvas.offsetWidth;
  const h = canvas.height = 160;

  const data = MiningData.earnings;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 0.0001;

  function getX(i) { return (i / (data.length - 1)) * (w - 40) + 20; }
  function getY(v) { return h - 20 - ((v - min) / range) * (h - 50); }

  // Gradient fill
  const gradient = ctx.createLinearGradient(0, 0, 0, h);
  gradient.addColorStop(0, 'rgba(245,158,11,0.3)');
  gradient.addColorStop(1, 'rgba(245,158,11,0.0)');

  // Grid lines
  ctx.strokeStyle = 'rgba(30,45,69,0.6)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 4; i++) {
    const y = 20 + (i * (h - 50) / 3);
    ctx.beginPath();
    ctx.moveTo(20, y); ctx.lineTo(w - 20, y);
    ctx.stroke();
  }

  // Area
  ctx.beginPath();
  ctx.moveTo(getX(0), h - 20);
  data.forEach((v, i) => ctx.lineTo(getX(i), getY(v)));
  ctx.lineTo(getX(data.length - 1), h - 20);
  ctx.closePath();
  ctx.fillStyle = gradient;
  ctx.fill();

  // Line
  ctx.beginPath();
  ctx.strokeStyle = '#f59e0b';
  ctx.lineWidth = 2.5;
  ctx.lineJoin = 'round';
  data.forEach((v, i) => i === 0 ? ctx.moveTo(getX(i), getY(v)) : ctx.lineTo(getX(i), getY(v)));
  ctx.stroke();

  // Dots
  data.forEach((v, i) => {
    ctx.beginPath();
    ctx.arc(getX(i), getY(v), 3.5, 0, Math.PI * 2);
    ctx.fillStyle = '#f59e0b';
    ctx.fill();
    ctx.strokeStyle = '#1a2236';
    ctx.lineWidth = 2;
    ctx.stroke();
  });
}

/* ─── HASHRATE CHART ────────────────────────────────────── */
function initHashrateChart() {
  const canvas = document.getElementById('hashrateChart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const w = canvas.width = canvas.offsetWidth;
  const h = canvas.height = 100;

  const data = MiningData.hashrates;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;

  function getX(i) { return (i / (data.length - 1)) * (w - 20) + 10; }
  function getY(v) { return h - 10 - ((v - min) / range) * (h - 24); }

  const gradient = ctx.createLinearGradient(0, 0, 0, h);
  gradient.addColorStop(0, 'rgba(16,185,129,0.25)');
  gradient.addColorStop(1, 'rgba(16,185,129,0.0)');

  ctx.beginPath();
  ctx.moveTo(getX(0), h);
  data.forEach((v, i) => ctx.lineTo(getX(i), getY(v)));
  ctx.lineTo(getX(data.length - 1), h);
  ctx.closePath();
  ctx.fillStyle = gradient;
  ctx.fill();

  ctx.beginPath();
  ctx.strokeStyle = '#10b981';
  ctx.lineWidth = 2;
  ctx.lineJoin = 'round';
  data.forEach((v, i) => i === 0 ? ctx.moveTo(getX(i), getY(v)) : ctx.lineTo(getX(i), getY(v)));
  ctx.stroke();
}

/* ─── PORTFOLIO DONUT ───────────────────────────────────── */
function initDonut() {
  const canvas = document.getElementById('donutChart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const size = 120;
  canvas.width = size; canvas.height = size;
  const cx = size / 2, cy = size / 2, r = 44, rw = 16;

  const segments = [
    { pct: 0.58, color: '#f7931a' },
    { pct: 0.22, color: '#627eea' },
    { pct: 0.12, color: '#34c1c7' },
    { pct: 0.08, color: '#26a17b' },
  ];

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

  // center text
  ctx.fillStyle = '#f1f5f9';
  ctx.font = 'bold 13px Syne, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('BTC', cx, cy - 6);
  ctx.font = '10px Outfit, sans-serif';
  ctx.fillStyle = '#94a3b8';
  ctx.fillText('58%', cx, cy + 8);
}

/* ─── TRANSACTIONS TABLE ────────────────────────────────── */
function renderTransactions(filter = 'all') {
  const tbody = document.getElementById('txTableBody');
  if (!tbody) return;

  const txMap = { mining: '⛏️', in: '📥', out: '📤' };
  const typeLabel = { mining: 'Mining', in: 'Deposit', out: 'Withdrawal' };

  const filtered = filter === 'all'
    ? MiningData.transactions
    : MiningData.transactions.filter(t => t.type === filter);

  tbody.innerHTML = filtered.map(tx => `
    <tr>
      <td>
        <div class="flex items-center gap-8">
          <div class="tx-icon ${tx.type}">${txMap[tx.type]}</div>
          <div>
            <div class="td-primary">${tx.desc}</div>
            <div class="text-xs text-muted mono">${tx.id}</div>
          </div>
        </div>
      </td>
      <td><span class="badge badge-muted">${tx.coin}</span></td>
      <td class="td-primary mono" style="color:${tx.amount[0]==='+' ? 'var(--green)' : 'var(--red)'}">${tx.amount}</td>
      <td class="text-muted">${tx.usd}</td>
      <td><span class="badge ${tx.status === 'success' ? 'badge-success' : 'badge-warning'}">${tx.status}</span></td>
      <td class="text-muted text-sm">${tx.date}</td>
    </tr>
  `).join('');
}

/* ─── MINING CONTRACTS ──────────────────────────────────── */
function renderContracts() {
  const container = document.getElementById('contractsContainer');
  if (!container) return;

  container.innerHTML = MiningData.contracts.map(c => `
    <div class="rig-card">
      <div class="rig-status ${c.status === 'active' ? '' : 'idle'}"></div>
      <div class="rig-info">
        <div class="rig-name">${c.name}</div>
        <div class="rig-specs">${c.hashrate} TH/s · ${c.power}W · ${c.daysLeft} days left</div>
        <div class="progress-wrap mt-8">
          <div class="progress-bar">
            <div class="progress-fill" style="width:${c.progress}%"></div>
          </div>
        </div>
      </div>
      <div class="rig-metrics">
        <div class="rig-hash">${c.hashrate} TH/s</div>
        <div class="rig-earnings">${c.dailyProfit}/day</div>
      </div>
    </div>
  `).join('');
}

/* ─── LIVE HASHRATE TICKER ──────────────────────────────── */
function startLiveTicker() {
  const el = document.getElementById('liveHashrate');
  if (!el) return;

  let base = 115.3;
  setInterval(() => {
    base += (Math.random() - 0.48) * 1.2;
    base = Math.max(100, Math.min(130, base));
    el.textContent = base.toFixed(1) + ' TH/s';
  }, 2500);
}

/* ─── BALANCE COUNTER ───────────────────────────────────── */
function initCounters() {
  const user = window.Auth?.getSession?.();
  if (!user) return;

  const el = document.getElementById('walletBalanceCounter');
  if (el) animateCounter(el, user.balance, 6, '₿ ');

  const usdEl = document.getElementById('walletBalanceUSD');
  if (usdEl) {
    const price = window.BTCPrice?.current || 67842;
    animateCounter(usdEl, user.balance * price, 2, '$');
  }
}

/* ─── WITHDRAWAL MODAL ──────────────────────────────────── */
function initWithdrawal() {
  const form = document.getElementById('withdrawForm');
  if (!form) return;

  form.addEventListener('submit', e => {
    e.preventDefault();
    const amt = parseFloat(form.querySelector('[name="amount"]')?.value || 0);
    const user = Auth.getSession();
    if (!user) return;
    if (amt <= 0 || amt > user.balance) {
      Toast.show('Insufficient balance.', 'error'); return;
    }
    Auth.updateSession({ balance: user.balance - amt });
    Toast.show('Withdrawal request submitted!', 'success');
    closeModal('withdrawModal');
    form.reset();
    setTimeout(() => location.reload(), 800);
  });
}

/* ─── DEPOSIT MODAL ─────────────────────────────────────── */
function initDeposit() {
  const form = document.getElementById('depositForm');
  if (!form) return;

  form.addEventListener('submit', e => {
    e.preventDefault();
    Toast.show('Deposit address copied. Send BTC to complete deposit.', 'success');
    closeModal('depositModal');
  });
}

/* ─── TX FILTER TABS ────────────────────────────────────── */
function initTxTabs() {
  document.querySelectorAll('[data-tx-filter]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-tx-filter]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderTransactions(btn.dataset.txFilter);
    });
  });
}

/* ─── DAILY PROFIT ANIMATION ────────────────────────────── */
function animateDailyProfit() {
  const el = document.getElementById('dailyProfitEl');
  if (!el) return;
  let val = 0.000032;
  setInterval(() => {
    val += 0.0000001 * Math.random();
    el.textContent = '₿ ' + val.toFixed(8);
  }, 3000);
}

/* ─── INIT ──────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  Auth?.requireAuth?.();

  // Slight delay for layout to settle before canvas draws
  setTimeout(() => {
    initEarningsChart();
    initHashrateChart();
    initDonut();
  }, 100);

  renderTransactions();
  renderContracts();
  initTxTabs();
  startLiveTicker();
  initWithdrawal();
  initDeposit();
  animateDailyProfit();

  setTimeout(initCounters, 500);

  // Update BTC-based USD values after price loads
  BTCPrice?.onChange?.((price) => {
    const user = Auth?.getSession?.();
    if (!user) return;
    const usdEl = document.getElementById('walletBalanceUSD');
    if (usdEl) usdEl.textContent = '$' + (user.balance * price).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  });
});
