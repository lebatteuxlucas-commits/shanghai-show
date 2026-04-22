// pipeline/stages/review.js
// Stage 11 — Review State Assignment
// Assigns each product to 'auto-approved' or 'pending-review' based on
// confidence score thresholds and required-field presence.
(function () {
  'use strict';

  const P = (window.Pipeline = window.Pipeline || {});
  P.stages = P.stages || {};

  // ── Thresholds ──────────────────────────────────────────────────────────────
  // A product is auto-approved when ALL conditions are met:
  //   1. Overall confidence ≥ AUTO_APPROVE_THRESHOLD
  //   2. All REQUIRED_FIELDS have non-missing values
  //   3. Supplier match score ≥ MIN_SUPPLIER_SCORE (or no score requirement if 0)
  const AUTO_APPROVE_THRESHOLD = 0.60;
  const REQUIRED_FIELDS        = ['name', 'sku', 'price'];
  const MIN_SUPPLIER_SCORE     = 0.00;  // 0 = no supplier match required

  // ── Stage: reviewAssignment ────────────────────────────────────────────────
  // Input:  products[] (ExtractedProduct[]), record (CatalogRecord)
  // Output: products[] with .reviewState updated in store
  async function reviewAssignment(products, record, opts) {
    _log(record, 'review', `Assigning review states for ${products.length} product(s)`);
    opts?.onProgress?.({ stage: 'review', pct: 0, msg: 'Assigning review states…' });

    let autoApproved = 0;
    let pendingReview = 0;

    products.forEach(product => {
      const reasons = _checkReasons(product);

      if (reasons.length === 0) {
        product.reviewState = 'auto-approved';
        autoApproved++;
      } else {
        product.reviewState = 'pending-review';
        product.reviewNotes = reasons.join('; ');
        pendingReview++;
      }

      // Persist the updated state
      P.Store.updateProduct(product.id, {
        reviewState: product.reviewState,
        reviewNotes: product.reviewNotes,
      });
    });

    _log(record, 'review', `Auto-approved: ${autoApproved}, Pending review: ${pendingReview}`);
    opts?.onProgress?.({ stage: 'review', pct: 100, msg: `${autoApproved} auto-approved, ${pendingReview} pending` });

    return products;
  }

  // Returns an array of reasons why a product needs review (empty = auto-approvable).
  function _checkReasons(product) {
    const reasons = [];

    if (product.confidence < AUTO_APPROVE_THRESHOLD) {
      reasons.push(`Low confidence (${(product.confidence * 100).toFixed(0)}% < ${AUTO_APPROVE_THRESHOLD * 100}%)`);
    }

    REQUIRED_FIELDS.forEach(key => {
      const f = product.fields[key];
      if (!f || f.source === 'missing' || f.value === null) {
        reasons.push(`Missing required field: ${key}`);
      }
    });

    if (MIN_SUPPLIER_SCORE > 0 && (product.supplierMatch?.matchScore || 0) < MIN_SUPPLIER_SCORE) {
      reasons.push(`Supplier not matched (score ${(product.supplierMatch?.matchScore || 0).toFixed(2)} < ${MIN_SUPPLIER_SCORE})`);
    }

    return reasons;
  }

  function _log(record, stage, msg) {
    record.processingLog.push({ ts: Date.now(), stage, msg });
  }

  // Expose thresholds for UI display
  P.stages.reviewAssignment = reviewAssignment;
  P.stages.reviewAssignment.AUTO_APPROVE_THRESHOLD = AUTO_APPROVE_THRESHOLD;
  P.stages.reviewAssignment.REQUIRED_FIELDS        = REQUIRED_FIELDS;
}());
