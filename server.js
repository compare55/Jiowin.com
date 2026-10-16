const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = __dirname;
const PORT = Number(process.env.PORT || 3000);
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const ADMIN_CHAT_ID = String(process.env.TELEGRAM_ADMIN_CHAT_ID || '');
const DATA_DIR = process.env.DATA_DIR || path.join(ROOT, 'data');
const DB_FILE = path.join(DATA_DIR, 'requests.json');
const LIVE_BETS_FILE = path.join(DATA_DIR, 'live-bets.json');
fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(DB_FILE)) fs.writeFileSync(DB_FILE, '[]');
if (!fs.existsSync(LIVE_BETS_FILE)) fs.writeFileSync(LIVE_BETS_FILE, '[]');
let requests = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
let liveBets = JSON.parse(fs.readFileSync(LIVE_BETS_FILE, 'utf8'));
function saveLiveBets(){ fs.writeFileSync(LIVE_BETS_FILE, JSON.stringify(liveBets.slice(0,500), null, 2)); }
let offset = 0;
const mime = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.mp3':'audio/mpeg','.txt':'text/plain; charset=utf-8'};
function save(){ fs.writeFileSync(DB_FILE, JSON.stringify(requests, null, 2)); }
function send(res, code, obj){ res.writeHead(code, {'Content-Type':'application/json; charset=utf-8','Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'Content-Type','Access-Control-Allow-Methods':'GET,POST,OPTIONS'}); res.end(JSON.stringify(obj)); }
function readBody(req){ return new Promise((resolve,reject)=>{let s=''; req.on('data',c=>{s+=c; if(s.length>20000){reject(new Error('Too large'));req.destroy();}});req.on('end',()=>{try{resolve(JSON.parse(s||'{}'))}catch(e){reject(e)}});});}
async function tg(method, body){
 if(!BOT_TOKEN) throw new Error('TELEGRAM_BOT_TOKEN is missing');
 const response=await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${method}`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(25000)});
 let data; try { data=await response.json(); } catch { throw new Error(`Telegram ${method} returned non-JSON (HTTP ${response.status})`); }
 if(!response.ok || !data.ok) throw new Error(`Telegram ${method} failed: ${data.description || response.statusText || response.status}`);
 return data;
}
function safe(s){ return String(s||'').replace(/[<>&]/g,' ').slice(0,300); }
async function notify(r){
 if(!BOT_TOKEN || !ADMIN_CHAT_ID) return;
 let msg = `🟡 JIOWIN ${r.type==='deposit'?'ADD MONEY':'WITHDRAWAL'} REQUEST\n\nRequest ID: ${r.id}\nCustomer ID: ${safe(r.customerId)}\nAmount: ₹${r.amount}\nStatus: PENDING`;
 if(r.type==='deposit') msg += `\nUTR: ${safe(r.utr)}`;
 else msg += `\nAccount holder: ${safe(r.holder)}\nBank: ${safe(r.bank)}\nAccount: ${safe(r.account)}\nIFSC: ${safe(r.ifsc)}`;
 const sent=await tg('sendMessage',{chat_id:ADMIN_CHAT_ID,text:msg,reply_markup:{inline_keyboard:[[{text:'✅ Approve',callback_data:`approve:${r.id}`},{text:'❌ Reject',callback_data:`reject:${r.id}`}]]}});
 if(!sent.result || !sent.result.message_id) throw new Error('Telegram did not confirm delivery to the admin chat');
}
async function handleUpdate(u){
 if(u.callback_query){
  const q=u.callback_query, data=String(q.data||'');
  if(String(q.from.id)!==ADMIN_CHAT_ID){ await tg('answerCallbackQuery',{callback_query_id:q.id,text:'Not authorized',show_alert:true}); return; }
  const [action,id]=data.split(':');
  if(!['approve','reject'].includes(action) || !id){ await tg('answerCallbackQuery',{callback_query_id:q.id,text:'Invalid action',show_alert:true}); return; }
  const r=requests.find(x=>x.id===id);
  if(!r){await tg('answerCallbackQuery',{callback_query_id:q.id,text:'Request not found'});return;}
  if(r.status!=='PENDING'){await tg('answerCallbackQuery',{callback_query_id:q.id,text:'Already processed'});return;}
  r.status=action==='approve'?'APPROVED':'REJECTED'; r.processedAt=new Date().toISOString(); r.processedBy=String(q.from.id); save();
  await tg('answerCallbackQuery',{callback_query_id:q.id,text:`Request ${r.status.toLowerCase()}`});
  try { await tg('editMessageReplyMarkup',{chat_id:q.message.chat.id,message_id:q.message.message_id,reply_markup:{inline_keyboard:[]}}); } catch(e) { console.error('Could not remove Telegram buttons:',e.message); }
  await tg('sendMessage',{chat_id:ADMIN_CHAT_ID,text:`✅ ${r.type==='deposit'?'ADD MONEY':'WITHDRAWAL'} ${r.id} marked ${r.status}.\nCustomer: ${safe(r.customerId)}\nAmount: ₹${r.amount}\n\nNote: this records approval only; it does not verify payment or transfer funds.`});
 }
}
let pollingStarted = false;
async function pollBot(){
 if(!BOT_TOKEN || !ADMIN_CHAT_ID || pollingStarted) return;
 pollingStarted = true;
 try {
  // getUpdates cannot run while a webhook is configured. Preserve queued updates.
  await tg('deleteWebhook',{drop_pending_updates:false});
  const me=await tg('getMe',{});
  console.log(`Telegram bot connected as @${me.result.username}`);
  while(true){
   try {
    const data=await tg('getUpdates',{offset,timeout:20,allowed_updates:['callback_query']});
    for(const u of data.result||[]){
     offset=u.update_id+1;
     try { await handleUpdate(u); } catch(e) { console.error('Telegram callback handling failed:',e.message); }
    }
   } catch(e) {
    console.error('Telegram polling error:',e.message);
    await new Promise(resolve=>setTimeout(resolve,3000));
   }
  }
 } catch(e) {
  console.error('Telegram bot startup failed:',e.message);
  pollingStarted=false;
  setTimeout(pollBot,5000);
 }
}
const server=http.createServer(async(req,res)=>{
 if(req.method==='OPTIONS'){res.writeHead(204,{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'Content-Type','Access-Control-Allow-Methods':'GET,POST,OPTIONS'});return res.end();}
 const url=new URL(req.url,'http://localhost');
 try{
  if(req.method==='GET' && url.pathname==='/api/health'){
   return send(res,200,{ok:true,telegramConfigured:Boolean(BOT_TOKEN&&ADMIN_CHAT_ID),storageWritable:fs.existsSync(DATA_DIR)});
  }
  if(req.method==='GET' && url.pathname==='/api/live-bets'){
   const game=String(url.searchParams.get('game')||'').slice(0,40);
   const rows=liveBets.filter(x=>!game||x.game===game).slice(0,50);
   const totals={}; for(const x of rows){const k=x.selection; totals[k]=(totals[k]||0)+x.amount;}
   return send(res,200,{bets:rows,totals,updatedAt:new Date().toISOString()});
  }
  if(req.method==='POST' && url.pathname==='/api/live-bets'){
   const b=await readBody(req);
   const allowedGames=['Slot','Aviator','Color','Dragon Tiger','7 Up Down','Pappu','E-Sabong'];
   const game=String(b.game||''); const selection=safe(b.selection).trim();
   const amount=Number(b.amount); const clientId=String(b.clientId||'');
   if(!allowedGames.includes(game)||!selection||!Number.isInteger(amount)||amount<1||amount>100000||!/^anon-[a-f0-9]{16,40}$/.test(clientId)) return send(res,400,{error:'Invalid bet activity'});
   const now=Date.now();
   // Basic duplicate/rate guard: max one event per client per game every 250ms.
   if(liveBets.some(x=>x.clientId===clientId&&x.game===game&&now-Date.parse(x.createdAt)<250)) return send(res,429,{error:'Please wait'});
   const r={id:crypto.randomBytes(8).toString('hex'),game,selection,amount,clientId,player:'Guest-'+clientId.slice(-4).toUpperCase(),createdAt:new Date(now).toISOString()};
   liveBets.unshift(r); liveBets=liveBets.slice(0,500); saveLiveBets();
   return send(res,201,{ok:true,id:r.id});
  }
  if(req.method==='POST' && url.pathname==='/api/requests'){
   if(!BOT_TOKEN || !ADMIN_CHAT_ID) return send(res,503,{error:'Telegram admin is not configured. Set TELEGRAM_BOT_TOKEN and TELEGRAM_ADMIN_CHAT_ID in Render Environment Variables.'});
   let b; try { b=await readBody(req); } catch(e) { return send(res,400,{error:'Invalid request data. Please reload and try again.'}); } const type=b.type;
   if(!['deposit','withdraw'].includes(type)) return send(res,400,{error:'Invalid request type'});
   const amount=Number(b.amount);
   if(!Number.isInteger(amount)||amount<1||amount>100000) return send(res,400,{error:'Amount must be a whole number between 1 and 100000'});
   if(!String(b.customerId||'').match(/^[A-Za-z0-9_-]{6,80}$/)) return send(res,400,{error:'Invalid customer ID'});
   if(type==='deposit' && !String(b.utr||'').trim()) return send(res,400,{error:'Transaction reference required'});
   if(type==='withdraw' && (!String(b.holder||'').trim()||!String(b.bank||'').trim()||!String(b.account||'').match(/^[0-9]{6,20}$/)||!String(b.ifsc||'').match(/^[A-Za-z]{4}0[A-Za-z0-9]{6}$/))) return send(res,400,{error:'Valid bank details required'});
   const r={id:(type==='deposit'?'DP':'WD')+'-'+Date.now().toString(36).toUpperCase()+'-'+crypto.randomBytes(3).toString('hex').toUpperCase(),type,amount,customerId:String(b.customerId),utr:type==='deposit'?String(b.utr).trim().slice(0,80):undefined,holder:type==='withdraw'?String(b.holder).trim().slice(0,80):undefined,bank:type==='withdraw'?String(b.bank).trim().slice(0,80):undefined,account:type==='withdraw'?String(b.account):undefined,ifsc:type==='withdraw'?String(b.ifsc).toUpperCase():undefined,status:'PENDING',createdAt:new Date().toISOString()};
   requests.unshift(r); save();
   try{await notify(r)}catch(e){console.error('Telegram notify failed:',e.message); return send(res,503,{error:'Request saved but Telegram notification failed: '+String(e.message||'unknown error').slice(0,180)+'. Check TELEGRAM_BOT_TOKEN and TELEGRAM_ADMIN_CHAT_ID, then retry only after confirming with admin.'});}
   return send(res,201,{id:r.id,status:r.status});
  }
  if(req.method==='GET' && url.pathname.startsWith('/api/requests/')){
   const id=decodeURIComponent(url.pathname.split('/').pop()); const r=requests.find(x=>x.id===id);
   if(!r)return send(res,404,{error:'Request not found'});
   return send(res,200,{id:r.id,type:r.type,status:r.status,amount:r.amount,customerId:r.customerId,processedAt:r.processedAt||null});
  }
  if(url.pathname.startsWith('/api/')) return send(res,404,{error:'Not found'});
  let p=decodeURIComponent(url.pathname); if(p==='/')p='/index.html';
  const full=path.resolve(ROOT,'.'+p); if(!full.startsWith(path.resolve(ROOT)+path.sep)) return send(res,403,{error:'Forbidden'});
  fs.readFile(full,(err,data)=>{if(err){res.writeHead(404);return res.end('Not found');}res.writeHead(200,{'Content-Type':mime[path.extname(full).toLowerCase()]||'application/octet-stream'});res.end(data);});
 }catch(e){send(res,400,{error:'Invalid request'});}
});
server.listen(PORT,()=>console.log(`Jiowin listening on ${PORT}`));
if(BOT_TOKEN && ADMIN_CHAT_ID){ console.log('Telegram admin approval configured; starting bot connection'); pollBot(); }
else console.warn('Telegram admin approval disabled: set TELEGRAM_BOT_TOKEN and TELEGRAM_ADMIN_CHAT_ID in Render Environment Variables.');
