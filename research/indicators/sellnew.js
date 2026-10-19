// New SELL entries (19 Oct 2026 — user: "มีฝั่ง Sell บ้างไหม" → "ทำมาเลย": (1) new Sell rules for 15m / 30m, (2) "wait for a
// bounce, then sell" on 1h Sell). Replays the site's own score (CS.decide) on every closed candle of 2 years (cached in
// score-<tf>.json), then tries Sell settings: threshold, confirmation indicator, entry (now / limit $d above within W, filled
// only when the price trades $0.3 through), SL $15×mult and the targets. One trade at a time, the site's evaluator, $0.4
// spread, 4 equal periods old → new. A setting is picked on periods 1–3 only (profit in each, ≥ 30 trades, win ≥ 60%);
// period 4 (never used to pick) is the check. node sellnew.js <projectDir>   (DATA_DIR = bars2y.json, news-hist.json)
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(process.argv[2] || path.join(__dirname, '..', '..'));
const SIG = require(path.join(ROOT, 'signals.js')); global.TA = require(path.join(ROOT, 'indicators.js'));
const INTRA = require(path.join(ROOT, 'intraday.js')); global.INTRA = INTRA; const CS = require(path.join(ROOT, 'chartsys.js'));
const DIR = process.env.DATA_DIR || __dirname;
function group(bars, ms) { const out = []; for (const b of bars) { const t = Math.floor(b.time / ms) * ms, l = out[out.length - 1];
  if (l && l.time === t) { l.high = Math.max(l.high, b.high); l.low = Math.min(l.low, b.low); l.close = b.close; } else out.push({ ...b, time: t }); } return out; }
function lb(b, t) { let lo = 0, hi = b.length; while (lo < hi) { const m = (lo + hi) >> 1; if (b[m].time < t) lo = m + 1; else hi = m; } return lo; }
const before = (b, t, n = 260) => { const i = lb(b, t); return b.slice(Math.max(0, i - n), i); };
const D = JSON.parse(fs.readFileSync(path.join(DIR, 'bars2y.json'), 'utf8'));
const NEWS = JSON.parse(fs.readFileSync(path.join(DIR, 'news-hist.json'), 'utf8')).map((n) => ({ time: n.t, title: n.name }));
const M = 60e3, H = 3600e3, DAY = 864e5, now = D.now, days = 730, start = now - days * DAY, SPREAD = 0.4;
const B = { m5: D['5m'], m15: D['15m'], m30: D['30m'], h1: D['1h'], h4: D['4h'], h5: group(D['1h'], 5 * H) };
const FB = D['5m'];
const period = (t) => Math.min(3, Math.floor(((t - start) / (days * DAY)) * 4));
const TFS = (process.env.TFS || '15m,30m,1h').split(',');
const out = []; const say = (s) => { console.log(s); out.push(s); };

// (1) the score on every closed candle (slow part, cached)
function scores(tf) {
  const f = path.join(DIR, `score-${tf}.json`); if (fs.existsSync(f)) return JSON.parse(fs.readFileSync(f, 'utf8'));
  const sys = CS.SYS[tf], dur = sys.frames[0][1], rows = [], t0 = Date.now();
  for (let t = Math.floor(start / dur) * dur + dur; t < now - dur; t += dur) {
    const wd = new Date(t).getUTCDay(); if (wd === 0 || wd === 6) continue;
    const data = Object.fromEntries(sys.frames.map(([k]) => [k, before(B[k], t)]));
    const ni = lb(NEWS, t - H), dec = CS.decide(sys, data, t, NEWS.slice(ni, ni + 6));
    if (!dec || dec.stale || dec.lastHour || (sys.news && dec.news)) continue;
    const p = before(FB, t, 1)[0]; if (!p) continue;
    if (dec.score > -2) continue; // only the bearish side matters here
    rows.push({ t, s: dec.score, bb: dec.bbPos, c: dec.conf || {}, price: p.close });
  }
  fs.writeFileSync(f, JSON.stringify(rows)); console.error(`${tf}: ${rows.length} bearish candles in ${Math.round((Date.now() - t0) / 1000)} s`);
  return rows;
}
function run(entries, holdMs) {
  let busy = 0; const trs = [];
  for (const e of entries) {
    if (e.t < busy || e.t < start) continue;
    Object.assign(INTRA.RULE, { slUsd: e.sl, tpUsd: e.tps });
    const t0 = INTRA.makeTrade({ dir: -1, score: 0, keys: {}, frames: [] }, e.price, e.t); if (holdMs) t0.expiresAt = e.t + holdMs;
    const i = lb(FB, e.t), j = lb(FB, t0.expiresAt + 1); const r = SIG.evaluate(t0, FB.slice(i, Math.min(j, i + 6000)), now);
    const s = SIG.summary([r], SPREAD); if (!s.traded) continue;
    trs.push({ p: period(e.t), pnl: s.pnl }); busy = (r.exitAt || t0.expiresAt) + 5 * M;
  }
  const per = [0, 1, 2, 3].map((k) => trs.filter((x) => x.p === k)), sum = (a) => a.reduce((s, x) => s + x.pnl, 0);
  const win = (a) => (a.length ? Math.round((100 * a.filter((x) => x.pnl > 0).length) / a.length) : 0);
  return { n: trs.length, win: win(trs), pnl: Math.round(sum(trs)), q: per.map((a) => Math.round(sum(a))), qw: per.map(win) };
}
const fmt = (r) => `${String(r.n).padStart(4)} ไม้  ชนะ ${String(r.win).padStart(3)}%  ${String(r.pnl).padStart(6)}$  [${r.q.join(' / ')}]  ชนะ [${r.qw.join(' / ')}]`;
const picked = (r) => r.n >= 30 && r.q.slice(0, 3).every((x) => x > 0) && r.qw.slice(0, 3).every((x) => x >= 60);

