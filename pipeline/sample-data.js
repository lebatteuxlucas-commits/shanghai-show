// pipeline/sample-data.js
// Sample catalog fixtures for UI testing — runs the 4 mock OCR catalogs
// through the full pipeline. Use the "Load sample data" button in the UI,
// or call Pipeline.sampleData.load() directly.
(function () {
  'use strict';

  const P = (window.Pipeline = window.Pipeline || {});

  const SAMPLES = [
    { id: 'mock_xiongfeng_motors',    supplierHint: 'Suzhou Xiongfeng Motor Co., Ltd.'      },
    { id: 'mock_ponely_tires',        supplierHint: 'Jiangsu Ponely Rubber Co., Ltd.'        },
    { id: 'mock_gineyea_accessories', supplierHint: 'Shenzhen Gineyea Technology Co., Ltd.'  },
    { id: 'mock_unknown_supplier',    supplierHint: ''                                        },
  ];

  // Runs each sample through the pipeline; skips catalogs already in the store.
  async function load() {
    for (const s of SAMPLES) {
      if (P.Store.getCatalog(s.id)) continue;
      await P.run({ file: s.id, supplierHint: s.supplierHint });
    }
  }

  P.sampleData = { SAMPLES, load };
}());
