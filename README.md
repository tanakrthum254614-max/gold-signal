# Gold Signal — วิเคราะห์กราฟทองคำ XAU/USD แบบเรียลไทม์

เว็บวิเคราะห์กราฟทองคำ บอกว่าตอนนี้ควร **ซื้อ / ขาย / รอก่อน** พร้อมจุดเข้า, Stop Loss, Take Profit และเหตุผล

## วิธีรัน
```
npm start
```
แล้วเปิด http://localhost:3000  (ไม่ต้อง npm install — ไม่มี dependency)

## แหล่งข้อมูล
- **หลัก: investing.com** (XAU/USD, pair id 68) — เบราว์เซอร์ของผู้ใช้ดึงตรงจาก `api.investing.com`
  (API นี้อนุญาต CORS เมื่อส่ง header `domain-id`; การดึงจากฝั่ง server จะโดน Cloudflare บล็อก จึงไม่ใช้ proxy)
  - แท่งเทียน: `/financialdata/68/historical/chart/?interval=PT1H&pointscount=160` อัปเดตทุก 3 วินาที
  - สถิติทางเทคนิค (สรุป, 12 ตัวชี้วัด, 12 ค่าเฉลี่ยเคลื่อนที่, Pivot Points): `/financialdata/technical/analysis/68/{5m,15m,30m,1h,5h,1d,1w,1mo}` ทุก 30 วินาที
- **สำรอง** (ถ้า investing.com ใช้ไม่ได้): Binance `PAXGUSDT` ปรับเทียบด้วยราคา Spot จาก gold-api.com และคำนวณตัวชี้วัดเอง (`indicators.js`)

## วิธีวิเคราะห์ (investing.js)
ใช้ "สรุปรวม" ของ investing.com ใน Timeframe ที่เลือกเป็นทิศทางหลัก แล้วกรองด้วย:
- Timeframe ใหญ่ต้องไม่สวนทาง (5m/15m→1h, 30m/1h→5h, 5h→1D, 1D→1W, 1W→1M)
- ถ้าสัญญาณไม่ใช่ "แรง" Timeframe ใหญ่ต้องยืนยัน
- RSI / Williams %R ไม่ Overbought/Oversold (ไม่ไล่ราคา)
- ราคาไม่ชน Pivot แนวรับ/แนวต้านใกล้เกินไป (< 0.3 ATR)

ผ่านทุกข้อ → **ซื้อ / ขาย** ไม่ผ่าน → **รอก่อน** พร้อมบอกเหตุผล
SL = 1.5 × ATR(14) ของ investing.com, TP1/TP2 = Pivot ถัดไปในทิศทางเทรด (หรือ 1.5/3 ATR)

> ⚠️ เป็นเครื่องมือวิเคราะห์ทางเทคนิค ไม่ใช่คำแนะนำการลงทุน

## Deploy
เว็บจริง: https://gold-signal-ten.vercel.app — เชื่อม GitHub กับ Vercel แล้ว **push ขึ้น `main` = deploy อัตโนมัติ**
