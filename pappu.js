// ========================
// PAPPU PLAY GAME
// ========================
const pappuGame = {
  state: 'betting',
  timer: 30,
  balance: Number(localStorage.getItem('demoBalance') ?? 0),
  transactions: JSON.parse(localStorage.getItem('demoTx')) || [],
  history: JSON.parse(localStorage.getItem('pappuHistory')) || [],
  bets: {},
  chipValue: 50,
  timerInterval: null
};

const PAPPU_PICTURES = [
  { id: 'titli',    name: 'Titli',    icon: '🦋', color: '#e74c3c' },
  { id: 'kabutar',  name: 'Kabutar',  icon: '🕊️', color: '#3498db' },
  { id: 'chidiya',  name: 'Chidiya',  icon: '🐦', color: '#f1c40f' },
  { id: 'masakali', name: 'Masakali', icon: '🦜', color: '#2ecc71' },
  { id: 'bhanwra',  name: 'Bhanwra',  icon: '🐝', color: '#f39c12' },
  { id: 'machhli',  name: 'Machhli',  icon: '🐟', color: '#1abc9c' },
  { id: 'sher',     name: 'Sher',     icon: '🦁', color: '#e67e22' },
  { id: 'hathi',    name: 'Hathi',    icon: '🐘', color: '#9b59b6' },
  { id: 'mor',      name: 'Mor',      icon: '🦚', color: '#2c3e50' },
  { id: 'chuha',    name: 'Chuha',    icon: '🐭', color: '#95a5a6' },
  { id: 'kutta',    name: 'Kutta',    icon: '🐕', color: '#d35400' },
  { id: 'billi',    name: 'Billi',    icon: '🐱', color: '#c0392b' }
];

const PAPPU_PAYOUT = 10;

// ========================
// INIT
// ========================
document.addEventListener('DOMContentLoaded', () => {
  buildPappuGrid();
  updateAllBalances();
  renderHistory();
  renderBets();
  startBettingRound();
  selectChip(50);
});

function buildPappuGrid() {
  const grid = document.getElementById('pappuGrid');
  grid.innerHTML = PAPPU_PICTURES.map(p => `
    <div class="pappu-item" data-id="${p.id}" onclick="placeBet('${p.id}')">
      <div class="pappu-icon" style="border-color:${p.color}; color:${p.color}">${p.icon}</div>
      <div class="pappu-name">${p.name}</div>
      <div class="pappu-bet-amount" id="bet-${p.id}">0</div>
    </div>
  `).join('');
}

function startBettingRound() {
  pappuGame.state = 'betting';
  pappuGame.timer = 30;
  pappuGame.bets = {};
  renderBets();
  updateTotalBet();
  updateStatus('Place your bets!');
  updateTimerDisplay();
  resetResultDisplay();

  if (pappuGame.timerInterval) clearInterval(pappuGame.timerInterval);
  pappuGame.timerInterval = setInterval(() => {
    pappuGame.timer--;
    updateTimerDisplay();
    if (pappuGame.timer <= 5) updateStatus('Betting closing soon!');
    if (pappuGame.timer <= 0) {
      clearInterval(pappuGame.timerInterval);
      drawResult();
    }
  }, 1000);
}

function updateTimerDisplay() {
  const el = document.getElementById('pappuTimer');
  el.textContent = pappuGame.timer;
  if (pappuGame.timer <= 5) {
    el.style.color = '#e94560';
  } else {
    el.style.color = '#f7d774';
  }
}

function updateStatus(msg) {
  document.getElementById('pappuStatus').textContent = msg;
}

// ========================
// CHIP SELECTION
// ========================
function selectChip(val) {
  pappuGame.chipValue = val;
  document.querySelectorAll('.chip').forEach(c => {
    c.classList.toggle('active', parseInt(c.dataset.val) === val);
  });
}

// ========================
// PLACE BET
// ========================
function placeBet(pictureId) {
  if (pappuGame.state !== 'betting') {
    showToast('Betting is closed!');
    return;
  }
  const chip = pappuGame.chipValue;
  if (pappuGame.balance < chip) {
    showToast('Insufficient coins!');
    return;
  }
  pappuGame.balance -= chip;
  if (window.reportLiveBet) reportLiveBet(pictureId, chip);
  pappuGame.bets[pictureId] = (pappuGame.bets[pictureId] || 0) + chip;
  updateAllBalances();
  renderBets();
  updateTotalBet();
  addTx('bet', chip, `Pappu: ${pictureId}`);
}

function renderBets() {
  PAPPU_PICTURES.forEach(p => {
    const el = document.getElementById('bet-' + p.id);
    if (el) el.textContent = pappuGame.bets[p.id] || 0;
  });
}

function updateTotalBet() {
  const total = Object.values(pappuGame.bets).reduce((a, b) => a + b, 0);
  document.getElementById('pappuTotalBet').textContent = total;
}

