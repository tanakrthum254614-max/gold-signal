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
| เว็บจริง | https://gold-signal-ten.vercel.app (alias: thander-gold-signal.vercel.app) |
| โค้ด (Public) | https://github.com/tanakrthum254614-max/gold-signal — push `main` = deploy อัตโนมัติ |
| Vercel | scope `thander1`, project `gold-signal` = **เว็บจริง** (ใช้ CLI `npx vercel`, ล็อกอินเป็น tanakrthum2546-3404) · repo นี้ผูกกับโปรเจค `thander2/gold-signal` ด้วย (สถานะ "Vercel – gold-signal" บน GitHub มาจากตัวนั้น ไม่ใช่เว็บจริง — preview ของมันถูกล็อก เข้าทดสอบไม่ได้) · ทดสอบ preview ให้ใช้ `npx vercel ls gold-signal` → URL `-thander1` แล้ว `npx vercel curl <url>` |
| ล็อกอิน | **สมาชิกเท่านั้น** (8 ต.ค. 2569) — Clerk dev instance `delicate-tapir-2101` (สมัครด้วยอีเมล+รหัสผ่าน ยืนยันโค้ดทางอีเมล หรือ Google) บน `login.html` → ตรวจฝั่งเซิร์ฟเวอร์ใน `middleware.js` · `?demo=1` เลิกใช้แล้ว · ระบบรหัส GOLD-… ถูกลบแล้ว |
| LINE OA | `@279arudw` · เพิ่มเพื่อน https://line.me/R/ti/p/@279arudw |
| Secret | GitHub Actions secret `LINE_CHANNEL_ACCESS_TOKEN` (Channel access token *long-lived* จากแท็บ Messaging API) |

## 0. ทำงานเสร็จแล้วต้องทำต่อ (ทุกครั้ง)
1. ทดสอบในเครื่อง (ภาพหน้าจอมือถือ + คอม, ไม่มี error · เรื่องราคา/ความเร็ววัดด้วย puppeteer-core แบบเวลาจริง)
2. เปลี่ยนกติกาสัญญาณ → ทดสอบย้อนหลังก่อน รายงานผลตามจริง (รวมที่ขาดทุน)
3. **อัปเดต `compare.html`** — เพิ่มหัวข้อใหม่ไว้บนสุด: 🕰️ แบบเก่า vs ✨ แบบใหม่ (ภาพใน `compare/`; ภาพแบบเก่าถ่ายจากโค้ดก่อนแก้ด้วย `git worktree add <dir> <commit>` + `PORT=3001 node dev-server.js` แล้วปิด server ก่อนลบ worktree)
4. เปลี่ยนเลข `?v=` → commit → push → เช็กว่าเว็บจริงได้ไฟล์ใหม่ · แก้ workflow → สั่งรันทดสอบ (send=false)
5. อัปเดต Skill.md + สำเนา `.claude/skills/gold-signal/SKILL.md` + memory
6. **อัปเดตพอร์ตโฟลิโอ** https://web-tan-portfolio.vercel.app/#activities (ผู้ใช้สั่ง 8 ต.ค. 2569) — repo `C:\Users\HP\tan-portfolio`: สไลด์ "Slide 4: Gold Signal" ใน `projects-modal` แก้ **ทั้ง index.html และ Portfolio.html** (ต้องเหมือนกัน) ให้คำอธิบาย/แท็ก/ข้อความในภาพตรงกับเว็บล่าสุด · เช็กในเครื่อง (รอ intro ~9 วิ แล้วเปิด modal + `projGoTo(3)`) → commit + push → เช็กว่าเว็บจริงมีข้อความใหม่ · ถ้างานไม่เปลี่ยนสิ่งที่ผู้ใช้เห็น (เช่นแก้บั๊กเล็ก) ไม่ต้องแก้สไลด์ แต่ต้องบอกว่าข้าม

---

## 1. ระบบสัญญาณตอนนี้ (ตรวจกับโค้ด 15 ต.ค. 2569)

> ข้อ 1–7 = สภาพปัจจุบันของโค้ด · ที่มาของแต่ละเรื่องอยู่ใน "บันทึกการเปลี่ยนแปลง" · รายละเอียดเดิมของข้อ 1 (5–8 ต.ค.) ย้ายไปไว้ท้ายไฟล์ "🗄️ ข้อ 1 เดิม" — หลายส่วนในนั้นยกเลิกแล้ว อย่าใช้เป็นข้อมูลปัจจุบัน

### ⭐ ระบบหลัก = CHARTSYS (สัญญาณบนกราฟรายกรอบ) — ตั้งแต่ 9 ต.ค. 2569 · หน้าสัญญาณ/LINE "ระบบหลัก" = `CHARTSYS.MAIN_TF` = **1h** (30m จนถึง 15 ต.ค.)
- **กติกาอยู่ที่ `chartsys.js` ที่เดียว** (UMD, **โหลดก่อน main.js**) ใช้ร่วมกันระหว่างเว็บ (`chartzones.js`, `main.js`, `chartchat.js`) และ `scripts/chart-run.js` · `SYS[tf]` มี `buy`/`sell` แยก `{ risky?, th, tp1, mult, confirm?, since?, win, q }` · ฝั่งที่ทดสอบไม่ผ่านไม่มี key (มีแค่ `sellQ` ไว้แสดง) · **`risky: '<เหตุผล>'` = สัญญาณเสี่ยง**: ยังมีจุดเข้าบนกราฟ + บันทึก (`risky: true` ในไม้) แต่ติด ⚠ ท้ายป้าย, คำตัดสิน "⚠️ มีสัญญาณ แต่เสี่ยง", `CHARTSYS.riskText(c)` บอกเหตุผล, **ไม่ส่ง LINE** (chart-run เช็ก `!risky` ด้วย) และไม่ใช่ระบบหลัก · `sideInfo` คืน `risky`
- คะแนน = โหวตตัวชี้วัด (`indicators.js`) ของหลายกรอบรวมกัน ผ่าน `INTRA.decideWith` · `CHARTSYS.dirOf` ตัดสินจุดเข้า (เกณฑ์ + ตัวยืนยัน + noChase + ข่าวเฉพาะกรอบที่ `news: true`) · `sideInfo` = % ความพร้อมเข้า + คำตัดสิน (✅ / ⏸ / ⚠️ / ⛔) ใช้ทุกหน้า · `levelsFor`/`usdList` = SL/TP (SL $15 × `mult`, `tp1: true` = TP1 อย่างเดียว ไม่งั้น TP $15/20/30 × mult — ค่าคงที่ใน usdList **ไม่ใช่ `INTRA.RULE.tpUsd`** ซึ่งเป็น [15]; บั๊ก 9–15 ต.ค. ทำให้ 1h/5h/5m SELL ได้ TP1 อย่างเดียว)
- **จุดเข้าปกติ (15 ต.ค. 2569): 1h BUY · 5h BUY · 1d BUY** · เสี่ยง (risky): 5m BUY (ช่วงล่าสุดขาดทุน) · 5m SELL (ผลจริง 14 ไม้ ชนะ 4 vs ทดสอบ 53%) · 15m (กำไรน้อยมาก) · 30m (ขาดทุน) · 1w (ไม้น้อย ไม่สม่ำเสมอ)

| กรอบ | กรอบที่ใช้คิด | BUY | SELL | หลบข่าว ±30 นาที |
|---|---|---|---|---|
| 5m | 5m · 30m · 1h | ⚠️ เสี่ยง: +5 · TP1 · SL $15 | ⚠️ เสี่ยง: −6 + SMA20<50 · SL $10 · TP $10/13/20 | ✅ |
| 15m | FRAMES15 (15m · 1h · 5h) | ⚠️ เสี่ยง: +6 + EMA9>21 · TP1 · SL $22.5 | ไม่ผ่าน | — |
| 30m | FRAMES (30m · 1h · 5h) | ⚠️ เสี่ยง: +5 · TP1 · SL $15 | ไม่ผ่าน | — |
| **1h (หลัก, หน้าแรก)** | 1h · 4h · 5h | +5 · SL $30 · TP 30/40/60 | ไม่ผ่าน | ✅ |
| 5h (long, ถือ ≤ 5 วัน) | 5h · 1d | +3 + ROC12 · SL $60 · TP 60/80/120 | ไม่ผ่าน | — |
| 1d (long, ≤ 20 วัน) | 1d · 1w | +3 · TP1 · SL $120 | ไม่ผ่าน | — |
| 1w (long, ≤ 84 วัน) | 1w | ⚠️ เสี่ยง: +1 · TP1 · SL $300 | — | — |

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
- **หลังบ้าน** `/admin.html` (อีเมลใน env `ADMIN_EMAILS`): สมาชิก, บันทึกการเข้าใช้ (`access/log.json`), ระงับ/คืนสิทธิ์, เขียนบทความ · `new-members.yml` ทุก 15 นาที: `new-members.js` (แจ้งสมาชิกใหม่) + `watchdog.js` (ตัวบันทึกหยุด/ค้าง/ล้ม) → web push เฉพาะเครื่องแอดมิน (+ LINE push เจ้าของถ้ามี `LINE_OWNER_ID`) — **ห้าม broadcast**
- **Vercel Functions** `api/*.mjs` (journal, articles, coach, news) + `lib/gs.mjs` (ก๊อปจาก middleware — **แก้ต้องแก้ทั้งสองที่**) · ข้อมูลใน Vercel Blob · ระบบชำระเงินเก็บไว้ที่ branch `payments-shelved` (ทุกอย่างฟรีตอนนี้)

---

## 2. โครงสร้างไฟล์

