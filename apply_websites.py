#!/usr/bin/env python3
"""
Apply website_lookups.json to:
  - exhibitors.csv (Website column added/populated)
  - china_cycle_suppliers.html (`website` field on each RAW[] entry)

Matching rules per entry, in priority order:
  1. Exact brand match against any key in lookups
  2. If brand is multi-token like "DAHON GROUP / DAHON", try each part
  3. Otherwise leave website empty

We mark each newly populated website with a `website_source: "auto_search"`
flag so we can audit / re-verify later.
"""

import csv, json, re
from pathlib import Path

ROOT = Path("/Users/lucaslebatteux/Developer/Clauderie/shanghai-show")
HTML = ROOT / "china_cycle_suppliers.html"
CSV  = ROOT / "exhibitors.csv"
LOOKUPS = ROOT / "website_lookups.json"

def main():
    lookup_data = json.loads(LOOKUPS.read_text(encoding="utf-8"))["lookups"]
    # Normalize keys to upper-stripped
    lookups = {k.strip().upper(): v for k, v in lookup_data.items()}

    def resolve(brand: str) -> str:
        if not brand: return ""
        b = brand.strip().upper()
        if b in lookups: return lookups[b]
        # Multi-brand "FOO / BAR" — try each part
        for part in re.split(r"\s*/\s*", b):
            if part in lookups: return lookups[part]
        return ""

    # ── HTML inline RAW[] ──────────────────────────────────────────
    html = HTML.read_text(encoding="utf-8")
    start = html.find("const RAW = [")
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
                if depth == 0: end = i; break
        i += 1
    objects = json.loads("[" + html[open_br + 1 : end] + "]")
    print(f"Loaded {len(objects)} entries")

    matched = 0
    for o in objects:
        url = resolve(o.get("brand", ""))
        if url:
            o["website"] = url
            o["website_source"] = "auto_search"
            matched += 1
        elif "website" in o and not o["website"]:
            del o["website"]
    print(f"Populated website for {matched} entries")

    new_array = ",".join(json.dumps(o, ensure_ascii=False) for o in objects)
    HTML.write_text(html[:open_br + 1] + new_array + html[end:], encoding="utf-8")
    print("✓ china_cycle_suppliers.html updated")

    # ── exhibitors.csv ──────────────────────────────────────────────
    with CSV.open(encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        rows = list(reader)
        fieldnames = reader.fieldnames

    if "Website" not in fieldnames:
        # Insert "Website" right after "Brand" if present, else at the end
        if "Brand" in fieldnames:
            i = fieldnames.index("Brand") + 1
            fieldnames = fieldnames[:i] + ["Website"] + fieldnames[i:]
        else:
            fieldnames = fieldnames + ["Website"]

    obj_by_sig = {(o["en"], o.get("booth", "")): o for o in objects}

    csv_matched = 0
    for r in rows:
        sig = (r.get("Company Name (English)",""), r.get("All Booths","") or r.get("Booth/Hall Number",""))
        o = obj_by_sig.get(sig)
        if o and o.get("website"):
            r["Website"] = o["website"]
            csv_matched += 1
        else:
            r.setdefault("Website", "")

    with CSV.open("w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, fieldnames=fieldnames); w.writeheader(); w.writerows(rows)
    print(f"✓ exhibitors.csv updated ({csv_matched} rows with Website)")

if __name__ == "__main__":
    main()
