#!/usr/bin/env python3
"""
Applique les décisions prises sur la page en ligne « Catalogue Matching ».

Entrée : un export JSON de la collection « decisions » de la page (obtenu par
Claude via ArtifactData list, ou fichier { "<key>": {decision, exhibitor_id, note} }),
plus data/review/online/unmatched.json (pour retrouver fichier + dossier, et les
rapprochements automatiques).

  decision = link  → le PDF est rattaché à exhibitor_id
  auto (sans décision contraire) → rattaché à l'exposant de marque identique
  skip / unsure / vide → rien

Produit data/review/online/catalogue_matches_online.csv (supplier_id, filename,
category_folder) puis lance scripts/import-catalogue-matches.ts dessus.
Usage : python3 scripts/review/apply_online_decisions.py decisions.json [--dry-run]
"""
import csv, json, subprocess, sys
from pathlib import Path
ROOT = Path(__file__).resolve().parents[2]; ON = ROOT / "data/review/online"

def main():
    if len(sys.argv) < 2: print(__doc__); sys.exit(1)
    dec = json.loads(Path(sys.argv[1]).read_text())
    if isinstance(dec, list):   # export ArtifactData : [{id, data}] ou [{doc_id, ...}]
        dec = {d.get("id") or d.get("doc_id"): (d.get("data") or d) for d in dec}
    items = json.loads((ON / "unmatched.json").read_text())
    rows, st = [], {"link": 0, "auto": 0, "skip": 0, "unsure": 0, "pending": 0}
    for it in items:
        d = dec.get(it["key"]) or {}
        if d.get("decision") == "link" and d.get("exhibitor_id"):
            rows.append((d["exhibitor_id"], it["filename"], it["folder"])); st["link"] += 1
        elif d.get("decision") in ("skip", "unsure"):
            st[d["decision"]] += 1
        elif it.get("auto"):
            rows.append((it["auto"]["id"], it["filename"], it["folder"])); st["auto"] += 1
        else:
            st["pending"] += 1
    out = ON / "catalogue_matches_online.csv"
    with out.open("w", encoding="utf-8-sig", newline="") as f:
        w = csv.writer(f); w.writerow(["supplier_id", "filename", "category_folder"]); w.writerows(rows)
    print(f"{st} → {len(rows)} rattachements dans {out}")
    if "--dry-run" in sys.argv: return
    subprocess.run(["node", str(ROOT / "scripts/import-catalogue-matches.ts"), str(out)], check=True)

if __name__ == "__main__":
    main()
