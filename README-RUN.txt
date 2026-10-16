JIOWIN WEBSITE + TELEGRAM ADMIN APPROVAL STARTER

IMPORTANT
- Existing game HTML/CSS/JS files are retained; game mechanics were not intentionally edited.
- This adds an Express-free Node.js server and Telegram approve/reject buttons for add-money and withdrawal requests.
- This is an approval workflow starter, not a production real-money wallet. Admin approval does NOT prove bank settlement, transfer funds, or securely update balances across devices.
- Before real use, implement authenticated customer accounts, server-side wallet ledger, persistent database, HTTPS, rate limiting, and compliant payment/payout provider. Bank details are sensitive; restrict access to the Telegram admin chat and protect server storage.
- The included QR path must exist: phonepe-payment-qr.jpeg. Add your actual QR image if needed.

RENDER SETUP
1. Create a Render Web Service (not Static Site) and connect the repository containing the CONTENTS of Jiowin-main (server.js and package.json at repository root).
2. Runtime: Node.
3. Build command: npm install
4. Start command: npm start
5. Add these Environment Variables exactly (names are case-sensitive):
   TELEGRAM_BOT_TOKEN = token from @BotFather (keep secret; no quotes or spaces)
   TELEGRAM_ADMIN_CHAT_ID = your private numeric Telegram user ID (not @username)
   DATA_DIR = /var/data (recommended with a Render persistent disk mounted at /var/data)
6. For persistence, attach a Render persistent disk mounted at /var/data. Without it, request records can be lost on redeploy/restart.
7. Set the bot token only in Render environment variables, never in website files or ZIP.
8. Deploy and check https://YOUR-SERVICE.onrender.com/api/health. It should return `ok:true` and `telegramConfigured:true`. If `telegramConfigured:false`, one or both environment variables are missing.
9. In Telegram, open your bot in a private chat and press Start. Keep only one running Render instance using this token; Telegram polling cannot be shared by multiple services/processes.

TELEGRAM BOT
- Create a bot with @BotFather and copy its token to TELEGRAM_BOT_TOKEN.
- Find your numeric Telegram user ID using a trusted ID lookup tool, then set TELEGRAM_ADMIN_CHAT_ID. Do not use your @username. The bot sends the request into that same private chat.
- Start a private chat with your bot and press Start.
- Only the configured numeric admin user ID can approve/reject requests. The server verifies Telegram API errors, reports startup/connection failures in Render logs, and uses long polling to avoid overlapping getUpdates calls.

REQUEST FLOW
- Deposit form sends amount, customer ID and UTR to the server; bot sends Approve/Reject.
- Withdrawal form sends amount and bank holder/bank/account/IFSC; bot sends Approve/Reject.
- Request status is stored in requests.json.
- Approve/reject only records the admin decision. It does not initiate bank transfers or credit a securely shared wallet. The website balance is still browser-demo/localStorage based, not a real shared wallet.

LOCAL TEST
- Requires Node.js 18+.
- Run `npm start` inside Jiowin-main and open http://localhost:3000.


REAL BET ACTIVITY FEED
The game pages now report successful bet-button actions to /api/live-bets and poll the shared server feed every 3 seconds. Each browser gets an anonymous visitor ID; no login page is required. This displays real submitted client activity, not verified cash wagers. Since the existing games still keep balances/results in browser localStorage, this activity feed is not a secure financial ledger and should not be presented as proof of paid/settled bets. Render persistent disk DATA_DIR is recommended so feed history survives restarts.
