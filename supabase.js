/* ══════════════════════════════════════════════════════════
   CRYPTOVAULT — supabase.js
   Shared Supabase client + Auth + Wallet + Deposits + Plans
══════════════════════════════════════════════════════════ */
'use strict';

const SUPABASE_URL = 'https://fwgqydxkdbuzrehqifjw.supabase.co';
const SUPABASE_KEY = 'sb_publishable_Pbn_Z0wwsqMUyLWYg3udmQ_MC-Qz1kj';

/* ─── CLIENT ─────────────────────────────────────────────── */
const _sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true }
});

/* ═══════════════════════════════════════════════════════════
   AUTH
═══════════════════════════════════════════════════════════ */
const CV_Auth = {
  _session: null,
  _profile: null,

  async init() {
    const { data: { session } } = await _sb.auth.getSession();
    if (!session) { window.location.href = 'login.html'; return false; }
    this._session = session;

    /* fetch or seed profile */
    let { data: prof } = await _sb.from('profiles').select('*').eq('id', session.user.id).single();
    if (!prof) {
      const { data: p2 } = await _sb.from('profiles').upsert({
        id: session.user.id,
        email: session.user.email,
        name: session.user.email.split('@')[0],
        ref_code: 'CV' + Math.random().toString(36).substring(2,8).toUpperCase(),
        is_admin: false
      }).select().single();
      prof = p2;
    }
    this._profile = prof;

    /* ensure wallet row */
    const { data: wallet } = await _sb.from('user_wallets').select('*').eq('user_id', session.user.id).single();
    if (!wallet) {
      await _sb.from('user_wallets').insert({ user_id: session.user.id, btc_balance: 0, usd_balance: 0 });
    }

    _sb.auth.onAuthStateChange(ev => { if (ev === 'SIGNED_OUT') window.location.href = 'login.html'; });
    return true;
  },

  async initAdmin() {
    const { data: { session } } = await _sb.auth.getSession();
    if (!session) { window.location.href = 'login.html'; return false; }
    this._session = session;
    let { data: prof } = await _sb.from('profiles').select('*').eq('id', session.user.id).single();
    this._profile = prof;
    if (!prof?.is_admin) { window.location.href = 'dashboard.html'; return false; }
    return true;
  },

  getUser()    { return this._session?.user || null; },
  getProfile() { return this._profile || {}; },
  isAdmin()    { return !!this._profile?.is_admin; },

  async logout() {
    await _sb.auth.signOut();
    window.location.href = 'login.html';
  },

  async updateProfile(fields) {
    if (!this._session) return;
    const { data } = await _sb.from('profiles').update(fields)
      .eq('id', this._session.user.id).select().single();
    if (data) this._profile = data;
    return data;
  }
};

/* ═══════════════════════════════════════════════════════════
   WALLET
═══════════════════════════════════════════════════════════ */
const CV_Wallet = {
  async get(userId) {
    const uid = userId || CV_Auth.getUser()?.id;
    const { data } = await _sb.from('user_wallets').select('*').eq('user_id', uid).single();
    return data || { btc_balance: 0, usd_balance: 0 };
  },

  async addBalance(userId, usdAmount, note = '') {
    const wallet = await this.get(userId);
    const newBal = (wallet.usd_balance || 0) + usdAmount;
    await _sb.from('user_wallets').update({ usd_balance: newBal, updated_at: new Date().toISOString() })
      .eq('user_id', userId);
    return newBal;
  },

  async deductBalance(userId, usdAmount) {
    const wallet = await this.get(userId);
    const newBal = Math.max(0, (wallet.usd_balance || 0) - usdAmount);
    await _sb.from('user_wallets').update({ usd_balance: newBal, updated_at: new Date().toISOString() })
      .eq('user_id', userId);
    return newBal;
  }
};

/* ═══════════════════════════════════════════════════════════
   DEPOSITS
═══════════════════════════════════════════════════════════ */
const DEPOSIT_ADDRESSES = {
  BTC:  'bc1qzffpufy57a0r4jpyv7w6qj7w48vzj8jeamusxe',
  USDT: '0x3484Eb517732AA21A5f410bF9b5E991e9FB251d0'
};

