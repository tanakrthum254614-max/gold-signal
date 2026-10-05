---
name: gold-signal
description: คู่มือโปรเจค Gold Signal — เว็บ/ระบบสัญญาณเทรดทองคำ XAU/USD (investing.com) สัญญาณรายวัน 07:00 + สัญญาณทุก 30 นาที แจ้งเตือน LINE และบันทึกสถิติชนะ–แพ้ ใช้เมื่อจะแก้ไข ทดสอบ หรือ deploy โปรเจคนี้
---

# Gold Signal — สัญญาณเทรดทองคำ XAU/USD

เว็บและระบบอัตโนมัติที่ให้สัญญาณ **ซื้อ/ขายทองคำ** พร้อม SL/TP ส่งเข้า LINE และ**บันทึกผลชนะ–แพ้จริงทุกไม้** (ไม่ตัดทิ้ง ไม่แก้ย้อนหลัง)

| อะไร | ที่ไหน |
|---|---|
| เว็บจริง | https://gold-signal-ten.vercel.app (alias: thander-gold-signal.vercel.app) |
| โค้ด (Public) | https://github.com/tanakrthum254614-max/gold-signal — push `main` = deploy อัตโนมัติ |
| Vercel | scope `thander1`, project `gold-signal` (ใช้ CLI `npx vercel`, ล็อกอินเป็น tanakrthum2546-3404) |
| ล็อกอิน | Clerk (Google) dev instance `delicate-tapir-2101` — publishable key อยู่ใน `config.js` |
| LINE OA | `@279arudw` · เพิ่มเพื่อน https://line.me/R/ti/p/@279arudw |
| Secret | GitHub Actions secret `LINE_CHANNEL_ACCESS_TOKEN` (Channel access token *long-lived* จากแท็บ Messaging API) |

---

## 0. ทำงานเสร็จแล้วต้องทำต่อ (ทุกครั้ง)
1. ทดสอบในเครื่อง (ภาพหน้าจอมือถือ + คอม, ไม่มี error · เรื่องราคา/ความเร็ววัดด้วย puppeteer-core แบบเวลาจริง)
2. เปลี่ยนกติกาสัญญาณ → ทดสอบย้อนหลังก่อน รายงานผลตามจริง (รวมที่ขาดทุน)
3. **อัปเดต `compare.html`** — เพิ่มหัวข้อใหม่ไว้บนสุด: 🕰️ แบบเก่า vs ✨ แบบใหม่ (ภาพใน `compare/`; ภาพแบบเก่าถ่ายจากโค้ดก่อนแก้ด้วย `git worktree add <dir> <commit>` + `PORT=3001 node dev-server.js` แล้วปิด server ก่อนลบ worktree)
4. เปลี่ยนเลข `?v=` → commit → push → เช็กว่าเว็บจริงได้ไฟล์ใหม่ · แก้ workflow → สั่งรันทดสอบ (send=false)
5. อัปเดต Skill.md + สำเนา `.claude/skills/gold-signal/SKILL.md` + memory

## ⏰ เช็กตรงทุก 5 นาที (5 ต.ค. 2569)
- GitHub cron `*/5` เริ่มจริงห่าง 10–20 นาที → price-alerts.yml ตั้ง `*/15` และแต่ละรอบรัน `scripts/check-loop.sh` นาน ~28 นาที เช็กเองทุกจุด 5 นาที (+20 วิ) · commit ทุกครั้งที่มีผลเปลี่ยน · รอบถัดไปรอคิว (concurrency ไม่ยกเลิก) จึงต่อกันไม่มีช่องว่าง · รันมือ = เช็กครั้งเดียว (`LOOP_MINUTES=0`) · ล้มทั้งรอบเฉพาะเมื่อทุกเช็กล้ม

## 💸 ใช้ของฟรีเท่านั้น (ผู้ใช้เลือก 5 ต.ค. 2569)
- ไม่ซื้อโดเมน → Clerk ยังเป็น development instance (มีป้าย Development mode, จำกัดจำนวนผู้ใช้) · แชร์ให้คนอื่นด้วยลิงก์ `/?demo=1` · ไม่เสนอของเสียเงิน (โดเมน, แพ็กเกจ LINE OA) เว้นแต่ผู้ใช้ถามเอง

## 👀 โหมดดูตัวอย่าง (`?demo=1`)
- auth.js ข้าม Clerk ทั้งหมด → เปิดแอปได้เลย มีแถบ `#demoBar` + ปุ่ม `#accSignIn` ในแท็บบัญชี · การตั้งค่าเก็บใน localStorage · หน้าล็อกอินมีปุ่ม "ดูตัวอย่างก่อน" · Portfolio ลิงก์มาที่ `/?demo=1`

## 1. ระบบสัญญาณ 2 ระบบ (แยกสถิติกัน)

### 📅 สัญญาณรายวัน (07:00 จันทร์–ศุกร์) — `signals.js` · บันทึกใน `signals.json`
- ทิศทาง = แนวโน้ม **สั้น + กลาง + ยาว** จาก investing.com (`explain.js` horizons) รวมกัน (เสมอ → ใช้ระยะกลาง)
- **เข้าทันที (Market)** ที่ราคาตอน 07:00 · มีสัญญาณทุกวันทำการ (`RULE.minTrend: 0`)
- **SL $15 · TP1 $15 · TP2 $20 · TP3 $30** · ดาว ★ = แนวโน้ม 3 ช่วงสอดคล้องกันแค่ไหน (|คะแนน| 0–6)
- ออกสัญญาณ **07:05** (หลังตลาดเปิด) · อายุถึง **02:45 คืนถัดไป** (ก่อนตลาดปิด 03:00) แล้วปิดที่ราคาตอนนั้น

