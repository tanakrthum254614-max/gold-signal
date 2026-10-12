"""zframes · ประกอบ dashboard จากผลโมเดล + บันทึกวิเคราะห์

    python build_dashboard.py gold

อ่าน  models/out/<asset>.json   (ตัวเลข: จาก models/<asset>_model.py)
      notes/<asset>.json        (มุมมอง/เหตุผล: Claude เขียน)
เขียน dashboards/<asset>.json   (runtime อ่านไฟล์นี้ แล้วรีเฟรชหน้าเว็บเอง)
"""
import json, os, sys, time
from datetime import datetime, timezone, timedelta

ROOT = os.path.dirname(os.path.abspath(__file__))
TH = timezone(timedelta(hours=7))


def load(path):
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def money(v, d=2):
    return "—" if v is None else f"${v:,.{d}f}"


def sgn(v, d=2, unit="%"):
    return "—" if v is None else f"{v:+.{d}f}{unit}"


def tone(v):
    return "muted" if v is None else ("up" if v > 0 else "down" if v < 0 else "muted")


def when(ms, fmt="%d/%m %H:%M"):
    return datetime.fromtimestamp(ms / 1000, TH).strftime(fmt) if isinstance(ms, (int, float)) else (ms or "")


def day(ms):
    return when(ms, "%d/%m/%Y")


GOLD_COINS = [
    {"coin": "xyz:GOLD", "label": "ทองคำ", "color": "#fbbf24"},
    {"coin": "xyz:SILVER", "label": "เงิน", "color": "#cbd5e1"},
    {"coin": "xyz:PLATINUM", "label": "แพลทินัม", "color": "#c4b5fd"},
    {"coin": "xyz:COPPER", "label": "ทองแดง", "color": "#fb923c"},
    {"coin": "xyz:BRENTOIL", "label": "น้ำมันเบรนท์", "color": "#34d399"},
    {"coin": "xyz:SP500", "label": "S&P 500", "color": "#60a5fa"},
]
TICKER = GOLD_COINS + [{"coin": c, "label": l} for c, l in (
    ("xyz:PALLADIUM", "แพลเลเดียม"), ("xyz:CL", "น้ำมัน WTI"), ("xyz:NATGAS", "ก๊าซ"), ("xyz:XYZ100", "Nasdaq 100"),
    ("xyz:EUR", "EUR/USD"), ("xyz:JPY", "USD/JPY"), ("xyz:TLT", "TLT"), ("xyz:URANIUM", "ยูเรเนียม"))]


def macro_zone(m, pair=None, subtitle="ดอกเบี้ยแท้จริง ดอลลาร์ และความกลัวของตลาด — ปัจจัยที่ทองคำต้องสู้ด้วย"):
    """pair = {"name", "points", "fmt"} เส้นสินทรัพย์ที่จะวางคู่กับ real yield (ไม่ใส่ = ทองคำจาก m["series"])"""
    mac = m.get("macro", {})
    if pair is None and m.get("series", {}).get("d1"):
        pair = {"name": "ทองคำ", "points": m["series"]["d1"], "fmt": "usd", "color": "#fbbf24"}
    fr = []
    r = mac.get("rates")
    if r:
        tiles = []
        for key, label in (("y10", "10Y"), ("real10", "Real 10Y"), ("be10", "เงินเฟ้อคาด 10Y")):
            if mac.get(key):
                ch = mac[key]["ch1m"] * 100
                tiles.append({"label": label, "value": f"{mac[key]['last']:.2f}%", "sub": f"{ch:+.0f} bp / 1 เดือน",
                              "tone": "down" if (key != "be10" and ch > 0) else "muted"})
        fr.append({"type": "board", "title": "Rates board", "source": "NY Fed · FRED · yield สดจาก Yahoo", "calc": "macro.board", "rows": [
            {"label": "เป้าหมาย Fed funds", "sub": f"ณ {day(r['tgtHi']['t'])}", "value": f"{r['tgtLo']['v']:.2f}–{r['tgtHi']['v']:.2f}%"},
            {"label": "Effective fed funds (EFFR)", "sub": day(r["effr"]["t"]), "value": f"{r['effr']['v']:.2f}%"},
            {"label": "SOFR", "sub": day(r["sofr"]["t"]) if r.get("sofr") else "", "value": f"{r['sofr']['v']:.2f}%" if r.get("sofr") else "—"},
        ], "tiles": tiles, "footnote": "Real yield สูงขึ้น = ต้นทุนเงินจริงแพงขึ้น กดดันทอง (ไม่ให้ดอกเบี้ย) และหุ้นเติบโต"})
    c = mac.get("curve")
    if c:
        bp = c["s2s10bp"]
        fr.append({"type": "curve", "title": "Yield curve · สด", "source": "Yahoo (3M/5Y/10Y/30Y) · FRED (2Y)", "calc": "macro.curve", "headline": f"{bp:+d} bps",
                   "sub": f"2s10s · {'ปกติ (ชัน)' if bp > 0 else 'กลับหัว'} · {day(c['asOf'])}", "tone": "up" if bp > 0 else "down",
                   "now": c["now"], "nowLabel": "ล่าสุด", "prev": {"label": "1 เดือนก่อน", "points": c["m1"]}})
    if mac.get("real10") and pair:
        x0 = pair["points"][0]["t"]
        real = [p for p in mac["real10"]["series"] if p["t"] >= x0]
        cr = mac.get("goldRealCorr") if pair["name"] == "ทองคำ" else None
        fr.append({"type": "series", "title": f"{pair['name']} vs Real yield 10Y", "source": "FRED DFII10 · หัวการ์ดสด (10Y สด − เงินเฟ้อคาด)", "calc": "macro.real", "fmt": pair.get("fmt", "num"), "fmtR": "pct",
                   "headline": f"{mac['real10']['last']:.2f}%", "sub": "real yield 10 ปี (TIPS)",
                   "change": {"text": f"{mac['real10']['ch1m'] * 100:+.0f} bp / 1 เดือน", "tone": "down" if mac["real10"]["ch1m"] > 0 else "up"},
                   "chips": [{"label": "correlation 1 ปี", "value": f"{cr:+.2f}"}] if cr is not None else [],
                   "lines": [{"name": f"{pair['name']} (ซ้าย)", "color": pair.get("color", "#60a5fa"), "points": pair["points"]},
                             {"name": "Real yield 10Y (ขวา)", "color": "#c4b5fd", "axis": "right", "points": real}],
                   "ranges": [{"label": "3M", "days": 92}, {"label": "6M", "days": 183}, {"label": "1Y", "days": 366}],
                   "area": False, "footnote": "real yield สูง = ต้นทุนเงินแพง กดมูลค่าสินทรัพย์ระยะยาว (ทอง, หุ้นเติบโต)"})
    if mac.get("dxy"):
        d = mac["dxy"]
        fr.append({"type": "series", "title": "ดอลลาร์ (DXY) · สด", "source": "ICE · Yahoo stream", "calc": "macro.dxy", "headline": f"{d['last']:.2f}",
                   "sub": "ดัชนีดอลลาร์เทียบ 6 สกุลหลัก",
                   "change": {"text": f"{d['ch1m']:+.2f} / 1 เดือน", "tone": "down" if d["ch1m"] > 0 else "up"},
                   "lines": [{"name": "USD", "points": d["series"]}],
                   "ranges": [{"label": "3M", "days": 92}, {"label": "1Y", "days": 366}, {"label": "2Y", "days": 731}],
                   "footnote": "ดอลลาร์แข็ง (สีแดง) มักกดราคาทอง"})
    if mac.get("hy"):
        hy, ig = mac["hy"], mac.get("ig")
        fr.append({"type": "series", "title": "Credit spread", "source": "FRED (ICE BofA) · รายวัน ไม่มีแบบสด", "fmt": "pct",
                   "headline": f"{hy['last']:.2f}%", "sub": "High yield OAS",
                   "change": {"text": f"{hy['ch1m'] * 100:+.0f} bp / 1 เดือน", "tone": "down" if hy["ch1m"] > 0 else "up"},
                   "chips": [{"label": "Investment grade", "value": f"{ig['last']:.2f}%"}] if ig else [],
                   "lines": [{"name": "High yield", "color": "#60a5fa", "points": hy["series"]}] +
                            ([{"name": "Investment grade", "color": "#34d399", "points": ig["series"]}] if ig else []),
                   "ranges": [{"label": "1Y", "days": 366}, {"label": "2Y", "days": 731}], "area": False,
                   "footnote": "spread กว้างขึ้น = ตลาดกลัวความเสี่ยงผิดนัดชำระ มากขึ้น"})
    if mac.get("cpi"):
        cp = mac["cpi"]
        fr.append({"type": "series", "title": "Inflation pulse", "source": "BLS · FRED · รายเดือน ไม่มีแบบสด", "fmt": "pct",
                   "headline": f"{cp['yoy']:+.2f}%", "sub": f"CPI-U เทียบปีก่อน · {when(cp['asOf'], '%m/%Y')}",
                   "tone": "warn" if cp["yoy"] > 3 else "muted",
                   "chips": [{"label": "เดือนต่อเดือน", "value": f"{cp['mom']:+.2f}%"}, {"label": "ดัชนี", "value": f"{cp['index']:.1f}"}],
                   "lines": [{"name": "CPI YoY", "color": "#34d399", "points": cp["series"]}], "height": 110})
    if mac.get("spx"):
        s = mac["spx"]
        fr.append({"type": "series", "title": "Index level · สด", "source": "FRED SP500 · หัวการ์ดสดจาก ^GSPC", "calc": "macro.spx", "headline": f"{s['last']:,.2f}",
                   "sub": f"S&P 500 · {day(s['asOf'])}", "change": {"text": f"{s['ch1m']:+,.0f} / 1 เดือน", "tone": tone(s["ch1m"])},
                   "lines": [{"name": "S&P 500", "color": "#34d399", "points": s["series"]}],
                   "ranges": [{"label": "3M", "days": 92}, {"label": "1Y", "days": 366}], "height": 110})
    if mac.get("vix"):
        v = mac["vix"]
        fr.append({"type": "gauge", "title": "VIX gauge · สด", "source": "CBOE · Yahoo stream", "calc": "macro.vix", "value": v["last"], "min": 10, "max": 45,
                   "bands": [{"to": 15, "color": "#34d399", "name": "สงบ"}, {"to": 20, "color": "#a3e635", "name": "ปกติ"},
                             {"to": 30, "color": "#fbbf24", "name": "ตื่นตัว"}, {"to": 45, "color": "#fb7185", "name": "กลัว"}],
                   "sub": f"ความผันผวนคาดการณ์ S&P 30 วัน · {day(v['asOf'])}"})
    return {"id": "macro", "short": "Macro", "title": "Macro backdrop", "subtitle": subtitle, "frames": fr}


