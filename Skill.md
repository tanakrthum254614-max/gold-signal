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

## 1. ระบบสัญญาณ 2 ระบบ (แยกสถิติกัน)

### 📅 สัญญาณรายวัน (07:00 จันทร์–ศุกร์) — `signals.js` · บันทึกใน `signals.json`
- ทิศทาง = แนวโน้ม **สั้น + กลาง + ยาว** จาก investing.com (`explain.js` horizons) รวมกัน (เสมอ → ใช้ระยะกลาง)
- **เข้าทันที (Market)** ที่ราคาตอน 07:00 · มีสัญญาณทุกวันทำการ (`RULE.minTrend: 0`)
- **SL $15 · TP1 $15 · TP2 $20 · TP3 $30** · ดาว ★ = แนวโน้ม 3 ช่วงสอดคล้องกันแค่ไหน (|คะแนน| 0–6)
- ออกสัญญาณ **07:05** (หลังตลาดเปิด) · อายุถึง **02:45 คืนถัดไป** (ก่อนตลาดปิด 03:00) แล้วปิดที่ราคาตอนนั้น

### ⏱️ สัญญาณ 30 นาที — `intraday.js` · บันทึกใน `intraday.json`
- ทุกครึ่งชั่วโมง วิเคราะห์แท่งที่ **ปิดแล้ว** ของ investing.com `PT30M / PT1H / PT5H` ด้วยตัวชี้วัดของเราเอง (`indicators.js`)
- คะแนน = ผลรวม 3 ช่วง (−6…+6) → **เข้าเมื่อ |คะแนน| ≥ 5** · ครั้งละ 1 ไม้ · ไม้ใหม่ได้ในครึ่งชั่วโมงที่เริ่ม ≥15 นาทีหลังไม้ก่อนปิด
- **เวลาตลาด (ไทย): 07:00–03:00** จันทร์ 07:00 ถึง เสาร์ 03:00 (`INTRA.marketOpen`) · ไม่เปิดไม้ใหม่ 02:00–03:00 · ทุกไม้ปิดภายใน **02:45** (`nextClose`) · ไม่ส่งอัปเดตรายชั่วโมงตอนตลาดปิด
- SL/TP เหมือนรายวัน
- **อัปเดต LINE ทุก 1 ชั่วโมง ไม่ข้าม** (`UPDATE_EVERY`) (`updateText` ใน `scripts/intraday-run.js`): ทิศทางที่ควรเอน (`dec.lean`) + จุดเข้า/SL/TP
  + **% โอกาสถึง TP1 ก่อน SL** จากตาราง `calibration` ใน `backtest-30m.json` (สถิติ 2 ปี แยกตามคะแนน −6…+6, `INTRA.odds`)
  ระดับ: ≥57% ✅ น่าเข้า · 53–56% 🟡 พอเข้าได้ · ≤52% ⚠️ ใกล้ 50/50 — ไม้ที่ "นับสถิติ" ยังเปิดเฉพาะเมื่อ |คะแนน| ≥ 5
- ชั่วโมงที่ประกาศไปแล้วเก็บใน `state/notify.json` ผ่าน **Actions cache** (ไม่ commit ทุกชั่วโมง → Vercel ไม่ deploy ถี่)
- ข้อสังเกตจากตาราง (2 ปี): ฝั่ง **ซื้อ** คะแนน +4…+6 ชนะ 57–59% · ฝั่ง **ขาย** −4…−6 แค่ ~49–50% (ทองเป็นขาขึ้นเกือบทั้งช่วง)

