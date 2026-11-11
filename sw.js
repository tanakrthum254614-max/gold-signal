// Service worker: makes the site installable as an app (push notifications removed 11 Nov 2026).
// Pages and data are always fetched fresh (prices are live) — only a small offline page is cached.
const OFFLINE = 'gs-offline-v1';
const OFFLINE_HTML = `<!doctype html><html lang="th"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Gold Signal</title><body style="margin:0;min-height:100vh;display:grid;place-items:center;background:#0d1016;color:#e6e9ef;font-family:system-ui,sans-serif;text-align:center;padding:24px">
<div><img src="/icons/icon-192.png" width="96" height="96" alt=""><h2 style="color:#e8b64c">ไม่มีอินเทอร์เน็ต</h2>
<p>Gold Signal ต้องใช้อินเทอร์เน็ตเพื่อดึงราคาทองสด<br>ต่อเน็ตแล้วกดลองใหม่</p>
<button onclick="location.reload()" style="font:inherit;padding:10px 22px;border-radius:12px;border:0;background:#e8b64c;color:#1a1205;font-weight:700">ลองใหม่</button></div></body></html>`;

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(OFFLINE).then((c) => c.addAll(['/icons/icon-192.png'])).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

// Network only; page navigations fall back to the offline page
self.addEventListener('fetch', (e) => {
  if (e.request.mode !== 'navigate') return;
  e.respondWith(fetch(e.request).catch(() => new Response(OFFLINE_HTML, { headers: { 'Content-Type': 'text/html; charset=utf-8' } })));
});