```
หน้าเว็บ
index.html      แอปหลัก (6 แท็บ) — asset ทุกตัวมี ?v=<เวอร์ชันของไฟล์นั้น> · "เวอร์ชัน N" ในหน้าบัญชี
login.html      เข้าสู่ระบบ / สมัคร (Clerk clerk-js@6 + @clerk/ui@1) · privacy.html (สาธารณะ) · admin.html (หลังบ้าน)
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
  morning-plan.yml   cron 00:05 + 01:05 UTC จ.–ศ. → market-gate.js (07:05 / 08:05 หน้าหนาว) · จันทร์สร้าง backtest ใหม่
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

## 🖼️ ข่าว: รูปผ่าน wsrv.nl + ลิงก์สำรอง Google News (17 ต.ค. 2569 · เวอร์ชัน 202610170000)
- ผู้ใช้: "เครื่องอื่นรูปภาพไม่ขึ้นโชว์ และกดเข้าไปขึ้น 403" → สาเหตุ Cloudflare ของ investing.com บล็อกบางเครื่อง · รูปผ่าน wsrv.nl (ทดสอบ 8/8 ขึ้น) · ลิงก์สำรอง Google News · หน้าบทความ 403 แก้ที่ต้นทางไม่ได้ · newsstats.js / terminal.css v=202610170000

## 📱 iPhone แนวนอน: viewport-fit=cover กลับมา (16 ต.ค. 2569 · เวอร์ชัน 202610162300)
- รูปจาก iPhone 13 ผู้ใช้: หน้าโหลดเลื่อนขวา ~110 px ตกขอบขวา → สาเหตุ: ไม่มี viewport-fit=cover แล้ว Safari เว้นฝั่งรอยบากแต่ชั้น fixed ยังกว้างเท่าจอ · แก้: head script ใส่ viewport-fit=cover กลับ + terminal.css html.vp-scaled body padding env(safe-area-inset-left/right), #tabbar left env(left), appbar padding-right · จำลองรอยบาก 82px ใน Chrome: หน้าโหลดกลางจอ, เมนูหลบ, ไม่ล้น · **อย่าเอา viewport-fit=cover ออกอีก** · รอผู้ใช้ยืนยันบน iPhone

## 📱 หน้าโหลดบน iPhone (16 ต.ค. 2569 · เวอร์ชัน 202610162200)
- ผู้ใช้: "เปิดในโทรศัพท์ยังไม่ตรงกลางเลย" (Chrome จำลองตรงกลางแล้ว) → สันนิษฐาน: แถบเครื่องมือ Safari บังส่วนล่างของ layer fixed inset:0 → ท้าย splash.css .splash height 100svh/100dvh, top 0, bottom auto · ยังรอรูปจาก iPhone ยืนยัน

## 🎯 หน้าโหลดตรงกลาง (16 ต.ค. 2569 · เวอร์ชัน 202610162100)
- ผู้ใช้: "หน้าตอนโหลดยังไม่ตรงกลาง เอาให้ตรงกลาง" → วัดแล้วกล่องเนื้อหาอยู่กลางจอทุกขนาด แต่ระหว่าง animation ข้อความ .sp-sub พิมพ์จากขอบซ้าย (clip-path) และ .sp-cbar เติมซ้าย→ขวาบนช่องที่แทบมองไม่เห็น → ท้าย splash.css: `spTypeMid` เปิดจากกลาง (ไม่มี caret) + `.sp-cbar i::before` แท่งจางในช่องว่าง, เส้นช่อง .16 · ดีไซน์/ความเร็วเดิม (MIN_MS 4000) · splash.css v=202610162100 · ทดสอบ gold-signal-tools/splashcenter.cjs · commit 14c2332

## ⭐ ติดตามกูรู · 🔔 แจ้งเตือนซื้อขาย · ARK รายวัน (16 ต.ค. 2569 · เวอร์ชัน 202610162000)
- ผู้ใช้: "เพิ่มเติมอะไรไหม" → เสนอ ARK รายวัน / แจ้งเตือน / ติดตาม → "ทำมา" · ทำครบ 3 · gurus-live รันบน GitHub ผ่าน (ดาวน์โหลด CSV ARK ได้) · รายการ ARK จริงอันแรกจะขึ้นเมื่อ ARK อัปเดตไฟล์วันถัดไป · commit c81dd94

## ⚡ พอร์ตกูรูเรียลไทม์จาก SEC (16 ต.ค. 2569 · เวอร์ชัน 202610161900)
- ผู้ใช้: "ขอทุกอย่างแบบเรียลไทม์" → ไล่ดูแล้วส่วนอื่นสดอยู่แล้ว (ราคาทอง 1–3 วิ, หุ้นสหรัฐ stream, ข่าว 1 นาที) · ส่วนที่ไม่สดคือรายการหุ้นกูรู → ฟีด SEC ทุก 10 นาที (ฟอร์ม 4 / 13D / 13G / 13F ใหม่) + 13F ใหม่อัปเดตพอร์ตทันที · ตัวอย่างจริง: บัฟเฟตต์ซื้อ LEN 4 ครั้ง → ถือ 28.4 ล้านหุ้น · ARK รายวันยังไม่ได้ทำ · commit 10249e4

## 🖼️ พอร์ตกูรู: ทุกคนมีภาพ (16 ต.ค. 2569 · เวอร์ชัน 202610161800)
- ผู้ใช้: "เอาให้มีทุกคนสิรูป เว้นว่างไว้มันดูไม่น่าเชื่อถือในการใช้งาน" → รูปบุคคลเสรี 14 · โลโก้กองทุน 8 · ป้ายชื่อกองทุนสีทอง 6 (บอกผู้ใช้ว่าไม่เอารูปมีลิขสิทธิ์) · แก้หน่วย Oaktree · zframes gurus.js v=2026101607 style v=2026101612 · data branch ยืนยัน {photo 14, logo 8, mark 6} · commits 24452a4, 05745ba, a481511

## 📸 รูปกูรู (16 ต.ค. 2569 · เวอร์ชัน 202610161700)
- ผู้ใช้: "อยากให้แสดงรูปของแต่ละคนด้วย" → รูปจาก Wikimedia Commons เฉพาะสัญญาอนุญาตเสรี 13 คน (บัฟเฟตต์ PD, เกตส์ CC BY 4.0, แอคแมน, ดาลิโอ, คลาร์แมน, เทปเปอร์, ไอคาห์น CC0, แมนเดล, แคธี่ วูด, มาร์คส์, โซรอส, มังเกอร์) · ที่เหลือตัวอักษรย่อ · zframes gurus.js v=2026101603 style v=2026101609 · zframes-refresh รันจริง: data branch มีรูป 13 · commit 222e2bc

## 🧑‍💼 พอร์ตกูรู แบบ Dime (16 ต.ค. 2569 · เวอร์ชัน 202610161600)
- ผู้ใช้ (รูป Dime Guru Portfolio): "อยากให้ทำเหมือนแอป dime แบบเรียลไทม์ ที่มีผู้เชี่ยวชาญ" → เลือก "แท็บย่อยในหุ้นสหรัฐ" + "เอาหลายคนมากกว่า 20" → 28 กูรูจาก 13F · บอกผู้ใช้แล้วว่า 13F รายไตรมาส (ช้าสุด 45 วัน) — ส่วนเรียลไทม์คือมูลค่าตามราคาสด · zframes-refresh รันจริงบน GitHub: 28 gurus บันทึกลง data branch · commit 2a2d712

## 👀 หน้า Demo สำหรับคนยังไม่สมัคร (16 ต.ค. 2569 · เวอร์ชัน 202610161500)
- ผู้ใช้: "ตอนให้คนแสกน … อยากให้มี Demo ให้สมัครสมาชิก ถ้าคนไม่สมัครสมาชิกจะไม่เห็นเส้นสัญญาณ … เป็นกราฟแท่งปกติ … แชทถามตอบจะไม่มี · ถ้าสมัครจะเห็นทุกอย่าง" (เปลี่ยนจากเดิมที่ไม่มี demo) → demo.html (public) กราฟแท่งเทียนล้วน + การ์ดล็อก + ปุ่มสมัคร · login.html ปุ่ม Demo · middleware PUBLIC += demo.html · เว็บจริง: demo 200, chartsys/chartzones/chartchat/main/chart-signals.json 401 · commit 217b9f1

## 📮 LINE: ข้อความตอบอัตโนมัติ + รูปชวนเพิ่มเพื่อน QR (16 ต.ค. 2569 · ไม่ได้แก้เว็บ)
- ผู้ใช้: "ทำต่อ้ลย" → `gold-signal-tools/lineqr.cjs <outDir> <previewDir>` (npm qrcode, ECC H + โลโก้กลาง) → Downloads gold-signal-line-addfriend-poster.png (1080×1350) / -square.png (1080×1080) · QR = https://line.me/R/ti/p/@279arudw — ถอดด้วย jsQR แล้วอ่านได้ทั้งสองไฟล์ · gold-signal-line-ตั้งค่า.txt เพิ่มข้อ 5 ข้อความ Auto-response (ตอบทุกข้อความ: ตอบแชทไม่ได้ → ปุ่มเมนู/เว็บ) และข้อ 6 รูป QR · ข้อความตอบกลับ (reply) ไม่กินโควตา

## 📨 กันโควตา LINE (16 ต.ค. 2569 · เวอร์ชัน 202610161400)
- ผู้ใช้: "ต้องเพิ่มอะไรไหมที่สำคัญ" → ชี้ว่า LINE ฟรี 300/เดือนนับต่อคน (51/เดือน × 6 เพื่อน ≈ เกิน → หยุดส่งรวมสัญญาณ) → "ทำมา" · notify.js kinds signal/extra/admin + lineRoom (สำรองสัญญาณ 15 รอบ) · morning-plan/intraday-run/weekly = extra · notify-failure/line-quota = admin (เดิม broadcast ถึงทุกคน) · หน้าบัญชีบอกให้เปิดแจ้งเตือนบนเครื่อง · test-notify-kinds.js ผ่าน 8 กรณี · ตอนนี้เพื่อน 1 คน = ส่ง LINE ครบเหมือนเดิม · ผลจริง 8 วันแรก (chart-signals.json): 1h BUY 2 ไม้ (1/1, −23.5) · 5m BUY 11 (6/5, +5.1) · 5m SELL 14 (4/10, −51.2) · 30m BUY 6 (2/4) — น้อยเกินสรุป · commit 9b6b2fc

## 🔧 ข้อความ LINE เช้า: ระบบหลัก 1 ชม. (16 ต.ค. 2569 · เวอร์ชัน 202610161300)
- เห็นจากรูป LINE ของผู้ใช้: ภาพรวมเช้าเขียน "จึงใช้สัญญาณ 30 นาทีเป็นหลัก" (ล้าสมัย) → scripts/morning-plan.js "จึงใช้ระบบหลัก 1 ชม. เป็นหลัก (ส่งแยกเมื่อถึงจุดเข้า)" · index.html #sgAdv (ซ่อนอยู่) แก้ตาม · chart-run.js คอมเมนต์ CHART_NOTIFY = 1h,5h,1d · commit 4727c76
- ผู้ใช้ถามบัญชีรับรอง LINE: ยื่นที่ Settings → Account settings (ฟรี) · ต้องมีข้อมูลธุรกิจ/ทะเบียน/หน้าร้าน · บริการสัญญาณลงทุนอาจไม่ผ่าน — บอกผู้ใช้ตามจริงแล้ว

## ✅ ตั้งค่า LINE @279arudw เสร็จ (16 ต.ค. 2569 · ไม่ได้แก้เว็บ)
- ผู้ใช้ตั้งเองใน manager.line.biz: รูปโปรไฟล์ = แบบ C (เหรียญ XAU) · ริชเมนู "Gold Signal เมนูหลัก" 6 ปุ่ม (?openExternalBrowser=1#tab) **แสดงถึง 31/12/2027 — ต้องต่อวันก่อนหมด** · Menu bar label "Gold Signal" (จำกัด 14 ตัวอักษร นับสระ/วรรณยุกต์ไทย) · ข้อความต้อนรับ (จำกัด 500 ตัวอักษร — ฉบับย่อ ~400) + User's display name · รูปปก
- **Response settings: Webhooks ปิด = ถูกต้อง** — ระบบส่งด้วย broadcast (scripts/line.js) และ push (admin-notify / new-members / watchdog) ไม่ต้องใช้ webhook · Greeting message เปิด · Chat ปิด · ไม่มีโค้ดตั้ง rich menu ผ่าน API (เมนูจาก manager จึงไม่โดนทับ)

## 💬 ชุด LINE + หน้าเข้าสู่ระบบพากลับแท็บเดิม (16 ต.ค. 2569 · เวอร์ชัน 202610161200)
- ผู้ใช้: "เพิ่มเติมอไรไหม" → เสนอรูปปก / ริชเมนู / ข้อความต้อนรับ → "ทำมา" · `gold-signal-tools/linekit.cjs <outDir> <previewDir>` → Downloads: gold-signal-line-cover.png (1080×878) · gold-signal-line-richmenu.jpg (2500×1686, 6 ปุ่ม 3×2 = home/chart/stats/zframes/journal/account, ไอคอนเส้นเดียวกับเมนูเว็บ) · gold-signal-line-ตั้งค่า.txt (ขั้นตอน manager.line.biz + ลิงก์ `https://gold-signal-ten.vercel.app/?openExternalBrowser=1#<tab>` + ข้อความต้อนรับ) · LINE เปิดลิงก์ในเบราว์เซอร์ของเครื่อง เพราะ Google ไม่ให้ล็อกอินใน in-app browser
- login.html: เก็บ `#tab` จากลิงก์ (fragment ติดมากับ 302 จาก middleware) ลง sessionStorage `gs-back` → หลัง /api/session สำเร็จ `location.replace('/' + back)` (รองรับ Google redirect) · ทดสอบ gold-signal-tools/loginback.cjs (#chart เก็บ, #signup/#bogus ไม่เก็บ) · ตรวจเว็บจริง: login.html มีโค้ดใหม่, /?openExternalBrowser=1 → 302 login.html · commit e78b7d8

## 🖼️ รูปโปรไฟล์ LINE (16 ต.ค. 2569 · ไม่ได้แก้เว็บ)
- ผู้ใช้: "ใน line อยากเปลี่ยนรูปโปรไฟล์ ขอลิ้ง" → บัญชี @279arudw เปลี่ยนที่ https://manager.line.biz (ตั้งค่า → ตั้งค่าบัญชี → รูปโปรไฟล์) หรือแอป LINE Official Account · "ขอรูป … เกี่ยวกับทองคำ" → `gold-signal-tools/lineprof.cjs <outDir>` ทำ PNG 1024×1024 3 แบบใน Downloads: gold-signal-line-A-logo (โลโก้สายฟ้าใหญ่) · B-bars (ทองแท่ง + โลโก้) · C-coin (เหรียญ XAU + แท่งเทียน) — ทุกอย่างอยู่ในวงกลมกลางภาพ (LINE ตัดเป็นวงกลม)

## 📱 แก้เรื่องเฉพาะ iPhone (16 ต.ค. 2569 · เวอร์ชัน 202610161100)
- ผู้ใช้: "ไอโฟน 13 ที่ใช้อยุ่" → text-size-adjust 100% · ไม่ใช้ viewport-fit=cover บนมือถือ + status bar black · ทิศจอแบบ iPhone · minimum-scale · ช่องพิมพ์ 16px · ปุ่มเต็มจอซ่อนบน iPhone + คำแนะนำปิดล็อกหมุนจอ · terminal.css/iframe v=202610161100 · ui.js v=202610161100 · zframes style v=2026101607 · iphone13.cjs: 683 → 1477 → 683 กว้างถูกทุกครั้ง scale 0.571 ทุกแท็บไม่ล้น ไม่มี error · commit 54c703c

## 📱 ทดสอบโทรศัพท์ 5 รุ่น + ปุ่มกดง่ายขึ้น (16 ต.ค. 2569 · เวอร์ชัน 202610161000)
- ผู้ใช้: "ทำมา" (ข้อ "ลองบนมือถือจริง") — เข้าเว็บจริงด้วยมือถือผู้ใช้ไม่ได้ จึงจำลอง iPhone SE / 15 / 15 Pro Max / Galaxy S23 / Pixel 8 แนวนอน+แนวตั้ง ทุกแท็บ (phoneaudit.cjs): ไม่ล้น ไม่ตกขอบ ไม่มี error · เจอปุ่มแถวเล็กสูง 26–34 CSS px = 15–19 px บนจอจริง → min-height 44px เฉพาะ vp-scaled / site-scaled · smalltaps.cjs หลังแก้ = ไม่เหลือ · terminal.css v=202610161000 · zframes style/app v=2026101606 · iframe v=202610161000 · commit 30aa2a3

## ☀️ หุ้นสหรัฐตามโหมดสว่าง (16 ต.ค. 2569 · เวอร์ชัน 202610160900)
- ผู้ใช้: "เพิ่มเติมอไรไหม" → เสนอ (1) หุ้นสหรัฐตามโหมดสว่าง (2) ลองบนมือถือจริงแล้วส่งรูป → "ทำมาหมด" · ทำข้อ 1 (ข้อ 2 ต้องให้ผู้ใช้ส่งรูปเอง) · zframes app.js/style.css v=2026101605 · iframe v=202610160900 · zlight.cjs: สว่าง → มืด → สว่าง เปลี่ยนตามทันที 1440 + 844x390 ไม่มี error · commit 049cba5

## 🎨 หุ้นสหรัฐดำ-ทอง + ป้ายข่าวแรง/ไม้วันนี้บนการ์ดหลัก (16 ต.ค. 2569 · เวอร์ชัน 202610160800)
- ผู้ใช้: "เพิ่มเติมอไรไหม" → เสนอ 3 ข้อ → "ทำมาหมด" · (1) zframes ม่วง → ดำ-ทอง (style.css ท้ายไฟล์ + JS colours + app.js แทนสีใน JSON) · (2) #inFlags ป้ายงดเข้าช่วงข่าวแรง ±30 นาที · (3) ป้ายไม้วันนี้ (ไม้ที่ถืออยู่มีการ์ด #inTrade อยู่แล้ว) · main.js v=202610160800 · terminal.css v=202610160800 · zframes style/frames/frames2/frames3/live/app v=2026101604 · iframe v=202610160800 · ทดสอบ inflags.cjs (มีข่าว+ไม้ → แสดง, ไม่มี → ซ่อน), zgold.cjs 21 โซน, stockpage.cjs, phonescale.cjs ไม่มี error · commit 858642e

## 🗑️ หน้าสัญญาณ: เอาการ์ดข่าวแรง / ไม้วันนี้ออก (16 ต.ค. 2569 · เวอร์ชัน 202610160700)
- ผู้ใช้ (รูปการ์ด "ข่าวแรงสหรัฐ (งดเปิดไม้ใหม่ ±30 นาทีรอบข่าว)" + "ไม้วันนี้"): "เอาออก" → index.html `.card.news-card` ใส่ class home-off · ทดสอบ homeoff.cjs 1440 + 844x390 ซ่อนจริง ไม่มี error · commit c2cfbf2

## 🗑️ หน้าสัญญาณ: เอาภาพรวมรายวันออก (16 ต.ค. 2569 · เวอร์ชัน 202610160600)
- ผู้ใช้ (รูปบล็อก "ภาพรวมรายวัน (ตลาดเปิด) · ข้อมูลประกอบ" + "ตลาดทองตอนนี้"): "เอาอันนี้ออก" → index.html ใส่ class home-off ที่หัวข้อและ .home-cols · terminal.css `.home-off { display: none !important }` v=202610160600 · ทดสอบ gold-signal-tools/homeoff.cjs 1440 + 844x390: ซ่อนจริง บรรทัด "อัปเดต … ไม่ใช่คำแนะนำ" ยังอยู่ ไม่มี error · commit f690b48

## 📐 ทุกแท็บใช้ขนาดตัวหนังสือชุดเดียว (16 ต.ค. 2569 · เวอร์ชัน 202610160500)
- ผู้ใช้: "ปรับทุกส่วนให้สัมพันกัน" → ตรวจทุกแท็บ (bigtext.cjs): ตัวหนังสือธรรมดา 18px (live.css ≥1400) ใหญ่กว่าหัวการ์ด 15px · หน้าข่าวหัว 26/28px มุม 16–20 · มือถือที่ย่อ (กว้าง 1477) โดนกฎจอกว้าง → terminal.css ท้ายไฟล์ ลำดับ 14/15/18 (≥1400 15/16/20, ≥1700 16/17/22) · vp-scaled คง 14/15/18 · #sigCard คำตัดสิน 34→28px · terminal.css v=202610160500 · ทดสอบ 1440 + 844x390 ทุกแท็บ ไม่มี error · commit 3c97e5e

## ✂️ หุ้นสหรัฐ: ตัดแถบหัวที่ไม่จำเป็น (16 ต.ค. 2569 · เวอร์ชัน 202610160400)
- ผู้ใช้ (รูปหัวหน้า NASDAQ-100): "เเถบไหนไม่สำคัญเอาออก เอาที่สำคัญจำเป็นจริงๆ ปรับสัดส่วนให้พอดี" → zframes/app.js ตัด h1.dash + .dsub + .data-note + h2 ของโซน (ซ้ำกับแท็บ) · style.css ท้ายไฟล์: .zone margin-top 8px · .zsub 11px บรรทัดเดียว · app.js/style.css v=2026101603 · iframe v=202610160400 · ทดสอบ 844x390 + 1440 ไม่ล้น ไม่มี error · commit ba4a2d6

## 📱 มือถือเล็กลงอีกนิด (16 ต.ค. 2569 · เวอร์ชัน 202610160300)
- ผู้ใช้: "ขอเล็กลงกว่านี้อีกนิด" → index.html head script S 1.5 → **1.75** (initial-scale 0.5714) · 844x390 → กว้าง 1477 · 390x844 → 683 · ทดสอบ `gold-signal-tools/phonescale.cjs` (สัญญาณ/กราฟ/หุ้นสหรัฐ/ข่าว ไม่ล้น ไม่มี error · 1440 ไม่ย่อ) · commit f1192d2

## 📱 มือถือย่อทั้งหน้าให้เล็กลงมาก (16 ต.ค. 2569 · เวอร์ชัน 202610160200)
- ผู้ใช้: "ใหญ่ไปขอเล็กลงมากๆเลย ในของโทรศัพท์" → viewport ของมือถือ = ด้านกว้าง × 1.5, initial-scale 0.6667 (`vp-scaled`) · แนวนอน 844x390 → กว้าง 1266 หน้าแบบคอม · แนวตั้ง 390 → 585 · zframes app.js?v=2026101602 ข้าม html.phone เมื่อย่อแล้ว · iframe v=202610160200 · ทดสอบ 844x390 ทุกแท็บไม่ล้น ไม่มี error, 1440 ไม่เปลี่ยน · commit c18e42f

## 🕯️ แท่งเทียนหุ้นทุกตัว + มือถือแนวนอนขนาดพอดี (16 ต.ค. 2569 · เวอร์ชัน 202610160100)
- ผู้ใช้: "ขอทุกหุ้นให้มีกราฟแท่งเทียนของทุกหุ้น" → **`api/candles.mjs`** (สมาชิก, Yahoo v8 chart: 5m=5d · 1h=60m 3mo · 1d=1y · 1wk=5y, แคช 60 วิ/สัญลักษณ์+กรอบ, ตัดแท่งแบน volume 0 ท้าย 5m/1h ที่ Yahoo ใส่นอกเวลาเทรด, Yahoo ล้ม = ส่งของเดิม) · zframes/frames3.js `stockCandleCard`/`loadStockCandles`/`drawStockCandles`/`startStockCandles`: การ์ดบนสุดของหน้าหุ้นทั้ง openStock (แทนกราฟเส้น) และ openDiv · EMA20/50 (+EMA200 เฉพาะ 1 วัน) · volume 20% ล่าง · ชี้/แตะ = OHLC+Vol · แท่งล่าสุดตาม SQ ราคาสด · โหลดใหม่ทุก 60 วิ (หยุดเมื่อปิดหน้า) · ปุ่ม `.sciv` ใช้ class rng → frames2 ตัวจัดการปุ่มช่วงเวลาต้องข้าม sciv (เคย error "reading ranges")
- ผู้ใช้: "ในโทรศัพท์ข้อมูลดูใหญ่ไปหมด มันล้น" → terminal.css 2 บล็อก max-width 600 ใช้กับมือถือแนวนอนด้วย (`(orientation: landscape) and (max-height: 500px) and (max-width: 1100px)`) · zframes: **`html.phone`** (app.js จาก screen จริง ≤600 + pointer coarse — ใน iframe ของเว็บ media query ความสูงไม่ match) ตัวหนังสือ 12.5px · .big 20px · การ์ดกระชับ · grid 2 คอลัมน์ · span2 เต็มแถว
- ทดสอบ gold-signal-tools/stockcandles.cjs (NVDA, KO, ทุกกรอบ, 1440/844) ไม่มี error · คอม 1440 ขนาดเดิม (16px/30px)

## 📊 หน้าหุ้นแต่ละตัวเป็นแดชบอร์ดเต็ม + 📱 มือถือแนวนอน (15 ต.ค. 2569 · เวอร์ชัน 202610160000)
- ผู้ใช้ (รูปหน้า GOOGL): "อยากให้แต่ละหุ้นทำแดชบอร์ดขึ้นมา มันดูน้อยไป" → zframes/frames3.js `openStock` เขียนใหม่ (หุ้นปันผลยังใช้ openDiv): `stockSeries(pts)` คำนวณจาก D.closes 1 ปี = EMA20/50/200, RSI14 (Wilder), MACD 12/26/9, drawdown · ดัชนีจากการ์ด calc idx.price ของแดชบอร์ด (จับคู่ตามวัน) → เทียบเริ่ม 100, beta/สหสัมพันธ์ · การ์ด: ราคา(span2) · สรุป · RSI · MACD · เทียบดัชนี · ผลตอบแทนช่วง (วงเล็บ = ดัชนี) · รายเดือน 12 · drawdown · เช็กลิสต์ 7 ข้อ · ความเสี่ยง 10 ช่อง · หุ้นกลุ่มเดียวกัน 10 ตัว (`tr[data-peer]` กดเปิดต่อ; หัวตาราง th handler ข้ามการ์ดที่ไม่มี _st) · `.mbox.mfull` กว้าง 1500 · ทดสอบ gold-signal-tools/stockpage.cjs (GOOGL, 1440/844) 11 การ์ด ไม่มี error
- ผู้ใช้: "เปิดในโทรศัพท์เป็นแนวนอน ไม่เอาแนวตั้ง มันแคบไป" → manifest orientation portrait→**landscape** (แอปที่ติดตั้ง) · ui.js ท้ายไฟล์: มือถือ (จอสั้น ≤600 + pointer coarse) แนวตั้ง = `#rotateCover` "หมุนโทรศัพท์เป็นแนวนอน" + ปุ่ม "เปิดแนวนอนเต็มจอ" (requestFullscreen + screen.orientation.lock — Android เท่านั้น; iPhone ทำไม่ได้) + "ดูแนวตั้งชั่วคราว" (sessionStorage gs-portrait-ok) · standalone ล็อกแนวนอนทันที · **เว็บบังคับหมุนจอเองไม่ได้** · terminal.css: มือถือแนวนอน (landscape, สูง ≤500, กว้าง ≤1100) appbar บาง 45px + เมนูเป็นแถบไอคอนซ้าย 72px (เดิมแถบล่าง) — พื้นที่เนื้อหา ~345/390px · ทดสอบ 390x844 (cover), 844x390, 932x430 ทุกแท็บไม่ล้น ไม่มี error; 1440 ไม่เปลี่ยน

## 🏷️ เมนู แดชบอร์ด → หุ้นสหรัฐ (15 ต.ค. 2569 · เวอร์ชัน 202610152300)
- ผู้ใช้: "ตั้งชื่อให้ใหม่ เอาเข้ากันกับ Nasdaq 100 / S&P 500 / หุ้นปันผล" → แท็บ #zframes ชื่อ "หุ้นสหรัฐ" (เข้าชุดกับ "ข่าวสหรัฐ") · iframe title ตาม · เมนูคอม/มือถือไม่ตัดคำ ไม่ล้น

## 🛠️ ทำตามผลตรวจ (15 ต.ค. 2569 · เวอร์ชัน 202610152200 · commit bc40fb7)
- ผู้ใช้: "ทำมาเลยทั้งหมด" · (1) chartsys `SYS['5m'].sell.risky = 'ผลจริงชนะต่ำกว่าทดสอบมาก (14 ไม้ ชนะ 4)'` → ไม่มีฝั่ง SELL ปกติแล้ว · ข้อความ "SELL ที่ทดสอบผ่าน: 5 นาที" ใน chartzones/chartchat เปลี่ยนเป็น "SELL มีแค่กรอบ 5 นาที — ติดป้ายเสี่ยง"
- (2) บทวิเคราะห์แดชบอร์ดใหม่ `zframes-build/notes/{ndx,spx,div}.json` asOf 2026-10-15 (คัดลอกไป D:\โปรเจคทันเดอร์\zframes\notes ด้วย) จากตัวเลขแดชบอร์ดเช้านี้ (scratchpad facts.js อ่าน dash-*.json จาก branch data: index/EMA/breadth/กลุ่มถ่วง cap/ผู้นำ-ผู้ตาม/RSI/rates) + CPI 14 ต.ค. จากปฏิทิน + หัวข่าว investing.com ไทย · สั่ง zframes-refresh (run 38678436324) สำเร็จ notesAsOf = 2026-10-15 ทั้ง 3 ชุด
- (5) scripts/zframes-refresh.sh ไม่ build gold แล้ว (รอบนี้ ~9 นาที)
- (3) **FRED_API_KEY ตั้งแล้ว 15 ต.ค. 11:06** (ผู้ใช้สมัครเอง) → FRED สด (EFFR/SOFR 13 ต.ค., เป้า Fed 14 ต.ค.) การ์ด "⚠️ คำเตือนข้อมูล" หาย · build 3 ชุด ~1 นาที (เดิม ~9 นาทีเพราะรอ FRED ล้ม) · **บั๊กที่เจอ**: zframes-refresh.sh เทียบจำนวนการ์ดกับเมื่อวาน → การ์ดคำเตือนหาย = 38 < 39 → เก็บไฟล์เก่า (run 38679695616 fail) → ไม่นับการ์ดคำเตือนข้อมูลแล้ว (b6038c5)
- (4) LINE_OWNER_ID: **ผู้ใช้ไม่เอา (15 ต.ค.)** — แจ้งเตือนแอดมินใช้ web push อย่างเดียว อย่าเสนออีก · workflow ยังรองรับถ้าวันหลังตั้ง (zframes-refresh.yml env FRED_API_KEY → gold_model.fred ที่ stocks/div import · new-members/monthly-research env LINE_OWNER_ID) — ผู้ใช้ต้องสมัคร/หาค่าเองแล้วตั้งด้วย `gh secret set`

## 🩺 ตรวจทุกส่วน (15 ต.ค. 2569 · ไม่แก้เว็บ)
- ผู้ใช้: "ดูข้อมูลทุกส่วนว่าควรปรับแก้อะไรไหม" · workflows 30 รอบล่าสุด: price-alerts 29/29 สำเร็จ (1 กำลังรัน), morning-plan 27 + ล้ม 2 (5 ต.ค. ตอนตั้ง token LINE), new-members 30/30, zframes-refresh ทุกวัน · branch data สดทุก 5 นาที · LINE 59/300 คาด 128 · เวลาหน้าหนาว 1 พ.ย. เลื่อนเองแล้ว (marketShift = 1 ชม. ตั้งแต่ 2 พ.ย.) · `gold-signal-tools/alltabs.cjs` ทุกแท็บคอม/มือถือ ไม่มี error ไม่ล้น (ข้อความ "โหลดบันทึกไม่ได้" ในสมุดเทรด = ข้อมูลจำลองของสคริปต์ผิดรูป ต้องส่ง {entries})
- ข้อที่ควรดู: 5m SELL ผลจริง 14 ไม้ ชนะ 4 (29%) −$51 vs ทดสอบ 53% (เบรกพัก 5m ถึง 19 ต.ค.) · บทวิเคราะห์แดชบอร์ดของ 12 ต.ค. · ยังไม่มี secret FRED_API_KEY (ตัวเลข FRED ค้าง 12 ต.ค.) และ LINE_OWNER_ID · zframes-refresh ยังสร้าง gold.json ที่ไม่มีหน้าใช้แล้ว

## 📊 แดชบอร์ด: เอาชุด ทองคำ / GOLD ออก (15 ต.ค. 2569 · เวอร์ชัน 202610152100)
- ผู้ใช้ (รูปเมนู ZFrames): "ตัดในส่วนนี้ออก ทอง/Gold ส่วนที่เหลือเอาไว้" → zframes/app.js รายการเหลือ ndx/spx/div, ค่าเริ่ม ndx (ลิงก์ ?d=gold ตกไปตัวแรก) · iframe ใน index.html ?d=ndx · zframes/index.html app.js?v=2026101521 · การ์ด "สัญญาณ Gold Signal ตอนนี้" ที่มีเฉพาะชุดทองหายไปด้วย · การ์ดข่าวแรงสหรัฐยังอยู่ทุกชุด

## 🕯️ หน้าโหลด: ไม่มีกรอบ + แท่งเทียนพื้นหลังชัด (15 ต.ค. 2569 · เวอร์ชัน 202610152000)
- ผู้ใช้ (รูปหน้าโหลดแบบเดิม): "เอากรอบออกได้ไหม และออกแบบด้านหลังให้เป็นแท่งเทียน มันดูไม่ออกเป็นอะไร" — แก้เฉพาะ 2 จุดนี้ ส่วนอื่นคงเดิม
- splash.css ท้าย: `.splash .sp-panel { display: none !important }` · `.sp-candles` mask: จอกว้างจางตรงกลาง (radial ellipse 30%/44%) · ≤600px เห็นแค่ส่วนล่าง (ใต้ 66–78%)
- splashfx.js กราฟพื้นหลัง: STEP 16→34px (มือถือ 12→22) · ราคาแกว่ง ×2.2 · ช่วงราคาสูง 30–96% ของจอ (มือถือ 74–96%) · แท่งกว้าง 64% มุมมน · ไส้ 1.6px · สี .45→.62 · เส้นราคาปิดจางลง (.14)
- ทดสอบ splashnew.cjs 1890/390: เข้าเว็บ ~6 วิ ไม่ล้น ไม่มี error · ภาพ compare/splash7-*.png

## ↩️ หน้าโหลดกลับเป็นแบบเดิม — ขั้นต่ำ 4 วินาที (15 ต.ค. 2569 · เวอร์ชัน 202610151900)
- ผู้ใช้หลังเห็นแบบกราฟเส้น: "ไม่เอาแล้ว เอาแบบเดิมกลับมา แต่ขอให้เร็วขึ้นกว่าเดิม" → `git checkout 4703a9a^ -- index.html auth.js splash.css` (หัวข้อด้านล่าง = ยกเลิกแล้ว) + MIN_MS 6500 → 4000 · วัด splashnew.cjs: เข้าเว็บ 6.0 วิ (เดิม 8.4) ไม่มี error · **บทเรียน: ผู้ใช้ปฏิเสธการเปลี่ยนหน้าโหลดครั้งที่ 3 แล้ว (broker boot, กราฟเส้น) — ห้ามเปลี่ยนแบบ ปรับได้แค่ความเร็ว/รายละเอียดเล็ก ๆ**

## ⚡ หน้าโหลดใหม่: ไม่มีกรอบ · โลโก้ + กราฟเส้นวิ่ง (15 ต.ค. 2569 · เวอร์ชัน 202610151800) — ยกเลิกแล้วในวันเดียวกัน
- ผู้ใช้: "หน้าตอนโหลดขอให้เร็วขึ้น และออกแบบเอากรอบออก มันดูยังไม่เป็นมืออาชีพ ออกแบบมาใหม่" → ถามทิศพร้อมภาพร่าง → เลือก "โลโก้ + กราฟเส้นวิ่ง" + "อย่างน้อย 4 วินาที"
- index.html `#splash.splash.spx`: แสงทอง `.spx-glow` · โลโก้ `.sp-logo` (lg-rim/lg-bar/lg-bolt ใน live.css — คงอนิเมชันวาดขอบ/ฟ้าผ่า) · `.spx-title` ไล่สีทอง · `.spx-sub` · `.spx-chart` svg (เส้น #spxLine + พื้น #spxArea ใน clipPath #spxReveal กว้างตาม %) + จุดเรืองแสง #spxDot · `.spx-foot` "กำลังโหลดข้อมูลตลาด" + #splashPct · เอาออก: sp-sky/market/flash/particles/panel/ring/beams/waves/sparks/chips + script splashfx.js
- auth.js: SPLASH API เดิม (step/show/hide) · เส้นจาก random walk คงที่ (seed 7, 64 จุด ขาขึ้น) ไม่ใช่ราคาจริง · MIN_MS 4000 · ปิดหน้าโหลดหลัง done 450ms
- วัด `gold-signal-tools/splashnew.cjs`: เข้าเว็บ 5.0–5.1 วิ (เดิม 8.3–8.4) คอม/มือถือ มืด/สว่าง ไม่ล้น ไม่มี error · ภาพ compare/splash5-*.png

## 📊 % Buy / Sell แสดงตอนถือไม้ด้วย (15 ต.ค. 2569 · เวอร์ชัน 202610151700)
- ผู้ใช้ (รูปการ์ดขวา "ถือ Buy" กราฟ 5 นาที): "พวกเปอร์เซ็นต์หายไปไหน" → เดิมตอนถือไม้ chartzones ไม่สร้าง % (showPlans = !open) · ตอนนี้ `fresh` (ข้อมูลพร้อม) → กล่องกราฟและ `#sigNote` มี `.cz-holdpct` "ความพร้อมเข้าตอนนี้ (ดูประกอบ — ถือไม้อยู่ ไม่ต้องเปิดไม้ใหม่)" + แถบ Buy/Sell · `CZ_SIDES` ส่งทุกครั้งที่ข้อมูลพร้อม · หัวการ์ดขวา "ระบบถือไม้อยู่ … · ตอนนี้ Buy x% · Sell y%" · ระวังชื่อ `live` ใน renderChartZones = ไม้ที่บันทึก (ชนกันครั้งแรก)
- แชท: ป้าย "ตามกราฟ (x)" ค้างกรอบเก่าจนกว่าจะถาม → เช็กทุก 1 วิ (`paintTfs` เมื่อเปลี่ยน)
- ทดสอบ mainsys.cjs (PRO=1, TFS=5m, ไม้ 5m BUY จริงที่ถืออยู่) 1440/390 ไม่มี error · ภาพ compare/hold-pct-1440.png

## ⏱️ ข่าวทุก 1 นาที + ทุกข่าวมีรูป (15 ต.ค. 2569 · เวอร์ชัน 202610151600)
- ผู้ใช้: "ขอทุกอย่างอัพแบบเรียลไทม์ทุกวัน และข่าวต้องมีรูปทุกวัน" → api/news.mjs TTL 60 วิ · loadFeed ทุก 55 วิ (interval 60 วิ ตอนแท็บข่าวเปิด) · ภาพปกสำรองตามหมวดอยู่หลังรูป (img z-index 1 ลบตัวเองเมื่อโหลดไม่ได้ทั้ง _L และ _M) · ส่วนอื่นเรียลไทม์อยู่แล้ว · ทดสอบ news-noimg.json (3 ไม่มีรูป + 1 รูปเสีย) ทุกการ์ดมีภาพ

## 📰 ข่าวล่าสุด: ข่าวเด่นขนาดเท่าข่าวอื่น (15 ต.ค. 2569 · เวอร์ชัน 202610151500 · commit beaff5f)
- ผู้ใช้ (รูปจอ ~1880px บนเว็บจริง — ยืนยันว่า Vercel ดึง RSS ได้): "ใหญ่ไป เอาขนาดเดียวกันเท่ากับด้านขวา" → แถวบน = 3 ข่าว `.nf-hd` grid 3 คอลัมน์ (2 คอลัมน์ 761–1000px, มือถือข่าวแรกรูปใหญ่ อีก 2 เป็นแถว) หัวข้อ 18px · เลิกใช้ `.nf-lead`/`.nf-side` · ทดสอบ nfview.cjs SIZES 1880/1440/390 ไม่ล้น

## 📰 หน้าข่าวสหรัฐแบบเว็บข่าว: ข่าวจริงมีรูป + ปฏิทินเป็นการ์ด (15 ต.ค. 2569 · เวอร์ชัน 202610151400 · commit 0e64014)
- ผู้ใช้ (รูปหน้าข่าวเดิม): "หน้าข่าวยังดูยาก ไม่น่าสนใจ" → เลือก "การ์ดข่าวทีละเรื่อง" → ระหว่างทำส่งรูปเว็บข่าว (IUX24 / เว็บข่าวไทย): "อยากให้เป็นแบบนี้ ให้รูปและข้อความบอก … น่าดูและน่าเชื่อถือ" → เลือก "ดึงข่าวจริงจากสำนักข่าว" (ไม่เอาภาพปกที่เราทำเอง)
- แหล่ง: th.investing.com/rss/news_11 · news_14 · news_95 (ฟีดละ 10 ข่าว: หัวข้อไทย, enclosure รูป Reuters บน content-media.investing.com, pubDate UTC, link) · เบราว์เซอร์อ่านเองไม่ได้ (ไม่มี CORS) · Node fetch ธรรมดาได้ 200 (ไม่ติด Cloudflare แบบ api.investing.com) → `api/news.mjs` (member() จาก lib/gs.mjs, รับเฉพาะลิงก์/รูปโดเมน investing.com, `collect()` export ไว้ทดสอบในเครื่อง) · probe: `gold-signal-tools/probe-news.cjs`, `probe-rss.cjs` (news HTML ไม่มี API ให้ใช้)
- **บั๊กที่เจอ**: id จาก `article-(\\d+)` ได้ "93" ซ้ำทุกข่าวแบบ `article-93CH-798426` → ตัดซ้ำเหลือ 13 จาก 30 → ใช้ทั้งก้อน · คอมเมนต์ `//` กลาง object บรรทัดเดียวกินโค้ดที่เหลือ (SyntaxError)
- newsstats.js: `renderFeed` วาดใหม่เฉพาะเมื่อ HTML เปลี่ยน (`nf.html`, กันรูปกะพริบ เพราะ renderStats ถูกเรียกบ่อย) · `loadFeed` ทุก 5 นาทีเมื่อแท็บเปิด · ปฏิทิน: `statsByName`/`impactOf`/`dayLabel`/`goldRule` · CSS ท้าย terminal.css `.nf*` และ `.nc*` (`:is(html, html.dark)` ทั้ง 2 ธีม)
- ทดสอบ: `gold-signal-tools/newsshot.cjs <port> <tag> <out> [light]` (NEWS_JSON = ข่าวจริงจาก collect()) + `nfview.cjs` 1440/390 มืด/สว่าง ไม่ล้น ไม่มี error · production `/api/news` ไม่ล็อกอิน = 401 · **ยังไม่ได้ยืนยันว่าเครื่อง Vercel ดึง RSS ได้** (ต้องเป็นสมาชิกถึงจะเรียกได้) — ถ้าดึงไม่ได้ หน้าเว็บขึ้น "โหลดข่าวไม่ได้" ส่วนปฏิทินยังทำงาน · ทางสำรอง: GitHub Actions + curl_cffi เขียนลง branch data

## ⚠️ จุดเข้ากลับมาทุกกรอบ แบบติดป้ายเสี่ยง (15 ต.ค. 2569 · เวอร์ชัน 202610151300 · commit 1a643e6)
- ผู้ใช้ (รูปกราฟ 1 ชม.): "ทำไมไม่เห็นจุดเข้าของทุกทามเฟรมเลย ตั้งแต่ 5 15 30 1ชม. 5ชม. 1วัน 1สัปดาห์" → เลือก "เปิดกลับให้เห็นบนกราฟ แต่ติดป้ายเสี่ยง" (ไม่เอาเปิดกลับทั้งหมด / ไม่เอาคงไว้) — **บทเรียน: ผู้ใช้อยากเห็นจุดเข้าทุกกรอบ อย่าซ่อนจุดเข้า ให้ติดป้ายแทน**
- chartsys.js `off` → `risky: '<เหตุผล>'` · dirOf/unconfirmed/stretched กลับไปใช้ sys.buy/sell ตรง ๆ · sideInfo `tested = !!c`, `risky`, คำตัดสินตอนมีสัญญาณ "⚠️ มีสัญญาณ แต่เสี่ยง" · `riskText(c)` แทน on/whyNo
- chartzones.js: หัวกล่องสัญญาณ "⚠️ 🟢 สัญญาณ BUY · เสี่ยง" + เหตุผล + "ใช้ไม้เล็กกว่าปกติ" (cls near) · ช่อง Buy/Sell มีบรรทัด `.cz-risk` · ป้ายบนแท่ง `Buy 4,140.77 ⚠` (`riskyNow` จาก state.tf) · แผนบนกราฟ "⚠️ เสี่ยง" · chartchat.js เพิ่มคำเตือนทุกคำตอบที่เกี่ยว
- chart-run.js: ไม้ฝั่งเสี่ยงบันทึกพร้อม `risky: true` · ไม่ส่ง LINE แม้ CHART_NOTIFY จะมีกรอบนั้น · ระบบหลักยัง 1h · TP fix จากรอบก่อนยังอยู่
- ทดสอบ: qualtest.js — 15m 229 · 30m 707 · 1w 24 ไม้ กลับมาเท่าก่อนปิด · mainsys.cjs (TFS=30m,15m,5m) เก่า/ใหม่ 1440/390 ไม่มี error ไม่ล้นจอ · ภาพ compare/risky-*.png

## ✂️ เหลือจุดเข้าเฉพาะกรอบที่กำไรครบ 4 ช่วง · ระบบหลัก 30m → 1h · แก้ TP (15 ต.ค. 2569 · เวอร์ชัน 202610151200 · commit d40f349)
- ผู้ใช้: "แก้มาเลย" (ตามตารางที่เสนอหลังทดสอบด้านล่าง) → `chartsys.js`: `off: '15 ต.ค. 2569'` ที่ 5m BUY · 15m BUY · 30m BUY · 1w BUY (ช่วงล่าสุด −433 / +48 / −7 / −5…+296) · คงจุดเข้า 1h BUY · 5h BUY · 1d BUY · 5m SELL · `on()` ใน dirOf / unconfirmed / stretched / sideInfo (`tested` = on, `off` ใหม่, คำตัดสิน "⏸ ปิดจุดเข้า — ดูทิศเท่านั้น") · `whyNo(c)` · `MAIN_TF = '1h'`
- **บั๊กที่เจอระหว่างทดสอบ**: `usdList` ใช้ `INTRA.RULE.tpUsd` ซึ่งเปลี่ยนเป็น [15] เมื่อ 9 ต.ค. (9699eb1) → 1h / 5h / 5m SELL ได้ TP1 อย่างเดียว (ไม้จริง 1h 2 ไม้ + 5m SELL 14 ไม้มี tps 1 ตัว) ไม่ตรงกับผลทดสอบที่ใช้ TP 3 จุด → แก้เป็นค่าคงที่ [15, 20, 30]
- chartzones.js: `Bon/Son/noEntry` — กรอบที่ปิดทั้งสองฝั่งขึ้น "⏸ กรอบ X ปิดจุดเข้า… จุดเข้าอยู่ที่ 1 ชม. · 5 ชม. · 1 วัน และ SELL 5 นาที" (ลิงก์ data-tf) · ข้อความรายละเอียด/ช่องฝั่งบอก "ปิดจุดเข้า" + ตัวเลขทดสอบเดิม · chartchat.js ใช้ `whyNo` ทุกคำตอบ + ผลจริงของฝั่งที่ปิด
- main.js หน้าสัญญาณ = ระบบ 1h: `homeDecide`/`homeCandles`, SM_FRAMES จาก SYS[MAIN_TF].frames, นับถอยหลังแท่ง 1 ชม., ข้อความทุกจุดใช้ `mainLabel()` · หลบข่าวบนหน้าแรกด้วย (1h มี news) · **index.html: chartsys.js ย้ายมาโหลดก่อน main.js** (main.js อ่าน CHARTSYS ตอนโหลด — ครั้งแรกพัง "CHARTSYS is not defined")
- chart-run.js `CHART_NOTIFY` ค่าเริ่ม 1h,5h,1d + หัวข้อระบบหลักตาม MAIN_TF · weekly.js / morning-plan.js ใช้ `CS.MAIN_TF` · ข้อความ LINE ในหน้าบัญชี + หัวการ์ดหน้าแรก
- ทดสอบ: qualtest.js รันซ้ำด้วยโค้ดใหม่ — 1h/5h/1d/5m SELL ได้จุดเข้าเท่าเดิมทุกจุด (1516/835/658/3774) กรอบที่ปิด = 0 · `gold-signal-tools/mainsys.cjs <port> <tag> <cs.json> <out>` (ราคาจริง + chart-signals.json จริง, 1440/390): หน้าแรก "ระบบหลัก 1 ชม." การ์ดย่อย 1 ชม./4 ชม./5 ชม. · 30m ขึ้นปิดจุดเข้า · 1h TP 3 จุด · ไม่ล้นจอ ไม่มี error (ตอนรันเก่า+ใหม่พร้อมกัน investing.com ตอบ CORS ล้มบางคำขอ = โดนจำกัด ไม่ใช่โค้ด) · ภาพ compare/mainsys-*.png · production dpl_9qzBRYf2k9 (d40f349) = gold-signal-ten
- ⚠️ ระหว่าง push รอบตัวบันทึกที่รันอยู่ยังเป็นโค้ดเก่า (ff7c123) จนจบรอบ ~09:30 → อาจเปิด/ส่ง LINE กรอบ 30m ได้อีกรอบสุดท้าย

## 🎯 ทดสอบ "สัญญาณน้อยลงแต่ชัวร์ขึ้น" ทุกกรอบ (15 ต.ค. 2569) — ไม่มีตัวไหนช่วยจริง ยังไม่เปลี่ยนกติกา
- ผู้ใช้ (รูปกราฟ 1h มี Buy 4,146.22 หลังราคาพุ่ง): "สัญญาณ Buy/Sell ยังไม่ค่อยแม่น อยากให้ทุกทามเฟรมแม่นยำ" → เลือก "สัญญาณน้อยลงแต่ชัวร์ขึ้น"
- `research/indicators/qualtest.js`: รันโค้ดเว็บจริง (CS.decide + CS.dirOf + ตัวยืนยัน + noChase + หลบข่าว 5m/1h ด้วยข่าว 1,242 รายการ) บน Binance PAXG 2 ปี (1d 5 ปี, 1w 4 ปี) แล้วลองตัวกรองจุดเข้า 21 แบบ: ระยะห่าง EMA20 (ext), ระยะจากจุดต่ำ 10 แท่ง (run), แท่งใหญ่ (big), RSI ไม่สูงเกิน, ต้องย่อแตะ EMA9 (pull), กรอบช้าเหนือ EMA50 (htf), คะแนนเกินเกณฑ์ ≥1 (margin), ความผันผวน (vol) · เลือกจากช่วง 1–3 (ชนะ% และ $ ไม่แย่ลงทุกช่วง, ไม้ ≥40%) แล้วดูช่วง 4
- `research/indicators/confluence.js`: เข้าเฉพาะตอนกรอบอื่นให้สัญญาณทางเดียวกัน (ทีละกรอบ / ≥1 / ≥2 กรอบ)
- ผล: **ตัวกรอง "ไม่ไล่ราคา" (ext/run/rsi/pull) ทำให้แย่ลงเกือบทุกกรอบ** (ทองเป็นตลาดโมเมนตัม เข้าตอนพุ่งได้ผลดีกว่า) · **หลายกรอบตรงกัน: ไม่ผ่านเลยสักแบบ** — บางแบบ % ชนะขึ้น (1h + 1d 57→62%) แต่กำไรลดและไม่สม่ำเสมอ · ที่ผ่านเกณฑ์: 5m BUY `rsi ≤ 65` (1,126→1,043 ไม้, 53→54%, +512→+714, ช่วง 4 ยัง −412) และ `htf` (ตัดแค่ 1–6 ไม้) · ทดสอบ ~200 แบบ ผ่าน 1–2 แบบเล็กน้อย = น่าจะเป็นโชค → **ไม่ใส่** (รอผู้ใช้ตัดสิน)
- ระบบเดิมยังเป็นค่าที่ดีที่สุดที่หาได้: ชนะ 53–57% (5m–1h), 64–67% (5h/1d/1w) · กรอบที่กำไรทุกช่วง: 1h, 5h, 1d · 5m BUY ช่วงล่าสุด −461
- ข้อมูลทดสอบ (bars2y.json, long.json, news-hist.json, qual-*.json) อยู่ใน scratchpad ไม่ได้ commit · ข่าวย้อนหลังดึงผ่าน Chrome จริงด้วย `C:UsersHPgold-signal-tools
ews-hist.cjs <dir>` (Node fetch โดน 403)

## 🔎 ตรวจคู่มือกับโค้ดจริง + เขียนข้อ 1–7 ใหม่ (15 ต.ค. 2569 · คู่มืออย่างเดียว ไม่แก้เว็บ)
- ผู้ใช้: "ตรวจว่าตรงกับโค้ดจริงไหม" → "ทำมาเลย" · ตรวจด้วยสคริปต์ (ทุกชื่อไฟล์/ฟังก์ชัน/#id ในคู่มือ grep กับโค้ด) + อ่าน chartsys.js, intraday.js, signals.js, workflows, index.html, middleware.js, branch data
- พบ: บันทึกการเปลี่ยนแปลงตรงกับโค้ด แต่ข้อ 1–7 ค้างที่ 5–8 ต.ค. — ยังเขียนว่าระบบ 30 นาทีเปิดไม้ TP 3 จุด/ส่ง ✅ ทุกครึ่งชั่วโมง, 5h/1d/1w ไม่มีจุดเข้า, แท็บ สถิติ/วิธีใช้, ธีมสว่างเป็นค่าเริ่มต้น, ข้อมูลอยู่บน main, `?v=` เลขเดียวทุกไฟล์, มี #lvCard/#tpCard/status.js/simple.css
- แก้: ข้อ 1 เขียนใหม่เป็นสภาพปัจจุบัน (CHARTSYS ตารางทุกกรอบ, เบรก, chart-run.js, LINE `CHART_NOTIFY` = 30m,1h,5h,1d,1w, หน้าเว็บ 6 แท็บ, ระบบเก่าที่ยังรัน, สมาชิก/หลังบ้าน/api) · ข้อ 2–7 อัปเดต (ไฟล์ครบ, branch data, ลำดับ CSS, workflows 6 ตัว, คำสั่งทดสอบ chart-run, deploy เลขแยกรายไฟล์, กับดักใหม่) · ข้อ 8 ตารางผลจริงเป็นตัวเลขหลังแก้ (32 ไม้ ชนะ 12 −99.8 ตรวจกับไฟล์จริง) · ข้อ 1 เดิมย้ายไปท้ายไฟล์ "🗄️ ข้อ 1 เดิม" พร้อมป้ายว่าอะไรยกเลิกแล้ว (ไม่ลบเนื้อหา)
- ไม่แก้หน้าเว็บ → ไม่มี compare.html / สไลด์พอร์ตโฟลิโอ

## 🧾 แก้ผลไม้เก่าใน chart-signals.json ให้ตรงราคาจริง (14 ต.ค. 2569 · เวอร์ชัน 202610151100)
- ผู้ใช้: "แก้มาเลย" (หลังรู้ว่าผลเก่าเพี้ยนเพราะบั๊กส่วนต่าง PAXG)
- วิธี: ไม้ที่ปิดแล้ว (ไม่รวม 5h/1d/1w) ตัดสินใหม่ด้วย `SIG.evaluate` บนแท่ง 5m PAXG ที่เลื่อนด้วยส่วนต่าง ณ ตอนเข้า (entry − ราคาปิด PAXG แท่งก่อนเข้า) ตรึงไว้ทั้งไม้ = ผลของคนที่เข้าตามราคาตลาดตอนนั้น · ไม่แตะ entry/SL/TP · ไม้ที่เปลี่ยนผลเก็บของเดิมใน `was` · คำนวณเบรกใหม่ (5m ยังพัก — แพ้ติด 5 ไม้จริงในราคาจริง 13–14 ต.ค.)
- รอบ 1 (64b7499, 17:40): 13 ไม้ · รอบ 2 (6ad8988): 5m SELL 14 ต.ค. 15:50 (ตอนรอบ 1 ในราคาจริงยังเปิดอยู่ เลยไม่ได้แก้ → TP ปลอม → จริงชน SL) · ผลรวม −$160 → −$99.8
- บันทึกบน worktree ของ origin/data แล้ว push ตรง (ไม่ force) · รอบตรวจถัดไปบันทึกต่อจากค่าที่แก้ ไม่ทับ
- ยืนยันโค้ดใหม่บน GitHub: run 38552843498 / 38557046806 (e0dbfa1) log `PAXG → spot offset` −4.67…−5.21 (12 matched candles) ทุกรอบ
- ทดสอบหน้าเว็บด้วยไฟล์จริงที่แก้แล้ว (gold-signal-tools/audit-real.cjs, rec-shot.cjs): หน้าอ่านได้ 32 ไม้ ชนะ 12 −99.8 · คอม/มือถือ ไม่ล้น ไม่มี error

## 🎯 แก้บั๊กส่วนต่างราคา PAXG ในตัวบันทึกสัญญาณกราฟ (14 ต.ค. 2569 · เวอร์ชัน 202610151000)
- ผู้ใช้ถาม "พวกสัญญาณในการเข้าต่างๆดีแล้วใช่ไหม แม่นยำไหม" → "ทำมา" (วิเคราะห์ไม้ที่แพ้)
- พบ: `scripts/chart-run.js` ตั้ง `off = investing m15 ตัวสุดท้าย − Binance m15 ตัวสุดท้าย` แต่แท่งล่าสุดของ investing.com ช้ากว่า Binance 1–2 แท่ง → ค่าปรับกระโดด −13.7…+5.2 ทุกรอบ (ส่วนต่างจริงเฉลี่ย −3 ถึง −4.4, sd ~1, เปลี่ยน ~$0.5/แท่ง) · ไม้ 5m/30m/1h ตามด้วย C.m5 ที่เลื่อนด้วยค่าใหม่ทุกรอบ → ชน SL $10–15 ปลอม (เช่น 5m SELL 13 ต.ค. 08:05 / 08:10 สวนจริงแค่ $3–4)
- แก้: ใช้ค่ากลางของผลต่างราคาปิด 12 แท่ง m15 ที่ปิดแล้วและเวลาตรงกัน (fallback แบบเดิมถ้าไม่มีแท่งตรง) + log `PAXG → spot offset` · กติกาเข้าไม้ไม่เปลี่ยน · ฝั่งเว็บ `loadOlder` จับเวลาตรงกันอยู่แล้ว ไม่ต้องแก้
- ผลคำนวณใหม่ใน §8 · ทดสอบ: รัน chart-run.js 3 รอบ (CHART_FILE สำเนา, ไม่บันทึก/ไม่ส่ง) ได้ −5.21 จาก 12 แท่งทุกรอบ

## 🧭 เมนูใช้ไอคอนเส้นแทนอีโมจิ (14 ต.ค. 2569 · เวอร์ชัน 202610150900)
- ผู้ใช้ (รูปเมนูซ้าย 🎯📰📈📊📓👤): "แก้ให้ดูเป็นมืออาชีพมากกว่านี้ อันนี้ดูทำเล่น เหมือนไม่ได้เอามาใช้งานระดับทางการ"
- index.html `#tabbar`: `<span>อีโมจิ</span>` → `<span class="ico"><svg viewBox="0 0 24 24">…</svg></span>` (เส้นแบบ Lucide: activity · newspaper · candlestick-chart · layout-dashboard · book-open · circle-user) — **อย่ากลับไปใช้อีโมจิในเมนู**
- terminal.css ท้ายไฟล์ (`:is(html, html.dark)` ทั้ง 2 ธีม): `.ico` 20px (คอมมืด 19px, มือถือ 22px) stroke currentColor 1.8 · ไม่มี filter grayscale/scale แบบเดิม · `.on .ico` สี `--gold` · เมนูซ้ายตัวหนา 500 / ที่เลือก 600
- ทดสอบ `gold-signal-tools/nav.cjs`: มืด/สว่าง/มือถือ ไอคอน 22px มือถือ สีเทา #848e9c / ที่เลือก #f0b90b · ไม่ล้น ไม่มี error · (setViewport แบบ isMobile ทำให้โหลดใหม่ ต้องรอหน้าโหลดจบก่อนถ่าย) · ภาพ compare/nav-*.png (ภาพเก่า = รูปผู้ใช้)

## ⏱️ หน้าโหลดเร็วขึ้นนิดหน่อย = ค่าที่ผู้ใช้พอใจ (14 ต.ค. 2569 · เวอร์ชัน 202610150800)
- ผู้ใช้: "ขอเร็วนิดนึง อีกนิดกำลังดีแล้ว" → auth.js MIN_MS 8000 → **6500** (ค่าที่ผู้ใช้ว่ากำลังดี — อย่าเปลี่ยนเองถ้าไม่ได้ขอ)
- วัด splash3.cjs: คอม 8.0 / มือถือ 8.5 วินาที (เดิม 9.5 / 10) · splashpace.cjs % เดินตามเวลา 9% → 100% แท่งเทียน 1 → 16 · ไม่มี error

## 🐢 หน้าโหลดหน่วงขึ้นอีก + เดินตามเวลา (14 ต.ค. 2569 · เวอร์ชัน 202610150700)
- ผู้ใช้: "ช้ากว่านี้อีก" + "ให้หน่วงกว่านี้" (ขอช้าลงรอบที่ 3–4) → auth.js MIN_MS 4000 → **8000** · วงแหวนวิ่งนำเวลาไม่ได้: `goal = min(target, elapsed/MIN_MS*100)` แล้ว shown ไล่ goal → % และแท่งเทียน (splashfx.js อ่าน #splashPct) เดินสม่ำเสมอตลอด 8 วิ ไม่พุ่งไป 90% แล้วค้าง
- วัด `splashpace.cjs` (หน่วงข้อมูล 2 วิ): 1 วิ 8% · 4 วิ 45% · 8 วิ 94% (แท่ง 1 → 14) · `splash3.cjs` คอม 9.5 / มือถือ 10 วินาที · ไม่มี error
- ⚠️ ทุกคนที่เปิดเว็บต้องรอ ~10 วินาที (ผู้ใช้ต้องการสำหรับโชว์งาน) — ถ้าจะลดให้แก้ MIN_MS อย่างเดียว

## 🕯️ หน้าโหลด: อนิเมชั่นแท่งเทียน (14 ต.ค. 2569 · เวอร์ชัน 202610150500)
- ผู้ใช้: "ไม่ต่างจากเดิมเลย แค่มีกรอบเข้ามาเอง … ออกแบบให้ดี ๆ มีอนิเมชั่นมากขึ้น" + "เกี่ยวกับกราฟแท่งเทียน" → ของเดิมอยู่ครบ (โลโก้ฟ้าผ่า วงแหวน ชื่อเด้ง ชิป)
- **`splashfx.js`** (โหลดหลัง auth.js): (1) `.sp-cbar` แท่งเทียน 16 แท่งแทรกก่อน `#splashChips` — ราคาปิดแกว่งรอบเส้นขาขึ้น (`50 + i*0.9 ± 7`, ตัวแท่ง ≥ 3) → ตัวแท่ง 15–26% ของความสูง · อ่าน % จาก `#splashPct` ทุกเฟรม: แท่งที่ผ่านแล้ว `.on` (ไส้ scaleY แล้วตัวแท่งเด้ง) · แท่งปัจจุบัน `.live` สีทองยืดหด (2) `canvas.sp-candles` กราฟพื้นหลังวิ่งสด (random walk ขาขึ้น 40ms/เฟรม แท่งใหม่ทุก ~26 tick) + เส้นปิดเรืองแสง + เส้นประราคาล่าสุด + ป้าย LIVE — **ภาพประกอบ ไม่ใช่ข้อมูลตลาด** · หยุดเมื่อ .gone · reduced-motion ไม่วาด
- **กับดัก: คลาส `.up` / `.dn` มีอยู่แล้วทั้งเว็บ (`.dn` padding 16px …) → แท่งเทียนใช้ `.cu` / `.cd`** (ตอนแรกแท่งเขียวกว้าง 0px)
- splash.css ต่อท้าย: ซ่อน `.sp-market` เดิม · `.sp-panel` สูง 575 (มือถือ 520) คลี่จากเส้น (`spUnfold` clip-path 1.1s) + ขอบแสงทองวิ่ง (`@property --spa` conic-gradient 3.6s) · `.sp-sub` พิมพ์ทีละตัว (clip-path steps 24) + เคอร์เซอร์ · ชิปเด้งทีละอัน (1.9/2.05/2.2s)
- ทดสอบ `gold-signal-tools/splash4.cjs` (ภาพ 0.5/1.6/3.2/4.8 วิ) + `splashdbg.cjs` (ขนาดแท่ง) 1440/390 ไม่ล้น ไม่มี error · ภาพ compare/splash3-*.png

## 🐢 หน้าโหลดช้าลงอีกนิด (14 ต.ค. 2569 · เวอร์ชัน 202610150400)
- ผู้ใช้: "ช้ากว่านี้อีกนิด" → auth.js MIN_MS 2800 → **4000** · วงแหวนนับ `max(0.25, diff*0.025)` (เดิม 0.35 / 0.035)
- วัด `gold-signal-tools/splash3.cjs` (ไม่หน่วงข้อมูล): คอม 4.2 → 5.5 วินาที · มือถือ 4.5 → 5.9 วินาที · ไม่มี error

## ⚡ หน้าโหลดกลับเป็นแบบเดิม + เกลาให้ทันสมัย (14 ต.ค. 2569 · เวอร์ชัน 202610150300)
- ผู้ใช้หลังหน้าโหลดแบบแอปโบรกเกอร์ (ac63361): "ไม่เอาแบบนี้ เอาแบบเก่า แต่เอาของเก่ามาแก้ให้มันดูช้านิดนึง และออกแบบให้มันทันสมัยมากขึ้น การเอาไปขายงาน" → **อย่าเปลี่ยนหน้าโหลดเป็นแบบอื่นอีก ให้เกลาของเดิม**
- คืน markup `#splash` ใน index.html + ส่วน SPLASH ของ auth.js จาก ac63361^ ทั้งก้อน · เพิ่ม `<div class="sp-panel">` ก่อน `.sp-ring`
- auth.js: MIN_MS 1200 → **2800** · วงแหวนนับ `max(0.35, diff*0.035)` (เดิม 0.6 / 0.06)
- `splash.css` (เขียนใหม่ทั้งไฟล์ สำหรับ markup เดิม): html.dark พื้น #07090c + `::before` ออโรร่าทอง (หมุน 9s) + `::after` ตารางจุด mask กลางจอ · `.sp-panel` กระจกฝ้า 460×470 radius 28 ขอบทองจาง + แสงวิ่ง 4.5s (จัดกลางด้วย inset 0 + margin auto — **ห้ามใช้ transform เพราะ popIn ทับ**) · เนื้อหา z-index 1 ทั้ง 2 ธีม · วงแหวน stroke 3/3.5 เรืองแสง · `.sp-title` 40px (มือถือ 30) แสงทองวิ่ง 3.2s · `.sp-sub` 14px **ภาษาไทยห้ามเว้นช่องไฟกว้าง** · ชิปกระจก เสร็จ = เขียว · ฟ้าผ่า .45 กราฟพื้นหลัง .16
- ทดสอบ `gold-signal-tools/splash2.cjs` (NOPOLISH=1 = ภาพแบบเก่า) 1440/390 ไม่ล้น ไม่มี error · ภาพ compare/splash2-*.png

## 🚀 หน้าโหลดแบบแอปโบรกเกอร์ (14 ต.ค. 2569 · เวอร์ชัน 202610150100)
- ผู้ใช้: "เปลี่ยนหน้าแรกให้สมจริงและออกแบบใหม่ มันดูธรรมดาไป" → ถาม: หน้าไหน = **หน้าโหลดตอนเปิดเว็บ** ("หน้าตอนโหลด"), สมจริงแบบ = **เหมือนแอปโบรกเกอร์จริง**
- index.html `#splash.splash.bk` ใหม่ทั้งหมด (ลบโลโก้ฟ้าผ่า/วงแหวน/ประกาย): `.bk-top` โลโก้ + `#bkPill` (กำลังเชื่อมต่อ → `.live` "LIVE · เชื่อมต่อแล้ว") · `.bk-card` XAU/USD + `#bkPx` + `#bkChg` + `#splashChips` 3 ขั้น (data-at 60/80/100: วงหมุน → ติ๊กเขียว) · `.bk-foot` `#splashBar` + `#splashPct` · `canvas#bkChart`
- `splash.css` (โหลดหลัง terminal.css, สีของตัวเองเหมือนกันทั้ง 2 ธีม) · CSS หน้าโหลดเก่าใน live.css/theme.css (.sp-*) ไม่ได้ใช้แล้ว (ยังไม่ลบ)
- auth.js SPLASH (API เดิม step/show/hide): ตัวเลขหมุนสุ่มทุก 70ms **สีเทา + blur 6px (ไม่ให้ใครอ่านเป็นราคา)** จนกว่า `#lvPrice` ที่ main.js เขียนจะมีตัวเลข → แสดงราคาจริง + สี/ข้อความจาก `#lvChg` · กราฟพื้นหลัง = random walk ประกอบ (ไม่ใช่ข้อมูลตลาด) หยุดเมื่อ .gone · reduced-motion ไม่วาดกราฟ · MIN_MS 1200
- ทดสอบ `gold-signal-tools/boot.cjs` (หน่วง investing 2 วิ): 45% ยังหมุน/กำลังเชื่อมต่อ → ได้ราคา 4,125.45 + LIVE → ปิด · 1440/390 ไม่ล้น ไม่มี error · ภาพ compare/boot-new-*.png

## 📱 มือถือสัดส่วนเล็กลง (14 ต.ค. 2569 · เวอร์ชัน 202610150000)
- ผู้ใช้: "ได้แล้ว ขอให้ทำสัดส่วนให้เหมาะการเปิดในโทรศัพท์ด้วย เปิดในโทรศัพท์ดูใหญ่ไป" → วัด `gold-signal-tools/mob.cjs`: body 16px เท่าคอม, การ์ด padding 14/16, ตัวเลข 28–40px
- ท้าย terminal.css `@media (max-width: 600px)` ใช้ `:is(html, html.dark)` (specificity เท่า html.dark + มาทีหลัง = ชนะ ทั้ง 2 ธีม): body 14px · การ์ด 12px radius 10 · h3/.sec-title 14 · ปุ่ม 13 · lv-price 30 · price 26 · action 28 · sm-score 32 · sig-side 26 · intra/s15-call 19 · dn-center 24 · lt-pnl 26 · st-title/kpi 18 (big 24) · ns-count 24 · jr-kpis 18 · tabbar 11px/ไอคอน 19 · **input/select/textarea คง 16px (กัน iPhone ซูม)** · ห้ามใช้ CSS zoom (พิกัดกราฟเพี้ยน)
- ผล: หน้าสัญญาณ 3,435 → 3,240px · บัญชี 2,022 → 1,886px · 390/360px ไม่ล้น ไม่มี error · ภาพ compare/mob-*.png

## ↔️ หน้าบัญชีเต็มความกว้างจอ (14 ต.ค. 2569 · เวอร์ชัน 202610142300)
- ผู้ใช้ (รูป ~1900px): "ทำไมไม่ชิดขอบ ช่องเว้นเยอะมาก" → เอา `max-width: 1600px; margin-inline: auto` ของ `#tab-account` ออก (ผู้ใช้ชอบเต็มจอเหมือนหน้าอื่น — **อย่าจำกัดความกว้างหน้าใดหน้าหนึ่งเอง**)
- วัด acc.cjs: จอ 2560 การ์ดเริ่มที่ 288px (เดิม 610) · 2 คอลัมน์ยังจบระดับเดียวกัน · ไม่ล้น ไม่มี error

## ⚖️ หน้าบัญชี 2 คอลัมน์สูงเท่ากัน (14 ต.ค. 2569 · เวอร์ชัน 202610142200)
- ผู้ใช้ส่งรูป (ไม่มีข้อความ) หลัง CSS columns: คอลัมน์ซ้ายยาว (หน้าจอ+แอป+ตั้งค่า) ขวาสั้น (LINE+ชวนเพื่อน) → ที่ว่างใหญ่ขวาล่าง
- terminal.css ≥1100px: grid 2 คอลัมน์วางเอง (ตามลำดับ section.card ใน HTML): 2 หน้าจอ = ซ้ายแถว 2 · 3 แอป = ขวาแถว 2 · 4 ตั้งค่า = ซ้ายแถว 3–4 · 5 LINE = ขวาแถว 3 · 6 ชวนเพื่อน = ขวาแถว 4 · align stretch (การ์ดยืดเต็มช่อง) · max-width 1600 · **เพิ่ม/ย้ายการ์ดในหน้าบัญชี = ต้องแก้ตำแหน่ง nth-of-type ด้วย**
- วัด acc.cjs: ขอบล่างคอลัมน์ซ้าย = ขวา ทุกจอ (1440: 952/952, 1920: 873/873) · มือถือคอลัมน์เดียวเหมือนเดิม · adminLink ยังซ่อน · ไม่มี error

## 🧱 หน้าบัญชีไม่มีช่องว่าง (14 ต.ค. 2569 · เวอร์ชัน 202610142100)
- ผู้ใช้ (รูปหน้าบัญชี 1920px): "ทำไมแบบนี้" → grid 2 คอลัมน์ทำให้แถวสูงเท่าการ์ดที่สูงกว่า → ช่องว่างใต้การ์ด "หน้าจอ" + max-width 1180 ขอบว่างเยอะ
- terminal.css: `#tab-account` max-width 1440 · ≥1100px `column-count: 2` + `break-inside: avoid` (การ์ดต่อกันลงไป) · โปรไฟล์/ปุ่ม wide/เวอร์ชัน `column-span: all` · `.wide:not([hidden])` display block (ปุ่มเป็น inline-block ใช้ column-span ไม่ได้)
- **กับดัก: ใส่ `display` ให้องค์ประกอบที่มี `hidden` จะทำให้มันโผล่ — ปุ่มหลังบ้าน (#adminLink hidden) เกือบโผล่ให้ทุกคนเห็น ต้องใช้ `:not([hidden])`** (เจอในเครื่อง ไม่ได้ขึ้นเว็บ) · `section.card` (display block) ต้องยกเว้น `.profile` (flex)
- ทดสอบ acc.cjs 1440/1920/2560/390: ไม่ล้น, adminLink display none, signOut เต็มแถว, ไม่มี error · ภาพ compare/acc2-*.png

## 🎨 หน้าบัญชีมีสีสัน + ปุ่มสีกลับมาทั้งเว็บ (14 ต.ค. 2569 · เวอร์ชัน 202610142000)
- ผู้ใช้ (รูปหน้าบัญชีจอกว้างมาก): "ดูธรรมดาไม่มีสีสันเลย" → สาเหตุเดียวกับกรอบสถานะ: `html.dark .btn` ใน terminal.css ทับ `.btn.gold/.line/.danger` → ปุ่มเทาหมด + ฟอร์มยืดเต็มจอที่ ≥1700px (`.content` max-width none)
- terminal.css ท้ายไฟล์: `.btn.gold` เหลือง #f0b90b ตัวดำ (hover #fcd535) · `.btn.line` #06c755 · `.btn.danger` พื้นแดงจาง ตัวแดง · #setSave/#pwaPush/#shareCopy เป็นปุ่มทอง · `.seg button.on` พื้นทอง
- `#tab-account` (มืด): max-width 1180 กลางจอ · ≥1100px grid 2 คอลัมน์ (โปรไฟล์/ปุ่ม wide/เวอร์ชัน เต็มแถว) · การ์ดหมวดมีแถบบน 3px + หัวข้อสี `--acc` ตาม nth-of-type: 2 ม่วง #a78bfa · 3 ฟ้า #38bdf8 · 4 ทอง · 5 LINE #06c755 · 6 ชมพู #f472b6 (**ถ้าเพิ่ม/สลับการ์ดในหน้าบัญชี สีจะเลื่อนตาม — แก้ nth-of-type ด้วย**) · โปรไฟล์ไล่สีทอง + avatar วงทอง
- ทดสอบ `gold-signal-tools/acc.cjs` 1440/2560/390: ไม่ล้นจอ, สีปุ่มถูกทุกปุ่ม, ไม่มี error · ภาพ compare/acc-*.png (ภาพเก่า = รูปผู้ใช้)

## 🟩🟥 การ์ดสัญญาณได้กรอบสีกลับมา (14 ต.ค. 2569 · เวอร์ชัน 202610141900)
- ผู้ใช้ (รูปการ์ด "ถือ Sell" หน้ากราฟ มือถือ): "ขอกรอบตรงนี้กลับมาแบบเดิม ตรงอื่นเหมือนเดิม" → สาเหตุ: `html.dark .card` (0,2,1) ใน terminal.css ชนะ `.signal.SELL` (0,2,0) → กรอบ/พื้นสีตามฝั่งหาย
- terminal.css: `.signal.BUY/.SELL/.WAIT`, `.sig.buy/.sell/.skip`, `.intra.buy/.sell` ใต้ html.dark ได้กรอบ `--up/--down/--wait` + ไล่สีจาง 45% กลับมา · hover ไม่เปลี่ยนกรอบของการ์ดสถานะ (`:not(.signal):not(.sig):not(.intra)`)
- **กับดัก: กฎใน terminal.css ที่ขึ้นต้น `html.dark` แรงกว่าคลาสสถานะใน style.css — เพิ่มกฎใหม่ให้เช็กการ์ดที่มีสีตามสถานะด้วย**
- ทดสอบ `gold-signal-tools/sigframe.cjs`: กรอบ rgb(14,203,129) + พื้นไล่สี, ไม่มี error · ภาพ compare/sigframe-old/new-390.png (ภาพเก่า = รูปที่ผู้ใช้ส่ง)

## 🖥️ ดีไซน์ รอบ 3: จอเทรดมืออาชีพเป็นค่าเริ่มต้น (14 ต.ค. 2569 · เวอร์ชัน 202610141800)
- ผู้ใช้หลังรอบ 2: "เหมือนเดิมยังไม่ค่อยสวยเท่าไร" → ถามสไตล์ (แอปการเงินสะอาดตา / หรูดำ-ทอง / จอเทรดมืออาชีพ) → เลือก **จอเทรดมืออาชีพ (TradingView / Binance)** · บทเรียน: เดาสไตล์ 2 รอบไม่ตรง — งานดีไซน์ให้ถามทิศทางพร้อมตัวอย่างก่อน
- **ค่าเริ่มต้นเป็นโหมดมืด**: head script ใน index.html + `ui.js theme()` = dark ยกเว้น `gs-theme` = 'light' · `html.dark` ใส่/ถอดใน head script และ `applyTheme` · theme-color #0b0e11 / #faf8f3
- **`terminal.css`** (โหลดหลัง design.css, ทุกกฎขึ้นต้น `html.dark`): โทเคน --bg #0b0e11 --panel #161a1e --panel-2 #1e2329 --line #2b3139 --text #eaecef --muted #848e9c --gold #f0b90b --up #0ecb81 --down #f6465d radius 8 · การ์ดแบน ไม่มีเงา padding 14/16 · ไม่มี body::before/after, #dsDust, แสงวิ่ง · `.lv-stats` เป็นเซลล์ต่อกัน (gap 1px บนพื้นเส้น) ตัวเลข JetBrains Mono · ปุ่มที่เลือก = พื้น #2b3139 ตัวเหลือง ขีดใต้ inset · เมนูซ้ายแน่น (10px 14px, 15px)
- motion.js: `dark()` → ไม่วาดประกาย ไม่เอียงการ์ด · main.js applyChartTheme สีมืดเป็นชุดใหม่ (grid #1e2329 border #2b3139)
- โหมดสว่าง (theme.css รอบ 2) ยังอยู่ครบ เลือกได้ที่ปุ่ม ☀️ / หน้าบัญชี
- ทดสอบ shots.cjs (OUTDIR=term) ทุกแท็บ 1440/390 ไม่ล้นจอ ไม่มี error · ภาพ compare/term-*.png

## ✨ ดีไซน์ใหม่ รอบ 2: ให้เห็นความต่างชัด (14 ต.ค. 2569 · เวอร์ชัน 202610141700)
- ผู้ใช้หลังรอบ 1 ขึ้นเว็บ: "เห็นเหมือนเดิมเลย" → ตรวจแล้วเซิร์ฟเวอร์ส่งไฟล์ใหม่ถูก (index no-store, sw.js network-only) — สาเหตุจริงคือรอบ 1 เปลี่ยนน้อยเกินไป · **บทเรียน: งานดีไซน์ต้องต่างจนเห็นในภาพเทียบทันที**
- theme.css ท้ายไฟล์ (ธีมสว่างเท่านั้น, แทนบล็อกรอบ 1): body พื้น `#fbf6ea` + radial ทอง 3 จุด (fixed) + `body::before` แสงทองเคลื่อน `dsGlow` 14s · `.card/.quote` กระจก rgba(255,255,255,.72) blur 16px radius 24 · `.sec-title` แถบทองซ้าย · `#liveHero.lv` ไล่เฉด #2b1d03→#d9a530 ตัวหนังสือครีม, `.lv-price` 58px ขาว text-shadow ทอง (มือถือ 44px), ขึ้น #7dffc4 / ลง #ffb0b8 · เมนูซ้าย/`.seg/.tfs/.cc-tfs/.cc-mode` ที่เลือก = ทองไล่เฉด #f7cd5d→#d99a1c ตัวหนังสือ #2b1d03
- motion.js: ประกาย 42→80 จุด (มือถือ 18→30) ใหญ่และสว่างขึ้น
- ทดสอบ shots.cjs (OUTDIR=new2) ทุกแท็บ 1440/390 ไม่ล้นจอ ไม่มี error · ภาพ compare/design2-new-*.png

## ✨ ดีไซน์ใหม่ทั้งเว็บ: สัดส่วน · ครีม-ทอง · อนิเมชั่นจัดเต็ม (14 ต.ค. 2569 · เวอร์ชัน 202610141600 · branch design-refresh 9accc9a)
- ผู้ใช้: "อยากให้ออกแบบดีไซน์สัดส่วนของทั้งเว็บ ให้มีสัดส่วนเหมาะสม สีสัน อนิเมชั่น สมจริง" → เลือก **สว่าง ครีม-ทอง (แบบเดิมขัดเกลา)** + อนิเมชั่น **จัดเต็ม** · คงตำแหน่ง/เนื้อหาทุกการ์ด (เคยไม่เอาหน้าเรียบง่าย)
- **ขนาดตัวหนังสือ** 37 → 18 ขนาด (สคริปต์แทน `font-size` ใน style/live/theme.css ±2px, ต่ำสุด 11px)
- **สี** theme.css: `--bg #faf8f3`, `--panel-2 #f7f4ec`, `--line #ece6d8`, `--muted #6e6a60`, เงาโทนทอง · ท้าย theme.css (ธีมสว่างเท่านั้น): `#liveHero` พื้นทองแก้ว, `.lv-price` ตัวเลขไล่เฉดทองเข้ม, `--ds-sweep`
- **`design.css`** (โหลดหลัง theme.css ทั้ง 2 ธีม): ระยะ `--sp` 16/14px, การ์ด padding 20/16, การ์ดยกตัว+ขอบทองตอน hover, แท็บเปลี่ยน = การ์ดเลื่อนขึ้นทีละใบ (`dsIn` fill **backwards** — both จะทับ transform ของการ์ดเอียง; แท็บกราฟ/แดชบอร์ดใช้ fade เพราะกราฟวัดขนาดกล่อง), แสงวิ่ง+แสงทองหายใจบนการ์ดราคา, จุดกราฟเส้นเต้น, เมนูซ้ายแถบทอง, appbar กระจก, แสงทองลอยพื้นหลัง (body::after)
- **`motion.js`**: ประกายทอง canvas `#dsDust` (42 จุด / มือถือ 18, ~30fps, หยุดเมื่อแท็บซ่อน) · ระลอกทองตอนกดปุ่ม · `#lvPrice` เด้ง (ds-bump) · `.lv-stats b` ไฮไลต์เมื่อเปลี่ยน (ds-tick) · การ์ดราคาเอียง 3D ±1.1° ตามเมาส์ · `prefers-reduced-motion` = ไม่ทำอะไรเลย
- **มือถือ**: กราฟเส้นลงใต้ราคา (≤520px) · ตัวเลข nowrap · หน้าบัญชีเคยกว้าง 417–420px → `.settings` grid `minmax(0,1fr)` + select width 100% · tabbar `minmax(0,1fr)`
- ทดสอบ `gold-signal-tools/shots.cjs` (OUTDIR) ทุกแท็บ 1440/390 = ไม่ล้นจอ ไม่มี error · `dark.cjs` โหมดมืด ok, 61 fps · `ovf.cjs` หาองค์ประกอบที่ล้น · ภาพ compare/design-*.png

## 📉 ข้อ 8 อัปเดตตัวเลขหลังหักสเปรด + ผลจริง (14 ต.ค. 2569 · คู่มืออย่างเดียว ไม่แก้เว็บ)
- ผู้ใช้: "ทำมาเลย" (ข้อเสนอ: backtest หักสเปรดทุกระบบ) → พบว่าตัวเลข "ทดสอบ" ของระบบหลักบนเว็บ (`test-stats.json`, งาน monthly-research) **หักสเปรด $0.4 อยู่แล้ว** ไม่ต้องรันใหม่ · ที่ล้าสมัยคือข้อ 8 (ตัวเลข 5 ต.ค. ก่อนหักสเปรด)
- ระบบรายวันตอนนี้ **ขาดทุน −$217/ปีหลังสเปรด** (เดิมเขียน +$72) · ผลจริง 7–14 ต.ค. 28 ไม้ ≈ −$171 ชนะ 32% ทุกกรอบติดลบ
- เวลาตลาดฤดูหนาว (1 พ.ย. 2569): ไม่พบประกาศทางการของ Exness · ไม่รันสคริปต์ใน MT5 ที่เทรดเงินจริง → ให้ผู้ใช้เช็ก Specification → Sessions ของ XAUUSD

## 💬 กล่องถามจุดเข้ากว้างขึ้น (14 ต.ค. 2569 · เวอร์ชัน 202610141500)
- ผู้ใช้ (รูปกล่องแชท): "อยากให้ช่องมันกว้างขึ้นมันแคบไป" → ปุ่มคำถามด่วน 13 ปุ่มถูกจำกัด `max-height: 92px` (ต้องการ 146–218px) เห็นครึ่งเดียว + แถบเลื่อน
- style.css: `.cc-quick` เอา max-height/overflow ออก (เห็นครบ) · `.cc-panel` 400 → 540px (มือถือ 420 → 600px) · ช่องคำตอบ 126 → 176px (1440) / 212px (1920) / 188px (มือถือ)
- ทดสอบ `gold-signal-tools/chatwide.cjs <port> <tag>`: 1440/1920/390 ปุ่มไม่ถูกตัด, กราฟ = คอลัมน์ขวา (สมดุลเหมือนเดิม), ไม่ล้นจอ, ไม่มี error · ภาพ compare/chatwide-old/new-1440.png

## 📊 โควตา LINE คาดการณ์สิ้นเดือน + จัด Skill.md ใหม่ (14 ต.ค. 2569 · เวอร์ชัน 202610141400)
- ผู้ใช้: "อยากเพิ่มเติมอะไรไหม" → เสนอ 5 ข้อ → "ทำมา" (ข้อ 1 โควตา LINE + ข้อ 4 จัดคู่มือ)
- พบว่าระบบนับโควตามีอยู่แล้ว (`scripts/line-quota.js` ใน morning-plan.yml) และใช้จริง 57/300 (14 ต.ค.) — ไม่ใช่ 900+ ตามคู่มือเก่า → แก้ข้อ 7
- `line-quota.js`: เพิ่ม `projected` = ใช้ไป ÷ วันที่ผ่าน (เวลาไทย) × วันในเดือน (เริ่มคำนวณเมื่อผ่าน ≥ 2 วัน) ลง quota.json · `main.js renderQuota`: " · คาดสิ้นเดือน ~N" และ ⚠️ สีแดงถ้าคาดเกิน limit · ไม่มี broadcast ใหม่
- Skill.md: หัวข้อ zframes/4 ระบบหลังบ้านที่อยู่บนสุด → ย้ายลงบันทึก · คู่มืออ้างอิง 0–9 อยู่บน · บันทึกเรียงตามวันที่ใหม่ → เก่า (วันเดียวกันคงลำดับเดิม) · ข้อ 9 เรียง 1–25 · ตรวจด้วยสคริปต์: ทุกบรรทัดเดิมยังอยู่ (ข้ามบรรทัดใน ``` ไม่ถือเป็นหัวข้อ)
- ทดสอบ: รัน line-quota.js กับ API จำลอง → "57 / 300 · forecast 130" · node --check main.js · ข้อความหน้าบัญชีจะมีคาดการณ์หลังงานเช้ารอบถัดไปเขียน quota.json ใหม่
- หมายเหตุ: ข้อเสนอ Clerk production ต้องใช้โดเมน (เสียเงิน) — ขัดกับ "ใช้ของฟรีเท่านั้น" จึงไม่ทำ

## 📓🤖⭐ 4 ระบบหลังบ้านจากรูป "แกะ 4 ระบบหลังบ้าน" (14 ต.ค. 2569 · เวอร์ชัน 202610140100→202610140200 · commits ce0acb2, 348c3f2)
- ผู้ใช้ส่งรูป 6 ภาพ (Login+PDPA · Stripe+PromptPay+Webhook · Chatbot AI + Context Injection · Hybrid CMS): "อยากทำแบบนี้ให้มีระบบแบบนี้" → เลือก **ทำทั้ง 4** · PRO ปลดล็อก = โค้ช AI + แดชบอร์ด · ราคา "ยังไม่กำหนด ตั้งทีหลัง"
- **โครงใหม่: Vercel Functions ใน `api/*.mjs`** (middleware รับ body ไม่ได้) + `lib/gs.mjs` (cookie/Blob — ก๊อปจาก middleware.js เพราะ middleware import ไฟล์ไม่ได้ **แก้ต้องแก้ทั้งสองที่**) · middleware: ปล่อย `/api/*` ของสมาชิกผ่าน `next()`, `/lib/` = 404 · ทุก function ตรวจ cookie เอง (ไม่เชื่อ header)
- **1) สมุดเทรด** แท็บใหม่ `#journal` (tabbar six, `journal.js`) → `api/journal.mjs`: Blob `journal/<userId>.json` เจ้าของเท่านั้น (แอดมินไม่มีหน้าดู) · ฟิลด์ เวลา/ฝั่ง/กรอบ/เข้า/SL/TP/ออก/lot/ผล (ว่าง = คิดให้: 1 lot = 100 oz)/ตามระบบ?/อารมณ์ (calm fear greed revenge tired fomo)/โน้ต/บทเรียน · สรุป win% ตามระบบ vs เข้าเอง และตามอารมณ์ · ปุ่ม "เติมจากสัญญาณ" (GS_SIGNALS) · CSV (BOM) · ลบทั้งหมด (PDPA) · เรียงใหม่สุดก่อน เวลาเท่ากันใช้ `created`
- **2) บทความ** `api/articles.mjs` → Blob `content/articles.json` · เขียนในหลังบ้านแท็บ 📝 (ร่าง/เผยแพร่/ปักหมุด/ดูตัวอย่าง) · สมาชิกเห็นการ์ด "📝 บทวิเคราะห์จากทีม" บนแท็บข่าวสหรัฐ ทันทีไม่ต้อง deploy · เนื้อหาเป็นข้อความ + `## หัวข้อ` `**หนา**` `- รายการ` ลิงก์ — `GS_MD()` escape ก่อนเสมอ (ไม่รับ HTML)
- **3) โค้ช AI** ปุ่ม "ระบบ | 🤖 โค้ช AI" ในแชทหน้ากราฟ (`chartchat.js` `CC_COACH`) + ปุ่ม "ให้พี่โค้ชดูสมุดของฉัน" → `api/coach.mjs`: Vercel AI Gateway (Chat Completions, OIDC header `x-vercel-oidc-token` / `AI_GATEWAY_API_KEY`) โมเดล `AI_COACH_MODEL` ค่าเริ่มต้น `google/gemini-2.5-flash` (14 ต.ค.: เครดิตฟรี $5/เดือนของ Gateway ใช้ได้แค่บางโมเดล — Claude/DeepSeek/gemini-3.1-flash-lite ได้ 403 "Free tier users do not have access"; ใช้ได้: gemini-2.5-flash(-lite), gpt-4.1-mini, mistral-small, llama-4-scout, grok-4.1-fast · ≈ 0.06 บาท/คำถาม ~2,000 คำถาม/เดือน) · context = สัญญาณ 4 กรอบ + ข่าว 24 ชม. + ตั้งค่าความเสี่ยง (จากหน้าเว็บ) + สรุปสมุดเทรด + บทความล่าสุด 2 เรื่อง (ฝั่งเซิร์ฟเวอร์) · system prompt "พี่โค้ช" รับฟัง/เตือนวินัย ห้ามสั่งซื้อขาย ไม่เดาตัวเลข · history รับแค่ user/assistant 8 ข้อความ · `AI_DAILY_LIMIT` (30/วัน/คน, แอดมินไม่จำกัด) นับใน Blob `ai/usage-<วันไทย>.json` · ไม่เก็บบทสนทนา
  - 14 ต.ค.: ผู้ใช้ใส่บัตรแล้ว (เครดิตฟรี $5/เดือน) — ถ้าเครดิตหมด/ไม่มีบัตร Gateway ตอบ 402/403 แชทขึ้น "โค้ช AI ยังไม่พร้อมใช้งาน…"
- **4) PRO / Stripe — ถอดออกแล้ว (14 ต.ค. 2569)** ผู้ใช้: "ไม่เอาละระบบชำระเงิน" → "อยากแก้ไขให้มันเสถียรก่อนถึงค่อยมาทำระบบชำระเงิน" · **ทุกอย่างฟรีสำหรับสมาชิก** (สมุดเทรด บทความ โค้ช AI แดชบอร์ด) ไม่มี paywall/การ์ด PRO/แท็บ PRO หลังบ้าน/`/api/pay/*`
  - โค้ดชำระเงินทั้งหมดเก็บไว้ที่ branch **`payments-shelved`** (commit 277d6ad: `lib/stripe.mjs`, `api/pro.mjs`, `api/pay/*`, `api/golive.mjs` ปุ่ม 🚀, PRO ใน middleware/lib/gs, การ์ด PRO ใน journal.js, scripts/stripe-setup + grant-existing, test `gold-signal-tools/pro-payments.cjs`) — จะกลับมาทำ: merge/cherry-pick จาก branch นั้น · แผนเดิม: 199/เดือน 1,990/ปี บัญชี Stripe ไทยของผู้ใช้ "Thander" สมาชิกเดิมฟรี 30 วัน · ⚠️ เก็บเงินค่าสัญญาณอาจต้องมีใบอนุญาต ก.ล.ต.
  - ของภายนอกที่ยังค้าง (ไม่ได้ลบ รอผู้ใช้ตัดสิน): Vercel Marketplace Stripe sandbox `stripe-cerise-jacket` + env STRIPE_* ใน production (โค้ดไม่ได้อ่านแล้ว) · webhook endpoint ทดสอบ we_1UQIGm… ใน sandbox (ชี้ไป /api/pay/webhook ที่ไม่มีแล้ว)
- `privacy.html` เพิ่ม สมุดเทรด / โค้ช AI (ส่งอะไรให้ AI) (ส่วน Stripe เอาออกพร้อมระบบชำระเงิน)
- ทดสอบ: `gold-signal-tools/apitest.mjs <repo>` (ก๊อป middleware.js เป็น middleware.test.mjs ก่อน แล้วลบ) (Blob/Gateway จำลอง: สิทธิ์เจ้าของ, ร่างไม่หลุด, quota 429, PRO_ENABLED ค้างก็ไม่ล็อก, แดชบอร์ดเปิดทุกคน, /api/pay/webhook ไม่ล็อกอิน = 401, /lib/ 404) · `gold-signal-tools/pro.cjs` (puppeteer: หน้าเว็บเรียก handler จริงในเครื่อง — จดไม้ 2 ไม้/แก้/escape, บทความ, ไม่มีการ์ด PRO, โค้ช escape `<img>`, มือถือ 390 ไม่ล้น tab 65px×6, หลังบ้านเขียนบทความ ไม่มีแท็บ PRO) · preview จริง (ผู้ใช้ทดสอบ Clerk แล้วลบ + ลบ log/คิวสมาชิกใหม่): journal/articles/pro 200, webhook ไม่มีลายเซ็น 400, `/lib/` 404, coach 403 จาก Gateway (บัตร)
- บทเรียน: Git Bash แปลง `/api/...` เป็น path Windows → ใช้ `MSYS_NO_PATHCONV=1` กับ `npx vercel curl` · `vercel env pull` ได้ค่า sensitive เป็น `[SENSITIVE]` (ACCESS_SECRET) → ทดสอบล็อกอินด้วยผู้ใช้ทดสอบ Clerk แทนการปลอม cookie · `Response.text()` ตัด BOM ทิ้ง (เช็ก BOM จาก bytes)

## ⚡ เปิดเว็บเร็วขึ้น + 🐕 watchdog แจ้งแอดมินเมื่อระบบบันทึกหยุด (13 ต.ค. 2569 · เวอร์ชัน 202610130100)
- ผู้ใช้: "ทำมาเลย" (ข้อเสนอ 4 + 5)
- **เปิดเร็วขึ้น:** วัดแล้วหน้าโหลดรอ `refreshTech()` (บทวิเคราะห์ investing.com 8 กรอบ, ทีละ 3) ~8 วินาที → `init()` รอแค่กรอบบนจอ + กรอบใหญ่ถัดไป (2 คำขอ) และรอทั้งหมดไม่เกิน 4 วินาที (`Promise.race`) แล้วแสดงหน้า · ที่เหลือโหลดต่อเบื้องหลังแล้ว render ใหม่ + refreshTech() ครบ 8 กรอบ · SPLASH MIN_MS 2000 → 1200 · วัดในเครื่อง 9.1 → 3.8 วินาที · ตาราง "ภาพรวมทุกกรอบเวลา" ยังครบ 8 แถวหลังโหลด
- **watchdog:** `scripts/watchdog.js` รันใน new-members.yml ทุก 15 นาที (permissions actions: read) · เฉพาะตลาดเปิด (และเปิดมาแล้ว ≥25 นาที) · อ่าน runs ของ price-alerts.yml:
  - stopped = ไม่มีรอบกำลังรันและรอบล่าสุดจบ > 30 นาที · stuck = รอบรันนาน > 50 นาที · failing = 3 รอบล่าสุด (ไม่นับ cancelled) failure
  - ส่ง web push เฉพาะเครื่องแอดมิน (`push(texts, { adminsOnly: true })`) + LINE push ถึงเจ้าของถ้ามี LINE_OWNER_ID — **ไม่ broadcast** · แจ้งครั้งเดียวต่อปัญหา + แจ้ง "กลับมาทำงานแล้ว" (สถานะใน Blob `access/watchdog.json`)
  - check-loop.sh: นับ data_save ล้มติดกัน → ≥ 3 ครั้งในรอบเดียว = รอบ fail (watchdog เห็นเป็น failing)
  - ทดสอบ diagnose 6 กรณี (ปกติ, หยุด 45 นาที, ช่องว่าง 20 นาที, ค้าง 60 นาที, ล้ม 3 รอบ, ล้ม 2 + ปกติ) ถูกหมด · รันกับ API จริง: "recorder OK"
  - แอดมินต้องเปิดการแจ้งเตือนในเว็บ (หน้าบัญชี) ที่เครื่องนั้นก่อน ถึงจะได้รับ

## 📊 แดชบอร์ด: อัปเดตเองทุกเช้า + การ์ดสัญญาณ / ข่าว / ผลจริงสด (13 ต.ค. 2569 · commits 86d4b65 → bad1228+)
- ผู้ใช้: "ในส่วนของแดชบอร์ด มีอะไรอยากเพิ่มเติม ที่สำคัญจริงๆ" → เสนอ 3 ข้อ → "ทำมาหมดเลย"
- **1) อัปเดตตัวเลขทุกเช้า** — `zframes-build/` = สำเนาโค้ด /zframes (build_dashboard.py + models gold/ndx/stocks/div + notes; Python มาตรฐาน ไม่ต้อง pip) · `.github/workflows/zframes-refresh.yml` ทุกวัน 06:00 ไทย (cron 0 23 UTC) + กดเองได้ → `scripts/zframes-refresh.sh`: data_load → สร้าง 4 แดชบอร์ด → ถ้าการ์ดน้อยกว่าเมื่อวาน (แหล่งข้อมูลล่ม) เก็บไฟล์เดิม → data_save ลง branch data (ไม่ deploy) · middleware เสิร์ฟ `/zframes/dashboards/(gold|ndx|spx|div).json` จาก branch data
  - บนเซิร์ฟเวอร์ไม่มี MT5/EA (APPDATA ว่าง) → ไม่มีการ์ด EA / ข่าว MT5 / ข้อมูลบัญชี และไม่ขึ้นคำเตือน "อ่าน snapshot.json ไม่ได้" · **ห้ามคัดลอก dashboards ที่ build ในเครื่องที่มี MT5 ขึ้นเว็บ** (มี EA GoldTraderLive / บัญชี Exness) — ถ้าจะ build ในเครื่องให้ตั้ง `APPDATA=""`
  - ⚠️ **FRED ไม่ตอบเครื่อง GitHub เลย** (ทดสอบ 13 ต.ค.: 17/17 series ใช้สำเนา) → ตัวเลข FRED-only (ดอกเบี้ย Fed, SOFR, real yield, breakeven, credit spread, CPI) ค้างที่ 12 ต.ค. จนกว่าจะใส่ secret `FRED_API_KEY` (ฟรี https://fred.stlouisfed.org/docs/api/api_key.html) — โค้ดรองรับแล้ว (api.stlouisfed.org) · yield/VIX/DXY/S&P ในแดชบอร์ดยังสดจาก Yahoo
  - Binance `api.binance.com` ตอบ 451 กับเครื่อง GitHub (สหรัฐ) → fallback `data-api.binance.vision`
  - FRED ไม่ตอบ/ช้ากับเครื่อง GitHub → `fred()` ลอง 2 ครั้ง (timeout 15 วิ) แล้วใช้สำเนา `models/cache/fred` (actions/cache) หรือ `models/fred-seed` (commit ไว้ 13 ต.ค.) + log "FRED did not answer" + คำเตือนบนแดชบอร์ด · แต่ละแดชบอร์ดใช้ ~3 นาที (รอบแรก FRED ล้ม → การ์ดหาย 6 ใบ → แก้แล้ว)
  - `dash.notesAsOf` (วันที่ notes) → หัวแดชบอร์ด "ตัวเลขอัปเดต <เวลา> · บทวิเคราะห์ <x วันก่อน>" (> 3 วัน = สีเตือน ⚠️) · บทวิเคราะห์ (notes) เปลี่ยนเฉพาะตอน Claude เขียนใหม่: แก้ `D:\โปรเจคทันเดอร์\zframes\notes\*.json` แล้วคัดลอกไป `Traeding/zframes-build/notes/` + push (รอบเช้าถัดไปใช้ หรือกด Run workflow)
- **2) การ์ด "สัญญาณ Gold Signal ตอนนี้"** (แดชบอร์ดทองคำ, แท็บราคาสด, กว้าง 2 ช่อง) — `zframes/site-cards.js` อ่าน `parent.GS_SIGNALS()` (chartchat.js: snapAll 5m/15m/30m/1h) ทุก 15 วิ: ทิศ · Buy % · Sell % · สถานะ (ถือ/พัก/งดข่าว/เข้าได้/รอ) + ปุ่ม "เปิดหน้ากราฟ →"
- **3) การ์ด "ข่าวแรงสหรัฐที่จะออก"** ทุกแดชบอร์ด (ทอง 1 ช่อง, หุ้น/ปันผล เต็มแถว) — `parent.GS_NEWS()` (state.news) นับถอยหลังทุกวินาที · ±30 นาที = "⚠️ ช่วงข่าวออก"
- การ์ด "ผลจริงของ Gold Signal" นับใหม่สดจาก `parent.GS_RECORD()` (state.chartSig + state.signals) ทุก 60 วิ — ตรงกับหน้าเว็บ
- นอกเว็บ (runtime ในเครื่อง) ไม่มี parent hooks → ไม่มีการ์ดเพิ่ม · ทดสอบ `gold-signal-tools/zcards.cjs` ไม่มี error

## ZFrames บน Gold Signal (12 ต.ค. 2569)

- เมนู “แดชบอร์ด” ใช้ hash `#zframes` ในแอปหลักและแสดง `/zframes/index.html?embed=1` ใน iframe เดียวกัน จึงสลับไปแท็บสัญญาณ/กราฟได้โดยไม่โหลดเว็บใหม่; หน้า ZFrames แบบเปิดตรงมีปุ่มกลับ `/#home` และตั้ง `gs-skip-splash-once` ใน sessionStorage เพื่อข้ามภาพเริ่มต้นหนึ่งครั้ง
- หน้าแดชบอร์ดสำหรับสมาชิก: `/zframes/index.html` เลือก GOLD, Nasdaq 100, S&P 500 และหุ้นปันผลจากเมนู "แดชบอร์ด" ของเว็บหลัก
- ข้อมูลวิเคราะห์ใน `zframes/dashboards/*.json` เป็น snapshot ณ เวลาที่ระบุบนหน้าเว็บ; ราคา Hyperliquid ผ่าน WebSocket และแท่งเทียนผ่าน candleSnapshot, หุ้น Yahoo ผ่าน WebSocket โดยใช้ `/api/zframes/quotes` สำหรับราคาเริ่มต้นและสำรอง
- API ราคาหุ้นอยู่หลังการตรวจสมาชิกใน `middleware.js`; ไม่รวมสถานะ EA/บัญชี Exness จากเครื่องส่วนตัวในไฟล์ที่เผยแพร่
- เมื่ออัปเดตข้อมูลวิเคราะห์ ให้บันทึก JSON ใหม่ แล้ว deploy พร้อมตรวจหน้า desktop/mobile และสถานะราคาสด

## 🧭 งานที่ทำเพิ่ม: zframes Dashboard (12 ต.ค. 2569 · v0.5.1)

- งานวิเคราะห์แยกอยู่ที่ `D:\โปรเจคทันเดอร์\zframes`; รายละเอียดและประวัติอยู่ใน [zframes/Skill.md](../zframes/Skill.md) เปิดด้วย `Start-zframes.cmd` หรือ http://127.0.0.1:37263/?d=gold (มีหน้า `ndx`, `spx`, `div`)
- zframes อ่าน `signals.json` และ `chart-signals.json` ของ Gold Signal เพื่อแสดงผลสัญญาณย้อนหลัง; ไม่แก้กติกา Gold Signal, ไม่ส่ง LINE และไม่ส่งคำสั่งซื้อขาย
- ราคาสดใช้ Yahoo stream สำหรับหุ้น และ Hyperliquid WebSocket สำหรับสินทรัพย์ `xyz`; HTTP ทุก 1 วินาทีเป็นทางสำรองเมื่อ WebSocket หลุด ข้อมูลส่งถึงหน้าเว็บผ่าน SSE และดูสถานะได้ที่ `/api/hub`
- กราฟแท่งเทียนทองเลือก 1m/5m/15m/1h แสดงราคาเปิด–สูง–ต่ำ–ปิด ชี้แท่งเพื่อดูย้อนหลัง พร้อมป้ายอายุข้อมูลจริง; แท่งล่าสุดขยับตามราคา mid และซิงก์ OHLC จาก Hyperliquid ทุก 15 วินาที
- ปรับหัวข้อ การ์ด ปุ่มช่วงเวลา และจอเล็กให้อ่านง่ายขึ้น; ตรวจหน้า gold จริงแล้ว 72 แท่ง เปลี่ยน 5m→1m ได้ ไม่มี JavaScript error; หน้า spx 38 การ์ด และ lint ทั้ง 4 หน้าใช้ได้
- เมื่อแก้งาน zframes เสร็จแต่ละครั้ง ให้บันทึกการเปลี่ยนแปลงและผลตรวจใน [zframes/Skill.md](../zframes/Skill.md)

- 12 ต.ค.: ปุ่มหมวด (Live, Cockpit, Technicals, Macro, Context …) เป็นแท็บ แสดงทีละหน้า ไม่เลื่อนลง ทั้ง 4 แดชบอร์ด · ไฟล์ `zframes/app.js`, `zframes/style.css` (v=2026101204) · ภาษาไทย: ปุ่ม/หัวข้อ/ชื่อการ์ดแปลใน `zframes/app.js` (`thDash`) + สถานะ RSI ใน `live.js` (v=2026101205) · 12 ต.ค.: ราคาทองในแดชบอร์ด = ราคาสดของเว็บ (investing.com) — main.js `window.GS_LIVE()`, `zframes/site-live.js` `siteGold()` ป้อน xyz:GOLD + spot:XAU ทุก 250 ms; ฟีดอื่น (Hyperliquid/gold-api) เติมได้แค่ prev/vol/OI · ผู้ใช้: "ยังไม่เรียลไทม์ ไม่ตรงกัน" (หัวเว็บ 4,185.50 vs แดชบอร์ด 4,185.30/4,185.25, แท่งเทียน "ช้า 24 วิ")

## ↔️ แดชบอร์ดเต็มความกว้าง (12 ต.ค. 2569 · zframes style ?v=2026101211 · iframe v=202610122800)
- ผู้ใช้ (รูป Nasdaq heatmap มีขอบว่างซ้ายขวา): "ขยายให้เต็มขอบจอ" → `zframes/style.css`: `.embedded main { max-width: none; padding 16px }` (เดิม max-width 1500px กึ่งกลาง) · เฉพาะตอนฝังในเว็บ (`?embed=1` → html.embedded) · วัด 1670px: เนื้อหา 1670 / heatmap 1600 · 1200px ไม่ล้น

## 💬 กล่องถามตอบกระชับ + จัดหน้ากราฟใหม่ให้ยังสมดุล (12 ต.ค. 2569 · เวอร์ชัน 202610122700)
- ผู้ใช้ (รูปข้อความต้อนรับในแชท): "เอาอันนี้ออก ปรับให้กล่องถามตอบมันกระชับขึ้น"
- `chartchat.js`: ไม่มีข้อความต้อนรับแล้ว (ลบ greet) · กล่องว่างแสดงคำใบ้บรรทัดเดียว (CSS `.cc-log:empty::before`) · หัวเหลือ "💬 ถามจุดเข้า Buy / Sell" · ท้ายเหลือ "ตอบจากระบบที่ทดสอบแล้ว · ไม่ใช่คำแนะนำการลงทุน"
- ความสูงแชทคงที่ 400px (มือถือ 420px) — เลิกให้แชทยืดเติมที่ว่าง
- ให้หน้ายังสมดุล: การ์ด "แนวรับ–แนวต้าน" กลับไปใต้การ์ดสัญญาณ (คอลัมน์ขวาบน, `aside > .card:last-child { flex: 1 }`) · "🧮 คำนวณขนาดไม้" ย้ายไปใต้ "เส้นค่าเฉลี่ยราคา" (แถวล่างขวา, ผลคำนวณ 3 คอลัมน์) · ปุ่ม 🧮 บนกราฟยังเลื่อนไปหา #tpCalc เหมือนเดิม
- วัด 1280–2600px: กราฟ = คอลัมน์ขวา (กราฟหลักยืดเล็กน้อย 460–483px), แชท 400px, แถวล่างสูงเท่ากัน · มือถือไม่ล้น ไม่มี error

## ⏳ หน้าโหลดแบบพอดี: คำโปรย · % · 3 ชิป (12 ต.ค. 2569 · เวอร์ชัน 202610122600)
- ผู้ใช้หลังเหลือแค่โลโก้ + %: "อันนี้ก็น้อยไป ไม่มีอะไร เอาออกหมดเลย ดีไซน์ให้มันเหมาะสม"
- ตอนนี้: โลโก้/วงแหวน · "Gold Signal" · "สัญญาณเทรดทองคำ · เรียลไทม์" · % · ชิป 3 อัน **ราคาสด (≥60%) · ข้อมูลกราฟ (≥80%) · สัญญาณ (100%)** — ยังไม่ถึง = เทา, กำลังโหลด = ขอบทอง + จุดกะพริบ, เสร็จ = ✓ พื้นทอง (auth.js count() ตาม data-at) · ไม่มีประโยคยาว/รายการขั้นตอน · MIN_MS 2000
- รูป: compare/splash-mid-mobile.png (45%), splash-late-mobile.png (80%)

## ⏳ หน้าโหลดเหลือแค่โลโก้ + ชื่อ + % (12 ต.ค. 2569 · เวอร์ชัน 202610122500)
- ผู้ใช้: "อยากให้ออกแบบหน้าตอนโหลดใหม่ มันดูเยอะเกินไป พวกคำต่างๆ"
- ลบ: บรรทัด "สัญญาณเทรดทองคำ XAU/USD · เรียลไทม์", ข้อความสถานะ (#splashText), รายการขั้นที่เสร็จ ✓ (#splashSteps) · คง: วงแหวน + โลโก้เคลื่อนไหว, "Gold Signal", % (role=status)
- `auth.js`: `SPLASH.step(text, pct)` ยังรับ text (ผู้เรียกใน main.js ไม่ต้องแก้) แต่ใช้แค่ % · MIN_MS 4000 → 1500 (ไม่มีข้อความให้อ่านแล้ว) · วงแหวนวิ่งเร็วขึ้น (0.035 → 0.06)
- ทดสอบ `gold-signal-tools/splash.cjs` มือถือ/คอม: ข้อความบนหน้าโหลด = "Gold Signal 100%" ไม่มี error

## ✂️ เอาแท็บ "วิธีใช้" ออก (12 ต.ค. 2569 · ui.js ?v=202610122400)
- ผู้ใช้: "เอาวิธีใช้ออก" → ลบลิงก์ 📖 วิธีใช้ ในเมนู + ทั้ง section `#tab-learn` (75 บรรทัด) · `ui.js` TABS เหลือ home/stats/chart/zframes/account · เมนูมือถือ `tabbar five` (5 ช่อง) · ลิงก์เก่า `#learn` เปิดหน้าสัญญาณแทน
- คงไว้: "วิธีใช้สัญญาณนี้ (3 ขั้น)" ที่พับอยู่ในการ์ดหน้าสัญญาณ (ไม่ใช่แท็บ) · ทดสอบ `gold-signal-tools/learn.cjs` ไม่มี error มือถือไม่ล้น

## 🧪 ทดสอบสัญญาณแบบรูป FollowSell / BUY (12 ต.ค. 2569) — ไม่ผ่าน ไม่นำมาใช้
- ผู้ใช้ส่งรูปกราฟ (FollowSell ตอนเด้งชนเส้นค่าเฉลี่ยในขาลง, BUY สามเหลี่ยมที่จุดต่ำ, BOS): "อยากให้ทำสัญญาณแบบนี้ จุดเข้า Buy กับ Sell"
- `research/indicators/followtest.js` (DATA_DIR = bars2y.json): follow20/follow50 (เทรนด์ EMA50/200 + ราคาเด้งแตะ EMA20/50 แล้วปิดกลับ), rsiRev (RSI กลับจาก 30/70), rsiTrend (RSI กลับตามเทรนด์ใหญ่) × Buy/Sell × SL 1/1.5/2×ATR × TP 1/1.5/2:1 × 5m/15m/30m/1h = 288 แบบ, 2 ปี, สเปรด $0.4
- ผล: **ไม่มีแบบไหนกำไรครบ 4 ช่วง (0/288)** · ผ่านช่วง 1–3 มี 13 แบบ (30m/1h Buy) แต่ช่วงล่าสุดขาดทุนทั้งหมด · 5m/15m ขาดทุนเกือบทุกแบบ (follow20 5m: 4,613 ไม้ −$2,472) · Sell ทุกกรอบไม่ผ่าน
- → ไม่ใส่เป็นสัญญาณเข้า (ระบบปัจจุบันชนะในช่วงล่าสุดดีกว่า) · ถามผู้ใช้ว่าจะโชว์เป็นเครื่องหมายดูอย่างเดียวไหม

## 🗂️ ข้อมูลสัญญาณย้ายไป branch `data` — โควตา Vercel ไม่เต็มอีก (12 ต.ค. 2569 · commit 110666c)
- ปัญหา: ทุกครั้งที่ check-loop บันทึกไม้ ("Signal update" ทุก ~5 นาที) = commit บน main = Vercel deploy ทั้งเว็บ · Hobby ให้ 100 deploy/วัน → 12 ต.ค. เต็ม ("Deployment rate limited — retry in 24 hours") งานแก้เว็บค้าง + ข้อมูลไม้บนเว็บค้าง
- ใหม่: `signals.json intraday.json chart-signals.json quota.json backtest.json backtest-30m.json backtest-15m.json` อยู่บน **branch `data`** (main เก็บแต่โค้ด — สำเนาบน main หยุดอัปเดตตั้งแต่ 110666c ใช้เป็น fallback เท่านั้น)
  - `vercel.json`: `git.deploymentEnabled.data = false` → push ไป data ไม่สร้าง deploy
  - `scripts/data-branch.sh`: `data_load` (ดึงไฟล์จาก origin/data มาไว้ใน working tree; fetch depth 50 + refspec `+refs/heads/data:refs/remotes/origin/data` เพราะ actions/checkout clone แค่ main) · `data_save "msg"` (git worktree บน DATA_BASE → commit → rebase บน origin/data → push HEAD:data, retry 3 ครั้ง — แก้บรรทัดเดียวกันพร้อมกัน = fail แล้วรอบหน้าลองใหม่ เหมือนเดิม) · DATA_BASE ส่งข้าม step ผ่าน GITHUB_ENV
  - check-loop.sh: `data_load` ต้นทุก check, `data_save` แทน git commit/pull/push · morning-plan.yml / weekly-summary.yml: step "Load signal data" หลัง checkout + `data_save` ตอนบันทึก · monthly-research ยังอยู่บน main (test-stats.json เดือนละครั้ง)
  - `middleware.js`: สมาชิกที่ล็อกอินขอ `/signals.json` ฯลฯ → ดึงจาก raw.githubusercontent.com/…/data (`?t=` เปลี่ยนทุก 10 วิ ทะลุ cache 5 นาทีของ GitHub, เก็บในเครื่อง 10 วิ, header `x-gs-data: data-branch`) · GitHub ล่ม → ไฟล์ที่ deploy ไว้ (`next()`) · ไม่ล็อกอิน = 401 เหมือนเดิม
- ผล: ข้อมูลไม้บนเว็บสดขึ้น (ไม่ต้องรอ deploy) · Vercel deploy เฉพาะตอนแก้โค้ด
- ทดสอบ: middleware ในเครื่อง (cookie จริง) ได้ 200 จาก GitHub ~0.3 วิ, ครั้งที่สอง 1 ms, ไม่มี cookie 401 · sandbox 2 runner บันทึกพร้อมกันคนละไฟล์ผ่าน, ไฟล์เดียวกันชน = fail ตามคาด, worktree ลบสะอาด
- ตอนสลับ: push โค้ด → รอรันเก่า (โค้ดเก่า) จบ 16:20 → สร้าง data จาก main ล่าสุด → ไม่มีรันเก่าค้างในคิว · thander1 deploy ได้อีกครั้ง 16:12 (งานวันนี้ขึ้นครบ)
- ⚠️ zframes `models/gold_model.py` อ่าน signals.json / chart-signals.json จากโฟลเดอร์ Traeding ในเครื่อง → ถ้าอยากได้ผลล่าสุด `git fetch origin data` แล้ว `git show origin/data:chart-signals.json`

## ✂️ เอากล่อง ATR ออกจากการ์ดสัญญาณ (12 ต.ค. 2569 · เวอร์ชัน 202610122300)
- ผู้ใช้ (รูปกล่อง "ราคาแกว่งเฉลี่ย (ATR) ±11.34 ต่อ 1 แท่งเทียน"): "เอาอันนี้ออก" → ลบบรรทัด box ATR ใน renderSignal (main.js) · `.plan:empty { display: none }` กันช่องว่าง (จุดรอซื้อ/ขายของ investing ยังแสดงถ้ามี)

## ⚖️ หน้ากราฟสมดุล ไม่มีช่องว่าง (12 ต.ค. 2569 · เวอร์ชัน 202610122200)
- ผู้ใช้ (รูปจอกว้าง ช่องว่างใหญ่ข้างกราฟ): "ทำให้สมดุลกัน ไม่เว้นช่องว่างไว้"
- ≥1081px: `.layout { align-items: stretch }` — การ์ดกราฟกับคอลัมน์ขวาสูงเท่ากันเสมอ · ถ้าคอลัมน์ขวาสูงกว่า → กราฟหลักขยาย (`.chart-main` flex 1, min 440px; lightweight-charts autoSize ตามกล่อง) · ถ้ากราฟสูงกว่า → การ์ดสัญญาณยืด และแชทขยาย (`.cc-panel` flex 1, min 520px)
- ย้ายการ์ด "แนวรับ–แนวต้าน" จากคอลัมน์ขวาบน → ใต้ "เส้นค่าเฉลี่ยราคา" ในแถวล่าง (`.layout2` คอลัมน์ขวาเป็น `.side`) ให้สูงพอ ๆ กับตารางตัวชี้วัด 12 แถว · การ์ดสุดท้าย flex 1 ให้จบระดับเดียวกัน
- วัด 1280/1440/1920/2600px: การ์ดกราฟ = คอลัมน์ขวา, แถวล่างสองฝั่งสูงเท่ากัน · มือถือไม่เปลี่ยน (กราฟ 340px) ไม่ล้นจอ · ทดสอบ `gold-signal-tools/bal.cjs`

## 💬 แชทย้ายเข้าการ์ดสัญญาณ (12 ต.ค. 2569 · เวอร์ชัน 202610122100)
- ผู้ใช้ (รูปส่วน "ความเห็นภายนอก (investing.com) — ข้อมูลประกอบ"): "เอาถามตอบอยู่ตรงนี้แทน"
- แชทอยู่ใน `#ccSlot` ของการ์ดสัญญาณ (แบบนักเทรด) แทนรายการเหตุผล investing.com · ไม่มีปุ่มลอยแล้ว · แบบง่าย (ไม่มีการ์ดข้าง) แชทย้ายไปใต้กราฟเอง (`place()` + MutationObserver บน #chartPro/#chartSimple hidden)
- `#reasons` / `#warns` ยังอยู่แต่ hidden (main.js ยังเขียนลง) + `.reasons[hidden] { display: none }` · ความเห็น investing.com ยังมีบรรทัดสั้นใต้คำตัดสิน ("ความเห็นภายนอก") และความมั่นใจ %
- ทดสอบ `gold-signal-tools/chat3.cjs`: อยู่ในการ์ด · สลับแบบง่าย/นักเทรดย้ายถูก · มือถือ 390px ไม่ล้น · ไม่มี error
- ⚠️ commit นี้รอโควตา Vercel (rate limited 12 ต.ค. ~15:30)

## 💬 แชทขยาย: 5 / 15 / 30 นาที / 1 ชม. (12 ต.ค. 2569 · เวอร์ชัน 202610122000)
- ผู้ใช้: "แชทถามตอบขอขยาย กรอบ 5 นาที 30 นาที 1 ชม. 15 นาที ถามตอบมากกว่านี้ ของการเข้า Buy หรือ Sell"
- แถบเลือกกรอบในแชท: ตามกราฟ · 5 นาที · 15 นาที · 30 นาที · 1 ชม. (ถามกรอบอื่นได้โดยไม่ต้องเปลี่ยนกราฟ) · พิมพ์ชื่อกรอบในคำถามก็ได้ ("Buy 15 นาทีได้ไหม")
- `chartzones.js`: `window.CZ_TFNOW(tf, fast)` = decide/sideInfo/brake/ไม้ที่บันทึก ของกรอบใดก็ได้ แบบเดียวกับการ์ด · `window.CZ_ZONES_OF(bars)` = โซน + กรอบราคา · กรอบที่อยู่บนกราฟยังใช้ CZ_NOW ของการ์ดเอง (ตัวเลขตรงกันเสมอ) · 5m ดึงแท่งเอง (`loadBars('5m')`, cache 60 วิ) เมื่อกราฟไม่ได้อยู่ 5m
- คำถามใหม่: **สรุป 4 กรอบ** (ทิศ/คะแนน/Buy%/Sell%/ไม้ที่ถือ + แนะนำกรอบที่เข้าได้หรือใกล้สุด + กรอบเล็ก/ใหญ่ตรงกันไหม) · **Buy กรอบไหนดี / Sell กรอบไหนดี** (เรียงตามความพร้อม + ผลทดสอบ + SL/TP) · **ทำไมยังไม่เข้า** (เทรนด์แต่ละกรอบย่อย + ขาดอีกกี่คะแนน + ตัวยืนยัน) · **ผลทดสอบ / ผลจริง** (win% + 4 ช่วง + ไม้จริงที่บันทึก) — รวมของเดิม 13 ปุ่ม
- ทดสอบ `gold-signal-tools/chat2.cjs` ทุกคำถาม × 4 กรอบ + พิมพ์ 6 แบบ + มือถือ ไม่มี error

## 🔺🔻 ลูกศรขึ้น/ลงตามกรอบที่ดู (12 ต.ค. 2569 · chartzones.js ?v=202610121900)
- ผู้ใช้: "ไม่เห็นมีลูกศรขึ้นลง เขียวคือขึ้น แดงคือลง แดงไม่เห็นมีเลยตั้งแต่ทำมา"
- สาเหตุ: ลูกศรเล็กใช้ `dec.lean` = เครื่องหมายของคะแนนรวมหลายกรอบ (รวมกรอบใหญ่) → ช่วงทองขาขึ้นยาว คะแนนรวมยังบวกตอนกราฟที่ดูอยู่ร่วง = เขียวตลอด · และมุมมองสะอาด (ค่าเริ่มต้น) ซ่อนลูกศรเล็กทั้งหมด
- ใหม่: `fdir(dec)` (window.CZ_FDIR) = ทิศของกรอบที่ดูอยู่เอง: ค่าเฉลี่ยโหวตอินดิเคเตอร์ของ frames[0] (|avg| ≥ 0.15) ไม่งั้นใช้ EMA 9/21 · ลูกศรขนาด 1 **ตรงแท่งที่เปลี่ยนทิศ** (▲ เขียว = เปลี่ยนเป็นขึ้น, ▼ แดง = เปลี่ยนเป็นลง) แสดงทั้งสองมุมมอง · มุมมองอินดิเคเตอร์มีลูกศรจางทุกแท่งด้วย · ป้าย "▲ ขึ้น / ▼ ลง" บนการ์ดใช้ทิศเดียวกัน · เพิ่มคำอธิบายใน legend
- ไม่เปลี่ยนกติกาสัญญาณ (Buy/Sell ใช้คะแนนเดิม) — เป็นแค่ลูกศรบอกทิศ

## 💬 แชทถามจุดเข้าในหน้ากราฟ (12 ต.ค. 2569 · เวอร์ชัน 202610121800)
- ผู้ใช้: "อยากให้มีแชทถามตอบในหน้าของกราฟ ว่าควรเข้าตำแหน่งไหน ไม่ควรเข้าตำแหน่งไหน"
- `chartchat.js`: ปุ่มลอย "💬 ถามจุดเข้า" เฉพาะแท็บกราฟ (ทั้งแบบง่าย/นักเทรด) → แผงแชท (มือถือ = เต็มความกว้าง เหนือแถบเมนูล่าง) · ปุ่มคำถามด่วน 8 ปุ่ม + พิมพ์เองได้
- **ไม่ใช้ AI / ไม่ส่งข้อมูลออก** — ตอบจากระบบบนกราฟกรอบที่เลือกอยู่เท่านั้น: `window.CZ_NOW` (chartzones.js renderChartZones: sides/pct/verdict/open/brake/stretched/unconf), `window.CZ_LEVELS` (setChartDecor: โซนซื้อ/ขาย + กรอบราคา envelope แท่งล่าสุด), `state.pivotLv` (renderLevels), `state.news`, `state.chartSig` (ไม้ที่ถือทุกกรอบ)
- คำตอบ: ตอนนี้ควรเข้าไหม · ซื้อ/ขายตรงไหน (จุดรอ = โซน + ขอบกรอบราคา, เตือนถ้าใกล้โซนฝั่งตรงข้าม) · ตรงไหนไม่ควรเข้า (โซนฝั่งตรงข้าม, นอกกรอบราคา, ช่วงข่าว ±30 นาที, ฝั่งที่ทดสอบไม่ผ่าน, สวนเทรนด์, ระบบพัก) · SL/TP · แนวรับ–ต้าน · ข่าว · ไม้ทุกกรอบ · **ประเมินราคาที่พิมพ์** ("ซื้อที่ 4150 ได้ไหม" → ในโซนไหน/ไล่ราคาไหม + SL/TP ถ้าเข้าที่ราคานั้น)
- ถ้าระบบกรอบนั้นถือไม้อยู่ → ตอบว่าถือตามแผน ไม่เปิดไม้ใหม่ · ทุกคำตอบย้ำว่าต้องรอความพร้อม 100% (ระบบเข้าตามคะแนน ไม่ใช่ราคาอย่างเดียว)
- ทดสอบ: `gold-signal-tools/chat.cjs` (ข้อมูลจำลอง) 11 คำถาม × 3 กรอบ (30m/1h/5m) + คลิก/พิมพ์จริง + มือถือ 390px ไม่ล้นจอ ไม่มี error

## 🎨 แดชบอร์ดสีเดียวกับเว็บ (12 ต.ค. 2569 · iframe v=202610121600, zframes ?v=2026101209)
- ⏪ **ยกเลิกแล้ว (12 ต.ค. 2569)** ผู้ใช้: "เอาแบบเดิมดีกว่า" → คืนไฟล์ zframes + iframe เป็นสีม่วงเดิม (iframe v=202610121700, zframes ?v=2026101210) — อย่าเปลี่ยนสีแดชบอร์ดอีกถ้าไม่ได้ขอ
- ผู้ใช้: "อยากให้สีพื้นหลังไปทางเดียวกับเว็บ" → `zframes/style.css` ท้ายไฟล์ override `:root` เป็นพาเลตธีมมืดของ Gold Signal (พื้น #0d1016 · การ์ด #151a23 · เส้น #262e3b · ตัวหนังสือ #e6e9ef · ทอง #e8b64c · ขึ้น #22c58b · ลง #f0506e) + พื้นหลังไล่สีกรมท่ามีแสงทองจาง ๆ มุมขวาบน · ปุ่มหมวดที่เลือก = ทอง ตัวหนังสือเข้ม
- สีม่วงที่ฝังในโค้ด → ทอง: frames.js (เส้นสด), frames2.js (COLORS ตัวแรก + สีเส้น), live.js (idx.signals) · frames3.js heat() ฐานสีเทาม่วง (40,36,58) → เทากรมท่า (38,44,56)
- แก้เฉพาะสำเนาในเว็บ (Traeding/zframes) — ตัว local runtime `zframes/public` ยังเป็นสีม่วงเดิม
- แดชบอร์ดเป็นธีมมืดเสมอ (เว็บค่าเริ่มต้นเป็นธีมสว่าง แต่กราฟ/heatmap อ่านง่ายกว่าบนพื้นมืด)

## 🧹 เก็บงาน: % ทองแดชบอร์ด · แดชบอร์ดบนมือถือ · CSS เก่า (12 ต.ค. 2569 · เวอร์ชัน 202610121500)
- `window.GS_LIVE()` ส่ง `prev` (ราคาปิดก่อนหน้าแบบเดียวกับหัวเว็บ `prevClose()`) → `zframes/site-live.js` ใช้คิด % วันนี้ของทอง (ไม่ใช้ prev ของ Hyperliquid)
- แดชบอร์ด: `html, body { overflow-x: clip }` (เดิม hidden → body กลายเป็นกล่องเลื่อน แถบหมวด sticky เลยไม่ติด) · ≤700px แถบหมวดแถวเดียวเลื่อนข้าง ปุ่มที่เลือกเลื่อนมากลางเอง
- `.news-live[hidden] { display: none }` — เดิม `display:flex` ทับ hidden → มีแถบว่างบนสุดทุกหน้าตอนไม่มีข่าว (บั๊กตั้งแต่ทำแถบข่าวสด)
- ลบ CSS หน้าสถิติไม้จริงเก่า 128 กฎ (tc-*, st-tf*, st-main/chart/side, cs-go, stats-more, lv-status/strip/grid/tiles/chart, mini-stats, chart-eq, bt-note …) — คงคลาสที่โค้ดสร้างชื่อตอนรัน (st-win, s0–s3, strong-buy …) · ตรวจหน้าแรก/กราฟ/ข่าว/ย้อนกราฟ หลังลบ ไม่มี error ไม่ล้นจอ

## ⚡ เรียลไทม์ทุกส่วน (12 ต.ค. 2569 · เวอร์ชัน 202610120200 · ผู้ใช้: "ช่วยปรับให้เรียลไทม์ทุกอย่าง")
- เดิมเรียลไทม์อยู่แล้ว: ราคา/แท่งเทียน (stream ทุก tick), Buy/Sell % + กล่องจุดเข้า (ทุก 1 วินาที), ข่าว (นับถอยหลังทุกวินาที, ปฏิทินทุก 15 วิรอบข่าว)
- เร็วขึ้น: ความเห็น investing.com ของกรอบที่ดูอยู่ + กรอบใหญ่ถัดไป ทุก 15 วิ (`refreshTech([tf, HIGHER[tf]])`; ครบ 8 กรอบยังทุก 60 วิ) · `refreshSignals` (สัญญาณที่บันทึก/ไม้ที่ถือ) และ `refreshBeat` (สถานะระบบ) ทุก 60 วิ (เดิม 5 นาที) · กลับมาที่แท็บ → ดึงทุกอย่างใหม่ทันที (เพิ่ม m15, signals, news, beat)
- วัดจริง: technical 16 คำขอ/นาที (นับ preflight เป็น 32) จากเดิม 8

## 🔻 ทดสอบเปิด Sell ทุกกรอบ — ยังไม่เปิดเพิ่ม (12 ต.ค. 2569 · ผู้ใช้: "ทำไมไม่เห็นฝั่ง Sell" → "ทดสอบเปิด Sell ให้ดู" → "พอ")
- สาเหตุที่ไม่เห็น Sell: เปิดเฉพาะ 5m (คะแนน ≤ −6 จาก ±6 + SMA 20/50 + ไม่ยืดหลุดขอบล่าง + ไม่ใช่ช่วงข่าว) · ข้อมูล 9–12 ต.ค. คะแนนต่ำสุดแค่ −1 (ทองขาขึ้น) · บันทึกจริงตั้งแต่ 7 ต.ค.: BUY 15 ไม้ SELL 0
- `research/indicators/selltest.js`: ~3,900 แบบ (เกณฑ์คะแนน × SL/TP × ตัวยืนยัน 28 ตัว) 2 ปี หลังสเปรด เลือกจากช่วง 1–3 ดูช่วง 4
  - 5m: กติกาเดิม (SMA 20/50) ดีที่สุดอยู่แล้ว 615 ไม้ 53% +$451 · **1h: คะแนน −4 + Bollinger กลับตัวจากขอบ, SL $30, TP 30/40/60 → 73 ไม้ 64% +$547 (55/98/208/186)** — ผ่าน แต่ทดสอบ ~680 แบบในกรอบนี้ อาจเป็นโชค · 5h: 37 ไม้ +$110 (น้อยไป) · 15m, 30m: ช่วงล่าสุดขาดทุน · 1d, 1w: ไม่มีแบบไหนกำไรสม่ำเสมอ
- ผู้ใช้ตอบ "พอ" → **ไม่เปิด Sell เพิ่ม** · ถ้าจะเปิด 1h Sell: แนะนำโชว์บนเว็บก่อน ไม่ส่ง LINE จนมีผลจริง 20 ไม้

- **12 ต.ค. ผู้ใช้: "เอา 5 นาที"** → ทดสอบผ่อน Sell 5m (`research/indicators/sell5m-loose.js`, 2 ปี, ไม่ได้กรองข่าว เพราะไม่มี news-hist ในเครื่อง): กติกาเดิม −6 + SMA 20/50 SL $10 TP123 = 658 ไม้ (~6/สัปดาห์) 52% +$353 กำไรครบ 4 ช่วง · −5: ทุกแบบติดลบหรือขาดทุนช่วงแรก (ดีสุด EMA 9/21 SL $15 +$592 แต่ 2 ช่วงแรกขาดทุน) · −4/−3: ขาดทุนเกือบทุกแบบ → **ไม่เปลี่ยนกติกา** · Sell 5m เปิดใช้จริงตั้งแต่ 9 ต.ค. 09:54 ยังไม่ถึงเกณฑ์เพราะทองขาขึ้น

## ⏪ เลื่อนกราฟย้อนดูวันอื่นได้ (12 ต.ค. 2569 · เวอร์ชัน 202610120100 · ผู้ใช้: "อยากให้เลื่อนย้อนไปดูของวันอื่นได้ มันย้อนดูไม่ได้")
- investing.com chart API ให้แค่ 160 แท่งล่าสุด → main.js `loadOlder()`: ลากกราฟเลยแท่งแรก (from < −3) → ดึง Binance PAXG 500 แท่งก่อนหน้า (`endTime`) ปรับ offset ให้เท่าราคา investing ที่แท่งซ้อนกัน · 5 ชม. สร้างจาก 1 ชม. (จัดกลุ่มนับจากแท่งแรกบนจอ) · เก็บใน `state.older[tf]` สูงสุด 3,000 แท่ง · `withOlder()` ต่อหน้าทุกครั้งที่ refreshPrice (ทุก 3 วิ) · หลังเติมแท่ง เลื่อน logical range ไปทางขวาเท่าจำนวนที่เติม (มุมมองไม่กระโดด)
- กันโหลดเอง: ต้องมีการลาก / ล้อเมาส์ / แตะ ที่กราฟภายใน 4 วิ (`userScrollAt`) · เฉพาะกราฟที่แสดงอยู่ · ไม่ใน 2.5 วิแรกหลังเปลี่ยนกรอบ (`state.tfAt`) · ต้องเป็นแท่งของกรอบนี้แล้ว (ระยะห่างแท่ง) — เดิมกราฟที่เพิ่งโผล่/ซ่อนอยู่รายงาน range ติดลบเลยโหลดเองตอนเปิด
- chartzones replay: ข้ามแท่งที่เก่ากว่าข้อมูลกรอบช้า (`ready`) ไม่คำนวณซ้ำทุกวินาที · ดูย้อนหลัง (แท่งล่าสุดหลุดจอ): ไม่วาดกล่องจุดเข้า และแกนราคาไม่เผื่อ SL/TP ของวันนี้ (`fitPlans(series, chart)`)
- ข้อจำกัด: ลูกศร/ป้ายสัญญาณย้อนหลังได้ไม่เกินช่วงที่มีข้อมูลกรอบช้า (เช่น กรอบ 5 นาที ~3 วัน) ไกลกว่านั้นเห็นแค่แท่งเทียน

## 📖 ข่าวกดอ่านได้ + เอาป้ายจุดเข้าใหญ่ออก (10 ต.ค. 2569 · เวอร์ชัน 202610100200)
- chartzones.js (ไม้ที่ถืออยู่): เอาป้าย "🎯 ซื้อ … ระบบที่ทดสอบแล้ว · ตั้งแต่ …" ออก (ผู้ใช้: "เอาอันนี้ออก") — ยังมีเส้นจุดเข้าสีทอง ป้าย SL / TP ข้างแกนราคา
- newsstats.js: ทุกข่าวเป็น `<details class="ns-item">` กด "อ่าน ▾" → 📖 คืออะไร + 🪙 ผลกับทอง (ตาราง `ABOUT` ภาษาไทย ~30 ข่าว ตรงกับชื่อภาษาอังกฤษด้วย regex) + คำอธิบายจาก investing.com (`event.description`, ถอด HTML) + แหล่งข้อมูล + ลิงก์ investing.com · จำว่าเปิดอันไหนไว้ (`ns.openItems` + event toggle) ตอนรายการ render ใหม่ทุก 15 วินาที
- ตรวจ: ข่าวทุกตัวในปฏิทินจริง (60 วัน + 8 วัน) มีคำอธิบายไทย

## 🔍 กราฟคมขึ้น (10 ต.ค. 2569 · เวอร์ชัน 202610100100 · ผู้ใช้: "เส้นกราฟคมชัดกว่านี้")
- เส้นหนา 1.5px ถูก anti-alias กระจาย 2 พิกเซล → เบลอ: EMA 20/50, MACD, กรอบราคา (chartzones) เป็น 2px · กรอบราคาสีทึบ `#d8b45a` (เดิม rgba .85/.55) เส้นกลางประ .8
- แท่งเทียน: มีขอบสีเดียวกับตัวแท่ง สีเข้มขึ้น `#12b886` / `#f03e4f`
- กล่องจุดเข้า (live.css): ตอนยังไม่ถึงจุดเข้า จางแค่พื้นกล่อง (.75) ป้ายไม่จาง · ป้าย 700 11.5px + เงาสีพื้นหลัง · เส้น TP ประ 2px · ขอบกล่องเข้มขึ้น

## ⏱️ ข่าวสหรัฐแบบเรียลไทม์ (10 ต.ค. 2569 · เวอร์ชัน 202610100000 · ผู้ใช้: "อยากให้เรียลไทม์ทุกอย่าง ข่าวของสหรัฐ กราฟด้วย")
- กราฟ: เรียลไทม์อยู่แล้ว — investing.com stream ทุก tick อัปเดตแท่งล่าสุด (patchChartBars/chartTick) และ render() + renderChartZones ทุก 1 วินาที (Buy/Sell %, กล่องจุดเข้า) · ไม่ได้แก้
- newsstats.js: `setInterval` 1 วินาที → นับถอยหลัง (`leftText`: วัน/ชม. แล้ว mm:ss ในชั่วโมงสุดท้าย) + แถบ `#newsLive` บนสุดทุกแท็บ · `pollNow()` ปฏิทิน (now−1 วัน → +8 วัน) ทุก 15 วินาทีเมื่อมีข่าวในช่วง −2 → +20 นาทีที่ยังไม่มีตัวเลขจริง ไม่งั้นทุก 5 นาที · ข่าวที่เพิ่งออกย้ายไปบนสุดของรายการ และเขียน `state.news` (ระบบหลบข่าวใช้)
- แถบข่าว: 15 นาทีก่อน → "⏰ ข่าวแรงกำลังมา mm:ss · ชื่อ · คาด" (กะพริบ) · ออกแล้ว ≤30 นาที → "🔴 ข่าวออกแล้ว · จริง/คาด · ดีกว่า/แย่กว่าคาด · ทองตั้งแต่ข่าวออก ±$" (ราคาเปิดนาทีที่ข่าวออกจาก Binance 1m ปรับ offset ให้เท่าราคาสด) · ระหว่างรอตัวเลข: "รอตัวเลขจริง… (เช็กทุก 15 วินาที)"
- main.js refreshNews ทุก 5 นาที (เดิม 30)

## 📩 LINE = สัญญาณเข้า + เตือนข่าว เท่านั้น (9 ต.ค. 2569 · เวอร์ชัน 202610092300 · ผู้ใช้เลือก)
- chart-run.js: ไม่ส่งผลปิดไม้ / ไม่ส่งพัก-กลับมาแจ้ง (log อย่างเดียว) · intraday-run.js: ไม่ส่งผล TP/SL ของไม้เก่า และไม่ส่งเตือน investing.com ล่ม (log) — เหลือเตือนข่าว · alerts.js (สูตรรายวัน): ส่งแค่ "ถึงจุดเข้าแล้ว" ผล TP/SL บันทึกอย่างเดียว · morning-plan.js: เอาบรรทัดผลครั้งก่อน + ผลงาน/ทดสอบ + ส่วนระบบหลักออก (เหลือภาพรวมวันนี้ + ข่าววันนี้) · weekly-summary.yml: SEND = inputs.send (รันเองถึงส่ง) ยังให้คิดผลศุกร์
- ทุกอย่างยังบันทึกใน chart-signals.json / signals.json / intraday.json (เบรกพักใช้ต่อ) · Web Push ส่งเหมือน LINE อัตโนมัติ (notify.js)
- ข้อความบนเว็บ (หน้าเข้าสู่ระบบ, วิธีใช้, การ์ด LINE ในบัญชี) บอกว่า LINE ไม่ส่งผลปิดไม้ — ให้ตั้ง SL/TP ในโบรกตอนเข้า

## 📰 หลบข่าวเฉพาะกรอบที่ช่วยได้ + ผลทดสอบตรงกติกาจริง (9 ต.ค. 2569 · เวอร์ชัน 202610092200)
- ดึงข่าวแรงสหรัฐย้อนหลัง 2 ปีได้ครบ (1,190 ข่าว, `importance=high`, ทีละ 60 วัน) → `research/indicators/newstest.js`: กติกาจริง (มีตัวยืนยัน) ±0/15/30/60 นาทีรอบข่าว
- ผล ±30 นาที: 5m BUY +$407→+$554 (4/4 ช่วง), 5m SELL +$353→+$451 (3/4), 1h +$774→+$792 (3/4) · แต่ 15m +$465→+$377, 30m (ระบบหลัก) +$957→+$828 แย่ลง
- ใส่จริง: `SYS[tf].news = true` เฉพาะ 5m, 1h · `CS.decide` ส่ง news เฉพาะกรอบนั้น · `dirOf` งดเฉพาะ `sys.news && dec.news` · หน้าแรก (30m) ไม่ส่ง news ให้ INTRA.decide (`mainSys().news`) · แถบเหลือง/ข้อความงดข่าวจึงขึ้นแค่ 5m/1h · ข้อความหน้าข่าว, วิธีใช้, LINE เตือนข่าว บอกว่า "กรอบ 5 นาที และ 1 ชม. งดเปิดไม้"
- ตัวเลขทดสอบ 5m/1h ใน SYS + test-stats.json เป็นแบบหลบข่าวแล้ว · indlab.js กรอง decs ด้วย news-hist.json เมื่อ `sys.news` (ตรวจ 1h = 258 ไม้ 57% +$792 ตรง) · workflow รายเดือนรัน `research/indicators/fetch_news.py` (curl_cffi, continue-on-error) ก่อน indlab
- ข้อความเก่าที่แก้: share text (ไม่มี "ผลชนะ–แพ้จริง"), meta description/og ("วันละ 1 สัญญาณ" → ทุกกรอบ + ข่าว), วิธีใช้ ("ผลจริงของทุกกรอบ", "ดูสถิติจริง")
- LINE ผล TP/SL + สรุปเสาร์ ยังส่งเหมือนเดิม (รอผู้ใช้ตัดสินใจ)

## 📰 แท็บ "ข่าวสหรัฐ" แทนหน้าสถิติไม้จริง (9 ต.ค. 2569 · เวอร์ชัน 202610092100 · ผู้ใช้: "เอาที่เป็นไม้จริงออก เว็บนี้ทำมาเพื่อดูสัญญาณในการเทรดแค่นั้น และสถิติข่าวต่างๆ ของสหรัฐ")
- เอาออกจากหน้าเว็บ: แดชบอร์ดไม้จริง (KPI, กราฟไม้จริง, การ์ดไม้ล่าสุด, ผลจริงเทียบทดสอบ, การ์ดทุกกรอบ, ทดสอบ 1 ปี, สูตรรายวัน-ติดตามผล) + การ์ด "ผลงานสัญญาณ 30 นาที" และแถบ lvStrip ในหน้าแรก · ลบฟังก์ชันที่ไม่ใช้แล้ว (renderLiveCheck/renderIntraStats/renderMiniRecord/renderChartSignals/renderStatsHero/tc*/plotEquity/equityChart/tilesHtml) · **ระบบเบื้องหลังยังบันทึก chart-signals.json เหมือนเดิม** (LINE ผล TP/SL, เบรกพัก, สรุปเสาร์) · ลิงก์ใน LINE "ดูสถิติ #stats" → "ดูกราฟ #chart"
- `newsstats.js` (โหลดหลัง chartzones.js; `renderStats()` → `renderNewsStats()`): ปฏิทิน investing.com ข่าวสำคัญสูงของสหรัฐ 60 วันย้อนหลัง + 8 วันข้างหน้า · ทองหลังข่าว = Binance PAXG 5m (`startTime` ต่อเวลาออกข่าว, ทีละ 4) ราคาตอนออก → +15 นาที / +1 ชม. + ช่วงแกว่ง 1 ชม. · ส่วน: hero (ข่าวถัดไป + นับถอยหลัง + 4 KPI), ข่าว 8 วัน, "ข่าวไหนทำให้ทองวิ่งแรงที่สุด" (รวมตามชื่อข่าว นับต่อเวลาออกครั้งเดียว, ไปตามตำรา = ดีกว่าคาด→ทองลง / แย่กว่าคาด→ทองขึ้น), ข่าวที่ออกแล้ว (10 รายการ + ปุ่มแสดงเพิ่ม) · ชื่อไทยจากตาราง regex `TH` · รีเฟรชทุก 10 นาที นับถอยหลังทุกนาทีตอนแท็บเปิด
- **บั๊กที่เจอ: API ปฏิทินไม่สนใจ `importances=high`** (คืนข่าวสำคัญกลาง/ต่ำด้วย และตัดที่ 300 รายการ) → ต้องใช้ `importance=high` · แก้ทั้ง main.js refreshNews, scripts/fetch_data.py, newsstats.js — ผล: ระบบงดเข้าไม้ ±30 นาทีเฉพาะข่าวแรงจริงตามที่ตั้งใจ (ก่อนหน้านี้งดรอบข่าวเล็กด้วย)
- เมนู: "📰 ข่าวสหรัฐ" (#stats เดิม)

## 🖥️ หน้าสถิติแบบแดชบอร์ด (9 ต.ค. 2569 · เวอร์ชัน 202610091800 · ผู้ใช้: "เปลี่ยนหน้าสถิติใหม่ทั้งหมด ดูธรรมดามาก")
- `#tab-stats.st-dash`: (1) `.st-hero` แถบมืดไล่สีทอง/เขียว + 5 KPI ของระบบหลัก (`renderStatsHero`: กำไรสะสม + เส้นเล็ก, วงอัตราชนะจริง + ขีดผลทดสอบ, ไม้ปิด, ไม้ที่ถือ + กำไรตอนนี้, สถานะ/เบรก) (2) `.st-main` กราฟไม้จริง (ซ้าย) + การ์ดไม้ล่าสุด (ขวา) (3) lvCard (4) การ์ดทุกกรอบ `.st-tf` (แถบชนะจริง + ขีดทดสอบ, ✅/⛔, ถืออยู่, ตัวยืนยัน, "กราฟ ›") (5) ส่วนพับเดิม
- กราฟไม้จริง: overlay ของตัวเอง `tcDraw` ใช้คลาสเดียวกับหน้ากราฟ (`cz-tag` "Buy 4,144.73", `cz-seg/cz-lv` เข้า/TP ✓/SL ✗) + ป้ายผล `.tc-res` · เปิดกรอบใหม่ที่ 120 แท่งล่าสุด (fitContent ทำป้ายซ้อนกัน) · กดการ์ดไม้ → `tcSelect` (เส้นราคา + ป้ายไฮไลต์ `.tc-sel`)
- การ์ดกรอบเวลา: กดการ์ด = เปลี่ยนกรอบของกราฟสถิติ, กด "กราฟ ›" = ไปหน้ากราฟ · ใช้ `.map(live)` เหมือนแถบบน (เคยไม่ตรง 2 ไม้ 50% vs 3 ไม้ 67%)
- กราฟสถิติถูกสร้างตอนแท็บซ่อน (กว้าง 0) → setVisibleLogicalRange ได้ระยะแท่งต่ำสุดแล้วค้าง (เห็น 1,387 ช่องจาก 200 แท่ง แท่งกองขวา) → `tcView.want` + `tcApplyRange()` ใช้ตอนกราฟมีความกว้างแล้ว (ResizeObserver) · v202610091900
- `.st-main` บนจอแคบต้องเป็น `minmax(0,1fr)` ไม่งั้นกราฟไม่หดเมื่อหมุนจอ (ล้น 844px)

## 🔍 แก้ซูมกราฟ (9 ต.ค. 2569 · เวอร์ชัน 202610091700 · ผู้ใช้: "พอซูมเข้าซูมออกกราฟเหลือเท่านี้เอง")
- สาเหตุ (บั๊กของวันเดียวกัน): ที่ว่างขวาให้กล่องจุดเข้าทำโดย `setVisibleLogicalRange({from: r.from, to: n-1+off})` = บีบแท่ง → ระยะแท่งเล็กลง → off = need/sp ใหญ่ขึ้น → บีบซ้ำ (เพดาน 240 แท่ง) → แท่งกองเล็ก ๆ ทางซ้าย
- แก้ใน chartzones.js `draw(b)`: sp คำนวณจากช่วงที่เห็นจริง (plotW / แท่งบนจอ) · หาที่ว่างโดย**เลื่อน** (from+d, to+d) ระยะแท่งเท่าเดิม · off เพดาน 120, ขั้นต่ำ 6 · กราฟที่ซ่อนอยู่ (plotW ≤ 0) ข้าม — เคยทำ rightOffset ติดลบ → LWC "Assertion failed: right should be >= left"
- ทดสอบ: puppeteer หมุนล้อเมาส์ซูมออก/เข้า วัดที่ว่างขวา ~170–290px (รวมกล่อง) ไม่มี error

## 📈 หน้าสถิติ: ไม้จริงบนกราฟ (9 ต.ค. 2569 · เวอร์ชัน 202610091600 · ผู้ใช้: "หน้าสถิติมีประโยชน์ไหม ไม่มีอะไรบ่งบอกถึงกราฟในการเทรดเลย")
- การ์ดใหม่บนสุด `#tcCard` (main.js `renderTradeChart` / `tcSelect` / `bindTradeChart`): ปุ่มเลือกกรอบ (⭐ = 30m ระบบหลัก, บอกจำนวนไม้) · สรุปผลจริงเทียบทดสอบ · กราฟแท่งเทียนของกรอบนั้น (`loadBars(tf)` cache 2 นาที) ปัก ▲▼ จุดเข้า + ✅❌ จุดปิดพร้อม $ · รายการไม้ (ใหม่สุดก่อน 50 ไม้) กดแล้วกราฟเลื่อนไปที่ไม้ + เส้นเข้า/SL/TP + ประโยค "ปิดยังไง ถือนานเท่าไร ได้เท่าไร" · ปุ่ม "เปิดหน้ากราฟกรอบนี้" · บรรทัดบันทึกระบบ 30 นาทีเก่าอยู่ในสรุปเมื่อเลือก 30m
- กราฟแสดงเฉพาะแท่งที่โหลดได้ (~300 แท่งล่าสุด) — ไม้เก่ากว่านั้นอยู่ในรายการ และ `#tcNote` บอก
- ตารางทุกกรอบ: แถว `tr.cs-go[data-tf]` กดแล้วไปหน้ากราฟกรอบนั้น · การ์ด "สัญญาณ 30 นาที — ผลจริง" ถูกเอาออก (ซ้ำ) · `#statsBeat` ย้ายเข้า lvCard · ทดสอบ 1 ปี + สูตรรายวัน + วิธีนับ พับใน `details.stats-more`
- กับดัก: แทรกข้อความด้วย `String.replace(key, text)` แล้ว `$$` / `` $` `` / `$&` ในข้อความถูกตีความเป็นรูปแบบพิเศษ (SL "−$15" หาย · เคยทำให้ต้นไฟล์ Skill.md ถูกคัดลอกซ้ำ 2 ชุด) → ใช้ slice ต่อสตริง หรือ `replace(key, () => text)` เมื่อข้อความมี `$`

## 🔢 ผลทดสอบชุดเดียวทุกที่ (9 ต.ค. 2569 · เวอร์ชัน 202610091500)
- เดิม: วงกลม/ตารางบอก "ทดสอบ 57%" (2 ปี) แต่การ์ดผลจริงเทียบทดสอบบอก 52% (backtest-30m 1 ปี) → งง
- `test-stats.json` (root) = ผลทดสอบของกติกาที่ใช้อยู่ (side มี confirm → แถว filter, ไม่มี → base) เขียนโดย `research/indicators/monthly.js` ทุกเดือน (workflow commit ด้วย) · `CHARTSYS.applyStats(st)` เขียนทับ win/q/n/pnl ใน SYS (ไม่แตะกติกา) — โหลดใน main.js (refreshSignals), chart-run.js, weekly.js, morning-plan.js → หน้าเว็บ LINE และเบรก ใช้ตัวเลขเดียวกัน
- การ์ด "ผลจริงเทียบกับที่ทดสอบไว้": คาดต่อไม้ = pnl/n ของ test-stats (หลังสเปรด $0.4 ปรับตามสเปรดผู้ใช้) · ความกว้างแถบปกติยังใช้การกระจายจาก backtest-30m 1 ปี · การ์ด 1 ปีเปลี่ยนชื่อเป็น "ทดสอบช่วง 1 ปีล่าสุด" + บรรทัดบอกผลทดสอบหลัก

## 🧹 ตามเก็บหลังรวมระบบ (9 ต.ค. 2569 · เวอร์ชัน 202610091400)
- `scripts/weekly.js` (สรุปเสาร์): "⏱️ สัญญาณ 30 นาที (ระบบหลัก)" = chart-signals tf 30m · บันทึกเก่า intraday.json เป็นบรรทัด "(ระบบ 30 นาทีแบบเดิม … ไม่นับรวม)" · รายการกราฟกรอบอื่นไม่รวม 30m · บรรทัดรายวันนับเฉพาะสัญญาณจริง (ภาพรวม advisory แยกบรรทัด) → ตัวเลขบวกกันได้ตรงยอดรวม
- `scripts/morning-plan.js` (ข้อความเช้า): `intraRows(trades)` อ่าน chart-signals 30m + `CS.brake` (ไม่ใช่ intraday.json แล้ว)
- การ์ดรายวันบนมือถือ: `.sig-tps` ใช้ `minmax(0,1fr)` + ฟอนต์/ระยะเล็กลง ≤520px (TP3 เคยโดนตัด) · ป้าย "ตอนนี้/ปิดที่" บนแถบ ชิดขอบ >80%/<20% ใช้ `.edge-r/.edge-l`

## 🔗 ระบบเดียวทุกส่วน (9 ต.ค. 2569 · เวอร์ชัน 202610091300 · ผู้ใช้: "อยากให้ทุกส่วนสัมพันธ์กัน")
- ก่อนหน้า: 5 ระบบคิดแยก (ระบบ 30 นาทีเก่า TP 3 จุด · วงกลม % จาก calibration · ระบบกราฟรายกรอบ · investing.com การ์ดขวา · สูตรรายวัน 07:00) บอกคนละอย่างได้
- **ระบบหลัก = CHARTSYS (ระบบกราฟรายกรอบ)** · ระบบ 30 นาทีเก่ารวมเข้ากับ `SYS['30m']`: `INTRA.RULE.tpUsd = [15]` (TP1 อย่างเดียว) — ทดสอบ 2 ปี TP1 705 ไม้ 57% +$957 vs TP3 565 ไม้ 56% +$663 (ดีกว่าทุกช่วง) · 1 ปีตามด้วยแท่ง 5 นาที: TP1 +$125 vs TP3 +$88 หลังสเปรด (แท่ง 15 นาทีให้ผลกลับกันเพราะแยก SL/TP ในแท่งเดียวไม่ได้ → `backtest-30m.js` เปลี่ยนเป็น follow '5m')
- `scripts/chart-run.js` บันทึก + ส่ง LINE 30m ด้วย (CHART_NOTIFY default '30m,1h,5h,1d,1w', หัวข้อ "⏱️ สัญญาณ 30 นาที (ระบบหลัก)") · `scripts/intraday-run.js` ไม่เปิดไม้/ไม่ส่ง ✅ ครึ่งชั่วโมง/ไม่มีเบรกแล้ว เหลือ: ตามไม้เก่าที่ยังเปิดจนปิด + เตือนข่าว + เตือน investing.com ล่ม · intraday.json = บันทึกเก่า (แสดงแยกบรรทัดในสถิติ)
- `CHARTSYS.sideInfo(sys, dec, side, br)` = ความพร้อมเข้า % + คำตัดสิน ใช้ร่วมกันทุกที่ (chartzones ช่อง Buy|Sell, main.js หน้าสัญญาณ) · `window.CZ_SIDES` ให้การ์ดขวา
- main.js: `MAIN_TF='30m'`, `intraTrades()` = chart-signals tf 30m (ไม่ใช่ intraday.json แล้ว), `oldIntraTrades()` = บันทึกเก่า, `tradeDay(t)` (id ของ chart เป็น "30m-<ms>") · การ์ดแนวโน้มสด: เบรก = `CHARTSYS.brake`, เข้า = `CHARTSYS.dirOf`, ไม่งั้น "⏸ รอก่อน — Buy x% · Sell y%" · วงกลม = ความพร้อมเข้า (ไม่ใช่ % ชนะ calibration แล้ว) + "ผลทดสอบ 2 ปี" + "เกณฑ์เข้า" + SL/TP จาก levelsFor
- การ์ดขวาหน้ากราฟ: หัวใหญ่ตามระบบของกรอบนั้นเสมอ (Buy/Sell/ถือ/รอก่อน) · investing.com = "ความเห็นภายนอก" · ไม่แสดงจุดเข้า/SL/TP ของ investing.com แล้ว (ขัดกับระบบ) เหลือจุดรอซื้อ/ขาย + ATR · chartzones ใช้ไม้ที่บันทึกจริง (chart-signals) ก่อนผล replay → ถือไม้ตรงกันทุกหน้า
- การ์ดสูตรรายวัน: `#sgMain` (`renderDailyVsMain`) "🔗 ระบบหลัก (30 นาที) ตอนนี้…" / "⚠️ ขัดกับระบบหลัก — ยึดระบบหลัก" (ทิศตรงข้าม หรือวันนั้นเป็นฝั่งที่ระบบหลักไม่เปิด)
- ทดสอบ: หน้าสัญญาณกับหน้ากราฟ 30m ได้ Buy 0% · Sell 60% ตรงกัน ทั้งตอนรอและตอนถือไม้ (ตอนแรกไม่ตรง → แก้ให้ chartzones อ่านไม้จริง)

## ➕ 5m SELL + SMA 20/50 · ผลจริงตั้งแต่เพิ่มตัวยืนยัน · ทดสอบซ้ำทุกเดือน (9 ต.ค. 2569 · เวอร์ชัน 202610091101)
- `SYS['5m'].sell.confirm = 'sma2050'` (SMA20 < SMA50 บนกรอบ 5 นาที): +$136 → +$353, ชนะ 51→52%, ดีขึ้นครบ 4 ช่วง · verify.js (โค้ดเว็บจริง) ได้ 658 ไม้ 52% +353 ตรงเป๊ะ · `conf.sma2050` ใน intraday.js
- ทุก side ที่มี confirm มี `since` (เวลาเริ่มใช้จริง) → หน้าสถิติ (main.js renderChartSignals) ใต้ชื่อกรอบแสดง "BUY + X ตั้งแต่ 9 ต.ค.: N ไม้ ชนะ Y% (ทดสอบ Z%)"
- workflow `monthly-research.yml` (วันที่ 2 ตี 3 ไทย; ~1 ชม.): `research/indicators/fetch.js` (Binance PAXG → DATA_DIR) → `indlab.js` → `monthly.js` เขียน `research/indicators/monthly/YYYY-MM.txt` + commit → `scripts/admin-notify.js` ส่งสรุปให้แอดมิน (web push adminsOnly + LINE owner ถ้ามี LINE_OWNER_ID) · เป็นรายงานเท่านั้น ไม่เปลี่ยนกติกาเอง · เกณฑ์ตัวใหม่: ดีกว่าเดิม ≥3/4 ช่วง ไม่แย่ลงเลย ไม้ ≥40%

## 🔬 ทดสอบตัวชี้วัด 28 ตัวทั่วโลก + เพิ่มตัวยืนยัน 2 กรอบ (9 ต.ค. 2569 · เวอร์ชัน 202610091000)
- ผู้ใช้ขอ "เส้นสัญญาณที่แม่นที่สุดทั้งหมดของโลก" → ทดสอบ 28 ตัว (EMA/SMA cross, EMA200, MACD, RSI 2 แบบ, Stoch, Bollinger 2 แบบ, Donchian, Keltner, Supertrend, PSAR, ADX/DMI, Ichimoku, CCI, Williams %R, Aroon, Heikin Ashi, Hull, TRIX, ROC, AO, Chandelier, LinReg, Connors RSI-2, Vortex, EMA 8/21/55) ทุกกรอบ ทั้ง (A) ใช้เดี่ยว (B) กรองระบบเดิม · ไม่ทดสอบ OBV/MFI/VWAP (ทอง spot ไม่มี volume จริง)
- วิธีกันหลอกตัวเอง: เลือกจากช่วง 1–3 แล้วดูช่วง 4 ที่ไม่เคยเห็น · ใช้เดี่ยว: ดีในช่วง 1–3 96 แบบ → ช่วง 4 ยังดีแค่ 18 (19%) · เป็นตัวกรอง: 57 → 34 (60%) · ตัวเดียวกันช่วยกรอบหนึ่งแต่ทำอีกกรอบแย่ = ส่วนใหญ่บังเอิญ · ฝั่ง SELL แทบไม่มีตัวไหนช่วย (ยกเว้น 5m SELL + SMA 20/50 ดีขึ้น 4/4 ช่วง — ยังไม่ได้ใส่ ผู้ใช้อนุมัติแค่ 2 ตัว)
- ใส่จริง (ดีขึ้นทุกช่วงหรือเท่าเดิม ไม่มีช่วงไหนแย่ลง): `SYS['15m'].buy.confirm = 'ema921'` (EMA9>EMA21 บนกรอบเร็ว: +$339→+$465, ชนะ 54→56%) · `SYS['5h'].buy.confirm = 'roc12'` (close > close 12 แท่งก่อน: +$1,458→+$1,834, ชนะ 61→65%) · `INTRA.decideWith` คืน `conf: { ema921, roc12 }` จาก fi.close · `CS.dirOf` เช็ก confirm · `CS.unconfirmed` → หัวการ์ด "⏸ คะแนนถึง … แต่ X ยังไม่ยืนยัน — รอ…" · รายละเอียดเขียน "ต้องมี X ยืนยัน"
- ตรวจ: `research/indicators/verify.js` รันโค้ดเว็บจริงได้ตัวเลขตรงกับงานวิจัยเป๊ะ (5h 93 ไม้ 65% +1834; 15m 230 ไม้ 56% +465) · สคริปต์ + รายงานอยู่ใน `research/indicators/` (ข้อมูลราคา bars2y.json/long.json ไม่ได้ commit — ดึงใหม่จาก Binance PAXG)

## 🎯 กราฟเหลือกล่องเดียว + แจ้งสมาชิกใหม่ + หลังบ้านบนมือถือ (9 ต.ค. 2569 · เวอร์ชัน 202610090900)
- กราฟ (ไม่มีไม้ที่ถืออยู่): `window.CZ_PLANS` เหลือ **ฝั่งเดียว** — ฝั่งที่ ✅ ควรเข้า ก่อน, ไม่งั้น % สูงกว่า, เท่ากันเลือกฝั่งที่ทดสอบผ่าน (ผู้ใช้: "สองกล่อง งงต้องซื้อตรงไหน เอาแค่อันเดียวพอ") · การ์ด Buy | Sell สองช่องพร้อม % ยังอยู่เหมือนเดิม
- ที่ว่างขวาของแท่งสุดท้าย: `need` = 170px คอม / max(136, 50% กราฟ) มือถือ, `rightOffset` สูงสุด 240 แท่ง, กล่องกว้างอย่างน้อย 126px · แก้บั๊กเดิม: การเปลี่ยนกรอบเวลาตั้งช่วงทับของเรา → กล่องทับแท่งเทียน (ตอนนี้ลองใหม่หลัง 600ms สูงสุด 3 ครั้ง)
- แจ้งสมาชิกใหม่: `/api/session` ถ้าบัญชีอายุ < 15 นาทีและไม่ใช่แอดมิน → คิวใน blob `access/new-members.json` {pending, sent} · `scripts/new-members.js` (workflow `new-members.yml` ทุก 15 นาที ทุกวัน) ส่ง Web Push เฉพาะเครื่องที่ `admin: true` (`push(texts, { adminsOnly: true })`) + LINE **push** ถึงเจ้าของถ้ามี secret `LINE_OWNER_ID` (ห้าม broadcast — จะไปถึงเพื่อนทุกคน) · เครื่องแอดมินถูกติด `admin: true` ตอนเปิดแจ้งเตือน หรือตอนแอดมินเข้าเว็บ (`/api/me` → markAdminDevices) · log ใน Actions ปิดอีเมล
- ยังไม่มี LINE_OWNER_ID: ตอนนี้แจ้งทาง Web Push อย่างเดียว · ปุ่ม "ลบบัญชี" ถูกระบบความปลอดภัยของ Claude Code บล็อก (ลบถาวร) — ยังไม่ได้ทำ, ลบใน Clerk dashboard เอง
- หลังบ้าน ≤700px: ตารางเป็นการ์ด (`td[data-l]` เป็นหัวข้อเล็ก, `.wide` เต็มแถว) ปุ่มระงับเห็นได้ไม่ต้องเลื่อนข้าง

## ⛔ ระงับ/คืนสิทธิ์สมาชิก + นโยบายความเป็นส่วนตัว (9 ต.ค. 2569 · เวอร์ชัน 202610083100)
- หลังบ้านคอลัมน์ "จัดการ": ⛔ ระงับ / ↩ คืนสิทธิ์ (ไม่มีปุ่มสำหรับแอดมิน) → `POST /api/admin/ban` header `x-user-id` + `x-action: ban|unban` · ระงับตัวเอง/แอดมินไม่ได้
- เก็บรายชื่อใน blob `access/banned.json` (middleware อ่าน cache 30 วิ) + เรียก Clerk `/v1/users/{id}/ban|unban` → คุกกี้เดิมโดนเตะออกภายใน ~30 วิ (หน้า → 302 `/login.html?banned=1` + ลบคุกกี้, API → 403) · `/api/session` ของคนถูกระงับ → 403 · log มีประเภท `banned`/`unbanned` (การนับล็อกอิน/เข้าเว็บนับแค่ login/visit)
- `privacy.html` (สาธารณะ, อยู่ใน `PUBLIC`) + ข้อความยินยอมใต้ฟอร์มใน login.html · ข้อความแชร์ใน ui.js เปลี่ยนเป็น "…ทุกกรอบเวลา … (สมัครสมาชิกฟรี)"
- ทดสอบ: import middleware.js ใน Node + ผู้ใช้ทดสอบ Clerk (`+clerk_test`) → ban/ห้ามเข้า/ล็อกอินใหม่ไม่ได้/unban กลับมาได้/สมาชิกเรียก API แอดมิน 403 แล้วลบผู้ใช้ทดสอบ

## 🖥️ จอกว้างมาก (8 ต.ค. 2569 · เวอร์ชัน 202610082600)
- ผู้ใช้: "ขอมากกว่านี้อีกนิด" → `@media (min-width: 1700px)`: `.content/.demo-bar` max-width none (padding 28px, demo-bar margin 28px) · sidebar 260px font 18.5 · การ์ดขวา 460px · body 18px และข้อความหลักใหญ่ขึ้นอีก ~10% · ระวัง: `git checkout -- compare/` จะทับภาพทดสอบที่ชื่อซ้ำไฟล์เดิม ให้ตั้งชื่อใหม่ก่อน

## 🖥️ จอกว้างสมส่วน (8 ต.ค. 2569 · เวอร์ชัน 202610082500)
- ผู้ใช้ใช้จอ ~1900px: "แถบซ้ายเล็ก ข้อมูลเล็กไป" → live.css `@media (min-width: 1400px)`: sidebar 240px (font 17, icon 22) · `.content/.demo-bar` max 1600px · `.layout` การ์ดขวา 420px · body 17px และขยายข้อความในกล่องสัญญาณ/ช่อง Buy-Sell/การ์ดขวา/ปุ่มกรอบเวลา · **ห้ามใช้ CSS zoom** (พิกัดเมาส์บนกราฟจะเพี้ยน) · ทดสอบที่ 1920px

## ◧ เมนูแนวตั้งด้านซ้าย (8 ต.ค. 2569 · เวอร์ชัน 202610082400)
- ผู้ใช้: "ย้ายแถบ navbar มาเป็นเมนูแนวตั้งฝั่งซ้าย" → live.css `@media (min-width: 900px)`: `#tabbar.tabbar` fixed top 56px ซ้าย กว้าง 200px flex-column · `#app { padding-left: 200px }` · `#app > .appbar { margin-left: -200px }` (หัวเว็บยังเต็มความกว้าง) · ใช้ `#tabbar` เพื่อชนะ theme.css ที่โหลดทีหลัง · มือถือ (<900px) ยังเป็นแถบล่างเดิม

## 🔤 การ์ดขวา: แค่ "Buy" / "Sell" (8 ต.ค. 2569 · เวอร์ชัน 202610082300)
- ผู้ใช้: "อยากให้สั้นลง ว่า Buy หรือ Sell พอ" → `renderSignalHead`: มีสัญญาณ = "Buy"/"Sell" · ถือไม้ = "ถือ Buy"/"ถือ Sell" · บรรทัดรองเหมือนเดิม · ไม่มีสัญญาณ = คำของ investing.com

## 📖 หน้าวิธีใช้: อ่านหน้ากราฟยังไง (8 ต.ค. 2569 · เวอร์ชัน 202610082200)
- แทนหัวข้อ "⏱️ สัญญาณ 15 นาที (ดูบนเว็บเท่านั้น)" (อธิบายการ์ดที่ลบแล้ว) ด้วย "📈 อ่านหน้ากราฟยังไง" `ol.learn-steps` 5 ข้อ: กรอบเวลา → ช่อง Buy|Sell (% + ✅⏸⚠️⛔) → เข้าเฉพาะ ✅ + 🧮 → ลูกศร/ป้าย/กล่อง TP-SL/เส้นไม้ที่ปิด → สิ่งที่ดูประกอบเท่านั้น · เมื่อเปลี่ยนหน้ากราฟอีก ให้อัปเดตหัวข้อนี้ด้วย

## 🛠️ หลังบ้าน: สมาชิก + บันทึกการเข้าใช้ (8 ต.ค. 2569 · เวอร์ชัน 202610082900)
- `/admin.html` + `/api/admin/members` (Clerk Backend API `/v1/users` ทีละ 500 + นับจาก log) + `/api/admin/log` (ใหม่สุดก่อน) — เฉพาะอีเมลใน env `ADMIN_EMAILS` (ตอนนี้ = 2 บัญชี Google ของเจ้าของที่มีอยู่ก่อน) · ไม่ใช่แอดมิน: หน้า → 302 `/`, API → 403 · `/api/me` มี `admin` → ลิงก์ `#adminLink` ในหน้าบัญชี
- บันทึก `access/log.json` (Blob, เก็บ 5,000 ล่าสุด): `login` ตอน /api/session และ `visit` จาก auth.js วันละครั้งต่อเครื่อง (localStorage `gs-visit`, POST /api/visit) · ฟิลด์: at, type, id, name, email, device (จาก UA), country/city (header `x-vercel-ip-*`) — ไม่เก็บ IP
- หน้า admin: ตัวเลขสรุป, ค้นหา/กรอง/เรียง, กดสมาชิก → บันทึกของคนนั้น, CSV (UTF-8 BOM) · เพิ่ม/เปลี่ยนแอดมิน: `npx vercel env rm/add ADMIN_EMAILS <env>` แล้ว redeploy
- ทดสอบ: `vercel dev` ใช้ env จาก cloud (แก้ .env.local ไม่มีผล) → ทดสอบแอดมินด้วยการ import middleware ใน Node และตั้ง env เอง · ลบผู้ใช้ทดสอบและบันทึก `+clerk_test@example.com` ออกจาก log ทุกครั้ง

## 👤 สมาชิกเท่านั้น — Clerk + ตรวจฝั่งเซิร์ฟเวอร์ (8 ต.ค. 2569 · เวอร์ชัน 202610082800)
- ลำดับ: ผู้ใช้ขอระบบรหัสจากผู้ดูแล (ทำเสร็จ v202610082700) → เปลี่ยนใจ "ล็อกอินอีเมลแบบเดิม ต้องสมัครสมาชิกก่อน" → เลือก **อีเมล + Google** และ **ตรวจฝั่งเซิร์ฟเวอร์** · ระบบรหัส/สคริปต์ access-codes/ข้อมูล codes ใน Blob ลบแล้ว · repo ยังสาธารณะ
- `login.html`: โหลด clerk-js + ui จาก FAPI (pk คงที่ในไฟล์) · แท็บ **เข้าสู่ระบบ | สมัครสมาชิก** (`mountSignIn` withSignUp / `mountSignUp`; หน้ารวมของ Clerk ไม่มีลิงก์สมัครให้เห็น) · `#signup` เปิดแท็บสมัคร · ล็อกอินแล้ว `Clerk.session.getToken()` → `POST /api/session` (header Authorization) → `/` · `?signout=1` = เรียก `Clerk.signOut()`
- `middleware.js` (Routing Middleware, nodejs, **ห้าม import แพ็กเกจ** — ดูเหตุผลในไฟล์): ตรวจ JWT RS256 ด้วย JWKS `https://delicate-tapir-2101.clerk.accounts.dev/.well-known/jwks.json` (แคช 1 ชม., iss ต้องตรง, exp) → ดึงชื่อ/อีเมลจาก Clerk Backend API (`CLERK_SECRET_KEY`) → คุกกี้ `gs_auth` = base64(JSON {id,name,email}).หมดอายุ.HMAC(ACCESS_SECRET) อายุ **14 วัน** · ไม่มีคุกกี้: หน้า → 302 /login.html, อื่น ๆ 401 · `/api/me` {name,email} · `/api/logout` → /login.html?signout=1 · `/api/push` ผูกกับ Clerk user id
- ข้อจำกัด: ลบ/แบนผู้ใช้ใน Clerk แล้ว คุกกี้เดิมยังใช้ได้จนหมดอายุ (≤14 วัน) · ถ้าจะเตะออกทันที ต้องเปลี่ยน ACCESS_SECRET (ทุกคนต้องล็อกอินใหม่)
- บทเรียน: Routing Middleware **ไม่ได้รับ request body** (ใช้ header) · Vercel **ไม่ส่ง node_modules** ไปกับ middleware (production ล่ม ~8 นาที แล้ว revert) · ทดสอบ preview ของ **thander1** ด้วย `npx vercel ls gold-signal` + `npx vercel curl` ก่อน merge ทุกครั้ง · regex ที่สร้างผ่านสคริปต์ node -e อาจเสีย  (เคยได้ `/^Bearers+/`) — ตรวจด้วยการอ่านไฟล์
- ทดสอบ: Clerk ทดสอบได้ด้วยอีเมล `…+clerk_test@example.com` โค้ด `424242` · การสมัครผ่านหน้าเว็บติด Cloudflare กันบอท → สร้างผู้ใช้ทดสอบด้วย Backend API (`POST /v1/users`), ได้ตั๋วด้วย `POST /v1/sessions` + `/v1/sessions/{id}/tokens` แล้วลบผู้ใช้ทิ้ง · ล็อกอินอุปกรณ์ใหม่ Clerk ถามโค้ดยืนยันอีกขั้น

## 🗑️ เอาสัญญาณ 15 นาที + แผนเทรดวันนี้ออกจากหน้าสัญญาณ (8 ต.ค. 2569 · เวอร์ชัน 202610082100)
- ผู้ใช้ส่งภาพ "เอาอันนี้ออก" → ถามก่อน → เลือก "เอาออกทั้งสองส่วน" · ลบ markup `#s15Card` และ `#tpCard` (+ หัวข้อ "🧭 แผนเทรดวันนี้") จาก index.html · **ห้ามใส่กลับเอง**
- เครื่องคำนวณ `#tpCalc` ย้ายไป `<section id="calcCard">` ใต้กราฟในแท็บกราฟ · `renderPlan` เรียกเมื่อ `onScreen('calcCard')` และข้าม session/levels/zones/radar ถ้าไม่มี `#tpSession` · `renderS15()` return ถ้าไม่มี `#s15Card` (refreshM15 ยังต้องทำงาน — กรอบ 15m บนกราฟใช้ state.m15) · ปุ่ม 🧮 บนกราฟแค่ scrollIntoView ไม่เปลี่ยน hash

## 🔔 เปิด Web push แล้ว (8 ต.ค. 2569 · เวอร์ชัน 202610082010)
- ผู้ใช้สั่ง "ทำมาหมด" → รัน `node scripts/setup-push.js` แล้ว: GitHub secret VAPID_PRIVATE_KEY + CLERK_SECRET_KEY (ดึงจาก Vercel env, ไม่แสดง) + variable VAPID_PUBLIC_KEY · config.js มี vapidPublicKey (commit d5b4003) · ทุกข้อความที่ส่ง LINE จะส่ง push ไปเครื่องที่กดเปิดแจ้งเตือนในหน้าบัญชีด้วย (ไม่ใช้โควตา LINE) · ผู้ใช้ต้องกด 🔔 เปิดแจ้งเตือนบนเครื่องเอง (ล็อกอิน Google; โหมด ?demo=1 บันทึกไม่ได้)

## 📏 TP/SL อยู่ในกราฟเสมอ + ชื่อความมั่นใจ (8 ต.ค. 2569 · เวอร์ชัน 202610082000)
- `fitPlans(series)` (position-box IIFE) ตั้ง `autoscaleInfoProvider` บน candles และ areaS: ขยายช่วงราคาให้ครอบ sl/tps ของ `CZ_PLANS` และ `CZ_OPEN` · การ์ดขวา `#confText` = "ความมั่นใจของ investing.com X%" แถบ `#signalCard .meter` จาง (.55) เพื่อไม่สับสนกับ "ความพร้อมเข้า"

## 🟢|🔴 Buy/Sell คนละช่อง + การ์ดขวาตามสัญญาณ (8 ต.ค. 2569 · เวอร์ชัน 202610081900)
- ผู้ใช้เปลี่ยนใจจาก "แผนเดียว" → "อยากให้มี 2 ตัว Buy และ Sell คนละช่อง บอก % ของแต่ละอันว่าควรเข้าไหม" (ต่างจากเดิมที่งง เพราะตอนนี้ทุกช่องมีคำตัดสินชัด) · `sideInfo(side)` → `{pct, tested, go, verdict}`: ✅ ควรเข้า (ผ่าน+สัญญาณ+ไม่พัก) / ⏸ ยังไม่ควรเข้า / ⚠️ ไม่แนะนำ (ไม่ผ่าน; ถึงเกณฑ์ = "ถึงเกณฑ์ แต่ไม่แนะนำ") / ⛔ พัก — ไม่เข้า
- กล่องเหนือกราฟ `.cz-two` 2 คอลัมน์ `.cz-col` (มือถือเรียงลง) · การ์ดขวา `#sigNote` 2 แถบ · กล่องบนกราฟ 2 กล่อง ป้าย "Buy 100% ✅ เข้า" / "Sell 0% ⏸" · ไม่มีไม้ถืออยู่เท่านั้น (ถือไม้ = กล่อง position เดิม)
- ผู้ใช้: "จุดเข้า 100 แล้วทำไมยังขึ้นรอก่อน" → `window.CZ_GO` ({side} ตอนมีสัญญาณที่ผ่าน, {side, open} ตอนถือไม้) → `renderSignalHead()` (main.js) เปลี่ยนคำใหญ่/สีการ์ดเป็น "✅ เข้าซื้อ (Buy) ได้" / "📌 ถือไม้…อยู่" และย้ายคำของ investing.com ไปบรรทัดรอง · `state.lastPlan` เก็บแผนล่าสุด

## ⚠️ แผน Sell ในกรอบที่ไม่ผ่าน (8 ต.ค. 2569 · เวอร์ชัน 202610081700)
- ผู้ใช้: "ในกรอบรอก่อน ไม่เห็นมีจุดเข้า Sell" (1 ชม. ทิศ ▼ แต่ขึ้น Buy 0%) → `pick` เลือกฝั่งที่คะแนนเอียงไปได้แม้ไม่ผ่าน (`untested`; ใช้ th ของ BUY สะท้อน, gap +0.5 ให้ฝั่งผ่านชนะเมื่อเท่ากัน; คะแนน 0 = ตามทิศ ▲/▼ `leanNow`)
- untested: % ไปถึง 100 ได้แต่ข้อความ "⚠️ ถึงเกณฑ์" ไม่ใช่ "✅" · `.cz-untested` "⚠️ ฝั่งนี้ทดสอบขาดทุน — เสี่ยง" · กล่องในกราฟ "⚠️ X% · ทดสอบขาดทุน" (จาง) · ไม่สร้างไม้ใน replay / chart-run / LINE (dirOf ยังใช้ sys.sell เท่านั้น)

## ✂️ กล่องหน้ากราฟ 3 บรรทัด (8 ต.ค. 2569 · เวอร์ชัน 202610081600)
- ผู้ใช้ถาม "คำเยอะไปไหม" → เสนอภาพตัวอย่างก่อน แล้วผู้ใช้เลือก "เหลือ 3 บรรทัด" · กล่อง: pill สั้น (ทิศ · กรอบ · รอบถัดไป) → `.cz-prog` (ไม่มีข้อความคะแนน) → `planRow(pick)` ราคาเท่านั้น · `waitOnly` = ข้อความรอธรรมดา (ใกล้/รอ/ไม่ให้ SELL) ย้ายไปใน `<details class="cz-more">` (ปิดเป็นค่าเริ่มทุกจอ; หัวข้อ "รายละเอียด (อีกฝั่ง · ความแม่นยำ · วิธีอ่าน)") พร้อม `pillFull` (แท่งปิด/คะแนน) และบรรทัดอีกฝั่ง · ข้อความสำคัญ (ถือไม้ · สัญญาณ · พัก · ข่าว · ราคายืด · ตลาดปิด) ยังอยู่ใต้ pill
- บนกราฟ "⏸ รอ X%" · การ์ดขวา `#sigNote` = แถบ % + "จากระบบบนกราฟ · การ์ดนี้เป็นบทวิเคราะห์ภาพรวม" · ตัวแปร `quiet` ใช้แล้ว (มุมมองสะอาด) อย่าตั้งชื่อซ้ำ
- **ห้ามขยายการลดคำไปหน้าอื่นเอง** (เคยโดนย้อนกลับ) — ถามก่อนพร้อมภาพตัวอย่าง

## ⏳ % ใกล้จุดเข้า (8 ต.ค. 2569 · เวอร์ชัน 202610081500)
- ผู้ใช้อยากเห็นเปอร์เซ็นต์ตรง "รอก่อน" ว่าอีกเท่าไรถึงเข้า → `pct` = คะแนนฝั่ง pick ÷ th ของฝั่งนั้น (0–99, สัญญาณ = 100, มีไม้ถืออยู่ = ไม่แสดง) · `.cz-prog` (ข้อความ + แถบ) ในกล่องเหนือกราฟ และใน `#sigNote` ของการ์ดขวา (ใต้ "รอก่อน") · กล่องในกราฟ "⏸ รอ — ใกล้จุดเข้า X%"
- เป็น "ความใกล้เกณฑ์" ไม่ใช่โอกาสชนะ (อัตราชนะอยู่ในส่วนความแม่นยำ)

## ⬆️⬇️ ลูกศรตรงจุดเข้า (8 ต.ค. 2569 · เวอร์ชัน 202610081400)
- ผู้ใช้ขอลูกศรขึ้นลงบอก buy/sell แล้วระบุ "เอาขึ้นเฉพาะที่เป็นจุดเข้าของแต่ละไม้" → markers(): ทุกไม้ที่ replay ได้ = lightweight marker size 1.6 ▲ `#18a058` belowBar / ▼ `#e0424f` aboveBar (ไม่ถูกซ่อนในมุมมองสะอาด) · ป้าย `.cz-tag` ขยับห่างแท่ง 26px · legend "▲ Buy จุดเข้าซื้อ / ▼ Sell จุดเข้าขาย"
- ทดสอบ (scratchpad flip.js): ลูกศรตามจุดเปลี่ยนทิศ (lean) แล้วเข้า ขาดทุนทุกกรอบ → **ห้ามใส่ลูกศรที่ไม่ใช่จุดเข้าจริง** · กรอบที่ไม่มีไม้ในช่วงที่เห็น (เช่น 1 ชม. ช่วงทองลง ระบบซื้ออย่างเดียว) จะไม่มีลูกศร — ถูกต้องแล้ว

## 1️⃣ แผนเดียวบนกราฟ (8 ต.ค. 2569 · เวอร์ชัน 202610081300)
- ผู้ใช้: "ไม่รู้ต้องเข้าตรงไหน มีตั้งสองอันให้เลือก" → **ห้ามแสดงสองแผนให้เลือกอีก** · `pick` = ฝั่งที่มีสัญญาณ (dir) ไม่งั้นฝั่งที่ทดสอบผ่านและใกล้เกณฑ์กว่า (`gap`) · CZ_PLANS มีแผนเดียว: live = กล่องเข้ม + `.pp-status.live` "✅ เข้าตอนนี้" · ไม่ live = `.pp.off` (จาง .65 ยกเว้นสถานะ) ป้าย "ถ้าเข้า Buy/Sell …" + "⏸ รอ — ยังไม่ใช่จุดเข้า · ต้องได้คะแนน …" · พัก = "⛔ พักอยู่ — ไม่เข้า"
- กล่องข้อความ: `planRow(pick)` + `.cz-plan-other` บรรทัดเล็กของอีกฝั่ง · พื้นที่ขวา 240px (มือถือ 42%) · ขยาย range ให้มีที่ได้ไม่เกินทุก 0.5 วิ (`b.roomAt`) แล้ววาดต่อเสมอ (เดิม return ก่อนวาด → ข้อความในกล่องค้างเก่า)

## 📦 กล่อง Buy/Sell บนกราฟ (8 ต.ค. 2569 · เวอร์ชัน 202610081200)
- ผู้ใช้ส่งภาพว่า "ไม่เห็นจุดเข้าเท่าไร อยากให้ขึ้นในกราฟ" (กราฟไม่มีไม้ จึงไม่มีอะไรวาด) → renderChartZones ตั้ง `window.CZ_PLANS` (ไม่มีไม้ถืออยู่ + ตลาดเปิด) = 2 แผน {side, entry=ราคาตอนนี้, sl, tps, ok, note} · position-box IIFE `drawPlans()` วาด 2 คอลัมน์ทางขวาแท่งล่าสุด: pbox win/loss + เส้น TP ทุกเป้า + ป้าย `.pp-lab` (Buy/Sell ราคา, TPn, SL, สถานะ) · ฝั่งไม่ผ่าน/พัก = `.pp.off` จาง
- พื้นที่ขวา: rightOffset = 260px (จอแคบ <520px = ~48% ของกราฟ) ÷ barSpacing · ถ้ากำลังดูแท่งล่าสุดแต่ที่ไม่พอ (zoom/สลับแท็บ) → setVisibleLogicalRange ขยายให้เอง
- **เลิกวาดแผน investing.com (state.locked) บนกราฟ** — `currentPlan()` เหลือเฉพาะไม้ที่ถืออยู่ (CZ_OPEN); ราคาแผน investing.com ยังอยู่ในการ์ดขวา

## 🎯 จุดเข้า · TP · SL ของ Buy/Sell บนกราฟ (8 ต.ค. 2569 · เวอร์ชัน 202610081100)
- ป้าย `.cz-tag` มีราคาเข้า ("Sell 4,144.49") · ไม้ที่ปิดแล้ว 8 ไม้ล่าสุดบนจอมีเส้น `.cz-seg` จากแท่งเข้าถึงแท่งที่มี exitAt: ทอง = เข้า, เขียวประ = TP (✓ ถ้า hit), แดงประ = SL (✗ ถ้า closedBy sl) + ป้ายราคา `.cz-lv` ที่ปลายเส้น · ไม้ที่ยังเปิดใช้กล่อง position เดิม
- กล่องสถานะมี `.cz-plan` 2 แถวตลอด (ยกเว้นตลาดปิด): 🟢 Buy / 🔴 Sell "เข้า ~ราคาปัจจุบัน · SL · TP…" + สถานะ (รอคะแนน ±th / ✅ สัญญาณมาแล้ว / ⛔ พัก / มีไม้ถืออยู่ / ⚠️ ฝั่งนี้ทดสอบไม่ผ่าน — ใช้ระยะของฝั่ง BUY และแถวจาง)
- ระวังตอนลบไฟล์ทดสอบใน compare/: `plan-*.png` เดิม (plan-dark/desktop/mobile/tested) เป็นไฟล์ที่ใช้อยู่ ห้ามลบ

## 🏷️ กราฟแบบภาพตัวอย่าง TradingView (8 ต.ค. 2569 · เวอร์ชัน 202610081000)
- ผู้ใช้ส่งภาพกราฟที่มีป้าย Buy/Sell + เส้นโค้ง 3 เส้น (Nadaraya-Watson Envelope) + แถบแนวรับ/ต้าน → IIFE "Chart decor" ท้าย chartzones.js: `setChartDecor(trades)` (เรียกจาก renderChartZones) วาด overlay `.cz-decor` บนทั้ง 2 กราฟ: ป้าย `.cz-tag.buy/.sell` ที่แท่งตัดสินใจ (แทนลูกศรใหญ่; จุดออกยังเป็นวงกลมเล็ก) · โซน `.cz-zone` จาก swing high/low (5 แท่งสองข้าง) ที่ยังไม่มีแท่งปิดทะลุ หนา 0.6–1.2 ATR สูงสุดฝั่งละ 5 · เส้นโค้ง = kernel regression แบบ endpoint (h 8, หน้าต่าง 30) ± 3×MAE(100) เป็น line series บนกราฟแท่งเทียนเท่านั้น
- **ทดสอบ 2 ปี (scratchpad nwe.js): เข้าเมื่อแตะขอบ/เด้งจากขอบ ขาดทุนเกือบทุกกรอบ** (มีแค่ 1d BUY +$412 จาก 21 ไม้) — NWE บน TradingView ส่วนใหญ่ repaint จึงดูแม่น → เส้นโค้งเป็นแค่ภาพประกอบ ป้าย Buy/Sell = ระบบที่ทดสอบผ่าน (chartsys.js) เท่านั้น
- ปุ่ม `#czClean` "มุมมองสะอาด" (ค่าเริ่มเปิด, จำใน localStorage `gs-clean`): ซ่อน EMA20/50 + Bollinger + พื้นหลังโซนเข้า + ลูกศรเล็กทุกแท่ง + legend บน · `window.CZ_CLEAN()`

## ⛔ เบรกสัญญาณกราฟ + สรุปรายสัปดาห์ (8 ต.ค. 2569 · เวอร์ชัน 202610080900)
- `CHARTSYS.brake(sys, trades, now)` (chartsys.js, ไม่มี state — คำนวณจาก chart-signals.json): แพ้ติดกัน 5 ไม้ → พักถึงเปิดตลาดจันทร์ถัดไป (`INTRA.nextWeek`; กรอบ long พัก 30 วัน) ไม้ที่เกิดระหว่างพักไม่นับ streak ใหม่ · 20 ไม้ปิดล่าสุดชนะต่ำกว่าผลทดสอบ (ถัวตามฝั่ง) เกิน 12 จุด → พักจนกว่าจะดีขึ้น (`until: null`)
- chart-run.js: ระหว่างพักยังเปิดไม้แต่ใส่ `paused: true` ไม่ส่ง LINE ตอนเข้า/ปิด (เพื่อให้เบรกปลดเองได้) · เก็บ `store.brakes` แล้วส่ง LINE ครั้งเดียวตอนเริ่มพัก ⛔ / กลับมา ✅ (เฉพาะกรอบใน CHART_NOTIFY)
- เว็บ: กล่องกราฟขึ้น `.cz-brake` "⛔ พักสัญญาณกรอบนี้…" สัญญาณที่เกิดเป็น "(พักอยู่ — ไม่แนะนำเข้า)" ไม่มีปุ่มคำนวณ · ตาราง #csCard มีคอลัมน์สถานะ ✅/⛔
- weekly.js: เพิ่มส่วน "📈 สัญญาณบนกราฟ" ผลสัปดาห์ต่อกรอบ (หักสเปรด) + สถานะพัก — **ไม่รวม**ในยอดรวมสัปดาห์
- Web push: ผู้ใช้ต้องรัน `node scripts/setup-push.js` เอง (สร้าง VAPID, ตั้ง secret ผ่าน gh, ดึง CLERK_SECRET_KEY จาก Vercel env) แล้ว commit config.js

## 📈 บันทึกผลจริงสัญญาณกราฟ + LINE + ปุ่มคำนวณ + มือถือ (7 ต.ค. 2569 · เวอร์ชัน 202610072000)
- **`chartsys.js`** (ใหม่, UMD) = กติกากลางของสัญญาณกราฟ (SYS, dirOf, decide, trade, levelsFor) ใช้ร่วมกันระหว่าง chartzones.js (เว็บ) และ `scripts/chart-run.js` (GitHub) — แก้กติกาที่ไฟล์นี้ที่เดียว · โหลดก่อน chartzones.js
- **`scripts/chart-run.js`** รันทุกเช็ก 5 นาทีใน check-loop.sh (หลัง intraday-run) → ติดตามไม้เปิด (5m Binance สำหรับกรอบสั้น, 1h สำหรับ 5h/1d, 1d สำหรับ 1w) แล้วเปิดไม้ใหม่ครั้งละ 1 ไม้ต่อกรอบ ตัดสินที่เปิดแท่งถัดไป · ข้ามถ้าช้าเกิน 10 นาที (กรอบยาว 2 ชม.) · แท่ง: investing m15/m30/h1/h5 จาก data.json + Binance m5/h4/d1/w1 เลื่อนให้เท่าราคา investing · บันทึก `chart-signals.json` (commit เมื่อเปลี่ยน) · `CHART_NOW`/`CHART_FILE` ใช้ทดสอบย้อนหลังเท่านั้น
- **LINE**: เข้า/ปิดไม้เฉพาะกรอบใน `CHART_NOTIFY` (ค่าเริ่ม 1h,5h,1d,1w — ผ่านทุกช่วงและเกิดไม่บ่อย ~1 ข้อความ/วัน) รวมใน OUTBOX เดียวกับระบบเดิม · web push ยังไม่ทำงานเพราะยังไม่ได้ตั้ง CLERK_SECRET_KEY/VAPID
- **หน้าสถิติ** `#csCard`/`renderChartSignals()`: ตารางต่อกรอบ ไม้ปิด ชนะ–แพ้ %ชนะจริง (<20 ไม้ = น้อย) vs ทดสอบ กำไรหลังสเปรดผู้ใช้ ไม้ที่ถืออยู่
- **ปุ่ม 🧮** `.cz-calc` ในกล่องกราฟ (มีเมื่อมีไม้ถืออยู่หรือมีสัญญาณ) → `window.fillCalc` (tradeplan.js) แล้วไป #home เลื่อนถึง #tpCalc · **มือถือ**: ความแม่นยำ/รายละเอียดอยู่ใน `<details class="cz-more">` ปิดเมื่อจอ ≤640px จำสถานะที่ผู้ใช้กด

## 🎯 ทุกกรอบเวลามีสัญญาณเข้าที่ทดสอบแล้ว (7 ต.ค. 2569 · เวอร์ชัน 202610071900)
- ผู้ใช้ขอ "ทุกไทม์เฟรมมีสัญญาณเข้าแบบแม่นยำ" → chartzones.js เขียนส่วนระบบใหม่: `SYS[tf]` มี `buy`/`sell` แยก `{ th, tp1, mult, win, q }` · ฝั่งที่ทดสอบไม่ผ่าน = ไม่มี (มีแค่ `sellQ` ไว้แสดง) → ไม่ให้สัญญาณ แสดงเป็นทิศอย่างเดียว · `dirOf()` ตัดสินจุดเข้าเอง (decideWith ใช้ threshold 99 เพื่อเอาคะแนน) · `long` (5h/1d/1w) ไม่สนตลาดปิด/ข่าว และถือไม้ไม่เกิน `hold`
- กรอบช้าดึงจาก Binance ผ่าน `refreshSlow()` → `state.h4/d1/w1` (200 แท่ง ทุก 10 นาที) · 5h = 5ชม.+1วัน · 1d = 1วัน+1สัปดาห์ · 1w = สัปดาห์อย่างเดียว (คะแนน ±2)
- ค่าที่เลือก (grid: เกณฑ์ × TP1/TP123 × ขนาด SL, เลือกที่กำไรหลายช่วงที่สุด, หลังสเปรด): 5m BUY +5 TP1 SL15 (53%, 3/4) · SELL −6 SL10 TP10/13/20 (51%, 3/4) · 15m BUY +6 TP1 SL22.5→$23 (54%, 4/4) · 30m BUY +5 TP1 SL15 (57%, 3/4) · 1h BUY +5 SL30 TP30/40/60 (57%, 4/4) · 5h BUY +3 SL60 TP60/80/120 (61%, 4/4) · 1d BUY +3 TP1 SL120 (64%, 4/4, 5 ปี) · 1w BUY +1 TP1 SL300 (70%, 23 ไม้) · SELL กรอบอื่นไม่ผ่าน
- ⚠️ เลือกค่าที่ดีที่สุดจาก 8 แบบต่อฝั่ง = เสี่ยง overfit · ช่วงทดสอบทองขึ้นแรง → BUY กรอบใหญ่ดูดีเกินจริง (กล่องบอกไว้) · กล่องสถานะ: pill ทิศแท่งล่าสุด + รอบถัดไป → คำแนะนำ → อัตราชนะ BUY/SELL · LINE/บันทึกผลไม่เปลี่ยน · สคริปต์วิจัย scratchpad `alltf.js`

## 🕔 สัญญาณทุก 5 นาที + TP1 อย่างเดียว (7 ต.ค. 2569 · เวอร์ชัน 202610071800)
- ผู้ใช้ขอ "สัญญาณบอกทุก 5 นาทีว่าเข้าตรงไหน · เอาแค่ TP1 · มีสัญญาณขึ้นลง" → SYS['5m'] มี `tp1: true`: ทุกแท่งปิดมีลูกศรเล็ก (size .5, จาก `dec.lean`) · กล่องสถานะขึ้นต้นด้วย pill `.cz-5m` "▲ ขึ้น/▼ ลง สัญญาณ 5 นาที (แท่ง HH:MM ปิดแล้ว · คะแนน) · ซื้อ/ขายที่ ~ราคา · SL · TP1 · รอบถัดไป" · ไม้ระบบ (±5) ตัด tps เหลือ TP1 ก่อน evaluate · `tpsUsd(sys)`/`levelsFor` เคารพ tp1 · กล่อง position ของแผน investing.com แสดง TP1 อย่างเดียวทุกกรอบ · ป้าย TP เป็น "TP1"
- ทดสอบ 2 ปี (5m+30m+1h, SL/TP1 $15, หลังสเปรด, ครึ่งปีเก่า→ใหม่): เข้าทุกลูกศรทีละไม้ `every` −89/+389/−977/−803 (ชนะ ~50%) → แสดงว่า "ใช้ดูทิศเท่านั้น" · ไม้ ±5 TP1: BUY +312/+448/+99/−466 · SELL +6/−117/−9/+212 · กรอบอื่นยังเป็นระบบ TP1/2/3 เดิม · LINE/บันทึกผลไม่เปลี่ยน

## 🧭 อ่านกราฟไม่งง (7 ต.ค. 2569 · เวอร์ชัน 202610071730)
- ผู้ใช้งงที่กล่องซ้ายบอก "อยู่ในไม้ขาย" แต่การ์ดขวาบอก "รอก่อน" → การ์ดขวา (`#signalCard`) เปลี่ยนหัวเป็น "บทวิเคราะห์ภาพรวม · กราฟ X" + `#sigNote` (ตั้งจาก renderChartZones) บอกว่าเป็นคนละระบบ และถ้าระบบบนกราฟถือไม้อยู่ บอก "ไม่ต้องเปิดไม้ใหม่" · ไม่เขียนว่า investing.com ตรง ๆ เพราะ plan.basis อาจเป็น "คำนวณเอง (สำรอง)"
- ป้าย SL หลังถึง TP1 (`p.be`) = "SL ที่ทุน … ถึง TP1 แล้ว ไม่มีทางขาดทุน" แทน −$0.00 · กล่องสถานะ "X ไม้ปิดแล้ว + 1 ไม้ที่ถืออยู่" · rightOffset ตอนมีไม้ 16 → 8 แท่ง

## 🔴🟢 กราฟบอก BUY และ SELL (7 ต.ค. 2569 · เวอร์ชัน 202610071700)
- ผู้ใช้ขอให้กราฟเรียลไทม์บอกว่าควรเข้าฝั่ง buy หรือ sell → chartzones.js: กรอบ 5m/15m/30m ใช้ `BOTH5` (sides 'both'): −5 = 🔴 สัญญาณ SELL พื้นแดงเข้ม ลูกศร ▼ "ขาย HH:MM" SL บน/TP ล่าง, กล่อง position รองรับไม้ขาย · กรอบ 1h ยัง `BUY5` (sell ขาดทุนทุกครึ่งปี `sellLost`) → บอกว่าไม่แนะนำ SELL
- ทดสอบ 2 ปีหลังสเปรด (Binance PAXG, ครึ่งปีเก่า→ใหม่) เก็บใน `sbt`: 5m −72/−71/+169/+261 · 15m −3/−139/−293/+150 · 30m −55/−50/−14/+124 · 1h −21/−65/−287/−235 — กำไรเฉพาะช่วงหลังที่ทองลง; กล่องสถานะแสดงตัวเลขนี้ตรง ๆ
- **เฉพาะหน้ากราฟ** — ระบบ 30 นาทีที่ส่ง LINE/บันทึก intraday.json ยัง `RULE.sides = 'buy'` ไม่เปลี่ยน · คลาส `.dn` ชนกับการ์ดโดนัท → ไอคอนในคำอธิบายใช้ `sell-mk`

## 🟢 สถานะระบบ + เวลาบนจุดเข้า (7 ต.ค. 2569 · เวอร์ชัน 202610071600)
- **สถานะระบบ**: `refreshBeat()` ใน main.js อ่าน GitHub API สาธารณะ (`actions/workflows/price-alerts.yml/runs?per_page=3`, ไม่ใช้ key, CORS เปิด, จำกัด 60 ครั้ง/ชม./IP → เรียกทุก 5 นาทีเฉพาะตอนแท็บเปิด) → `#inBeat` (การ์ดระบบ 30 นาที) และ `#statsBeat` (การ์ดผลจริง หน้าสถิติ): 🟢 ทำงานอยู่ (run in_progress หรือจบสำเร็จ ≤45 นาที) · ⚠️ ล้มเหลว / ไม่ได้เช็กมา X นาที · ⏸ ตลาดปิด · ถ้าเรียก GitHub ไม่ได้ = ซ่อนบรรทัด (ไม่เดา)
- **เวลาบนจุดเข้า**: chartzones.js มี `clock()`/`ago()` ระดับไฟล์ (ใช้ได้ทั้ง 2 IIFE) — ลูกศร “ซื้อ HH:MM” และป้ายจุดเข้า “ตั้งแต่ HH:MM (X ชม. ก่อน)” · ไม่เปลี่ยนเส้น/กล่องเดิม
- **ทดสอบกลยุทธ์ 30 นาที (1 ปี, Binance PAXG, หักสเปรด $0.4)**: แบบปัจจุบัน 344 ไม้ ชนะ 52% +$181/ออนซ์ แต่ครึ่งปีหลัง −$16 · ไม่มีทางเลือกไหนดีกว่าชัดเจนในครึ่งปีหลัง (เกณฑ์ +4/+6, SL10/20, TP20/30/45, จำกัดช่วงเวลา, ไม่ใช้กฎห้ามไล่ราคา ล้วน −$80…+$7) → **ไม่เปลี่ยนกติกา** · สคริปต์ทดลองอยู่นอกโปรเจค
- สรุปรายสัปดาห์ LINE มีอยู่แล้ว (`weekly-summary.yml` เสาร์ 07:30)

## ↩️ ย้อนหน้าตากลับเป็นแบบเดิม (7 ต.ค. 2569 · เวอร์ชัน 202610071500)
- ผู้ใช้ส่งภาพหน้าเดิม (เวอร์ชัน 202610061722 / commit `1d8dbe4`) แล้วขอให้กลับมาเป็นแบบนั้น → คืน `index.html main.js chartzones.js tradeplan.js ui.js` จาก `1d8dbe4` และลบ `simple.css status.js chartentry.js` รวมถึง test ของสองไฟล์หลัง
- **หัวข้อ "จุดเข้าบนกราฟอ่านง่าย" และ "โครงสร้างเรียบง่ายทุกหน้า" / "การแยกบันทึกระบบกับคะแนนเว็บ" ด้านล่างถูกยกเลิกแล้ว** (เก็บไว้เป็นประวัติ) — แท็บกลับเป็น สัญญาณ/สถิติ/กราฟ/วิธีใช้/บัญชี, กราฟมีปุ่มแบบง่าย/แบบนักเทรด
- ห้ามปรับโครงหน้าให้ "เรียบง่าย" อีกเองโดยไม่ถาม ผู้ใช้ชอบหน้าแบบเดิมที่ข้อมูลครบ · ข้อมูลสัญญาณ/workflow/สถิติไม่ได้เปลี่ยน · ภาพเทียบ `compare/restore-*.png`

## จุดเข้าบนกราฟอ่านง่าย (6 ต.ค. 2569) — ยกเลิกแล้ว 7 ต.ค.
- ผู้ใช้แจ้งว่าจุดเข้าเก่าดูเหมือนคำแนะนำเข้าตอนนี้และหาจุดเดิมยาก: แยกสถานะตอนนี้ออกจากจุดซื้อก่อนหน้าใน chartzones.js
- chartentry.js เป็นโมเดลแสดงผลเท่านั้น: จุดจำลองเป็นรอบล่าสุดเฉพาะช่วงแท่งที่เกิดสัญญาณ พอข้ามแท่งเป็นจุดเดิม; live score ไม่ยืนยันแท่งปิด; ตลาด/ข่าว/ข้อมูล/พักระบบมีลำดับก่อนสถานะผ่าน
- บอกเวลาไทย วัน อายุสัญญาณ ราคาเข้า SL TP และระยะราคากราฟจากจุดเดิม; ปุ่มดูแท่งที่เกิดสัญญาณเลื่อนไปจุดนั้น; ลูกศรมีเวลาและมีรายการย้อนหลังในรายละเอียด
- ไม้จำลองค้างอยู่จะบอกว่ารอจุดใหม่ ระบบไม่เปิดซ้ำ; ไม่สร้างสัญญาณเพื่อให้มีจุดเข้า และไม่แก้กติกา INTRA/SIG หรือประวัติผล
- แสดงเส้นชุดเดียวเมื่อมีไม้จำลอง (พักเส้นแผนประกอบชั่วคราวแล้วคืนเมื่อไม่มีไม้); จุดเก่าป้ายเป็นกลาง ไม่กะพริบ; SL ที่ทุนไม่ซ้อนกับป้ายเข้า
- ผลบนกราฟคือแบบจำลองจากช่วงแท่งที่โหลด ไม่ใช่คำสั่งโบรกเกอร์หรือสัญญาณที่บันทึกใน intraday.json; หน้าเทรดแสดงระบบบันทึกเดิม
- เวอร์ชัน 202610070005; ทดสอบ model ด้วย scripts/test-chartentry.js และหน้าเว็บด้วยข้อมูลทดสอบก่อน/หลังบนคอมและมือถือ

## ⏰ เช็กตรงทุก 5 นาที (5 ต.ค. 2569)
- GitHub cron `*/5` เริ่มจริงห่าง 10–20 นาที → price-alerts.yml ตั้ง `*/15` และแต่ละรอบรัน `scripts/check-loop.sh` นาน ~28 นาที เช็กเองทุกจุด 5 นาที (+20 วิ) · commit ทุกครั้งที่มีผลเปลี่ยน · รอบถัดไปรอคิว (concurrency ไม่ยกเลิก) จึงต่อกันไม่มีช่องว่าง · รันมือ = เช็กครั้งเดียว (`LOOP_MINUTES=0`) · ล้มทั้งรอบเฉพาะเมื่อทุกเช็กล้ม

## 💸 ใช้ของฟรีเท่านั้น (ผู้ใช้เลือก 5 ต.ค. 2569)
- ไม่ซื้อโดเมน → Clerk ยังเป็น development instance (มีป้าย Development mode, จำกัดจำนวนผู้ใช้) · แชร์ให้คนอื่นด้วยลิงก์ `/?demo=1` · ไม่เสนอของเสียเงิน (โดเมน, แพ็กเกจ LINE OA) เว้นแต่ผู้ใช้ถามเอง

## 🗄️ หัวข้อเก่าไม่มีวันที่

### 👀 โหมดดูตัวอย่าง (`?demo=1`)
- auth.js ข้าม Clerk ทั้งหมด → เปิดแอปได้เลย มีแถบ `#demoBar` + ปุ่ม `#accSignIn` ในแท็บบัญชี · การตั้งค่าเก็บใน localStorage · หน้าล็อกอินมีปุ่ม "ดูตัวอย่างก่อน" · Portfolio ลิงก์มาที่ `/?demo=1`

---

# 🗄️ ข้อ 1 เดิม (5–8 ต.ค. 2569) — เก็บเป็นประวัติ ไม่ใช่สภาพปัจจุบัน

> ย้ายมาจากข้อ 1 เมื่อ 15 ต.ค. 2569 (ตรวจคู่มือกับโค้ด) · ยกเลิก/เปลี่ยนแล้ว: โครงสร้างเรียบง่าย + status.js + simple.css (7 ต.ค.), ระบบ 30 นาทีเปิดไม้/ส่ง ✅ ทุกครึ่งชั่วโมง (9 ต.ค. → CHARTSYS), TP 3 จุดของระบบ 30 นาที (9 ต.ค. → TP1), การ์ด 15 นาที + แผนเทรดวันนี้ #tpCard (8 ต.ค.), หน้าสถิติ/renderLiveCheck/#lvCard (9 ต.ค.), โหมด ?demo=1 (8 ต.ค.), หน้าโหลดแบบฟ้าผ่าใน live.css (14 ต.ค. → splash.css), "5h/1d/1w ไม่มีจุดเข้า" (7 ต.ค. มีแล้ว) · สภาพปัจจุบันดูข้อ 1–7


### โครงสร้างเรียบง่ายทุกหน้า (6 ต.ค. 2569 · ผู้ใช้ส่งภาพขอเอาการ์ดสถานะออก)
- **ลบ `#nowCard` และ CSS/renderer ของการ์ดแล้ว ห้ามเพิ่มกลับเอง** ผู้ใช้เห็นว่าข้อมูลเยอะเกินไป ต้องการสิ่งสำคัญในการเทรดและอ่านง่ายทุกหน้า
- หน้า **เทรด**: ราคาทอง + สัญญาณหลัก 30 นาที (รายละเอียดคะแนนใน `#inDetail`) + ไม้เปิดจริงพร้อมช่อง entry/SL/TP1–3 + ข่าวถัดไป (ปฏิทินเต็มยุบไว้)
- หน้า **กราฟ**: เริ่มที่แท่งเทียนถ้ายังไม่เคยเลือกโหมด (`gs-chart`) · คงเส้นจุดเข้า/SL/TP และกล่อง position ตามคำขอเดิม · RSI/MACD, ตารางตัวชี้วัด, รายละเอียด backtest กดเปิดได้ · เครื่องคำนวณ lot อยู่ใต้กราฟ `#positionTools` · แผนแนวรับ–ต้าน/เรดาร์/สัญญาณ 15 นาทีเป็นหัวข้อเสริม
- หน้า **ผลเทรด**: กำไรสุทธิ/อัตราชนะ/จำนวนปิดแล้ว 3 ช่อง + จำนวนชนะ/แพ้และประวัติ · ยอดวันนี้/ประวัติ 30 นาทีหัก userSpread เหมือนยอดรวม · ผลทดสอบ/กราฟเทียบ/โดนัท/สูตรรายวันเก็บในรายละเอียด ไม่ลบข้อมูลสถิติ
- หน้า **วิธีใช้**: 3 ขั้น + คำศัพท์ · กติกาเต็มกดอ่านได้ · หน้า **ตั้งค่า**: ทุน/ความเสี่ยง/สเปรดก่อน แล้วการแจ้งเตือน/ติดตั้งแอป และหน้าจอ/บัญชี
- `simple.css` โหลดหลัง theme.css ใช้ตัวแปรสีเดิมทั้งมืด/สว่าง · `renderTradeSummary()` แสดงเหตุผลสั้นจาก `HOME_STATUS.model` · `renderCalculator()` แยกจาก `renderPlan()` เพื่อให้เครื่องคำนวณทำงานแม้แผนเทรดยุบอยู่ · toggle details เรียก render กราฟ/สถิติเมื่อเปิด · `onScreen` ข้ามรายละเอียดที่ปิด
- `chartzones.js` กดดูผลทดสอบใน `.cz-detail` (จำสถานะเปิดขณะราคาอัปเดต) และระบุจุดจาก replay ว่า “แบบจำลองบนกราฟ” · กติกาสัญญาณ/ประวัติจริง/workflow ไม่เปลี่ยน
- ภาพเปรียบเทียบทุกหน้า `compare/simple-*.png` ใช้ข้อมูลทดสอบชุดเดียวกันทั้งก่อน/หลัง ไม่ใช่ผลเทรดจริง · ทดสอบมือถือ 390/320 และคอม 1440, ทั้งมืด/สว่าง, เปิดรายละเอียดกราฟ, ตั้งค่าและคำนวณ lot, ทั้งมีไม้/ไม่มีไม้

### การแยกบันทึกระบบกับคะแนนเว็บ (6 ต.ค. 2569 · ใช้ภายในสัญญาณหลัก)
- `status.js` (`HOME_STATUS.model`) แยกคะแนนแท่งปิด/คะแนนสด/ไม้ในบันทึกระบบ 30 นาที และเหตุผลที่รอ (พักระบบ, cooldown, ข่าว, ไม่ไล่ราคา, ข้อมูลไม่พร้อม) · การ์ดข้อมูลเชิงเทคนิคแบบเดิมถูกลบตามคำขอผู้ใช้แล้ว
- คะแนนเว็บผ่าน = “รอระบบยืนยัน” เท่านั้น ห้ามอ้างว่ากำลังส่ง LINE โดยไม่มีหลักฐาน · อ่านไม้จาก `state.intra.trades` ดิบ ไม่ใช้ผลประเมินจำลองบนเว็บเป็นการยืนยันจากเซิร์ฟเวอร์
- เก็บ `intraMeta` (source/at/times ของกราฟที่ดาวน์โหลดก่อน patch stream), `priceBarAt`, `signalsAt`, `newsAt` และสถานะ fetch ล้มเหลว · เวลาโหลดสำเร็จแยกจากอายุข้อมูล · กราฟ 30m/1h/5h แสดงเวลาปิดแท่งล่าสุดของแต่ละกรอบ
- `intraday.json.updatedAt` คือเวลา **บันทึกเปลี่ยน** ไม่ใช่ heartbeat หรือเวลาตรวจล่าสุดทุกครั้ง; ข้อมูลปัจจุบันยังไม่มี heartbeat สาธารณะ → แสดงข้อจำกัดนี้ตรง ๆ · ปฏิทินข่าวโหลดล้มเหลวไม่แปลว่าไม่มีข่าว
- เงื่อนไขความสดเป็นการแสดงผลเท่านั้น ไม่เปลี่ยนกติกาซื้อ/ขายหรือ workflows · `node --test scripts/test-status.js` ตรวจสถานะและข้อมูลค้าง · ภาพประวัติการ์ดที่ยกเลิกแล้วอยู่ใน `compare/status-*.png`
- แก้คำอธิบายหน้าแรก/ล็อกอิน/วิธีใช้/สถิติให้ตรงกับซื้ออย่างเดียวคะแนนแท่งปิด +5 และปิดไม้ 02:45 (03:45 หน้าหนาว) · เมื่อกลับเข้าแท็บโหลดบันทึกสัญญาณและข่าวใหม่ด้วย

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

### 📲 แอป (PWA) + แจ้งเตือนบนเครื่อง (6 ต.ค. 2569)
- `manifest.webmanifest` + `icons/` (192/512/maskable/apple-touch 180/badge-96 สร้างจาก logo.svg ด้วย puppeteer) + `sw.js` (ไม่แคชข้อมูล มีหน้า offline · รับ push → showNotification · แตะ → โฟกัสแอป) · vercel.json: sw.js no-cache
- `pwa.js`: ปุ่มติดตั้ง (`beforeinstallprompt`; iPhone = วิธีทำผ่าน Safari) ในการ์ด `#pwaCard` แท็บบัญชี + แถบ `#installBar` บนมือถือ (ปิดได้ จำใน localStorage) · เปิดแจ้งเตือน: ต้องล็อกอิน (โหมด demo ไม่ได้) → `pushManager.subscribe` (timeout 20 วิ) → เก็บใน Clerk `unsafeMetadata.push` (ไม่เกิน 5 เครื่อง, เก็บ goldSettings ไว้ด้วย)
- เซิร์ฟเวอร์: `scripts/push.js` — `notify.send()`/`sendFlex()` ส่ง LINE แล้ว push ข้อความเดียวกัน (บรรทัดแรก = หัวเรื่อง) ไปทุกเครื่องจาก Clerk Backend API (`GET /users`) · 404/410 → ลบเครื่องออก (PATCH metadata) · ไม่มีคีย์ → ข้าม (log)
- คีย์: secret `VAPID_PRIVATE_KEY`, `CLERK_SECRET_KEY` + variable `VAPID_PUBLIC_KEY` + `config.js vapidPublicKey` (ว่าง = การ์ดขึ้น "กำลังเตรียม") — ตั้งด้วย `node scripts/setup-push.js` (**ผู้ใช้ต้องรันเอง** — Claude ไม่มีสิทธิ์เขียน secret) แล้ว commit config.js · workflow ทั้ง 3 ติดตั้ง `web-push` (package.json dependencies; Vercel ไม่ install เพราะ installCommand ว่าง)
- ทดสอบ: puppeteer + `ServiceWorker.deliverPushMessage` / คลิกปุ่มด้วย JS (แถบแท็บล่างบังปุ่ม) / subscribe ผ่าน FCM จริงใน headless ได้ + push.js กับ Clerk ปลอม → แจ้งเตือนขึ้นจริง
- กับดัก: `.btn { display: inline-flex }` ทับ attribute `hidden` → เพิ่ม `.btn[hidden] { display: none }` · dev-server เสิร์ฟโฟลเดอร์ย่อยได้แล้ว (icons/, compare/)

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
- **อนิเมชั่นเพิ่ม (6 ต.ค. 2569)** live.css "More motion" + theme.css (สีโหมดสว่าง): `.sp-market` กราฟแท่งเทียนขาขึ้น 18 แท่ง (`.mk-c` เด้งทีละแท่ง `--i`×0.11 วิ) + `.mk-line` วาดเส้นราคา (pathLength=1 — **ห้ามใส่ vector-effect: non-scaling-stroke กับเส้นที่ใช้ pathLength** dash จะเพี้ยน) · `.sp-beams` ลำแสง conic หมุน · `.sp-wave` ×2 คลื่นกระแทก + `.sp-sparks` 10 จุด (`--a` มุม, `--d` ระยะ) ตามรอบฟ้าผ่า 3.2 วิ · `#splashHead` หัวดาวหางที่ปลายวงแหวน (auth.js `count()` คำนวณ cx/cy) · `.sp-pct.bump` ทุก 25% · ชื่อแยกเป็น `<span style="--i">` ตกลงทีละตัว (แต่ละตัวมี shine เอง) · `.splash.done` = `lgBoom` คลื่นใหญ่ + `lgFlashEnd` + `beamFlare`
- ❌ **ลองแบบจัดเต็มแล้วผู้ใช้ไม่เอา (6 ต.ค. 2569)**: ฝนเหรียญ 3 มิติ, พื้นตาราง, แถบตัววิ่ง, ตัวอักษรวนรอบโลโก้, จอสั่น, วาร์ป (commit e8d67dd) → revert กลับเป็นชุดก่อนหน้า — อย่าเพิ่มกลับเอง
- ทดสอบ: บล็อก request ภายนอกด้วย puppeteer ให้หน้าโหลดค้าง แล้วหยุดภาพ · **อย่าเรียก `a.play()` กับอนิเมชั่นที่จบแล้ว** (มันจะเริ่มใหม่จาก 0 ภาพเพี้ยน) — ใส่คลาส done แล้วหยุดเฉพาะอนิเมชั่นใหม่
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
- **กราฟในการ์ดเดินตามราคาสด (6 ต.ค. 2569)**: เดิม `drawS15Chart` วาดเฉพาะตอน `s.at` เปลี่ยน (แท่ง 15m ปิด) → ราคาบนกราฟค้างไม่ตรงหัวเว็บ (ผู้ใช้แจ้ง) · ตอนนี้ `s15Tick()` ใน onStreamTick อัปเดตแท่งล่าสุดทุก tick, `patchIntraCandles` ขึ้นแท่ง 15m ใหม่จากสตรีม, `refreshM15` ตั้ง `renderS15.drawn = null` ให้วาดใหม่ทุกนาที · ทดสอบ: แท่งล่าสุด == state.livePrice 30/30 (เดิม 0/30)
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

### 📈 สัญญาณบนกราฟทุกกรอบเวลา (chartzones.js, 6 ต.ค. 2569 · ผู้ใช้ขอ "สัญญาณตรงกราฟว่าควรเข้าโซนไหน ทุกทามเฟรม")
- ระบบเดียวกัน (3 กรอบชี้ขึ้น ซื้อที่ +5, noChase) ใช้กรอบกราฟเป็นกรอบเร็ว · `SYS` ใน chartzones.js: 5m [5m,30m,1h] · 15m FRAMES15 · 30m FRAMES · **1h [1h,4h,5h] SL×2 ($30, TP 30/40/60)** · 5h/1d/1w ไม่มีจุดเข้า (ทิศทางอย่างเดียว)
- ผลทดสอบ 2 ปี (4 ครึ่งปี หลังสเปรด): 1h +166/+145/+383/+57 (**กำไรทุกช่วง**, ×1.5 ก็ +194/+220/+101/+58; ×1 −194 ครึ่งปีล่าสุด) · 5m +90/+342/+352/−417 · 15m +61/+480/+305/−53 · 30m +135/+429/+218/−31 · ลอง 1h ด้วย [1h,5h,1d] แล้วครึ่งปีล่าสุดขาดทุน จึงใช้ 4h
- แท่ง 4h ไม่มีใน investing → `state.h4` จาก backupBars('4h', 200) (Binance PAXG เลื่อนเป็นราคา spot เหมือน backtest) ทุก 10 นาที
- วาดบนทั้ง 2 มุมมอง (mainChart/candles + simpleChart/areaS): histogram `priceScaleId: 'cz'` เป็นพื้นหลัง, markers, price lines, กล่อง `#czBox` / `#czBoxS` · main.js markChart15 → renderChartZones · drawPlanLines (เส้นจุดเข้า/ตัดขาดทุน/เป้า จาก investing.com) **ผู้ใช้ขอให้คงไว้บนกราฟ** — ลองเอาออกแล้วผู้ใช้สั่งเอากลับ (6 ต.ค. 2569)
- **กล่องสถานะไม้** (chartzones.js ส่วนท้าย `drawPositionBoxes`, ผู้ใช้: "จุดเข้าให้ชัดกว่านี้"): HTML overlay `.pbox-layer` ใน #mainChart / #simpleChart · แดง entry→SL, เขียว entry→TP สุดท้าย, `.pentry` เส้นทอง, ป้าย `.ptag` ชิดขวาแกนราคา ดันไม่ให้ทับกัน · ไม้ระบบ (`window.CZ_OPEN`) ก่อน แล้วค่อยแผน investing (`state.locked`) · rightOffset 16 ตอนมีไม้ · กล่องกว้าง ≥170px
- **กับดัก**: mainChart ซ่อนแกนเวลา → `timeScale().width()` = 0 ต้องใช้ `el.clientWidth − priceScale('right').width()` · innerHTML ใหม่ทุก tick ทำให้อนิเมชั่นเริ่มใหม่ตลอด (กะพริบ) → เขียนเฉพาะตอนเปลี่ยน ไม่มีอนิเมชั่นเข้า
- **กับดัก**: replay cache ห้ามเก็บผลที่เป็น null (ข้อมูลยังโหลดไม่ครบ) — เคยทำให้กรอบ 1h คำนวณไม่ได้ 99/100 จุดถาวร
- ทดสอบภาพตอนไม่มีสัญญาณจริง: override INTRA.decideWith ในหน้า (กลับเครื่องหมายคะแนน) เฉพาะใน puppeteer

### 🧪 ทดสอบแผนเทรด + ผลจริง vs ทดสอบ (6 ต.ค. 2569)
- **จุดเข้าตามแนวรับ–ต้านขาดทุน** (2 ปี ทุกชั่วโมง คำสั่งรอ 60 นาที ตามบนแท่ง 5m หลังสเปรด, 4 ครึ่งปี): ซื้อแนวรับ +147/+71/−441/−587 · เฉพาะเทรนด์ขึ้น +176/+94/−126/−179 · ขายแนวต้าน −422/−623/−705/−25 · เบรก −1213/−94/−359/−864 → tradeplan.js `LEVEL_BT` แสดงตารางนี้แทนจุดเข้า · ส่วนที่เหลือ: เช็กว่า TP1/SL ของระบบมีแนวขวางไหม + ปุ่ม `#tpUseSys`
- **เรดาร์ 1 นาทีขาดทุน**: limit ที่ EMA9, SL max($4, 2×ATR1m), TP 1.5×SL → ~10,000 ไม้ 40–43% −$1,811 หลังสเปรด (+$2,311 ก่อนสเปรด) → เหลือแค่ข้อมูลโมเมนตัม
- `renderLiveCheck()` (main.js, เรียกจาก renderStats): ผลจริง intraday.json เทียบ backtest-30m.json — คาด n×avg ± 2σ√n, ต้อง ≥20 ไม้ถึงสรุป · การ์ด `#lvCard` แท็บสถิติ + `#lvStrip` หน้าแรก · บอกผลทดสอบ 30/90 วันล่าสุด
- `onScreen(id)`: การ์ด 15m / แผนเทรด render เฉพาะตอนอยู่บนจอ (±200px)
- ตาราง % โอกาส (calibration) ไม่ต้องแก้ตาม noChase: เป็นการจำลอง "ถ้าเข้าตอนนี้ที่คะแนนนี้" ทุกจังหวะ ไม่ขึ้นกับตัวกรอง
- สคริปต์วิจัยอยู่ใน scratchpad (ไม่ได้ commit): ข้อมูล Binance PAXG 1m/5m/15m/30m/1h 2 ปี

### 🧭 แผนเทรดวันนี้ (tradeplan.js, 6 ต.ค. 2569 · ผู้ใช้ขอ "ครบทุกอย่างสำหรับนักเทรดทอง")
- การ์ด `#tpCard` หน้าแรกใต้การ์ด 15 นาที · `window.renderPlan()` เรียกจาก onStreamTick ส่วน heavy (≤1 ครั้ง/วิ) · ใช้ global ของ main.js (state, f2, nowPrice, thaiTime, signedScore, lotFor) จึงต้องโหลด **หลัง** main.js
- ช่วงตลาด (`SESS`, เวลาหน้าร้อน + SIG.marketShift) · บันได: PLAN.levelsFromDaily + สูง/ต่ำวันนี้ (m15 ตั้งแต่เปิดตลาด) + TA.swings(m15) รวมระดับที่ห่าง < $1.5 · จุดเข้า: แนวที่ใกล้สุด (ห่าง ≥ ¼ ATR15) · SL = เลยแนวไป max($5, 0.8×ATR15) · TP1 = แนวแรกที่ห่าง ≥ 1R, TP2 = แนวถัดไป ≥ ½R ต่อ (ไม่มีก็ 1.5R / +1R) · ป้าย "เข้ากับเทรนด์" จากคะแนนสด 30 นาที (≥+3 ซื้อ, ≤−3 ขาย, อื่น ๆ เล่นกรอบ)
- เรดาร์ 1 นาที (state.tick): EMA9/21 + ROC 5 นาที, RSI14, ATR14 · SL สั้น = max($4, 2×ATR1m), TP = 1.5×SL · ข่าวแรงใกล้ → งด
- เครื่องคิด: `calc.fill(side, entry, sl, tp)` · ค่าเริ่ม = ราคาสด ±$15 จนกว่าผู้ใช้จะแก้
- **จุดเข้าส่วนนี้ยังไม่ backtest** (การ์ดบอกไว้) — Pivot+limit เคยทดสอบแล้วขาดทุน (ประวัติข้อ 1) ถ้าจะทำเป็นสัญญาณจริงต้องทดสอบก่อน

### 🔍 ไม่ไล่ราคา + เหตุผลละเอียด + กราฟ 15 นาทีแบบโต้ตอบ (6 ต.ค. 2569 · ผู้ใช้ขอ "ละเอียดและแม่นยำขึ้น")
- **`RULE.noChase`** (ใช้ทั้ง RULE และ RULE15): ไม่เข้าถ้ากรอบเร็ว (30m/15m) ปิดนอกขอบ Bollinger ด้านที่จะเข้า (`dec.bbPos` ≥ 1 ฝั่งซื้อ) → `dec.stretched`, reasons() มีข้อความ · ต้องเช็ก `sideOk` ด้วย (ไม่งั้นคะแนน −5 ขึ้นข้อความ "ยืดเกินขอบบน" ผิด)
- ผล (ข้อมูลชุดเดียวกัน หลังสเปรด): 30m 1y +$122→+$166 (375→349 ไม้), 2y +$726→+$751 · 15m 1y +$169→+$230 · แบ่ง 4 ครึ่งปี: ดีขึ้นในครึ่งปีล่าสุดที่ขาดทุน (15m −$175→−$53, 30m −$159→−$31) แย่ลงเล็กน้อยช่วงกลาง
- **สิ่งที่ลองแล้วไม่ใช้**: SL/TP = k×ATR 1 ชม. (k 1.0–2.0) — ไม่ดีขึ้นสม่ำเสมอ ทุกแบบยังขาดทุนครึ่งปีล่าสุด · ADX, RSI, ระยะห่าง EMA, ชั่วโมงเทรด, คะแนนละเอียด — ดีปีหนึ่งแย่อีกปี · ข้อสังเกต: ATR 1 ชม. เพิ่มจาก ~$9 เป็น ~$16 (SL $15 โดนบ่อยขึ้น 43%→57%) · สคริปต์วิจัย: ดึง Binance 2 ปีเก็บ features ของทุกจังหวะ score≥3 แล้วจำลองไม้เดียวต่อครั้งตามตัวกรอง (แบ่ง Y1/Y2 และ 4 ครึ่งปี)
- `decideWith` เก็บ `frames[].avg` + `frames[].votes` (ตัวชี้วัดทีละตัว) → main.js `whyDetail`/`renderWhy(prefix)` ใน `<details id="s15Detail">` และ `#inDetail` (อัปเดต DOM เฉพาะเมื่อข้อความเปลี่ยน เพื่อให้กล่องเปิดค้างได้)
- กราฟการ์ด 15m: ลากเลื่อน/ซูมที่แกน/pinch (ไม่ใช้ล้อเมาส์) · `s15View` แสดง 96 แท่งล่าสุดจนกว่าผู้ใช้จะแตะกราฟ (`s15Chart.user`, ปุ่ม `#s15Reset`) · `s15Ohlc` แถบ OHLC + คะแนนตอนแท่งปิด (`decAt.get(b.time + M15)`) จาก subscribeCrosshairMove
- ทดสอบ puppeteer: ต้อง scrollIntoView ก่อนใช้ mouse กับกราฟ (นอกจอ = hover ไม่ทำงาน)

### กติกาการนับผล (ใช้ร่วมกันใน `signals.js` → `evaluateTargets`)
- ปิด **⅓ ที่แต่ละ TP** · ถึง TP1 แล้ว **เลื่อน SL ไปที่ทุน**
- **ชนะ** = ถึง TP1 ก่อน SL · **แพ้** = โดน SL ก่อน TP1 · แท่ง 15 นาทีเดียวโดนทั้ง SL และ TP → นับว่าโดน SL ก่อน (อนุรักษ์นิยม)
- ครบ 3 เป้า = **+$21.67/ออนซ์** · TP1 แล้วกลับทุน = **+$5** · โดน SL = **−$15**
- ไม้เก่าที่มี `tp` เดียว (ไม่มี `tps`) ใช้ `evaluate` แบบเดิม — อย่าลบโค้ดส่วนนี้
