// pipeline/stages/ingestion.js
// Stage 1 — File Ingestion
// Creates a CatalogRecord from a File object or a mock ID string.
// Does not call any adapter; only sets up the record and validates input.
(function () {
  'use strict';

  const P = (window.Pipeline = window.Pipeline || {});
  P.stages = P.stages || {};

  // ── Stage: ingestion ───────────────────────────────────────────────────────
  // Input:  { file, supplierHint? }  — file is a File object or a mock ID string
  // Output: CatalogRecord with status 'pending'
  async function ingestion({ file, supplierHint = '' }) {
    const isMock   = typeof file === 'string';
    const fileName = isMock ? file : (file.name || 'unknown');
    const fileType = isMock ? 'mock' : _detectType(fileName);
    const fileSizeBytes = isMock ? 0 : (file.size || 0);

    const record = P.models.createCatalogRecord({
      supplierHint: supplierHint || _hintFromName(fileName),
      fileName,
      fileType,
      fileSizeBytes,
    });

    _log(record, 'ingestion', `Ingested "${fileName}" (${fileType}${isMock ? ', mock' : ', ' + _fmt(fileSizeBytes)})`);
    return record;
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────
  function _detectType(name) {
    const ext = (name || '').split('.').pop().toLowerCase();
    if (ext === 'pdf')                         return 'pdf';
    if (['jpg','jpeg','png','webp'].includes(ext)) return 'image';
    if (['xlsx','xls','csv'].includes(ext))    return 'xlsx';
    return 'unknown';
  }

  // Guess a supplier hint from the filename (e.g. "suzhou_xiongfeng_motor.pdf" → "Suzhou Xiongfeng Motor")
  function _hintFromName(name) {
    return (name || '')
      .replace(/\.[^.]+$/, '')           // strip extension
      .replace(/[_\-]+/g, ' ')           // underscores/hyphens → spaces
      .replace(/\b\w/g, c => c.toUpperCase())  // Title Case
      .trim();
  }

  function _fmt(bytes) {
    if (bytes < 1024)       return bytes + 'B';
    if (bytes < 1048576)    return (bytes / 1024).toFixed(1) + 'KB';
    return (bytes / 1048576).toFixed(1) + 'MB';
  }

  function _log(record, stage, msg) {
    record.processingLog.push({ ts: Date.now(), stage, msg });
  }

  P.stages.ingestion = ingestion;
}());
