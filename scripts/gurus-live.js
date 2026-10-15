// ⚡ Live SEC filings of the 28 gurus (user, 16 Oct 2026: "ขอทุกอย่างแบบเรียลไทม์"). Runs every 10 minutes
// (.github/workflows/gurus-live.yml). 13F holdings come once a quarter, but these come within days of a trade:
//   Form 4        — a fund owning > 10% of a company reports each buy / sell within 2 business days (Berkshire's buys)
//   SCHEDULE 13D/G — crossing 5% of a company (13D = activist), within days
//   13F-HR        — the quarterly portfolio; a new one → the caller rebuilds gurus.json (prints NEW13F=<ciks>)
// Usage: node scripts/gurus-live.js <out.json> <gurus.json>
const fs = require('fs');
const { GURUS, UA } = require('./gurus-13f.js');

const DAYS = 45; // filings this recent
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let last = 0;
async function sec(url, as = 'json') { // ≤ 8 requests a second (SEC allows 10)
  const wait = last + 130 - Date.now(); if (wait > 0) await sleep(wait); last = Date.now();
  for (let i = 0; i < 3; i++) {
    const r = await fetch(url, { headers: { 'User-Agent': UA } });
    if (r.ok) return as === 'json' ? r.json() : r.text();
    if (r.status === 404) return null;
    await sleep(1200 * (i + 1));
  }
  return null;
}
const tag = (x, n) => { const m = x.match(new RegExp(`<(?:\\w+:)?${n}>\\s*(?:<value>)?([^<]*)`, 'i')); return m ? m[1].trim() : ''; };
const unent = (t) => t.replace(/&amp;/g, '&').replace(/&apos;|&#39;/g, "'").replace(/&quot;/g, '"');

// Form 4: every non-derivative trade the guru reported as the owner (an issuer's own insiders file too — skipped)
function form4(xml, cik) {
  const flat = xml.replace(/\s+/g, ' ');
  const owners = [...flat.matchAll(/<rptOwnerCik>\s*0*(\d+)\s*<\/rptOwnerCik>/g)].map((m) => +m[1]);
  if (!owners.includes(cik)) return null;
  const out = { symbol: tag(flat, 'issuerTradingSymbol').toUpperCase().split(/[ ,;]+/)[0], issuer: unent(tag(flat, 'issuerName')), buy: 0, sell: 0, buyUsd: 0, sellUsd: 0, after: null, date: null };
  for (const m of flat.matchAll(/<nonDerivativeTransaction>(.*?)<\/nonDerivativeTransaction>/g)) {
    const t = m[1], code = tag(t, 'transactionCode'), sh = +tag(t, 'transactionShares') || 0, px = +tag(t, 'transactionPricePerShare') || 0;
    const date = tag(t, 'transactionDate');
    if (date && (!out.date || date > out.date)) out.date = date;
    const after = +tag(t, 'sharesOwnedFollowingTransaction'); if (after > (out.after || 0)) out.after = after; // the main class (LEN A, not B)
    if (code === 'P') { out.buy += sh; out.buyUsd += sh * px; } else if (code === 'S') { out.sell += sh; out.sellUsd += sh * px; }
  }
  return out.buy || out.sell ? out : null;
}
// SCHEDULE 13D / 13G (XML since Dec 2024): the company and the stake
function sched13(xml) {
  const flat = xml.replace(/\s+/g, ' ');
  const pct = flat.match(/<(?:\w+:)?(?:percentOfClass|classPercent)>\s*([\d.]+)/i);
  const amt = flat.match(/<(?:\w+:)?(?:aggregateAmountOwned|reportingPersonBeneficiallyOwnedAggregateNumberOfShares)>\s*([\d.]+)/i);
  return { issuer: unent(tag(flat, 'issuerName')), cusip: tag(flat, 'issuerCusipNumber').toUpperCase(), pct: pct ? +pct[1] : null, shares: amt ? +amt[1] : null };
}

// ---- ARK daily holdings → trades. Snapshot per fund in gurus-ark.json { ARKK: { date, h: { TSLA: [shares, price] } } } ----
const ARK_CIK = 1697748;
const ARK = { ARKK: 'ARK_INNOVATION_ETF_ARKK_HOLDINGS', ARKW: 'ARK_NEXT_GENERATION_INTERNET_ETF_ARKW_HOLDINGS', ARKQ: 'ARK_AUTONOMOUS_TECH._%26_ROBOTICS_ETF_ARKQ_HOLDINGS',
  ARKG: 'ARK_GENOMIC_REVOLUTION_ETF_ARKG_HOLDINGS', ARKF: 'ARK_FINTECH_INNOVATION_ETF_ARKF_HOLDINGS', ARKX: 'ARK_SPACE_%26_DEFENSE_INNOVATION_ETF_ARKX_HOLDINGS' };
function csvRows(text) {
  const rows = [];
  for (const line of text.split(/\r?\n/).slice(1)) {
    const cells = [...line.matchAll(/("([^"]*)"|[^,]*)(,|$)/g)].map((m) => (m[2] ?? m[1]).trim()).slice(0, 8);
    if (cells.length < 7 || !cells[0] || !/\d/.test(cells[0])) continue;
    const [date, fund, company, ticker, cusip, shares, value] = cells;
    const sh = +shares.replace(/[,$]/g, ''), v = +value.replace(/[,$]/g, '');
    if (sh > 0) rows.push({ date, fund, company, ticker: (ticker || '').replace(/\s.*/, '').toUpperCase(), cusip, sh, px: v / sh });
  }
  return rows;
}
async function arkTrades(file, prevItems) {
  const snap = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {};
  const items = [...prevItems].filter((x) => Date.now() - Date.parse(x.at) < DAYS * 864e5);
  for (const [fund, name] of Object.entries(ARK)) {
    let text = null;
    try {
      const r = await fetch(`https://assets.ark-funds.com/fund-documents/funds-etf-csv/${name}.csv`, { headers: { 'User-Agent': 'Mozilla/5.0 (GoldSignal)' }, signal: AbortSignal.timeout(15000) });
      if (r.ok) text = await r.text();
    } catch (e) { /* skipped this run */ }
    const rows = text ? csvRows(text) : [];
    if (!rows.length) { console.log(`ARK ${fund}: no file`); continue; }
    const [m, d, y] = rows[0].date.split('/'), date = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    const now = Object.fromEntries(rows.filter((r) => r.ticker).map((r) => [r.ticker, [r.sh, +r.px.toFixed(4), r.company]]));
    const old = snap[fund];
    if (old && old.date < date) {
      const moves = [];
      for (const [t, [sh, px, co]] of Object.entries(now)) {
        const was = old.h[t]?.[0] || 0;
        if (Math.abs(sh - was) >= Math.max(1, was * 0.005)) moves.push({ s: t, co, d: sh - was, usd: Math.abs(sh - was) * px, px, new: !was });
      }
      for (const [t, [was, px, co]] of Object.entries(old.h)) if (!now[t]) moves.push({ s: t, co, d: -was, usd: was * px, px, exit: true });
      moves.sort((a, b) => b.usd - a.usd);
      if (moves.length) items.push({ acc: `ark-${fund}-${date}`, cik: ARK_CIK, th: 'แคธี่ วูด', en: 'Cathie Wood', form: `ARK ${fund}`, kind: 'ark', fund,
        filed: date, at: `${date}T22:00:00.000Z`, url: `https://www.ark-funds.com/funds/${fund.toLowerCase()}`,
        buys: moves.filter((x) => x.d > 0).slice(0, 6), sells: moves.filter((x) => x.d < 0).slice(0, 6) });
      console.log(`ARK ${fund} ${old.date} → ${date}: ${moves.length} changes`);
    }
    if (!old || old.date < date) snap[fund] = { date, h: now };
  }
  fs.writeFileSync(file, JSON.stringify(snap));
  return items.filter((x, i, a) => a.findIndex((y) => y.acc === x.acc) === i);
}

(async () => {
  const [out, gurusFile] = process.argv.slice(2);
  const have = fs.existsSync(gurusFile) ? JSON.parse(fs.readFileSync(gurusFile, 'utf8')) : { gurus: [] };
  const filedOf = Object.fromEntries(have.gurus.map((g) => [g.cik, g.filed]));
  const prev = fs.existsSync(out) ? JSON.parse(fs.readFileSync(out, 'utf8')) : { items: [] };
  const known = new Map(prev.items.map((x) => [x.acc, x])); // parsed before → not fetched again
  // 13D / 13G name the company by CUSIP → the ticker from the 13F mapping cache (gurus-cusip.json, next to gurus.json)
  const cacheFile = require('path').join(require('path').dirname(gurusFile), 'gurus-cusip.json');
  const cusips = fs.existsSync(cacheFile) ? JSON.parse(fs.readFileSync(cacheFile, 'utf8')) : {};
  const since = new Date(Date.now() - DAYS * 864e5).toISOString().slice(0, 10);
  const items = [], new13F = [];
  for (const [cik, th, en] of GURUS) {
    const j = await sec(`https://data.sec.gov/submissions/CIK${String(cik).padStart(10, '0')}.json`);
    if (!j) { console.log(`⚠️ ${en}: no submissions`); continue; }
    const f = j.filings.recent;
    for (let i = 0; i < f.form.length && f.filingDate[i] >= since; i++) {
      const form = f.form[i], acc = f.accessionNumber[i];
      const kind = /^4(\/A)?$/.test(form) ? 'f4' : /13D/.test(form) ? '13d' : /13G/.test(form) ? '13g' : /^13F-HR/.test(form) ? '13f' : null;
      if (!kind) continue;
      if (kind === '13f' && filedOf[cik] && f.filingDate[i] > filedOf[cik] && !new13F.includes(cik)) new13F.push(cik);
      const base = { acc, cik, th, en, form, kind, filed: f.filingDate[i], at: f.acceptanceDateTime[i],
        url: `https://www.sec.gov/Archives/edgar/data/${cik}/${acc.replace(/-/g, '')}/${acc}-index.htm` };
      if (known.has(acc)) { items.push({ ...known.get(acc), ...base }); continue; }
      const doc = (f.primaryDocument[i] || '').replace(/^xsl[^/]+\//, '');
      let extra = {};
      if (kind !== '13f' && /\.xml$/i.test(doc)) {
        const xml = await sec(`https://www.sec.gov/Archives/edgar/data/${cik}/${acc.replace(/-/g, '')}/${doc}`, 'text');
        if (xml) extra = kind === 'f4' ? form4(xml, cik) : sched13(xml);
        if (kind === 'f4' && !extra) continue; // someone else's Form 4 (the guru is the issuer)
      }
      if (extra && extra.cusip && !extra.symbol && cusips[extra.cusip]) extra.symbol = cusips[extra.cusip];
      items.push({ ...base, ...(extra || {}) });
    }
  }
  // ARK (Cathie Wood) publishes every fund's holdings each day: the day-to-day change = her trades (kept with the filings)
  const arkFile = require('path').join(require('path').dirname(out), 'gurus-ark.json');
  const ark = await arkTrades(arkFile, prev.items.filter((x) => x.kind === 'ark'));
  items.push(...ark);
  items.sort((a, b) => b.at.localeCompare(a.at));
  const body = { asOf: new Date().toISOString(), days: DAYS, items: items.slice(0, 200) };
  const changed = JSON.stringify(body.items) !== JSON.stringify(prev.items);
  if (changed) fs.writeFileSync(out, JSON.stringify(body));
  // new buys / sells since the last run → scripts/gurus-notify.js (web push)
  const seen = new Set(prev.items.map((x) => x.acc));
  const fresh = body.items.filter((x) => (x.kind === 'f4' || x.kind === 'ark') && !seen.has(x.acc));
  if (process.env.GURUS_NEW) fs.writeFileSync(process.env.GURUS_NEW, JSON.stringify(prev.items.length ? fresh : [])); // first run: nothing is "new"
  console.log(`gurus-live: ${items.length} filings in ${DAYS} days (ARK ${ark.length}) · ${changed ? 'changed' : 'no change'} · new trades ${fresh.length}${new13F.length ? ` · NEW 13F: ${new13F.join(',')}` : ''}`);
  if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `new13f=${new13F.join(',')}\nchanged=${changed}\n`);
})().catch((e) => { console.error(e); process.exit(1); });
