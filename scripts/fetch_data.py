"""Fetch gold data for the morning plan and write it as JSON.

Primary source is investing.com (XAU/USD, pair 68). Its API sits behind Cloudflare, which
rejects ordinary server HTTP clients by TLS fingerprint, so we use curl_cffi to look like Chrome.
If investing.com still refuses, fall back to Binance PAXG candles (via the geo-unrestricted
data-api.binance.vision host) shifted onto the gold-api.com spot price.

Usage: python scripts/fetch_data.py data.json
"""
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
    return {
        "source": "investing.com",
        "tech": tech,
        "daily": [b[:5] for b in daily],
        "hourly": [b[:5] for b in hourly],
    }


def from_binance(session):
    def klines(interval, limit):
        url = f"https://data-api.binance.vision/api/v3/klines?symbol=PAXGUSDT&interval={interval}&limit={limit}"
        return [[k[0], float(k[1]), float(k[2]), float(k[3]), float(k[4])] for k in get_json(session, url)]

    daily, hourly, h4 = klines("1d", 300), klines("1h", 300), klines("4h", 300)
    spot = get_json(session, "https://api.gold-api.com/price/XAU")["price"]
    off = spot - hourly[-1][4]  # PAXG trades at a small premium/discount to spot gold
    shift = lambda rows: [[r[0], r[1] + off, r[2] + off, r[3] + off, r[4] + off] for r in rows]
    return {"source": "binance", "daily": shift(daily), "hourly": shift(hourly), "h4": shift(h4)}


def thb_rate(session):
    try:
        return get_json(session, "https://open.er-api.com/v6/latest/USD")["rates"]["THB"]
    except Exception:
        return None


def main(out_path):
    session = requests.Session(impersonate="chrome")
    try:
        data = from_investing(session)
    except Exception as e:  # noqa: BLE001 - any failure means "use the backup source"
        print(f"investing.com unavailable ({e}); using Binance backup", file=sys.stderr)
        data = from_binance(session)
    data["thb"] = thb_rate(session)
    data["fetchedAt"] = int(time.time() * 1000)
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False)
    print(f"source={data['source']} daily={len(data['daily'])} hourly={len(data['hourly'])}")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "data.json")