### ⏱️ สัญญาณ 30 นาที — `intraday.js` · บันทึกใน `intraday.json`
- ทุกครึ่งชั่วโมง วิเคราะห์แท่งที่ **ปิดแล้ว** ของ investing.com `PT30M / PT1H / PT5H` ด้วยตัวชี้วัดของเราเอง (`indicators.js`)
- คะแนน = ผลรวม 3 ช่วง (−6…+6) → **เข้าเมื่อ |คะแนน| ≥ 5** · ครั้งละ 1 ไม้ · ไม้ใหม่ได้ในครึ่งชั่วโมงที่เริ่ม ≥15 นาทีหลังไม้ก่อนปิด
- **เวลาตลาด (ไทย): 07:00–03:00** (หน้าหนาวสหรัฐ 08:00–04:00 — ดูหัวข้อเวลาตลาด) จันทร์ถึงเช้าเสาร์ (`INTRA.marketOpen`) · ไม่เปิดไม้ใหม่ 02:00–03:00 · ทุกไม้ปิดภายใน **02:45** (`nextClose`) · ไม่ส่งอัปเดตตอนตลาดปิด
- SL/TP เหมือนรายวัน
- **ข้อความอัปเดต 30 นาที** (`UPDATE_EVERY`, `updateText` ใน `scripts/intraday-run.js`) — เช็กทุกครึ่งชั่วโมง แต่**ส่ง LINE เฉพาะตอน ✅ เปลี่ยน** (ดู "ประหยัดโควตา LINE" ด้านล่าง): **ทั้งฝั่งซื้อและฝั่งขาย** แต่ละฝั่งมีคำตัดสิน (`INTRA.verdict`: ≥57% ✅ ควรเข้า · 53–56% 🟡 ลดขนาดไม้ · <53% ❌ ไม่ควรเข้า) + % + จุดเข้า/SL/TP + บรรทัดสรุปฝั่งที่ได้เปรียบ · ตาราง `calibration` แยก `{buy, sell}` ต่อคะแนน (ทุกครึ่งชั่วโมงจำลองทั้งซื้อและขาย) · ฝั่งขายไม่เคยเกิน ~53% ที่คะแนนใด → ไม้ที่นับสถิติยังเปิดเฉพาะฝั่งซื้อ (`RULE.sides`)
  + **% จบกำไร** (winRate = ไม้ที่ปิดได้กำไร: ถึง TP1 หรือปิดตอนหมดเวลาแล้วมีกำไร — ไม่ใช่ "ถึง TP1 ก่อน SL") และ **% ถึง TP1** (= 100 − split[0]) จากตาราง `calibration` ใน `backtest-30m.json` (สถิติ 2 ปี แยกตามคะแนน −6…+6, `INTRA.odds`)
  ระดับ: ≥57% ✅ น่าเข้า · 53–56% 🟡 พอเข้าได้ · ≤52% ⚠️ ใกล้ 50/50 — ไม้ที่ "นับสถิติ" ยังเปิดเฉพาะเมื่อ |คะแนน| ≥ 5
- ชั่วโมงที่ประกาศไปแล้วเก็บใน `state/notify.json` ผ่าน **Actions cache** (ไม่ commit ทุกชั่วโมง → Vercel ไม่ deploy ถี่)
- ข้อสังเกตจากตาราง (2 ปี): ฝั่ง **ซื้อ** คะแนน +4…+6 ชนะ 57–59% · ฝั่ง **ขาย** −4…−6 แค่ ~49–50% (ทองเป็นขาขึ้นเกือบทั้งช่วง)

### ⚡ ราคาสดจากสตรีมของ investing.com (5 ต.ค. 2569)
- ราคาหน้าเว็บมาจาก **SockJS stream ที่ investing.com ใช้เอง**: `wss://streaming.forexpros.com/echo/<n>/<id>/websocket` → ได้ `o` แล้วส่ง `[JSON.stringify({_event:"bulk-subscribe",tzID:8,message:"pid-68:"})]` → เฟรม `a[...]` = `{message:"pid-68::{last_numeric, bid, ask, high, low, last_close, pc, pcp, timestamp}"}` ~1 tick/วินาที · heartbeat `{_event:"heartbeat",data:"h"}` ทุก 25 วิ · ต่อใหม่แบบ backoff (main.js `startStream` / `onStreamTick`)
- **ไม่ผ่าน Cloudflare** ของ REST API — ใช้ได้แม้ REST โดนบล็อก · ทดสอบ: หน้าเว็บเปลี่ยนราคา 17 ครั้ง/20 วินาที (เดิมแทบไม่ขยับเพราะตกไปแหล่งสำรอง)
- **ราคาเดียวทั้งเว็บ**: ทุก tick → `patchChartBars` (แท่งล่าสุดของกราฟ, ขึ้นแท่งใหม่เมื่อครบช่วง) + `chartTick` (อัปเดตแท่ง/ราคาหน้ากราฟทันที) · ส่วนหนัก (`render`, เกจ, โดนัท) ≤1 ครั้ง/วินาที · แท่งสำรอง Binance ปรับ offset ด้วยราคาสตรีม (ไม่ใช้ gold-api ที่ช้า) · ราคาปิดอ้างอิงทุกจุด = `prevClose()` (last_close จากสตรีม = ตัวเลขเดียวกับ investing.com) · ทดสอบ 30 ตัวอย่าง: หัวเว็บ = หน้าแรก = หน้ากราฟ = แท่งล่าสุด ตรงกัน 30/30
- REST (PT1M) เหลือทุก ~21 วิ (ทุก 3 วิเฉพาะตอนสตรีมหลุด) · ตัวชี้วัด 60 วิ · แท่ง 15m/30m/1h/5h 60 วิ — เดิมยิง ~1 ครั้ง/วินาที/แท็บ จน investing.com บล็อก IP (`Failed to fetch`)
- แหล่งอื่นที่ลองแล้ว: gold-api.com อัปเดต ~1.5 นาที · Binance PAXG trade ~30/นาที, bookTicker mid เปลี่ยน ~ทุก 3 วิ · Swissquote โดน CORS · Binance Futures XAUUSDT ws ไม่มีข้อความ
- ทดสอบแบบเวลาจริงต้องใช้ puppeteer-core (Chrome `--virtual-time-budget` เร่งเวลา ทำให้วัดความถี่ผิด)

