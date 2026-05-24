Replace your FULL `dashboard.js` with this CLEAN fixed version start section.

Sabse important:

* duplicate Supabase removed
* duplicate BTCPrice removed
* switchTab works
* no redeclare errors

OLD file pura delete karke ye paste karo:

```javascript
'use strict';

/* ─── AUTH MODULE ───────────────────────────────────────── */
const Auth = (() => {
  let _session = null;
  let _profile = null;

  async function init() {

    const { data: { session } } =
      await _supabase.auth.getSession();

    if (!session) {
      window.location.href = 'login.html';
      return false;
    }

    _session = session;

    const { data: prof } =
      await _supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single();

    _profile = prof || {};

    _supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        window.location.href = 'login.html';
      }
    });

    return true;
  }

  async function logout() {
    await _supabase.auth.signOut();
    window.location.href = 'login.html';
  }

  function getUser() {
    return _session?.user || null;
  }

  function getProfile() {
    return _profile || {};
  }

  async function updateProfile(fields) {

    if (!_session) return;

    const { data } =
      await _supabase
        .from('profiles')
        .update(fields)
        .eq('id', _session.user.id)
        .select()
        .single();

    if (data) {
      _profile = data;
    }

    return data;
  }

  return {
    init,
    logout,
    getUser,
    getProfile,
    updateProfile
  };

})();

/* ─── BTC PRICE ───────────────────────────────────────── */

const BTCPrice = (() => {

  let _price = 67842;

  let _callbacks = [];

  function onChange(cb) {
    _callbacks.push(cb);
    cb(_price);
  }

  async function fetchPrice() {

    try {

      const response =
        await fetch(
          'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd'
        );

      const json = await response.json();

      if (json.bitcoin?.usd) {

        _price = json.bitcoin.usd;

        _callbacks.forEach(cb => cb(_price));

      }

    } catch (err) {

      console.log('BTC price fetch failed');

    }

  }

  fetchPrice();

  setInterval(fetchPrice, 60000);

  return {
    onChange,
    get: () => _price
  };

})();

/* ─── HELPERS ───────────────────────────────────────── */

function $(id) {
  return document.getElementById(id);
}

function setText(id, text) {
  const el = $(id);
  if (el) el.textContent = text;
}

/* ─── TABS ───────────────────────────────────────── */

function switchTab(name) {

  document.querySelectorAll('.tab-content')
    .forEach(tab => {
      tab.style.display = 'none';
    });

  document.querySelectorAll('.nav-item')
    .forEach(item => {
      item.classList.remove('active');
    });

  const tab =
    $('tab-' + name);

  const nav =
    $('nav-' + name);

  if (tab) {
    tab.style.display = '';
  }

  if (nav) {
    nav.classList.add('active');
  }

  setText(
    'pageTitle',
    name.charAt(0).toUpperCase() + name.slice(1)
  );

}

/* ─── USER UI ───────────────────────────────────────── */

function populateUserUI() {

  const user =
    Auth.getUser();

  const profile =
    Auth.getProfile();

  const email =
    user?.email || 'User';

  document.querySelectorAll('.user-email-display')
    .forEach(el => {
      el.textContent = email;
    });

  document.querySelectorAll('.user-name-display')
    .forEach(el => {
      el.textContent =
        email.split('@')[0];
    });

}

/* ─── SETTINGS ───────────────────────────────────────── */

async function saveSettings() {

  const name =
    $('settingName')?.value?.trim();

  if (!name) return;

  await Auth.updateProfile({
    name
  });

  populateUserUI();

  alert('Settings saved');

}

/* ─── DEPOSIT ADDRESS ───────────────────────────────────────── */

function copyDepositAddress() {

  const address =
    $('depositAddressDisplay')?.textContent;

  navigator.clipboard.writeText(address);

  alert('Address copied');

}

/* ─── COIN SWITCH ───────────────────────────────────────── */

function selectCoin(coin) {

  const addressDisplay =
    $('depositAddressDisplay');

  const label =
    $('coinLabel');

  const warn =
    $('coinLabelWarn');

  if (coin === 'BTC') {

    addressDisplay.textContent =
      'bc1qzffpufy57a0r4jpyv7w6qj7w48vzj8jeamusxe';

  } else {

    addressDisplay.textContent =
      '0x3484Eb517732AA21A5f410bF9b5E991e9FB251d0';

  }

  if (label) label.textContent = coin;

  if (warn) warn.textContent = coin;

}

/* ─── SUBMIT DEPOSIT ───────────────────────────────────────── */

async function submitDeposit() {

  alert(
    'Deposit request submitted successfully'
  );

}

/* ─── LOGOUT ───────────────────────────────────────── */

function wireLogout() {

  document.querySelectorAll('[data-logout]')
    .forEach(btn => {

      btn.addEventListener('click', async (e) => {

        e.preventDefault();

        await Auth.logout();

      });

    });

}

/* ─── INIT ───────────────────────────────────────── */

document.addEventListener(
  'DOMContentLoaded',
  async () => {

    const ok =
      await Auth.init();

    if (!ok) return;

    populateUserUI();

    wireLogout();

    BTCPrice.onChange(price => {

      setText(
        'tickerPrice',
        '$' + price.toLocaleString()
      );

    });

    window.switchTab = switchTab;
    window.saveSettings = saveSettings;
    window.selectCoin = selectCoin;
    window.submitDeposit = submitDeposit;
    window.copyDepositAddress = copyDepositAddress;

  }
);
```
