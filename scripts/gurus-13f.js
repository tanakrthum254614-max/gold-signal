// 🧑‍💼 Guru portfolios from SEC 13F filings (user, 16 Oct 2026: "อยากให้ทำเหมือนแอป Dime … ที่มีผู้เชี่ยวชาญ", 20+ gurus).
// For every manager below: the two latest 13F-HR filings from SEC EDGAR (free; quarterly, filed up to 45 days after the
// quarter) → holdings by CUSIP, compared with the quarter before (new / added / reduced / sold out). CUSIP → ticker via
// OpenFIGI (free, no key: 25 requests a minute, 10 ids each), cached in gurus-cusip.json so later runs only map new ones.
// The site marks each holding to the live price (zframes), so portfolio values move in real time between filings.
// Usage: node scripts/gurus-13f.js <out.json> [cusipCache.json]
const fs = require('fs');

const UA = 'GoldSignal guru-portfolio research (contact: tanakrthum254614@gmail.com)'; // SEC asks for a contact in the User-Agent
// [cik, Thai name, English name, fund, style]
const GURUS = [
  [1067983, 'วอร์เรน บัฟเฟตต์', 'Warren Buffett', 'Berkshire Hathaway', 'หุ้นคุณค่า ถือยาว'],
  [1166559, 'บิล เกตส์', 'Bill Gates', 'Gates Foundation Trust', 'หุ้นพื้นฐานแข็ง ถือยาว'],
  [1088875, 'เบลลี่ กิฟฟอร์ด', 'Baillie Gifford', 'Baillie Gifford & Co', 'หุ้นเติบโต'],
  [1649339, 'ไมเคิล เบอร์รี่', 'Michael Burry', 'Scion Asset Management', 'สวนตลาด หาของถูก'],
  [1336528, 'บิล แอคแมน', 'Bill Ackman', 'Pershing Square', 'พอร์ตกระจุก นักลงทุนเชิงรุก'],
  [1350694, 'เรย์ ดาลิโอ', 'Ray Dalio', 'Bridgewater Associates', 'มหภาค กระจายความเสี่ยง'],
  [1536411, 'สแตนลีย์ ดรัคเคนมิลเลอร์', 'Stanley Druckenmiller', 'Duquesne Family Office', 'มหภาค ตามเทรนด์'],
  [1061768, 'เซธ คลาร์แมน', 'Seth Klarman', 'Baupost Group', 'หุ้นคุณค่า มีส่วนเผื่อปลอดภัย'],
  [1709323, 'หลี่ ลู่', 'Li Lu', 'Himalaya Capital', 'หุ้นคุณค่า (ศิษย์มังเกอร์)'],
  [1569205, 'เทอร์รี่ สมิธ', 'Terry Smith', 'Fundsmith', 'หุ้นคุณภาพ ซื้อแล้วไม่ทำอะไร'],
  [1656456, 'เดวิด เทปเปอร์', 'David Tepper', 'Appaloosa Management', 'หุ้นถูกช่วงวิกฤต'],
  [1040273, 'แดน โลบ', 'Dan Loeb', 'Third Point', 'นักลงทุนเชิงรุก'],
  [1489933, 'เดวิด ไอน์ฮอร์น', 'David Einhorn', 'Greenlight (DME Capital)', 'หุ้นคุณค่า + ชอร์ต'], // files as DME Capital Management since 2024
  [921669, 'คาร์ล ไอคาห์น', 'Carl Icahn', 'Icahn Capital', 'นักลงทุนเชิงรุก'],
  [1549575, 'โมห์นิช ปาบราย', 'Mohnish Pabrai', 'Dalal Street', 'หุ้นคุณค่า เดิมพันน้อยตัว'],
  [1112520, 'ชัค เอเคอร์', 'Chuck Akre', 'Akre Capital Management', 'หุ้นคุณภาพ ทบต้น'],
  [1167483, 'เชส โคลแมน', 'Chase Coleman', 'Tiger Global', 'หุ้นเทคเติบโต'],
  [1061165, 'สตีเฟน แมนเดล', 'Stephen Mandel', 'Lone Pine Capital', 'หุ้นเติบโต'],
  [1135730, 'ฟิลิปป์ ลัฟฟอนต์', 'Philippe Laffont', 'Coatue Management', 'หุ้นเทค'],
  [1697748, 'แคธี่ วูด', 'Cathie Wood', 'ARK Investment', 'นวัตกรรม เทคโนโลยีใหม่'],
  [949509, 'ฮาวเวิร์ด มาร์คส์', 'Howard Marks', 'Oaktree Capital', 'หุ้นคุณค่า ตราสารหนี้'],
  [1029160, 'จอร์จ โซรอส', 'George Soros', 'Soros Fund Management', 'มหภาค'],
  [1510387, 'โจเอล กรีนแบลตต์', 'Joel Greenblatt', 'Gotham Asset Management', 'สูตรวิเศษ (หุ้นดีราคาถูก)'],
  [1096343, 'ทอม เกย์เนอร์', 'Tom Gayner', 'Markel Group', 'หุ้นคุณภาพ ถือยาว'],
  [783412, 'ชาร์ลี มังเกอร์ (Daily Journal)', 'Daily Journal (Munger)', 'Daily Journal Corp', 'พอร์ตสไตล์มังเกอร์'],
  [1418814, 'เจฟฟ์ อูเบน', 'Jeffrey Ubben', 'ValueAct Capital', 'นักลงทุนเชิงรุก'],
  [1103804, 'แอนเดรียส ฮัลวอร์เซน', 'Andreas Halvorsen', 'Viking Global', 'หุ้นเติบโต'],
  [1034524, 'โพเลน แคปปิตอล', 'Polen Capital', 'Polen Capital Management', 'หุ้นเติบโตคุณภาพ'],
];
const TOP = 40; // holdings kept per guru (by value)

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let lastSec = 0;
async function sec(url, as = 'json') { // ≤ 8 requests a second (SEC allows 10)
  const wait = lastSec + 130 - Date.now(); if (wait > 0) await sleep(wait); lastSec = Date.now();
  for (let i = 0; i < 3; i++) {
    const r = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Encoding': 'gzip, deflate' } });
    if (r.ok) return as === 'json' ? r.json() : r.text();
    if (r.status === 404) throw new Error(`404 ${url}`);
    await sleep(1500 * (i + 1));
  }
  throw new Error(`SEC failed ${url}`);
}

