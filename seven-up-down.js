// ========================
// 7UP 7DOWN GAME
// ========================
const sudGame = {
  state: 'betting',
  timer: 10,
  balance: Number(localStorage.getItem('demoBalance') ?? 0),
  transactions: JSON.parse(localStorage.getItem('demoTx')) || [],
  history: JSON.parse(localStorage.getItem('sudHistory')) || [],
  bets: {},
  chipValue: 50,
  timerInterval: null,
  soundReady: false,
  lastBetAmounts: {}
};

const DICE_FACES = ['⚀','⚁','⚂','⚃','⚄','⚅'];

// ========================
// INIT
// ========================
document.addEventListener('DOMContentLoaded', () => {
  updateAllBalances();
  renderHistory();
  renderBets();
  renderRoadmap();
  selectChip(50);
  // Audio is unlocked on the first real user interaction (mobile browser policy).
  document.addEventListener('pointerdown', unlockSUDSound, { once: true });
  startBettingRound();
});

function startBettingRound() {
  sudGame.state = 'betting';
  sudGame.timer = 10;
  sudGame.bets = {};
  renderBets();
  updateTotalBet();
  updateStatus('Please Bet Now');
  updateTimerDisplay();
  resetDice();
  const lock = document.getElementById('sudLockOverlay');
  if (lock) lock.classList.add('hidden');
  document.querySelectorAll('.sud-bet-btn,.sud-side-btn,.sud-num-btn').forEach(b => b.classList.remove('bet-disabled'));
  if (sudGame.timerInterval) clearInterval(sudGame.timerInterval);
  sudGame.timerInterval = setInterval(() => {
    sudGame.timer--;
    updateTimerDisplay();
    if (sudGame.timer <= 3 && sudGame.timer > 0) {
      updateStatus('Betting closing soon!');
      playSUDSound('tick');
    }
    if (sudGame.timer <= 0) {
      clearInterval(sudGame.timerInterval);
      sudGame.state = 'locked';
      document.querySelectorAll('.sud-bet-btn,.sud-side-btn,.sud-num-btn').forEach(b => b.classList.add('bet-disabled'));
      const lockText = document.getElementById('sudLockText');
      if (lockText) lockText.textContent = 'Please Bet Now';
      if (lock) lock.classList.remove('hidden');
      updateStatus('Betting closed');
      playSUDSound('lock');
      setTimeout(() => { if (lock) lock.classList.add('hidden'); rollDice(); }, 900);
    }
  }, 1000);
}

function updateTimerDisplay() {
  const el = document.getElementById('sudTimer');
  el.textContent = sudGame.timer;
  if (sudGame.timer <= 3) {
    el.style.color = '#e94560';
  } else {
    el.style.color = '#f7d774';
  }
}

function updateStatus(msg) {
  document.getElementById('sudStatus').textContent = msg;
}

// ========================
// CHIP SELECTION
// ========================
function selectChip(val) {
  sudGame.chipValue = val;
  document.querySelectorAll('.chip').forEach(c => {
    c.classList.toggle('active', parseInt(c.dataset.val) === val);
  });
}

// ========================
// PLACE BET
// ========================
function placeBet(type) {
  if (sudGame.state !== 'betting') {
    showToast('Betting is closed!');
    playSUDSound('lock');
    return;
  }
  const chip = sudGame.chipValue;
  if (sudGame.balance < chip) {
    showToast('Insufficient coins!');
    return;
  }
  sudGame.balance -= chip;
  if (window.reportLiveBet) reportLiveBet(type, chip);
  sudGame.bets[type] = (sudGame.bets[type] || 0) + chip;
  playSUDSound('bet');
  updateAllBalances();
  renderBets();
  updateTotalBet();
  addTx('bet', chip, `7U7D: ${type}`);
}

