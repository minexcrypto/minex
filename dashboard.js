'use strict';

function switchTab(name){

document.querySelectorAll('.tab-content')
.forEach(tab=>{
tab.style.display='none';
});

document.querySelectorAll('.nav-item')
.forEach(item=>{
item.classList.remove('active');
});

const activeTab =
document.getElementById('tab-' + name);

const activeNav =
document.getElementById('nav-' + name);

if(activeTab){
activeTab.style.display='block';
}

if(activeNav){
activeNav.classList.add('active');
}

const title =
document.getElementById('pageTitle');

if(title){
title.textContent =
name.charAt(0).toUpperCase() +
name.slice(1);
}

}

function selectCoin(coin){

const addr =
document.getElementById('depositAddressDisplay');

if(!addr) return;

if(coin === 'BTC'){

addr.textContent =
'bc1qzffpufy57a0r4jpyv7w6qj7w48vzj8jeamusxe';

}else{

addr.textContent =
'0x3484Eb517732AA21A5f410bF9b5E991e9FB251d0';

}

}

function copyDepositAddress(){

const text =
document.getElementById('depositAddressDisplay')
?.textContent;

if(text){

navigator.clipboard.writeText(text);

alert('Address copied');

}

}

function submitDeposit(){

alert('Deposit request submitted');

}

function saveSettings(){

alert('Settings saved');

}

window.switchTab = switchTab;
window.selectCoin = selectCoin;
window.copyDepositAddress = copyDepositAddress;
window.submitDeposit = submitDeposit;
window.saveSettings = saveSettings;
