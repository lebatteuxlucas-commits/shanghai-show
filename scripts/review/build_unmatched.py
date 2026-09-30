#!/usr/bin/env python3
"""
Construit la liste des PDF de catalogues sans exposant rattaché, avec une
proposition automatique d'exposant (marque déduite du nom de fichier ou du
dossier, comparée aux marques et raisons sociales de l'annuaire).
Sortie : data/review/online/unmatched.json
  [{ key, filename, folder, size_kb, brand_guess, ocr_names, candidates:[{id,en,cn,brand,hall,booth,score}], auto:{id,score}|null }]
"""
import csv, json, os, re, sys
from pathlib import Path
ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts/websites")); from guess_domains import load_raw
BASE = Path(os.environ.get("CATALOGUES_DIR") or (Path.home() / "Library/Mobile Documents/com~apple~CloudDocs/TIS 2023 - 2025/FutureMotion"))
ROOTS = ("All Catalogues 220926", "Suppliers Catalogues", "Catalogues")
NOISE = re.compile(r"\b(20\d\d|catalog(ue)?s?|catalogo|brochure|quotation|price ?list|product(s)?|new|digital|final|lowres|low res|spreads?|single pages?|"
                   r"optimised|optimized|version|v\d+|part ?\d+|en|eng|english|cn|chinese|website|web|i|ii|iii|\d+)\b", re.I)
STOP = {"co", "ltd", "inc", "the", "and", "of", "bike", "bikes", "bicycle", "cycle", "group", "international", "technology", "industry", "trading"}

def norm(s): return re.sub(r"[^a-z0-9]+", " ", (s or "").lower()).strip()
def toks(s): return [t for t in norm(s).split() if t and t not in STOP and len(t) >= 2]

def brand_guess(filename, folder):
    stem = Path(filename).stem
    stem = re.sub(r"^[0-9a-f]{24}_", "", stem)           # préfixe hexadécimal de certains exports
    g = NOISE.sub(" ", stem)
    g = re.sub(r"[\-_–—·,.()\[\]&+]+", " ", g)
    g = re.sub(r"\s+", " ", g).strip()
    sub = folder.split("/", 1)[1] if "/" in folder else ""
    if sub and sub.lower() not in ("suppliers catalogues",):
        sub_clean = re.sub(r"\s+", " ", NOISE.sub(" ", sub)).strip()
        if sub_clean and (not g or len(sub_clean) < len(g)): g = sub_clean or g
    return g

def main():
    raw = load_raw()
    ref = {(c["category_folder"], c["filename"]) for e in raw for c in e.get("catalogues", [])}
    ocr = {}
    p = ROOT / "data/review/_non_rapproches_enrichis.csv"
    if p.exists():
        for r in csv.DictReader(open(p, encoding="utf-8-sig")):
            ocr[(r["dossier"], r["fichier"])] = r.get("noms_trouves_dans_pdf", "")
    idx = []
    for e in raw:
        idx.append((e, set(toks(e.get("brand", ""))), set(toks(e["en"])), norm(e.get("brand", "")), norm(e["en"])))
    items = []
    for root in ROOTS:
        for dp, dn, fn in os.walk(BASE / root):
            for f in sorted(fn):
                if not f.lower().endswith(".pdf") or f.startswith("."): continue
                folder = os.path.relpath(dp, BASE)
                if (folder, f) in ref: continue
                g = brand_guess(f, folder); gt = set(toks(g)); gn = norm(g)
                cands = []
                for e, bt, et, bn, en in idx:
                    sc = 0
                    if gn and gn == bn: sc = 100
                    elif gn and bn and (gn in bn or bn in gn) and len(gn) >= 4: sc = 80
                    elif gt and gt <= bt: sc = 70
                    elif gt and gt & bt: sc = 50 + 10 * len(gt & bt)
                    elif gn and len(gn) >= 5 and gn in en: sc = 60
                    elif gt and gt & et: sc = 30 + 10 * len(gt & et)
                    if sc: cands.append((sc, e))
                cands.sort(key=lambda x: (-x[0], x[1]["en"]))
                top = [{"id": e["id"], "en": e["en"], "cn": e.get("cn", ""), "brand": e.get("brand", ""), "hall": e["hall"], "booth": e.get("booth", ""), "score": sc} for sc, e in cands[:6]]
                auto = None
                if top and top[0]["score"] == 100 and (len(top) == 1 or top[1]["score"] < 100):   # marque strictement identique et unique
                    auto = {"id": top[0]["id"], "score": top[0]["score"]}
                items.append({"key": re.sub(r"[^A-Za-z0-9]+", "_", folder + "/" + f)[:120], "filename": f, "folder": folder,
                              "size_kb": os.path.getsize(os.path.join(dp, f)) // 1024, "brand_guess": g,
                              "ocr_names": ocr.get((folder, f), ""), "candidates": top, "auto": auto})
    out = ROOT / "data/review/online/unmatched.json"
    out.write_text(json.dumps(items, ensure_ascii=False, indent=1))
    n_auto = sum(1 for i in items if i["auto"]); n_cand = sum(1 for i in items if i["candidates"] and not i["auto"])
    print(f"{len(items)} PDF sans exposant · {n_auto} rapprochés automatiquement (marque exacte) · {n_cand} avec candidats à confirmer · {len(items)-n_auto-n_cand} sans candidat → {out}")

if __name__ == "__main__":
    main()
