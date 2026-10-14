// 📓 Private trade journal (user, 14 Oct 2026 — "ระบบ Login จัดการข้อมูลผู้ใช้ … อ่าน/เขียนได้เฉพาะเจ้าของ").
// One private Blob file per member, journal/<Clerk user id>.json. The id comes only from the signed cookie, so a member
// can read and write their own file and nothing else; there is no admin view of journals.
// GET → { entries } (newest first) · GET ?format=csv → download · POST { entry } → add · PUT { entry } (with id) → edit
// DELETE ?id=… → one entry · DELETE ?all=1 → the whole journal (PDPA: the owner can erase their data).
import { member, readJson, writeJson, json, fail, body, clip, num } from '../lib/gs.mjs';

const MAX = 2000;
const SIDES = ['BUY', 'SELL'];
const TFS = ['5m', '15m', '30m', '1h', '5h', '1d', '1w', 'other'];
const MOODS = ['calm', 'fear', 'greed', 'revenge', 'tired', 'fomo'];
const file = (id) => `journal/${id}.json`;

// XAU/USD: 1 lot = 100 oz, so $1 of price = $100 per lot
export function pnl(e) {
  if (e.exit == null || e.entry == null || !e.lots) return null;
  return Math.round((e.exit - e.entry) * (e.side === 'SELL' ? -1 : 1) * e.lots * 100 * 100) / 100;
}
export function clean(raw, old) {
  const e = {
    id: old ? old.id : `t${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    at: Number.isFinite(+raw.at) && +raw.at > 0 ? +raw.at : Date.now(),
    side: SIDES.includes(raw.side) ? raw.side : 'BUY',
    tf: TFS.includes(raw.tf) ? raw.tf : 'other',
    entry: num(raw.entry), sl: num(raw.sl), tp: num(raw.tp), exit: num(raw.exit),
    lots: num(raw.lots) != null && +raw.lots > 0 && +raw.lots <= 100 ? +raw.lots : null,
    system: !!raw.system, // followed a Gold Signal signal (true) or own idea (false)
    mood: MOODS.includes(raw.mood) ? raw.mood : '',
    note: clip(raw.note, 1000),
    lesson: clip(raw.lesson, 500),
    created: old ? old.created : Date.now(), updated: Date.now(),
  };
  if (e.entry == null || e.entry <= 0) throw new Error('ใส่ราคาเข้าให้ถูกต้อง');
  e.result = num(raw.result) != null ? +raw.result : pnl(e); // a typed result wins (fees, partial closes)
  return e;
}

const csvCell = (v) => { const s = v == null ? '' : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
function csv(entries) {
  const cols = ['at', 'side', 'tf', 'entry', 'sl', 'tp', 'exit', 'lots', 'result', 'system', 'mood', 'note', 'lesson'];
  const rows = entries.map((e) => cols.map((c) => csvCell(c === 'at' ? new Date(e.at).toISOString() : e[c])).join(','));
  return '﻿' + [cols.join(','), ...rows].join('\n');
}

async function handle(request) {
  const m = await member(request);
  if (!m) return fail('ต้องเข้าสู่ระบบก่อน', 401);
  const url = new URL(request.url);
  let data;
  try { data = await readJson(file(m.id), { entries: [] }); } catch (e) { return fail('อ่านบันทึกไม่ได้ ลองใหม่อีกครั้ง', 503); }
  const entries = data.entries || [];
  // newest first; same minute (the form's time has no seconds) → the one written last first
  const save = async () => { entries.sort((a, b) => (b.at - a.at) || (b.created - a.created)); await writeJson(file(m.id), { entries }); };

  if (request.method === 'GET') {
    if (url.searchParams.get('format') === 'csv') {
      return new Response(csv(entries), { headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': 'attachment; filename="gold-signal-journal.csv"', 'cache-control': 'no-store' } });
    }
    return json({ ok: true, entries });
  }
  if (request.method === 'DELETE') {
    if (url.searchParams.get('all') === '1') { await writeJson(file(m.id), { entries: [] }); return json({ ok: true, entries: [] }); }
    const id = url.searchParams.get('id');
    const i = entries.findIndex((e) => e.id === id);
    if (i < 0) return fail('ไม่พบรายการ', 404);
    entries.splice(i, 1);
    await save();
    return json({ ok: true, entries });
  }
  if (request.method === 'POST' || request.method === 'PUT') {
    let raw;
    try { raw = (await body(request)).entry || {}; } catch (e) { return fail('ข้อมูลไม่ถูกต้อง'); }
    let e;
    try {
      if (request.method === 'PUT') {
        const i = entries.findIndex((x) => x.id === raw.id);
        if (i < 0) return fail('ไม่พบรายการ', 404);
        e = clean(raw, entries[i]);
        entries[i] = e;
      } else {
        if (entries.length >= MAX) return fail(`บันทึกได้สูงสุด ${MAX} รายการ ลบรายการเก่าก่อน`);
        e = clean(raw);
        entries.push(e);
      }
    } catch (err) { return fail(err.message); }
    await save();
    return json({ ok: true, entry: e, entries });
  }
  return fail('method', 405);
}

export const GET = handle, POST = handle, PUT = handle, DELETE = handle;
