// pipeline/adapters/llm.js
// LLM field-extraction adapter interface + mock implementation.
//
// To plug in a real LLM (Claude API, GPT-4, Gemini):
//   1. Implement: { extractFields(blockText, context) → Promise<RawFields> }
//   2. Replace Pipeline.adapters.llm with your adapter.
//
// The mock uses regex + keyword heuristics — deterministic, no network calls.
(function () {
  'use strict';

  const P = (window.Pipeline = window.Pipeline || {});
  P.adapters = P.adapters || {};

  // ── Helpers ────────────────────────────────────────────────────────────────
  function _delay(ms) { return new Promise(r => setTimeout(r, ms)); }

  function _find(text, patterns) {
    for (const re of patterns) {
      const m = text.match(re);
      if (m) return m[1]?.trim() || null;
    }
    return null;
  }

  function _findAll(text, re) {
    const results = [];
    let m;
    const g = new RegExp(re.source, 'gi');
    while ((m = g.exec(text)) !== null) results.push(m[1]?.trim());
    return results.filter(Boolean);
  }

  // ── Mock field extractor ───────────────────────────────────────────────────
  // Returns RawFields — a plain object with string values and rough confidence hints.
  // The Field-Extraction stage wraps these into proper FieldValue objects.
  const mockLlm = {
    name: 'mock-llm',

    async extractFields(blockText, context) {
      await _delay(50 + Math.random() * 80);

      const t = blockText;
      const tl = t.toLowerCase();

      // ── Name ────────────────────────────────────────────────────────────
      const name = _find(t, [
        /^PRODUCT:\s*(.+)$/im,
        /^Product name[:\s]+(.+)$/im,
        /^Model[:\s]+(.+)$/im,
      ]);

      // ── SKU / Reference ─────────────────────────────────────────────────
      const sku = _find(t, [
        /^Reference[:\s]+([A-Z0-9\-\.]+)/im,
        /^Ref[\.:\s]+([A-Z0-9\-\.]+)/im,
        /^Model\s*#[:\s]+([A-Z0-9\-\.]+)/im,
        /\bSKU[:\s]+([A-Z0-9\-\.]+)/im,
      ]);

      // ── Supplier ─────────────────────────────────────────────────────────
      const supplierName = context?.supplierHint || null;

      // ── Description ──────────────────────────────────────────────────────
      // Grab first sentence-like block after the product name line
      const descMatch = t.match(/(?:^|\n)(?!(?:Reference|Ref\.|Specifications|Certific|MOQ|Price|Colors|Compatible|Channel|Positioning|Category|Weight|Material|Dimension|Voltage|Power|Torque|IP|Connector|Compound))([A-Z][^.\n]{20,120}\.)/m);
      const description = descMatch ? descMatch[1]?.trim() : null;

      // ── Specs (key: value table) ──────────────────────────────────────────
      const specLines = [];
      const specRe = /^([A-Z][A-Za-z /()°]+):\s*([^\n]+)/mg;
      let sm;
      while ((sm = specRe.exec(t)) !== null) {
        const key = sm[1].trim();
        const val = sm[2].trim();
        // Skip non-spec lines
        if (['Reference','Category','Colors','MOQ','Price','Certif','Compatible',
             'Channel','Positioning','Region','Contact'].some(x => key.startsWith(x))) continue;
        specLines.push({ k: key, v: val });
      }

      // ── Materials ─────────────────────────────────────────────────────────
      const materials = _find(t, [
        /Material[s]?[:\s]+([^\n]+)/i,
        /(?:alloy|aluminium|aluminum|nylon|steel|carbon|rubber|pa6|pa12)/i,
      ]) || (tl.includes('alumin') ? 'Aluminium alloy' : null)
         || (tl.includes('nylon') ? 'Nylon (PA6)' : null)
         || (tl.includes('butyl') ? 'Butyl rubber' : null);

      // ── Dimensions ────────────────────────────────────────────────────────
      const dimensions = _find(t, [
        /Dimensions?[:\s]+([^\n]+)/i,
        /Size[:\s]+([^\n]+)/i,
        /(\d+\s*[×x]\s*\d+(?:\s*[×x]\s*\d+)?(?:mm|cm|"))/i,
      ]);

      // ── Compatibility ─────────────────────────────────────────────────────
      const compatibility = _find(t, [
        /Compatible with[:\s]+([^\n]+)/i,
        /Fits[:\s]+([^\n]+)/i,
      ]);

      // ── Colors ────────────────────────────────────────────────────────────
      const colorsRaw = _find(t, [
        /Colou?rs?(?: available)?[:\s]+([^\n]+)/i,
      ]);
      const colors = colorsRaw ? colorsRaw.split(/[,/]/).map(s => s.trim()).filter(Boolean) : null;

      // ── MOQ ───────────────────────────────────────────────────────────────
      const moq = _find(t, [
        /MOQ[:\s]+([^\n]+)/i,
        /Minimum order[:\s]+([^\n]+)/i,
        /MOQ\s+(\d[\d,]+\s*\w+)/i,
      ]);

      // ── Price ─────────────────────────────────────────────────────────────
      const price = _find(t, [
        /Price[:\s]+(USD\s*[\d.–\-]+(?:\s*–\s*[\d.]+)?[^\n]*)/i,
        /(?:USD|EUR|CNY)\s*([\d.]+\s*[–\-~]\s*[\d.]+)/,
        /around\s+(USD\s*[\d.–\-]+[^\n]*)/i,
      ]);

      // ── Certifications ────────────────────────────────────────────────────
      const certRaw = _find(t, [
        /Certifications?[:\s]+([^\n]+)/i,
      ]);
      const certifications = certRaw
        ? certRaw.split(/[,;\/]/).map(s => s.trim()).filter(Boolean)
        : null;

      // ── Positioning ───────────────────────────────────────────────────────
      const posRaw = (_find(t, [/Positioning[:\s]+([^\n]+)/i]) || '').toLowerCase();
      const positioning = posRaw.includes('premium') ? 'premium'
                        : posRaw.includes('entry')   ? 'entry'
                        : posRaw.includes('mid')      ? 'mid'
                        : _inferPositioning(tl);

      // ── Channel ───────────────────────────────────────────────────────────
      const chanRaw = (_find(t, [/Channel[:\s]+([^\n]+)/i]) || '').toLowerCase();
      const channel = chanRaw.includes('both') ? 'both'
                    : chanRaw.includes('aftermarket') ? 'aftermarket'
                    : chanRaw.includes('oem') ? 'OEM'
                    : _inferChannel(tl);

      // ── Region suitability ─────────────────────────────────────────────────
      const regionRaw = (_find(t, [/Region[:\s]+([^\n]+)/i]) || '').toLowerCase();
      const regionSuitability = (regionRaw.includes('eu') || tl.includes('en15194') || tl.includes('stvzo') || tl.includes('ce, en'))
        ? 'EU'
        : tl.includes('domestic') ? 'domestic'
        : 'unclear';

      return {
        name,
        sku,
        supplierName,
        description,
        specs: specLines.length ? specLines : null,
        materials,
        dimensions,
        compatibility,
        colors,
        moq,
        price,
        certifications,
        positioning,
        channel,
        regionSuitability,
      };
    },
  };

  // ── Inference helpers ───────────────────────────────────────────────────────
  function _inferPositioning(tl) {
    if (tl.includes('premium') || tl.includes('carbon') || tl.includes('titanium')) return 'premium';
    if (tl.includes('entry') || tl.includes('basic') || tl.includes('economy')) return 'entry';
    return 'mid';
  }

  function _inferChannel(tl) {
    if (tl.includes('oem') || tl.includes('bulk') || tl.includes('white box')) return 'OEM';
    if (tl.includes('aftermarket') || tl.includes('retail') || tl.includes('blister')) return 'aftermarket';
    return 'both';
  }

  P.adapters.llm = mockLlm;
}());
