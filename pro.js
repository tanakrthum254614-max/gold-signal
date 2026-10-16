// ⭐ PRO state for the page (17 Oct 2026 — user: "อยากทำตัวที่เก็บตังก่อน" → PRO = AI coach, US stocks + gurus, signals on every
// timeframe, price alerts beyond one; free = the 1-hour main system, chart, news, journal, one price alert).
// GET /api/pro → { enabled, features, pro }. While the paywall is off (until the back office's 🚀 go-live) nothing is locked.
// The server enforces the same rules (middleware.js proOk / lib/gs.mjs allowed); this only shapes what the page shows.
(function () {
  const FREE_TF = '1h'; // the main system stays free
  const S = { enabled: false, pro: true, features: [] };
  window.GS_PRO = S;
  // locked(feature[, tf]) — true when this member must upgrade to use it
  window.gsLocked = (feature, tf) => {
    if (!S.enabled || S.pro || !S.features.includes(feature)) return false;
    if (feature === 'signals') return !!tf && tf !== FREE_TF;
    return true;
  };
  window.GS_PRO_FREE_TF = FREE_TF;
  const apply = () => {
    document.documentElement.classList.toggle('pro-wall', S.enabled && !S.pro);
    if (typeof window.renderChartZones === 'function') try { window.renderChartZones(); } catch (e) { /* chart not ready */ }
    window.dispatchEvent(new Event('gs-pro'));
  };
  fetch('/api/pro', { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)).then((j) => {
    if (!j) return;
    Object.assign(S, { enabled: !!j.enabled, pro: !!j.pro, features: j.features || [], until: j.until || 0 });
    apply();
  }).catch(() => {});
})();
