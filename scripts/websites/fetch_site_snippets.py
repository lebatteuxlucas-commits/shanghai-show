#!/usr/bin/env python3
"""
Pour chaque exposant avec un site web, récupère la page d'accueil et en extrait
title, meta description, meta keywords, h1/h2 et un extrait de texte visible.
Sortie : data/websites/site_snippets.json { "<id>": {title, description, keywords, headings, text, lang} }
Sert de matière aux rapprochements catégories / product scope.
"""
import json, re, sys, html as H, concurrent.futures as cf
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))
from guess_domains import fetch, load_raw
OUT = Path(__file__).resolve().parents[2] / "data/websites/site_snippets.json"

def meta(text, name):
    m = re.search(r'<meta[^>]+(?:name|property)=["\'](?:og:)?' + name + r'["\'][^>]*content=["\']([^"\']*)', text, re.I) \
        or re.search(r'<meta[^>]+content=["\']([^"\']*)["\'][^>]*(?:name|property)=["\'](?:og:)?' + name + r'["\']', text, re.I)
    return H.unescape(m.group(1)).strip() if m else ""

def clean(s): return re.sub(r"\s+", " ", H.unescape(re.sub(r"<[^>]+>", " ", s))).strip()

def grab(e):
    try:
        _, t = fetch(e["website"], timeout=12)
    except Exception as ex:
        return e["id"], {"error": ex.__class__.__name__}
    title = re.search(r"<title[^>]*>(.*?)</title>", t, re.S | re.I)
    body = re.sub(r"<(script|style|noscript|svg)[^>]*>.*?</\1>", " ", t, flags=re.S | re.I)
    heads = [clean(h) for h in re.findall(r"<h[12][^>]*>(.*?)</h[12]>", body, re.S | re.I)]
    heads = [h for h in heads if 2 <= len(h) <= 80][:12]
    return e["id"], {"url": e["website"], "title": clean(title.group(1))[:200] if title else "",
                     "description": meta(t, "description")[:500], "keywords": meta(t, "keywords")[:300],
                     "headings": heads, "text": clean(body)[:1500]}

def main():
    todo = [e for e in load_raw() if e.get("website")]
    out = {}
    with cf.ThreadPoolExecutor(max_workers=30) as ex:
        for eid, d in ex.map(grab, todo):
            out[eid] = d
    OUT.write_text(json.dumps(out, ensure_ascii=False, indent=1))
    ok = sum(1 for v in out.values() if "error" not in v)
    print(f"{ok}/{len(todo)} pages récupérées → {OUT}")

if __name__ == "__main__":
    main()
