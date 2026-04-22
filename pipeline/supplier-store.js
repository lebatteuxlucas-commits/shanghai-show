// pipeline/supplier-store.js
// Two lightweight stores built on localStorage:
//
//   Pipeline.SupplierStore.suppliers   — profiles for suppliers NOT in the RAW exhibitor list
//   Pipeline.SupplierStore.reconQueue  — catalogs whose supplier match needs human confirmation
//
// Supplier profile shape:
//   { id, en, cn, displayName, legalName, aliases[], website, source, catalogIds[], notes, createdAt }
//
// Reconciliation item shape:
//   { id, catalogId, status, candidateName, candidates[{exhibitorEn,exhibitorCn,score}],
//     confirmedExhibitorEn, confirmedExhibitorCn, newSupplierId, createdAt }
//   status: 'pending' | 'confirmed' | 'new-supplier' | 'skipped'
(function () {
  'use strict';

  const P = (window.Pipeline = window.Pipeline || {});
  const LS_KEY = 'fm_supplier_v1';

  let _suppliers  = new Map();  // id → supplier profile
  let _recon      = new Map();  // id → reconciliation item
  let _listeners  = [];

  // ── Persistence ────────────────────────────────────────────────────────────
  function persist() {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify({
        suppliers: [..._suppliers.values()],
        recon:     [..._recon.values()],
      }));
    } catch (e) { /* quota exceeded — silent */ }
  }

  function hydrate() {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (!raw) return;
      const data = JSON.parse(raw);
      (data.suppliers || []).forEach(s => _suppliers.set(s.id, s));
      (data.recon     || []).forEach(r => _recon.set(r.id, r));
    } catch (e) { /* corrupt — ignore */ }
  }

  function _notify() {
    _listeners.forEach(fn => { try { fn(); } catch (e) {} });
  }

  // ── Supplier profile API ───────────────────────────────────────────────────
  function addSupplier(profile) {
    const s = Object.assign({
      id:          'sp_' + Math.random().toString(36).slice(2,9) + '_' + Date.now().toString(36),
      en:          '',
      cn:          '',
      displayName: '',
      legalName:   '',
      aliases:     [],
      website:     '',
      source:      'catalog',  // 'catalog' | 'manual'
      catalogIds:  [],
      notes:       '',
      createdAt:   Date.now(),
    }, profile);
    _suppliers.set(s.id, s);
    persist();
    _notify();
    return s;
  }

  function updateSupplier(id, updates) {
    const existing = _suppliers.get(id);
    if (!existing) return null;
    const updated = Object.assign({}, existing, updates);
    _suppliers.set(id, updated);
    persist();
    _notify();
    return updated;
  }

  function getSupplier(id)    { return _suppliers.get(id) || null; }
  function getAllSuppliers()   { return [..._suppliers.values()]; }
  function deleteSupplier(id) { _suppliers.delete(id); persist(); _notify(); }

  // ── Reconciliation queue API ───────────────────────────────────────────────
  function addReconItem(item) {
    // Deduplicate by catalogId — one pending item per catalog max
    for (const r of _recon.values()) {
      if (r.catalogId === item.catalogId && r.status === 'pending') return r;
    }

    const r = Object.assign({
      id:                   'rq_' + Math.random().toString(36).slice(2,9) + '_' + Date.now().toString(36),
      catalogId:            '',
      status:               'pending',
      candidateName:        '',
      candidates:           [],   // [{ exhibitorEn, exhibitorCn, score }]
      confirmedExhibitorEn: null,
      confirmedExhibitorCn: null,
      newSupplierId:        null,
      createdAt:            Date.now(),
    }, item);
    _recon.set(r.id, r);
    persist();
    _notify();
    return r;
  }

  function updateReconItem(id, updates) {
    const existing = _recon.get(id);
    if (!existing) return null;
    const updated = Object.assign({}, existing, updates);
    _recon.set(id, updated);
    persist();
    _notify();
    return updated;
  }

  function getReconItem(id)  { return _recon.get(id) || null; }
  function getPendingRecon() {
    const result = [];
    for (const r of _recon.values()) { if (r.status === 'pending') result.push(r); }
    return result;
  }
  function getAllRecon()      { return [..._recon.values()]; }

  // Remove recon items for a deleted catalog
  function purgeReconForCatalog(catalogId) {
    for (const [id, r] of _recon) {
      if (r.catalogId === catalogId) _recon.delete(id);
    }
    persist();
  }

  function onChange(fn) { _listeners.push(fn); }

  // ── Init ───────────────────────────────────────────────────────────────────
  hydrate();

  P.SupplierStore = {
    // Supplier profiles
    addSupplier, updateSupplier, getSupplier, getAllSuppliers, deleteSupplier,
    // Reconciliation queue
    addReconItem, updateReconItem, getReconItem, getPendingRecon, getAllRecon,
    purgeReconForCatalog,
    // Subscriptions
    onChange,
    persist,
  };
}());