def build_gold(m, n):
    px = m["price"]
    p = m["perf"]
    lv = m["levels"]
    sc = m["scenarios5d"]
    br = m.get("broker")
    view = n.get("view", {})
    r52 = m["range52w"]

    # ---------- 1) Live ----------
    marks = [{"price": lv["pivot"]["R1"], "label": "R1", "tone": "down"}, {"price": lv["pivot"]["S1"], "label": "S1", "tone": "up"}]
    marks += [{"price": x["price"], "label": "R", "tone": "down"} for x in lv["resistance"][:1]]
    marks += [{"price": x["price"], "label": "S", "tone": "up"} for x in lv["support"][:1]]
    tiles = [{"label": "Open interest", "value": "—", "live": "oi", "sub": "Hyperliquid perp"},
             {"label": "มูลค่าซื้อขาย 24 ชม.", "value": "—", "live": "vol"},
             {"label": "Funding", "value": "—", "live": "funding"},
             {"label": "แกว่งเฉลี่ยต่อวัน (ATR)", "value": money(lv["atrDaily"], 0), "sub": f"ผันผวน 30 วัน {m['vol']['realized30dAnnPct']:.1f}%/ปี"}]
    if br:
        tiles.append({"label": f"Exness {br['symbol']}", "value": f"{br['bid']:,.2f}", "sub": f"spread {br['spread']:.2f}"})
    live = {"id": "live", "short": "Live", "title": "Live market — ราคาสด", "subtitle": "Hyperliquid xyz ผ่าน WebSocket · Exness MT5 ทันทีที่ราคาเปลี่ยน · แท่งเทียนขยับตามราคา", "frames": [
        {"type": "liveline", "span": 2, "title": "Price liveline", "source": "Hyperliquid", "coins": GOLD_COINS,
         "footnote": "% เปลี่ยนแปลงตั้งแต่ต้นเส้น (เริ่มจากแท่ง 1 นาที ~3 ชม.ก่อน แล้วต่อด้วยราคาสด)"},
        {"type": "quotes", "title": "Price ticker", "source": "Hyperliquid · เทียบเมื่อวาน", "coins": GOLD_COINS + [{"coin": "xyz:XYZ100", "label": "Nasdaq 100"}]},
        {"type": "candles", "span": 2, "title": "ทองคำ · แท่งเทียน", "source": "Hyperliquid xyz:GOLD", "coin": "xyz:GOLD",
         "intervals": ["1m", "5m", "15m", "1h"], "default": "5m", "marks": marks},
        {"type": "profile", "title": "Asset profile", "source": "XAU/USD", "coin": "xyz:GOLD", "name": "ทองคำ · Gold spot (XAU/USD)",
         "sub": "สินค้าโภคภัณฑ์ · โลหะมีค่า · ซื้อขาย 23 ชม./วัน", "price": px, "change": (p["1d"] or 0) / 100,
         "rangeLow": r52["low"], "rangeHigh": r52["high"], "tiles": tiles},
    ]}

    # ---------- 2) Cockpit ----------
    kpis = {"type": "kpis", "span": 3, "title": "Snapshot · สด", "source": "Hyperliquid + Exness + gold-api", "calc": "gold.kpis", "items": [
        {"label": "XAU/USD spot", "value": money(px), "sub": f"วันนี้ {sgn(p['1d'])}", "tone": tone(p["1d"])},
        {"label": "1 สัปดาห์", "value": sgn(p["1w"]), "tone": tone(p["1w"])},
        {"label": "1 เดือน", "value": sgn(p["1m"]), "tone": tone(p["1m"])},
        {"label": "ตั้งแต่ต้นปี", "value": sgn(p["ytd"]), "tone": tone(p["ytd"])},
        {"label": "ห่างจุดสูงสุด 52 สัปดาห์", "value": sgn(r52["fromHighPct"], 1),
         "sub": f"สูง {money(r52['high'], 0)} · ต่ำ {money(r52['low'], 0)}", "tone": "warn"},
        {"label": "แนวโน้มรวม", "value": f"{m['trendTotal']:+d}/{m['trendMax']}", "sub": "1D + 4H + 1H", "tone": tone(m["trendTotal"])},
    ]}
    snapshot = {"type": "snapshot", "span": 2, "title": "Cockpit — มุมมองรวม", "source": f"มุมมอง ณ {n.get('asOf', '')}", "calc": "gold.snapshot", "lines": [
        {"label": "สรุป", "text": n.get("headline", "")},
        {"label": "จุดยืน", "text": view.get("stance", "")},
        {"label": "กรอบ 5 วัน", "text": f"{money(sc['bear']['price'], 0)} – {money(sc['bull']['price'], 0)} (ช่วง 10–90% จากอดีต)"},
    ], "footnote": n.get("summary", "")}
    scorecard = {"type": "scorecard", "title": "Investment view (1–5)", "source": "Model + Claude", "rows": view.get("scores", []),
                 "confidence": view.get("confidence", "กลาง"), "footnote": "ไม่ใช่คำแนะนำการลงทุน"}
    scen = {"type": "scenarios", "span": 2, "title": "Scenarios · 5 วันทำการ (จากราคาสด)", "source": f"empirical {sc['sample']} ช่วง", "calc": "gold.scen", "horizon": "5 วัน",
            "cases": [{"name": k.capitalize(), "price": sc[k]["price"], "ret": sc[k]["ret"],
                       **({"prob": n["probs"][k]} if k in n.get("probs", {}) else {}), "drivers": n.get("drivers", {}).get(k, [])}
                      for k in ("bear", "base", "bull")],
            "footnote": f"ราคาเป้าจากการกระจายผลตอบแทน 5 วันในอดีต · ขึ้น {sc['upShare'] * 100:.0f}% ของครั้ง"}
    levels = {"type": "levels", "title": "แนวรับ / แนวต้าน · สด", "source": "swing 4H + pivot", "calc": "gold.levels", "current": px,
              "resistance": [{"price": r["price"], "label": f"swing 4H ×{r['touches']}"} for r in lv["resistance"]],
              "support": [{"price": s["price"], "label": f"swing 4H ×{s['touches']}"} for s in lv["support"]],
              "footnote": f"Pivot วันนี้ P {lv['pivot']['P']:,.0f} · R1 {lv['pivot']['R1']:,.0f} · S1 {lv['pivot']['S1']:,.0f}"}
    thesis = {"type": "thesis", "span": 2, "title": "Thesis & เงื่อนไขเปลี่ยนใจ", "items": n.get("thesis", []), "changeIf": n.get("changeIf", [])}
    action = {"type": "action", "title": "Action matrix · ตรวจเงื่อนไขสด", "source": "ไม่ใช่คำแนะนำ", "calc": "actions", "rows": n.get("actions", [])}
    cockpit = {"id": "cockpit", "short": "Cockpit", "title": "Fund manager cockpit — ทองคำ",
               "subtitle": "สรุป 3 นาที: snapshot · view · scenarios · levels · thesis · actions",
               "frames": [kpis, snapshot, scorecard, scen, levels, thesis, action]}

    # ---------- 3) Technicals ----------
    S = m["series"]
    rsi_now = S["rsi"][-1]["v"]
    rsi_state = "Overbought" if rsi_now >= 70 else "Oversold" if rsi_now <= 30 else "Neutral"
    peers = [{"label": "ทองคำ", "value": p["1m"], "display": sgn(p["1m"], 1), "color": "#fbbf24"}]
    peers += [{"label": x["label"], "value": x["ch1m"], "display": sgn(x["ch1m"], 1)} for x in m.get("peers", [])]
    tech = {"id": "tech", "short": "Technicals", "title": "Price & technicals", "subtitle": "กราฟราคา · RSI · แนวโน้มหลายกรอบเวลา · เทียบสินทรัพย์เกี่ยวข้อง", "frames": [
        {"type": "series", "title": "RSI 14 · รายวัน", "source": "คำนวณจากแท่ง 1D · สด", "calc": "gold.rsi", "headline": f"{rsi_now:.0f}",
         "sub": rsi_state, "tone": "down" if rsi_now >= 70 else "up" if rsi_now <= 30 else None, "decimals": 0,
         "lines": [{"name": "RSI", "color": "#c4b5fd", "points": S["rsi"]}],
         "refs": [{"v": 70, "label": "70", "color": "#fb7185"}, {"v": 30, "label": "30", "color": "#34d399"}],
         "ranges": [{"label": "90D", "days": 90}, {"label": "180D", "days": 180}, {"label": "1Y", "days": 366}], "defaultRange": "180D", "height": 140},
        {"type": "series", "span": 2, "title": "XAU/USD · สด", "source": "Binance PAXG (ปรับเป็น spot) · จุดสุดท้ายสด", "calc": "gold.price", "fmt": "usd",
         "headline": money(px), "change": {"text": f"1 ปี {sgn(p['1y'])}", "tone": tone(p["1y"])},
         "lines": [{"name": "XAU/USD", "color": "#60a5fa", "points": S["d1"]}],
         "refs": [{"v": lv["resistance"][0]["price"], "label": "R", "color": "#fb7185"}] if lv["resistance"] else [],
         "ranges": [{"label": "7D", "lines": [{"name": "XAU/USD 1H", "color": "#60a5fa", "points": S["h1"]}]},
                    {"label": "1M", "days": 31}, {"label": "3M", "days": 92}, {"label": "1Y", "days": 366}], "defaultRange": "3M"},
        {"type": "trend", "title": "แนวโน้มหลายกรอบเวลา · สด", "source": "EMA · RSI · MACD จากแท่ง Hyperliquid + ราคาสด", "calc": "gold.trend", "rows": [
            {"tf": t["tf"], "score": t["score"], "max": t["scoreMax"], "rsi": round(t["rsi14"], 1),
             "note": f"EMA20 {t['ema20']:,.0f} · EMA50 {t['ema50']:,.0f}" + (f" · EMA200 {t['ema200']:,.0f}" if t["ema200"] else "")}
            for t in m["trend"]]},
        {"type": "bars", "title": "ผลตอบแทน 1 เดือน เทียบสินทรัพย์ · สด", "source": "Hyperliquid", "calc": "gold.peers", "rows": peers},
        {"type": "kpis", "title": "ความผันผวน", "source": "realized", "items": [
            {"label": "30 วัน (ต่อปี)", "value": f"{m['vol']['realized30dAnnPct']:.1f}%"},
            {"label": "90 วัน (ต่อปี)", "value": f"{m['vol']['realized90dAnnPct']:.1f}%"},
            {"label": "ATR รายวัน", "value": money(lv["atrDaily"], 0), "tone": "muted"}]},
    ]}

    # ---------- 5) Context ----------
    ctx = []
    if n.get("macro"):
        ctx.append({"type": "list", "span": 2, "title": "ปัจจัยมหภาค / ข่าว", "source": "สรุปโดย Claude", "items": n["macro"]})
    if br and br.get("news"):
        ctx.append({"type": "list", "title": "ปฏิทินข่าวจาก MT5", "items": [str(x) for x in br["news"]][:8]})
    rec = m.get("record", {})
    rows = []
    if rec.get("daily"):
        d = rec["daily"]
        rows.append({"system": "สัญญาณรายวัน 07:00", "closed": d["closed"], "wins": d["wins"], "losses": d["losses"]})
    for tf, d in sorted(rec.get("chart", {}).items()):
        rows.append({"system": f"สัญญาณกราฟ {tf}", "closed": d["n"], "wins": d["wins"], "losses": d["losses"],
                     "open": d["open"], "pnl": round(d["pnl"], 2)})
    if rows:
        ctx.append({"type": "record", "title": "ผลจริงของ Gold Signal", "source": "signals.json", "rows": rows,
                    "footnote": "จำนวนยังน้อย อย่าอ่านเป็นอัตราชนะระยะยาว"})
    ea = m.get("ea")
    if ea:
        bad = ea.get("phase") == "blocked"
        ctx.append({"type": "status", "title": "EA GoldTraderLive", "source": "Exness MT5", "rows": [
            {"label": "บัญชี", "value": f"{ea.get('server')} · {ea.get('accountMode')}"},
            {"label": "สถานะ", "value": f"{ea.get('phase')} — {ea.get('reason') or ''}", "tone": "down" if bad else "up"},
            {"label": "Balance / Equity", "value": f"{money(ea.get('balance'))} / {money(ea.get('equity'))}",
             "tone": "down" if not ea.get("equity") else "muted"},
            {"label": "กำไรวันนี้", "value": money(ea.get("todayPnl")), "tone": tone(ea.get("todayPnl"))},
            {"label": "ไม้ที่เปิดอยู่", "value": "ไม่มี" if not ea.get("position") else json.dumps(ea["position"], ensure_ascii=False)},
            {"label": "อัปเดต", "value": when(ea.get("asOf"))},
        ]})
    srcs = [{"name": s["name"], "what": s["what"], "at": when(s.get("at"))} for s in m["sources"]] + n.get("sources", [])
    ctx.append({"type": "sources", "title": "แหล่งข้อมูล", "items": srcs})
    if m.get("warnings"):
        ctx.append({"type": "list", "title": "⚠️ คำเตือนข้อมูล", "items": m["warnings"]})

    zones = [live, cockpit, tech, macro_zone(m),
             {"id": "context", "short": "Context", "title": "Context & systems", "subtitle": "ข่าว · ผลงานจริง · บัญชี · แหล่งข้อมูล", "frames": ctx}]
    lv_ = m["levels"]
    gold_live = {**m["live"], "levels": {"R": [r["price"] for r in lv_["resistance"]], "S": [x["price"] for x in lv_["support"]], "pivot": lv_["pivot"]},
                 "peers": [{"coin": x["coin"], "label": x["label"], "ref": x["last"] / (1 + x["ch1m"] / 100)} for x in m.get("peers", [])]}
    live_keys = [c["coin"] for c in GOLD_COINS] + [t["coin"] for t in TICKER] + [x["coin"] for x in m.get("peers", [])] + \
                ["xyz:GOLD", "spot:XAU", "mt5:gold", "ea"] + MACRO_LIVE
    return {"id": "gold", "kind": "gold", "asset": "XAUUSD", "title": "GOLD — Fund Manager Research Terminal",
            "gold": gold_live, "macroLive": macro_live(m), "liveKeys": live_keys,
            "subtitle": "XAU/USD · Cockpit + ราคาสด Hyperliquid + มหภาค FRED + Exness MT5 + ผลจริง Gold Signal",
            "generatedAt": int(time.time() * 1000), "modelAt": m["generatedAt"], "basePrice": px,
            "live": "gold", "ticker": TICKER, "zones": zones}


