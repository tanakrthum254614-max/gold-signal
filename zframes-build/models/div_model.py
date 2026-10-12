"""zframes · หุ้นปันผล (S&P 500 + Nasdaq-100)
รายชื่อ S&P 500 (Wikipedia) ∪ Nasdaq-100 (Nasdaq) → market cap (Nasdaq screener) → ประวัติปันผล 10 ปี + ราคารายเดือน (Yahoo)
→ วัน XD / วันจ่าย / payout / P/E (Yahoo quoteSummary, cache 20 ชม.) → ยิลด์, การเติบโต, จำนวนปีที่เพิ่มต่อเนื่อง, payout, Div score
เขียนผลไปที่ models/out/div.json

    python models/div_model.py
"""
import json, os, re, statistics, sys, time, urllib.request
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone, timedelta

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import gold_model as G
import ndx_model as N

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "models", "out", "div.json")
CACHE = os.path.join(ROOT, "models", "cache", "yahoo_div")
UA = N.UA
warnings = G.warnings
NOW = time.time()
YEAR = 365.25 * 86400

# กลุ่ม GICS ภาษาไทยสั้น ๆ
GICS_TH = {"Information Technology": "เทคโนโลยี", "Health Care": "สุขภาพ", "Financials": "การเงิน", "Consumer Discretionary": "สินค้าฟุ่มเฟือย",
           "Communication Services": "สื่อสาร", "Industrials": "อุตสาหกรรม", "Consumer Staples": "สินค้าจำเป็น", "Energy": "พลังงาน",
           "Utilities": "สาธารณูปโภค", "Real Estate": "อสังหาฯ (REIT)", "Materials": "วัสดุ"}
NDX_SECTOR_TO_GICS = {"Semiconductors": "Information Technology", "Software & Cloud": "Information Technology",
                      "Hardware & Storage": "Information Technology", "Internet & Media": "Communication Services",
                      "Consumer": "Consumer Discretionary", "Health care": "Health Care", "Industrials & Space": "Industrials",
                      "Energy & Utilities": "Utilities", "Financials": "Financials"}


def raw(url, timeout=30):
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=timeout) as r:
        return r.read().decode("utf-8")


def sp500():
    txt = raw("https://en.wikipedia.org/w/index.php?title=List_of_S%26P_500_companies&action=raw")
    tbl = txt[txt.find('id="constituents"'):]
    tbl = tbl[:tbl.find("\n|}")]
    out = []
    for chunk in tbl.split("\n|-")[1:]:
        cells = [c.strip() for c in "||".join(l.lstrip("|") for l in chunk.split("\n") if l.startswith("|")).split("||") if c.strip()]
        m = re.search(r"\{\{\s*\w*Symbol\s*\|\s*([A-Z.\-]+)", cells[0] if cells else "", re.I)
        if not m or len(cells) < 3: continue
        name = re.sub(r"\[\[(?:[^\]|]*\|)?([^\]]+)\]\]", r"\1", cells[1])
        out.append({"s": m.group(1).upper(), "name": name.strip(), "gics": cells[2].strip(" |")})
    return out


_crumb = {}


def yahoo_session():
    """Yahoo quoteSummary ต้องมี cookie + crumb (ขอครั้งเดียวต่อการรัน)"""
    if not _crumb:
        import http.cookiejar
        cj = http.cookiejar.CookieJar()
        op = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cj))
        op.addheaders = [("User-Agent", UA["User-Agent"])]
        try: op.open("https://fc.yahoo.com", timeout=15)
        except Exception: pass  # ตอบ 404 แต่ได้ cookie มาแล้ว
        _crumb["op"] = op
        _crumb["c"] = op.open("https://query1.finance.yahoo.com/v1/test/getcrumb", timeout=15).read().decode()
    return _crumb["op"], _crumb["c"]


