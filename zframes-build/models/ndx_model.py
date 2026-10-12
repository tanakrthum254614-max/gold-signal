"""zframes · Nasdaq-100 model
รายชื่อ + market cap จาก Nasdaq → ราคา 1 ปีทุกตัวจาก Yahoo → ตัวชี้วัดรายตัว, breadth, กลุ่มอุตสาหกรรม, มหภาค
เขียนผลไปที่ models/out/ndx.json

    python models/ndx_model.py
"""
import json, math, os, statistics, sys, time, urllib.request
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import gold_model as G  # ใช้ตัวชี้วัด + macro_block ร่วมกัน

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "models", "out", "ndx.json")
UA = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130 Safari/537.36",
      "accept": "application/json"}
warnings = G.warnings

# กลุ่มอุตสาหกรรม (จัดเอง ไม่ใช่ GICS ทางการ)
SECTOR = {
    "Semiconductors": "NVDA AVGO AMD MU INTC QCOM TXN ADI AMAT LRCX KLAC ASML MRVL ARM NXPI MCHP MPWR TER ALAB",
    "Software & Cloud": "MSFT ADBE INTU CDNS SNPS ADSK PANW CRWD FTNT DDOG WDAY PLTR APP MSTR ROP CRWV NBIS",
    "Internet & Media": "GOOGL GOOG META NFLX AMZN PDD MELI SHOP ABNB BKNG DASH TTWO CMCSA TMUS TRI",
    "Hardware & Storage": "AAPL CSCO WDC STX SNDK LITE",
    "Consumer": "TSLA COST WMT SBUX ROST ORLY MAR PEP MDLZ MNST KDP CCEP CPRT",
    "Health care": "AMGN GILD VRTX REGN ISRG IDXX DXCM ALNY MRNA GEHC",
    "Industrials & Space": "HON HONA PCAR CTAS ODFL CSX FAST AXON PAYX ADP SPCX RKLB FER LIN",
    "Energy & Utilities": "AEP XEL EXC CEG FANG BKR",
    "Financials": "PYPL",
}
SECTOR_OF = {s: k for k, v in SECTOR.items() for s in v.split()}
HL_STOCKS = set("AAPL AMAT AMD AMZN ARM ASML AVGO COST CRWD GOOGL INTC LITE LRCX META MRNA MRVL MSFT MSTR MU NBIS NFLX NVDA PLTR QCOM TSLA WDC CRWV SNDK".split())


def get(url, timeout=20):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read().decode("utf-8"))


def yahoo_daily(sym):
    q = urllib.request.quote(sym)
    d = get(f"https://query1.finance.yahoo.com/v8/finance/chart/{q}?range=1y&interval=1d")["chart"]["result"][0]
    c = d["indicators"]["quote"][0]
    bars = [{"t": t * 1000, "h": h, "l": l, "c": cl} for t, h, l, cl in zip(d["timestamp"], c["high"], c["low"], c["close"])
            if cl is not None and h is not None]
    return d["meta"], bars


def num(s):
    try:
        return float(str(s).replace("$", "").replace(",", "").replace("%", ""))
    except ValueError:
        return None


