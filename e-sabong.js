// ========================
// SUPER E-SABONG GAME
// ========================
const esabongGame = {
  state: 'betting',
  timer: 15,
  balance: Number(localStorage.getItem('demoBalance') ?? 0),
  transactions: JSON.parse(localStorage.getItem('demoTx')) || [],
  history: JSON.parse(localStorage.getItem('esabongHistory')) || [],
  bets: {},
  chipValue: 50,
  timerInterval: null,
  fightInterval: null,
  meronPool: 0,
  walaPool: 0,
  drawPool: 0,
  meronOdds: 2.00,
  walaOdds: 2.00
};

// ========================
// INIT
// ========================
document.addEventListener('DOMContentLoaded', () => {
  updateAllBalances();
  renderHistory();
  renderBets();
  startBettingRound();
  selectChip(50);
});

function startBettingRound() {
  esabongGame.state = 'betting';
  esabongGame.timer = 15;
  esabongGame.bets = {};
  esabongGame.meronPool = 0;
  esabongGame.walaPool = 0;
  esabongGame.drawPool = 0;
  esabongGame.meronOdds = 2.00;
  esabongGame.walaOdds = 2.00;

  renderBets();
  updateTotalBet();
  updatePoolDisplay();
  updateOddsDisplay();
  updateStatus('Place your bets!');
  updateTimerDisplay();
  resetRoosters();

  if (esabongGame.timerInterval) clearInterval(esabongGame.timerInterval);
  esabongGame.timerInterval = setInterval(() => {
    esabongGame.timer--;
    updateTimerDisplay();
    if (esabongGame.timer <= 5) updateStatus('Betting closing soon!');
    if (esabongGame.timer <= 0) {
      clearInterval(esabongGame.timerInterval);
      startFight();
    }
  }, 1000);
}

function updateTimerDisplay() {
  const el = document.getElementById('timerText');
  const fill = document.getElementById('timerFill');
  el.textContent = esabongGame.timer + 's';
  fill.style.width = (esabongGame.timer / 15) * 100 + '%';

  if (esabongGame.timer <= 5) {
    el.style.color = '#e94560';
    fill.style.background = 'linear-gradient(90deg, #e94560, #c0392b)';
  } else {
    el.style.color = '#f7d774';
    fill.style.background = 'linear-gradient(90deg, #f7d774, #f39c12)';
  }
}

function updateStatus(msg) {
  document.getElementById('fightStatus').textContent = msg;
}

// ========================
// CHIP SELECTION
// ========================
function selectChip(val) {
  esabongGame.chipValue = val;
  document.querySelectorAll('.chip').forEach(c => {
    c.classList.toggle('active', parseInt(c.dataset.val) === val);
  });
}

// ========================
// PLACE BET
// ========================
function placeBet(type) {
  if (esabongGame.state !== 'betting') {
    showToast('Betting is closed!');
    return;
  }
  const chip = esabongGame.chipValue;
  if (esabongGame.balance < chip) {
    showToast('Insufficient coins!');
    return;
  }
  esabongGame.balance -= chip;
  if (window.reportLiveBet) reportLiveBet(type, chip);
  esabongGame.bets[type] = (esabongGame.bets[type] || 0) + chip;

  if (type === 'meron') esabongGame.meronPool += chip;
  else if (type === 'wala') esabongGame.walaPool += chip;
  else if (type === 'draw') esabongGame.drawPool += chip;

  calculateOdds();

  updateAllBalances();
  renderBets();
  updateTotalBet();
  updatePoolDisplay();
  updateOddsDisplay();
  addTx('bet', chip, `E-Sabong: ${type}`);
}