### 🕐 เวลาตลาดตามเวลานิวยอร์ก (6 ต.ค. 2569)
- ตลาดทองเดินตามเวลานิวยอร์ก → เวลาไทย **กลาง มี.ค.–ต้น พ.ย. 07:00–03:00 · ต้น พ.ย.–กลาง มี.ค. 08:00–04:00** · โค้ดเขียนเวลาแบบ "หน้าร้อน" แล้วเลื่อนด้วย `SIG.marketShift(ms)` (0 หรือ 1 ชม., `SIG.usDst` = อาทิตย์ที่ 2 มี.ค. 07:00 UTC → อาทิตย์แรก พ.ย. 06:00 UTC) · ข้อความ: `SIG.mt(ms, "07:00")` → "08:00" หน้าหนาว
- ที่ใช้: `INTRA.marketOpen/nextClose/lastHour/weekStart/nextWeek` (นาฬิกา `mkt()`), `SIG.expiry` (02:45→03:45), weekly.js, backtest.js (เข้าตอนเปิด), check-loop.sh (ช่วง 30 นาทีแรกหลังเปิดเป็นของงานเช้า), main.js ข้อความ, index.html วิธีใช้
- **งานเช้า**: cron 2 รอบ `5 0` และ `5 1` (UTC) + `scripts/market-gate.js` → `GO=true` เฉพาะเมื่อตลาดเปิดแล้ว + วันนั้นยังไม่มีสัญญาณ (รันมือ = ผ่านเสมอ) · ทุกขั้นใน morning-plan.yml มี `if: env.GO == 'true'`
- backtest 1 ปีข้อมูลชุดเดียวกัน ก่อน→หลัง: 30 นาที +$313.72→+$293.48 · 15 นาที +$243.19→+$332.52 · รายวัน +$72.11→−$19.23 (advisory อยู่แล้ว)
- ถ้าโบรกเกอร์ของผู้ใช้ไม่เลื่อนเวลา → ให้ `marketShift` คืน 0 ตลอด (จุดเดียว)

### ⚡ โลโก้ + หน้าโหลด (6 ต.ค. 2569)
- `logo.svg` = ตราหกเหลี่ยมทอง + แท่งทอง 3 แท่งไล่ขึ้น + สายฟ้า (ผู้ใช้ขอ "ตลาดทองคำ + สายฟ้า") · ใช้เป็น `<img class="logo">` ที่แถบบน/หน้าล็อกอิน + favicon · แก้รูปทรงต้องแก้ 2 ที่: logo.svg และ SVG `.sp-logo` ใน index.html (ภาพเดียวกัน แต่ id gradient `lg*`)
- หน้าโหลด (live.css "Logo"): ขอบวาด (`lg-rim` pathLength=1) → แกนกลาง → แท่งทองเด้งขึ้น (`lg-bar`) → สายฟ้าฟาด 1.1 วิ (`lgStrike`) แล้ววนทุก 3.2 วิ พร้อม `lgZap` / ประกาย `lg-rays` / แสงวาบ `.sp-flash` / ฟ้าผ่าบนท้องฟ้า `.sp-sky` (มุมซ้าย-ขวาบน ไม่ทับชื่อ) · โหลดเสร็จ `lgDone`
- กับดัก: `.sp-ring svg` เดิมหมุน −90° (สำหรับวงแหวน %) → ตอนนี้ใช้ `.sp-ring > svg:not(.sp-logo)`
- ทดสอบอนิเมชั่น: หยุดภาพที่เวลาที่ต้องการด้วย `document.getAnimations().forEach(a => { a.pause(); a.currentTime = t; })` (บล็อก request ข้อมูลเพื่อให้หน้าโหลดค้าง) · dev-server เสิร์ฟ .svg/.png แล้ว