const CV_Deposits = {
  async submit({ coin, amount, txid, screenshotUrl }) {
    const user = CV_Auth.getUser();
    const { data, error } = await _sb.from('deposits').insert({
      user_id: user.id,
      user_email: user.email,
      coin,
      amount: parseFloat(amount),
      txid,
      screenshot_url: screenshotUrl || null,
      status: 'pending'
    }).select().single();
    return { data, error };
  },

  async getMyDeposits() {
    const user = CV_Auth.getUser();
    const { data } = await _sb.from('deposits').select('*')
      .eq('user_id', user.id).order('created_at', { ascending: false });
    return data || [];
  },

  async getPending() {
    const { data } = await _sb.from('deposits').select('*')
      .eq('status', 'pending').order('created_at', { ascending: false });
    return data || [];
  },

  async getAll() {
    const { data } = await _sb.from('deposits').select('*')
      .order('created_at', { ascending: false });
    return data || [];
  },

  async approve(depositId) {
    /* get deposit */
    const { data: dep } = await _sb.from('deposits').select('*').eq('id', depositId).single();
    if (!dep) return { error: 'Deposit not found' };

    /* add to wallet */
    await CV_Wallet.addBalance(dep.user_id, dep.amount, `Deposit approved: ${dep.coin}`);

    /* mark approved */
    const { error } = await _sb.from('deposits').update({
      status: 'approved',
      reviewed_at: new Date().toISOString()
    }).eq('id', depositId);

    return { error };
  },

  async reject(depositId) {
    const { error } = await _sb.from('deposits').update({
      status: 'rejected',
      reviewed_at: new Date().toISOString()
    }).eq('id', depositId);
    return { error };
  }
};

/* ═══════════════════════════════════════════════════════════
   PLANS
═══════════════════════════════════════════════════════════ */
const PLAN_DEFINITIONS = [
  {
    id: 'starter',
    name: 'Starter',
    icon: '🌱',
    min_deposit: 500,
    monthly_return_pct: 10,
    daily_return_pct: 10 / 30,
    duration_days: 30,
    color: 'gold',
    features: ['10% Monthly Return', 'Daily Payouts', 'Basic Dashboard', 'Email Support']
  },
  {
    id: 'pro',
    name: 'Pro',
    icon: '🥇',
    min_deposit: 2000,
    monthly_return_pct: 15,
    daily_return_pct: 15 / 30,
    duration_days: 90,
    color: 'blue',
    features: ['15% Monthly Return', 'Daily Payouts', 'Advanced Dashboard', 'Priority Support', 'Analytics Reports'],
    featured: true
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    icon: '💎',
    min_deposit: 5000,
    monthly_return_pct: 20,
    daily_return_pct: 20 / 30,
    duration_days: 180,
    color: 'green',
    features: ['20% Monthly Return', 'Daily Payouts', 'VIP Dashboard', 'Dedicated Manager', 'Auto Reinvest + Compound']
  }
];