def reading(x):
    """สรุปรายตัวเป็นภาษาไทยจากตัวเลขในโมเดล (ทุกตัวใช้กฎเดียวกัน)"""
    parts = [x["signal"] + ":"]
    if x["aboveE200"] is not None:
        parts.append(f"ราคา{'เหนือ' if x['aboveE200'] else 'ต่ำกว่า'}เส้น EMA200" +
                     (f" และ{'เหนือ' if x['aboveE50'] else 'ต่ำกว่า'} EMA50" if x["aboveE50"] is not None else ""))
    elif x["aboveE50"] is not None:
        parts.append(f"ราคา{'เหนือ' if x['aboveE50'] else 'ต่ำกว่า'} EMA50 (ประวัติยังไม่ถึง 200 วัน)")
    else:
        parts.append(f"หุ้นใหม่ มีข้อมูลแค่ {x['days']} วัน")
    if x["rsi"] is not None:
        st = "ร้อนแรง ระวังย่อ" if x["rsi"] >= 70 else "ขายมากเกิน อาจเด้ง" if x["rsi"] <= 30 else "ปกติ"
        parts.append(f"RSI {x['rsi']:.0f} ({st})")
    for k, l in (("ch1m", "1 เดือน"), ("ytd", "ตั้งแต่ต้นปี")):
        if x[k] is not None: parts.append(f"{l} {x[k]:+.1f}%")
    if x["fromHigh"] is not None:
        parts.append("ใกล้จุดสูงสุด 52 สัปดาห์" if x["fromHigh"] > -3 else f"ต่ำกว่าจุดสูงสุด 52 สัปดาห์ {abs(x['fromHigh']):.0f}%")
    if x["vol30"]: parts.append(f"ผันผวน {x['vol30']:.0f}%/ปี")
    return parts[0] + " " + " · ".join(parts[1:])


