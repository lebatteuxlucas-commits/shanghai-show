#!/usr/bin/env python3
"""
Met l'annuaire en accord avec les décisions finales de la page de revue, puis
supprime les catalogues en double.

1. Pour chaque PDF passé par la page : seul l'exposant choisi (decision = link)
   peut le détenir. Un rapprochement automatique ou antérieur invalidé depuis
   (unsure / skip / autre exposant) est retiré. Les fiches « added_* » créées à
   la main sont conservées.
2. Doublons : un même fichier déposé dans plusieurs dossiers (même nom normalisé
   et même taille) n'est gardé qu'une fois par exposant.
Usage : python3 scripts/review/reconcile_catalogues.py decisions.json [--dry-run]
"""
import json, os, re, sys
from pathlib import Path
ROOT = Path(__file__).resolve().parents[2]; HTML = ROOT / "china_cycle_suppliers.html"
BASE = Path(os.environ.get("CATALOGUES_DIR") or (Path.home() / "Library/Mobile Documents/com~apple~CloudDocs/TIS 2023 - 2025/FutureMotion"))

def load():
    s = HTML.read_text(encoding="utf-8"); i = s.find("const RAW = ["); ob = s.find("[", i)
    depth, j, ins, esc = 0, ob, False, False
    while j < len(s):
        c = s[j]
        if esc: esc = False
        elif c == "\\": esc = True
        elif c == '"': ins = not ins
        elif not ins:
            if c == "[": depth += 1
            elif c == "]":
                depth -= 1
                if depth == 0: return s, ob, j, json.loads("[" + s[ob + 1:j] + "]")
        j += 1

def norm_name(f): return re.sub(r"[^a-z0-9一-鿿]+", "", f.lower())
def size_of(folder, fn):
    try: return (BASE / folder / fn).stat().st_size
    except OSError: return -1

def main():
    dec = json.loads(Path(sys.argv[1]).read_text()); dry = "--dry-run" in sys.argv
    items = {i["key"]: i for i in json.loads((ROOT / "data/review/online/unmatched.json").read_text())}
    s, ob, end, raw = load()
    allowed = {}   # (folder, filename) → exhibitor autorisé ou None
    for key, it in items.items():
        d = dec.get(key) or {}
        allowed[(it["folder"], it["filename"])] = d["exhibitor_id"] if d.get("decision") == "link" and d.get("exhibitor_id") else None
    removed = []
    for e in raw:
        if e["id"].startswith("added_"): continue
        keep = []
        for c in e.get("catalogues", []):
            k = (c["category_folder"], c["filename"])
            if k in allowed and allowed[k] != e["id"]:
                removed.append((e["id"], e["en"][:40], c["filename"])); continue
            keep.append(c)
        e["catalogues"] = keep
    dups = []
    for e in raw:
        seen = {}; keep = []
        for c in e.get("catalogues", []):
            sig = (norm_name(c["filename"]), size_of(c["category_folder"], c["filename"]))
            if sig in seen: dups.append((e["id"], c["category_folder"], c["filename"])); continue
            seen[sig] = c; keep.append(c)
        e["catalogues"] = keep
    print(f"{len(removed)} rattachement(s) invalidé(s) retiré(s) · {len(dups)} doublon(s) supprimé(s)")
    for r in removed[:40]: print("  retiré :", *r)
    if dry: return
    HTML.write_text(s[:ob + 1] + ",".join(json.dumps(o, ensure_ascii=False) for o in raw) + s[end:], encoding="utf-8")
    print("✓ china_cycle_suppliers.html mis à jour")

if __name__ == "__main__":
    main()