def yahoo_div(sym):
    """เงินปันผลต่อปี (forward), วัน XD, วันจ่าย, payout, P/E จาก Yahoo (cache 20 ชม.)"""
    os.makedirs(CACHE, exist_ok=True)
    p = os.path.join(CACHE, sym + ".json")
    if os.path.exists(p) and NOW - os.path.getmtime(p) < 20 * 3600:
        with open(p, encoding="utf-8") as f: return json.load(f)
    op, c = yahoo_session()
    r = json.loads(op.open(f"https://query1.finance.yahoo.com/v10/finance/quoteSummary/{sym}?modules=summaryDetail,calendarEvents&crumb={urllib.request.quote(c)}", timeout=20).read())
    res = (r.get("quoteSummary", {}).get("result") or [{}])[0]
    sd, ce = res.get("summaryDetail") or {}, res.get("calendarEvents") or {}
    v = lambda d, k: (d.get(k) or {}).get("raw") if isinstance(d.get(k), dict) else None
    keep = {"fwd": v(sd, "dividendRate"), "payout": (v(sd, "payoutRatio") or 0) * 100 if v(sd, "payoutRatio") is not None else None,
            "pe": v(sd, "trailingPE"), "ex": v(ce, "exDividendDate") or v(sd, "exDividendDate"), "pay": v(ce, "dividendDate")}
    with open(p, "w", encoding="utf-8") as f: json.dump(keep, f)
    return keep


def yahoo_monthly(sym):
    """ราคารายเดือน + ประวัติปันผลทั้งหมด (ใช้ period1/period2 เพราะ range=max บังคับเป็นราย 3 เดือนและปันผลไม่ครบ)"""
    d = N.get(f"https://query1.finance.yahoo.com/v8/finance/chart/{sym.replace('.', '-')}?period1=-1000000000&period2={int(NOW)}&interval=1mo&events=div")["chart"]["result"][0]
    closes = [(t, c) for t, c in zip(d.get("timestamp", []), d["indicators"]["quote"][0]["close"]) if c is not None and t > NOW - 10.1 * YEAR]
    divs = sorted((v["date"], v["amount"]) for v in (d.get("events", {}).get("dividends") or {}).values())
    return d["meta"], closes, divs


EPOCH = datetime(1970, 1, 1, tzinfo=timezone.utc)
def year_of(ts):  # Windows แปลง timestamp ก่อนปี 1970 ด้วย fromtimestamp ไม่ได้
    return (EPOCH + timedelta(seconds=ts)).year


