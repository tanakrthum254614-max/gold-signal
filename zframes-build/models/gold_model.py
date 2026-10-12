"""zframes · gold model
ดึงข้อมูลทองคำ (XAU/USD) จากหลายแหล่ง → คำนวณตัวชี้วัด / ระดับราคา / สถานการณ์
แล้วเขียนผลลัพธ์ไปที่ models/out/gold.json  (ใช้แค่ standard library)

    python models/gold_model.py
"""
import csv, io, json, math, os, statistics, sys, time, urllib.request
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone, timedelta

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "models", "out", "gold.json")
MT5 = os.path.join(os.environ.get("APPDATA", ""), "MetaQuotes", "Terminal", "Common", "Files")
GOLD_SIGNAL = os.environ.get("GOLD_SIGNAL_DIR") or r"D:\โปรเจคทันเดอร์\Traeding"  # GitHub Actions: repo root with the data branch files
TH = timezone(timedelta(hours=7))
UA = {"User-Agent": "zframes/0.1"}
warnings = []


def get_json(url, timeout=15):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read().decode("utf-8"))


def _safe(fn, *a):
    try:
        return fn(*a)
    except Exception as e:
        warnings.append(f"{fn.__name__}({a[0]}) ล้มเหลว: {e}")
        return None


def read_json(path):
    try:
        with open(path, encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        # on the server (GitHub Actions) there is no MT5 terminal: its files are simply absent, not an error to show
        if not (os.environ.get("GOLD_SIGNAL_DIR") and path.startswith(MT5)):
            warnings.append(f"อ่าน {os.path.basename(path)} ไม่ได้: {e}")
        return None


def post_json(url, body, timeout=15):
    req = urllib.request.Request(url, data=json.dumps(body).encode(), headers={**UA, "content-type": "application/json"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read().decode("utf-8"))


FRED_CACHE = os.path.join(ROOT, "models", "cache", "fred")


def fred(sid, days=800):
    """อ่าน series จาก FRED (ไม่ต้องใช้ API key) → [{t, v}]
    FRED drops / stalls requests from busy servers (GitHub Actions): 2 quick tries, and if both fail the last good copy
    (models/cache/fred, kept between runs) — FRED series are daily or monthly, so a copy from yesterday is still right."""
    start = (datetime.now(TH) - timedelta(days=days)).strftime("%Y-%m-%d")
    req = urllib.request.Request(f"https://fred.stlouisfed.org/graph/fredgraph.csv?id={sid}&cosd={start}", headers=UA)
    path = os.path.join(FRED_CACHE, f"{sid}.json")
    try:
        for attempt in range(2):
            try:
                with urllib.request.urlopen(req, timeout=15) as r:
                    rows = list(csv.reader(io.StringIO(r.read().decode("utf-8"))))[1:]
                break
            except Exception:
                if attempt == 1: raise
                time.sleep(3)
        out = []
        for d, v in rows:
            if v not in ("", "."):
                out.append({"t": int(datetime.strptime(d, "%Y-%m-%d").replace(tzinfo=timezone.utc).timestamp() * 1000), "v": float(v)})
        if out:
            os.makedirs(FRED_CACHE, exist_ok=True)
            with open(path, "w", encoding="utf-8") as fh: json.dump(out, fh)
        return out
    except Exception:
        # last good copy from an earlier run, else the copy committed with the code (models/fred-seed, 13 Oct 2026)
        for p in (path, os.path.join(ROOT, "models", "fred-seed", f"{sid}.json")):
            if os.path.exists(p):
                print(f"fred {sid}: FRED did not answer — using the stored copy ({os.path.basename(os.path.dirname(p))})", file=sys.stderr)
                if not any("FRED ไม่ตอบ" in w for w in warnings): warnings.append("FRED ไม่ตอบ — ตัวเลขมหภาคบางตัวใช้ค่าล่าสุดที่เก็บไว้ (ดูวันที่บนการ์ด)")
                with open(p, encoding="utf-8") as fh: return json.load(fh)
        raise


def hl_daily(coin, days=400):
    now = int(time.time() * 1000)
    rows = post_json("https://api.hyperliquid.xyz/info", {"type": "candleSnapshot", "req": {
        "coin": coin, "interval": "1d", "startTime": now - days * 86400000, "endTime": now}})
    return [{"t": r["t"], "c": float(r["c"])} for r in rows]


def klines(interval, limit):
    # api.binance.com answers 451 to US servers (GitHub Actions) — data-api.binance.vision is Binance's public market-data host
    q = f"/api/v3/klines?symbol=PAXGUSDT&interval={interval}&limit={limit}"
    try:
        rows = get_json("https://api.binance.com" + q)
    except Exception:
        rows = get_json("https://data-api.binance.vision" + q)
    return [{"t": r[0], "o": float(r[1]), "h": float(r[2]), "l": float(r[3]), "c": float(r[4])} for r in rows]


# ---------- indicators ----------
def ema(vals, n):
    k, out, e = 2 / (n + 1), [], None
    for v in vals:
        e = v if e is None else v * k + e * (1 - k)
        out.append(e)
    return out


def rsi(vals, n=14):
    gains = losses = 0.0
    for i in range(1, n + 1):
        d = vals[i] - vals[i - 1]
        gains += max(d, 0); losses += max(-d, 0)
    ag, al = gains / n, losses / n
    for i in range(n + 1, len(vals)):
        d = vals[i] - vals[i - 1]
        ag = (ag * (n - 1) + max(d, 0)) / n
        al = (al * (n - 1) + max(-d, 0)) / n
    return 100.0 if al == 0 else 100 - 100 / (1 + ag / al)


def rsi_series(vals, n=14):
    """RSI ทุกแท่ง (Wilder) — ค่าแรกเริ่มที่แท่ง n"""
    out = [None] * len(vals)
    if len(vals) <= n: return out
    ag = sum(max(vals[i] - vals[i - 1], 0) for i in range(1, n + 1)) / n
    al = sum(max(vals[i - 1] - vals[i], 0) for i in range(1, n + 1)) / n
    out[n] = 100.0 if al == 0 else 100 - 100 / (1 + ag / al)
    for i in range(n + 1, len(vals)):
        d = vals[i] - vals[i - 1]
        ag = (ag * (n - 1) + max(d, 0)) / n
        al = (al * (n - 1) + max(-d, 0)) / n
        out[i] = 100.0 if al == 0 else 100 - 100 / (1 + ag / al)
    return out


def ta_state(cl):
    """สถานะตัวชี้วัด ณ ราคาปิดล่าสุดที่ปิดแล้ว — หน้าเว็บใช้ต่อยอดกับราคาสด (EMA/RSI/MACD แบบ realtime)"""
    if len(cl) < 30: return None
    e12, e26 = ema(cl, 12), ema(cl, 26)
    sig = ema([a - b for a, b in zip(e12, e26)], 9)[-1]
    n = 14
    ag = sum(max(cl[i] - cl[i - 1], 0) for i in range(1, n + 1)) / n
    al = sum(max(cl[i - 1] - cl[i], 0) for i in range(1, n + 1)) / n
    for i in range(n + 1, len(cl)):
        d = cl[i] - cl[i - 1]
        ag = (ag * (n - 1) + max(d, 0)) / n
        al = (al * (n - 1) + max(-d, 0)) / n
    r = lambda v: round(v, 6) if v is not None else None
    return {"prev": r(cl[-1]), "e20": r(ema(cl, 20)[-1]), "e50": r(ema(cl, 50)[-1]) if len(cl) >= 50 else None,
            "e200": r(ema(cl, 200)[-1]) if len(cl) >= 200 else None, "e12": r(e12[-1]), "e26": r(e26[-1]), "sig": r(sig),
            "ag": r(ag), "al": r(al)}


def yahoo_hist(sym, rng="2y"):
    """ราคารายวันจาก Yahoo (ใช้กับ DXY, yield ที่มีราคาสดใน stream)"""
    req = urllib.request.Request(f"https://query1.finance.yahoo.com/v8/finance/chart/{urllib.request.quote(sym)}?range={rng}&interval=1d",
                                 headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=20) as r:
        d = json.loads(r.read().decode("utf-8"))["chart"]["result"][0]
    return [{"t": t * 1000, "v": round(c, 4)} for t, c in zip(d["timestamp"], d["indicators"]["quote"][0]["close"]) if c is not None]


def corr(a, b):
    ma, mb = statistics.fmean(a), statistics.fmean(b)
    cov = sum((x - ma) * (y - mb) for x, y in zip(a, b))
    den = math.sqrt(sum((x - ma) ** 2 for x in a) * sum((y - mb) ** 2 for y in b))
    return cov / den if den else None


def atr(bars, n=14):
    trs = [max(b["h"] - b["l"], abs(b["h"] - p["c"]), abs(b["l"] - p["c"])) for p, b in zip(bars, bars[1:])]
    a = sum(trs[:n]) / n
    for t in trs[n:]:
        a = (a * (n - 1) + t) / n
    return a


def macd(vals):
    m = [a - b for a, b in zip(ema(vals, 12), ema(vals, 26))]
    s = ema(m, 9)
    return m[-1], s[-1], m[-1] - s[-1]


def swings(bars, k=3):
    """จุดกลับตัว (fractal) แบบง่าย"""
    hi, lo = [], []
    for i in range(k, len(bars) - k):
        win = bars[i - k:i + k + 1]
        if bars[i]["h"] == max(b["h"] for b in win): hi.append(bars[i]["h"])
        if bars[i]["l"] == min(b["l"] for b in win): lo.append(bars[i]["l"])
    return hi, lo


def cluster(levels, tol):
    levels = sorted(levels)
    groups = []
    for v in levels:
        if groups and v - groups[-1][-1] <= tol: groups[-1].append(v)
        else: groups.append([v])
    return [(sum(g) / len(g), len(g)) for g in groups]


def pct(a, b):
    return (a / b - 1) * 100 if b else None


def trend_block(name, bars):
    closes = [b["c"] for b in bars]
    e20, e50 = ema(closes, 20)[-1], ema(closes, 50)[-1]
    e200 = ema(closes, 200)[-1] if len(closes) >= 200 else None
    r = rsi(closes)
    m, s, h = macd(closes)
    px = closes[-1]
    score = 0
    score += 1 if px > e20 else -1
    score += 1 if e20 > e50 else -1
    if e200 is not None: score += 1 if px > e200 else -1
    score += 1 if h > 0 else -1
    score += 1 if r > 55 else (-1 if r < 45 else 0)
    return {"tf": name, "close": px, "ema20": e20, "ema50": e50, "ema200": e200, "rsi14": r,
            "macd": m, "macdSignal": s, "macdHist": h, "atr14": atr(bars), "score": score, "scoreMax": 5 if e200 is not None else 4}


# ---------- record of our own systems ----------
def signal_record():
    out = {}
    sig = read_json(os.path.join(GOLD_SIGNAL, "signals.json"))
    if sig:
        done = [s for s in sig.get("signals", []) if s.get("status") in ("win", "loss")]
        wins = sum(1 for s in done if s["status"] == "win")
        last = sig["signals"][-1] if sig.get("signals") else None
        out["daily"] = {"closed": len(done), "wins": wins, "losses": len(done) - wins,
                        "last": {k: last.get(k) for k in ("id", "side", "entry", "status", "trendScore", "priceAtSignal")} if last else None}
    ch = read_json(os.path.join(GOLD_SIGNAL, "chart-signals.json"))
    if ch:
        by = {}
        for t in ch.get("trades", []):
            d = by.setdefault(t.get("tf", "?"), {"n": 0, "wins": 0, "losses": 0, "open": 0, "pnl": 0.0})
            st = t.get("status")
            if st in ("win", "loss"):
                d["n"] += 1; d["wins" if st == "win" else "losses"] += 1; d["pnl"] += float(t.get("pnl") or 0)
            else:
                d["open"] += 1
        out["chart"] = by
    return out


def macro_block(d1=None):
    """ข้อมูลมหภาคจาก FRED (ใช้ร่วมกันทุก dashboard) — d1 = แท่งรายวันทองสำหรับ correlation กับ real yield"""
    ids = ["EFFR", "SOFR", "DFEDTARU", "DFEDTARL", "DGS3MO", "DGS2", "DGS5", "DGS10", "DGS30", "DFII10", "T10YIE",
           "DTWEXBGS", "BAMLH0A0HYM2", "BAMLC0A0CM", "CPIAUCSL", "VIXCLS", "SP500"]
    with ThreadPoolExecutor(4) as ex:
        F = dict(zip(ids, ex.map(lambda i: _safe(fred, i), ids)))
    miss = [i for i in ids if not F.get(i)]
    if miss: warnings.append("FRED ดึงไม่ได้: " + ", ".join(miss))

    def last(i): return F[i][-1] if F.get(i) else None
    def ago(i, days):
        s = F.get(i)
        if not s: return None
        cut = s[-1]["t"] - days * 86400000
        return next((p for p in reversed(s) if p["t"] <= cut), s[0])
    def tail(i, days):
        s = F.get(i) or []
        return [p for p in s if p["t"] >= s[-1]["t"] - days * 86400000] if s else []

    mac = {}
    if last("EFFR"):
        mac["rates"] = {"effr": last("EFFR"), "sofr": last("SOFR"), "tgtLo": last("DFEDTARL"), "tgtHi": last("DFEDTARU")}
    curve_ids = [("3M", "DGS3MO"), ("2Y", "DGS2"), ("5Y", "DGS5"), ("10Y", "DGS10"), ("30Y", "DGS30")]
    if all(F.get(i) for _, i in curve_ids):
        mac["curve"] = {"asOf": last("DGS10")["t"], "now": [{"label": l, "v": last(i)["v"]} for l, i in curve_ids],
                        "m1": [{"label": l, "v": ago(i, 30)["v"]} for l, i in curve_ids],
                        "s2s10bp": round((last("DGS10")["v"] - last("DGS2")["v"]) * 100)}
    for key, sid in (("real10", "DFII10"), ("be10", "T10YIE"), ("dollar", "DTWEXBGS"), ("hy", "BAMLH0A0HYM2"),
                     ("ig", "BAMLC0A0CM"), ("vix", "VIXCLS"), ("spx", "SP500"), ("y10", "DGS10")):
        if F.get(sid):
            a = ago(sid, 30)
            mac[key] = {"last": last(sid)["v"], "asOf": last(sid)["t"], "ch1m": last(sid)["v"] - a["v"],
                        "series": [{"t": p["t"], "v": p["v"]} for p in tail(sid, 730)]}
    if F.get("CPIAUCSL") and len(F["CPIAUCSL"]) > 13:
        c = F["CPIAUCSL"]
        yoy = [{"t": c[i]["t"], "v": round((c[i]["v"] / c[i - 12]["v"] - 1) * 100, 2)} for i in range(12, len(c))]
        mac["cpi"] = {"yoy": yoy[-1]["v"], "mom": round((c[-1]["v"] / c[-2]["v"] - 1) * 100, 2), "index": c[-1]["v"],
                      "asOf": c[-1]["t"], "series": yoy[-18:]}
    # ทองเทียบ real yield: ทองมักสวนทาง real yield — วัด correlation 1 ปีจากการเปลี่ยนแปลงรายสัปดาห์
    if d1 and F.get("DFII10"):
        gold_by_day = {datetime.fromtimestamp(b["t"] / 1000, timezone.utc).date(): b["c"] for b in d1}
        pairs = [(gold_by_day[d], p["v"]) for p in F["DFII10"][-260:]
                 if (d := datetime.fromtimestamp(p["t"] / 1000, timezone.utc).date()) in gold_by_day]
        wk = pairs[::5]
        if len(wk) > 20:
            mac["goldRealCorr"] = corr([math.log(b[0] / a[0]) for a, b in zip(wk, wk[1:])], [b[1] - a[1] for a, b in zip(wk, wk[1:])])
    dx = _safe(yahoo_hist, "DX-Y.NYB")
    if dx:
        mac["dxy"] = {"last": dx[-1]["v"], "asOf": dx[-1]["t"], "ch1m": dx[-1]["v"] - dx[max(0, len(dx) - 22)]["v"], "series": dx}
    return mac

def main():
    now = int(time.time() * 1000)
    data = {"asset": "XAUUSD", "name": "ทองคำ (XAU/USD)", "generatedAt": now, "sources": []}

    # 1) ราคาอ้างอิง spot
    spot = None
    try:
        g = get_json("https://api.gold-api.com/price/XAU")
        spot = float(g["price"])
        data["spot"] = {"price": spot, "updatedAt": g.get("updatedAt"), "source": "gold-api.com"}
        data["sources"].append({"name": "gold-api.com", "what": "ราคา XAU spot", "at": g.get("updatedAt")})
    except Exception as e:
        warnings.append(f"gold-api ใช้ไม่ได้: {e}")

    # 2) ราคาโบรกเกอร์จริงจาก MT5 (Exness)
    snap = read_json(os.path.join(MT5, "GoldObserver", "snapshot.json"))
    if snap and snap.get("bid"):
        age = (now - int(snap.get("asOf", 0))) / 1000
        data["broker"] = {"symbol": snap.get("symbol"), "bid": snap["bid"], "ask": snap["ask"],
                          "spread": round(snap["ask"] - snap["bid"], 3), "marketOpen": snap.get("marketOpen"),
                          "ageSec": round(age), "news": snap.get("news", [])}
        data["sources"].append({"name": "Exness MT5 (GoldObserver)", "what": "bid/ask จริงของโบรกเกอร์", "at": snap.get("asOf")})
        if age > 300: warnings.append(f"ราคา MT5 ไม่อัปเดตมา {round(age / 60)} นาที")
        if spot is None: spot = (snap["bid"] + snap["ask"]) / 2

    # 3) แท่งเทียน (PAXG ติดตามราคาทอง 1 ออนซ์)
    try:
        d1, h4, h1 = klines("1d", 400), klines("4h", 300), klines("1h", 300)
        data["sources"].append({"name": "Binance PAXGUSDT", "what": "แท่งเทียน 1D/4H/1H (PAXG = ทอง 1 ออนซ์ แบบ token)", "at": now})
    except Exception as e:
        print(json.dumps({"error": f"ดึงแท่งเทียนไม่ได้: {e}"}, ensure_ascii=False)); sys.exit(1)

    px = spot or d1[-1]["c"]
    basis = d1[-1]["c"] - px  # ส่วนต่าง PAXG กับ spot
    data["price"] = px
    data["paxgBasis"] = basis

    closes = [b["c"] for b in d1]

    def back(days):
        return closes[-1 - days] if len(closes) > days else None
    year_start = next((b["c"] for b in d1 if datetime.fromtimestamp(b["t"] / 1000, TH).year == datetime.now(TH).year), None)
    data["perf"] = {"1d": pct(closes[-1], back(1)), "1w": pct(closes[-1], back(7)), "1m": pct(closes[-1], back(30)),
                    "3m": pct(closes[-1], back(90)), "ytd": pct(closes[-1], year_start), "1y": pct(closes[-1], back(365))}
    hi52 = max(b["h"] for b in d1[-365:]); lo52 = min(b["l"] for b in d1[-365:])
    data["range52w"] = {"high": hi52 - basis, "low": lo52 - basis, "fromHighPct": pct(closes[-1], hi52)}

    # ความผันผวน
    rets = [math.log(b / a) for a, b in zip(closes[-91:], closes[-90:])]
    data["vol"] = {"realized30dAnnPct": statistics.pstdev(rets[-30:]) * math.sqrt(365) * 100,
                   "realized90dAnnPct": statistics.pstdev(rets) * math.sqrt(365) * 100}

    # แนวโน้มหลายกรอบเวลา (ปรับเป็นราคา spot ด้วย basis)
    tfs = [trend_block("1D", d1), trend_block("4H", h4), trend_block("1H", h1)]
    for t in tfs:
        for k in ("close", "ema20", "ema50", "ema200"):
            if t[k] is not None: t[k] -= basis
    data["trend"] = tfs
    data["trendTotal"] = sum(t["score"] for t in tfs)
    data["trendMax"] = sum(t["scoreMax"] for t in tfs)

    # แนวรับ/แนวต้าน จาก swing 4H + pivot รายวัน
    a_d = tfs[0]["atr14"]
    hs, ls = swings(h4[-180:])
    lv = cluster([v - basis for v in hs + ls], a_d * 0.25)
    res = sorted([(v, n) for v, n in lv if v > px], key=lambda x: x[0])[:3]
    sup = sorted([(v, n) for v, n in lv if v < px], key=lambda x: -x[0])[:3]
    y = d1[-2]
    P = (y["h"] + y["l"] + y["c"]) / 3 - basis
    data["levels"] = {
        "resistance": [{"price": v, "touches": n} for v, n in res],
        "support": [{"price": v, "touches": n} for v, n in sup],
        "pivot": {"P": P, "R1": 2 * P - (y["l"] - basis), "S1": 2 * P - (y["h"] - basis),
                  "R2": P + (y["h"] - y["l"]), "S2": P - (y["h"] - y["l"])},
        "atrDaily": a_d,
    }

    # สถานการณ์ 5 วันทำการ: ใช้การกระจายผลตอบแทน 5 วันในอดีต (2 ปี) แบบ empirical
    r5 = sorted(closes[i + 5] / closes[i] - 1 for i in range(max(0, len(closes) - 400), len(closes) - 5))
    q = lambda p: r5[min(len(r5) - 1, int(p * len(r5)))]
    up = sum(1 for r in r5 if r > 0) / len(r5)
    sc_q10, sc_q50, sc_q90 = q(0.10), q(0.50), q(0.90)
    data["scenarios5d"] = {
        "sample": len(r5), "upShare": up,
        "bear": {"q": 0.10, "ret": q(0.10), "price": px * (1 + q(0.10))},
        "base": {"q": 0.50, "ret": q(0.50), "price": px * (1 + q(0.50))},
        "bull": {"q": 0.90, "ret": q(0.90), "price": px * (1 + q(0.90))},
        "note": "ช่วง 10%–90% ของผลตอบแทน 5 วันในอดีต ไม่ใช่คำทำนาย",
    }

    # ราคาย่อ (sparkline) 120 วัน
    data["chart"] = [{"t": b["t"], "c": b["c"] - basis} for b in d1[-120:]]
    # series สำหรับกราฟเลือกช่วง 7D/1M/3M/1Y และ RSI รายวัน
    rs = rsi_series(closes)
    data["series"] = {
        "d1": [{"t": b["t"], "v": round(b["c"] - basis, 2)} for b in d1[-365:]],
        "h1": [{"t": b["t"], "v": round(b["c"] - basis, 2)} for b in h1[-24 * 7:]],
        "rsi": [{"t": b["t"], "v": round(r, 1)} for b, r in zip(d1, rs) if r is not None][-365:],
    }

    # ---------- สินทรัพย์เกี่ยวข้อง (Hyperliquid xyz) ----------
    peers = [("xyz:SILVER", "เงิน (Silver)"), ("xyz:PLATINUM", "แพลทินัม"), ("xyz:COPPER", "ทองแดง"),
             ("xyz:BRENTOIL", "น้ำมันเบรนท์"), ("xyz:SP500", "S&P 500"), ("xyz:XYZ100", "Nasdaq 100")]
    with ThreadPoolExecutor(6) as ex:
        res = dict(zip([p[0] for p in peers], ex.map(lambda p: _safe(hl_daily, p[0]), peers)))
    data["peers"] = []
    for coin, label in peers:
        s = res.get(coin)
        if not s or len(s) < 31:
            warnings.append(f"ไม่มีข้อมูลย้อนหลัง {coin}"); continue
        data["peers"].append({"coin": coin, "label": label, "last": s[-1]["c"], "ch1m": pct(s[-1]["c"], s[-31]["c"]),
                              "ch1w": pct(s[-1]["c"], s[-8]["c"])})
    data["sources"].append({"name": "Hyperliquid (xyz dex)", "what": "ราคาสด/แท่งเทียน ทอง เงิน โลหะ น้ำมัน S&P Nasdaq", "at": now})

    data["macro"] = macro_block(d1)
    data["sources"].append({"name": "FRED (St. Louis Fed)", "what": "ดอกเบี้ย, yield curve, real yield, CPI, VIX, credit spread, ดอลลาร์", "at": now})

    # ---------- สถานะสำหรับคำนวณสดบนหน้าเว็บ ----------
    # แท่ง 1D ของ Binance เป็นวัน UTC และแท่งสุดท้ายคือวันนี้ (ยังไม่ปิด) → state ใช้ถึงเมื่อวาน
    closed = [b["c"] - basis for b in d1[:-1]]
    ref = lambda days: closed[-days] if len(closed) >= days else None
    data["live"] = {
        "key": "xyz:GOLD", "prev": closed[-1], "state1d": ta_state(closed),
        "refs": {"1w": ref(7), "1m": ref(30), "3m": ref(90), "1y": ref(365),
                 "ytd": next((b["c"] - basis for b in d1 if datetime.fromtimestamp(b["t"] / 1000, TH).year == datetime.now(TH).year), None)},
        "hi52": hi52 - basis, "lo52": lo52 - basis,
        "q5": {"bear": sc_q10, "base": sc_q50, "bull": sc_q90},
    }

    data["record"] = signal_record()
    if data["record"]:
        data["sources"].append({"name": "Gold Signal (gold-signal-ten.vercel.app)", "what": "ผลสัญญาณที่บันทึกจริง", "at": now})

    ea = read_json(os.path.join(MT5, "GoldTraderLive", "status.json"))
    if ea:
        data["ea"] = {k: ea.get(k) for k in ("server", "symbol", "accountMode", "connected", "enabled", "phase", "reason",
                                              "balance", "equity", "todayPnl", "maxLots", "allowSell", "position", "asOf")}

    data["warnings"] = warnings
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=1)
    print(json.dumps({"ok": True, "out": OUT, "price": round(px, 2), "trend": f'{data["trendTotal"]}/{data["trendMax"]}',
                      "warnings": warnings}, ensure_ascii=False))


if __name__ == "__main__":
    main()
