#!/usr/bin/env python3
"""
Couche 1 — devinette de domaines vérifiée par le contenu.

Pour chaque exposant sans site web, on génère des candidats de domaine à
partir de la marque et de la raison sociale (EN + CN), on résout le DNS,
on récupère la page d'accueil et on n'accepte le domaine que si la page
mentionne la raison sociale chinoise, la marque ou la raison sociale EN.

Sortie : data/websites/guess_results.json
  { "<id>": { "url", "confidence", "evidence", "method": "domain_guess" } }
  + "_rejected": { "<id>": [candidats testés] }   (pour ne pas retester)

Usage : python3 scripts/websites/guess_domains.py [--limit N] [--workers 40] [--ids id1,id2]
"""
import argparse, concurrent.futures as cf, json, re, socket, ssl, sys, time, urllib.request, http.client
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
HTML = ROOT / "china_cycle_suppliers.html"
OUT_DIR = ROOT / "data" / "websites"
OUT = OUT_DIR / "guess_results.json"

TLDS = ["com", "cn", "com.cn"]
CITY_ABBR = {
    "SHENZHEN": "sz", "GUANGZHOU": "gz", "SHANGHAI": "sh", "NINGBO": "nb", "TIANJIN": "tj",
    "SUZHOU": "sz", "HANGZHOU": "hz", "DONGGUAN": "dg", "WUXI": "wx", "XIAMEN": "xm",
    "KUNSHAN": "ks", "TAIZHOU": "tz", "WENZHOU": "wz", "JINHUA": "jh", "FOSHAN": "fs",
    "ZHONGSHAN": "zs", "HUIZHOU": "hz", "CHANGZHOU": "cz", "NANJING": "nj", "BEIJING": "bj",
    "QINGDAO": "qd", "YANTAI": "yt", "WEIFANG": "wf", "TIANTAI": "tt", "JIAXING": "jx",
}
CORP_TOKENS = {"CO", "LTD", "LIMITED", "INC", "CORP", "CORPORATION", "COMPANY", "GROUP",
               "HOLDINGS", "HOLDING", "INTERNATIONAL", "INDUSTRIAL", "INDUSTRY", "INDUSTRIES",
               "TRADING", "TRADE", "IMPORT", "EXPORT", "IMP", "EXP", "TECHNOLOGY", "TECH",
               "TECHNOLOGIES", "MANUFACTURING", "MANUFACTURE", "PRODUCTS", "PRODUCT",
               "DEVELOPMENT", "SCIENCE", "MACHINERY", "ELECTRONICS", "ELECTRONIC", "ELECTRIC",
               "ENTERPRISE", "ENTERPRISES", "COMMERCIAL", "COMMERCE", "THE", "AND", "OF", "SHI",
               "VEHICLE", "VEHICLES", "ACCESSORIES", "ACCESSORY", "PARTS", "PART", "SPORTS", "SPORT",
               "BICYCLE", "BICYCLES", "BIKE", "BIKES", "CYCLE", "CYCLES", "CYCLING", "EQUIPMENT",
               "APPARATUS", "PRECISION", "PLASTIC", "PLASTICS", "RUBBER", "HARDWARE", "METAL",
               "METALS", "NEW", "ENERGY", "POWER", "MOTOR", "MOTORS", "ELECTRICAL", "INTELLIGENT",
               "SMART", "OUTDOOR", "GOODS", "SUPPLY", "CHAIN", "AUTO", "AUTOMOBILE", "LIGHTING",
               "LIGHT", "TOOLS", "TOOL", "GEAR", "FITNESS", "LEISURE", "CARBON", "FIBER", "FIBRE",
               "COMPOSITE", "COMPOSITES", "ALUMINUM", "ALUMINIUM", "ALLOY", "STEEL", "MATERIAL",
               "MATERIALS", "TEXTILE", "TEXTILES", "GARMENT", "GARMENTS", "APPAREL", "MOULD", "MOLD",
               "TYRE", "TIRE", "TYRES", "TIRES", "BATTERY", "BATTERIES", "SEAT", "SADDLE", "FRAME"}
