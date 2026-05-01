#!/usr/bin/env python3
"""
Parse 82 EN + 82 CN HTML pages saved by hand from the official China Cycle
exhibitor portal (api.e-chinacycle.com/proceeding-exhibitor/page).

Each page contains up to 20 entries of the form:
  <div class="info">
    <div class="name">COMPANY NAME</div>
    <div class="venue">[E1]0001</div>          ← single booth
    OR
    <div class="venue">[E1]0105,[E1]0113</div>  ← multi-booth
  </div>

Pages are aligned: page N in EN folder has the same exhibitors in the same
order as page N in the CN folder. We pair them by (page_index, in_page_index).

Output:
  exhibitors_official.json  — bilingual canonical database with booth codes
  exhibitors_official.csv   — flat CSV view for inspection
"""

import csv, json, re
from pathlib import Path

EN_DIR = Path("/Users/lucaslebatteux/Downloads/New Folder With Items")
CN_DIR = Path("/Users/lucaslebatteux/Downloads/New Folder With Items 2")
OUT_JSON = Path("/Users/lucaslebatteux/Developer/Clauderie/shanghai-show/exhibitors_official.json")
OUT_CSV  = Path("/Users/lucaslebatteux/Developer/Clauderie/shanghai-show/exhibitors_official.csv")

# Block pattern: capture name + venue. Both <div class="name"> and <div class="venue">
# come in that order inside <div class="info">.
INFO_RE = re.compile(
    r'<div[^>]*class="info"[^>]*>\s*'
    r'<div[^>]*class="name"[^>]*>\s*([^<]+?)\s*</div>\s*'
    r'<div[^>]*class="venue"[^>]*>\s*([^<]+?)\s*</div>\s*'
    r'</div>',
    re.UNICODE | re.DOTALL
)
VENUE_RE = re.compile(r'\[([EWN]\d)\]\s*([\w/-]+)', re.UNICODE)

def parse_page(path: Path):
    """Return ordered list of {name, venue_str, booths:[(hall,booth)]}."""
    text = path.read_text(encoding="utf-8")
    out = []
    for m in INFO_RE.finditer(text):
        name = m.group(1).strip()
        venue_str = m.group(2).strip()
        booths = VENUE_RE.findall(venue_str)
        out.append({"name": name, "venue_str": venue_str, "booths": booths})
    return out

def find_pages(d: Path):
    """Return ordered list of page files. EN: '<title>0.html', CN: '0.html'."""
    files = list(d.glob("*.html"))
    # Strip non-numeric prefix to get index
    keyed = []
    for f in files:
        m = re.search(r'(\d+)\.html?$', f.name)
        if m:
            keyed.append((int(m.group(1)), f))
    keyed.sort()
    return [f for _, f in keyed]

def main():
    en_files = find_pages(EN_DIR)
    cn_files = find_pages(CN_DIR)
    print(f"EN pages: {len(en_files)}")
    print(f"CN pages: {len(cn_files)}")
    assert len(en_files) == len(cn_files), "Page count mismatch — alignment will fail"

    # Merge by venue string (language-invariant). The EN and CN page ordering
    # can drift after a few pages — most likely because Vue's sort/filter state
    # isn't deterministic across language switches — so position-based pairing
    # silently corrupts later halls. Booth codes are the canonical key.
    en_by_venue, cn_by_venue = {}, {}
    en_dups, cn_dups = [], []

    def collect(files, target, dups):
        for i, f in enumerate(files):
            for j, e in enumerate(parse_page(f)):
                key = e["venue_str"]
                if key in target:
                    dups.append((key, target[key]["name"], e["name"]))
                else:
                    target[key] = {**e, "page": i, "page_idx": j}

    collect(en_files, en_by_venue, en_dups)
    collect(cn_files, cn_by_venue, cn_dups)
    print(f"EN distinct venues: {len(en_by_venue)} (dups: {len(en_dups)})")
    print(f"CN distinct venues: {len(cn_by_venue)} (dups: {len(cn_dups)})")

    only_en = en_by_venue.keys() - cn_by_venue.keys()
    only_cn = cn_by_venue.keys() - en_by_venue.keys()
    if only_en:
        print(f"⚠ {len(only_en)} venues in EN only — first 5: {list(only_en)[:5]}")
    if only_cn:
        print(f"⚠ {len(only_cn)} venues in CN only — first 5: {list(only_cn)[:5]}")

    rows = []
    for venue_str, en in en_by_venue.items():
        cn = cn_by_venue.get(venue_str)
        rows.append({
            "name_en": en["name"],
            "name_cn": cn["name"] if cn else "",
            "venue":   venue_str,
            "booths":  en["booths"],
            "halls":   sorted({h for h, _ in en["booths"]}),
        })
    # Add CN-only entries (rare but possible if alignment broke)
    for venue_str in only_cn:
        cn = cn_by_venue[venue_str]
        rows.append({
            "name_en": "",
            "name_cn": cn["name"],
            "venue":   venue_str,
            "booths":  cn["booths"],
            "halls":   sorted({h for h, _ in cn["booths"]}),
        })

    print(f"\n✓ Parsed {len(rows)} unique exhibitors (each may have multiple booths)")
    total_booths = sum(len(r["booths"]) for r in rows)
    print(f"✓ Total booth assignments: {total_booths}")

    # Hall distribution
    from collections import Counter
    hall_count = Counter()
    for r in rows:
        for h, _ in r["booths"]:
            hall_count[h] += 1
    print("Booths per hall:")
    for code in ["E1","E2","E3","E4","E5","E6","E7","N1","W1","W2","W3","W4","W5"]:
        if hall_count.get(code):
            print(f"  {code}: {hall_count[code]}")

    OUT_JSON.write_text(json.dumps(rows, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\n✓ {OUT_JSON.relative_to(OUT_JSON.parent.parent)}")

    # Flat CSV — one row per (exhibitor, booth) so multi-booth entries show twice
    with OUT_CSV.open("w", encoding="utf-8-sig", newline="") as f:
        w = csv.writer(f)
        w.writerow(["name_en", "name_cn", "hall", "booth", "all_booths"])
        for r in rows:
            for h, b in r["booths"]:
                w.writerow([r["name_en"], r["name_cn"], h, b, r["venue"]])
    print(f"✓ {OUT_CSV.relative_to(OUT_CSV.parent.parent)}")

if __name__ == "__main__":
    main()
