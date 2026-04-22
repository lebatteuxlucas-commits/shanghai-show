// pipeline/stages/supplier-matching.js
// Stage 7 — Supplier Matching
//
// Multi-signal matching strategy (all signals applied per name pair):
//   1. Exact normalized name                  → 1.00
//   2. Substring containment (length-weighted) → up to 0.92
//   3. Token Jaccard overlap                   → up to ~0.90
//   4. Character bigram similarity (×0.90)     → handles OCR noise, transliteration variants
//   5. Initialism / abbreviation               → handles "GTC" ↔ "Guangtai Cycle"
//   Applied against: EN name, CN name, aliases.
//
// Confidence bands:
//   ≥ 0.85  auto-link              (matchMethod 'exact')
//   0.20–0.84  uncertain match → reconciliation queue  (matchMethod 'fuzzy')
//   < 0.20  no useful signal   (matchMethod 'none')
//
// Lookup order per product:
//   1. Previously confirmed external suppliers (SupplierStore) — highest priority
//   2. RAW China Cycle exhibitor list
(function () {
  'use strict';

  const P = (window.Pipeline = window.Pipeline || {});
  P.stages = P.stages || {};

  // ── Stage entry point ──────────────────────────────────────────────────────
  async function supplierMatching(products, record, opts) {
    _log(record, 'supplier-matching', 'Matching suppliers against exhibitor list');
    opts?.onProgress?.({ stage: 'supplier-matching', pct: 0, msg: 'Matching suppliers…' });

    const raw            = (typeof RAW !== 'undefined') ? RAW : [];
    const knownSuppliers = P.SupplierStore ? P.SupplierStore.getAllSuppliers() : [];

    if (!raw.length) {
      _log(record, 'supplier-matching', 'RAW exhibitor list not available — skipping');
      return products;
    }

    const hint = _normalize(record.supplierHint);

    products.forEach(product => {
      const extractedName = _normalize(product.fields.supplierName?.value || '');
      const query = extractedName || hint;

      if (!query) {
        product.supplierMatch = P.models.supplierMatch(null, null, null, 0, 'none');
        return;
      }

      // Priority 1: previously confirmed external suppliers (re-links repeat catalogs)
      if (knownSuppliers.length) {
        const knownMatch = _findBestKnown(query, knownSuppliers);
        if (knownMatch && knownMatch.matchScore >= 0.75) {
          product.supplierMatch = knownMatch;
          if (!product.fields.supplierName?.value) {
            product.fields.supplierName = P.models.inferredField(knownMatch.exhibitorEn, 0.65, null);
          }
          return;
        }
      }

      // Priority 2: RAW China Cycle exhibitor list
      const match = _findBest(query, raw);
      product.supplierMatch = match;

      if (match.matchScore > 0 && !product.fields.supplierName?.value) {
        product.fields.supplierName = P.models.inferredField(match.exhibitorEn, 0.55, null);
      }
    });

    const matched = products.filter(p => p.supplierMatch.matchScore >= 0.5).length;
    _log(record, 'supplier-matching', `Matched ${matched}/${products.length} product(s) to known exhibitors`);
    opts?.onProgress?.({ stage: 'supplier-matching', pct: 100, msg: `${matched}/${products.length} matched` });

    // ── Reconciliation queue (catalog-level) ──────────────────────────────────
    // Queue uncertain catalog-level matches for human confirmation.
    // Auto-accept only when best score ≥ 0.85.
    if (P.SupplierStore && hint) {
      const candidates = _topN(hint, raw, 3);
      const bestScore  = candidates[0]?.score || 0;
      if (bestScore < 0.85) {
        P.SupplierStore.addReconItem({
          catalogId:     record.id,
          candidateName: record.supplierHint,
          candidates,
          bestScore,
        });
        _log(record, 'supplier-matching', `Reconciliation queued (best score: ${bestScore.toFixed(2)})`);
      }
    }

    return products;
  }

  // ── Known external supplier lookup ─────────────────────────────────────────
  // Checks all profiles in SupplierStore (user-confirmed non-exhibitor suppliers).
  // Matches against en, cn, displayName, legalName, and all aliases.
  function _findBestKnown(query, suppliers) {
    let bestScore = 0;
    let bestS     = null;

    for (const s of suppliers) {
      const targets = [s.en, s.cn, s.displayName, s.legalName, ...(s.aliases || [])];
      for (const t of targets) {
        const n = _normalize(t);
        if (!n) continue;
        const score = _scorePair(query, n);
        if (score > bestScore) { bestScore = score; bestS = s; }
      }
    }

    if (!bestS || bestScore < 0.45) return null;
    const method = bestScore >= 0.85 ? 'exact' : 'fuzzy';
    return P.models.supplierMatch(
      bestS.id,
      bestS.en || bestS.displayName || null,
      bestS.cn || null,
      Math.min(1, bestScore),
      method,
    );
  }

  // ── RAW exhibitor list matching ────────────────────────────────────────────
  function _findBest(query, raw) {
    let bestScore = 0;
    let best      = null;

    for (const e of raw) {
      const score = _score(query, e);
      if (score > bestScore) { bestScore = score; best = e; }
    }

    if (!best || bestScore < 0.20) {
      return P.models.supplierMatch(null, null, null, 0, 'none');
    }

    const method = bestScore >= 0.85 ? 'exact' : 'fuzzy';
    return P.models.supplierMatch(
      best.id || null,
      best.en || best.exhibitorEn || null,
      best.cn || best.exhibitorCn || null,
      Math.min(1, bestScore),
      method,
    );
  }

  // Score a query against one exhibitor entry (checks EN, CN, aliases)
  function _score(query, exhibitor) {
    const en = _normalize(exhibitor.en || exhibitor.exhibitorEn || '');
    const cn = _normalize(exhibitor.cn || exhibitor.exhibitorCn || '');
    let best = 0;
    if (en) best = Math.max(best, _scorePair(query, en));
    if (cn) best = Math.max(best, _scorePair(query, cn));
    (exhibitor.aliases || []).forEach(a => {
      const n = _normalize(a);
      if (n) best = Math.max(best, _scorePair(query, n));
    });
    return best;
  }

  // Top-N candidates with per-candidate matchSignal for the reconciliation UI
  function _topN(query, raw, n) {
    return raw
      .map(e => ({
        exhibitorEn:  e.en  || e.exhibitorEn  || null,
        exhibitorCn:  e.cn  || e.exhibitorCn  || null,
        score:        _score(query, e),
        matchSignal:  _bestSignal(query, e),
      }))
      .filter(r => r.score >= 0.15)
      .sort((a, b) => b.score - a.score)
      .slice(0, n);
  }

  // ── Core pair-wise scoring — all five signals ──────────────────────────────
  function _scorePair(a, b) {
    if (!a || !b) return 0;
    if (a === b)  return 1.0;

    let s = 0;

    // Signal 1: length-weighted substring containment
    // Short queries get penalised — "GT" inside "Guangtai Cycle Technology" scores ~0.78, not 0.92
    if (b.includes(a) && a.length >= 3) s = Math.max(s, 0.72 + 0.20 * (a.length / b.length));
    if (a.includes(b) && b.length >= 3) s = Math.max(s, 0.68 + 0.20 * (b.length / a.length));

    // Signal 2: token Jaccard overlap
    s = Math.max(s, _tokenOverlap(a, b));

    // Signal 3: character bigram overlap
    // Robust to OCR noise (3→e, 1→l, rn→m), spelling variants, and romanisation differences.
    // Capped at 0.90 to stay below the auto-link threshold.
    s = Math.max(s, _bigramOverlap(a, b) * 0.90);

    // Signal 4: initialism / abbreviation
    // "GTC" ↔ "guangtai cycle", "KMC" ↔ "kmc chain"
    s = Math.max(s, _initialismScore(a, b));

    return Math.min(1, s);
  }

  // ── Scoring primitives ─────────────────────────────────────────────────────

  // Jaccard on word tokens
  function _tokenOverlap(a, b) {
    const ta = new Set(a.split(/\s+/).filter(Boolean));
    const tb = new Set(b.split(/\s+/).filter(Boolean));
    if (!ta.size || !tb.size) return 0;
    let intersection = 0;
    ta.forEach(t => { if (tb.has(t)) intersection++; });
    return intersection / (ta.size + tb.size - intersection);
  }

  // Jaccard on character bigrams (computed on compacted string — spaces removed)
  function _bigramOverlap(a, b) {
    const ta = _bigrams(a);
    const tb = _bigrams(b);
    if (!ta.size || !tb.size) return 0;
    let intersection = 0;
    ta.forEach(bg => { if (tb.has(bg)) intersection++; });
    return intersection / (ta.size + tb.size - intersection);
  }

  function _bigrams(s) {
    const compact = s.replace(/\s+/g, '');
    const bgs = new Set();
    for (let i = 0; i < compact.length - 1; i++) bgs.add(compact.slice(i, i + 2));
    return bgs;
  }

  // Bidirectional initialism check: does either string form the initials of the other?
  function _initialismScore(a, b) {
    return Math.max(_initialismOf(a, b), _initialismOf(b, a));
  }

  function _initialismOf(abbr, full) {
    if (abbr.length < 2 || abbr.length > 6 || !/^[a-z]+$/.test(abbr)) return 0;
    const tokens = full.split(/\s+/).filter(Boolean);
    if (tokens.length < 2) return 0;
    const initials = tokens.map(t => t[0]).join('');
    if (initials === abbr)                              return 0.80; // exact initialism
    if (initials.startsWith(abbr) && abbr.length >= 2) return 0.65; // prefix initialism
    return 0;
  }

  // ── Normalization ──────────────────────────────────────────────────────────
  // Strips legal suffixes, generic descriptor words, and bike-domain noise so
  // "Xiongfeng Bicycle Technology Co., Ltd." → "xiongfeng" and matches cleanly.
  function _normalize(s) {
    return (s || '').toLowerCase()
      // Legal suffixes
      .replace(/co\.,?\s*ltd\.?|limited|holdings?|enterprises?/gi, '')
      .replace(/corporation|corp\.?|incorporated|inc\.?|llc/gi, '')
      // Generic descriptor words
      .replace(/technology|technologies|tech|industrial|industry|group|trading/gi, '')
      .replace(/manufacture|manufacturing|manufacturer|factory|mfg|workshop/gi, '')
      .replace(/international|global|worldwide/gi, '')
      // Bike-domain noise — extremely common in exhibitor names, adds zero signal
      .replace(/e?-?bicycl(?:e|es)?|e?-?bike(?:s)?|cycling|cycle(?:s)?/gi, '')
      .replace(/electric|ebike|e-?bike/gi, '')
      .replace(/components?|parts?|accessories|systems?|products?|equipment/gi, '')
      // Collapse non-alphanumeric (preserve CJK)
      .replace(/[^a-z0-9\u4e00-\u9fff ]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  // Human-readable explanation of the dominant matching signal — shown in recon card
  function _bestSignal(query, exhibitor) {
    const en = _normalize(exhibitor.en || exhibitor.exhibitorEn || '');
    const cn = _normalize(exhibitor.cn || exhibitor.exhibitorCn || '');

    // Check explicit containment first (most interpretable)
    for (const [t, lang] of [[en, 'EN'], [cn, 'CN']]) {
      if (!t) continue;
      if (t === query) return `Exact ${lang} name`;
      if (t.includes(query) || query.includes(t)) return `${lang} name contains`;
    }

    // Compare all fuzzy signals and return the strongest
    const signals = [];
    const push = (score, label) => { if (score > 0) signals.push({ score, label }); };

    if (en) {
      push(_tokenOverlap(query, en),           `Token match (EN)`);
      push(_bigramOverlap(query, en) * 0.90,   `Name similarity (EN)`);
      push(_initialismScore(query, en),         `Abbreviation match`);
    }
    if (cn) {
      push(_tokenOverlap(query, cn),            `Token match (CN)`);
      push(_bigramOverlap(query, cn) * 0.90,   `Name similarity (CN)`);
    }

    signals.sort((a, b) => b.score - a.score);
    return signals[0]?.label || 'Partial match';
  }

  function _log(record, stage, msg) {
    record.processingLog.push({ ts: Date.now(), stage, msg });
  }

  P.stages.supplierMatching = supplierMatching;
}());