def stock_metrics(sym, meta, bars):
    cl = [b["c"] for b in bars]
    n = len(cl)
    px = meta.get("regularMarketPrice") or cl[-1]
    # แท่งสุดท้าย = วันทำการล่าสุด (chartPreviousClose ของ range=1y คือราคาก่อนเริ่มช่วง ไม่ใช่เมื่อวาน)
    prev = cl[-2] if n > 1 else None
    back = lambda k: cl[-1 - k] if n > k else None
    y0 = next((b["c"] for b in bars if datetime.fromtimestamp(b["t"] / 1000, timezone.utc).year == datetime.now().year), None)
    e20, e50 = G.ema(cl, 20)[-1], G.ema(cl, 50)[-1] if n >= 50 else None
    e200 = G.ema(cl, 200)[-1] if n >= 200 else None
    r = G.rsi(cl) if n > 15 else None
    h = G.macd(cl)[2] if n > 35 else None
    score = (1 if px > e20 else -1) + ((1 if e20 > e50 else -1) if e50 else 0) + ((1 if px > e200 else -1) if e200 else 0) \
        + ((1 if h > 0 else -1) if h is not None else 0) + ((1 if r > 55 else -1 if r < 45 else 0) if r is not None else 0)
    rets = [math.log(b / a) for a, b in zip(cl[-31:], cl[-30:])] if n > 31 else []
    hi, lo = meta.get("fiftyTwoWeekHigh") or max(cl), meta.get("fiftyTwoWeekLow") or min(cl)
    return {
        "px": px, "prev": prev, "ch1d": G.pct(px, prev), "ch1w": G.pct(px, back(5)), "ch1m": G.pct(px, back(21)),
        "ch3m": G.pct(px, back(63)), "ytd": G.pct(px, y0), "ch1y": G.pct(px, cl[0]) if n > 200 else None,
        "rsi": r, "score": score, "aboveE50": px > e50 if e50 else None, "aboveE200": px > e200 if e200 else None,
        "e50": e50, "e200": e200, "vol30": statistics.pstdev(rets) * math.sqrt(252) * 100 if rets else None,
        "hi52": hi, "lo52": lo, "fromHigh": G.pct(px, hi), "pos52": (px - lo) / (hi - lo) * 100 if hi > lo else None,
        "atr": G.atr(bars) if n > 15 else None, "days": n,
    }


def signal(m):
    s, r = m["score"], m["rsi"] or 50
    if s >= 3 and r >= 70: return "ขาขึ้น · ร้อนแรง"
    if s >= 3: return "ขาขึ้น"
    if s <= -3 and r <= 30: return "ขาลง · ขายมากเกิน"
    if s <= -3: return "ขาลง"
    if r <= 30: return "ขายมากเกิน"
    if r >= 70: return "ซื้อมากเกิน"
    return "ไซด์เวย์"


