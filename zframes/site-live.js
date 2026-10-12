// Browser transport for the hosted member dashboard. Research JSON is a saved snapshot;
// prices come from the exchanges and are only labeled live while fresh.
const candleSpan = {'1m':3,'5m':10,'15m':30,'1h':320,'4h':1280,'1d':7300};
const candleCache = new Map();
async function siteCandles(coin, interval) {
  if (!/^xyz:[A-Z0-9]+$/.test(coin) || !candleSpan[interval]) throw Error('Invalid candle request');
  const key = coin + ':' + interval, old = candleCache.get(key);
  if (old && Date.now() - old.at < 8000) return old.rows;
  const now = Date.now();
  const r = await fetch('https://api.hyperliquid.xyz/info', {
    method:'POST', headers:{'content-type':'application/json'},
    body:JSON.stringify({type:'candleSnapshot',req:{coin,interval,startTime:now-candleSpan[interval]*3600000,endTime:now}}),
    signal:AbortSignal.timeout(8000)
  });
  if (!r.ok) throw Error('Hyperliquid ' + r.status);
  const rows = (await r.json()).map(x=>({t:x.t,o:+x.o,h:+x.h,l:+x.l,c:+x.c}));
  candleCache.set(key,{at:Date.now(),rows});
  return rows;
}

const yahooFields = {1:['id','s'],2:['price','f'],3:['time','z'],7:['marketHours','v'],8:['changePercent','f'],9:['dayVolume','z'],10:['dayHigh','f'],11:['dayLow','f'],12:['change','f']};
const yahooHours = {0:'pre',1:'open',2:'post',3:'overnight',4:'overnight'};
function decodeYahoo(b64) {
  const bin = atob(b64), b = Uint8Array.from(bin,c=>c.charCodeAt(0)), dv = new DataView(b.buffer), out = {};
  let i = 0;
  const varint = () => {let v=0n,s=0n,x; do {x=b[i++];v|=BigInt(x&127)<<s;s+=7n;} while(x&128);return v;};
  while (i < b.length) {
    const k=Number(varint()), f=k>>3, wt=k&7, d=yahooFields[f];
    if(wt===0){const v=varint();if(d)out[d[0]]=d[1]==='z'?Number((v>>1n)^-(v&1n)):Number(v);}
    else if(wt===5){if(d)out[d[0]]=dv.getFloat32(i,true);i+=4;}
    else if(wt===1)i+=8;
    else if(wt===2){const n=Number(varint());if(d)out[d[0]]=new TextDecoder().decode(b.subarray(i,i+n));i+=n;}
    else break;
  }
  return out;
}