### 🧭 การ์ดแนวโน้มสด (แทนเกจเข็ม, 5 ต.ค. 2569)
- index.html `#sm`: แถบ 13 ช่อง −6…+6 (`#smSegs`, ช่องที่ติด = `on b|s` + `peak`, `--k` = ความแรง) + เส้นประ "จุดเข้าซื้อ" ที่ +5 + เคอร์เซอร์ (`smCursor`, ตำแหน่ง calc ตาม gap 4px / 3px บนมือถือ) · คะแนนนับขึ้น/ลง (`smCount`) · ข้อความ `smMood` · 3 การ์ด `#smf-m30|h1|h5` (**แท่งเทียน** `.smf-candles` 30 แท่ง/มือถือ 14 จาก `state.intraCandles` — สร้าง `<g><line/><rect/></g>` ใหม่เฉพาะตอนขึ้นแท่งใหม่ (เด้งขึ้นทีละแท่ง) ระหว่างนั้นแค่ขยับ attribute · แท่งสุดท้าย `.live` กะพริบ · เส้นประ `.lp` = ราคาตอนนี้ · `.smf-chg` = ราคาแท่งนี้ − ราคาเปิดแท่ง · โหวต ▲▲ +2) · แถบนับถอยหลังถึงแท่ง 30 นาทีปิด (`renderCycle` ทุก 1 วิ) · โค้ด: main.js `buildMeter` / `renderMeter(dec, off)` · CSS: live.css "Trend strength meter" + theme.css
- **ตลาดปิด vs ข้อมูลช้า**: `off = !dec.open ? "closed" : dec.stale ? "late" : ""` — "🌙 ตลาดปิด" ดูจากเวลาเท่านั้น (บอกวันด้วย `INTRA.nextOpen`) · ข้อมูลช้า → "⏳ กำลังดึงข้อมูลกราฟล่าสุด…" + ดึงใหม่ (ทุก ≥20 วิ) · `INTRA.reasons` แยกข้อความเหมือนกัน
- **ต้นเหตุเดิม** (ผู้ใช้เห็น "ตลาดปิด" จันทร์ 23:38): `stale` = แท่ง 30m ล่าสุดเก่ากว่า 2 ชม. — แท่งไม่อัปเดตเมื่อ fetch ล้ม/แท็บหลับ (`every()` ข้ามตอนแท็บซ่อน และตอนกลับมาไม่ได้ดึงแท่ง) · แก้: `patchIntraCandles` ขึ้นแท่งใหม่จากราคาสตรีมเมื่อครบช่วง (เฉพาะสตรีมสด + ตลาดเปิด + ช่วงถัดไปช่วงเดียว) · visibilitychange เรียก `refreshIntraCandles`

### ⏱️ สัญญาณ 15 นาที — เว็บเท่านั้น (5 ต.ค. 2569)
- `INTRA.decide15` = `decideWith(FRAMES15, RULE15, …)`: แนวโน้ม 15m/1h/5h · **ซื้ออย่างเดียวที่ +5** · SL/TP เหมือนระบบ 30 นาที · ไม่ส่ง LINE ไม่บันทึกไฟล์
- เว็บ (main.js `run15`): จำลองย้อนหลังบนแท่ง 15m ที่อยู่บนจอ (investing 160 แท่ง ≈ 40 ชม.) ด้วยกติกาเดียวกับ backtest (ไม้เดียว, รอ 15 นาทีหลังปิด) → การ์ดหน้าแรก (กราฟแท่ง 15m + ▲ ซื้อ / ● TP / ● SL + พื้นหลังเขียว=เข้าได้ เหลือง=ข่าว) และ markers ในหน้ากราฟเมื่อเลือก 15m (ช่วง 2 วัน)
- ทดสอบ 1 ปี (`SYSTEM=15 node scripts/backtest-30m.js 365` → backtest-15m.json, ตามไม้บนแท่ง 5m): ซื้อ+ขาย ±5 −$131 · ซื้อ +3 −$460 · +4 −$198 · **+5 +$97** (1.4/วัน, 52%) · +6 +$37 (หลังสเปรด) · ทดลองค่าอื่น: `TH=4 SIDES=buy OUT=tmp.json`
- `decide` (30 นาที) ถูกปรับเป็น `decideWith(FRAMES, RULE, …)` — ผล backtest เหมือนเดิมทุกตัว (375 ไม้, +$313.72 ก่อนสเปรด)
- แหล่งสำรอง: ถ้า investing.com ล่ม แท่ง 15m/30m/1h ใช้ Binance PAXG และสร้างแท่ง 5 ชม. จาก 1 ชม. (`group5h`)

### สัญญาณรายวัน = ข้อมูลประกอบ (5 ต.ค. 2569)
- `SIG.RULE.advisory = true` → สัญญาณใหม่มี `advisory: true`: ข้อความเช้าเป็น "🧭 ภาพรวมทองคำวันนี้" (เอียงขึ้น/ลง + ข่าว + สถานะระบบ 30 นาที) **ไม่บอกให้เข้าไม้** · alerts.js บันทึกผลแต่**ไม่ส่ง LINE** · weekly.js ไม่นับรวมในยอดรวม · เว็บแสดงกล่องเตือน ซ่อนวิธีเข้า/lot · กล่องสถิติหน้าแรกเปลี่ยนเป็นของระบบ 30 นาที
- เหตุผล: backtest รายวัน 1 ปีหลังหักสเปรด −$31.89/ออนซ์ (ชนะ 49%) · สัญญาณเก่าก่อน 6 ต.ค. ไม่มี flag จึงยังแจ้งเตือนจนจบตามเดิม
- **โควตา LINE**: `scripts/line-quota.js` ในงานเช้า (GET /v2/bot/message/quota + /quota/consumption) → `quota.json` (commit, no-cache ใน vercel.json, แสดงที่แท็บบัญชี) · ใช้ ≥80% ส่งเตือนเดือนละครั้ง · error ไม่ทำให้งานเช้าล้ม