def main():
    now = int(time.time() * 1000)
    data = {"asset": "NDX", "name": "Nasdaq-100", "generatedAt": now, "sources": []}

    lst = get("https://api.nasdaq.com/api/quote/list-type/nasdaq100")["data"]
    rows = lst["data"]["rows"]
    data["listDate"] = lst.get("date")
    data["sources"].append({"name": "Nasdaq.com", "what": f"รายชื่อ Nasdaq-100 {len(rows)} ตัว + market cap", "at": now})

    syms = [r["symbol"] for r in rows] + ["QQQ", "^NDX"]
    with ThreadPoolExecutor(10) as ex:
        res = dict(zip(syms, ex.map(lambda s: G._safe(yahoo_daily, s), syms)))
    data["sources"].append({"name": "Yahoo Finance", "what": "ราคารายวัน 1 ปี ทุกตัว + ราคาสดระหว่างวัน", "at": now})

    # ดัชนี
    imeta, ibars = res.get("^NDX") or res.get("QQQ") or (None, None)
    if not ibars:
        print(json.dumps({"error": "ดึงข้อมูลดัชนีไม่ได้"}, ensure_ascii=False)); sys.exit(1)
    idx = stock_metrics("^NDX", imeta, ibars)
    idx["series"] = [{"t": b["t"], "v": round(b["c"], 2)} for b in ibars]
    idx["rsiSeries"] = [{"t": b["t"], "v": round(v, 1)} for b, v in zip(ibars, G.rsi_series([b["c"] for b in ibars])) if v is not None]
    data["index"] = idx

    # หุ้นรายตัว
    stocks, dates = [], [b["t"] for b in ibars]
    day = lambda t: datetime.fromtimestamp(t / 1000, timezone.utc).date()
    dkeys = [day(t) for t in dates]
    tot_cap = sum(num(r["marketCap"]) or 0 for r in rows)
    for r in rows:
        s = r["symbol"]
        got = res.get(s)
        if not got or len(got[1]) < 5:
            warnings.append(f"ไม่มีราคาย้อนหลัง {s}"); continue
        meta, bars = got
        m = stock_metrics(s, meta, bars)
        cap = num(r["marketCap"])
        by = {day(b["t"]): round(b["c"], 2) for b in bars}
        stocks.append({"s": s, "name": meta.get("shortName") or r["companyName"].replace(" Common Stock", ""),
                       "sector": SECTOR_OF.get(s, "Other"), "cap": cap, "w": cap / tot_cap * 100 if cap and tot_cap else None,
                       "hl": s in HL_STOCKS, **m, "signal": signal(m), "closes": [by.get(k) for k in dkeys]})
        if s not in SECTOR_OF: warnings.append(f"ยังไม่ได้จัดกลุ่ม {s}")
    stocks.sort(key=lambda x: -(x["cap"] or 0))
    data["stocks"] = stocks
    data["dates"] = dates

    # breadth
    def share(f):
        v = [x[f] for x in stocks if x[f] is not None]
        return sum(v) / len(v) * 100 if v else None
    adv = sum(1 for x in stocks if (x["ch1d"] or 0) > 0)
    data["breadth"] = {
        "n": len(stocks), "adv": adv, "dec": len(stocks) - adv,
        "aboveE50": share("aboveE50"), "aboveE200": share("aboveE200"),
        "nearHigh": sum(1 for x in stocks if x["fromHigh"] is not None and x["fromHigh"] > -3),
        "rsiAvg": statistics.fmean(x["rsi"] for x in stocks if x["rsi"]),
        "overbought": sum(1 for x in stocks if (x["rsi"] or 0) >= 70), "oversold": sum(1 for x in stocks if x["rsi"] and x["rsi"] <= 30),
        "signals": {k: sum(1 for x in stocks if x["signal"] == k) for k in sorted({x["signal"] for x in stocks})},
    }
    # breadth ย้อนหลัง: % หุ้นเหนือ EMA50 ทุกวัน (ใช้ closes ที่เรียงตามวันดัชนี)
    hist = []
    for i in range(60, len(dates)):
        up = tot = 0
        for x in stocks:
            c = [v for v in x["closes"][:i + 1] if v is not None]
            if len(c) < 51: continue
            tot += 1; up += c[-1] > G.ema(c[-120:], 50)[-1]
        if tot: hist.append({"t": dates[i], "v": round(up / tot * 100, 1)})
    data["breadth"]["e50Series"] = hist

    # กลุ่มอุตสาหกรรม (ถ่วงด้วย market cap)
    secs = {}
    for x in stocks:
        g = secs.setdefault(x["sector"], {"sector": x["sector"], "cap": 0, "n": 0, "_w": {}})
        g["cap"] += x["cap"] or 0; g["n"] += 1
        for f in ("ch1d", "ch1m", "ytd"):
            if x[f] is not None:
                a = g["_w"].setdefault(f, [0, 0]); a[0] += x[f] * (x["cap"] or 0); a[1] += x["cap"] or 0
    for g in secs.values():
        for f, (s_, w) in g.pop("_w").items(): g[f] = s_ / w if w else None
    data["sectors"] = sorted(secs.values(), key=lambda g: -g["cap"])

    data["macro"] = G.macro_block()
    data["sources"].append({"name": "FRED (St. Louis Fed)", "what": "ดอกเบี้ย, yield curve, CPI, VIX, credit spread", "at": now})
    data["warnings"] = warnings
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False)
    print(json.dumps({"ok": True, "out": OUT, "stocks": len(stocks), "index": round(idx["px"], 2),
                      "adv/dec": f"{adv}/{len(stocks) - adv}", "warnings": warnings}, ensure_ascii=False))


if __name__ == "__main__":
    import stocks_model  # โมเดลรวม ndx/spx (มี state สำหรับคำนวณสด)
    stocks_model.main("ndx")