### ระบบเสริม (เพิ่ม 5 ต.ค. 2569)
- **30 นาทีเข้าเฉพาะฝั่งซื้อ** (`INTRA.RULE.sides = 'buy'`) — backtest 2 ปี: ซื้ออย่างเดียว 630 ไม้ +$893 หลังสเปรด vs สองฝั่ง 1,267 ไม้ +$791 · 1 ปีล่าสุด +$164 vs +$239 (ต่อไม้ดีกว่าเกือบเท่าตัว)
- **หลบข่าวแรง**: ปฏิทิน investing.com `endpoints.investing.com/pd-instruments/v1/calendars/economic/events/occurrences?domain_id=1&country_ids=5&importances=high` (CORS เปิด, ดึงได้ทั้งเว็บและ Actions) → ไม่เปิดไม้ ±30 นาที (`RULE.newsMin`) · เตือนล่วงหน้า ~30 นาที · รายการข่าวในข้อความเช้า · backtest **ไม่มี**ตัวกรองข่าว (ไม่มีปฏิทินย้อนหลัง)
- **ขนาดไม้**: 0.01 lot = 1 ออนซ์ → lot = ทุน×%เสี่ยง ÷ (SL×100) ปัดลง 0.01 · ตั้งค่า (ทุน USD/THB, %เสี่ยง, สเปรด) ในแท็บบัญชี เก็บใน Clerk `unsafeMetadata.goldSettings` + localStorage
- **สเปรด**: `SIG.summary(list, spread)` หักต่อไม้ · ฝั่งเซิร์ฟเวอร์ใช้ `SPREAD_USD` จาก repo variable `vars.SPREAD_USD` (ค่าเริ่ม 0.4) · เว็บใช้ค่าที่ผู้ใช้ตั้ง
- **ช่องทางส่ง** (`scripts/notify.js`): สำคัญ (เข้า/TP/SL/สัญญาณเช้า/สรุป) → LINE (+สำเนา Telegram) · ประจำ (อัปเดตรายชั่วโมง/เตือนข่าว) → Telegram ถ้าตั้ง `TELEGRAM_BOT_TOKEN`+`TELEGRAM_CHAT_ID` ไม่งั้น LINE · ส่งพลาดแค่ log ไม่ล้ม
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
style.css       ธีมมืด สีทอง
config.js       Clerk publishable key + ลิงก์เพิ่มเพื่อน LINE (ของสาธารณะ ไม่มีความลับ)
auth.js         หน้าโหลด (splash) + ล็อกอิน Google ผ่าน Clerk (clerk-js@6 + @clerk/ui@1 + ภาษาไทย thTH)
ui.js           แท็บ (hash routing), หน้าบัญชี, แชร์ LINE
main.js         ดึงข้อมูล investing.com จากเบราว์เซอร์, กราฟ, การ์ดสัญญาณ, หน้าสถิติ
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
  alerts.js          ทุก 5 นาที: ติดตามสัญญาณรายวัน แจ้ง TP/SL
  intraday-run.js    ทุก 5 นาที: ติดตาม/เปิดไม้ 30 นาที แจ้ง LINE
  trade-events.js    ข้อความ LINE ของเหตุการณ์ TP/SL (ใช้ร่วมกัน)
  line.js            broadcast ไป LINE Messaging API
  backtest.js / backtest-30m.js   ทดสอบย้อนหลัง (Binance PAXG ผ่าน data-api.binance.vision)
.github/workflows/
  morning-plan.yml   cron 00:05 UTC จ.–ศ. (= 07:05 เวลาไทย หลังตลาดเปิด)
  price-alerts.yml   cron ทุก 5 นาที จ.–ศ. (UTC) · แจ้ง TP/SL · อัปเดตทุก 1 ชั่วโมง · เปิดไม้ 30 นาที
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

- **ห้ามตั้งชื่อไฟล์ราก `app.js` / `server.js` / `index.js`** — Vercel จะคิดว่าเป็น Node server แล้วเว็บพัง (500)
- **Vercel Hobby บล็อก deploy ถ้า commit author ไม่ใช่บัญชีที่เชื่อมไว้** → workflow commit ด้วยตัวตน `tanakrthum254614-max` (noreply email) ห้ามใช้ github-actions[bot]
- **Vercel MCP connector ไม่มีสิทธิ์ scope thander1** → ใช้ Vercel CLI
- **Line endings**: repo ตั้ง `core.autocrlf false` ไว้แล้ว ถ้าไฟล์กลายเป็น CRLF สคริปต์แก้ไฟล์แบบหลายบรรทัดจะหาข้อความไม่เจอ
- **`String.replace(a, b)` ใน Node: `$$` ใน b จะกลายเป็น `$` ตัวเดียว** (และ `$&`, `$'` มีความหมายพิเศษ) — นี่คือต้นเหตุที่ `$` หายจากข้อความไทยหลายครั้ง · แทรกโค้ดด้วย `slice()` ต่อ string หรือ `replace(a, () => b)` แทน
- **วันจันทร์ `backtest.json` มักชนกัน** (งานเช้าสร้างใหม่) → แก้ด้วยการรัน `node scripts/backtest*.js 365` ใหม่แล้ว `git add`
- **แก้โค้ดผ่าน node/heredoc ระวัง `$` และ `\n`** ใน template string หายหรือกลายเป็นขึ้นบรรทัดจริง — ตรวจ `grep '~\${\|(+\${'` หลังแก้
- **โควตา LINE ฟรี 300 ข้อความ/เดือน นับต่อคน** — อัปเดตทุก 1 ชั่วโมง ≈ 24/วัน + เหตุการณ์ไม้ ≈ **600+/คน/เดือน** → แพ็กเกจฟรีหมดภายในประมาณ 2 สัปดาห์ ต้องอัปเกรด LINE OA
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
