// ========================
// SLOT GAME
// ========================
const SYMBOLS = [
  { id: 'cherry',  emoji: '🍒', weight: 22, pay: { 3: 3, 4: 8, 5: 20 } },
  { id: 'lemon',   emoji: '🍋', weight: 20, pay: { 3: 4, 4: 10, 5: 25 } },
  { id: 'bell',    emoji: '🔔', weight: 16, pay: { 3: 5, 4: 12, 5: 30 } },
  { id: 'star',    emoji: '⭐', weight: 14, pay: { 3: 6, 4: 15, 5: 40 } },
  { id: 'diamond', emoji: '💎', weight: 10, pay: { 3: 10, 4: 25, 5: 60 } },
  { id: 'seven',   emoji: '7️⃣', weight: 6,  pay: { 3: 15, 4: 40, 5: 100 } }
];

let balance = Number(localStorage.getItem('demoBalance') ?? 0);
let transactions = JSON.parse(localStorage.getItem('demoTx')) || [];
let currentBet = 50;
let spinning = false;

const reels = document.querySelectorAll('.reel');
const spinBtn = document.getElementById('spinBtn');
const messageEl = document.getElementById('message');
const bigWinBanner = document.getElementById('bigWinBanner');

document.addEventListener('DOMContentLoaded', () => {
  updateAllBalances();
  renderTx();
  setupBetChips();
  animateJackpot();
  randomizeReels();
  spinBtn.addEventListener('click', spin);
});

// ========================
// SETUP
// ========================
function setupBetChips() {
  document.querySelectorAll('.bet-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      if (spinning) return;
      document.querySelectorAll('.bet-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      currentBet = parseInt(chip.dataset.bet);
    });
  });
}

function animateJackpot() {
  const el = document.getElementById('jackpotValue');
  if (!el) return;
  let value = 12450000;
  setInterval(() => {
    value += Math.floor(Math.random() * 500) + 100;
    el.textContent = value.toLocaleString();
  }, 3000);
}

// ========================
// SYMBOL LOGIC
// ========================
function getRandomSymbol() {
  const total = SYMBOLS.reduce((s, x) => s + x.weight, 0);
  let r = Math.random() * total;
  for (const sym of SYMBOLS) {
    r -= sym.weight;
    if (r <= 0) return sym;
  }
  return SYMBOLS[0];
}

function randomizeReels() {
  reels.forEach(reel => {
    const drum = reel.querySelector('.reel-drum');
    const syms = drum.querySelectorAll('.sym');
    syms.forEach(s => {
      const s2 = getRandomSymbol();
      s.textContent = s2.emoji;
      s.dataset.sym = s2.id;
    });
  });
}

// ========================
// SPIN
// ========================
function spin() {
  if (spinning) return;
  if (balance < currentBet) {
    messageEl.textContent = '⚠️ Insufficient coins! Add in wallet.';
    messageEl.classList.add('shake');
    setTimeout(() => messageEl.classList.remove('shake'), 500);
    return;
  }

  spinning = true;
  spinBtn.disabled = true;
  spinBtn.classList.add('spinning');
  balance -= currentBet;
  if (window.reportLiveBet) reportLiveBet('Spin', currentBet);
  addTx('bet', currentBet, 'Slot Bet');
  updateAllBalances();
  messageEl.textContent = '🎰 Spinning...';
  messageEl.classList.remove('win', 'lose');
  clearWinHighlights();
  hideBigWin();

  const results = [];

  reels.forEach((reel, i) => {
    const stopDelay = 900 + i * 250 + Math.random() * 200;
    reel.classList.add('spinning');

    const spinInt = setInterval(() => {
      const drum = reel.querySelector('.reel-drum');
      const syms = drum.querySelectorAll('.sym');
      syms.forEach(s => {
        const s2 = getRandomSymbol();
        s.textContent = s2.emoji;
        s.dataset.sym = s2.id;
      });
    }, 60);

    setTimeout(() => {
      clearInterval(spinInt);
      reel.classList.remove('spinning');

      const drum = reel.querySelector('.reel-drum');
      const syms = drum.querySelectorAll('.sym');
      const finalSyms = [getRandomSymbol(), getRandomSymbol(), getRandomSymbol()];
      syms.forEach((s, idx) => {
        s.textContent = finalSyms[idx].emoji;
        s.dataset.sym = finalSyms[idx].id;
      });
      results[i] = finalSyms;

      if (i === reels.length - 1) {
        setTimeout(() => evaluateWins(results), 300);
      }
    }, stopDelay);
  });
}