### ประหยัดโควตา LINE + เบรกฉุกเฉิน (5 ต.ค. 2569)
- **อัปเดต 30 นาทีส่งเฉพาะตอนเปลี่ยน**: เช็กทุกครึ่งชั่วโมง แต่ส่งเมื่อฝั่งใดฝั่งหนึ่ง **กลายเป็น ✅** หรือ **หมด ✅** (state.goodKey/goodDay ใน state/notify.json, วันเริ่ม 07:00 = วันตาม UTC) — จำลอง 30 วัน ≈ 2 ข้อความ/วัน (เดิม ~40) · ส่งทุก 30 นาทีกินโควตา ~900/เดือน
- **รวมข้อความต่อรอบ**: workflow ตั้ง `OUTBOX=outbox.json` → `send()` เก็บคิว → `scripts/flush.js` ส่ง LINE ครั้งเดียว (≤5 บอลลูน, `pack()`) — LINE นับต่อครั้งที่ส่ง ไม่ใช่ต่อบอลลูน
- **เบรกฉุกเฉิน** `INTRA.RULE.pause {streak:5, weekLoss:60}` + `INTRA.pauseCheck`: แพ้ติด 5 ไม้ หรือสัปดาห์นี้ขาดทุนสุทธิ ≤ −$60/ออนซ์ → `intraday.json.pause {from, until: จันทร์หน้า 07:00, reason}` ไม่เปิดไม้/ไม่ส่ง ✅ · หลังพักนับใหม่ตั้งแต่ `pause.until` · เว็บแสดง "🛑 ระบบพัก"
  ผลจำลอง 1 ปี: พัก 5 ครั้ง ข้าม 45 ไม้ กำไร +$151 vs +$164 ถ้าไม่มีเบรก — **เบรกไม่ได้เพิ่มกำไรในอดีต** มีไว้กันกรณีระบบพังจริง

### ระบบเสริม (เพิ่ม 5 ต.ค. 2569)
- **30 นาทีเข้าเฉพาะฝั่งซื้อ** (`INTRA.RULE.sides = 'buy'`) — backtest 2 ปี: ซื้ออย่างเดียว 630 ไม้ +$893 หลังสเปรด vs สองฝั่ง 1,267 ไม้ +$791 · 1 ปีล่าสุด +$164 vs +$239 (ต่อไม้ดีกว่าเกือบเท่าตัว)
- **หลบข่าวแรง**: ปฏิทิน investing.com `endpoints.investing.com/pd-instruments/v1/calendars/economic/events/occurrences?domain_id=1&country_ids=5&importances=high` (CORS เปิด, ดึงได้ทั้งเว็บและ Actions) → ไม่เปิดไม้ ±30 นาที (`RULE.newsMin`) · เตือนล่วงหน้า ~30 นาที · รายการข่าวในข้อความเช้า · backtest **ไม่มี**ตัวกรองข่าว (ไม่มีปฏิทินย้อนหลัง)
- **ขนาดไม้**: 0.01 lot = 1 ออนซ์ → lot = ทุน×%เสี่ยง ÷ (SL×100) ปัดลง 0.01 · ตั้งค่า (ทุน USD/THB, %เสี่ยง, สเปรด) ในแท็บบัญชี เก็บใน Clerk `unsafeMetadata.goldSettings` + localStorage
- **สเปรด**: `SIG.summary(list, spread)` หักต่อไม้ · ฝั่งเซิร์ฟเวอร์ใช้ `SPREAD_USD` จาก repo variable `vars.SPREAD_USD` (ค่าเริ่ม 0.4) · เว็บใช้ค่าที่ผู้ใช้ตั้ง
- **ช่องทางส่ง**: LINE อย่างเดียว (`scripts/notify.js` → `line.js`) · ส่งพลาด (เช่นโควตาหมด) แค่ log ไม่ล้ม · ผู้ใช้ไม่เอา Telegram (ลบโค้ดออกแล้ว)
- **สรุปรายสัปดาห์**: `weekly-summary.yml` เสาร์ 00:30 UTC (07:30 ไทย) → `scripts/weekly.js` (ปิดสัญญาณรายวันวันศุกร์ที่หมดอายุด้วย)
- **แจ้งเมื่อระบบพัง**: ทุก workflow มีขั้น `if: failure()` → `scripts/notify-failure.js` (ไม่เกิน 1 ครั้ง/3 ชม./งาน ผ่าน state cache) · ใช้ข้อมูลสำรอง Binance > 30 นาที → แจ้ง 1 ครั้ง/6 ชม.

### กติกาการนับผล (ใช้ร่วมกันใน `signals.js` → `evaluateTargets`)
- ปิด **⅓ ที่แต่ละ TP** · ถึง TP1 แล้ว **เลื่อน SL ไปที่ทุน**
- **ชนะ** = ถึง TP1 ก่อน SL · **แพ้** = โดน SL ก่อน TP1 · แท่ง 15 นาทีเดียวโดนทั้ง SL และ TP → นับว่าโดน SL ก่อน (อนุรักษ์นิยม)
- ครบ 3 เป้า = **+$21.67/ออนซ์** · TP1 แล้วกลับทุน = **+$5** · โดน SL = **−$15**
- ไม้เก่าที่มี `tp` เดียว (ไม่มี `tps`) ใช้ `evaluate` แบบเดิม — อย่าลบโค้ดส่วนนี้

---

## 2. โครงสร้างไฟล์

