// pipeline/stages/extraction.js
// Stage 2 — Document Text Extraction
// Calls the OCR adapter to get raw page text strings.
// Updates CatalogRecord.rawPages[] and CatalogRecord.pageCount.
(function () {
  'use strict';

  const P = (window.Pipeline = window.Pipeline || {});
  P.stages = P.stages || {};

  // ── Stage: extraction ──────────────────────────────────────────────────────
  // Input:  CatalogRecord (status: 'pending'), opts? { onProgress }
  // Output: CatalogRecord with rawPages[] populated
  async function extraction(record, opts) {
    const ocr = P.adapters.ocr;
    if (!ocr) throw new Error('No OCR adapter registered at Pipeline.adapters.ocr');

    _log(record, 'extraction', `Starting OCR with adapter "${ocr.name || 'unknown'}"`);
    opts?.onProgress?.({ stage: 'extraction', pct: 0, msg: 'Extracting text…' });

    let pages;
    try {
      // Pass the original File object (or mock ID string) stored on the record.
      // The OCR adapter receives whatever was passed as `file` during ingestion.
      pages = await ocr.extractPages(record._sourceFile || record.fileName, opts);
    } catch (err) {
      record.status = 'failed';
      record.error  = err.message || String(err);
      _log(record, 'extraction', `OCR failed: ${record.error}`);
      throw err;
    }

    record.rawPages  = pages || [];
    record.pageCount = record.rawPages.length;

    _log(record, 'extraction', `Extracted ${record.pageCount} page(s)`);
    opts?.onProgress?.({ stage: 'extraction', pct: 100, msg: `${record.pageCount} page(s) extracted` });

    return record;
  }

  function _log(record, stage, msg) {
    record.processingLog.push({ ts: Date.now(), stage, msg });
  }

  P.stages.extraction = extraction;
}());