INDEX_CFG = {
    "ndx": {"name": "Nasdaq-100", "upper": "NASDAQ-100", "sym": "^NDX", "hl": "xyz:XYZ100", "hlLabel": "Nasdaq 100",
            "other": ("xyz:SP500", "S&P 500"), "src": "Nasdaq · Yahoo"},
    "spx": {"name": "S&P 500", "upper": "S&P 500", "sym": "^GSPC", "hl": "xyz:SP500", "hlLabel": "S&P 500",
            "other": ("xyz:XYZ100", "Nasdaq 100"), "src": "Wikipedia · Yahoo"},
}
HL_SET = set("AAPL AMAT AMD AMZN ARM ASML AVGO COST CRWD GOOGL INTC LITE LRCX META MRNA MRVL MSFT MSTR MU NBIS NFLX NVDA PLTR QCOM TSLA WDC CRWV SNDK ORCL IBM CVX LLY DELL COIN HOOD".split())  # หุ้นที่มี perp บน Hyperliquid xyz
MACRO_LIVE = ["^TNX", "^IRX", "^FVX", "^TYX", "^VIX", "DX-Y.NYB", "^GSPC", "^NDX"]


def build_index(m, n):
    u = m.get("universe", "ndx")
    C = INDEX_CFG[u]
    I, B, st = m["index"], m["breadth"], m["stocks"]
    view = n.get("view", {})
    syms = [x["s"] for x in st]
    for i, x in enumerate(st): x["rank"] = i + 1
    hl_list = [x for x in st if x["hl"]][:8]

    # ---------- 1) Live ----------
    coins = [{"coin": C["hl"], "label": C["hlLabel"], "color": "#c4b5fd"}, {"coin": C["other"][0], "label": C["other"][1], "color": "#60a5fa"}]
    coins += [{"coin": "xyz:" + x["s"], "label": x["s"]} for x in hl_list[:4]]
    live = {"id": "live", "short": "Live", "title": f"Live market — {C['name']}",
            "subtitle": "ราคาทุกตัวแบบ tick-by-tick (Yahoo stream รวมก่อนเปิด/หลังปิด/กลางคืน) · ดัชนีและหุ้นใหญ่ 24 ชม. บน Hyperliquid WebSocket", "frames": [
        {"type": "liveline", "span": 2, "title": "Price liveline · 24 ชม.", "source": "Hyperliquid", "coins": coins,
         "footnote": "ใช้ได้แม้ตลาดสหรัฐฯ ปิด (perp ติดตามราคาหุ้น/ดัชนี ซื้อขาย 24/7)"},
        {"type": "movers", "title": "ขึ้น/ลงแรงสุด · สด", "source": "Yahoo stream", "count": 6},
        {"type": "candles", "span": 2, "title": f"{C['hlLabel']} · แท่งเทียน 24 ชม.", "source": f"Hyperliquid {C['hl']}", "coin": C["hl"],
         "intervals": ["1m", "5m", "15m", "1h"], "default": "15m"},
        {"type": "profile", "title": C["name"], "source": f"{C['sym']} · สดจาก {C['hl']}", "coin": C["hl"], "name": f"{C['name']} Index ({C['sym']})",
         "sub": f"{B['n']} บริษัท · ราคาปิดล่าสุด {I['px']:,.2f}", "price": I["px"], "change": (I["ch1d"] or 0) / 100,
         "rangeLow": I["lo52"], "rangeHigh": I["hi52"], "tiles": [
            {"label": "Open interest (perp)", "value": "—", "live": "oi"}, {"label": "มูลค่าซื้อขาย 24 ชม.", "value": "—", "live": "vol"},
            {"label": "RSI 14 รายวัน", "value": f"{I['rsi']:.0f}"}, {"label": "ห่างจุดสูงสุด", "value": sgn(I["fromHigh"], 1)}]},
    ]}

    heatmap = {"id": "heatmap", "short": "Heatmap", "title": f"Heatmap — ทั้ง {len(st)} ตัว", "subtitle": "จัดกลุ่มตามอุตสาหกรรม · ขนาดตาม market cap · ทุกโหมดคำนวณจากราคาสด",
               "frames": [{"type": "heatmap", "span": 3, "title": f"{C['name']} heatmap", "source": C["src"], "items": syms, "metric": "d",
                           "height": 600 if len(st) < 200 else 860}]}

    # ---------- 3) Cockpit (สด) ----------
    kpis = {"type": "kpis", "span": 3, "title": "Snapshot · สด", "calc": "idx.kpis", "items": []}
    snapshot = {"type": "snapshot", "span": 2, "title": "Cockpit — มุมมองรวม", "source": f"มุมมอง ณ {n.get('asOf', '')}", "calc": "idx.snapshot",
                "lines": [{"label": "สรุป", "text": n.get("headline", "")}, {"label": "จุดยืน", "text": view.get("stance", "")}], "footnote": n.get("summary", "")}
    scorecard = {"type": "scorecard", "title": "Investment view (1–5)", "source": "Model + Claude", "rows": view.get("scores", []),
                 "confidence": view.get("confidence", "กลาง"), "footnote": "ไม่ใช่คำแนะนำการลงทุน"}
    cockpit = {"id": "cockpit", "short": "Cockpit", "title": f"Fund manager cockpit — {C['name']}",
               "subtitle": "ทุกตัวเลขคำนวณใหม่ทุก tick: ดัชนี · breadth · กลุ่มอุตสาหกรรม · RSI · เงื่อนไข action", "frames": [
        kpis, snapshot, scorecard,
        {"type": "series", "span": 2, "title": f"{C['name']} ({C['sym']})", "source": "Yahoo · จุดสุดท้ายสด", "calc": "idx.price", "headline": f"{I['px']:,.2f}",
         "change": {"text": f"1 ปี {sgn(I['ch1y'])}", "tone": tone(I["ch1y"])},
         "lines": [{"name": C["sym"], "color": "#60a5fa", "points": I["series"]}],
         "ranges": [{"label": "1M", "days": 31}, {"label": "3M", "days": 92}, {"label": "6M", "days": 183}, {"label": "1Y", "days": 366}], "defaultRange": "6M"},
        {"type": "bars", "title": "กลุ่มอุตสาหกรรม · วันนี้ (สด)", "source": "ถ่วงด้วย market cap", "calc": "idx.sectors", "metric": "ch1d", "rows": []},
        {"type": "series", "title": "Breadth: % หุ้นเหนือ EMA50", "source": f"คำนวณจาก {len(st)} ตัว · สด", "calc": "idx.breadth", "fmt": "pct", "decimals": 0,
         "headline": f"{B['aboveE50']:.0f}%", "lines": [{"name": "% เหนือ EMA50", "color": "#34d399", "points": B["e50Series"]}],
         "refs": [{"v": 50, "label": "50%"}], "height": 130, "footnote": "ดัชนีขึ้นแต่เส้นนี้ลง = ขึ้นด้วยหุ้นไม่กี่ตัว"},
        {"type": "series", "title": "RSI 14 · ดัชนี", "source": f"{C['sym']} รายวัน · สด", "calc": "idx.rsi", "headline": f"{I['rsi']:.0f}", "decimals": 0,
         "lines": [{"name": "RSI", "color": "#c4b5fd", "points": I["rsiSeries"]}],
         "refs": [{"v": 70, "label": "70", "color": "#fb7185"}, {"v": 30, "label": "30", "color": "#34d399"}],
         "ranges": [{"label": "90D", "days": 90}, {"label": "180D", "days": 180}, {"label": "1Y", "days": 366}], "defaultRange": "180D", "height": 130},
        {"type": "thesis", "span": 2, "title": "Thesis & เงื่อนไขเปลี่ยนใจ", "items": n.get("thesis", []), "changeIf": n.get("changeIf", [])},
        {"type": "action", "title": "Action matrix · ตรวจเงื่อนไขสด", "source": "ไม่ใช่คำแนะนำ", "calc": "actions", "rows": n.get("actions", [])},
    ]}

    table = {"id": "stocks", "short": "หุ้นทุกตัว", "title": "หุ้นทุกตัว — วิเคราะห์รายตัวแบบสด",
             "subtitle": "ทุกคอลัมน์ (ราคา, %, RSI, เทรนด์, สัญญาณ, จากจุดสูงสุด) คำนวณใหม่ทุก tick · คลิกหัวคอลัมน์เพื่อเรียง · คลิกแถวเพื่อดูรายตัว",
             "frames": [{"type": "stocktable", "span": 3, "title": f"{C['name']} · {len(st)} ตัว", "source": f"{C['src']} · Hyperliquid", "items": syms,
                         "footnote": "น้ำหนัก = สัดส่วน market cap โดยประมาณ · คอลัมน์ 24 ชม. = ราคา perp บน Hyperliquid (มีเฉพาะบางตัว)"}]}

    S_ = lambda title, **kw: {"type": "screen", "title": title, "source": "สด", **kw}
    screens = {"id": "screens", "short": "Screens", "title": "Screens — คัดหุ้นสด", "subtitle": "คัดใหม่ทุก tick จากราคาสด · คลิกชื่อเพื่อดูรายละเอียด", "frames": [
        S_("ขึ้นแรงสุดวันนี้", metric="d", n=10),
        S_("ลงแรงสุดวันนี้", metric="d", n=10, asc=True),
        S_("ผู้นำ 1 เดือน", metric="ch1m", n=10),
        S_("ผู้ตาม 1 เดือน", metric="ch1m", n=10, asc=True),
        S_("ผู้นำตั้งแต่ต้นปี", metric="ytd", n=10),
        S_("RSI ≥ 70 (ร้อนแรง)", metric="rsi", n=15, filter="ob", mode="list"),
        S_("RSI ≤ 30 (ขายมากเกิน)", metric="rsi", n=15, asc=True, filter="os", mode="list"),
        S_("ใกล้จุดสูงสุด 52 สัปดาห์ (≤3%)", metric="fromHigh", n=15, filter="nearHigh", mode="list"),
        S_("ลงจากจุดสูงสุดมากที่สุด", metric="fromHigh", n=10, asc=True),
        {"type": "bars", "title": "สัญญาณรายตัว · สด", "source": "จำนวนหุ้น", "calc": "idx.signals", "rows": []},
        {"type": "bars", "title": "กลุ่มอุตสาหกรรม · 1 เดือน (สด)", "source": "ถ่วงด้วย market cap", "calc": "idx.sectors", "metric": "ch1m", "rows": []},
        {"type": "bars", "title": "ผันผวนสูงสุด (30 วัน)", "source": "ต่อปี", "rows": [{"label": x["s"], "value": x["vol30"], "display": f"{x['vol30']:.0f}%", "color": "#fbbf24"}
                                                                                  for x in sorted([x for x in st if x["vol30"]], key=lambda x: -x["vol30"])[:10]]},
    ]}

    ctx = []
    if n.get("macro"):
        ctx.append({"type": "list", "span": 2, "title": "ปัจจัยมหภาค / ข่าว", "source": "สรุปโดย Claude", "items": n["macro"]})
    if n.get("stocks"):
        ctx.append({"type": "list", "title": "Claude: หุ้นที่น่าจับตา", "items": [{"title": k, "text": v} for k, v in n["stocks"].items()]})
    srcs = [{"name": s["name"], "what": s["what"], "at": when(s.get("at"))} for s in m["sources"]] + n.get("sources", [])
    ctx.append({"type": "sources", "title": "แหล่งข้อมูล", "items": srcs})
    if m.get("warnings"):
        ctx.append({"type": "list", "title": "⚠️ คำเตือนข้อมูล", "items": m["warnings"][:20]})

    zones = [live, heatmap, cockpit, table, screens,
             macro_zone(m, {"name": C["name"], "points": I["series"], "fmt": "num", "color": "#60a5fa"},
                        "ดอกเบี้ย, real yield และความกลัวของตลาด — สดจาก Yahoo stream (yield, VIX, DXY) + ข้อมูลรายวัน/รายเดือนจาก FRED"),
             {"id": "context", "short": "Context", "title": "Context", "subtitle": "ข่าว · หุ้นน่าจับตา · แหล่งข้อมูล", "frames": ctx}]

    keep = ("s", "name", "sector", "cap", "w", "hl", "px", "ch1d", "ch1w", "ch1m", "ch3m", "ytd", "ch1y", "rsi", "score", "signal",
            "aboveE50", "aboveE200", "fromHigh", "pos52", "hi52", "lo52", "vol30", "days", "rank", "st", "refs")
    stocks = [{**{k: x.get(k) for k in keep}, "reading": reading(x)} for x in st]
    ticker = [{"coin": C["hl"], "label": C["hlLabel"]}, {"coin": C["other"][0], "label": C["other"][1]}] + \
             [{"coin": "xyz:" + x["s"], "label": x["s"]} for x in st if x["hl"]]
    idx = {k: I.get(k) for k in ("symbol", "hl", "px", "ch1d", "rsi", "score", "hi52", "lo52", "vol30", "st", "refs", "ch1y")}
    live_keys = syms + [C["sym"]] + MACRO_LIVE + [c["coin"] for c in coins] + [t["coin"] for t in ticker]
    return {"id": u, "kind": "index", "asset": u.upper(), "title": f"{C['upper']} — Fund Manager Research Terminal",
            "subtitle": f"{len(st)} ตัว · เรียลไทม์ทุก tick (Yahoo stream + Hyperliquid) · breadth · heatmap · มหภาคสด",
            "generatedAt": int(time.time() * 1000), "modelAt": m["generatedAt"], "basePrice": I["px"],
            "live": None, "ticker": ticker, "stockSyms": syms, "stocks": stocks, "stockNotes": n.get("stocks", {}), "index": idx,
            "macroLive": macro_live(m), "liveKeys": live_keys,
            "dates": m["dates"], "closes": {x["s"]: x["closes"] for x in st}, "zones": zones}


