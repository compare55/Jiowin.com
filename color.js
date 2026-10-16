// ========================
// COLOR PREDICTION GAME
// ========================
const colorGame = {
  state: 'betting',
  timer: 30,
  period: 0,
  balance: Number(localStorage.getItem('demoBalance') ?? 0),
  history: JSON.parse(localStorage.getItem('colorHistory')) || [],
  myBets: JSON.parse(localStorage.getItem('colorBets')) || [],
  timerInterval: null
};

const COLOR_MAP = {
  0: { color: 'violet', size: 'small' },
  1: { color: 'green', size: 'small' },
  2: { color: 'red', size: 'small' },
  3: { color: 'green', size: 'small' },
  4: { color: 'red', size: 'small' },
  5: { color: 'violet', size: 'big' },
  6: { color: 'red', size: 'big' },
  7: { color: 'green', size: 'big' },
  8: { color: 'red', size: 'big' },
  9: { color: 'green', size: 'big' }
};

// ========================
// INIT
// ========================
document.addEventListener('DOMContentLoaded', () => {
  generatePeriod();
  renderHistory();
  updateAllBalances();
  startTimer();
});

function generatePeriod() {
  const now = new Date();
  colorGame.period = `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}${String(now.getHours()).padStart(2,'0')}${String(Math.floor(now.getMinutes()/30)).padStart(2,'0')}${String(now.getSeconds()).padStart(2,'0')}`;
  document.getElementById('periodNumber').textContent = colorGame.period;
}

// ========================
// TIMER
// ========================
function startTimer() {
  if (colorGame.timerInterval) clearInterval(colorGame.timerInterval);
  colorGame.timer = 30;
  colorGame.state = 'betting';
  updateTimerDisplay();

  colorGame.timerInterval = setInterval(() => {
    colorGame.timer--;
    updateTimerDisplay();
    if (colorGame.timer <= 0) {
      clearInterval(colorGame.timerInterval);
      drawResult();
    }
  }, 1000);
}

function updateTimerDisplay() {
  const el = document.getElementById('timerDisplay');
  const mins = String(Math.floor(colorGame.timer / 60)).padStart(2, '0');
  const secs = String(colorGame.timer % 60).padStart(2, '0');
  el.textContent = `${mins}:${secs}`;
  el.style.color = colorGame.timer <= 5 ? '#e94560' : '#f1c40f';
}

// ========================
// DRAW RESULT
// ========================
function drawResult() {
  colorGame.state = 'drawing';
  const resultNum = Math.floor(Math.random() * 10);
  const resultColor = COLOR_MAP[resultNum].color;
  const resultSize = COLOR_MAP[resultNum].size;
  const ball = document.getElementById('resultBall');
  ball.textContent = '?';
  ball.className = 'result-ball drawing';

  let flickerCount = 0;
  const flickerInterval = setInterval(() => {
    ball.textContent = Math.floor(Math.random() * 10);
    flickerCount++;
    if (flickerCount > 15) {
      clearInterval(flickerInterval);
      showResult(resultNum, resultColor, resultSize);
    }
  }, 80);
}

function showResult(num, color, size) {
  const ball = document.getElementById('resultBall');
  ball.textContent = num;
  ball.className = `result-ball ${color}`;

  let totalWin = 0;
  const bets = colorGame.myBets;

  bets.forEach(bet => {
    let won = false, multiplier = 0;
    if (bet.type === 'green' && color === 'green') { won = true; multiplier = 2; }
    else if (bet.type === 'red' && color === 'red') { won = true; multiplier = 2; }
    else if (bet.type === 'violet' && color === 'violet') { won = true; multiplier = 4.5; }
    else if (bet.type === 'big' && size === 'big') { won = true; multiplier = 2; }
    else if (bet.type === 'small' && size === 'small') { won = true; multiplier = 2; }
    else if (bet.type.startsWith('num') && parseInt(bet.type.replace('num','')) === num) {
      won = true; multiplier = 9;
    }
    if (num === 5 && (bet.type === 'green' || bet.type === 'violet')) {
      won = true;
      multiplier = bet.type === 'green' ? 2 : 4.5;
    }
    if (won) {
      const winAmount = Math.floor(bet.amount * multiplier);
      totalWin += winAmount;
      addTx('win', winAmount, `Color ${bet.type} @ ${multiplier}x`);
    }
  });

  if (totalWin > 0) {
    colorGame.balance += totalWin;
    updateAllBalances();
    showToast(`+${totalWin} coins! 🎉`);
  } else if (bets.length > 0) {
    showToast('Better luck next time!');
  }

  colorGame.history.unshift({ num, color, size, period: colorGame.period });
  colorGame.history = colorGame.history.slice(0, 10);
  localStorage.setItem('colorHistory', JSON.stringify(colorGame.history));
  renderHistory();

  colorGame.myBets = [];
  localStorage.removeItem('colorBets');
  colorGame.state = 'result';

  setTimeout(() => {
    generatePeriod();
    startTimer();
  }, 3000);
}

