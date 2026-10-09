"""High-impact US news history for the indicator study (news-hist.json in DATA_DIR): investing.com's economic
calendar, 60 days per request back to mid-2024. Python + curl_cffi (impersonating Chrome) because a plain fetch
gets 403. Note: importance=high (singular) — importances=high is ignored by the API.
Usage: python research/indicators/fetch_news.py"""
import calendar
import json
import os
import sys
import time
from curl_cffi import requests

BASE = ("https://endpoints.investing.com/pd-instruments/v1/calendars/economic/events/occurrences"
        "?domain_id=1&country_ids=5&importance=high&limit=300")
out_dir = os.environ.get("DATA_DIR", os.path.dirname(__file__))
session = requests.Session(impersonate="chrome")
now = time.time() * 1000
stop = now - 800 * 864e5
seen, rows, to = set(), [], now
while to > stop:
    frm = to - 60 * 864e5
    iso = lambda ms: time.strftime("%Y-%m-%dT%H:%M:%S.000Z", time.gmtime(ms / 1000))
    r = session.get(f"{BASE}&start_date={iso(frm)}&end_date={iso(to)}", timeout=30)
    r.raise_for_status()
    j = r.json()
    names = {e["event_id"]: e.get("short_name") for e in j.get("events", [])}
    for o in j.get("occurrences", []):
        t = calendar.timegm(time.strptime(o["occurrence_time"][:19], "%Y-%m-%dT%H:%M:%S")) * 1000
        key = (t, o["event_id"])
        if key not in seen:
            seen.add(key)
            rows.append({"t": t, "name": names.get(o["event_id"], "US data")})
    print(iso(frm)[:10], len(j.get("occurrences", [])), file=sys.stderr)
    to = frm
rows.sort(key=lambda x: x["t"])
os.makedirs(out_dir, exist_ok=True)
with open(os.path.join(out_dir, "news-hist.json"), "w", encoding="utf-8") as f:
    json.dump(rows, f)
print(f"news-hist.json: {len(rows)} releases")
