// pipeline/stages/detection.js
// Stage 3 — Product Block Detection
// Splits raw page text into product blocks, stored in CatalogRecord.detectedBlocks[].
// Segmentation is handled inline — no separate stage needed for V1.
// POST-MVP: extract into its own stage when real OCR needs richer typing (tables, images, multi-column).
(function () {
  'use strict';

  const P = (window.Pipeline = window.Pipeline || {});
  P.stages = P.stages || {};

  async function detection(record) {
    const blocks = [];
    let blockIndex = 0;

    record.rawPages.forEach((pageText, pageIdx) => {
      if (_isCoverPage(pageText, pageIdx)) return;
      const pageBlocks = _blocksFromPage(pageText, pageIdx + 1, record.id, blockIndex);
      blockIndex += pageBlocks.length;
      blocks.push(...pageBlocks);
    });

    record.detectedBlocks = blocks;
    _log(record, 'detection', `Detected ${blocks.length} product block(s) from ${record.rawPages.length} page(s)`);
    return record;
  }

  // ── Block detection ────────────────────────────────────────────────────────
  // Split page on blank lines, accumulate chunks into blocks, flush on product
  // boundaries. Falls back to treating the whole page as one block.
  function _blocksFromPage(pageText, pageNum, catalogId, startIndex) {
    const chunks = pageText.split(/\n{2,}/).map(c => c.trim()).filter(Boolean);
    const blocks  = [];
    let acc = [];

    chunks.forEach((chunk, i) => {
      const isProduct = /^PRODUCT:/im.test(chunk) || /^Reference[:\s]/im.test(chunk);
      const isTable   = _isTableChunk(chunk);

      // Flush accumulated block when a new product header starts
      if (isProduct && acc.length > 0) {
        blocks.push(P.models.createProductBlock(catalogId, pageNum, acc.join('\n\n'), startIndex + blocks.length));
        acc = [];
      }

      if (isProduct || isTable || acc.length > 0) acc.push(chunk);
    });

    if (acc.length > 0) {
      blocks.push(P.models.createProductBlock(catalogId, pageNum, acc.join('\n\n'), startIndex + blocks.length));
    }

    // Fallback: nothing matched structural hints — treat whole page as one block
    if (blocks.length === 0) {
      blocks.push(P.models.createProductBlock(catalogId, pageNum, pageText, startIndex));
    }

    return blocks;
  }

  function _isTableChunk(chunk) {
    const lines   = chunk.split('\n');
    const kvLines = lines.filter(l => /^[A-Z][A-Za-z /()°]+:\s+.+/.test(l));
    return kvLines.length >= 3 && kvLines.length / lines.length > 0.4;
  }

  // Skip first-page cover sheets that contain no product data
  function _isCoverPage(text, pageIdx) {
    if (pageIdx > 0) return false;
    const lc = text.toLowerCase();
    return (lc.includes('catalog') || lc.includes('catalogue') ||
            lc.includes('co., ltd') || lc.includes('hall e')) &&
           !(/^PRODUCT:/im.test(text));
  }

  function _log(record, stage, msg) {
    record.processingLog.push({ ts: Date.now(), stage, msg });
  }

  P.stages.detection = detection;
}());
