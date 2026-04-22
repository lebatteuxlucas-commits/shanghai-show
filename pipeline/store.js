// pipeline/store.js
// In-memory store with localStorage persistence.
// The single source of truth for all pipeline state.
(function () {
  'use strict';

  const P = (window.Pipeline = window.Pipeline || {});
  const LS_KEY = 'fm_pipeline_v1';

  let _catalogs  = new Map();   // id → CatalogRecord
  let _products  = new Map();   // id → ExtractedProduct
  let _listeners = [];

  // ── Persistence ────────────────────────────────────────────────────────────
  function persist() {
    try {
      const data = {
        catalogs: [..._catalogs.values()],
        products: [..._products.values()],
      };
      localStorage.setItem(LS_KEY, JSON.stringify(data));
    } catch (e) { /* quota exceeded — silent */ }
  }

  function hydrate() {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (!raw) return;
      const data = JSON.parse(raw);
      (data.catalogs || []).forEach(c => _catalogs.set(c.id, c));
      (data.products || []).forEach(p => _products.set(p.id, p));
    } catch (e) { /* corrupt data — ignore */ }
  }

  // ── Notifications ──────────────────────────────────────────────────────────
  function _notify(event, payload) {
    _listeners.forEach(fn => { try { fn(event, payload); } catch (e) {} });
  }

  // ── Catalog API ────────────────────────────────────────────────────────────
  function addCatalog(record) {
    _catalogs.set(record.id, record);
    persist();
    _notify('catalog:added', record);
    return record;
  }

  function updateCatalog(id, updates) {
    const existing = _catalogs.get(id);
    if (!existing) return null;
    const updated = Object.assign({}, existing, updates);
    _catalogs.set(id, updated);
    persist();
    _notify('catalog:updated', updated);
    return updated;
  }

  function getCatalog(id)      { return _catalogs.get(id) || null; }
  function getAllCatalogs()     { return [..._catalogs.values()]; }
  function deleteCatalog(id) {
    const c = _catalogs.get(id);
    if (!c) return;
    // Remove all associated products
    c.extractedIds.forEach(pid => _products.delete(pid));
    _catalogs.delete(id);
    persist();
    _notify('catalog:deleted', id);
    // Remove reconciliation queue items for this catalog
    if (P.SupplierStore) P.SupplierStore.purgeReconForCatalog(id);
  }

  // ── Product API ────────────────────────────────────────────────────────────
  function addProduct(product) {
    _products.set(product.id, product);
    persist();
    _notify('product:added', product);
    return product;
  }

  function updateProduct(id, updates) {
    const existing = _products.get(id);
    if (!existing) return null;
    const updated = Object.assign({}, existing, updates);
    _products.set(id, updated);
    persist();
    _notify('product:updated', updated);
    return updated;
  }

  function getProduct(id)      { return _products.get(id) || null; }
  function getAllProducts()     { return [..._products.values()]; }

  // Apply multiple product patches in one persist + notify cycle
  function batchUpdateProducts(patches) {
    patches.forEach(({ id, updates }) => {
      const existing = _products.get(id);
      if (existing) _products.set(id, Object.assign({}, existing, updates));
    });
    persist();
    _notify('product:batch-updated', null);
  }

  function getProductsByCatalog(catalogId) {
    return [..._products.values()].filter(p => p.catalogId === catalogId);
  }

  function getReviewQueue() {
    return [..._products.values()].filter(p => p.reviewState === 'pending-review');
  }

  function getAutoApproved() {
    return [..._products.values()].filter(p => p.reviewState === 'auto-approved');
  }

  function clearAll() {
    _catalogs.clear();
    _products.clear();
    persist();
    _notify('store:cleared', null);
  }

  // ── Change subscription ────────────────────────────────────────────────────
  function onChange(fn)   { _listeners.push(fn); }
  function offChange(fn)  { _listeners = _listeners.filter(l => l !== fn); }

  // ── Stats ──────────────────────────────────────────────────────────────────
  function getStats() {
    const products = [..._products.values()];
    return {
      catalogs:     _catalogs.size,
      totalProducts:products.length,
      autoApproved: products.filter(p => p.reviewState === 'auto-approved').length,
      pendingReview:products.filter(p => p.reviewState === 'pending-review').length,
      approved:     products.filter(p => p.reviewState === 'approved').length,
      rejected:     products.filter(p => p.reviewState === 'rejected').length,
    };
  }

  // ── Init ───────────────────────────────────────────────────────────────────
  hydrate();

  P.Store = {
    addCatalog, updateCatalog, getCatalog, getAllCatalogs, deleteCatalog,
    addProduct,  updateProduct,  batchUpdateProducts,  getProduct,  getAllProducts,
    getProductsByCatalog, getReviewQueue, getAutoApproved,
    clearAll,
    onChange, offChange,
    getStats,
    persist,
  };
}());