def analyse(meta, closes, divs, nd):
    px = meta.get("regularMarketPrice") or (closes[-1][1] if closes else None)
    if not px: return None
    # ตัดปันผลพิเศษและรายการซ้ำใน Yahoo: งวดที่มากกว่า 1.75 เท่าของค่ากลางงวดใกล้เคียง (±400 วัน) ไม่นับในยิลด์/การเติบโต/ความต่อเนื่อง
    # "พิเศษ" = งวดที่พุ่งเกิน 1.75 เท่าของงวดก่อนหน้า แล้วงวดถัดไปกลับลงมา (ถ้าสูงต่อ = เพิ่มอัตราจริง ไม่ใช่พิเศษ)
    fwd0 = (nd or {}).get("fwd")
    allv, reg = divs, []
    for i, (d, a) in enumerate(allv):
        prev = [b for _, b in allv[max(0, i - 3):i]]
        nxt = [b for _, b in allv[i + 1:i + 4]]
        spike = bool(prev) and a > 1.75 * statistics.median(prev)
        if spike and nxt: spike = a > 1.75 * statistics.median(nxt)
        elif spike and fwd0: spike = a > 1.5 * fwd0 / max(1, len([1 for e, _ in allv if e > d - YEAR]))
        if not spike: reg.append((d, a))
    special_amt = sum(a for d, a in allv if d > NOW - YEAR) - sum(a for d, a in reg if d > NOW - YEAR)
    divs = reg
    ttm_at = lambda t: sum(a for d, a in divs if t - YEAR < d <= t)
    ttm = ttm_at(NOW)
    last12 = [a for d, a in divs if d > NOW - YEAR]
    freq = len(last12)
    special = special_amt > 0
    ttm5 = ttm_at(NOW - 5 * YEAR)
    cagr5 = ((ttm / ttm5) ** (1 / 5) - 1) * 100 if ttm5 > 0 and ttm > 0 else None
    # ปีปฏิทินที่ครบแล้ว: นับปีที่ยอดรวม "เพิ่มขึ้น" ต่อเนื่องจากปีล่าสุดย้อนไป (ประวัติทั้งหมด, ไม่นับปีแรกที่อาจจ่ายไม่ครบ)
    yr = datetime.now(timezone.utc).year
    tot = {}
    pays = {}  # อัตราปันผลต่องวด "ค่ากลาง" ของแต่ละปี — ไม่เพี้ยนเมื่องวดเลื่อนข้ามปีหรือมีรายการแปลก 1 งวด
    for d, a in divs:
        tot[year_of(d)] = tot.get(year_of(d), 0) + a
        pays.setdefault(year_of(d), []).append(a)
    top = {k: statistics.median(v) for k, v in pays.items()}
    if tot: tot.pop(min(tot))
    streak = 0
    for y in range(yr - 1, yr - 71, -1):
        if y not in tot or (y - 1) not in tot: break
        rate_up = top[y] > top[y - 1] * 1.0001
        sum_up = tot[y] > tot[y - 1] * 1.001 and top[y] >= top[y - 1] * 0.9999
        if rate_up or sum_up: streak += 1
        else: break
    # ยิลด์เฉลี่ย 5 ปี (รายเดือน)
    hist = [ttm_at(t) / c * 100 for t, c in closes if t > NOW - 5 * YEAR and c and ttm_at(t) > 0]
    avg5 = statistics.fmean(hist) if len(hist) > 12 else None
    def back(years):
        cut = NOW - years * YEAR
        return next((c for t, c in reversed(closes) if t <= cut), None)
    def tr(years):
        p0 = back(years)
        if not p0: return None
        d = sum(a for t, a in divs if t > NOW - years * YEAR)
        return (((px + d) / p0) ** (1 / years) - 1) * 100
    nd = nd or {}
    fwd, payout, pe = nd.get("fwd") or None, nd.get("payout"), nd.get("pe")
    ts = lambda k: datetime.fromtimestamp(nd[k], timezone.utc) if nd.get(k) else None
    ex, pay = ts("ex"), ts("pay")
    today = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    nxt, est = None, False
    if ex and ex >= today: nxt = ex
    elif ex and freq:
        nxt, est = ex + timedelta(days=365 / freq), True
        while nxt < today: nxt += timedelta(days=365 / freq)
    y = ttm / px * 100
    fy = (fwd / px * 100) if fwd else None
    hi = meta.get("fiftyTwoWeekHigh")
    return {
        "px": px, "ttm": ttm, "specialAmt": round(special_amt, 4), "yield": y, "fwd": fwd, "fwdYield": fy, "freq": freq, "special": special,
        "cagr5": cagr5, "streak": streak, "avg5": avg5, "vsAvg": (y - avg5) if avg5 else None,
        "payout": payout, "pe": pe, "tr1": tr(1), "tr3": tr(3), "tr5": tr(5), "ch1y": G.pct(px, back(1)),
        "fromHigh": G.pct(px, hi) if hi else None, "hi52": hi, "lo52": meta.get("fiftyTwoWeekLow"),
        "exLast": ex.strftime("%Y-%m-%d") if ex else None, "exNext": nxt.strftime("%Y-%m-%d") if nxt else None, "exEst": est,
        "payDate": pay.strftime("%Y-%m-%d") if pay else None,
        "divHist": [{"t": int(d * 1000), "v": round(a, 4)} for d, a in allv if d > NOW - 10 * YEAR],
        "yearly": {str(k): round(v, 4) for k, v in sorted(tot.items()) if yr - 11 < k < yr},
        "monthly": [[int(t * 1000), round(c, 2)] for t, c in closes],
    }