// ========================
// PLACE BET
// ========================
function placeBet(type, number = null) {
  if (colorGame.state !== 'betting') {
    showToast('Betting is closed!');
    return;
  }
  const betAmount = parseInt(document.getElementById('colorBet').value);
  if (betAmount < 10) {
    showToast('Minimum bet is 10 coins');
    return;
  }
  if (colorGame.balance < betAmount) {
    showToast('Insufficient coins!');
    return;
  }
  colorGame.balance -= betAmount;
  if (window.reportLiveBet) reportLiveBet(type, betAmount);
  updateAllBalances();
  colorGame.myBets.push({ type, number, amount: betAmount });
  localStorage.setItem('colorBets', JSON.stringify(colorGame.myBets));
  addTx('bet', betAmount, `Color bet: ${type}`);
  showToast(`Bet placed: ${betAmount} on ${type}`);
}

// ========================
// HISTORY
// ========================
function renderHistory() {
  const list = document.getElementById('colorHistory');
  if (!list) return;
  if (colorGame.history.length === 0) {
    list.innerHTML = '<div style="color:#666;text-align:center;padding:1rem;">No results yet</div>';
    return;
  }
  list.innerHTML = colorGame.history.map(h => `
    <div class="history-item">
      <span class="history-period">${h.period ? h.period.slice(-6) : '—'}</span>
      <span class="history-num ${h.color}">${h.num}</span>
      <span class="history-color ${h.color}">${h.color.toUpperCase()}</span>
      <span class="history-size">${h.size.toUpperCase()}</span>
    </div>`).join('');
}

// ========================
// UI HELPERS
// ========================
function adjustBet(amount) {
  const input = document.getElementById('colorBet');
  let val = parseInt(input.value) + amount;
  if (val < 10) val = 10;
  input.value = val;
}
function setBet(amount) {
  document.getElementById('colorBet').value = amount;
}

// ========================
// WALLET
// ========================
function updateAllBalances() {
  const navBal = document.getElementById('navBalance');
  if (navBal) navBal.textContent = colorGame.balance;
  const inlineBal = document.getElementById('inlineBalance');
  if (inlineBal) inlineBal.textContent = colorGame.balance;
  const walletBal = document.getElementById('walletBalance');
  if (walletBal) walletBal.textContent = colorGame.balance;
  localStorage.setItem('demoBalance', colorGame.balance);
}

function addTx(type, amount, note = '') {
  const tx = JSON.parse(localStorage.getItem('demoTx')) || [];
  tx.unshift({ type, amount, note, time: new Date().toLocaleTimeString() });
  localStorage.setItem('demoTx', JSON.stringify(tx.slice(0, 30)));
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
  if (colorGame.balance <= 0) { showToast('No coins to withdraw!'); return; }
  const amount = Math.min(colorGame.balance, 500);
  colorGame.balance -= amount;
  updateAllBalances();
  addTx('withdraw', amount, 'Withdrawn to Vault');
  showToast(`${amount} coins moved to Vault 🔒`);
}

function renderTx() {
  const box = document.getElementById('txHistory');
  if (!box) return;
  const tx = JSON.parse(localStorage.getItem('demoTx')) || [];
  if (tx.length === 0) {
    box.innerHTML = '<div style="padding:0.5rem;color:#666;text-align:center;">No transactions yet</div>';
    return;
  }
  box.innerHTML = tx.map(t => {
    const sign = (t.type === 'add' || t.type === 'win') ? '+' : '-';
    return `<div class="tx-item"><span>${t.note}</span><span class="tx-${t.type}">${sign}${t.amount}</span></div>`;
  }).join('');
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
