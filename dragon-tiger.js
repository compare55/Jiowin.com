// ========================
// DRAGON TIGER GAME
// ========================
const dtGame = {
  state: 'betting',
  timer: 10,
  balance: Number(localStorage.getItem('demoBalance') ?? 0),
  transactions: JSON.parse(localStorage.getItem('demoTx')) || [],
  history: JSON.parse(localStorage.getItem('dtHistory')) || [],
  bets: {},
  chipValue: 50,
  timerInterval: null,
  roundNumber: 0,
  audioContext: null
};

const CARD_VALUES = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];
const CARD_SUITS = ['♠','♥','♦','♣'];
// FIX: Black suits ko black color diya (pehle white tha — card bg white hai isliye invisible ho rahe the)
const SUIT_COLORS = { '♠': '#000', '♥': '#e94560', '♦': '#e94560', '♣': '#000' };

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
  dtGame.state = 'betting';
  dtGame.roundNumber++;
  showRoundPopup('PLEASE BET NOW', 1200);
  playGameTone('start');
  dtGame.timer = 10;
  dtGame.bets = {};
  renderBets();
  updateTotalBet();
  updateStatus('Place your bets!');
  updateTimerDisplay();
  resetCards();

  if (dtGame.timerInterval) clearInterval(dtGame.timerInterval);
  dtGame.timerInterval = setInterval(() => {
    dtGame.timer--;
    updateTimerDisplay();
    if (dtGame.timer <= 5) updateStatus('Betting closing soon!');
    if (dtGame.timer <= 0) {
      clearInterval(dtGame.timerInterval);
      dtGame.state = 'locked';
      updateStatus('Bet Locked');
      showRoundPopup('BET LOCKED', 1000);
      playGameTone('lock');
      setTimeout(dealCards, 850);
    }
  }, 1000);
}

function updateTimerDisplay() {
  const el = document.getElementById('dtTimer');
  el.textContent = dtGame.timer;
  if (dtGame.timer <= 5) {
    el.style.color = '#e94560';
  } else {
    el.style.color = '#f7d774';
  }
}

function updateStatus(msg) {
  document.getElementById('dtStatus').textContent = msg;
  document.querySelectorAll('.dt-bet-btn, .dt-side-btn').forEach(btn => {
    btn.classList.toggle('bet-locked', dtGame.state !== 'betting');
    btn.setAttribute('aria-disabled', dtGame.state !== 'betting' ? 'true' : 'false');
  });
}

// ========================
// CHIP SELECTION
// ========================
function selectChip(val) {
  dtGame.chipValue = val;
  document.querySelectorAll('.chip').forEach(c => {
    c.classList.toggle('active', parseInt(c.dataset.val) === val);
  });
}

// ========================
// PLACE BET
// ========================
function placeBet(type) {
  if (dtGame.state !== 'betting') {
    showToast('Betting is closed!');
    return;
  }
  const chip = dtGame.chipValue;
  if (dtGame.balance < chip) {
    showToast('Insufficient coins!');
    return;
  }
  dtGame.balance -= chip;
  if (window.reportLiveBet) reportLiveBet(type, chip);
  dtGame.bets[type] = (dtGame.bets[type] || 0) + chip;
  updateAllBalances();
  renderBets();
  updateTotalBet();
  showPlacedChip(type, chip);
  playGameTone('bet');
  addTx('bet', chip, `DT: ${type}`);
}

function renderBets() {
  document.getElementById('betDragon').textContent = dtGame.bets.dragon || 0;
  document.getElementById('betTiger').textContent = dtGame.bets.tiger || 0;
  document.getElementById('betTie').textContent = dtGame.bets.tie || 0;
  const chipTypes = ['dragon','tie','tiger','dragonBig','dragonSmall','tigerBig','tigerSmall','suitedTie'];
  chipTypes.forEach(type => {
    const id = 'chips' + type[0].toUpperCase() + type.slice(1);
    const node = document.getElementById(id);
    if (!node) return;
    const amount = dtGame.bets[type] || 0;
    node.innerHTML = amount > 0 ? `<span class="dt-chip-coin" title="Bet ${amount}">${formatChipAmount(amount)}</span>` : '';
  });
}

function formatChipAmount(amount) {
  if (amount >= 1000) return (amount / 1000).toFixed(amount % 1000 ? 1 : 0) + 'K';
  return String(amount);
}

function showPlacedChip(type, amount) {
  const node = document.getElementById('chips' + type[0].toUpperCase() + type.slice(1));
  if (!node) return;
  const coin = document.createElement('span');
  coin.className = 'dt-chip-fly';
  coin.textContent = formatChipAmount(amount);
  node.appendChild(coin);
  setTimeout(() => coin.classList.add('landed'), 20);
  setTimeout(() => { if (coin.isConnected) coin.remove(); }, 900);
}