// 13F information table XML → rows (namespaces vary: <ns1:infoTable> or <infoTable>)
function parseTable(xml) {
  const rows = [], tag = (s, n) => { const m = s.match(new RegExp(`<(?:\\w+:)?${n}>([^<]*)</(?:\\w+:)?${n}>`, 'i')); return m ? m[1].trim() : ''; };
  for (const m of xml.matchAll(/<(?:\w+:)?infoTable>([\s\S]*?)<\/(?:\w+:)?infoTable>/gi)) {
    const s = m[1];
    // names keep XML entities (S&amp;P) — decoded so the page shows S&P
    const unent = (t) => t.replace(/&amp;/g, '&').replace(/&apos;|&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
    rows.push({ name: unent(tag(s, 'nameOfIssuer')), cls: unent(tag(s, 'titleOfClass')), cusip: tag(s, 'cusip').toUpperCase(), value: +tag(s, 'value') || 0,
      shares: +tag(s, 'sshPrnamt') || 0, type: tag(s, 'sshPrnamtType'), put: tag(s, 'putCall') });
  }
  return rows;
}

async function filings(cik) {
  const j = await sec(`https://data.sec.gov/submissions/CIK${String(cik).padStart(10, '0')}.json`);
  const f = j.filings.recent, out = [];
  for (let i = 0; i < f.form.length; i++) if (f.form[i] === '13F-HR') out.push({ acc: f.accessionNumber[i], date: f.filingDate[i], period: f.reportDate[i] });
  return { name: j.name, list: out };
}
async function holdings(cik, acc) {
  const dir = `https://www.sec.gov/Archives/edgar/data/${cik}/${acc.replace(/-/g, '')}`;
  const idx = await sec(`${dir}/index.json`);
  const xmls = idx.directory.item.map((x) => x.name).filter((n) => /\.xml$/i.test(n) && !/primary_doc/i.test(n));
  for (const n of xmls) {
    const rows = parseTable(await sec(`${dir}/${n}`, 'text'));
    if (rows.length) return rows;
  }
  return [];
}
// sum by CUSIP (a manager reports one row per sub-account); options (put/call) kept apart
function byCusip(rows) {
  // value is in dollars since 2023, but some filers still report thousands: a median price per share under $3 means thousands
  const px = rows.filter((r) => r.shares > 0 && r.value > 0 && !r.put).map((r) => r.value / r.shares).sort((a, b) => a - b);
  const k = px.length && px[Math.floor(px.length / 2)] < 3 ? 1000 : 1;
  const m = new Map();
  for (const r of rows) {
    if (r.type && r.type !== 'SH') continue; // bonds (PRN) left out
    const key = r.put ? `${r.cusip}:${r.put.toUpperCase()}` : r.cusip;
    const x = m.get(key) || { cusip: r.cusip, name: r.name, cls: r.cls, put: r.put ? r.put.toUpperCase() : null, value: 0, shares: 0 };
    x.value += r.value * k; x.shares += r.shares; m.set(key, x);
  }
  return m;
}

// CUSIP → ticker (OpenFIGI). cache: { cusip: ticker | null }. Pass 1: ID_CUSIP on the US listing. Non-US companies have a
// CINS code (starts with a letter, e.g. Chubb H1467J104) that OpenFIGI only knows as ID_CINS → pass 2: ID_CINS on the US listing.
async function figi(part, us, type = 'ID_CUSIP') {
  for (let t = 0; t < 4; t++) {
    const r = await fetch('https://api.openfigi.com/v3/mapping', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(part.map((c) => ({ idType: type, idValue: c, ...(us ? { exchCode: 'US' } : {}) }))) });
    if (r.status === 429) { await sleep(20000); continue; }
    if (!r.ok) { await sleep(3000); continue; }
    await sleep(2500); // 25 requests a minute without a key
    return r.json();
  }
  return null;
}
const pick = (data, us) => { const eq = (data || []).filter((y) => y.marketSector === 'Equity'); return (us ? eq[0] : eq.find((y) => ['US', 'UN', 'UW', 'UQ', 'UA', 'UR'].includes(y.exchCode)) || eq[0]) || null; };
async function mapCusips(cusips, cache) {
  const all = [...new Set(cusips)];
  const todo = all.filter((c) => !(c in cache)), retry = all.filter((c) => cache[c] === null && !(cache._tried2 || []).includes(c));
  console.log(`OpenFIGI: ${todo.length} new CUSIPs (cached ${Object.keys(cache).length - 1})`);
  for (let i = 0; i < todo.length; i += 10) {
    const part = todo.slice(i, i + 10), j = await figi(part, true);
    if (j) j.forEach((x, k) => { const d = pick(x.data, true); cache[part[k]] = d ? d.ticker.replace('/', '.') : null; });
  }
  const second = [...new Set([...retry, ...todo.filter((c) => cache[c] === null)])];
  console.log(`OpenFIGI pass 2 (CINS, US listing): ${second.length}`);
  for (let i = 0; i < second.length; i += 10) {
    const part = second.slice(i, i + 10), j = await figi(part, true, 'ID_CINS');
    if (j) j.forEach((x, k) => { const d = pick(x.data, true); if (d) cache[part[k]] = d.ticker.replace('/', '.'); });
  }
  cache._tried2 = [...new Set([...(cache._tried2 || []), ...second])];
}

