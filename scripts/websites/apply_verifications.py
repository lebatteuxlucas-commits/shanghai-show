#!/usr/bin/env python3
"""
Applique les verdicts de l'agent website-verifier (data/websites/verify_results/*.json) :
  - mismatch / unreachable sur un site de l'annuaire  → ajouté à blocklist.json (retiré à la prochaine fusion)
  - match sur un candidat en attente (held)           → ajouté à manual_accepted.json
  - unsure                                            → listé dans to_verify_manually.csv, rien ne change
Puis relance merge_results.py et apply_websites.py.
Usage : python3 scripts/websites/apply_verifications.py [--dry-run]
"""
import argparse, csv, glob, json, subprocess, sys
from pathlib import Path
ROOT = Path(__file__).resolve().parents[2]
RES = ROOT / "data/websites/verify_results"; BLOCK = ROOT / "data/websites/blocklist.json"
MANUAL = ROOT / "data/websites/manual_accepted.json"; HELD = ROOT / "data/websites/held_for_confirmation.json"
sys.path.insert(0, str(ROOT / "scripts/websites")); from guess_domains import load_raw, fetch, PARKED

import urllib.error
def really_dead(url):
    """Re-test réseau : True seulement si le domaine ne répond pas (DNS/connexion) ou renvoie une page parquée.
    Une erreur HTTP (403 anti-bot, 500…) prouve que le serveur existe : on considère le site vivant."""
    for u in (url, url.replace("https://", "http://", 1) if url.startswith("https://") else url.replace("http://", "https://", 1)):
        try:
            _, text = fetch(u, timeout=15)
            low = text.lower()
            if len(text) < 200 or any(k in low for k in PARKED): continue
            return False
        except urllib.error.HTTPError:
            return False
        except Exception:
            continue
    return True

def main():
    a = argparse.ArgumentParser(); a.add_argument("--dry-run", action="store_true"); a = a.parse_args()
    verdicts = {}
    for f in sorted(glob.glob(str(RES / "*.json"))): verdicts.update(json.loads(Path(f).read_text()))
    batches = {}
    for f in glob.glob(str(ROOT / "data/websites/verify_batches/*.json")):
        for r in json.loads(Path(f).read_text()): batches[r["id"]] = r
    raw = {e["id"]: e for e in load_raw()}
    block = json.loads(BLOCK.read_text()) if BLOCK.exists() else {"_meta": ""}
    manual = json.loads(MANUAL.read_text()) if MANUAL.exists() else {"_meta": ""}
    held = json.loads(HELD.read_text()) if HELD.exists() else {}
    st = {"match": 0, "unsure": 0, "mismatch": 0, "unreachable": 0, "blocked": 0, "accepted": 0, "held_rejected": 0}
    unsure = []
    for eid, v in verdicts.items():
        vd = v.get("verdict", "unsure"); st[vd] = st.get(vd, 0) + 1
        row = batches.get(eid) or {"url": raw.get(eid, {}).get("website", ""), "source": raw.get(eid, {}).get("website_source", "")}
        url = row.get("url", "")
        if not url: continue
        if vd == "unreachable" and not really_dead(url):
            vd = "unsure"; v = {**v, "reason": "injoignable pour l'agent mais répond en curl : " + v.get("reason", "")}
            st["unreachable_but_alive"] = st.get("unreachable_but_alive", 0) + 1
        if row.get("source") == "held":
            if vd == "match":
                manual[eid] = {"url": url, "source": "manual", "confidence": "high", "evidence": "vérifié par l'agent website-verifier : " + v.get("reason", "")}
                held.pop(eid, None); st["accepted"] += 1
            elif vd in ("mismatch", "unreachable"):
                held.pop(eid, None); st["held_rejected"] += 1
                if eid not in block: block[eid] = {"url": url, "reason": f"{vd} (website-verifier) : {v.get('reason', '')}"}
            else:
                unsure.append((eid, url, v.get("reason", "")))
        elif row.get("source") == "auto_search":
            # Phase A (correspondances par marque saisies à la main) : jamais exclu automatiquement, seulement signalé
            if vd != "match": unsure.append((eid, url, f"[phase A, {vd}] " + v.get("reason", "")))
        else:
            if vd in ("mismatch", "unreachable") and eid not in block:
                block[eid] = {"url": url, "reason": f"{vd} (website-verifier) : {v.get('reason', '')}"}
                st["blocked"] += 1
            elif vd == "unsure":
                unsure.append((eid, url, v.get("reason", "")))
    print(st)
    if a.dry_run: return
    BLOCK.write_text(json.dumps(block, ensure_ascii=False, indent=1))
    MANUAL.write_text(json.dumps(manual, ensure_ascii=False, indent=1))
    HELD.write_text(json.dumps(held, ensure_ascii=False, indent=1))
    with (ROOT / "data/websites/to_verify_manually.csv").open("w", encoding="utf-8-sig", newline="") as f:
        w = csv.writer(f); w.writerow(["id", "company_en", "company_cn", "url", "agent_reason"])
        for eid, url, why in unsure: w.writerow([eid, raw.get(eid, {}).get("en", ""), raw.get(eid, {}).get("cn", ""), url, why])
    print(f"{len(unsure)} cas incertains → data/websites/to_verify_manually.csv")
    subprocess.run([sys.executable, str(ROOT / "scripts/websites/merge_results.py")], check=True)
    subprocess.run([sys.executable, str(ROOT / "apply_websites.py")], check=True)

if __name__ == "__main__":
    main()