```
index.html      หน้าเว็บ (แท็บ: สัญญาณ / สถิติ / กราฟ / วิธีใช้ / บัญชี) — asset ทุกตัวมี ?v=<เวอร์ชัน>
style.css       โครง CSS เดิม (เดิมเป็นธีมมืด)
theme.css       ธีมสว่าง (ค่าเริ่มต้น · <link id=themeLight> โหลดเป็นไฟล์สุดท้าย ทับสีของ style.css/live.css) · โหมดมืด = ปิดไฟล์นี้ (ปุ่ม 🌙 บนแถบบน / แท็บบัญชี, localStorage gs-theme, ui.js applyTheme → main.js applyChartTheme) — การ์ดขาว เงานุ่ม แถบสีด้านบนบอกสถานะ · สีกราฟอยู่ใน main.js (chartBase / series)
live.css        หน้าโหลดแบบอนิเมชั่น (วงแหวน % + อนุภาค + รายการขั้น), ราคาสด, การ์ดแนวโน้มสด (แถบ −6…+6), โดนัท, การเคลื่อนไหวของแท็บ
config.js       Clerk publishable key + ลิงก์เพิ่มเพื่อน LINE (ของสาธารณะ ไม่มีความลับ)
logo.svg        โลโก้ (ตราหกเหลี่ยมทอง + แท่งทอง + สายฟ้า) — แถบบน, หน้าล็อกอิน, favicon
auth.js         หน้าโหลด (SPLASH.step(text, pct) ขยับวงแหวน + นับ % + เก็บขั้นที่ผ่านแล้ว) + ล็อกอิน Google ผ่าน Clerk (clerk-js@6 + @clerk/ui@1 + ภาษาไทย thTH)
ui.js           แท็บ (hash routing), หน้าบัญชี, แชร์ LINE
main.js         ดึงข้อมูล investing.com จากเบราว์เซอร์, กราฟ, การ์ดสัญญาณ, หน้าสถิติ
                หน้าแรกเรียลไทม์: ราคาจากสตรีม (startStream/onStreamTick ~1 วิ) + refreshTick (PT1M ทุก ~21 วิ, ทุก 3 วิเฉพาะตอนสตรีมหลุด) → renderLive (ราคา/กราฟเส้น/สถานะตลาด) + patchIntraCandles
                (ขยับแท่ง 30m/1h/5h ที่ยังไม่ปิดตามราคาสด) → renderIntra: renderMeter คะแนนสด INTRA.decide(...,live=true) เทียบคะแนนแท่งปิด,
                โดนัทฝั่งซื้อ/ขายจาก calibration.split [ไม่ถึง TP1, TP1, TP2, TP3] ตรงกลาง = จบกำไร, ไม้ที่เปิดอยู่ (แถบ SL→TP3), ไทม์ไลน์ข่าว
                LINE ใช้แท่งปิดเท่านั้น (ส่งเฉพาะตอน ✅ เปลี่ยน) · เว็บสด
indicators.js   ตัวชี้วัด (EMA/RSI/MACD/BB/ATR/Stoch/ADX) + เครื่องโหวต — ใช้ทั้งเว็บและ Node
investing.js    แปลผลวิเคราะห์ investing.com เป็นภาษาไทย (โหมดนักเทรด)
explain.js      horizons(): แนวโน้มระยะสั้น/กลาง/ยาว จากสรุป investing.com
dailyplan.js    Pivot Points (ใช้ในกราฟโหมดนักเทรด) + money()
signals.js      สร้าง/ให้คะแนนสัญญาณ, summary(), RULE ของสัญญาณรายวัน
intraday.js     decide()/makeTrade() ของสัญญาณ 30 นาที
signals.json    บันทึกสัญญาณรายวัน (เขียนโดย GitHub Actions เท่านั้น)
intraday.json   บันทึกไม้ 30 นาที (เขียนโดย GitHub Actions เท่านั้น)
backtest.json / backtest-30m.json   ผลทดสอบย้อนหลัง 1 ปี (สร้างใหม่ทุกวันจันทร์)
scripts/
  fetch_data.py      ดึงข้อมูล (curl_cffi ปลอมเป็น Chrome) · --m15-only = แท่ง 15m/30m/1h/5h
  morning-plan.js    งาน 07:00: ให้คะแนนสัญญาณเก่า + ออกสัญญาณรายวัน + ส่ง LINE
  check-loop.sh      วนเช็กทุก 5 นาที (~28 นาที/รอบ) เรียก alerts.js + intraday-run.js
  alerts.js          ทุก 5 นาที (ผ่าน check-loop): ติดตามสัญญาณรายวัน บันทึก TP/SL
  intraday-run.js    ทุก 5 นาที (ผ่าน check-loop): ติดตาม/เปิดไม้ 30 นาที แจ้ง LINE
  trade-events.js    ข้อความ LINE ของเหตุการณ์ TP/SL (ใช้ร่วมกัน)
  line.js            broadcast ไป LINE Messaging API
  backtest.js / backtest-30m.js   ทดสอบย้อนหลัง (Binance PAXG ผ่าน data-api.binance.vision)
.github/workflows/
  morning-plan.yml   cron 00:05 + 01:05 UTC จ.–ศ. → market-gate.js ปล่อยรอบที่ตลาดเปิดแล้ว (07:05 / 08:05 หน้าหนาว)
  price-alerts.yml   cron */15 จ.–ศ. (UTC) แต่ละรอบรัน check-loop.sh เช็กทุก 5 นาที · แจ้ง TP/SL · อัปเดตทุก 30 นาที · เปิดไม้ 30 นาที
dev-server.js   เซิร์ฟเวอร์ทดสอบในเครื่อง (npm start → http://localhost:3000)
vercel.json     framework: null (static) + no-cache สำหรับหน้าเว็บและไฟล์ .json
```

