// ─── CryptoVault Admin Panel ───

const SUPABASE_URL = 'YOUR_SUPABASE_URL';
const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY';

const { createClient } = supabase;
const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ─── DOM refs ───
const loginScreen = document.getElementById('login-screen');
const adminApp = document.getElementById('admin-app');
const loginForm = document.getElementById('login-form');
const loginError = document.getElementById('login-error');
const logoutBtn = document.getElementById('logout-btn');
const adminEmail = document.getElementById('admin-email');
const depositsBody = document.getElementById('deposits-body');
const usersBody = document.getElementById('users-body');
const filterStatus = document.getElementById('filter-status');
const searchInput = document.getElementById('search-input');
const toastEl = document.getElementById('toast');
const lightbox = document.getElementById('lightbox');
const lightboxImg = document.getElementById('lightbox-img');
const lightboxClose = document.querySelector('.lightbox-close');

let allDeposits = [];
let allUsers = [];

// ─── Auth ───

async function init() {
    const { data: { session } } = await sb.auth.getSession();
    if (session) {
        const isAdmin = await checkAdmin(session.user.id);
        if (isAdmin) {
            showApp(session.user.email);
        } else {
            await sb.auth.signOut();
            showLogin();
        }
    } else {
        showLogin();
    }
}

async function checkAdmin(userId) {
    // Option A: check a column on profiles table
    const { data, error } = await sb
        .from('profiles')
        .select('is_admin')
        .eq('id', userId)
        .single();
    if (error || !data) return false;
    return data.is_admin === true;
}

loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    loginError.textContent = '';
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;

    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    if (error) {
        loginError.textContent = error.message;
        return;
    }
    const isAdmin = await checkAdmin(data.user.id);
    if (!isAdmin) {
        loginError.textContent = 'Access denied: not an admin.';
        await sb.auth.signOut();
        return;
    }
    showApp(data.user.email);
});

logoutBtn.addEventListener('click', async () => {
    await sb.auth.signOut();
    location.reload();
});

function showLogin() {
    loginScreen.classList.remove('hidden');
    adminApp.classList.add('hidden');
}

function showApp(email) {
    loginScreen.classList.add('hidden');
    adminApp.classList.remove('hidden');
    adminEmail.textContent = email;
    loadData();
}

// ─── Data Loading ───

async function loadData() {
    await Promise.all([loadDeposits(), loadUsers()]);
    renderStats();
    renderDeposits();
    renderUsers();
}

async function loadDeposits() {
    const { data, error } = await sb
        .from('deposits')
        .select('*, profiles(email, balance)')
        .order('created_at', { ascending: false });
    if (error) {
        showToast('Failed to load deposits: ' + error.message, 'error');
        return;
    }
    allDeposits = data || [];
}

async function loadUsers() {
    const { data, error } = await sb
        .from('profiles')
        .select('id, email, balance, created_at')
        .order('created_at', { ascending: false });
    if (error) {
        showToast('Failed to load users: ' + error.message, 'error');
        return;
    }
    allUsers = data || [];
}

// ─── Stats ───

function renderStats() {
    const total = allDeposits.length;
    const pending = allDeposits.filter(d => d.status === 'pending').length;
    const approved = allDeposits.filter(d => d.status === 'approved').length;
    const users = allUsers.length;

    document.getElementById('stat-total').textContent = total;
    document.getElementById('stat-pending').textContent = pending;
    document.getElementById('stat-approved').textContent = approved;
    document.getElementById('stat-users').textContent = users;
}

// ─── Deposits Table ───

function renderDeposits() {
    const statusFilter = filterStatus.value;
    const query = searchInput.value.trim().toLowerCase();

    let rows = allDeposits.slice();

    // pending first
    rows.sort((a, b) => {
        if (a.status === 'pending' && b.status !== 'pending') return -1;
        if (a.status !== 'pending' && b.status === 'pending') return 1;
        return new Date(b.created_at) - new Date(a.created_at);
    });

    if (statusFilter !== 'all') {
        rows = rows.filter(r => r.status === statusFilter);
    }

    if (query) {
        rows = rows.filter(r => {
            const email = (r.profiles?.email || '').toLowerCase();
            const coin = (r.coin || '').toLowerCase();
            const tx = (r.tx_hash || '').toLowerCase();
            return email.includes(query) || coin.includes(query) || tx.includes(query);
        });
    }

    depositsBody.innerHTML = '';

    if (rows.length === 0) {
        depositsBody.innerHTML = `<tr class="empty-row"><td colspan="8">No deposits found.</td></tr>`;
        return;
    }

    rows.forEach(dep => {
        const tr = document.createElement('tr');
        if (dep.status === 'pending') tr.classList.add('pending-row');

        const email = escapeHtml(dep.profiles?.email || '—');
        const coin = escapeHtml(dep.coin || '—');
        const amount = dep.amount != null ? Number(dep.amount).toFixed(6) : '—';
        const txHash = escapeHtml(dep.tx_hash || '—');
        const status = dep.status || 'pending';
        const created = formatDate(dep.created_at);
        const screenshot = dep.screenshot_url || dep.screenshot || '';

        const imgHtml = screenshot
            ? `<img src="${escapeHtml(screenshot)}" class="thumb" data-full="${escapeHtml(screenshot)}" alt="Screenshot">`
            : '<span class="text-muted">—</span>';

        const actionsHtml = status === 'pending'
            ? `<button class="btn-approve" data-id="${dep.id}" data-uid="${dep.user_id}" data-amt="${dep.amount}">Approve</button>
               <button class="btn-reject" data-id="${dep.id}">Reject</button>`
            : `<span class="badge badge-${status}">${status}</span>`;

        tr.innerHTML = `
            <td>${email}</td>
            <td>${coin}</td>
            <td>${amount}</td>
            <td><div class="tx-hash" title="${txHash}">${txHash}</div></td>
            <td>${imgHtml}</td>
            <td><span class="badge badge-${status}">${status}</span></td>
            <td>${created}</td>
            <td>${actionsHtml}</td>
        `;
        depositsBody.appendChild(tr);
    });

    // bind approve / reject
    depositsBody.querySelectorAll('.btn-approve').forEach(btn => {
        btn.addEventListener('click', () => handleApprove(btn));
    });
    depositsBody.querySelectorAll('.btn-reject').forEach(btn => {
        btn.addEventListener('click', () => handleReject(btn));
    });
    // bind image clicks
    depositsBody.querySelectorAll('.thumb').forEach(img => {
        img.addEventListener('click', () => openLightbox(img.dataset.full));
    });
}

