// pipeline/taxonomy.js
// Bicycle / e-bike specific category taxonomy + classification helpers.
(function () {
  'use strict';

  const P = (window.Pipeline = window.Pipeline || {});

  // ── Category definitions ───────────────────────────────────────────────────
  // Each entry: { id, label, keywords[] }
  // Keywords are matched against product name, description, and raw block text.
  const CATEGORIES = [
    { id: 'grips',               label: 'Grips',                      keywords: ['grip', 'handle grip', 'lock-on', 'lock on', 'bar grip'] },
    { id: 'handlebar-end-plugs', label: 'Handlebar End Plugs',        keywords: ['end plug', 'bar end', 'bar plug', 'expander', 'bar cap'] },
    { id: 'bells',               label: 'Bells',                      keywords: ['bell', 'ring bell', 'horn'] },
    { id: 'bottle-cages',        label: 'Bottle Cages',               keywords: ['bottle cage', 'water cage', 'bidon'] },
    { id: 'pedals',              label: 'Pedals',                     keywords: ['pedal', '9/16', '1/2"'] },
    { id: 'saddles',             label: 'Saddles',                    keywords: ['saddle', 'seat', 'bicycle seat'] },
    { id: 'seatposts',           label: 'Seatposts',                  keywords: ['seatpost', 'seat post', 'seat tube'] },
    { id: 'kickstands',          label: 'Kickstands',                 keywords: ['kickstand', 'kick stand', 'side stand'] },
    { id: 'locks',               label: 'Locks',                      keywords: ['u-lock', 'u lock', 'chain lock', 'folding lock', 'cable lock', 'padlock'] },
    { id: 'battery-locks',       label: 'Battery Locks',              keywords: ['battery lock', 'lock bl', 'battery latch'] },
    { id: 'battery-casings',     label: 'Battery Casings',            keywords: ['battery case', 'battery housing', 'battery casing', 'battery shell'] },
    { id: 'chargers',            label: 'Chargers',                   keywords: ['charger', 'charging', 'charge adapter', 'smart charger'] },
    { id: 'batteries',           label: 'Batteries',                  keywords: ['battery', 'lithium', 'li-ion', 'lifepo4', 'downtube', 'rack battery', 'frame battery'] },
    { id: 'hub-motors',          label: 'Hub Motors',                 keywords: ['hub motor', 'rear hub motor', 'front hub motor', 'wheel motor', 'dd motor', 'direct drive'] },
    { id: 'mid-motors',          label: 'Mid-Drive Motors',           keywords: ['mid drive', 'mid motor', 'mid-drive', 'crank motor', 'bb motor', 'bottom bracket motor'] },
    { id: 'controllers',         label: 'Controllers',                keywords: ['controller', 'sine wave', 'sinewave', 'foc controller', 'speed controller', 'motor controller'] },
    { id: 'displays',            label: 'Displays / Headunits',       keywords: ['display', 'lcd', 'led display', 'headunit', 'head unit', 'console', 'hmi'] },
    { id: 'sensors',             label: 'Sensors',                    keywords: ['sensor', 'torque sensor', 'cadence sensor', 'pas sensor', 'speed sensor', 'pedal assist'] },
    { id: 'forks',               label: 'Forks',                      keywords: ['fork', 'suspension fork', 'rigid fork', 'air fork'] },
    { id: 'helmets',             label: 'Helmets',                    keywords: ['helmet', 'head protection', 'mips'] },
    { id: 'eyewear',             label: 'Eyewear',                    keywords: ['eyewear', 'sunglasses', 'glasses', 'goggles', 'uv400'] },
    { id: 'bags',                label: 'Bags & Luggage',             keywords: ['bag', 'pannier', 'saddle bag', 'frame bag', 'handlebar bag', 'luggage'] },
    { id: 'racks',               label: 'Racks',                      keywords: ['rack', 'rear rack', 'front rack', 'carrier'] },
    { id: 'baskets',             label: 'Baskets',                    keywords: ['basket', 'front basket', 'rear basket', 'wicker basket'] },
    { id: 'lighting',            label: 'Lighting',                   keywords: ['light', 'headlight', 'front light', 'tail light', 'rear light', 'led light', 'stvzo', 'lumen'] },
    { id: 'reflectors',          label: 'Reflectors',                 keywords: ['reflector', 'pedal reflector', 'spoke reflector', 'en13895'] },
    { id: 'brakes',              label: 'Brakes',                     keywords: ['brake', 'disc brake', 'hydraulic brake', 'mechanical brake', 'v-brake'] },
    { id: 'brake-levers',        label: 'Brake Levers',               keywords: ['brake lever', 'lever', 'hydraulic lever'] },
    { id: 'disc-rotors',         label: 'Disc Rotors',                keywords: ['rotor', 'disc rotor', 'brake rotor', '160mm', '180mm', '203mm'] },
    { id: 'fenders',             label: 'Fenders',                    keywords: ['fender', 'mudguard', 'mud guard'] },
    { id: 'stems',               label: 'Stems',                      keywords: ['stem', 'ahead stem', 'threadless stem'] },
    { id: 'handlebars',          label: 'Handlebars',                 keywords: ['handlebar', 'flat bar', 'riser bar', 'drop bar', 'bullhorn'] },
    { id: 'accessories',         label: 'Accessories',                keywords: ['accessory', 'accessories', 'computer', 'mount', 'holder', 'adapter'] },
    { id: 'oem-packaging',       label: 'OEM Packaging',              keywords: ['oem pack', 'oem packaging', 'bulk pack', 'white box'] },
    { id: 'aftermarket-packaging',label:'Aftermarket Packaging',      keywords: ['retail pack', 'blister', 'aftermarket packaging', 'retail box'] },
    { id: 'tires',               label: 'Tires',                      keywords: ['tyre', 'tire', 'inner tube', 'tube', '700c', '26"', '27.5"', '29"', 'fat tire'] },
    { id: 'rims-wheels',         label: 'Rims & Wheels',              keywords: ['rim', 'wheel', 'spoke', 'wheelset'] },
    { id: 'chains',              label: 'Chains',                     keywords: ['chain', 'bicycle chain', 'chain ring'] },
    { id: 'cassettes',           label: 'Cassettes & Sprockets',      keywords: ['cassette', 'sprocket', 'freewheel', 'cogset'] },
    { id: 'derailleurs',         label: 'Derailleurs',                keywords: ['derailleur', 'rear derailleur', 'front derailleur', 'shifter'] },
    { id: 'bottom-brackets',     label: 'Bottom Brackets',            keywords: ['bottom bracket', 'bb', 'bb86', 'threaded bb'] },
    { id: 'spare-parts',         label: 'Spare Parts',                keywords: ['spare part', 'replacement', 'repair kit'] },
    { id: 'other',               label: 'Other',                      keywords: [] },
  ];

  // ── classify(text) ─────────────────────────────────────────────────────────
  // Returns { id, label, confidence } — best matching category for a text block.
  function classify(text) {
    const lower = (text || '').toLowerCase();
    let best = null;
    let bestScore = 0;

    for (const cat of CATEGORIES) {
      if (cat.id === 'other') continue;
      let score = 0;
      for (const kw of cat.keywords) {
        if (lower.includes(kw)) {
          // Longer keyword = stronger signal
          score += kw.length / 8;
        }
      }
      if (score > bestScore) {
        bestScore = score;
        best = cat;
      }
    }

    if (!best || bestScore < 0.3) {
      return { id: 'other', label: 'Other', confidence: 0.2 };
    }
    return {
      id:         best.id,
      label:      best.label,
      confidence: Math.min(0.95, 0.4 + bestScore * 0.15),
    };
  }

  // ── getCategoryById ────────────────────────────────────────────────────────
  function getCategoryById(id) {
    return CATEGORIES.find(c => c.id === id) || CATEGORIES[CATEGORIES.length - 1];
  }

  P.taxonomy = { CATEGORIES, classify, getCategoryById };
}());