function calculateOdds() {
  const total = esabongGame.meronPool + esabongGame.walaPool;
  if (total === 0) {
    esabongGame.meronOdds = 2.00;
    esabongGame.walaOdds = 2.00;
    return;
  }
  const meronPct = esabongGame.meronPool / total;
  const walaPct = esabongGame.walaPool / total;

  esabongGame.meronOdds = Math.max(1.20, Math.min(5.00, 2.00 * (1 - meronPct + 0.5)));
  esabongGame.walaOdds = Math.max(1.20, Math.min(5.00, 2.00 * (1 - walaPct + 0.5)));

  esabongGame.meronOdds = Math.round(esabongGame.meronOdds * 100) / 100;
  esabongGame.walaOdds = Math.round(esabongGame.walaOdds * 100) / 100;
}

function renderBets() {
  document.getElementById('betMeron').textContent = esabongGame.bets.meron || 0;
  document.getElementById('betWala').textContent = esabongGame.bets.wala || 0;
  document.getElementById('betDraw').textContent = esabongGame.bets.draw || 0;
}

function updateTotalBet() {
  const total = Object.values(esabongGame.bets).reduce((a, b) => a + b, 0);
  document.getElementById('esabongTotalBet').textContent = total;
}

function updatePoolDisplay() {
  document.getElementById('meronPool').textContent = esabongGame.meronPool;
  document.getElementById('walaPool').textContent = esabongGame.walaPool;
  document.getElementById('drawPool').textContent = esabongGame.drawPool;
}

function updateOddsDisplay() {
  document.getElementById('meronOdds').textContent = esabongGame.meronOdds.toFixed(2) + 'x';
  document.getElementById('walaOdds').textContent = esabongGame.walaOdds.toFixed(2) + 'x';
}

function clearBets() {
  if (esabongGame.state !== 'betting') return;
  const total = Object.values(esabongGame.bets).reduce((a, b) => a + b, 0);
  if (total > 0) {
    esabongGame.balance += total;
    updateAllBalances();
    showToast(`${total} coins returned`);
  }
  esabongGame.bets = {};
  esabongGame.meronPool = 0;
  esabongGame.walaPool = 0;
  esabongGame.drawPool = 0;
  renderBets();
  updateTotalBet();
  updatePoolDisplay();
  updateOddsDisplay();
}

// ========================
// FIGHT SIMULATION
// ========================
function startFight() {
  esabongGame.state = 'fighting';
  updateStatus('Fight in progress...');

  document.getElementById('meronRooster').classList.add('fighting');
  document.getElementById('walaRooster').classList.add('fighting');

  let fightTime = 0;
  const maxFightTime = 4000 + Math.random() * 3000;

  esabongGame.fightInterval = setInterval(() => {
    fightTime += 200;

    const meronEl = document.getElementById('meronRooster');
    const walaEl = document.getElementById('walaRooster');
    meronEl.style.transform = `translateX(${Math.random() * 20}px)`;
    walaEl.style.transform = `translateX(-${Math.random() * 20}px)`;

    if (fightTime >= maxFightTime) {
      clearInterval(esabongGame.fightInterval);
      determineWinner();
    }
  }, 200);
}

