---
name: gold-signal
description: คู่มือโปรเจค Gold Signal — เว็บสัญญาณเทรดทองคำ XAU/USD (สมาชิกเท่านั้น) สัญญาณ Buy/Sell ทุกกรอบเวลา 5 นาที–1 สัปดาห์ (ระบบหลัก 30 นาที) กราฟเรียลไทม์ สถิติข่าวเศรษฐกิจสหรัฐ แจ้ง LINE เฉพาะสัญญาณเข้า + เตือนข่าว และหลังบ้านแอดมิน ใช้เมื่อจะแก้ไข ทดสอบ หรือ deploy โปรเจคนี้
---

# Gold Signal — สัญญาณเทรดทองคำ XAU/USD

## ขอบเขตงานเดิมและไฟล์งานใหม่

- ไฟล์นี้เป็นคู่มือ **งานเดิม: เว็บ Gold Signal** ที่ `D:\โปรเจคทันเดอร์\Traeding` รวมกราฟ สัญญาณ แจ้งเตือน และสถิติของระบบเดิม
- **งานใหม่: ผู้ช่วย Exness MT5** แยกไว้ที่ [Exness-MT5/Skill.md](../Exness-MT5/Skill.md) ใน `D:\โปรเจคทันเดอร์\Exness-MT5` ใช้ไฟล์นั้นเมื่อพัฒนางานใหม่
- สถิติในเว็บเดิมคือผลติดตามสัญญาณ/ผลจำลองตามแหล่งข้อมูลที่ระบุ ไม่ใช่หลักฐานว่าได้ส่งคำสั่งซื้อขายเงินจริงใน Exness
- ผู้ใช้ขอแยกคู่มือทั้งสองงานเมื่อ 6 ตุลาคม 2569; เก็บรายละเอียดเดิมไว้ทั้งหมด และบันทึกข้อกำหนด Exness เฉพาะคู่มืองานใหม่
- การแยกเอกสารครั้งนี้ไม่เปลี่ยนหน้าเว็บ กติกาสัญญาณ หรือเปิดระบบซื้อขาย

เว็บและระบบอัตโนมัติที่ให้สัญญาณ **ซื้อ/ขายทองคำ** พร้อม SL/TP ส่งเข้า LINE และ**บันทึกผลชนะ–แพ้จริงทุกไม้** (ไม่ตัดทิ้ง ไม่แก้ย้อนหลัง)

| อะไร | ที่ไหน |
|---|---|
| เว็บจริง | **https://gold-signal.gold-signal.workers.dev** (Cloudflare Worker ตั้งแต่ 20 ต.ค. 2569 — `worker.js` + `wrangler.toml`, deploy: `bash scripts/cf-build.sh && npx wrangler deploy`, รหัสลับ: `npx wrangler secret put`) · เดิม gold-signal-ten.vercel.app (Vercel thander1 โดนบล็อก) |
| ข้อมูลส่วนตัว | **Supabase** โปรเจค bormgxqwigwrezzzffmb (Singapore) ตาราง `kv` (path → body) แทน Vercel Blob — `lib/gs.mjs` / `middleware.js` blobGet/blobPut, สคริปต์ใช้ `scripts/blob.js` · env SUPABASE_URL / SUPABASE_SERVICE_KEY (Cloudflare secret + GitHub secret + .env.local) |
| โค้ด (Public) | https://github.com/tanakrthum254614-max/gold-signal — push `main` = deploy อัตโนมัติ |
| Vercel | scope `thander1`, project `gold-signal` = **เว็บจริง** (ใช้ CLI `npx vercel`, ล็อกอินเป็น tanakrthum2546-3404) · repo นี้ผูกกับโปรเจค `thander2/gold-signal` ด้วย (สถานะ "Vercel – gold-signal" บน GitHub มาจากตัวนั้น ไม่ใช่เว็บจริง — preview ของมันถูกล็อก เข้าทดสอบไม่ได้) · ทดสอบ preview ให้ใช้ `npx vercel ls gold-signal` → URL `-thander1` แล้ว `npx vercel curl <url>` |
| ล็อกอิน | **สมาชิกเท่านั้น** (8 ต.ค. 2569) — Clerk dev instance `delicate-tapir-2101` (สมัครด้วยอีเมล+รหัสผ่าน ยืนยันโค้ดทางอีเมล หรือ Google) บน `login.html` → ตรวจฝั่งเซิร์ฟเวอร์ใน `middleware.js` · `?demo=1` เลิกใช้แล้ว · ระบบรหัส GOLD-… ถูกลบแล้ว |
| LINE OA | `@279arudw` · เพิ่มเพื่อน https://line.me/R/ti/p/@279arudw |
| Secret | GitHub Actions secret `LINE_CHANNEL_ACCESS_TOKEN` (Channel access token *long-lived* จากแท็บ Messaging API) |

## 0. ทำงานเสร็จแล้วต้องทำต่อ (ทุกครั้ง)
0. ⏰ **ทุกงาน: ข้อความสุดท้ายต้องเตือนผู้ใช้ "ยังต้องซื้อโดเมน .com (goldsignalth.com)" หลังบันทึก Skill.md แล้ว — จนกว่าผู้ใช้บอกว่าซื้อแล้ว** (17 ต.ค. 2569)
1. ทดสอบในเครื่อง (ภาพหน้าจอมือถือ + คอม, ไม่มี error · เรื่องราคา/ความเร็ววัดด้วย puppeteer-core แบบเวลาจริง)
2. เปลี่ยนกติกาสัญญาณ → ทดสอบย้อนหลังก่อน รายงานผลตามจริง (รวมที่ขาดทุน)
3. **อัปเดต `compare.html`** — เพิ่มหัวข้อใหม่ไว้บนสุด: 🕰️ แบบเก่า vs ✨ แบบใหม่ (ภาพใน `compare/`; ภาพแบบเก่าถ่ายจากโค้ดก่อนแก้ด้วย `git worktree add <dir> <commit>` + `PORT=3001 node dev-server.js` แล้วปิด server ก่อนลบ worktree)
4. เปลี่ยนเลข `?v=` → commit → push → เช็กว่าเว็บจริงได้ไฟล์ใหม่ · แก้ workflow → สั่งรันทดสอบ (send=false)
5. อัปเดต Skill.md + สำเนา `.claude/skills/gold-signal/SKILL.md` + memory
5.1 **อัปเดต GitHub** (ผู้ใช้สั่ง 17 ต.ค. 2569: "หลังจากทำอะไรเสร็จทุกครั้งให้เพิ่มมีการอัปเดตใน git ไปด้วย หลังจากบันทึก Skill.md และต้องซื้อโดเมนด้วย") — ทำต่อจาก Skill.md ทันที: README.md ของ repo gold-signal (Key Features / ภาพ ให้ตรงของล่าสุด, ภาษาทางการ ไม่มีอีโมจิ) · เปลี่ยนภาพใน `docs/img/` ถ้าหน้าที่โชว์เปลี่ยน · คำอธิบาย repo ถ้าตัวผลิตภัณฑ์เปลี่ยน · push แล้วเปิดหน้า GitHub ดูว่าแสดงถูก
6. **อัปเดตพอร์ตโฟลิโอ** https://web-tan-portfolio.vercel.app/#activities (ผู้ใช้สั่ง 8 ต.ค. 2569) — repo `C:\Users\HP\tan-portfolio`: สไลด์ "Slide 4: Gold Signal" ใน `projects-modal` แก้ **ทั้ง index.html และ Portfolio.html** (ต้องเหมือนกัน) ให้คำอธิบาย/แท็ก/ข้อความในภาพตรงกับเว็บล่าสุด · เช็กในเครื่อง (รอ intro ~9 วิ แล้วเปิด modal + `projGoTo(3)`) → commit + push → เช็กว่าเว็บจริงมีข้อความใหม่ · ถ้างานไม่เปลี่ยนสิ่งที่ผู้ใช้เห็น (เช่นแก้บั๊กเล็ก) ไม่ต้องแก้สไลด์ แต่ต้องบอกว่าข้าม

---

## 1. ระบบสัญญาณตอนนี้ (ตรวจกับโค้ด 15 ต.ค. 2569)

> ข้อ 1–7 = สภาพปัจจุบันของโค้ด · ที่มาของแต่ละเรื่องอยู่ใน "บันทึกการเปลี่ยนแปลง" · รายละเอียดเดิมของข้อ 1 (5–8 ต.ค.) อยู่ใน [Skill-archive.md](Skill-archive.md) "🗄️ ข้อ 1 เดิม" — หลายส่วนในนั้นยกเลิกแล้ว อย่าใช้เป็นข้อมูลปัจจุบัน

- **🔴 17 ต.ค.: 1h มี Sell แล้ว (⚠️ risky, confirm bbrev)** · **↩️ ยกเลิกแล้วคืนเดียวกัน (4b052c7): จุดเข้ากลับมาทุกกรอบแบบ ⚠️ risky เหมือน 15 ต.ค.** — ผู้ใช้: "จุดที่ให้เข้าซื้อไปไหนหมดของทุกทามเฟรม" · "ที่เป็น Buy กับ Sell จุดบอกสัญญาณในการเข้าซื้อ" → ลบ `off:` ออกจาก SYS (กลไก `on`/`whyNo`/noEntry ยังอยู่ ไม่มีกรอบไหนใช้) · **อย่าปิดจุดเข้ากรอบไหนอีกถ้าผู้ใช้ไม่สั่งตรง ๆ** (ผู้ใช้อยากเห็นป้าย Buy/Sell ทุกกรอบ) · การ์ด 📒 ผลจริงยังอยู่ (3 ช่อง 1h/5h/1d + ท้ายการ์ดผลกรอบเสี่ยง) · ประวัติ: **🎯 จุดเข้าเหลือแค่ 1h / 5h / 1d BUY** — 5m BUY+SELL, 15m, 30m, 1w มี `off: '<เหตุผล>'` ใน SYS (คง risky ไว้แต่ไม่มีผล) · `CHARTSYS.on(c)` = ฝั่งที่ใช้ (dirOf/unconfirmed/stretched ข้าม off) · `sideInfo` คืน `off`, verdict "⏸ ปิดจุดเข้า — ดูทิศเท่านั้น" · `CHARTSYS.whyNo(c)` · `ENTRY_TFS` · chartzones: `noEntry` → หัวการ์ด "ใช้ดูกราฟอย่างเดียว … จุดเข้าอยู่ที่ 1 ชม. · 5 ชม. · 1 วัน" ไม่มีช่อง Buy/Sell/กล่องบนกราฟ ไม่โชว์เบรก · ฝั่งที่ไม่มีจุดเข้า (เช่น Sell 1h) ไม่โชว์ราคาเข้า/SL/TP แล้ว · chart-run.js ไม่บันทึกไม้กรอบ off (dirOf = 0) · **การ์ด 📒 ผลจริงทุกไม้** หน้าสัญญาณ (`#recCard`, main.js `renderRecord` ใน refreshSignals): 3 ช่อง (ทดสอบชนะ %, ความถี่จาก c.n, ผลจริง) + 10 ไม้ล่าสุดที่ปิด + ยอดเดิมของกรอบที่ปิด · CSS live.css `.rec` · ทดสอบ gold-signal-tools/entries.cjs

### ⭐ ระบบหลัก = CHARTSYS (สัญญาณบนกราฟรายกรอบ) — ตั้งแต่ 9 ต.ค. 2569 · หน้าสัญญาณ/LINE "ระบบหลัก" = `CHARTSYS.MAIN_TF` = **1h** (30m จนถึง 15 ต.ค.)
- **กติกาอยู่ที่ `chartsys.js` ที่เดียว** (UMD, **โหลดก่อน main.js**) ใช้ร่วมกันระหว่างเว็บ (`chartzones.js`, `main.js`, `chartchat.js`) และ `scripts/chart-run.js` · `SYS[tf]` มี `buy`/`sell` แยก `{ risky?, th, tp1, mult, confirm?, since?, win, q }` · ฝั่งที่ทดสอบไม่ผ่านไม่มี key (มีแค่ `sellQ` ไว้แสดง) · **`risky: '<เหตุผล>'` = สัญญาณเสี่ยง**: ยังมีจุดเข้าบนกราฟ + บันทึก (`risky: true` ในไม้) แต่ติด ⚠ ท้ายป้าย, คำตัดสิน "⚠️ มีสัญญาณ แต่เสี่ยง", `CHARTSYS.riskText(c)` บอกเหตุผล, **ไม่ส่ง LINE** (chart-run เช็ก `!risky` ด้วย) และไม่ใช่ระบบหลัก · `sideInfo` คืน `risky`
- คะแนน = โหวตตัวชี้วัด (`indicators.js`) ของหลายกรอบรวมกัน ผ่าน `INTRA.decideWith` · `CHARTSYS.dirOf` ตัดสินจุดเข้า (เกณฑ์ + ตัวยืนยัน + noChase + ข่าวเฉพาะกรอบที่ `news: true`) · `sideInfo` = % ความพร้อมเข้า + คำตัดสิน (✅ / ⏸ / ⚠️ / ⛔) ใช้ทุกหน้า · `levelsFor`/`usdList` = SL/TP (SL $15 × `mult`, `tp1: true` = TP1 อย่างเดียว ไม่งั้น TP $15/20/30 × mult — ค่าคงที่ใน usdList **ไม่ใช่ `INTRA.RULE.tpUsd`** ซึ่งเป็น [15]; บั๊ก 9–15 ต.ค. ทำให้ 1h/5h/5m SELL ได้ TP1 อย่างเดียว)
- **↩️ 19 ต.ค. 2569: แบบ A (ทุกฝั่ง risky = off) ใช้ได้ไม่กี่ชั่วโมง แล้วผู้ใช้สั่ง "เอาจุดเข้ามากลับมาทั้งหมด ทุกทามเฟรม" (67c0e99) → กลับเป็น ⚠️ risky เหมือนเดิม (ให้จุดเข้า + บันทึก, ไม่ส่ง LINE)** · **บทเรียน: ผู้ใช้ต้องการจุดเข้าทุกกรอบเสมอ (เคยปิด 16 ต.ค. และ 19 ต.ค. แล้วสั่งคืนทั้งสองครั้ง) — ห้ามเสนอปิดกรอบอีก** · ตารางสาธารณะยังเป็นระบบหลักเท่านั้น
- **จุดเข้าปกติ (15 ต.ค. 2569): 1h BUY · 5h BUY · 1d BUY** · เสี่ยง (risky): 5m BUY (ช่วงล่าสุดขาดทุน) · 5m SELL (ผลจริง 14 ไม้ ชนะ 4 vs ทดสอบ 53%) · 15m (กำไรน้อยมาก) · 30m (ขาดทุน) · 1w (ไม้น้อย ไม่สม่ำเสมอ)

| กรอบ | กรอบที่ใช้คิด | BUY | SELL | หลบข่าว ±30 นาที |
|---|---|---|---|---|
| 5m | 5m · 30m · 1h | ⚠️ เสี่ยง: +5 · SL $15 · **TP 5/10/15 · 📥 รอย่อ $5 ภายใน 1 ชม. (19 ต.ค., 84%)** | ⚠️ เสี่ยง: −6 + SMA20<50 · SL $10 · TP $10/13/20 | ✅ |
| 15m | FRAMES15 (15m · 1h · 5h) | ⚠️ เสี่ยง: +6 + EMA9>21 · TP1 · SL $22.5 | ⚠️ ใหม่ 19 ต.ค.: −4 · SL $15 · TP 3.75/15/30 · 📥 รอเด้ง $5 ภายใน 2 ชม. (87%) | — |
| 30m | FRAMES (30m · 1h · 5h) | ⚠️ เสี่ยง: +5 · SL $15 · **TP 3.75/15/30 · 📥 รอย่อ $5 ภายใน 3 ชม. (19 ต.ค., 87%)** | ⚠️ ใหม่ 19 ต.ค.: −3 · SL $15 · TP 3.75/15/30 · 📥 รอเด้ง $5 ภายใน 3 ชม. (87%) | — |
| **1h (หลัก, หน้าแรก)** | 1h · 4h · 5h | +5 · SL $30 · **TP 7.5/30/60 · 📥 รอย่อ $3 ภายใน 6 ชม. (19 ต.ค., ทดสอบ 80%)** | ⚠️ เสี่ยง: −4 + bbrev · SL $30 · TP 30/40/60 · 📥 รอเด้ง $6 ภายใน 6 ชม. (19 ต.ค., 76%) | ✅ |
| 5h (long, ถือ ≤ 5 วัน) | 5h · 1d | +3 + ROC12 · SL $60 · TP 60/80/120 | ไม่ผ่าน | — |
| 1d (long, ≤ 20 วัน) | 1d · 1w | +3 · TP1 · SL $120 | ไม่ผ่าน | — |
| 1w (long, ≤ 84 วัน) | 1w | ⚠️ เสี่ยง: +1 · TP1 · SL $300 | — | — |

- **📥 จุดเข้าแบบรอราคาย่อ (limit, 19 ต.ค. 2569)**: ฝั่งที่มี `dip`/`dipH` → `levelsFor` คืน `entry = ราคา − dip` (SL/TP วัดจาก entry) · `CS.trade` ตั้ง `status 'pending'`, `limit`, `priceAtSignal`, `fillBy = t + dipH` · `SIG.evaluate`: ได้เข้าเมื่อราคาผ่าน entry ไป $0.3 ก่อน fillBy (แท่งที่เข้าเช็กได้แค่ SL) · ไม่ถึง = `'expired'` (FINAL, ไม่นับผล) · ระหว่าง pending ไม่เปิดไม้ใหม่ในกรอบนั้น · หน้าเว็บ/LINE แสดง "📥 รอเข้าที่ X" · Sell ยังเข้าทันที (5m SELL ทดสอบแล้วแย่ลง)
- ตัวเลข win/q ใน SYS ถูกเขียนทับด้วย `test-stats.json` (`CHARTSYS.applyStats`, งาน monthly-research) — ตารางผลอยู่ข้อ 8 · กรอบ long ไม่สนตลาดปิด/ข่าว
- **เบรก** `CHARTSYS.brake` (คำนวณจาก chart-signals.json ไม่มี state): แพ้ติด 5 ไม้ → พักถึงเปิดตลาดจันทร์หน้า (long พัก 30 วัน) · 20 ไม้ล่าสุดชนะต่ำกว่าทดสอบเกิน 12 จุด → พักจนกว่าจะดีขึ้น · ระหว่างพักยังบันทึกไม้ (`paused: true`) แต่ไม่ส่ง LINE
- **ตัวบันทึก** `scripts/chart-run.js` (ทุกเช็ก 5 นาทีใน check-loop.sh): ตามไม้เปิดบนแท่ง 5m (กรอบสั้น) / 1h (5h, 1d) / 1d (1w) แล้วเปิดไม้ใหม่ครั้งละ 1 ไม้ต่อกรอบที่เปิดแท่งถัดไป · แท่ง investing.com m15/m30/h1/h5 จาก data.json + Binance PAXG m5/h4/d1/w1 เลื่อนด้วย **ค่ากลางส่วนต่าง 12 แท่ง m15 ที่เวลาตรงกัน** (log `PAXG → spot offset`) · เขียน `chart-signals.json` บน branch data
- **LINE** ส่งเฉพาะ "เข้าไม้" ของกรอบใน `CHART_NOTIFY` (ค่าเริ่ม **1h,5h,1d** — 5m SELL ไม่ส่ง LINE · หัวข้อ "⏱️ สัญญาณ 1 ชม. (ระบบหลัก)") · ไม้ของฝั่งเสี่ยงบันทึกแต่ไม่ส่ง LINE · ไม่ส่งผลปิดไม้/พัก-กลับมา (log อย่างเดียว) · web push ส่งข้อความเดียวกันอัตโนมัติ

