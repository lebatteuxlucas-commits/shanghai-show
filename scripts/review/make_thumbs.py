#!/usr/bin/env python3
"""Aperçu de la première page de chaque PDF non rattaché (sips), puis planches (PIL) pour la page en ligne.
Sortie : data/review/online/thumbs/<key>.jpg puis data/review/online/sheets/sheet_NN.jpg + sheets.json (position de chaque key)."""
import json, os, subprocess, sys, concurrent.futures as cf
from pathlib import Path
from PIL import Image
ROOT = Path(__file__).resolve().parents[2]; ON = ROOT / "data/review/online"
BASE = Path(os.environ.get("CATALOGUES_DIR") or (Path.home() / "Library/Mobile Documents/com~apple~CloudDocs/TIS 2023 - 2025/FutureMotion"))
items = json.loads((ON / "unmatched.json").read_text())
TH = ON / "thumbs"; TH.mkdir(parents=True, exist_ok=True); SH = ON / "sheets"; SH.mkdir(exist_ok=True)
W, H, COLS, ROWS = 240, 320, 5, 4   # vignettes 240×320 (recadrées), planches de 20

def thumb(it):
    out = TH / (it["key"] + ".jpg")
    if out.exists(): return it["key"], True
    src = BASE / it["folder"] / it["filename"]
    r = subprocess.run(["sips", "-s", "format", "jpeg", "-s", "formatOptions", "70", "-Z", "480", str(src), "--out", str(out)],
                       capture_output=True, timeout=180)
    return it["key"], out.exists()

ok = 0
with cf.ThreadPoolExecutor(max_workers=4) as ex:
    for n, (k, good) in enumerate(ex.map(thumb, items), 1):
        ok += good
        if n % 50 == 0: print(f"… {n}/{len(items)} ({ok} aperçus)", file=sys.stderr, flush=True)
print(f"{ok}/{len(items)} aperçus générés", file=sys.stderr)

pos = {}; sheet_i = 0; cell = 0; sheet = None
def new_sheet():
    return Image.new("RGB", (W * COLS, H * ROWS), (245, 246, 247))
for it in items:
    p = TH / (it["key"] + ".jpg")
    if not p.exists(): continue
    if sheet is None: sheet = new_sheet()
    try:
        im = Image.open(p).convert("RGB")
    except Exception:
        continue
    im.thumbnail((W, H))
    cx, cy = (cell % COLS) * W + (W - im.width) // 2, (cell // COLS) * H + (H - im.height) // 2
    sheet.paste(im, (cx, cy))
    pos[it["key"]] = {"sheet": sheet_i, "x": (cell % COLS) * W, "y": (cell // COLS) * H}
    cell += 1
    if cell == COLS * ROWS:
        sheet.save(SH / f"sheet_{sheet_i:02d}.jpg", "JPEG", quality=58, optimize=True); sheet_i += 1; cell = 0; sheet = None
if sheet is not None: sheet.save(SH / f"sheet_{sheet_i:02d}.jpg", "JPEG", quality=58, optimize=True); sheet_i += 1
(ON / "sheets.json").write_text(json.dumps({"w": W, "h": H, "cols": COLS, "rows": ROWS, "sheets": sheet_i, "pos": pos}))
tot = sum(f.stat().st_size for f in SH.glob("*.jpg")) // 1024
print(f"{sheet_i} planches, {tot} Ko, {len(pos)} vignettes placées", file=sys.stderr)
