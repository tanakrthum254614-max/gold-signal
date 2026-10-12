"""zframes · โมเดลหุ้นทั้งดัชนี (Nasdaq-100 หรือ S&P 500)
รายชื่อ → market cap → ราคารายวัน 1 ปีทุกตัว (Yahoo) → ตัวชี้วัดรายตัว + "state" ณ ราคาปิดล่าสุดที่ปิดแล้ว
ให้หน้าเว็บคำนวณ RSI / EMA / MACD / ผลตอบแทน / breadth ใหม่ทุก tick จากราคาสด

    python models/stocks_model.py ndx
    python models/stocks_model.py spx
"""
import json, math, os, statistics, sys, time
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import gold_model as G
import ndx_model as N

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
warnings = G.warnings
UNIVERSE = {
    "ndx": {"name": "Nasdaq-100", "index": "^NDX", "hl": "xyz:XYZ100"},
    "spx": {"name": "S&P 500", "index": "^GSPC", "hl": "xyz:SP500"},
}


def members(u):
    """[{s, name, sector, cap}]"""
    scr = {r["symbol"]: r for r in N.get("https://api.nasdaq.com/api/screener/stocks?tableonly=true&limit=10000&download=true", 60)["data"]["rows"]}
    cap = lambda s: N.num(scr[s.replace(".", "/")]["marketCap"]) if s.replace(".", "/") in scr and scr[s.replace(".", "/")].get("marketCap") else None
    if u == "ndx":
        rows = N.get("https://api.nasdaq.com/api/quote/list-type/nasdaq100")["data"]["data"]["rows"]
        return [{"s": r["symbol"], "name": r["companyName"].replace(" Common Stock", ""), "sector": N.SECTOR_OF.get(r["symbol"], "Other"),
                 "cap": N.num(r["marketCap"]) or cap(r["symbol"])} for r in rows]
    import div_model as D
    return [{"s": x["s"], "name": x["name"], "sector": D.GICS_TH.get(x["gics"], x["gics"]), "cap": cap(x["s"])} for x in D.sp500()]


def closed_bars(meta, bars):
    """ตัดแท่งของวันนี้ทิ้งถ้ายังไม่ปิด (แท่งรายวันมี timestamp = เวลาเปิดตลาดของวันนั้น)"""
    start = ((meta.get("currentTradingPeriod") or {}).get("regular") or {}).get("start")
    if start and bars and bars[-1]["t"] >= start * 1000: return bars[:-1]
    return bars


