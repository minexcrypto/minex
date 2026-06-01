/* --------------------------------------------------------------
   CRYPTOVAULT ? admin.js  ENTERPRISE EDITION
   Tables: profiles ? deposits ? withdrawals ? transactions ? contracts ? notifications ? referrals ? admin_logs
-------------------------------------------------------------- */
'use strict';

/* Route guard intentionally disabled here.
   Access control is enforced by Supabase auth + role checks below. */

/* --------------------------------------------------------------
   ?1  SUPABASE CLIENT
-------------------------------------------------------------- */
let sb = null;
const AUTH_IDLE_TIMEOUT_MS = 30 * 60 * 1000;
function assertSafePublicKey(key) {
  const token = String(key || '').trim();
  if (!token || /service_role/i.test(token) || /^sb_secret_/i.test(token)) {
    throw new Error('Unsafe Supabase key configuration.');
  }
  return token;
}
function initSupabaseClient() {
  const url = window.CRYPTOVAULT_SUPABASE_URL || '';
  const key = window.CRYPTOVAULT_SUPABASE_KEY || '';
  if (!url || !key) { AdminUI.banner('? Supabase credentials missing.', 'error'); return false; }
  if (typeof window.supabase?.createClient !== 'function') { AdminUI.banner('? Supabase SDK not found.', 'error'); return false; }
  try { sb = window.supabase.createClient(url, assertSafePublicKey(key)); console.log('[CryptoVault] Supabase client initialized.'); return true; }
  catch (err) { AdminUI.banner('? Supabase init error: ' + err.message, 'error'); return false; }
}

