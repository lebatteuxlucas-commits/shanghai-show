#!/usr/bin/env python3
"""
Couvertures de catalogues pour le site : première page de chaque PDF rattaché à un
exposant, en JPEG 240 px de large, dans assets/covers/<clé>.jpg.
La clé est un double FNV-1a 32 bits de « dossier/fichier » (même calcul côté client
et côté serveur, voir coverKey dans china_cycle_suppliers.html et home-render.js).
Écrit la table `const COVERS = {...};` dans china_cycle_suppliers.html (clés existantes).
Exclusions : config/cover-exclude.json, liste de "dossier/fichier" à ne jamais afficher.
Usage : python3 scripts/covers/make_covers.py [--prune]
"""
import json, os, re, subprocess, sys, concurrent.futures as cf
from pathlib import Path
ROOT = Path(__file__).resolve().parents[2]; HTML = ROOT / "china_cycle_suppliers.html"; OUT = ROOT / "assets/covers"
sys.path.insert(0, str(ROOT / "scripts/websites")); from guess_domains import load_raw
BASE = Path(os.environ.get("CATALOGUES_DIR") or (Path.home() / "Library/Mobile Documents/com~apple~CloudDocs/TIS 2023 - 2025/FutureMotion"))
EXCL = ROOT / "config/cover-exclude.json"

def fnv1a(s):
    h = 0x811c9dc5
    b = s.encode("utf-16-le")
    for i in range(0, len(b), 2):          # unités UTF-16, comme charCodeAt en JS
        h ^= b[i] | (b[i + 1] << 8)
        h = (h * 0x01000193) & 0xFFFFFFFF
    return h
def cover_key(folder, filename):
    return f"{fnv1a(folder + '/' + filename):08x}{fnv1a(filename + '/' + folder):08x}"

def main():
    OUT.mkdir(parents=True, exist_ok=True)
    excl = set(json.loads(EXCL.read_text())) if EXCL.exists() else set()
    files = {}
    for e in load_raw():
        for c in e.get("catalogues", []):
            if f'{c["category_folder"]}/{c["filename"]}' in excl: continue
            files[cover_key(c["category_folder"], c["filename"])] = (c["category_folder"], c["filename"])
    def make(item):
        key, (folder, fn) = item
        dst = OUT / f"{key}.jpg"
        if dst.exists(): return key, True
        src = BASE / folder / fn
        if not src.exists(): return key, False
        subprocess.run(["sips", "-s", "format", "jpeg", "-s", "formatOptions", "62", "-Z", "320", str(src), "--out", str(dst)], capture_output=True, timeout=180)
        if dst.exists():   # -Z borne la plus grande dimension : on recadre à 240 de large max via PIL si dispo
            try:
                from PIL import Image
                im = Image.open(dst); im.thumbnail((240, 320)); im.convert("RGB").save(dst, "JPEG", quality=62, optimize=True)
            except Exception: pass
        return key, dst.exists()
    ok = {}
    with cf.ThreadPoolExecutor(max_workers=4) as ex:
        for key, good in ex.map(make, files.items()):
            if good: ok[key] = 1
    if "--prune" in sys.argv:
        for f in OUT.glob("*.jpg"):
            if f.stem not in files: f.unlink()
    html = HTML.read_text(encoding="utf-8")
    line = "const COVERS = " + json.dumps(ok, separators=(",", ":")) + ";"
    if "const COVERS = " in html:
        html = re.sub(r"const COVERS = \{[^\n]*\};", lambda m: line, html, count=1)
    else:
        html = html.replace("const RAW_IDX = ", line + "\n" + "const RAW_IDX = ", 1)
    HTML.write_text(html, encoding="utf-8")
    tot = sum(f.stat().st_size for f in OUT.glob("*.jpg")) // 1024
    print(f"{len(ok)}/{len(files)} couvertures ({tot} Ko dans assets/covers) · exclusions : {len(excl)}")

if __name__ == "__main__":
    main()