---

## 3. แหล่งข้อมูล (สำคัญ)

- **investing.com API**: `https://api.investing.com/api/financialdata` คู่ XAU/USD = **pair 68**
  - กราฟ: `/68/historical/chart/?interval=PT15M|PT30M|PT1H|PT5H|P1D&pointscount=160` (สูงสุด **160** แท่ง)
  - วิเคราะห์: `/technical/analysis/68/{5m,15m,30m,1h,5h,1d,1w,1mo}`
  - ต้องส่ง header **`domain-id: th`** — API ตอบ CORS ให้ทุก origin → **เบราว์เซอร์ดึงได้โดยตรง**
  - **จากเซิร์ฟเวอร์ (Node fetch / Vercel) โดน Cloudflare บล็อก 403** เพราะ TLS fingerprint → ห้ามทำ proxy
  - บน GitHub Actions ใช้ Python **curl_cffi `impersonate="chrome"`** ผ่าน
- สำรอง: Binance PAXG/USDT (`data-api.binance.vision` ไม่ติด geo-block) + เลื่อนราคาด้วย spot จาก gold-api.com
- Pivot รายวันของ investing.com เช้าวันจันทร์คำนวณจากแท่งสั้นของคืนวันอาทิตย์ → **อย่าใช้** (ใช้ `PLAN.levelsFromDaily` ที่ข้ามวันเสาร์–อาทิตย์)

---

## 4. ทดสอบในเครื่อง

```bash
npm start                                   # http://localhost:3000
# ปิดหน้าล็อกอินชั่วคราว: ตั้ง clerkPublishableKey เป็น '' ใน config.js แล้ว "อย่าลืมคืนค่า" ก่อน commit
node scripts/morning-plan.js data.json      # dry run (ไม่ส่ง ไม่บันทึก) — ต้องมี data.json จาก fetch_data.py
SIGNALS_FILE=/tmp/x.json RECORD=true node scripts/alerts.js data.json        # ทดสอบกับไฟล์ปลอม
INTRADAY_FILE=/tmp/y.json RECORD=true node scripts/intraday-run.js data.json
node scripts/backtest.js 365 && node scripts/backtest-30m.js 365             # สร้าง backtest ใหม่
```
- ในเครื่องไม่มี Python → ทดสอบ fetch_data.py บน GitHub (`gh workflow run ... -f send=false`)
- ถ่ายภาพหน้าจอ: Chrome headless `--screenshot` (ความกว้างต่ำสุดจริง ~500px)

## 5. รันงานอัตโนมัติด้วยมือ

```bash
gh workflow run morning-plan.yml -R tanakrthum254614-max/gold-signal -f send=false -f record=false   # ทดสอบเฉย ๆ
gh workflow run morning-plan.yml -R tanakrthum254614-max/gold-signal -f send=true  -f record=true    # ของจริง (ส่ง LINE + บันทึก)
gh workflow run price-alerts.yml -R tanakrthum254614-max/gold-signal -f send=false
```

## 6. Deploy
- `git push` ไป `main` → Vercel build เองภายใน ~1 นาที
- เปลี่ยนไฟล์เว็บเมื่อไร **อัปเดตเลข `?v=` ใน index.html** (และ "เวอร์ชัน" ในหน้าบัญชี) กัน cache เก่า:
  `V=$(date +%Y%m%d%H%M) && sed -i -E "s/\?v=[0-9]+/?v=$V/g; s/เวอร์ชัน [0-9]+/เวอร์ชัน $V/" index.html`
- ก่อน push ให้ `git pull --rebase` เสมอ — GitHub Actions commit `signals.json` / `intraday.json` ตลอด

---

## 7. บทเรียน / กับดักที่เคยเจอ