// ========================
// EVALUATE
// ========================
function evaluateWins(results) {
  const grid = [[], [], []];
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 5; col++) {
      grid[row][col] = results[col][row];
    }
  }

  let totalWin = 0;
  let winLines = 0;

  for (let row = 0; row < 3; row++) {
    const line = grid[row];
    const firstId = line[0].id;
    let count = 1;
    for (let i = 1; i < 5; i++) {
      if (line[i].id === firstId) count++;
      else break;
    }
    if (count >= 3) {
      const sym = line[0];
      const pay = sym.pay[count] || 0;
      if (pay > 0) {
        const win = currentBet * pay;
        totalWin += win;
        winLines++;
        for (let i = 0; i < count; i++) {
          const reel = reels[i];
          const cells = reel.querySelectorAll('.sym');
          cells[row].classList.add('win-cell');
        }
      }
    }
  }

  spinning = false;
  spinBtn.disabled = false;
  spinBtn.classList.remove('spinning');

  if (totalWin > 0) {
    balance += totalWin;
    addTx('win', totalWin, `Slot Win x${winLines}`);
    updateAllBalances();

    if (totalWin >= currentBet * 20) {
      showBigWin(totalWin);
      messageEl.textContent = `💥 MEGA WIN! +${totalWin} coins!`;
    } else if (totalWin >= currentBet * 10) {
      showBigWin(totalWin);
      messageEl.textContent = `🎉 BIG WIN! +${totalWin} coins!`;
    } else {
      messageEl.textContent = `✨ You won ${totalWin} coins!`;
      messageEl.classList.add('win');
    }
    spawnCoins(totalWin >= currentBet * 10 ? 30 : 15);
  } else {
    messageEl.textContent = '😔 Try again!';
    messageEl.classList.add('lose');
  }
}

function clearWinHighlights() {
  document.querySelectorAll('.sym').forEach(s => s.classList.remove('win-cell'));
}

// ========================
// EFFECTS
// ========================
function spawnCoins(count) {
  for (let i = 0; i < count; i++) {
    setTimeout(() => {
      const coin = document.createElement('div');
      coin.className = 'flying-coin';
      coin.textContent = '🪙';
      coin.style.left = Math.random() * 100 + 'vw';
      coin.style.animationDuration = (1.5 + Math.random() * 1) + 's';
      document.body.appendChild(coin);
      setTimeout(() => coin.remove(), 2600);
    }, i * 40);
  }
}

function showBigWin(amount) {
  document.getElementById('bigWinAmount').textContent = amount;
  bigWinBanner.classList.remove('hidden');
  bigWinBanner.classList.add('show');
  setTimeout(() => {
    bigWinBanner.classList.remove('show');
    bigWinBanner.classList.add('hidden');
  }, 3000);
}

function hideBigWin() {
  bigWinBanner.classList.add('hidden');
  bigWinBanner.classList.remove('show');
}

// ========================
// WALLET
// ========================
function updateAllBalances() {
  const navBal = document.getElementById('navBalance');
  if (navBal) navBal.textContent = balance;
  const slotBal = document.getElementById('slotBalance');
  if (slotBal) slotBal.textContent = balance;
  const walletBal = document.getElementById('walletBalance');
  if (walletBal) walletBal.textContent = balance;
  localStorage.setItem('demoBalance', balance);
}

function addTx(type, amount, note = '') {
  transactions.unshift({ type, amount, note, time: new Date().toLocaleTimeString() });
  transactions = transactions.slice(0, 30);
  localStorage.setItem('demoTx', JSON.stringify(transactions));
  renderTx();
}

function renderTx() {
  const box = document.getElementById('txHistory');
  if (!box) return;
  if (transactions.length === 0) {
    box.innerHTML = '<div style="padding:0.5rem;color:#666;text-align:center;">No transactions yet</div>';
    return;
  }
  box.innerHTML = transactions.map(tx => {
    const sign = (tx.type === 'add' || tx.type === 'win') ? '+' : '-';
    return `<div class="tx-item"><span>${tx.note}</span><span class="tx-${tx.type}">${sign}${tx.amount}</span></div>`;
  }).join('');
}

function openWallet() {
  document.getElementById('walletModal').classList.remove('hidden');
  updateAllBalances();
  renderTx();
}
function closeWallet() { document.getElementById('walletModal').classList.add('hidden'); }
function addCoins() { window.location.href = 'payment.html?method=upi'; }
function withdrawCoins() {
  if (balance <= 0) { showToast('No coins!'); return; }
  const amt = Math.min(balance, 500);
  balance -= amt;
  updateAllBalances();
  addTx('withdraw', amt, 'Withdrawn');
  showToast(`${amt} coins moved to Vault`);
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
