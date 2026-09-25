#!/usr/bin/env python3
"""
Construit, pour chaque exposant, un « pack de signaux » compact servant à déduire
les catégories et le product scope :
  - raison sociale EN/CN, marque, hall (+ libellé), stand
  - texte officiel (api.e-chinacycle.com) : businessScopeEn / businessScope / description(En)
  - extrait du site web (title, meta description, keywords, titres h1/h2, texte)
  - catalogues collectés (dossier + nom de fichier)
Sortie : data/enrich/packs/pack_NN.json (lots de --size exposants, défaut 80).
Usage : python3 scripts/enrich/build_signal_packs.py [--size 80] [--only-missing]
"""
import argparse, json, re, sys, html as H
from pathlib import Path
ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts/websites"))
from guess_domains import load_raw

DET = ROOT / "data/websites/official_details.json"
SNIP = ROOT / "data/websites/site_snippets.json"
PACKS = ROOT / "data/enrich/packs"

def n(s): return re.sub(r"[\s（）()【】\[\]、,.，。·\-]", "", (s or "")).upper()
def strip_html(s, limit):
    s = re.sub(r"<[^>]+>", " ", H.unescape(s or ""))
    return re.sub(r"\s+", " ", s).strip()[:limit]

def official_index():
    det = json.loads(DET.read_text()) if DET.exists() else {}
    by_cn, by_en = {}, {}
    F = ("businessScopeEn", "businessScope", "descriptionEn", "description")
    for d in det.values():
        for key, idx in ((n(d.get("name")), by_cn), (n(d.get("nameEn")), by_en)):
            if not key: continue
            m = idx.setdefault(key, {})
            for f in F:
                if d.get(f) and not m.get(f): m[f] = d[f]
    return by_cn, by_en

def main():
    ap = argparse.ArgumentParser(); ap.add_argument("--size", type=int, default=80); ap.add_argument("--only-missing", action="store_true")
    ap.add_argument("--ids-file", help="JSON : liste d'ids à (re)traiter uniquement")
    ap.add_argument("--prefix", default="pack", help="préfixe des fichiers de packs (pack | pass2)")
    a = ap.parse_args()
    raw = load_raw(); by_cn, by_en = official_index()
    only = set(json.loads(Path(a.ids_file).read_text())) if a.ids_file else None
    snip = json.loads(SNIP.read_text()) if SNIP.exists() else {}
    packs, cur = [], []
    for e in raw:
        if a.only_missing and (e.get("scope") or e.get("cats")): continue
        if only is not None and e["id"] not in only: continue
        off = {**by_en.get(n(e["en"]), {}), **by_cn.get(n(e["cn"]), {})}
        p = {"id": e["id"], "en": e["en"], "cn": e.get("cn", ""), "brand": e.get("brand", ""),
             "hall": f'{e["hall"]} ({e.get("hallEn", "")})', "booth": e.get("booth", "")}
        o = {}
        if off.get("businessScopeEn"): o["scope_en"] = off["businessScopeEn"][:300]
        if off.get("businessScope"): o["scope_cn"] = off["businessScope"][:300]
        if off.get("descriptionEn"): o["desc_en"] = strip_html(off["descriptionEn"], 500)
        if off.get("description"): o["desc_cn"] = strip_html(off["description"], 400)
        if o: p["official"] = o
        s = snip.get(e["id"]) if e.get("website") else None   # pas d'extrait si le site a été retiré depuis
        if s and "error" not in s and s.get("url") == e.get("website"):
            w = {k: s[k] for k in ("url", "title", "description", "keywords") if s.get(k)}
            if s.get("headings"): w["headings"] = s["headings"][:8]
            if s.get("text"): w["text"] = s["text"][:400]
            p["website"] = w
        elif e.get("website"):
            p["website"] = {"url": e["website"], "note": "page non récupérable"}
        if e.get("catalogues"):
            p["catalogues"] = sorted({f'{c["category_folder"]} / {c["filename"]}' for c in e["catalogues"]})[:8]
        cur.append(p)
        if len(cur) >= a.size: packs.append(cur); cur = []
    if cur: packs.append(cur)
    for f in PACKS.glob(f"{a.prefix}_*.json"): f.unlink()
    for i, pk in enumerate(packs, 1):
        (PACKS / f"{a.prefix}_{i:02d}.json").write_text(json.dumps(pk, ensure_ascii=False, indent=1))
    tot = sum(len(p) for p in packs)
    rich = sum(1 for p in packs for x in p if x.get("official") or x.get("website") or x.get("catalogues"))
    print(f"{tot} exposants dans {len(packs)} packs ; {rich} avec au moins un signal texte, {tot-rich} avec nom/marque/hall seulement")

if __name__ == "__main__":
    main()
