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
  items.sort((a, b) => b.at.localeCompare(a.at));
  const body = { asOf: new Date().toISOString(), days: DAYS, items: items.slice(0, 200) };
  const changed = JSON.stringify(body.items) !== JSON.stringify(prev.items);
  if (changed) fs.writeFileSync(out, JSON.stringify(body));
  console.log(`gurus-live: ${items.length} filings in ${DAYS} days · ${changed ? 'changed' : 'no change'}${new13F.length ? ` · NEW 13F: ${new13F.join(',')}` : ''}`);
  if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `new13f=${new13F.join(',')}\nchanged=${changed}\n`);
})().catch((e) => { console.error(e); process.exit(1); });