def main(u):
    cfg = UNIVERSE[u]
    now = int(time.time() * 1000)
    out_path = os.path.join(ROOT, "models", "out", f"{u}.json")
    data = {"asset": u.upper(), "universe": u, "name": cfg["name"], "generatedAt": now, "sources": []}
    mem = members(u)
    data["sources"].append({"name": "Wikipedia / Nasdaq.com", "what": f"รายชื่อ {cfg['name']} {len(mem)} ตัว + market cap", "at": now})

    syms = [m["s"] for m in mem] + [cfg["index"]]
    with ThreadPoolExecutor(12) as ex:
        res = dict(zip(syms, ex.map(lambda s: G._safe(N.yahoo_daily, s.replace(".", "-")), syms)))
    data["sources"].append({"name": "Yahoo Finance", "what": "ราคารายวัน 1 ปีทุกตัว + ราคาสด (stream)", "at": now})

    imeta, ibars = res.get(cfg["index"]) or (None, None)
    if not ibars:
        print(json.dumps({"error": "ดึงข้อมูลดัชนีไม่ได้"}, ensure_ascii=False)); sys.exit(1)
    idx = N.stock_metrics(cfg["index"], imeta, ibars)
    icl = closed_bars(imeta, ibars)
    idx.update({"symbol": cfg["index"], "hl": cfg["hl"], "st": G.ta_state([b["c"] for b in icl]),
                "series": [{"t": b["t"], "v": round(b["c"], 2)} for b in ibars],
                "rsiSeries": [{"t": b["t"], "v": round(v, 1)} for b, v in zip(ibars, G.rsi_series([b["c"] for b in ibars])) if v is not None]})
    idx["refs"] = refs(icl)
    data["index"] = idx

    dates = [b["t"] for b in ibars]
    day = lambda t: datetime.fromtimestamp(t / 1000, timezone.utc).date()
    dkeys = [day(t) for t in dates]
    tot_cap = sum(m["cap"] or 0 for m in mem)
    stocks = []
    for m in mem:
        got = res.get(m["s"])
        if not got or len(got[1]) < 5:
            warnings.append(f"ไม่มีราคาย้อนหลัง {m['s']}"); continue
        meta, bars = got
        x = N.stock_metrics(m["s"], meta, bars)
        cl = closed_bars(meta, bars)
        by = {day(b["t"]): round(b["c"], 2) for b in bars}
        stocks.append({**m, "name": meta.get("shortName") or m["name"], "w": m["cap"] / tot_cap * 100 if m["cap"] and tot_cap else None,
                       "hl": m["s"] in N.HL_STOCKS, **x, "signal": N.signal(x), "st": G.ta_state([b["c"] for b in cl]), "refs": refs(cl),
                       "closes": [by.get(k) for k in dkeys]})
    stocks.sort(key=lambda x: -(x["cap"] or 0))
    data["stocks"], data["dates"] = stocks, dates

    def share(f):
        v = [x[f] for x in stocks if x[f] is not None]
        return sum(v) / len(v) * 100 if v else None
    adv = sum(1 for x in stocks if (x["ch1d"] or 0) > 0)
    data["breadth"] = {"n": len(stocks), "adv": adv, "dec": len(stocks) - adv, "aboveE50": share("aboveE50"), "aboveE200": share("aboveE200"),
                       "nearHigh": sum(1 for x in stocks if x["fromHigh"] is not None and x["fromHigh"] > -3),
                       "overbought": sum(1 for x in stocks if (x["rsi"] or 0) >= 70), "oversold": sum(1 for x in stocks if x["rsi"] and x["rsi"] <= 30),
                       "signals": {k: sum(1 for x in stocks if x["signal"] == k) for k in sorted({x["signal"] for x in stocks})}}
    # % หุ้นเหนือ EMA50 ย้อนหลัง: คำนวณ EMA50 ของแต่ละตัวครั้งเดียวแล้วนับรายวัน
    up, tot = [0] * len(dates), [0] * len(dates)
    for x in stocks:
        c = x["closes"]
        e, k, n = None, 2 / 51, 0
        for i, v in enumerate(c):
            if v is None: continue
            e = v if e is None else v * k + e * (1 - k); n += 1
            if n >= 50: tot[i] += 1; up[i] += v > e
    data["breadth"]["e50Series"] = [{"t": dates[i], "v": round(up[i] / tot[i] * 100, 1)} for i in range(60, len(dates)) if tot[i]]

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
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False)
    print(json.dumps({"ok": True, "out": out_path, "stocks": len(stocks), "index": round(idx["px"], 2),
                      "adv/dec": f"{adv}/{len(stocks) - adv}", "warnings": warnings[:10], "nWarnings": len(warnings)}, ensure_ascii=False))


def refs(cl):
    """ราคาปิดอ้างอิงสำหรับคำนวณผลตอบแทนสด: 1 สัปดาห์ / 1 เดือน / 3 เดือน / ต้นปี / 1 ปี"""
    c = [b["c"] for b in cl]
    yr = datetime.now().year
    back = lambda k: c[-1 - k] if len(c) > k else None
    return {"1w": back(4), "1m": back(20), "3m": back(62), "1y": c[0] if len(c) > 200 else None,
            "ytd": next((b["c"] for b in cl if datetime.fromtimestamp(b["t"] / 1000, timezone.utc).year == yr), None)}


if __name__ == "__main__":
    main((sys.argv[1] if len(sys.argv) > 1 else "ndx").lower())
