// Records every real entry of the chart-tab systems (chartsys.js) on all seven timeframes in chart-signals.json,
// so the website can compare live results with the backtest. Runs in every 5-minute check (check-loop.sh).
// Candles: investing.com 15m/30m/1h/5h from data.json where present; 5m, 4h, 1d, 1w (and anything missing)
// from Binance PAXG shifted onto the investing.com price — the same mix the chart tab uses.
// LINE: new entries and exits for the timeframes in CHART_NOTIFY (default 1h,5h,1d — 16 Oct 2026). 1h = the site's main
// system since 9 Oct 2026 — the old 30-minute system (intraday-run.js) was merged into it, so LINE, the signals tab and
// the stats show one record.
// Usage: node scripts/chart-run.js data.json      Env: RECORD, SEND / OUTBOX (notify.js), CHART_NOTIFY, SITE_URL
const fs = require('fs');
const path = require('path');
const SIG = require('../signals.js');
const INTRA = require('../intraday.js');
const CS = require('../chartsys.js');
const { send, quotaShare } = require('./notify.js');
const { signed } = require('./trade-events.js');
// One set of test numbers everywhere (monthly study → test-stats.json)
try { CS.applyStats(JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'test-stats.json'), 'utf8'))); } catch (e) { /* keep chartsys.js numbers */ }

const ROOT = path.join(__dirname, '..');
const FILE = process.env.CHART_FILE || path.join(ROOT, 'chart-signals.json'); // CHART_FILE / CHART_NOW: tests only
const SITE_URL = process.env.SITE_URL || 'https://gold-signal.gold-signal.workers.dev';
const NOTIFY = (process.env.CHART_NOTIFY || '5m,15m,30m,1h,5h,1d') /* + 5m, 30m since 19 Oct 2026 · + 15m (user: "15 นาทีส่งไลน์ด้วย") */.split(',').map((s) => s.trim()).filter(Boolean);
const TF_TH = { '5m': '5 นาที', '15m': '15 นาที', '30m': '30 นาที', '1h': '1 ชม.', '5h': '5 ชม.', '1d': '1 วัน', '1w': '1 สัปดาห์' };
const API = 'https://data-api.binance.vision/api/v3/klines?symbol=PAXGUSDT';
const H = 3600e3;