def macro_live(m):
    """ค่าคงที่ที่หน้าเว็บใช้คำนวณมหภาคสด (real yield ≈ yield 10Y สด − เงินเฟ้อคาดการณ์ 10Y รายวันจาก FRED)"""
    mac = m.get("macro", {})
    pick = lambda k: (mac.get(k) or {}).get("last")
    return {"be10": pick("be10"), "y2": next((p["v"] for p in (mac.get("curve") or {}).get("now", []) if p["label"] == "2Y"), None),
            "y10Fred": pick("y10"), "real10Fred": pick("real10"), "dxyPrev": (mac.get("dxy") or {}).get("last")}


def div_reading(x):
    y = x["fwdYield"] if x["fwdYield"] is not None else x["yield"]
    p = [f"ยิลด์ {y:.2f}%" + (f" (เฉลี่ย 5 ปี {x['avg5']:.2f}%)" if x["avg5"] else "")]
    if x["freq"]: p.append({12: "จ่ายรายเดือน", 4: "จ่ายรายไตรมาส", 2: "จ่ายปีละ 2 ครั้ง", 1: "จ่ายปีละครั้ง"}.get(x["freq"], f"จ่าย {x['freq']} ครั้ง/ปี"))
    if x["cagr5"] is not None: p.append(f"ปันผลโต {x['cagr5']:+.1f}%/ปี (5 ปี)")
    p.append(f"เพิ่มปันผลต่อเนื่อง {x['streak']} ปี" + (" (Dividend Aristocrat)" if x["streak"] >= 25 else ""))
    if x["payout"] is not None and x["gics"] != "Real Estate": p.append(f"payout {x['payout']:.0f}% ของกำไร")
    if x["tr1"] is not None: p.append(f"ผลตอบแทนรวม 1 ปี {x['tr1']:+.1f}%")
    if x["exNext"]: p.append(f"XD ถัดไป {x['exNext']}{' (ประมาณ)' if x['exEst'] else ''}")
    return " · ".join(p)


