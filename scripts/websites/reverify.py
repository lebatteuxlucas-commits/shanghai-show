#!/usr/bin/env python3
"""
Re-vérification des résultats de devinette de domaine SANS preuve par raison sociale CN.
On recharge la page et on compte les occurrences de vocabulaire vélo fort
(自行车/电动车/单车/骑行, bicycle/bike/cycling/e-bike…). Un vrai site du secteur en
a plusieurs ; un homonyme (power.com, honor.com, kinesis-ergo.com) n'en a qu'une ou zéro.
  ≥ 3 occurrences  → confidence conservée (high)
  < 3              → confidence "review" (non appliquée au site, à contrôler à la main)
"""
import json, re, sys, concurrent.futures as cf
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))
from guess_domains import fetch, cn_core, load_raw

ROOT = Path(__file__).resolve().parents[2]
G = ROOT / "data/websites/guess_results.json"
STRONG_CN = ["自行车", "电动车", "单车", "骑行", "电踏车", "助力车", "童车", "滑板车", "车架", "轮组", "花鼓"]
STRONG_EN = re.compile(r"\b(bicycles?|bikes?|cycling|e-?bikes?|pedelecs?|cyclists?|wheelsets?|e-?scooters?)\b", re.I)

def score(text):
    return sum(text.count(k) for k in STRONG_CN) + len(STRONG_EN.findall(text))

def check(item):
    eid, v, entry = item
    try:
        _, text = fetch(v["url"])
    except Exception as e:
        return eid, None, f"fetch-error:{e.__class__.__name__}"
    for c in cn_core(entry.get("cn", "")):
        if len(c) >= 3 and c in text:
            return eid, "high", f"cn:{c}"
    n = score(text)
    return eid, ("high" if n >= 3 else "review"), f"cycling-hits:{n}"

def main():
    g = json.loads(G.read_text()); rejected = g.pop("_rejected", {})
    raw = {e["id"]: e for e in load_raw()}
    todo = [(k, v, raw[k]) for k, v in g.items() if not any(e.startswith("cn:") for e in v["evidence"])]
    print(f"{len(todo)} résultats sans preuve CN à re-vérifier", file=sys.stderr)
    changed = 0
    with cf.ThreadPoolExecutor(max_workers=30) as ex:
        for eid, conf, note in ex.map(check, todo):
            v = g[eid]
            v.setdefault("evidence", []).append("reverify:" + note)
            if conf is None:
                new = "review"
            else:
                new = conf if v["confidence"] == "high" or conf == "high" else "review"
                if v["confidence"] == "medium" and conf == "high" and note.startswith("cn:"): new = "high"
                elif v["confidence"] == "medium": new = "review"   # medium sans CN reste à revoir
            if new != v["confidence"]:
                changed += 1
                print(f"  {v['confidence']:6} → {new:6} {eid} {v['url']}  ({note})", file=sys.stderr)
            v["confidence"] = new
    # Promotion : marque (≥ 6 lettres) contenue dans le domaine + ≥ 10 mentions vélo → high
    from urllib.parse import urlparse
    for eid, v in g.items():
        if v["confidence"] != "review": continue
        hits = max([int(x.split(":")[-1]) for x in v["evidence"] if x.startswith("reverify:cycling-hits:")] or [0])
        host = urlparse(v["url"]).netloc.lower().replace("-", "")
        parts = [re.sub(r"[^a-z0-9]", "", p.lower()) for p in re.split(r"\s*/\s*", raw[eid].get("brand") or "")]
        if hits >= 10 and any(len(p) >= 6 and p in host for p in parts):
            v["confidence"] = "high"; v["evidence"].append("promoted:brand-in-domain")
            changed += 1
            print(f"  review → high   {eid} {v['url']}  (marque dans le domaine, {hits} mentions vélo)", file=sys.stderr)
    g["_rejected"] = rejected
    G.write_text(json.dumps(g, ensure_ascii=False, indent=1))
    import collections
    print(f"{changed} reclassés ; répartition : {collections.Counter(v['confidence'] for k,v in g.items() if k != '_rejected')}", file=sys.stderr)

if __name__ == "__main__":
    main()
