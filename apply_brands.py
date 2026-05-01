#!/usr/bin/env python3
"""
Apply floor_plan_brands.json (per-hall map of booth_code → brand_name read
from the EN floor plan JPGs) to:
  - exhibitors.csv (add a "Brand" column)
  - china_cycle_suppliers.html (add `brand` field on each RAW[] entry)

Matching strategy:
  - Each canonical entry in RAW has a `booth` string like "E5-0901" or
    "E1-1305, E1-1701" (multi-booth).
  - Split on commas and lookup each (hall, code) in brands map.
  - If multiple booths map to different brands, we join with " / ".
  - If no match anywhere, leave brand empty.
"""

import csv, json, re
from pathlib import Path

ROOT = Path("/Users/lucaslebatteux/Developer/Clauderie/shanghai-show")
HTML = ROOT / "china_cycle_suppliers.html"
CSV  = ROOT / "exhibitors.csv"
BRANDS = ROOT / "floor_plan_brands.json"

BOOTH_RE = re.compile(r"([EWN]\d)-(\w+)")

def lookup_brand(booth_str: str, brand_map: dict) -> str:
    """Resolve all booth codes in a multi-booth string to brands."""
    if not booth_str:
        return ""
    pieces = []
    for m in BOOTH_RE.finditer(booth_str):
        hall, code = m.group(1), m.group(2)
        b = brand_map.get(hall, {}).get(code)
        if b and b not in pieces:
            pieces.append(b)
    return " / ".join(pieces)

def main():
    brand_map = json.loads(BRANDS.read_text(encoding="utf-8"))["halls"]
    total_brands_in_map = sum(len(v) for v in brand_map.values())
    print(f"Loaded brand map: {total_brands_in_map} booth→brand pairs across {len(brand_map)} halls")

    # ── exhibitors.csv ──────────────────────────────────────────────
    with CSV.open(encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        rows = list(reader)
        original_fields = reader.fieldnames

    if "Brand" not in original_fields:
        new_fields = original_fields[:original_fields.index("All Booths") + 1] + ["Brand"] \
            + original_fields[original_fields.index("All Booths") + 1:]
    else:
        new_fields = original_fields

    matched = 0
    for r in rows:
        booth_str = r.get("All Booths") or ""
        brand = lookup_brand(booth_str, brand_map)
        r["Brand"] = brand
        if brand:
            matched += 1

    with CSV.open("w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, fieldnames=new_fields)
        w.writeheader()
        w.writerows(rows)
    print(f"✓ exhibitors.csv: {matched}/{len(rows)} rows now have a Brand value")

    # ── HTML inline RAW[] ──────────────────────────────────────────
    html = HTML.read_text(encoding="utf-8")
    # Find the RAW array (we know the format: const RAW = [...];)
    start = html.find("const RAW = [")
    if start < 0:
        raise RuntimeError("RAW not found")
    open_br = html.find("[", start)
    depth, i = 0, open_br
    in_str, esc = False, False
    while i < len(html):
        c = html[i]
        if esc: esc = False
        elif c == "\\": esc = True
        elif c == '"': in_str = not in_str
        elif not in_str:
            if c == "[": depth += 1
            elif c == "]":
                depth -= 1
                if depth == 0:
                    end = i
                    break
        i += 1

    array_text = html[open_br + 1 : end]
    objects = json.loads("[" + array_text + "]")
    print(f"Parsed {len(objects)} RAW entries from HTML")

    html_matched = 0
    for o in objects:
        booth = o.get("booth", "")
        brand = lookup_brand(booth, brand_map)
        if brand:
            o["brand"] = brand
            html_matched += 1
        elif "brand" in o:
            del o["brand"]

    new_array = ",".join(json.dumps(o, ensure_ascii=False) for o in objects)
    new_html = html[:open_br + 1] + new_array + html[end:]
    HTML.write_text(new_html, encoding="utf-8")
    print(f"✓ china_cycle_suppliers.html: {html_matched}/{len(objects)} entries now have a brand")

    # Coverage breakdown per hall
    from collections import Counter
    hall_counts = Counter()
    hall_total  = Counter()
    for o in objects:
        for m in BOOTH_RE.finditer(o.get("booth", "")):
            hall_total[m.group(1)] += 1
            if o.get("brand"):
                hall_counts[m.group(1)] += 1
    print("\nCoverage per hall (matched / total booth codes):")
    for h in sorted(hall_total):
        print(f"  {h}: {hall_counts[h]}/{hall_total[h]} ({hall_counts[h] * 100 // max(hall_total[h], 1)}%)")

if __name__ == "__main__":
    main()