function clearBets() {
  if (pappuGame.state !== 'betting') return;
  const total = Object.values(pappuGame.bets).reduce((a, b) => a + b, 0);
  if (total > 0) {
    pappuGame.balance += total;
    updateAllBalances();
    showToast(`${total} coins returned`);
  }
  pappuGame.bets = {};
  renderBets();
  updateTotalBet();
}

// ========================
// DRAW RESULT
// ========================
function drawResult() {
  pappuGame.state = 'drawing';
  updateStatus('Drawing winner...');

  const display = document.getElementById('pappuResultDisplay');
  display.classList.add('drawing');

  let flicker = 0;
  const flickerInt = setInterval(() => {
    const randPic = PAPPU_PICTURES[Math.floor(Math.random() * PAPPU_PICTURES.length)];
    document.getElementById('pappuResultIcon').textContent = randPic.icon;
    document.getElementById('pappuResultText').textContent = randPic.name;
    flicker++;
    if (flicker > 15) {
      clearInterval(flickerInt);
      display.classList.remove('drawing');
      showResult();
    }
  }, 100);
}

function showResult() {
  pappuGame.state = 'result';

  const winner = PAPPU_PICTURES[Math.floor(Math.random() * PAPPU_PICTURES.length)];

  document.getElementById('pappuResultIcon').textContent = winner.icon;
  document.getElementById('pappuResultText').textContent = `🏆 ${winner.name} WINS!`;

  document.querySelectorAll('.pappu-item').forEach(el => {
    el.classList.toggle('winner', el.dataset.id === winner.id);
  });

  let totalWin = 0;
  let details = [];

  Object.keys(pappuGame.bets).forEach(picId => {
    const amt = pappuGame.bets[picId];
    if (picId === winner.id) {
      const winAmt = amt * PAPPU_PAYOUT;
      totalWin += winAmt;
      const pic = PAPPU_PICTURES.find(p => p.id === picId);
      details.push(`${pic.name} +${winAmt}`);
      addTx('win', winAmt, `Pappu: ${picId} @ ${PAPPU_PAYOUT}x`);
    }
  });

  if (totalWin > 0) {
    pappuGame.balance += totalWin;
    updateAllBalances();
    updateStatus(`You won ${totalWin} coins! 🎉`);
    showToast(`+${totalWin} coins! ${details.join(', ')}`);
  } else {
    updateStatus(`${winner.name} wins — Better luck next time!`);
  }

  pappuGame.history.unshift({ icon: winner.icon, name: winner.name, id: winner.id });
  pappuGame.history = pappuGame.history.slice(0, 10);
  localStorage.setItem('pappuHistory', JSON.stringify(pappuGame.history));
  renderHistory();

  setTimeout(() => {
    document.querySelectorAll('.pappu-item').forEach(el => el.classList.remove('winner'));
    startBettingRound();
  }, 3000);
}

function resetResultDisplay() {
  document.getElementById('pappuResultIcon').textContent = '❓';
  document.getElementById('pappuResultText').textContent = 'Waiting...';
  document.getElementById('pappuResultDisplay').classList.remove('drawing');
}

// ========================
// HISTORY
// ========================
function renderHistory() {
  const list = document.getElementById('pappuHistory');
  if (!list) return;
  if (pappuGame.history.length === 0) {
    list.innerHTML = '<div style="color:#666;text-align:center;padding:1rem;">No results yet</div>';
    return;
  }
  list.innerHTML = pappuGame.history.map(h => `
    <div class="pappu-history-item">
      <span class="pappu-h-icon">${h.icon}</span>
      <span class="pappu-h-name">${h.name}</span>
    </div>
  `).join('');
}

// ========================
// WALLET
// ========================
function updateAllBalances() {
  const navBal = document.getElementById('navBalance');
  if (navBal) navBal.textContent = pappuGame.balance;
  const walletBal = document.getElementById('walletBalance');
  if (walletBal) walletBal.textContent = pappuGame.balance;
  localStorage.setItem('demoBalance', pappuGame.balance);
}

function addTx(type, amount, note = '') {
  pappuGame.transactions.unshift({ type, amount, note, time: new Date().toLocaleTimeString() });
  pappuGame.transactions = pappuGame.transactions.slice(0, 30);
  localStorage.setItem('demoTx', JSON.stringify(pappuGame.transactions));
  renderTx();
}

function renderTx() {
  const box = document.getElementById('txHistory');
  if (!box) return;
  if (pappuGame.transactions.length === 0) {
    box.innerHTML = '<div style="padding:0.5rem;color:#666;text-align:center;">No transactions yet</div>';
    return;
  }
  box.innerHTML = pappuGame.transactions.map(tx => {
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
  if (pappuGame.balance <= 0) { showToast('No coins to withdraw!'); return; }
  const amount = Math.min(pappuGame.balance, 500);
  pappuGame.balance -= amount;
  updateAllBalances();
  addTx('withdraw', amount, 'Withdrawn to Vault');
  showToast(`${amount} coins moved to Vault 🔒`);
}

let toastTimer;
function showToast(msg) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.add('hidden'), 2500);
}
