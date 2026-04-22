// pipeline/models.js
// Core data models for the extraction pipeline.
// Every stage reads and writes these structures.
(function () {
  'use strict';

  const P = (window.Pipeline = window.Pipeline || {});

  // ── Helpers ────────────────────────────────────────────────────────────────
  function uid() {
    return 'px_' + Math.random().toString(36).slice(2, 10) + '_' + Date.now().toString(36);
  }

  // ── FieldValue ─────────────────────────────────────────────────────────────
  // Every extracted field carries its own provenance and confidence.
  function fieldValue(value, source, confidence, rawText) {
    return {
      value:      value ?? null,
      source:     source || 'missing',   // 'explicit' | 'inferred' | 'missing'
      confidence: typeof confidence === 'number' ? confidence : 0,
      rawText:    rawText || null,
    };
  }
  function missingField()                       { return fieldValue(null, 'missing',  0,   null); }
  function explicitField(v, conf, raw)          { return fieldValue(v,    'explicit', conf, raw); }
  function inferredField(v, conf, raw)          { return fieldValue(v,    'inferred', conf, raw); }

  // ── SupplierMatch ──────────────────────────────────────────────────────────
  function supplierMatch(exhibitorId, exhibitorEn, exhibitorCn, score, method) {
    return {
      exhibitorId:  exhibitorId  || null,
      exhibitorEn:  exhibitorEn  || null,
      exhibitorCn:  exhibitorCn  || null,
      matchScore:   score  || 0,            // 0–1
      matchMethod:  method || 'none',       // 'exact' | 'fuzzy' | 'manual' | 'none'
    };
  }

  // ── CatalogRecord ──────────────────────────────────────────────────────────
  // Created by the Ingestion stage; enriched by Extraction.
  function createCatalogRecord(opts) {
    return {
      id:               opts.id || uid(),
      supplierHint:     opts.supplierHint || '',   // from user input or filename
      fileName:         opts.fileName    || 'unknown',
      fileType:         opts.fileType    || 'unknown', // 'pdf' | 'image' | 'xlsx' | 'mock'
      fileSizeBytes:    opts.fileSizeBytes || 0,
      uploadedAt:       opts.uploadedAt  || Date.now(),
      status:           'pending',  // 'pending' | 'processing' | 'completed' | 'failed'
      pageCount:        0,
      rawPages:         [],   // string[] — one entry per page
      segmentedPages:   [],   // PageSegment[][]
      detectedBlocks:   [],   // ProductBlock[]
      extractedIds:     [],   // ExtractedProduct IDs
      processingLog:    [],   // {ts, stage, msg}[]
      error:            null,
      durationMs:       null,
    };
  }

  // ── ProductBlock ───────────────────────────────────────────────────────────
  function createProductBlock(catalogId, pageNum, rawText, blockIndex) {
    return {
      catalogId,
      pageNum,
      rawText,
      blockIndex,
    };
  }

  // ── ExtractedProduct ───────────────────────────────────────────────────────
  // Output of the full pipeline; persisted to PipelineStore.
  function createExtractedProduct(catalogId, pageNum, blockIndex) {
    return {
      id:           uid(),
      catalogId,
      sourcePage:   pageNum,
      blockIndex:   blockIndex ?? null,

      fields: {
        name:             missingField(),
        sku:              missingField(),
        supplierName:     missingField(),
        description:      missingField(),
        specs:            missingField(),   // value is {k,v}[]
        materials:        missingField(),
        dimensions:       missingField(),
        compatibility:    missingField(),
        colors:           missingField(),
        moq:              missingField(),
        price:            missingField(),
        certifications:   missingField(),
        category:         missingField(),
        positioning:      missingField(),   // 'entry' | 'mid' | 'premium'
        channel:          missingField(),   // 'OEM' | 'aftermarket' | 'both'
        regionSuitability:missingField(),   // 'EU' | 'domestic' | 'unclear'
        images:           missingField(),   // value is string[]
      },

      confidence:     0,      // 0–1 overall block confidence
      supplierMatch:  supplierMatch(),

      reviewState:    'pending-review',  // 'auto-approved' | 'pending-review' | 'approved' | 'rejected'
      reviewedBy:     null,
      reviewedAt:     null,
      reviewNotes:    '',

      createdAt:      Date.now(),
    };
  }

  // ── Public API ─────────────────────────────────────────────────────────────
  P.models = {
    uid,
    fieldValue,
    missingField,
    explicitField,
    inferredField,
    supplierMatch,
    createCatalogRecord,
    createProductBlock,
    createExtractedProduct,
  };
}());
