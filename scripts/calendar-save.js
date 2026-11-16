// Keeps the history of released high-impact US news in calendar.json (data branch, 16 Nov 2026). /api/calendar only
// knows this week (ForexFactory) and today's actuals (Myfxbook); the news-stats tab wants the past 60 days, so every
// 5-minute check folds the released items in here (a later actual replaces an empty one). Same shape as /api/calendar.
//   node scripts/calendar-save.js [calendar.json]
const fs = require('fs');

const FILE = process.argv[2] || 'calendar.json';
const SITE = process.env.SITE_URL || 'https://gold-signal.gold-signal.workers.dev';
const KEEP_DAYS = 120;
const FF = 'https://nfs.faireconomy.media/ff_calendar_thisweek.json';

(async () => {
  let live;
  try {
    const r = await fetch(`${SITE}/api/calendar`, { signal: AbortSignal.timeout(20000) });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    live = await r.json();
  } catch (e) {
    console.log(`calendar: not updated (${e.message})`);
    return; // optional — never fail the recorder over it
  }
  let old = { events: [], occurrences: [] };
  try { old = JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch (e) { /* first run */ }
  // a copy of ForexFactory's weekly export for /api/calendar when ForexFactory refuses the Cloudflare data centre;
  // refreshed at most every 30 minutes (ForexFactory asks for gentle polling)
  let ff = old.ff || null;
  if (!ff || Date.now() - ff.at > 30 * 60e3) {
    try {
      const r = await fetch(FF, { headers: { 'user-agent': 'Mozilla/5.0 (compatible; GoldSignal/1.0)' }, signal: AbortSignal.timeout(15000) });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const list = (await r.json()).filter((e) => e.country === 'USD' && e.impact === 'High');
      ff = { at: Date.now(), list };
    } catch (e) { console.log(`calendar: ForexFactory copy not refreshed (${e.message})`); }
  }

  const now = Date.now(), from = now - KEEP_DAYS * 864e5;
  const ev = new Map(old.events.map((e) => [e.event_id, e]));
  const oc = new Map(old.occurrences.map((o) => [o.event_id, o]));
  let added = 0;
  live.occurrences.forEach((o, i) => {
    if (Date.parse(o.occurrence_time) > now) return; // only released items
    const had = oc.get(o.event_id);
    if (had && had.actual != null && o.actual == null) return; // keep an actual we already saw
    if (!had) added++;
    oc.set(o.event_id, o);
    ev.set(o.event_id, live.events[i]);
  });
  const occurrences = [...oc.values()].filter((o) => Date.parse(o.occurrence_time) >= from)
    .sort((a, b) => Date.parse(a.occurrence_time) - Date.parse(b.occurrence_time));
  const events = occurrences.map((o) => ev.get(o.event_id)).filter(Boolean);
  fs.writeFileSync(FILE, JSON.stringify({ source: live.source, at: now, events, occurrences, ff }));
  console.log(`calendar: ${occurrences.length} released items (+${added}), ${occurrences.filter((o) => o.actual != null).length} with actuals · site sources ${JSON.stringify(live.ok || {})} · ForexFactory copy ${ff ? new Date(ff.at).toISOString() : 'none'}`);
})();
