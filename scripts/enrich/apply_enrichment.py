#!/usr/bin/env python3
"""
Applique data/enrich/results/*.json (sortie des agents scope-classifier) au RAW[]
inliné dans china_cycle_suppliers.html :
  cats             : 1 à 3 catégories parmi les 11 valeurs du filtre (validées)
  scope            : phrase produit en anglais
  scope_source     : official | website | catalogue | brand | name
  scope_confidence : high | medium | low
Les entrées déjà éditées à la main (scope_source == "manual") ne sont pas écrasées.
Usage : python3 scripts/enrich/apply_enrichment.py [--dry-run]
"""
import argparse, glob, json, re, sys, collections
from pathlib import Path
ROOT = Path(__file__).resolve().parents[2]
HTML = ROOT / "china_cycle_suppliers.html"
# pass 1 (pack_*) puis pass 2 (pass2_*) : la seconde passe l'emporte
RESULTS = sorted(glob.glob(str(ROOT / "data/enrich/results/pack_*.json"))) + sorted(glob.glob(str(ROOT / "data/enrich/results/pass2_*.json")))
ALLOWED = ["Complete Bikes", "Frames, Forks & Parts", "Tires, Rims & Parts", "Transmissions & Parts",
           "Steering & Components", "Accessories", "Machinery & Tools", "Cycling/Outdoor Products",
           "Electric Bicycle", "E-Bike Parts & Accessories", "Other"]
ALIAS = {"e-bike parts and accessories": "E-Bike Parts & Accessories", "electric bicycle / motorcycle": "E-Bike Parts & Accessories",
         "cycling / outdoor products": "Cycling/Outdoor Products", "frames, forks and parts": "Frames, Forks & Parts",
         "tires, rims and parts": "Tires, Rims & Parts", "transmissions and parts": "Transmissions & Parts", "transmission & parts": "Transmissions & Parts", "transmission and parts": "Transmissions & Parts",
         "tires, rims and parts": "Tires, Rims & Parts", "tyres, rims & parts": "Tires, Rims & Parts", "frames, forks and parts": "Frames, Forks & Parts",
         "e-bike parts & accessories ": "E-Bike Parts & Accessories", "electric bicycle parts & accessories": "E-Bike Parts & Accessories", "cycling/outdoor product": "Cycling/Outdoor Products",
         "steering and components": "Steering & Components", "machinery and tools": "Machinery & Tools"}
LOW = {c.lower(): c for c in ALLOWED}
# Repli par hall pour les entrées restées « Other » sans scope : le thème du hall vaut catégorie (confiance low).
HALL_DEFAULT = {"E1": "Complete Bikes", "W2": "Complete Bikes", "W3": "Complete Bikes", "E2": "Accessories", "E3": "Accessories",
                "E4": "Tires, Rims & Parts", "E5": "E-Bike Parts & Accessories", "E6": "Electric Bicycle", "E7": "Electric Bicycle",
                "W4": "Cycling/Outdoor Products", "W5": "Electric Bicycle"}
NAME_HINTS = [(re.compile(r"\b(SPORTS?|OUTDOOR|APPAREL|GARMENT)\b|体育|运动|户外|服饰", re.I), "Cycling/Outdoor Products"),
              (re.compile(r"\b(ELECTRONIC|ELECTRIC|ELECTRICAL|MOTOR|BATTERY|POWER)\b|电子|电气|电机|电池|动力", re.I), "E-Bike Parts & Accessories"),
              (re.compile(r"\b(CYCLE|BICYCLE|BIKE|VEHICLE)S?\b|车业|自行车", re.I), "Complete Bikes"),
              (re.compile(r"\b(METAL|HARDWARE|MACHINERY|MOULD|MOLD|ALLOY|PLASTIC)S?\b|金属|五金|机械|模具|塑料", re.I), "Machinery & Tools")]

def fallback_cat(o):
    name = f'{o.get("en","")} {o.get("cn","")}'
    for rx, cat in NAME_HINTS:
        if rx.search(name): return cat, "name"
    return HALL_DEFAULT.get((o.get("hall") or "").upper()), "hall"

def norm_cat(c):
    k = re.sub(r"\s+", " ", str(c)).strip().lower()
    return LOW.get(k) or ALIAS.get(k)

def load_html_objects():
    html = HTML.read_text(encoding="utf-8")
    start = html.find("const RAW = ["); ob = html.find("[", start)
    depth, i, ins, esc = 0, ob, False, False
    while i < len(html):
        ch = html[i]
        if esc: esc = False
        elif ch == "\\": esc = True
        elif ch == '"': ins = not ins
        elif not ins:
            if ch == "[": depth += 1
            elif ch == "]":
                depth -= 1
                if depth == 0: end = i; break
        i += 1
    return html, ob, end, json.loads("[" + html[ob + 1:end] + "]")

def main():
    ap = argparse.ArgumentParser(); ap.add_argument("--dry-run", action="store_true"); a = ap.parse_args()
    res = {}
    for f in RESULTS:
        try: res.update(json.loads(Path(f).read_text()))
        except Exception as e: print(f"! {f}: {e}", file=sys.stderr)
    html, ob, end, objects = load_html_objects()
    st = collections.Counter(); bad = []
    for o in objects:
        r = res.get(o["id"])
        if not r: st["no_result"] += 1; continue
        if o.get("scope_source") == "manual": st["manual_kept"] += 1; continue
        cats = []
        for c in (r.get("cats") or []):
            nc = norm_cat(c)
            if nc and nc not in cats: cats.append(nc)
            elif not nc: bad.append((o["id"], c))
        cats = cats[:3] or ["Other"]
        scope = re.sub(r"\s+", " ", str(r.get("scope") or "")).strip()[:220]
        if cats == ["Other"] and not scope:
            fc, how = fallback_cat(o)
            if fc: cats = [fc]; r = {**r, "confidence": "low", "scope_source": how}; st["fallback_" + how] += 1
        o["cats"] = cats; o["scope"] = scope
        o["scope_source"] = r.get("scope_source") or "name"; o["scope_confidence"] = r.get("confidence") or "low"
        st["applied"] += 1; st["conf_" + o["scope_confidence"]] += 1
        if scope: st["with_scope"] += 1
        for c in cats: st["cat:" + c] += 1
    print(f"{len(res)} résultats lus ; {dict(st)}")
    if bad: print(f"{len(bad)} catégories inconnues ignorées, ex. {bad[:5]}", file=sys.stderr)
    if a.dry_run: return
    new_array = ",".join(json.dumps(o, ensure_ascii=False) for o in objects)
    HTML.write_text(html[:ob + 1] + new_array + html[end:], encoding="utf-8")
    print("✓ china_cycle_suppliers.html mis à jour")

if __name__ == "__main__":
    main()
