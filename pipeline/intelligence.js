// pipeline/intelligence.js
// Sourcing intelligence engine — query parsing, supplier ranking, product ranking.
//
// POST-MVP: replace _keywordScore with vector cosine similarity and _defaultParser
// with an LLM call returning the same Intent shape:
//   { raw, topN, categories[], positioning, channel, region, compatibility }
(function () {
  'use strict';

  const P = (window.Pipeline = window.Pipeline || {});

  // ── Keyword scorer ────────────────────────────────────────────────────────────
  function _keywordScore(query, text) {
    if (!query || !text) return 0;
    const tl = text.toLowerCase();
    const terms = query.toLowerCase().split(/\s+/).filter(t => t.length > 2);
    if (!terms.length) return 0;
    return terms.filter(t => tl.includes(t)).length / terms.length;
  }

  // ── Query parser ──────────────────────────────────────────────────────────────
  function parseQuery(text) {
    return _defaultParser(text);
  }

  function _defaultParser(text) {
    if (!text || !text.trim()) return _emptyIntent(text);
    const tl = text.toLowerCase();

    // topN
    const topNm = tl.match(/\btop\s+(\d+)\b/);
    const topN = topNm ? parseInt(topNm[1]) : 10;

    // categories — match taxonomy keywords
    const categories = [];
    const cats = (P.taxonomy && P.taxonomy.CATEGORIES) ? P.taxonomy.CATEGORIES : [];
    for (const cat of cats) {
      if (cat.id === 'other') continue;
      for (const kw of cat.keywords) {
        if (tl.includes(kw.toLowerCase())) {
          if (!categories.includes(cat.id)) categories.push(cat.id);
          break;
        }
      }
    }

    // positioning
    const positioning =
      /\b(premium|high.end|pro|professional|high.quality|carbon|titanium)\b/.test(tl) ? 'premium' :
      /\b(entry|budget|affordable|cheap|economy|basic|low.cost)\b/.test(tl)           ? 'entry'   :
      /\b(mid|value|mid.range)\b/.test(tl)                                             ? 'mid'     : null;

    // channel
    const channel =
      /\boem\b|\bbulk\b|\bwhite.?box\b/.test(tl) ? 'OEM' :
      /\baftermarket\b|\bretail\b|\bconsumer\b/.test(tl) ? 'aftermarket' : null;

    // region
    const region =
      /\b(eu\b|europe|european|stvzo|en15194|german[y]?|french|uk)\b/.test(tl) ? 'EU'       :
      /\b(domestic|china|chinese|local)\b/.test(tl)                             ? 'domestic' : null;

    // compatibility — "compatible with Bosch" / "fits Shimano"
    const compatM = text.match(/\b(?:compatible (?:with|for)|fits?)\s+([A-Za-z][^,.\n]{2,25}?)(?:\s+(?:ecosystem|system|standard|protocol|motor|battery))?(?=[,.\s]|$)/i);
    const compatibility = compatM ? compatM[1].trim() : null;

    return { raw: text, topN, categories, positioning, channel, region, compatibility };
  }

  function _emptyIntent(raw) {
    return { raw: raw || '', topN: 10, categories: [], positioning: null, channel: null, region: null, compatibility: null };
  }

  // ── Rank suppliers ────────────────────────────────────────────────────────────
  // Returns: [{ exhibitor, score, evidence[] }]  sorted desc
  function rankSuppliers(intent, opts) {
    const raw = (typeof RAW !== 'undefined') ? RAW : [];
    if (!raw.length) return [];

    const allProducts = P.Store ? P.Store.getAllProducts() : [];
    const bySupplier  = _buildSupplierIdx(allProducts);
    const limit = opts?.limit || intent.topN || 10;

    const scored = raw.map(ex => {
      const products  = _productsFor(ex, bySupplier);
      const score     = _scoreSupplier(ex, intent, products);
      const evidence  = _supplierEvidence(ex, intent, products);
      return { exhibitor: ex, score, evidence };
    });

    scored.sort((a, b) => b.score - a.score || (a.exhibitor.en || '').localeCompare(b.exhibitor.en || ''));

    const minScore = intent.categories.length ? 0.05 : 0;
    return scored.filter(r => r.score > minScore).slice(0, limit);
  }

  // ── Rank products ─────────────────────────────────────────────────────────────
  // Returns: [{ product, score, evidence[] }]  sorted desc
  function rankProducts(intent, opts) {
    const products = P.Store ? P.Store.getAllProducts() : [];
    if (!products.length) return [];

    const limit = opts?.limit || intent.topN || 20;

    const scored = products.map(p => ({
      product:  p,
      score:    _scoreProduct(p, intent),
      evidence: _productEvidence(p, intent),
    }));

    scored.sort((a, b) => b.score - a.score);

    const minScore = intent.categories.length ? 0.05 : 0;
    return scored.filter(r => r.score > minScore).slice(0, limit);
  }

  // ── Supplier scoring ──────────────────────────────────────────────────────────
  const W = {
    catFromExtracted: 0.26,  // extracted products confirm exact category
    catFromScope:     0.16,  // exhibitor scope/cats text hints at category
    positioning:      0.12,  // positioning alignment
    channel:          0.10,  // OEM/aftermarket alignment
    euSuitability:    0.10,  // EU compliance evidence
    dataRichness:     0.09,  // avg confidence of extracted products
    reviewValidated:  0.08,  // fraction of products approved/auto-approved
    breadth:          0.09,  // more matching products = stronger signal
  };

  function _scoreSupplier(exhibitor, intent, products) {
    let s = 0;
    const catProds = _filterByCat(products, intent.categories);

    // Category
    if (catProds.length > 0) {
      s += W.catFromExtracted;
      s += W.breadth * Math.min(1, catProds.length / 5);
    } else if (intent.categories.length > 0) {
      const scopeHit = _scopeMatchesCats(exhibitor, intent.categories);
      s += W.catFromScope * scopeHit;
    } else {
      s += (W.catFromExtracted + W.catFromScope + W.breadth) * 0.3; // no category filter — neutral
    }

    // Positioning
    if (intent.positioning) {
      if (catProds.length) {
        const hit = catProds.filter(p => p.fields.positioning?.value === intent.positioning).length;
        s += W.positioning * (hit / catProds.length);
      }
    } else {
      s += W.positioning * 0.5;
    }

    // Channel
    if (intent.channel) {
      const pool = catProds.length ? catProds : products;
      if (pool.length) {
        const hit = pool.filter(p => { const v = p.fields.channel?.value; return v === intent.channel || v === 'both'; }).length;
        s += W.channel * (hit / pool.length);
      }
    } else {
      s += W.channel * 0.5;
    }

    // EU suitability
    if (intent.region === 'EU') {
      const pool = catProds.length ? catProds : products;
      const euHit = pool.filter(p => p.fields.regionSuitability?.value === 'EU').length;
      if (euHit > 0)            s += W.euSuitability;
      else if (_scopeHasEU(exhibitor)) s += W.euSuitability * 0.5;
    } else {
      s += W.euSuitability * 0.3;
    }

    // Data richness
    if (products.length > 0) {
      s += W.dataRichness * (products.reduce((t, p) => t + p.confidence, 0) / products.length);
    }

    // Review validation
    if (products.length > 0) {
      const approved = products.filter(p => p.reviewState === 'approved' || p.reviewState === 'auto-approved').length;
      s += W.reviewValidated * (approved / products.length);
    }

    return Math.min(1, Math.max(0, s));
  }

  // ── Product scoring ───────────────────────────────────────────────────────────
  function _scoreProduct(product, intent) {
    const f = product.fields;
    let s = 0;

    // Category
    const catId = f.category?.value?.id;
    if (intent.categories.length) {
      if (intent.categories.includes(catId)) {
        s += 0.35;
      } else {
        // soft: keyword overlap between product name/desc and category keywords
        const nameTxt = [(f.name?.value || ''), (f.description?.value || '')].join(' ');
        const kwTxt = intent.categories.map(id => {
          const c = P.taxonomy?.getCategoryById(id);
          return c ? c.keywords.slice(0, 3).join(' ') : id;
        }).join(' ');
        s += 0.15 * _keywordScore(kwTxt, nameTxt);
      }
    }

    // Positioning
    if (intent.positioning) {
      if (f.positioning?.value === intent.positioning) s += 0.15;
    } else { s += 0.08; }

    // Channel
    if (intent.channel) {
      const v = f.channel?.value;
      if (v === intent.channel || v === 'both') s += 0.10;
    } else { s += 0.05; }

    // EU
    if (intent.region === 'EU') {
      if (f.regionSuitability?.value === 'EU') s += 0.12;
    } else { s += 0.04; }

    // Confidence
    s += 0.10 * product.confidence;

    // Review state
    s += ({ approved: 0.08, 'auto-approved': 0.06, 'pending-review': 0.02, rejected: 0 }[product.reviewState] || 0);

    // Compatibility
    if (intent.compatibility) {
      const compat = [(f.compatibility?.value || ''), (f.description?.value || '')].join(' ');
      if (compat.toLowerCase().includes(intent.compatibility.toLowerCase())) s += 0.10;
    }

    return Math.min(1, Math.max(0, s));
  }

  // ── Evidence builders ─────────────────────────────────────────────────────────
  function _supplierEvidence(exhibitor, intent, products) {
    const ev = [];
    const catProds = _filterByCat(products, intent.categories);

    // Extracted products — strongest signal
    if (catProds.length > 0) {
      ev.push({ type: 'data', text: `${catProds.length} matching product${catProds.length > 1 ? 's' : ''} extracted from catalog` });
    } else if (products.length > 0) {
      ev.push({ type: 'data', text: `${products.length} catalog product${products.length > 1 ? 's' : ''} on file (different categories)` });
    }

    // Certifications
    const certs = new Set();
    const pool = catProds.length ? catProds : products;
    pool.forEach(p => (p.fields.certifications?.value || []).forEach(c => certs.add(c)));
    if (certs.size) ev.push({ type: 'cert', text: `Certified: ${[...certs].slice(0, 5).join(', ')}` });

    // Pricing
    const priceStr = _priceRange(catProds.length ? catProds : products.slice(0, 4));
    if (priceStr) ev.push({ type: 'price', text: `Price range: ${priceStr}` });

    // Positioning match
    if (intent.positioning && catProds.length) {
      const cnt = catProds.filter(p => p.fields.positioning?.value === intent.positioning).length;
      if (cnt) ev.push({ type: 'match', text: `${cnt} ${intent.positioning}-tier product${cnt > 1 ? 's' : ''} confirmed` });
    }

    // EU
    if (intent.region === 'EU') {
      const euCnt = pool.filter(p => p.fields.regionSuitability?.value === 'EU').length;
      if (euCnt)             ev.push({ type: 'eu',   text: `${euCnt} EU-suitable product${euCnt > 1 ? 's' : ''}` });
      else if (_scopeHasEU(exhibitor)) ev.push({ type: 'eu',   text: 'EU market referenced in scope' });
      else                   ev.push({ type: 'warn', text: 'EU compliance unconfirmed' });
    }

    // Channel
    if (intent.channel && pool.length) {
      const hit = pool.filter(p => { const v = p.fields.channel?.value; return v === intent.channel || v === 'both'; }).length;
      if (hit) ev.push({ type: 'match', text: `${hit} ${intent.channel} product${hit > 1 ? 's' : ''}` });
      else     ev.push({ type: 'warn',  text: `No confirmed ${intent.channel} products` });
    }

    // Review status
    const approved = pool.filter(p => p.reviewState === 'approved' || p.reviewState === 'auto-approved').length;
    if (approved > 0 && pool.length > 0) {
      ev.push({ type: 'verified', text: `${approved}/${pool.length} product${approved > 1 ? 's' : ''} verified` });
    }

    // Fallback: show scope snippet when no extracted data
    if (products.length === 0 && exhibitor.scope) {
      ev.push({ type: 'scope', text: exhibitor.scope.slice(0, 100).replace(/\s+/g, ' ').trim() + '…' });
    }

    return ev;
  }

  function _productEvidence(product, intent) {
    const f = product.fields;
    const ev = [];

    if (f.category?.value?.label) ev.push({ type: 'match', text: f.category.value.label });
    const certs = f.certifications?.value;
    if (certs?.length) ev.push({ type: 'cert', text: certs.slice(0, 3).join(', ') });
    if (f.price?.value) ev.push({ type: 'price', text: f.price.value });
    if (f.moq?.value)   ev.push({ type: 'moq',   text: `MOQ: ${f.moq.value}` });
    if (intent.region === 'EU' && f.regionSuitability?.value === 'EU')
      ev.push({ type: 'eu', text: 'EU-suitable' });
    if (intent.compatibility && (f.compatibility?.value || '').toLowerCase().includes(intent.compatibility.toLowerCase()))
      ev.push({ type: 'match', text: `Compatible: ${f.compatibility.value}` });

    // Source traceability
    const catalog = P.Store?.getCatalog(product.catalogId);
    if (catalog) {
      const src = catalog.supplierHint || catalog.fileName;
      ev.push({ type: 'source', text: `${src} · p.${product.sourcePage}` });
    }

    return ev;
  }

  // ── Helpers ───────────────────────────────────────────────────────────────────
  function _buildSupplierIdx(products) {
    const idx = new Map();
    products.forEach(p => {
      const sm = p.supplierMatch;
      [sm?.exhibitorEn, sm?.exhibitorCn, p.fields.supplierName?.value]
        .filter(Boolean)
        .forEach(k => {
          if (!idx.has(k)) idx.set(k, []);
          idx.get(k).push(p);
        });
    });
    return idx;
  }

  function _productsFor(exhibitor, idx) {
    const seen = new Set();
    const out  = [];
    [exhibitor.en, exhibitor.cn].filter(Boolean).forEach(k => {
      (idx.get(k) || []).forEach(p => { if (!seen.has(p.id)) { seen.add(p.id); out.push(p); } });
    });
    return out;
  }

  function _filterByCat(products, categories) {
    if (!categories.length) return products;
    return products.filter(p => {
      const id = p.fields.category?.value?.id;
      return id && categories.includes(id);
    });
  }

  function _scopeMatchesCats(exhibitor, categories) {
    const text = [(exhibitor.scope || ''), (exhibitor.cats || []).join(' ')].join(' ').toLowerCase();
    const cats = (P.taxonomy && P.taxonomy.CATEGORIES) ? P.taxonomy.CATEGORIES : [];
    let score = 0;
    for (const catId of categories) {
      const cat = cats.find(c => c.id === catId);
      if (!cat) continue;
      for (const kw of cat.keywords) {
        if (text.includes(kw.toLowerCase())) { score++; break; }
      }
    }
    return Math.min(1, score / Math.max(1, categories.length));
  }

  function _scopeHasEU(exhibitor) {
    const text = [(exhibitor.scope || ''), (exhibitor.hallEn || ''), (exhibitor.en || '')].join(' ').toLowerCase();
    return /\beu\b|europe|en15194|stvzo|ce mark|rohs|epac/.test(text);
  }

  function _priceRange(products) {
    const vals = products.map(p => p.fields.price?.value).filter(Boolean);
    if (!vals.length) return null;
    return vals.slice(0, 3).join(' / ');
  }

  P.intelligence = { parseQuery, rankSuppliers, rankProducts };
}());