CN_GENERIC = re.compile(r"(运动器材|车辆配件|自行车配件|自行车零件|电动车|自行车|运动用品|户外用品|塑料制品|橡胶制品|精密机械|机械设备|机械|电子科技|科技发展|科技|贸易|商贸|实业|电子|工贸|制造|制品|进出口|新材料|新能源|电器|五金|金属|车业|车料|车件|轮胎|复合材料|碳纤维|材料|智能|工业|发展|投资|国际|集团|控股|技术|器材|设备|用品|配件|零部件|部件|车行|体育|户外|服饰|服装|纺织|模具|动力|能源|照明|工具|电机|电池|车架|鞍座|坐垫)")
CITIES_EN = set(CITY_ABBR) | {"HEBEI", "JIANGSU", "ZHEJIANG", "FUJIAN", "GUANGDONG", "SHANDONG",
    "SICHUAN", "HENAN", "ANHUI", "HUBEI", "HUNAN", "JIANGXI", "SHANXI", "SHAANXI", "GUANGXI",
    "CHONGQING", "CHENGDU", "WUHAN", "CHANGSHA", "ZHENGZHOU", "JINAN", "SHIJIAZHUANG", "XINGTAI",
    "PINGXIANG", "LANXI", "YIWU", "TAICANG", "ZHANGJIAGANG", "HUZHOU", "DEQING", "ANJI", "TAIWAN",
    "HONG", "KONG", "CHINA", "TIANCHANG", "XINGYUAN", "GUANGZHOU"}
PARKED = ["domain for sale", "buy this domain", "此域名可出售", "域名出售", "域名转让", "hugedomains",
          "afternic", "sedo.com", "dan.com", "godaddy", "parked", "namebright", "站点已暂停",
          "该网站暂时无法访问", "website coming soon", "domain is for sale", "aliyun.com/domain",
          "west.cn", "网站建设中", "the site is under construction", "未备案", "temporarily unavailable"]
CYCLING_KW = ["自行车", "电动车", "单车", "骑行", "车架", "轮胎", "鞍座", "头盔", "脚踏", "链条", "变速", "车灯",
              "电踏车", "助力车", "滑板车", "童车", "车把", "轮组", "花鼓", "碟刹", "刹车", "内胎", "外胎", "坐垫",
              "电踏车", "锂电池"]
CYCLING_EN = re.compile(r"\b(bicycles?|bikes?|cycling|e-?bikes?|pedelecs?|e-?scooters?|helmets?|saddles?|wheelsets?|"
                        r"derailleurs?|cranksets?|handlebars?|pedals?|inner tubes?|bike frames?|bicycle parts|"
                        r"hub motors?|mid-?drive|cyclists?)\b", re.I)
CN_SUFFIX = re.compile(r"(股份)?(有限)?(责任)?公司|集团|股份|有限$")
CN_CITY = re.compile(r"^(深圳|广州|上海|宁波|天津|苏州|杭州|东莞|无锡|厦门|昆山|台州|温州|金华|佛山|中山|惠州|常州|南京|北京|青岛|烟台|潍坊|嘉兴|重庆|成都|武汉|长沙|郑州|济南|石家庄|邢台|萍乡|兰溪|义乌|太仓|张家港|湖州|德清|安吉|天长|河北|江苏|浙江|福建|广东|山东|四川|河南|安徽|湖北|湖南|江西|山西|陕西|广西|香港|中国|平湖|余姚|慈溪|瑞安|永康|乐清|新昌|天台|三门|临海|黄岩|路桥|椒江|玉环|温岭|仙居|海宁|桐乡|绍兴|诸暨|上虞|嵊州|丽水|衢州|舟山|扬州|镇江|南通|泰州|徐州|盐城|淮安|连云港|宿迁|泉州|漳州|莆田|福州|珠海|江门|肇庆|汕头|揭阳|潮州|清远|韶关|河源|梅州|湛江|茂名|阳江|云浮|保定|唐山|廊坊|沧州|衡水|邯郸|秦皇岛|张家口|承德|大连|沈阳|长春|哈尔滨|西安|太原|合肥|芜湖|南昌|昆明|贵阳|南宁|海口|乌鲁木齐|兰州|银川|西宁|呼和浩特|拉萨)(市|省)?")

def load_raw():
    html = HTML.read_text(encoding="utf-8")
    start = html.find("const RAW = ["); ob = html.find("[", start)
    depth, i, ins, esc = 0, ob, False, False
    while i < len(html):
        c = html[i]
        if esc: esc = False
        elif c == "\\": esc = True
        elif c == '"': ins = not ins
        elif not ins:
            if c == "[": depth += 1
            elif c == "]":
                depth -= 1
                if depth == 0: end = i; break
        i += 1
    return json.loads("[" + html[ob + 1:end] + "]")