def score(x):
    """Div score 0–100 (กฎตายตัว, ความต่อเนื่องเต็มที่ 10 ปี): ยิลด์ 30 + การเติบโต 25 + ความต่อเนื่อง 25 + ความปลอดภัย payout 20"""
    s = min((x["fwdYield"] or x["yield"]) / 6, 1) * 30
    s += min(max(x["cagr5"] or 0, 0) / 10, 1) * 25
    s += min(x["streak"] / 10, 1) * 25
    p = None if x["gics"] == "Real Estate" else x["payout"]  # REIT ใช้ FFO ไม่ใช่กำไรบัญชี → payout จาก EPS ใช้ไม่ได้
    s += 8 if p is None else 20 if p <= 60 else 12 if p <= 80 else 5 if p <= 100 else 0
    if p is not None and p > 100: s -= 15          # จ่ายเกินกำไร เสี่ยงถูกตัดปันผล
    if (x["cagr5"] or 0) < 0: s -= 10                 # ปันผล 5 ปีลดลง
    return max(0, round(s))


def flags(x):
    f = []
    if x["gics"] == "Real Estate": f.append("REIT (payout จากกำไรบัญชีสูงเกินจริง ควรดู FFO)")
    elif x["payout"] is not None and x["payout"] > 100: f.append("จ่ายเกินกำไร")
    if x["cagr5"] is not None and x["cagr5"] < 0: f.append("ปันผลลดลงใน 5 ปี")
    if x["special"]: f.append("มีปันผลพิเศษ (ไม่นับในยิลด์)")
    if x["vsAvg"] is not None and x["vsAvg"] > 1: f.append("ยิลด์สูงกว่าค่าเฉลี่ย 5 ปี")
    if x["streak"] >= 25: f.append(f"Dividend Aristocrat · เพิ่มปันผล {x['streak']} ปีติด")
    elif x["streak"] >= 10: f.append(f"เพิ่มปันผลต่อเนื่อง {x['streak']} ปี")
    return f


