#!/usr/bin/env python3
"""
Replace the inline RAW[] in china_cycle_suppliers.html and rewrite
exhibitors.csv from exhibitors_official.json (1627 canonical entries
with bilingual names + booth codes).

We preserve a small set of OCR-only brands the official portal doesn't
list — those have no booth code but are kept so the directory still
surfaces them when a user searches by brand.
"""

import csv, json, re
from pathlib import Path

ROOT = Path("/Users/lucaslebatteux/Developer/Clauderie/shanghai-show")
HTML = ROOT / "china_cycle_suppliers.html"
CSV  = ROOT / "exhibitors.csv"
OFF  = ROOT / "exhibitors_official.json"
PLAN = ROOT / "floor_plan_extracted.json"

HALL_NAMES_EN = {
    "E1": "Bicycles", "E2": "Accessories", "E3": "Accessories",
    "E4": "Tires & accessories", "E5": "E-bikes accessories",
    "E6": "E-bikes & accessories", "E7": "E-bike brands",
    "N1": "International Brands",
    "W1": "International brands", "W2": "Bicycles & accessories",
    "W3": "Children's bikes", "W4": "Cycling & outdoor sporting",
    "W5": "Two-Wheel Brands",
}
HALL_NAMES_CN = {
    "E1": "整车品牌馆", "E2": "零配件馆", "E3": "零配件馆",
    "E4": "轮胎及零配件馆", "E5": "电动车零配件馆",
    "E6": "电动车及零配件馆", "E7": "电动车品牌馆",
    "N1": "两轮品牌馆",
    "W1": "国际品牌馆", "W2": "整车及零配件馆",
    "W3": "童车馆", "W4": "户外骑行装备馆", "W5": "品牌创新馆",
}

def main():
    official = json.loads(OFF.read_text(encoding="utf-8"))
    print(f"Loaded {len(official)} official entries")

    # ── Build canonical RAW[] objects ───────────────────────────────
    raw = []
    for o in official:
        booths = o["booths"]  # list of [hall, code]
        primary_hall = booths[0][0] if booths else ""
        # Combined booth string for display (multi-booth → join with ', ')
        booth_codes = ", ".join(f"{h}-{c}" for h, c in booths) if booths else ""
        # Halls list (deduped)
        halls = sorted({h for h, _ in booths}) if booths else []
        raw.append({
            "en":    o["name_en"],
            "cn":    o["name_cn"],
            "hall":  primary_hall,           # primary hall (drives chip filter)
            "hallEn": HALL_NAMES_EN.get(primary_hall, ""),
            "scope": "",
            "cats":  [],
            "website": "",
            "booth": booth_codes,            # NEW field, displayed in UI
            "halls": halls,                  # NEW field for multi-hall
        })

    # ── Add OCR-only brands the official portal doesn't list ────────
    plan = json.loads(PLAN.read_text(encoding="utf-8"))["halls"]
    # Brands we know are visible on the floor plan but absent from the official list.
    # Match purely by EN name presence in plan vs. set of official EN names.
    official_en_set = {o["name_en"].strip().upper() for o in official if o["name_en"]}
    # Famous brands our floor-plan OCR caught but official doesn't have
    # (verified absent: ROCKBROS, PARDUS, JAVA, VELOFOX, etc.)
    keep_ocr_only = {
        # name → (hall, optional cn)
        "ROCKBROS":      ("W1", "洛克兄弟"),
        "PARDUS":        ("W1", "瑞豹"),  # already in official as RUIBAO ?
        "JAVA":          ("W1", "JAVA"),
        "VELOFOX":       ("E5", "VELOFOX"),  # shares booth with HENGTAI per user
        "TUNAP":         ("N1", "TUNAP"),
        "AVENTON":       ("N1", "Aventon"),
    }
    added_ocr = 0
    for en, (hall, cn) in keep_ocr_only.items():
        if en in official_en_set:
            continue
        raw.append({
            "en":    en,
            "cn":    cn,
            "hall":  hall,
            "hallEn": HALL_NAMES_EN.get(hall, ""),
            "scope": "",
            "cats":  [],
            "website": "",
            "booth": "",
            "halls": [hall],
            "_src":  "floor_plan_ocr_only",
        })
        added_ocr += 1
    print(f"Added {added_ocr} OCR-only brands not in official portal")

    # ── exhibitors.csv ──────────────────────────────────────────────
    with CSV.open("w", encoding="utf-8-sig", newline="") as f:
        w = csv.writer(f)
        w.writerow(["Company Name (English)", "Company Name (Chinese)",
                    "Booth/Hall Number", "Hall Name (English)", "Hall Name (Chinese)",
                    "All Booths", "ID"])
        for i, r in enumerate(raw):
            w.writerow([
                r["en"],
                r["cn"],
                r["hall"],
                HALL_NAMES_EN.get(r["hall"], ""),
                HALL_NAMES_CN.get(r["hall"], ""),
                r["booth"],
                f"official_{i}" if "_src" not in r else f"ocr_{i}",
            ])
    print(f"✓ exhibitors.csv: {len(raw)} rows")

    # ── HTML inline RAW[] ──────────────────────────────────────────
    html = HTML.read_text(encoding="utf-8")
    start = html.find("const RAW = [")
    if start < 0:
        raise RuntimeError("Could not find RAW assignment")
    # Find end of array `];`
    # Walk forward bracket-counting to be safe with nested objects
    i = html.find("[", start)
    depth = 0
    end = -1
    in_str = False
    esc = False
    while i < len(html):
        c = html[i]
        if esc:
            esc = False
        elif c == "\\":
            esc = True
        elif c == '"':
            in_str = not in_str
        elif not in_str:
            if c == "[":
                depth += 1
            elif c == "]":
                depth -= 1
                if depth == 0:
                    end = i
                    break
        i += 1
    if end < 0:
        raise RuntimeError("Could not match brackets")

    new_array_body = ",".join(json.dumps(r, ensure_ascii=False) for r in raw)
    new_html = html[:start] + f"const RAW = [{new_array_body}];" + html[end+2:]

    # Update visible counts
    for old, new in [
        (f'<span class="tab-count" id="tc-suppliers">{2787}</span>',
         f'<span class="tab-count" id="tc-suppliers">{len(raw)}</span>'),
        (f'<span class="tab-count" id="tc-suppliers">{3523}</span>',
         f'<span class="tab-count" id="tc-suppliers">{len(raw)}</span>'),
        ('<span class="stat-num">2,787</span><span class="stat-label">Suppliers</span>',
         f'<span class="stat-num">{len(raw):,}</span><span class="stat-label">Suppliers</span>'),
        ('<span class="stat-num">3,523</span><span class="stat-label">Suppliers</span>',
         f'<span class="stat-num">{len(raw):,}</span><span class="stat-label">Suppliers</span>'),
    ]:
        new_html = new_html.replace(old, new)

    HTML.write_text(new_html, encoding="utf-8")
    delta = len(new_html) - len(html)
    print(f"✓ china_cycle_suppliers.html: {delta:+,} bytes (RAW now {len(raw)} entries)")

if __name__ == "__main__":
    main()
