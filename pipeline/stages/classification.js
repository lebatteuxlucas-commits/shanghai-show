// pipeline/stages/classification.js
// Stage 8 — Category Classification
// Uses the taxonomy module to assign a bicycle/e-bike category to each product.
// Writes into product.fields.category as a FieldValue.
(function () {
  'use strict';

  const P = (window.Pipeline = window.Pipeline || {});
  P.stages = P.stages || {};

  // ── Stage: classification ──────────────────────────────────────────────────
  // Input:  products[] (ExtractedProduct[]), record (CatalogRecord)
  // Output: products[] with fields.category populated
  async function classification(products, record, opts) {
    _log(record, 'classification', `Classifying ${products.length} product(s)`);
    opts?.onProgress?.({ stage: 'classification', pct: 0, msg: 'Classifying products…' });

    products.forEach((product, i) => {
      // Build a combined search text from name, description, and the raw block
      const nameTxt  = product.fields.name?.value         || '';
      const descTxt  = product.fields.description?.value  || '';
      const block    = record.detectedBlocks.find(b => b.blockIndex === product.blockIndex);
      const rawText  = block?.rawText || '';

      const combined = [nameTxt, descTxt, rawText].join(' ');
      const result   = P.taxonomy.classify(combined);

      const source = result.confidence >= 0.55 ? 'explicit' : 'inferred';
      product.fields.category = source === 'explicit'
        ? P.models.explicitField({ id: result.id, label: result.label }, result.confidence, null)
        : P.models.inferredField({ id: result.id, label: result.label }, result.confidence, null);
    });

    const classified = products.filter(p => p.fields.category?.value?.id !== 'other').length;
    _log(record, 'classification', `Classified ${classified}/${products.length} product(s) to a specific category`);
    opts?.onProgress?.({ stage: 'classification', pct: 100, msg: `${classified}/${products.length} classified` });

    return products;
  }

  function _log(record, stage, msg) {
    record.processingLog.push({ ts: Date.now(), stage, msg });
  }

  P.stages.classification = classification;
}());
