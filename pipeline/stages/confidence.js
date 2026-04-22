// pipeline/stages/confidence.js
// Stage 9 — Confidence Scoring
// Computes an overall 0–1 confidence score for each product based on:
//   - Field completeness (how many key fields have values)
//   - Individual field confidences
//   - Supplier match score
//   - Category classification confidence
(function () {
  'use strict';

  const P = (window.Pipeline = window.Pipeline || {});
  P.stages = P.stages || {};

  // ── Field weights ───────────────────────────────────────────────────────────
  // Key sourcing fields carry higher weight than supplementary fields.
  const WEIGHTS = {
    name:             0.20,
    sku:              0.15,
    price:            0.12,
    moq:              0.10,
    description:      0.08,
    category:         0.08,
    certifications:   0.07,
    materials:        0.05,
    compatibility:    0.05,
    dimensions:       0.04,
    colors:           0.03,
    positioning:      0.02,
    channel:          0.02,
    regionSuitability:0.02,
    specs:            0.02,
    supplierName:     0.02,
    images:           0.02,
  };

  // ── Stage: confidenceScoring ───────────────────────────────────────────────
  // Input:  products[] (ExtractedProduct[])
  // Output: products[] with .confidence populated
  async function confidenceScoring(products, record, opts) {
    _log(record, 'confidence', `Scoring ${products.length} product(s)`);
    opts?.onProgress?.({ stage: 'confidence', pct: 0, msg: 'Scoring confidence…' });

    products.forEach(product => {
      product.confidence = _score(product);
    });

    const avg = products.length
      ? (products.reduce((s, p) => s + p.confidence, 0) / products.length).toFixed(2)
      : 0;
    _log(record, 'confidence', `Average confidence: ${avg}`);
    opts?.onProgress?.({ stage: 'confidence', pct: 100, msg: `Avg confidence: ${avg}` });

    return products;
  }

  function _score(product) {
    const f = product.fields;
    let total = 0;

    for (const [key, weight] of Object.entries(WEIGHTS)) {
      const field = f[key];
      if (!field || field.source === 'missing' || field.value === null) continue;

      // Field contribution = weight × field confidence
      // Inferred fields get a 20% penalty vs explicit
      const penalty = field.source === 'inferred' ? 0.80 : 1.00;
      total += weight * field.confidence * penalty;
    }

    // Bonus: strong supplier match adds up to 0.05
    const matchBonus = Math.min(0.05, (product.supplierMatch?.matchScore || 0) * 0.05);
    total += matchBonus;

    return Math.min(1, Math.max(0, total));
  }

  function _log(record, stage, msg) {
    record.processingLog.push({ ts: Date.now(), stage, msg });
  }

  P.stages.confidenceScoring = confidenceScoring;
}());