function determineWinner() {
  esabongGame.state = 'result';

  document.getElementById('meronRooster').classList.remove('fighting');
  document.getElementById('walaRooster').classList.remove('fighting');
  document.getElementById('meronRooster').style.transform = '';
  document.getElementById('walaRooster').style.transform = '';

  const rand = Math.random();
  let winner;
  if (rand < 0.10) winner = 'draw';
  else if (rand < 0.55) winner = 'meron';
  else winner = 'wala';

  if (winner === 'meron') {
    document.getElementById('meronRooster').classList.add('winner');
    document.getElementById('meronStatus').textContent = '🏆 WINNER!';
    document.getElementById('walaStatus').textContent = 'Lost';
  } else if (winner === 'wala') {
    document.getElementById('walaRooster').classList.add('winner');
    document.getElementById('walaStatus').textContent = '🏆 WINNER!';
    document.getElementById('meronStatus').textContent = 'Lost';
  } else {
    document.getElementById('meronRooster').classList.add('winner');
    document.getElementById('walaRooster').classList.add('winner');
    document.getElementById('meronStatus').textContent = '🤝 DRAW';
    document.getElementById('walaStatus').textContent = '🤝 DRAW';
  }

  let totalWin = 0;
  let details = [];

  Object.keys(esabongGame.bets).forEach(type => {
    const amt = esabongGame.bets[type];
    if (type === winner) {
      let mult = 2;
      if (type === 'draw') mult = 8;
      else if (type === 'meron') mult = esabongGame.meronOdds;
      else if (type === 'wala') mult = esabongGame.walaOdds;

      const winAmt = Math.floor(amt * mult);
      totalWin += winAmt;
      details.push(`${type} +${winAmt}`);
      addTx('win', winAmt, `E-Sabong: ${type} @ ${mult.toFixed(2)}x`);
    }
  });

  if (totalWin > 0) {
    esabongGame.balance += totalWin;
    updateAllBalances();
    updateStatus(`You won ${totalWin} coins! 🎉`);
    showToast(`+${totalWin} coins! ${details.join(', ')}`);
  } else {
    updateStatus(`${winner.toUpperCase()} wins — Better luck next time!`);
  }

  esabongGame.history.unshift({ winner, period: Date.now() });
  esabongGame.history = esabongGame.history.slice(0, 10);
  localStorage.setItem('esabongHistory', JSON.stringify(esabongGame.history));
  renderHistory();

  setTimeout(() => {
    document.getElementById('meronRooster').classList.remove('winner');
    document.getElementById('walaRooster').classList.remove('winner');
    document.getElementById('meronStatus').textContent = 'Ready';
    document.getElementById('walaStatus').textContent = 'Ready';
    startBettingRound();
  }, 3000);
}

function resetRoosters() {
  document.getElementById('meronRooster').classList.remove('winner', 'fighting');
  document.getElementById('walaRooster').classList.remove('winner', 'fighting');
  document.getElementById('meronStatus').textContent = 'Ready';
  document.getElementById('walaStatus').textContent = 'Ready';
}

// ========================
// HISTORY
// ========================
function renderHistory() {
  const list = document.getElementById('esabongHistory');
  if (!list) return;
  if (esabongGame.history.length === 0) {
    list.innerHTML = '<div style="color:#666;text-align:center;padding:1rem;">No results yet</div>';
    return;
  }
  list.innerHTML = esabongGame.history.map(h => {
    const icon = h.winner === 'meron' ? '🐓' : h.winner === 'wala' ? '🐓' : '🤝';
    const cls = h.winner === 'meron' ? 'green' : h.winner === 'wala' ? 'red' : 'violet';
    const label = h.winner === 'meron' ? 'MERON' : h.winner === 'wala' ? 'WALA' : 'DRAW';
    return `<div class="esabong-history-item">
      <span>${icon}</span>
      <span class="esabong-h-result ${cls}">${label}</span>
    </div>`;
  }).join('');
}

// ========================
// WALLET
// ========================
function updateAllBalances() {
  const navBal = document.getElementById('navBalance');
  if (navBal) navBal.textContent = esabongGame.balance;
  const walletBal = document.getElementById('walletBalance');
  if (walletBal) walletBal.textContent = esabongGame.balance;
  localStorage.setItem('demoBalance', esabongGame.balance);
}

function addTx(type, amount, note = '') {
  esabongGame.transactions.unshift({ type, amount, note, time: new Date().toLocaleTimeString() });
  esabongGame.transactions = esabongGame.transactions.slice(0, 30);
  localStorage.setItem('demoTx', JSON.stringify(esabongGame.transactions));
  renderTx();
}

function renderTx() {
  const box = document.getElementById('txHistory');
  if (!box) return;
  if (esabongGame.transactions.length === 0) {
    box.innerHTML = '<div style="padding:0.5rem;color:#666;text-align:center;">No transactions yet</div>';
    return;
  }
  box.innerHTML = esabongGame.transactions.map(tx => {
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
  if (esabongGame.balance <= 0) { showToast('No coins to withdraw!'); return; }
  const amount = Math.min(esabongGame.balance, 500);
  esabongGame.balance -= amount;
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
