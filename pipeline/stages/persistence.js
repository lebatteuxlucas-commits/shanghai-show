// pipeline/stages/persistence.js
// Stage 10 — Persistence
// Saves each ExtractedProduct to the PipelineStore and updates the CatalogRecord
// with the list of extracted product IDs.
(function () {
  'use strict';

  const P = (window.Pipeline = window.Pipeline || {});
  P.stages = P.stages || {};

  // ── Stage: persistence ─────────────────────────────────────────────────────
  // Input:  products[] (ExtractedProduct[]), record (CatalogRecord)
  // Output: products[] (unchanged), record updated with extractedIds[]
  async function persistence(products, record, opts) {
    _log(record, 'persistence', `Saving ${products.length} product(s) to store`);
    opts?.onProgress?.({ stage: 'persistence', pct: 0, msg: 'Saving products…' });

    const ids = [];
    products.forEach(product => {
      P.Store.addProduct(product);
      ids.push(product.id);
    });

    // Update the catalog record with the list of persisted product IDs
    record.extractedIds = ids;
    P.Store.addCatalog(record);

    _log(record, 'persistence', `Saved ${ids.length} product(s); catalog ID: ${record.id}`);
    opts?.onProgress?.({ stage: 'persistence', pct: 100, msg: `${ids.length} product(s) saved` });

    return products;
  }

  function _log(record, stage, msg) {
    record.processingLog.push({ ts: Date.now(), stage, msg });
  }

  P.stages.persistence = persistence;
}());
