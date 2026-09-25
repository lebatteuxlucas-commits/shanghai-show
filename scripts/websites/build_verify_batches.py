#!/usr/bin/env python3
"""
Prépare les lots de vérification pour l'agent website-verifier :
  - tous les sites présents dans l'annuaire (RAW[].website), sauf ceux déjà vérifiés
    (data/websites/verify_results/*.json) ou validés à la main
  - les candidats en attente (data/websites/held_for_confirmation.json)
Sortie : data/websites/verify_batches/verify_NN.json
Usage : python3 scripts/websites/build_verify_batches.py [--size 40] [--all] [--include-manual]
"""
import argparse, glob, json, sys
from pathlib import Path
ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts/websites"))
from guess_domains import load_raw
OUT = ROOT / "data/websites/verify_batches"; RES = ROOT / "data/websites/verify_results"
HELD = ROOT / "data/websites/held_for_confirmation.json"

def main():
    ap = argparse.ArgumentParser(); ap.add_argument("--size", type=int, default=40)
    ap.add_argument("--all", action="store_true", help="re-vérifier même les sites déjà jugés")
    ap.add_argument("--include-manual", action="store_true", help="inclure les sites validés à la main")
    a = ap.parse_args()
    done = set()
    if not a.all:
        for f in glob.glob(str(RES / "*.json")): done |= set(json.loads(Path(f).read_text()))
    rows = []
    for e in load_raw():
        if not e.get("website") or e["id"] in done: continue
        if e.get("website_source") == "manual" and not a.include_manual: continue
        rows.append({"id": e["id"], "en": e["en"], "cn": e.get("cn", ""), "brand": e.get("brand", ""), "hall": e["hall"],
                     "scope": e.get("scope", ""), "url": e["website"], "source": e.get("website_source", "")})
    raw_by_id = {e["id"]: e for e in load_raw()}
    if HELD.exists():
        for eid, h in json.loads(HELD.read_text()).items():
            if eid in done: continue
            e = raw_by_id.get(eid, {})
            rows.append({"id": eid, "en": e.get("en", h.get("company", "")), "cn": e.get("cn", ""), "brand": e.get("brand", ""), "hall": e.get("hall", ""),
                         "scope": e.get("scope", ""), "url": h["url"], "source": "held"})
    OUT.mkdir(parents=True, exist_ok=True); RES.mkdir(parents=True, exist_ok=True)
    for f in OUT.glob("verify_*.json"): f.unlink()
    for i in range(0, len(rows), a.size):
        (OUT / f"verify_{i // a.size + 1:02d}.json").write_text(json.dumps(rows[i:i + a.size], ensure_ascii=False, indent=1))
    print(f"{len(rows)} sites à vérifier dans {(len(rows) + a.size - 1) // a.size} lots")

if __name__ == "__main__":
    main()