const CV_Plans = {
  definitions: PLAN_DEFINITIONS,

  getPlanDef(planId) {
    return PLAN_DEFINITIONS.find(p => p.id === planId);
  },

  async getActivePlans(userId) {
    const uid = userId || CV_Auth.getUser()?.id;
    const { data } = await _sb.from('user_plans').select('*')
      .eq('user_id', uid).eq('status', 'active')
      .order('created_at', { ascending: false });
    return data || [];
  },

  async getAllUserPlans(userId) {
    const uid = userId || CV_Auth.getUser()?.id;
    const { data } = await _sb.from('user_plans').select('*')
      .eq('user_id', uid).order('created_at', { ascending: false });
    return data || [];
  },

  async activate(planId, investAmount) {
    const user   = CV_Auth.getUser();
    const planDef = this.getPlanDef(planId);
    if (!planDef) return { error: 'Invalid plan' };

    /* check min */
    if (investAmount < planDef.min_deposit)
      return { error: `Minimum investment for ${planDef.name} is $${planDef.min_deposit}` };

    /* check wallet balance */
    const wallet = await CV_Wallet.get(user.id);
    if (wallet.usd_balance < investAmount)
      return { error: 'Insufficient wallet balance. Please deposit funds first.' };

    /* deduct balance */
    await CV_Wallet.deductBalance(user.id, investAmount);

    /* daily earnings = invest * daily_return_pct / 100 */
    const dailyEarnings = (investAmount * planDef.daily_return_pct) / 100;
    const startDate     = new Date();
    const endDate       = new Date(startDate);
    endDate.setDate(endDate.getDate() + planDef.duration_days);

    const { data, error } = await _sb.from('user_plans').insert({
      user_id:         user.id,
      plan_id:         planId,
      plan_name:       planDef.name,
      invest_amount:   investAmount,
      daily_earnings:  dailyEarnings,
      monthly_return_pct: planDef.monthly_return_pct,
      status:          'active',
      start_date:      startDate.toISOString(),
      end_date:        endDate.toISOString(),
      total_earned:    0
    }).select().single();

    return { data, error };
  },

  /* credit daily earnings to wallet — call this once per day per active plan */
  async creditDailyEarnings() {
    const user   = CV_Auth.getUser();
    const plans  = await this.getActivePlans(user.id);
    let totalCredited = 0;

    for (const plan of plans) {
      /* check if end_date passed */
      if (new Date(plan.end_date) < new Date()) {
        await _sb.from('user_plans').update({ status: 'completed' }).eq('id', plan.id);
        continue;
      }

      /* check last credit — avoid double-crediting */
      const lastCredit = plan.last_credit_date ? new Date(plan.last_credit_date) : null;
      const now        = new Date();
      const daysDiff   = lastCredit
        ? (now - lastCredit) / (1000 * 60 * 60 * 24)
        : 1;

      if (daysDiff < 0.9) continue; /* already credited today */

      const credit = plan.daily_earnings * Math.floor(daysDiff);
      await CV_Wallet.addBalance(user.id, credit);
      await _sb.from('user_plans').update({
        total_earned:    (plan.total_earned || 0) + credit,
        last_credit_date: now.toISOString()
      }).eq('id', plan.id);

      totalCredited += credit;
    }

    return totalCredited;
  },

  calcDailyEarnings(investAmount, planId) {
    const def = this.getPlanDef(planId);
    if (!def) return 0;
    return (investAmount * def.daily_return_pct) / 100;
  }
};

/* ═══════════════════════════════════════════════════════════
   TOAST
═══════════════════════════════════════════════════════════ */
const Toast = {
  show(msg, type = 'info', duration = 3500) {
    let c = document.getElementById('toast-container');
    if (!c) { c = document.createElement('div'); c.id = 'toast-container'; document.body.appendChild(c); }
    const icons = { success:'✅', error:'❌', info:'💡', warning:'⚠️' };
    const t = document.createElement('div');
    t.className = `toast ${type}`;
    t.innerHTML = `<span class="toast-icon">${icons[type]||'💡'}</span><span>${msg}</span>`;
    c.appendChild(t);
    setTimeout(() => { t.style.opacity='0'; t.style.transform='translateX(20px)'; t.style.transition='0.3s'; setTimeout(()=>t.remove(),300); }, duration);
  }
};

/* ═══════════════════════════════════════════════════════════
   COPY UTIL
═══════════════════════════════════════════════════════════ */
function copyToClipboard(text, msg = 'Copied!') {
  navigator.clipboard.writeText(text).then(() => Toast.show(msg, 'success'));
}

/* ═══════════════════════════════════════════════════════════
   BTC PRICE
═══════════════════════════════════════════════════════════ */
const BTCPrice = (() => {
  let _price = 67842, _cbs = [];
  function onChange(cb) { _cbs.push(cb); cb(_price); }
  async function _fetch() {
    try {
      const r = await fetch('https://api.coinbase.com/v2/prices/BTC-USD/spot');
      const d = await r.json();
      _price = parseFloat(d.data.amount);
      _cbs.forEach(cb => cb(_price));
    } catch { _cbs.forEach(cb => cb(_price)); }
  }
  _fetch(); setInterval(_fetch, 30000);
  return { onChange, get: () => _price, format: n => '$'+n.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2}) };
})();

/* ═══════════════════════════════════════════════════════════
   FORMAT HELPERS
═══════════════════════════════════════════════════════════ */
function fmtUSD(n)  { return '$' + (n||0).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2}); }
function fmtDate(d) { return new Date(d).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}); }
function daysLeft(endDate) { return Math.max(0, Math.ceil((new Date(endDate)-new Date())/(1000*60*60*24))); }
