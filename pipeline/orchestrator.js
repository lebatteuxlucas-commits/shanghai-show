// pipeline/orchestrator.js
// Runs all 9 active pipeline stages in sequence and returns the CatalogRecord.
//
// Usage:
//   const record = await Pipeline.run({ file: fileObj, supplierHint: 'Xiongfeng' });
//   const record = await Pipeline.run({ file: 'mock_xiongfeng_motors' });
//
// TODO (post-MVP): add Pipeline.on/off event emitter if a detailed progress UI
// (per-stage status, streaming logs) is ever needed.
(function () {
  'use strict';

  const P = (window.Pipeline = window.Pipeline || {});

  async function run(opts) {
    if (!opts?.file) throw new Error('Pipeline.run() requires opts.file');

    const startMs = Date.now();
    const record  = await P.stages.ingestion({ file: opts.file, supplierHint: opts.supplierHint || '' });
    record._sourceFile = opts.file;
    record.status = 'processing';

    try {
      await P.stages.extraction(record);
      await P.stages.detection(record);

      if (!record.detectedBlocks.length) {
        _log(record, 'orchestrator', 'No product blocks detected');
        return _finish(record, [], startMs);
      }

      let products = await P.stages.fieldExtraction(record);
      products = await P.stages.supplierMatching(products, record);
      products = await P.stages.classification(products, record);
      products = await P.stages.confidenceScoring(products, record);
      products = await P.stages.persistence(products, record);
      products = await P.stages.reviewAssignment(products, record);

      return _finish(record, products, startMs);

    } catch (err) {
      record.status = 'failed';
      record.error  = err.message || String(err);
      _log(record, 'orchestrator', `Pipeline failed: ${record.error}`);
      P.Store.updateCatalog(record.id, { status: 'failed', error: record.error });
      throw err;
    }
  }

  function _finish(record, products, startMs) {
    record.status     = 'completed';
    record.durationMs = Date.now() - startMs;
    _log(record, 'orchestrator', `Completed in ${record.durationMs}ms — ${products.length} product(s)`);
    P.Store.updateCatalog(record.id, {
      status:       record.status,
      durationMs:   record.durationMs,
      processingLog: record.processingLog,
    });
    return record;
  }

  function _log(record, stage, msg) {
    record.processingLog.push({ ts: Date.now(), stage, msg });
  }

  P.run = run;
}());