let siteRun = 0, siteTimers = [], siteSockets = [];
function setSiteQuote(key, patch) {
  if(!Number.isFinite(patch.px) || patch.px<=0)return;
  const old=QS[key]||{}, q=QS[key]={...old,...patch};
  const changed = old.px !== q.px || old.t !== q.t;
  if(q.prev)q.ch=q.px/q.prev-1;
  const time=typeof q.t==='number'?q.t:Date.parse(q.t);
  if(Number.isFinite(time)&&time<=Date.now()+5000)LIVESTAT.last=Math.max(LIVESTAT.last,time<1e12?time*1000:time);
  if(changed)LIVESTAT.ticks++;
  if(key.startsWith('xyz:'))LIVE.push?.(key,q);
  if(!key.includes(':')&&window.dash?.stockMap?.[key])SQ[key]={...q,hl:QS['xyz:'+key]&&{px:QS['xyz:'+key].px,ch:QS['xyz:'+key].ch}};
  if(changed)dirty=true;
}
function sitePost(body) {
  return fetch('https://api.hyperliquid.xyz/info',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(8000)}).then(r=>{if(!r.ok)throw Error(r.status);return r.json();});
}
async function siteContext(run) {
  try {
    const [meta,ctx]=await sitePost({type:'metaAndAssetCtxs',dex:'xyz'});
    if(run!==siteRun)return;
    meta.universe.forEach((item,i)=>{
      const c=ctx[i], prev=Number(c.prevDayPx), old=QS[item.name];
      setSiteQuote(item.name,{px:old?.px||Number(c.markPx),prev,vol:Number(c.dayNtlVlm),oi:Number(c.openInterest)*Number(c.markPx),funding:Number(c.funding),t:old?.t||Date.now(),src:old?.src||'hl-poll',hours:'24/7'});
    });
  } catch {}
}
async function siteMids(run) {
  try {
    const mids=await sitePost({type:'allMids',dex:'xyz'});
    if(run!==siteRun)return;
    for(const [key,value] of Object.entries(mids)){
      const px=Number(value);if(px!==QS[key]?.px)setSiteQuote(key,{px,t:Date.now(),src:'hl-poll',hours:'24/7'});
    }
    LIVESTAT.ok=true;
  } catch {}
}
async function siteSpot(run) {
  try {const r=await fetch('https://api.gold-api.com/price/XAU',{signal:AbortSignal.timeout(6000)}),x=await r.json();if(run===siteRun)setSiteQuote('spot:XAU',{px:Number(x.price),t:Date.parse(x.updatedAt),src:'gold-api'});}catch{}
}
let siteSparkBusy = 0;
async function siteSpark(run, symbols) {
  if(!symbols.length)return;
  if(siteSparkBusy===run)return;
  siteSparkBusy=run;
  try {
    for(let i=0;i<symbols.length;i+=100){
      const r=await fetch('/api/zframes/quotes?symbols='+encodeURIComponent(symbols.slice(i,i+100).join(',')),{signal:AbortSignal.timeout(15000)});
      if(!r.ok)continue;
      const data=await r.json();if(run!==siteRun)return;
      for(const [key,q] of Object.entries(data.q||{})){
        if(QS[key]?.src==='stream'&&QS[key].t>q.t)continue;
        setSiteQuote(key,q);
      }
    }
  }catch{}finally{if(siteSparkBusy===run)siteSparkBusy=0;}
}
connectLive = function(id) {
  siteRun++;const run=siteRun;
  let hlLast=0;
  siteTimers.forEach(clearInterval);siteTimers=[];
  siteSockets.forEach(s=>{try{s.close()}catch{}});siteSockets=[];
  LIVESTAT.ticks=0;LIVESTAT.last=0;LIVESTAT.since=Date.now();LIVESTAT.ok=false;
  const keys=[...new Set(window.dash?.liveKeys||[])], stocks=keys.filter(k=>!k.includes(':')&&k!=='ea');
  const hl=new WebSocket('wss://api.hyperliquid.xyz/ws');siteSockets.push(hl);
  hl.onopen=()=>{if(run===siteRun){hl.send(JSON.stringify({method:'subscribe',subscription:{type:'allMids',dex:'xyz'}}));LIVESTAT.ok=true;badge();}};
  hl.onmessage=e=>{if(run!==siteRun)return;try{const msg=JSON.parse(e.data);if(msg.channel!=='allMids')return;hlLast=Date.now();for(const [key,value] of Object.entries(msg.data?.mids||{})){const px=Number(value);if(px!==QS[key]?.px)setSiteQuote(key,{px,t:Date.now(),src:'hl-ws',hours:'24/7'});}}catch{}};
  hl.onclose=()=>{if(run===siteRun)siteTimers.push(setTimeout(()=>connectLive(id),2000));};
  if(stocks.length){
    const ys=new WebSocket('wss://streamer.finance.yahoo.com/?version=2');siteSockets.push(ys);
    ys.onopen=()=>{if(run!==siteRun)return;const list=stocks.map(s=>s.replace('.', '-'));for(let i=0;i<list.length;i+=200)ys.send(JSON.stringify({subscribe:list.slice(i,i+200)}));};
    ys.onmessage=e=>{if(run!==siteRun)return;try{const j=JSON.parse(e.data);if(j.type!=='pricing')return;const x=decodeYahoo(j.message),key=x.id?.replace(/^([A-Z]+)-([A-Z])$/,'$1.$2');if(!key||!x.price)return;const prev=QS[key]?.prev??(x.change!=null?x.price-x.change:undefined);setSiteQuote(key,{px:x.price,prev,t:x.time||Date.now(),hours:yahooHours[x.marketHours],src:'stream',hi:x.dayHigh,lo:x.dayLow,vol:x.dayVolume});}catch{}};
    ys.onclose=()=>{if(run===siteRun)siteTimers.push(setTimeout(()=>connectLive(id),3000));};
    siteSpark(run,stocks);siteTimers.push(setInterval(()=>siteSpark(run,stocks),60000));
  }
  siteContext(run);siteMids(run);if(id==='gold')siteSpot(run);
  siteTimers.push(setInterval(()=>siteContext(run),5000));
  siteTimers.push(setInterval(()=>{if(hl.readyState!==WebSocket.OPEN||Date.now()-hlLast>10000)siteMids(run);},1000));
  if(id==='gold')siteTimers.push(setInterval(()=>siteSpot(run),15000));
};
