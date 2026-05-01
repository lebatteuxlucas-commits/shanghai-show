#!/usr/bin/env python3
"""
Two-pass brand population:
  Pass 1 — apply OCR'd brands from floor_plan_brands.json (already done by
           apply_brands.py, but we redo it here authoritatively).
  Pass 2 — for any entry still without a brand, auto-derive a sensible
           commercial name from the canonical EN company name.

The auto-derivation strips:
  - Parenthesized geographic qualifiers: "(SHANGHAI)", "(KUNSHAN)" …
  - Corporate suffixes: CO., LTD, INC, GROUP, CORPORATION …
  - City / province prefixes: SHANGHAI, NINGBO, GUANGZHOU, TIANJIN …
  - Generic industry tokens: BICYCLE, RUBBER, TECHNOLOGY, MACHINERY …

It then keeps the most distinctive 1–2 tokens left. We mark each entry's
`brand_source` as "plan" (read from the JPG) or "auto" (derived) so the UI
can hint at the difference if we want to.

Outputs:
  - exhibitors.csv  (Brand column populated for all rows)
  - china_cycle_suppliers.html  (`brand` field on every RAW[] entry)
"""

import csv, json, re
from pathlib import Path

ROOT = Path("/Users/lucaslebatteux/Developer/Clauderie/shanghai-show")
HTML = ROOT / "china_cycle_suppliers.html"
CSV  = ROOT / "exhibitors.csv"
BRANDS = ROOT / "floor_plan_brands.json"

# Booth pattern: hall-code separated by '-' from the 4-digit code.
BOOTH_RE = re.compile(r"([EWN]\d)-(\w+)")

# Cities and provinces commonly seen as a leading prefix in registered names.
CITY_PREFIXES = sorted([
    "SHANGHAI", "NINGBO", "GUANGZHOU", "TIANJIN", "SUZHOU",
    "HEBEI", "JIANGSU", "ZHEJIANG", "FUJIAN", "GUANGDONG", "SHANDONG",
    "SICHUAN", "HENAN", "ANHUI", "HUBEI", "HUNAN", "JIANGXI", "GANSU",
    "SHANXI", "SHAANXI", "HAINAN", "INNER MONGOLIA", "GUANGXI",
    "LIAONING", "JILIN", "HEILONGJIANG", "YUNNAN", "GUIZHOU", "CHONGQING",
    "QINGHAI", "TIBET", "XINJIANG",
    "CHANGZHOU", "WUXI", "WENZHOU", "DONGGUAN", "SHENZHEN", "TAIWAN",
    "TAICHUNG", "BEIJING", "KUNSHAN", "HANGZHOU", "NANJING", "XIAMEN",
    "CIXI", "XINGTAI", "YIWU", "PINGXIANG", "HUIZHOU", "JINHUA",
    "JIANGYIN", "TAICANG", "YANTAI", "JINAN", "QINGDAO", "ZHUHAI",
    "DALIAN", "HARBIN", "FOSHAN", "JURONG", "ZHENJIANG", "NANTONG",
    "TANGSHAN", "BAODING", "SHIJIAZHUANG", "HANDAN", "LANGFANG",
    "RUIAN", "XINGTAI", "YANCHENG", "YANGZHOU", "TAIZHOU", "YUEQING",
    "TAIZHOU", "HAINING", "JIAXING", "WUHAN", "CHENGDU", "CHONGQING",
    "YIWU", "JINHUA", "JIASHAN", "PUTIAN", "QUANZHOU", "SHANTOU",
    "ZHONGSHAN", "YONGKANG", "DEZHOU", "WEIFANG", "LINYI", "BINZHOU",
    "ZAOZHUANG", "ZIBO", "RIZHAO", "HEZE", "XUZHOU", "LIANYUNGANG",
    "SUQIAN", "HUAIAN", "HEFEI", "WUHU", "BENGBU", "MAANSHAN", "FUYANG",
    "BENGBU", "ANSHAN", "DALIAN", "FUSHUN", "ZHANJIANG", "MEIZHOU",
    "QINGYUAN", "XIAOSHAN", "WUYI", "DEQING", "XINCHANG",
], key=len, reverse=True)