/* --------------------------------------------------------------
   ?2  DOM HELPERS
-------------------------------------------------------------- */
const $  = (sel, ctx = document) => { try { return ctx.querySelector(sel); } catch { return null; } };
const $$ = (sel, ctx = document) => { try { return [...ctx.querySelectorAll(sel)]; } catch { return []; } };
function setHTML(sel, html)  { const el = resolve(sel); if (el) el.innerHTML = html; }
function setText(sel, text)  { const el = resolve(sel); if (el) el.textContent = text; }
function show(sel)           { const el=resolve(sel); if(el){ el.classList.remove('hidden'); el.classList.add('open'); el.style.display=''; } }
function hide(sel)           { const el=resolve(sel); if(el){ el.classList.add('hidden'); el.classList.remove('open'); el.style.display='none'; } }
function on(sel, evt, fn, ctx = document) { const el = typeof sel === 'string' ? $(sel, ctx) : (sel || null); if (el) el.addEventListener(evt, fn); }
function resolve(sel) { return typeof sel === 'string' ? $(sel) : (sel || null); }
function escapeHtml(text='') {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function getLocalDayRange(date = new Date()) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

function getDateRangeForFilter(filter) {
  const normalized = String(filter || '').toLowerCase();
  if (normalized === 'all' || normalized === 'all-time' || normalized === '') return null;

  const { start, end } = getLocalDayRange(new Date());
  if (normalized === 'today') return { start, end };

  if (normalized === 'last-week') {
    start.setDate(start.getDate() - 6);
    return { start, end };
  }

  if (normalized === 'last-month') {
    start.setDate(start.getDate() - 29);
    return { start, end };
  }

  return null;
}

function filterUsersByCreatedAt(rows, filter) {
  const range = getDateRangeForFilter(filter);
  if (!range) return rows.slice();
  return rows.filter(row => {
    if (!row?.created_at) return false;
    const createdAt = new Date(row.created_at);
    return createdAt >= range.start && createdAt <= range.end;
  });
}

async function fetchAllProfiles(columns) {
  if (!sb) return [];
  const rows = [];
  const pageSize = 200;
  const maxRows = 2000;
  let from = 0;
  while (rows.length < maxRows) {
    const { data, error } = await sb
      .from('profiles')
      .select(columns)
      .order('created_at', { ascending: false })
      .range(from, from + pageSize - 1);
    if (error) throw error;
    const batch = data || [];
    rows.push(...batch);
    if (batch.length < pageSize) break;
    from += pageSize;
  }
  return rows;
}

const PLAN_DURATION_DAYS = {
  starter: 1460,
  silver: 1095,
  gold: 730,
  platinum: 365,
};

function getLocalPlanDurationDays(planName) {
  const key = String(planName || '').trim().toLowerCase();
  return PLAN_DURATION_DAYS[key] || 0;
}

const PLAN_SETUP_FALLBACK = {
  starter: { priceUsd: 500, hashrate: 10, durationDays: 1460, monthlyRate: 0.10 },
  silver: { priceUsd: 2500, hashrate: 50, durationDays: 1095, monthlyRate: 0.15 },
  gold: { priceUsd: 5000, hashrate: 100, durationDays: 730, monthlyRate: 0.20 },
  platinum: { priceUsd: 10000, hashrate: 300, durationDays: 365, monthlyRate: 0.25 },
};

function getLocalPlanSetup(planName) {
  const key = String(planName || '').trim().toLowerCase();
  return PLAN_SETUP_FALLBACK[key] || null;
}

function getLocalPlanPriceUsd(planName, fallbackPrice = null) {
  const plan = getLocalPlanSetup(planName);
  const price = Number(plan?.priceUsd ?? fallbackPrice);
  return Number.isFinite(price) && price > 0 ? price : 0;
}

function getLocalPlanHashrate(planName, fallbackHashrate = null) {
  const plan = getLocalPlanSetup(planName);
  const hashrate = Number(plan?.hashrate ?? fallbackHashrate);
  return Number.isFinite(hashrate) && hashrate > 0 ? hashrate : 0;
}

function getLocalPlanMonthlyRate(planName, fallbackRate = null) {
  const plan = getLocalPlanSetup(planName);
  const rate = Number(plan?.monthlyRate ?? fallbackRate);
  return Number.isFinite(rate) && rate > 0 ? rate : 0;
}

function getLocalPlanDailyProfitUsd(planName, priceUsd = null) {
  const price = Number.isFinite(Number(priceUsd)) ? Number(priceUsd) : getLocalPlanPriceUsd(planName, 0);
  const monthlyRate = getLocalPlanMonthlyRate(planName, 0);
  return price > 0 ? (price * monthlyRate) / 30 : 0;
}

function formatDateTimeLocalValue(date) {
  const d = date instanceof Date ? new Date(date.getTime()) : new Date(date || Date.now());
  if (!Number.isFinite(d.getTime())) return '';
  const pad = (value) => String(value).padStart(2, '0');
  const year = d.getFullYear();
  const month = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  const hours = pad(d.getHours());
  const minutes = pad(d.getMinutes());
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function parseDateTimeLocalValue(value) {
  const text = String(value || '').trim();
  if (!text) return null;
  const parsed = new Date(text);
  return Number.isFinite(parsed.getTime()) ? parsed : null;
}

/* --------------------------------------------------------------
   ?3  UI PRIMITIVES
-------------------------------------------------------------- */
const AdminUI = {
  toast(msg, type = 'info', ms = 4000) {
    let wrap = document.getElementById('_cvToastWrap');
    if (!wrap) {
      wrap = document.createElement('div'); wrap.id = '_cvToastWrap';
      Object.assign(wrap.style, { position:'fixed', bottom:'24px', right:'24px', zIndex:'9999', display:'flex', flexDirection:'column', gap:'10px' });
      document.body.appendChild(wrap);
    }
    const palette = { success:'#10b981', error:'#ef4444', info:'#f59e0b', warning:'#f97316' };
    const icons   = { success:'?', error:'?', info:'??', warning:'??' };
    const borderColor = palette[type] || palette.info;
    const t = document.createElement('div');
    t.style.cssText = 'background:#111720;border:1px solid #1e2d45;border-left:3px solid '+borderColor+';border-radius:12px;padding:14px 18px;display:flex;align-items:center;gap:12px;font-size:13px;color:#94a3b8;min-width:280px;max-width:400px;box-shadow:0 4px 24px rgba(0,0,0,.45);animation:_cvSlideIn .3s ease;';
    t.innerHTML = `<span style="font-size:17px;flex-shrink:0">${icons[type]||'??'}</span><span style="flex:1;line-height:1.45">${msg}</span>`;
    wrap.appendChild(t);
    setTimeout(() => { Object.assign(t.style,{opacity:'0',transform:'translateX(16px)',transition:'.3s ease'}); setTimeout(()=>t.remove(),320); }, ms);
  },
  banner(msg, type='warning') {
    const colours = { warning:'#f59e0b', error:'#ef4444', success:'#10b981', info:'#3b82f6' };
    const c = colours[type] || colours.warning;
    document.getElementById('_cvBanner')?.remove();
    const b = document.createElement('div'); b.id='_cvBanner';
    b.style.cssText = `background:${c}18;border-bottom:1px solid ${c}44;padding:11px 24px;font-size:13px;font-weight:600;color:${c};text-align:center;`;
    b.textContent = msg; document.body.prepend(b);
  },
  loading(msg='Loading?') { return `<div style="padding:48px;text-align:center;color:#475569;font-size:13px;"><div style="width:26px;height:26px;border:2px solid #1e2d45;border-top-color:#f59e0b;border-radius:50%;animation:_cvSpin .8s linear infinite;margin:0 auto 14px;"></div>${msg}</div>`; },
  error(msg='Failed to load data.') { return `<div style="padding:48px;text-align:center;color:#ef4444;font-size:13px;">? ${msg}</div>`; },
  empty(msg='No records found.') { return `<div style="padding:48px;text-align:center;color:#475569;font-size:13px;">?? ${msg}</div>`; },
  badge(status) {
    const map = {
      pending:{bg:'rgba(245,158,11,.15)',fg:'#f59e0b',label:'Pending'}, approved:{bg:'rgba(16,185,129,.15)',fg:'#10b981',label:'Approved'},
      rejected:{bg:'rgba(239,68,68,.15)',fg:'#ef4444',label:'Rejected'}, success:{bg:'rgba(16,185,129,.15)',fg:'#10b981',label:'Success'},
      failed:{bg:'rgba(239,68,68,.15)',fg:'#ef4444',label:'Failed'}, active:{bg:'rgba(16,185,129,.15)',fg:'#10b981',label:'Active'},
      inactive:{bg:'rgba(100,116,139,.15)',fg:'#64748b',label:'Inactive'}, completed:{bg:'rgba(59,130,246,.15)',fg:'#3b82f6',label:'Completed'},
      mining:{bg:'rgba(249,115,22,.15)',fg:'#f97316',label:'Mining'}, deposit:{bg:'rgba(16,185,129,.15)',fg:'#10b981',label:'Deposit'},
      withdrawal:{bg:'rgba(239,68,68,.15)',fg:'#ef4444',label:'Withdrawal'}, referral:{bg:'rgba(139,92,246,.15)',fg:'#8b5cf6',label:'Referral'},
      purchase:{bg:'rgba(59,130,246,.15)',fg:'#3b82f6',label:'Purchase'}, info:{bg:'rgba(59,130,246,.15)',fg:'#3b82f6',label:'Info'},
      warning:{bg:'rgba(245,158,11,.15)',fg:'#f59e0b',label:'Warning'}, error:{bg:'rgba(239,68,68,.15)',fg:'#ef4444',label:'Error'},
      announcement:{bg:'rgba(139,92,246,.15)',fg:'#8b5cf6',label:'Announcement'}, banned:{bg:'rgba(239,68,68,.15)',fg:'#ef4444',label:'Banned'},
      suspended:{bg:'rgba(245,158,11,.15)',fg:'#f59e0b',label:'Suspended'},
    };
    const s = map[String(status).toLowerCase()] || {bg:'rgba(100,116,139,.15)',fg:'#64748b',label:status||'?'};
    return `<span style="display:inline-flex;align-items:center;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:700;background:${s.bg};color:${s.fg};white-space:nowrap;">${s.label}</span>`;
  },
  activateTab(name) {
    $$('[data-admin-tab]').forEach(btn => btn.classList.toggle('active', btn.dataset.adminTab===name));
    $$('[data-admin-section]').forEach(sec => { const match=sec.dataset.adminSection===name; sec.classList.toggle('active',match); sec.style.display=match?'':'none'; });
    const TITLES = { overview:'Dashboard Overview', deposits:'Deposit Requests', withdrawals:'Withdrawal Requests', transactions:'Transaction History', contracts:'Mining Contracts', users:'User Management', referrals:'Referral Analytics', notifications:'Send Notifications', logs:'Security Logs', 'new-users':'New User', 'old-users':'Old User', 'edit-old-user':'Edit Old User' };
    setText('#adminPageTitle', TITLES[name]||name);
  },
};

/* inject keyframes */
(() => {
  if (document.getElementById('_cvKF')) return;
  const s = document.createElement('style'); s.id='_cvKF';
  s.textContent = `
    @keyframes _cvSlideIn { from{opacity:0;transform:translateX(14px)} to{opacity:1;transform:translateX(0)} }
    @keyframes _cvSpin { to{transform:rotate(360deg)} }
    .hidden { display:none !important; }
    .admin-btn { display:inline-flex;align-items:center;justify-content:center;gap:6px;padding:6px 13px;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;border:none;transition:all .2s;font-family:inherit;white-space:nowrap; }
    .admin-btn:disabled { opacity:.5;cursor:default; }
    .admin-btn-approve { background:rgba(16,185,129,.15);color:#10b981; } .admin-btn-approve:hover:not(:disabled) { background:rgba(16,185,129,.25); }
    .admin-btn-reject { background:rgba(239,68,68,.15);color:#ef4444; } .admin-btn-reject:hover:not(:disabled) { background:rgba(239,68,68,.25); }
    .admin-btn-outline { background:rgba(255,255,255,.04);color:#94a3b8;border:1px solid #1e2d45; } .admin-btn-outline:hover:not(:disabled) { border-color:#f59e0b;color:#f59e0b; }
    .admin-btn-primary { background:linear-gradient(135deg,#f59e0b,#f97316);color:#080b10; } .admin-btn-primary:hover:not(:disabled) { filter:brightness(1.1); }
    .admin-btn-danger { background:rgba(239,68,68,.15);color:#ef4444;border:1px solid rgba(239,68,68,.2); } .admin-btn-danger:hover:not(:disabled) { background:rgba(239,68,68,.25); }
    .admin-btn-blue { background:rgba(59,130,246,.15);color:#3b82f6;border:1px solid rgba(59,130,246,.2); } .admin-btn-blue:hover:not(:disabled) { background:rgba(59,130,246,.25); }
    .pagination-bar { display:flex;gap:6px;justify-content:center;padding:16px; }
    .pagination-bar button { min-width:32px;height:32px;border-radius:6px;background:#111720;border:1px solid #1e2d45;color:#94a3b8;font-size:12px;cursor:pointer; }
    .pagination-bar button.active { background:rgba(245,158,11,.15);color:#f59e0b;border-color:rgba(245,158,11,.3); }
    .modal-overlay { position:fixed;inset:0;background:rgba(0,0,0,.7);backdrop-filter:blur(6px);z-index:1000;display:none;align-items:center;justify-content:center;padding:20px;overflow-y:auto; }
    .modal-overlay.open { display:flex; }
    .modal { background:#111720;border:1px solid #1e2d45;border-radius:20px;width:100%;max-width:460px;padding:28px;animation:modalIn .3s ease; }
    .modal-xl { max-width:900px; }
    .modal-header { display:flex;align-items:center;justify-content:space-between;margin-bottom:20px; }
    .modal-close { width:32px;height:32px;border-radius:8px;background:#1a2236;border:none;cursor:pointer;color:#94a3b8;font-size:18px;display:flex;align-items:center;justify-content:center; }
    .modal-close:hover { background:rgba(239,68,68,.15);color:#ef4444; }
    .modal-body { max-height:70vh;overflow-y:auto; }
    .form-group { margin-bottom:14px; }
    .form-group label { display:block;font-size:12px;font-weight:600;color:#94a3b8;margin-bottom:6px; }
    .form-group input, .form-group select, .form-group textarea { width:100%;background:#0d1117;border:1px solid #1e2d45;border-radius:10px;padding:10px 14px;font-size:13px;color:#f1f5f9;outline:none; }
    .form-group input:focus, .form-group select:focus, .form-group textarea:focus { border-color:#f59e0b; }
    .filters { display:flex;gap:10px;flex-wrap:wrap;margin-bottom:16px;align-items:center; }
    .filters input, .filters select { background:#0d1117;border:1px solid #1e2d45;border-radius:10px;padding:8px 12px;font-size:13px;color:#f1f5f9;outline:none; }
    .global-search-wrap { display:flex;gap:8px; }
    .global-search-wrap input { background:#0d1117;border:1px solid #1e2d45;border-radius:10px;padding:8px 14px;font-size:13px;color:#f1f5f9;width:260px; }
    .table-container table { width:100%;border-collapse:collapse; }
    .table-container th { font-size:11px;font-weight:700;letter-spacing:.8px;text-transform:uppercase;color:#475569;padding:11px 16px;text-align:left;white-space:nowrap;border-bottom:1px solid #1e2d45;background:#0d1117; }
    .table-container td { padding:12px 16px;font-size:13px;color:#94a3b8;border-bottom:1px solid rgba(30,45,69,.5); }
    .table-container tr:hover td { background:rgba(255,255,255,.02); }
    .topbar { display:flex;align-items:center;justify-content:space-between;padding:0 28px;height:64px;border-bottom:1px solid #1e2d45;background:rgba(13,17,23,.9);backdrop-filter:blur(20px);position:sticky;top:0;z-index:90; }
    .topbar-left, .topbar-right { display:flex;align-items:center;gap:12px; }
    .card { background:#111720;border:1px solid #1e2d45;border-radius:18px;padding:24px; }
    .card-header { display:flex;align-items:center;justify-content:space-between;margin-bottom:16px; }
    .card-title { font-size:16px;font-weight:700;color:#f1f5f9; }
    .stats-grid { display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-bottom:24px; }
    @media(max-width:900px){ .stats-grid{grid-template-columns:repeat(2,1fr);} .global-search-wrap input{width:180px;} .modal-xl{max-width:100%;} }
    @media(max-width:600px){ .stats-grid{grid-template-columns:1fr;} .filters input,.filters select{width:100%;} .global-search-wrap{width:100%;} .global-search-wrap input{width:100%;} }
  `;
  document.head.appendChild(s);
})();

const TH = ['font-size:11px','font-weight:700','letter-spacing:.8px','text-transform:uppercase','color:#475569','padding:11px 16px','text-align:left','white-space:nowrap','border-bottom:1px solid #1e2d45'].join(';');
const TD = 'padding:12px 16px;font-size:13px;color:#94a3b8;border-bottom:1px solid rgba(30,45,69,.5);';

/* --------------------------------------------------------------
   ?4  ADMIN AUTH
-------------------------------------------------------------- */
const AdminAuth = {
  user: null,
  _roleAuth: window.CVAuthRole,
  async check() {
    if(!sb || !this._roleAuth) return false;
    try{
      const { session, user, role } = await this._roleAuth.getSessionWithRole(sb);
      if(!session || !user) return false;
      if(role !== 'admin') return 'forbidden';
      this.user=user;
      this._fillUI(user);
      return true;
    }catch{return false;}
  },
  async login(email,password){
    if(!sb || !this._roleAuth) throw new Error('Supabase client not ready.');
    const deviceId = localStorage.getItem('cv_auth_device_id') || 'admin-browser';
    try{
      const { data:precheck, error:preErr } = await sb.rpc('auth_rate_limit', {
        p_action: 'precheck',
        p_email: String(email || '').toLowerCase(),
        p_device_id: deviceId,
        p_success: null
      });
      if(!preErr && precheck && precheck.allowed===false){
        throw new Error(`Too many attempts. Try again in ${Math.max(1,Number(precheck.retry_after_seconds||0))}s.`);
      }
    }catch(e){
      if((e?.message||'').toLowerCase().includes('too many attempts')) throw e;
      console.warn('Rate limit precheck unavailable, continuing admin login:', e?.message||e);
    }

    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    if(error){
      try{
        await sb.rpc('auth_rate_limit', {
          p_action: 'record',
          p_email: String(email || '').toLowerCase(),
          p_device_id: deviceId,
          p_success: false
        });
      }catch{}
      throw new Error(error.message);
    }

    if(!data?.user?.email_confirmed_at){
      await sb.auth.signOut().catch(()=>{});
      throw new Error('Please verify your email before logging in.');
    }
    const role = await this._roleAuth.resolveUserRole(sb, data.user);
    if(role!=='admin'){
      await sb.auth.signOut().catch(()=>{});
      this._roleAuth.clearRole();
      throw new Error('Access denied.');
    }

    try{
      await sb.rpc('auth_rate_limit', {
        p_action: 'record',
        p_email: String(email || '').toLowerCase(),
        p_device_id: deviceId,
        p_success: true
      });
    }catch{}

    this._roleAuth.touchAuthActivity?.();
    this.user = data.user;
    this._fillUI(data.user);
    return data.user;
  },
  async logout(){ if(sb)await sb.auth.signOut().catch(()=>{}); this._roleAuth.clearRole(); this.user=null; window.location.replace('login.html'); },
  _fillUI(user){ setText('#adminUserEmail', user.email||''); },
};

/* --------------------------------------------------------------
   ?5  LOGIN FORM
-------------------------------------------------------------- */
function initLoginForm() {
  const form=document.getElementById('adminLoginForm'); const errEl=document.getElementById('adminLoginError'); const btnEl=document.getElementById('adminLoginBtn'); const passEl=document.getElementById('adminLoginPassword'); const eyeEl=document.getElementById('adminTogglePassword');
  if(!form)return;
  on(eyeEl,'click',()=>{ if(!passEl)return; passEl.type=passEl.type==='password'?'text':'password'; if(eyeEl)eyeEl.textContent=passEl.type==='password'?'??':'??'; });
  form.addEventListener('submit',async e=>{
    e.preventDefault(); const email=(document.getElementById('adminLoginEmail')?.value||'').trim(); const password=passEl?.value||'';
    if(!email||!password){ if(errEl)errEl.textContent='Email and password required.'; return; }
    if(errEl)errEl.textContent=''; if(btnEl){btnEl.disabled=true; btnEl.textContent='Signing in?';}
    try{ await AdminAuth.login(email,password); hide('#adminLoginScreen'); show('#adminAppShell'); await _bootPanel(); }
    catch(err){ if(errEl)errEl.textContent=err.message; }
    finally{ if(btnEl){btnEl.disabled=false; btnEl.textContent='Sign In';} }
  });
}

/* --------------------------------------------------------------
   ?6  BTC PRICE
-------------------------------------------------------------- */
const PriceService = {
  _handlers:[], current:null, onChange(fn){this._handlers.push(fn);},
  async fetch(){ try{ const ctrl=new AbortController(); const timer=setTimeout(()=>ctrl.abort(),8000); const res=await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd&include_24hr_change=true',{signal:ctrl.signal}); clearTimeout(timer); if(!res.ok)throw new Error('HTTP '+res.status); const json=await res.json(); const price=json?.bitcoin?.usd??null; const change=json?.bitcoin?.usd_24h_change??null; if(price!==null){this.current={price,change}; this._handlers.forEach(fn=>fn(this.current));} }catch{} },
  fmt(n){ if(n==null)return'?'; return '$'+Number(n).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2}); },
  start(ms=30000){ this.fetch(); setInterval(()=>this.fetch(),ms); },
};
function initPriceWidget(){
  PriceService.onChange(({price,change})=>{
    $$('.admin-btc-price').forEach(el=>el.textContent=PriceService.fmt(price));
    const up=change!=null&&change>=0; const changeStr=change!=null?((up?'? ':'? ')+Math.abs(change).toFixed(2)+'%'):'?'; const colour=change!=null?(up?'#10b981':'#ef4444'):'#64748b';
    $$('.admin-btc-change').forEach(el=>{ el.textContent=changeStr; el.style.color=colour; });
  });
  PriceService.start();
}

/* --------------------------------------------------------------
   ?7  OVERVIEW
-------------------------------------------------------------- */
const OverviewModule = {
  async load(){
    await Promise.allSettled([this._depositStats(),this._withdrawalStats(),this._userStats(),this._contractStats(),this._referralStats(),this._volumeStats()]);
    this._activityFeed();
  },
  async _depositStats(){ try{ const[{count:total,error:totalErr},{count:pending,error:pendingErr}]=await Promise.all([sb.from('deposits').select('id',{count:'exact',head:true}),sb.from('deposits').select('id',{count:'exact',head:true}).eq('status','pending')]); if(totalErr)throw totalErr; if(pendingErr)throw pendingErr; setText('#stat-pending-deposits',pending??0); setText('#sidebarDepositBadge',pending>0?String(pending):''); document.getElementById('sidebarDepositBadge').style.display=pending>0?'inline-flex':'none'; setText('#stat-total-deposits',total??0); }catch(err){console.warn(err);} },
  async _withdrawalStats(){ try{ const{count,error}=await sb.from('withdrawals').select('id',{count:'exact',head:true}).eq('status','pending'); if(error)throw error; setText('#stat-pending-withdrawals',count??0); setText('#sidebarWithdrawalBadge',count>0?String(count):''); document.getElementById('sidebarWithdrawalBadge').style.display=count>0?'inline-flex':'none'; }catch(err){console.warn(err);} },
  async _userStats(){ try{ const{count,error}=await sb.from('profiles').select('id',{count:'exact',head:true}); if(error)throw error; setText('#stat-total-users',count??'?'); }catch(err){console.warn(err);} },
  async _contractStats(){ try{ const{count,error}=await sb.from('contracts').select('id',{count:'exact',head:true}).eq('active',true); if(error)throw error; setText('#stat-active-contracts',count??0); }catch(err){console.warn(err);} },
  async _referralStats(){ try{ const{count,error}=await sb.from('referrals').select('id',{count:'exact',head:true}); if(error)throw error; setText('#stat-total-referrals',count??0); }catch(err){console.warn(err);} },
  async _volumeStats(){
    try{
      const contractCard = document.getElementById('stat-total-contract-volume')?.closest('.stat-card');
      const walletCard = document.getElementById('stat-total-wallet-balance')?.closest('.stat-card');
      if (contractCard) {
        const label = contractCard.querySelector('.stat-label');
        if (label) label.textContent = 'Contract Volume';
      }
      if (walletCard) {
        const label = walletCard.querySelector('.stat-label');
        if (label) label.textContent = 'Wallet Balance';
      }

      const sumContractsByField = async (field) => {
        const rows = [];
        const pageSize = 200;
        const maxRows = 2000;
        let from = 0;
        while (rows.length < maxRows) {
          const { data, error } = await sb
            .from('contracts')
            .select(field)
            .order('created_at', { ascending: false })
            .range(from, from + pageSize - 1);
          if (error) throw error;
          const batch = data || [];
          rows.push(...batch);
          if (batch.length < pageSize) break;
          from += pageSize;
        }
        return rows.reduce((s, r) => s + Number(r?.[field] || 0), 0);
      };

      let contractTotalValue = 0;
      try {
        contractTotalValue = await sumContractsByField('plan_price');
      } catch {
        try {
          contractTotalValue = await sumContractsByField('price_usdt');
        } catch {
          try {
            contractTotalValue = await sumContractsByField('amount');
          } catch {
            contractTotalValue = await sumContractsByField('total_earned');
          }
        }
      }

      const walletRows = await fetchAllProfiles('usdt_balance');
      const walletTotal = (walletRows || []).reduce((s, r) => s + Number(r.usdt_balance || 0), 0);

      setText('#stat-total-contract-volume', '$ ' + contractTotalValue.toFixed(2) + ' USDT');
      setText('#stat-total-wallet-balance', '$ ' + walletTotal.toFixed(2) + ' USDT');
    }catch(err){console.warn(err);}
  },
  async _activityFeed(){
    const wrap=document.getElementById('overviewActivityFeed'); if(!wrap)return;
    try{
      const{data}=await sb.from('admin_logs').select('action,admin_email,created_at').order('created_at',{ascending:false}).limit(20);
      const rows=data||[];
      if(!rows.length){ wrap.innerHTML=AdminUI.empty('No recent activity.'); return; }
      wrap.innerHTML=rows.map(r=>`<div style="padding:10px 0;border-bottom:1px solid rgba(30,45,69,.4);font-size:12px;color:#94a3b8;"><span style="color:#f59e0b;font-weight:600;">${r.action}</span> by ${r.admin_email||'Admin'} ? ${new Date(r.created_at).toLocaleString()}</div>`).join('');
    }catch{ wrap.innerHTML=AdminUI.error(); }
  }
};

/* --------------------------------------------------------------
   ?8  ADMIN LOGGER
-------------------------------------------------------------- */
async function logAdminAction(action,targetTable,targetId,oldValue,newValue){
  if(!sb||!AdminAuth.user)return;
  try{ await sb.from('admin_logs').insert({admin_id:AdminAuth.user.id,admin_email:AdminAuth.user.email||'',action,target_table:targetTable||'',target_id:String(targetId||''),old_value:oldValue||null,new_value:newValue||null,created_at:new Date().toISOString()}); }catch(err){console.warn('[Admin] logAdminAction failed:',err.message);}
}

/* --------------------------------------------------------------
   ?9  PAGINATION HELPERS
-------------------------------------------------------------- */
function paginate(rows, pageSize, page, containerId, renderFn, moduleName) {
  const total = rows.length;
  const pages = Math.ceil(total / pageSize) || 1;
  const start = (page - 1) * pageSize;
  const pageRows = rows.slice(start, start + pageSize);
  renderFn(pageRows);
  const wrap = document.getElementById(containerId);
  if (!wrap) return;
  let html = `<button ${page===1?'disabled':''} onclick="${moduleName}.goPage(${page-1})">?</button>`;
  for (let i=1;i<=pages;i++){ if(i===1||i===pages||(i>=page-2&&i<=page+2)){ html+=`<button class="${i===page?'active':''}" onclick="${moduleName}.goPage(${i})">${i}</button>`; } else if(i===page-3||i===page+3){ html+=`<span style="color:#475569;padding:0 4px;">?</span>`; } }
  html+=`<button ${page===pages?'disabled':''} onclick="${moduleName}.goPage(${page+1})">?</button>`;
  wrap.innerHTML=html;
}

/* --------------------------------------------------------------
   ?10  DEPOSITS MODULE
-------------------------------------------------------------- */
const DepositsModule = {
  _rows:[], _page:1, _pageSize:25, _profileMap:{},
  goPage(n){ this._page=n; this._renderPage(); },
  async load(statusFilter='all'){
    const container=document.getElementById('depositsTableWrap'); if(!container||!sb)return;
    setHTML(container,AdminUI.loading('Loading deposits?'));
    try{
      let q=sb.from('deposits').select('*').order('created_at',{ascending:false}).limit(250);
      if(statusFilter!=='all')q=q.eq('status',statusFilter);
      const{data,error}=await q; if(error)throw error; this._rows=data||[];
      const userIds=[...new Set(this._rows.map(r=>r.user_id).filter(Boolean))];
      this._profileMap=await _fetchProfiles(userIds);
      this._page=1; this._renderPage(); this._syncBadges(this._rows);
    }catch(err){ setHTML(container,AdminUI.error('Could not load deposits: '+err.message)); }
  },
  _renderPage(){
    const container=document.getElementById('depositsTableWrap'); const filter=$('#depositSearchInput')?.value?.toLowerCase()||'';
    let rows=this._rows; if(filter)rows=rows.filter(r=>((r.user_email||'')+(r.coin||'')+(r.tx_hash||'')).toLowerCase().includes(filter));
    const renderFn=(pageRows)=>this._render(container,pageRows);
    paginate(rows,this._pageSize,this._page,'depositsPagination',renderFn,'DepositsModule');
  },
  _render(container,rows){
    if(!rows.length){ setHTML(container,AdminUI.empty('No deposit records.')); return; }
    const tbodyHTML=rows.map(d=>{
      const coinLabel=d.coin==='usdt_bep20'?'USDT (BEP20)':'BTC'; const decimals=d.coin==='usdt_bep20'?2:8; const amount=Number(d.amount||0).toFixed(decimals);
      const email=d.user_email||(d.user_id?d.user_id.slice(0,8)+'?':'?'); const date=d.created_at?new Date(d.created_at).toLocaleString('en-US',{dateStyle:'medium',timeStyle:'short'}):'?';
      const screenshotBtn=d.screenshot_url?`<a href="${d.screenshot_url}" target="_blank" class="admin-btn admin-btn-outline" style="margin-left:4px;">??</a>`:'';
      const actions=d.status==='pending'
        ?`<button class="admin-btn admin-btn-approve" onclick="DepositsModule.updateStatus('${d.id}','approved')">? Approve</button><button class="admin-btn admin-btn-reject" onclick="DepositsModule.updateStatus('${d.id}','rejected')" style="margin-left:4px;">? Reject</button>${screenshotBtn}`
        :`<span style="font-size:12px;color:#475569">?</span>${screenshotBtn}`;
      return`<tr><td style="${TD};font-family:monospace;font-size:11px;color:#64748b">${String(d.id||'').slice(0,8)}?</td><td style="${TD}"><div style="font-weight:600;color:#f1f5f9;font-size:13px">${email}</div><div style="font-size:11px;color:#f59e0b;margin-top:2px">${this._profileMap?.[d.user_id]?.user_id || '?'}</div></td><td style="${TD};font-family:monospace;color:#fbbf24;font-weight:600">${amount} <span style="font-size:10px;color:#64748b">${coinLabel}</span></td><td style="${TD};font-size:12px;color:#94a3b8">${d.tx_hash?d.tx_hash.slice(0,20)+'?':'?'}</td><td style="${TD}">${AdminUI.badge(d.status)}</td><td style="${TD};font-size:12px;color:#64748b">${date}</td><td style="${TD}">${actions}<button class="admin-btn admin-btn-outline" onclick="DepositsModule.openEditModal('${d.id}')" style="margin-left:4px;">??</button><button class="admin-btn admin-btn-danger" onclick="DepositsModule.deleteDeposit('${d.id}')" style="margin-left:4px;">??</button></td></tr>`;
    }).join('');
    setHTML(container,`<table style="width:100%;border-collapse:collapse"><thead><tr><th style="${TH}">ID</th><th style="${TH}">User</th><th style="${TH}">Amount</th><th style="${TH}">TXID</th><th style="${TH}">Status</th><th style="${TH}">Date</th><th style="${TH}">Actions</th></tr></thead><tbody>${tbodyHTML}</tbody></table>`);
  },
  async updateStatus(depositId,newStatus){
    if(!sb||!depositId)return;
    if(this._processing&&this._processing.has(depositId))return;
    if(!this._processing)this._processing=new Set(); this._processing.add(depositId);
    try{
      const{data:currentRow,error:fetchErr}=await sb.from('deposits').select('id,status,user_id,amount,coin,user_email').eq('id',depositId).maybeSingle();
      if(fetchErr)throw fetchErr; if(!currentRow)throw new Error('Deposit not found');
      if(currentRow.status==='approved'){ AdminUI.toast('Deposit already approved.','warning'); return; }
      if(currentRow.status!=='pending'){ AdminUI.toast('Deposit status is '+currentRow.status,'info'); return; }
      const{error:updErr}=await sb.from('deposits').update({status:newStatus}).eq('id',depositId).eq('status','pending');
      if(updErr)throw updErr;
      await logAdminAction('deposit_'+newStatus,'deposits',depositId,{status:currentRow.status},{status:newStatus});
      this._rows=this._rows.map(r=>r.id===depositId?{...r,status:newStatus}:r); this._renderPage(); this._syncBadges(this._rows);
      if(newStatus==='approved'){ await this._creditBalance(depositId,currentRow); }
      AdminUI.toast(`Deposit marked as <strong>${newStatus}</strong>.`,newStatus==='approved'?'success':'warning');
    }catch(err){ AdminUI.toast('Update failed: '+err.message,'error'); }
    finally{ this._processing.delete(depositId); }
  },
  async _creditBalance(depositId,dep){
    if(!dep?.user_id||!dep?.amount)return;
    const field='usdt_balance';
    const{data:existingTx,error:txCheckErr}=await sb.from('transactions').select('id').eq('user_id',dep.user_id).eq('type','deposit').eq('amount',dep.amount).eq('status','success').gte('created_at',new Date(Date.now()-300000).toISOString()).maybeSingle();
    if(existingTx){ AdminUI.toast('Deposit already credited.','warning'); return; }
    const _createTx=async()=>{ const{error:txErr}=await sb.from('transactions').insert({user_id:dep.user_id,type:'deposit',amount:Number(dep.amount||0),coin:'usdt_bep20',status:'success',created_at:new Date().toISOString()}); if(txErr)throw txErr; };
    try{
      const{data:profile,error:fetchErr}=await sb.from('profiles').select(field).eq('id',dep.user_id).maybeSingle();
      if(fetchErr||profile==null)throw fetchErr||new Error('Profile not found');
      const newBal=Number(profile[field]||0)+Number(dep.amount);
      const{error:updErr}=await sb.from('profiles').update({[field]:newBal}).eq('id',dep.user_id);
      if(updErr)throw updErr; await _createTx();
    }catch(err){ AdminUI.toast('? Deposit approved but balance credit failed.','warning',7000); }
  },
  _syncBadges(rows){
    const pending=rows.filter(r=>r.status==='pending').length;
    const badge=document.getElementById('sidebarDepositBadge'); if(badge){ badge.textContent=pending>0?String(pending):''; badge.style.display=pending>0?'inline-flex':'none'; }
  },
  openCreateModal(){
    const body=document.getElementById('entityModalBody'); const title=document.getElementById('entityModalTitle');
    if(title)title.textContent='Create Manual Deposit';
    setHTML(body,`
      <div class="form-group"><label>User Email</label><input type="email" id="mdEmail" placeholder="user@example.com"></div>
      <div class="form-group"><label>Coin</label><select id="mdCoin"><option value="usdt_bep20">USDT</option></select></div>
      <div class="form-group"><label>Amount</label><input type="number" id="mdAmount" step="0.00000001"></div>
      <div class="form-group"><label>TX Hash (optional)</label><input type="text" id="mdTxHash" placeholder="0x..."></div>
      <button class="admin-btn admin-btn-primary" onclick="DepositsModule.createManual()">? Create & Approve</button>
    `);
    show('#entityModal');
  },
  async createManual(){
    const email=$('#mdEmail')?.value?.trim(); const coin=$('#mdCoin')?.value; const amount=parseFloat($('#mdAmount')?.value||0); const txHash=$('#mdTxHash')?.value?.trim()||'';
    if(!email||!amount){ AdminUI.toast('Email and amount required.','error'); return; }
    const{data:prof}=await sb.from('profiles').select('id').eq('email',email).maybeSingle(); if(!prof){ AdminUI.toast('User not found.','error'); return; }
    const{data:dep,error}=await sb.from('deposits').insert({user_id:prof.id,user_email:email,coin:'usdt_bep20',amount,tx_hash:txHash,status:'approved',created_at:new Date().toISOString()}).select().single();
    if(error){ AdminUI.toast('Failed: '+error.message,'error'); return; }
    await this._creditBalance(dep.id,dep); await logAdminAction('manual_deposit','deposits',dep.id,null,dep);
    AdminUI.toast('Manual deposit created & credited.','success'); hide('#entityModal'); this.load($('#depositStatusFilter')?.value||'all');
  },
  async openEditModal(id){
    const row=this._rows.find(r=>r.id===id); if(!row)return;
    const body=document.getElementById('entityModalBody'); const title=document.getElementById('entityModalTitle');
    if(title)title.textContent='Edit Deposit';
    setHTML(body,`
      <div class="form-group"><label>Amount</label><input type="number" id="edAmount" value="${row.amount}" step="0.00000001"></div>
      <div class="form-group"><label>Status</label><select id="edStatus"><option value="pending" ${row.status==='pending'?'selected':''}>Pending</option><option value="approved" ${row.status==='approved'?'selected':''}>Approved</option><option value="rejected" ${row.status==='rejected'?'selected':''}>Rejected</option></select></div>
      <div class="form-group"><label>TX Hash</label><input type="text" id="edTxHash" value="${row.tx_hash||''}"></div>
      <button class="admin-btn admin-btn-primary" onclick="DepositsModule.saveEdit('${id}')">?? Save</button>
    `);
    show('#entityModal');
  },
  async saveEdit(id){
    const amount=parseFloat($('#edAmount')?.value||0); const status=$('#edStatus')?.value; const txHash=$('#edTxHash')?.value?.trim()||'';
    const old=this._rows.find(r=>r.id===id);
    const{error}=await sb.from('deposits').update({amount,status,tx_hash:txHash}).eq('id',id);
    if(error){ AdminUI.toast('Save failed: '+error.message,'error'); return; }
    await logAdminAction('edit_deposit','deposits',id,old,{amount,status,tx_hash:txHash});
    this._rows=this._rows.map(r=>r.id===id?{...r,amount,status,tx_hash:txHash}:r); this._renderPage(); hide('#entityModal');
    AdminUI.toast('Deposit updated.','success');
  },
  async deleteDeposit(id){
    if(!confirm('Delete this deposit permanently?'))return;
    const{error}=await sb.from('deposits').delete().eq('id',id);
    if(error){ AdminUI.toast('Delete failed: '+error.message,'error'); return; }
    await logAdminAction('delete_deposit','deposits',id,null,null);
    this._rows=this._rows.filter(r=>r.id!==id); this._renderPage(); AdminUI.toast('Deposit deleted.','warning');
  },
  export(){
    const headers=['ID','User Email','Coin','Amount','TX Hash','Status','Created At'];
    const rows=this._rows.map(r=>[r.id,r.user_email||'',r.coin||'',r.amount||0,r.tx_hash||'',r.status||'',r.created_at||'']);
    downloadCSV('deposits.csv',[headers,...rows]);
  }
};

/* --------------------------------------------------------------
   ?11  WITHDRAWALS MODULE
-------------------------------------------------------------- */
const WithdrawalsModule = {
  _rows:[], _page:1, _pageSize:25, _profileMap:{},
  goPage(n){ this._page=n; this._renderPage(); },
  async load(statusFilter='all'){
    const container=document.getElementById('withdrawalsTableWrap'); if(!container||!sb)return;
    setHTML(container,AdminUI.loading('Loading withdrawals?'));
    try{
      let q=sb.from('withdrawals').select('*').order('created_at',{ascending:false}).limit(250);
      if(statusFilter!=='all')q=q.eq('status',statusFilter);
      const{data,error}=await q; if(error)throw error; this._rows=data||[];
      const userIds=[...new Set(this._rows.map(r=>r.user_id).filter(Boolean))];
      this._profileMap=await _fetchProfiles(userIds);
      this._page=1; this._renderPage(); this._syncBadges(this._rows);
    }catch(err){ setHTML(container,AdminUI.error('Could not load withdrawals: '+err.message)); }
  },
  _renderPage(){
    const container=document.getElementById('withdrawalsTableWrap'); const filter=$('#withdrawalSearchInput')?.value?.toLowerCase()||'';
    let rows=this._rows; if(filter)rows=rows.filter(r=>((r.user_email||'')+(r.address||'')).toLowerCase().includes(filter));
    paginate(rows,this._pageSize,this._page,'withdrawalsPagination',(pageRows)=>this._render(container,pageRows),'WithdrawalsModule');
  },
  _render(container,rows){
    if(!rows.length){ setHTML(container,AdminUI.empty('No withdrawals.')); return; }
    const html=rows.map(w=>{
      const coin=w.coin==='usdt_bep20'?'USDT':'BTC'; const amt=Number(w.amount||0).toFixed(w.coin==='usdt_bep20'?2:8);
      const date=w.created_at?new Date(w.created_at).toLocaleString('en-US',{dateStyle:'medium',timeStyle:'short'}):'?';
      const actions=w.status==='pending'
        ?`<button class="admin-btn admin-btn-approve" onclick="WithdrawalsModule.updateStatus('${w.id}','approved')">? Approve</button><button class="admin-btn admin-btn-reject" onclick="WithdrawalsModule.updateStatus('${w.id}','rejected')" style="margin-left:4px;">? Reject</button>`
        :`<span style="font-size:12px;color:#475569">?</span>`;
      return`<tr><td style="${TD};font-family:monospace;font-size:11px;color:#64748b">${String(w.id||'').slice(0,8)}?</td><td style="${TD}"><div style="font-weight:600;color:#f1f5f9;font-size:13px">${w.user_email||'?'}</div><div style="font-size:11px;color:#f59e0b;margin-top:2px">${this._profileMap?.[w.user_id]?.user_id || '?'}</div></td><td style="${TD};font-family:monospace;color:#fbbf24;font-weight:600">${amt} ${coin}</td><td style="${TD};font-size:12px;color:#94a3b8">${w.address?w.address.slice(0,20)+'?':'?'}</td><td style="${TD}">${AdminUI.badge(w.status)}</td><td style="${TD};font-size:12px;color:#64748b">${date}</td><td style="${TD}">${actions}<button class="admin-btn admin-btn-outline" onclick="WithdrawalsModule.openEditModal('${w.id}')" style="margin-left:4px;">??</button><button class="admin-btn admin-btn-danger" onclick="WithdrawalsModule.deleteWithdrawal('${w.id}')" style="margin-left:4px;">??</button></td></tr>`;
    }).join('');
    setHTML(container,`<table style="width:100%;border-collapse:collapse"><thead><tr><th style="${TH}">ID</th><th style="${TH}">User</th><th style="${TH}">Amount</th><th style="${TH}">Address</th><th style="${TH}">Status</th><th style="${TH}">Date</th><th style="${TH}">Actions</th></tr></thead><tbody>${html}</tbody></table>`);
  },
  async updateStatus(id,newStatus){
    if(!sb||!id)return;
    const{data:row,error:fetchErr}=await sb.from('withdrawals').select('*').eq('id',id).maybeSingle();
    if(fetchErr||!row){ AdminUI.toast('Withdrawal not found.','error'); return; }
    if(row.status!=='pending'){ AdminUI.toast('Already processed.','warning'); return; }
    const{error}=await sb.from('withdrawals').update({status:newStatus}).eq('id',id).eq('status','pending');
    if(error){ AdminUI.toast('Failed: '+error.message,'error'); return; }
    await logAdminAction('withdrawal_'+newStatus,'withdrawals',id,{status:row.status},{status:newStatus});
    if(newStatus==='approved'){
      if(row.wallet_debited !== true && !(await this._debitBalance(row))) return;
      if(!(await this._syncWithdrawalTransaction(row, 'success'))) return;
    } else if(newStatus==='rejected'){
      if(row.wallet_debited === true && !(await this._refundBalance(row))) return;
      if(!(await this._syncWithdrawalTransaction(row, 'rejected'))) return;
    }
    this._rows=this._rows.map(r=>r.id===id?{...r,status:newStatus}:r); this._renderPage(); this._syncBadges(this._rows);
    AdminUI.toast(`Withdrawal ${newStatus}.`,newStatus==='approved'?'success':'warning');
  },
  async _syncWithdrawalTransaction(row, status){
    if(!row?.id||!row?.user_id||!row?.amount) return false;
    const amount = Number(row.amount || 0);
    const txPatch = {
      status,
      withdrawal_id: row.id,
    };

    const { data: linkedRows, error: linkedErr } = await sb
      .from('transactions')
      .select('id')
      .eq('withdrawal_id', row.id)
      .eq('type', 'withdrawal')
      .limit(10);
    if (linkedErr) {
      AdminUI.toast('Transaction lookup failed: ' + linkedErr.message, 'error');
      return false;
    }
    if ((linkedRows || []).length) {
      const { error } = await sb
        .from('transactions')
        .update(txPatch)
        .in('id', (linkedRows || []).map(r => r.id));
      if (error) {
        AdminUI.toast('Transaction update failed: ' + error.message, 'error');
        return false;
      }
      return true;
    }

    const { data: fallbackRows, error: fallbackErr } = await sb
      .from('transactions')
      .select('id,created_at,status,withdrawal_id')
      .eq('user_id', row.user_id)
      .eq('type', 'withdrawal')
      .eq('amount', amount)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(20);
    if (fallbackErr) {
      AdminUI.toast('Transaction lookup failed: ' + fallbackErr.message, 'error');
      return false;
    }

    const exactTime = new Date(row.created_at || Date.now()).getTime();
    const nearRows = (fallbackRows || []).filter(tx => {
      const txTime = new Date(tx.created_at || 0).getTime();
      return Math.abs(txTime - exactTime) <= 60 * 60 * 1000;
    });

    const rowsToUpdate = nearRows.length ? nearRows : (fallbackRows || []);

    if (!rowsToUpdate.length) {
      const { error: insertErr } = await sb.from('transactions').insert({
        user_id: row.user_id,
        type: 'withdrawal',
        amount,
        coin: row.coin || 'usdt_bep20',
        status,
        withdrawal_id: row.id,
        created_at: row.created_at || new Date().toISOString(),
      });
      if (insertErr) {
        AdminUI.toast('Transaction insert failed: ' + insertErr.message, 'error');
        return false;
      }
      return true;
    }

    const { error: updateErr } = await sb
      .from('transactions')
      .update(txPatch)
      .in('id', rowsToUpdate.map(r => r.id));
    if (updateErr) {
      AdminUI.toast('Transaction update failed: ' + updateErr.message, 'error');
      return false;
    }
    return true;
  },
  async _debitBalance(row){
    if(!row?.user_id||!row?.amount)return false;
    if(row.wallet_debited === true) return true;
    const field='usdt_balance';
    const{data:prof}=await sb.from('profiles').select(field).eq('id',row.user_id).maybeSingle();
    if(!prof)return false;
    const current=Number(prof[field]||0); const debit=Number(row.amount||0);
    if(current<debit){ AdminUI.toast('? User balance insufficient for debit.','warning',6000); return false; }
    const{error}=await sb.from('profiles').update({[field]:current-debit}).eq('id',row.user_id);
    if(error){ AdminUI.toast('Balance debit failed.','error'); return false; }
    const{error:txErr}=await sb.from('transactions').insert({user_id:row.user_id,type:'withdrawal',amount:debit,coin:row.coin||'usdt_bep20',status:'success',withdrawal_id:row.id||null,created_at:new Date().toISOString()});
    if(txErr){ AdminUI.toast('Transaction save failed.','error'); return false; }
    await sb.from('withdrawals').update({wallet_debited:true}).eq('id',row.id).catch(()=>{});
    return true;
  },
  async _refundBalance(row){
    if(!row?.user_id||!row?.amount)return false;
    const field='usdt_balance';
    const{data:prof}=await sb.from('profiles').select(field).eq('id',row.user_id).maybeSingle();
    if(!prof)return false;
    const current=Number(prof[field]||0); const refund=Number(row.amount||0);
    const{error}=await sb.from('profiles').update({[field]:current+refund}).eq('id',row.user_id);
    if(error){ AdminUI.toast('Balance refund failed.','error'); return false; }
    return true;
  },
  _syncBadges(rows){
    const pending=rows.filter(r=>r.status==='pending').length;
    const badge=document.getElementById('sidebarWithdrawalBadge'); if(badge){ badge.textContent=pending>0?String(pending):''; badge.style.display=pending>0?'inline-flex':'none'; }
  },
  openCreateModal(){
    const body=document.getElementById('entityModalBody'); const title=document.getElementById('entityModalTitle');
    if(title)title.textContent='Create Manual Withdrawal';
    setHTML(body,`
      <div class="form-group"><label>User Email</label><input type="email" id="mwEmail" placeholder="user@example.com"></div>
      <div class="form-group"><label>Coin</label><select id="mwCoin"><option value="usdt_bep20">USDT</option></select></div>
      <div class="form-group"><label>Amount</label><input type="number" id="mwAmount" step="0.00000001"></div>
      <div class="form-group"><label>Address</label><input type="text" id="mwAddress" placeholder="Wallet address"></div>
      <button class="admin-btn admin-btn-primary" onclick="WithdrawalsModule.createManual()">? Create & Approve</button>
    `);
    show('#entityModal');
  },
  async createManual(){
    const email=$('#mwEmail')?.value?.trim(); const coin=$('#mwCoin')?.value; const amount=parseFloat($('#mwAmount')?.value||0); const address=$('#mwAddress')?.value?.trim()||'';
    if(!email||!amount||!address){ AdminUI.toast('All fields required.','error'); return; }
    const{data:prof}=await sb.from('profiles').select('id,usdt_balance').eq('email',email).maybeSingle();
    if(!prof){ AdminUI.toast('User not found.','error'); return; }
    const field='usdt_balance'; const bal=Number(prof[field]||0);
    if(bal<amount){ AdminUI.toast('Insufficient user balance.','error'); return; }
    const{data:w,error}=await sb.from('withdrawals').insert({user_id:prof.id,user_email:email,coin:'usdt_bep20',amount,address,status:'approved',wallet_debited:true,created_at:new Date().toISOString()}).select().single();
    if(error){ AdminUI.toast('Failed: '+error.message,'error'); return; }
    await sb.from('profiles').update({[field]:bal-amount}).eq('id',prof.id);
    await sb.from('transactions').insert({user_id:prof.id,type:'withdrawal',amount,coin:'usdt_bep20',status:'success',withdrawal_id:w.id,created_at:new Date().toISOString()});
    await logAdminAction('manual_withdrawal','withdrawals',w.id,null,w);
    AdminUI.toast('Manual withdrawal created.','success'); hide('#entityModal'); this.load($('#withdrawalStatusFilter')?.value||'all');
  },
  openEditModal(id){
    const row=this._rows.find(r=>r.id===id); if(!row)return;
    const body=document.getElementById('entityModalBody'); const title=document.getElementById('entityModalTitle');
    if(title)title.textContent='Edit Withdrawal';
    setHTML(body,`
      <div class="form-group"><label>Amount</label><input type="number" id="ewAmount" value="${row.amount}" step="0.00000001"></div>
      <div class="form-group"><label>Status</label><select id="ewStatus"><option value="pending" ${row.status==='pending'?'selected':''}>Pending</option><option value="approved" ${row.status==='approved'?'selected':''}>Approved</option><option value="rejected" ${row.status==='rejected'?'selected':''}>Rejected</option></select></div>
      <div class="form-group"><label>Address</label><input type="text" id="ewAddress" value="${row.address||''}"></div>
      <button class="admin-btn admin-btn-primary" onclick="WithdrawalsModule.saveEdit('${id}')">?? Save</button>
    `);
    show('#entityModal');
  },
  async saveEdit(id){
    const amount=parseFloat($('#ewAmount')?.value||0); const status=$('#ewStatus')?.value; const address=$('#ewAddress')?.value?.trim()||'';
    const old=this._rows.find(r=>r.id===id);
    const{error}=await sb.from('withdrawals').update({amount,status,address}).eq('id',id);
    if(error){ AdminUI.toast('Save failed: '+error.message,'error'); return; }
    await logAdminAction('edit_withdrawal','withdrawals',id,old,{amount,status,address});
    this._rows=this._rows.map(r=>r.id===id?{...r,amount,status,address}:r); this._renderPage(); hide('#entityModal');
    AdminUI.toast('Withdrawal updated.','success');
  },
  async deleteWithdrawal(id){
    if(!confirm('Delete this withdrawal?'))return;
    const{error}=await sb.from('withdrawals').delete().eq('id',id);
    if(error){ AdminUI.toast('Delete failed: '+error.message,'error'); return; }
    await logAdminAction('delete_withdrawal','withdrawals',id,null,null);
    this._rows=this._rows.filter(r=>r.id!==id); this._renderPage(); AdminUI.toast('Deleted.','warning');
  },
  export(){
    const headers=['ID','User Email','Coin','Amount','Address','Status','Created At'];
    const rows=this._rows.map(r=>[r.id,r.user_email||'',r.coin||'',r.amount||0,r.address||'',r.status||'',r.created_at||'']);
    downloadCSV('withdrawals.csv',[headers,...rows]);
  }
};

/* --------------------------------------------------------------
   ?12  USERS MODULE
-------------------------------------------------------------- */
const UsersModule = {
  _rows:[], _page:1, _pageSize:25,
  goPage(n){ this._page=n; this._renderPage(); },
  async load(){
    const container=document.getElementById('usersTableWrap'); if(!container||!sb)return;
    setHTML(container,AdminUI.loading('Loading users?'));
    try{
      const{data,error}=await sb.from('profiles').select('id,email,name,user_id,usdt_balance,level,is_active,is_admin,is_banned,is_suspended,ref_code,phone,country,created_at').order('created_at',{ascending:false}).limit(250);
      if(error)throw error; this._rows=data||[]; this._page=1; this._renderPage(); setText('#stat-total-users',this._rows.length);
    }catch(err){ setHTML(container,AdminUI.error('Could not load users: '+err.message)); }
  },
  _renderPage(){
    const container=document.getElementById('usersTableWrap'); const filter=$('#userSearchInput')?.value?.toLowerCase()||''; const statusFilter=$('#userStatusFilter')?.value||'all';
    let rows=this._rows; if(filter)rows=rows.filter(r=>((r.email||'')+(r.name||'')+(r.id||'')).toLowerCase().includes(filter));
    if(statusFilter==='active')rows=rows.filter(r=>r.is_active!==false&&!r.is_banned&&!r.is_suspended);
    if(statusFilter==='suspended')rows=rows.filter(r=>r.is_suspended===true);
    if(statusFilter==='banned')rows=rows.filter(r=>r.is_banned===true);
    paginate(rows,this._pageSize,this._page,'usersPagination',(pageRows)=>this._render(container,pageRows),'UsersModule');
  },
  _render(container,rows){
    if(!rows.length){ setHTML(container,AdminUI.empty('No users found.')); return; }
    const html=rows.map(u=>{
      const joined=u.created_at?new Date(u.created_at).toLocaleDateString('en-US',{dateStyle:'medium'}):'?';
      const usdt=Number(u.usdt_balance||0).toFixed(2); let status='active'; if(u.is_banned)status='banned'; else if(u.is_suspended)status='suspended'; else if(u.is_active===false)status='inactive';
      return`<tr><td style="${TD};font-family:monospace;font-size:11px;color:#f59e0b;font-weight:600">${u.user_id || String(u.id||'').slice(0,8)+'?'}</td><td style="${TD}"><div style="font-weight:600;color:#f1f5f9;font-size:13px">${u.name||'?'}</div><div style="font-size:11px;color:#64748b;margin-top:2px">${u.email||'?'}</div></td><td style="${TD};font-family:monospace;color:#fbbf24;font-weight:500">${usdt} <span style="font-size:10px;color:#64748b">USDT</span></td><td style="${TD};font-size:12px;color:#94a3b8">${u.level||'Standard'}</td><td style="${TD}">${AdminUI.badge(status)}${u.is_admin?'<span style="margin-left:4px;">??</span>':''}</td><td style="${TD};font-size:12px;color:#64748b">${joined}</td><td style="${TD}"><button class="admin-btn admin-btn-outline" onclick="UsersModule.openUserModal('${u.id}')">?? View</button><button class="admin-btn admin-btn-outline" onclick="UsersModule.toggleActive('${u.id}')" style="margin-left:4px;">${u.is_active!==false?'Suspend':'Reinstate'}</button></td></tr>`;
    }).join('');
    setHTML(container,`<table style="width:100%;border-collapse:collapse"><thead><tr><th style="${TH}">ID</th><th style="${TH}">User</th><th style="${TH}">USDT Balance</th><th style="${TH}">Level</th><th style="${TH}">Status</th><th style="${TH}">Joined</th><th style="${TH}">Actions</th></tr></thead><tbody>${html}</tbody></table>`);
  },
  async openUserModal(userId){
    const u=this._rows.find(r=>r.id===userId); if(!u)return;
    const modal=document.getElementById('userDetailModal'); const body=document.getElementById('userDetailBody');
    setText('#udModalTitle', (u.name||u.email||'User') + ' Details');
    /* Fetch financial aggregates */
    const[{data:deps},{data:withs},{data:txs},{data:contracts},{data:refs}]=await Promise.all([
      sb.from('deposits').select('amount,status,coin').eq('user_id',userId),
      sb.from('withdrawals').select('amount,status,coin').eq('user_id',userId),
      sb.from('transactions').select('amount,type').eq('user_id',userId),
      sb.from('contracts').select('hashrate,daily_profit,active').eq('user_id',userId),
      sb.from('referrals').select('earnings').eq('referrer_id',userId),
    ]);
    const totalDep=(deps||[]).filter(d=>d.status==='approved').reduce((s,d)=>s+Number(d.amount||0),0);
    const totalWit=(withs||[]).filter(w=>w.status==='approved').reduce((s,w)=>s+Number(w.amount||0),0);
    const mining=(txs||[]).filter(t=>t.type==='mining'||t.type==='mining_reward').reduce((s,t)=>s+Number(t.amount||0),0);
    const refEarn=(refs||[]).reduce((s,r)=>s+Number(r.earnings||0),0);
    const activeContracts=(contracts||[]).filter(c=>c.active===true);
    const totalHash=activeContracts.reduce((s,c)=>s+Number(c.hashrate||0),0);
    const dailyProfit=activeContracts.reduce((s,c)=>s+Number(c.daily_profit||0),0);
    const statusText=u.is_banned?'Banned':u.is_suspended?'Suspended':u.is_active!==false?'Active':'Inactive';
    setHTML(body,`
      <div class="grid-2" style="margin-bottom:20px;">
        <div class="card"><div class="card-title">?? User Info</div>
          <div style="font-size:13px;color:#94a3b8;line-height:1.8;">
            <div><strong style="color:#f1f5f9;">Name:</strong> ${u.name||'?'}</div>
            <div><strong style="color:#f1f5f9;">Email:</strong> ${u.email||'?'}</div>
            <div><strong style="color:#f1f5f9;">Phone:</strong> ${u.phone||'?'}</div>
            <div><strong style="color:#f1f5f9;">Country:</strong> ${u.country||'?'}</div>
            <div><strong style="color:#f1f5f9;">User ID:</strong> <span style="color:#f59e0b;font-weight:700;">${u.user_id || '?'}</span></div>
            <div><strong style="color:#f1f5f9;">Internal UUID:</strong> <span style="font-size:11px;color:#64748b;">${u.id}</span></div>
            <div><strong style="color:#f1f5f9;">Ref Code:</strong> ${u.ref_code||'?'}</div>
            <div><strong style="color:#f1f5f9;">Joined:</strong> ${u.created_at?new Date(u.created_at).toLocaleString():'?'}</div>
            <div><strong style="color:#f1f5f9;">Status:</strong> ${AdminUI.badge(statusText)} ${u.is_admin?'<span style="color:#f59e0b;">?? Admin</span>':''}</div>
          </div>
        </div>
        <div class="card"><div class="card-title">?? Financial Stats</div>
          <div style="font-size:13px;color:#94a3b8;line-height:1.8;">
            <div><strong style="color:#f1f5f9;">Wallet Balance:</strong> ${Number(u.usdt_balance||0).toFixed(2)} USDT</div>
            <div><strong style="color:#f1f5f9;">Total Deposited:</strong> ${totalDep.toFixed(2)} USDT</div>
            <div><strong style="color:#f1f5f9;">Total Withdrawn:</strong> ${totalWit.toFixed(2)} USDT</div>
            <div><strong style="color:#f1f5f9;">Mining Income:</strong> ${mining.toFixed(2)} USDT</div>
            <div><strong style="color:#f1f5f9;">Referral Earnings:</strong> ${refEarn.toFixed(2)} USDT</div>
            <div><strong style="color:#f1f5f9;">Active Contracts:</strong> ${activeContracts.length} ? ${totalHash.toFixed(1)} TH/s</div>
            <div><strong style="color:#f1f5f9;">Daily Profit:</strong> ${dailyProfit.toFixed(2)} USDT</div>
          </div>
        </div>
      </div>
      <div class="card" style="margin-bottom:20px;"><div class="card-title">?? Admin Actions</div>
        <div style="display:flex;flex-wrap:wrap;gap:8px;">
          <button class="admin-btn admin-btn-primary" onclick="UsersModule.editBalance('${u.id}')">?? Edit Balance</button>
          <button class="admin-btn ${u.is_suspended?'admin-btn-approve':'admin-btn-reject'}" onclick="UsersModule.toggleSuspend('${u.id}')">${u.is_suspended?'Reinstate':'Suspend'}</button>
          <button class="admin-btn ${u.is_banned?'admin-btn-approve':'admin-btn-danger'}" onclick="UsersModule.toggleBan('${u.id}')">${u.is_banned?'Unban':'Ban'}</button>
          <button class="admin-btn ${u.is_admin?'admin-btn-danger':'admin-btn-blue'}" onclick="UsersModule.toggleAdmin('${u.id}')">${u.is_admin?'Remove Admin':'Make Admin'}</button>
          <button class="admin-btn admin-btn-outline" onclick="UsersModule.forceLogout('${u.id}')">?? Force Logout</button>
          <button class="admin-btn admin-btn-outline" onclick="UsersModule.resetPassword('${u.id}')">?? Reset Password</button>
        </div>
      </div>
    `);
    show('#userDetailModal');
  },
  closeModal(){ hide('#userDetailModal'); },
  async editBalance(userId){
    const u=this._rows.find(r=>r.id===userId); if(!u)return;
    const newUsdt=prompt('New USDT balance (current: '+u.usdt_balance+')', u.usdt_balance||0); if(newUsdt===null)return;
    const old={usdt_balance:u.usdt_balance};
    const patch={usdt_balance:parseFloat(newUsdt)||0};
    const{error}=await sb.from('profiles').update(patch).eq('id',userId);
    if(error){ AdminUI.toast('Failed: '+error.message,'error'); return; }
    await logAdminAction('edit_balance','profiles',userId,old,patch);
    u.usdt_balance=patch.usdt_balance; this._renderPage();
    AdminUI.toast('Balance updated.','success');
  },
  async toggleActive(userId){
    const u=this._rows.find(r=>r.id===userId); if(!u)return;
    const newState=u.is_active===false?true:false;
    const{error}=await sb.from('profiles').update({is_active:newState}).eq('id',userId);
    if(error){ AdminUI.toast('Failed: '+error.message,'error'); return; }
    await logAdminAction(newState?'reinstate_user':'suspend_user','profiles',userId,{is_active:u.is_active},{is_active:newState});
    u.is_active=newState; u.is_suspended=false; u.is_banned=false; this._renderPage();
    AdminUI.toast(newState?'User reinstated.':'User suspended.','success');
  },
  async toggleSuspend(userId){
    const u=this._rows.find(r=>r.id===userId); if(!u)return;
    const newState=!u.is_suspended;
    const{error}=await sb.from('profiles').update({is_suspended:newState,is_active:!newState}).eq('id',userId);
    if(error){ AdminUI.toast('Failed: '+error.message,'error'); return; }
    await logAdminAction(newState?'suspend_user':'reinstate_user','profiles',userId,{is_suspended:u.is_suspended},{is_suspended:newState});
    u.is_suspended=newState; u.is_active=!newState; this._renderPage(); this.closeModal();
    AdminUI.toast(newState?'User suspended.':'User reinstated.','success');
  },
  async toggleBan(userId){
    const u=this._rows.find(r=>r.id===userId); if(!u)return;
    const newState=!u.is_banned;
    const{error}=await sb.from('profiles').update({is_banned:newState,is_active:!newState}).eq('id',userId);
    if(error){ AdminUI.toast('Failed: '+error.message,'error'); return; }
    await logAdminAction(newState?'ban_user':'unban_user','profiles',userId,{is_banned:u.is_banned},{is_banned:newState});
    u.is_banned=newState; u.is_active=!newState; this._renderPage(); this.closeModal();
    AdminUI.toast(newState?'User banned.':'User unbanned.','warning');
  },
  async toggleAdmin(userId){
    const u=this._rows.find(r=>r.id===userId); if(!u)return;
    const newState=!u.is_admin;
    const{error}=await sb.from('profiles').update({is_admin:newState}).eq('id',userId);
    if(error){ AdminUI.toast('Failed: '+error.message,'error'); return; }
    await logAdminAction(newState?'promote_admin':'remove_admin','profiles',userId,{is_admin:u.is_admin},{is_admin:newState});
    u.is_admin=newState; this._renderPage(); this.closeModal();
    AdminUI.toast(newState?'Promoted to admin.':'Admin access removed.',newState?'success':'warning');
  },
  async forceLogout(userId){
    if(!confirm('Force logout this user?'))return;
    await logAdminAction('force_logout','profiles',userId,null,null);
    AdminUI.toast('Force logout signal sent. (Implement edge function if needed)','warning');
  },
  async resetPassword(userId){
    const u=this._rows.find(r=>r.id===userId); if(!u||!u.email){ AdminUI.toast('No email.','error'); return; }
    const{error}=await sb.auth.resetPasswordForEmail(u.email);
    if(error){ AdminUI.toast('Failed: '+error.message,'error'); return; }
    await logAdminAction('reset_password','profiles',userId,null,null);
    AdminUI.toast('Password reset link sent to '+u.email,'success');
  },
  export(){
    const headers=['ID','Email','Name','USDT Balance','Level','Active','Admin','Banned','Suspended','Ref Code','Created'];
    const rows=this._rows.map(r=>[r.id,r.email||'',r.name||'',r.usdt_balance||0,r.level||'',r.is_active!==false?'Yes':'No',r.is_admin?'Yes':'No',r.is_banned?'Yes':'No',r.is_suspended?'Yes':'No',r.ref_code||'',r.created_at||'']);
    downloadCSV('users.csv',[headers,...rows]);
  }
};
window.UsersModule=UsersModule;

/* --------------------------------------------------------------
   ?12A  NEW USERS MODULE
-------------------------------------------------------------- */
const NewUsersModule = {
  _rows:[], _page:1, _pageSize:25,
  goPage(n){ this._page=n; this._renderPage(); },
  async load(dateFilter='today'){
    const container=document.getElementById('newUsersTableWrap'); if(!container||!sb)return;
    setHTML(container,AdminUI.loading('Loading new users?'));
    try{
      const data = await fetchAllProfiles('id,email,name,user_id,usdt_balance,level,is_active,is_admin,is_banned,is_suspended,ref_code,phone,country,created_at');
      this._rows = filterUsersByCreatedAt(data||[], dateFilter);
      this._page = 1;
      this._renderPage();
      setText('#newUsersCount', String(this._rows.length));
    }catch(err){
      setHTML(container,AdminUI.error('Could not load new users: '+err.message));
    }
  },
  _renderPage(){
    const container=document.getElementById('newUsersTableWrap'); if(!container)return;
    const filter=($('#newUserSearchInput')?.value||'').toLowerCase().trim();
    const dateFilter=$('#newUserDateFilter')?.value||'today';
    let rows=filterUsersByCreatedAt(this._rows, dateFilter);
    if(filter) rows=rows.filter(r=>((r.email||'')+(r.name||'')+(r.user_id||'')+(r.id||'')).toLowerCase().includes(filter));
    paginate(rows,this._pageSize,this._page,'newUsersPagination',(pageRows)=>this._render(container,pageRows),'NewUsersModule');
  },
  _render(container,rows){
    if(!rows.length){ setHTML(container,AdminUI.empty('No new users found for the selected date range.')); return; }
    const html=rows.map(u=>{
      const joined=u.created_at?new Date(u.created_at).toLocaleString('en-US',{dateStyle:'medium',timeStyle:'short'}):'?';
      const usdt=Number(u.usdt_balance||0).toFixed(8);
      let status='active';
      if(u.is_banned) status='banned'; else if(u.is_suspended) status='suspended'; else if(u.is_active===false) status='inactive';
      return`<tr><td style="${TD};font-family:monospace;font-size:11px;color:#f59e0b;font-weight:600">${u.user_id || String(u.id||'').slice(0,8)+'?'}</td><td style="${TD}"><div style="font-weight:600;color:#f1f5f9;font-size:13px">${u.name||'?'}</div><div style="font-size:11px;color:#64748b;margin-top:2px">${u.email||'?'}</div></td><td style="${TD};font-family:monospace;color:#fbbf24;font-weight:500">${usdt} USDT</td><td style="${TD};font-size:12px;color:#94a3b8">${u.level||'Standard'}</td><td style="${TD}">${AdminUI.badge(status)}${u.is_admin?'<span style="margin-left:4px;">??</span>':''}</td><td style="${TD};font-size:12px;color:#64748b">${joined}</td><td style="${TD}"><button class="admin-btn admin-btn-outline" onclick="UsersModule.openUserModal('${u.id}')">?? View</button></td></tr>`;
    }).join('');
    setHTML(container,`<table style="width:100%;border-collapse:collapse"><thead><tr><th style="${TH}">ID</th><th style="${TH}">User</th><th style="${TH}">USDT Balance</th><th style="${TH}">Level</th><th style="${TH}">Status</th><th style="${TH}">Joined</th><th style="${TH}">Actions</th></tr></thead><tbody>${html}</tbody></table>`);
  },
  export(){
    const dateFilter=$('#newUserDateFilter')?.value||'today';
    const rows=filterUsersByCreatedAt(this._rows, dateFilter);
    const headers=['ID','Email','Name','User ID','USDT Balance','Level','Active','Admin','Banned','Suspended','Ref Code','Created'];
    const data=rows.map(r=>[r.id,r.email||'',r.name||'',r.user_id||'',r.usdt_balance||0,r.level||'',r.is_active!==false?'Yes':'No',r.is_admin?'Yes':'No',r.is_banned?'Yes':'No',r.is_suspended?'Yes':'No',r.ref_code||'',r.created_at||'']);
    downloadCSV('new_users.csv',[headers,...data]);
  }
};
window.NewUsersModule=NewUsersModule;

/* --------------------------------------------------------------
   ?12B  OLD USERS MODULE
-------------------------------------------------------------- */
const OldUsersModule = {
  _rows:[], _page:1, _pageSize:25,
  goPage(n){ this._page=n; this._renderPage(); },
  async load(dateFilter='all-time'){
    const container=document.getElementById('oldUsersTableWrap'); if(!container||!sb)return;
    setHTML(container,AdminUI.loading('Loading old users?'));
    try{
      this._rows = await fetchAllProfiles('id,email,name,user_id,usdt_balance,level,is_active,is_admin,is_banned,is_suspended,ref_code,phone,country,created_at');
      this._page = 1;
      this._renderPage();
      setText('#oldUsersCount', String(this._rows.length));
      EditOldUserModule._rows = this._rows.map(row => ({ ...row, _activePlan: '', _activeContract: null }));
    }catch(err){
      setHTML(container,AdminUI.error('Could not load old users: '+err.message));
    }
  },
  _renderPage(){
    const container=document.getElementById('oldUsersTableWrap'); if(!container)return;
    const filter=($('#oldUserSearchInput')?.value||'').toLowerCase().trim();
    const dateFilter=$('#oldUserDateFilter')?.value||'all-time';
    let rows=filterUsersByCreatedAt(this._rows, dateFilter);
    if(filter) rows=rows.filter(r=>((r.email||'')+(r.name||'')+(r.user_id||'')+(r.id||'')+(r.phone||'')+(r.country||'')).toLowerCase().includes(filter));
    paginate(rows,this._pageSize,this._page,'oldUsersPagination',(pageRows)=>this._render(container,pageRows),'OldUsersModule');
  },
  _render(container,rows){
    if(!rows.length){ setHTML(container,AdminUI.empty('No users found.')); return; }
    const html=rows.map(u=>{
      const joined=u.created_at?new Date(u.created_at).toLocaleDateString('en-US',{dateStyle:'medium'}):'?';
      const usdt=Number(u.usdt_balance||0).toFixed(8);
      let status='active';
      if(u.is_banned) status='banned'; else if(u.is_suspended) status='suspended'; else if(u.is_active===false) status='inactive';
      return`<tr><td style="${TD};font-family:monospace;font-size:11px;color:#f59e0b;font-weight:600">${u.user_id || String(u.id||'').slice(0,8)+'?'}</td><td style="${TD}"><div style="font-weight:600;color:#f1f5f9;font-size:13px">${u.name||'?'}</div><div style="font-size:11px;color:#64748b;margin-top:2px">${u.email||'?'}</div></td><td style="${TD};font-family:monospace;color:#fbbf24;font-weight:500">${usdt} USDT</td><td style="${TD};font-size:12px;color:#94a3b8">${u.level||'Standard'}</td><td style="${TD}">${AdminUI.badge(status)}${u.is_admin?'<span style="margin-left:4px;">??</span>':''}</td><td style="${TD};font-size:12px;color:#64748b">${joined}</td><td style="${TD}"><button class="admin-btn admin-btn-outline" onclick="UsersModule.openUserModal('${u.id}')">?? View</button></td></tr>`;
    }).join('');
    setHTML(container,`<table style="width:100%;border-collapse:collapse"><thead><tr><th style="${TH}">ID</th><th style="${TH}">User</th><th style="${TH}">USDT Balance</th><th style="${TH}">Level</th><th style="${TH}">Status</th><th style="${TH}">Joined</th><th style="${TH}">Actions</th></tr></thead><tbody>${html}</tbody></table>`);
  },
  export(){
    const dateFilter=$('#oldUserDateFilter')?.value||'all-time';
    const rows=filterUsersByCreatedAt(this._rows, dateFilter);
    const headers=['ID','Email','Name','User ID','USDT Balance','Level','Active','Admin','Banned','Suspended','Ref Code','Created'];
    const data=rows.map(r=>[r.id,r.email||'',r.name||'',r.user_id||'',r.usdt_balance||0,r.level||'',r.is_active!==false?'Yes':'No',r.is_admin?'Yes':'No',r.is_banned?'Yes':'No',r.is_suspended?'Yes':'No',r.ref_code||'',r.created_at||'']);
    downloadCSV('old_users.csv',[headers,...data]);
  },
  async bulkEditFiltered(){
    const search = ($('#oldUserSearchInput')?.value || '').trim();
    const dateFilter = $('#oldUserDateFilter')?.value || 'all-time';
    const filtered = filterUsersByCreatedAt(this._rows, dateFilter).filter(r => {
      if (!search) return true;
      return `${r.id||''} ${r.user_id||''} ${r.email||''} ${r.name||''} ${r.phone||''} ${r.country||''}`.toLowerCase().includes(search.toLowerCase());
    });
    if (!filtered.length) { AdminUI.toast('No filtered users found.','warning'); return; }
    EditOldUserModule._rows = filtered.map(row => ({ ...row, _activePlan:'', _activeContract:null }));
    const oldSearch = $('#editOldUserSearchInput');
    const oldPlan = $('#editOldUserPlanFilter');
    if (oldSearch) oldSearch.value = search;
    if (oldPlan) oldPlan.value = 'all';
    AdminUI.activateTab('edit-old-user');
    EditOldUserModule.openBulkEditForm();
  }
};
window.OldUsersModule=OldUsersModule;

/* --------------------------------------------------------------
   ?12C  EDIT OLD USER MODULE
-------------------------------------------------------------- */
const EditOldUserModule = {
  _rows:[], _page:1, _pageSize:15, _selectedUser:null,
  goPage(n){ this._page=n; this._renderPage(); },
  _normalizePlan(plan){
    const text=String(plan||'').trim().toLowerCase().replace(/\bplan\b/g,'').replace(/\s+/g,' ').trim();
    if(text.includes('starter')) return 'starter';
    if(text.includes('silver')) return 'silver';
    if(text.includes('gold')) return 'gold';
    if(text.includes('platinum')) return 'platinum';
    return text;
  },
  _prettyPlan(plan){
    const normalized=this._normalizePlan(plan);
    return normalized ? normalized.charAt(0).toUpperCase()+normalized.slice(1) : '?';
  },
  _statusFromRow(row){
    if(row?.is_banned) return 'banned';
    if(row?.is_suspended) return 'suspended';
    if(row?.is_active===false) return 'inactive';
    return 'active';
  },
  _activeContractForRow(row){
    return row?._activeContract || null;
  },
  _historyContractForRow(row){
    const selectedId = ($('#eouHistoryContract')?.value || this._selectedHistoryContractId || '').trim();
    const contracts = Array.isArray(row?._contracts) ? row._contracts : [];
    if (selectedId) {
      if (selectedId.startsWith('plan:')) {
        const planName = this._normalizePlan(selectedId.slice(5)) || 'starter';
        const planSetup = this._historyPlanSetup(planName);
        return {
          id: selectedId,
          plan: planName,
          active: true,
          daily_profit: planSetup.dailyProfit,
          hashrate: planSetup.hashrate,
          total_earned: 0,
          created_at: null,
          __synthetic: true,
        };
      }
      const picked = contracts.find(contract => String(contract.id) === selectedId);
      if (picked) return picked;
    }
    const existing = contracts.find(contract => contract.active === true) || contracts[0] || row?._activeContract || null;
    if (existing) return existing;
    const fallbackPlan = this._normalizePlan(row?._activePlan || 'starter') || 'starter';
    const fallbackSetup = this._historyPlanSetup(fallbackPlan);
    return {
      id: `plan:${fallbackPlan}`,
      plan: fallbackPlan,
      active: true,
      daily_profit: fallbackSetup.dailyProfit,
      hashrate: fallbackSetup.hashrate,
      total_earned: 0,
      created_at: null,
      __synthetic: true,
    };
  },
  _contractDurationDays(contract){
    return getLocalPlanDurationDays(contract?.plan);
  },
  _historyRowLabel(row){
    const name = row?.name || row?.email || row?.user_id || 'Unknown user';
    const email = row?.email || row?.user_id || '';
    const plan = this._prettyPlan(row?._activePlan);
    return `${name}${email ? ' | ' + email : ''}${plan ? ' | ' + plan : ''}`;
  },
  _historyContractLabel(contract){
    if (!contract) return 'No contract found';
    const plan = this._prettyPlan(contract.plan);
    const duration = this._contractDurationDays(contract);
    const price = Number.isFinite(Number(contract.plan_price)) ? Number(contract.plan_price) : getLocalPlanPriceUsd(contract?.plan, 0);
    const priceText = price > 0 ? `$${Number(price).toFixed(2)}` : 'Auto';
    const status = contract.__synthetic ? 'Template' : (contract.active ? 'Active' : 'Inactive');
    return `${plan} | ${status} | ${duration || 'Unknown'} days | ${priceText}`;
  },
  _historyPlanSetup(planName){
    const normalized = this._normalizePlan(planName || 'starter') || 'starter';
    const plan = getLocalPlanSetup(normalized) || {};
    const priceUsd = getLocalPlanPriceUsd(normalized, plan.priceUsd || 0);
    const hashrate = getLocalPlanHashrate(normalized, plan.hashrate || 0);
    const durationDays = getLocalPlanDurationDays(normalized) || Number(plan.durationDays || 0);
    const monthlyRate = getLocalPlanMonthlyRate(normalized, plan.monthlyRate || 0);
    const dailyProfit = getLocalPlanDailyProfitUsd(normalized, priceUsd);
    return { normalized, priceUsd, hashrate, durationDays, monthlyRate, dailyProfit };
  },
  _setDateField(selector, value){
    const el = $(selector);
    if (el) el.value = formatDateTimeLocalValue(value);
  },
  _readDateField(selector){
    return parseDateTimeLocalValue($(selector)?.value || '');
  },
  _historyTargetRow(){
    const selectedId = ($('#eouHistoryUser')?.value || this._selectedUser?.id || '').trim();
    if (selectedId) {
      const picked = this._rows.find(row => row.id === selectedId);
      if (picked) return picked;
    }
    return this._selectedUser || this._rows[0] || null;
  },
  _renderHistoryUserOptions(selectedId = ''){
    return this._rows.map(row => {
      const id = String(row.id || '');
      const selected = id === selectedId ? ' selected' : '';
      return `<option value="${escapeHtml(id)}"${selected}>${escapeHtml(this._historyRowLabel(row))}</option>`;
    }).join('');
  },
  _renderHistoryContractOptions(row, selectedId = ''){
    const contracts = Array.isArray(row?._contracts) ? row._contracts : [];
    if (!contracts.length) {
      return Object.keys(PLAN_SETUP_FALLBACK).map(plan => {
        const selected = `plan:${plan}` === selectedId ? ' selected' : '';
        return `<option value="plan:${plan}"${selected}>${escapeHtml(this._prettyPlan(plan))} Template</option>`;
      }).join('');
    }
    return contracts.map(contract => {
      const id = String(contract.id || '');
      const selected = id === selectedId ? ' selected' : '';
      const label = this._historyContractLabel(contract);
      return `<option value="${escapeHtml(id)}"${selected}>${escapeHtml(label)}</option>`;
    }).join('');
  },
  _refreshHistoryPreview(){
    const row = this._historyTargetRow();
    if (!row) return;
    const contract = this._historyContractForRow(row);
    const planSetup = this._historyPlanSetup($('#eouHistoryPlan')?.value || contract?.plan || row?._activePlan || 'starter');
    const years = Math.max(1, Number.parseFloat($('#eouHistoryYears')?.value || '1') || 1);
    const daysField = $('#eouHistoryDays');
    const creditField = $('#eouHistoryCredit');
    const remainingField = $('#eouHistoryRemaining');
    const infoField = $('#eouHistoryContractInfo');
    const requestedDays = Math.max(1, Math.round(years * 365));
    const durationDays = contract ? this._contractDurationDays(contract) : planSetup.durationDays;
    const backfillDays = durationDays ? Math.min(requestedDays, durationDays) : requestedDays;
    const remainingDays = durationDays ? Math.max(0, durationDays - backfillDays) : null;
    const now = new Date();
    const defaultProfileStart = new Date(now.getTime() - (requestedDays * 24 * 60 * 60 * 1000));
    const defaultPurchaseTime = new Date(defaultProfileStart.getTime() + (60 * 60 * 1000));
    const depositTime = defaultProfileStart;
    const purchaseTime = defaultPurchaseTime;
    const runningDays = Math.max(1, Math.min(durationDays || requestedDays, Math.round((now.getTime() - purchaseTime.getTime()) / (24 * 60 * 60 * 1000)) + 1));
    const expiryDate = durationDays ? new Date(purchaseTime.getTime() + (durationDays * 24 * 60 * 60 * 1000)) : null;
    const dailyProfit = Number.parseFloat(contract?.daily_profit || planSetup.dailyProfit || 0) || 0;
    const total = dailyProfit * backfillDays;

    if (daysField) daysField.value = String(backfillDays);
    if (creditField) creditField.value = `${total.toFixed(8)} USDT`;
    if (remainingField) remainingField.value = durationDays ? `${remainingDays} days` : 'Unlimited';
    if (infoField) {
      const depositDateText = depositTime.toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });
      const purchaseDateText = purchaseTime.toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });
      const priceText = `$${Number(planSetup.priceUsd || 0).toFixed(2)}`;
      if (requestedDays > durationDays && durationDays > 0) {
        infoField.textContent = `Selected contract expires after ${durationDays} days, so only ${backfillDays} days can be backfilled and future payouts stop after expiry.`;
      } else if (durationDays > 0) {
        infoField.textContent = `${this._prettyPlan(planSetup.normalized)} selected. Deposit ${priceText}, purchase ${priceText}, deposit on ${depositDateText}, purchase on ${purchaseDateText}. ${remainingDays} future payout day${remainingDays === 1 ? '' : 's'} left.`;
      } else {
        infoField.textContent = `${this._prettyPlan(planSetup.normalized)} selected. Deposit ${priceText}, purchase ${priceText}, deposit on ${depositDateText}, purchase on ${purchaseDateText}.`;
      }
    }
  },
  _bulkRows(){
    return this._filteredRows();
  },
  _syncBulkActionFields(){
    const action=($('#eouBulkAction')?.value||'wallet_add').toLowerCase();
    const walletSection=document.getElementById('eouBulkWalletSection');
    const transactionSection=document.getElementById('eouBulkTransactionSection');
    const dailySection=document.getElementById('eouBulkDailySection');
    if(walletSection) walletSection.style.display = action==='wallet_add' ? '' : 'none';
    if(transactionSection) transactionSection.style.display = action==='transaction' ? '' : 'none';
    if(dailySection) dailySection.style.display = action==='daily_profit' ? '' : 'none';
  },
  openBulkEditForm(){
    const rows=this._bulkRows();
    if(!rows.length){ AdminUI.toast('No filtered users found. Load users and choose a plan first.','warning'); return; }
    const title=document.getElementById('oldUserEditModalTitle');
    const body=document.getElementById('oldUserEditModalBody');
    if(title) title.textContent='Bulk Edit Filtered Users';
    setHTML(body,`
      <div style="margin-bottom:14px;padding:12px 14px;border:1px solid #1e2d45;border-radius:12px;background:#0d1117;color:#94a3b8;font-size:13px;">
        Applies to <strong style="color:#f1f5f9;">${rows.length}</strong> filtered user${rows.length===1?'':'s'}.
      </div>

      <div class="form-group">
        <label>Action</label>
        <select id="eouBulkAction">
          <option value="wallet_add">Wallet Balance Add</option>
          <option value="transaction">Transaction Entry</option>
          <option value="daily_profit">Set Daily Profit</option>
        </select>
      </div>

      <div id="eouBulkWalletSection">
        <div class="form-group">
          <label>Amount to Add (USDT)</label>
          <input type="number" id="eouBulkWalletAmount" step="0.01" placeholder="2">
        </div>
      </div>

      <div id="eouBulkTransactionSection" style="display:none;">
        <div class="form-group">
          <label>Transaction Amount</label>
          <input type="number" id="eouBulkTxAmount" step="0.00000001" placeholder="10">
        </div>
        <div class="form-group">
          <label>Direction</label>
          <select id="eouBulkTxDirection">
            <option value="credit">Positive / Credit</option>
            <option value="debit">Negative / Debit</option>
          </select>
        </div>
        <div class="form-group">
          <label>Transaction Name</label>
          <input type="text" id="eouBulkTxName" placeholder="Manual Adjustment">
        </div>
        <div class="form-group">
          <label>Coin</label>
          <select id="eouBulkTxCoin">
            <option value="usdt_bep20">USDT</option>
            
          </select>
        </div>
      </div>

      <div id="eouBulkDailySection" style="display:none;">
        <div class="form-group">
          <label>Daily Profit</label>
          <input type="number" id="eouBulkDailyProfit" step="0.00000001" placeholder="2">
        </div>
      </div>

      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:18px;">
        <button class="admin-btn admin-btn-primary" onclick="EditOldUserModule.saveBulkEdit()">Save Bulk Changes</button>
        <button class="admin-btn admin-btn-outline" onclick="EditOldUserModule.closeBulkEditForm()">Cancel</button>
      </div>
    `);
    show('#oldUserEditModal');
    this._syncBulkActionFields();
    on('#eouBulkAction','change',()=>this._syncBulkActionFields());
  },
  closeBulkEditForm(){
    hide('#oldUserEditModal');
    setHTML('#oldUserEditModalBody','');
  },
  openHistoryEditForm(userId=''){
    const row = userId ? this._rows.find(item => item.id === userId) : (this._selectedUser || this._rows[0] || null);
    if(!row){ AdminUI.toast('No user available. Load users first.','warning'); return; }
    this._selectedUser = row;
    this._selectedHistoryContractId = '';
    const title = document.getElementById('historyEditModalTitle');
    const userSelect = document.getElementById('eouHistoryUser');
    const contractSelect = document.getElementById('eouHistoryContract');
    if(title) title.textContent = `History Edit - ${row.name || row.email || row.user_id || 'User'}`;
    if(userSelect){
      userSelect.innerHTML = this._renderHistoryUserOptions(row.id);
      userSelect.value = row.id;
    }
    const contract = this._historyContractForRow(row);
    if(contractSelect){
      contractSelect.innerHTML = this._renderHistoryContractOptions(row, contract?.id || '');
      contractSelect.value = contract?.id || '';
    }
    this._selectedHistoryContractId = contract?.id || '';
    $('#eouHistoryYears').value = '4';
    this._refreshHistoryPreview();
    show('#historyEditModal');
  },
  closeHistoryEditForm(){
    hide('#historyEditModal');
  },
  async saveHistoryEdit(){
    const row = this._historyTargetRow();
    if(!row){ AdminUI.toast('No user selected.','error'); return; }
    const selectedContract = this._historyContractForRow(row);
    const planName = this._normalizePlan(selectedContract?.plan || row?._activePlan || 'starter') || 'starter';
    const planSetup = this._historyPlanSetup(planName);
    const existingContract = selectedContract && !selectedContract.__synthetic && selectedContract.id ? selectedContract : null;
    const years = Number.parseFloat($('#eouHistoryYears')?.value || '');
    if(!Number.isFinite(years) || years <= 0){ AdminUI.toast('Enter a valid number of years.','error'); return; }
    const depositAmount = Number(planSetup.priceUsd || 0);
    const purchaseAmount = Number(planSetup.priceUsd || 0);
    const dailyProfit = Number(existingContract?.daily_profit || planSetup.dailyProfit || 0);
    const requestedDays = Math.max(1, Math.round(years * 365));
    const depositTime = new Date(Date.now() - (requestedDays * 24 * 60 * 60 * 1000));
    const purchaseTime = new Date(depositTime.getTime() + (60 * 60 * 1000));
    const contractStart = new Date(purchaseTime.getTime());
    const firstMiningAt = new Date(contractStart.getTime() + (24 * 60 * 60 * 1000));

    const durationDays = existingContract ? this._contractDurationDays(existingContract) : planSetup.durationDays;
    const backfillDays = durationDays ? Math.min(requestedDays, durationDays) : requestedDays;
    const totalReward = Number((dailyProfit * backfillDays).toFixed(8));
    const now = Date.now();
    const elapsedDays = Math.max(1, Math.round((now - purchaseTime.getTime()) / (24 * 60 * 60 * 1000)) + 1);
    const runningDays = durationDays ? Math.min(durationDays, elapsedDays) : elapsedDays;
    const remainingDays = durationDays ? Math.max(0, durationDays - runningDays) : null;
    const progress = durationDays ? Number(Math.min(100, (runningDays / durationDays) * 100).toFixed(2)) : 0;
    const originalSnapshot = {
      usdt_balance: Number(row.usdt_balance || 0),
      created_at: row.created_at || null,
      plan: existingContract?.plan || null,
      daily_profit: existingContract?.daily_profit ?? null,
      total_earned: existingContract?.total_earned ?? null,
      has_contract: Boolean(existingContract?.id),
    };

    try{
      let contract = existingContract || null;
      const updateOrCreateHistoryTx = async (type, createdAt, amount) => {
        const { data: existingRows, error: lookupErr } = await sb
          .from('transactions')
          .select('id')
          .eq('user_id', row.id)
          .eq('type', type)
          .limit(20);
        if (lookupErr) throw lookupErr;
        const ids = (existingRows || []).map(item => item.id).filter(Boolean);
        if (ids.length) {
          const { error } = await sb.from('transactions').update({ created_at: createdAt.toISOString(), amount: Number(amount) }).in('id', ids);
          if (error) throw error;
          return { created: false, count: ids.length };
        }
        if (!(Number.isFinite(Number(amount)) && Number(amount) > 0)) {
          return { created: false, count: 0 };
        }
        const { error } = await sb.from('transactions').insert({
          user_id: row.id,
          type,
          amount: Number(amount),
          coin: 'usdt_bep20',
          status: 'success',
          created_at: createdAt.toISOString(),
        });
        if (error) throw error;
        return { created: true, count: 1 };
      };

      const depositTxResult = await updateOrCreateHistoryTx('deposit', depositTime, depositAmount);
      const purchaseTxResult = await updateOrCreateHistoryTx('purchase', purchaseTime, purchaseAmount);

      if (!contract) {
        const contractPayload = {
          user_id: row.id,
          plan: planName,
          hashrate: planSetup.hashrate,
          daily_profit: dailyProfit,
          active: true,
          progress,
          created_at: contractStart.toISOString(),
          last_payout_at: totalReward > 0
            ? new Date(firstMiningAt.getTime() + ((backfillDays - 1) * 24 * 60 * 60 * 1000)).toISOString()
            : contractStart.toISOString(),
          next_payout_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          total_earned: 0,
        };
        const { data: createdContract, error: createContractErr } = await sb.from('contracts').insert(contractPayload).select().single();
        if (createContractErr) throw createContractErr;
        contract = createdContract;
      }

      if(totalReward > 0){
        const rows = [];
        const txAmount = Number(dailyProfit.toFixed(8));
        for(let i = 0; i < backfillDays; i++){
          rows.push({
            user_id: row.id,
            type: 'mining',
            amount: txAmount,
            coin: 'usdt',
            status: 'success',
            created_at: new Date(firstMiningAt.getTime() + (i * 24 * 60 * 60 * 1000)).toISOString(),
          });
        }
        for(let i = 0; i < rows.length; i += 100){
          const chunk = rows.slice(i, i + 100);
          const { error } = await sb.from('transactions').insert(chunk);
          if(error) throw error;
        }
      }

      const setupWalletDelta = 0;
      const rewardDelta = totalReward > 0 ? totalReward : 0;

      if(setupWalletDelta !== 0 || rewardDelta !== 0){
        const currentWallet = Number(row.usdt_balance || 0);
        const nextWallet = Number((currentWallet + setupWalletDelta + rewardDelta).toFixed(8));
        const { error } = await sb.from('profiles').update({ usdt_balance: nextWallet }).eq('id', row.id);
        if(error) throw error;
        row.usdt_balance = nextWallet;
      }

      if(contract?.id){
        const currentTotalEarned = Number(contract.total_earned || 0);
        const nextTotalEarned = Number((currentTotalEarned + rewardDelta).toFixed(8));
        const nextContractPatch = {
          plan: planName,
          hashrate: planSetup.hashrate,
          daily_profit: dailyProfit,
          progress,
          total_earned: nextTotalEarned,
          created_at: contractStart.toISOString(),
          active: true,
        };
        nextContractPatch.last_payout_at = totalReward > 0
          ? new Date(firstMiningAt.getTime() + ((backfillDays - 1) * 24 * 60 * 60 * 1000)).toISOString()
          : contractStart.toISOString();
        nextContractPatch.next_payout_at = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
        const { error } = await sb.from('contracts').update(nextContractPatch).eq('id', contract.id);
        if(error) throw error;
        contract.total_earned = nextTotalEarned;
        contract.created_at = contractStart.toISOString();
        contract.plan = planName;
        contract.hashrate = planSetup.hashrate;
        contract.daily_profit = dailyProfit;
        contract.progress = nextContractPatch.progress;
        contract.active = true;
        contract.last_payout_at = nextContractPatch.last_payout_at;
        contract.next_payout_at = nextContractPatch.next_payout_at;
      }

      const backdateProfile = true;
      if(backdateProfile){
        const { error } = await sb.from('profiles').update({ created_at: depositTime.toISOString() }).eq('id', row.id);
        if(error) throw error;
        row.created_at = depositTime.toISOString();
      }

      await logAdminAction(
        'history_edit',
        'profiles',
        row.id,
        originalSnapshot,
        {
          mode: existingContract ? 'existing_contract' : 'initial_profile_setup',
          plan: planName,
          years,
          days: backfillDays,
          daily_profit: dailyProfit,
          total_reward: totalReward,
          deposit_amount: depositAmount,
          purchase_amount: purchaseAmount,
          contract_id: contract.id,
          contract_plan: contract.plan,
          contract_hashrate: contract.hashrate || planSetup.hashrate,
          contract_duration_days: durationDays,
          deposit_tx_created_at: depositTime.toISOString(),
          purchase_tx_created_at: purchaseTime.toISOString(),
          deposit_tx_created: depositTxResult.created,
          purchase_tx_created: purchaseTxResult.created,
          mining_start_at: firstMiningAt.toISOString(),
          running_days: runningDays,
          remaining_days: remainingDays,
          plan_ends_at: durationDays ? new Date(contractStart.getTime() + (durationDays * 24 * 60 * 60 * 1000)).toISOString() : null,
        }
      );

      AdminUI.toast(`History updated for ${row.name || row.email || 'selected user'}.`, 'success', 6000);
      this.closeHistoryEditForm();
      await this.loadUsers();
    }catch(err){
      AdminUI.toast('History edit failed: '+err.message,'error',7000);
    }
  },
  closeEditForm(){
    return this.closeBulkEditForm();
  },
  async loadUsers(){
    const container=document.getElementById('editOldUserTableWrap'); if(!container||!sb)return;
    setHTML(container,AdminUI.loading('Loading users?'));
    try{
      const[{data:profiles,error:profilesError},{data:contracts,error:contractsError}]=await Promise.all([
        sb.from('profiles').select('id,email,name,user_id,phone,country,usdt_balance,is_active,is_banned,is_suspended,created_at').order('created_at',{ascending:false}).limit(250),
        sb.from('contracts').select('id,user_id,plan,daily_profit,total_earned,active,progress,created_at,last_payout_at,next_payout_at').order('created_at',{ascending:false}).limit(250)
      ]);
      if(profilesError) throw profilesError;
      if(contractsError) throw contractsError;
      const contractMap={};
      (contracts||[]).forEach(contract=>{
        const userKey=contract?.user_id;
        if(!userKey) return;
        if(!contractMap[userKey]) contractMap[userKey]=[];
        contractMap[userKey].push(contract);
      });
      Object.values(contractMap).forEach(list => list.sort((a,b) => new Date(b.created_at || 0) - new Date(a.created_at || 0)));
      this._rows=(profiles||[]).map(profile=>{
        const userContracts=contractMap[profile.id] || contractMap[profile.user_id] || [];
        const activeContract=userContracts.find(contract=>contract.active===true) || userContracts[0] || null;
        return {...profile,_contracts:userContracts,_activeContract:activeContract,_activePlan:activeContract?.plan||''};
      });
      this._page=1;
      this._renderPage();
    }catch(err){
      setHTML(container,AdminUI.error('Could not load users: '+err.message));
    }
  },
  _filteredRows(){
    const search=($('#editOldUserSearchInput')?.value||'').trim().toLowerCase();
    const planFilter=($('#editOldUserPlanFilter')?.value||'all').toLowerCase();
    let rows=this._rows.slice();
    if(planFilter!=='all') rows=rows.filter(row=>this._normalizePlan(row._activePlan)===planFilter);
    if(search){
      rows=rows.filter(row=>{
        const text=`${row.id||''} ${row.user_id||''} ${row.email||''} ${row.name||''} ${row.phone||''} ${row.country||''}`.toLowerCase();
        return text.includes(search);
      });
    }
    return rows;
  },
  _renderPage(){
    const container=document.getElementById('editOldUserTableWrap'); if(!container)return;
    const rows=this._filteredRows();
    paginate(rows,this._pageSize,this._page,'editOldUserPagination',(pageRows)=>this._render(container,pageRows),'EditOldUserModule');
  },
  _render(container,rows){
    if(!rows.length){ setHTML(container,AdminUI.empty('No users found.')); return; }
    const html=rows.map(u=>{
      const plan=this._prettyPlan(u._activePlan);
      const status=this._statusFromRow(u);
      const wallet=Number(u.usdt_balance||0).toFixed(2);
      const daily=u._activeContract?.daily_profit!=null ? Number(u._activeContract.daily_profit).toFixed(8) : '?';
      return`<tr>
        <td style="${TD};font-family:monospace;font-size:11px;color:#64748b">${String(u.id||'').slice(0,8)}?</td>
        <td style="${TD}"><div style="font-weight:600;color:#f1f5f9;">${u.name||'?'}</div><div style="font-size:11px;color:#64748b;margin-top:2px;">${u.user_id||'?'}</div></td>
        <td style="${TD}">${u.email||'?'}</td>
        <td style="${TD};font-weight:600;color:#f1f5f9;">${plan}</td>
        <td style="${TD};font-family:monospace;color:#10b981;">${wallet} USDT</td>
        <td style="${TD};font-family:monospace;color:#fbbf24;">${daily}</td>
        <td style="${TD}">${AdminUI.badge(status)}</td>
        <td style="${TD}"><button class="admin-btn admin-btn-primary" onclick="EditOldUserModule.openEditForm('${u.id}')">Edit</button></td>
      </tr>`;
    }).join('');
    setHTML(container,`
      <table style="width:100%;border-collapse:collapse">
        <thead><tr><th style="${TH}">ID</th><th style="${TH}">Name</th><th style="${TH}">Email</th><th style="${TH}">Active Plan</th><th style="${TH}">Wallet</th><th style="${TH}">Daily Profit</th><th style="${TH}">Status</th><th style="${TH}">Action</th></tr></thead>
        <tbody>${html}</tbody>
      </table>
    `);
  },
  async openEditForm(userId){
    if(!userId){ return this.openBulkEditForm(); }
    const row=this._rows.find(item=>item.id===userId);
    if(!row)return;
    this._selectedUser=row;
    const contract=this._activeContractForRow(row);
    show('#editOldUserFormWrap');
    $('#eouName').value=row.name||'';
    $('#eouEmail').value=row.email||'';
    $('#eouPhone').value=row.phone||'';
    $('#eouCountry').value=row.country||'';
    $('#eouPlan').value=this._normalizePlan(row._activePlan)||'starter';
    $('#eouStatus').value=this._statusFromRow(row);
    $('#eouWalletBalance').value=Number(row.usdt_balance||0);
    $('#eouDailyProfit').value=Number(contract?.daily_profit||0);
    window.scrollTo({ top:document.body.scrollHeight, behavior:'smooth' });
  },
  // Backward-compatible alias for older onclick bindings.
  async selectUser(userId){
    return this.openEditForm(userId);
  },
  async saveUser(){
    if(!this._selectedUser){ AdminUI.toast('No user selected.','error'); return; }
    try{
      const row=this._selectedUser;
      const contract=this._activeContractForRow(row);
      const status=($('#eouStatus')?.value||'active').toLowerCase();
      const selectedPlan=this._normalizePlan($('#eouPlan')?.value||'starter');
      const dailyProfitInput=parseFloat($('#eouDailyProfit')?.value||0);
      const dailyProfit=Number.isFinite(dailyProfitInput)?dailyProfitInput:0;
      const walletInput=parseFloat($('#eouWalletBalance')?.value||0);
      const walletBalance=Number.isFinite(walletInput)?walletInput:0;
      const profilePatch={
        name:($('#eouName')?.value||'').trim(),
        email:($('#eouEmail')?.value||'').trim(),
        phone:($('#eouPhone')?.value||'').trim(),
        country:($('#eouCountry')?.value||'').trim(),
        usdt_balance:walletBalance,
        is_active:status==='active',
        is_suspended:status==='suspended',
        is_banned:status==='banned'
      };
      const {error:profileError}=await sb.from('profiles').update(profilePatch).eq('id',row.id);
      if(profileError) throw profileError;
      if(contract?.id){
        const contractPatch={ plan:selectedPlan || contract.plan || 'starter', daily_profit:dailyProfit };
        const {error:contractError}=await sb.from('contracts').update(contractPatch).eq('id',contract.id);
        if(contractError) throw contractError;
      }
      await logAdminAction('edit_old_user','profiles',row.id,row,{...profilePatch, plan:selectedPlan, daily_profit:dailyProfit});
      if(contract?.id){
        AdminUI.toast('User updated successfully.','success');
      }else{
        AdminUI.toast('User updated, but no active contract was found so plan and daily profit were not changed.','warning');
      }
      this.clearForm();
      await this.loadUsers();
    }catch(err){
      AdminUI.toast('Update failed: '+err.message,'error');
    }
  },
  async saveBulkEdit(){
    const rows=this._bulkRows();
    if(!rows.length){ AdminUI.toast('No filtered users found.','error'); return; }
    const action=($('#eouBulkAction')?.value||'wallet_add').toLowerCase();
    const userIds=rows.map(row=>row.id).filter(Boolean);
    if(!userIds.length){ AdminUI.toast('No valid users selected.','error'); return; }

    try{
      if(action==='wallet_add'){
        const amount=Number.parseFloat($('#eouBulkWalletAmount')?.value||'');
        if(!Number.isFinite(amount) || amount===0){ AdminUI.toast('Enter a valid wallet amount.','error'); return; }
        const { data: currentProfiles, error } = await sb.from('profiles').select('id,usdt_balance').in('id', userIds);
        if(error) throw error;
        const profileMap = new Map((currentProfiles||[]).map(p => [p.id, p]));
        let updated=0;
        for(const row of rows){
          const current=Number(profileMap.get(row.id)?.usdt_balance ?? row.usdt_balance ?? 0);
          const next=current+amount;
          const { error: updateError } = await sb.from('profiles').update({ usdt_balance: next }).eq('id', row.id);
          if(updateError) throw updateError;
          updated++;
        }
        await logAdminAction('bulk_wallet_add','profiles','bulk:'+userIds.join(','),{action:'wallet_add',amount,targets:userIds.length},{action:'wallet_add',amount,targets:userIds.length});
        AdminUI.toast(`Wallet balance updated for ${updated} user${updated===1?'':'s'}.`,'success');
      } else if(action==='transaction'){
        let amount=Number.parseFloat($('#eouBulkTxAmount')?.value||'');
        if(!Number.isFinite(amount) || amount===0){ AdminUI.toast('Enter a valid transaction amount.','error'); return; }
        const direction=($('#eouBulkTxDirection')?.value||'credit').toLowerCase();
        amount=Math.abs(amount);
        if(direction==='debit') amount=-amount;
        const name=($('#eouBulkTxName')?.value||'').trim() || 'Manual Adjustment';
        const coin=($('#eouBulkTxCoin')?.value||'usdt_bep20');
        let created=0;
        for(const row of rows){
          const { error: txError } = await sb.from('transactions').insert({
            user_id: row.id,
            type: name,
            coin,
            amount,
            status: 'success',
            created_at: new Date().toISOString(),
          });
          if(txError) throw txError;
          created++;
        }
        await logAdminAction('bulk_transaction_add','transactions','bulk:'+userIds.join(','),{action:'transaction',amount,name,coin,targets:userIds.length},{action:'transaction',amount,name,coin,targets:userIds.length});
        AdminUI.toast(`Transaction entry added for ${created} user${created===1?'':'s'}.`,'success');
      } else if(action==='daily_profit'){
        const dailyProfit=Number.parseFloat($('#eouBulkDailyProfit')?.value||'');
        if(!Number.isFinite(dailyProfit)){ AdminUI.toast('Enter a valid daily profit.','error'); return; }
        const { data: contracts, error } = await sb.from('contracts').select('id,user_id,active').in('user_id', userIds);
        if(error) throw error;
        const activeContracts=(contracts||[]).filter(c=>c.active===true);
        let updated=0;
        for(const contract of activeContracts){
          const { error: updateError } = await sb.from('contracts').update({ daily_profit: dailyProfit }).eq('id', contract.id);
          if(updateError) throw updateError;
          updated++;
        }
        await logAdminAction('bulk_daily_profit','contracts','bulk:'+userIds.join(','),{action:'daily_profit',dailyProfit,targets:userIds.length},{action:'daily_profit',dailyProfit,targets:userIds.length});
        AdminUI.toast(`Daily profit updated for ${updated} contract${updated===1?'':'s'}.`,'success');
      } else {
        AdminUI.toast('Unknown bulk action.','error');
        return;
      }
      this.closeBulkEditForm();
      await this.loadUsers();
    }catch(err){
      AdminUI.toast('Bulk update failed: '+err.message,'error');
    }
  },
  // Explicit save handler name for direct button wiring.
  async saveEditForm(){
    return this.saveUser();
  },
  clearForm(){
    this._selectedUser=null;
    hide('#editOldUserFormWrap');
    ['#eouName','#eouEmail','#eouPhone','#eouCountry','#eouWalletBalance','#eouDailyProfit'].forEach(id=>{ const el=$(id); if(el) el.value=''; });
    const planEl=$('#eouPlan'); if(planEl) planEl.value='starter';
    const statusEl=$('#eouStatus'); if(statusEl) statusEl.value='active';
  }
};
window.EditOldUserModule=EditOldUserModule;