function showRoundPopup(message, duration = 1000) {
  const popup = document.getElementById('dtRoundPopup');
  if (!popup) return;
  popup.textContent = message;
  popup.classList.remove('hidden');
  popup.classList.remove('dt-popup-in');
  void popup.offsetWidth;
  popup.classList.add('dt-popup-in');
  clearTimeout(popup._hideTimer);
  popup._hideTimer = setTimeout(() => popup.classList.add('hidden'), duration);
}

function playGameTone(kind) {
  try {
    if (localStorage.getItem('soundEnabled') === 'false') return;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    if (!dtGame.audioContext) dtGame.audioContext = new AudioCtx();
    const ctx = dtGame.audioContext;
    if (ctx.state === 'suspended') ctx.resume();
    const now = ctx.currentTime;
    const notes = kind === 'lock' ? [740, 520, 370] : kind === 'start' ? [440, 587, 740] : kind === 'bet' ? [950, 1250] : kind === 'flip' ? [420, 650] : kind === 'deal' ? [330, 440, 660] : [740, 880, 1100];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = (kind === 'bet' || kind === 'flip') ? 'sine' : 'triangle';
      osc.frequency.setValueAtTime(freq, now + i * 0.09);
      gain.gain.setValueAtTime(0.0001, now + i * 0.09);
      gain.gain.exponentialRampToValueAtTime((kind === 'bet' || kind === 'flip') ? 0.04 : 0.07, now + i * 0.09 + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.09 + 0.12);
      osc.connect(gain); gain.connect(ctx.destination);
      osc.start(now + i * 0.09); osc.stop(now + i * 0.09 + 0.14);
    });
  } catch (e) { /* audio is optional on unsupported browsers */ }
}

function updateTotalBet() {
  const total = Object.values(dtGame.bets).reduce((a, b) => a + b, 0);
  document.getElementById('dtTotalBet').textContent = total;
}

function clearBets() {
  if (dtGame.state !== 'betting') return;
  const total = Object.values(dtGame.bets).reduce((a, b) => a + b, 0);
  if (total > 0) {
    dtGame.balance += total;
    updateAllBalances();
    showToast(`${total} coins returned`);
  }
  dtGame.bets = {};
  renderBets();
  updateTotalBet();
}

// ========================
// DEAL CARDS
// ========================
function dealCards() {
  dtGame.state = 'dealing';
  playGameTone('deal');
  updateStatus('Dealing...');

  const dragonVal = CARD_VALUES[Math.floor(Math.random() * 13)];
  const dragonSuit = CARD_SUITS[Math.floor(Math.random() * 4)];
  const tigerVal = CARD_VALUES[Math.floor(Math.random() * 13)];
  const tigerSuit = CARD_SUITS[Math.floor(Math.random() * 4)];

  animateCard('dragonCard', dragonVal, dragonSuit);
  setTimeout(() => playGameTone('flip'), 180);
  setTimeout(() => { animateCard('tigerCard', tigerVal, tigerSuit); playGameTone('flip'); }, 420);

  setTimeout(() => {
    showResult(dragonVal, dragonSuit, tigerVal, tigerSuit);
  }, 1200);
}

function animateCard(id, val, suit) {
  const el = document.getElementById(id);
  el.classList.remove('card-back');
  el.classList.add('flipping');
  setTimeout(() => {
    el.querySelector('.card-value').textContent = val;
    el.querySelector('.card-suit').textContent = suit;
    // FIX: Suit ke hisaab se color set
    el.querySelector('.card-value').style.color = SUIT_COLORS[suit];
    el.querySelector('.card-suit').style.color = SUIT_COLORS[suit];
    el.classList.remove('flipping');
  }, 300);
}