# Words that flag a "company type" — strip them and everything after the
# corporate suffix.
SUFFIX_PATTERNS = [
    r"\bCO\.\s*,\s*LTD\.?",
    r"\bCO\.\s*LTD\.?",
    r"\bCO\.\s*,",
    r"\bCO\b\.?,?",
    r"\bLTD\b\.?",
    r"\bINC\b\.?",
    r"\bCORP\b\.?",
    r"\bCORPORATION\b",
    r"\bCOMPANY\b",
    r"\bSRL\b",
    r"\bGMBH\b",
    r"\bA\.?G\b",
    r"\bAB\b",
    r"\bAS\b",
    r"\bGROUP\b",
    r"\bHOLDING\b",
    r"\bHOLDINGS\b",
    r"\bENTERPRISES?\b",
    r"\bSTOCK\b",
    r"\bSHARES?\b",
    r"\bLIMITED\b",
    r"\bIMPORT\b",
    r"\bEXPORT\b",
    r"\bSALES\b",
    r"\bSALES\s+CORPORATION\b",
    r"\bTRADING\b",
    r"\bTRADE\b",
    r"\bMANUFACTURING\b",
    r"\bMANUFACTURER\b",
    r"\bPRODUCTS?\b",
]

# Generic domain tokens that, by themselves, are not a brand.
INDUSTRY_TOKENS = {
    "BICYCLE", "BICYCLES", "BIKE", "BIKES", "VEHICLE", "VEHICLES",
    "RUBBER", "PLASTIC", "PLASTICS", "METAL", "METALS", "ALLOY",
    "STEEL", "ALUMINUM", "ALUMINIUM", "CARBON", "FIBER",
    "TIRES", "TIRE", "TYRE", "TYRES", "CHAIN", "CHAINS",
    "SADDLE", "SADDLES", "PUMP", "PUMPS",
    "PARTS", "ACCESSORIES", "ACCESSORY", "COMPONENTS", "COMPONENT",
    "TECHNOLOGY", "TECHNOLOGIES", "TECH", "TEC",
    "ELECTRONICS", "ELECTRONIC", "ELECTRIC", "ELECTRICAL",
    "MACHINERY", "MACHINE", "INDUSTRIAL", "INDUSTRY", "INDUSTRIES",
    "INTERNATIONAL", "INTL", "GLOBAL", "WORLDWIDE",
    "SPORTS", "SPORT", "SPORTING", "GOODS",
    "OUTDOOR", "INDOOR", "EQUIPMENT",
    "APPARATUS", "DEVICE", "DEVICES",
    "DRIVE", "DRIVES", "MOTOR", "MOTORS", "POWER", "ENERGY",
    "BATTERY", "BATTERIES", "CELL", "CELLS",
    "LIGHTING", "LIGHT", "LIGHTS", "LAMP",
    "TOOL", "TOOLS", "HARDWARE",
    "MATERIAL", "MATERIALS",
    "TRADE", "BUSINESS",
    "FOR", "AND", "&",
    "NEW", "ENERGY",
    "PRECISION",
    "INNOVATION",
    "INNOVATIONS",
    "DESIGN", "DESIGNS",
    "DEVELOPMENT",
    "RESEARCH",
    "SOLUTIONS", "SOLUTION",
    "SYSTEM", "SYSTEMS",
    "ENGINEERING", "ENGINEER",
    "INTELLIGENT", "INTELLIGENCE",
    "AUTOMATIC",
    "PROFESSIONAL",
    "PRO",
    "CYCLE",
    "CYCLING",
    "CHILDREN'S",
    "KIDS",
    "TOY",
    "TOYS",
    "TRADING",
    "COUNTY",
    "DISTRICT",
    "TOWN",
    "VILLAGE",
    "MANUFACTURING", "MANUFACTURE", "MANUFACTURER",
    "INDUSTRIAL", "INDUSTRY", "INDUSTRIES",
    "TECHNOLOGY", "TECHNOLOGIES", "TECH",
    "EQUIPMENT", "APPARATUS", "DEVICES",
    "PRECISION", "MECHANICAL",
    "INTERNATIONAL", "GLOBAL",
    "ENERGY", "POWER",
    "SUPPLY", "SUPPLIES",
    "PRODUCT", "PRODUCTS",
    "PARTS", "ACCESSORIES",
    "CHILDREN", "KIDS", "BABY",
    "SAFETY",
    "PROTECTION",
    "SOLUTIONS",
}