(async () => {
  const [out, cacheFile = 'gurus-cusip.json'] = process.argv.slice(2);
  if (!out) throw new Error('usage: node scripts/gurus-13f.js <out.json> [cusipCache.json]');
  const cache = fs.existsSync(cacheFile) ? JSON.parse(fs.readFileSync(cacheFile, 'utf8')) : {};
  const gurus = [];
  for (const [cik, th, en, fund, style] of GURUS) {
    try {
      const { name, list } = await filings(cik);
      if (!list.length) { console.log(`⚠️ ${en}: no 13F-HR`); continue; }
      const [cur, prev] = list;
      const now = byCusip(await holdings(cik, cur.acc));
      const before = prev ? byCusip(await holdings(cik, prev.acc)) : new Map();
      const total = [...now.values()].filter((x) => !x.put).reduce((a, x) => a + x.value, 0);
      const longs = [...now.values()].filter((x) => !x.put).sort((a, b) => b.value - a.value);
      const moves = [];
      for (const [key, x] of now) {
        if (x.put) continue;
        const p = before.get(key);
        if (!p) moves.push({ cusip: x.cusip, name: x.name, act: 'new', value: x.value, pct: null });
        else if (p.shares && Math.abs(x.shares / p.shares - 1) >= 0.05) moves.push({ cusip: x.cusip, name: x.name, act: x.shares > p.shares ? 'add' : 'cut', value: x.value, pct: +((x.shares / p.shares - 1) * 100).toFixed(1) });
      }
      for (const [key, p] of before) if (!p.put && !now.has(key)) moves.push({ cusip: p.cusip, name: p.name, act: 'exit', value: p.value, pct: -100 });
      moves.sort((a, b) => b.value - a.value);
      gurus.push({ cik, th, en, fund, style, filer: name, period: cur.period, filed: cur.date, prevPeriod: prev ? prev.period : null,
        total, count: longs.length, top: longs.slice(0, TOP).map((x) => ({ cusip: x.cusip, name: x.name, cls: x.cls, value: x.value, shares: x.shares, w: +(x.value / total * 100).toFixed(2),
          chg: before.get(x.cusip) && before.get(x.cusip).shares ? +((x.shares / before.get(x.cusip).shares - 1) * 100).toFixed(1) : null })),
        moves: moves.slice(0, 25) });
      console.log(`✓ ${en} (${name}) ${cur.period} · ${longs.length} holdings · $${(total / 1e9).toFixed(2)}B · ${moves.length} moves`);
    } catch (e) { console.log(`⚠️ ${en}: ${e.message}`); }
  }
  await mapCusips(gurus.flatMap((g) => [...g.top, ...g.moves].map((x) => x.cusip)), cache);
  for (const g of gurus) for (const x of [...g.top, ...g.moves]) x.s = cache[x.cusip] || null;
  fs.writeFileSync(cacheFile, JSON.stringify(cache));
  const body = { asOf: new Date().toISOString(), source: 'SEC EDGAR 13F-HR · OpenFIGI', gurus };
  fs.writeFileSync(out, JSON.stringify(body));
  console.log(`wrote ${out}: ${gurus.length} gurus · mapped ${Object.values(cache).filter(Boolean).length}/${Object.keys(cache).length} CUSIPs`);
})().catch((e) => { console.error(e); process.exit(1); });