/* --------------------------------------------------------------
   ?13  TRANSACTIONS MODULE
-------------------------------------------------------------- */
const TransactionsModule = {
  _rows:[], _page:1, _pageSize:25, _profileMap:{},
  goPage(n){ this._page=n; this._renderPage(); },
  _txLabel(row){
    return row?.type || '?';
  },
  async load(typeFilter='all'){
    const container=document.getElementById('transactionsTableWrap'); if(!container||!sb)return;
    setHTML(container,AdminUI.loading('Loading transactions?'));
    try{
      let q=sb.from('transactions').select('*').order('created_at',{ascending:false}).limit(250);
      if(typeFilter!=='all')q=q.eq('type',typeFilter);
      const{data,error}=await q; if(error)throw error; this._rows=data||[];
      const userIds=[...new Set(this._rows.map(r=>r.user_id).filter(Boolean))];
      this._profileMap=await _fetchProfiles(userIds);
      this._page=1; this._renderPage();
    }catch(err){ setHTML(container,AdminUI.error('Could not load transactions: '+err.message)); }
  },
  _renderPage(){
    const container=document.getElementById('transactionsTableWrap'); const filter=$('#transactionSearchInput')?.value?.toLowerCase()||'';
    let rows=this._rows; if(filter)rows=rows.filter(r=>((r.user_id||'')+(r.type||'')+(r.coin||'')).toLowerCase().includes(filter));
    paginate(rows,this._pageSize,this._page,'transactionsPagination',(pageRows)=>this._render(container,pageRows),'TransactionsModule');
  },
  _render(container,rows){
    if(!rows.length){ setHTML(container,AdminUI.empty('No transactions.')); return; }
    const html=rows.map(tx=>{
      const isUSDT=tx.coin==='usdt'||tx.coin==='usdt_bep20'; const coin=isUSDT?'USDT':'BTC'; const decimals=isUSDT?2:8;
      const rawAmount=Number(tx.amount||0); const absAmount=Math.abs(rawAmount).toFixed(decimals); const date=tx.created_at?new Date(tx.created_at).toLocaleString('en-US',{dateStyle:'medium',timeStyle:'short'}):'?';
      const isOut=rawAmount<0 || tx.type==='withdrawal' || tx.type==='purchase'; const color=isOut?'#ef4444':'#10b981'; const sign=isOut?'-':'+'; 
      return`<tr><td style="${TD};font-family:monospace;font-size:11px;color:#64748b">${String(tx.id||'').slice(0,8)}?</td><td style="${TD}"><span style="color:#f59e0b;font-weight:600;font-family:monospace;">${this._profileMap?.[tx.user_id]?.user_id || (tx.user_id?tx.user_id.slice(0,8)+'?':'?')}</span></td><td style="${TD};font-size:12px;color:#f1f5f9;font-weight:600">${escapeHtml(String(this._txLabel(tx)))}</td><td style="${TD};font-family:monospace;color:${color};font-weight:600">${sign}${absAmount} ${coin}</td><td style="${TD}">${AdminUI.badge(tx.status)}</td><td style="${TD};font-size:12px;color:#64748b">${date}</td><td style="${TD}"><button class="admin-btn admin-btn-outline" onclick="TransactionsModule.openEditModal('${tx.id}')">??</button><button class="admin-btn admin-btn-danger" onclick="TransactionsModule.deleteTransaction('${tx.id}')" style="margin-left:4px;">??</button></td></tr>`;
    }).join('');
    setHTML(container,`<table style="width:100%;border-collapse:collapse"><thead><tr><th style="${TH}">ID</th><th style="${TH}">User</th><th style="${TH}">Name</th><th style="${TH}">Amount</th><th style="${TH}">Status</th><th style="${TH}">Date</th><th style="${TH}">Actions</th></tr></thead><tbody>${html}</tbody></table>`);
  },
  openCreateModal(){
    const body=document.getElementById('entityModalBody'); const title=document.getElementById('entityModalTitle');
    if(title)title.textContent='Add Transaction';
    setHTML(body,`
      <div class="form-group"><label>User ID</label><input type="text" id="ntUserId" placeholder="uuid"></div>
      <div class="form-group"><label>Transaction Name / Type</label><input type="text" id="ntType" placeholder="Deposit, Withdrawal, Bonus, Manual Adjust..."></div>
      <div class="form-group"><label>Coin</label><select id="ntCoin"><option value="usdt_bep20">USDT</option></select></div>
      <div class="form-group"><label>Amount</label><input type="number" id="ntAmount" step="0.00000001"></div>
      <div class="form-group"><label>Status</label><select id="ntStatus"><option value="success">Success</option><option value="pending">Pending</option><option value="failed">Failed</option></select></div>
      <button class="admin-btn admin-btn-primary" onclick="TransactionsModule.createTransaction()">? Create</button>
    `);
    show('#entityModal');
  },
  async createTransaction(){
    const userId=$('#ntUserId')?.value?.trim(); const type=$('#ntType')?.value; const coin=$('#ntCoin')?.value; const amount=parseFloat($('#ntAmount')?.value||0); const status=$('#ntStatus')?.value;
    if(!userId||!amount){ AdminUI.toast('User ID and amount required.','error'); return; }
    const{data,error}=await sb.from('transactions').insert({user_id:userId,type,coin,amount,status,created_at:new Date().toISOString()}).select().single();
    if(error){ AdminUI.toast('Failed: '+error.message,'error'); return; }
    await logAdminAction('create_transaction','transactions',data.id,null,data);
    AdminUI.toast('Transaction created.','success'); hide('#entityModal'); this.load($('#transactionTypeFilter')?.value||'all');
  },
  openEditModal(id){
    const row=this._rows.find(r=>r.id===id); if(!row)return;
    const body=document.getElementById('entityModalBody'); const title=document.getElementById('entityModalTitle');
    if(title)title.textContent='Edit Transaction';
    setHTML(body,`
      <div class="form-group"><label>Amount</label><input type="number" id="etAmount" value="${row.amount}" step="0.00000001"></div>
      <div class="form-group"><label>Transaction Name / Type</label><input type="text" id="etType" value="${escapeHtml(String(row.type||''))}"></div>
      <div class="form-group"><label>Status</label><select id="etStatus"><option value="success" ${row.status==='success'?'selected':''}>Success</option><option value="pending" ${row.status==='pending'?'selected':''}>Pending</option><option value="failed" ${row.status==='failed'?'selected':''}>Failed</option></select></div>
      <button class="admin-btn admin-btn-primary" onclick="TransactionsModule.saveEdit('${id}')">?? Save</button>
    `);
    show('#entityModal');
  },
  async saveEdit(id){
    const amount=parseFloat($('#etAmount')?.value||0); const type=($('#etType')?.value||'').trim(); const status=$('#etStatus')?.value;
    const old=this._rows.find(r=>r.id===id);
    const{error}=await sb.from('transactions').update({amount,type,status}).eq('id',id);
    if(error){ AdminUI.toast('Save failed: '+error.message,'error'); return; }
    await logAdminAction('edit_transaction','transactions',id,old,{amount,type,status});
    this._rows=this._rows.map(r=>r.id===id?{...r,amount,type,status}:r); this._renderPage(); hide('#entityModal');
    AdminUI.toast('Transaction updated.','success');
  },
  async deleteTransaction(id){
    if(!confirm('Delete this transaction?'))return;
    const{error}=await sb.from('transactions').delete().eq('id',id);
    if(error){ AdminUI.toast('Delete failed: '+error.message,'error'); return; }
    await logAdminAction('delete_transaction','transactions',id,null,null);
    this._rows=this._rows.filter(r=>r.id!==id); this._renderPage(); AdminUI.toast('Deleted.','warning');
  },
  export(){
    const headers=['ID','User ID','Name','Coin','Amount','Status','Created At'];
    const rows=this._rows.map(r=>[r.id,r.user_id||'',r.type||'',r.coin||'',r.amount||0,r.status||'',r.created_at||'']);
    downloadCSV('transactions.csv',[headers,...rows]);
  }
};