CN_REGION_PREFIXES = [
    "内蒙古", "黑龙江", "石家庄", "邯郸市", "邢台市", "天津市", "上海市", "广宗县",
    "天津", "北京", "上海", "重庆",
    "河北", "河南", "山东", "山西", "陕西", "甘肃", "青海", "新疆", "西藏", "宁夏",
    "云南", "贵州", "四川", "重庆", "湖北", "湖南", "广东", "广西", "海南", "福建",
    "台湾", "江苏", "浙江", "安徽", "江西", "辽宁", "吉林", "黑龙",
    "邢台", "邯郸", "石家", "保定", "张家口", "承德", "唐山", "廊坊", "沧州",
    "宁波", "杭州", "温州", "上海", "天津", "北京", "广州", "深圳", "苏州", "无锡",
    "南京", "成都", "武汉", "西安", "厦门", "义乌", "东莞", "佛山", "中山", "汕头",
    "昆山", "常州", "镇江", "扬州", "南通", "盐城", "徐州", "连云港", "宿迁", "泰州",
    "嘉兴", "湖州", "绍兴", "金华", "衢州", "丽水", "舟山", "台州", "永康", "瑞安",
    "济南", "青岛", "烟台", "潍坊", "临沂", "淄博", "枣庄", "东营", "威海", "日照",
    "莱芜", "德州", "聊城", "滨州", "菏泽",
]

CN_GENERIC_SUFFIXES = [
    "股份有限公司", "有限责任公司", "有限公司", "工贸有限公司",
    "儿童玩具制造有限公司", "儿童玩具有限公司", "儿童玩具",
    "自行车制造有限公司", "自行车制造", "自行车配件", "自行车",
    "童车有限公司", "童车制造", "童车", "电动车", "电动自行车",
    "车业有限公司", "车业", "实业有限公司", "实业",
    "气筒制造有限公司", "气筒制造", "气筒",
    "进出口有限公司", "进出口", "贸易有限公司", "贸易",
    "科技有限公司", "科技", "技术有限公司", "技术",
    "电子有限公司", "电子", "电气有限公司", "电气",
    "机械有限公司", "机械", "工业有限公司", "工业",
    "塑料有限公司", "塑料", "金属有限公司", "金属",
    "文具有限公司", "文具", "运动器材", "运动器材有限公司",
    "工艺品有限公司", "工艺品",
    "市", "县", "区",
]

def cn_auto_brand(name: str) -> str:
    if not name: return ""
    s = name
    # Strip ONE leading region/city token only — looping would also chew off
    # cities that double as brand names (e.g. 瑞安 / Ruian which is also a
    # legit company brand).
    for region in sorted(CN_REGION_PREFIXES, key=len, reverse=True):
        if s.startswith(region):
            s = s[len(region):]
            break
    # Strip trailing generic suffixes (longest first)
    changed = True
    while changed:
        changed = False
        for suf in sorted(CN_GENERIC_SUFFIXES, key=len, reverse=True):
            if s.endswith(suf):
                s = s[:-len(suf)]
                changed = True
                break
    return s.strip()