def build_div(m, n):
    S, st = m["summary"], m["stocks"]
    mac = m.get("macro", {})
    view = n.get("view", {})
    for i, x in enumerate(st): x["rank"] = i + 1
    syms = [x["s"] for x in st]
    y = lambda x: x["fwdYield"] if x["fwdYield"] is not None else x["yield"]
    reit = lambda x: x["gics"] == "Real Estate"
    y10 = mac.get("y10", {}).get("last")
    today = datetime.now(TH).strftime("%Y-%m-%d")
    soon = sorted([x for x in st if x["exNext"] and x["exNext"] >= today and not x["exEst"]], key=lambda x: x["exNext"])[:14]

    live = {"id": "live", "short": "Live", "title": "Live — หุ้นปันผลวันนี้", "subtitle": "ราคาหุ้นปันผลทั้งหมดแบบ tick-by-tick (Yahoo stream) · ยิลด์และ Div score คำนวณใหม่ตามราคาสด · ปฏิทิน XD", "frames": [
        {"type": "movers", "span": 2, "title": "หุ้นปันผลขึ้น/ลงแรงสุด · สด", "source": "Yahoo stream", "count": 8},
        {"type": "list", "title": "XD ที่ประกาศแล้ว (ใกล้สุด)", "source": "Yahoo calendarEvents",
         "items": [{"title": f"{x['exNext'][8:]}/{x['exNext'][5:7]} · {x['s']}", "text": f"ยิลด์ {y(x):.2f}% · จ่าย {x['payDate'] or '—'}"} for x in soon] or ["ยังไม่มีวัน XD ที่ประกาศในช่วงนี้"],
         "footnote": "ต้องถือหุ้นก่อนวัน XD จึงจะได้ปันผล · วันที่ประมาณการไม่ได้แสดงในรายการนี้"},
    ]}

    kpis = {"type": "kpis", "span": 3, "title": "Snapshot", "source": "ราคาปิดล่าสุด", "items": [
        {"label": "S&P 500 ที่จ่ายปันผล", "value": f"{S['spxPayers']}/{S['spxN']}", "sub": f"ยิลด์ทั้งดัชนี {S['spxYield']:.2f}%"},
        {"label": "Nasdaq-100 ที่จ่ายปันผล", "value": f"{S['ndxPayers']}/{S['ndxN']}", "sub": f"ยิลด์ทั้งดัชนี {S['ndxYield']:.2f}%"},
        {"label": "ยิลด์กลาง (median)", "value": f"{S['medYield']:.2f}%", "sub": f"ปันผลโตกลาง {S['medCagr']:.1f}%/ปี"},
        {"label": "เพิ่มปันผลต่อเนื่อง 10+ ปี", "value": f"{S['streak10']} ตัว", "sub": f"25 ปีขึ้นไป (Aristocrats) {S['aristocrats']} ตัว", "tone": "up"},
        {"label": "จ่ายเกินกำไร (ไม่รวม REIT)", "value": f"{S['over100']} ตัว", "sub": f"ปันผลลดลงใน 5 ปี {S['cuts']} ตัว", "tone": "warn"},
        {"label": "พันธบัตร 10 ปี", "value": f"{y10:.2f}%" if y10 else "—", "sub": "เทียบยิลด์หุ้นปันผล", "tone": "muted"},
    ]}
    sec = {"type": "bars", "title": "ยิลด์กลางตามกลุ่ม", "source": "median", "rows": [
        {"label": f"{g['sector']} ({g['n']})", "value": g["medYield"], "display": f"{g['medYield']:.2f}%", "color": "#fbbf24"} for g in m["sectors"]]}
    cockpit = {"id": "cockpit", "short": "Cockpit", "title": "Dividend cockpit — S&P 500 + Nasdaq-100",
               "subtitle": "ภาพรวมหุ้นปันผล · กลุ่มที่ให้ยิลด์สูง · มุมมอง", "frames": [
        kpis,
        {"type": "snapshot", "span": 2, "title": "มุมมองรวม", "source": f"มุมมอง ณ {n.get('asOf', '')}", "lines": [
            {"label": "สรุป", "text": n.get("headline", "")}, {"label": "จุดยืน", "text": view.get("stance", "")}], "footnote": n.get("summary", "")},
        sec,
        {"type": "thesis", "span": 2, "title": "หลักคิดเลือกหุ้นปันผล", "items": n.get("thesis", []), "changeIf": n.get("changeIf", [])},
        {"type": "action", "title": "Action matrix", "source": "ไม่ใช่คำแนะนำ", "rows": n.get("actions", [])},
    ]}

    heat = {"id": "heatmap", "short": "Heatmap", "title": f"Heatmap — หุ้นปันผล {len(st)} ตัว",
            "subtitle": "ขนาดตาม market cap · สีตามยิลด์ / % วันนี้ (สด) / การเติบโตของปันผล 5 ปี",
            "frames": [{"type": "heatmap", "span": 3, "title": "Dividend heatmap", "source": "Yahoo", "items": syms, "metric": "y",
                        "metrics": ["y", "d", "cagr5"], "height": 680}]}
    table = {"id": "stocks", "short": "หุ้นทุกตัว", "title": "หุ้นปันผลทุกตัว",
             "subtitle": "กรองตามดัชนี/กลุ่ม · คลิกหัวคอลัมน์เพื่อเรียง · คลิกแถวเพื่อดูประวัติปันผลรายปีและกราฟราคา 10 ปี",
             "frames": [{"type": "stocktable", "span": 3, "title": f"{len(st)} ตัวที่จ่ายปันผลใน 12 เดือน", "source": "Yahoo · Wikipedia · Nasdaq", "items": syms,
                         "cols": ["rank", "s", "idx", "px", "d", "spark", "y", "payout", "cagr5", "streak", "exNext", "tr1", "dscore"],
                         "footnote": "ยิลด์ = เงินปันผลต่อปีที่ประกาศ ÷ ราคา (ไม่รวมปันผลพิเศษ) · Div score 0–100 = ยิลด์ 30 (เต็มที่ 6%) + การเติบโต 25 (เต็มที่ 10%/ปี) + ความต่อเนื่อง 25 (เต็มที่ 10 ปี) + payout 20, หัก 15 ถ้าจ่ายเกินกำไร และหัก 10 ถ้าปันผลลดลง"}]}

    def bars(L, key, fmt="{:+.1f}%", color=None):
        return [{"label": f"{x['s']}", "value": x[key] if key != "y" else y(x), "display": fmt.format(x[key] if key != "y" else y(x)), **({"color": color} if color else {})} for x in L]
    safe_hi = sorted([x for x in st if y(x) >= 4 and (reit(x) or (x["payout"] is not None and x["payout"] <= 80)) and (x["cagr5"] or 0) >= 0], key=lambda x: -y(x))[:15]
    growers = sorted([x for x in st if (x["cagr5"] or 0) >= 10 and x["streak"] >= 5], key=lambda x: -x["cagr5"])[:15]
    traps = sorted([x for x in st if y(x) >= 4 and (((x["payout"] or 0) > 100 and not reit(x)) or (x["cagr5"] or 0) < 0)], key=lambda x: -y(x))[:15]
    cheap = sorted([x for x in st if x["vsAvg"] is not None and x["streak"] >= 5], key=lambda x: -x["vsAvg"])[:10]
    ndx_payers = sorted([x for x in st if "NDX" in x["idx"]], key=lambda x: -y(x))[:15]
    monthly = sorted([x for x in st if x["freq"] >= 12], key=lambda x: -y(x))
    cuts = sorted([x for x in st if x["cagr5"] is not None and x["cagr5"] < 0], key=lambda x: x["cagr5"])[:10]
    S_ = lambda title, **kw: {"type": "screen", "title": title, "source": kw.pop("source", "สด"), **kw}
    screens = {"id": "screens", "short": "Screens", "title": "Screens — คัดหุ้นปันผลสด", "subtitle": "ยิลด์และ Div score เปลี่ยนตามราคาสด จึงคัดใหม่ทุก tick · คลิกชื่อเพื่อดูรายละเอียด", "frames": [
        S_("Div score สูงสุด", metric="dscore", n=15, color="#c4b5fd", source="0–100 · สด"),
        S_("ยิลด์ ≥ 4% และจ่ายไม่เกินตัว", metric="y", n=15, filter="safeHigh", mode="list", extra=["cagr5"], source="payout ≤ 80%, ปันผลไม่ลด"),
        S_("ปันผลโตเร็ว", metric="cagr5", n=15, filter="growers", mode="list", extra=["y", "streak"], source="โต ≥ 10%/ปี, เพิ่มต่อเนื่อง ≥ 5 ปี"),
        S_("⚠️ ระวังกับดักยิลด์", metric="y", n=15, filter="traps", mode="list", extra=["payout", "cagr5"], source="ยิลด์ ≥ 4% แต่จ่ายเกินกำไร หรือปันผลลดลง"),
        S_("ยิลด์สูงกว่าค่าเฉลี่ย 5 ปีของตัวเอง", metric="vsAvg", n=10, filter="cheap", color="#34d399", source="อาจถูกกว่าปกติ (เพิ่มต่อเนื่อง ≥ 5 ปี)"),
        S_("Nasdaq-100 ที่ยิลด์สูงสุด", metric="y", n=15, filter="ndx", color="#60a5fa", source=f"{S['ndxPayers']} ตัวที่จ่าย"),
        S_("จ่ายปันผลรายเดือน", metric="y", n=10, filter="monthly", mode="list"),
        S_("ปันผลลดลงมากสุด (5 ปี)", metric="cagr5", n=10, filter="cuts", asc=True, source="%/ปี"),
        {"type": "bars", "title": "เพิ่มปันผลต่อเนื่องนานที่สุด", "source": "ปี", "rows": [{"label": x["s"], "value": x["streak"], "display": f"{x['streak']} ปี", "color": "#34d399"} for x in sorted(st, key=lambda x: -x["streak"])[:12]]},
        {"type": "bars", "title": "ผลตอบแทนรวม 5 ปี (ต่อปี) สูงสุด", "source": "ราคา + ปันผล", "rows": bars(sorted([x for x in st if x["tr5"] is not None], key=lambda x: -x["tr5"])[:10], "tr5")},
    ]}

    spx_pair = {"name": "S&P 500", "points": mac["spx"]["series"], "fmt": "num", "color": "#60a5fa"} if mac.get("spx") else None
    ctx = []
    if n.get("macro"): ctx.append({"type": "list", "span": 2, "title": "ปัจจัยมหภาค / ข่าว", "source": "สรุปโดย Claude", "items": n["macro"]})
    if n.get("stocks"): ctx.append({"type": "list", "title": "Claude: หุ้นปันผลน่าจับตา", "items": [{"title": k, "text": v} for k, v in n["stocks"].items()]})
    srcs = [{"name": s_["name"], "what": s_["what"], "at": when(s_.get("at"))} for s_ in m["sources"]] + n.get("sources", [])
    ctx.append({"type": "sources", "title": "แหล่งข้อมูล", "items": srcs})
    if m.get("warnings"): ctx.append({"type": "list", "title": "⚠️ คำเตือนข้อมูล", "items": m["warnings"][:20]})

    keep = ("s", "name", "sector", "gics", "idx", "cap", "w", "px", "yield", "fwd", "fwdYield", "ttm", "freq", "special", "specialAmt", "cagr5",
            "streak", "avg5", "vsAvg", "payout", "pe", "tr1", "tr3", "tr5", "ch1y", "fromHigh", "hi52", "lo52", "exLast", "exNext", "exEst",
            "payDate", "yearly", "flags", "rank")
    stocks = [{**{k: x[k] for k in keep}, "y": y(x), "dscore": x["score"], "ch1d": None, "reading": div_reading(x)} for x in st]
    return {"id": "div", "kind": "div", "asset": "DIV", "title": "DIVIDEND — S&P 500 + Nasdaq-100",
            "subtitle": f"หุ้นจ่ายปันผล {len(st)} ตัว · ยิลด์ · การเติบโต · ความต่อเนื่อง · payout · วัน XD · ราคาสด",
            "generatedAt": int(time.time() * 1000), "modelAt": m["generatedAt"], "live": None,
            "ticker": [{"coin": "xyz:SP500", "label": "S&P 500"}, {"coin": "xyz:XYZ100", "label": "Nasdaq 100"}, {"coin": "xyz:TLT", "label": "TLT (พันธบัตร)"}],
            "stockSyms": syms, "stocks": stocks, "stockNotes": n.get("stocks", {}),
            "liveKeys": syms + ["xyz:SP500", "xyz:XYZ100", "xyz:TLT"] + MACRO_LIVE + ["xyz:" + x["s"] for x in st if x["s"] in HL_SET],
            "macroLive": macro_live(m),
            "monthly": {x["s"]: x["monthly"] for x in st},
            "zones": [live, cockpit, heat, table, screens,
                      macro_zone(m, spx_pair, "ยิลด์พันธบัตร 10 ปีคือคู่แข่งของหุ้นปันผล — ดอกเบี้ยสูงทำให้หุ้นปันผลต้องให้ยิลด์มากขึ้นถึงจะน่าสนใจ"),
                      {"id": "context", "short": "Context", "title": "Context", "subtitle": "ข่าว · หุ้นน่าจับตา · แหล่งข้อมูล", "frames": ctx}]}


BUILDERS = {"gold": build_gold, "ndx": build_index, "spx": build_index, "div": build_div}


def main():
    asset = (sys.argv[1] if len(sys.argv) > 1 else "gold").lower()
    if asset not in BUILDERS:
        sys.exit(f"ยังไม่มี builder สำหรับ {asset} (มี: {', '.join(BUILDERS)})")
    m = load(os.path.join(ROOT, "models", "out", f"{asset}.json"))
    notes_path = os.path.join(ROOT, "notes", f"{asset}.json")
    n = load(notes_path) if os.path.exists(notes_path) else {}
    dash = BUILDERS[asset](m, n)
    dash["notesAsOf"] = n.get("asOf")  # when Claude last wrote the analysis text (the page shows its age)
    out = os.path.join(ROOT, "dashboards", f"{asset}.json")
    os.makedirs(os.path.dirname(out), exist_ok=True)
    tmp = out + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(dash, f, ensure_ascii=False)
    os.replace(tmp, out)
    print(json.dumps({"ok": True, "out": out, "zones": len(dash["zones"]), "frames": sum(len(z["frames"]) for z in dash["zones"]),
                      "notes": bool(n)}, ensure_ascii=False))


if __name__ == "__main__":
    main()
