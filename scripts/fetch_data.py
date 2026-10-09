"""Fetch gold data for the morning plan and write it as JSON.

Primary source is investing.com (XAU/USD, pair 68). Its API sits behind Cloudflare, which
rejects ordinary server HTTP clients by TLS fingerprint, so we use curl_cffi to look like Chrome.
If investing.com still refuses, fall back to Binance PAXG candles (via the geo-unrestricted
data-api.binance.vision host) shifted onto the gold-api.com spot price.

Usage: python scripts/fetch_data.py data.json [--m15-only]
  --m15-only  only the short-term candles (for the 5-minute price-alert / 30-minute signal check)
"""
import calendar
import json
import sys
import time

from curl_cffi import requests

PAIR_ID = 68
INVESTING = "https://api.investing.com/api/financialdata"
TECH_TFS = ["5m", "15m", "30m", "1h", "5h", "1d", "1w", "1mo"]
HEADERS = {"domain-id": "th", "Accept": "application/json", "Referer": "https://th.investing.com/"}


def get_json(session, url, headers=None):
    r = session.get(url, headers=headers or {}, timeout=25)
    r.raise_for_status()
    return r.json()


def from_investing(session):
    tech = {}
    for tf in TECH_TFS:
        tech[tf] = get_json(session, f"{INVESTING}/technical/analysis/{PAIR_ID}/{tf}", HEADERS)
        time.sleep(0.3)
    daily = get_json(session, f"{INVESTING}/{PAIR_ID}/historical/chart/?interval=P1D&pointscount=60", HEADERS)["data"]
    hourly = get_json(session, f"{INVESTING}/{PAIR_ID}/historical/chart/?interval=PT1H&pointscount=160", HEADERS)["data"]
    # 15-minute candles (160 = 40 hours) score yesterday's signal; 30-minute (80 hours) reach back
    # over the weekend to Friday's signal on Monday morning
    m15 = get_json(session, f"{INVESTING}/{PAIR_ID}/historical/chart/?interval=PT15M&pointscount=160", HEADERS)["data"]
    m30 = get_json(session, f"{INVESTING}/{PAIR_ID}/historical/chart/?interval=PT30M&pointscount=160", HEADERS)["data"]
    return {
        "source": "investing.com",
        "tech": tech,
        "daily": [b[:5] for b in daily],
        "hourly": [b[:5] for b in hourly],
        "m15": [b[:5] for b in m15],
        "m30": [b[:5] for b in m30],
    }


def from_binance(session):
    def klines(interval, limit):
        url = f"https://data-api.binance.vision/api/v3/klines?symbol=PAXGUSDT&interval={interval}&limit={limit}"
        return [[k[0], float(k[1]), float(k[2]), float(k[3]), float(k[4])] for k in get_json(session, url)]

    daily, hourly, h4, m15 = klines("1d", 300), klines("1h", 300), klines("4h", 300), klines("15m", 200)
    m30 = klines("30m", 200)
    spot = get_json(session, "https://api.gold-api.com/price/XAU")["price"]
    off = spot - hourly[-1][4]  # PAXG trades at a small premium/discount to spot gold
    shift = lambda rows: [[r[0], r[1] + off, r[2] + off, r[3] + off, r[4] + off] for r in rows]
    return {"source": "binance", "daily": shift(daily), "hourly": shift(hourly), "h4": shift(h4), "m15": shift(m15), "m30": shift(m30)}


INTRADAY = {"m15": "PT15M", "m30": "PT30M", "h1": "PT1H", "h5": "PT5H"}


def m15_investing(session):
    """15/30-minute, 1-hour and 5-hour candles: follow open trades and make the 30-minute call."""
    out = {"source": "investing.com"}
    for key, interval in INTRADAY.items():
        rows = get_json(session, f"{INVESTING}/{PAIR_ID}/historical/chart/?interval={interval}&pointscount=160", HEADERS)["data"]
        out[key] = [b[:5] for b in rows]
    return out


def m15_binance(session):
    def klines(interval, limit):
        url = f"https://data-api.binance.vision/api/v3/klines?symbol=PAXGUSDT&interval={interval}&limit={limit}"
        return [[k[0], float(k[1]), float(k[2]), float(k[3]), float(k[4])] for k in get_json(session, url)]

    m15, m30, h1 = klines("15m", 200), klines("30m", 200), klines("1h", 1000)
    h5 = []  # Binance has no 5-hour candles: build them from 1-hour ones
    for r in h1:
        t = r[0] // (5 * 3600000) * (5 * 3600000)
        if h5 and h5[-1][0] == t:
            h5[-1] = [t, h5[-1][1], max(h5[-1][2], r[2]), min(h5[-1][3], r[3]), r[4]]
        else:
            h5.append([t, *r[1:5]])
    off = get_json(session, "https://api.gold-api.com/price/XAU")["price"] - m15[-1][4]
    shift = lambda rows: [[r[0], r[1] + off, r[2] + off, r[3] + off, r[4] + off] for r in rows]
    return {"source": "binance", "m15": shift(m15), "m30": shift(m30), "h1": shift(h1[-200:]), "h5": shift(h5[-160:])}


CALENDAR = ("https://endpoints.investing.com/pd-instruments/v1/calendars/economic/events/occurrences"
            "?domain_id=1&limit=60&country_ids=5&importance=high")  # importance (singular): importances= is ignored and returned medium/low too


def news(session):
    """Upcoming high-impact US releases from investing.com's economic calendar, one entry per time."""
    try:
        cal = get_json(session, CALENDAR)
    except Exception as e:  # noqa: BLE001 - news is optional
        print(f"calendar unavailable ({e})", file=sys.stderr)
        return []
    names = {e["event_id"]: e.get("short_name") or e.get("long_name") for e in cal.get("events", [])}
    by_time = {}
    for o in cal.get("occurrences", []):
        t = calendar.timegm(time.strptime(o["occurrence_time"][:19], "%Y-%m-%dT%H:%M:%S")) * 1000
        by_time.setdefault(t, []).append(names.get(o["event_id"], "US data"))
    return [{"time": t, "title": " · ".join(dict.fromkeys(ts))[:120]} for t, ts in sorted(by_time.items())]


def main(out_path, m15_only=False):
    session = requests.Session(impersonate="chrome")
    primary, backup = (m15_investing, m15_binance) if m15_only else (from_investing, from_binance)
    try:
        data = primary(session)
    except Exception as e:  # noqa: BLE001 - any failure means "use the backup source"
        print(f"investing.com unavailable ({e}); using Binance backup", file=sys.stderr)
        data = backup(session)
    data["news"] = news(session)
    data["fetchedAt"] = int(time.time() * 1000)
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False)
    print(f"source={data['source']} " + " ".join(f"{k}={len(v)}" for k, v in data.items() if isinstance(v, list)))


if __name__ == "__main__":
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    main(args[0] if args else "data.json", m15_only="--m15-only" in sys.argv)