CJK_RE = re.compile(r"[一-鿿]")
def auto_brand(name: str) -> str:
    """Best-effort commercial brand from a corporate name."""
    if not name:
        return ""
    # The source data occasionally pasted a Chinese name into the EN field —
    # fall through to the CN-aware extractor when we detect CJK characters.
    if CJK_RE.search(name):
        return cn_auto_brand(name)
    s = name.upper().strip()
    # Remove parenthesized regions / qualifiers
    s = re.sub(r"\([^)]*\)", " ", s)
    s = re.sub(r"【[^】]*】", " ", s)   # CJK brackets occasionally appear
    # Cut everything from first corporate suffix onwards. We scan all
    # patterns and keep the *earliest* match position, so multi-word
    # suffixes like "MANUFACTURING CO., LTD." trim correctly.
    earliest = len(s)
    for pat in SUFFIX_PATTERNS:
        m = re.search(pat, s)
        if m and m.start() < earliest:
            earliest = m.start()
    s = s[:earliest]
    # Drop trailing punctuation
    s = re.sub(r"[\.,;:'\"]+", " ", s)
    s = re.sub(r"\s+", " ", s).strip()
    # Strip leading city / province prefixes (greedy, longest first)
    changed = True
    while changed:
        changed = False
        for city in CITY_PREFIXES:
            if s.startswith(city + " "):
                s = s[len(city) + 1:].strip()
                changed = True
                break
    # Tokenize and keep up to 2 leading non-industry tokens
    toks = [t for t in s.split() if t and t not in INDUSTRY_TOKENS]
    if not toks:
        # If everything was generic, fall back to the original first word
        toks = name.upper().strip().split()[:1]
    # Cap at 2 tokens — most floor-plan brands are one word, two at most
    return " ".join(toks[:2]).strip()

def lookup_plan(booth_str: str, brand_map: dict) -> str:
    pieces = []
    for m in BOOTH_RE.finditer(booth_str or ""):
        b = brand_map.get(m.group(1), {}).get(m.group(2))
        if b and b not in pieces:
            pieces.append(b)
    return " / ".join(pieces)

def main():
    brand_map = json.loads(BRANDS.read_text(encoding="utf-8"))["halls"]

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

    plan_count, auto_count = 0, 0
    for o in objects:
        plan_brand = lookup_plan(o.get("booth", ""), brand_map)
        if plan_brand:
            o["brand"] = plan_brand
            o["brand_source"] = "plan"
            plan_count += 1
        else:
            derived = auto_brand(o.get("en", ""))
            if not derived:
                # Fall back to Chinese-name derivation when EN is empty.
                derived = cn_auto_brand(o.get("cn", ""))
            if derived:
                o["brand"] = derived
                o["brand_source"] = "auto"
                auto_count += 1
            elif "brand" in o:
                del o["brand"]

    print(f"  from plan OCR: {plan_count}")
    print(f"  auto-derived:  {auto_count}")
    print(f"  total covered: {plan_count + auto_count} / {len(objects)}")

    new_array = ",".join(json.dumps(o, ensure_ascii=False) for o in objects)
    HTML.write_text(html[:open_br + 1] + new_array + html[end:], encoding="utf-8")
    print(f"✓ china_cycle_suppliers.html updated")

    # ── exhibitors.csv ──────────────────────────────────────────────
    with CSV.open(encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        rows = list(reader)
        fieldnames = reader.fieldnames

    if "Brand" not in fieldnames:
        # Insert "Brand" right after "All Booths" if present
        if "All Booths" in fieldnames:
            i = fieldnames.index("All Booths") + 1
            fieldnames = fieldnames[:i] + ["Brand"] + fieldnames[i:]
        else:
            fieldnames = fieldnames + ["Brand"]

    obj_by_sig = {(o["en"], o.get("booth","")): o for o in objects}

    for r in rows:
        sig = (r.get("Company Name (English)",""), r.get("All Booths","") or r.get("Booth/Hall Number",""))
        o = obj_by_sig.get(sig)
        if o and "brand" in o:
            r["Brand"] = o["brand"]
        else:
            r.setdefault("Brand", "")

    with CSV.open("w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, fieldnames=fieldnames); w.writeheader(); w.writerows(rows)
    print(f"✓ exhibitors.csv updated")

if __name__ == "__main__":
    main()