function renderBets() {
  const map = { down: 'betDown', up: 'betUp', lucky: 'betLucky', odd: 'betOdd', even: 'betEven' };
  Object.keys(map).forEach(k => {
    const el = document.getElementById(map[k]);
    if (el) el.textContent = sudGame.bets[k] || 0;
  });
  // Show the selected stakes on the same betting surface, like the reference.
  document.querySelectorAll('.sud-chip-stack').forEach(el => {
    const type = el.dataset.stack;
    el.innerHTML = chipStackHTML(type);
  });
  document.querySelectorAll('.sud-side-btn').forEach(btn => {
    const type = btn.querySelector('#betOdd') ? 'odd' : 'even';
    let stack = btn.querySelector('.sud-side-chip-stack');
    if (!stack) { stack = document.createElement('span'); stack.className = 'sud-side-chip-stack'; stack.dataset.stack = type; btn.appendChild(stack); }
    stack.innerHTML = chipStackHTML(type);
  });
  document.querySelectorAll('.sud-num-btn').forEach(btn => {
    const firstText = btn.childNodes.length ? (btn.childNodes[0].textContent || '').trim() : '';
    const number = btn.dataset.number || firstText;
    if (!/^\d+$/.test(number)) return;
    btn.dataset.number = number;
    const type = 'num' + number;
    let stack = btn.querySelector('.sud-number-chip-stack');
    if (!stack) { stack = document.createElement('span'); stack.className = 'sud-number-chip-stack'; stack.dataset.stack = type; btn.appendChild(stack); }
    stack.innerHTML = chipStackHTML(type);
    btn.classList.toggle('has-bet', !!sudGame.bets[type]);
  });
}
function chipStackHTML(type) {
  const amount = sudGame.bets[type] || 0;
  if (!amount) return '';
  const chip = sudGame.chipValue;
  const label = amount >= 1000 ? (amount / 1000).toFixed(amount % 1000 ? 1 : 0) + 'k' : amount;
  return '<span class="sud-mini-chip">' + label + '</span>';
}

function updateTotalBet() {
  const total = Object.values(sudGame.bets).reduce((a, b) => a + b, 0);
  document.getElementById('sudTotalBet').textContent = total;
}

function clearBets() {
  if (sudGame.state !== 'betting') return;
  const total = Object.values(sudGame.bets).reduce((a, b) => a + b, 0);
  if (total > 0) {
    sudGame.balance += total;
    updateAllBalances();
    showToast(`${total} coins returned`);
  }
  sudGame.bets = {};
  renderBets();
  updateTotalBet();
}

// ========================
// ROLL DICE
// ========================
function rollDice() {
  sudGame.state = 'rolling';
  updateStatus('Dice Rolling...');
  const lock = document.getElementById('sudLockOverlay');
  if (lock) lock.classList.add('hidden');
  playSUDSound('roll');
  document.querySelector('.sud-dice-area')?.classList.add('is-rolling');

  const d1 = Math.floor(Math.random() * 6) + 1;
  const d2 = Math.floor(Math.random() * 6) + 1;
  const sum = d1 + d2;

  let flicker = 0;
  const flickerInt = setInterval(() => {
    document.getElementById('dice1').textContent = DICE_FACES[Math.floor(Math.random()*6)];
    document.getElementById('dice2').textContent = DICE_FACES[Math.floor(Math.random()*6)];
    document.getElementById('sudSum').textContent = Math.floor(Math.random()*11)+2;
    flicker++;
    playSUDSound('rattle');
    if (flicker > 12) {
      clearInterval(flickerInt);
      document.querySelector('.sud-dice-area')?.classList.remove('is-rolling');
      showResult(d1, d2, sum);
    }
  }, 80);
}