/* --------------------------------------------------------------
   ?14  CONTRACTS MODULE
-------------------------------------------------------------- */
const ContractsModule = {
  _rows:[], _page:1, _pageSize:25, _profileMap:{},
  goPage(n){ this._page=n; this._renderPage(); },
  async load(){
    const container=document.getElementById('contractsTableWrap'); if(!container||!sb)return;
    setHTML(container,AdminUI.loading('Loading contracts?'));
    try{
      const{data,error}=await sb.from('contracts').select('id,user_id,plan,hashrate,daily_profit,active,progress,created_at,last_payout_at,next_payout_at,total_earned').order('created_at',{ascending:false}).limit(250);
      if(error)throw error; this._rows=data||[];
      const userIds=[...new Set(this._rows.map(r=>r.user_id).filter(Boolean))];
      this._profileMap=await _fetchProfiles(userIds);
      this._page=1; this._renderPage();
    }catch(err){ setHTML(container,AdminUI.error('Could not load contracts: '+err.message)); }
  },
  _renderPage(){
    const container=document.getElementById('contractsTableWrap'); const filter=$('#contractSearchInput')?.value?.toLowerCase()||''; const statusFilter=$('#contractStatusFilter')?.value||'all';
    let rows=this._rows; if(filter)rows=rows.filter(r=>((r.plan||'')+(r.user_id||'')).toLowerCase().includes(filter));
    if(statusFilter==='active')rows=rows.filter(r=>r.active===true); if(statusFilter==='inactive')rows=rows.filter(r=>r.active!==true);
    paginate(rows,this._pageSize,this._page,'contractsPagination',(pageRows)=>this._render(container,pageRows),'ContractsModule');
  },
  _render(container,rows){
    if(!rows.length){ setHTML(container,AdminUI.empty('No contracts.')); return; }
    const html=rows.map(c=>{
      const date=c.created_at?new Date(c.created_at).toLocaleDateString('en-US',{dateStyle:'medium'}):'?';
      const hashrate=c.hashrate!=null?Number(c.hashrate).toFixed(1)+' TH/s':'?'; const daily=c.daily_profit!=null?Number(c.daily_profit).toFixed(8):'?';
      return`<tr><td style="${TD};font-family:monospace;font-size:11px;color:#64748b">${String(c.id||'').slice(0,8)}?</td><td style="${TD}"><span style="color:#f59e0b;font-weight:600;font-family:monospace;">${this._profileMap?.[c.user_id]?.user_id || (c.user_id?c.user_id.slice(0,8)+'?':'?')}</span></td><td style="${TD};font-weight:600;color:#f1f5f9">${c.plan||'?'}</td><td style="${TD};font-family:monospace;color:#fbbf24">${hashrate}</td><td style="${TD};font-family:monospace;color:#10b981;font-size:12px">${daily}</td><td style="${TD}">${AdminUI.badge(c.active?'active':'inactive')}</td><td style="${TD};font-size:12px;color:#64748b">${date}</td><td style="${TD}"><button class="admin-btn admin-btn-outline" onclick="ContractsModule.openEditModal('${c.id}')">??</button><button class="admin-btn ${c.active?'admin-btn-reject':'admin-btn-approve'}" onclick="ContractsModule.toggleActive('${c.id}')" style="margin-left:4px;">${c.active?'Pause':'Resume'}</button><button class="admin-btn admin-btn-danger" onclick="ContractsModule.deleteContract('${c.id}')" style="margin-left:4px;">??</button></td></tr>`;
    }).join('');
    setHTML(container,`<table style="width:100%;border-collapse:collapse"><thead><tr><th style="${TH}">ID</th><th style="${TH}">User</th><th style="${TH}">Plan</th><th style="${TH}">Hashrate</th><th style="${TH}">Daily</th><th style="${TH}">Status</th><th style="${TH}">Started</th><th style="${TH}">Actions</th></tr></thead><tbody>${html}</tbody></table>`);
  },
  openCreateModal(){
    const body=document.getElementById('entityModalBody'); const title=document.getElementById('entityModalTitle');
    if(title)title.textContent='Add Contract';
    setHTML(body,`
      <div class="form-group"><label>User ID</label><input type="text" id="ncUserId" placeholder="uuid"></div>
      <div class="form-group"><label>Plan Name</label><input type="text" id="ncPlan" placeholder="Gold"></div>
      <div class="form-group"><label>Hashrate (TH/s)</label><input type="number" id="ncHashrate" step="0.1"></div>
      <div class="form-group"><label>Daily Profit (USDT)</label><input type="number" id="ncDaily" step="0.00000001"></div>
      <button class="admin-btn admin-btn-primary" onclick="ContractsModule.createContract()">? Create</button>
    `);
    show('#entityModal');
  },
  async createContract(){
    const userId=$('#ncUserId')?.value?.trim(); const plan=$('#ncPlan')?.value?.trim(); const hashrate=parseFloat($('#ncHashrate')?.value||0); const daily=parseFloat($('#ncDaily')?.value||0);
    if(!userId||!plan){ AdminUI.toast('User ID and plan required.','error'); return; }
    const createdAt = new Date().toISOString();
    const{data,error}=await sb.from('contracts').insert({
      user_id:userId,
      plan,
      hashrate,
      daily_profit:daily,
      active:true,
      progress:0,
      last_payout_at:null,
      next_payout_at:new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      total_earned:0,
      created_at:createdAt
    }).select().single();
    if(error){ AdminUI.toast('Failed: '+error.message,'error'); return; }
    await logAdminAction('create_contract','contracts',data.id,null,data);
    AdminUI.toast('Contract created.','success'); hide('#entityModal'); this.load();
  },
  openEditModal(id){
    const row=this._rows.find(r=>r.id===id); if(!row)return;
    const body=document.getElementById('entityModalBody'); const title=document.getElementById('entityModalTitle');
    if(title)title.textContent='Edit Contract';
    setHTML(body,`
      <div class="form-group"><label>Plan</label><input type="text" id="ecPlan" value="${row.plan||''}"></div>
      <div class="form-group"><label>Hashrate</label><input type="number" id="ecHashrate" value="${row.hashrate||0}" step="0.1"></div>
      <div class="form-group"><label>Daily Profit</label><input type="number" id="ecDaily" value="${row.daily_profit||0}" step="0.00000001"></div>
      <div class="form-group"><label>Progress %</label><input type="number" id="ecProgress" value="${row.progress||0}" step="0.1" min="0" max="100"></div>
      <button class="admin-btn admin-btn-primary" onclick="ContractsModule.saveEdit('${id}')">?? Save</button>
    `);
    show('#entityModal');
  },
  async saveEdit(id){
    const plan=$('#ecPlan')?.value?.trim(); const hashrate=parseFloat($('#ecHashrate')?.value||0); const daily=parseFloat($('#ecDaily')?.value||0); const progress=parseFloat($('#ecProgress')?.value||0);
    const old=this._rows.find(r=>r.id===id);
    const patch={plan,hashrate,daily_profit:daily,progress};
    const{error}=await sb.from('contracts').update(patch).eq('id',id);
    if(error){ AdminUI.toast('Save failed: '+error.message,'error'); return; }
    await logAdminAction('edit_contract','contracts',id,old,patch);
    this._rows=this._rows.map(r=>r.id===id?{...r,...patch}:r); this._renderPage(); hide('#entityModal');
    AdminUI.toast('Contract updated.','success');
  },
  async toggleActive(id){
    const row=this._rows.find(r=>r.id===id); if(!row)return;
    const newState=!row.active;
    const{error}=await sb.from('contracts').update({active:newState}).eq('id',id);
    if(error){ AdminUI.toast('Failed: '+error.message,'error'); return; }
    await logAdminAction(newState?'resume_contract':'pause_contract','contracts',id,{active:row.active},{active:newState});
    row.active=newState; this._renderPage(); AdminUI.toast(newState?'Contract resumed.':'Contract paused.','success');
  },
  async deleteContract(id){
    if(!confirm('Delete this contract?'))return;
    const{error}=await sb.from('contracts').delete().eq('id',id);
    if(error){ AdminUI.toast('Delete failed: '+error.message,'error'); return; }
    await logAdminAction('delete_contract','contracts',id,null,null);
    this._rows=this._rows.filter(r=>r.id!==id); this._renderPage(); AdminUI.toast('Deleted.','warning');
  },
  export(){
    const headers=['ID','User ID','Plan','Hashrate','Daily Profit','Active','Progress','Created','Last Payout','Next Payout','Total Earned'];
    const rows=this._rows.map(r=>[
      r.id,
      r.user_id||'',
      r.plan||'',
      r.hashrate||0,
      r.daily_profit||0,
      r.active?'Yes':'No',
      r.progress||0,
      r.created_at||'',
      r.last_payout_at||'',
      r.next_payout_at||'',
      r.total_earned||0
    ]);
    downloadCSV('contracts.csv',[headers,...rows]);
  }
};

