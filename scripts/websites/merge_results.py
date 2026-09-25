#!/usr/bin/env python3
"""
Fusionne les trois couches de recherche en website_lookups_v2.json (clé = id exposant) :
  - data/websites/official_details.json   (couche 0, site déclaré par l'exposant sur api.e-chinacycle.com)
  - data/websites/guess_results.json      (couche 1, devinette de domaine vérifiée)
  - data/websites/agent_results/*.json    (couche 2, agents WebSearch)

Règle : le site déclaré officiellement l'emporte ; puis un "high" de la devinette ;
puis le résultat de l'agent (found) ; puis le "medium" de la devinette.
Les entrées déjà pourvues d'un site manuel/phase A ne sont pas écrasées.
"""
import json, glob
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
GUESS = ROOT / "data/websites/guess_results.json"
AGENTS = sorted(glob.glob(str(ROOT / "data/websites/agent_results/*.json")))
OUT = ROOT / "website_lookups_v2.json"

guess = json.loads(GUESS.read_text()) if GUESS.exists() else {}
guess.pop("_rejected", None)
agent = {}
for f in AGENTS:
    try:
        agent.update(json.loads(Path(f).read_text()))
    except Exception as e:
        print(f"! {f}: {e}")

# Couche 0 : détails officiels, rapprochés par raison sociale CN puis EN
import sys, re
sys.path.insert(0, str(ROOT / "scripts/websites"))
from guess_domains import load_raw
OFFICIAL = ROOT / "data/websites/official_details.json"
official = {}; official_store = {}
STOREFRONT = re.compile(r"(alibaba\.com|1688\.com|made-in-china\.com|globalsources\.com|taobao|tmall|tb\.cn|jd\.com|amazon\.)", re.I)
def norm_site(w):
    w = (w or "").strip().replace("：", ":").replace("。", ".")
    w = re.sub(r"^(website|site|web|网址|官网)\s*[:：]\s*", "", w, flags=re.I)
    w = re.sub(r"^(https?):/{1,2}(?!/)", r"\1://", w)      # http:/x → http://x
    w = re.sub(r"^https?:(?!//)", "http://", w)             # http:kingas → http://kingas
    w = re.sub(r"^(www)\.\s+", r"\1.", w, flags=re.I)     # "www. site.com"
    w = w.split()[0] if w.split() else ""
    if "@" in w or not re.search(r"[a-z0-9-]+\.[a-z]{2,}", w, re.I): return None
    if not re.match(r"https?://", w, re.I): w = "http://" + w
    w = re.sub(r"^(https?)://", lambda m: m.group(1).lower() + "://", w, flags=re.I)
    return w.rstrip("/") if w.count("/") <= 3 else w
if OFFICIAL.exists():
    det = json.loads(OFFICIAL.read_text())
    by_cn = {}; by_en = {}
    for d in det.values():
        w = norm_site(d.get("website"))
        if not w: continue
        by_cn.setdefault((d.get("name") or "").strip(), w)
        by_en.setdefault((d.get("nameEn") or "").strip().upper(), w)
    for e in load_raw():
        w = by_cn.get((e.get("cn") or "").strip()) or by_en.get((e.get("en") or "").strip().upper())
        if not w: continue
        (official_store if STOREFRONT.search(w) else official)[e["id"]] = w
print(f"couche 0 : {len(official)} sites déclarés rapprochés (+{len(official_store)} vitrines Alibaba/1688 déclarées)")

# On ne conserve de l'ancien fichier que les entrées saisies à la main : tout le reste est recalculé.
prev = json.loads(OUT.read_text())["lookups"] if OUT.exists() else {}
out = {k: v for k, v in prev.items() if v.get("source") == "manual"}; review = {}
stats = {"official": 0, "guess_high": 0, "agent": 0, "guess_medium": 0, "storefront_only": 0, "none": 0}
for eid in set(guess) | set(agent) | set(official) | set(official_store):
    g = guess.get(eid); a = agent.get(eid) or {}
    if eid in official:
        out[eid] = {"url": official[eid], "source": "official_api", "confidence": "high", "evidence": "website déclaré par l'exposant (api.e-chinacycle.com)"}
        stats["official"] += 1
    elif g and g["confidence"] == "high":
        out[eid] = {"url": g["url"], "source": "domain_guess", "confidence": "high", "evidence": g["evidence"]}
        stats["guess_high"] += 1
    elif a.get("status") == "found" and a.get("url"):
        out[eid] = {"url": a["url"], "source": "websearch", "confidence": a.get("confidence", "medium"), "evidence": a.get("evidence", "")}
        stats["agent"] += 1
    elif g:
        review[eid] = {"url": g["url"], "source": "domain_guess", "confidence": g["confidence"], "evidence": g["evidence"], "title": g.get("title", "")}
        stats["guess_medium"] += 1
    elif a.get("storefront") or eid in official_store:
        out[eid] = {"url": "", "storefront": official_store.get(eid) or a.get("storefront"), "source": "official_api" if eid in official_store else "websearch", "confidence": "none"}
        stats["storefront_only"] += 1
    else:
        stats["none"] += 1
MANUAL = ROOT / "data/websites/manual_accepted.json"
if MANUAL.exists():
    for eid, m in json.loads(MANUAL.read_text()).items():
        if eid.startswith("_"): continue
        out[eid] = {"url": m["url"], "source": "manual", "confidence": "high", "evidence": m.get("evidence", "validé à la main")}
        review.pop(eid, None); stats["manual"] = stats.get("manual", 0) + 1
BLOCK = ROOT / "data/websites/blocklist.json"
if BLOCK.exists():
    blocked = {k: v for k, v in json.loads(BLOCK.read_text()).items() if not k.startswith("_")}
    def host(u): return re.sub(r"^https?://(www\.)?", "", (u or "").lower()).rstrip("/").split("/")[0]
    for eid, b in blocked.items():
        if eid in out and host(out[eid].get("url")) == host(b["url"]):
            out.pop(eid); review.pop(eid, None); stats["blocked"] = stats.get("blocked", 0) + 1
        elif eid in review and host(review[eid]["url"]) == host(b["url"]):
            review.pop(eid); stats["blocked"] = stats.get("blocked", 0) + 1
OUT.write_text(json.dumps({"_meta": {"method": "domain_guess (scripts/websites/guess_domains.py) + agents WebSearch (.claude/agents/website-finder.md)",
                                      "key": "id exposant (RAW[].id)"}, "lookups": out}, ensure_ascii=False, indent=1))
REVIEW = ROOT / "data/websites/to_review.csv"
import csv
raw_by_id = {e["id"]: e for e in load_raw()}
with REVIEW.open("w", encoding="utf-8-sig", newline="") as f:
    w = csv.writer(f); w.writerow(["id", "brand", "company_en", "company_cn", "hall", "booth", "url_candidate", "page_title", "evidence", "keep (y/n)"])
    for eid, r in sorted(review.items(), key=lambda kv: kv[0]):
        e = raw_by_id.get(eid, {})
        w.writerow([eid, e.get("brand", ""), e.get("en", ""), e.get("cn", ""), e.get("hall", ""), e.get("booth", ""), r["url"], r.get("title", ""), "; ".join(r["evidence"]), ""])
print(f"{len(review)} candidats à contrôler → {REVIEW}")
print(stats, "→", len([v for v in out.values() if v.get("url")]), "sites dans", OUT.name)