function showResult(d1, d2, sum) {
  sudGame.state = 'result';

  document.getElementById('dice1').textContent = DICE_FACES[d1 - 1];
  document.getElementById('dice2').textContent = DICE_FACES[d2 - 1];
  document.getElementById('sudSum').textContent = sum;
  const diceArea = document.querySelector('.sud-dice-area');
  if (diceArea) { diceArea.classList.remove('is-rolling'); diceArea.classList.add('show-result'); }
  playSUDSound('result');

  const isOdd = sum % 2 !== 0;

  let totalWin = 0;
  let details = [];

  Object.keys(sudGame.bets).forEach(type => {
    const amt = sudGame.bets[type];
    let won = false;
    let mult = 0;

    if (type === 'down' && sum < 7) { won = true; mult = 2; }
    else if (type === 'up' && sum > 7) { won = true; mult = 2; }
    else if (type === 'lucky' && sum === 7) { won = true; mult = 5; }
    else if (type === 'odd' && isOdd) { won = true; mult = 2; }
    else if (type === 'even' && !isOdd) { won = true; mult = 2; }
    else if (type.startsWith('num') && parseInt(type.replace('num','')) === sum) {
      won = true; mult = 9;
    }

    if (won) {
      const winAmt = Math.floor(amt * mult);
      totalWin += winAmt;
      details.push(`${type} +${winAmt}`);
      addTx('win', winAmt, `7U7D: ${type}`);
    }
  });

  if (totalWin > 0) {
    sudGame.balance += totalWin;
    updateAllBalances();
    updateStatus(`You won ${totalWin} coins! 🎉`);
    showToast(`+${totalWin} coins! ${details.join(', ')}`);
  } else {
    updateStatus(`Result: ${sum} — Better luck next time!`);
  }

  sudGame.history.unshift({ d1, d2, sum, isOdd });
  sudGame.history = sudGame.history.slice(0, 10);
  localStorage.setItem('sudHistory', JSON.stringify(sudGame.history));
  renderHistory();
  renderRoadmap();
  const lock = document.getElementById('sudLockOverlay');
  const lockText = document.getElementById('sudLockText');
  if (lock && lockText) {
    lockText.textContent = totalWin > 0 ? 'YOU WIN +' + totalWin : 'RESULT ' + sum;
    lock.classList.remove('hidden');
    lock.classList.add('result-pop');
  }
  setTimeout(() => {
    if (lock) { lock.classList.add('hidden'); lock.classList.remove('result-pop'); }
    if (diceArea) diceArea.classList.remove('show-result');
    startBettingRound();
  }, 3000);
}

function resetDice() {
  document.getElementById('dice1').textContent = '⚀';
  document.getElementById('dice2').textContent = '⚀';
  document.getElementById('sudSum').textContent = '?';
  const area = document.querySelector('.sud-dice-area');
  if (area) area.classList.remove('is-rolling', 'show-result');
}

// ========================
// HISTORY
// ========================
function renderHistory() {
  const list = document.getElementById('sudHistory');
  if (!list) return;
  if (sudGame.history.length === 0) {
    list.innerHTML = '<div style="color:#666;text-align:center;padding:1rem;">No results yet</div>';
    return;
  }
  list.innerHTML = sudGame.history.map(h => {
    const cls = h.sum < 7 ? 'green' : h.sum > 7 ? 'red' : 'violet';
    const label = h.sum < 7 ? 'DOWN' : h.sum > 7 ? 'UP' : 'LUCKY 7';
    return `<div class="sud-history-item">
      <span>🎲 ${h.d1} + ${h.d2}</span>
      <span class="sud-h-sum ${cls}">${h.sum} (${label})</span>
    </div>`;
  }).join('');
}

// ========================
// WALLET
// ========================
function updateAllBalances() {
  const navBal = document.getElementById('navBalance');
  if (navBal) navBal.textContent = sudGame.balance;
  const walletBal = document.getElementById('walletBalance');
  if (walletBal) walletBal.textContent = sudGame.balance;
  localStorage.setItem('demoBalance', sudGame.balance);
}

function addTx(type, amount, note = '') {
  sudGame.transactions.unshift({ type, amount, note, time: new Date().toLocaleTimeString() });
  sudGame.transactions = sudGame.transactions.slice(0, 30);
  localStorage.setItem('demoTx', JSON.stringify(sudGame.transactions));
  renderTx();
}