/* --------------------------------------------------------------
   ?15  NOTIFICATIONS MODULE
-------------------------------------------------------------- */
const NotificationsModule = {
  async load(){
    const container=document.getElementById('adminNotifTableWrap'); if(!container||!sb)return;
    setHTML(container,AdminUI.loading('Loading notifications?'));
    try{
      const{data,error}=await sb.from('notifications').select('id,user_id,title,message,type,is_read,created_at').order('created_at',{ascending:false}).limit(100);
      if(error)throw error; const rows=data||[];
      if(!rows.length){ setHTML(container,AdminUI.empty('No notifications.')); return; }
      const userIds=[...new Set(rows.map(r=>r.user_id).filter(Boolean))];
      const profileMap=await _fetchProfiles(userIds);
      const html=rows.map(n=>{
        const email=(profileMap[n.user_id]?.email||'All Users')||'All Users'; const name=(profileMap[n.user_id]?.name||email)||email; const date=n.created_at?new Date(n.created_at).toLocaleString('en-US',{dateStyle:'medium',timeStyle:'short'}):'?';
        return`<tr><td style="${TD};font-family:monospace;font-size:11px;color:#64748b">${String(n.id||'').slice(0,8)}?</td><td style="${TD}"><div style="font-weight:600;color:#f1f5f9;font-size:13px">${name}</div><div style="font-size:11px;color:#f59e0b;margin-top:2px">${profileMap[n.user_id]?.user_id || '?'}</div></td><td style="${TD}">${n.title||'?'}</td><td style="${TD};font-size:12px;color:#94a3b8;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${n.message||'?'}</td><td style="${TD}">${AdminUI.badge(n.type)}</td><td style="${TD}">${AdminUI.badge(n.is_read?'success':'pending')}</td><td style="${TD};font-size:12px;color:#64748b">${date}</td></tr>`;
      }).join('');
      setHTML(container,`<table style="width:100%;border-collapse:collapse"><thead><tr><th style="${TH}">ID</th><th style="${TH}">User</th><th style="${TH}">Title</th><th style="${TH}">Message</th><th style="${TH}">Type</th><th style="${TH}">Status</th><th style="${TH}">Date</th></tr></thead><tbody>${html}</tbody></table>`);
    }catch(err){ setHTML(container,AdminUI.error('Could not load notifications: '+err.message)); }
  },
  async send(){
    const target=document.getElementById('notifTarget')?.value||'all'; const title=document.getElementById('notifTitle')?.value.trim(); const message=document.getElementById('notifMessage')?.value.trim(); const type=document.getElementById('notifType')?.value||'info'; const email=document.getElementById('notifUserEmail')?.value.trim();
    if(!title||!message){ AdminUI.toast('Title and message required.','error'); return; } if(!sb){ AdminUI.toast('Supabase not ready.','error'); return; }
    const btn=document.getElementById('sendNotifBtn'); if(btn){btn.disabled=true; btn.textContent='Sending?';}
    try{
      let userIds=[];
      if(target==='all'){ const{data:profiles,error:profErr}=await sb.from('profiles').select('id'); if(profErr)throw profErr; userIds=(profiles||[]).map(p=>p.id); }
      else{ if(!email)throw new Error('Enter user email.'); const{data:prof,error:profErr}=await sb.from('profiles').select('id').eq('email',email).maybeSingle(); if(profErr)throw profErr; if(!prof)throw new Error('User not found.'); userIds=[prof.id]; }
      if(!userIds.length)throw new Error('No target users.');
      const rows=userIds.map(uid=>({user_id:uid,title,message,type,is_read:false,created_at:new Date().toISOString()}));
      for(let i=0;i<rows.length;i+=500){ const batch=rows.slice(i,i+500); const{error}=await sb.from('notifications').insert(batch); if(error)throw error; }
      AdminUI.toast(`Sent to ${userIds.length} user(s).`,'success'); document.getElementById('notifTitle').value=''; document.getElementById('notifMessage').value=''; this.load();
    }catch(err){ AdminUI.toast('Send failed: '+err.message,'error'); }
    finally{ if(btn){btn.disabled=false; btn.textContent='?? Send Notification';} }
  }
};
window.NotificationsModule=NotificationsModule;