async function klines(interval, limit) {
  const r = await fetch(`${API}&interval=${interval}&limit=${limit}`);
  if (!r.ok) throw new Error(`binance ${interval} ${r.status}`);
  const now = +process.env.CHART_NOW || Date.now();
  return (await r.json()).map((k) => ({ time: k[0], open: +k[1], high: +k[2], low: +k[3], close: +k[4] })).filter((b) => b.time < now);
}
const bars = (rows) => (rows || []).map((b) => ({ time: b[0], open: b[1], high: b[2], low: b[3], close: b[4] }));
const shift = (rows, off) => rows.map((b) => ({ ...b, open: b.open + off, high: b.high + off, low: b.low + off, close: b.close + off }));
const when = (tf, ms) => new Date(ms).toLocaleString('th-TH', CS.SYS[tf].long
  ? { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Bangkok' }
  : { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Bangkok' });
const f2 = (v) => v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const keep = ({ why, stars, rule, market, ...t }) => t; // drop the long explanation fields
// several queued signals → one LINE text (≤ 4,700 characters; the link once at the end)
function pack(queue) {
  if (queue.length === 1) return queue[0].text;
  const strip = (x) => x.text.split('\n').filter((l) => l.trim() !== `${SITE_URL}/#chart`).join('\n');
  const head = `📬 แจ้งเตือน ${queue.length} รายการ (${when('1d', queue[0].at)} – ${when('1h', queue[queue.length - 1].at)} น.)`;
  let body = '', n = 0;
  for (const x of queue) { const part = `\n\n${strip(x)}`; if ((head + body + part).length > 4700) break; body += part; n++; }
  return `${head}${body}${n < queue.length ? `\n\n…และอีก ${queue.length - n} รายการ` : ''}\n\nดูทั้งหมด: ${SITE_URL}/#chart`;
}

(async function main() {
  const now = +process.env.CHART_NOW || Date.now();
  const data = JSON.parse(fs.readFileSync(path.resolve(process.argv[2] || 'data.json'), 'utf8'));
  const [m5, m15b, h1b, h4, d1, w1] = await Promise.all([klines('5m', 1000), klines('15m', 200), klines('1h', 1000), klines('4h', 200), klines('1d', 200), klines('1w', 200)]);
  // PAXG trades a few dollars off spot gold: line Binance up with the investing.com price the site shows
  // Measured on candles with the same time (median of the last 12 closed ones). Before 14 Oct 2026 it compared the
  // two latest candles, which aren't the same candle (investing.com's newest is 1–2 candles behind Binance's), so the
  // offset jumped ±$5–14 between runs and open trades hit SL / TP that real gold never reached.
  const inv = bars(data.m15);
  const bn = new Map(m15b.map((b) => [b.time, b.close]));
  const diffs = inv.slice(0, -1).filter((b) => bn.has(b.time)).slice(-12).map((b) => b.close - bn.get(b.time)).sort((a, b) => a - b);
  const off = diffs.length ? diffs[diffs.length >> 1] : inv.length ? inv[inv.length - 1].close - m15b[m15b.length - 1].close : 0;
  console.log(`PAXG → spot offset ${off.toFixed(2)} (${diffs.length} matched candles)`);
  const h5b = [];
  h1b.forEach((b) => { const t = Math.floor(b.time / (5 * H)) * 5 * H, l = h5b[h5b.length - 1];
    if (l && l.time === t) { l.high = Math.max(l.high, b.high); l.low = Math.min(l.low, b.low); l.close = b.close; } else h5b.push({ ...b, time: t }); });
  const pick = (key, backup) => (data[key] && data[key].length ? bars(data[key]) : shift(backup, off));
  const C = {
    m5: shift(m5, off), m15: pick('m15', m15b), m30: pick('m30', []), h1: pick('h1', h1b.slice(-200)), h4: shift(h4, off),
    h5: pick('h5', h5b.slice(-160)), d1: shift(d1, off), w1: shift(w1, off),
  };
  if (!C.m30.length) C.m30 = shift(await klines('30m', 200), off);
  // Candles that follow open trades: 5-minute for intraday, 1-hour for 5h/1d (held days to weeks), daily for 1w
  const follow = { '5h': shift(h1b, off), '1d': shift(h1b, off), '1w': C.d1 };

  const store = fs.existsSync(FILE) ? JSON.parse(fs.readFileSync(FILE, 'utf8')) : { startedAt: now, trades: [] };
  const before = JSON.stringify(store.trades);
  const texts = [];

  // 1) follow open trades
  store.trades = store.trades.map((t) => {
    if (SIG.isFinal(t)) return t;
    const r = keep(SIG.evaluate(t, (follow[t.tf] || C.m5).filter((b) => b.time >= t.createdAt), now));
    // Exits are recorded but not sent (user, 9 Oct 2026) — except two things members must act on (20 Oct 2026, user: "ทำมา"):
    // TP1 reached → move the stop to entry (the tested results assume it) · a limit that never filled → delete the order
    const tell = NOTIFY.includes(t.tf) && !t.paused, sd = t.side === 'SELL' ? '🔴 Sell' : '🟢 Buy';
    if (tell && (r.hit || 0) >= 1 && !(t.hit || 0) && !SIG.isFinal(r)) texts.push({ tf: t.tf, text: `✅ ${TF_TH[t.tf]} ${sd} (เข้า ${f2(r.entry)}) ถึง TP1 ${f2(r.tps[0])} แล้ว\n→ เลื่อน SL ไปที่ทุน ${f2(r.entry)} · ที่เหลือถือต่อไป TP2 ${f2(r.tps[1] || r.tps[0])}` });
    if (tell && t.status === 'pending' && r.status === 'expired') texts.push({ tf: t.tf, text: `❌ ยกเลิก ${TF_TH[t.tf]} ${sd} รอเข้าที่ ${f2(r.entry)} — ราคาไม่ถึงภายในเวลา\n→ ลบคำสั่ง Limit ที่ตั้งไว้ได้เลย` });
    if (t.status === 'pending' && r.status !== 'pending') console.log(`${r.tf}: limit ${r.side} ${f2(r.entry)} ${r.status === 'expired' ? 'never reached — cancelled' : 'filled'}`);
    if (SIG.isFinal(r) && r.status !== 'expired') console.log(`${r.tf}: closed ${r.side} ${f2(r.entry)} ${r.closedBy || ''} ${signed(r.pnl)}`);
    return r;
  });

  // 2) new entries: decided once per candle, at the open of the candle after the one that closed
  for (const [tf, sys] of Object.entries(CS.SYS)) {
    const [key, dur] = sys.frames[0];
    const fast = C[key].filter((b) => b.time + dur <= now);
    if (fast.length < 61) continue;
    const t = fast[fast.length - 1].time + dur;
    if (now - t > (sys.long ? 2 * H : Math.min(dur, 10 * 60e3))) continue; // missed this candle: never enter late
    const mine = store.trades.filter((x) => x.tf === tf);
    // One open trade per SIDE — Buy and Sell independent (20 Oct 2026). 19 Oct it was "every new signal" (first candle of a
    // signal only), but the live-like backtest (research/indicators/edgetest.js) showed those first-candle entries lose money;
    // a side takes the next entry once its trade closed (a limit that never filled holds the side until it expires).
    if (mine.some((x) => x.createdAt >= t)) continue; // this candle is done
    const data2 = Object.fromEntries(sys.frames.map(([k]) => [k, C[k]]));
    const dec = CS.decide(sys, data2, t, data.news || []);
    const dir = CS.dirOf(sys, dec);
    if (!dir) continue;
    const sd = dir > 0 ? 'BUY' : 'SELL';
    if (mine.some((x) => x.side === sd && (!SIG.isFinal(x) || (x.status === 'expired' ? x.fillBy : (x.exitAt || x.expiresAt)) + dur > t))) continue; // that side is busy
    // While the safety brake is on, keep recording (so it can lift by itself) but don't announce
    const paused = !!CS.brake(sys, mine, now);
    // risky sides (chartsys.js, 15 Oct 2026) are recorded too, flagged ⚠️ — since 19 Oct 2026 also in LINE (labelled) for
    // the CHART_NOTIFY timeframes (user: "อยากให้มีเข้าทุกทามเฟรมเลย 5 30 1 ชั่วโมง" → "ทำมาทั้งหมด")
    const risky = !!(dir > 0 ? sys.buy : sys.sell).risky;
    const tr = keep({ ...CS.trade(sys, dec, dir, fast[fast.length - 1].close, t), tf, id: `${tf}-${t}`, score: dec.score, ...(paused ? { paused } : {}), ...(risky ? { risky } : {}) });
    store.trades.push(tr);
    console.log(`${tf}: ${tr.side} ${tr.entry} SL ${tr.sl} TP ${tr.tps.join('/')} (score ${dec.score})${paused ? ' — paused, not announced' : ''}`);
    if (NOTIFY.includes(tf) && !paused) {
      const c = dir > 0 ? sys.buy : sys.sell;
      texts.push({ tf, text: `${tf === CS.MAIN_TF ? `⏱️ สัญญาณ ${TF_TH[tf]} (ระบบหลัก)` : `🎯 สัญญาณกราฟ ${TF_TH[tf]}`} · ${dir > 0 ? '🟢 ซื้อ (BUY)' : '🔴 ขาย (SELL)'}\n`
        // limit entry (19 Oct 2026): Buy waits for a dip, Sell for a bounce — the member sets a Buy / Sell Limit; never reached in time = cancelled
        + (tr.limit
          ? `📥 รอเข้าที่ ${f2(tr.entry)} (ราคาตอนนี้ ${f2(tr.priceAtSignal)} · ${dir > 0 ? 'รอย่อ' : 'รอเด้งขึ้น'} $${c.dip}) ภายใน ${c.dipH < 1 ? `${Math.round(c.dipH * 60)} นาที` : `${c.dipH} ชม.`} — ตั้ง ${dir > 0 ? 'Buy' : 'Sell'} Limit ที่ราคานี้ (อย่าเข้าทันที) · ราคาไม่ถึง = ยกเลิก\n`
          : `เข้า ~${f2(tr.entry)}\n`)
        + `SL ${f2(tr.sl)} · ${tr.tps.map((v, k) => `TP${k + 1} ${f2(v)}`).join(' · ')}\n`
        + `แท่ง ${when(tf, t - dur)} ปิดแล้ว · คะแนน ${dec.score > 0 ? '+' : ''}${dec.score} · ทดสอบชนะ ${c.win}% (ไม่รับประกัน)\n`
        + (risky ? `⚠️ สัญญาณเสี่ยง — ${c.risky} · ควรใช้ขนาดการซื้อขายเล็กกว่าปกติ\n` : '') + `${SITE_URL}/#chart` });
    }
  }

  // 3) safety brake on / off since the last run
  const brakes = {};
  for (const [tf, sys] of Object.entries(CS.SYS)) {
    const b = CS.brake(sys, store.trades.filter((x) => x.tf === tf), now);
    if (b) brakes[tf] = b;
    const was = (store.brakes || {})[tf];
    if (!NOTIFY.includes(tf) || !!was === !!b) continue;
    // recorded (the website shows ⛔) but not sent — LINE is entry signals and news warnings only
    console.log(b
      ? `⛔ พักสัญญาณกราฟ ${TF_TH[tf]}: ${b.why}
หยุดแจ้ง${b.until ? `ถึง ${when('1d', b.until)}` : 'จนกว่าผล 20 รายการล่าสุดจะกลับมาใกล้ผลทดสอบ'} · ระบบยังบันทึกต่อแบบไม่แจ้ง`
      : `✅ กลับมาแจ้งสัญญาณกราฟ ${TF_TH[tf]} แล้ว`);
  }
  const brakesChanged = JSON.stringify(brakes) !== JSON.stringify(store.brakes || {});
  store.brakes = brakes;

  // 📬 LINE at most once every 30 minutes (20 Oct 2026, user: "มีการแจ้งเตือนถี่เกินไป อยากให้ 30 นาทีแจ้งทีแต่ละสัญญาณ"): a signal
  // after a quiet half hour goes at once; later ones wait in store.lineQueue and go together in ONE message when 30 minutes passed
  const GAP = 30 * 60e3, beforeQ = JSON.stringify(store.lineQueue || []);
  const queue = [...(store.lineQueue || []), ...texts.map((x) => ({ at: now, tf: x.tf, text: x.text }))];
  let out = [];
  if (queue.length && now - (store.lineAt || 0) >= GAP) {
    // LINE quota guard (20 Oct 2026): past 80% of the month, only 1 ชม. and longer go out (the rest stay on the website)
    const share = process.env.SEND === 'true' ? await quotaShare() : null, LONG = ['1h', '5h', '1d', '1w'];
    let send1 = queue;
    if (share != null && share >= 0.8) { send1 = queue.filter((x) => !x.tf || LONG.includes(x.tf)); console.log(`LINE quota ${Math.round(share * 100)}% — sending ${send1.length}/${queue.length} (1h+ only)`); }
    out = send1.length ? [pack(send1) + (send1.length < queue.length ? `\n(โควตา LINE เดือนนี้ใกล้หมด — ส่งเฉพาะกรอบ 1 ชม. ขึ้นไป · กรอบอื่นดูบนเว็บ)` : '')] : [];
    store.lineAt = now; store.lineQueue = [];
  } else store.lineQueue = queue;
  if (queue.length && !out.length) console.log(`📬 ${queue.length} signal(s) waiting — LINE again at ${when('1d', (store.lineAt || 0) + GAP)}`);

  store.trades = store.trades.slice(-600);
  if (JSON.stringify(store.trades) === before && !brakesChanged && !out.length && JSON.stringify(store.lineQueue) === beforeQ) return console.log('chart signals: no change');
  store.updatedAt = now;
  if (process.env.RECORD === 'true') fs.writeFileSync(FILE, `${JSON.stringify(store, null, 1)}\n`);
  else console.log(`(not recorded) ${store.trades.length} trades`);
  await send(out);
})().catch((e) => { console.error(e); process.exit(1); });
