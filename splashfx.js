// Loading screen motion, candlestick themed (14 Oct 2026, user: "ออกแบบให้ดี ๆ มีอนิเมชั่นมากขึ้น … เกี่ยวกับกราฟแท่งเทียน").
// Keeps the original lightning-logo splash and adds:
//  1. a live candlestick chart streaming behind everything (decorative random walk — not market data)
//  2. a row of 16 candles under the % that form one by one as loading progresses (wick first, then body)
// Reads progress from #splashPct (written by auth.js) and stops when the splash is gone. Styles in splash.css.
(function () {
  const splash = document.getElementById('splash');
  if (!splash) return;
  const reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const gone = () => splash.classList.contains('gone');

  // ---------- 2. progress candles ----------
  const N = 16;
  const row = document.createElement('div');
  row.className = 'sp-cbar';
  row.setAttribute('aria-hidden', 'true');
  // a rising path with pullbacks, like gold trending up
  // closes swing around a gently rising line, so bodies are big relative to the whole row and each reads as a candle
  let p = 50, lo = 1e9, hi = -1e9;
  const bars = Array.from({ length: N }, (_, i) => {
    const o = p;
    let c = 50 + i * 0.9 + (Math.random() * 2 - 1) * 7;
    if (Math.abs(c - o) < 3) c = o + (c >= o ? 3 : -3);
    const h = Math.max(o, c) + 0.5 + Math.random() * 3, l = Math.min(o, c) - 0.5 - Math.random() * 3;
    p = c; lo = Math.min(lo, l); hi = Math.max(hi, h);
    return { o, c, h, l };
  });
  const Y = (v) => ((hi - v) / (hi - lo)) * 100; // % from the top
  bars.forEach((b) => {
    const el = document.createElement('i');
    el.className = b.c >= b.o ? 'cu' : 'cd'; // own names: .up / .dn already exist site-wide
    el.style.setProperty('--wt', `${Y(b.h)}%`);
    el.style.setProperty('--wh', `${Y(b.l) - Y(b.h)}%`);
    el.style.setProperty('--bt', `${Y(Math.max(b.o, b.c))}%`);
    el.style.setProperty('--bh', `${Math.max(2, Y(Math.min(b.o, b.c)) - Y(Math.max(b.o, b.c)))}%`);
    el.innerHTML = '<b></b><s></s>'; // b = wick, s = body
    row.appendChild(el);
  });
  const chips = document.getElementById('splashChips');
  splash.insertBefore(row, chips || null);
  const kids = [...row.children];
  let lastLit = -1;
  function progress() {
    if (gone()) return;
    const pct = parseInt((document.getElementById('splashPct') || {}).textContent, 10) || 0;
    const lit = Math.min(N, Math.floor((pct / 100) * N + 0.0001));
    for (let i = lastLit + 1; i < lit; i++) kids[i].classList.add('on');
    if (lit - 1 > lastLit) lastLit = lit - 1;
    // the candle being formed right now flickers like a live candle
    kids.forEach((k, i) => k.classList.toggle('live', i === lit && lit < N));
    requestAnimationFrame(progress);
  }
  requestAnimationFrame(progress);

  // ---------- 1. streaming chart in the background ----------
  if (reduce) return;
  const cv = document.createElement('canvas');
  cv.className = 'sp-candles';
  cv.setAttribute('aria-hidden', 'true');
  splash.insertBefore(cv, splash.firstChild);
  const ctx = cv.getContext('2d');
  let W = 0, H = 0, list = [], cur, last = 0, price = 100;
  const STEP = () => (W < 600 ? 12 : 16);
  function size() {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    W = cv.clientWidth; H = cv.clientHeight;
    cv.width = W * dpr; cv.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  const fresh = () => ({ o: price, h: price, l: price, c: price, t: 0 });
  function tick() {
    price += (Math.random() - 0.44) * 1.3; // gentle upward drift
    cur.c = price; cur.h = Math.max(cur.h, price); cur.l = Math.min(cur.l, price); cur.t++;
  }
  size();
  addEventListener('resize', size);
  const count = () => Math.ceil(W / STEP()) + 2;
  while (list.length < count()) { cur = fresh(); for (let k = 0; k < 8; k++) tick(); list.push(cur); }
  cur = fresh();
  function draw(now) {
    if (gone()) return;
    requestAnimationFrame(draw);
    if (now - last < 40) return;
    last = now;
    tick();
    if (cur.t > 26) { list.push(cur); if (list.length > count()) list.shift(); cur = fresh(); }
    const all = list.concat([cur]);
    let a = Infinity, b = -Infinity;
    all.forEach((k) => { a = Math.min(a, k.l); b = Math.max(b, k.h); });
    const pad = (b - a) * 0.12 + 0.5, top = H * 0.48, bot = H * 0.97, st = STEP();
    const y = (v) => bot - ((v - a + pad) / (b - a + 2 * pad)) * (bot - top);
    ctx.clearRect(0, 0, W, H);
    // closing-price line with a soft gold glow under the candles
    ctx.beginPath();
    all.forEach((k, i) => { const x = W - (all.length - i) * st + st / 2; i ? ctx.lineTo(x, y(k.c)) : ctx.moveTo(x, y(k.c)); });
    ctx.strokeStyle = 'rgba(240, 185, 11, .35)'; ctx.lineWidth = 1.5; ctx.shadowColor = 'rgba(240, 185, 11, .6)'; ctx.shadowBlur = 8; ctx.stroke(); ctx.shadowBlur = 0;
    all.forEach((k, i) => {
      const x = W - (all.length - i) * st + st / 2, up = k.c >= k.o, live = k === cur;
      const col = up ? (live ? 'rgba(14, 203, 129, .95)' : 'rgba(14, 203, 129, .45)') : (live ? 'rgba(246, 70, 93, .95)' : 'rgba(246, 70, 93, .45)');
      ctx.strokeStyle = ctx.fillStyle = col;
      if (live) { ctx.shadowColor = col; ctx.shadowBlur = 14; }
      ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x, y(k.h)); ctx.lineTo(x, y(k.l)); ctx.stroke();
      const t = y(Math.max(k.o, k.c)), h = Math.max(1.5, Math.abs(y(k.o) - y(k.c)));
      ctx.fillRect(x - st * 0.3, t, st * 0.6, h);
      ctx.shadowBlur = 0;
    });
    // dashed last-price line + tag, like a trading app
    const ly = y(cur.c);
    ctx.setLineDash([5, 5]); ctx.strokeStyle = 'rgba(240, 185, 11, .55)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, ly); ctx.lineTo(W, ly); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(240, 185, 11, .9)'; ctx.fillRect(W - 46, ly - 8, 46, 16);
    ctx.fillStyle = '#0b0e11'; ctx.font = '700 10px "JetBrains Mono", monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('LIVE', W - 23, ly + 0.5);
  }
  requestAnimationFrame(draw);
})();