/* --------------------------------------------------------------
   ?16  REFERRAL MODULE
-------------------------------------------------------------- */
const ReferralModule = {
  _ensureDetailsWrap(){
    let detailWrap = document.getElementById('referralLeaderDetailsWrap');
    if (detailWrap) return detailWrap;
    const boardWrap = document.getElementById('referralLeaderboardWrap');
    if (!boardWrap || !boardWrap.parentElement) return null;
    detailWrap = document.createElement('div');
    detailWrap.id = 'referralLeaderDetailsWrap';
    detailWrap.style.margin = '12px 16px 16px';
    boardWrap.parentElement.appendChild(detailWrap);
    return detailWrap;
  },
  _formatContractSummary(contracts = []){
    const counts = {};
    (contracts || []).forEach(c => {
      const key = String(c?.plan || '').trim().toLowerCase();
      if (!key) return;
      counts[key] = Number(counts[key] || 0) + 1;
    });
    const items = Object.entries(counts)
      .sort((a, b) => (b[1] - a[1]) || String(a[0]).localeCompare(String(b[0])))
      .map(([plan, count]) => `${plan.charAt(0).toUpperCase()}${plan.slice(1)} ${count}`);
    return items.length ? items.join(', ') : 'No Contract';
  },
  async _buildReferralUserRows(referrerId){
    const { data: refs, error: refsErr } = await sb
      .from('referrals')
      .select('referred_user_id, earnings, created_at')
      .eq('referrer_id', referrerId);
    if (refsErr) throw refsErr;

    const referredIds = [...new Set((refs || []).map(r => r.referred_user_id).filter(Boolean))];
    if (!referredIds.length) return [];

    const { data: profiles } = await sb
      .from('profiles')
      .select('id,email,user_id,usdt_balance')
      .in('id', referredIds);
    const profileById = Object.fromEntries((profiles || []).map(p => [p.id, p]));

    const userKeys = [...new Set((profiles || []).flatMap(p => [String(p?.id || '').trim(), String(p?.user_id || '').trim()]).filter(Boolean))];
    let contracts = [];
    if (userKeys.length) {
      const { data: cRows } = await sb
        .from('contracts')
        .select('user_id,plan,active,created_at');
      contracts = (cRows || []).filter(c => userKeys.includes(String(c?.user_id || '').trim()));
    }

    const contractByUserKey = {};
    contracts.forEach(c => {
      const key = String(c?.user_id || '').trim();
      if (!key) return;
      if (!contractByUserKey[key]) contractByUserKey[key] = [];
      contractByUserKey[key].push(c);
    });

    return referredIds.map((uid) => {
      const p = profileById[uid] || {};
      const keys = [String(uid).trim(), String(p?.user_id || '').trim()].filter(Boolean);
      const userContracts = keys.flatMap(k => contractByUserKey[k] || []);
      const active = userContracts.some(c => c?.active === true);
      return {
        referred_user_id: uid,
        email: p?.email || 'Profile pending',
        user_code: p?.user_id || String(uid).slice(0, 8) + '...',
        wallet_balance: Number(p?.usdt_balance || 0),
        contract_count: userContracts.length,
        contract_summary: this._formatContractSummary(userContracts),
        id_active: active,
      };
    });
  },
  async load(){
    const wrap=document.getElementById('referralLeaderboardWrap'); if(!wrap||!sb)return;
    const detailWrap=this._ensureDetailsWrap();
    if (detailWrap) {
      setHTML(detailWrap, `<div style="color:#64748b;font-size:12px;">Click <strong style="color:#f59e0b;">View</strong> to see invited users details.</div>`);
    }
    setHTML(wrap,AdminUI.loading());
    try{
      const{data,error}=await sb.from('referrals').select('referrer_id,referred_user_id,earnings,created_at').limit(250);
      if(error)throw error; const rows=data||[];
      const referrerMap={}; rows.forEach(r=>{ if(!referrerMap[r.referrer_id])referrerMap[r.referrer_id]={count:0,earnings:0}; referrerMap[r.referrer_id].count++; referrerMap[r.referrer_id].earnings+=Number(r.earnings||0); });
      const sorted=Object.entries(referrerMap).sort((a,b)=>b[1].earnings-a[1].earnings).slice(0,10);
      const userIds=sorted.map(([id])=>id); const profileMap=await _fetchProfiles(userIds);
      const total=rows.length; const totalEarnings=rows.reduce((s,r)=>s+Number(r.earnings||0),0); const top=sorted[0]; const topName=top?(profileMap[top[0]]?.name||profileMap[top[0]]?.email||top[0]):'?';
      setText('#refStatTotal',total); setText('#refStatEarnings',totalEarnings.toFixed(8)); setText('#refStatTop',topName); setText('#refStatConv',total>0?'?':'?');
      if(!sorted.length){ setHTML(wrap,AdminUI.empty('No referrals yet.')); return; }
      const html=sorted.map(([id,stats],i)=>{
        const p=profileMap[id]||{}; const name=p.name||p.email||id.slice(0,8)+'?';
        return`<tr><td style="${TD};font-weight:700;color:#f59e0b;">#${i+1}</td><td style="${TD}">${name}</td><td style="${TD}">${stats.count}</td><td style="${TD};font-family:monospace;color:#10b981">${stats.earnings.toFixed(8)}</td><td style="${TD}"><button class="admin-btn admin-btn-outline referral-view-btn" style="padding:6px 10px;font-size:12px;" data-referrer-id="${id}">View</button></td></tr>`;
      }).join('');
      setHTML(wrap,`<table style="width:100%;border-collapse:collapse"><thead><tr><th style="${TH}">Rank</th><th style="${TH}">User</th><th style="${TH}">Referrals</th><th style="${TH}">Earnings</th><th style="${TH}">Action</th></tr></thead><tbody>${html}</tbody></table>`);
      $$('.referral-view-btn', wrap).forEach(btn => {
        btn.addEventListener('click', () => this.viewLeader(btn.dataset.referrerId));
      });
    }catch(err){ setHTML(wrap,AdminUI.error(err.message)); }
  },
  async viewLeader(referrerId){
    const detailWrap = this._ensureDetailsWrap();
    if (!detailWrap || !sb || !referrerId) return;
    setHTML(detailWrap, AdminUI.loading('Loading invited users...'));
    try{
      const { data: leaderProfile } = await sb.from('profiles').select('id,name,email,user_id').eq('id', referrerId).maybeSingle();
      const rows = await this._buildReferralUserRows(referrerId);
      if (!rows.length) {
        const leaderName = leaderProfile?.name || leaderProfile?.email || 'Selected leader';
        setHTML(detailWrap, `<div style="color:#94a3b8;font-size:13px;"><strong style="color:#f1f5f9;">${leaderName}</strong> has not invited any users yet.</div>`);
        return;
      }
      const rowsHtml = rows.map((r, idx) => {
        return `<tr>
          <td style="${TD};">${idx + 1}</td>
          <td style="${TD};color:#f1f5f9;">${r.email}</td>
          <td style="${TD};color:#94a3b8;">${r.user_code}</td>
          <td style="${TD};">${r.contract_count}</td>
          <td style="${TD};">${r.contract_summary}</td>
          <td style="${TD};color:${r.id_active ? '#10b981' : '#ef4444'};">${r.id_active ? 'Active' : 'Inactive'}</td>
          <td style="${TD};font-family:monospace;color:#10b981;">$ ${r.wallet_balance.toFixed(2)} USDT</td>
        </tr>`;
      }).join('');

      const leaderName = leaderProfile?.name || leaderProfile?.email || referrerId;
      const header = `<div style="font-size:13px;color:#94a3b8;margin-bottom:10px;"><strong style="color:#f1f5f9;">${leaderName}</strong> invited <span style="color:#f59e0b;">${rows.length}</span> users</div>`;
      const table = `<table style="width:100%;border-collapse:collapse">
        <thead>
          <tr>
            <th style="${TH}">#</th>
            <th style="${TH}">Email</th>
            <th style="${TH}">User ID</th>
            <th style="${TH}">Total Plans</th>
            <th style="${TH}">Contract Details</th>
            <th style="${TH}">Active</th>
            <th style="${TH}">Wallet Balance</th>
          </tr>
        </thead>
        <tbody>${rowsHtml}</tbody>
      </table>`;

      setHTML(detailWrap, header + table);
    }catch(err){
      setHTML(detailWrap, AdminUI.error('Could not load invited users: ' + err.message));
    }
  },
  async loadTree(){
    const email=$('#referralTreeSearch')?.value?.trim(); const wrap=document.getElementById('referralTreeWrap'); if(!email||!wrap||!sb)return;
    setHTML(wrap,AdminUI.loading());
    try{
      const{data:prof}=await sb.from('profiles').select('id,email,name,ref_code').eq('email',email).maybeSingle(); if(!prof){ setHTML(wrap,AdminUI.empty('User not found.')); return; }
      const rows = await this._buildReferralUserRows(prof.id);
      let html=`<div style="font-size:14px;font-weight:600;color:#f1f5f9;margin-bottom:12px;">${prof.name||prof.email} <span style="color:#f59e0b;">(${rows.length} referrals)</span></div>`;
      if(!rows.length){ html+=`<div style="color:#475569;font-size:13px;">No referrals found.</div>`; }
      else{
        const tbody = rows.map((r, idx) => `<tr>
          <td style="${TD};">${idx + 1}</td>
          <td style="${TD};color:#f1f5f9;">${r.email}</td>
          <td style="${TD};color:#94a3b8;">${r.user_code}</td>
          <td style="${TD};">${r.contract_count}</td>
          <td style="${TD};">${r.contract_summary}</td>
          <td style="${TD};color:${r.id_active ? '#10b981' : '#ef4444'};">${r.id_active ? 'Active' : 'Inactive'}</td>
          <td style="${TD};font-family:monospace;color:#10b981;">$ ${r.wallet_balance.toFixed(2)} USDT</td>
        </tr>`).join('');
        html += `<table style="width:100%;border-collapse:collapse">
          <thead>
            <tr>
              <th style="${TH}">#</th>
              <th style="${TH}">Email</th>
              <th style="${TH}">User ID</th>
              <th style="${TH}">Total Plans</th>
              <th style="${TH}">Contract Details</th>
              <th style="${TH}">Active</th>
              <th style="${TH}">Wallet Balance</th>
            </tr>
          </thead>
          <tbody>${tbody}</tbody>
        </table>`;
      }
      setHTML(wrap,html);
    }catch(err){ setHTML(wrap,AdminUI.error(err.message)); }
  }
};
window.ReferralModule = ReferralModule;