def slug(s):
    return re.sub(r"[^a-z0-9]", "", s.lower())

def en_tokens(en):
    en = re.sub(r"\(.*?\)", " ", en.upper())
    en = re.sub(r"\b((?:[A-Z]\.){2,})", lambda m: m.group(1).replace(".", ""), en)  # K.S.D. -> KSD
    toks = [t for t in re.split(r"[^A-Z0-9]+", en) if t]
    return [t for t in toks if t not in CORP_TOKENS]

def cn_core(cn):
    cn = re.sub(r"[（(【\[].*?[）)】\]]", "", cn or "").strip()
    cn = cn.split("/")[0].strip()
    cn = CN_SUFFIX.sub("", cn)
    nocity = CN_CITY.sub("", cn)
    short = CN_GENERIC.sub("", nocity)
    cores = [c for c in {cn, nocity} if len(c) >= 3]
    if 2 <= len(short) < len(nocity) and short not in cores: cores.append(short)
    return sorted(cores, key=len, reverse=True)

def candidates(entry):
    names = []
    brand = (entry.get("brand") or "").upper()
    for part in re.split(r"\s*/\s*", brand):
        part = part.strip()
        if not part: continue
        toks = [t for t in re.split(r"[^A-Z0-9]+", part) if t]
        if not toks: continue
        joined = slug(part)
        if 3 <= len(joined) <= 24: names.append(joined)
        if len(toks) > 1:
            names.append("-".join(t.lower() for t in toks))
            if len(toks[0]) >= 4: names.append(toks[0].lower())
    toks = en_tokens(entry.get("en", ""))
    city = next((t for t in toks if t in CITIES_EN), None)
    distinct = [t for t in toks if t not in CITIES_EN and len(t) >= 3]
    if distinct:
        first = distinct[0].lower()
        names.append(first)
        if len(distinct) > 1:
            names.append(first + distinct[1].lower())
        if city and city in CITY_ABBR:
            names.append(CITY_ABBR[city] + first)
        if city:
            names.append(city.lower() + first)
    # Variantes secteur
    base = [n for n in names if n and "-" not in n][:3]
    for n in base:
        if len(n) <= 12:
            names += [n + "bike", n + "bikes", n + "ebike", n + "cycle", n + "bicycle", n + "sports"]
    seen, out = set(), []
    for n in names:
        n = n.strip("-")
        if len(n) < 3 or n in seen or n.isdigit(): continue
        seen.add(n); out.append(n)
    return out[:9]

def resolves(host):
    try:
        socket.setdefaulttimeout(3)
        socket.getaddrinfo(host, 80)
        return True
    except Exception:
        return False

CTX = ssl.create_default_context(); CTX.check_hostname = False; CTX.verify_mode = ssl.CERT_NONE
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"

def fetch(url, timeout=8):
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8"})
    with urllib.request.urlopen(req, timeout=timeout, context=CTX) as r:
        raw = r.read(400_000)
        final = r.geturl()
    for enc in ("utf-8", "gb18030"):
        try: return final, raw.decode(enc)
        except Exception: pass
    return final, raw.decode("utf-8", "ignore")

def verify(entry, text, host=""):
    low = text.lower()
    if any(p in low for p in PARKED): return None
    title = re.search(r"<title[^>]*>(.*?)</title>", text, re.S | re.I)
    title = re.sub(r"\s+", " ", title.group(1)).strip() if title else ""
    tl = title.lower()
    h = host.lower().removeprefix("www.")
    if tl in ("", h, "www." + h, h.split(".")[0]) or "for sale" in tl or "出售" in tl:
        return None  # titre = nom de domaine nu : page parking
    ev = []
    cores = cn_core(entry.get("cn", ""))
    for c in cores:
        if c in text:
            ev.append(("cn:" if len(c) >= 3 else "cn2:") + c); break
    brand = (entry.get("brand") or "")
    for part in re.split(r"\s*/\s*", brand):
        p = part.strip().lower()
        if len(p) >= 3 and (p in tl):
            ev.append(f"brand-in-title:{part.strip()}"); break
        if len(p) >= 4 and p in low:
            ev.append(f"brand-in-body:{part.strip()}"); break
    toks = [t for t in en_tokens(entry.get("en", "")) if t not in CITIES_EN and len(t) >= 4]
    for t in toks[:2]:
        if t.lower() in tl:
            ev.append(f"en-in-title:{t}"); break
    if not ev: return None
    cycling = [k for k in CYCLING_KW if k in text] + sorted({m.lower() for m in CYCLING_EN.findall(text)})[:3]
    cn_hit = any(e.startswith("cn:") for e in ev)
    title_hit = any(e.startswith(("brand-in-title", "en-in-title")) for e in ev)
    if cn_hit:
        conf = "high"
    elif title_hit and cycling:
        conf = "high" if len(ev) >= 2 else "medium"
    else:
        return None  # marque dans le corps seulement, ou titre sans vocabulaire vélo : rejet
    if cycling: ev.append("cycling:" + ",".join(cycling[:3]))
    return {"confidence": conf, "evidence": ev, "title": title[:120]}