// ─── Users Table ───

function renderUsers() {
    usersBody.innerHTML = '';
    if (allUsers.length === 0) {
        usersBody.innerHTML = `<tr class="empty-row"><td colspan="3">No users found.</td></tr>`;
        return;
    }
    allUsers.forEach(u => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${escapeHtml(u.email || '—')}</td>
            <td>${u.balance != null ? Number(u.balance).toFixed(6) : '0.000000'}</td>
            <td>${formatDate(u.created_at)}</td>
        `;
        usersBody.appendChild(tr);
    });
}

// ─── Actions ───

async function handleApprove(btn) {
    const id = btn.dataset.id;
    const userId = btn.dataset.uid;
    const amount = parseFloat(btn.dataset.amt);
    if (!id || !userId || isNaN(amount)) return;

    btn.disabled = true;
    const sibling = btn.nextElementSibling;
    if (sibling) sibling.disabled = true;

    // 1. Update deposit status
    const { error: updErr } = await sb
        .from('deposits')
        .update({ status: 'approved' })
        .eq('id', id);

    if (updErr) {
        showToast('Approve failed: ' + updErr.message, 'error');
        btn.disabled = false;
        if (sibling) sibling.disabled = false;
        return;
    }

    // 2. Add amount to user's balance
    const { data: profile, error: profErr } = await sb
        .from('profiles')
        .select('balance')
        .eq('id', userId)
        .single();

    if (profErr) {
        showToast('Deposit approved but balance update failed: ' + profErr.message, 'error');
    } else {
        const current = parseFloat(profile.balance || 0);
        const newBal = current + amount;
        const { error: balErr } = await sb
            .from('profiles')
            .update({ balance: newBal })
            .eq('id', userId);
        if (balErr) {
            showToast('Deposit approved but balance update failed: ' + balErr.message, 'error');
        }
    }

    showToast('Deposit approved successfully.', 'success');
    await loadData();
}

async function handleReject(btn) {
    const id = btn.dataset.id;
    if (!id) return;

    btn.disabled = true;
    const sibling = btn.previousElementSibling;
    if (sibling) sibling.disabled = true;

    const { error } = await sb
        .from('deposits')
        .update({ status: 'rejected' })
        .eq('id', id);

    if (error) {
        showToast('Reject failed: ' + error.message, 'error');
        btn.disabled = false;
        if (sibling) sibling.disabled = false;
        return;
    }

    showToast('Deposit rejected.', 'success');
    await loadData();
}

// ─── Tabs ───

document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', (e) => {
        e.preventDefault();
        document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
        link.classList.add('active');
        const tab = link.dataset.tab;
        document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
        document.getElementById('tab-' + tab).classList.add('active');
    });
});

// ─── Filters ───

filterStatus.addEventListener('change', renderDeposits);
searchInput.addEventListener('input', debounce(renderDeposits, 300));

// ─── Lightbox ───

function openLightbox(url) {
    lightboxImg.src = url;
    lightbox.classList.remove('hidden');
}

lightboxClose.addEventListener('click', () => {
    lightbox.classList.add('hidden');
    lightboxImg.src = '';
});

lightbox.addEventListener('click', (e) => {
    if (e.target === lightbox) {
        lightbox.classList.add('hidden');
        lightboxImg.src = '';
    }
});

// ─── Helpers ───

function showToast(msg, type = 'success') {
    toastEl.textContent = msg;
    toastEl.className = 'toast ' + type + ' show';
    setTimeout(() => toastEl.classList.remove('show'), 3500);
}

function escapeHtml(str) {
    if (!str) return '';
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function formatDate(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    return d.toLocaleString('en-GB', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
    });
}

function debounce(fn, ms) {
    let t;
    return (...args) => {
        clearTimeout(t);
        t = setTimeout(() => fn(...args), ms);
    };
}

// ─── Start ───
init();