def main():
    now = int(NOW * 1000)
    data = {"asset": "DIV", "name": "หุ้นปันผล S&P 500 + Nasdaq-100", "generatedAt": now, "sources": []}
    spx = sp500()
    ndx = N.get("https://api.nasdaq.com/api/quote/list-type/nasdaq100")["data"]["data"]["rows"]
    data["sources"].append({"name": "Wikipedia", "what": f"รายชื่อ S&P 500 {len(spx)} ตัว + GICS sector", "at": now})
    data["sources"].append({"name": "Nasdaq.com", "what": f"รายชื่อ Nasdaq-100 {len(ndx)} ตัว + market cap (screener)", "at": now})
    if len(spx) < 480: warnings.append(f"อ่านรายชื่อ S&P 500 จาก Wikipedia ได้แค่ {len(spx)} ตัว")

    uni = {x["s"]: {"s": x["s"], "name": x["name"], "gics": x["gics"], "idx": ["SPX"]} for x in spx}
    for r in ndx:
        s = r["symbol"]
        if s in uni: uni[s]["idx"].append("NDX")
        else: uni[s] = {"s": s, "name": r["companyName"].replace(" Common Stock", ""), "gics": NDX_SECTOR_TO_GICS.get(N.SECTOR_OF.get(s, ""), "Information Technology"), "idx": ["NDX"]}
    scr = {r["symbol"]: r for r in N.get("https://api.nasdaq.com/api/screener/stocks?tableonly=true&limit=10000&download=true", 60)["data"]["rows"]}
    for x in uni.values():
        r = scr.get(x["s"].replace(".", "/"))
        x["cap"] = N.num(r["marketCap"]) if r and r.get("marketCap") else None

    syms = list(uni)
    with ThreadPoolExecutor(12) as ex:
        ym = dict(zip(syms, ex.map(lambda s: G._safe(yahoo_monthly, s), syms)))
    data["sources"].append({"name": "Yahoo Finance", "what": "ประวัติปันผล 10 ปี, ราคารายเดือน, เงินปันผลต่อปี, วัน XD/วันจ่าย, payout, P/E, ราคาสด", "at": now})
    payers = [s for s in syms if ym.get(s) and any(d > NOW - YEAR for d, _ in ym[s][2])]
    with ThreadPoolExecutor(16) as ex:
        yahoo_session()
        nd = dict(zip(payers, ex.map(lambda s: G._safe(yahoo_div, s.replace(".", "-")), payers)))

    rows = []
    for s in payers:
        meta, closes, divs = ym[s]
        a = G._safe(analyse, meta, closes, divs, nd.get(s))
        if not a: continue
        x = {**uni[s], "sector": GICS_TH.get(uni[s]["gics"], uni[s]["gics"]), **a}
        x["score"] = score(x)
        x["flags"] = flags(x)
        rows.append(x)
    rows.sort(key=lambda x: -(x["cap"] or 0))
    tot_cap = sum(x["cap"] or 0 for x in uni.values() if "SPX" in x["idx"])
    for x in rows: x["w"] = (x["cap"] or 0) / tot_cap * 100 if "SPX" in x["idx"] and tot_cap else None
    data["stocks"] = rows

    def med(L): L = [v for v in L if v is not None]; return statistics.median(L) if L else None
    sp_n, nd_n = sum("SPX" in x["idx"] for x in uni.values()), sum("NDX" in x["idx"] for x in uni.values())
    sp_rows = [x for x in rows if "SPX" in x["idx"]]
    nd_rows = [x for x in rows if "NDX" in x["idx"]]
    def idx_yield(idx):  # ยิลด์ทั้งดัชนีถ่วง market cap (หุ้นไม่จ่าย = 0)
        caps = [x for x in uni.values() if idx in x["idx"] and x["cap"]]
        ys = {x["s"]: x["yield"] for x in rows}
        tc = sum(x["cap"] for x in caps)
        return sum(ys.get(x["s"], 0) * x["cap"] for x in caps) / tc if tc else None
    data["summary"] = {
        "spxN": sp_n, "spxPayers": len(sp_rows), "ndxN": nd_n, "ndxPayers": len(nd_rows),
        "spxYield": idx_yield("SPX"), "ndxYield": idx_yield("NDX"),
        "medYield": med([x["yield"] for x in rows]), "medCagr": med([x["cagr5"] for x in rows]),
        "streak10": sum(1 for x in rows if x["streak"] >= 10), "aristocrats": sum(1 for x in rows if x["streak"] >= 25 and "SPX" in x["idx"]), "cuts": sum(1 for x in rows if x["cagr5"] is not None and x["cagr5"] < 0), "over100": sum(1 for x in rows if (x["payout"] or 0) > 100 and x["gics"] != "Real Estate"),
    }
    secs = {}
    for x in rows:
        g = secs.setdefault(x["sector"], {"sector": x["sector"], "n": 0, "ys": []})
        g["n"] += 1; g["ys"].append(x["yield"])
    data["sectors"] = sorted([{"sector": k, "n": v["n"], "medYield": statistics.median(v["ys"])} for k, v in secs.items()], key=lambda g: -g["medYield"])

    data["macro"] = G.macro_block()
    data["sources"].append({"name": "FRED (St. Louis Fed)", "what": "yield พันธบัตร, ดอกเบี้ย, CPI, VIX", "at": now})
    data["warnings"] = warnings
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as f: json.dump(data, f, ensure_ascii=False)
    print(json.dumps({"ok": True, "out": OUT, "universe": len(uni), "payers": len(rows), **{k: (round(v, 2) if isinstance(v, float) else v) for k, v in data["summary"].items()},
                      "warnings": warnings[:15], "nWarnings": len(warnings)}, ensure_ascii=False))


if __name__ == "__main__":
    main()
