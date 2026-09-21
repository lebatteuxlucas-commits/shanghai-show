#!/usr/bin/env python3
"""
Génère les favicons à partir du monogramme F du logo FutureMotion
(assets/futuremotion-logo.png : blanc + vert sur fond transparent).

Sorties :
  favicon.ico                   16/32/48 px (demandé par défaut par les navigateurs)
  assets/favicon-32.png         <link rel="icon">
  assets/apple-touch-icon.png   180 px (iOS, raccourcis)
  assets/fm-monogram.png        monogramme seul, transparent (image OpenGraph)

Usage : python3 scripts/generate_favicons.py   (Pillow requis)
"""
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
SLATE = "#41535D"
MONOGRAM_RIGHT_EDGE = 550   # colonnes 0–549 du logo pleine résolution = monogramme F


def monogram():
    logo = Image.open(ROOT / "assets/futuremotion-logo.png").convert("RGBA")
    mono = logo.crop((0, 0, MONOGRAM_RIGHT_EDGE, logo.size[1]))
    return mono.crop(mono.getbbox())


def tile(mono, size, radius_ratio=0.22, padding_ratio=0.16):
    """Carré ardoise arrondi, monogramme centré (rendu à 4x puis réduit pour l'anticrénelage)."""
    big = size * 4
    img = Image.new("RGBA", (big, big), (0, 0, 0, 0))
    ImageDraw.Draw(img).rounded_rectangle((0, 0, big - 1, big - 1), radius=int(big * radius_ratio), fill=SLATE)
    inner = int(big * (1 - 2 * padding_ratio))
    m = mono.copy()
    m.thumbnail((inner, inner), Image.LANCZOS)
    img.alpha_composite(m, ((big - m.size[0]) // 2, (big - m.size[1]) // 2))
    return img.resize((size, size), Image.LANCZOS)


def main():
    mono = monogram()
    mono.save(ROOT / "assets/fm-monogram.png", optimize=True)
    tile(mono, 32).save(ROOT / "assets/favicon-32.png", optimize=True)
    # iOS applique ses propres coins arrondis : carré plein, sans rayon.
    tile(mono, 180, radius_ratio=0).save(ROOT / "assets/apple-touch-icon.png", optimize=True)
    tile(mono, 48).save(ROOT / "favicon.ico", sizes=[(16, 16), (32, 32), (48, 48)])
    print("✓ favicon.ico, assets/favicon-32.png, assets/apple-touch-icon.png, assets/fm-monogram.png")


if __name__ == "__main__":
    main()
