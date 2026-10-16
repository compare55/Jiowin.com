// Money Coming wheel UI and animation. Wallet/transaction behavior remains local to this page.
const mcGame = {
  state: 'idle',
  balance: Number(localStorage.getItem('demoBalance') ?? 0),
  transactions: JSON.parse(localStorage.getItem('demoTx') || '[]'),
  multiplier: 1,
  bet: 1,
  auto: false,
  spinTimer: null,
  audio: null,
  referenceSound: null
};

const $mc = id => document.getElementById(id);
const fmtMC = value => Number(value).toLocaleString('en-IN', {minimumFractionDigits: 3, maximumFractionDigits: 3});

document.addEventListener('DOMContentLoaded', () => {
  updateAllBalances();
  renderTx();
  $mc('mcSpinBtn').addEventListener('click', spinMoneyComing);
  $mc('mcBetFive').addEventListener('click', () => setBet(5));
  $mc('mcBetOne').addEventListener('click', () => setBet(1));
  $mc('mcBetDown').addEventListener('click', () => setBet(Math.max(1, mcGame.bet - 1)));
  $mc('mcBetUp').addEventListener('click', () => setBet(Math.min(5, mcGame.bet + 1)));
  $mc('mcAutoSpin').addEventListener('click', () => {
    mcGame.auto = !mcGame.auto;
    $mc('mcAutoSpin').classList.toggle('active', mcGame.auto);
    if (mcGame.auto && mcGame.state === 'idle') spinMoneyComing();
  });
  // Wheel motion is part of the reference screen and runs continuously.
  $mc('mcMainWheel').style.animationDuration = '8s';
});

function setBet(amount) {
  mcGame.bet = amount;
  $mc('mcBetOne').classList.toggle('active', amount === 1);
  $mc('mcBetFive').classList.toggle('active', amount === 5);
}

function ensureMCAudio() {
  try {
    if (!mcGame.referenceSound) {
      mcGame.referenceSound = new Audio('money-coming-wheel-sound.mp3');
      mcGame.referenceSound.loop = true;
      mcGame.referenceSound.volume = 0.72;
    }
    if (mcGame.referenceSound.paused) mcGame.referenceSound.play().catch(() => {});
  } catch (_) {}
}
// The wheel audio is sampled from the supplied reference recording.
function mcTick() {}
function spinMoneyComing() {
  if (mcGame.state === 'spinning') return;
  ensureMCAudio();
  const bet = mcGame.bet;
  if (mcGame.balance < bet) {
    $mc('mcMessage').textContent = 'Insufficient balance';
    mcGame.auto = false;
    $mc('mcAutoSpin').classList.remove('active');
    return;
  }
  mcGame.balance -= bet;
  addTx('bet', bet, 'Money Coming Spin');
  updateAllBalances();
  mcGame.state = 'spinning';
  $mc('mcSpinBtn').disabled = true;
  $mc('mcMessage').textContent = '₹ 0.000';
  $mc('mcMultiplierDisplay').textContent = '1x';
  const wheel = $mc('mcMainWheel');
  wheel.style.animationDuration = '1.15s';
  wheel.style.filter = 'brightness(1.12)';
  const columns = Array.from(document.querySelectorAll('.mc-number-column'));
  columns.forEach((col, index) => {
    col.classList.add('mc-reel-spinning');
    const symbols = ['0', '1', '10', '25', '50', '75', '150', '250', '500', '1000'];
    const interval = setInterval(() => {
      col.innerHTML = [0,1,2].map(() => `<span>${symbols[Math.floor(Math.random()*symbols.length)]}</span>`).join('');
      mcTick(420 + Math.random()*450, .025, .018);
    }, 90 + index * 10);
    setTimeout(() => {
      clearInterval(interval);
      col.classList.remove('mc-reel-spinning');
      col.innerHTML = [0,1,2].map(() => `<span>${symbols[Math.floor(Math.random()*symbols.length)]}</span>`).join('');
      mcTick(780, .08, .055);
    }, 850 + index * 240);
  });
  mcGame.spinTimer = setTimeout(() => {
    wheel.style.animationDuration = '8s';
    wheel.style.filter = '';
    // Demo outcome: this remains a local visual demo, not a real-money game.
    const won = Math.random() < 0.28;
    const multiplier = won ? [2, 3, 5, 10][Math.floor(Math.random()*4)] : 0;
    if (won) {
      const amount = bet * multiplier;
      mcGame.balance += amount;
      mcGame.multiplier = multiplier;
      $mc('mcMultiplierDisplay').textContent = `${multiplier}x`;
      $mc('mcMessage').textContent = `₹ ${fmtMC(amount)}`;
      addTx('win', amount, `Money Coming ${multiplier}x`);
      mcTick(980, .12, .07); setTimeout(() => mcTick(1250, .16, .055), 100);
      showToast(`+₹ ${fmtMC(amount)}`);
    } else {
      $mc('mcMessage').textContent = '₹ 0.000';
      mcTick(240, .12, .045);
    }
    updateAllBalances();
    mcGame.state = 'idle';
    $mc('mcSpinBtn').disabled = false;
    if (mcGame.auto && mcGame.balance >= mcGame.bet) setTimeout(spinMoneyComing, 450);
    else if (mcGame.auto) { mcGame.auto = false; $mc('mcAutoSpin').classList.remove('active'); }
  }, 2050);
}

function updateAllBalances() {
  const value = fmtMC(mcGame.balance);
  if ($mc('navBalance')) $mc('navBalance').textContent = value;
  if ($mc('mcBalance')) $mc('mcBalance').textContent = value;
  if ($mc('walletBalance')) $mc('walletBalance').textContent = value;
  localStorage.setItem('demoBalance', mcGame.balance);
}
function addTx(type, amount, note = '') {
  mcGame.transactions.unshift({type, amount, note, time: new Date().toLocaleTimeString()});
  mcGame.transactions = mcGame.transactions.slice(0, 30);
  localStorage.setItem('demoTx', JSON.stringify(mcGame.transactions));
  renderTx();
}
function renderTx() {
  const box = $mc('txHistory');
  if (!box) return;
  if (!mcGame.transactions.length) { box.innerHTML = '<div style="padding:.5rem;color:#666;text-align:center">No transactions yet</div>'; return; }
  box.innerHTML = mcGame.transactions.map(tx => {
    const sign = (tx.type === 'add' || tx.type === 'win') ? '+' : '-';
    return `<div class="tx-item"><span>${tx.note || tx.type}</span><span class="tx-${tx.type}">${sign}${tx.amount}</span></div>`;
  }).join('');
}
function openWallet() { $mc('walletModal').classList.remove('hidden'); updateAllBalances(); renderTx(); }
function closeWallet() { $mc('walletModal').classList.add('hidden'); }
function addCoins() { window.location.href = 'payment.html?method=upi'; }
function withdrawCoins() {
  if (mcGame.balance <= 0) { showToast('No coins to withdraw'); return; }
  const amount = Math.min(mcGame.balance, 500); mcGame.balance -= amount;
  updateAllBalances(); addTx('withdraw', amount, 'Withdrawn to Vault'); showToast(`${amount} coins moved to Vault`);
}
function closeWheel() { $mc('luckyWheelModal').classList.add('hidden'); }
let toastTimer;
function showToast(msg) {
  const toast = $mc('toast'); if (!toast) return;
  toast.textContent = msg; toast.classList.remove('hidden'); clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.add('hidden'), 2500);
}