const W = { '15m': [H, 2 * H], '30m': [H, 3 * H], '1h': [2 * H, 6 * H] };
for (const tf of TFS) {
  const sys = CS.SYS[tf], rows = scores(tf);
  const mults = tf === '1h' ? [2] : [1, 1.5];
  const confs = [null, 'ema921', 'roc12', 'sma2050', 'bbrev'];
  say(`\n===== ${tf} SELL — คะแนนลบ ${rows.length} แท่ง · ตอนนี้: ${sys.sell ? `th ${sys.sell.th} ${sys.sell.confirm || ''} ชนะ ${sys.sell.win}%` : 'ไม่มี Sell'}`);
  const res = [];
  for (const th of [3, 4, 5, 6, 7]) for (const cf of confs) {
    const sig = rows.filter((r) => r.s <= -th && r.bb > 0 && (!cf || r.c[cf] === -1));
    if (sig.length < 30) continue;
    for (const mult of mults) {
      const sl = 15 * mult;
      for (const [tn, tps] of [['15/20/30', [15, 20, 30]], ['TP1 15', [15]], ['¼/1/2', [0.25, 1, 2]], ['½/1/2', [0.5, 1, 2]]]) {
        const T = tn.includes('/') && tps[0] < 1 ? tps.map((k) => +(sl * k).toFixed(2)) : tps.map((u) => u * mult);
        for (const d of [0, 2, 3, 5].map((x) => x * mult)) for (const w of d ? W[tf] : [0]) {
          const fills = [];
          for (const e of sig) {
            if (!d) { fills.push({ t: e.t, price: e.price, sl, tps: T }); continue; }
            const lim = e.price + d, i0 = lb(FB, e.t), i1 = lb(FB, e.t + w);
            for (let i = i0; i < i1 && i < FB.length; i++) if (FB[i].high >= lim + 0.3) { fills.push({ t: FB[i].time, price: lim, sl, tps: T }); break; }
          }
          const r = run(fills, sys.hold || 0);
          res.push({ name: `th −${th} ${cf || 'ไม่ยืนยัน'} · SL $${sl} · TP ${T.join('/')} · ${d ? `เด้ง $${d} ภายใน ${w / H} ชม.` : 'เข้าทันที'}`, ...r });
        }
      }
    }
  }
  const ok = res.filter(picked).sort((a, b) => b.q.slice(0, 3).reduce((x, y) => x + y, 0) - a.q.slice(0, 3).reduce((x, y) => x + y, 0));
  say(`ลองทั้งหมด ${res.length} แบบ · ผ่านช่วง 1–3 (กำไรทุกช่วง ชนะ ≥ 60% ≥ 30 ไม้) ${ok.length} แบบ · ช่วง 4 ก็กำไร ${ok.filter((r) => r.q[3] > 0).length} แบบ`);
  ok.slice(0, 15).forEach((r) => say(`  ${r.q[3] > 0 ? '✅' : '❌'} ${r.name.padEnd(62)} ${fmt(r)}`));
  if (tf === '1h' && sys.sell) {
    const now1 = res.filter((r) => r.name.startsWith(`th −${sys.sell.th} ${sys.sell.confirm} · SL $30 · TP 30/40/60`));
    say('  — 1h Sell ตอนนี้ (th −4 bbrev, TP 30/40/60) เข้าทันที vs รอเด้ง:'); now1.forEach((r) => say(`    ${r.name.padEnd(62)} ${fmt(r)}`));
  }
}
say('\n✅ = ผ่านช่วง 1–3 และช่วง 4 (ไม่ได้ใช้เลือก) ก็กำไร · ❌ = ผ่าน 1–3 แต่ช่วง 4 ขาดทุน · ลองหลายแบบ = มีโอกาสเจอแบบ "ฟลุก" → ใช้เฉพาะที่ ✅ และไม่ห่างจากแบบข้างเคียงมาก');
if (process.env.OUT) fs.writeFileSync(process.env.OUT, out.join('\n') + '\n');
