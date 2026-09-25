#!/usr/bin/env python3
"""
Couche 0 — site web déclaré par l'exposant sur la plateforme officielle du salon.

Interroge https://api.e-chinacycle.com/web/exhibitor/{id} pour chaque id de
exhibitors_raw.json et enregistre le détail (website, description, address…)
dans data/websites/official_details.json  { "<raw id>": {...data} }.
Reprise possible : les ids déjà présents ne sont pas refetchés.
"""
import json, sys, time, concurrent.futures as cf, urllib.request, ssl
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
RAW = ROOT / "exhibitors_raw.json"
OUT = ROOT / "data/websites/official_details.json"
API = "https://api.e-chinacycle.com/web/exhibitor/{id}"
CTX = ssl.create_default_context()

def fetch(eid):
    req = urllib.request.Request(API.format(id=eid), headers={
        "User-Agent": "Mozilla/5.0", "X-API-KEY": "123456", "Accept": "application/json",
        "Referer": "https://online.e-chinacycle.com/"})
    for attempt in range(5):
        try:
            with urllib.request.urlopen(req, timeout=20, context=CTX) as r:
                d = json.loads(r.read().decode("utf-8"))
            return eid, d.get("data") or {"_error": d.get("msg")}
        except Exception as e:
            time.sleep(2 * (attempt + 1))
            last = str(e)
    return eid, {"_error": last}

def main():
    ids = [e["id"] for e in json.loads(RAW.read_text())]
    ids = list(dict.fromkeys(ids))
    out = json.loads(OUT.read_text()) if OUT.exists() else {}
    todo = [i for i in ids if i not in out or "_error" in out[i]]
    print(f"{len(ids)} ids, {len(todo)} à récupérer", file=sys.stderr)
    t0 = time.time(); n = 0
    with cf.ThreadPoolExecutor(max_workers=4) as ex:
        for eid, data in ex.map(fetch, todo):
            out[eid] = data; n += 1
            if n % 100 == 0:
                OUT.write_text(json.dumps(out, ensure_ascii=False))
                ok = sum(1 for v in out.values() if v.get("website"))
                print(f"… {n}/{len(todo)} ({ok} avec website, {time.time()-t0:.0f}s)", file=sys.stderr)
    OUT.write_text(json.dumps(out, ensure_ascii=False))
    ok = sum(1 for v in out.values() if v.get("website")); err = sum(1 for v in out.values() if "_error" in v)
    print(f"Terminé : {len(out)} détails, {ok} avec website, {err} erreurs → {OUT}", file=sys.stderr)

if __name__ == "__main__":
    main()