/* --------------------------------------------------------------
   ?17  SECURITY LOGS MODULE
-------------------------------------------------------------- */
const SecurityLogsModule = {
  _rows:[], _page:1, _pageSize:25,
  goPage(n){ this._page=n; this._renderPage(); },
  async load(){
    const container=document.getElementById('logsTableWrap'); if(!container||!sb)return;
    setHTML(container,AdminUI.loading('Loading logs?'));
    try{
      const{data,error}=await sb.from('admin_logs').select('*').order('created_at',{ascending:false}).limit(250);
      if(error)throw error; this._rows=data||[]; this._page=1; this._renderPage();
    }catch(err){ setHTML(container,AdminUI.error('Could not load logs: '+err.message)); }
  },
  _renderPage(){
    const container=document.getElementById('logsTableWrap'); const filter=$('#logSearchInput')?.value?.toLowerCase()||'';
    let rows=this._rows; if(filter)rows=rows.filter(r=>((r.action||'')+(r.admin_email||'')+(r.target_table||'')).toLowerCase().includes(filter));
    paginate(rows,this._pageSize,this._page,'logsPagination',(pageRows)=>this._render(container,pageRows),'SecurityLogsModule');
  },
  _render(container,rows){
    if(!rows.length){ setHTML(container,AdminUI.empty('No logs.')); return; }
    const html=rows.map(l=>{
      const date=l.created_at?new Date(l.created_at).toLocaleString('en-US',{dateStyle:'medium',timeStyle:'short'}):'?';
      return`<tr><td style="${TD};font-family:monospace;font-size:11px;color:#64748b">${String(l.id||'').slice(0,8)}?</td><td style="${TD}">${l.admin_email||'?'}</td><td style="${TD}"><span style="color:#f59e0b;font-weight:600;">${l.action}</span></td><td style="${TD};font-size:12px;color:#94a3b8">${l.target_table||'?'} ${l.target_id?'<br><span style="font-size:10px;color:#64748b;">'+l.target_id.slice(0,12)+'?</span>':''}</td><td style="${TD};font-size:12px;color:#64748b">${date}</td></tr>`;
    }).join('');
    setHTML(container,`<table style="width:100%;border-collapse:collapse"><thead><tr><th style="${TH}">ID</th><th style="${TH}">Admin</th><th style="${TH}">Action</th><th style="${TH}">Target</th><th style="${TH}">Date</th></tr></thead><tbody>${html}</tbody></table>`);
  },
  export(){
    const headers=['ID','Admin Email','Action','Target Table','Target ID','Old Value','New Value','Created At'];
    const rows=this._rows.map(r=>[r.id,r.admin_email||'',r.action||'',r.target_table||'',r.target_id||'',JSON.stringify(r.old_value)||'',JSON.stringify(r.new_value)||'',r.created_at||'']);
    downloadCSV('admin_logs.csv',[headers,...rows]);
  }
};