def hosts_for(entry):
    out = []
    for name in candidates(entry):
        for tld in TLDS:
            out.append(f"{name}.{tld}")
    return out

def try_entry(entry, live):
    """live : ensemble des domaines nus qui résolvent (calculé en masse avant)."""
    tried = []
    for bare in hosts_for(entry):
        if bare not in live: continue
        host = "www." + bare
        for url in (f"https://{host}", f"http://{host}", f"https://{bare}"):
            tried.append(url)
            try:
                final, text = fetch(url)
            except Exception:
                continue
            v = verify(entry, text, host=bare)
            if v:
                v.update({"url": final.rstrip("/") if final.count("/") <= 3 else final, "method": "domain_guess"})
                return entry["id"], v, tried
            break  # page reçue mais non vérifiée : inutile de retenter les autres schémas
    return entry["id"], None, tried

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=0)
    ap.add_argument("--workers", type=int, default=40)
    ap.add_argument("--ids", default="")
    ap.add_argument("--retry-rejected", action="store_true")
    args = ap.parse_args()

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    results = json.loads(OUT.read_text()) if OUT.exists() else {}
    rejected = results.setdefault("_rejected", {})

    raw = load_raw()
    want = set(args.ids.split(",")) if args.ids else None
    todo = [e for e in raw if not e.get("website") and (want is None or e["id"] in want)
            and e["id"] not in results and (args.retry_rejected or e["id"] not in rejected)]
    if args.limit: todo = todo[:args.limit]
    print(f"{len(raw)} exposants, {len(todo)} à tester", file=sys.stderr)

    t0 = time.time(); found = 0
    # Phase 1 : résolution DNS en masse (bare + www), 200 threads
    all_hosts = sorted({h for e in todo for h in hosts_for(e)})
    print(f"Phase 1 : {len(all_hosts)} domaines à résoudre", file=sys.stderr)
    live = set()
    def _res(h):
        return h, (resolves(h) or resolves("www." + h))
    with cf.ThreadPoolExecutor(max_workers=200) as ex:
        for n, (h, ok) in enumerate(ex.map(_res, all_hosts), 1):
            if ok: live.add(h)
            if n % 2000 == 0: print(f"… DNS {n}/{len(all_hosts)} ({len(live)} vivants, {time.time()-t0:.0f}s)", file=sys.stderr)
    print(f"Phase 1 terminée : {len(live)} domaines vivants en {time.time()-t0:.0f}s", file=sys.stderr)
    # Phase 2 : fetch + vérification
    with cf.ThreadPoolExecutor(max_workers=args.workers) as ex:
        for n, (eid, v, tried) in enumerate(ex.map(lambda e: try_entry(e, live), todo), 1):
            if v:
                results[eid] = v; found += 1
                print(f"✓ {eid} {v['confidence']:6} {v['url']}  {v['evidence']}", file=sys.stderr)
            else:
                rejected[eid] = tried
            if n % 50 == 0:
                OUT.write_text(json.dumps(results, ensure_ascii=False, indent=1))
                print(f"… {n}/{len(todo)} ({found} trouvés, {time.time()-t0:.0f}s)", file=sys.stderr)
    OUT.write_text(json.dumps(results, ensure_ascii=False, indent=1))
    print(f"Terminé : {found} sites trouvés sur {len(todo)} en {time.time()-t0:.0f}s → {OUT}", file=sys.stderr)

if __name__ == "__main__":
    main()