// ========================
// RESULT
// ========================
function showResult(dragonVal, dragonSuit, tigerVal, tigerSuit) {
  dtGame.state = 'result';
  playGameTone('result');
  const dRank = CARD_VALUES.indexOf(dragonVal);
  const tRank = CARD_VALUES.indexOf(tigerVal);

  let winner = 'tie';
  if (dRank > tRank) winner = 'dragon';
  else if (tRank > dRank) winner = 'tiger';

  const suitedTie = (dragonVal === tigerVal && dragonSuit === tigerSuit);

  if (winner === 'dragon') {
    document.getElementById('dragonWinTag').classList.remove('hidden');
    document.getElementById('dragonCard').classList.add('winner');
  } else if (winner === 'tiger') {
    document.getElementById('tigerWinTag').classList.remove('hidden');
    document.getElementById('tigerCard').classList.add('winner');
  } else {
    document.getElementById('dragonWinTag').classList.remove('hidden');
    document.getElementById('tigerWinTag').classList.remove('hidden');
    document.getElementById('dragonWinTag').textContent = 'TIE';
    document.getElementById('tigerWinTag').textContent = 'TIE';
    document.getElementById('dragonCard').classList.add('winner');
    document.getElementById('tigerCard').classList.add('winner');
  }

  let totalWin = 0;
  let details = [];

  Object.keys(dtGame.bets).forEach(type => {
    const amt = dtGame.bets[type];
    let won = false;
    let mult = 0;

    if (type === 'dragon' && winner === 'dragon') { won = true; mult = 2; }
    else if (type === 'tiger' && winner === 'tiger') { won = true; mult = 2; }
    else if (type === 'tie' && winner === 'tie') { won = true; mult = 12; }
    else if (type === 'suitedTie' && suitedTie) { won = true; mult = 51; }
    else if (type === 'dragonBig' && dRank >= 7 && winner === 'dragon') { won = true; mult = 2; }
    else if (type === 'dragonSmall' && dRank <= 5 && winner === 'dragon') { won = true; mult = 2; }
    else if (type === 'tigerBig' && tRank >= 7 && winner === 'tiger') { won = true; mult = 2; }
    else if (type === 'tigerSmall' && tRank <= 5 && winner === 'tiger') { won = true; mult = 2; }

    if (won) {
      const winAmt = Math.floor(amt * mult);
      totalWin += winAmt;
      details.push(`${type} +${winAmt}`);
      addTx('win', winAmt, `DT: ${type}`);
    }
  });

  if (winner === 'tie' && !suitedTie) {
    ['dragon', 'tiger'].forEach(type => {
      if (dtGame.bets[type]) {
        const half = Math.floor(dtGame.bets[type] / 2);
        totalWin += half;
      }
    });
  }

  if (totalWin > 0) {
    dtGame.balance += totalWin;
    updateAllBalances();
    updateStatus(`You won ${totalWin} coins! 🎉`);
    showToast(`+${totalWin} coins! ${details.join(', ')}`);
  } else {
    updateStatus(`${winner.toUpperCase()} wins! Better luck next time.`);
  }

  dtGame.history.unshift({
    dv: dragonVal, tv: tigerVal, winner, suitedTie,
    period: Date.now()
  });
  dtGame.history = dtGame.history.slice(0, 10);
  localStorage.setItem('dtHistory', JSON.stringify(dtGame.history));
  renderHistory();

  setTimeout(() => {
    document.getElementById('dragonWinTag').classList.add('hidden');
    document.getElementById('tigerWinTag').classList.add('hidden');
    document.getElementById('dragonWinTag').textContent = 'WINNER';
    document.getElementById('tigerWinTag').textContent = 'WINNER';
    startBettingRound();
  }, 3000);
}

function resetCards() {
  ['dragonCard', 'tigerCard'].forEach(id => {
    const el = document.getElementById(id);
    el.classList.remove('winner', 'flipping');
    el.classList.add('card-back');
    el.querySelector('.card-value').textContent = '?';
    el.querySelector('.card-suit').textContent = '?';
    // FIX: '?' ko black color diya (pehle white tha — card bg white hai isliye invisible tha)
    el.querySelector('.card-value').style.color = '#000';
    el.querySelector('.card-suit').style.color = '#000';
  });
  document.getElementById('dragonWinTag').classList.add('hidden');
  document.getElementById('tigerWinTag').classList.add('hidden');
}

// ========================
// HISTORY
// ========================
function renderHistory() {
  const list = document.getElementById('dtHistory');
  if (!list) return;
  if (dtGame.history.length === 0) {
    list.innerHTML = '<div style="color:#666;text-align:center;padding:1rem;">No results yet</div>';
    return;
  }
  list.innerHTML = dtGame.history.map(h => {
    const winClass = h.winner === 'dragon' ? 'green' : h.winner === 'tiger' ? 'red' : 'violet';
    const icon = h.winner === 'dragon' ? '🐉' : h.winner === 'tiger' ? '🐯' : '🤝';
    return `<div class="dt-history-item">
      <span class="dt-h-dragon">🐉 ${h.dv}</span>
      <span class="dt-h-result ${winClass}">${icon}</span>
      <span class="dt-h-tiger">${h.tv} 🐯</span>
    </div>`;
  }).join('');
}

// ========================
// WALLET
// ========================
function updateAllBalances() {
  const navBal = document.getElementById('navBalance');
  if (navBal) navBal.textContent = dtGame.balance;
  const walletBal = document.getElementById('walletBalance');
  if (walletBal) walletBal.textContent = dtGame.balance;
  localStorage.setItem('demoBalance', dtGame.balance);
}

function addTx(type, amount, note = '') {
  dtGame.transactions.unshift({ type, amount, note, time: new Date().toLocaleTimeString() });
  dtGame.transactions = dtGame.transactions.slice(0, 30);
  localStorage.setItem('demoTx', JSON.stringify(dtGame.transactions));
  renderTx();
}

function renderTx() {
  const box = document.getElementById('txHistory');
  if (!box) return;
  if (dtGame.transactions.length === 0) {
    box.innerHTML = '<div style="padding:0.5rem;color:#666;text-align:center;">No transactions yet</div>';
    return;
  }
  box.innerHTML = dtGame.transactions.map(tx => {
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
  if (dtGame.balance <= 0) { showToast('No coins to withdraw!'); return; }
  const amount = Math.min(dtGame.balance, 500);
  dtGame.balance -= amount;
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
