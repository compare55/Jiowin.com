/* One-time cleanup of legacy demo credits that were added by old wallet buttons. */
(function () {
  const flag = 'jiowin_wallet_auto_credit_cleanup_v1';
  if (localStorage.getItem(flag)) return;
  let tx = [];
  try { tx = JSON.parse(localStorage.getItem('demoTx') || '[]'); if (!Array.isArray(tx)) tx = []; } catch (_) { tx = []; }
  const fakeNotes = new Set(['Coins Added', 'Daily Bonus']);
  const fakeCredits = tx.filter(item => item && fakeNotes.has(item.note))
    .reduce((sum, item) => sum + Math.max(0, Number(item.amount) || 0), 0);
  let balance = Number(localStorage.getItem('demoBalance'));
  if (!Number.isFinite(balance) || balance < 0) balance = 0;
  if (fakeCredits > 0) {
    balance = Math.max(0, balance - fakeCredits);
    tx = tx.filter(item => !item || !fakeNotes.has(item.note));
    localStorage.setItem('demoTx', JSON.stringify(tx));
  } else if (balance === 1000 && !tx.some(item => item && ['add', 'win'].includes(item.type))) {
    // Remove the old default starting balance when it has no recorded earned/deposited funds.
    balance = 0;
  }
  localStorage.setItem('demoBalance', String(balance));
  localStorage.setItem(flag, '1');
})();