- **คลาส CSS ชนกัน**: style.css มี `.gauge`, `.top` (padding 18px — ทำให้ช่องแถบสูงผิด), `.tag.s1/.s0/.s-1` อยู่แล้ว · เพิ่มคลาสใหม่ให้ grep ก่อนเสมอ (การ์ดแนวโน้มใช้ `.sm*` / `.smf*`)
- **headless Chrome โดน investing.com บล็อก** (ตกไปแหล่งสำรอง) → ใส่ `--user-agent="Mozilla/5.0 ... Chrome/141..."` และ `--window-size` กว้าง ≥500 (headless ใหม่บังคับขั้นต่ำ ~500px)
- **ห้ามตั้งชื่อไฟล์ราก `app.js` / `server.js` / `index.js`** — Vercel จะคิดว่าเป็น Node server แล้วเว็บพัง (500)
- **Vercel Hobby บล็อก deploy ถ้า commit author ไม่ใช่บัญชีที่เชื่อมไว้** → workflow commit ด้วยตัวตน `tanakrthum254614-max` (noreply email) ห้ามใช้ github-actions[bot]
- **Vercel MCP connector ไม่มีสิทธิ์ scope thander1** → ใช้ Vercel CLI
- **Line endings**: repo ตั้ง `core.autocrlf false` ไว้แล้ว ถ้าไฟล์กลายเป็น CRLF สคริปต์แก้ไฟล์แบบหลายบรรทัดจะหาข้อความไม่เจอ
- **`String.replace(a, b)` ใน Node: `$$` ใน b จะกลายเป็น `$` ตัวเดียว** (และ `$&`, `$'` มีความหมายพิเศษ) — นี่คือต้นเหตุที่ `$` หายจากข้อความไทยหลายครั้ง · แทรกโค้ดด้วย `slice()` ต่อ string หรือ `replace(a, () => b)` แทน
- **วันจันทร์ `backtest.json` มักชนกัน** (งานเช้าสร้างใหม่) → แก้ด้วยการรัน `node scripts/backtest*.js 365` ใหม่แล้ว `git add`
- **แก้โค้ดผ่าน node/heredoc ระวัง `$` และ `\n`** ใน template string หายหรือกลายเป็นขึ้นบรรทัดจริง — ตรวจ `grep '~\${\|(+\${'` หลังแก้
- **โควตา LINE ฟรี 300 ข้อความ/เดือน นับต่อคน** — อัปเดตทุก 30 นาที (07:00–03:00) ≈ 40/วัน + เหตุการณ์ไม้ ≈ **900+/คน/เดือน** → แพ็กเกจฟรีหมดภายในประมาณ 1 สัปดาห์ ต้องอัปเกรด LINE OA
  (ถ้าส่งไม่ได้ สคริปต์จะ log `⚠️ LINE send failed` แล้วบันทึกผลต่อ ไม่ล้ม)
- **ความซื่อตรงของสถิติ**: ห้ามลบไม้ที่มีผลแล้ว ลบได้เฉพาะไม้ที่ยังไม่เข้า/ไม่มีผล และต้องบอกผู้ใช้ · แสดงผล backtest ตามจริงเสมอ (รวมที่ขาดทุน)
- ทุกครั้งที่เปลี่ยนกติกา **ทดสอบย้อนหลัง 2 ช่วงปีก่อน** — หลายสูตรได้กำไรปีแรกแต่ขาดทุนปีหลัง

## 8. ผลทดสอบย้อนหลังล่าสุด (ณ 5 ต.ค. 2569, ยังไม่หักสเปรด)

| ระบบ | 1 ปี | 2 ปี |
|---|---|---|
| รายวัน 07:05 (ทุกวัน, 3 TP, ปิด 02:45) | 260 ไม้ · ชนะ 49% · +$72/ออนซ์ | +$479 (ก่อนปรับเวลา) |
| 30 นาที (±5, 3 TP, เฉพาะ 07:00–03:00) | 876 ไม้ (~3.4/วัน) · ชนะ 51% · +$590 (≈ +$239 หลังหักสเปรด $0.4) | +$1,514 (ก่อนปรับเวลา) |

## 9. ประวัติการเปลี่ยนกติกา (สั้น ๆ)
1. Pivot + limit order (รอราคา) → backtest ขาดทุน −$1,404/ปี → เลิกใช้
2. เข้าทันทีตามเทรนด์ SL/TP ตาม ATR → −$71/ปี
3. เฉพาะ 5 ดาว, TP/SL $15 → +$15/ปี
4. 3 TP ($15/$20/$30) + เลื่อน SL ไปทุน → +$72/ปี
5. สัญญาณทุกวัน (ไม่จำกัด 5 ดาว) → +$70/ปี (ปัจจุบัน)
6. เพิ่มระบบ 30 นาที (±5) → +$603/ปี (ปัจจุบัน)
7. (5 ต.ค. 2569) เปลี่ยนเป็นธีมสว่าง (theme.css) + หน้าโหลดค้างอย่างน้อย 4 วินาที (auth.js MIN_MS) วงแหวนเติมช้าลง
16. (6 ต.ค. 2569) เวลาตลาดเลื่อนตามเวลาออมแสงสหรัฐ (08:00–04:00 ช่วงหน้าหนาว) + งานเช้า 2 รอบผ่าน market-gate
15. (6 ต.ค. 2569) การ์ด 3 กรอบเวลาเปลี่ยนจากเส้นราคาเป็นแท่งเทียน
14. (6 ต.ค. 2569) โลโก้ใหม่ ทองคำ + สายฟ้า (logo.svg, favicon) + หน้าโหลดแบบฟ้าผ่า
13. (5 ต.ค. 2569) เกจเข็ม → แถบความแรง −6…+6 + การ์ด 3 กรอบเวลา + นับถอยหลัง · แก้ "ตลาดปิด" ทั้งที่ตลาดเปิด
12. (5 ต.ค. 2569) ราคาสดจากสตรีม investing.com (~1 วินาที) + ลดการยิง REST
11. (5 ต.ค. 2569) เพิ่มสัญญาณ 15 นาทีบนเว็บ (ไม่ส่ง LINE) + ลูกศรบนกราฟ
10. (5 ต.ค. 2569) สัญญาณรายวันเป็นข้อมูลประกอบ (advisory) + เช็กโควตา LINE ทุกเช้า
9. (5 ต.ค. 2569) LINE ส่งเฉพาะตอน ✅ เปลี่ยน + รวมข้อความต่อรอบ + เบรกฉุกเฉิน
8. (5 ต.ค. 2569) ปรับหน้าเว็บใหม่เป็นเรียลไทม์: หน้าโหลดอนิเมชั่น, ราคาสด 3 วิ, เกจคะแนนสด, โดนัท % แต่ละจุด — กติกาการเทรดไม่เปลี่ยน