function renderTx() {
  const box = document.getElementById('txHistory');
  if (!box) return;
  if (sudGame.transactions.length === 0) {
    box.innerHTML = '<div style="padding:0.5rem;color:#666;text-align:center;">No transactions yet</div>';
    return;
  }
  box.innerHTML = sudGame.transactions.map(tx => {
    const sign = (tx.type === 'add' || tx.type === 'win') ? '+' : '-';
    return `<div class="tx-item"><span>${tx.note || tx.type}</span><span class="tx-${tx.type}">${sign}${tx.amount}</span></div>`;
  }).join('');
}

function openWallet() {
  document.getElementById('walletModal').classList.remove('hidden');
  updateAllBalances();
  renderTx();
}
function closeWallet() {
  document.getElementById('walletModal').classList.add('hidden');
}
function addCoins() { window.location.href = 'payment.html?method=upi'; }
function withdrawCoins() {
  if (sudGame.balance <= 0) { showToast('No coins to withdraw!'); return; }
  const amount = Math.min(sudGame.balance, 500);
  sudGame.balance -= amount;
  updateAllBalances();
  addTx('withdraw', amount, 'Withdrawn to Vault');
  showToast(`${amount} coins moved to Vault 🔒`);
}

// Lightweight synthesized casino-style sounds; no external audio files required.
let sudAudioContext = null;
function unlockSUDSound() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    if (!sudAudioContext) sudAudioContext = new Ctx();
    if (sudAudioContext.state === 'suspended') sudAudioContext.resume();
    sudGame.soundReady = true;
  } catch (e) { /* sound is optional on unsupported browsers */ }
}
function playSUDSound(kind) {
  try {
    if (!sudAudioContext) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      sudAudioContext = new Ctx();
    }
    if (sudAudioContext.state === 'suspended') return;
    const ctx = sudAudioContext;
    const now = ctx.currentTime;
    const tone = (freq, duration, type='sine', volume=0.035, delay=0) => {
      const osc = ctx.createOscillator(), gain = ctx.createGain();
      osc.type = type; osc.frequency.setValueAtTime(freq, now + delay);
      gain.gain.setValueAtTime(0.0001, now + delay);
      gain.gain.exponentialRampToValueAtTime(volume, now + delay + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + delay + duration);
      osc.connect(gain); gain.connect(ctx.destination);
      osc.start(now + delay); osc.stop(now + delay + duration + 0.02);
    };
    if (kind === 'bet') { tone(760, .055, 'triangle', .04); tone(1040, .07, 'sine', .025, .035); }
    else if (kind === 'tick') tone(880, .055, 'square', .018);
    else if (kind === 'lock') { tone(260, .13, 'triangle', .035); tone(190, .16, 'sine', .025, .07); }
    else if (kind === 'roll') { tone(180, .3, 'sawtooth', .025); tone(320, .22, 'triangle', .025, .1); }
    else if (kind === 'rattle') { tone(280 + Math.random()*520, .035, 'square', .012); }
    else if (kind === 'result') { tone(660, .12, 'triangle', .04); tone(880, .16, 'triangle', .04, .12); tone(1100, .2, 'sine', .035, .25); }
  } catch (e) { /* fail quietly if Web Audio is blocked */ }
}

let toastTimer;
function showToast(msg) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.add('hidden'), 2500);
}function renderRoadmap() {
  const list = document.getElementById('sudRoadmap');
  if (!list) return;
  if (!sudGame.history.length) {
    list.innerHTML = '<span class="sud-roadmap-empty">Waiting for first result</span>';
    return;
  }
  list.innerHTML = sudGame.history.slice(0, 10).map(h => {
    const cls = h.sum < 7 ? 'down' : h.sum > 7 ? 'up' : 'lucky';
    return '<span class="sud-roadmap-pill ' + cls + '"><b>' + h.sum + '</b><small>' + h.d1 + '+' + h.d2 + '</small></span>';
  }).join('');
}