/* --------------------------------------------------------------
   ?18  GLOBAL SEARCH
-------------------------------------------------------------- */
const GlobalSearch = {
  async execute(){
    const term=$('#globalSearchInput')?.value?.trim(); if(!term){ AdminUI.toast('Enter search term.','warning'); return; }
    AdminUI.toast('Searching?','info',2000);
    try{
      const promises=[
        sb.from('profiles').select('id,email,name').or(`email.ilike.%${term}%,name.ilike.%${term}%`).limit(10),
        sb.from('deposits').select('id,user_email,amount,status').or(`user_email.ilike.%${term}%,tx_hash.ilike.%${term}%`).limit(10),
        sb.from('withdrawals').select('id,user_email,amount,status').or(`user_email.ilike.%${term}%,address.ilike.%${term}%`).limit(10),
        sb.from('transactions').select('id,user_id,type,amount').or(`user_id.ilike.%${term}%`).limit(10),
      ];
      const[{data:users},{data:deps},{data:withs},{data:txs}]=await Promise.all(promises);
      let html=`<div style="font-size:16px;font-weight:700;color:#f1f5f9;margin-bottom:16px;">?? Results for "${term}"</div>`;
      html+=`<div style="margin-bottom:12px;"><strong style="color:#f59e0b;">Users (${(users||[]).length})</strong></div>`+(users||[]).map(u=>`<div style="padding:8px 0;border-bottom:1px solid rgba(30,45,69,.4);font-size:13px;color:#94a3b8;cursor:pointer;" onclick="AdminUI.activateTab('users'); UsersModule.openUserModal('${u.id}')">${u.name||'?'} ? ${u.email||'?'}</div>`).join('')||'<div style="color:#475569;font-size:12px;">No users.</div>';
      html+=`<div style="margin:16px 0 12px;"><strong style="color:#f59e0b;">Deposits (${(deps||[]).length})</strong></div>`+(deps||[]).map(d=>`<div style="padding:8px 0;border-bottom:1px solid rgba(30,45,69,.4);font-size:13px;color:#94a3b8;">${d.user_email||'?'} ? ${d.amount} ${d.coin||'BTC'} ? ${AdminUI.badge(d.status)}</div>`).join('')||'<div style="color:#475569;font-size:12px;">No deposits.</div>';
      AdminUI.toast(html,'info',8000);
    }catch(err){ AdminUI.toast('Search error: '+err.message,'error'); }
  }
};

/* --------------------------------------------------------------
   ?19  CSV EXPORT
-------------------------------------------------------------- */
function downloadCSV(filename, rows){
  const csv=rows.map(r=>r.map(c=>`"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n');
  const blob=new Blob([csv],{type:'text/csv;charset=utf-8;'}); const url=URL.createObjectURL(blob);
  const a=document.createElement('a'); a.href=url; a.download=filename; a.click(); URL.revokeObjectURL(url);
}

function ensureEditOldUserBulkButton() {
  const editSection = document.querySelector('[data-admin-section="edit-old-user"]');
  const oldUsersSection = document.querySelector('[data-admin-section="old-users"]');

  if (oldUsersSection) {
    oldUsersSection.querySelectorAll('button').forEach(btn => {
      const txt = (btn.textContent || '').trim().toLowerCase();
      if (txt.includes('edit user') || txt.includes('bulk edit') || txt.includes('edit all filtered')) {
        btn.remove();
      }
    });
  }

  if (!editSection) return;
  const filters = editSection.querySelector('.filters');
  if (!filters) return;

  const actionRow = document.createElement('div');
  actionRow.dataset.eouActionRow = '1';
  actionRow.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap;align-items:center;';

  const loadBtn = document.createElement('button');
  loadBtn.className = 'admin-btn admin-btn-primary';
  loadBtn.type = 'button';
  loadBtn.textContent = '?? Load Users';
  loadBtn.addEventListener('click', () => EditOldUserModule.loadUsers());

  const bulkBtn = document.createElement('button');
  bulkBtn.className = 'admin-btn admin-btn-outline';
  bulkBtn.type = 'button';
  bulkBtn.textContent = '?? Bulk Edit';
  bulkBtn.addEventListener('click', () => EditOldUserModule.openBulkEditForm());

  const historyBtn = document.createElement('button');
  historyBtn.className = 'admin-btn admin-btn-outline';
  historyBtn.type = 'button';
  historyBtn.textContent = '🕘 History Edit';
  historyBtn.addEventListener('click', () => EditOldUserModule.openHistoryEditForm());

  const search = editSection.querySelector('#editOldUserSearchInput');
  const plan = editSection.querySelector('#editOldUserPlanFilter');
  filters.innerHTML = '';
  if (search) filters.appendChild(search);
  if (plan) filters.appendChild(plan);
  actionRow.append(loadBtn, bulkBtn, historyBtn);
  filters.appendChild(actionRow);
}

function removeLegacyVolumeCards() {
  const legacyTerms = ['btc volume', 'usdt volume', 'total contract value'];
  $$('.stat-card, .card').forEach(card => {
    const text = (card.textContent || '').toLowerCase();
    if (legacyTerms.some(term => text.includes(term))) {
      card.remove();
    }
  });
}

function ensureOverviewStatsCards() {
  const grid = document.querySelector('[data-admin-section="overview"] .stats-grid');
  if (!grid) return;

  const upsert = (id, label, className) => {
    if (document.getElementById(id)) return;
    const card = document.createElement('div');
    card.className = `stat-card ${className}`;
    card.innerHTML = `<div class="stat-label">${label}</div><div class="stat-value" id="${id}">0</div>`;
    grid.appendChild(card);
  };

  upsert('stat-total-contract-volume', 'Contract Volume', 'blue');
  upsert('stat-total-wallet-balance', 'Wallet Balance', 'green');
}

/* --------------------------------------------------------------
   ?20  PROFILE FETCH HELPER
-------------------------------------------------------------- */
async function _fetchProfiles(userIds){
  if(!sb||!userIds.length)return{};
  const{data,error}=await sb.from('profiles').select('id,email,name,user_id').in('id',userIds);
  if(error){ console.warn('Profile fetch error:',error.message); return{}; }
  const map={}; (data||[]).forEach(p=>{map[p.id]=p;}); return map;
}

/* --------------------------------------------------------------
   ?21  SEARCH / FILTER WIRING
-------------------------------------------------------------- */
function initFilters(){
  on('#depositStatusFilter','change',e=>{ DepositsModule.load(e.target.value||'all'); });
  on('#withdrawalStatusFilter','change',e=>{ WithdrawalsModule.load(e.target.value||'all'); });
  on('#transactionTypeFilter','change',e=>{ TransactionsModule.load(e.target.value||'all'); });
  on('#contractStatusFilter','change',e=>{ ContractsModule.load(); });
  on('#userStatusFilter','change',e=>{ UsersModule._renderPage(); });
  on('#newUserDateFilter','change',e=>{ NewUsersModule.load(e.target.value||'today'); });
  on('#oldUserDateFilter','change',e=>{ OldUsersModule.load(e.target.value||'all-time'); });
  on('#newUserSearchInput','input',()=>{ NewUsersModule._page=1; NewUsersModule._renderPage(); });
  on('#oldUserSearchInput','input',()=>{ OldUsersModule._page=1; OldUsersModule._renderPage(); });
  on('#editOldUserSearchInput','input',()=>{ EditOldUserModule._page=1; EditOldUserModule._renderPage(); });
  on('#editOldUserPlanFilter','change',()=>{ EditOldUserModule._page=1; EditOldUserModule._renderPage(); });
  on('#eouHistoryUser','change',()=>{
    const row = EditOldUserModule._historyTargetRow();
    const contractSelect = $('#eouHistoryContract');
    const contract = EditOldUserModule._historyContractForRow(row);
    if (contractSelect) {
      contractSelect.innerHTML = EditOldUserModule._renderHistoryContractOptions(row, contract?.id || '');
      contractSelect.value = contract?.id || '';
    }
    EditOldUserModule._selectedHistoryContractId = contract?.id || '';
    EditOldUserModule._refreshHistoryPreview();
  });
  on('#eouHistoryContract','change',()=>{
    EditOldUserModule._selectedHistoryContractId = ($('#eouHistoryContract')?.value || '').trim();
    EditOldUserModule._refreshHistoryPreview();
  });
  on('#eouHistoryYears','input',()=>EditOldUserModule._refreshHistoryPreview());
  on('#depositSearchInput','input',()=>{ DepositsModule._page=1; DepositsModule._renderPage(); });
  on('#withdrawalSearchInput','input',()=>{ WithdrawalsModule._page=1; WithdrawalsModule._renderPage(); });
  on('#transactionSearchInput','input',()=>{ TransactionsModule._page=1; TransactionsModule._renderPage(); });
  on('#contractSearchInput','input',()=>{ ContractsModule._page=1; ContractsModule._renderPage(); });
  on('#userSearchInput','input',()=>{ UsersModule._page=1; UsersModule._renderPage(); });
  on('#logSearchInput','input',()=>{ SecurityLogsModule._page=1; SecurityLogsModule._renderPage(); });
  on('#globalSearchBtn','click',()=>GlobalSearch.execute());
  on('#globalSearchInput','keydown',e=>{ if(e.key==='Enter')GlobalSearch.execute(); });
}

function initNotificationForm(){
  on('#notifTarget','change',e=>{ const grp=document.getElementById('notifUserGroup'); if(grp)grp.style.display=e.target.value==='specific'?'':'none'; });
  on('#sendNotifBtn','click',e=>{ e.preventDefault(); NotificationsModule.send(); });
}

/* --------------------------------------------------------------
   ?22  REALTIME
-------------------------------------------------------------- */
function initRealtime(){
  if(typeof sb?.channel!=='function')return;
  try{
    const channel=sb.channel('admin-realtime');
    channel.on('postgres_changes',{event:'INSERT',schema:'public',table:'deposits'},payload=>{
      if(payload.new?.status==='pending'){
        AdminUI.toast('?? New deposit request.','info',6000);
        const badge=document.getElementById('sidebarDepositBadge'); const cur=parseInt(badge?.textContent||'0',10);
        setText('#sidebarDepositBadge',String(cur+1)); if(badge)badge.style.display='inline-flex';
      }
      DepositsModule.load($('#depositStatusFilter')?.value||'all');
      OverviewModule._depositStats();
    })
    .on('postgres_changes',{event:'UPDATE',schema:'public',table:'deposits'},()=>{
      DepositsModule.load($('#depositStatusFilter')?.value||'all'); OverviewModule._depositStats();
    })
    .on('postgres_changes',{event:'INSERT',schema:'public',table:'withdrawals'},payload=>{
      if(payload.new?.status==='pending'){
        AdminUI.toast('?? New withdrawal request.','info',6000);
        const badge=document.getElementById('sidebarWithdrawalBadge'); const cur=parseInt(badge?.textContent||'0',10);
        setText('#sidebarWithdrawalBadge',String(cur+1)); if(badge)badge.style.display='inline-flex';
      }
      WithdrawalsModule.load($('#withdrawalStatusFilter')?.value||'all'); OverviewModule._withdrawalStats();
    })
    .on('postgres_changes',{event:'UPDATE',schema:'public',table:'withdrawals'},()=>{
      WithdrawalsModule.load($('#withdrawalStatusFilter')?.value||'all'); OverviewModule._withdrawalStats();
    })
    .on('postgres_changes',{event:'*',schema:'public',table:'transactions'},()=>{
      TransactionsModule.load($('#transactionTypeFilter')?.value||'all');
    })
    .on('postgres_changes',{event:'*',schema:'public',table:'contracts'},()=>{
      ContractsModule.load();
      if(_loaded.has('edit-old-user')) EditOldUserModule.loadUsers();
    })
    .on('postgres_changes',{event:'*',schema:'public',table:'profiles'},()=>{
      UsersModule.load(); OverviewModule._userStats();
      if(_loaded.has('new-users')) NewUsersModule.load($('#newUserDateFilter')?.value||'today');
      if(_loaded.has('old-users')) OldUsersModule.load($('#oldUserDateFilter')?.value||'all-time');
      if(_loaded.has('edit-old-user')) EditOldUserModule.loadUsers();
    })
    .on('postgres_changes',{event:'INSERT',schema:'public',table:'admin_logs'},()=>{
      if(_loaded.has('logs'))SecurityLogsModule.load();
      OverviewModule._activityFeed();
    })
    .subscribe(status=>{ if(status==='SUBSCRIBED')console.info('[Admin] Realtime subscribed.'); });
  }catch(err){ console.warn('[Admin] Realtime unavailable:',err.message); }
}

/* --------------------------------------------------------------
   ?23  NAVIGATION
-------------------------------------------------------------- */
const _loaded=new Set();

function initNavigation(){
  $$('[data-admin-tab]').forEach(btn=>{
    btn.addEventListener('click',async()=>{
      const name=btn.dataset.adminTab; AdminUI.activateTab(name); await loadSection(name);
      document.getElementById('adminSidebar')?.classList.remove('open');
      document.getElementById('adminSidebarOverlay')?.classList.remove('open');
    });
  });
  on('#adminMenuToggle','click',()=>{
    document.getElementById('adminSidebar')?.classList.toggle('open');
    document.getElementById('adminSidebarOverlay')?.classList.toggle('open');
  });
  on('#adminSidebarOverlay','click',()=>{
    document.getElementById('adminSidebar')?.classList.remove('open');
    document.getElementById('adminSidebarOverlay')?.classList.remove('open');
  });
  $$('[data-admin-logout]').forEach(btn=>{ btn.addEventListener('click',()=>AdminAuth.logout()); });
}

function initModals(){
  on('#entityModal','click',e=>{ if(e.target===e.currentTarget) closeEntityModal(); });
  on('#userDetailModal','click',e=>{ if(e.target===e.currentTarget) UsersModule.closeModal(); });
}

async function loadSection(name){
  const alwaysReload = new Set(['new-users','old-users']);
  if(_loaded.has(name) && !alwaysReload.has(name)) return;
  _loaded.add(name);
  switch(name){
    case 'overview': await OverviewModule.load(); break;
    case 'deposits': await DepositsModule.load(); break;
    case 'withdrawals': await WithdrawalsModule.load(); break;
    case 'transactions': await TransactionsModule.load(); break;
    case 'contracts': await ContractsModule.load(); break;
    case 'users': await UsersModule.load(); break;
    case 'new-users': await NewUsersModule.load($('#newUserDateFilter')?.value||'today'); break;
    case 'old-users': await OldUsersModule.load($('#oldUserDateFilter')?.value||'all-time'); break;
    case 'edit-old-user': await EditOldUserModule.loadUsers(); break;
    case 'referrals': await ReferralModule.load(); break;
    case 'notifications': await NotificationsModule.load(); break;
    case 'logs': await SecurityLogsModule.load(); break;
  }
}

/* --------------------------------------------------------------
   ?24  PANEL BOOT
-------------------------------------------------------------- */
async function _bootPanel(){
  _loaded.clear(); removeLegacyVolumeCards(); ensureOverviewStatsCards(); initFilters(); initPriceWidget(); initRealtime(); initNotificationForm();
  AdminUI.activateTab('overview'); await loadSection('overview');
}

/* --------------------------------------------------------------
   ?25  ENTRY POINT
-------------------------------------------------------------- */
console.log('[CryptoVault] admin.js enterprise loaded.');

document.addEventListener('DOMContentLoaded',async()=>{
  window.CVAuthRole?.startSessionInactivityGuard?.(()=>AdminAuth.logout(), AUTH_IDLE_TIMEOUT_MS);
  initNavigation(); initLoginForm(); initModals();
  ensureEditOldUserBulkButton();
  if(!initSupabaseClient()){ show('#adminLoginScreen'); hide('#adminAppShell'); return; }
  let alreadyLoggedIn=false;
  let forbiddenUser=false;
  try{
    const authState=await AdminAuth.check();
    alreadyLoggedIn=authState===true;
    forbiddenUser=authState==='forbidden';
  }catch(err){ console.warn('[Admin] Session check error:',err.message); }
  if(forbiddenUser){
    await sb.auth.signOut().catch(()=>{});
    AdminAuth._roleAuth.clearRole();
    window.location.replace('login.html');
    return;
  }
  if(alreadyLoggedIn){ hide('#adminLoginScreen'); show('#adminAppShell'); try{await _bootPanel();}catch(err){ AdminUI.banner('? Panel boot error: '+err.message,'error');} }
  else{ show('#adminLoginScreen'); hide('#adminAppShell'); }
});

document.addEventListener('DOMContentLoaded',() => {
  ensureOverviewStatsCards();
});

function closeEntityModal(){ hide('#entityModal'); }

/* --------------------------------------------------------------
   ?26  PUBLIC EXPORTS
-------------------------------------------------------------- */
Object.assign(window,{
  AdminAuth,AdminUI,DepositsModule,WithdrawalsModule,UsersModule,NewUsersModule,OldUsersModule,EditOldUserModule,TransactionsModule,ContractsModule,
  OverviewModule,PriceService,NotificationsModule,ReferralModule,SecurityLogsModule,GlobalSearch,
  logAdminAction,closeEntityModal
});