### บนหน้าเว็บ
- **กราฟ** (`chartzones.js`): ป้าย Buy/Sell ที่แท่งตัดสินใจ, เส้นไม้ที่ปิดแล้ว (เข้า/TP ✓/SL ✗), กล่อง position ของไม้ที่ถืออยู่ หรือแผนฝั่งเดียว (`CZ_PLANS`) ทางขวาแท่งล่าสุด, ลูกศรเปลี่ยนทิศ (`fdir`), โซน swing + เส้นโค้ง NWE (ภาพประกอบเท่านั้น — ทดสอบแล้วขาดทุน), ช่อง Buy | Sell พร้อม % · ปุ่ม "มุมมองสะอาด" (`gs-clean`) · เลื่อนย้อนดูวันก่อนได้ (`loadOlder`, Binance) · ไม้ที่บันทึกจริงมาก่อนผล replay → ถือไม้ตรงกันทุกหน้า
- **แชทถามจุดเข้า** (`chartchat.js`) ในการ์ดสัญญาณหน้ากราฟ (`#ccSlot`): ตอบจากระบบ (ไม่ใช้ AI) กรอบ 5m/15m/30m/1h + โหมด 🤖 โค้ช AI (`api/coach.mjs`) · `window.GS_SIGNALS / GS_NEWS / GS_RECORD / GS_LIVE` ให้แดชบอร์ด zframes อ่าน
- **การ์ดขวาหน้ากราฟ** `#signalCard`: หัวตามระบบของกรอบนั้น (Buy / Sell / ถือ / รอก่อน) · investing.com = "ความเห็นภายนอก" · เครื่องคำนวณ lot `#calcCard` (`tradeplan.js`) ใต้กราฟ เติมด้วยปุ่ม 🧮
- **หน้าสัญญาณ** (`#tab-home`): ราคาสด `#liveHero` · การ์ดระบบหลัก 1h `#intraCard` (`homeDecide` = `decideWith(SYS[MAIN_TF].frames …)` บน `homeCandles()` = investing h1/h5 + Binance `state.h4` จาก chartzones refreshSlow, แท่ง h4 กำลังวิ่งขยับตามราคาสดใน patchIntraCandles · แถบคะแนน −6…+6 `#sm`, การ์ดย่อย 1 ชม./4 ชม./5 ชม., นับถอยหลังแท่ง 1 ชม., `#inDetail` เหตุผลรายตัวชี้วัด, ไม้ที่ถือ, `#inBeat` สถานะตัวบันทึกจาก GitHub API) · "ถ้าเข้าตอนนี้" โดนัท `#dnBuy/#dnSell` · ข่าวถัดไป `#inNews` · ภาพรวมรายวัน `#sigCard` (`#sgMain` เทียบกับระบบหลัก)
  - **ภาพรวมรายวัน (#sigCard) + การ์ด "ตลาดทองตอนนี้" ซ่อนแล้ว** (16 ต.ค., ผู้ใช้ส่งรูป "เอาอันนี้ออก"): class `home-off` (terminal.css display:none !important) บน h3.sec-title และ .home-cols — DOM ยังอยู่ main.js ยังเติมข้อมูล (ไม่ error) · LINE ภาพรวมเช้า 07:05 ไม่เปลี่ยน · จะเอากลับ = ลบ class home-off
  - **การ์ดข่าวแรงสหรัฐ + ไม้วันนี้ (.news-card: #inNews/#inToday) ซ่อนแล้ว** (16 ต.ค., รูป "เอาออก"): class home-off เหมือนกัน · การงดเปิดไม้ ±30 นาทีรอบข่าวยังทำงาน · หน้าสัญญาณจบที่ "ถ้าเข้าตอนนี้"
  - **ป้ายบนการ์ดระบบหลัก `#inFlags`** (16 ต.ค.): main.js `renderInFlags(now, trades)` เรียกท้าย renderIntra — "⏸ งดเข้า — ข่าว … HH:MM น. · ถึง HH:MM น." เฉพาะเมื่อมีข่าวแรงใน ±INTRA.RULE.newsMin นาที และ mainSys().news · "⏱️ ไม้วันนี้ N ไม้ · ปิดแล้ว k · ±$/ออนซ์" เฉพาะวันที่มีไม้ · ไม่มีอะไร = hidden · ไม้ที่ถืออยู่ = การ์ด #inTrade เดิม · ทดสอบ gold-signal-tools/inflags.cjs
- **ข่าวสหรัฐ** (`#tab-stats`, `newsstats.js`) แบบเว็บข่าว (15 ต.ค.): (1) **ข่าวล่าสุด** `#nfCard` = ข่าวจริงภาษาไทยมีรูปจาก `api/news.mjs` (RSS th.investing.com news_11 ทองคำ/โภคภัณฑ์ · news_14 เศรษฐกิจ · news_95 ตัวเลขเศรษฐกิจ, สมาชิกเท่านั้น, แคช 1 นาทีใน function + หน้าเว็บถามทุก 1 นาทีตอนเปิดแท็บ · ไม่มีรูป/รูปเสีย = ภาพปกตามหมวด (`.nf-img[data-cat]::before` 🪙/🏛️/📊 บนพื้นไล่สี), เวลาในฟีดเป็น UTC, id = `article-<key>` ทั้งก้อน) แถวบน 3 ข่าวขนาดเท่ากัน `.nf-hd` (รูป _L.jpg → fallback _M, **ไม่ทำข่าวเด่นใหญ่** — ผู้ใช้ว่าใหญ่ไป) + การ์ด 3 คอลัมน์ (มือถือ = ข่าวแรกรูปใหญ่ ที่เหลือรูปซ้ายหัวข้อขวา) ชิปหมวด, "x นาทีที่ผ่านมา", ลิงก์ไปอ่านที่ต้นทาง · (2) ปฏิทินข่าวแรง (`importance=high` — **ไม่ใช่ `importances`**) 60 วันย้อนหลัง + 8 วันหน้า: การ์ดข่าวถัดไป `.nc-hero` (ชื่อข่าว + นับถอยหลัง + "ทองมักขยับ ~$" + ผลกับทองจาก ABOUT) · ข่าวที่จะออกแบ่งวัน `.nc-day` ป้าย 🔥 ≥$15 / ⚡ ≥$8 / เบา (`impactOf` จากค่าเฉลี่ย 1 ชม. ของข่าวชื่อเดียวกัน) · ข่าวที่ออกแล้วเป็นการ์ด `.nc.past` (ทอง 1 ชม. + ✓ ไปตามตำรา) · ตารางสถิติพับใน `details.nc-stats` · กดอ่านคำอธิบายไทย, แถบ `#newsLive` นับถอยหลังทุกแท็บ · การ์ดบทความ `#artCard` · **ไม่มีหน้าสถิติไม้จริงแล้ว** (ลบ 9 ต.ค. — ระบบหลังบ้านยังบันทึกครบ)
  - **รูป/ลิงก์ข่าว 403** (17 ต.ค.): content-media.investing.com + หน้าบทความอยู่หลัง Cloudflare ซึ่งตอบ 403 บางเครื่อง (Node fetch, Chrome headless โดน; curl ผ่าน) → newsstats.js `pic()` ลำดับ wsrv.nl relay (_L 960 → _M 640) → ตรง investing → ลบรูป (เห็นรูปปกหมวด) · referrerpolicy no-referrer · `.nf-alt` "เปิดไม่ได้? หาข่าวนี้จากแหล่งอื่น ›" → news.google.com/search?q=หัวข่าว (click handler capture, window.open) · ลิงก์ rel noopener noreferrer
- **แดชบอร์ด** (`#tab-zframes`): iframe `/zframes/index.html?d=ndx&embed=1` (Nasdaq 100 / S&P 500 / ปันผล — **ชุดทองคำเอาออกจากเมนูแล้ว 15 ต.ค.** ตามที่ผู้ใช้สั่ง; zframes-refresh ยังสร้าง gold.json อยู่แต่ไม่มีหน้าใช้) ข้อมูลจาก branch data อัปเดต 06:00 ทุกวัน · **สมุดเทรด** (`#tab-journal`, `journal.js` → `api/journal.mjs`) · **บัญชี** (`#tab-account`): ตั้งค่าทุน/ความเสี่ยง/สเปรด (Clerk `unsafeMetadata.goldSettings` + localStorage), แจ้งเตือน/ติดตั้งแอป `#pwaCard`, โควตา LINE, ลิงก์หลังบ้าน (แอดมิน)
  - หัวหน้าแดชบอร์ด (16 ต.ค., ผู้ใช้ "แถบไหนไม่สำคัญเอาออก"): **ไม่มี** h1 ชื่อชุด / บรรทัด subtitle / แถบ data-note / h2 ของแต่ละโซนแล้ว — app.js render เริ่มที่ `<nav class="zn">` · ใต้แท็บเหลือ `.zsub` บรรทัดเล็ก (ว่าง = ซ่อน) · ชื่อชุดดูจากช่องเลือก #pick บนแถบบน
  - **สีดำ-ทองเหมือนทั้งเว็บ** (16 ต.ค.): ท้าย zframes/style.css override :root (--bg0 #0b0e11 · --card #161a1e · --line #2b3139 · --acc #f0b90b ฯลฯ ชุด terminal.css html.dark) + การ์ดมุม 8px · JS: สีม่วง #c4b5fd → #f0b90b (frames/frames2/frames3/live.js), เส้นดัชนีในกราฟเทียบ = เทา #848e9c · app.js `j()` แทน #c4b5fd ใน JSON แดชบอร์ด (zframes-refresh ยังเขียนสีม่วง) · สีชุดข้อมูลอื่น (ฟ้า/ม่วงอ่อนใน legend) คงไว้ · ทดสอบ gold-signal-tools/zgold.cjs (ทุกโซน 3 ชุด + ตรวจสีม่วงที่เหลือ) · หมายเหตุ: โปรเจค zframes ต้นฉบับ (D:\โปรเจคทันเดอร์\zframes) ยังม่วง
  - **ตามโหมดสว่าง/มืดของเว็บ** (16 ต.ค.): zframes/app.js ตั้ง `html.light` = หน้าแม่ไม่มี class dark + MutationObserver บน html ของหน้าแม่ (สลับที่แท็บบัญชีแล้วเปลี่ยนทันที) · style.css ท้ายไฟล์ `html.light …` ชุดสี theme.css (ครีม #faf8f3 / การ์ดขาว / ทอง #b9800c, ปุ่มเลือก #f0b429) · SVG ที่วาดด้วย stroke/fill="#fff" ใช้ CSS attribute selector แทนสีเข้ม · .ticker / .livebadge มีทั้ง 2 โหมด · ทดสอบ gold-signal-tools/zlight.cjs
  - **แท็บ "พอร์ตกูรู"** (16 ต.ค., แบบ Dime): `zframes/gurus.js` (`GURUS.inject(dash)` ที่ app.js เรียกก่อน connectLive → เพิ่มโซน id `gurus` ทุกชุด + เพิ่ม ticker ของกูรูเข้า dash.liveKeys ให้ Yahoo stream / /api/zframes/quotes) · frames `gurus` (การ์ด 28 คน มูลค่า = ราคาสด × จำนวนหุ้น อัปเดต 2 วิ, เรียง มูลค่า/อัปเดตล่าสุด/กำไรตั้งแต่สิ้นไตรมาส) · `guruFocus` (คนละ 3 รายการใหญ่สุด ซื้อใหม่/ซื้อเพิ่ม/ขายบางส่วน/ขายหมด, กรอง ซื้อ/ขาย) · `guruCrowd` (หุ้นที่ ≥3 คนถือ) · กดกูรู = modal 40 อันดับ + เคลื่อนไหวไตรมาส, กดหุ้นที่อยู่ในชุด = openStock · กูรูที่รายงานเก่ากว่า 200 วัน = "หยุดยื่นรายงาน" (เบอร์รี่) ไม่อยู่ใน Focus/Crowd
  - ข้อมูล: `scripts/gurus-13f.js <out> <cusipCache>` — SEC EDGAR submissions → 13F-HR 2 ฉบับล่าสุด → info table XML (decode &amp;) · หน่วย value: median ราคา/หุ้น < $3 = รายงานเป็นพันดอลลาร์ (Duquesne, Baupost) · CUSIP→ticker OpenFIGI (ID_CUSIP+US แล้ว ID_CINS+US สำหรับบริษัทนอกสหรัฐ) แคชใน zframes/dashboards/gurus-cusip.json · ไอน์ฮอร์นใช้ CIK 1489933 (DME Capital) · รันใน zframes-refresh.sh ทุกเช้า (เก็บเมื่อ ≥20 คน) → data branch · middleware DATA += gurus · ไฟล์ทั้งหมดสมาชิกเท่านั้น (401) · ทดสอบ gold-signal-tools/gurutest.cjs
  - **รูปกูรู** (16 ต.ค.): `WIKI` (cik → หน้า en.wikipedia) → page summary originalimage (ตัด ?utm_… ออกก่อน) → Commons imageinfo ต้องเป็นสัญญาอนุญาตเสรี (`FREE`: CC BY/BY-SA/CC0/Public domain) ไม่งั้นลอง Wikidata P18 → `g.photo = { url (thumb 160px), by, lic, page }` · ได้ 13/28 · gurus.js `avatar()` รูปทับตัวอักษรย่อ (รูปเสีย = ตัวอักษรย่อ) · เครดิตผู้ถ่าย+สัญญาอนุญาตในหน้าพอร์ต + บรรทัด .gu-credit ใต้การ์ด · ห้ามใช้รูปที่ไม่ใช่สัญญาอนุญาตเสรี
  - **ทุกคนมีภาพ** (16 ต.ค., ผู้ใช้: "เอาให้มีทุกคน … เว้นว่างไว้มันดูไม่น่าเชื่อถือ"): ลำดับ `FILE` (ไฟล์ Commons ที่ตรวจเอง — Terry Smith MNZM + `POS` ครอป/ซูมจากรูปหมู่) → หน้า Wikipedia/Wikidata → `commonsSearch` (ชื่อเต็มเรียงกันในชื่อไฟล์ + คำอธิบายต้องมี investor/hedge fund/fund manager/ชื่อกองทุน — กันคนชื่อซ้ำ) → โลโก้กองทุน `zframes/gurus-logos/<domain>.png|ico` (ตรวจด้วยตา 8 ไฟล์; บริการ favicon ไม่เสถียรจาก GitHub) → ป้ายชื่อกองทุน `MARK` (SCION, DUQUESNE, HIMALAYA, THIRD POINT, GREENLIGHT, GOTHAM) · ผล: รูป 14 · โลโก้ 8 · ป้ายชื่อ 6 · **ไม่ใช้รูปมีลิขสิทธิ์** · himcap.com = ไอคอน Webflow, thirdpoint.com = placeholder → ไม่ใช้ · แก้หน่วยพันดอลลาร์: ต้อง median < $3 **และ** รวม < $50M (Oaktree เคยเป็น $3.78 ล้านล้าน)
  - **⚡ ล่าสุดจาก SEC (สด)** (16 ต.ค., "ขอทุกอย่างแบบเรียลไทม์"): `.github/workflows/gurus-live.yml` ทุก 10 นาที → `scripts/gurus-live.sh` → `scripts/gurus-live.js` (submissions ของ 28 CIK, 45 วันล่าสุด): ฟอร์ม 4 (อ่าน XML: เฉพาะที่ rptOwnerCik = กูรู, รวมรายการ P/S, ราคาเฉลี่ย, ถือหลังทำรายการ = ค่ามากสุดของคลาสหลัก) · SCHEDULE 13D/13G (issuerName, % ของบริษัท, CUSIP→ticker จาก gurus-cusip.json) · 13F-HR ใหม่กว่า gurus.json → รัน gurus-13f.js ทันที · บันทึกลง data branch เฉพาะเมื่อเปลี่ยน · `zframes/dashboards/gurus-live.json` (middleware DATA) · gurus.js `guruLive` การ์ดบนสุดของแท็บ + ส่วนในหน้าพอร์ตแต่ละคน · อ่านใหม่ทุก 2 นาที, "x นาทีที่แล้ว" + ราคาสดเทียบราคาที่ซื้อทุก 30 วิ · gurus-13f.js export { GURUS, UA } (main รันเฉพาะ require.main)
  - **⭐ ติดตาม / 🔔 แจ้งเตือน / ARK รายวัน** (16 ต.ค.): middleware `/api/gurus/follow` (GET { ciks } · POST header x-follow base64 { ciks }) → Blob `access/guru-follows.json` { follows: { who: [cik] } } · gurus.js ☆/★ `data-follow` บนการ์ด+หน้าพอร์ต (localStorage gs-guru-follow สำรอง) ติดตามขึ้นก่อน · การ์ดล่าสุดมีชิป "⭐ เฉพาะที่ติดตาม" · `arkTrades()` ใน gurus-live.js: CSV 6 กองทุน (assets.ark-funds.com) snapshot ต่อกองทุนใน `zframes/dashboards/gurus-ark.json` (data branch) → วันที่ใหม่ = รายการ kind `ark` (≥0.5% เปลี่ยน, 6 ใหญ่สุดต่อฝั่ง) · รายการ f4/ark ใหม่ → `GURUS_NEW` → `scripts/gurus-notify.js` หลัง data_save สำเร็จ → push.js `opts.pick(sub, i)` (ติดตามใครไว้ = เฉพาะคนนั้น, ไม่ติดตาม = ทั้งหมด) · ข้อความขึ้นต้น 🔔 → คลิกเปิด /#zframes · gurus-live.yml มี npm install + BLOB/VAPID · ทดสอบ gold-signal-tools/gurufollow.cjs
- เมนู 6 แท็บ: สัญญาณ · ข่าวสหรัฐ · กราฟ · หุ้นสหรัฐ · สมุดเทรด · บัญชี — ไอคอนเส้น SVG (**ห้ามกลับไปใช้อีโมจิ**) · ≥900px เป็นเมนูซ้าย, มือถือเป็นแถบล่าง
- **มือถือย่อทั้งหน้า** (16 ต.ค.): head script ใน index.html (`<meta name="viewport" id="vp">`) — มือถือ (ด้านสั้นของ screen ≤600 + pointer coarse) ตั้ง viewport `width = ด้านกว้างจอ × S, initial-scale = 1/S` โดย **S = 1.75** (ทุกอย่างเหลือ ~57%; เดิม 1.5 → ผู้ใช้ "ขอเล็กลงกว่านี้อีกนิด") + class `vp-scaled` ที่ html · คำนวณใหม่เมื่อหมุนจอ · แนวนอน 844 → CSS กว้าง 1477 = ได้หน้าแบบคอม (เมนูซ้ายเต็ม) · **ผล: กฎ CSS มือถือแนวนอน (แถบไอคอนซ้าย/บล็อก ≤600) ไม่ match แล้วบนมือถือที่ย่อ** · zframes/app.js ไม่ใส่ `html.phone` ถ้าหน้าแม่มี `vp-scaled` · อยากเล็ก/ใหญ่ขึ้น = แก้ S (มากขึ้น = เล็กลง)
  - **พื้นที่กดบนมือถือที่ย่อ** (16 ต.ค.): terminal.css `html.vp-scaled` ปุ่ม .cc-mode/.cc-tfs/.cc-quick/.nf-chips/.jr-tools .btn/.tfs min-height 44px (≈25 px บนจอจริง) · zframes app.js ใส่ `html.site-scaled` เมื่อหน้าแม่ vp-scaled → .zn button/.rng/.top select min-height 44px · ตัวหนังสือไม่เปลี่ยน · ตรวจ `gold-signal-tools/phoneaudit.cjs` (5 รุ่น × 2 แนว × 6 แท็บ: ล้น/ตกขอบ/ตัวหนังสือเล็กสุด/ปุ่มเล็ก) + `smalltaps.cjs` (ปุ่มที่ < 22 px บนจอจริง) · ตัวหนังสือเล็กสุดบนจอจริง ~6–7 px (11px × 0.571)
  - **iPhone (ผู้ใช้ใช้ iPhone 13)** (16 ต.ค.): head script ไม่ใส่ viewport-fit=cover (Safari เว้นรอยบากเอง) + minimum-scale = initial-scale · ทิศจอจาก screen.orientation.type → window.orientation → innerWidth>innerHeight (iPhone ไม่สลับ screen.width/height, innerWidth = ความกว้างที่เราตั้ง) · fit ซ้ำ 150/600 ms หลังหมุน + screen.orientation change · apple-mobile-web-app-status-bar-style = black (ทึบ — ไม่มี cover แล้ว) · CSS `-webkit-text-size-adjust: 100%` ทั้งเว็บ+zframes · ช่องพิมพ์ 16px บน vp-scaled/site-scaled · ui.js หน้าหมุนจอ: iPhone ซ่อนปุ่มเต็มจอ + บอกวิธีปิดล็อกหมุนจอ · ทดสอบ `gold-signal-tools/iphone13.cjs` (UA iOS, 390x844 DPR3, หมุน แนวตั้ง→นอน→ตั้ง) — Chrome จำลอง ไม่ใช่ Safari จริง
- **ขนาดตัวหนังสือชุดเดียวทุกแท็บ** (16 ต.ค., "ปรับทุกส่วนให้สัมพันกัน"): ท้าย terminal.css — body 14px (≥1400: 15 · ≥1700: 16) < หัวการ์ด .card h3 15 (16 · 17) < หัวหน้าข่าว .nf-title/.st-title 18 (20 · 22) · .nf/.st-hero มุม 8px padding 14×16 เท่าการ์ดอื่น · `html.vp-scaled` คงชุด 14/15/18 (มือถือที่ย่อกว้าง 1477 ไม่โดนกฎจอกว้างของ live.css) · คำตัดสิน #sigCard .sig-side 28px เท่า #inCall · ตัวเลขใหญ่ (ราคาสด ฯลฯ) ไม่ได้แตะ · วัดด้วย `gold-signal-tools/bigtext.cjs <port> [w] [m]` + `consist.cjs`

### ระบบเก่าที่ยังรันอยู่
- **ภาพรวมรายวัน 07:05** (`signals.js`, `signals.json`): ทิศจากแนวโน้มสั้น+กลาง+ยาวของ investing.com (`explain.js`) · `RULE = { minTrend: 0, slUsd: 15, tpUsd: [15, 20, 30], advisory: true }` → เป็น "ข้อมูลประกอบ" ไม่บอกให้เข้า · อายุถึง 02:45 (หน้าหนาว 03:45) · `alerts.js` ตามผลแล้วบันทึกอย่างเดียว (advisory = ไม่ส่ง LINE; ข้อความเช้าส่งโดย morning-plan.js) · ทดสอบ 1 ปีหลังสเปรด −$217
- **ระบบ 30 นาทีแบบเก่า** (`intraday.js`, `intraday.json`): **ไม่เปิดไม้ใหม่แล้ว** — `intraday-run.js` เหลือตามไม้เก่าจนปิด + เตือนข่าวแรง ~30 นาทีล่วงหน้า (LINE) · `INTRA` ยังเป็นแกนของ CHARTSYS: `RULE = { threshold: 5, slUsd: 15, tpUsd: [15], maxHoldMs: 24 ชม., sides: 'buy', newsMin: 30, noChase: true, pause }`, `decideWith`, `FRAMES/FRAMES15`, `marketOpen/nextClose/nextWeek`, `newsNear`
- **สรุปรายสัปดาห์** `weekly.js` (เสาร์ 07:30 ไทย): คำนวณ/บันทึกทุกสัปดาห์ แต่**ส่ง LINE เฉพาะตอนกดรันเองพร้อม send=true**

### กติกาที่ใช้ทุกระบบ
- **เวลาตลาด (ไทย)**: หน้าร้อนสหรัฐ 07:00–03:00 · หน้าหนาว (อาทิตย์แรก พ.ย. – อาทิตย์ที่ 2 มี.ค.) 08:00–04:00 · โค้ดเขียนเวลาหน้าร้อนแล้วเลื่อนด้วย `SIG.marketShift(ms)` (จุดเดียว) · ข้อความ `SIG.mt(ms, "07:00")`
- **การนับผล** (`signals.js` → `evaluateTargets`): ปิด ⅓ ที่แต่ละ TP · ถึง TP1 แล้วเลื่อน SL ไปทุน · ชนะ = ถึง TP1 ก่อน SL · แท่งเดียวโดนทั้งคู่ = นับ SL ก่อน · ไม้เก่าที่มี `tp` เดียวใช้ `evaluate` แบบเดิม — อย่าลบ
- **สเปรด**: เซิร์ฟเวอร์ `vars.SPREAD_USD` (0.4) · เว็บใช้ค่าที่ผู้ใช้ตั้ง · **ขนาดไม้** 0.01 lot = 1 ออนซ์ → lot = ทุน × %เสี่ยง ÷ (SL × 100) ปัดลง
- **ข่าวแรงสหรัฐ**: `endpoints.investing.com/pd-instruments/v1/calendars/economic/events/occurrences?domain_id=1&country_ids=5&importance=high` (CORS เปิด) — งดเข้า ±30 นาทีเฉพาะกรอบ 5m / 1h (หน้าแรกด้วย เพราะระบบหลักคือ 1h)
- **LINE ทั้งระบบ = สัญญาณเข้า + เตือนข่าว + ภาพรวมเช้า** · รวมเป็นคำขอเดียวต่อรอบ (`OUTBOX` → `flush.js`) · โควตาฟรี 300/เดือน (ดูข้อ 7) · ส่งพลาด = log ไม่ล้ม
  - **ชนิดข้อความ + กันโควตา** (16 ต.ค.): scripts/notify.js `send(texts, { kind })` / `sendFlex(flex, { kind })` — `signal` (ค่าเริ่มต้น: chart-run, alerts) ส่ง LINE เสมอ · `extra` (morning-plan ภาพรวม, intraday-run เตือนข่าว, weekly) ส่ง LINE เฉพาะเมื่อ `lineRoom()`: โควตาเหลือ − เพื่อน ≥ เพื่อน × 15 (เพื่อน = /v2/bot/insight/followers เมื่อวาน; ไม่รู้ = ใช้ไม่เกิน 50%) ไม่งั้นแจ้งเตือนเว็บอย่างเดียว · `admin` (notify-failure, line-quota เตือน 80%) = web push เครื่องแอดมิน + LINE push ถึง LINE_OWNER_ID ถ้ามี — **ไม่ broadcast** · env LINE_EXTRAS=on|off บังคับได้ · OUTBOX เก็บ {text, kind} (string เก่า = signal) · ทดสอบ `node scripts/test-notify-kinds.js` (fake LINE API)

### แจ้งเตือนบนเครื่อง (PWA) + สมาชิก + หลังบ้าน
- PWA: `manifest.webmanifest`, `icons/`, `sw.js` (ไม่แคชข้อมูล, รับ push) · `pwa.js` ปุ่มติดตั้ง + เปิดแจ้งเตือน → เก็บใน Clerk `unsafeMetadata.push` (≤5 เครื่อง) · `scripts/push.js` ส่ง web push ทุกครั้งที่ส่ง LINE · VAPID ตั้งแล้ว (8 ต.ค., config.js มี vapidPublicKey)
- **สมาชิกเท่านั้น**: `login.html` (Clerk อีเมล/Google) → `POST /api/session` → คุกกี้ `gs_auth` 14 วัน · `middleware.js` ตรวจทุก request (ห้าม import แพ็กเกจ, ไม่รับ body) · ไม่ล็อกอิน: หน้า → 302 /login.html, ไฟล์อื่น 401 · ระงับสมาชิกได้ (`access/banned.json`) · `?demo=1` เลิกใช้แล้ว
  - **หน้า Demo** (16 ต.ค., ผู้ใช้อยากให้คนสแกน QR ดูก่อนสมัคร): `demo.html` อยู่ใน PUBLIC ของ middleware.js · ราคาสด + กราฟแท่งเทียนธรรมดา (lightweight-charts, investing.com → Binance PAXG สำรอง, โหลดใหม่ทุก 5 วิ, กรอบ 5m/15m/1h/5h/1d/1w) · **ไม่โหลดไฟล์ของสมาชิกเลย** (chartsys/chartzones/chartchat/main ฯลฯ ยัง 401 สำหรับคนไม่ล็อกอิน — ตรวจบนเว็บจริงแล้ว) · การ์ด 🔒 ฟีเจอร์สมาชิก (ข้อความเบลอเป็นตัวอย่าง ไม่ใช่ข้อมูลจริง) + ปุ่ม → /login.html#signup · login.html มีปุ่ม "👀 ทดลองดูก่อน (Demo)" เหนือกล่องล็อกอิน · ทดสอบ gold-signal-tools/demotest.cjs (ไม่มีคำขอไฟล์สมาชิก) + demolive.cjs
- **💲 ราคา (16 ต.ค. 2569 ดึก): 149 บาท/เดือน · 1,290 บาท/ปี** — ผู้ใช้: "ปรับราคาเป็น 149" + เลือกรายปี 1,290 · เปลี่ยนราคาที่หลังบ้าน ⭐ PRO → ใส่ราคา → **💲 บันทึกราคาใหม่** (api/golive.mjs action 'prices': สร้าง Price THB ใหม่ + archive ตัวเก่า + อัปเดต stripe-live.json; คนที่สมัครบัตรไว้แล้วจ่ายราคาเดิมต่อ) · lib/stripe.mjs prices() cache 1 นาที · ข้อความ pay/login/demo/terms เขียนราคาไว้ตรง ๆ ต้องแก้ด้วยถ้าเปลี่ยนอีก (pay.html ดึงราคาจริงจาก /api/pro ทับ) · **อย่ากด 🚀 ซ้ำเพื่อเปลี่ยนราคา** (🚀 ไม่เปลี่ยนราคาที่มีแล้ว และให้ PRO ฟรีสมาชิกใหม่) · ทดสอบ gold-signal-tools/pricetest.mjs + adminprice.cjs
- **💰 สมาชิกต้องจ่ายก่อน (16 ต.ค. 2569 ดึก)**: paywall เปิดอยู่ → middleware `paidOk(who)` (แอดมิน หรือ pro.json until > now) ไม่ผ่าน = หน้า (/, *.html) 302 → **/pay.html** · อย่างอื่น 402 `{pay:true}` · เปิดได้: `PAY_OPEN` = /pay.html, /api/pro, /api/pay/checkout|portal, /api/visit + /api/me, /api/logout, /api/paid (อ่าน pro.json สด) · checkout success → /pay.html?pay=ok (poll /api/paid ทุก 2 วิ แล้วเข้า /) · cancel → ?pay=cancel · **ไม่มีแบบฟรีแล้ว** (ล็อกฟีเจอร์ฟรี/PRO เดิมยังอยู่ในโค้ดแต่ไม่มีผลเพราะคนไม่จ่ายเข้าไม่ได้) · login/demo/terms เปลี่ยนคำว่า "ฟรี" เป็นราคา · ทดสอบ gold-signal-tools/paidtest.mjs (middleware) + paypage.cjs (หน้า) · **ADMIN_EMAILS = tanakrthum2546@gmail.com, tanakrthum254614@gmail.com** (ผู้ใช้ขอ 2 คน)
- **⭐ PRO / Stripe — 🟢 เปิดเก็บเงินจริงแล้ว 16 ต.ค. 2569 22:30** (Blob access/pro-config.json enabled:true · access/stripe-live.json = product prod_VS7KvGWa67Ao2q + ราคา THB 199/1,990 + webhook we_1URD5w1Rf1sT8NWCPjuzNwql → `${SITE_URL}/api/pay/webhook` (**ย้ายโดเมนต้องแก้ URL webhook ใน Stripe ด้วย**) · env STRIPE_LIVE_SECRET_KEY = rk_live_ แบบ "Full access—except sensitive operations" ใส่ผ่านหน้าเว็บ Vercel (คำสั่ง `!` ใส่ค่าไม่ได้ เพราะไม่ interactive) · ผู้ใช้ 2 คนที่เหลือคือแอดมิน · สมาชิกเดิม 1 คนได้ PRO ฟรีถึง ~15 พ.ย. · บัญชี Stripe ยังไม่ผูกบัญชีธนาคาร (⚠️ เงินค้างใน Stripe จนกว่าเพิ่มที่ Settings → Payouts) · PromptPay active · การ์ด #proCard: แอดมินเห็นแพ็กเกจเป็น **ตัวอย่าง (ปุ่ม disabled)** · ตรวจ Blob: scratchpad blobpeek.mjs กับ env pull production) — ประวัติเดิม: revert 9ee2c92 (โค้ดจาก payments-shelved: lib/stripe.mjs, api/pro.mjs, api/pay/{checkout,portal,webhook}.mjs, api/golive.mjs, scripts/stripe-setup.mjs, grant-existing.mjs, หลังบ้านแท็บ ⭐ PRO + 🚀, การ์ด #proCard ใน journal.js) · **PRO_FEATURES ค่าเริ่มต้น `ai,dashboard,signals,alerts`** (lib/gs.mjs + middleware.js ต้องตรงกัน) · ราคา 199/เดือน 1,990/ปี · paywall เปิดเมื่อ env PRO_ENABLED=1 หรือ Blob `access/pro-config.json { enabled }` (ปุ่ม 🚀) — **17 ต.ค. ตรวจแล้ว: ไม่มี PRO_ENABLED, ไม่มี pro-config.json, pro.json 0 คน = ทุกคนใช้ฟรี** · เปิดแล้วสมาชิกฟรี: middleware 402 ที่ /zframes/*, /api/zframes/*, /api/candles, /api/gurus/follow (proWall หน้า "หุ้นสหรัฐ + พอร์ตกูรู สำหรับ PRO") · /chart-signals.json กรองเหลือ tf 1h · /api/alerts ตั้งได้ 1 (PRO 10, เกิน = 402) · โค้ช api/coach.mjs allowed(m,"ai") 402 · หน้าเว็บ `pro.js` (โหลดหลัง config.js) GET /api/pro → `gsLocked(feature, tf)` (signals ล็อกเมื่อ tf ≠ 1h) · chartzones.js renderChartZones: ล็อก = ลบ markers/zones/decor + CZ_OPEN/CZ_PLANS = null + `#tab-chart.tf-locked` (ซ่อน .cz-box แสดง .tf-lock) · chartchat.js ask(): ล็อกกรอบอื่น + all/bestbuy/bestsell · `terms.html` สาธารณะ (PUBLIC): แพ็กเกจ/ราคา/เงื่อนไข/ยกเลิก/คืนเงิน 7 วัน/ติดต่อ — Stripe ใช้ตรวจ · ทดสอบ gold-signal-tools/protest.mjs (middleware ทุกกรณี) + prouitest.cjs (หน้าเว็บ off/on) · **ที่ผู้ใช้ต้องทำก่อนกด 🚀**: Stripe "Thander" (TH) → Verify your business (บัตรประชาชน + บัญชีธนาคาร + เว็บ gold-signal-ten.vercel.app/terms.html) → เปิด PromptPay ใน Payment methods → สร้าง restricted live key → `npx vercel env add STRIPE_LIVE_SECRET_KEY production --sensitive` → หลังบ้าน ⭐ PRO → เช็กลิสต์ ✅ ครบ → 🚀
- **หลังบ้าน** `/admin.html` (อีเมลใน env `ADMIN_EMAILS`): สมาชิก, บันทึกการเข้าใช้ (`access/log.json`), ระงับ/คืนสิทธิ์, เขียนบทความ · `new-members.yml` ทุก 15 นาที: `new-members.js` (แจ้งสมาชิกใหม่) + `watchdog.js` (ตัวบันทึกหยุด/ค้าง/ล้ม) → web push เฉพาะเครื่องแอดมิน (+ LINE push เจ้าของถ้ามี `LINE_OWNER_ID`) — **ห้าม broadcast**
- **Vercel Functions** `api/*.mjs` (journal, articles, coach, news) + `lib/gs.mjs` (ก๊อปจาก middleware — **แก้ต้องแก้ทั้งสองที่**) · ข้อมูลใน Vercel Blob · ระบบชำระเงินเก็บไว้ที่ branch `payments-shelved` (ทุกอย่างฟรีตอนนี้)

---

## 2. โครงสร้างไฟล์

```
หน้าเว็บ
index.html      แอปหลัก (6 แท็บ) — asset ทุกตัวมี ?v=<เวอร์ชันของไฟล์นั้น> · "เวอร์ชัน N" ในหน้าบัญชี
login.html      เข้าสู่ระบบ / สมัคร (Clerk clerk-js@6 + @clerk/ui@1; ราคาสด + ผลทดสอบ/ผลจริง + ขอบทองแสงวิ่ง) · privacy.html (สาธารณะ) · admin.html (หลังบ้าน)
CSS (ลำดับโหลด)  style.css (โครงเดิม) → live.css (ราคาสด, แถบคะแนน, กล่อง position, จอกว้าง/เมนูซ้าย) → theme.css (#themeLight ธีมสว่าง)
                → design.css (ระยะ/อนิเมชั่น ทั้ง 2 ธีม) → terminal.css (ธีมมืดแบบจอเทรด — ทุกกฎขึ้นต้น html.dark) → splash.css (หน้าโหลด)
                ค่าเริ่มต้น = **โหมดมืด** (head script ใน index.html + ui.js theme(); สว่างเมื่อ localStorage gs-theme = 'light')
config.js       Clerk publishable key + vapidPublicKey + ลิงก์ LINE (สาธารณะ) — ตั้ง clerkPublishableKey '' = รันในเครื่องโดยไม่ล็อกอิน
auth.js         หน้าโหลด SPLASH (โลโก้ฟ้าผ่า + แผงกระจก + วงแหวน % + ชิป; MIN_MS 4000 — ผู้ใช้ขอเร็วขึ้น 15 ต.ค.) + ใครล็อกอินอยู่ (/api/me) + visit log · splashfx.js แท่งเทียนบนหน้าโหลด
ui.js           แท็บ (hash routing), ธีม, หน้าบัญชี, แชร์
main.js         ดึงข้อมูล investing.com จากเบราว์เซอร์, สตรีมราคา, กราฟ, หน้าสัญญาณ, โหลด JSON ที่บันทึก (getJson → middleware → branch data)
chartsys.js     กติกาสัญญาณบนกราฟ (ใช้ทั้งเว็บและ Node) + MAIN_TF — โหลดก่อน main.js และ chartzones.js
chartzones.js   วาดสัญญาณ/โซน/กล่อง position บนกราฟ · chartchat.js แชทถามจุดเข้า + โค้ช AI · tradeplan.js เครื่องคำนวณ lot
newsstats.js    แท็บข่าวสหรัฐ + แถบข่าวสด · journal.js สมุดเทรด · motion.js อนิเมชั่น (reduced-motion = ไม่ทำเลย · ธีมมืดไม่มีประกาย/การ์ดเอียง)
indicators.js   ตัวชี้วัด + เครื่องโหวต · intraday.js INTRA (decideWith, เวลาตลาด, ระบบ 30 นาทีเก่า) · signals.js SIG (ภาพรวมรายวัน, evaluateTargets, summary, marketShift)
investing.js / explain.js / dailyplan.js   แปลผล investing.com · แนวโน้ม 3 ช่วง · Pivot (PLAN.levelsFromDaily)
pwa.js · sw.js · manifest.webmanifest · icons/ · logo.svg
middleware.js   ตรวจสมาชิก, /api/session|me|logout|push|visit|admin/*, เสิร์ฟ JSON + แดชบอร์ดจาก branch data (raw.githubusercontent.com)
api/            journal.mjs · articles.mjs · coach.mjs · news.mjs (Vercel Functions) · lib/gs.mjs (cookie/Blob ร่วม)
zframes/        หน้าแดชบอร์ด (สำเนาเว็บของ /zframes) · zframes-build/ ตัวสร้างแดชบอร์ดที่ GitHub ใช้
research/indicators/  งานวิจัย + monthly-research (indlab.js, monthly.js, verify.js, fetch_news.py)
compare.html + compare/   ภาพเทียบแบบเก่า/ใหม่ทุกงาน

ข้อมูล (อยู่บน branch data — สำเนาบน main หยุดอัปเดตตั้งแต่ 12 ต.ค. ใช้เป็น fallback เท่านั้น)
chart-signals.json   ไม้ของระบบหลัก (chart-run.js) · signals.json ภาพรวมรายวัน · intraday.json ระบบ 30 นาทีเก่า
quota.json           โควตา LINE · backtest.json / backtest-30m.json / backtest-15m.json (สร้างใหม่ทุกจันทร์)
zframes/dashboards/*.json   แดชบอร์ด (06:00 ทุกวัน)
test-stats.json      (อยู่บน main) ผลทดสอบของกติกาปัจจุบัน — monthly-research เขียนเดือนละครั้ง

scripts/
  fetch_data.py      ดึง investing.com ด้วย curl_cffi (ปลอม Chrome) · --m15-only = แท่ง 15m/30m/1h/5h
  check-loop.sh      วนทุก 5 นาที ~28 นาที/รอบ: fetch → alerts.js → intraday-run.js → chart-run.js → flush.js
  chart-run.js       ⭐ บันทึก/ตามไม้ระบบหลักทุกกรอบ + LINE เข้าไม้ (CHART_NOTIFY)
  alerts.js          ตามภาพรวมรายวัน · intraday-run.js ตามไม้ 30 นาทีเก่า + เตือนข่าว
  morning-plan.js    ข้อความเช้า (ภาพรวมวันนี้ + ข่าววันนี้) · market-gate.js ปล่อยรอบที่ตลาดเปิด · line-quota.js
  weekly.js          สรุปเสาร์ · notify.js / line.js / push.js / flush.js / trade-events.js ส่งข้อความ
  data-branch.sh     data_load / data_save (worktree → rebase → push HEAD:data, retry 3)
  new-members.js · watchdog.js · admin-notify.js · notify-failure.js · setup-push.js
  backtest.js / backtest-30m.js   ทดสอบย้อนหลัง (Binance PAXG ผ่าน data-api.binance.vision) · zframes-refresh.sh
.github/workflows/
  price-alerts.yml   cron */15 จ.–ศ. (UTC) → check-loop.sh
  morning-plan.yml   cron 00:05 + 01:05 UTC จ.–ศ. → market-gate.js (07:05 / 08:05 หน้าหนาว) · จันทร์สร้าง backtest ใหม่ · ส่ง LINE ภาพรวมเช้า (เปิดอีกครั้ง 19 ต.ค.; MORNING_LINE=off เพื่อปิด)
  weekly-summary.yml เสาร์ 00:30 UTC · new-members.yml ทุก 15 นาที (สมาชิกใหม่ + watchdog)
  monthly-research.yml วันที่ 2 ตี 3 ไทย · zframes-refresh.yml 23:00 UTC ทุกวัน
dev-server.js   เซิร์ฟเวอร์ทดสอบในเครื่อง (npm start → http://localhost:3000, PORT ได้) — ไม่รัน middleware/api
vercel.json     static (framework null, build/install ว่าง) + no-cache หน้าเว็บ/JSON/sw.js · git.deploymentEnabled.data = false
```

- สคริปต์ทดสอบหน้าเว็บ (puppeteer) อยู่นอก repo ที่ `C:\Users\HP\gold-signal-tools\*.cjs` (เช่น shots.cjs, nav.cjs, splash3.cjs, apitest.mjs)

---

## 3. แหล่งข้อมูล (สำคัญ)

- **investing.com API**: `https://api.investing.com/api/financialdata` คู่ XAU/USD = **pair 68**
  - กราฟ: `/68/historical/chart/?interval=PT1M|PT15M|PT30M|PT1H|PT5H|P1D&pointscount=160` (สูงสุด **160** แท่ง — ย้อนหลังกว่านั้นใช้ Binance)
  - วิเคราะห์: `/technical/analysis/68/{5m,15m,30m,1h,5h,1d,1w,1mo}`
  - ต้องส่ง header **`domain-id: th`** — API ตอบ CORS ให้ทุก origin → **เบราว์เซอร์ดึงได้โดยตรง**
  - **จากเซิร์ฟเวอร์ (Node fetch / Vercel) โดน Cloudflare บล็อก 403** เพราะ TLS fingerprint → ห้ามทำ proxy · บน GitHub Actions ใช้ Python **curl_cffi `impersonate="chrome"`**
- **ราคาสด**: SockJS stream ของ investing.com `wss://streaming.forexpros.com/echo/<n>/<id>/websocket` → `bulk-subscribe` `pid-68:` (~1 tick/วิ, main.js `startStream`/`onStreamTick`) ไม่ผ่าน Cloudflare · REST PT1M เหลือทุก ~21 วิ (ทุก 3 วิตอนสตรีมหลุด) — ยิงถี่เกินเคยโดนบล็อก IP
- **Binance PAXG/USDT** (`data-api.binance.vision`; `api.binance.com` ตอบ 451 กับเครื่อง GitHub): แท่ง 5m/4h/1d/1w ของระบบหลัก, ย้อนกราฟ, ทองหลังข่าว, backtest · ราคา PAXG ต่างจาก spot ~$3–5 → **ต้องเลื่อนด้วยส่วนต่างจากแท่งเวลาตรงกันเสมอ** (บั๊ก 14 ต.ค.)
- Pivot รายวันของ investing.com เช้าวันจันทร์คำนวณจากแท่งสั้นของคืนวันอาทิตย์ → **อย่าใช้** (ใช้ `PLAN.levelsFromDaily`)

---

## 4. ทดสอบในเครื่อง

```bash
npm start                                   # http://localhost:3000 (ไม่มี middleware → ตั้ง clerkPublishableKey '' ชั่วคราว แล้ว "อย่าลืมคืนค่า" ก่อน commit)
git fetch origin data && git show origin/data:chart-signals.json > /tmp/cs.json   # ข้อมูลล่าสุดอยู่บน branch data ไม่ใช่ไฟล์บน main
node scripts/morning-plan.js data.json      # dry run (ไม่ส่ง ไม่บันทึก) — ต้องมี data.json จาก fetch_data.py
CHART_FILE=/tmp/cs.json node scripts/chart-run.js data.json                  # ระบบหลัก (ไม่ใส่ RECORD=true = ไม่บันทึก) · CHART_NOW=<ms> ย้อนเวลา
SIGNALS_FILE=/tmp/x.json RECORD=true node scripts/alerts.js data.json
INTRADAY_FILE=/tmp/y.json RECORD=true node scripts/intraday-run.js data.json
node scripts/backtest.js 365 && node scripts/backtest-30m.js 365
```
- ในเครื่องไม่มี Python → ทดสอบ fetch_data.py บน GitHub (`gh workflow run ... -f send=false`)
- ภาพหน้าจอ/วัดผล: puppeteer-core สคริปต์ใน `C:\Users\HP\gold-signal-tools` (Chrome `--virtual-time-budget` เร่งเวลา วัดความถี่ผิด) · middleware/api ทดสอบด้วย `gold-signal-tools/apitest.mjs` หรือ preview ของ thander1 (`npx vercel curl`)

---

## 5. รันงานอัตโนมัติด้วยมือ

```bash
gh workflow run morning-plan.yml -R tanakrthum254614-max/gold-signal -f send=false -f record=false   # ทดสอบเฉย ๆ
gh workflow run morning-plan.yml -R tanakrthum254614-max/gold-signal -f send=true  -f record=true    # ของจริง (ส่ง LINE + บันทึก)
gh workflow run price-alerts.yml -R tanakrthum254614-max/gold-signal -f send=false                   # เช็กครั้งเดียว (LOOP_MINUTES=0)
gh workflow run weekly-summary.yml -R tanakrthum254614-max/gold-signal -f send=true                  # สรุปเสาร์ส่ง LINE เฉพาะแบบนี้
```

---

## 6. Deploy
- `git push` ไป `main` → Vercel (thander1) build เองภายใน ~1 นาที · push ไป `data` ไม่ deploy
- เปลี่ยนไฟล์เว็บไหน **เปลี่ยน `?v=` ของไฟล์นั้นใน index.html** (เลขแยกรายไฟล์ ไม่ต้องเปลี่ยนทุกตัว) และ "เวอร์ชัน N" ในหน้าบัญชี เป็นเวลาปัจจุบัน `YYYYMMDDHHMM`
- ก่อน push `git pull --rebase` (monthly-research commit test-stats.json / รายงานขึ้น main เดือนละครั้ง) · ข้อมูลไม้ไม่ commit ขึ้น main แล้ว
- เช็กว่าเว็บจริงได้ไฟล์ใหม่: เว็บต้องล็อกอิน → ใช้ `npx vercel curl` หรือดูเลข `?v=` ผ่านเครื่องมือของ thander1 · Hobby จำกัด 100 deploy/วัน

---

## 7. บทเรียน / กับดักที่เคยเจอ

- **คลาส CSS ชนกัน**: style.css มี `.gauge`, `.top`, `.tag.s1/.s0/.s-1`, `.dn` อยู่แล้ว · เพิ่มคลาสใหม่ให้ grep ก่อนเสมอ · **กฎ `html.dark …` ใน terminal.css แรงกว่าคลาสสถานะใน style.css** (เคยทำกรอบสีการ์ดสัญญาณ/สีปุ่มหาย) · ใส่ `display` ให้ของที่มี `hidden` จะทำให้โผล่ → ใช้ `:not([hidden])`
- **headless Chrome โดน investing.com บล็อก** (ตกไปแหล่งสำรอง) → ใส่ user-agent Chrome จริง และ `--window-size` กว้าง ≥500
- **ห้ามตั้งชื่อไฟล์ราก `app.js` / `server.js` / `index.js`** — Vercel จะคิดว่าเป็น Node server แล้วเว็บพัง (500)
- **Vercel Hobby บล็อก deploy ถ้า commit author ไม่ใช่บัญชีที่เชื่อมไว้** → workflow commit ด้วยตัวตน `tanakrthum254614-max` (noreply email) ห้ามใช้ github-actions[bot]
- **Vercel MCP connector ไม่มีสิทธิ์ scope thander1** → ใช้ Vercel CLI · Git Bash แปลง `/api/...` เป็น path Windows → `MSYS_NO_PATHCONV=1`
- **middleware.js**: ไม่ได้รับ request body, Vercel ไม่ส่ง node_modules ไปด้วย (เคยล่ม ~8 นาที) → ห้าม import แพ็กเกจ · ทดสอบ preview thander1 ก่อน merge
- **Line endings**: repo ตั้ง `core.autocrlf false` ไว้แล้ว ถ้าไฟล์กลายเป็น CRLF สคริปต์แก้ไฟล์หลายบรรทัดจะหาข้อความไม่เจอ
- **`String.replace(a, b)` ใน Node: `$$` ใน b จะกลายเป็น `$` ตัวเดียว** (และ `$&`, `$'` มีความหมายพิเศษ) — ต้นเหตุที่ `$` หายจากข้อความไทยหลายครั้ง · ใช้ `slice()` ต่อ string หรือ `replace(a, () => b)` · แก้โค้ดผ่าน node/heredoc ระวัง `$` และ `\n` ใน template string
- **วันจันทร์ backtest.json มักชนกัน** (งานเช้าสร้างใหม่) → รัน `node scripts/backtest*.js 365` ใหม่แล้ว `git add`
- **โควตา LINE ฟรี 300 ข้อความ/เดือน (นับต่อผู้รับ)** · ของจริง 14 ต.ค. 2569: ใช้ 57/300 คาดสิ้นเดือน ~130 · `scripts/line-quota.js` เช็กทุกเช้า → `quota.json` (branch data, มี `projected`) แสดงในหน้าบัญชี · ผู้รับเพิ่ม = ใช้เพิ่มตามจำนวนคน · เตือน broadcast ครั้งเดียวเมื่อเกิน 80%
- **ส่วนต่าง PAXG ↔ spot**: อย่าใช้แท่งล่าสุดของสองแหล่งลบกัน (investing.com ช้ากว่า 1–2 แท่ง) → ใช้แท่งที่เวลาตรงกันเท่านั้น
- **ความซื่อตรงของสถิติ**: ห้ามลบไม้ที่มีผลแล้ว ลบได้เฉพาะไม้ที่ยังไม่เข้า/ไม่มีผล และต้องบอกผู้ใช้ · แก้ผลย้อนหลังได้เฉพาะเมื่อพิสูจน์ว่าตัวบันทึกผิด และเก็บของเดิมใน `was` · แสดงผล backtest ตามจริงเสมอ (รวมที่ขาดทุน)
- ทุกครั้งที่เปลี่ยนกติกา **ทดสอบย้อนหลัง 2 ปี แบ่ง 4 ช่วง** (เลือกจากช่วง 1–3 แล้วดูช่วง 4) — หลายสูตรได้กำไรช่วงแรกแต่ขาดทุนช่วงหลัง
- **งานดีไซน์**: ถามทิศทางพร้อมตัวอย่างก่อน และต้องต่างจนเห็นในภาพเทียบ · ห้ามทำหน้า "เรียบง่าย" เองโดยไม่ถาม · อย่าเปลี่ยน MIN_MS (4000) / สีแดชบอร์ด ถ้าไม่ได้ขอ · **หน้าโหลด = แบบโลโก้ฟ้าผ่าเดิมเท่านั้น** (แบบกราฟเส้นไม่มีกรอบ 15 ต.ค. ผู้ใช้ไม่เอา) ปรับได้แค่ความเร็ว

---

## 8. ผลทดสอบย้อนหลัง + ผลจริง (อัปเดต 14 ต.ค. 2569 · **หักสเปรด $0.4 แล้วทุกตัวเลข** · $/ออนซ์)

**ระบบหลัก (CHARTSYS, สัญญาณบนกราฟ)** — จาก `test-stats.json` (ทดสอบ 9 ต.ค. 2569: 2 ปี, กรอบ 1 วัน = 5 ปี, แบ่ง 4 ช่วง เก่า → ใหม่) = ตัวเลข "ทดสอบ" ที่เว็บแสดง

| กรอบ | ฝั่ง | ไม้ | ชนะ | รวม | 4 ช่วง (เก่า → ใหม่) |
|---|---|---|---|---|---|
| 5 นาที | BUY | 1,122 | 54% | +554 | 331 / 551 / 104 / **−433** |
| 5 นาที | SELL | 615 | 53% | +451 | 39 / 84 / 156 / 172 |
| 15 นาที | BUY | 230 | 56% | +465 | 261 / 72 / 84 / 48 |
| 30 นาที (หลัก/LINE) | BUY | 705 | 57% | +957 | 264 / 462 / 239 / **−7** |
| 1 ชม. | BUY | 258 | 57% | +792 | 192 / 209 / 359 / 32 |
| 5 ชม. | BUY | 93 | 65% | +1,834 | 483 / 511 / 635 / 205 |
| 1 วัน | BUY | 94 | 64% | +2,555 | 128 / 218 / 1,243 / 966 |
| 1 สัปดาห์ | BUY | 23 | 70% | +2,396 | 196 / 737 / 1,167 / 296 |

- ⚠️ ช่วงล่าสุด 5m BUY ขาดทุน −433 และ 30m BUY −7 · กรอบใหญ่ (5h/1d/1w) ได้กำไรมาจากทองขาขึ้นยาว — ไม้น้อย ไม่ได้พิสูจน์ว่าใช้ได้ทุกสภาพตลาด

**ผลจริงที่บันทึก (`chart-signals.json` branch data, เริ่ม 7 ต.ค. 2569, ถึง 14 ต.ค.)** — 32 ไม้ที่ปิดแล้ว **ขาดทุนทุกกรอบ** (ตรวจกับไฟล์จริง 15 ต.ค.)

| กรอบ (หลังแก้ย้อนหลัง 14 ต.ค.) | ไม้ | ชนะ | รวมก่อนสเปรด |
|---|---|---|---|
| 5m (BUY+SELL) | 24 | 9 | −61 |
| 30m BUY | 6 | 2 | −15 |
| 1h BUY | 2 | 1 | −24 |
| **รวม** | **32** | **12 (38%)** | **−99.8** (≈ −113 หลังสเปรด) |

- ตารางเดิมก่อนแก้ (เพี้ยนเพราะบั๊ก): 5m BUY 10 ไม้ 40% −47 · 5m SELL 10 ไม้ 20% −55 · 30m BUY 6 ไม้ 33% −47 · 1h BUY 2 ไม้ 50% −22 · รวม 28 ไม้ 32% ≈ −171 หลังสเปรด

- ⚠️ **ตัวเลขชุดนี้เพี้ยนเพราะบั๊กตัวบันทึก (แก้แล้ว 14 ต.ค. 2569 เย็น)**: `chart-run.js` คำนวณส่วนต่าง PAXG → ราคาทองจริงจากแท่งล่าสุดที่เวลาไม่ตรงกัน ไม้จึงชน SL/TP ปลอม · คำนวณใหม่ 31 ไม้ (ถึง 14 ต.ค. 17:25) ด้วยส่วนต่างที่ตรึงไว้ตอนเข้า: **ชนะ 13/31 (42%) · −$74 ก่อนสเปรด (≈ −$87 หลังสเปรด)** แทน 11/31 · −$150 ที่บันทึก · แยกกรอบ 5m −36 (10/23) · 30m −15 (2/6) · 1h −24 (1/2) · **แก้ย้อนหลังใน branch data แล้ว (64b7499 + 6ad8988)**: 32 ไม้ ชนะ 12 (38%) · −$99.8 ก่อนสเปรด (≈ −$113 หลังสเปรด) · 5m 9/24 −61 · 30m 2/6 −15 · 1h 1/2 −24 · ไม้ที่แก้มี `was: {status, pnl, closedBy, fix}`
- 1 สัปดาห์ / 28 ไม้ ยังน้อยเกินจะสรุป (ทดสอบต้อง ≥ 20 ไม้ต่อกรอบ) แต่ต้องบอกผู้ใช้ตรง ๆ และติดตามต่อ — เบรก (CHARTSYS.brake) จะพักกรอบที่แพ้ติด 5 ไม้ / win% ต่ำกว่าทดสอบ −12

**ระบบเก่า (backtest.json / backtest-30m.json บน branch data, สร้าง 12 ต.ค. 2569, 1 ปี)**

| ระบบ | ไม้ | ชนะ | ก่อนสเปรด | หลังสเปรด |
|---|---|---|---|---|
| รายวัน 07:05 (ข้อมูลประกอบ) | 260 | 47% | −113 | **−217** |
| 30 นาที แบบเก่า (intraday.js, TP $15) | 406 | 52% | +277 | +115 |

**ตัวเลขเดิม (ณ 5 ต.ค. 2569, ยังไม่หักสเปรด — เก็บไว้เป็นประวัติ)**

| ระบบ | 1 ปี | 2 ปี |
|---|---|---|
| รายวัน 07:05 (ทุกวัน, 3 TP, ปิด 02:45) | 260 ไม้ · ชนะ 49% · +$72/ออนซ์ | +$479 (ก่อนปรับเวลา) |
| 30 นาที (±5, 3 TP, เฉพาะ 07:00–03:00) | 876 ไม้ (~3.4/วัน) · ชนะ 51% · +$590 (≈ +$239 หลังหักสเปรด $0.4) | +$1,514 (ก่อนปรับเวลา) |

---

## 9. ประวัติการเปลี่ยนกติกา (สั้น ๆ)
1. Pivot + limit order (รอราคา) → backtest ขาดทุน −$1,404/ปี → เลิกใช้
2. เข้าทันทีตามเทรนด์ SL/TP ตาม ATR → −$71/ปี
3. เฉพาะ 5 ดาว, TP/SL $15 → +$15/ปี
4. 3 TP ($15/$20/$30) + เลื่อน SL ไปทุน → +$72/ปี
5. สัญญาณทุกวัน (ไม่จำกัด 5 ดาว) → +$70/ปี (ปัจจุบัน)
6. เพิ่มระบบ 30 นาที (±5) → +$603/ปี (ปัจจุบัน)
7. (5 ต.ค. 2569) เปลี่ยนเป็นธีมสว่าง (theme.css) + หน้าโหลดค้างอย่างน้อย 4 วินาที (auth.js MIN_MS) วงแหวนเติมช้าลง
8. (5 ต.ค. 2569) ปรับหน้าเว็บใหม่เป็นเรียลไทม์: หน้าโหลดอนิเมชั่น, ราคาสด 3 วิ, เกจคะแนนสด, โดนัท % แต่ละจุด — กติกาการเทรดไม่เปลี่ยน
9. (5 ต.ค. 2569) LINE ส่งเฉพาะตอน ✅ เปลี่ยน + รวมข้อความต่อรอบ + เบรกฉุกเฉิน
10. (5 ต.ค. 2569) สัญญาณรายวันเป็นข้อมูลประกอบ (advisory) + เช็กโควตา LINE ทุกเช้า
11. (5 ต.ค. 2569) เพิ่มสัญญาณ 15 นาทีบนเว็บ (ไม่ส่ง LINE) + ลูกศรบนกราฟ
12. (5 ต.ค. 2569) ราคาสดจากสตรีม investing.com (~1 วินาที) + ลดการยิง REST
13. (5 ต.ค. 2569) เกจเข็ม → แถบความแรง −6…+6 + การ์ด 3 กรอบเวลา + นับถอยหลัง · แก้ "ตลาดปิด" ทั้งที่ตลาดเปิด
14. (6 ต.ค. 2569) โลโก้ใหม่ ทองคำ + สายฟ้า (logo.svg, favicon) + หน้าโหลดแบบฟ้าผ่า
15. (6 ต.ค. 2569) การ์ด 3 กรอบเวลาเปลี่ยนจากเส้นราคาเป็นแท่งเทียน
16. (6 ต.ค. 2569) เวลาตลาดเลื่อนตามเวลาออมแสงสหรัฐ (08:00–04:00 ช่วงหน้าหนาว) + งานเช้า 2 รอบผ่าน market-gate
17. (6 ต.ค. 2569) ติดตั้งเป็นแอป (PWA) + แจ้งเตือนบนเครื่องผ่าน web push (ข้อความเดียวกับ LINE ไม่กินโควตา)
18. (6 ต.ค. 2569) หน้าโหลดอนิเมชั่นเพิ่ม: กราฟแท่งเทียนพื้นหลัง, ลำแสง, คลื่นกระแทก+ประกายไฟ, หัวดาวหาง, ชื่อเด้งทีละตัว, ฉากจบระเบิดแสง
19. (6 ต.ค. 2569) การ์ดสัญญาณ 15 นาที: กราฟเดินตามราคาสดทุกวินาที (เดิมค้างจนแท่งปิด)
20. (6 ต.ค. 2569) กติกาไม่ไล่ราคา (Bollinger) ทั้ง 2 ระบบ + เหตุผลละเอียดทุกตัวชี้วัด + กราฟ 15 นาทีลาก/ซูม/ชี้ดู OHLC
21. (6 ต.ค. 2569) แผนเทรดวันนี้: ช่วงตลาด, บันไดแนวรับแนวต้าน, จุดเข้าอ้างอิง 3 แบบ, เรดาร์สายสั้น 1 นาที, คำนวณขนาดไม้
22. (6 ต.ค. 2569) หน้าโหลดจัดเต็ม (ผู้ใช้ไม่เอา → revert)
23. (6 ต.ค. 2569) ทดสอบจุดเข้าแผนเทรด + เรดาร์สายสั้น (ขาดทุนทั้งคู่ → เปลี่ยนเป็นข้อมูลประกอบ) · การ์ดผลจริง vs ทดสอบ · render เฉพาะการ์ดบนจอ
24. (6 ต.ค. 2569) สัญญาณบนกราฟทุกกรอบเวลา (chartzones.js) — กรอบ 1 ชม. SL $30 กำไรทุกครึ่งปีในการทดสอบ
25. (6 ต.ค. 2569) จุดเข้าบนกราฟเป็นกล่องสถานะไม้ (แดง SL / เขียว TP + ป้ายใหญ่)

---

# 📜 บันทึกการเปลี่ยนแปลง (ใหม่สุดอยู่บน)

> จัดเรียงใหม่ 14 ต.ค. 2569: เนื้อหาเดิมครบทุกหัวข้อ แค่เรียงตามวันที่ (ใหม่ → เก่า) · งานใหม่ให้เพิ่มหัวข้อไว้บนสุดของส่วนนี้

## 20 ต.ค. 2569 — 🚚 ย้ายออกจาก Vercel → Cloudflare Worker + Supabase
- ผู้ใช้ (ภาพหน้าล็อกอิน "ยืนยันบัญชีไม่สำเร็จ"): "เข้าไม่ได้ กรอกบัญชี 2 บัญชีที่ฟิกไว้" → สาเหตุ: Vercel ทีม thander1 **softBlock FAIR_USE_LIMITS_EXCEEDED / blobTotalSimpleRequests** ตั้งแต่ 20 ต.ค. 16:45 (เปิดเอง 19 พ.ย.) ทั้งเว็บตอบ 402 DEPLOYMENT_DISABLED · ตัวการอ่าน Blob: middleware ทุก request (banned/pro cache 30 วิต่อ instance) + check-loop ทุก 5 นาที (price-alerts-user, pro-expiry, backup-blob list, market-send, push)
- ผู้ใช้เลือก "ไม่จ่าย ย้ายไปบัญชีอื่น" → "ย้ายไปใช้ supabase ได้ไหม" → Cloudflare (ฟรี ใช้เชิงพาณิชย์ได้) + Supabase · "ทำให้หน่อย"
- **worker.js**: middleware.js ก่อนทุก request (คืน x-middleware-next = ไปต่อ) → api/*.mjs เดิม (export GET/POST…) → rewrites /blog, /sitemap.xml → ASSETS (dist/) + headers no-store ตาม vercel.json · `/` และ `.../` → index.html เอง · cron 30 1 * * 1-5 = scheduled() เรียก market cron · **wrangler.toml** nodejs_compat (process.env มาจาก vars/secrets), assets run_worker_first, **html_handling "none"** (ไม่งั้น /login.html → 307 /login แล้ว middleware วน) · vars ADMIN_EMAILS, SITE_URL · `scripts/cf-build.sh` = git ls-files ลบ api/lib/scripts/research/docs/.github/*.md ฯลฯ → dist/ (639 ไฟล์ 105 MB)
- **Supabase** ตาราง `kv(path text pk, body text, updated_at)` RLS เปิด ไม่มี policy (secret key เท่านั้น) · REST: GET `?select=body&path=eq.` · upsert POST `?on_conflict=path` + `prefer: resolution=merge-duplicates` · key ขึ้นต้น eyJ (legacy) ส่ง bearer ด้วย · `scripts/blob.js` = get/put/list/del แบบ @vercel/blob (get คืน {statusCode, stream}) — สคริปต์ 9 ตัว require('./blob') + `ready()` แทนเช็ก BLOB_READ_WRITE_TOKEN · workflow 6 ไฟล์ใช้ secrets SUPABASE_URL / SUPABASE_SERVICE_KEY · `scripts/blob-to-supabase.js` คัดลอก 16 ไฟล์ (ไม่เอา backup/) ตรวจอ่านกลับตรงทุกไฟล์ · `scripts/cf-secrets.sh` (ผู้ใช้รันเอง — ระบบสิทธิ์ไม่ให้ผมแตะรหัสลับ): ✓ ACCESS_SECRET, CLERK_SECRET_KEY, SUPABASE_*, STRIPE_LIVE_SECRET_KEY, CRON_SECRET · ไม่มี AI_GATEWAY_API_KEY → **โค้ช AI ยังใช้ไม่ได้** · Stripe webhook secret อยู่ใน access/stripe-live.json แล้ว แต่ **URL webhook ใน Stripe ต้องเปลี่ยนเป็น /api/pay/webhook ของโดเมนใหม่ (ผู้ใช้ทำ)**
- lib/blog.mjs: `import CSYS from '../chartsys.js'` แทน createRequire · ลิงก์ gold-signal-ten.vercel.app → workers.dev ใน 34 ไฟล์ · market siteFinal ถือ workers.dev = ยังไม่ใช่โดเมนจริง
- กับดัก: sed -i ใน Git Bash ทำ CRLF หาย (push.js, golive, market, ref, morning-plan) → เติม \r คืน · SSL ของ subdomain workers.dev ใหม่ใช้ ~1 นาที (curl 35 schannel ระหว่างรอ)
- **โค้ช AI + ตัวเขียนการตลาด → Cloudflare Workers AI** (ผู้ใช้ "ทำมาให้หน่อยทั้งหมด", 6170f4f): wrangler.toml `[ai] binding = "AI"` · worker.js ตั้ง `globalThis.GS_AI = env.AI` · lib/gs.mjs `workersAI(messages)` โมเดล `@cf/aisingapore/gemma-sea-lion-v4-27b-it` (gemma-3-12b บัญชีนี้ใช้ไม่ได้ 5018) — ทดสอบตอบไทยทางการดี ~7 วิ ~20 neurons/คำตอบ (ฟรี 10,000/วัน ≈ 500 คำตอบ) · ใช้เมื่อไม่มี AI_GATEWAY_API_KEY · README (Cloudflare/Supabase, fbd50ef) + พอร์ตโฟลิโอสไลด์ลิงก์ใหม่ + แท็ก "Cloudflare Workers + Supabase" (a65528d)
- **ระบบสิทธิ์ไม่ให้ผมแก้โค้ดที่เปลี่ยน URL webhook ของ Stripe** → ผู้ใช้ต้องแก้ใน Stripe Dashboard เอง · ไม่มี Claude in Chrome (ผู้ใช้ไม่ติดตั้ง) → ทดสอบล็อกอินจริง / rich menu LINE ผู้ใช้ทำเอง
- ทดสอบ: wrangler dev (ไม่ล็อกอิน = เหมือน Vercel ทุกเส้นทาง · คุกกี้สมาชิก/แอดมิน: หน้าแอป, data branch, ข่าว, /api/me admin:true, admin.html เฉพาะแอดมิน) · เว็บจริง / → welcome, login 200, main.js 401 · workflow new-members รันสำเร็จ (อ่าน/เขียน Supabase) · commit fc2c28b

## 20 ต.ค. 2569 — 💲 "เฉลี่ยต่อรายการ" คู่กับ % ชนะ · 🔬 เลื่อน SL ไปทุนช้าลง (ไม่ใช้) · 📦 ย่อ Skill.md
- ผู้ใช้: "เพิ่มเติมหรือปรับอะไรดี หรือควรลดอะไรดี" → เสนอ 5 ข้อ → "ทำมา" (ข้อ 1 + 3 + 4, ข้อ 2 รายงานอย่างเดียว) · ที่มา: ไม้จริงวันนี้ ชนะ 3 × +$1.25 · แพ้ 2 × −$15 → % ชนะดูดีเกินจริง (ต้องชนะ ~92% ถึงเท่าทุน)
- **lib/blog.mjs** side() `cur` เพิ่ม `winSum` / `lossSum` · **login.html** ช่อง 4 กรอบ: บรรทัด `.av` "เฉลี่ย ±$" (B.pnl+S.pnl)/ไม้ปิด สีเขียว/แดง · tcap: คำอธิบาย + `#avgAll` "ชนะเฉลี่ย · แพ้เฉลี่ย ต่อรายการ" (รวมทุกช่อง, ไม้ pnl ≤ 0 = แพ้) · **main.js** renderRecord: `avg()` "เฉลี่ย ±$/รายการ" ต่อช่อง + `wl()` ชนะเฉลี่ย/แพ้เฉลี่ยในบรรทัดกรอบเสี่ยง · main.js?v=202610211130
- **กฎถือฝั่งละ 1 ไม้ (chart-run.js บรรทัด busy)**: ตรวจกับข้อมูลจริงแล้วถูก (5m SELL / 30m SELL busy) — 5m SELL 08:10 + 08:30 ซ้อนกันเพราะเปิดก่อน 3bfefb8 (09:11) · ไม่แก้โค้ด
- **วิจัย edgetest.js `BE=tp1|tp2|half|none`** (สำเนา evaluateTargets เปลี่ยนแค่จุดเลื่อน SL; tp1 = ตรงกับ SIG.evaluate ทุกตัวเลข) · report-2026-10-20-be.txt: เลื่อนช้าลง/ไม่เลื่อน → ชนะเหลือ 38–71%, 5m BUY/SELL ขาดทุนหรือ ~0 → **คง tp1** · ข้อยกเว้น 1h SELL: tp2 +$429 / none +$467 (เดิม +$201, กำไรทุก 4 ช่วง, 78–81 ไม้ใน 2 ปี) — ยังไม่เปลี่ยน (ฝั่ง risky, รอผู้ใช้) · ข้อสังเกต: ทดสอบเองกำไรเฉลี่ยต่อไม้แค่ ~$0.3–1.1 (เช่น 5m SELL $1,010 / 1,868 ไม้)
- **ย่อ Skill.md** 490 KB → 153 KB: บันทึก 17 ต.ค. และก่อนหน้า + "🗄️ ข้อ 1 เดิม" → **Skill-archive.md** (ครบทุกบรรทัด) · สำเนา .claude/skills/gold-signal/ มีทั้ง 2 ไฟล์
- ทดสอบ: gold-signal-tools/avgtile.mjs (ใหม่: pc + iPhone 13, ไม่ล้น, ไม่มี error) · entries.cjs (ไม้ archive + วันนี้) · errscan.cjs ไม่มี error

## 20 ต.ค. 2569 — 🔔 LINE ถึง TP1 / ยกเลิก Limit + 🧹 ลบโค้ดที่ไม่ใช้
- ผู้ใช้: "เพิ่มเติมหรือปรับอะไรดี หรือควรลดอะไรดี" → เสนอ → "ทำมา" (ข้อ 1 + 2 + 4; ข้อ 1 = อนุญาตข้อความทางออกใน LINE)
- chart-run.js follow loop: hit 0 → ≥ 1 (ยังไม่ปิด) → `✅ {กรอบ} {Buy/Sell} (เข้า X) ถึง TP1 Y แล้ว → เลื่อน SL ไปที่ทุน X · ที่เหลือถือต่อไป TP2` · pending → expired → `❌ ยกเลิก … รอเข้าที่ X — ราคาไม่ถึงภายในเวลา → ลบคำสั่ง Limit` · เฉพาะ CHART_NOTIFY และไม่ paused · เข้าคิว lineQueue เดียวกัน (หัว "📬 แจ้งเตือน N รายการ") · followtest.js (scratchpad dry) ไม้ปลอม 2 ไม้ → ข้อความถูก
- ลบ: login.html renderRecent/REC/renderEnt/LAST/renderToday/TODAY + CSS .today/.ent (−78) · lib/blog.mjs readyJSON + `?ready=1`, today, openTiles, tiles[].all/.last (−43) · คงไว้ chartsys require (ใช้ `cur`) + vercel includeFiles · welcome ใช้ open/recent/tfs/others/all ครบ
- ทดสอบ tilelive / phoneshot / errscan ไม่มี error

## 20 ต.ค. 2569 — 🔎 "ขอแม่นยำกว่านี้" — ให้กรอบใหญ่ยืนยัน: ไม่ช่วยพอจะใช้
- edgetest.js `CONF=<tf>:<k>` (คะแนนแท่งปิดล่าสุดของกรอบใหญ่ต้องเอียงทางเดียวกัน ≥ k) · `TFS=` · ลอง 5m+15m/30m/1h, 15m+30m/1h, 30m+1h × k 2/3 (MODE=side)
- ผล: **อัตราชนะไม่ขึ้นเลย** (ยัง 84–88% ทุกแบบ) · กำไรรวมลดเกือบทุกแบบ · มีอันเดียวที่น่าสนใจ: 5m BUY + 15m ≥ 2 → +$598 [241/304/86/−32] (เดิม +$552, ช่วงล่าสุด −340 → −32) แต่ยังไม่กำไรครบ 4 ช่วง → ไม่ใช้ (ต้องให้ chartsys ข้ามกรอบ — ไม่คุ้มสำหรับฝั่ง risky)
- สรุปที่บอกผู้ใช้: อัตราชนะตอนนี้มาจากโครงสร้าง TP1 ใกล้ + ย้าย SL ไปทุน (~85%); ดันให้สูงกว่านี้ = TP1 ใกล้ขึ้น → กำไรต่อไม้หาย · ต้องรอผลจริงของกติกาใหม่

## 20 ต.ค. 2569 — 📱 หน้าสมัครบนมือถือเล็กลงอีกขั้น
- ผู้ใช้: "ปรับขนาดหน้าตอนเข้าสู่ระบบสมัครสมาชิกให้สมส่วนกับโทรศัพท์ มันดูใหญ่ไป" → login.html `@media (max-width: 600px)` เพิ่มชุด "one more size down" (brand 24px/14.5px · ราคา · headline 16px · steps 19px · tabs · tiles .pc 21px · tcap 10px · demo · FAQ · trust) + Clerk PHONE: fontSize 13px, card 14px 12px, ปุ่มหลัก 8px/13px, headerTitle 16px, subtitle 12px · **ช่องกรอกยัง 16px** (iPhone ซูมถ้าเล็กกว่า)
- ทดสอบ gold-signal-tools/phoneshot.cjs (ใหม่: iPhone 13 UA 390×844, รอฟอร์ม Clerk): ปุ่ม "ดำเนินการต่อ" bottom 672 → 620 px, หน้าสูง 1781 → 1588, ไม่มี error ไม่ล้นจอ

## 20 ต.ค. 2569 — 🔎 "สัญญาณยังให้ไม่ค่อยตรง" — ตัวกรองเทรนด์กรอบใหญ่ไม่ช่วย (ไม่เปลี่ยนกติกา)
- ผู้ใช้: "สัญญาณยังให้ไม่ค่อยตรงเลย" → ไม้วันนี้ (หลังล้างสถิติ): Sell ทั้งหมด (กราฟลงช่วงเช้า) · ปิด 3 ชนะ (TP1 → ทุน +$1.25) · 2 ยกเลิก · 4 Sell เปิดอยู่ ติดลบ $1.75–8.75 เพราะทองกลับตัวขึ้นหลัง 08:30 (~4,120 → 4,134) — การรอเด้งแล้วขาย = เข้าตรงจังหวะกลับตัวพอดีในวันที่กลับตัวแรง · 2 ใน 4 ไม้เปิดมาจากกติกา "ทุกสัญญาณใหม่" ก่อน 3bfefb8
- ทดสอบ edgetest.js `HTF=4h|1h HTF_EMA=50|20 MODE=side` (เทรดตามทิศกรอบใหญ่เท่านั้น): **ทุกแบบแย่กว่าไม่กรอง** (เช่น 5m SELL +$1,010 → +$416 ด้วย 4h EMA50, 5m BUY ยังขาดทุนช่วงล่าสุดทุกแบบ) → ไม่ใช้ · edgetest.js เพิ่มตัวเลือก HTF/HTF_EMA

## 20 ต.ค. 2569 — 🔧 ผลทดสอบแบบเดียวกับระบบจริง · ถือแยกฝั่ง · กันโควตา LINE
- ผู้ใช้: "เพิ่มเติมหรือปรับอะไรดี" → เสนอ 7 ข้อ → "ทำมา" (ทำข้อ 1 กันโควตา, 2 ทดสอบใหม่, 5 ข้อความ Limit)
- **พบบั๊กในการจำลอง** (newidea LIMIT / sellnew / morenew run()): ไม้รอราคาที่ไม่ได้เข้าไม่กันฝั่ง → แท่งถัดไปลองใหม่ทันที (ระบบจริงต้องรอจน fillBy) → ผลดีเกินจริงมาก · แก้ morenew.js (`e.wait` / `e.at`) + indlab.js (busy = t + dipH) · edgetest.js ใหม่: ทดสอบกติกาปัจจุบันแบบ "ทุกสัญญาณใหม่" (MODE ปกติ) หรือ "ถือแยกฝั่ง" (MODE=side) — ทุกสัญญาณใหม่: กำไรหาย/ขาดทุน (5m SELL −$109, 1h SELL −$61) → เลิกใช้
- ผลใหม่ (report-2026-10-20-more-fixed.txt, กำไรทุก 4 ช่วง + ชนะ ≥ 70%): 5m SELL th2 roc12 dip5/0.5h 87% +$1,010 · 15m BUY th4 bbrev dip3/1h 88% +$309 · 15m SELL th4 roc12 dip5/1h 87% +$579 · 30m SELL th2 roc12 dip5/1h 87% +$614 · 1h BUY th4 sma2050 dip6/6h 82% +$496 · 1h SELL th3 bbrev dip6/2h TP 7.5/30/60 82% +$201 · **5m BUY / 30m BUY ไม่มีแบบไหนผ่าน** → คงกติกา + risky "ช่วงทดสอบล่าสุดขาดทุน" (86% / 84%, ล่าสุด −$340 / −$232) · since ทั้งหมด 2026-10-20T00:00 (= วันล้างสถิติ) · test-stats.json ตาม
- **chart-run.js**: ถือได้ฝั่งละ 1 ไม้ (Buy/Sell แยก; expired limit กันฝั่งถึง fillBy + dur) แทน "ทุกสัญญาณใหม่" · LINE quota guard: notify.js `quotaShare()` → ≥ 80% ส่งเฉพาะ 1h/5h/1d/1w + หมายเหตุ · texts = {tf, text} · ข้อความ "ตั้ง Buy/Sell Limit ที่ราคานี้ (อย่าเข้าทันที)" · dipH < 1 แสดงเป็นนาที (chart-run/chartzones/chartchat/main/easy)
- ทดสอบ: dry run · batchtest.js · tpcheck.cjs · errscan.cjs · tilelive.mjs ไม่มี error

## 20 ต.ค. 2569 — ⚡ ผลจริงอัปเดตทุก 15 วินาที
- ผู้ใช้: "ขอทุกอย่างเรียลไทม์ให้ตัวเลขขยับตามที่สั่งไว้" → login.html loadStats 60 → 15 วิ · main.js `every(15e3, refreshSignals)` (เดิม 60 วิ) · ทางข้อมูลเร็วอยู่แล้ว: middleware dataFile / lib/blog statsJSON ใส่ `?t=` ทุก 10–20 วิ (ข้าม CDN 5 นาทีของ GitHub) → ช้าสุดคือรอบเช็กของ recorder ทุก 5 นาที (ผลตัดสินบนแท่ง 5 นาที — เร็วกว่านี้ไม่ได้โดยไม่ให้ตัวเลขกลับไปกลับมา)
- errscan.cjs ไม่มี error

## 20 ต.ค. 2569 — 🧹 ล้างสถิติเก่า เริ่มนับผลจริงใหม่ 20 ต.ค.
- ผู้ใช้: "ล้างสถิติของเก่าทั้งหมด เริ่มใหม่วันนี้เลย" → branch data: chart-signals.json เก็บเฉพาะ createdAt ≥ 2026-10-20T00:00+07:00 (8 รายการ) · `startedAt` = นั้น · `brakes` = {} · `resetAt` · 57 รายการเดิม → **chart-signals-archive-2026-10-20.json** (branch data, ไม่ลบ) · ทำผ่าน git worktree ของ origin/data, commit + push (recorder pull ก่อนทุกรอบ)
- **กับดัก**: commit บน data ต้องใช้อีเมล noreply `331178108+tanakrthum254614-max@users.noreply.github.com` — ผมเผลอใช้อีเมลจริงแล้ว amend + force-with-lease แก้ทันที (repo สาธารณะ)
- login.html tcap "นับใหม่ตั้งแต่ 20 ต.ค. 2569" · บรรทัดกติกาเก่าหายเอง (oldRules = 0) · raw.githubusercontent cache ~5 นาที

## 20 ต.ค. 2569 — 🔍 ผลจริงแยกกติกาปัจจุบัน / กติกาเก่า
- ผู้ใช้: "แพ้มากกว่าชนะ … วิเคราะห์ให้ชนะเกิน 70%" → วิเคราะห์ chart-signals.json: **ทุกไม้ที่แพ้เป็นกติกาเก่า** (ก่อน since 19 ต.ค. 20:00): 5m BUY 16 ไม้ 44% −$43 · 5m SELL 14 ไม้ 29% −$51 · 30m BUY 9 ไม้ 56% · 1h BUY 2 ไม้ 50% · กติกาใหม่: 4 ปิด ชนะ 4 (+$7.55, ส่วนใหญ่ TP1 แล้วออกที่ทุน) · 7 expired (ราคาไม่ถึง) · 3 pending
- lib/blog.mjs tiles side(): `cur` = ไม้ที่ createdAt ≥ since ของฝั่ง (chartsys) · `oldRules` = ไม้กติกาเก่าทุกกรอบในช่อง (43 ไม้ ชนะ 44% −$83.17) · login.html ตัวใหญ่/บรรทัด Buy-Sell = cur · tcap บอกวันเริ่มกติกา + บรรทัดกติกาเก่า (#oldRules) — **ไม่ซ่อนผลแพ้** · กับดัก: ตัวแปร `o` ชนกับของเดิมใน loadStats → SyntaxError ทั้งหน้า (ใช้ `old`)
- ยังต้องรอผลจริงจำนวนมากพอ (≥ 20 ไม้ต่อฝั่ง) ก่อนสรุปว่าได้ ≥ 70% จริง

## 20 ต.ค. 2569 — ✅ หน้าสมัคร: ช่อง 4 กรอบ = ผลจริง (ไม่ใช่ผลทดสอบ)
- ผู้ใช้ (ภาพช่อง 88/88/87/85%): "ปรับให้เป็นตัวเลขจริงในการเข้าของทุกทามเฟรม ไม่เฟคเลขขึ้นมา" → login.html: ตัวใหญ่ = ชนะจริงรวม Buy+Sell (tiles[].buy/sell.live, .wins — ทุกไม้ที่ปิดตั้งแต่เริ่มบันทึก 7 ต.ค. รวมกติกาเก่า) · `.bs` Buy / Sell คนละบรรทัด "x% (w/n)" · ไม่มีไม้ปิด "— (ยังไม่มีไม้ปิด)" · tcap "อัตราชนะจริงจากทุกรายการที่ระบบบันทึกและปิดแล้ว…" · loadStats ทุก 60 วิ · ตอนทำ: 5m 41% (13/32) · 15m 100% (2/2) · 30m 64% (7/11) · 1h 50% (1/2)
- กับดัก: Buy/Sell บรรทัดเดียว nowrap ทำช่องล้น (มือถือ scrollWidth 393 > 390) → แยกบรรทัด

## 20 ต.ค. 2569 — 📬 LINE ไม่เกิน 1 ครั้ง / 30 นาที
- ผู้ใช้ (ภาพ LINE 5m Sell 08:00/08:10/08:30): "มีการแจ้งเตือนถี่เกินไป อยากให้ 30 นาทีแจ้งทีแต่ละสัญญาณ" → chart-run.js: texts → `store.lineQueue` [{at, text}] ใน chart-signals.json · ถ้า `now − store.lineAt ≥ 30 นาที` → `pack(queue)` เป็นข้อความเดียว ("📬 สัญญาณ N รายการ (ช่วงเวลา)" + ทุกสัญญาณ ตัดลิงก์ซ้ำ ≤ 4,700 ตัวอักษร "…และอีก N สัญญาณ" + ลิงก์ครั้งเดียว) แล้วตั้ง lineAt · ไม่อย่างนั้นรอคิว (log "📬 N signal(s) waiting") · "no change" นับคิวด้วย (ไม่งั้นคิวไม่ถูกส่ง)
- ทดสอบ batchtest.js (dry: คิว → ครบ 30 นาทีส่ง → คิวว่าง) + พรีวิว pack 3 สัญญาณ

## 19 ต.ค. 2569 — 📈 จุดเข้า Buy / Sell มากขึ้น (5m/15m/30m/1h) + เบรกนับเฉพาะกติกาปัจจุบัน
- ผู้ใช้: "อยากให้จุดเข้า Buy และ Sell เยอะๆ สม่ำเสมอในการบอกจุดเข้า" → research/indicators/morenew.js (ใหม่, จาก sellnew.js ทั้ง 2 ฝั่ง; cache score2-<tf>.json) th 2–6 × ตัวยืนยัน × TP ¼/1/2 หรือ ½/1/2 ของ SL × เข้าทันที/รอราคา → เก็บเฉพาะ **กำไรทั้ง 4 ช่วง + ชนะ ≥ 70%** เรียงตามจำนวนไม้ · report-2026-10-19-more.txt
- ใช้ (ไม้/วันทำการ, ทดสอบ 2 ปี ทีละไม้): 5m BUY th2 dip5/1h 88% +$2,901 (5.1) · 5m SELL th2 dip5/1h 88% +$3,470 (5.5; เดิม th6 sma2050 53%) · 15m BUY th2 dip5/2h 89% +$2,808 (4.1; เดิม th6 ema921 TP1 56%) · 15m SELL th2 87% +$1,948 (3.9) · 30m BUY th4 ema921 dip5/3h 88% +$1,470 (2.2, ล่าสุด +22 → risky "กำไรน้อย") · 30m SELL th2 87% +$1,575 (3.2) · 1h BUY th3 dip10/6h 85% +$1,656 (1.1) · 1h SELL th2 bbrev dip6 TP 7.5/30/60 83% +$532 (0.3) · ทุกตัว tps 3.75/15/30 (1h 7.5/30/60) · since 2026-10-19T20:00 · test-stats.json ตาม
- **เบรก** (chartsys brake): นับเฉพาะไม้ที่ `createdAt >= since` ของฝั่งนั้น → 5m เลิกพัก ("✅ กลับมาแจ้งสัญญาณกราฟ 5 นาที")
- ⚠️ ~25 สัญญาณ/วัน + ส่งทุกสัญญาณใหม่ → LINE หลายครั้งต่อวัน (flush รวมทุกข้อความในรอบเดียวเป็น 1 request) — ระวังโควตารายเดือน · ลองหลายแบบ (~2,800) เสี่ยงฟลุก แต่แบบข้างเคียงก็ผ่าน → ติด risky จนมีผลจริง 20 ไม้ (ยกเว้น 1h BUY)
- ทดสอบ: tpcheck.cjs (5m/15m/30m/1h รอเข้า/เด้ง ครบ 2 ฝั่ง) · dry run · errscan.cjs ไม่มี error

## 19 ต.ค. 2569 — 🎯 เลิก "ถือไม้ทีละไม้" — ทุกสัญญาณใหม่บันทึก + ส่ง LINE · หน้าเว็บไม่มีสถานะ "ถือ"
- ผู้ใช้ (ภาพ "ถือ Buy" ทั้งที่ Sell 50%): "ทำไมถือ Buy" → อธิบาย → "เอาระบบเข้าซื้อออก ให้บอกแค่จุดเข้าซื้อตรงที่สัญญาณบอกในกราฟ" → ถาม → "หน้าเว็บ + LINE"
- **chart-run.js**: ลบ one-at-a-time (`!SIG.isFinal(x) || exitAt + dur > t`) → เหลือกันซ้ำแท่งเดียวกัน + **กติกา "สัญญาณใหม่"**: ข้ามถ้า `dirOf(decide(t − dur)) === dir` (แท่งก่อนหน้าเป็นสัญญาณฝั่งเดียวกันอยู่แล้ว) · ไม้หลายไม้เปิดพร้อมกันได้ (follow loop ประเมินทุกไม้) · เบรกยังทำงาน (paused = บันทึกไม่ส่ง)
- ประมาณการจาก qual-*.json 90 วัน: สัญญาณใหม่ต่อวันทำการ 5m ~8 · 15m ~0.6 · 30m ~1.4 · 1h ~0.6 (+ Sell ใหม่ 15m/30m) → **ระวังโควตา LINE** (5m พักอยู่ตอนนี้) · ผลทดสอบ % เดิมวัดแบบทีละไม้ — ผลจริงต่อจากนี้นับทุกสัญญาณ
- **หน้าเว็บ**: chartzones.js `const open = null` (การ์ด/📌/กล่องไม้ที่ถือ/เส้นราคาไม่มีสถานะถือ — ป้ายไม้ + กล่องไม้ปิดบนกราฟยังอยู่) · main.js renderIntra `open = null` (หน้าแรกไม่มี "📌 มีรายการเปิดอยู่" / #inTrade) · ยังแสดง "📥 รอเข้า" ของไม้ limit ล่าสุด
- ทดสอบ: dry run recorder · notecheck.cjs (5m "รอก่อน", ไม่มีถือ) · errscan.cjs ไม่มี error

## 19 ต.ค. 2569 — 🔢 การ์ด "ถือ Buy": % ความพร้อมเข้า Buy / Sell ตัวใหญ่
- ผู้ใช้: "ไหนเปอร์เซ็น อยากให้แสดงแบบเมื่อก่อน" → ถาม (เปิดภาพให้ดู) → "% ใหญ่ในการ์ด ถือ Buy" → main.js renderSignalHead: ถือไม้ (CZ_GO.open) + CZ_SIDES → #actionSub = `.as-pct` Buy % / Sell % ตัวใหญ่ + `.as-note` (แทนบรรทัด "ระบบถือสถานะอยู่ — …") · live.css `#actionSub .as-pct` · อัปเดตทุกครั้งที่ chartzones คำนวณ (เรียก renderSignalHead) · ไม่ถือ = บรรทัดเดิม · notecheck.cjs ไม่มี error

## 19 ต.ค. 2569 — 🔄 #sigNote ตอนถือไม้ = % ความพร้อมเข้า Buy/Sell (ไม่มีข้อความ 📌)
- ผู้ใช้ (ภาพกล่อง 📌): "เอาออก แล้วแสดงเป็นเปอร์เซ็นในการเข้า ทั้งฝั่ง Buy หรือ Sell" → chartzones.js `note.innerHTML = showPlans || (open && fresh) ? mini bars : …` (ข้อความ 📌 + holdPct ไม่ใช้แล้ว) · บรรทัด actionSub "ระบบถือสถานะอยู่ — …" ยังอยู่ · notecheck.cjs: 5m/30m ถือ → "Buy 20% · Sell 0%" · ไม่มี error

## 19 ต.ค. 2569 — ↩️ คืนกล่อง 📌 + "ตอนนี้ควรทำอะไร?" · ช่องจุดเข้า Buy/Sell ขึ้นเสมอ · กล่องไม้บนกราฟสูงสุด 40
- ผู้ใช้: "เอากลับมาแบบเดิม แต่ขอให้แสดงจุดเข้าเสมอของสัญญาณ ให้แสดงหลายๆ ไม้ เอาเหมือนตะก่อน" → ถาม → คืนทั้ง 2 กล่อง + "ช่อง Buy/Sell ขึ้นเสมอ"
- คืน: index.html `#easySum` · easy.js = เวอร์ชันก่อน 70da39a (ทัวร์ 5 ขั้นเริ่ม easySum) · chartzones ลบ `note.hidden = !!open`
- chartzones.js: `showPlans = fresh && !noEntry` (ไม่สน open) → การ์ดมีช่อง Buy|Sell (รอเข้า/SL/TP) ตลอด · #sigNote เรียง `open ? 📌 + holdPct : showPlans ? mini : …` (ถ้าไม่สลับ 📌 จะหาย) · กล่องไม้ปิดบนกราฟ: ทุกไม้ที่อยู่ในจอ (onScreen) สูงสุด 40 (เดิม slice(-8))
- ทดสอบ notecheck.cjs (📌 ขึ้นตอนถือ 5m/30m) · dipshot5.cjs (5m ถือ Buy ยังมีช่อง Buy/Sell) · boxshot.cjs · homeshot.cjs (ทัวร์ 1/5 คำตอบเดียว) · ไม่มี error · **อย่าซ่อนช่องจุดเข้าตอนถือไม้อีก**

## 19 ต.ค. 2569 — ✂️ หน้ากราฟ: ซ่อนกล่อง 📌 "ถือสถานะ… ไม่ต้องเปิดรายการใหม่" ทุกกรอบ
- ผู้ใช้ (ภาพกล่อง #sigNote ตอนถือ): "เอาออกทุกทามเฟรม" → chartzones.js `note.hidden = !!open` (ถือหรือรอเข้า = ซ่อน #sigNote ทั้งกล่อง รวมแถบ "ความพร้อมเข้าตอนนี้ (ดูประกอบ…)") · ตอนไม่ถือ #sigNote ยังแสดง Buy/Sell % ตามเดิม
- ทดสอบ notecheck.cjs (ใหม่): 5m/30m ถือ → ซ่อน · 15m/1h/5h/1d → แสดง · ไม่มี error

## 19 ต.ค. 2569 — ✂️ เว็บสมาชิก: เอากล่อง "ตอนนี้ควรทำอะไร?" (#easySum) ออก
- ผู้ใช้ (ภาพกล่อง): "เอาอันนี้ออก" → index.html ลบ `<div id="easySum">` (renderEasy มี `if (!box) return`) · easy.js ทัวร์: ลบขั้น easySum (เหลือ 4: ราคาสด · ผลจริง · กราฟ · แจ้งเตือน) และเริ่มทัวร์เมื่อมี #liveHero แทน (เดิมรอ #easySum แสดง → ถ้าไม่แก้ ทัวร์จะไม่ขึ้นเลย) · ระวัง: คอมเมนต์ `//` กลางบรรทัดเดียวทำ SyntaxError → ใช้ `/* */`
- ทดสอบ errscan.cjs · homeshot.cjs (ใหม่: ทัวร์ "1 / 4 ราคาทองสด", ไม่มี easySum, ไม่มี error)

## 19 ต.ค. 2569 — ✂️ ช่อง 4 กรอบ: เอากล่องจุดเข้าล่าสุดออก
- ผู้ใช้ (ภาพกล่อง ถือ/ยังไม่มีจุดเข้า/ล่าสุด): "เอาอันนี้ออก" → login.html ลบ `<span class="ent">` ×4 + ส่วน "ด้านล่าง = จุดเข้าล่าสุด…" ใน tcap · loadStats ครั้งเดียว (ไม่ poll) · renderEnt/LAST ยังอยู่แต่ไม่มีที่แสดง · **หน้าสมัครตอนนี้ = ช่อง 4 กรอบ: ชื่อ · % รวม Buy+Sell · "Buy x% · Sell y%" เท่านั้น — ผู้ใช้เอาออกทีละอย่างจนเหลือแค่นี้ อย่าเพิ่มอะไรกลับถ้าไม่สั่ง**

## 19 ต.ค. 2569 — ✂️ ช่อง 4 กรอบ: เอา "ผลจริง" + แถบความพร้อมเข้าออก
- ผู้ใช้ (ภาพบรรทัด "ผลจริง x% (ชนะ w/n)"): "เอาอันนี้ออก" · (ภาพแถบ Buy/Sell %): "เอาออกเลย" → login.html ลบ `.lv`, `.rdy` (markup/CSS/JS loadReady) · ช่อง = ชื่อกรอบ · % รวม · Buy/Sell % · จุดเข้าล่าสุดสด · endpoint `?ready=1` + vercel.json includeFiles ยังอยู่ (ไม่มีหน้าไหนเรียก) · **ผู้ใช้ไม่เอาผลจริง/ความพร้อมเข้าในหน้าสมัคร (ครั้งที่ 2 สำหรับผลจริง) — อย่าเสนออีก**

## 19 ต.ค. 2569 — ⚡ ช่อง 4 กรอบ: ความพร้อมเข้าสด + ผลจริง
- ผู้ใช้: "ขอแบบเรียลไทม์ให้ตัวเลขเรียลไทม์ในการเข้าและขยับเปอร์เซ็นต่างๆ" → ถาม → "ทั้งสองแบบ"
- lib/blog.mjs `?blog=1&ready=1` (public): createRequire → chartsys.js (+ intraday/indicators/signals) · Binance PAXG klines 5m/15m/30m/1h(1000 → h5)/4h · `CS.decide(sys, frames, now, [], true)` (แท่งที่กำลังวิ่ง, ไม่ส่งข่าว) → `CS.sideInfo(...).pct` ต่อฝั่ง (null = ไม่มีฝั่งนั้น) · `closed` = dec.stale · cache 10 วิ ต่อ instance · **vercel.json `functions.api/market.mjs.includeFiles = "{chartsys,intraday,indicators,signals}.js"`** (ไม่มีแล้ว function หาไฟล์ไม่เจอ)
- login.html ช่อง: `.lv` "ผลจริง x% (ชนะ w/n)" รวม Buy+Sell จาก tiles[].buy/sell.live/wins · `.rdy` แถบ Buy/Sell + % (loadReady ทุก 10 วิ, 100% = สีทอง, ตลาดปิด = "ปิด") · tcap อธิบายแถบ
- ตรวจ: 1h Buy 40% ตรงกับเว็บสมาชิก · tilelive.mjs ตอบ ready=1 ด้วย blogGET จริง · เว็บจริงตอบ ok · commit a5a9a4e

## 19 ต.ค. 2569 — ✂️ หน้าสมัคร: เอา "สัญญาณวันนี้" ออก
- ผู้ใช้ (ภาพรายการ): "เอาออกห้าตอนสมัครสมาชิก" → login.html ลบ `<div class="today">` (renderToday เหลือแต่ไม่มีที่แสดง → return) · การ์ด #todayCard ในเว็บสมาชิกยังอยู่ · API today ยังอยู่
- ผู้ใช้ถาม "Sigzy คืออะไร" → ค้นแล้วเจอแอป iOS "Sig-Zy: Binary Signals" (สัญญาณ Forex/ไบนารีออปชัน กราฟ 1–4 ชม. อ้างชนะ 75% — ตรวจสอบไม่ได้) ไม่ได้เพิ่มอะไรในระบบ

## 19 ต.ค. 2569 — 📋 สัญญาณวันนี้ทุกกรอบ (สด) + 🔔 LINE 15 นาที
- ผู้ใช้: "15 นาทีส่งไลน์ด้วย อยากให้เอาเรียลไทม์ของแต่ละวันในการเข้าทุกสัญญาณ" → ถามที่แสดง → "ทั้งสองที่"
- chart-run.js `CHART_NOTIFY` default = `5m,15m,30m,1h,5h,1d` (1w ยังไม่ส่ง)
- lib/blog.mjs `today = {day, list}`: ทุกไม้ของวัน (กรุงเทพฯ) ทุกกรอบ ไม่รวม skip · ถ้าวันนี้ยังไม่มี = วันทำการล่าสุด · fields tf/side/entry/at/risky/paused/state(wait|open|closed|cancel)/pnl/exit/by/hit/n/realized/until — ไม่มี SL/TP (หน้าสาธารณะ)
- login.html `#today` ใต้ช่อง 4 กรอบ: `renderToday()` ทุก tick ราคา — ถือ = realized + ส่วนที่เหลือ × (ราคาสด − เข้า) เหมือน evaluator · รอเข้า "อีก $x" · ปิด ✅/❌ ±$ · ยกเลิก · รวมทั้งวัน
- index.html หน้าแรก การ์ด `#todayCard` (ก่อน 📒 ผลจริง) · main.js `renderToday(price)` เรียกท้าย renderIntra (ทุก tick) · มี SL (→ ทุนหลัง TP1) / TP ทุกตัว, "TPn แล้ว", ไม้พัก "(พัก · ไม่ส่ง LINE)" · live.css `.today-card` (+ .up/.down ในการ์ด)
- แก้: refreshBeat (main.js) / admin.html สถานะงาน — ข้ามรอบ `cancelled` (chain: รอบที่รอคิวถูกแทนด้วยรอบใหม่ = ไม่ใช่ล้มเหลว) เดิมขึ้น "⚠️ ระบบเช็กรอบล่าสุดล้มเหลว" · watchdog.js ข้าม cancelled อยู่แล้ว
- ทดสอบ: tilelive.mjs · todayshot.cjs (ใหม่ — ต้องตั้ง localStorage gs-tour=1 และกด "ดูแนวตั้งชั่วคราว" บนมือถือ · dev server อ่าน chart-signals.json ในเครื่อง → `git show origin/data:chart-signals.json > chart-signals.json` แล้ว `git checkout -- chart-signals.json` คืน) · errscan.cjs ไม่มี error · commit e136240

## 19 ต.ค. 2569 — 🔴 ฝั่ง Sell: 15m / 30m ใหม่ + 1h รอเด้งแล้วค่อยขาย
- ผู้ใช้: "มีฝั่ง Sell บ้างไหม" → ตอบ (5m Sell พักอยู่ ⛔, 1h Sell ยังไม่เคยออก, 15m/30m ไม่มี) เสนอ 2 ทาง → "ทำมาเลย" (ทั้งคู่)
- research/indicators/sellnew.js (ใหม่): replay คะแนน CS.decide ทุกแท่ง 2 ปี (cache score-<tf>.json ใน DATA_DIR) → ลอง th 3–7 × ตัวยืนยัน × SL mult × TP × เข้าทันที/รอเด้ง $d ภายใน W (ต้องผ่าน $0.3) · เลือกจากช่วง 1–3 (กำไรทุกช่วง ชนะ ≥ 60% ≥ 30 ไม้) แล้วดูช่วง 4 · รายงาน report-2026-10-19-sell.txt
- ใช้: 15m Sell th 4 ไม่ยืนยัน dip 5 dipH 2 · tps 3.75/15/30 → 1,330 ไม้ 87% +$1,219 [160/132/396/531] · 30m Sell th 3 dip 5 dipH 3 → 1,376 ไม้ 87% +$1,269 [110/115/393/651] · 1h Sell (เดิม −4 bbrev) + dip 6 dipH 6 → 70 ไม้ 76% +$693 [140/107/191/255] (เข้าทันที 62% +$545) · ทั้ง 3 ติด risky "Sell ใหม่ — ยังไม่มีผลจริงครบ 20 รายการ" (ลองรวม ~2,800 แบบ เสี่ยงฟลุก) · test-stats.json เพิ่ม 15m/30m SELL, 1h SELL ใหม่
- ข้อความ limit แยกฝั่ง: LINE "รอเด้งขึ้น $x … ตั้ง Sell Limit" · chartzones "เด้ง $x" · main/easy/chartchat
- **indlab.js sim จำลอง limit entry แล้ว** (c.dip/dipH, ผ่าน $0.3) — เดิมงานรายเดือน (monthly.js → test-stats.json) จะเขียนทับด้วยตัวเลข "เข้าทันที" วันที่ 1 พ.ย.
- ทดสอบ: tpcheck.cjs (15m/30m/1h เห็น "รอเข้า … (เด้ง $x)") · errscan.cjs ไม่มี error · dry run recorder · commit 2974ade

## 19 ต.ค. 2569 — ⚡ เรียลไทม์ทุกอย่าง: รันบันทึกสัญญาณต่อกันไม่มีช่องว่าง + ช่องจุดเข้าขยับตามราคา
- ผู้ใช้: "ขอแบบเรียลไทม์ทุกอย่าง" · ปัญหาเดิม: price-alerts.yml cron */15 แต่ GitHub เริ่มรอบช้า → รอบละ ~28 นาที ว่าง 15–40 นาที (เช่น จบ 14:05 เริ่มใหม่ 14:33) → จุดเข้า 5m/15m หลุด (เข้าเฉพาะภายใน 10 นาทีหลังแท่งปิด)
- **chain**: price-alerts.yml มี input `chain` + `permissions: actions: write` · step แรก "Queue the next run" (เมื่อ schedule หรือ chain): `gh workflow run price-alerts.yml -f send=true -f chain=true` (จันทร์–ศุกร์ UTC เท่านั้น) → concurrency `price-alerts` ให้รอจนรอบนี้จบแล้วเริ่มต่อทันที · `SEND`/`LOOP_MINUTES=28` ใช้กับ chain ด้วย · cron ยังอยู่เป็นตัวสำรองเริ่ม chain ใหม่ (เช้าวันจันทร์ / ถ้า chain ขาด) · workflow_dispatch จาก GITHUB_TOKEN สร้างรอบใหม่ได้ (ข้อยกเว้นของ GitHub)
- login.html ช่อง: `LAST[tf]` + `renderEnt()` เรียกทุก tick ราคา (showPrice) — ถือ = "● ถือ Buy ราคา" + ±$ ต่อออนซ์ (เขียว/แดง) · รอเข้า = "📥 รอเข้า Buy ราคา" + "อีก $x" · ไม้ใหม่ → ช่องกะพริบ · loadStats ทุก 20 วิ
- ทดสอบ tilelive.mjs (+ช่อง 30m รอเข้าปลอม): +$0.58 → +$0.07 ใน 3 วิ, "อีก $8.70" · ไม่มี error · commit 55adbad · เริ่ม chain ด้วย dispatch มือ 07:55 UTC

## 19 ต.ค. 2569 — ✂️ ช่อง 4 กรอบ: เอา "N จุดเข้า" ออก
- ผู้ใช้ (ภาพบรรทัด 1,957 / 230 / 765 / 435 จุดเข้า): "เอาออก" → login.html ลบ `.cnt` (markup + JS) และ " · จุดเข้า = จำนวนครั้งในการทดสอบ" ใน .tcap · `tiles[].all.n` ใน API ยังอยู่ (ใช้ถ่วง % รวม) · ทดสอบ tilelive.mjs คอม + มือถือ ไม่มี error

## 19 ต.ค. 2569 — 🧮 ช่อง 4 กรอบ: % รวม Buy + Sell + จุดเข้า
- ผู้ใช้: "แสดงเปอร์เซ็นรวมของบายกับเซลของแต่ละทามเฟรม ขอจุดเข้าในแต่ละช่องด้วย" → ถาม → "ทั้งราคาและจำนวน" + "% แยกเก็บไว้ตัวเล็ก"
- lib/blog.mjs: `side()` คืน `n` · `tiles[].all = {tested, n}` (% ชนะถ่วงตามจำนวนไม้ทดสอบ Buy/Sell: 5m 74% 1,957 · 15m 56% 230 · 30m 87% 765 · 1h 77% 435) · `tiles[].last` = ไม้ล่าสุดของกรอบใน chart-signals (ข้าม expired/skip) `{side, entry, at, state: wait|open|closed, until}`
- login.html ช่อง: ชื่อกรอบ · % รวมตัวใหญ่ · "Buy x% · Sell y%" ตัวเล็ก (⚠ ถ้าเสี่ยง, "—" ไม่มีฝั่ง) · "N จุดเข้า" · กล่องจุดเข้าล่าสุด (📥 รอเข้า / ● ถือ ขอบเขียว / "ล่าสุด Buy · วันเวลา" + ราคา, ไม่มี = "ยังไม่มีจุดเข้า") · poll ทุก 60 วิ · หมายเหตุ: ราคาจุดเข้าโชว์บนหน้าสาธารณะ (ผู้ใช้เลือกเอง)
- ทดสอบ tilelive.mjs คอม + มือถือ ไม่มี error · commit 9f5f853

## 19 ต.ค. 2569 — ↩️ ช่อง 4 กรอบกลับมา: แสดงแค่ % Buy / Sell
- ผู้ใช้: "เอากลับมาแบบเดิม ให้แสดงแค่เปอร์เซ็นจุดเข้าในการซื้อ ฝั่ง Buy Sell" → คืน login.html จาก 7c8e876^ แล้วตัด: `.rl` (จริง x% / ชนะ W/L), `.hold` + renderHolds (ถือ / รอเข้า), แฟลช · เหลือ ชื่อกรอบ · Buy % · Sell % (⚠ ถ้า risky, "—" ถ้าฝั่งไม่มีจุดเข้า) · คำอธิบาย `.tcap` "% = อัตราชนะของจุดเข้าจากการทดสอบย้อนหลัง 2 ปี (ไม่รับประกันผลในอนาคต) · ⚠ = สัญญาณเสี่ยง" · loadStats ครั้งเดียว (+ ตอนกลับมาที่แท็บ) ไม่ poll 30 วิ
- ทดสอบ tilelive.mjs (ตัวเลขจริงจาก blogGET: 84/53 · 56/— · 87/— · 80/65) คอม + มือถือ ไม่มี error · commit e551490

## 19 ต.ค. 2569 — ✂️ หน้าสมัคร: เอาช่องผลงาน 4 กรอบออก
- ผู้ใช้ (ภาพช่อง 5m/15m/30m/1h): "เอาออกไปเลย ไม่เอาแล้ว" → login.html ลบ `<section class="rec">` (#tiles + .tcap), CSS `.rec*` ทั้งหมด, JS loadStats / renderRecent / renderHolds / REC / TILE_TF / money (ไม่ fetch `/api/market?blog=1&stats=1` ทุก 30 วิแล้ว) · `lib/blog.mjs` tiles/openTiles ยังอยู่ (ไม่มีหน้าไหนใช้แล้ว — welcome ใช้ tfs/recent/others/all) · (ผู้ใช้สั่งคืนแล้ว — ดูหัวข้อถัดขึ้นไป)
- ทดสอบ gold-signal-tools/loginshot.cjs (ใหม่: คอม + มือถือ ไม่มี error) · commit 7c8e876

## 19 ต.ค. 2569 — 📥 จุดเข้าแม่นขึ้น: รอราคาย่อแล้วค่อยเข้า (Buy 5m · 30m · 1h)
- ผู้ใช้: "ขอแม่นยำจุดในการเข้า" → วิจัย limit entry (newidea.js `LIMIT=1 THROUGH=0.3`, รายงาน research/indicators/report-2026-10-19-limit*.txt) → เลือก **"ทั้ง 3 กรอบ Buy"**
- ผลทดสอบ 2 ปี (ต้องผ่านราคา $0.3 ถึงนับว่าได้เข้า): 1h ย่อ $3/6 ชม. 77% +$522 → **80% +$775** (ทุกช่วงกำไร ล่าสุด +$105) · 30m ย่อ $5/3 ชม. 81% +$355 → **87% +$833** (ล่าสุด +$1) · 5m ย่อ $5/1 ชม. 75% +$195 → **84% +$1,750** (ล่าสุดยัง −$75 → ยังเสี่ยง) · ไม้น้อยลง 10–20%
- โค้ด: signals.js (pending/fillBy/expired) · chartsys.js (`dip`/`dipH`, levelsFor, trade) · test-stats.json · chart-run.js LINE "📥 รอเข้าที่ … ภายใน N ชม. — ตั้ง Buy Limit ได้เลย · ราคาไม่ถึง = ยกเลิก" + log filled/cancelled · chartzones (หัวการ์ด "📥 รอเข้า…", เส้นจุด "รอเข้า", ช่อง Buy "รอเข้า X (ย่อ $N ภายใน N ชม.)") · main.js การ์ดหน้าแรก + ช่อง 📥 ในการ์ดระดับราคา · easy.js · chartchat.js · lib/blog.mjs `openTiles` รวม pending (`wait`, `until`) · login.html ช่อง "รอเข้า Buy X"
- แก้เพิ่ม: `CHART_NOTIFY` บรรทัด 22 คอมเมนต์ `//` กลืน `.split` (เดิมเป็น string — บังเอิญยังใช้ได้) → `/* */` · ข้อความ "ไม่ส่ง LINE" ของสัญญาณเสี่ยง (riskText, easy, login, main, welcome) ไม่ตรงแล้ว → แก้
- ทดสอบ: dry run recorder (สัญญาณ 30m จริงออกเป็น "📥 รอเข้าที่ 4,178.91 (ราคาตอนนี้ 4,183.91 · รอย่อ $5)") · unit test fill/expire · tpcheck.cjs (รอเข้าทั้ง 3 กรอบ) · tilelive.mjs (+ช่อง 30m รอเข้า) · errscan.cjs (ใหม่: ทุกแท็บ + welcome/login คอม/มือถือ ไม่มี error) · dipshot.cjs (ภาพ compare) · commit 06de76d

## 19 ต.ค. 2569 — ↩️ Buy | Sell แบบละเอียด (อ่านง่ายขึ้น)
- ผู้ใช้: "เอาแบบเดิมกลับมา" → ถาม → "Buy | Sell แบบละเอียด" + "ปรับให้มันดูง่ายขึ้น" → `git show c4d1846^:login.html` แล้วปรับ: ป้าย เสี่ยง → `.wr` ⚠ ข้าง Buy/Sell · ลบ `.lbl` ในช่อง → `.tcap` ใต้ช่องครั้งเดียว · ผลจริง "จริง N%" + "ชนะ W/L" · "ยังไม่มีผลจริง" / "ไม่มีสัญญาณ" สีจาง · hold "● ถือ Buy · ±$" บรรทัดเดียว · **ช่องผลงานปัจจุบัน = แบบนี้ (ผู้ใช้ไม่ชอบแบบเรียบง่ายที่ไม่มี ชนะ W/L)**

## 19 ต.ค. 2569 — 🧹 ช่องผลงาน Buy / Sell แบบเรียบง่าย
- ผู้ใช้: "มันดูยุ่งเหยิงไป ออกแบบใหม่" → ถาม 3 แบบ (ตาราง / ปุ่มสลับ / ช่องเรียบง่าย) → **"ช่องเรียบง่าย"** → login.html ช่อง = `.tf` ชื่อกรอบ + `.wr` ⚠ (ถ้าฝั่งไหน risky) · `.bs` (.b / .s: small Buy/Sell + .pc %) · `.rl` "จริง x% · y%" · hold "● ถือ Buy · ±$" บรรทัดเดียว · `.tcap` คำอธิบายครั้งเดียวใต้ช่อง · ไม่มีป้าย เสี่ยง/คำอธิบายในช่องแล้ว

## 19 ต.ค. 2569 — 🟢🔴 ช่องผลงาน Buy | Sell
- ผู้ใช้: "จุดเข้า Buy และ Sell เห็นมีแต่ Buy" → lib/blog.mjs tiles[].buy / .sell (null = ไม่มีแถวทดสอบ = ไม่มีสัญญาณ) {tested, risky, live, wins, pnl} · openTiles รวม SELL · test-stats.json เพิ่ม 1h SELL {74, 65%, +593} · login.html ช่อง `data-tf` + `.sides` (`.sd.b` / `.sd.s`) แต่ละฝั่ง: ป้าย เสี่ยง · % ทดสอบ · "จริง N% (W/L)" หรือ "ไม่มีสัญญาณ" · hold "ถือ Buy/Sell" · flash เมื่อ JSON ของ buy/sell เปลี่ยน · tilelive.mjs ผ่าน

## 19 ต.ค. 2569 — 🔤 ช่อง 4 กรอบ: คำไม่ตัดกลาง
- ผู้ใช้: "คำในกรอบตก" → login.html `.rec .tile .nw { white-space: nowrap }` ห่อท่อน "ผลจริง N%", "(ชนะ W จาก L)", "● กำลังถือ", "เข้า X", "ต่อออนซ์" · "ผลจริง: ยังไม่มีรายการ" (สั้นลง) · ตรวจ scrollWidth ช่อง 1024/1280/1366 ไม่ล้น

## 19 ต.ค. 2569 — ➕ ช่องผลงาน 4 กรอบ (+15 นาที)
- ผู้ใช้: "อยากเพิ่มของ 15 นาทีด้วย เอาเป็น 4 กรอบ" → lib/blog.mjs `TILE = [5m, 15m, 30m, 1h]` · login.html ช่อง Buy · 15 นาที (เสี่ยง) · `.tiles` 4 คอลัมน์ / มือถือ ≤600px 2×2 · `TILE_TF` 4 กรอบ · 15m ยังกติกาเดิม (TP1, ทดสอบ 56%) และไม่อยู่ใน CHART_NOTIFY

## 19 ต.ค. 2569 — 📊 ช่องผลงาน: ผลจริงเป็น %
- ผู้ใช้ (ภาพแถว "ผลจริง 15 รายการ · ชนะ 7"): "ปรับตรงนี้ด้วย มันยังไม่สมส่วนกับเปอร์เซ็นต์" → login.html `.lbl` "ชนะ · ทดสอบ 2 ปี" ใต้ % ใหญ่ · `.rl` = "ผลจริง **N%** (ชนะ W จาก L)" (`b.lw`) · tilelive.mjs ผ่าน คอม/มือถือ · ผลจริงที่มี = กติกาก่อนแบ่งปิดกำไร

## 19 ต.ค. 2569 — 🔔 LINE 5m/30m + 🎯 แบ่งปิดกำไร 5m/30m
- ผู้ใช้: "อยากให้มีเข้าทุกทามเฟรมเลย 5 30 1 ชั่วโมง" → ถาม (LINE / เข้าบ่อยขึ้น / แบ่งปิดกำไร) → "ทำมาทั้งหมด … ข้อ 1 กับ 2 และ 3" → ทดสอบข้อ 2 (qualtest `TH_DELTA=-1`, DATA_DIR = scratchpad/exit-th): ไม้ +40–50% แต่ 5m BUY +$344 (ช่วง 4 −574) · 30m +$957 (ช่วง 4 −222) · 1h +$820 (ช่วง 4 −114) · + แบ่งปิดกำไร: 1h 77% +$443 ช่วง 4 −246 · 5m ขาดทุน −$381 → แสดงตาราง → **ยืนยัน "ข้อ 1 + 3"**
- scripts/chart-run.js: `CHART_NOTIFY` ค่าเริ่ม **5m,30m,1h,5h,1d** · risky ส่ง LINE ได้ (เดิม `&& !risky`) + บรรทัด "⚠️ สัญญาณเสี่ยง — {risky} · ควรใช้ขนาดการซื้อขายเล็กกว่าปกติ" · paused (brake) ยังไม่ส่ง
- chartsys.js: 5m BUY `tps [5, 10, 15]` win 75 q [113,462,6,−445] · 30m BUY `tps [3.75, 15, 30]` win 81 q [67,244,143,−99] (tp1 false) · test-stats.json ตาม · index.html แท็บบัญชี: LINE ส่ง 5 นาที · 30 นาที (ติดป้ายเสี่ยง) · 5 ชม. · 1 วัน
- ตรวจ: tpcheck.cjs (trader view) 5m +5/+10/+15 · 30m +3.75/+15/+30 · 1h +7.5/+30/+60 · chart-run dry run ทำงาน · 15m / 1w / 5m SELL / 1h SELL ไม่เปลี่ยน (1h SELL ส่ง LINE ด้วยเพราะ 1h อยู่ใน CHART_NOTIFY และ risky ส่งได้แล้ว)

## 19 ต.ค. 2569 — ✂️ ช่องผลงานหน้าเข้าสู่ระบบ: ไม่แสดง $ สะสม
- ผู้ใช้ (ภาพแถว −$28.24 / −$0.22 / −$23.51 ต่อออนซ์): "เอาอันนี้ออก" → login.html `.rl` = "ผลจริง N รายการ · ชนะ M" เท่านั้น · แถว ● กำลังถือ ±$ ยังอยู่ · welcome.html ยังแสดง $ ครบ

## 19 ต.ค. 2569 — 🎯 1h BUY แบ่งปิดกำไร (ทดสอบชนะ 57% → 77%)
- ผู้ใช้: "ขอมากกว่า 70 ก็ได้ 50 เปอร์เซ็นต์ดูน้อยไป มันดูแบบเป็นแค่มือสมัครเล่น" → newidea.js `PARTIAL=1` (จุดเข้าเดิม, SL เดิม, 6 ลำดับเป้า × 5 กรอบ) → report-2026-10-19-partial.txt: ชนะ 72–85% ได้ทุกกรอบ แต่ช่วง 4 ขาดทุนเกือบหมด · ผ่านแบบเดียว **1h $7.5/$30/$60: 399 ไม้ 77% +$522 [234/245/34/9]** (เดิม 57% +$804) · 5h $19.8/60/120 82% แต่ช่วง 4 −$13 → ถาม → **"ใช้กับ 1 ชม."**
- chartsys.js: `SYS['1h'].buy.tps = [7.5, 30, 60]` (+ since, win 77, q) · `usdList(c)` ใช้ `c.tps` ถ้ามี (ทุกที่ใช้ usdList/levelsFor: chartzones, chartchat, easy, main, recorder `CS.trade`) · SIG.evaluate แบ่งเท่ากัน 3 ส่วน + SL → ทุนหลัง TP1 อยู่แล้ว · test-stats.json 1h BUY = {n 399, win 77, pnl 522, q} · indlab.js / verify.js ใช้ `c.tps ||` (รายเดือนจะได้ตัวเลขชุดเดียวกัน)
- ตรวจ: หน้ากราฟ 1h TP1 +7.5 / TP2 +30 / TP3 +60 · "ทดสอบชนะ 77%" · หน้าสัญญาณ 77% · commit 97248b7 · ผลจริง 2 รายการเดิมเป็นกติกาเก่า

## 19 ต.ค. 2569 — 🔬 วิจัยแนวคิดใหม่ (เป้าชนะ 80%) — ยังไม่เปลี่ยนระบบ (รอผู้ใช้)
- ผู้ใช้: "ทำแพ้บ่อย ชนะไม่ถึง 80% เลย เปลี่ยนความคิดใหม่ในการเทรด คิดวิเคราะห์ในการเข้าใหม่ หาจุดที่แม่นยำ และมีเหตุผลที่ชัดเจนในการเข้า"
- research/indicators/newidea.js (DATA_DIR = scratchpad/exit) → report-2026-10-19-newidea.txt · SIG.evaluate, สเปรด $0.4, 2 ปี 4 ช่วง, ผ่าน = กำไรช่วง 1–3 แล้วดูช่วง 4
- **A ย่อในแนวโน้ม** (กรอบใหญ่ขาขึ้น + แตะ EMA20 + แท่งกลับตัว + RSI 40–65, SL ใต้สวิง 5 แท่ง, TP 0.5–2×): **ขาดทุนทุกกรอบ** (5m −$394 ถึง −$2,231 · 30m/1h ขาดทุน) → ใช้ไม่ได้
- **B จุดเข้าเดิม + TP ใกล้** (0.25–1 × SL): ชนะ 75–87% ได้จริง แต่ส่วนใหญ่ขาดทุนช่วงหลัง · ผ่าน: **5h BUY TP 0.25×SL ($15 / SL $60) ชนะ 83% ทุกช่วง แต่ช่วง 4 แค่ +$3** (แพ้ 1 = ชนะ 4) · **1h BUY TP 0.75×SL ($22.5 เป้าเดียว / SL $30): ชนะ 60% +$1,062 ช่วง 4 +$82** (ระบบเว็บ 57% +$804 ช่วง 4 +$47) · 5h 0.75 ผ่านแต่ด้อยกว่าเว็บ (+$1,318 vs +$1,834) · 1d ทุกแบบช่วง 4 ขาดทุน · 5m/30m ชนะ 80% แต่ขาดทุน
- สรุปให้ผู้ใช้: 80% = ต้องตั้งเป้ากำไรเล็กกว่าจุดตัดขาดทุนมาก กำไรแทบไม่เหลือ · ทางเลือกที่มีเหตุผล: 1h เป้าเดียว $22.5 (ชนะ 57→60%) — 1 ใน 25 แบบที่ลอง (มีโอกาสเป็นโชค) · ถามแล้ว → ผู้ใช้เลือก **"ไม่เปลี่ยน"** (ระบบเดิมใช้ต่อ)

## 19 ต.ค. 2569 — 🔁 ช่องผลงานหน้าเข้าสู่ระบบ = 5m / 30m / 1h
- ผู้ใช้: "เอาเป็น 5 นาที 30 นาที 1 ชั่วโมง ได้ไหม ที่แสดงอยู่คนละทามเฟรม" → lib/blog.mjs เพิ่ม `tiles` (5m/30m/1h BUY: tested จาก test-stats.json, live/wins/pnl ทุกรายการ BUY ของกรอบนั้นรวม risky, risky = tf ≠ 1h) + `openTiles` (active BUY ของ 3 กรอบ: tf side entry at — ไม่มี SL/TP) · `tfs` เดิม (1h/5h/1d) ยังใช้ที่ welcome.html
- login.html: ป้าย `.rk` "เสี่ยง" ที่ 5m/30m · loadStats ใช้ `j.tiles` · `TILE_TF = ['5m','30m','1h']` · renderHolds ใช้ `REC.openTiles` · ทดสอบ tilelive.mjs (blogGET จริง + 5m ถือปลอม → ปิดชนะ +$15: 16 รายการ ชนะ 8 −$13.24 + flash)

## 19 ต.ค. 2569 — ⚡ ช่องผลงาน 3 กรอบ (หน้าเข้าสู่ระบบ) ขยับแบบเรียลไทม์
- ผู้ใช้: "อยากให้ตัวเลขขยับด้วยแบบเรียลไทม์เวลาเข้าไม้ของทามเฟรมไหนแล้วชนะหรือแพ้" → login.html: แต่ละช่องมี `.hold` (ซ่อนจนมีรายการ) · `renderHolds()` จับ j.open ตาม tf (1h/5h/1d) → `.tile.holding` ขอบเขียว + "● กำลังถือ · เข้า X" + ±$ จาก px ทุก tick (เรียกใน showPrice) · `data-sig` = live|wins|pnl เปลี่ยน → `.flash` (tileFlash 1.6 s) · loadStats ทุก 30 วิ (เดิม 60) · ทดสอบ gold-signal-tools/tilelive.mjs (open ปลอม → ปิดชนะ +$30: ช่องเปลี่ยนเป็น 3 รายการ ชนะ 2 +$6.49 + flash) คอม/มือถือ ไม่มี error

## 19 ต.ค. 2569 — ✂️ หน้าเข้าสู่ระบบ: ตาราง/คำอธิบายใต้ช่องผลงานออก
- ผู้ใช้ส่งภาพส่วนใต้ช่องผลงาน: "เอาออกไม่เอาแล้วข้อความนี้" → ถาม → "ทั้งหมดที่แคปมา" → login.html ลบ `.rhead`, `#rlist`, `#rnote`, `#reccap` (JS ยังอยู่ แต่เช็ก null: renderRecent / rnote / reccap) · เหลือช่อง 3 กรอบ + Demo · **welcome.html ไม่ได้แตะ** (ยังมีตาราง + ผลรวมครบ — ตัวเลขสาธารณะครบอยู่ที่หน้าแรก) · fold/signupui ผ่าน ไม่มี error

## 19 ต.ค. 2569 — ↩️ จุดเข้ากลับมาทุกกรอบเวลา
- ผู้ใช้: "เอาจุดเข้ามากลับมาทั้งหมด ทุกทามเฟรม" → `git checkout 169ab73^ -- chartsys.js main.js pro.js chartchat.js chartzones.js` (ลบลูป off + คืนข้อความ "⚠️ สัญญาณเสี่ยง" / "Sell มีแค่กรอบ 5 นาที") + บันทึกในคอมเมนต์ chartsys · ตรวจ SYS: 5m/15m/30m/1w buy, 5m sell, 1h sell = risky · 1h/5h/1d buy = on · หน้ากราฟ 5m/30m มีรายการบนกราฟ, 1w ป้ายเสี่ยง
- ตารางรายการล่าสุด (login/welcome) ยังระบบหลักเท่านั้น (ไม่ได้สั่งเปลี่ยน) · บรรทัดกรอบเสี่ยง: "ยังให้จุดเข้า ติดป้ายเสี่ยง ไม่ส่ง LINE" · welcome #others คืนข้อความ "ติดป้าย ⚠️ ไม่ส่ง LINE" · commit 67c0e99

## 19 ต.ค. 2569 — ✅ แบบ A: ตารางเฉพาะระบบหลัก + หยุดจุดเข้ากรอบเสี่ยง
- ผู้ใช้ (ภาพตารางรายการล่าสุด): "มันดูไม่น่าเชื่อถือเลย ติดลบมากกว่าบวกอีก แปลว่าเครื่องมือเรายังไม่แม่นยำมากพอ" → อธิบายตามตัวเลข (36/38 รายการ = กรอบเสี่ยง −$79.66 · ระบบหลักมี 2 รายการ) → ถาม A/B/C → "ทำมาหมดเลยอยากเห็นภาพตัวอย่างก่อน" → gold-signal-tools/variants.cjs + sheet.cjs → compare/preview/เลือกแบบ-ABC.png (เปิดให้ด้วย Start-Process) → **"ทำAมา"**
- chartsys.js: ลูปหลัง SYS `if (s[k].risky) s[k].off = 'เหลือเฉพาะกรอบที่ทดสอบผ่านทุกช่วง (19 ต.ค.)'` · ตรวจ: 5m buy/sell, 15m, 30m, 1w, 1h sell = OFF · 1h/5h/1d buy = on · chart-run.js dry run (สำเนาโปรเจกต์ + fetch_data.py) "no change"
- lib/blog.mjs `recent` = เฉพาะระบบหลัก (done) · login/welcome หัวตาราง "รายการล่าสุด · ระบบหลัก 1 ชม. / 5 ชม. / 1 วัน" + แถว "ระบบหลักออกสัญญาณไม่บ่อย (…)" ถ้าน้อยกว่า 5 · login `#rnote` / welcome `#others` = "กรอบเสี่ยง … ผลจริง 36 · ชนะ 14 · −$79.66 — หยุดให้จุดเข้าแล้ว ตั้งแต่ 19 ต.ค." · ยอดรวมทุกรายการยังแสดง
- ข้อความ: main.js recCard footnote · pro.js คู่มือ · chartchat "Sell มีแค่กรอบ 5 นาที" (4 จุด) · chartzones sellNo → "ตอนนี้ไม่มีกรอบไหนให้สัญญาณ Sell" · เว็บจริงตรวจแล้ว · commit 169ab73

## 19 ต.ค. 2569 — 🧾 รายการล่าสุดแบบเรียลไทม์ · 🔬 วิจัยตัวกรองเวลา (ไม่ผ่าน)
- ผู้ใช้ (ภาพช่องผลงาน 3 กรอบ): "ตรงนี้ดูน่าเชื่อถือแบบมีราคาติดลบด้วย อยากให้เรียลไทม์แต่ละไม้ที่ให้เข้า อยากให้แม่นยำกว่านี้" → ถาม 2 ข้อ → "รายการล่าสุด + รายการที่เปิดอยู่วิ่งสด" + "วิจัยใหม่ แต่ปรับเฉพาะถ้าผ่านจริง"
- lib/blog.mjs statsJSON → `recent` (6 รายการปิดล่าสุดทุกกรอบ เรียงตาม exitAt: tf side at exitAt entry exit pnl by risky) · login.html + welcome.html `#rlist` (`.rlist`, `.rhead`) — แถว ● กำลังถือ (j.open = 1h/5h/1d เท่านั้น ไม่โชว์ open ของกรอบเสี่ยง = ไม่แจกสัญญาณฟรี) ราคาเข้า → ราคาสด ±$ อัปเดตทุก tick · ปิดแล้ว ✅/❌ เวลา · กรอบ · ป้าย "เสี่ยง" · เข้า → ออก · ตัดขาดทุน/ถึงเป้า/หมดเวลา · ±$ · welcome แสดง open ใน #holding อยู่แล้ว (REC.open = []) · ทดสอบ gold-signal-tools/recenttest.mjs (API จริงผ่าน blogGET + open ปลอม) · เว็บจริงตรวจแล้ว · commit 01e62b0
- research/indicators/qualtest.js `TIME=1`: กรองช่วงตลาด (เอเชีย 07–14 / ลอนดอน 14–19 / นิวยอร์ก 19–03 ไทย) + วันในสัปดาห์ 7 แบบ × 1h/5h/1d BUY (DATA_DIR = scratchpad/exit, ข้อมูลถึง 16 ต.ค.) · **0/21 ผ่านเกณฑ์ช่วง 1–3** → ไม่เปลี่ยนระบบ · report-2026-10-19-time.txt · qual-1h.json ไม่มี 1h SELL (สร้างก่อนเพิ่ม Sell) — ถ้าจะวิจัย Sell ต้องลบ cache แล้วสร้างใหม่
- สรุปการวิจัยทั้งหมด (15–19 ต.ค.): ตัวกรอง ~200 + SL/TP 72 ต่อกรอบ + หลายกรอบตรงกัน + ช่วงเวลา 21 → ไม่มีอะไรดีขึ้นสม่ำเสมอ · **อย่าวิจัยซ้ำแนวเดิม** ทางที่เหลือ = เก็บผลจริง 20–30 รายการต่อกรอบ แล้วเทียบกับผลทดสอบ

## 19 ต.ค. 2569 — 📊 LINE สรุปรายสัปดาห์ (เสาร์) กลับมา
- ผู้ใช้: "ไม่เห็นสรุปของวันเสาร์เลย ที่จะสรุปตั้งแต่จันถึงศุกร์ ว่าเป็นยังไงสัปดาห์นี้" (+ ส่งภาพ LINE ศุกร์: ภาพรวมเช้า 7.38 + เตือนข่าว 9.51 — "เอาแบบเดิมกลับมานะที่แจ้งเตือน")
- สาเหตุ: weekly-summary.yml `SEND: inputs.send || false` ตั้งแต่ e901d01 (9 ต.ค. ผู้ใช้ขอ LINE = จุดเข้า + ข่าวเท่านั้น) → รันทุกเสาร์แต่ dry run
- แก้: `SEND: github.event_name == 'schedule' || inputs.send == true` · `RECORD` และขั้น Save results เฉพาะ schedule · input `week_of` → env `WEEKLY_AT` (weekly.js ใช้แทน Date.now()) รายงานสัปดาห์ย้อนหลังได้ · ทดสอบ dispatch send=false week_of=2026-10-17T07:30:00+07:00 → ข้อความครบ
- **LINE ปัจจุบัน = แบบเดิม: ภาพรวมเช้า 07:05 · เตือนข่าวแรง 30 นาที · จุดเข้า 1h/5h/1d · สรุปเสาร์ 07:30** (ผล TP/SL/ปิดรายการยังไม่ส่ง ตาม 9 ต.ค.) — อย่าปิดข้อความประจำเหล่านี้อีก
- ส่งย้อนหลังด้วยมือ: `gh workflow run weekly-summary.yml -f send=true -f week_of=<เวลาในสัปดาห์นั้น>` · ภาพรวมเช้า: `gh workflow run morning-plan.yml -f send=true -f record=false` (ส่งถึงทุกคนที่เพิ่มเพื่อน — ถามผู้ใช้ก่อน)
- 19 ต.ค. 08:52 ผู้ใช้ "ส่งทั้งคู่" → ส่งสรุปสัปดาห์ 12–16 ต.ค. + ภาพรวมเช้าวันนี้ด้วยมือ ✓ sent to LINE ทั้งคู่ · โควตา LINE 2026-10: 65/300 (คาด 110) · **LINE OA มีเพื่อน 1 คน และ web push 0 เครื่อง** — สมาชิกยังไม่ได้เพิ่มเพื่อน/เปิดแจ้งเตือน

## 19 ต.ค. 2569 — 🔔 LINE ภาพรวมเช้ากลับมา · 📱 หน้าสมัครมือถือเล็กลง · ⚡ หน้าสัญญาณเบาลงตอนตลาดเปิด
- ผู้ใช้ (จันทร์เช้า): "ทำไมไม่เห็นมีการแจ้งเตือนตอนเช้าแล้ว ปกติมี และอยากให้ปรับในโทรศัพท์ให้ดูเล็กลงอีกนิด มันดูใหญ่ไปตอนเปิดสมัครสมาชิก" → "ทำมาให้มีแจ้งเตือนด้วย ถ้าคนสมัครเข้ามาแล้วไม่มีแจ้งเตือนจะไม่เป็นไปตามที่เราตั้งเป้าไว้ ให้มีแจ้งเตือนทุกครั้งก็ต่อเมื่อมีสัญญาณในการเข้า เอาแบบเดิมกลับมาที่แจ้งเตือนในไลน์" → ถาม (มีตัวเลือกกรอบเสี่ยง) → เลือก **"แบบเดิม: 1 ชม. / 5 ชม. / 1 วัน"**
- สาเหตุ: 17 ต.ค. ปิด LINE ภาพรวม 07:05 (รอบ "ลดส่วนไม่สำคัญ") + ตั้งแต่ 16 ต.ค. ยังไม่มีจุดเข้า 1 ชม./5 ชม./1 วัน → สมาชิกไม่ได้ LINE เลย · **บทเรียน: ห้ามปิดข้อความ LINE ที่ส่งประจำ — ผู้ใช้ถือว่า "มีแจ้งเตือน" เป็นเป้าหมายของบริการ**
- scripts/morning-plan.js: ส่ง flex ภาพรวมเป็นค่าเริ่มต้น (`MORNING_LINE !== 'off'`), kind 'extra' (โควตาใกล้หมด → web push) · CHART_NOTIFY ยัง 1h,5h,1d · index.html แท็บบัญชี: "ทุกครั้งที่มีจุดเข้า · ภาพรวมทองคำทุกเช้า 07:05 น. (วันทำการ)" · ทดสอบ: scripts/test-notify-kinds.js ผ่าน · dry run morning-plan (สำเนาโปรเจกต์ + fetch_data.py) สร้าง flex 2,236 bytes · วันนี้ 07:05 ผ่านไปแล้ว (market-gate ส่งวันละครั้ง) → เริ่มส่งพรุ่งนี้
- login.html `@media (max-width: 600px)`: โลโก้ 28px (ต้องใช้ `.pm .pm-brand` ชนะ premium.css) หัวข้อ 18px ขั้นตอน/แท็บ/ช่องผลงาน/FAQ/ป้ายเล็กลง · Clerk `PHONE` → fontSize 14px, ปุ่ม Google padding 9px, headerTitle 18px, card padding 18/16, **formFieldInput 16px** (iPhone ซูมถ้าเล็กกว่า 16) · มือถือ 390×664 แท็บสมัคร ปุ่มดำเนินการต่อ 639–672 (ในจอ)
- main.js onStreamTick: `render()` เต็มทุกวินาทีเฉพาะ `location.hash === '#chart'` · แท็บอื่น `renderMarket(price)` + renderIntra + renderSignalHome · `UI.on('tab:chart')` เรียก `render()` ก่อน · ตรวจ gold-signal-tools/chartcatch.cjs (แท่งล่าสุด = ราคาสด หลังอยู่หน้าสัญญาณ 20 วิ) · ตัวรับราคาสดใช้เวลา ~1.1 → 0.5 วิ/10 วิ (CPU×4) · busy.cjs ตอนตลาดเปิดแกว่งมาก (37–58%) เทียบได้แค่คร่าว ๆ
- เช็กวันจันทร์: ราคาสด welcome/login วิ่ง (9 ค่าใน 12 วิ, LIVE) · soak หน้าสมาชิก: ปกติ 17 ครั้ง/20 วิ, สตรีมหลุด/เงียบ/พับแท็บ ต่อเองได้ · loop สัญญาณ 00:36–01:05 UTC success ("no open signal") · commit f4d49a4

---

> 📦 **บันทึก 17 ต.ค. 2569 และก่อนหน้า + "🗄️ ข้อ 1 เดิม (5–8 ต.ค.)" ย้ายไป [Skill-archive.md](Skill-archive.md)** (20 ต.ค. 2569 — ไฟล์นี้ใหญ่ 490 KB อ่านยาก) · เนื้อหาครบ ไม่ได้ลบ · หาเรื่องเก่าให้ค้นในไฟล์นั้น
