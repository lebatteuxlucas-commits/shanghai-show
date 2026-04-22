// pipeline/stages/field-extraction.js
// Stage 5 — Field Extraction
// Calls the LLM adapter on each product block and wraps returned raw values
// into typed FieldValue objects (explicit | inferred | missing).
(function () {
  'use strict';

  const P = (window.Pipeline = window.Pipeline || {});
  P.stages = P.stages || {};

  // ── Stage: fieldExtraction ─────────────────────────────────────────────────
  // Input:  CatalogRecord with detectedBlocks[] populated
  // Output: Array of ExtractedProduct (not yet persisted; persistence is Stage 10)
  async function fieldExtraction(record, opts) {
    const llm = P.adapters.llm;
    if (!llm) throw new Error('No LLM adapter registered at Pipeline.adapters.llm');

    _log(record, 'field-extraction', `Extracting fields from ${record.detectedBlocks.length} block(s) using "${llm.name || 'unknown'}"`);

    const context = { supplierHint: record.supplierHint || null };
    const products = [];

    for (let i = 0; i < record.detectedBlocks.length; i++) {
      const block = record.detectedBlocks[i];
      const pct   = Math.round((i / record.detectedBlocks.length) * 100);
      opts?.onProgress?.({ stage: 'field-extraction', pct, msg: `Block ${i + 1}/${record.detectedBlocks.length}` });

      let raw;
      try {
        raw = await llm.extractFields(block.rawText, context);
      } catch (err) {
        _log(record, 'field-extraction', `Block ${i}: LLM error — ${err.message}`);
        raw = {};
      }

      const product = P.models.createExtractedProduct(record.id, block.pageNum, block.blockIndex);
      _applyRaw(product.fields, raw, block.rawText);
      products.push(product);
    }

    _log(record, 'field-extraction', `Created ${products.length} ExtractedProduct(s)`);
    opts?.onProgress?.({ stage: 'field-extraction', pct: 100, msg: `${products.length} product(s) extracted` });

    return products;
  }

  // ── Map raw LLM output → typed FieldValues ─────────────────────────────────
  // We treat LLM output as "explicit" when a value is present and non-trivial.
  // A value coming from a `supplierHint` (context injection) is "inferred".
  function _applyRaw(fields, raw, blockText) {
    // String fields
    _set(fields, 'name',          raw.name,          'explicit', 0.85);
    _set(fields, 'sku',           raw.sku,            'explicit', 0.90);
    _set(fields, 'description',   raw.description,   'explicit', 0.70);
    _set(fields, 'materials',     raw.materials,     'explicit', 0.75);
    _set(fields, 'dimensions',    raw.dimensions,    'explicit', 0.80);
    _set(fields, 'compatibility', raw.compatibility, 'explicit', 0.75);
    _set(fields, 'moq',           raw.moq,           'explicit', 0.85);
    _set(fields, 'price',         raw.price,         'explicit', 0.80);
    _set(fields, 'positioning',   raw.positioning,   raw.positioning === 'mid' ? 'inferred' : 'explicit', 0.65);
    _set(fields, 'channel',       raw.channel,       raw.channel    === 'both' ? 'inferred' : 'explicit', 0.65);
    _set(fields, 'regionSuitability', raw.regionSuitability,
         raw.regionSuitability === 'unclear' ? 'inferred' : 'explicit', 0.60);

    // Array fields
    _set(fields, 'colors',         raw.colors,         'explicit', 0.80);
    _set(fields, 'certifications', raw.certifications, 'explicit', 0.85);

    // Object field: specs
    if (raw.specs && raw.specs.length) {
      fields.specs = P.models.explicitField(raw.specs, 0.80, null);
    }

    // Supplier name — injected from context, therefore inferred
    if (raw.supplierName) {
      fields.supplierName = P.models.inferredField(raw.supplierName, 0.60, null);
    }

    // images — not populated here; handled by Stage 6
  }

  function _set(fields, key, value, source, conf) {
    if (value === null || value === undefined || value === '') return;
    // Arrays: skip if empty
    if (Array.isArray(value) && value.length === 0) return;
    fields[key] = source === 'explicit'
      ? P.models.explicitField(value, conf, null)
      : P.models.inferredField(value, conf, null);
  }

  function _log(record, stage, msg) {
    record.processingLog.push({ ts: Date.now(), stage, msg });
  }

  P.stages.fieldExtraction = fieldExtraction;
}());
